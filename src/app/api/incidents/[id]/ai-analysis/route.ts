import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { callGeminiAPI, getGeminiConfig } from '@/lib/gemini';
import { getServiceNowConfig, fetchServiceNowAPI } from '@/lib/servicenow';

export const dynamic = 'force-dynamic';

function trunc(str: string | null | undefined, max: number): string {
  if (!str) return 'N/A';
  return str.length > max ? str.slice(0, max) + '…' : str;
}

// Stop words to filter out when generating keyword tokens
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'have', 'been',
  'issue', 'error', 'spike', 'problem', 'incident', 'outage', 'status',
  'down', 'slow', 'fail', 'failure', 'alert', 'critical', 'high', 'low',
  'loss', 'packet', 'unable', 'please', 'check', 'detected', 'reported',
  'service', 'system', 'site', 'sites', 'portal', 'user', 'users'
]);

function extractKeywords(texts: (string | null | undefined)[]): string[] {
  const words: string[] = [];
  for (const text of texts) {
    if (!text) continue;
    const tokens = text
      .toLowerCase()
      .replace(/[^a-z0-9\s_-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
    words.push(...tokens);
  }
  // Return unique keywords up to 8
  return Array.from(new Set(words)).slice(0, 8);
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    // 1. Fetch current incident from local database
    const incident = await prisma.incident.findFirst({
      where: { OR: [{ id }, { number: id }] },
      include: {
        updates: { orderBy: { updateNumber: 'asc' } },
        sites: { include: { site: true } },
      },
    });

    if (!incident) {
      return NextResponse.json({ success: false, error: 'Incident not found' }, { status: 404 });
    }

    // 2. Extract domain keywords from CI, CTI, Short Description, and Description
    const keywords = extractKeywords([
      incident.cmdbCi,
      incident.cti,
      incident.shortDescription,
      incident.description,
      incident.businessService,
    ]);

    // Calculate timestamp for 10 days ago (ISO string for ServiceNow query)
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const tenDaysAgoStr = tenDaysAgo.toISOString().split('T')[0] + ' 00:00:00';

    // 3. Parallel Fetch: Local Portal History + ServiceNow Live MCP Data
    const [allPortalIncidents, geminiConfig, snConfig] = await Promise.all([
      prisma.incident.findMany({
        where: { id: { not: incident.id } },
        select: {
          number: true,
          priority: true,
          status: true,
          shortDescription: true,
          assignmentGroup: true,
          businessService: true,
          cti: true,
          aiRootCause: true,
          updates: {
            select: { comment: true },
            orderBy: { updateNumber: 'asc' },
            take: 2,
          },
        },
        orderBy: { openedAt: 'desc' },
        take: 20,
      }),
      getGeminiConfig(),
      getServiceNowConfig(),
    ]);

    // 4. Live ServiceNow MCP Search Queries
    let serviceNowData: any = null;
    let snSimilarIncidents: any[] = [];
    let snChangeRequests: any[] = [];
    let snKbArticles: any[] = [];

    try {
      const cleanNum = incident.number.trim().toUpperCase();
      const isSysId = /^[0-9a-f]{32}$/i.test(cleanNum);
      const exactIncQuery = isSysId ? `sys_id=${cleanNum}` : `number=${cleanNum}`;

      // Build keyword search queries
      const kwIncQuery = keywords.length > 0
        ? keywords.map((k) => `short_descriptionLIKE${k}^ORdescriptionLIKE${k}^ORcmdb_ci.nameLIKE${k}`).join('^OR')
        : 'active=false';

      const kwChgQuery = keywords.length > 0
        ? keywords.map((k) => `short_descriptionLIKE${k}^ORdescriptionLIKE${k}^ORcmdb_ci.nameLIKE${k}`).join('^OR')
        : 'ORDERBYDESCsys_created_on';

      const kwKbQuery = keywords.length > 0
        ? `workflow_state=published^` + keywords.map((k) => `short_descriptionLIKE${k}^ORtextLIKE${k}`).join('^OR')
        : 'workflow_state=published^ORDERBYDESCsys_view_count';

      const [exactRes, similarIncRes, chgRes, kbRes] = await Promise.all([
        // Query A: Exact incident record
        fetchServiceNowAPI(`/api/now/table/incident?sysparm_query=${exactIncQuery}&sysparm_display_value=true&sysparm_limit=1`),
        // Query B: Similar real incidents in ServiceNow (with resolution close_notes)
        fetchServiceNowAPI(`/api/now/table/incident?sysparm_query=${encodeURIComponent(kwIncQuery + '^ORDERBYDESCopened_at')}&sysparm_display_value=true&sysparm_limit=6&sysparm_fields=number,short_description,description,assignment_group,cmdb_ci,close_notes,state,priority,opened_at,closed_at`),
        // Query C: Recent changes in last 10 days matching CI or description
        fetchServiceNowAPI(`/api/now/table/change_request?sysparm_query=${encodeURIComponent(kwChgQuery + `^ORsys_created_on>=${tenDaysAgoStr}^ORDERBYDESCsys_created_on`)}&sysparm_display_value=true&sysparm_limit=6&sysparm_fields=number,short_description,description,cmdb_ci,risk,state,type,sys_created_on,start_date`),
        // Query D: Knowledge base articles matching CI or description
        fetchServiceNowAPI(`/api/now/table/kb_knowledge?sysparm_query=${encodeURIComponent(kwKbQuery)}&sysparm_display_value=true&sysparm_limit=5&sysparm_fields=number,short_description,topic,workflow_state,sys_view_count,text`),
      ]);

      if (exactRes.ok) {
        const json = await exactRes.json();
        if (json.result && json.result.length > 0) serviceNowData = json.result[0];
      }

      if (similarIncRes.ok) {
        const json = await similarIncRes.json();
        snSimilarIncidents = (json.result || []).filter((i: any) => {
          const num = i.number?.display_value || i.number;
          return num && num !== cleanNum;
        });
      }

      // If keyword search had no similar incidents, fetch top recent closed incidents to learn resolution steps
      if (snSimilarIncidents.length === 0) {
        const fallbackIncRes = await fetchServiceNowAPI(`/api/now/table/incident?sysparm_query=ORDERBYDESCopened_at&sysparm_display_value=true&sysparm_limit=5&sysparm_fields=number,short_description,assignment_group,close_notes,state,priority`);
        if (fallbackIncRes.ok) {
          const json = await fallbackIncRes.json();
          snSimilarIncidents = (json.result || []).filter((i: any) => {
            const num = i.number?.display_value || i.number;
            return num && num !== cleanNum;
          });
        }
      }

      if (chgRes.ok) {
        const json = await chgRes.json();
        snChangeRequests = json.result || [];
      }

      if (kbRes.ok) {
        const json = await kbRes.json();
        snKbArticles = json.result || [];
      }

      // Fallback for KBs if none found
      if (snKbArticles.length === 0) {
        const fallbackKbRes = await fetchServiceNowAPI(`/api/now/table/kb_knowledge?sysparm_query=workflow_state=published&sysparm_display_value=true&sysparm_limit=4&sysparm_fields=number,short_description,topic`);
        if (fallbackKbRes.ok) {
          const json = await fallbackKbRes.json();
          snKbArticles = json.result || [];
        }
      }
    } catch (snErr) {
      console.warn('[AI Analysis] ServiceNow live MCP lookup error:', snErr);
    }

    // 5. Clean & Format Data Context for AI
    const snIncidentsContext = snSimilarIncidents.map((i: any) => {
      const num = i.number?.display_value || i.number;
      const desc = i.short_description?.display_value || i.short_description;
      const grp = i.assignment_group?.display_value || i.assignment_group || 'Unassigned';
      const closeNotes = i.close_notes?.display_value || i.close_notes || 'Resolved by engineering triage.';
      const prio = i.priority?.display_value || i.priority || 'P3';
      const st = i.state?.display_value || i.state || 'Closed';
      return { number: num, shortDescription: desc, assignmentGroup: grp, closeNotes, priority: prio, state: st };
    });

    const snChangesContext = snChangeRequests.map((c: any) => {
      const num = c.number?.display_value || c.number;
      const desc = c.short_description?.display_value || c.short_description;
      const ci = c.cmdb_ci?.display_value || c.cmdb_ci || 'General CI';
      const risk = c.risk?.display_value || c.risk || 'Moderate';
      const state = c.state?.display_value || c.state || 'Implemented';
      const created = c.sys_created_on?.display_value || c.sys_created_on;
      return { number: num, shortDescription: desc, ci, risk, state, created };
    });

    const snKbsContext = snKbArticles.map((k: any) => {
      const num = k.number?.display_value || k.number;
      const title = k.short_description?.display_value || k.short_description;
      const topic = k.topic?.display_value || k.topic || 'Operations';
      return { number: num, title, topic };
    });

    // 6. Centralized Gemini AI Synthesis
    let analysis: any = null;
    let modelUsed = 'algorithmic-fallback';

    if (geminiConfig.apiKey) {
      try {
        const updateNotes = incident.updates
          .slice(0, 6)
          .map((u) => `#${u.updateNumber}: ${trunc(u.comment, 120)}`)
          .join('\n');

        const prompt = `You are a Principal Enterprise Incident Management AI Analyst.
Analyze the current incident using verified real ServiceNow data and Portal knowledge.

CRITICAL INSTRUCTION ON INCIDENT NUMBERS:
You MUST ONLY reference real incident numbers provided in the "REAL SERVICENOW INCIDENTS" and "PORTAL HISTORICAL INCIDENTS" sections below. NEVER hallucinate, invent, or make up incident numbers.

CURRENT INCIDENT:
- Number: ${incident.number}
- Short Description: ${incident.shortDescription}
- Description: ${incident.description || 'N/A'}
- Priority: ${incident.priority}
- Current Assignment Group: ${incident.assignmentGroup || 'Unassigned'}
- CI: ${incident.cmdbCi || 'N/A'}
- Category / CTI: ${incident.cti || 'N/A'}
- Business Service: ${incident.businessService || 'N/A'}
- Updates:
${updateNotes || 'No timeline updates posted yet.'}

REAL SERVICENOW INCIDENTS (From live ServiceNow instance):
${JSON.stringify(snIncidentsContext, null, 1)}

REAL SERVICENOW CHANGE REQUESTS (Last 10 days / Correlated):
${JSON.stringify(snChangesContext, null, 1)}

REAL SERVICENOW KNOWLEDGE BASE ARTICLES:
${JSON.stringify(snKbsContext, null, 1)}

PORTAL HISTORICAL INCIDENTS:
${JSON.stringify(allPortalIncidents.slice(0, 6).map((p) => ({ number: p.number, title: p.shortDescription, group: p.assignmentGroup, rootCause: p.aiRootCause })), null, 1)}

OUTPUT REQUIREMENTS (Return ONLY valid JSON):
{
  "assignmentGroupRecommendation": {
    "recommended": "<Exact best group based on matching ServiceNow or portal history>",
    "confidence": "HIGH" | "MEDIUM" | "LOW",
    "reasoning": "<1-2 sentences explaining why this group was chosen referencing matching tickets>",
    "alternateGroups": ["<alternateGroup1>", "<alternateGroup2>"]
  },
  "resolutionSteps": [
    {
      "stepNumber": 1,
      "action": "<Specific technical step synthesized from ServiceNow close_notes and timeline>",
      "responsible": "<Team or role>",
      "priority": "IMMEDIATE" | "SHORT_TERM" | "LONG_TERM",
      "rationale": "<Why, citing resolution notes of similar issues>",
      "source": "ServiceNow Resolution Notes & Portal Playbooks"
    }
  ],
  "recentChanges": [
    {
      "changeNumber": "<CHG number from the list above>",
      "shortDescription": "<Change description>",
      "ci": "<CI>",
      "risk": "<Risk level>",
      "state": "<State>",
      "createdDate": "<Created date>",
      "correlationScore": "HIGH" | "MEDIUM" | "LOW",
      "correlationReason": "<Why this change might have triggered or is related to the outage>"
    }
  ],
  "suggestedKbArticles": [
    {
      "kbNumber": "<KB number from the list above>",
      "title": "<KB title>",
      "topic": "<Topic>",
      "relevanceReason": "<Why relevant to this outage>",
      "recommendedAction": "<How engineers should apply this article>"
    }
  ],
  "relatedIncidents": [
    {
      "incidentNumber": "<ONLY real number from REAL SERVICENOW INCIDENTS or PORTAL HISTORICAL INCIDENTS>",
      "source": "ServiceNow" | "Portal",
      "shortDescription": "<Short description>",
      "priority": "<Priority>",
      "assignmentGroup": "<Group>",
      "status": "<Status>",
      "similarityReason": "<Why related>",
      "resolutionNotes": "<Exact close_notes / resolution details from that ticket>"
    }
  ],
  "impactAssessment": "<1-2 sentences summarizing business and site impact>",
  "urgencyNote": "<Observation on recovery velocity and change correlation>"
}`;

        const geminiResult = await callGeminiAPI({
          prompt,
          temperature: 0.2,
          maxOutputTokens: 3500,
          jsonOutput: true,
        });

        if (geminiResult.parsedJson) {
          analysis = geminiResult.parsedJson;
          modelUsed = geminiResult.modelUsed;
        } else if (geminiResult.text) {
          const cleanText = geminiResult.text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
          analysis = JSON.parse(cleanText);
          modelUsed = geminiResult.modelUsed;
        }
      } catch (geminiErr) {
        console.warn('[AI Analysis] Gemini API call fallback triggered:', geminiErr);
      }
    }

    // 7. Deterministic Fallback Engine (Guarantees authentic ServiceNow data)
    if (!analysis) {
      // Build related incidents strictly from real ServiceNow tickets
      const related = snIncidentsContext.slice(0, 4).map((i) => ({
        incidentNumber: i.number,
        source: 'ServiceNow',
        shortDescription: i.shortDescription,
        priority: i.priority,
        assignmentGroup: i.assignmentGroup,
        status: i.state,
        similarityReason: `Matches related domain in ServiceNow instance.`,
        resolutionNotes: i.closeNotes,
      }));

      // Determine best assignment group from matching ServiceNow tickets or current
      const primaryGroup = snIncidentsContext[0]?.assignmentGroup !== 'Unassigned'
        ? snIncidentsContext[0]?.assignmentGroup
        : (incident.assignmentGroup || 'Network Infrastructure Team');

      // Synthesize resolution steps from ServiceNow close notes
      const resolutionSteps = [
        {
          stepNumber: 1,
          action: `Engage ${primaryGroup} on the active Microsoft Teams Command Bridge.`,
          responsible: 'Incident Commander',
          priority: 'IMMEDIATE',
          rationale: 'Establish technical triage lead and verify live error telemetry.',
          source: 'Standard CIM Playbook',
        },
        {
          stepNumber: 2,
          action: snIncidentsContext[0]?.closeNotes && snIncidentsContext[0].closeNotes.length > 10
            ? `Apply remediation based on ${snIncidentsContext[0].number} resolution: ${snIncidentsContext[0].closeNotes}`
            : 'Inspect network interfaces, reboot impacted services, and check routing tables for packet loss.',
          responsible: primaryGroup,
          priority: 'IMMEDIATE',
          rationale: `Derived from matching ServiceNow incident ${snIncidentsContext[0]?.number || 'history'}.`,
          source: 'ServiceNow Live Resolution Notes',
        },
        {
          stepNumber: 3,
          action: 'Cross-reference recent ServiceNow change deployments to verify no conflicting configurations were pushed.',
          responsible: 'Change Management / Operations Lead',
          priority: 'SHORT_TERM',
          rationale: 'Rule out unauthorized changes or unexpected dependencies from recent releases.',
          source: 'ServiceNow Change Correlation',
        },
        {
          stepNumber: 4,
          action: 'Validate telemetry across all impacted facilities and conduct end-user validation before closing.',
          responsible: 'Site IT Coordinator',
          priority: 'SHORT_TERM',
          rationale: 'Ensure full operational recovery across all affected locations.',
          source: 'CIM Operational Verification',
        },
      ];

      // Recent changes
      const recentChanges = snChangesContext.slice(0, 4).map((c, idx) => ({
        changeNumber: c.number,
        shortDescription: c.shortDescription,
        ci: c.ci,
        risk: c.risk,
        state: c.state,
        createdDate: c.created,
        correlationScore: idx === 0 ? 'HIGH' : 'MEDIUM',
        correlationReason: `Change deployed to ${c.ci || 'infrastructure'} during recent change window. Review release logs.`,
      }));

      // Suggested KBs
      const suggestedKbArticles = snKbsContext.slice(0, 4).map((k) => ({
        kbNumber: k.number,
        title: k.title,
        topic: k.topic,
        relevanceReason: `Published ServiceNow KB article covering ${k.topic || 'troubleshooting procedures'}.`,
        recommendedAction: 'Follow standard verification procedures outlined in this article.',
      }));

      analysis = {
        assignmentGroupRecommendation: {
          recommended: primaryGroup,
          confidence: snIncidentsContext.length > 0 ? 'HIGH' : 'MEDIUM',
          reasoning: `Recommended based on matching ServiceNow incident resolutions (${snIncidentsContext.map((i) => i.number).join(', ') || 'historical patterns'}).`,
          alternateGroups: ['Database Administration', 'Wintel Server Operations', 'Enterprise Service Desk'],
        },
        resolutionSteps,
        recentChanges,
        suggestedKbArticles,
        relatedIncidents: related,
        impactAssessment: `Disruption impacting ${incident.sites?.length || 1} site facility with active response underway.`,
        urgencyNote: snChangesContext.length > 0
          ? `⚠️ Correlated with ${snChangesContext.length} ServiceNow Change Requests (${snChangesContext.map((c) => c.number).join(', ')}). Review change deployment logs.`
          : 'Service restoration in progress. Follow standard SLA cadences.',
      };
    }

    // 8. Enrich with ServiceNow MCP Metadata
    const serviceNowTelemetry = {
      connected: !!serviceNowData || snSimilarIncidents.length > 0,
      instanceUrl: snConfig.instanceUrl,
      liveIncident: serviceNowData ? {
        number: serviceNowData.number?.display_value || serviceNowData.number,
        state: serviceNowData.state?.display_value || serviceNowData.state,
        priority: serviceNowData.priority?.display_value || serviceNowData.priority,
        assignmentGroup: serviceNowData.assignment_group?.display_value || serviceNowData.assignment_group,
        cmdbCi: serviceNowData.cmdb_ci?.display_value || serviceNowData.cmdb_ci,
      } : null,
      totalSimilarIncsFound: snSimilarIncidents.length,
      totalChangesFound: snChangeRequests.length,
      totalKbsFound: snKbArticles.length,
    };

    return NextResponse.json({
      success: true,
      analysis,
      incidentNumber: incident.number,
      modelUsed,
      serviceNowTelemetry,
    });
  } catch (err: any) {
    console.error('[AI Analysis API] Error:', err);
    return NextResponse.json({ success: false, error: err.message || 'AI analysis failed' }, { status: 500 });
  }
}

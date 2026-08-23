import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { callGeminiAPI, getGeminiConfig } from '@/lib/gemini';
import { getServiceNowConfig, fetchServiceNowAPI } from '@/lib/servicenow';

export const dynamic = 'force-dynamic';

function trunc(str: string | null | undefined, max: number): string {
  if (!str) return 'N/A';
  return str.length > max ? str.slice(0, max) + '…' : str;
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    // 1. Fetch the current incident from local DB
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

    // 2. Parallel data gathering: Portal History + ServiceNow Live MCP
    const [allIncidents, geminiConfig, snConfig] = await Promise.all([
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
        take: 30,
      }),
      getGeminiConfig(),
      getServiceNowConfig(),
    ]);

    // 3. ServiceNow MCP Telemetry & Change Request Correlation
    let serviceNowData: any = null;
    let snChangeRequests: any[] = [];
    let snKbArticles: any[] = [];

    try {
      const cleanNum = incident.number.trim().toUpperCase();
      const isSysId = /^[0-9a-f]{32}$/i.test(cleanNum);
      const queryParam = isSysId ? `sys_id=${cleanNum}` : `number=${cleanNum}`;

      const [snIncRes, snChgRes, snKbRes] = await Promise.all([
        fetchServiceNowAPI(`/api/now/table/incident?sysparm_query=${queryParam}&sysparm_display_value=true&sysparm_limit=1`),
        fetchServiceNowAPI('/api/now/table/change_request?sysparm_query=ORDERBYDESCsys_created_on&sysparm_limit=3&sysparm_display_value=true'),
        fetchServiceNowAPI(`/api/now/table/kb_knowledge?sysparm_query=workflow_state=published^short_descriptionLIKE${encodeURIComponent(incident.cti || incident.shortDescription.split(' ')[0] || 'incident')}&sysparm_limit=2&sysparm_display_value=true`),
      ]);

      if (snIncRes.ok) {
        const snIncJson = await snIncRes.json();
        if (snIncJson.result && snIncJson.result.length > 0) {
          serviceNowData = snIncJson.result[0];
        }
      }

      if (snChgRes.ok) {
        const snChgJson = await snChgRes.json();
        snChangeRequests = snChgJson.result || [];
      }

      if (snKbRes.ok) {
        const snKbJson = await snKbRes.json();
        snKbArticles = snKbJson.result || [];
      }
    } catch (snErr) {
      console.warn('[AI Analysis] ServiceNow live MCP lookup notice:', snErr);
    }

    // Build timeline updates summary
    const updateNotes = incident.updates
      .slice(0, 6)
      .map((u) => `#${u.updateNumber}: ${trunc(u.comment, 120)}`)
      .join('\n');

    // Build historical incident summary lines
    const historicalLines = allIncidents.map((inc) => {
      const firstUpdate = trunc(inc.updates[0]?.comment, 100);
      return `${inc.number}|${inc.priority}|${inc.status}|${inc.assignmentGroup || '?'}|${inc.cti || '?'}|${trunc(inc.shortDescription, 80)}|${trunc(inc.aiRootCause, 100)}|upd:${firstUpdate}`;
    }).join('\n');

    // 4. Centralized Gemini AI Analysis
    let analysis: any = null;
    let modelUsed = 'algorithmic-fallback';

    if (geminiConfig.apiKey) {
      try {
        const prompt = `You are a Principal IT Major Incident Management AI Analyst.
Analyze this critical IT incident using the Portal Data, ServiceNow Live MCP Telemetry, and Historical Knowledge Base.

CURRENT INCIDENT:
- Number: ${incident.number}
- Short Description: ${trunc(incident.shortDescription, 250)}
- Description: ${trunc(incident.description, 350)}
- Priority: ${incident.priority}
- Current Assignment Group: ${incident.assignmentGroup || 'Unassigned'}
- CTI Category: ${incident.cti || 'N/A'}
- Business Service: ${incident.businessService || 'N/A'}
- CMDB CI: ${incident.cmdbCi || 'N/A'}
- Status: ${incident.status}
- Impacted Sites: ${incident.sites?.map((s: any) => s.site?.name).filter(Boolean).join(', ') || 'N/A'}

TIMELINE UPDATES:
${updateNotes || 'No timeline updates posted yet.'}

SERVICENOW LIVE MCP CONTEXT:
${serviceNowData ? `- Live ServiceNow State: ${serviceNowData.state?.display_value || serviceNowData.state}\n- Live Assignment Group: ${serviceNowData.assignment_group?.display_value || serviceNowData.assignment_group}\n- Live CI: ${serviceNowData.cmdb_ci?.display_value || serviceNowData.cmdb_ci || 'None'}` : 'No live ServiceNow record found.'}
${snChangeRequests.length > 0 ? `- Recent Change Requests (CHG):\n${snChangeRequests.map((c: any) => `  * ${c.number?.display_value || c.number} (${c.state?.display_value || c.state}, Risk: ${c.risk?.display_value || c.risk}): ${c.short_description?.display_value || c.short_description}`).join('\n')}` : ''}
${snKbArticles.length > 0 ? `- Knowledge Base Articles (KB):\n${snKbArticles.map((k: any) => `  * ${k.number?.display_value || k.number}: ${k.short_description?.display_value || k.short_description}`).join('\n')}` : ''}

PORTAL HISTORICAL INCIDENTS:
${historicalLines || 'No previous historical incidents.'}

OUTPUT REQUIREMENTS:
Return valid JSON adhering strictly to this schema:
{
  "assignmentGroupRecommendation": {
    "recommended": "<best assignment group name>",
    "confidence": "HIGH" | "MEDIUM" | "LOW",
    "reasoning": "<1-2 sentences explaining why based on CTI, CI, and symptoms>",
    "alternateGroups": ["<group2>", "<group3>"]
  },
  "relatedIncidents": [
    {
      "incidentNumber": "<INC number>",
      "shortDescription": "<short description>",
      "priority": "P1" | "P2" | "P3" | "P4",
      "assignmentGroup": "<group>",
      "status": "RESOLVED" | "CLOSED" | "INVESTIGATING",
      "similarityReason": "<1 sentence on why it is similar>",
      "resolution": "<how the issue was mitigated/resolved>"
    }
  ],
  "resolutionSteps": [
    {
      "stepNumber": 1,
      "action": "<specific technical remediation action>",
      "responsible": "<team/role>",
      "priority": "IMMEDIATE" | "SHORT_TERM" | "LONG_TERM",
      "rationale": "<technical justification>"
    }
  ],
  "impactAssessment": "<1-2 sentences on user, site, and operational business exposure>",
  "urgencyNote": "<observation on escalation velocity, SLA thresholds, and change correlation>"
}`;

        const geminiResult = await callGeminiAPI({
          prompt,
          temperature: 0.2,
          maxOutputTokens: 3000,
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

    // 5. Intelligent Algorithmic Fallback Engine
    if (!analysis) {
      const topSimilar = allIncidents
        .filter((inc) => inc.assignmentGroup === incident.assignmentGroup || (incident.cti && inc.cti && inc.cti.includes(incident.cti.split('/')[0].trim())))
        .slice(0, 4)
        .map((inc) => ({
          incidentNumber: inc.number,
          shortDescription: inc.shortDescription,
          priority: inc.priority,
          assignmentGroup: inc.assignmentGroup || 'Support Team',
          status: inc.status,
          similarityReason: `Matches ${inc.assignmentGroup || 'assigned team'} domain and related IT service components.`,
          resolution: inc.aiRootCause || 'Resolved by engineering lead following node reboot and telemetry stabilization.',
        }));

      analysis = {
        assignmentGroupRecommendation: {
          recommended: incident.assignmentGroup || 'Network Infrastructure Team',
          confidence: incident.assignmentGroup ? 'HIGH' : 'MEDIUM',
          reasoning: `Recommended based on incident CTI profile (${incident.cti || 'IT Service'}) and primary CI telemetry (${incident.cmdbCi || 'Active Cluster'}).`,
          alternateGroups: ['Database Administration', 'Wintel Server Operations', 'Enterprise Service Desk'],
        },
        relatedIncidents: topSimilar,
        resolutionSteps: [
          {
            stepNumber: 1,
            action: `Engage ${incident.assignmentGroup || 'Lead Support Team'} on the active Microsoft Teams Command Bridge.`,
            responsible: 'Incident Commander',
            priority: 'IMMEDIATE',
            rationale: 'Verify live telemetry and confirm secondary node health.',
          },
          {
            stepNumber: 2,
            action: 'Inspect recent ServiceNow Change Requests and deployment logs for correlated updates.',
            responsible: 'Operations Lead',
            priority: 'IMMEDIATE',
            rationale: 'Isolate potential configuration drift or unauthorized change execution.',
          },
          {
            stepNumber: 3,
            action: 'Execute service diagnostics and initiate failover to standby node if error rate persists.',
            responsible: incident.assignmentGroup || 'Engineering Team',
            priority: 'SHORT_TERM',
            rationale: 'Restore transaction processing within SLA thresholds.',
          },
          {
            stepNumber: 4,
            action: 'Perform user validation at impacted sites and verify latency metrics before resolving ticket.',
            responsible: 'Site Coordinator',
            priority: 'SHORT_TERM',
            rationale: 'Confirm complete service restoration across all impacted facilities.',
          },
        ],
        impactAssessment: `Priority ${incident.priority} disruption impacting ${incident.sites?.length || 1} facility locations with active triage underway.`,
        urgencyNote: snChangeRequests.length > 0
          ? `⚠️ Correlated with ${snChangeRequests.length} recent ServiceNow Change Requests (${snChangeRequests.map((c: any) => c.number?.display_value || c.number).join(', ')}). Review change deployment times.`
          : 'Service restoration in progress. Follow standard P1/P2 cadence for status updates.',
      };
    }

    // 6. Enrich with ServiceNow Live MCP Metadata
    const serviceNowTelemetry = {
      connected: !!serviceNowData,
      instanceUrl: snConfig.instanceUrl,
      liveIncident: serviceNowData ? {
        number: serviceNowData.number?.display_value || serviceNowData.number,
        state: serviceNowData.state?.display_value || serviceNowData.state,
        priority: serviceNowData.priority?.display_value || serviceNowData.priority,
        assignmentGroup: serviceNowData.assignment_group?.display_value || serviceNowData.assignment_group,
        cmdbCi: serviceNowData.cmdb_ci?.display_value || serviceNowData.cmdb_ci,
      } : null,
      changeRequestsCount: snChangeRequests.length,
      changeRequests: snChangeRequests.map((c: any) => ({
        number: c.number?.display_value || c.number,
        shortDescription: c.short_description?.display_value || c.short_description,
        risk: c.risk?.display_value || c.risk,
        state: c.state?.display_value || c.state,
      })),
      kbArticlesCount: snKbArticles.length,
      kbArticles: snKbArticles.map((k: any) => ({
        number: k.number?.display_value || k.number,
        title: k.short_description?.display_value || k.short_description,
      })),
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

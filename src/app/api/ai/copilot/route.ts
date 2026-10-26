import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getGeminiConfig, callGeminiAPI } from '@/lib/gemini';
import { getServiceNowConfig, fetchServiceNowAPI } from '@/lib/servicenow';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function priorityEmoji(p: string): string {
  switch (p) {
    case 'P1': return '🔴';
    case 'P2': return '🟠';
    case 'P3': return '🟡';
    case 'P4': return '🟢';
    default:   return '⚪';
  }
}

function statusEmoji(s: string): string {
  switch (s) {
    case 'INVESTIGATING': return '🔍';
    case 'IDENTIFIED':    return '🎯';
    case 'MONITORING':    return '📡';
    case 'RESOLVED':      return '✅';
    case 'CLOSED':        return '🏁';
    default:              return '📋';
  }
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function buildProgressNarrative(
  updates: { comment: string }[],
  assignmentGroup: string,
  aiDoneSoFar: string | null,
): string {
  if (aiDoneSoFar) return aiDoneSoFar;

  if (updates.length === 0) {
    return `No timeline updates have been posted yet. The incident is currently under initial investigation by **${assignmentGroup}**.`;
  }

  const cleaned = updates
    .map((u) => u.comment.trim().replace(/^Update\s+#\d+:\s*/i, ''))
    .filter(Boolean);

  return `Engineering teams have completed initial triage and are actively progressing remediation. Key actions so far: ${cleaned.join('. ')}.`;
}

/**
 * Autonomous Multi-Source Deep Search Engine:
 * Directly looks up change requests, incidents, CIs, and runbooks from live ServiceNow
 * and cross-references against CIM Apex Centre portal incidents, updates, and historical KB.
 */
async function executeServiceNowMCPTool(
  query: string,
  allIncidents: any[],
  historicalIncidents: any[],
): Promise<{ toolUsed: string; resultText: string } | null> {
  const lower = query.toLowerCase();

  try {
    // -----------------------------------------------------------------------
    // 1. SPECIFIC CHANGE REQUEST QUERY (e.g. CHG0000013, CHG12345)
    // -----------------------------------------------------------------------
    const chgMatch = query.match(/\b(CHG\d{4,})\b/i);
    if (chgMatch) {
      const chgNum = chgMatch[1].toUpperCase();
      const res = await fetchServiceNowAPI(
        `/api/now/table/change_request?sysparm_query=number=${encodeURIComponent(chgNum)}&sysparm_display_value=true&sysparm_limit=1`
      );

      let snResultText = '';
      if (res.ok) {
        const json = await res.json();
        const items = json.result || [];
        if (items.length > 0) {
          const item = items[0];
          const number = item.number?.display_value || item.number || chgNum;
          const shortDesc = (item.short_description?.display_value || item.short_description || 'No summary provided').trim();
          const desc = (item.description?.display_value || item.description || 'No detailed description provided').trim();
          const state = item.state?.display_value || item.state || 'Unknown';
          const type = item.type?.display_value || item.type || 'Normal';
          const risk = item.risk?.display_value || item.risk || 'Unspecified';
          const priority = item.priority?.display_value || item.priority || 'Unspecified';
          const impact = item.impact?.display_value || item.impact || 'Unspecified';
          const ci = item.cmdb_ci?.display_value || item.cmdb_ci || 'None';
          const requestedBy = item.requested_by?.display_value || item.requested_by || 'Unspecified';
          const assignedTo = item.assigned_to?.display_value || item.assigned_to || 'Unassigned';
          const assignmentGroup = item.assignment_group?.display_value || item.assignment_group || 'Unassigned';
          const startDate = item.start_date?.display_value || item.start_date;
          const endDate = item.end_date?.display_value || item.end_date;
          const workStart = item.work_start?.display_value || item.work_start;
          const workEnd = item.work_end?.display_value || item.work_end;
          const createdOn = item.sys_created_on?.display_value || item.sys_created_on;
          const updatedOn = item.sys_updated_on?.display_value || item.sys_updated_on;
          const implPlan = item.implementation_plan?.display_value || item.implementation_plan;
          const backoutPlan = item.backout_plan?.display_value || item.backout_plan;
          const closeNotes = item.close_notes?.display_value || item.close_notes;

          const isFutureCreation = createdOn && new Date(createdOn).getFullYear() > new Date().getFullYear();

          snResultText = `Live ServiceNow Change Request Record: **${number}**
- **Title / Summary**: ${shortDesc}
- **Description**: ${desc}
- **Current State**: **${state}**
- **Change Type**: ${type} | **Risk Level**: **${risk}** | **Priority**: ${priority} | **Impact**: ${impact}
- **Configuration Item (CI)**: **${ci}**
- **Assigned To**: **${assignedTo}** | **Requested By**: ${requestedBy}
- **Assignment Group**: ${assignmentGroup}
- **📅 Planned Implementation Window**:
  * Planned Start: \`${startDate || 'Not specified'}\`
  * Planned End: \`${endDate || 'Not specified'}\`
- **⏱️ Actual Execution Timestamps**:
  * Work Start: \`${workStart || 'Not started'}\`
  * Work End: \`${workEnd || 'Pending / In progress'}\`
- **Audit Records in ServiceNow**:
  * Record Created: \`${createdOn || '—'}\`
  * Last Updated: \`${updatedOn || '—'}\`
${isFutureCreation ? `> 💡 **Notice on Timestamps**: In ServiceNow's demo dataset, this record carries a synthetic creation date of \`${createdOn}\`, while its planned execution window is scheduled for \`${startDate}\` to \`${endDate}\` (last updated \`${updatedOn}\`).` : ''}
${implPlan ? `- **Implementation Plan**: ${implPlan}` : ''}
${backoutPlan ? `- **Backout Plan**: ${backoutPlan}` : ''}
${closeNotes ? `- **Close Notes**: ${closeNotes}` : ''}`;
        }
      }

      // Cross-reference with CIM Apex Centre Database
      const linkedCimIncidents = allIncidents.filter((i) =>
        i.number.toLowerCase().includes(chgNum.toLowerCase()) ||
        i.shortDescription.toLowerCase().includes(chgNum.toLowerCase()) ||
        (i.description && i.description.toLowerCase().includes(chgNum.toLowerCase())) ||
        (i.aiTechnicalSummary && i.aiTechnicalSummary.toLowerCase().includes(chgNum.toLowerCase())) ||
        i.updates.some((u: any) => u.comment.toLowerCase().includes(chgNum.toLowerCase()))
      );

      let cimResultText = '';
      if (linkedCimIncidents.length > 0) {
        cimResultText = `\n\n📍 **Correlated CIM Apex Centre Incidents (${linkedCimIncidents.length})**:\n` +
          linkedCimIncidents.map((i) => `- **${i.number}** (${priorityEmoji(i.priority)} ${i.priority} · **${i.status}**): ${i.shortDescription}`).join('\n');
      } else {
        cimResultText = `\n\n📍 **CIM Apex Centre Correlation**: No active or historical incidents in CIM Apex Centre are currently correlated with change ${chgNum}.`;
      }

      if (snResultText) {
        return {
          toolUsed: 'servicenow_get_change_requests',
          resultText: snResultText + cimResultText,
        };
      } else if (linkedCimIncidents.length > 0) {
        return {
          toolUsed: 'cim_apex_centre_lookup',
          resultText: `Change Request ${chgNum} was not found directly in ServiceNow, but is referenced in CIM Apex Centre:\n${cimResultText}`,
        };
      } else {
        return {
          toolUsed: 'servicenow_get_change_requests',
          resultText: `No Change Request matching "${chgNum}" was found in either the live ServiceNow instance or the CIM Apex Centre.`,
        };
      }
    }

    // -----------------------------------------------------------------------
    // 2. SPECIFIC INCIDENT QUERY (e.g. INC0000060, INC0010001, sys_id)
    // -----------------------------------------------------------------------
    const incMatch = query.match(/\b(INC\d{4,}|[0-9a-f]{32})\b/i);
    if (incMatch) {
      const incNum = incMatch[1].toUpperCase();
      const isSysId = /^[0-9a-f]{32}$/i.test(incNum);

      // Search CIM Apex Centre Database
      const localInc = allIncidents.find(
        (i) => i.number.toUpperCase() === incNum || i.id === incNum || i.number.toUpperCase().includes(incNum)
      );

      // Search Live ServiceNow
      const queryParam = isSysId ? `sys_id=${incNum}` : `number=${incNum}`;
      const res = await fetchServiceNowAPI(
        `/api/now/table/incident?sysparm_query=${encodeURIComponent(queryParam)}&sysparm_display_value=true&sysparm_limit=1`
      );

      let snText = '';
      if (res.ok) {
        const json = await res.json();
        if (json.result && json.result.length > 0) {
          const item = json.result[0];
          snText = `ServiceNow Live Incident Record: **${item.number?.display_value || item.number}**
- **Short Description**: ${item.short_description?.display_value || item.short_description}
- **State**: **${item.state?.display_value || item.state}**
- **Priority**: ${priorityEmoji(item.priority?.display_value || item.priority)} **${item.priority?.display_value || item.priority}**
- **Assignment Group**: **${item.assignment_group?.display_value || item.assignment_group || 'Unassigned'}**
- **Assigned To**: ${item.assigned_to?.display_value || item.assigned_to || 'Unassigned'}
- **Configuration Item (CI)**: ${item.cmdb_ci?.display_value || item.cmdb_ci || 'None'}
- **Opened At**: ${item.opened_at?.display_value || item.opened_at || '—'}
- **Work Notes**: ${item.work_notes?.display_value || item.work_notes || 'None'}
- **Close Notes**: ${item.close_notes?.display_value || item.close_notes || 'None'}`;
        }
      }

      let cimText = '';
      if (localInc) {
        const siteNames = localInc.sites?.map((s: any) => s.site.name).join(', ') || 'Unassigned';
        const latestUpdates = localInc.updates?.slice(-3).map((u: any) => `  * [${fmtDate(u.createdAt)}] ${u.comment}`).join('\n') || '  * No timeline updates posted yet.';
        cimText = `\n\nCIM Apex Centre Incident Status:
- **Portal Status**: **${localInc.status}** (${priorityEmoji(localInc.priority)} ${localInc.priority})
- **Summary**: ${localInc.shortDescription}
- **Impacted Sites**: ${siteNames}
- **What Has Been Done**: ${localInc.aiDoneSoFar || 'Engineering teams are progressing investigation.'}
- **What Is Awaited**: ${localInc.aiWhatIsAwaited || 'Awaiting secondary confirmation.'}
- **Recent Updates**:
${latestUpdates}
${localInc.teamsBridgeLink ? `- **Teams Command Bridge**: [Join Bridge](${localInc.teamsBridgeLink})` : ''}`;
      }

      if (snText || cimText) {
        return {
          toolUsed: 'servicenow_get_incident',
          resultText: (snText ? snText : 'Not found in live ServiceNow.') + (cimText ? cimText : '\n\nNot tracked in local CIM Apex Centre portal.'),
        };
      }
    }

    // -----------------------------------------------------------------------
    // 3. SPECIFIC KNOWLEDGE BASE ARTICLE (e.g. KB0010001, KB12345)
    // -----------------------------------------------------------------------
    const kbMatch = query.match(/\b(KB\d{4,})\b/i);
    if (kbMatch) {
      const kbNum = kbMatch[1].toUpperCase();
      const res = await fetchServiceNowAPI(
        `/api/now/table/kb_knowledge?sysparm_query=number=${encodeURIComponent(kbNum)}&sysparm_display_value=true&sysparm_limit=1`
      );

      if (res.ok) {
        const json = await res.json();
        if (json.result && json.result.length > 0) {
          const item = json.result[0];
          return {
            toolUsed: 'servicenow_search_kb',
            resultText: `ServiceNow Live Knowledge Base Article: **${item.number?.display_value || item.number}**
- **Title**: ${item.short_description?.display_value || item.short_description}
- **Category / Topic**: ${item.category?.display_value || item.topic?.display_value || 'General'}
- **Workflow State**: ${item.workflow_state?.display_value || item.workflow_state}
- **Author**: ${item.author?.display_value || item.author || 'ServiceNow IT'}
- **Article Content**:
${(item.text?.display_value || item.text || 'No article body content available.').slice(0, 1000)}`,
          };
        }
      }
    }

    // -----------------------------------------------------------------------
    // 4. GENERAL CHANGE REQUESTS QUERY
    // -----------------------------------------------------------------------
    if (lower.includes('change') || lower.includes('deployment') || lower.includes('release') || lower.includes('chg') || lower.includes('patch')) {
      const res = await fetchServiceNowAPI(
        '/api/now/table/change_request?sysparm_query=ORDERBYDESCsys_updated_on&sysparm_limit=6&sysparm_display_value=true'
      );
      if (res.ok) {
        const json = await res.json();
        const changes = json.result || [];
        if (changes.length > 0) {
          const chgList = changes.map((c: any) => {
            const num = c.number?.display_value || c.number;
            const title = (c.short_description?.display_value || c.short_description || '—').trim();
            const risk = c.risk?.display_value || c.risk || '—';
            const state = c.state?.display_value || c.state || '—';
            const start = c.start_date?.display_value || c.start_date || '—';
            const end = c.end_date?.display_value || c.end_date || '—';
            const updated = c.sys_updated_on?.display_value || c.sys_updated_on || '—';
            return `- **${num}**: ${title} (State: **${state}**, Risk: ${risk}, Planned Window: \`${start}\` → \`${end}\`, Updated: \`${updated}\`)`;
          }).join('\n');

          return {
            toolUsed: 'servicenow_get_change_requests',
            resultText: `ServiceNow Recent Change Requests (Sorted by Recent Activity):\n${chgList}`,
          };
        }
      }
    }

    // -----------------------------------------------------------------------
    // 5. KNOWLEDGE BASE & RUNBOOK TROUBLESHOOTING SEARCH (ServiceNow + CIM Apex Centre)
    // -----------------------------------------------------------------------
    if (
      lower.includes('kb') || lower.includes('knowledge') || lower.includes('runbook') ||
      lower.includes('playbook') || lower.includes('sop') || lower.includes('how to') ||
      lower.includes('fix') || lower.includes('resolve') || lower.includes('troubleshoot') ||
      lower.includes('solution') || lower.includes('resolution')
    ) {
      const cleanQ = query.replace(/(search|find|kb|knowledge|base|runbook|playbook|servicenow|sop|how|to|fix|resolve)/gi, '').trim() || 'incident';
      const encodedQ = encodeURIComponent(cleanQ);

      // 1. Query ServiceNow KB
      const res = await fetchServiceNowAPI(
        `/api/now/table/kb_knowledge?sysparm_query=workflow_state=published^short_descriptionLIKE${encodedQ}^ORtextLIKE${encodedQ}&sysparm_limit=3&sysparm_display_value=true`
      );

      let snKbText = '';
      if (res.ok) {
        const json = await res.json();
        const articles = json.result || [];
        if (articles.length > 0) {
          snKbText = `ServiceNow Knowledge Base Articles:\n` +
            articles.map((a: any) => `- **${a.number?.display_value || a.number}**: ${a.short_description?.display_value || a.short_description} (Topic: ${a.topic?.display_value || a.topic || 'General'})`).join('\n');
        }
      }

      // 2. Query CIM Apex Centre Historical Knowledge
      const lowerQ = cleanQ.toLowerCase();
      const matchingHistorical = historicalIncidents.filter((h) =>
        h.title.toLowerCase().includes(lowerQ) ||
        (h.category && h.category.toLowerCase().includes(lowerQ)) ||
        (h.rootCause && h.rootCause.toLowerCase().includes(lowerQ)) ||
        (h.resolutionNotes && h.resolutionNotes.toLowerCase().includes(lowerQ))
      ).slice(0, 3);

      let cimKbText = '';
      if (matchingHistorical.length > 0) {
        cimKbText = `\n\nCIM Apex Centre Past Solutions & Root Causes:\n` +
          matchingHistorical.map((h) => `- **${h.title}** (${h.category || 'General'}): Root Cause: ${h.rootCause || 'N/A'}. Resolution: ${h.resolutionNotes || 'N/A'}`).join('\n');
      }

      if (snKbText || cimKbText) {
        return {
          toolUsed: 'servicenow_search_kb',
          resultText: (snKbText || 'No direct ServiceNow KB matches.') + (cimKbText || ''),
        };
      }
    }

    // -----------------------------------------------------------------------
    // 6. LIST ACTIVE INCIDENTS IN SERVICENOW
    // -----------------------------------------------------------------------
    if ((lower.includes('servicenow') || lower.includes('sn')) && (lower.includes('list') || lower.includes('open') || lower.includes('p1') || lower.includes('all incidents') || lower.includes('tickets'))) {
      const res = await fetchServiceNowAPI(
        '/api/now/table/incident?sysparm_query=active=true^ORDERBYDESCopened_at&sysparm_limit=6&sysparm_display_value=true'
      );
      if (res.ok) {
        const json = await res.json();
        const incs = json.result || [];
        if (incs.length > 0) {
          const incList = incs.map((i: any) => `- **${i.number?.display_value || i.number}** [${i.priority?.display_value || i.priority}] - ${i.short_description?.display_value || i.short_description} (State: ${i.state?.display_value || i.state}, Group: ${i.assignment_group?.display_value || i.assignment_group || 'Unassigned'})`).join('\n');
          return {
            toolUsed: 'servicenow_list_incidents',
            resultText: `Live ServiceNow Active Incidents:\n${incList}`,
          };
        }
      }
    }
  } catch (err) {
    console.warn('[AI Copilot Autonomous Search] Notice:', err);
  }

  return null;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { prompt, history } = body as {
      prompt?: string;
      history?: { role: 'user' | 'assistant'; content: string }[];
    };

    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { success: false, error: 'Query prompt is required' },
        { status: 400 },
      );
    }

    const query = prompt.trim();
    const lower = query.toLowerCase();

    // -----------------------------------------------------------------
    // 1. Fetch DB Telemetry & Configurations
    // -----------------------------------------------------------------
    const [allIncidents, historicalIncidents, sites, aiConfig, snConfig] = await Promise.all([
      prisma.incident.findMany({
        include: {
          updates: { orderBy: { updateNumber: 'asc' } },
          sites: { include: { site: true } },
        },
        orderBy: { openedAt: 'desc' },
      }),
      prisma.historicalIncident.findMany({ take: 50 }),
      prisma.site.findMany({
        include: { incidents: { include: { incident: true } } },
      }),
      getGeminiConfig(),
      getServiceNowConfig(),
    ]);

    // -----------------------------------------------------------------
    // 2. Autonomous Multi-Source Deep Search (Live ServiceNow + CIM Apex Centre)
    // -----------------------------------------------------------------
    const mcpData = await executeServiceNowMCPTool(query, allIncidents, historicalIncidents);

    const activeIncidents = allIncidents.filter((i) => i.status !== 'CLOSED');
    const closedIncidents = allIncidents.filter((i) => i.status === 'CLOSED');
    const { apiKey, model } = aiConfig;

    // -----------------------------------------------------------------
    // 3. Gemini AI Processing with Live Multi-Source Context
    // -----------------------------------------------------------------
    if (apiKey) {
      try {
        const systemPrompt = buildSystemPrompt(
          activeIncidents,
          closedIncidents,
          sites,
          historicalIncidents,
          mcpData,
          snConfig.instanceUrl,
        );

        let fullPrompt = query;
        if (history && Array.isArray(history) && history.length > 0) {
          const formattedHistory = history
            .map((m: any) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
            .join('\n');
          fullPrompt = `[Previous Conversation]\n${formattedHistory}\n\n[Current User Question]\n${query}`;
        }

        if (mcpData) {
          fullPrompt += `\n\n[⚡ Live ServiceNow & CIM Apex Centre Search Telemetry (${mcpData.toolUsed})]\n${mcpData.resultText}`;
        }

        const result = await callGeminiAPI({
          prompt: fullPrompt,
          systemPrompt,
          temperature: 0.2, // Lower temperature for high factual accuracy
          maxOutputTokens: 2048,
        });

        if (result.text) {
          return NextResponse.json({
            success: true,
            response: result.text,
            modelUsed: result.modelUsed,
            mcpToolUsed: mcpData?.toolUsed || null,
          });
        }
      } catch (err) {
        console.warn('[AI Copilot] Gemini call failed — falling back to local engine:', err);
      }
    }

    // -----------------------------------------------------------------
    // 4. Fallback Engine with Live Telemetry Enrichment
    // -----------------------------------------------------------------
    const botReply = generateFallbackResponse(
      query,
      lower,
      allIncidents,
      activeIncidents,
      closedIncidents,
      sites,
      historicalIncidents,
      mcpData,
    );

    return NextResponse.json({
      success: true,
      response: botReply,
      mcpToolUsed: mcpData?.toolUsed || null,
    });
  } catch (err: any) {
    console.error('[AI Copilot] Unhandled error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// System Prompt Builder
// ---------------------------------------------------------------------------

function buildSystemPrompt(
  activeIncidents: any[],
  closedIncidents: any[],
  sites: any[],
  historicalIncidents: any[],
  mcpData: { toolUsed: string; resultText: string } | null,
  snInstanceUrl: string,
): string {
  const activeCtx = activeIncidents.map((i) => ({
    number: i.number,
    title: i.shortDescription,
    priority: i.priority,
    status: i.status,
    group: i.assignmentGroup,
    cti: i.cti || null,
    cmdbCi: i.cmdbCi || null,
    teamsBridge: i.teamsBridgeLink,
    openedAt: i.openedAt,
    updates: i.updates.map((u: any) => u.comment),
    aiSummary: i.aiExecutiveSummary || i.aiCurrentStatusSummary || null,
    aiDoneSoFar: i.aiDoneSoFar || null,
    aiAwaited: i.aiWhatIsAwaited || null,
    sites: i.sites.map((s: any) => ({
      name: s.site.name,
      city: s.site.city,
      country: s.site.country,
    })),
  }));

  const closedCtx = closedIncidents.slice(0, 20).map((i) => ({
    number: i.number,
    title: i.shortDescription,
    priority: i.priority,
    status: i.status,
    group: i.assignmentGroup,
    openedAt: i.openedAt,
    closedAt: i.closedAt,
    sites: i.sites.map((s: any) => s.site.name),
  }));

  const siteCtx = sites.map((s) => ({
    name: s.name,
    city: s.city,
    country: s.country,
    status: s.status,
    activeIncidents: s.incidents
      .filter((r: any) => r.incident.status !== 'CLOSED')
      .map((r: any) => r.incident.number),
  }));

  const histCtx = historicalIncidents.map((h) => ({
    title: h.title,
    category: h.category,
    solution: h.resolutionNotes,
    rootCause: h.rootCause,
  }));

  return `You are a warm, highly knowledgeable, and extremely precise AI Command Copilot for the Critical Incident Management (CIM) Portal — an enterprise IT operations dashboard integrated with live ServiceNow instance (${snInstanceUrl}) and CIM Apex Centre.

## CRITICAL ACCURACY & RELEVANCE MANDATE (ZERO TOLERANCE FOR HALLUCINATION)
1. **Absolute Fact Grounding**: Only state facts, numbers, dates, and statuses that are EXPLICITLY present in the ServiceNow Live Telemetry or CIM Apex Centre Portal Context below.
2. **Never Fabricate or Extrapolate**: If a ticket, change request, or article is not present in the telemetry, state clearly that it was not found in either system. Never make up details or dates.
3. **Change Requests (CHG) Precision**:
   - Provide complete attributes: Title, State, Type, Risk, Configuration Item (CI), Assigned To, Requested By, and Assignment Group.
   - For dates, clearly distinguish:
     * **Planned Implementation Window**: Planned Start to Planned End (this is the scheduled change window).
     * **Audit Timestamps**: Record Created date and Last Updated date.
     * If a timestamp in ServiceNow has a future date (common in demo/scheduled releases, e.g. 2027), explain: "(Note: In ServiceNow, this record carries a scheduled/demo creation timestamp of YYYY-MM-DD)".
4. **Incidents (INC) Precision**:
   - Report live ServiceNow ticket attributes alongside CIM Apex Centre portal updates, impacted sites, and timeline progress.

## YOUR PERSONALITY & STYLE
- Warm, professional, and conversational — senior IT Incident Commander
- Confident, structured, and scannable
- Emoji anchoring: 📍 locations · 🔴 P1 · 🟠 P2 · 🟡 P3 · 🟢 P4 · ✅ resolved · 🏁 closed · 🔍 investigating · 📡 monitoring · ⚡ Live data

## FORMATTING RULES
- Always respond in well-structured **markdown**
- Use \`###\` headers to separate distinct sections
- Use \`**bold**\` for all ticket numbers, statuses, groups, priorities, and site names
- Format bridge links as: \`[Join Command Bridge](url)\`
- Use bullet points for actions and timeline summaries

${mcpData ? `### ⚡ Live Multi-Source Search Telemetry Active\nTool / Engine Used: ${mcpData.toolUsed}\nData:\n${mcpData.resultText}\n` : ''}

## REAL-TIME CIM PORTAL CONTEXT
### Active Portal Incidents (${activeIncidents.length})
${JSON.stringify(activeCtx, null, 1)}

### Recently Closed Incidents (${closedCtx.length})
${JSON.stringify(closedCtx, null, 1)}

### Sites (${siteCtx.length})
${JSON.stringify(siteCtx, null, 1)}

### Historical Knowledge Base (${histCtx.length} items)
${JSON.stringify(histCtx, null, 1)}`;
}

// ---------------------------------------------------------------------------
// Fallback Response Engine
// ---------------------------------------------------------------------------

function generateFallbackResponse(
  query: string,
  lower: string,
  allIncidents: any[],
  activeIncidents: any[],
  closedIncidents: any[],
  sites: any[],
  historicalIncidents: any[],
  mcpData: { toolUsed: string; resultText: string } | null,
): string {
  // If MCP Tool returned live data, format and return it prominently!
  if (mcpData) {
    return (
      `### ⚡ Live ServiceNow & CIM Apex Centre Report\n\n` +
      `> **Engine**: \`${mcpData.toolUsed}\` · Synchronized with live ServiceNow REST API and CIM Apex Centre.\n\n` +
      `${mcpData.resultText}\n\n` +
      `*You can ask me to fetch related change requests, check active incidents, or search knowledge base runbooks.*`
    );
  }

  // Extract potential incident number
  const numberMatch = lower.match(/\b(?:inc)?(0*\d{4,})\b/i);
  let matchedIncident: any = null;

  if (numberMatch) {
    const fragment = numberMatch[1];
    matchedIncident = allIncidents.find((i) =>
      i.number.toLowerCase().includes(fragment.toLowerCase()),
    );
  }

  // Extract potential change request number
  const chgMatch = lower.match(/\b(chg\d{4,})\b/i);
  if (chgMatch) {
    return `### 🔄 Change Request Search\n\nI queried ServiceNow for **${chgMatch[1].toUpperCase()}**, but no matching record was returned. Please verify the Change Request number in ServiceNow.`;
  }

  // Identify location / site
  const matchedSite = sites.find(
    (s: any) =>
      lower.includes(s.city.toLowerCase()) ||
      lower.includes(s.name.toLowerCase()) ||
      lower.includes(s.country.toLowerCase()) ||
      s.city
        .toLowerCase()
        .split(' ')
        .some((word: string) => word.length > 3 && lower.includes(word)),
  );

  // Pattern: Executive Summary / Brief Me
  if (
    lower.includes('executive summary') ||
    lower.includes('brief me') ||
    lower.includes('overview') ||
    lower.includes('sitrep') ||
    lower.includes('situation report')
  ) {
    const p1Count = activeIncidents.filter((i) => i.priority === 'P1').length;
    const p2Count = activeIncidents.filter((i) => i.priority === 'P2').length;
    const p3Count = activeIncidents.filter((i) => i.priority === 'P3').length;
    const p4Count = activeIncidents.filter((i) => i.priority === 'P4').length;

    const impactedSites = sites.filter(
      (s: any) => s.incidents.filter((r: any) => r.incident.status !== 'CLOSED').length > 0,
    );

    let incidentLines = '';
    for (const inc of activeIncidents.slice(0, 8)) {
      const siteNames = inc.sites.map((s: any) => s.site.name).join(', ') || 'Unassigned';
      incidentLines += `- ${priorityEmoji(inc.priority)} **${inc.number}** — ${inc.shortDescription} · **${inc.status}** · ${siteNames}\n`;
    }

    return (
      `### 📊 Executive Situation Report\n\n` +
      `> The CIM Portal is currently tracking **${activeIncidents.length} active incident${activeIncidents.length !== 1 ? 's' : ''}** across **${impactedSites.length} impacted site${impactedSites.length !== 1 ? 's' : ''}**.\n\n` +
      `### Priority Breakdown\n\n` +
      `- 🔴 **P1 Critical**: ${p1Count}\n` +
      `- 🟠 **P2 High**: ${p2Count}\n` +
      `- 🟡 **P3 Moderate**: ${p3Count}\n` +
      `- 🟢 **P4 Low**: ${p4Count}\n\n` +
      (incidentLines
        ? `### Active Incidents\n\n${incidentLines}\n`
        : `### Active Incidents\n\n✅ No active incidents — all systems are operational!\n\n`) +
      `*${closedIncidents.length} incident${closedIncidents.length !== 1 ? 's' : ''} closed historically. Ask me about any specific incident for more details.*`
    );
  }

  // Pattern: How many incidents / count
  if (
    lower.includes('how many') ||
    lower.includes('count') ||
    lower.includes('total incidents') ||
    lower.includes('number of incidents')
  ) {
    return (
      `### 📈 Incident Statistics\n\n` +
      `- **Total Incidents**: ${allIncidents.length}\n` +
      `- **Active**: ${activeIncidents.length}\n` +
      `- **Closed / Resolved**: ${closedIncidents.length}\n\n` +
      `> Currently tracking **${activeIncidents.length} active incident${activeIncidents.length !== 1 ? 's' : ''}** requiring attention.\n\n` +
      `*Ask me about any specific incident number for a full briefing.*`
    );
  }

  // Pattern: List all active incidents
  if (
    lower.includes('list all active') ||
    lower.includes('list active') ||
    lower.includes('show active') ||
    lower.includes('all active') ||
    lower.includes('active incidents') ||
    lower.includes('open incidents')
  ) {
    if (activeIncidents.length === 0) {
      return (
        `### ✅ All Clear\n\n` +
        `There are currently **no active incidents** in the system. All services are operating normally!\n\n` +
        `*${closedIncidents.length} incident${closedIncidents.length !== 1 ? 's have' : ' has'} been resolved historically.*`
      );
    }

    let lines = '';
    for (const inc of activeIncidents) {
      const siteNames = inc.sites.map((s: any) => s.site.name).join(', ') || '—';
      lines += `- ${priorityEmoji(inc.priority)} **${inc.number}** — ${inc.shortDescription}\n`;
      lines += `  - **Priority**: ${inc.priority} · **Status**: ${inc.status} · **Group**: ${inc.assignmentGroup}\n`;
      lines += `  - **Sites**: ${siteNames} · **Opened**: ${fmtDate(inc.openedAt)}\n`;
    }

    return (
      `### 📋 Active Incidents (${activeIncidents.length})\n\n` +
      `${lines}\n` +
      `*Click on any incident number in the dashboard for full timeline details.*`
    );
  }

  // Pattern: Bridge / Teams link
  if (
    lower.includes('bridge') ||
    lower.includes('teams link') ||
    lower.includes('teams call') ||
    lower.includes('join the call') ||
    lower.includes('conference')
  ) {
    const target = matchedIncident || activeIncidents[0];
    if (target && target.teamsBridgeLink) {
      return (
        `### 📞 Teams Command Bridge\n\n` +
        `Here is the active bridge link for **${target.number}**:\n\n` +
        `🔗 **[Join Command Bridge](${target.teamsBridgeLink})**\n\n` +
        `- **Incident**: ${target.shortDescription}\n` +
        `- **Assignment Group**: **${target.assignmentGroup}**\n` +
        `- **Priority**: ${priorityEmoji(target.priority)} **${target.priority}**\n\n` +
        `*Join to coordinate directly with the lead engineers.*`
      );
    } else if (target) {
      return (
        `### 📞 Bridge Status\n\n` +
        `Incident **${target.number}** does not currently have a Teams bridge link configured.\n\n` +
        `Please ask the Incident Manager to provision a bridge via the dashboard.`
      );
    }
  }

  // Pattern: Specific incident query
  if (matchedIncident) {
    const inc = matchedIncident;
    const narrative = buildProgressNarrative(inc.updates, inc.assignmentGroup, inc.aiDoneSoFar);
    const siteNames = inc.sites.map((s: any) => `📍 ${s.site.name} (${s.site.city}, ${s.site.country})`).join('\n- ') || '—';

    return (
      `### ${statusEmoji(inc.status)} Incident Briefing — ${inc.number}\n\n` +
      `> ${inc.aiExecutiveSummary || inc.shortDescription}\n\n` +
      `- **Description**: ${inc.shortDescription}\n` +
      `- **Priority**: ${priorityEmoji(inc.priority)} **${inc.priority}**\n` +
      `- **Status**: **${inc.status}**\n` +
      `- **Assignment Group**: **${inc.assignmentGroup}**\n` +
      `- **Opened**: ${fmtDate(inc.openedAt)}\n` +
      (inc.closedAt ? `- **Closed**: ${fmtDate(inc.closedAt)}\n` : '') +
      `- **Affected Sites**:\n  - ${siteNames}\n\n` +
      `### What Has Been Done\n\n` +
      `${narrative}\n\n` +
      `### Next Steps Awaited\n\n` +
      `${inc.aiWhatIsAwaited || 'Awaiting next mandatory status update and secondary system validation.'}\n\n` +
      (inc.teamsBridgeLink ? `🔗 [Join Command Bridge](${inc.teamsBridgeLink})\n` : '')
    );
  }

  // General conversational fallback
  return (
    `### 🤖 CIM Command Copilot (ServiceNow & Portal Integrated)\n\n` +
    `Hello! I'm your AI operations assistant for the Critical Incident Management Portal with **real-time ServiceNow MCP tool access** and **CIM Apex Centre integration**.\n\n` +
    `Here are some things you can ask me:\n\n` +
    `- 🔄 *"Tell me about change CHG0000013"*
` +
    `- ⚡ *"Check incident INC0000060 in ServiceNow"*
` +
    `- 📋 *"Show recent change requests in ServiceNow"*
` +
    `- 📚 *"Search KB for database high CPU"*
` +
    `- 📊 *"Give me an executive summary"*
` +
    `- 📋 *"List all active incidents"*
` +
    `- 📞 *"Send me the Teams bridge link for active incident"*
\n` +
    `How can I assist your operations today? 😊`
  );
}

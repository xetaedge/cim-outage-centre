import { NextResponse } from 'next/server';
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
 * Executes ServiceNow MCP tools on demand for AI Copilot queries
 */
async function executeServiceNowMCPTool(query: string): Promise<{ toolUsed: string; resultText: string } | null> {
  const lower = query.toLowerCase();

  try {
    // 1. Single Incident Query (INC... or sys_id)
    const incMatch = query.match(/\b(INC\d{5,}|[0-9a-f]{32})\b/i);
    if (incMatch && (lower.includes('servicenow') || lower.includes('sn') || lower.includes('ticket') || lower.includes('fetch') || lower.includes('check'))) {
      const incNum = incMatch[1].toUpperCase();
      const isSysId = /^[0-9a-f]{32}$/i.test(incNum);
      const queryParam = isSysId ? `sys_id=${incNum}` : `number=${incNum}`;
      const res = await fetchServiceNowAPI(`/api/now/table/incident?sysparm_query=${queryParam}&sysparm_display_value=true&sysparm_limit=1`);
      
      if (res.ok) {
        const json = await res.json();
        if (json.result && json.result.length > 0) {
          const item = json.result[0];
          return {
            toolUsed: 'servicenow_get_incident',
            resultText: `ServiceNow Live Incident Record:
Number: ${item.number?.display_value || item.number}
Short Description: ${item.short_description?.display_value || item.short_description}
State: ${item.state?.display_value || item.state}
Priority: ${item.priority?.display_value || item.priority}
Assignment Group: ${item.assignment_group?.display_value || item.assignment_group || 'Unassigned'}
Assigned To: ${item.assigned_to?.display_value || item.assigned_to || 'Unassigned'}
Configuration Item (CI): ${item.cmdb_ci?.display_value || item.cmdb_ci || 'None'}
Opened: ${item.opened_at?.display_value || item.opened_at}
Work Notes / Activity: ${item.work_notes?.display_value || item.work_notes || 'None'}
Close Notes: ${item.close_notes?.display_value || item.close_notes || 'None'}`,
          };
        }
      }
    }

    // 2. Change Requests Query
    if (lower.includes('change') || lower.includes('deployment') || lower.includes('release') || lower.includes('chg')) {
      const res = await fetchServiceNowAPI('/api/now/table/change_request?sysparm_query=ORDERBYDESCsys_created_on&sysparm_limit=5&sysparm_display_value=true');
      if (res.ok) {
        const json = await res.json();
        const changes = json.result || [];
        if (changes.length > 0) {
          const chgList = changes.map((c: any) => `- ${c.number?.display_value || c.number}: ${c.short_description?.display_value || c.short_description} (Risk: ${c.risk?.display_value || c.risk}, State: ${c.state?.display_value || c.state}, Created: ${c.sys_created_on?.display_value || c.sys_created_on})`).join('\n');
          return {
            toolUsed: 'servicenow_get_change_requests',
            resultText: `ServiceNow Recent Change Requests:\n${chgList}`,
          };
        }
      }
    }

    // 3. Knowledge Base Query
    if (lower.includes('kb') || lower.includes('knowledge') || lower.includes('runbook') || lower.includes('playbook') || lower.includes('sop') || lower.includes('how to')) {
      const cleanQ = encodeURIComponent(query.replace(/(search|find|kb|knowledge|base|runbook|playbook|servicenow)/gi, '').trim() || 'incident');
      const res = await fetchServiceNowAPI(`/api/now/table/kb_knowledge?sysparm_query=workflow_state=published^short_descriptionLIKE${cleanQ}^ORtextLIKE${cleanQ}&sysparm_limit=3&sysparm_display_value=true`);
      if (res.ok) {
        const json = await res.json();
        const articles = json.result || [];
        if (articles.length > 0) {
          const kbList = articles.map((a: any) => `- ${a.number?.display_value || a.number}: ${a.short_description?.display_value || a.short_description} (Topic: ${a.topic?.display_value || a.topic})`).join('\n');
          return {
            toolUsed: 'servicenow_search_kb',
            resultText: `ServiceNow Knowledge Base Articles Matching Query:\n${kbList}`,
          };
        }
      }
    }

    // 4. List Active P1 / Incidents in ServiceNow
    if ((lower.includes('servicenow') || lower.includes('sn')) && (lower.includes('list') || lower.includes('open') || lower.includes('p1') || lower.includes('all incidents'))) {
      const res = await fetchServiceNowAPI('/api/now/table/incident?sysparm_query=active=true^ORDERBYDESCopened_at&sysparm_limit=5&sysparm_display_value=true');
      if (res.ok) {
        const json = await res.json();
        const incs = json.result || [];
        if (incs.length > 0) {
          const incList = incs.map((i: any) => `- ${i.number?.display_value || i.number} [${i.priority?.display_value || i.priority}] - ${i.short_description?.display_value || i.short_description} (${i.state?.display_value || i.state}, Group: ${i.assignment_group?.display_value || i.assignment_group || 'Unassigned'})`).join('\n');
          return {
            toolUsed: 'servicenow_list_incidents',
            resultText: `Live ServiceNow Active Incidents:\n${incList}`,
          };
        }
      }
    }
  } catch (err) {
    console.warn('[AI Copilot MCP] Autonomous tool execution notice:', err);
  }

  return null;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
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
    // 1. Parallel Data Fetch: DB Telemetry + Autonomous ServiceNow MCP
    // -----------------------------------------------------------------
    const [allIncidents, historicalIncidents, sites, aiConfig, snConfig, mcpData] = await Promise.all([
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
      executeServiceNowMCPTool(query),
    ]);

    const activeIncidents = allIncidents.filter((i) => i.status !== 'CLOSED');
    const closedIncidents = allIncidents.filter((i) => i.status === 'CLOSED');
    const { apiKey, model } = aiConfig;

    // -----------------------------------------------------------------
    // 2. Gemini AI Processing with Live ServiceNow MCP Context
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
          fullPrompt += `\n\n[⚡ Live ServiceNow MCP Tool Telemetry (${mcpData.toolUsed})]\n${mcpData.resultText}`;
        }

        const result = await callGeminiAPI({
          prompt: fullPrompt,
          systemPrompt,
          temperature: 0.4,
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
    // 3. Fallback Engine with Live MCP Enrichment
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

  return `You are a warm, highly knowledgeable AI Command Copilot for the Critical Incident Management (CIM) Portal — an enterprise IT operations dashboard integrated with live ServiceNow Model Context Protocol (MCP) tools.

## CAPABILITIES & SERVICENOW MCP INTEGRATION
- Connected to Live ServiceNow Instance: ${snInstanceUrl}
- You have autonomous access to ServiceNow MCP tools (servicenow_get_incident, servicenow_list_incidents, servicenow_search_kb, servicenow_get_change_requests, servicenow_create_incident, servicenow_update_incident).
- When answering questions about ServiceNow tickets, changes, or runbooks, reference live telemetry clearly with visual markdown badges.

## YOUR PERSONALITY & STYLE
- Warm, professional, and conversational — senior IT Incident Commander
- Confident, structured, and scannable
- Emoji anchoring: 📍 locations · 🔴 P1 · 🟠 P2 · 🟡 P3 · 🟢 P4 · ✅ resolved · 🏁 closed · 🔍 investigating · 📡 monitoring · ⚡ MCP live data

## FORMATTING RULES (MANDATORY)
- Always respond in well-structured **markdown**
- Use \`###\` headers to separate distinct sections
- Use \`**bold**\` for all incident numbers, statuses, groups, priorities, and site names
- Format bridge links as: \`[Join Command Bridge](url)\`
- Use bullet points for actions and timeline summaries

${mcpData ? `### ⚡ Live ServiceNow MCP Telemetry Active\nTool Used: ${mcpData.toolUsed}\nData:\n${mcpData.resultText}\n` : ''}

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
      `### ⚡ Live ServiceNow Response (via MCP)

` +
      `> **Tool**: \`${mcpData.toolUsed}\` · Synchronized with live ServiceNow REST API.

` +
      `${mcpData.resultText}

` +
      `*You can ask me to update this ticket, fetch related change requests, or search knowledge base runbooks.*`
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
    `### 🤖 CIM Command Copilot (ServiceNow MCP Enabled)\n\n` +
    `Hello! I'm your AI operations assistant for the Critical Incident Management Portal with **real-time ServiceNow MCP tool access**.\n\n` +
    `Here are some things you can ask me:\n\n` +
    `- ⚡ *"Check incident INC0000060 in ServiceNow"*
` +
    `- 🔄 *"Show recent change requests in ServiceNow"*
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

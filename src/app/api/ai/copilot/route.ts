import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// AI Configuration — resolves API key & model from DB → env → defaults
// (Replicates the private getAIConfig logic from @/lib/openai)
// ---------------------------------------------------------------------------
async function getAIConfig(): Promise<{ apiKey: string | null; model: string }> {
  try {
    const [keySetting, modelSetting] = await Promise.all([
      prisma.systemSetting.findUnique({ where: { key: 'OPENAI_API_KEY' } }),
      prisma.systemSetting.findUnique({ where: { key: 'AI_MODEL' } }),
    ]);

    const apiKey = keySetting?.value || process.env.OPENAI_API_KEY || null;
    const model = modelSetting?.value || 'gpt-4o-mini';

    return { apiKey, model };
  } catch {
    return {
      apiKey: process.env.OPENAI_API_KEY || null,
      model: 'gpt-4o-mini',
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Emoji badge for incident priority */
function priorityEmoji(p: string): string {
  switch (p) {
    case 'P1': return '🔴';
    case 'P2': return '🟠';
    case 'P3': return '🟡';
    case 'P4': return '🟢';
    default:   return '⚪';
  }
}

/** Emoji badge for incident status */
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

/** Format a Date for display (or return fallback) */
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

/** Build a clean, cohesive narrative from update comments */
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
    // 1. Fetch all data in parallel (including closed / archived)
    // -----------------------------------------------------------------
    const [allIncidents, historicalIncidents, sites, aiConfig] = await Promise.all([
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
      getAIConfig(),
    ]);

    const activeIncidents = allIncidents.filter((i) => i.status !== 'CLOSED');
    const closedIncidents = allIncidents.filter((i) => i.status === 'CLOSED');
    const { apiKey, model } = aiConfig;

    // -----------------------------------------------------------------
    // 2. Attempt Gemini API (using DB-configured key & model)
    // -----------------------------------------------------------------
    if (apiKey) {
      try {
        const systemPrompt = buildSystemPrompt(
          activeIncidents,
          closedIncidents,
          sites,
          historicalIncidents,
        );

        // Build Gemini messages array from history
        const contents = [];
        
        if (history && Array.isArray(history)) {
          for (const msg of history) {
            if (
              msg &&
              typeof msg.role === 'string' &&
              typeof msg.content === 'string' &&
              ['user', 'assistant'].includes(msg.role)
            ) {
              contents.push({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }],
              });
            }
          }
        }

        contents.push({
          role: 'user',
          parts: [{ text: query }],
        });

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents,
            generationConfig: {
              temperature: 0.5,
              maxOutputTokens: 2048,
            },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (responseText) {
            return NextResponse.json({ success: true, response: responseText });
          }
        } else {
          console.warn('Gemini API returned non-OK status:', response.status);
        }
      } catch (err) {
        console.warn('[AI Copilot] Gemini call failed — falling back to local engine:', err);
      }
    }

    // -----------------------------------------------------------------
    // 3. Local Fallback Engine (rich markdown responses)
    // -----------------------------------------------------------------
    const botReply = generateFallbackResponse(
      query,
      lower,
      allIncidents,
      activeIncidents,
      closedIncidents,
      sites,
      historicalIncidents,
    );

    return NextResponse.json({ success: true, response: botReply });
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
): string {
  // -- Active incidents context
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

  // -- Recently closed incidents context (last 20)
  const closedCtx = closedIncidents.slice(0, 20).map((i) => ({
    number: i.number,
    title: i.shortDescription,
    priority: i.priority,
    status: i.status,
    group: i.assignmentGroup,
    cti: i.cti || null,
    cmdbCi: i.cmdbCi || null,
    openedAt: i.openedAt,
    closedAt: i.closedAt,
    sites: i.sites.map((s: any) => s.site.name),
  }));

  // -- Sites context
  const siteCtx = sites.map((s) => ({
    name: s.name,
    city: s.city,
    country: s.country,
    status: s.status,
    activeIncidents: s.incidents
      .filter((r: any) => r.incident.status !== 'CLOSED')
      .map((r: any) => r.incident.number),
  }));

  // -- Historical knowledge base
  const histCtx = historicalIncidents.map((h) => ({
    title: h.title,
    category: h.category,
    solution: h.resolutionNotes,
    rootCause: h.rootCause,
  }));

  return `You are a warm, highly knowledgeable AI Command Copilot for the Critical Incident Management (CIM) Portal — an enterprise IT operations dashboard.

## YOUR PERSONALITY
- Warm, professional, and conversational — like a trusted senior operations lead
- Confident and concise; never verbose for the sake of it
- Use emoji sparingly but effectively for visual anchoring:
  📍 locations · 🔴 P1/critical · 🟠 P2 · 🟡 P3 · 🟢 P4/healthy · ✅ resolved · 🏁 closed · 🔍 investigating · 📡 monitoring

## FORMATTING RULES (MANDATORY)
- Always respond with well-structured, beautifully formatted **markdown**
- Use \`###\` headers to separate distinct sections
- Use \`**bold**\` for all key data points: incident numbers, statuses, assignment groups, priorities, site names
- Use \`- \` bullet lists when presenting multi-item data
- Use \`> \` blockquotes for executive summaries or key insights
- When providing bridge/Teams links, format as clickable markdown: \`[Join Command Bridge](url)\`
- For incident summaries, create a **cohesive narrative** of progress — NEVER list raw "Update #1: ..., Update #2: ..." sequences
- Keep responses scannable: use whitespace and structure generously

## SEMANTIC MATCHING
- Match user queries semantically — they do NOT need to use exact names, IDs, or phrasing
- "Chicago", "what is happening in chicago", "any outages in Chicago?" → identify Chicago-related sites and incidents
- "INC0010001", "10001", "incident 10001" → fuzzy-match the incident number
- "bridge for INC0010001", "Teams link" → extract incident and provide the Teams bridge link
- "how many incidents", "count active" → provide counts with breakdown
- "executive summary", "brief me" → provide a high-level overview

## REAL-TIME DATABASE CONTEXT

### Active Incidents (${activeIncidents.length})
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
): string {
  // ------- Extract potential incident number -------
  const numberMatch = lower.match(/\b(?:inc)?(0*\d{4,})\b/i);
  let matchedIncident: any = null;

  if (numberMatch) {
    const fragment = numberMatch[1];
    matchedIncident = allIncidents.find((i) =>
      i.number.toLowerCase().includes(fragment.toLowerCase()),
    );
  }

  // ------- Identify location / site -------
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

  // =====================================================================
  // Pattern: Executive Summary / Brief Me
  // =====================================================================
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

  // =====================================================================
  // Pattern: How many incidents / count
  // =====================================================================
  if (
    lower.includes('how many') ||
    lower.includes('count') ||
    lower.includes('total incidents') ||
    lower.includes('number of incidents')
  ) {
    const total = allIncidents.length;
    const active = activeIncidents.length;
    const closed = closedIncidents.length;

    return (
      `### 📈 Incident Statistics\n\n` +
      `- **Total Incidents**: ${total}\n` +
      `- **Active**: ${active}\n` +
      `- **Closed / Resolved**: ${closed}\n\n` +
      `> Currently tracking **${active} active incident${active !== 1 ? 's' : ''}** requiring attention.\n\n` +
      `*Ask me about any specific incident number for a full briefing.*`
    );
  }

  // =====================================================================
  // Pattern: List all active incidents
  // =====================================================================
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

  // =====================================================================
  // Pattern: Bridge / Teams link
  // =====================================================================
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
    } else {
      return (
        `### 📞 Bridge Status\n\n` +
        `No active incidents found to link a command bridge. All systems appear operational!`
      );
    }
  }

  // =====================================================================
  // Pattern: What priority is INC...? / Priority query
  // =====================================================================
  if (matchedIncident && (lower.includes('priority') || lower.includes('what priority'))) {
    const inc = matchedIncident;
    return (
      `### ${priorityEmoji(inc.priority)} Priority for ${inc.number}\n\n` +
      `- **Incident**: ${inc.shortDescription}\n` +
      `- **Priority**: **${inc.priority}**\n` +
      `- **Status**: ${statusEmoji(inc.status)} **${inc.status}**\n` +
      `- **Assignment Group**: **${inc.assignmentGroup}**\n` +
      (inc.cti ? `- **CTI**: ${inc.cti}\n` : '') +
      (inc.cmdbCi ? `- **CMDB CI**: ${inc.cmdbCi}\n` : '') +
      `\n*Opened ${fmtDate(inc.openedAt)}${inc.closedAt ? ` · Closed ${fmtDate(inc.closedAt)}` : ''}*`
    );
  }

  // =====================================================================
  // Pattern: Location / site query
  // =====================================================================
  if (
    matchedSite ||
    lower.includes('location') ||
    lower.includes('city') ||
    lower.includes('site') ||
    lower.includes('facility')
  ) {
    const site = matchedSite || sites[0];
    if (site) {
      const activeRels = site.incidents.filter((r: any) => r.incident.status !== 'CLOSED');
      if (activeRels.length > 0) {
        let incLines = '';
        for (const rel of activeRels) {
          const inc = rel.incident;
          incLines += `- ${priorityEmoji(inc.priority)} **${inc.number}** — ${inc.shortDescription} · **${inc.status}**\n`;
        }

        return (
          `### 📍 Location Status — ${site.name}\n\n` +
          `- **City**: ${site.city}\n` +
          `- **Country**: ${site.country}\n` +
          `- **Status**: 🟠 **IMPACTED**\n` +
          `- **Active Incidents**: ${activeRels.length}\n\n` +
          `${incLines}\n` +
          `Remediation teams are actively working to restore full operations at this facility.`
        );
      } else {
        return (
          `### 📍 Location Status — ${site.name}\n\n` +
          `- **City**: ${site.city}\n` +
          `- **Country**: ${site.country}\n` +
          `- **Status**: 🟢 **HEALTHY**\n\n` +
          `This facility is currently fully operational with **0 active incidents**. ✅`
        );
      }
    } else {
      const cityList = sites.map((s: any) => `**${s.city}** (${s.country})`).join(', ');
      return (
        `### 📍 Location Query\n\n` +
        `I couldn't identify that specific location. We currently track facilities in:\n\n` +
        `${cityList}\n\n` +
        `Which site would you like to check?`
      );
    }
  }

  // =====================================================================
  // Pattern: Specific incident query (status / updates / what has been done)
  // =====================================================================
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
      (inc.cti ? `- **CTI**: ${inc.cti}\n` : '') +
      (inc.cmdbCi ? `- **CMDB CI**: ${inc.cmdbCi}\n` : '') +
      `- **Opened**: ${fmtDate(inc.openedAt)}\n` +
      (inc.closedAt ? `- **Closed**: ${fmtDate(inc.closedAt)}\n` : '') +
      `- **Affected Sites**:\n  - ${siteNames}\n\n` +
      `### What Has Been Done\n\n` +
      `${narrative}\n\n` +
      `### Next Steps Awaited\n\n` +
      `${inc.aiWhatIsAwaited || 'Awaiting next mandatory status update and secondary system validation.'}\n\n` +
      (inc.teamsBridgeLink
        ? `🔗 [Join Command Bridge](${inc.teamsBridgeLink})\n`
        : '')
    );
  }

  // =====================================================================
  // Pattern: General conversational fallback
  // =====================================================================
  const activeCount = activeIncidents.length;

  return (
    `### 🤖 CIM Command Copilot\n\n` +
    `Hello! I'm your AI operations assistant for the Critical Incident Management Portal. ` +
    `We're currently tracking **${activeCount} active incident${activeCount !== 1 ? 's' : ''}** across **${sites.length} sites**.\n\n` +
    `Here are some things you can ask me:\n\n` +
    `- 📊 *"Give me an executive summary"*\n` +
    `- 📋 *"List all active incidents"*\n` +
    `- 📍 *"What's happening in Chicago?"*\n` +
    `- 🔍 *"Tell me about INC0010001"*\n` +
    `- 📞 *"Send me the Teams bridge link for INC0000060"*\n` +
    `- 📈 *"How many incidents are open?"*\n` +
    `- ❓ *"What priority is INC0010001?"*\n\n` +
    `How can I help you coordinate operations today? 😊`
  );
}

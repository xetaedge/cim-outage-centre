import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { callGeminiAPI } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const { notes = '', transcriptLines = [] } = body;

    const incident = await prisma.incident.findFirst({
      where: { OR: [{ id }, { number: id }] },
      include: {
        updates: {
          orderBy: { updateNumber: 'desc' },
          take: 3,
        },
        sites: {
          include: { site: true },
        },
      },
    });

    if (!incident) {
      return NextResponse.json({ success: false, error: 'Incident not found' }, { status: 404 });
    }

    // Prepare discussion content
    let discussionContent = '';
    if (typeof notes === 'string' && notes.trim()) {
      discussionContent += `FACILITATOR DISCUSSION NOTES:\n${notes.trim()}\n\n`;
    }

    if (Array.isArray(transcriptLines) && transcriptLines.length > 0) {
      discussionContent += `LIVE TEAMS TRANSCRIPTION STREAM:\n${transcriptLines.join('\n')}\n\n`;
    }

    if (!discussionContent.trim()) {
      // Fallback to latest updates and incident description if no notes provided yet
      const recentUpdates = incident.updates.map(u => `[Update #${u.updateNumber} - ${u.authorName}]: ${u.comment}`).join('\n');
      discussionContent = `INCIDENT BASE TELEMETRY:\nDescription: ${incident.description || incident.shortDescription}\nRecent updates:\n${recentUpdates || 'Command bridge newly convened.'}`;
    }

    const sitesList = incident.sites.map((s: any) => s.site.name).join(', ') || 'Global';

    const prompt = `You are "Whisper AI", an enterprise Incident Command Bridge AI assistant monitoring the Microsoft Teams meeting for Major Incident ${incident.number}.

INCIDENT CONTEXT:
- Number: ${incident.number}
- Short Description: ${incident.shortDescription}
- Priority: ${incident.priority}
- Status: ${incident.status}
- Assignment Group: ${incident.assignmentGroup}
- Affected Locations: ${sitesList}
- Teams Bridge: ${incident.teamsBridgeLink || 'Active Bridge Call'}

LIVE TEAMS MEETING TRANSCRIPT & FACILITATOR NOTES:
${discussionContent}

TASK:
Analyze the meeting discussion notes and synthesize the latest incident update summary.
Return ONLY valid JSON matching this exact structure:
{
  "suggestedSummary": "A crisp, authoritative 2-3 sentence incident timeline update written in clear professional ITSM language. Explains current technical state, concrete actions executed on the call, and immediate next steps.",
  "focusArea": "Short 4-8 word technical focus (e.g., 'Core Switch BGP Flap Isolation & Interface Bounce')",
  "keyHighlights": [
    "Key observation or diagnostic finding 1",
    "Key observation or diagnostic finding 2",
    "Key observation or diagnostic finding 3"
  ],
  "actionItems": [
    "Specific task assigned on call with owning group or role",
    "Specific task assigned on call with owning group or role"
  ],
  "bridgeStatus": "TRIAGING_ROOT_CAUSE"
}`;

    const aiRes = await callGeminiAPI({
      prompt,
      systemPrompt: 'You are Whisper AI. You analyze Microsoft Teams bridge meeting audio transcripts and facilitator notes to formulate accurate, factual, and concise ITSM updates.',
      temperature: 0.25,
      maxOutputTokens: 1500,
      jsonOutput: true,
    });

    const parsed = aiRes.parsedJson || {};
    const suggestedSummary = parsed.suggestedSummary || `Teams bridge convened for ${incident.number}. Engineering teams are investigating telemetry for ${incident.shortDescription} across ${sitesList}. Remediation workflows are actively progressing.`;
    const focusArea = parsed.focusArea || `${incident.assignmentGroup} Diagnostic Triage`;
    const keyHighlights = Array.isArray(parsed.keyHighlights) ? parsed.keyHighlights : ['Engineering bridge coordinating across domains', 'Telemetry inspection underway'];
    const actionItems = Array.isArray(parsed.actionItems) ? parsed.actionItems : ['Monitor latency checkpoints', 'Prepare scheduled status update'];
    const bridgeStatus = parsed.bridgeStatus || 'TRIAGING_ROOT_CAUSE';

    // Persist latest suggested summary and notes on the incident record
    await prisma.incident.update({
      where: { id: incident.id },
      data: {
        whisperLatestSummary: suggestedSummary,
        whisperLastSyncedAt: new Date(),
        ...(notes && notes.trim() ? { whisperLatestNotes: notes.trim() } : {}),
      },
    }).catch(e => console.warn('[Whisper AI] Failed to cache summary on incident:', e.message));

    return NextResponse.json({
      success: true,
      suggestedSummary,
      focusArea,
      keyHighlights,
      actionItems,
      bridgeStatus,
      lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    });
  } catch (err: any) {
    console.error('[Whisper AI Suggestion Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

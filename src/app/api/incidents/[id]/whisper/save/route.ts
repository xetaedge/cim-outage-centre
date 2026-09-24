import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const {
      transcriptText,
      notes = '',
      summary = '',
      actionItems = [],
      meetingTitle = '',
      meetingUrl = '',
      source = 'TEAMS_FACILITATOR',
    } = body;

    const cookieStore = cookies();
    const token = cookieStore.get('cim_token')?.value;
    const session = token ? verifyToken(token) : null;
    const authorName = session?.name || 'Incident Manager';

    if (!transcriptText && !notes) {
      return NextResponse.json(
        { success: false, error: 'Transcription text or notes are required to save.' },
        { status: 400 }
      );
    }

    const incident = await prisma.incident.findFirst({
      where: { OR: [{ id }, { number: id }] },
    });

    if (!incident) {
      return NextResponse.json({ success: false, error: 'Incident not found' }, { status: 404 });
    }

    const effectiveTitle = meetingTitle || `Teams Command Bridge - ${incident.number} (${new Date().toLocaleDateString()})`;
    const effectiveText = (transcriptText || notes).trim();
    const effectiveActionItems = Array.isArray(actionItems) ? actionItems.join('\n') : (typeof actionItems === 'string' ? actionItems : '');

    const newTranscript = await prisma.incidentTranscript.create({
      data: {
        incidentId: incident.id,
        title: effectiveTitle,
        meetingUrl: meetingUrl || incident.teamsBridgeLink || null,
        transcriptText: effectiveText,
        notes: notes || null,
        summary: summary || null,
        actionItems: effectiveActionItems || null,
        source: source || 'TEAMS_FACILITATOR',
        capturedBy: authorName,
      },
    });

    // Update incident telemetry cache
    await prisma.incident.update({
      where: { id: incident.id },
      data: {
        whisperLatestNotes: notes || effectiveText.slice(0, 2000),
        whisperLatestSummary: summary || incident.whisperLatestSummary,
        whisperLastSyncedAt: new Date(),
      },
    }).catch(e => console.warn('[Whisper AI] Update incident error:', e.message));

    // Audit Log entry
    await prisma.auditLog.create({
      data: {
        userId: session?.id || null,
        userName: authorName,
        userRole: session?.role || 'INCIDENT_MANAGER',
        action: 'TRANSCRIPT_STORED',
        details: `Saved full meeting transcription for ${incident.number} ("${effectiveTitle}"). Words: ${effectiveText.split(/\s+/).length}.`,
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      transcript: newTranscript,
      message: 'Full meeting transcription successfully archived.',
    });
  } catch (err: any) {
    console.error('[Whisper AI Save Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

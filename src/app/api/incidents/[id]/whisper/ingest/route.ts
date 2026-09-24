import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  return NextResponse.json({
    status: 'ACTIVE',
    service: 'Whisper AI Facilitator Ingestion Webhook',
    targetIncident: id,
    usage: 'POST JSON payload with { notes?: string, transcript?: string, speaker?: string, meetingTitle?: string, meetingUrl?: string }',
    examplePayload: {
      notes: 'Lead engineer confirmed DB primary failover completed. Cache hit ratio stabilizing.',
      transcript: '10:04:12 [John Doe]: Team, please check ping times to the primary router in Dallas.\n10:04:35 [Alice]: Latency is down to 4ms now.',
      meetingTitle: 'P1 Bridge Call',
      meetingUrl: 'https://teams.microsoft.com/l/meetup-join/...',
    },
  });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const {
      notes = '',
      transcript = '',
      speaker = '',
      meetingTitle = '',
      meetingUrl = '',
      autoArchive = false,
    } = body;

    const incident = await prisma.incident.findFirst({
      where: { OR: [{ id }, { number: id }] },
    });

    if (!incident) {
      return NextResponse.json({ success: false, error: 'Incident not found' }, { status: 404 });
    }

    // Format new discussion chunk
    let formattedNoteChunk = '';
    const timestampStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (speaker) {
      formattedNoteChunk = `[${timestampStr}] ${speaker}: ${notes || transcript}`;
    } else if (notes) {
      formattedNoteChunk = `[${timestampStr}] ${notes}`;
    } else if (transcript) {
      formattedNoteChunk = transcript;
    }

    // Append to existing notes or start fresh
    const existingNotes = incident.whisperLatestNotes || '';
    const updatedNotes = existingNotes
      ? `${existingNotes}\n${formattedNoteChunk}`.trim()
      : formattedNoteChunk.trim();

    // Update incident with latest notes stream
    await prisma.incident.update({
      where: { id: incident.id },
      data: {
        whisperLatestNotes: updatedNotes,
        whisperLastSyncedAt: new Date(),
        ...(meetingUrl && !incident.teamsBridgeLink ? { teamsBridgeLink: meetingUrl } : {}),
      },
    });

    // If autoArchive is requested or a full transcript was sent, archive to IncidentTranscript
    if (autoArchive && (transcript || updatedNotes)) {
      await prisma.incidentTranscript.create({
        data: {
          incidentId: incident.id,
          title: meetingTitle || `Facilitator Session - ${incident.number}`,
          meetingUrl: meetingUrl || incident.teamsBridgeLink || null,
          transcriptText: (transcript || updatedNotes).trim(),
          notes: notes || null,
          source: 'TEAMS_FACILITATOR',
          capturedBy: speaker ? `Facilitator (${speaker})` : 'Teams Facilitator App',
        },
      }).catch(e => console.warn('[Whisper Ingest] Archive error:', e.message));
    }

    return NextResponse.json({
      success: true,
      message: 'Discussion notes successfully received by Whisper AI.',
      incidentNumber: incident.number,
      lastSyncedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[Whisper Ingest Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

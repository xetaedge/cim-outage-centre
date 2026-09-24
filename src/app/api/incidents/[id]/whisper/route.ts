import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchTeamsMeetingTranscriptDetails } from '@/lib/teams';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const incident = await prisma.incident.findFirst({
      where: { OR: [{ id }, { number: id }] },
      include: {
        transcripts: {
          orderBy: { createdAt: 'desc' },
        },
        updates: {
          orderBy: { updateNumber: 'desc' },
          take: 5,
        },
      },
    });

    if (!incident) {
      return NextResponse.json({ success: false, error: 'Incident not found' }, { status: 404 });
    }

    // 1. Fetch live transcript lines and diagnostic info from Microsoft Graph API
    let liveGraphTranscript: string[] = [];
    let graphStatus: any = null;

    if (incident.teamsBridgeLink) {
      try {
        const details = await fetchTeamsMeetingTranscriptDetails(incident.number, incident.teamsBridgeLink);
        liveGraphTranscript = details.lines || [];
        graphStatus = {
          hasMeeting: details.hasMeeting,
          meetingId: details.meetingId || null,
          transcriptsFound: details.transcriptsFound,
          errorCode: details.errorCode || null,
          error: details.error || null,
          adminActionRequired: Boolean(details.adminActionRequired),
          instructions: details.instructions || [],
        };
      } catch (graphErr: any) {
        console.warn('[Whisper AI] Graph API fetch notice:', graphErr.message);
        graphStatus = {
          hasMeeting: false,
          errorCode: 'FetchException',
          error: graphErr.message,
        };
      }
    }

    // 2. Parse facilitator notes if available
    let facilitatorNotes = incident.whisperLatestNotes || '';

    // If new transcript lines were fetched from Graph API, persist to incident record
    if (liveGraphTranscript.length > 0) {
      const freshJoined = liveGraphTranscript.join('\n');
      if (freshJoined !== incident.whisperLatestNotes) {
        facilitatorNotes = freshJoined;
        await prisma.incident.update({
          where: { id: incident.id },
          data: {
            whisperLatestNotes: freshJoined,
            whisperLastSyncedAt: new Date(),
          },
        }).catch(() => {});
      }
    }

    // 3. Construct current live discussion lines
    const activeDiscussionLines: string[] = [];
    if (liveGraphTranscript.length > 0) {
      activeDiscussionLines.push(...liveGraphTranscript);
    } else if (facilitatorNotes.trim()) {
      // Split facilitator notes into bullet lines
      const splitLines = facilitatorNotes.split('\n').filter(l => l.trim().length > 0);
      activeDiscussionLines.push(...splitLines);
    }

    return NextResponse.json({
      success: true,
      incidentNumber: incident.number,
      meetingUrl: incident.teamsBridgeLink || null,
      isBridgeConfigured: Boolean(incident.teamsBridgeLink),
      liveDiscussionLines: activeDiscussionLines,
      facilitatorNotes,
      latestSummary: incident.whisperLatestSummary || null,
      lastSyncedAt: incident.whisperLastSyncedAt || null,
      savedTranscripts: incident.transcripts || [],
      webhookUrl: `/api/incidents/${incident.id}/whisper/ingest`,
      graphStatus,
    });
  } catch (err: any) {
    console.error('[Whisper AI] Error fetching meeting status:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { notes } = body;

    const incident = await prisma.incident.findFirst({
      where: { OR: [{ id }, { number: id }] },
    });

    if (!incident) {
      return NextResponse.json({ success: false, error: 'Incident not found' }, { status: 404 });
    }

    const updated = await prisma.incident.update({
      where: { id: incident.id },
      data: {
        whisperLatestNotes: notes || '',
        whisperLastSyncedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      notes: updated.whisperLatestNotes,
      lastSyncedAt: updated.whisperLastSyncedAt,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

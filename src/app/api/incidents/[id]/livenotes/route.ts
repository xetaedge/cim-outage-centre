import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateLiveAINotes } from '@/lib/openai';
import { fetchTeamsMeetingTranscript } from '@/lib/teams';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const incident = await prisma.incident.findUnique({
      where: { id: params.id },
      include: {
        updates: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    });

    if (!incident) {
      return NextResponse.json({ success: false, error: 'Incident not found' }, { status: 404 });
    }

    const transcriptLines = await fetchTeamsMeetingTranscript(incident.number, incident.teamsBridgeLink);
    const updateStrings = incident.updates.map(u => `[Log - ${u.authorName || 'Engineer'}]: ${u.comment}`);
    const combinedData = [...transcriptLines, ...updateStrings];

    const notes = await generateLiveAINotes(
      incident.number,
      incident.shortDescription,
      incident.priority,
      incident.status,
      combinedData
    );

    return NextResponse.json({
      success: true,
      notes: {
        ...notes,
        transcripts: transcriptLines,
        meetingUrl: incident.teamsBridgeLink
      }
    });
  } catch (err: any) {
    console.error('Error fetching live AI notes:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

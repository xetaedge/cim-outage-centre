import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendInstantMeetingInvite } from '@/lib/teams';
import { resolveBridgeRecipients, sendEmail, getAssignmentGroupEmail, getSiteEmails } from '@/lib/email';
import { buildBridgeEmail } from '@/templates/bridgeEmailTemplate';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const incident = await prisma.incident.findFirst({
      where: {
        OR: [{ id }, { number: id }],
      },
      include: {
        sites: {
          include: {
            site: {
              include: {
                supportPersons: true,
              },
            },
          },
        },
      },
    });

    if (!incident) {
      return NextResponse.json({ success: false, error: 'Incident not found' }, { status: 404 });
    }

    const recipients = await resolveBridgeRecipients(incident);

    return NextResponse.json({
      success: true,
      incidentNumber: incident.number,
      meetingUrl: incident.teamsBridgeLink,
      recipients,
      totalAttendees: recipients.allEmails.length,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    let incident = await prisma.incident.findFirst({
      where: {
        OR: [{ id }, { number: id }],
      },
      include: {
        sites: {
          include: {
            site: {
              include: {
                supportPersons: true,
              },
            },
          },
        },
      },
    });

    if (!incident) {
      return NextResponse.json({ success: false, error: 'Incident not found' }, { status: 404 });
    }

    // 1. Dispatch Microsoft Teams Online Meeting & Calendar Invite (Graph API + Nodemailer)
    const inviteResult = await sendInstantMeetingInvite(incident, false);

    // Refresh incident to capture any updated teamsBridgeLink
    const refreshed = await prisma.incident.findUnique({
      where: { id: incident.id },
      include: {
        sites: {
          include: {
            site: {
              include: {
                supportPersons: true,
              },
            },
          },
        },
      },
    });
    if (refreshed) incident = refreshed;

    // 2. Dispatch Bridge Details HTML Email via Microsoft Graph / Nodemailer
    const locations = incident.sites?.map((s: any) => s.site?.name).join(', ') || 'Global';
    const bridgeHtml = buildBridgeEmail({
      incidentNumber: incident.number,
      priority: incident.priority,
      location: locations,
      shortDescription: incident.shortDescription,
      teamsBridgeLink: incident.teamsBridgeLink || '',
      conferenceId: incident.teamsConferenceId || '123456789#',
    });

    const agEmail = await getAssignmentGroupEmail(incident.assignmentGroup);
    const siteEmails = getSiteEmails(incident.sites);
    const extraEmails = [agEmail, siteEmails].filter(Boolean).join(',');

    const emailResult = await sendEmail(
      'BRIDGE_RECIPIENTS',
      `Priority Incident Bridge Details - ${incident.number}`,
      bridgeHtml,
      extraEmails
    );

    const recipients = await resolveBridgeRecipients(incident);

    // Log Audit Log entry
    await prisma.auditLog.create({
      data: {
        userName: 'Incident Manager',
        userRole: 'INCIDENT_MANAGER',
        action: 'BRIDGE_INVITE_DISPATCHED',
        details: `Dispatched Teams Command Bridge meeting invite for ${incident.number} to ${recipients.allEmails.length} recipients (Bridge Recipients, ${incident.assignmentGroup || 'Assignment Group'}, Affected Sites).`,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Teams Command Bridge meeting successfully dispatched to ${recipients.allEmails.length} recipients.`,
      inviteResult,
      emailResult,
      recipients,
      totalAttendees: recipients.allEmails.length,
      meetingUrl: incident.teamsBridgeLink,
    });
  } catch (err: any) {
    console.error('Error dispatching bridge meeting invite:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

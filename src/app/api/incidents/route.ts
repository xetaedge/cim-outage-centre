import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateAIIncidentInsights } from '@/lib/openai';
import { sendInstantMeetingInvite, sendTeamsBridgeNotification, getTeamsCredentials, formatTeamsBridgeLink } from '@/lib/teams';
import { sendEmail, getAssignmentGroupEmail, getSiteEmails } from '@/lib/email';
import { buildBridgeEmail } from '@/templates/bridgeEmailTemplate';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const priority = searchParams.get('priority');
    const status = searchParams.get('status');
    const group = searchParams.get('assignmentGroup');
    const service = searchParams.get('businessService');

    const where: any = {};

    if (search) {
      where.OR = [
        { number: { contains: search } },
        { shortDescription: { contains: search } },
        { description: { contains: search } },
        { assignmentGroup: { contains: search } },
        { businessService: { contains: search } },
        { cti: { contains: search } },
      ];
    }

    if (priority && priority !== 'ALL') {
      where.priority = priority;
    }

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (group && group !== 'ALL') {
      where.assignmentGroup = group;
    }

    if (service && service !== 'ALL') {
      where.businessService = service;
    }

    const incidents = await prisma.incident.findMany({
      where,
      include: {
        updates: { orderBy: { updateNumber: 'asc' } },
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
      orderBy: [
        { priority: 'asc' },
        { openedAt: 'desc' },
      ],
    });

    const assignmentGroups = await prisma.assignmentGroup.findMany();
    const agMap = new Map(assignmentGroups.map((g) => [g.name.trim().toLowerCase(), g.email]));

    const incidentsWithEmails = incidents.map((inc) => ({
      ...inc,
      assignmentGroupEmail: agMap.get(inc.assignmentGroup?.trim().toLowerCase()) || '',
    }));

    return NextResponse.json({ success: true, incidents: incidentsWithEmails });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      number,
      shortDescription,
      description,
      priority = 'P1',
      status = 'INVESTIGATING',
      assignmentGroup = 'Database Administration',
      assignedTo,
      cmdbCi,
      businessService,
      cti,
      issueSummary,
      teamsBridgeLink,
      affectedSiteIds = [],
    } = body;

    if (!number || !shortDescription) {
      return NextResponse.json(
        { success: false, error: 'Incident number and short description are required' },
        { status: 400 }
      );
    }

    const cleanNum = number.trim().toUpperCase();

    // Check affected sites
    const siteNames = await prisma.site.findMany({
      where: { id: { in: affectedSiteIds } },
      select: { name: true },
    });
    const siteNameStrings = siteNames.map((s) => s.name);

    // AI Insights
    const aiInsights = await generateAIIncidentInsights(
      cleanNum,
      shortDescription,
      description || shortDescription,
      priority,
      assignmentGroup,
      issueSummary ? [issueSummary] : [],
      siteNameStrings
    );

    // Check if incident already exists by number to avoid unique constraint crash
    const existing = await prisma.incident.findUnique({
      where: { number: cleanNum },
    });

    // Ensure Teams bridge link is always created
    const creds = await getTeamsCredentials();
    const finalTeamsBridgeLink = teamsBridgeLink || existing?.teamsBridgeLink || formatTeamsBridgeLink(cleanNum, creds);

    let incident;

    if (existing) {
      // Update existing incident
      incident = await prisma.incident.update({
        where: { id: existing.id },
        data: {
          shortDescription,
          description: description || existing.description,
          priority,
          status: status || existing.status,
          assignmentGroup: assignmentGroup || existing.assignmentGroup,
          assignedTo: assignedTo || existing.assignedTo,
          cmdbCi: cmdbCi || existing.cmdbCi,
          businessService: businessService || existing.businessService,
          cti: cti || existing.cti,
          issueSummary: issueSummary || existing.issueSummary,
          teamsBridgeLink: finalTeamsBridgeLink,
          ettrMinutes: aiInsights.ettrMinutes,
          aiRootCause: aiInsights.rootCause,
          aiBusinessImpact: aiInsights.businessImpact,
          aiTechnicalSummary: aiInsights.technicalSummary,
          aiExecutiveSummary: aiInsights.executiveSummary,
          aiCurrentStatusSummary: aiInsights.currentStatusSummary || issueSummary || shortDescription,
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
          updates: true,
        },
      });

      // Update site relations
      if (affectedSiteIds.length > 0) {
        await prisma.incidentSite.deleteMany({
          where: { incidentId: existing.id },
        });

        await prisma.incidentSite.createMany({
          data: affectedSiteIds.map((siteId: string) => ({
            incidentId: existing.id,
            siteId,
          })),
        });

        // Refresh incident with updated site relations
        const refreshed = await prisma.incident.findUnique({
          where: { id: existing.id },
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
            updates: true,
          },
        });
        if (refreshed) incident = refreshed;
      }
    } else {
      // Create new incident
      incident = await prisma.incident.create({
        data: {
          number: cleanNum,
          shortDescription,
          description,
          priority,
          status,
          assignmentGroup,
          assignedTo: assignedTo || 'Marcus Vance',
          cmdbCi,
          businessService,
          cti,
          issueSummary,
          teamsBridgeLink: finalTeamsBridgeLink,
          teamsConferenceId: Math.floor(100000000 + Math.random() * 900000000).toString() + '#',
          ettrMinutes: aiInsights.ettrMinutes,
          aiRootCause: aiInsights.rootCause,
          aiBusinessImpact: aiInsights.businessImpact,
          aiTechnicalSummary: aiInsights.technicalSummary,
          aiExecutiveSummary: aiInsights.executiveSummary,
          aiCurrentStatusSummary: aiInsights.currentStatusSummary || issueSummary || shortDescription,
          sites: {
            create: affectedSiteIds.map((siteId: string) => ({
              site: { connect: { id: siteId } },
            })),
          },
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
          updates: true,
        },
      });
    }

    // Update affected sites status to IMPACTED
    if (affectedSiteIds.length > 0) {
      await prisma.site.updateMany({
        where: { id: { in: affectedSiteIds } },
        data: { status: 'IMPACTED' },
      });
    }

    // Log Audit
    await prisma.auditLog.create({
      data: {
        userName: 'Incident Manager',
        userRole: 'INCIDENT_MANAGER',
        action: existing ? 'INCIDENT_UPDATED' : 'INCIDENT_CREATED',
        details: `${existing ? 'Updated' : 'Published'} incident ${cleanNum} (${priority}) with ${affectedSiteIds.length} location(s).`,
      },
    });

    if (incident) {
      try {
        await sendInstantMeetingInvite(incident, true);
        const updatedIncident = await prisma.incident.findUnique({
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
            updates: true,
          },
        });
        if (updatedIncident) {
          incident = updatedIncident;
        }
      } catch (err) {
        console.error('Failed to dispatch instant 30-min meeting invite:', err);
      }
      sendTeamsBridgeNotification(incident, existing ? 'Incident Updated' : 'Incident Published').catch((err) =>
        console.error('Failed to send Teams bridge notification:', err)
      );

      // Send Bridge Email
      if (!existing) { // Only send bridge email on new incident creation
        try {
          const locations = incident.sites?.map((s: any) => s.site?.name).join(', ') || 'Global';
          const bridgeHtml = buildBridgeEmail({
            incidentNumber: incident.number,
            priority: incident.priority,
            location: locations,
            shortDescription: incident.shortDescription,
            teamsBridgeLink: incident.teamsBridgeLink || '',
            conferenceId: incident.teamsConferenceId || '123456789#',
          });

          // Fetch Assignment Group email and site emails
          const agEmail = await getAssignmentGroupEmail(incident.assignmentGroup);
          const siteEmails = getSiteEmails(incident.sites);
          const extraEmails = [agEmail, siteEmails].filter(Boolean).join(',');

          sendEmail(
            'BRIDGE_RECIPIENTS',
            `Priority Incident Bridge Details - ${incident.number}`,
            bridgeHtml,
            extraEmails
          );
        } catch (emailErr) {
          console.error('Failed to send bridge email:', emailErr);
        }
      }
    }

    const assignmentGroupEmail = await getAssignmentGroupEmail(incident.assignmentGroup);

    return NextResponse.json({
      success: true,
      incident: {
        ...incident,
        assignmentGroupEmail,
      },
    });
  } catch (err: any) {
    console.error('Error in POST /api/incidents:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

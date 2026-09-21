import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail, getAssignmentGroupEmail, getSiteEmails } from '@/lib/email';
import { buildCimUpdateEmail } from '@/templates/cimUpdateEmailTemplate';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const incident = await prisma.incident.findFirst({
      where: { OR: [{ id }, { number: id }] },
      include: {
        updates: { orderBy: { updateNumber: 'asc' } },
        sites: {
          include: {
            site: {
              include: { supportPersons: true },
            },
          },
        },
      },
    });

    if (!incident) {
      return NextResponse.json({ success: false, error: 'Incident not found' }, { status: 404 });
    }

    const startDt = new Date(incident.openedAt);
    const diffMs = Date.now() - startDt.getTime();
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffMins = Math.floor((diffMs % 3600000) / 60000);
    const outageDuration = `${diffHrs}h ${diffMins}m`;

    const updateCount = incident.updates.length;
    const updateSeqStr = incident.totalOutageDuration ? 'FINAL' : (updateCount > 0 ? updateCount.toString() : '1');

    const siteNames = incident.sites.map((s) => s.site.name);
    const resolutionBullets = incident.aiDoneSoFar
      ? incident.aiDoneSoFar.split('\n').filter((l: string) => l.trim()).map((l: string) => l.replace(/^[-*]\s*/, ''))
      : ['Investigating'];

    const agEmail = await getAssignmentGroupEmail(incident.assignmentGroup);
    const siteEmails = getSiteEmails(incident.sites);
    const extraEmails = [agEmail, siteEmails].filter(Boolean).join(',');

    const nextUpdateStr = incident.nextUpdateDueAt
      ? new Date(incident.nextUpdateDueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : 'N/A';

    const emailPreview = {
      subject: `Priority Incident Update - ${incident.number}`,
      updateSequence: updateSeqStr,
      incidentNumber: incident.number,
      startDate: startDt.toLocaleDateString(),
      startTime: startDt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      priority: incident.priority,
      incidentManager: incident.assignedTo || 'Unassigned',
      nextUpdate: nextUpdateStr,
      businessImpact: incident.aiBusinessImpact || 'Under Evaluation',
      sitesImpacted: siteNames.length > 0 ? siteNames.join(', ') : 'Global',
      outageDuration: incident.totalOutageDuration || outageDuration,
      assignmentGroup: incident.assignmentGroup || 'General',
      relatedIncidents: incident.relatedIncidents || 'None',
      issueSummary: incident.issueSummary || incident.shortDescription,
      resolutionBullets,
      overallStatus: incident.aiCurrentStatusSummary || incident.status,
      teamsInvolved: incident.teamsInvolved || 'N/A',
      partnerLead: incident.partnerLead || 'N/A',
      itCoordinator: incident.cdItCoordinator || 'N/A',
      stakeholders: incident.stakeholdersInformed || 'N/A',
      teamsLink: incident.teamsBridgeLink || '#',
      extraEmails,
    };

    return NextResponse.json({ success: true, emailPreview });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const payload = await request.json();

    const {
      subject,
      extraEmails = '',
      updateSequence,
      incidentNumber,
      startDate,
      startTime,
      priority,
      incidentManager,
      nextUpdate,
      businessImpact,
      sitesImpacted,
      outageDuration,
      assignmentGroup,
      relatedIncidents,
      issueSummary,
      resolutionBullets,
      overallStatus,
      teamsInvolved,
      partnerLead,
      itCoordinator,
      stakeholders,
      teamsLink,
    } = payload;

    if (!subject || !incidentNumber) {
      return NextResponse.json(
        { success: false, error: 'Missing required email fields (subject, incidentNumber)' },
        { status: 400 }
      );
    }

    // Convert the bullet array back to HTML list
    const bulletArray: string[] = Array.isArray(resolutionBullets) ? resolutionBullets : ['Investigating'];
    const resolutionStatus = `<ul>${bulletArray.map((b: string) => `<li>${b}</li>`).join('')}</ul>`;

    const html = buildCimUpdateEmail({
      updateSequence: updateSequence || '1',
      incidentNumber,
      startDate: startDate || '',
      startTime: startTime || '',
      priority: priority || 'P1',
      incidentManager: incidentManager || 'Unassigned',
      nextUpdate: nextUpdate || 'N/A',
      businessImpact: businessImpact || 'Under Evaluation',
      sitesImpacted: sitesImpacted || 'Global',
      outageDuration: outageDuration || 'N/A',
      assignmentGroup: assignmentGroup || 'General',
      relatedIncidents: relatedIncidents || 'None',
      issueSummary: issueSummary || '',
      resolutionStatus,
      overallStatus: overallStatus || '',
      teamsInvolved: teamsInvolved || 'N/A',
      partnerLead: partnerLead || 'N/A',
      itCoordinator: itCoordinator || 'N/A',
      stakeholders: stakeholders || 'N/A',
      teamsLink: teamsLink || '#',
    });

    const result = await sendEmail('CIM_UPDATE_RECIPIENTS', subject, html, extraEmails);

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

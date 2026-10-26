import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendEmail, getAssignmentGroupEmail, getSiteEmails } from '@/lib/email';
import { buildCimUpdateEmail } from '@/templates/cimUpdateEmailTemplate';

export const dynamic = 'force-dynamic';

// Every field lands in an HTML email body, so escape it to stop injected markup or links.
function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

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
  const auth = await requireSession(['ADMIN', 'INCIDENT_MANAGER']);
  if (auth instanceof NextResponse) return auth;

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
    const resolutionStatus = `<ul>${bulletArray.map((b: string) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`;

    const html = buildCimUpdateEmail({
      updateSequence: escapeHtml(updateSequence || '1'),
      incidentNumber: escapeHtml(incidentNumber),
      startDate: escapeHtml(startDate || ''),
      startTime: escapeHtml(startTime || ''),
      priority: escapeHtml(priority || 'P1'),
      incidentManager: escapeHtml(incidentManager || 'Unassigned'),
      nextUpdate: escapeHtml(nextUpdate || 'N/A'),
      businessImpact: escapeHtml(businessImpact || 'Under Evaluation'),
      sitesImpacted: escapeHtml(sitesImpacted || 'Global'),
      outageDuration: escapeHtml(outageDuration || 'N/A'),
      assignmentGroup: escapeHtml(assignmentGroup || 'General'),
      relatedIncidents: escapeHtml(relatedIncidents || 'None'),
      issueSummary: escapeHtml(issueSummary || ''),
      resolutionStatus,
      overallStatus: escapeHtml(overallStatus || ''),
      teamsInvolved: escapeHtml(teamsInvolved || 'N/A'),
      partnerLead: escapeHtml(partnerLead || 'N/A'),
      itCoordinator: escapeHtml(itCoordinator || 'N/A'),
      stakeholders: escapeHtml(stakeholders || 'N/A'),
      teamsLink: /^https:\/\//i.test(teamsLink || '') ? escapeHtml(teamsLink) : '#',
    });

    const result = await sendEmail('CIM_UPDATE_RECIPIENTS', subject, html, extraEmails);

    // Persist user-edited Business Impact and Total Outage Duration to the incident record
    if (outageDuration || businessImpact) {
      await prisma.incident.updateMany({
        where: { OR: [{ id: params.id }, { number: incidentNumber }] },
        data: {
          ...(outageDuration ? { totalOutageDuration: outageDuration } : {}),
          ...(businessImpact ? { aiBusinessImpact: businessImpact } : {}),
        },
      }).catch((e) => console.warn('Could not update incident metadata during email send:', e.message));
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

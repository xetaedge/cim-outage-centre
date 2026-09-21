import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { generateAIIncidentInsights } from '@/lib/openai';
import { getAssignmentGroupEmail, getSiteEmails } from '@/lib/email';
import { fetchServiceNowAPI } from '@/lib/servicenow';
import { verifyToken } from '@/lib/auth';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const {
      comment,
      authorName,
      nextCadenceHours = 1,
      isFinalUpdate = false,
      totalOutageDuration = '',
      publishToWorknotes = true,
      additionalInfo = '',
    } = await request.json();

    const cookieStore = cookies();
    const token = cookieStore.get('cim_token')?.value;
    const session = token ? verifyToken(token) : null;
    const effectiveAuthorName = (authorName && authorName.trim()) || session?.name || 'Incident Manager';

    if (!comment) {
      return NextResponse.json({ success: false, error: 'Comment is required' }, { status: 400 });
    }

    const incident = await prisma.incident.findFirst({
      where: { OR: [{ id }, { number: id }] },
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
    });

    if (!incident) {
      return NextResponse.json({ success: false, error: 'Incident not found' }, { status: 404 });
    }

    const nextUpdateNumber = incident.updates.length + 1;

    const newUpdate = await prisma.incidentUpdate.create({
      data: {
        incidentId: incident.id,
        updateNumber: nextUpdateNumber,
        comment,
        authorName: effectiveAuthorName,
        isFinal: isFinalUpdate,
        ...(additionalInfo && additionalInfo.trim() ? { additionalInfo: additionalInfo.trim() } : {}),
      },
    });

    // Calculate next update cadence timestamp
    const cadenceHours = typeof nextCadenceHours === 'number' ? nextCadenceHours : (incident.priority === 'P2' ? 2 : 1);
    const nextDueTimestamp = new Date(Date.now() + cadenceHours * 60 * 60 * 1000);

    // Collaborate ALL chronological updates — include additionalInfo for richer AI synthesis
    const allUpdates = [...incident.updates.map((u) => u.comment), comment];
    if (additionalInfo && additionalInfo.trim()) {
      allUpdates.push(`[Additional Context for RCA] ${additionalInfo.trim()}`);
    }
    const siteNames = incident.sites.map((s) => s.site.name);

    // Auto-generate Descriptive Summary under "WHAT HAS BEEN DONE SO FAR"
    const aiResult = await generateAIIncidentInsights(
      incident.number,
      incident.shortDescription,
      incident.description || incident.shortDescription,
      incident.priority,
      incident.assignmentGroup,
      allUpdates,
      siteNames
    );

    // Store additionalInfo in the incident if provided (helps RCA later)
    const additionalInfoUpdate = additionalInfo && additionalInfo.trim()
      ? { additionalInfo: additionalInfo.trim() }
      : {};

    if (additionalInfo && additionalInfo.trim()) {
      await prisma.$executeRawUnsafe('ALTER TABLE "Incident" ADD COLUMN IF NOT EXISTS "additionalInfo" TEXT;').catch(() => {});
    }

    let updatedIncident: any;
    try {
      updatedIncident = await prisma.incident.update({
        where: { id: incident.id },
        data: {
          nextUpdateDueAt: nextDueTimestamp,
          aiCurrentStatusSummary: aiResult.currentStatusSummary,
          aiDoneSoFar: aiResult.doneSoFar,
          aiWhatIsAwaited: aiResult.whatIsAwaited,
          aiTechnicalSummary: aiResult.technicalSummary,
          issueSummary: aiResult.issueSummaryRephrased,
          ...(isFinalUpdate && totalOutageDuration ? { totalOutageDuration } : {}),
          ...additionalInfoUpdate,
        },
        include: {
          updates: { orderBy: { updateNumber: 'asc' } },
          sites: { include: { site: true } },
        },
      });
    } catch (updateErr) {
      // Graceful fallback if additionalInfo is not in current DB schema
      updatedIncident = await prisma.incident.update({
        where: { id: incident.id },
        data: {
          nextUpdateDueAt: nextDueTimestamp,
          aiCurrentStatusSummary: aiResult.currentStatusSummary,
          aiDoneSoFar: aiResult.doneSoFar,
          aiWhatIsAwaited: aiResult.whatIsAwaited,
          aiTechnicalSummary: aiResult.technicalSummary,
          issueSummary: aiResult.issueSummaryRephrased,
          ...(isFinalUpdate && totalOutageDuration ? { totalOutageDuration } : {}),
        },
        include: {
          updates: { orderBy: { updateNumber: 'asc' } },
          sites: { include: { site: true } },
        },
      });
    }

    // Audit Log
    const auditDetails = [
      `Posted Update #${nextUpdateNumber} on ${incident.number}.`,
      `Next update due at ${nextDueTimestamp.toLocaleTimeString()}.`,
      publishToWorknotes ? 'Worknotes synced to ServiceNow.' : 'Worknotes sync SKIPPED (user opted out).',
      additionalInfo ? 'Additional RCA context provided.' : '',
    ].filter(Boolean).join(' ');

    await prisma.auditLog.create({
      data: {
        userId: session?.id || null,
        userName: effectiveAuthorName,
        userRole: session?.role || 'INCIDENT_MANAGER',
        action: 'UPDATE_POSTED',
        details: auditDetails,
      },
    });

    // Build CIM Email Preview payload only if "Update Additional Info" is NOT selected
    // (Per user requirement: when selecting "Update Additional Info", it should NOT trigger an email)
    const isAdditionalInfoSelected = Boolean(additionalInfo && additionalInfo.trim());
    let emailPreview: Record<string, any> | null = null;

    if (!isAdditionalInfoSelected) {
      try {
        const startDt = new Date(incident.openedAt);
        const diffMs = Date.now() - startDt.getTime();
        const diffHrs = Math.floor(diffMs / 3600000);
        const diffMins = Math.floor((diffMs % 3600000) / 60000);
        const outageDuration = `${diffHrs}h ${diffMins}m`;

        const updateSeqStr = isFinalUpdate ? 'FINAL' : nextUpdateNumber.toString();

        const resolutionBullets = updatedIncident.aiDoneSoFar
          ? updatedIncident.aiDoneSoFar.split('\n').filter((l: string) => l.trim()).map((l: string) => l.replace(/^[-*]\s*/, ''))
          : ['Investigating'];

        // Fetch Assignment Group email and site emails for recipient preview
        const agEmail = await getAssignmentGroupEmail(incident.assignmentGroup);
        const siteEmails = getSiteEmails(incident.sites);
        const extraEmails = [agEmail, siteEmails].filter(Boolean).join(',');

        emailPreview = {
          subject: `Priority Incident Update - ${incident.number}`,
          updateSequence: updateSeqStr,
          incidentNumber: incident.number,
          startDate: startDt.toLocaleDateString(),
          startTime: startDt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          priority: incident.priority,
          incidentManager: incident.assignedTo || 'Unassigned',
          nextUpdate: isFinalUpdate ? 'N/A' : nextDueTimestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          businessImpact: updatedIncident.aiBusinessImpact || 'Under Evaluation',
          sitesImpacted: siteNames.length > 0 ? siteNames.join(', ') : 'Global',
          outageDuration: isFinalUpdate && totalOutageDuration ? totalOutageDuration : outageDuration,
          assignmentGroup: incident.assignmentGroup || 'General',
          relatedIncidents: updatedIncident.relatedIncidents || 'None',
          // AI-rephrased fields — shown prominently in the review modal
          issueSummary: updatedIncident.issueSummary || comment,
          resolutionBullets,
          overallStatus: updatedIncident.aiCurrentStatusSummary || updatedIncident.status,
          teamsInvolved: updatedIncident.teamsInvolved || 'N/A',
          partnerLead: updatedIncident.partnerLead || 'N/A',
          itCoordinator: updatedIncident.cdItCoordinator || 'N/A',
          stakeholders: updatedIncident.stakeholdersInformed || 'N/A',
          teamsLink: incident.teamsBridgeLink || '#',
          extraEmails,
        };
      } catch (emailErr) {
        console.error('Failed to build CIM email preview:', emailErr);
      }
    }

    // Sync worknotes to ServiceNow only if user opted in (publishToWorknotes flag)
    if (publishToWorknotes) {
      try {
        const workNote = `[CIM Outage Centre - Update #${nextUpdateNumber}] by ${effectiveAuthorName}:\n${comment}`;
        // First, look up the incident sys_id by number
        const lookupRes = await fetchServiceNowAPI(
          `/api/now/table/incident?sysparm_query=number=${encodeURIComponent(incident.number)}&sysparm_fields=sys_id&sysparm_limit=1`,
          { method: 'GET' }
        );
        if (lookupRes.ok) {
          const lookupData = await lookupRes.json();
          const sysId = lookupData.result?.[0]?.sys_id;
          if (sysId) {
            await fetchServiceNowAPI(
              `/api/now/table/incident/${sysId}`,
              {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ work_notes: workNote }),
              }
            );
            console.log(`[ServiceNow] Worknotes synced for ${incident.number} (sys_id: ${sysId})`);
          } else {
            console.warn(`[ServiceNow] Incident ${incident.number} not found in ServiceNow — worknotes not synced.`);
          }
        }
      } catch (snErr) {
        console.error('[ServiceNow] Failed to sync worknotes:', snErr);
      }
    } else {
      console.log(`[ServiceNow] Worknotes sync skipped for ${incident.number} — user opted out.`);
    }

    const assignmentGroupEmail = await getAssignmentGroupEmail(updatedIncident.assignmentGroup);

    return NextResponse.json({
      success: true,
      update: newUpdate,
      incident: {
        ...updatedIncident,
        assignmentGroupEmail,
      },
      emailPreview,
      emailSuppressed: isAdditionalInfoSelected,
      worknotesSynced: publishToWorknotes,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

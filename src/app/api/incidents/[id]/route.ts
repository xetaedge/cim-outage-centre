import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getAssignmentGroupEmail } from '@/lib/email';
import { verifyToken } from '@/lib/auth';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    const cookieStore = cookies();
    const token = cookieStore.get('cim_token')?.value;
    const session = token ? verifyToken(token) : null;
    const isGuest = session?.role === 'GUEST';

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

    const assignmentGroupEmail = await getAssignmentGroupEmail(incident.assignmentGroup);

    // Sanitize internal additionalInfo if requester is a GUEST
    let sanitizedIncident: any = incident;
    if (isGuest) {
      const { additionalInfo, ...restIncident } = incident;
      sanitizedIncident = {
        ...restIncident,
        updates: incident.updates.map((u: any) => {
          const { additionalInfo, ...restUpdate } = u;
          return restUpdate;
        }),
      };
    }

    return NextResponse.json({
      success: true,
      incident: {
        ...sanitizedIncident,
        assignmentGroupEmail,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await request.json();

    const existing = await prisma.incident.findFirst({
      where: { OR: [{ id }, { number: id }] },
      include: { sites: true },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Incident not found' }, { status: 404 });
    }

    const {
      status,
      shortDescription,
      description,
      cti,
      issueSummary,
      teamsBridgeLink,
      priority,
      assignmentGroup,
      assignedTo,
      cmdbCi,
      businessService,
      ettrMinutes,
      relatedIncidents,
      teamsInvolved,
      partnerLead,
      cdItCoordinator,
      stakeholdersInformed,
    } = body;

    const updateData: any = {};
    if (status) {
      updateData.status = status;
      if (status === 'RESOLVED' || status === 'CLOSED') {
        updateData.resolvedAt = new Date();
        if (status === 'CLOSED') updateData.closedAt = new Date();
      }
    }
    if (shortDescription !== undefined) updateData.shortDescription = shortDescription;
    if (description !== undefined) updateData.description = description;
    if (cti !== undefined) updateData.cti = cti;
    if (issueSummary !== undefined) updateData.issueSummary = issueSummary;
    if (teamsBridgeLink !== undefined) updateData.teamsBridgeLink = teamsBridgeLink;
    if (priority !== undefined) updateData.priority = priority;
    if (assignmentGroup !== undefined) updateData.assignmentGroup = assignmentGroup;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    if (cmdbCi !== undefined) updateData.cmdbCi = cmdbCi;
    if (businessService !== undefined) updateData.businessService = businessService;
    if (ettrMinutes !== undefined) updateData.ettrMinutes = parseInt(ettrMinutes, 10) || existing.ettrMinutes;
    if (relatedIncidents !== undefined) updateData.relatedIncidents = relatedIncidents;
    if (teamsInvolved !== undefined) updateData.teamsInvolved = teamsInvolved;
    if (partnerLead !== undefined) updateData.partnerLead = partnerLead;
    if (cdItCoordinator !== undefined) updateData.cdItCoordinator = cdItCoordinator;
    if (stakeholdersInformed !== undefined) updateData.stakeholdersInformed = stakeholdersInformed;

    const updated = await prisma.incident.update({
      where: { id: existing.id },
      data: updateData,
      include: {
        updates: true,
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

    // If incident is CLOSED, check linked sites and revert status to HEALTHY if no other active unclosed incidents remain
    if (status === 'CLOSED') {
      for (const siteRel of existing.sites) {
        const remainingUnclosed = await prisma.incidentSite.count({
          where: {
            siteId: siteRel.siteId,
            incident: { status: { notIn: ['CLOSED', 'RESOLVED'] } },
          },
        });

        if (remainingUnclosed === 0) {
          await prisma.site.update({
            where: { id: siteRel.siteId },
            data: { status: 'HEALTHY', usersImpacted: 0 },
          });
        }
      }
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userName: 'Incident Manager',
        userRole: 'INCIDENT_MANAGER',
        action: status === 'CLOSED' ? 'INCIDENT_CLOSED' : 'INCIDENT_UPDATED',
        details: `Updated incident ${existing.number}: status -> ${status || existing.status}`,
      },
    });

    const assignmentGroupEmail = await getAssignmentGroupEmail(updated.assignmentGroup);

    return NextResponse.json({
      success: true,
      incident: {
        ...updated,
        assignmentGroupEmail,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    const existing = await prisma.incident.findFirst({
      where: { OR: [{ id }, { number: id }] },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Incident not found' }, { status: 404 });
    }

    await prisma.incident.delete({ where: { id: existing.id } });

    await prisma.auditLog.create({
      data: {
        userName: 'Incident Manager',
        userRole: 'INCIDENT_MANAGER',
        action: 'INCIDENT_DELETED',
        details: `Deleted incident ${existing.number}`,
      },
    });

    return NextResponse.json({ success: true, message: `Incident ${existing.number} removed.` });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET: Return current linked sites for this incident
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    const incident = await prisma.incident.findFirst({
      where: { OR: [{ id }, { number: id }] },
      include: {
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

    return NextResponse.json({ success: true, sites: incident.sites.map((s) => s.site) });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST: Add a location to this incident
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { siteId } = body;

    if (!siteId) {
      return NextResponse.json({ success: false, error: 'siteId is required' }, { status: 400 });
    }

    const incident = await prisma.incident.findFirst({
      where: { OR: [{ id }, { number: id }] },
    });

    if (!incident) {
      return NextResponse.json({ success: false, error: 'Incident not found' }, { status: 404 });
    }

    const targetSite = await prisma.site.findUnique({
      where: { id: siteId },
    });

    if (!targetSite) {
      return NextResponse.json({ success: false, error: 'Target site not found' }, { status: 404 });
    }

    // Upsert link in IncidentSite join table
    await prisma.incidentSite.upsert({
      where: {
        incidentId_siteId: {
          incidentId: incident.id,
          siteId: targetSite.id,
        },
      },
      create: {
        incidentId: incident.id,
        siteId: targetSite.id,
      },
      update: {},
    });

    // Mark site as IMPACTED if incident is active
    if (incident.status !== 'CLOSED' && incident.status !== 'RESOLVED') {
      await prisma.site.update({
        where: { id: targetSite.id },
        data: { status: 'IMPACTED' },
      });
    }

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userName: 'Incident Manager',
        userRole: 'INCIDENT_MANAGER',
        action: 'INCIDENT_LOCATION_ADDED',
        details: `Linked location ${targetSite.name} (${targetSite.city}, ${targetSite.country}) to incident ${incident.number}`,
      },
    });

    // Return full updated incident with sites
    const updated = await prisma.incident.findUnique({
      where: { id: incident.id },
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

    return NextResponse.json({
      success: true,
      message: `Location "${targetSite.name}" added to incident ${incident.number}.`,
      incident: updated,
    });
  } catch (err: any) {
    console.error('[Incident Sites API POST] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE: Remove a location from this incident
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    let siteId = searchParams.get('siteId');

    if (!siteId) {
      try {
        const body = await request.json();
        siteId = body.siteId;
      } catch {
        // Body optional if provided in query
      }
    }

    if (!siteId) {
      return NextResponse.json({ success: false, error: 'siteId is required' }, { status: 400 });
    }

    const incident = await prisma.incident.findFirst({
      where: { OR: [{ id }, { number: id }] },
    });

    if (!incident) {
      return NextResponse.json({ success: false, error: 'Incident not found' }, { status: 404 });
    }

    // Delete relation
    await prisma.incidentSite.deleteMany({
      where: {
        incidentId: incident.id,
        siteId: siteId,
      },
    });

    // Check if the site is still linked to other unclosed incidents
    const remainingUnclosed = await prisma.incidentSite.count({
      where: {
        siteId: siteId,
        incident: { status: { notIn: ['CLOSED', 'RESOLVED'] } },
      },
    });

    if (remainingUnclosed === 0) {
      await prisma.site.update({
        where: { id: siteId },
        data: { status: 'HEALTHY' },
      });
    }

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userName: 'Incident Manager',
        userRole: 'INCIDENT_MANAGER',
        action: 'INCIDENT_LOCATION_REMOVED',
        details: `Removed location ${siteId} from incident ${incident.number}`,
      },
    });

    // Return full updated incident with sites
    const updated = await prisma.incident.findUnique({
      where: { id: incident.id },
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

    return NextResponse.json({
      success: true,
      message: `Location removed from incident ${incident.number}.`,
      incident: updated,
    });
  } catch (err: any) {
    console.error('[Incident Sites API DELETE] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

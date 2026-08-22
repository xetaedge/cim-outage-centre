import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    const site = await prisma.site.findFirst({
      where: { OR: [{ id }, { code: id }] },
      include: {
        supportPersons: {
          orderBy: [{ priority: 'asc' }, { name: 'asc' }],
        },
        incidents: {
          include: {
            incident: true,
          },
        },
        _count: {
          select: { supportPersons: true },
        },
      },
    });

    if (!site) {
      return NextResponse.json({ success: false, error: 'Site not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, site });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await request.json();

    const existing = await prisma.site.findFirst({
      where: { OR: [{ id }, { code: id }] },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Site not found' }, { status: 404 });
    }

    const {
      name,
      code,
      country,
      state,
      city,
      lat,
      lng,
      businessUnit,
      siteType,
      supportEmails,
      status,
      usersImpacted,
    } = body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (code !== undefined) updateData.code = code.trim();
    if (country !== undefined) updateData.country = country.trim();
    if (state !== undefined) updateData.state = state ? state.trim() : null;
    if (city !== undefined) updateData.city = city.trim();
    if (lat !== undefined) {
      const parsedLat = typeof lat === 'number' ? lat : parseFloat(lat);
      if (!isNaN(parsedLat)) updateData.lat = parsedLat;
    }
    if (lng !== undefined) {
      const parsedLng = typeof lng === 'number' ? lng : parseFloat(lng);
      if (!isNaN(parsedLng)) updateData.lng = parsedLng;
    }
    if (businessUnit !== undefined) updateData.businessUnit = businessUnit.trim();
    if (siteType !== undefined) updateData.siteType = siteType.trim();
    if (supportEmails !== undefined) updateData.supportEmails = supportEmails ? supportEmails.trim() : null;
    if (status !== undefined) updateData.status = status;
    if (usersImpacted !== undefined) {
      const parsedImpacted = typeof usersImpacted === 'number' ? usersImpacted : parseInt(usersImpacted, 10);
      if (!isNaN(parsedImpacted)) updateData.usersImpacted = parsedImpacted;
    }

    const updated = await prisma.site.update({
      where: { id: existing.id },
      data: updateData,
      include: {
        supportPersons: true,
        incidents: {
          include: {
            incident: true,
          },
        },
        _count: {
          select: { supportPersons: true },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        userName: 'Admin',
        userRole: 'ADMIN',
        action: 'SITE_UPDATED',
        details: `Updated site ${existing.name} (${existing.code})`,
      },
    });

    return NextResponse.json({ success: true, site: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    const existing = await prisma.site.findFirst({
      where: { OR: [{ id }, { code: id }] },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Site not found' }, { status: 404 });
    }

    await prisma.site.delete({
      where: { id: existing.id },
    });

    await prisma.auditLog.create({
      data: {
        userName: 'Admin',
        userRole: 'ADMIN',
        action: 'SITE_DELETED',
        details: `Deleted site ${existing.name} (${existing.code})`,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Site ${existing.name} (${existing.code}) deleted successfully.`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

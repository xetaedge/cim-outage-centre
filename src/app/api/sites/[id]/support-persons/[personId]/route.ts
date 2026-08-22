import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string; personId: string } }
) {
  try {
    const { id, personId } = params;

    const site = await prisma.site.findFirst({
      where: { OR: [{ id }, { code: id }] },
    });

    if (!site) {
      return NextResponse.json({ success: false, error: 'Site not found' }, { status: 404 });
    }

    const person = await prisma.siteSupportPerson.findFirst({
      where: {
        id: personId,
        siteId: site.id,
      },
    });

    if (!person) {
      return NextResponse.json(
        { success: false, error: 'Support person not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, supportPerson: person });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string; personId: string } }
) {
  try {
    const { id, personId } = params;

    const site = await prisma.site.findFirst({
      where: { OR: [{ id }, { code: id }] },
    });

    if (!site) {
      return NextResponse.json({ success: false, error: 'Site not found' }, { status: 404 });
    }

    const existing = await prisma.siteSupportPerson.findFirst({
      where: {
        id: personId,
        siteId: site.id,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Support person not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, mobile1, mobile2, email, priority, type } = body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (email !== undefined) updateData.email = email.trim();
    if (mobile1 !== undefined) updateData.mobile1 = mobile1 ? mobile1.trim() : null;
    if (mobile2 !== undefined) updateData.mobile2 = mobile2 ? mobile2.trim() : null;
    if (priority !== undefined) updateData.priority = priority.trim();
    if (type !== undefined) updateData.type = type.trim();

    const updated = await prisma.siteSupportPerson.update({
      where: { id: existing.id },
      data: updateData,
    });

    await prisma.auditLog.create({
      data: {
        userName: 'Admin',
        userRole: 'ADMIN',
        action: 'SITE_SUPPORT_PERSON_UPDATED',
        details: `Updated support person ${updated.name} for site ${site.name} (${site.code})`,
      },
    });

    return NextResponse.json({ success: true, supportPerson: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; personId: string } }
) {
  try {
    const { id, personId } = params;

    const site = await prisma.site.findFirst({
      where: { OR: [{ id }, { code: id }] },
    });

    if (!site) {
      return NextResponse.json({ success: false, error: 'Site not found' }, { status: 404 });
    }

    const existing = await prisma.siteSupportPerson.findFirst({
      where: {
        id: personId,
        siteId: site.id,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Support person not found' },
        { status: 404 }
      );
    }

    await prisma.siteSupportPerson.delete({
      where: { id: existing.id },
    });

    await prisma.auditLog.create({
      data: {
        userName: 'Admin',
        userRole: 'ADMIN',
        action: 'SITE_SUPPORT_PERSON_DELETED',
        details: `Deleted support person ${existing.name} from site ${site.name} (${site.code})`,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Support person ${existing.name} removed successfully.`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

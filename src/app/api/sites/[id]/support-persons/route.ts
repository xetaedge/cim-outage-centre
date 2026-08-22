import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    const site = await prisma.site.findFirst({
      where: { OR: [{ id }, { code: id }] },
    });

    if (!site) {
      return NextResponse.json({ success: false, error: 'Site not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const priority = searchParams.get('priority');
    const type = searchParams.get('type');

    const where: any = { siteId: site.id };
    if (priority) {
      where.priority = priority;
    }
    if (type) {
      where.type = type;
    }

    const supportPersons = await prisma.siteSupportPerson.findMany({
      where,
      orderBy: [{ priority: 'asc' }, { name: 'asc' }],
    });

    return NextResponse.json({ success: true, supportPersons });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    const site = await prisma.site.findFirst({
      where: { OR: [{ id }, { code: id }] },
    });

    if (!site) {
      return NextResponse.json({ success: false, error: 'Site not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, mobile1, mobile2, email, priority = 'Primary', type = 'Internal' } = body;

    if (!name || !name.trim() || !email || !email.trim()) {
      return NextResponse.json(
        { success: false, error: 'Name and email are required for support person' },
        { status: 400 }
      );
    }

    const newPerson = await prisma.siteSupportPerson.create({
      data: {
        siteId: site.id,
        name: name.trim(),
        email: email.trim(),
        mobile1: mobile1 ? mobile1.trim() : null,
        mobile2: mobile2 ? mobile2.trim() : null,
        priority: priority.trim(),
        type: type.trim(),
      },
    });

    await prisma.auditLog.create({
      data: {
        userName: 'Admin',
        userRole: 'ADMIN',
        action: 'SITE_SUPPORT_PERSON_CREATED',
        details: `Added support person ${newPerson.name} (${newPerson.priority}, ${newPerson.type}) to site ${site.name} (${site.code})`,
      },
    });

    return NextResponse.json({ success: true, supportPerson: newPerson }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

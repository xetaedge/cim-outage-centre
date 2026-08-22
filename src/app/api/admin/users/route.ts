import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim();
    const role = searchParams.get('role')?.trim();

    const where: any = {};
    if (role && role !== 'ALL') {
      where.role = role;
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { auditLogs: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const stats = {
      total: await prisma.user.count(),
      admins: await prisma.user.count({ where: { role: 'ADMIN' } }),
      managers: await prisma.user.count({ where: { role: 'INCIDENT_MANAGER' } }),
      guests: await prisma.user.count({ where: { role: 'GUEST' } }),
    };

    return NextResponse.json({ success: true, users, stats });
  } catch (err: any) {
    console.error('[Admin Users GET Error]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, email, password, role = 'GUEST' } = await request.json();

    if (!name || !email) {
      return NextResponse.json(
        { success: false, error: 'Name and email are required.' },
        { status: 400 }
      );
    }

    const validRoles = ['ADMIN', 'INCIDENT_MANAGER', 'GUEST'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { success: false, error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'A user with this email address already exists.' },
        { status: 409 }
      );
    }

    const passwordHash = password ? await bcrypt.hash(password, 10) : await bcrypt.hash('welcome123', 10);

    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: cleanEmail,
        role,
        passwordHash,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: newUser.id,
        userName: 'Admin',
        userRole: 'ADMIN',
        action: 'USER_CREATED_BY_ADMIN',
        details: `Administrator created user ${newUser.name} (${newUser.email}) with role: ${role}.`,
      },
    });

    return NextResponse.json({ success: true, user: newUser, message: `User ${newUser.name} created successfully.` });
  } catch (err: any) {
    console.error('[Admin Users POST Error]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

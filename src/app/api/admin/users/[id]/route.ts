import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, user });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { name, email, role, password } = body;

    const existing = await prisma.user.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }

    const data: any = {};
    if (name) data.name = name.trim();
    if (email) data.email = email.toLowerCase().trim();
    if (role) {
      const validRoles = ['ADMIN', 'INCIDENT_MANAGER', 'GUEST'];
      if (!validRoles.includes(role)) {
        return NextResponse.json(
          { success: false, error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
          { status: 400 }
        );
      }
      data.role = role;
    }
    if (password) {
      data.passwordHash = await bcrypt.hash(password, 10);
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Audit log
    const roleChanged = role && role !== existing.role;
    await prisma.auditLog.create({
      data: {
        userId: existing.id,
        userName: 'Admin',
        userRole: 'ADMIN',
        action: roleChanged ? 'USER_ROLE_UPDATED' : 'USER_UPDATED',
        details: roleChanged
          ? `Changed role for ${existing.name} (${existing.email}) from ${existing.role} to ${role}.`
          : `Updated details for ${existing.name} (${existing.email}).`,
      },
    });

    return NextResponse.json({
      success: true,
      user: updated,
      message: `Permissions updated for ${updated.name}: ${updated.role}.`,
    });
  } catch (err: any) {
    console.error('[Admin User Update Error]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    const existing = await prisma.user.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }

    // Unlink audit logs before deleting user to avoid foreign key constraints
    await prisma.auditLog.updateMany({
      where: { userId: id },
      data: { userId: null },
    });

    await prisma.user.delete({
      where: { id },
    });

    await prisma.auditLog.create({
      data: {
        userName: 'Admin',
        userRole: 'ADMIN',
        action: 'USER_DELETED',
        details: `Deleted user account ${existing.name} (${existing.email}).`,
      },
    });

    return NextResponse.json({
      success: true,
      message: `User account ${existing.name} deleted successfully.`,
    });
  } catch (err: any) {
    console.error('[Admin User Delete Error]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

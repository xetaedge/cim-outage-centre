import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { signToken, UserRole } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { success: false, error: 'Full name, email, and password are required.' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters long.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'An account with this email address already exists. Please log in.' },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // First time registration defaults to GUEST permission
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: cleanEmail,
        role: 'GUEST',
        passwordHash,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        userName: user.name,
        userRole: 'GUEST',
        action: 'USER_REGISTERED',
        details: `User ${user.name} (${user.email}) registered locally. Assigned default permission: GUEST.`,
      },
    });

    const sessionUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as UserRole,
    };

    const token = signToken(sessionUser);

    const response = NextResponse.json({
      success: true,
      user: sessionUser,
      message: 'Account created successfully! You are assigned Guest permissions. Contact an Administrator for elevated access.',
    });

    response.cookies.set('cim_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (err: any) {
    console.error('[Registration Error]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { signToken, UserRole } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials. User not found.' },
        { status: 401 }
      );
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch && user.passwordHash !== password) {
      return NextResponse.json(
        { success: false, error: 'Invalid password. Please check your credentials.' },
        { status: 401 }
      );
    }

    const sessionUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as UserRole,
    };

    const token = signToken(sessionUser);

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action: 'LOCAL_LOGIN',
        details: `User ${user.name} (${user.email}) logged in via local credentials.`,
      },
    });

    const response = NextResponse.json({
      success: true,
      user: sessionUser,
      message: `Welcome back, ${user.name}!`,
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
    console.error('[Login Error]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signToken, UserRole } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { role } = await request.json();

    const targetRole: UserRole = role || 'GUEST';
    let user = await prisma.user.findFirst({
      where: { role: targetRole },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: targetRole === 'ADMIN' ? 'Sarah Connor (Admin)' : targetRole === 'INCIDENT_MANAGER' ? 'Alex Vance (Incident Manager)' : 'Guest Viewer',
          email: `${targetRole.toLowerCase()}@organization.com`,
          role: targetRole,
          passwordHash: 'hashed',
        },
      });
    }

    const sessionUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as UserRole,
    };

    const token = signToken(sessionUser);

    const response = NextResponse.json({ success: true, user: sessionUser, token });
    response.cookies.set('cim_token', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

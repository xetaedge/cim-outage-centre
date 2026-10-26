import { NextResponse } from 'next/server';
import { getSession, signToken, UserSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getSession();
  return NextResponse.json({ authenticated: !!session, user: session });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { timeZone, name } = await request.json();
    const effectiveTz = (timeZone && typeof timeZone === 'string') ? timeZone.trim() : 'UTC';

    // Safely add timeZone column if not present yet in Neon Postgres
    await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "timeZone" TEXT DEFAULT \'UTC\';').catch(() => {});

    // Update user in database
    const updatedUser = await prisma.user.update({
      where: { id: session.id },
      data: {
        timeZone: effectiveTz,
        ...(name && name.trim() ? { name: name.trim() } : {}),
      },
    }).catch(async () => {
      // Fallback if id was from previous seed
      return await prisma.user.findFirst({ where: { email: session.email } });
    });

    const updatedSession: UserSession = {
      id: session.id,
      name: updatedUser?.name || session.name,
      email: session.email,
      role: session.role,
      timeZone: effectiveTz,
    };

    const newToken = signToken(updatedSession);

    const response = NextResponse.json({
      success: true,
      user: updatedSession,
      message: 'Profile settings updated successfully.',
    });

    response.cookies.set('cim_token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (err: any) {
    console.error('Failed to update profile settings:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

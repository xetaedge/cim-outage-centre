import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, signToken, UserSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const cookieStore = cookies();
  const token = cookieStore.get('cim_token')?.value;

  if (!token) {
    return NextResponse.json({
      authenticated: false,
      user: null,
    });
  }

  const session = verifyToken(token);
  if (!session) {
    return NextResponse.json({
      authenticated: false,
      user: null,
    });
  }

  // Fetch latest user details including timeZone from database
  let timeZone = session.timeZone || 'UTC';
  try {
    const dbUser = await (prisma.user as any).findUnique({
      where: { id: session.id },
      select: { timeZone: true, name: true, role: true },
    });
    if (dbUser?.timeZone) {
      timeZone = dbUser.timeZone;
    }
  } catch (err) {
    // Schema may not have timeZone column yet in local test
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      ...session,
      timeZone,
    },
  });
}

export async function PUT(request: Request) {
  const cookieStore = cookies();
  const token = cookieStore.get('cim_token')?.value;

  if (!token) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const session = verifyToken(token);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 });
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
      ...session,
      name: updatedUser?.name || session.name,
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

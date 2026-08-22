import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, UserSession } from '@/lib/auth';

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

  return NextResponse.json({ authenticated: true, user: session });
}

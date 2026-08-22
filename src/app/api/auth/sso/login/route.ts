import { NextResponse } from 'next/server';
import { getTeamsCredentials } from '@/lib/teams';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const creds = await getTeamsCredentials();
    const url = new URL(request.url);
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || url.host;
    const proto = request.headers.get('x-forwarded-proto') || (url.protocol.replace(':', '')) || 'http';
    const baseUrl = `${proto}://${host}`;
    const redirectUri = `${baseUrl}/api/auth/sso/callback`;

    const tenantId = creds.tenantId || process.env.AZURE_TENANT_ID || '00550e88-11f9-4a42-b775-d0274f01576e';
    const clientId = creds.clientId || process.env.AZURE_CLIENT_ID || 'bcb10dc2-3ef1-41f3-aa41-2f1cef152a7a';

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: 'Microsoft Client ID is not configured in Admin Settings.' },
        { status: 400 }
      );
    }

    const state = Math.random().toString(36).substring(2, 15);
    const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?client_id=${encodeURIComponent(
      clientId
    )}&response_type=code&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_mode=query&scope=${encodeURIComponent(
      'openid profile email User.Read'
    )}&state=${encodeURIComponent(state)}`;

    const response = NextResponse.redirect(authUrl);
    response.cookies.set('sso_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 600, // 10 minutes
    });

    return response;
  } catch (err: any) {
    console.error('[SSO Login Error]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

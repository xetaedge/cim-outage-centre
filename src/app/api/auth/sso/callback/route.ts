import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTeamsCredentials } from '@/lib/teams';
import { signToken, UserRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || url.host;
  const proto = request.headers.get('x-forwarded-proto') || (url.protocol.replace(':', '')) || 'http';
  const baseUrl = `${proto}://${host}`;

  if (error || !code) {
    console.error('[SSO Callback Error]', error, errorDescription);
    return NextResponse.redirect(
      `${baseUrl}/login?error=${encodeURIComponent(errorDescription || error || 'SSO authentication failed')}`
    );
  }

  try {
    const creds = await getTeamsCredentials();
    const redirectUri = `${baseUrl}/api/auth/sso/callback`;
    const tenantId = creds.tenantId || 'common';

    // 1. Exchange code for Graph API token
    const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        scope: 'openid profile email User.Read',
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('[SSO Token Exchange Error]', errText);
      return NextResponse.redirect(
        `${baseUrl}/login?error=${encodeURIComponent('Failed to exchange Microsoft authentication token.')}`
      );
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // 2. Fetch User Profile from Microsoft Graph
    const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!profileRes.ok) {
      const errText = await profileRes.text();
      console.error('[SSO Profile Fetch Error]', errText);
      return NextResponse.redirect(
        `${baseUrl}/login?error=${encodeURIComponent('Failed to retrieve user profile from Microsoft Graph.')}`
      );
    }

    const profile = await profileRes.json();
    const email = (profile.mail || profile.userPrincipalName || '').toLowerCase().trim();
    const name = profile.displayName || profile.givenName || email.split('@')[0] || 'SSO User';

    if (!email) {
      return NextResponse.redirect(
        `${baseUrl}/login?error=${encodeURIComponent('No valid email associated with Microsoft account.')}`
      );
    }

    // 3. Find or Create User in database
    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // First time registration -> default to GUEST as required
      user = await prisma.user.create({
        data: {
          name,
          email,
          role: 'GUEST',
          passwordHash: 'sso_authenticated',
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          userName: name,
          userRole: 'GUEST',
          action: 'SSO_REGISTERED',
          details: `User ${name} (${email}) registered via Microsoft Graph SSO. Assigned default role: GUEST.`,
        },
      });
    } else {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          action: 'SSO_LOGIN',
          details: `User ${user.name} (${email}) logged in via Microsoft Graph SSO. Role: ${user.role}.`,
        },
      });
    }

    // 4. Create Session JWT
    const sessionUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as UserRole,
    };

    const token = signToken(sessionUser);

    const response = NextResponse.redirect(`${baseUrl}/`);
    response.cookies.set('cim_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (err: any) {
    console.error('[SSO Callback Exception]', err);
    return NextResponse.redirect(
      `${baseUrl}/login?error=${encodeURIComponent('Internal server error during SSO authentication.')}`
    );
  }
}

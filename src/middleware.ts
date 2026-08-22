import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Explicitly public endpoints that can be accessed without login
const PUBLIC_PATHS = [
  '/login',
  '/api/auth/sso/login',
  '/api/auth/sso/callback',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/auth/me',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Allow internal Next.js assets, static files, and favicons
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') || // static files (.png, .svg, .css, .js, etc.)
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get('cim_token')?.value;
  const isPublicPath = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  // 2. If user is already authenticated and visits /login, redirect to dashboard /
  if (token && pathname === '/login') {
    const dashboardUrl = new URL('/', request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  // 3. Allow public authentication endpoints
  if (isPublicPath) {
    return NextResponse.next();
  }

  // 4. If no token is present:
  if (!token) {
    // Return 401 for API routes
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: 'Authentication required. Please sign in.' },
        { status: 401 }
      );
    }

    // Redirect all page routes to /login
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 5. Token is present -> Allow access
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except static assets
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

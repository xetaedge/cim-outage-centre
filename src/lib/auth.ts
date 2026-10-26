import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Read lazily so `next build` works without the secret; no fallback, a public default would let anyone forge tokens.
function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET must be set to at least 32 random characters.');
  return secret;
}

export type UserRole = 'ADMIN' | 'INCIDENT_MANAGER' | 'GUEST';

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  timeZone?: string;
}

export function signToken(user: UserSession): string {
  // Strip out JWT internal claims (exp, iat, nbf) if user object was derived from an existing decoded token
  const { id, name, email, role, timeZone } = user as any;
  const cleanPayload: UserSession = {
    id,
    name,
    email,
    role,
    ...(timeZone ? { timeZone } : {}),
  };
  return jwt.sign(cleanPayload, jwtSecret(), { algorithm: 'HS256', expiresIn: '7d' });
}

export function verifyToken(token: string): UserSession | null {
  const secret = jwtSecret();
  try {
    return jwt.verify(token, secret, { algorithms: ['HS256'] }) as UserSession;
  } catch (error) {
    return null;
  }
}

/**
 * Verifies the cim_token cookie and reloads the user from the database,
 * so a deleted user or a changed role takes effect immediately.
 */
export async function getSession(): Promise<UserSession | null> {
  const token = cookies().get('cim_token')?.value;
  const claims = token ? verifyToken(token) : null;
  if (!claims?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: claims.id },
    select: { id: true, name: true, email: true, role: true, timeZone: true },
  });
  if (!user) return null;

  return { ...user, role: user.role as UserRole, timeZone: user.timeZone || 'UTC' };
}

/**
 * Route guard: returns the session, or a 401/403 response to return as-is.
 * Usage: `const auth = await requireSession(['ADMIN']); if (auth instanceof NextResponse) return auth;`
 */
export async function requireSession(roles?: UserRole[]): Promise<UserSession | NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: 'Authentication required. Please sign in.' }, { status: 401 });
  }
  if (roles && !roles.includes(session.role)) {
    return NextResponse.json({ success: false, error: 'You do not have permission to perform this action.' }, { status: 403 });
  }
  return session;
}

// Placeholder the settings API returns instead of stored secrets; clients echo it back for unchanged fields.
export const SECRET_MASK = '••••••••';

/** Drops request fields still holding SECRET_MASK so the stored value is used instead. */
export function stripMasked<T extends Record<string, any>>(body: T): T {
  return Object.fromEntries(Object.entries(body || {}).filter(([, v]) => v !== SECRET_MASK)) as T;
}

export function hasPermission(role: UserRole, action: string): boolean {
  if (role === 'ADMIN') return true;

  if (role === 'INCIDENT_MANAGER') {
    const allowedActions = [
      'VIEW_INCIDENTS',
      'VIEW_TIMELINE',
      'VIEW_MAP',
      'VIEW_TEAMS_BRIDGE',
      'CREATE_INCIDENT',
      'EDIT_INCIDENT',
      'DELETE_INCIDENT',
      'ADD_UPDATE',
      'MODIFY_TEAMS_BRIDGE',
      'GENERATE_AI_SUMMARY',
      'CLOSE_INCIDENT',
      'FETCH_SERVICENOW',
    ];
    return allowedActions.includes(action);
  }

  if (role === 'GUEST') {
    const allowedActions = [
      'VIEW_INCIDENTS',
      'VIEW_TIMELINE',
      'VIEW_MAP',
      'VIEW_SITES',
      'VIEW_AI_SUMMARY',
    ];
    return allowedActions.includes(action);
  }

  return false;
}

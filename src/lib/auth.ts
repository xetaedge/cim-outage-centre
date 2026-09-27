import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'cim-outage-centre-secret-key-2026';

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
  return jwt.sign(cleanPayload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): UserSession | null {
  try {
    return jwt.verify(token, JWT_SECRET) as UserSession;
  } catch (error) {
    return null;
  }
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

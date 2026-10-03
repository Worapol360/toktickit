import { createHash, randomBytes } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from './prisma.js';

export type SafeUser = {
  id: number;
  name: string;
  email: string;
  role: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR';
  mustChangePassword: boolean;
};

type AuthenticatedRequest = Request & { user?: SafeUser; sessionId?: number };

export const SESSION_COOKIE = 'ttik_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export function safeUser(user: { id: number; name: string; email: string; role: string; mustChangePassword: boolean }): SafeUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as SafeUser['role'],
    mustChangePassword: user.mustChangePassword
  };
}

function errorResponse(response: Response, status: number, code: string, message: string, fields?: Record<string, string>) {
  response.status(status).json({ error: { code, message, ...(fields ? { fields } : {}) } });
}

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function sessionToken(request: Request) {
  const header = request.header('Cookie') ?? '';
  const match = header.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return match?.[1];
}

export function csrfGuard(request: Request, response: Response, next: NextFunction) {
  if (['POST', 'PATCH', 'DELETE'].includes(request.method) && request.header('X-Requested-With') !== 'XMLHttpRequest') {
    errorResponse(response, 403, 'CSRF_CHECK_FAILED', 'A CSRF protection header is required.');
    return;
  }
  next();
}

export async function requireAuth(request: AuthenticatedRequest, response: Response, next: NextFunction) {
  try {
    const token = sessionToken(request);
    if (!token) {
      errorResponse(response, 401, 'UNAUTHENTICATED', 'Authentication is required.');
      return;
    }

    const session = await prisma.session.findUnique({ where: { tokenHash: tokenHash(token) }, include: { user: true } });
    if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.user.isActive) {
      errorResponse(response, 401, 'UNAUTHENTICATED', 'Authentication is required.');
      return;
    }

    request.user = safeUser(session.user);
    request.sessionId = session.id;
    next();
  } catch {
    errorResponse(response, 401, 'UNAUTHENTICATED', 'Authentication is required.');
  }
}

export function requirePasswordChangeComplete(request: AuthenticatedRequest, response: Response, next: NextFunction) {
  if (request.user?.mustChangePassword) {
    errorResponse(response, 403, 'PASSWORD_CHANGE_REQUIRED', 'You must change your password before continuing.');
    return;
  }
  next();
}

export function requireRole(...roles: SafeUser['role'][]) {
  return (request: AuthenticatedRequest, response: Response, next: NextFunction) => {
    if (!request.user || !roles.includes(request.user.role)) {
      errorResponse(response, 403, 'FORBIDDEN', 'You do not have permission to perform this action.');
      return;
    }
    next();
  };
}

export function validatePassword(value: unknown) {
  return typeof value === 'string' && value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value);
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { emailNormalized: email.trim().toLowerCase() } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { kind: 'invalid' as const };
  }
  if (!user.isActive) return { kind: 'inactive' as const };

  const rawToken = randomBytes(32).toString('hex');
  const session = await prisma.session.create({
    data: { userId: user.id, tokenHash: tokenHash(rawToken), expiresAt: new Date(Date.now() + SESSION_TTL_MS) }
  });
  return { kind: 'success' as const, rawToken, user: safeUser(user), sessionId: session.id };
}

export function setSessionCookie(response: Response, token: string) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  response.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax${secure}; Path=/; Max-Age=28800`);
}

export function clearSessionCookie(response: Response) {
  response.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export { errorResponse, tokenHash, type AuthenticatedRequest };

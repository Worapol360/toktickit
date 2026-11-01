import type { PrismaClient } from '@prisma/client';
import type { Response } from 'supertest';
import { SESSION_COOKIE, tokenHash } from '../../src/auth.js';

type FixturePrisma = Pick<PrismaClient, 'user' | 'session'>;

const userFields = {
  id: true,
  name: true,
  email: true,
  emailNormalized: true,
  passwordHash: true,
  role: true,
  department: true,
  isActive: true,
  mustChangePassword: true,
  createdAt: true,
  updatedAt: true
} as const;

export type FixtureSessionTracker = Set<number>;

export async function trackLoginSession(
  prisma: FixturePrisma,
  response: Response,
  tracker: FixtureSessionTracker
) {
  const cookies = response.headers['set-cookie'];
  const cookie = Array.isArray(cookies) ? cookies.find((value) => value.startsWith(`${SESSION_COOKIE}=`)) : cookies;
  const token = cookie?.match(new RegExp(`^${SESSION_COOKIE}=([^;]+)`))?.[1];
  if (!token) throw new Error('Login response did not contain a session cookie');
  const session = await prisma.session.findUnique({ where: { tokenHash: tokenHash(token) }, select: { id: true } });
  if (!session) throw new Error('Login session was not found after login');
  tracker.add(session.id);
}

export async function snapshotUsers(prisma: FixturePrisma, emails: string[]) {
  return prisma.user.findMany({
    where: { emailNormalized: { in: emails.map((email) => email.toLowerCase()) } },
    select: { ...userFields, sessions: true }
  });
}

export async function restoreUsers(
  prisma: FixturePrisma,
  emails: string[],
  snapshots: Awaited<ReturnType<typeof snapshotUsers>>,
  sessionIds: FixtureSessionTracker
) {
  const normalizedEmails = emails.map((email) => email.toLowerCase());
  const currentUsers = await prisma.user.findMany({
    where: { emailNormalized: { in: normalizedEmails } },
    select: userFields
  });
  const originalByEmail = new Map(snapshots.map((user) => [user.emailNormalized, user]));
  const currentByEmail = new Map(currentUsers.map((user) => [user.emailNormalized, user]));

  await prisma.session.deleteMany({ where: { id: { in: [...sessionIds] } } });

  for (const email of normalizedEmails) {
    const original = originalByEmail.get(email);
    const current = currentByEmail.get(email);
    if (!original) {
      if (current) await prisma.user.delete({ where: { id: current.id } });
      continue;
    }

    if (!current) {
      await prisma.user.create({
        data: {
          id: original.id,
          name: original.name,
          email: original.email,
          emailNormalized: original.emailNormalized,
          passwordHash: original.passwordHash,
          role: original.role,
          department: original.department,
          isActive: original.isActive,
          mustChangePassword: original.mustChangePassword,
          createdAt: original.createdAt,
          updatedAt: original.updatedAt
        }
      });
    } else {
      await prisma.user.update({
        where: { id: current.id },
        data: {
          name: original.name,
          email: original.email,
          emailNormalized: original.emailNormalized,
          passwordHash: original.passwordHash,
          role: original.role,
          department: original.department,
          isActive: original.isActive,
          mustChangePassword: original.mustChangePassword,
          createdAt: original.createdAt,
          updatedAt: original.updatedAt
        }
      });
    }

    if (original.sessions.length > 0) {
      const existingSessions = await prisma.session.findMany({
        where: { id: { in: original.sessions.map((session) => session.id) } },
        select: { id: true }
      });
      const existingIds = new Set(existingSessions.map((session) => session.id));
      await prisma.session.createMany({
        data: original.sessions.filter((session) => !existingIds.has(session.id)).map((session) => ({
          id: session.id,
          userId: original.id,
          tokenHash: session.tokenHash,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
          revokedAt: session.revokedAt
        }))
      });
    }
  }
}

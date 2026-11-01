/**
 * HEALTH-01 … HEALTH-03 (Lab 4, Issue 5).
 * api-spec.md §6, specification.md AC-27, FR-20.
 *
 * HEALTH-02 simulates the database failure with a spy on prisma.$queryRaw;
 * the real database is never stopped.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../src/server.js';
import prisma from '../../src/prisma.js';
import { restoreUsers, snapshotUsers, trackLoginSession, type FixtureSessionTracker } from './fixture-cleanup.js';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const localPasswordHash = '$2b$12$MvQuSTNtpiuJmfaKc7j0Nu0FipBQuY31F6ojkIMWw2OMTZoK5lUkq';
const csrf = 'X-Requested-With';
const FIXTURE_EMAILS = ['a5health_staff@example.com'];

describe('Health endpoint (HEALTH-01 … HEALTH-03)', () => {
  let gatedAgent: request.SuperAgentTest;
  let userSnapshots: Awaited<ReturnType<typeof snapshotUsers>>;
  const sessionIds: FixtureSessionTracker = new Set();

  // bcrypt is CPU-only: create + log the gated user in once, before the tests,
  // to keep this file's CPU footprint minimal for Lab 1–3 files in parallel.
  beforeAll(async () => {
    userSnapshots = await snapshotUsers(prisma, FIXTURE_EMAILS);
    await prisma.user.upsert({
      where: { emailNormalized: 'a5health_staff@example.com' },
      update: { role: 'IT_STAFF', isActive: true, mustChangePassword: false, passwordHash: localPasswordHash },
      create: {
        name: 'A5 Health Staff',
        email: 'a5health_staff@example.com',
        emailNormalized: 'a5health_staff@example.com',
        department: 'IT',
        role: 'IT_STAFF',
        passwordHash: localPasswordHash,
        mustChangePassword: false,
        isActive: true
      }
    });

    const agent = request.agent(app);
    const login = await agent
      .post('/api/auth/login')
      .set(csrf, 'XMLHttpRequest')
      .send({ email: 'a5health_staff@example.com', password: 'LocalOnly1!' });
    expect(login.status).toBe(200);
    await trackLoginSession(prisma, login, sessionIds);
    gatedAgent = agent;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await restoreUsers(prisma, FIXTURE_EMAILS, userSnapshots, sessionIds);
  });

  it('HEALTH-01: GET /api/health with the database up returns 200 ok/up with a UTC time', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      database: 'up',
      time: expect.any(String)
    });
    expect(new Date(response.body.time).toISOString()).toBe(response.body.time);
  });

  it('HEALTH-02: when the database check fails the endpoint returns 503 degraded/down', async () => {
    vi.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('simulated pool exhaustion'));

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      status: 'degraded',
      database: 'down'
    });
  });

  it('HEALTH-03: a forced internal error on a dashboard endpoint returns the safe 500 envelope with no internals', async () => {
    await prisma.user.upsert({
      where: { emailNormalized: 'a5health_staff@example.com' },
      update: { role: 'IT_STAFF', isActive: true, mustChangePassword: false, passwordHash: localPasswordHash },
      create: {
        name: 'A5 Health Staff',
        email: 'a5health_staff@example.com',
        emailNormalized: 'a5health_staff@example.com',
        department: 'IT',
        role: 'IT_STAFF',
        passwordHash: localPasswordHash,
        mustChangePassword: false,
        isActive: true
      }
    });

    const agent = request.agent(app);
    const login = await agent
      .post('/api/auth/login')
      .set(csrf, 'XMLHttpRequest')
      .send({ email: 'a5health_staff@example.com', password: 'LocalOnly1!' });
    expect(login.status).toBe(200);
    await trackLoginSession(prisma, login, sessionIds);

    vi.spyOn(prisma.ticket, 'count').mockRejectedValueOnce(new Error('SELECT * FROM "Ticket" -- forced failure at /app/src/server.ts:999'));

    const response = await agent.get('/api/dashboard/staff');

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
    expect(response.body.error.message).toBe('Unable to load the staff dashboard.');
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('stack');
    expect(serialized).not.toContain('SELECT');
    expect(serialized).not.toContain('Ticket');
    expect(serialized).not.toContain('/app/');
    expect(serialized).not.toContain('forced failure');
  });
});

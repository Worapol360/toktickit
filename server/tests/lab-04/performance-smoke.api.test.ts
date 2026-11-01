/**
 * PERF-01 / PERF-02 (Lab 4, Issue 5) — performance smoke.
 * tests.md §2.5, specification.md D-20, AC-27.
 *
 * PERF-01 warms each dashboard endpoint once, then asserts the measured call
 * responds in < 500 ms. PERF-02 inserts 200 Actions Taken on one fixture
 * Ticket (scoped cleanup, D-20) and asserts the list endpoint responds in
 * < 500 ms. These are smoke bounds, not benchmarks.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { app } from '../../src/server.js';
import prisma from '../../src/prisma.js';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const localPasswordHash = '$2b$12$MvQuSTNtpiuJmfaKc7j0Nu0FipBQuY31F6ojkIMWw2OMTZoK5lUkq';
const SUMMARY_PREFIX = '[A5-PERF]';
const csrf = 'X-Requested-With';
const BUDGET_MS = 500;
const ACTION_COUNT = 200;

async function loginAs(email: string): Promise<request.SuperAgentTest> {
  const agent = request.agent(app);
  const response = await agent
    .post('/api/auth/login')
    .set(csrf, 'XMLHttpRequest')
    .send({ email, password: 'LocalOnly1!' });
  if (response.status !== 200) {
    throw new Error(`Login as ${email} failed with ${response.status}: ${JSON.stringify(response.body)}`);
  }
  return agent;
}

async function measured<T>(call: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const startedAt = performance.now();
  const result = await call();
  return { result, ms: performance.now() - startedAt };
}

describe('Performance smoke (PERF-01, PERF-02)', () => {
  let requesterAgent: request.SuperAgentTest;
  let staffAgent: request.SuperAgentTest;
  let staffId: number;

  async function cleanupFixtures() {
    await prisma.actionTaken.deleteMany({
      where: { ticket: { summary: { startsWith: SUMMARY_PREFIX } } }
    });
    await prisma.ticket.deleteMany({ where: { summary: { startsWith: SUMMARY_PREFIX } } });
  }

  async function upsertUser(email: string, name: string, role: 'REQUESTER' | 'IT_STAFF') {
    const normalized = email.toLowerCase();
    return prisma.user.upsert({
      where: { emailNormalized: normalized },
      update: { name, role, isActive: true, mustChangePassword: false, passwordHash: localPasswordHash },
      create: {
        name,
        email,
        emailNormalized: normalized,
        department: 'IT',
        role,
        passwordHash: localPasswordHash,
        mustChangePassword: false,
        isActive: true
      }
    });
  }

  async function ensureUsers() {
    const requester = await upsertUser('a5perf_req@example.com', 'A5 Perf Requester', 'REQUESTER');
    const staff = await upsertUser('a5perf_staff@example.com', 'A5 Perf Staff', 'IT_STAFF');
    staffId = staff.id;
    return { requester, staff };
  }

  // Log in once per file (bcrypt is CPU-only; per-test logins would add load
  // to Lab 1–3 files running in parallel).
  beforeAll(async () => {
    const { requester, staff } = await ensureUsers();
    await cleanupFixtures();
    requesterAgent = await loginAs(requester.email);
    staffAgent = await loginAs(staff.email);
  });

  beforeEach(async () => {
    const cat = await prisma.category.findFirst({ where: { isActive: true } });
    const sys = await prisma.relatedSystem.findFirst({ where: { isActive: true } });
    if (!cat || !sys) throw new Error('Test database is missing required seed categories/systems');

    const { requester } = await ensureUsers();

    await cleanupFixtures();

    await prisma.ticket.create({
      data: {
        ticketNumber: `TICK-A5PERF-${randomUUID().slice(0, 12)}`,
        summary: `${SUMMARY_PREFIX} Warm-up ticket`,
        description: 'Perf-smoke fixture ticket.',
        requestedPriority: 'Medium',
        itPriority: 'Medium',
        status: 'Open',
        requesterId: requester.id,
        categoryId: cat.id,
        relatedSystemId: sys.id
      }
    });
  });

  afterEach(async () => {
    await cleanupFixtures();
  });

  it('PERF-01: both dashboard endpoints respond in under 500 ms after one warm-up call', async () => {
    await requesterAgent.get('/api/dashboard/requester');
    await staffAgent.get('/api/dashboard/staff');

    const requester = await measured(() => requesterAgent.get('/api/dashboard/requester'));
    expect(requester.result.status).toBe(200);
    expect(requester.ms).toBeLessThan(BUDGET_MS);

    const staff = await measured(() => staffAgent.get('/api/dashboard/staff'));
    expect(staff.result.status).toBe(200);
    expect(staff.ms).toBeLessThan(BUDGET_MS);
  });

  it('PERF-02: GET /api/tickets/:id/actions-taken with 200 Actions responds in under 500 ms', async () => {
    const ticket = await prisma.ticket.findFirst({ where: { summary: { startsWith: SUMMARY_PREFIX } } });
    if (!ticket) throw new Error('Perf fixture ticket was not created');

    const now = Date.now();
    await prisma.actionTaken.createMany({
      data: Array.from({ length: ACTION_COUNT }, (_, index) => ({
        ticketId: ticket.id,
        actionAt: new Date(now - (ACTION_COUNT - index) * 60_000),
        description: `Performance fixture action ${index + 1}: inspected the endpoint under load.`,
        result: 'Verified consistent behaviour across all seeded records.',
        performedById: staffId,
        updatedById: staffId
      }))
    });

    const counted = await prisma.actionTaken.count({ where: { ticketId: ticket.id } });
    expect(counted).toBe(ACTION_COUNT);

    const { result, ms } = await measured(() => staffAgent.get(`/api/tickets/${ticket.id}/actions-taken`));
    expect(result.status).toBe(200);
    expect(result.body.actionsTaken).toHaveLength(ACTION_COUNT);
    expect(ms).toBeLessThan(BUDGET_MS);
  });
});

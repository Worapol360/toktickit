/**
 * RD-01 โ€ฆ RD-06: Requester dashboard (Lab 4, Issue 5).
 * api-spec.md ยง5.1, ยง2.3, ยง2.4; specification.md AC-02, AC-16, AC-18,
 * BR-25 โ€ฆ BR-30, D-08.
 *
 * Fixtures use the [A5-RD] prefix, belong to users created by this file, and
 * are removed with summary-scoped deletes only (never unscoped).
 * RD-01 compares every metric to an independent direct Prisma query on the
 * same fixtures; RD-05 follows each drilldown against GET /api/tickets.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { app } from '../../src/server.js';
import prisma from '../../src/prisma.js';
import { restoreUsers, snapshotUsers, trackLoginSession, type FixtureSessionTracker } from './fixture-cleanup.js';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

// Fixture users store the password at bcrypt cost 10 instead of the seed's
// cost 12: compares are ~4ร— cheaper and this file logs several agents in
// while Lab 1โ€“3 files run in parallel โ€” the real bcrypt path is still
// exercised, only the fixture rounds are lighter.
const fixturePasswordHash = '$2b$10$oSo2VThL8AWCYiI6/fHGWeABOwsT5Hc4K6gOJ4XuxFK0v1EfQY7Sy';
const SUMMARY_PREFIX = '[A5-RD]';
const csrf = 'X-Requested-With';
const ACTIVE_STATUSES = ['New', 'Open', 'In Progress', 'Waiting for Requester', 'Reopened'];
const FIXTURE_EMAILS = [
  'a5rd_req1@example.com',
  'a5rd_req2@example.com',
  'a5rd_req_empty@example.com',
  'a5rd_staff@example.com',
  'a5rd_admin@example.com'
];

async function loginAs(email: string, sessionIds: FixtureSessionTracker): Promise<request.SuperAgentTest> {
  const agent = request.agent(app);
  const response = await agent
    .post('/api/auth/login')
    .set(csrf, 'XMLHttpRequest')
    .send({ email, password: 'LocalOnly1!' });
  if (response.status !== 200) {
    throw new Error(`Login as ${email} failed with ${response.status}: ${JSON.stringify(response.body)}`);
  }
  await trackLoginSession(prisma, response, sessionIds);
  return agent;
}

describe('Requester dashboard API (RD-01 โ€ฆ RD-06)', () => {
  let catId: number;
  let sysId: number;
  let requester: { id: number; email: string };
  let otherRequester: { id: number; email: string };
  let emptyRequester: { id: number; email: string };
  let staffUser: { id: number; email: string };
  let adminUser: { id: number; email: string };
  let requesterAgent: request.SuperAgentTest;
  let emptyAgent: request.SuperAgentTest;
  let staffAgent: request.SuperAgentTest;
  let adminAgent: request.SuperAgentTest;
  let fixtureSeq = 0;
  let userSnapshots: Awaited<ReturnType<typeof snapshotUsers>>;
  const sessionIds: FixtureSessionTracker = new Set();

  async function cleanupFixtures() {
    await prisma.ticket.deleteMany({ where: { summary: { startsWith: SUMMARY_PREFIX } } });
  }

  async function upsertUser(email: string, name: string, role: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR') {
    const normalized = email.toLowerCase();
    return prisma.user.upsert({
      where: { emailNormalized: normalized },
      update: { name, role, isActive: true, mustChangePassword: false, passwordHash: fixturePasswordHash },
      create: {
        name,
        email,
        emailNormalized: normalized,
        department: 'Support',
        role,
        passwordHash: fixturePasswordHash,
        mustChangePassword: false,
        isActive: true
      }
    });
  }

  async function createTicket(
    ownerId: number,
    label: string,
    options: { status?: string; itPriority?: string | null; ownerId?: number | null; resolvedAt?: Date | null; updatedAt?: Date } = {}
  ) {
    fixtureSeq += 1;
    return prisma.ticket.create({
      data: {
        ticketNumber: `TICK-A5RD-${randomUUID().slice(0, 12)}`,
        summary: `${SUMMARY_PREFIX}${label} ${fixtureSeq}`,
        description: 'Requester dashboard fixture ticket for the Lab 4 Issue 5 tests.',
        requestedPriority: 'Medium',
        itPriority: options.itPriority === undefined ? 'Medium' : options.itPriority,
        status: options.status ?? 'Open',
        requesterId: ownerId,
        ownerId: options.ownerId === undefined ? null : options.ownerId,
        categoryId: catId,
        relatedSystemId: sysId,
        ...(options.resolvedAt !== undefined ? { resolvedAt: options.resolvedAt } : {}),
        ...(options.updatedAt ? { updatedAt: options.updatedAt } : {})
      }
    });
  }

  async function ensureUsers() {
    const u1 = await upsertUser('a5rd_req1@example.com', 'A5 RD Requester', 'REQUESTER');
    const u2 = await upsertUser('a5rd_req2@example.com', 'A5 RD Other Requester', 'REQUESTER');
    const u3 = await upsertUser('a5rd_req_empty@example.com', 'A5 RD Empty Requester', 'REQUESTER');
    const uStaff = await upsertUser('a5rd_staff@example.com', 'A5 RD Staff', 'IT_STAFF');
    const uAdmin = await upsertUser('a5rd_admin@example.com', 'A5 RD Admin', 'ADMINISTRATOR');

    requester = { id: u1.id, email: u1.email };
    otherRequester = { id: u2.id, email: u2.email };
    emptyRequester = { id: u3.id, email: u3.email };
    staffUser = { id: uStaff.id, email: uStaff.email };
    adminUser = { id: uAdmin.id, email: uAdmin.email };
  }

  // bcrypt compares are CPU-only and this suite runs in parallel with Lab 1โ€“3
  // files: log every agent in once here instead of before each test.
  beforeAll(async () => {
    userSnapshots = await snapshotUsers(prisma, FIXTURE_EMAILS);
    await ensureUsers();
    await cleanupFixtures();
    requesterAgent = await loginAs(requester.email, sessionIds);
    emptyAgent = await loginAs(emptyRequester.email, sessionIds);
    staffAgent = await loginAs(staffUser.email, sessionIds);
    adminAgent = await loginAs(adminUser.email, sessionIds);
  });

  beforeEach(async () => {
    const cat = await prisma.category.findFirst({ where: { isActive: true } });
    const sys = await prisma.relatedSystem.findFirst({ where: { isActive: true } });
    if (!cat || !sys) throw new Error('Test database is missing required seed categories/systems');
    catId = cat.id;
    sysId = sys.id;

    await ensureUsers();
    await cleanupFixtures();
  });

  afterEach(async () => {
    await cleanupFixtures();
  });

  afterAll(async () => {
    await cleanupFixtures();
    await restoreUsers(prisma, FIXTURE_EMAILS, userSnapshots, sessionIds);
  });

  it('RD-01: every metric equals an independent direct Prisma query on the same fixtures', async () => {
    await createTicket(requester.id, 'active open', { status: 'Open' });
    await createTicket(requester.id, 'active in progress', { status: 'In Progress' });
    await createTicket(requester.id, 'waiting for requester', { status: 'Waiting for Requester' });
    await createTicket(requester.id, 'resolved recent', { status: 'Resolved', resolvedAt: new Date() });
    await createTicket(requester.id, 'cancelled', { status: 'Cancelled', resolvedAt: null });
    // Another requester's tickets must never influence the metrics.
    await createTicket(otherRequester.id, 'other open', { status: 'Open' });
    await createTicket(otherRequester.id, 'other waiting', { status: 'Waiting for Requester' });

    const response = await requesterAgent.get('/api/dashboard/requester');
    expect(response.status).toBe(200);
    const body = response.body;

    const expectedOpen = await prisma.ticket.count({
      where: { requesterId: requester.id, status: { in: ACTIVE_STATUSES } }
    });
    const expectedWaiting = await prisma.ticket.count({
      where: { requesterId: requester.id, status: 'Waiting for Requester' }
    });
    const expectedResolved = await prisma.ticket.count({
      where: { requesterId: requester.id, status: 'Resolved' }
    });

    expect(body.metrics.openTickets.value).toBe(expectedOpen);
    expect(body.metrics.openTickets.value).toBe(3);
    expect(body.metrics.waitingForRequester.value).toBe(expectedWaiting);
    expect(body.metrics.waitingForRequester.value).toBe(1);
    expect(body.metrics.resolved.value).toBe(expectedResolved);
    expect(body.metrics.resolved.value).toBe(1);
    expect(body.windowDays).toBe(7);
    expect(new Date(body.generatedAt).toISOString()).toBe(body.generatedAt);

    const expectedNeedsAttention = await prisma.ticket.findMany({
      where: { requesterId: requester.id, status: 'Waiting for Requester' },
      select: { id: true },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }]
    });
    expect(body.needsAttention.map((ticket: { id: number }) => ticket.id)).toEqual(
      expectedNeedsAttention.map((ticket) => ticket.id)
    );
    expect(body.needsAttention).toHaveLength(1);

    const expectedRecentlyUpdated = await prisma.ticket.findMany({
      where: { requesterId: requester.id },
      select: { id: true },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 5
    });
    expect(body.recentlyUpdated.map((ticket: { id: number }) => ticket.id)).toEqual(
      expectedRecentlyUpdated.map((ticket) => ticket.id)
    );

    const expectedRecentlyResolved = await prisma.ticket.findMany({
      where: { requesterId: requester.id, status: 'Resolved', resolvedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      select: { id: true },
      orderBy: [{ resolvedAt: 'desc' }, { id: 'desc' }]
    });
    expect(body.recentlyResolved.map((ticket: { id: number }) => ticket.id)).toEqual(
      expectedRecentlyResolved.map((ticket) => ticket.id)
    );
  });

  it('RD-02: no other Requester data appears anywhere, and users is never present', async () => {
    const otherTicket = await createTicket(otherRequester.id, 'other owned', { status: 'Open' });
    await createTicket(otherRequester.id, 'other waiting', { status: 'Waiting for Requester' });
    await createTicket(otherRequester.id, 'other resolved', { status: 'Resolved', resolvedAt: new Date() });
    const myTicket = await createTicket(requester.id, 'mine', { status: 'Open' });

    const response = await requesterAgent.get('/api/dashboard/requester');
    expect(response.status).toBe(200);
    const body = response.body;

    expect(body.metrics.openTickets.value).toBe(1);
    expect(body.metrics.waitingForRequester.value).toBe(0);
    expect(body.metrics.resolved.value).toBe(0);

    const allListedIds = [
      ...body.needsAttention.map((ticket: { id: number }) => ticket.id),
      ...body.recentlyUpdated.map((ticket: { id: number }) => ticket.id),
      ...body.recentlyResolved.map((ticket: { id: number }) => ticket.id)
    ];
    expect(allListedIds).not.toContain(otherTicket.id);
    expect(allListedIds).toContain(myTicket.id);

    expect(body).not.toHaveProperty('users');
  });

  it('RD-03: a Requester with no Tickets sees zeros and empty lists (never null)', async () => {
    const response = await emptyAgent.get('/api/dashboard/requester');

    expect(response.status).toBe(200);
    const body = response.body;
    expect(body.metrics.openTickets.value).toBe(0);
    expect(body.metrics.waitingForRequester.value).toBe(0);
    expect(body.metrics.resolved.value).toBe(0);
    expect(body.needsAttention).toEqual([]);
    expect(body.recentlyUpdated).toEqual([]);
    expect(body.recentlyResolved).toEqual([]);
    expect(body).not.toHaveProperty('users');
  });

  it('RD-04: staff, administrator and anonymous callers are rejected (403 / 403 / 401)', async () => {
    const anonymous = await request(app).get('/api/dashboard/requester');
    const asStaff = await staffAgent.get('/api/dashboard/requester');
    const asAdmin = await adminAgent.get('/api/dashboard/requester');

    expect(anonymous.status).toBe(401);
    expect(anonymous.body.error.code).toBe('UNAUTHENTICATED');
    expect(asStaff.status).toBe(403);
    expect(asStaff.body.error.code).toBe('FORBIDDEN');
    expect(asAdmin.status).toBe(403);
    expect(asAdmin.body.error.code).toBe('FORBIDDEN');
  });

  it('RD-05: following each drilldown against GET /api/tickets returns totalItems equal to the card value', async () => {
    await createTicket(requester.id, 'drill active new', { status: 'New' });
    await createTicket(requester.id, 'drill active open', { status: 'Open' });
    await createTicket(requester.id, 'drill active in progress', { status: 'In Progress' });
    await createTicket(requester.id, 'drill waiting', { status: 'Waiting for Requester' });
    await createTicket(requester.id, 'drill resolved', { status: 'Resolved', resolvedAt: new Date() });
    await createTicket(requester.id, 'drill closed', { status: 'Closed', resolvedAt: new Date() });

    const response = await requesterAgent.get('/api/dashboard/requester');
    expect(response.status).toBe(200);
    const body = response.body;

    const drilldowns: Array<{ path: string; query: Record<string, string> }> = [
      body.metrics.openTickets.drilldown,
      body.metrics.waitingForRequester.drilldown,
      body.metrics.resolved.drilldown
    ];
    const cardValues = [
      body.metrics.openTickets.value,
      body.metrics.waitingForRequester.value,
      body.metrics.resolved.value
    ];

    for (const [index, drilldown] of drilldowns.entries()) {
      expect(drilldown).not.toBeNull();
      expect(drilldown.path).toBe('/');
      const query = new URLSearchParams(drilldown.query).toString();
      const list = await requesterAgent.get(`/api/tickets?${query}`);
      expect(list.status).toBe(200);
      expect(list.body.pagination.totalItems).toBe(cardValues[index]);
    }
  });

  it('RD-06: list ordering is newest first, lists are capped at 5, and the 7-day recentlyResolved boundary is applied', async () => {
    const base = Date.now();
    // Seven tickets so the cap of 5 is exercised on needsAttention and recentlyUpdated.
    for (let index = 0; index < 7; index += 1) {
      await createTicket(requester.id, `waiting ${index}`, {
        status: 'Waiting for Requester',
        updatedAt: new Date(base - index * 1000)
      });
    }
    // recentlyResolved boundary: inside, on-edge-ish, and outside the window.
    const inside = await createTicket(requester.id, 'resolved inside window', {
      status: 'Resolved',
      resolvedAt: new Date(base - (7 * 24 * 60 * 60 * 1000) + 60_000)
    });
    const outside = await createTicket(requester.id, 'resolved outside window', {
      status: 'Resolved',
      resolvedAt: new Date(base - (7 * 24 * 60 * 60 * 1000) - 60_000)
    });
    const fresh = await createTicket(requester.id, 'resolved fresh', {
      status: 'Resolved',
      resolvedAt: new Date(base)
    });

    const response = await requesterAgent.get('/api/dashboard/requester');
    expect(response.status).toBe(200);
    const body = response.body;

    expect(body.needsAttention).toHaveLength(5);
    const attentionIds = body.needsAttention.map((ticket: { id: number }) => ticket.id);
    const attentionTimes = body.needsAttention.map((ticket: { updatedAt: string }) => new Date(ticket.updatedAt).getTime());
    for (let index = 1; index < attentionTimes.length; index += 1) {
      expect(attentionTimes[index - 1]).toBeGreaterThanOrEqual(attentionTimes[index]);
    }
    expect(new Set(attentionIds).size).toBe(5);

    expect(body.recentlyUpdated).toHaveLength(5);

    const resolvedIds = body.recentlyResolved.map((ticket: { id: number }) => ticket.id);
    expect(resolvedIds).toContain(fresh.id);
    expect(resolvedIds).toContain(inside.id);
    expect(resolvedIds).not.toContain(outside.id);
    expect(body.recentlyResolved.length).toBeLessThanOrEqual(5);

    // Shape: recentlyResolved items carry resolvedAt; the other lists do not.
    for (const item of body.recentlyResolved) {
      expect(item).toHaveProperty('resolvedAt');
      expect(typeof item.resolvedAt).toBe('string');
    }
    for (const item of body.needsAttention) {
      expect(item).not.toHaveProperty('resolvedAt');
      expect(Object.keys(item).sort()).toEqual(['id', 'status', 'summary', 'ticketNumber', 'updatedAt']);
    }
  });
});

/**
 * SD-01 … SD-07: Staff dashboard (Lab 4, Issue 5).
 * api-spec.md §5.2, §2.3, §2.4; specification.md AC-17, AC-18, BR-25 … BR-31,
 * D-10, D-18.
 *
 * Fixtures use the [A5-SD] prefix and users created by this file; cleanup is
 * summary-scoped only. Server test files run in parallel, so unassigned /
 * byStatus / byPriority / users are global metrics that other files may write
 * to concurrently: each such assertion snapshots the database immediately
 * before and after the dashboard call and requires the dashboard value to
 * equal one of the two snapshots (with a bounded retry), which is the
 * strongest exact DB agreement achievable under concurrent writers.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { app } from '../../src/server.js';
import prisma from '../../src/prisma.js';
import { priorityBucket } from '../../src/lab-04/dashboard-helpers.js';
import { restoreUsers, snapshotUsers, trackLoginSession, type FixtureSessionTracker } from './fixture-cleanup.js';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const localPasswordHash = '$2b$12$MvQuSTNtpiuJmfaKc7j0Nu0FipBQuY31F6ojkIMWw2OMTZoK5lUkq';
const SUMMARY_PREFIX = '[A5-SD]';
const csrf = 'X-Requested-With';
const ACTIVE_STATUSES = ['New', 'Open', 'In Progress', 'Waiting for Requester', 'Reopened'];
const STATUS_ORDER = [
  'New',
  'Open',
  'In Progress',
  'Waiting for Requester',
  'Resolved',
  'Closed',
  'Reopened',
  'Cancelled'
];
const CONSISTENCY_ATTEMPTS = 5;
const FIXTURE_EMAILS = [
  'a5sd_staff@example.com',
  'a5sd_staff2@example.com',
  'a5sd_admin@example.com',
  'a5sd_req@example.com',
  'a5sd_zero@example.com'
];

/**
 * Reads a global metric together with DB counts taken immediately before and
 * after the dashboard call, retrying until the dashboard value agrees with
 * one of the two snapshots (a single concurrent write lands on exactly one
 * side of the call), so exact DB agreement holds despite parallel test files.
 */
async function untilConsistent<S>(
  read: () => Promise<S>,
  isConsistent: (snapshot: S) => boolean,
  attempts: number = CONSISTENCY_ATTEMPTS
): Promise<S> {
  let latest = await read();
  for (let attempt = 0; attempt < attempts - 1 && !isConsistent(latest); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    latest = await read();
  }
  return latest;
}

const notOwnTickets = { NOT: { summary: { startsWith: SUMMARY_PREFIX } } };

async function nonOwnUnassignedActive(): Promise<number> {
  return prisma.ticket.count({
    where: { ...notOwnTickets, ownerId: null, status: { in: ACTIVE_STATUSES } }
  });
}

type GlobalSnapshots = {
  statuses: Map<string, number>;
  priorities: Map<string, number>;
  activeTotal: number;
};

function toPriorityMap(groups: Array<{ itPriority: string | null; _count: { _all: number } }>): Map<string, number> {
  const map = new Map<string, number>();
  for (const group of groups) {
    const bucket = priorityBucket(group.itPriority);
    map.set(bucket, (map.get(bucket) ?? 0) + group._count._all);
  }
  return map;
}

async function nonOwnTicketSnapshots(): Promise<GlobalSnapshots> {
  const [statuses, priorities, activeTotal] = await Promise.all([
    prisma.ticket.groupBy({
      by: ['status'],
      where: notOwnTickets,
      _count: { _all: true }
    }),
    prisma.ticket.groupBy({
      by: ['itPriority'],
      where: { ...notOwnTickets, status: { in: ACTIVE_STATUSES } },
      _count: { _all: true }
    }),
    prisma.ticket.count({ where: { ...notOwnTickets, status: { in: ACTIVE_STATUSES } } })
  ]);
  return {
    statuses: new Map(statuses.map((group) => [group.status, group._count._all])),
    priorities: toPriorityMap(priorities),
    activeTotal
  };
}

type UserCounts = {
  activeRequesters: number;
  activeItStaff: number;
  activeAdministrators: number;
  inactive: number;
};

async function readUserCounts(): Promise<UserCounts> {
  const [activeRequesters, activeItStaff, activeAdministrators, inactive] = await Promise.all([
    prisma.user.count({ where: { role: 'REQUESTER', isActive: true } }),
    prisma.user.count({ where: { role: 'IT_STAFF', isActive: true } }),
    prisma.user.count({ where: { role: 'ADMINISTRATOR', isActive: true } }),
    prisma.user.count({ where: { isActive: false } })
  ]);
  return { activeRequesters, activeItStaff, activeAdministrators, inactive };
}

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

describe('Staff dashboard API (SD-01 … SD-07)', () => {
  let catId: number;
  let sysId: number;
  let staff: { id: number; email: string };
  let staff2: { id: number; email: string };
  let admin: { id: number; email: string };
  let requester: { id: number; email: string };
  let staffAgent: request.SuperAgentTest;
  let staff2Agent: request.SuperAgentTest;
  let adminAgent: request.SuperAgentTest;
  let requesterAgent: request.SuperAgentTest;
  let zeroAgent: request.SuperAgentTest;
  let fixtureSeq = 0;
  let userSnapshots: Awaited<ReturnType<typeof snapshotUsers>>;
  const sessionIds: FixtureSessionTracker = new Set();

  async function cleanupFixtures() {
    await prisma.actionTaken.deleteMany({
      where: { ticket: { summary: { startsWith: SUMMARY_PREFIX } } }
    });
    await prisma.ticket.deleteMany({ where: { summary: { startsWith: SUMMARY_PREFIX } } });
  }

  async function upsertUser(email: string, name: string, role: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR') {
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

  async function createTicket(
    label: string,
    options: {
      status?: string;
      itPriority?: string | null;
      ownerId?: number | null;
      requesterId?: number;
      updatedAt?: Date;
    } = {}
  ) {
    fixtureSeq += 1;
    return prisma.ticket.create({
      data: {
        ticketNumber: `TICK-A5SD-${randomUUID().slice(0, 12)}`,
        summary: `${SUMMARY_PREFIX}${label} ${fixtureSeq}`,
        description: 'Staff dashboard fixture ticket for the Lab 4 Issue 5 tests.',
        requestedPriority: 'Medium',
        itPriority: options.itPriority === undefined ? 'Medium' : options.itPriority,
        status: options.status ?? 'Open',
        requesterId: options.requesterId ?? requester.id,
        ownerId: options.ownerId === undefined ? null : options.ownerId,
        categoryId: catId,
        relatedSystemId: sysId,
        ...(options.updatedAt ? { updatedAt: options.updatedAt } : {})
      }
    });
  }

  async function createAction(
    ticketId: number,
    performedById: number,
    options: { openFollowUp?: boolean; completedFollowUp?: boolean; description?: string } = {}
  ) {
    const needsFollowUp = Boolean(options.openFollowUp || options.completedFollowUp);
    return prisma.actionTaken.create({
      data: {
        ticketId,
        actionAt: new Date(),
        description: options.description ?? 'Reviewed the configuration on the affected workstation.',
        result: 'Configuration corrected and verified with the requester.',
        performedById,
        updatedById: performedById,
        followUpRequired: needsFollowUp,
        followUpNote: needsFollowUp ? 'Confirm the outcome with the requester afterwards.' : null,
        followUpCompletedAt: options.completedFollowUp ? new Date() : null
      }
    });
  }

  async function ensureUsers() {
    const uStaff = await upsertUser('a5sd_staff@example.com', 'A5 SD Staff', 'IT_STAFF');
    const uStaff2 = await upsertUser('a5sd_staff2@example.com', 'A5 SD Staff Two', 'IT_STAFF');
    const uAdmin = await upsertUser('a5sd_admin@example.com', 'A5 SD Admin', 'ADMINISTRATOR');
    const uReq = await upsertUser('a5sd_req@example.com', 'A5 SD Requester', 'REQUESTER');
    const uZero = await upsertUser('a5sd_zero@example.com', 'A5 SD Zero Staff', 'IT_STAFF');

    staff = { id: uStaff.id, email: uStaff.email };
    staff2 = { id: uStaff2.id, email: uStaff2.email };
    admin = { id: uAdmin.id, email: uAdmin.email };
    requester = { id: uReq.id, email: uReq.email };
    return uZero;
  }

  // bcrypt compares are CPU-only and this suite runs in parallel with Lab 1–3
  // files: log every agent in once here instead of before each test.
  beforeAll(async () => {
    userSnapshots = await snapshotUsers(prisma, FIXTURE_EMAILS);
    await ensureUsers();
    await cleanupFixtures();
    staffAgent = await loginAs(staff.email, sessionIds);
    staff2Agent = await loginAs(staff2.email, sessionIds);
    adminAgent = await loginAs(admin.email, sessionIds);
    requesterAgent = await loginAs(requester.email, sessionIds);
    zeroAgent = await loginAs('a5sd_zero@example.com', sessionIds);
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

  it('SD-01: staff metrics equal their direct DB counts (scoped exact; global unassigned via snapshots)', async () => {
    const baselineMyOwned = await prisma.ticket.count({
      where: { ownerId: staff.id, status: { in: ACTIVE_STATUSES } }
    });
    const baselineFollowUps = await prisma.actionTaken.count({
      where: { performedById: staff.id, followUpRequired: true, followUpCompletedAt: null }
    });

    const unassignedActive = await createTicket('unassigned active', { status: 'Open', ownerId: null });
    await createTicket('unassigned resolved', { status: 'Resolved', ownerId: null });
    const ownedActive = await createTicket('owned active', { status: 'In Progress', ownerId: staff.id });
    const ownedTicket = await createTicket('follow-up host', { status: 'Open', ownerId: staff.id });
    await createAction(ownedTicket.id, staff.id, { openFollowUp: true });

    // unassigned is global: our own delta is exactly 1 active unassigned fixture.
    const reading = await untilConsistent(
      async () => {
        const before = (await nonOwnUnassignedActive()) + 1;
        const response = await staffAgent.get('/api/dashboard/staff');
        expect(response.status).toBe(200);
        const after = (await nonOwnUnassignedActive()) + 1;
        return { value: response.body.metrics.unassigned.value, before, after, body: response.body };
      },
      (snapshot) => snapshot.value === snapshot.before || snapshot.value === snapshot.after
    );
    const body = reading.body;

    expect([reading.before, reading.after]).toContain(reading.value);
    expect(body.metrics.myOwned.value).toBe(baselineMyOwned + 2);
    expect(body.metrics.myOpenFollowUps.value).toBe(baselineFollowUps + 1);
    expect(body.windowDays).toBe(7);
    expect(new Date(body.generatedAt).toISOString()).toBe(body.generatedAt);

    // The drilldowns are present and well-formed.
    expect(body.metrics.unassigned.drilldown).toEqual({
      path: '/staff/tickets',
      query: { ownerId: 'unassigned', statusGroup: 'active' }
    });
    expect(body.metrics.myOwned.drilldown).toEqual({
      path: '/staff/tickets',
      query: { ownerId: String(staff.id), statusGroup: 'active' }
    });
    expect(body.metrics.myOpenFollowUps.drilldown).toBeNull();

    // recentTickets: shape and ordering only (global, capped at 5).
    expect(body.recentTickets.length).toBeLessThanOrEqual(5);
    const recentTimes = body.recentTickets.map((ticket: { updatedAt: string }) => new Date(ticket.updatedAt).getTime());
    for (let index = 1; index < recentTimes.length; index += 1) {
      expect(recentTimes[index - 1]).toBeGreaterThanOrEqual(recentTimes[index]);
    }
    for (const ticket of body.recentTickets) {
      expect(Object.keys(ticket).sort()).toEqual([
        'id',
        'itPriority',
        'owner',
        'requesterMarkedResolved',
        'status',
        'summary',
        'ticketNumber',
        'updatedAt'
      ]);
      expect(typeof ticket.requesterMarkedResolved).toBe('boolean');
    }
    // Sanity: our fixtures really were created and remain scannable.
    expect(unassignedActive.ownerId).toBeNull();
    expect(ownedActive.ownerId).toBe(staff.id);
  });

  it('SD-02: byStatus has all 8 statuses in order with snapshot-correct values; byPriority buckets include Unset with no drilldown', async () => {
    // Our fixtures: New +1, Cancelled +1, Open +2 (status view).
    const ownStatusDelta = new Map<string, number>([
      ['New', 1],
      ['Cancelled', 1],
      ['Open', 2]
    ]);
    // Active-only priority view: Medium +1, Urgent +1, Unset +1 (Cancelled is not active).
    const ownPriorityDelta = new Map<string, number>([
      ['Medium', 1],
      ['Urgent', 1],
      ['Unset', 1]
    ]);
    const ownActiveDelta = 3;

    await createTicket('status cancelled', { status: 'Cancelled' });
    await createTicket('status new', { status: 'New' });
    await createTicket('priority unset', { status: 'Open', itPriority: null, ownerId: staff.id });
    await createTicket('priority urgent', { status: 'Open', itPriority: 'Urgent', ownerId: staff.id });

    const reading = await untilConsistent(
      async () => {
        const before = await nonOwnTicketSnapshots();
        const response = await staffAgent.get('/api/dashboard/staff');
        expect(response.status).toBe(200);
        const after = await nonOwnTicketSnapshots();
        return { body: response.body, before, after };
      },
      (snapshot) => {
        const { body, before, after } = snapshot;
        const statusOk = body.byStatus.every((entry: { status: string; value: number }) => {
          const nonOwn = entry.value - (ownStatusDelta.get(entry.status) ?? 0);
          return nonOwn === (before.statuses.get(entry.status) ?? 0) || nonOwn === (after.statuses.get(entry.status) ?? 0);
        });
        const priorityOk = body.byPriority.every((entry: { priority: string; value: number }) => {
          const nonOwn = entry.value - (ownPriorityDelta.get(entry.priority) ?? 0);
          return nonOwn === (before.priorities.get(entry.priority) ?? 0) || nonOwn === (after.priorities.get(entry.priority) ?? 0);
        });
        const totalFromPriorities = body.byPriority.reduce(
          (sum: number, entry: { value: number }) => sum + entry.value,
          0
        );
        const totalNonOwn = totalFromPriorities - ownActiveDelta;
        const totalOk = totalNonOwn === before.activeTotal || totalNonOwn === after.activeTotal;
        return statusOk && priorityOk && totalOk;
      }
    );
    const { body, before, after } = reading;

    expect(body.byStatus).toHaveLength(8);
    expect(body.byStatus.map((entry: { status: string }) => entry.status)).toEqual(STATUS_ORDER);
    for (const entry of body.byStatus) {
      const delta = ownStatusDelta.get(entry.status) ?? 0;
      expect([(before.statuses.get(entry.status) ?? 0) + delta, (after.statuses.get(entry.status) ?? 0) + delta]).toContain(entry.value);
      expect(entry.drilldown).toEqual({ path: '/staff/tickets', query: { status: entry.status } });
    }

    expect(body.byPriority.map((entry: { priority: string }) => entry.priority)).toEqual([
      'Low',
      'Medium',
      'High',
      'Urgent',
      'Unset'
    ]);
    const byPriority = new Map(body.byPriority.map((entry: { priority: string; value: number }) => [entry.priority, entry]));
    expect(byPriority.get('Unset').drilldown).toBeNull();
    expect(byPriority.get('Urgent').drilldown).toEqual({
      path: '/staff/tickets',
      query: { itPriority: 'Urgent', statusGroup: 'active' }
    });
    expect(byPriority.get('Low').drilldown).toEqual({
      path: '/staff/tickets',
      query: { itPriority: 'Low', statusGroup: 'active' }
    });
    for (const entry of body.byPriority) {
      const delta = ownPriorityDelta.get(entry.priority) ?? 0;
      expect([(before.priorities.get(entry.priority) ?? 0) + delta, (after.priorities.get(entry.priority) ?? 0) + delta]).toContain(entry.value);
    }
    const activeTotalFromPriorities = body.byPriority.reduce(
      (sum: number, entry: { value: number }) => sum + entry.value,
      0
    );
    expect([before.activeTotal + ownActiveDelta, after.activeTotal + ownActiveDelta]).toContain(activeTotalFromPriorities);
  });

  it('SD-03: myOwned, myOpenFollowUps and myRecentActions are scoped to the calling staff member', async () => {
    const ownedByStaff1 = await createTicket('owned by staff 1', { status: 'Open', ownerId: staff.id });
    const ownedByStaff2 = await createTicket('owned by staff 2', { status: 'Open', ownerId: staff2.id });

    const action1 = await createAction(ownedByStaff1.id, staff.id, { openFollowUp: true });
    const action2 = await createAction(ownedByStaff2.id, staff2.id, {});
    const action3 = await createAction(ownedByStaff2.id, staff2.id, { completedFollowUp: true });

    const staffOne = (await staffAgent.get('/api/dashboard/staff')).body;
    const staffTwo = (await staff2Agent.get('/api/dashboard/staff')).body;

    expect(staffOne.metrics.myOwned.value).toBe(1);
    expect(staffTwo.metrics.myOwned.value).toBe(1);
    expect(staffOne.metrics.myOpenFollowUps.value).toBe(1);
    expect(staffTwo.metrics.myOpenFollowUps.value).toBe(0);

    expect(staffOne.myRecentActions.map((action: { id: number }) => action.id)).toEqual([action1.id]);
    expect(staffOne.myRecentActions[0]).toEqual({
      id: action1.id,
      ticketId: ownedByStaff1.id,
      ticketNumber: ownedByStaff1.ticketNumber,
      description: action1.description,
      followUpRequired: true,
      followUpOpen: true,
      createdAt: staffOne.myRecentActions[0].createdAt
    });
    expect(staffTwo.myRecentActions.map((action: { id: number }) => action.id)).toEqual([action3.id, action2.id]);
    expect(staffTwo.myRecentActions[0].followUpOpen).toBe(false);
    expect(staffTwo.myRecentActions[1].followUpOpen).toBe(false);
  });

  it('SD-04: users counts are present for Administrator and structurally absent for IT Staff', async () => {
    const staffBody = (await staffAgent.get('/api/dashboard/staff')).body;
    expect(staffBody).not.toHaveProperty('users');

    const userCountKeys = ['activeRequesters', 'activeItStaff', 'activeAdministrators', 'inactive'] as const;

    const reading = await untilConsistent(
      async () => {
        const before = await readUserCounts();
        const response = await adminAgent.get('/api/dashboard/staff');
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('users');
        const after = await readUserCounts();
        return { users: response.body.users, before, after };
      },
      (snapshot) =>
        userCountKeys.every(
          (key) => snapshot.users[key] === snapshot.before[key] || snapshot.users[key] === snapshot.after[key]
        )
    );
    const { users, before, after } = reading;

    for (const key of userCountKeys) {
      expect([before[key], after[key]], key).toContain(users[key]);
    }
    expect(users.activeRequesters).toBeGreaterThanOrEqual(1);
    expect(users.activeItStaff).toBeGreaterThanOrEqual(2);
    expect(users.activeAdministrators).toBeGreaterThanOrEqual(1);
  });

  it('SD-05: requester and anonymous callers are rejected (403 / 401)', async () => {
    const anonymous = await request(app).get('/api/dashboard/staff');
    const asRequester = await requesterAgent.get('/api/dashboard/staff');

    expect(anonymous.status).toBe(401);
    expect(anonymous.body.error.code).toBe('UNAUTHENTICATED');
    expect(asRequester.status).toBe(403);
    expect(asRequester.body.error.code).toBe('FORBIDDEN');
  });

  it('SD-06: following every drilldown against GET /api/staff/tickets returns totalItems equal to the card value', async () => {
    await createTicket('drill unassigned', { status: 'Open', ownerId: null });
    await createTicket('drill owned', { status: 'Open', ownerId: staff.id });
    await createTicket('drill cancelled', { status: 'Cancelled', ownerId: null });
    await createTicket('drill urgent active', { status: 'In Progress', itPriority: 'Urgent', ownerId: null });
    await createTicket('drill unset active', { status: 'New', itPriority: null, ownerId: null });

    type DrillCase = { drilldown: { path: string; query: Record<string, string> } | null; value: number; name: string };
    type DrillBody = {
      metrics: {
        unassigned: { value: number; drilldown: { path: string; query: Record<string, string> } | null };
        myOwned: { value: number; drilldown: { path: string; query: Record<string, string> } | null };
      };
      byStatus: Array<{ status: string; value: number; drilldown: { path: string; query: Record<string, string> } | null }>;
      byPriority: Array<{
        priority: string;
        value: number;
        drilldown: { path: string; query: Record<string, string> } | null;
      }>;
    };

    const toCases = (body: DrillBody): DrillCase[] => [
      { drilldown: body.metrics.unassigned.drilldown, value: body.metrics.unassigned.value, name: 'unassigned' },
      { drilldown: body.metrics.myOwned.drilldown, value: body.metrics.myOwned.value, name: 'myOwned' },
      ...body.byStatus.map((entry) => ({
        drilldown: entry.drilldown,
        value: entry.value,
        name: `byStatus:${entry.status}`
      })),
      ...body.byPriority
        .filter((entry) => entry.drilldown !== null)
        .map((entry) => ({
          drilldown: entry.drilldown,
          value: entry.value,
          name: `byPriority:${entry.priority}`
        }))
    ];

    const reading = await untilConsistent(
      async () => {
        const response = await staffAgent.get('/api/dashboard/staff');
        expect(response.status).toBe(200);
        const body = response.body;
        const cases = toCases(response.body);

        // Other test files keep transitioning their own tickets, so the list
        // totalItems is read at a later instant than the cards. Fetch every
        // drilldown list in parallel (one narrow window) and read the cards
        // again afterwards: a list value matching either card reading means a
        // single concurrent write landed before or after the list reads, which
        // is consistent — only stacked writes inside the window are real drift.
        const lists = await Promise.all(
          cases.map(async ({ drilldown }) => {
            if (!drilldown) return null;
            const query = new URLSearchParams(drilldown.query).toString();
            return staffAgent.get(`/api/staff/tickets?${query}`);
          })
        );
        const afterResponse = await staffAgent.get('/api/dashboard/staff');
        expect(afterResponse.status).toBe(200);
        const afterByName = new Map(toCases(afterResponse.body).map((entry) => [entry.name, entry.value]));

        const mismatches: string[] = [];
        cases.forEach(({ drilldown, value, name }, index) => {
          if (!drilldown) {
            mismatches.push(`${name}: drilldown missing`);
            return;
          }
          const list = lists[index];
          if (!list) {
            mismatches.push(`${name}: list missing`);
            return;
          }
          if (list.status !== 200) {
            mismatches.push(`${name}: list status ${list.status}`);
            return;
          }
          const total = list.body.pagination.totalItems;
          const afterValue = afterByName.get(name);
          if (total !== value && (afterValue === undefined || total !== afterValue)) {
            mismatches.push(`${name}: card ${value} (after ${afterValue}) !== list ${total}`);
          }
        });
        return { mismatches, cases, body };
      },
      (snapshot) => snapshot.mismatches.length === 0,
      10
    );

    expect(reading.mismatches).toEqual([]);

    for (const { drilldown, name } of reading.cases) {
      expect(drilldown, name).not.toBeNull();
      expect(drilldown.path, name).toBe('/staff/tickets');
    }

    // myOpenFollowUps has no drilldown and must stay that way.
    expect(reading.body.metrics.myOpenFollowUps.drilldown).toBeNull();
  });

  it('SD-07: a staff member with zero owned Tickets and zero Actions sees zeros and empty lists', async () => {
    const response = await zeroAgent.get('/api/dashboard/staff');
    expect(response.status).toBe(200);
    const body = response.body;

    expect(body.metrics.myOwned.value).toBe(0);
    expect(body.metrics.myOpenFollowUps.value).toBe(0);
    expect(body.myRecentActions).toEqual([]);
    expect(body).not.toHaveProperty('users');
    // Global lists are arrays (never null), possibly non-empty from other fixtures.
    expect(Array.isArray(body.recentTickets)).toBe(true);
    expect(Array.isArray(body.byStatus)).toBe(true);
    expect(Array.isArray(body.byPriority)).toBe(true);
  });
});

/**
 * WF-01 … WF-13: Ticket status workflow, resolution gate, and stale updates
 * (Lab 4, Issue 4). specification.md BR-13 … BR-24, api-spec.md §4, §4.5.
 *
 * Every fixture ticket is created with a unique ticket number under the
 * [A4-WF] summary prefix and removed with a summary-scoped delete in
 * afterEach (never an unscoped updateMany/deleteMany). Shared seed users are
 * not mutated; the test users belong to this file.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { app, ALL_STATUSES } from '../../src/server.js';
import prisma from '../../src/prisma.js';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const localPasswordHash = '$2b$12$MvQuSTNtpiuJmfaKc7j0Nu0FipBQuY31F6ojkIMWw2OMTZoK5lUkq';
const SUMMARY_PREFIX = '[A4-WF]';
const csrf = 'X-Requested-With';

const ACTIVE_STATUSES = ['New', 'Open', 'In Progress', 'Waiting for Requester', 'Reopened'];

// Independent literal copy of specification.md BR-13 (15 permitted pairs).
const PERMITTED_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['New', 'Open'],
  ['New', 'Cancelled'],
  ['Open', 'In Progress'],
  ['Open', 'Cancelled'],
  ['In Progress', 'Waiting for Requester'],
  ['In Progress', 'Resolved'],
  ['In Progress', 'Cancelled'],
  ['Waiting for Requester', 'In Progress'],
  ['Waiting for Requester', 'Resolved'],
  ['Waiting for Requester', 'Cancelled'],
  ['Resolved', 'Closed'],
  ['Resolved', 'Reopened'],
  ['Closed', 'Reopened'],
  ['Reopened', 'In Progress'],
  ['Reopened', 'Cancelled']
];

function permitted(from: string, to: string) {
  return PERMITTED_PAIRS.some(([f, t]) => f === from && t === to);
}

async function loginAs(email: string): Promise<request.SuperAgentTest> {
  const agent = request.agent(app);
  await agent
    .post('/api/auth/login')
    .set(csrf, 'XMLHttpRequest')
    .send({ email, password: 'LocalOnly1!' });
  return agent;
}

describe('Ticket workflow API (WF-01 … WF-13)', () => {
  let catId: number;
  let sysId: number;
  let requesterOwner: { id: number; email: string };
  let otherRequester: { id: number; email: string };
  let nonOwnerStaff: { id: number; email: string };
  let ownerStaff: { id: number; email: string };
  let adminUser: { id: number; email: string };
  let inactiveStaffId: number;

  let requesterAgent: request.SuperAgentTest;
  let otherRequesterAgent: request.SuperAgentTest;
  let staffAgent: request.SuperAgentTest;
  let ownerStaffAgent: request.SuperAgentTest;
  let adminAgent: request.SuperAgentTest;

  let fixtureSeq = 0;

  async function cleanupFixtures() {
    await prisma.actionTaken.deleteMany({
      where: { ticket: { summary: { startsWith: SUMMARY_PREFIX } } }
    });
    await prisma.ticket.deleteMany({
      where: { summary: { startsWith: SUMMARY_PREFIX } }
    });
  }

  async function createTicket(status: string, label: string, overrides: Record<string, unknown> = {}) {
    fixtureSeq += 1;
    return prisma.ticket.create({
      data: {
        ticketNumber: `TICK-A4WF-${randomUUID().slice(0, 12)}`,
        summary: `${SUMMARY_PREFIX}${label} ${status} fixture ${fixtureSeq}`,
        description: 'Workflow fixture ticket for the Lab 4 Issue 4 tests.',
        requestedPriority: 'Medium',
        itPriority: 'Medium',
        status,
        requesterId: requesterOwner.id,
        ownerId: ownerStaff.id,
        categoryId: catId,
        relatedSystemId: sysId,
        ...overrides
      }
    });
  }

  async function createAction(
    ticketId: number,
    options: { openFollowUp?: boolean; completedFollowUp?: boolean } = {}
  ) {
    const needsFollowUp = Boolean(options.openFollowUp || options.completedFollowUp);
    return prisma.actionTaken.create({
      data: {
        ticketId,
        actionAt: new Date(),
        description: 'Reviewed the configuration on the affected workstation.',
        result: 'Configuration corrected and verified with the requester.',
        performedById: ownerStaff.id,
        updatedById: ownerStaff.id,
        followUpRequired: needsFollowUp,
        followUpNote: needsFollowUp ? 'Confirm the outcome with the requester afterwards.' : null,
        followUpCompletedAt: options.completedFollowUp ? new Date() : null
      }
    });
  }

  function patchStatus(agent: request.SuperAgentTest, ticketId: number, body: Record<string, unknown>) {
    return agent
      .patch(`/api/staff/tickets/${ticketId}/status`)
      .set(csrf, 'XMLHttpRequest')
      .send(body);
  }

  function patchOwner(agent: request.SuperAgentTest, ticketId: number, body: Record<string, unknown>) {
    return agent
      .patch(`/api/staff/tickets/${ticketId}/owner`)
      .set(csrf, 'XMLHttpRequest')
      .send(body);
  }

  function patchPriority(agent: request.SuperAgentTest, ticketId: number, body: Record<string, unknown>) {
    return agent
      .patch(`/api/staff/tickets/${ticketId}/priority`)
      .set(csrf, 'XMLHttpRequest')
      .send(body);
  }

  beforeAll(async () => {
    const cat = await prisma.category.findFirst({ where: { isActive: true } });
    const sys = await prisma.relatedSystem.findFirst({ where: { isActive: true } });
    if (!cat || !sys) {
      throw new Error('Test database is missing required seed categories/systems');
    }
    catId = cat.id;
    sysId = sys.id;

    const u1 = await prisma.user.upsert({
      where: { emailNormalized: 'a4wf_req1@example.com' },
      update: { name: 'A4 WF Requester', role: 'REQUESTER', department: 'Support', passwordHash: localPasswordHash, mustChangePassword: false, isActive: true },
      create: {
        name: 'A4 WF Requester', email: 'a4wf_req1@example.com', emailNormalized: 'a4wf_req1@example.com',
        department: 'Support', role: 'REQUESTER', passwordHash: localPasswordHash, mustChangePassword: false, isActive: true
      }
    });
    const u2 = await prisma.user.upsert({
      where: { emailNormalized: 'a4wf_req2@example.com' },
      update: { name: 'A4 WF Other Requester', role: 'REQUESTER', department: 'Operations', passwordHash: localPasswordHash, mustChangePassword: false, isActive: true },
      create: {
        name: 'A4 WF Other Requester', email: 'a4wf_req2@example.com', emailNormalized: 'a4wf_req2@example.com',
        department: 'Operations', role: 'REQUESTER', passwordHash: localPasswordHash, mustChangePassword: false, isActive: true
      }
    });
    const u3 = await prisma.user.upsert({
      where: { emailNormalized: 'a4wf_staff_nonowner@example.com' },
      update: { name: 'A4 WF Non-Owner Staff', role: 'IT_STAFF', department: 'IT', passwordHash: localPasswordHash, mustChangePassword: false, isActive: true },
      create: {
        name: 'A4 WF Non-Owner Staff', email: 'a4wf_staff_nonowner@example.com', emailNormalized: 'a4wf_staff_nonowner@example.com',
        department: 'IT', role: 'IT_STAFF', passwordHash: localPasswordHash, mustChangePassword: false, isActive: true
      }
    });
    const u4 = await prisma.user.upsert({
      where: { emailNormalized: 'a4wf_staff_owner@example.com' },
      update: { name: 'A4 WF Owner Staff', role: 'IT_STAFF', department: 'IT', passwordHash: localPasswordHash, mustChangePassword: false, isActive: true },
      create: {
        name: 'A4 WF Owner Staff', email: 'a4wf_staff_owner@example.com', emailNormalized: 'a4wf_staff_owner@example.com',
        department: 'IT', role: 'IT_STAFF', passwordHash: localPasswordHash, mustChangePassword: false, isActive: true
      }
    });
    const u5 = await prisma.user.upsert({
      where: { emailNormalized: 'a4wf_admin@example.com' },
      update: { name: 'A4 WF Administrator', role: 'ADMINISTRATOR', department: 'IT', passwordHash: localPasswordHash, mustChangePassword: false, isActive: true },
      create: {
        name: 'A4 WF Administrator', email: 'a4wf_admin@example.com', emailNormalized: 'a4wf_admin@example.com',
        department: 'IT', role: 'ADMINISTRATOR', passwordHash: localPasswordHash, mustChangePassword: false, isActive: true
      }
    });
    const u6 = await prisma.user.upsert({
      where: { emailNormalized: 'a4wf_staff_inactive@example.com' },
      update: { name: 'A4 WF Inactive Staff', role: 'IT_STAFF', department: 'IT', passwordHash: localPasswordHash, mustChangePassword: false, isActive: false },
      create: {
        name: 'A4 WF Inactive Staff', email: 'a4wf_staff_inactive@example.com', emailNormalized: 'a4wf_staff_inactive@example.com',
        department: 'IT', role: 'IT_STAFF', passwordHash: localPasswordHash, mustChangePassword: false, isActive: false
      }
    });

    requesterOwner = { id: u1.id, email: u1.email };
    otherRequester = { id: u2.id, email: u2.email };
    nonOwnerStaff = { id: u3.id, email: u3.email };
    ownerStaff = { id: u4.id, email: u4.email };
    adminUser = { id: u5.id, email: u5.email };
    inactiveStaffId = u6.id;

    requesterAgent = await loginAs(requesterOwner.email);
    otherRequesterAgent = await loginAs(otherRequester.email);
    staffAgent = await loginAs(nonOwnerStaff.email);
    ownerStaffAgent = await loginAs(ownerStaff.email);
    adminAgent = await loginAs(adminUser.email);
  });

  beforeEach(() => {
    fixtureSeq = 0;
  });

  afterEach(async () => {
    await cleanupFixtures();
  });

  afterAll(async () => {
    await cleanupFixtures();
  });

  it('WF-01: table-driven matrix — every (from, to) pair yields 15 x 200 and 49 x 409 INVALID_STATUS_TRANSITION', async () => {
    let accepted = 0;
    let rejected = 0;

    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        const ticket = await createTicket(from, '[WF-01]');
        if (to === 'Resolved') {
          // The gate must pass so the matrix itself is what is being tested.
          await createAction(ticket.id);
        }

        const res = await patchStatus(staffAgent, ticket.id, { status: to, expectedVersion: ticket.version });
        const row = await prisma.ticket.findUnique({ where: { id: ticket.id } });

        if (permitted(from, to)) {
          expect([from, to, res.status]).toEqual([from, to, 200]);
          expect(res.body.ticket.status).toBe(to);
          expect(res.body.ticket.version).toBe(ticket.version + 1);
          expect(row!.status).toBe(to);
          if (to === 'Resolved') expect(res.body.ticket.resolvedAt).toBeTruthy();
          accepted += 1;
        } else {
          expect([from, to, res.status]).toEqual([from, to, 409]);
          expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
          expect(row!.status).toBe(from);
          expect(row!.version).toBe(ticket.version);
          rejected += 1;
        }
      }
    }

    expect(accepted).toBe(15);
    expect(rejected).toBe(49);
  });

  it('WF-02: Requester and anonymous are rejected on status, owner and priority with the Ticket unchanged', async () => {
    const ticket = await createTicket('Open', '[WF-02]');
    const before = await prisma.ticket.findUnique({ where: { id: ticket.id } });

    const anonymousStatus = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/status`)
      .set(csrf, 'XMLHttpRequest')
      .send({ status: 'In Progress' });
    const anonymousOwner = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/owner`)
      .set(csrf, 'XMLHttpRequest')
      .send({ ownerId: adminUser.id });
    const anonymousPriority = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/priority`)
      .set(csrf, 'XMLHttpRequest')
      .send({ itPriority: 'High' });
    expect([anonymousStatus.status, anonymousOwner.status, anonymousPriority.status]).toEqual([401, 401, 401]);
    expect(anonymousStatus.body.error.code).toBe('UNAUTHENTICATED');

    const ownerStatus = await patchStatus(requesterAgent, ticket.id, { status: 'In Progress' });
    const ownerOwner = await patchOwner(requesterAgent, ticket.id, { ownerId: adminUser.id });
    const ownerPriority = await patchPriority(requesterAgent, ticket.id, { itPriority: 'High' });
    expect([ownerStatus.status, ownerOwner.status, ownerPriority.status]).toEqual([403, 403, 403]);
    expect(ownerStatus.body.error.code).toBe('FORBIDDEN');

    const otherStatus = await patchStatus(otherRequesterAgent, ticket.id, { status: 'In Progress' });
    const otherOwner = await patchOwner(otherRequesterAgent, ticket.id, { ownerId: adminUser.id });
    const otherPriority = await patchPriority(otherRequesterAgent, ticket.id, { itPriority: 'High' });
    expect([otherStatus.status, otherOwner.status, otherPriority.status]).toEqual([403, 403, 403]);

    const after = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(after).toEqual(before);
  });

  it('WF-02: non-owner IT Staff may change status, owner and priority (BR-14)', async () => {
    const ticket = await createTicket('Open', '[WF-02-staff]');
    expect(ticket.ownerId).toBe(ownerStaff.id); // the caller is deliberately not the owner

    const statusRes = await patchStatus(staffAgent, ticket.id, { status: 'In Progress', expectedVersion: ticket.version });
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.ticket.status).toBe('In Progress');
    expect(statusRes.body.ticket.version).toBe(ticket.version + 1);

    const ownerRes = await patchOwner(staffAgent, ticket.id, { ownerId: adminUser.id, expectedVersion: statusRes.body.ticket.version });
    expect(ownerRes.status).toBe(200);
    expect(ownerRes.body.ticket.ownerId).toBe(adminUser.id);
    expect(ownerRes.body.ticket.version).toBe(statusRes.body.ticket.version + 1);

    const priorityRes = await patchPriority(staffAgent, ticket.id, { itPriority: 'Urgent', expectedVersion: ownerRes.body.ticket.version });
    expect(priorityRes.status).toBe(200);
    expect(priorityRes.body.ticket.itPriority).toBe('Urgent');
    expect(priorityRes.body.ticket.version).toBe(ownerRes.body.ticket.version + 1);
  });

  it('WF-02: an Administrator may change status, owner and priority (BR-14)', async () => {
    const ticket = await createTicket('Open', '[WF-02-admin]');

    const statusRes = await patchStatus(adminAgent, ticket.id, { status: 'In Progress', expectedVersion: ticket.version });
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.ticket.status).toBe('In Progress');

    const ownerRes = await patchOwner(adminAgent, ticket.id, { ownerId: nonOwnerStaff.id, expectedVersion: statusRes.body.ticket.version });
    expect(ownerRes.status).toBe(200);
    expect(ownerRes.body.ticket.ownerId).toBe(nonOwnerStaff.id);

    const priorityRes = await patchPriority(adminAgent, ticket.id, { itPriority: 'Low', expectedVersion: ownerRes.body.ticket.version });
    expect(priorityRes.status).toBe(200);
    expect(priorityRes.body.ticket.itPriority).toBe('Low');
  });

  it('WF-03: resolving with no Actions Taken returns 409 RESOLUTION_BLOCKED (NO_ACTIONS_TAKEN)', async () => {
    for (const from of ['In Progress', 'Waiting for Requester']) {
      const ticket = await createTicket(from, '[WF-03]');
      const res = await patchStatus(staffAgent, ticket.id, { status: 'Resolved', expectedVersion: ticket.version });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('RESOLUTION_BLOCKED');
      expect(res.body.error.details).toEqual({ reason: 'NO_ACTIONS_TAKEN', openFollowUps: 0 });

      const row = await prisma.ticket.findUnique({ where: { id: ticket.id } });
      expect(row!.status).toBe(from);
      expect(row!.version).toBe(ticket.version);
      expect(row!.resolvedAt).toBeNull();
    }
  });

  it('WF-04: an open follow-up blocks resolving with the exact count, then completing them allows it', async () => {
    const ticket = await createTicket('In Progress', '[WF-04]');
    const first = await createAction(ticket.id, { openFollowUp: true });
    const second = await createAction(ticket.id, { openFollowUp: true });
    await createAction(ticket.id); // one action without follow-up does not unblock

    const blocked = await patchStatus(staffAgent, ticket.id, { status: 'Resolved', expectedVersion: ticket.version });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('RESOLUTION_BLOCKED');
    expect(blocked.body.error.details).toEqual({ reason: 'OPEN_FOLLOW_UPS', openFollowUps: 2 });

    for (const action of [first, second]) {
      const done = await ownerStaffAgent
        .patch(`/api/staff/tickets/${ticket.id}/actions-taken/${action.id}`)
        .set(csrf, 'XMLHttpRequest')
        .send({ expectedVersion: action.version, followUpCompleted: true });
      expect(done.status).toBe(200);
    }

    const row = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    const resolved = await patchStatus(staffAgent, ticket.id, { status: 'Resolved', expectedVersion: row!.version });
    expect(resolved.status).toBe(200);
    expect(resolved.body.ticket.status).toBe('Resolved');
  });

  it('WF-05: resolving with at least one Action and no open follow-up succeeds and sets resolvedAt', async () => {
    const ticket = await createTicket('In Progress', '[WF-05]');
    await createAction(ticket.id);
    await createAction(ticket.id, { completedFollowUp: true });

    const res = await patchStatus(staffAgent, ticket.id, { status: 'Resolved', expectedVersion: ticket.version });
    expect(res.status).toBe(200);
    expect(res.body.ticket.status).toBe('Resolved');
    expect(res.body.ticket.resolvedAt).toBeTruthy();
    expect(res.body.ticket.version).toBe(ticket.version + 1);

    const row = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(row!.resolvedAt).not.toBeNull();
  });

  it('WF-06: mark-resolved keeps status; Reopen clears resolvedAt and the flag; Close keeps resolvedAt', async () => {
    const reopenTicket = await createTicket('In Progress', '[WF-06-reopen]');
    await createAction(reopenTicket.id);

    const resolved = await patchStatus(staffAgent, reopenTicket.id, { status: 'Resolved', expectedVersion: reopenTicket.version });
    expect(resolved.status).toBe(200);
    const resolvedAt = resolved.body.ticket.resolvedAt;
    expect(resolvedAt).toBeTruthy();

    const marked = await requesterAgent
      .post(`/api/tickets/${reopenTicket.id}/mark-resolved`)
      .set(csrf, 'XMLHttpRequest')
      .send();
    expect(marked.status).toBe(200);
    expect(marked.body.ticket.status).toBe('Resolved'); // status never changes (BR-17)
    expect(marked.body.ticket.requesterMarkedResolved).toBe(true);
    expect(marked.body.ticket.version).toBe(resolved.body.ticket.version + 1);

    const reopened = await patchStatus(staffAgent, reopenTicket.id, { status: 'Reopened', expectedVersion: marked.body.ticket.version });
    expect(reopened.status).toBe(200);
    expect(reopened.body.ticket.resolvedAt).toBeNull();
    expect(reopened.body.ticket.requesterMarkedResolved).toBe(false);
    expect(reopened.body.ticket.status).toBe('Reopened');

    const closeTicket = await createTicket('In Progress', '[WF-06-close]');
    await createAction(closeTicket.id);
    const resolveRes = await patchStatus(staffAgent, closeTicket.id, { status: 'Resolved', expectedVersion: closeTicket.version });
    expect(resolveRes.status).toBe(200);
    const keepResolvedAt = resolveRes.body.ticket.resolvedAt;
    expect(keepResolvedAt).toBeTruthy();

    const closed = await patchStatus(staffAgent, closeTicket.id, { status: 'Closed', expectedVersion: resolveRes.body.ticket.version });
    expect(closed.status).toBe(200);
    expect(closed.body.ticket.status).toBe('Closed');
    expect(closed.body.ticket.resolvedAt).toBe(keepResolvedAt); // Resolved -> Closed keeps resolvedAt (BR-18)
  });

  it('WF-07: stale expectedVersion is rejected on status, owner and priority; omitted still works; success increments version', async () => {
    const ticket = await createTicket('New', '[WF-07]');

    const staleStatus = await patchStatus(staffAgent, ticket.id, { status: 'Open', expectedVersion: 99 });
    expect(staleStatus.status).toBe(409);
    expect(staleStatus.body.error.code).toBe('VERSION_CONFLICT');
    expect(staleStatus.body.error.details).toEqual({ currentVersion: ticket.version });

    const staleOwner = await patchOwner(staffAgent, ticket.id, { ownerId: adminUser.id, expectedVersion: 99 });
    expect(staleOwner.status).toBe(409);
    expect(staleOwner.body.error.code).toBe('VERSION_CONFLICT');
    expect(staleOwner.body.error.details).toEqual({ currentVersion: ticket.version });

    const stalePriority = await patchPriority(staffAgent, ticket.id, { itPriority: 'High', expectedVersion: 99 });
    expect(stalePriority.status).toBe(409);
    expect(stalePriority.body.error.code).toBe('VERSION_CONFLICT');
    expect(stalePriority.body.error.details).toEqual({ currentVersion: ticket.version });

    let row = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(row).toEqual(ticket); // nothing changed

    const noVersionStatus = await patchStatus(staffAgent, ticket.id, { status: 'Open' });
    expect(noVersionStatus.status).toBe(200);
    expect(noVersionStatus.body.ticket.version).toBe(ticket.version + 1);

    const noVersionOwner = await patchOwner(staffAgent, ticket.id, { ownerId: adminUser.id });
    expect(noVersionOwner.status).toBe(200);
    expect(noVersionOwner.body.ticket.version).toBe(ticket.version + 2);

    const noVersionPriority = await patchPriority(staffAgent, ticket.id, { itPriority: 'High' });
    expect(noVersionPriority.status).toBe(200);
    expect(noVersionPriority.body.ticket.version).toBe(ticket.version + 3);

    row = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(row!.version).toBe(ticket.version + 3);

    const correctVersion = await patchStatus(staffAgent, ticket.id, { status: 'In Progress', expectedVersion: row!.version });
    expect(correctVersion.status).toBe(200);
    expect(correctVersion.body.ticket.version).toBe(row!.version + 1);
  });

  it('WF-08: concurrent resolve and open-follow-up create never leave Resolved with an open follow-up', async () => {
    const ticket = await createTicket('In Progress', '[WF-08]');
    await createAction(ticket.id); // gate passes before the race starts

    const [resolveRes, createActionRes] = await Promise.all([
      patchStatus(staffAgent, ticket.id, { status: 'Resolved', expectedVersion: ticket.version }),
      staffAgent
        .post(`/api/staff/tickets/${ticket.id}/actions-taken`)
        .set(csrf, 'XMLHttpRequest')
        .send({
          description: 'Restarted the application service on the server.',
          result: 'Service started and health probe returned OK.',
          followUpRequired: true,
          followUpNote: 'Verify the fix with the requester tomorrow.'
        })
    ]);

    const row = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    const openFollowUps = await prisma.actionTaken.count({
      where: { ticketId: ticket.id, followUpRequired: true, followUpCompletedAt: null }
    });

    // Invariant: a Resolved Ticket never holds an open follow-up.
    expect(row!.status === 'Resolved' && openFollowUps > 0).toBe(false);

    // Exactly one of the two racing requests succeeds; the other fails with a documented 409.
    const successes = [resolveRes.status, createActionRes.status].filter((status) => status < 300);
    expect(successes).toHaveLength(1);

    const failure = resolveRes.status >= 400 ? resolveRes : createActionRes;
    expect(failure.status).toBe(409);
    expect(['RESOLUTION_BLOCKED', 'TICKET_ACTIONS_LOCKED']).toContain(failure.body.error.code);
    if (failure.body.error.code === 'RESOLUTION_BLOCKED') {
      expect(failure.body.error.details.reason).toBe('OPEN_FOLLOW_UPS');
    }
  });

  it('WF-09: two concurrent status changes with the same expectedVersion yield exactly one 200 and one 409', async () => {
    const ticket = await createTicket('In Progress', '[WF-09]');

    const [first, second] = await Promise.all([
      patchStatus(staffAgent, ticket.id, { status: 'Waiting for Requester', expectedVersion: 1 }),
      patchStatus(staffAgent, ticket.id, { status: 'Cancelled', expectedVersion: 1 })
    ]);

    const statuses = [first.status, second.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 409]);

    const loser = first.status === 409 ? first : second;
    expect(loser.body.error.code).toBe('VERSION_CONFLICT');
    expect(loser.body.error.details).toEqual({ currentVersion: 2 });

    const row = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(row!.version).toBe(2);
    const winner = first.status === 200 ? first : second;
    expect(row!.status).toBe(winner.body.ticket.status);
    expect(row!.status).not.toBe(ticket.status);
  });

  it('WF-10: allowedTransitions is present in staff responses and structurally absent from Requester responses', async () => {
    const staffTicket = await createTicket('In Progress', '[WF-10-staff]');
    await createAction(staffTicket.id);
    const requesterTicket = await createTicket('Open', '[WF-10-requester]');
    const token = encodeURIComponent('[WF-10');

    // Staff queue list
    const queue = await staffAgent.get(`/api/staff/tickets?search=${token}&pageSize=100`);
    expect(queue.status).toBe(200);
    const queued = (queue.body.tickets as Array<Record<string, unknown>>).find((t) => t.id === staffTicket.id);
    expect(queued).toBeDefined();
    expect(queued!.allowedTransitions).toEqual(['Waiting for Requester', 'Resolved', 'Cancelled']);
    expect(queued!.version).toBe(1);
    expect('resolvedAt' in queued!).toBe(true);

    // Staff detail
    const detail = await staffAgent.get(`/api/staff/tickets/${staffTicket.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.ticket.allowedTransitions).toEqual(['Waiting for Requester', 'Resolved', 'Cancelled']);
    expect(detail.body.ticket.version).toBe(1);
    expect('resolvedAt' in detail.body.ticket).toBe(true);

    // Staff PATCH response
    const patched = await patchStatus(staffAgent, requesterTicket.id, { status: 'In Progress' });
    expect(patched.status).toBe(200);
    expect(patched.body.ticket.allowedTransitions).toEqual(['Waiting for Requester', 'Resolved', 'Cancelled']);
    expect(patched.body.ticket.version).toBe(2);

    // Requester list — allowedTransitions and internalNotes are structurally absent
    const requesterList = await requesterAgent.get(`/api/tickets?search=${token}&pageSize=100`);
    expect(requesterList.status).toBe(200);
    const requesterRow = (requesterList.body.tickets as Array<Record<string, unknown>>).find((t) => t.id === staffTicket.id);
    expect(requesterRow).toBeDefined();
    expect('allowedTransitions' in requesterRow!).toBe(false);
    expect('internalNotes' in requesterRow!).toBe(false);
    expect(requesterRow!.version).toBe(1);
    expect('resolvedAt' in requesterRow!).toBe(true);

    // Requester detail
    const requesterDetail = await requesterAgent.get(`/api/tickets/${staffTicket.id}`);
    expect(requesterDetail.status).toBe(200);
    expect('allowedTransitions' in requesterDetail.body.ticket).toBe(false);
    expect('internalNotes' in requesterDetail.body.ticket).toBe(false);
    expect(requesterDetail.body.ticket.version).toBe(1);
    expect('resolvedAt' in requesterDetail.body.ticket).toBe(true);
  });

  it('WF-11: cancelling a Ticket with open follow-ups is not gated', async () => {
    const ticket = await createTicket('In Progress', '[WF-11]');
    await createAction(ticket.id, { openFollowUp: true });
    await createAction(ticket.id, { openFollowUp: true });

    const res = await patchStatus(staffAgent, ticket.id, { status: 'Cancelled', expectedVersion: ticket.version });
    expect(res.status).toBe(200);
    expect(res.body.ticket.status).toBe('Cancelled');
    expect(res.body.ticket.allowedTransitions).toEqual([]);

    const row = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(row!.status).toBe('Cancelled');
    expect(row!.version).toBe(ticket.version + 1);
  });

  it('WF-12: owner change to a non-staff or inactive user stays rejected; priority rules intact (Lab 3 regression)', async () => {
    const ticket = await createTicket('Open', '[WF-12]');

    const toRequester = await patchOwner(staffAgent, ticket.id, { ownerId: requesterOwner.id });
    expect(toRequester.status).toBe(400);
    expect(toRequester.body.error.code).toBe('VALIDATION_ERROR');
    expect(toRequester.body.error.message).toBe('Owner must be an active IT Staff or Administrator.');

    const toInactive = await patchOwner(staffAgent, ticket.id, { ownerId: inactiveStaffId });
    expect(toInactive.status).toBe(400);
    expect(toInactive.body.error.code).toBe('VALIDATION_ERROR');
    expect(toInactive.body.error.message).toBe('Owner must be an active IT Staff or Administrator.');

    const toUnknown = await patchOwner(staffAgent, ticket.id, { ownerId: 999_999 });
    expect(toUnknown.status).toBe(404);
    expect(toUnknown.body.error.code).toBe('USER_NOT_FOUND');

    const badPriority = await patchPriority(staffAgent, ticket.id, { itPriority: 'Super High' });
    expect(badPriority.status).toBe(400);
    expect(badPriority.body.error.code).toBe('VALIDATION_ERROR');

    const missingOwner = await patchOwner(staffAgent, ticket.id, {});
    expect(missingOwner.status).toBe(400);
    expect(missingOwner.body.error.code).toBe('VALIDATION_ERROR');

    const row = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(row).toEqual(ticket); // every rejection left the Ticket untouched

    const ok = await patchPriority(staffAgent, ticket.id, { itPriority: 'Low' });
    expect(ok.status).toBe(200);
    expect(ok.body.ticket.itPriority).toBe('Low');
    expect(ok.body.ticket.version).toBe(ticket.version + 1);
  });

  it('WF-13: statusGroup=active filters both list endpoints; unknown value and statusGroup+status are 400', async () => {
    await createTicket('New', '[WF-13-active]');
    await createTicket('Reopened', '[WF-13-active]');
    await createTicket('Closed', '[WF-13-closed]');
    await createTicket('Cancelled', '[WF-13-cancelled]');
    const token = encodeURIComponent('[WF-13');

    const staffActive = await staffAgent.get(`/api/staff/tickets?search=${token}&statusGroup=active&pageSize=100`);
    expect(staffActive.status).toBe(200);
    const staffStatuses = (staffActive.body.tickets as Array<{ summary: string; status: string }>)
      .filter((t) => t.summary.startsWith(SUMMARY_PREFIX))
      .map((t) => t.status);
    expect(staffStatuses.sort()).toEqual(['New', 'Reopened']);
    expect(staffActive.body.tickets.every((t: { status: string }) => ACTIVE_STATUSES.includes(t.status))).toBe(true);

    const requesterActive = await requesterAgent.get(`/api/tickets?search=${token}&statusGroup=active&pageSize=100`);
    expect(requesterActive.status).toBe(200);
    const requesterStatuses = (requesterActive.body.tickets as Array<{ summary: string; status: string }>)
      .filter((t) => t.summary.startsWith(SUMMARY_PREFIX))
      .map((t) => t.status);
    expect(requesterStatuses.sort()).toEqual(['New', 'Reopened']);

    const staffUnknown = await staffAgent.get(`/api/staff/tickets?statusGroup=bogus`);
    expect(staffUnknown.status).toBe(400);
    expect(staffUnknown.body.error.code).toBe('INVALID_QUERY_PARAMETER');

    const requesterUnknown = await requesterAgent.get(`/api/tickets?statusGroup=bogus`);
    expect(requesterUnknown.status).toBe(400);
    expect(requesterUnknown.body.error.code).toBe('INVALID_QUERY_PARAMETER');

    const staffCombined = await staffAgent.get(`/api/staff/tickets?statusGroup=active&status=New`);
    expect(staffCombined.status).toBe(400);
    expect(staffCombined.body.error.code).toBe('INVALID_QUERY_PARAMETER');

    const requesterCombined = await requesterAgent.get(`/api/tickets?statusGroup=active&status=New`);
    expect(requesterCombined.status).toBe(400);
    expect(requesterCombined.body.error.code).toBe('INVALID_QUERY_PARAMETER');

    // Existing query behaviour is unchanged when statusGroup is not used.
    const staffByStatus = await staffAgent.get(`/api/staff/tickets?search=${token}&status=Closed&pageSize=100`);
    expect(staffByStatus.status).toBe(200);
    const closedOnly = (staffByStatus.body.tickets as Array<{ summary: string; status: string }>)
      .filter((t) => t.summary.startsWith(SUMMARY_PREFIX));
    expect(closedOnly.map((t) => t.status)).toEqual(['Closed']);
  });
});

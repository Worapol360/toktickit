/**
 * API-01 … API-16: Actions Taken (Lab 4, Issue 2)
 * AC-01 … AC-11, AC-15 (Actions rows), AC-23
 * Every fixture is created with a unique ticket number and removed with a
 * summary-scoped delete in beforeEach/afterEach (never unscoped).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { app } from '../../src/server.js';
import prisma from '../../src/prisma.js';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const localPasswordHash = '$2b$12$MvQuSTNtpiuJmfaKc7j0Nu0FipBQuY31F6ojkIMWw2OMTZoK5lUkq';
const SUMMARY_PREFIX = '[A4-ACTIONS]';

function agentFor(email: string) {
  const agent = request.agent(app);
  const ready = agent
    .post('/api/auth/login')
    .set('X-Requested-With', 'XMLHttpRequest')
    .send({ email, password: 'LocalOnly1!' });
  return { agent, ready };
}

const csrf = 'X-Requested-With';

function validCreateBody(overrides: Record<string, unknown> = {}) {
  return {
    description: 'Remapped the Finance share on the user laptop.',
    result: 'Drive reachable after remap; waiting for user confirmation.',
    ...overrides
  };
}

describe('Actions Taken API (API-01 to API-16)', () => {
  let catId: number;
  let sysId: number;
  let requester1: { id: number; email: string };
  let requester2: { id: number; email: string };
  let staffA: { id: number; email: string };
  let staffB: { id: number; email: string };
  let adminUser: { id: number; email: string };

  async function cleanupFixtures() {
    await prisma.actionTaken.deleteMany({
      where: { ticket: { summary: { startsWith: SUMMARY_PREFIX } } }
    });
    await prisma.ticket.deleteMany({
      where: { summary: { startsWith: SUMMARY_PREFIX } }
    });
  }

  beforeEach(async () => {
    const cat = await prisma.category.findFirst({ where: { isActive: true } });
    const sys = await prisma.relatedSystem.findFirst({ where: { isActive: true } });
    if (!cat || !sys) {
      throw new Error('Test database is missing required seed categories/systems');
    }
    catId = cat.id;
    sysId = sys.id;

    const u1 = await prisma.user.upsert({
      where: { emailNormalized: 'a4t_req1@example.com' },
      update: { name: 'A4 Requester 1', role: 'REQUESTER', department: 'Support', passwordHash: localPasswordHash, mustChangePassword: false, isActive: true },
      create: {
        name: 'A4 Requester 1',
        email: 'a4t_req1@example.com',
        emailNormalized: 'a4t_req1@example.com',
        department: 'Support',
        role: 'REQUESTER',
        passwordHash: localPasswordHash,
        mustChangePassword: false,
        isActive: true
      }
    });
    const u2 = await prisma.user.upsert({
      where: { emailNormalized: 'a4t_req2@example.com' },
      update: { name: 'A4 Requester 2', role: 'REQUESTER', department: 'Operations', passwordHash: localPasswordHash, mustChangePassword: false, isActive: true },
      create: {
        name: 'A4 Requester 2',
        email: 'a4t_req2@example.com',
        emailNormalized: 'a4t_req2@example.com',
        department: 'Operations',
        role: 'REQUESTER',
        passwordHash: localPasswordHash,
        mustChangePassword: false,
        isActive: true
      }
    });
    const uA = await prisma.user.upsert({
      where: { emailNormalized: 'a4t_staff_a@example.com' },
      update: { name: 'A4 Staff A', role: 'IT_STAFF', department: 'IT', passwordHash: localPasswordHash, mustChangePassword: false, isActive: true },
      create: {
        name: 'A4 Staff A',
        email: 'a4t_staff_a@example.com',
        emailNormalized: 'a4t_staff_a@example.com',
        department: 'IT',
        role: 'IT_STAFF',
        passwordHash: localPasswordHash,
        mustChangePassword: false,
        isActive: true
      }
    });
    const uB = await prisma.user.upsert({
      where: { emailNormalized: 'a4t_staff_b@example.com' },
      update: { name: 'A4 Staff B', role: 'IT_STAFF', department: 'IT', passwordHash: localPasswordHash, mustChangePassword: false, isActive: true },
      create: {
        name: 'A4 Staff B',
        email: 'a4t_staff_b@example.com',
        emailNormalized: 'a4t_staff_b@example.com',
        department: 'IT',
        role: 'IT_STAFF',
        passwordHash: localPasswordHash,
        mustChangePassword: false,
        isActive: true
      }
    });
    const uAdm = await prisma.user.upsert({
      where: { emailNormalized: 'a4t_admin@example.com' },
      update: { name: 'A4 Admin', role: 'ADMINISTRATOR', department: 'IT', passwordHash: localPasswordHash, mustChangePassword: false, isActive: true },
      create: {
        name: 'A4 Admin',
        email: 'a4t_admin@example.com',
        emailNormalized: 'a4t_admin@example.com',
        department: 'IT',
        role: 'ADMINISTRATOR',
        passwordHash: localPasswordHash,
        mustChangePassword: false,
        isActive: true
      }
    });

    requester1 = { id: u1.id, email: u1.email };
    requester2 = { id: u2.id, email: u2.email };
    staffA = { id: uA.id, email: uA.email };
    staffB = { id: uB.id, email: uB.email };
    adminUser = { id: uAdm.id, email: uAdm.email };

    await cleanupFixtures();
  });

  afterEach(async () => {
    await cleanupFixtures();
  });

  async function createTicket(opts: {
    summary?: string;
    status?: string;
    requesterId?: number;
    ownerId?: number | null;
    itPriority?: string | null;
    requesterMarkedResolved?: boolean;
    withResolvedAt?: boolean;
  } = {}) {
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: `TICK-TEST-A4-${randomUUID().slice(0, 12)}`,
        summary: `${SUMMARY_PREFIX} ${opts.summary ?? 'Fixture ticket'}`,
        description: 'Fixture ticket for the Lab 4 Actions Taken API tests.',
        requestedPriority: 'Medium',
        itPriority: opts.itPriority === undefined ? 'Medium' : opts.itPriority,
        status: opts.status ?? 'New',
        requesterMarkedResolved: opts.requesterMarkedResolved ?? false,
        requesterId: opts.requesterId ?? requester1.id,
        ownerId: opts.ownerId === undefined ? staffA.id : opts.ownerId,
        categoryId: catId,
        relatedSystemId: sysId
      }
    });
    if (opts.withResolvedAt) {
      await prisma.ticket.update({ where: { id: ticket.id }, data: { resolvedAt: ticket.updatedAt } });
    }
    return ticket;
  }

  function postAction(agent: request.SuperAgentTest, ticketId: number, body: Record<string, unknown>) {
    return agent
      .post(`/api/staff/tickets/${ticketId}/actions-taken`)
      .set(csrf, 'XMLHttpRequest')
      .send(body);
  }

  function patchAction(agent: request.SuperAgentTest, ticketId: number, actionId: number, body: Record<string, unknown>) {
    return agent
      .patch(`/api/staff/tickets/${ticketId}/actions-taken/${actionId}`)
      .set(csrf, 'XMLHttpRequest')
      .send(body);
  }

  // API-01
  it('API-01: creates a valid Action with the session user as performer and version 1', async () => {
    const { agent, ready } = agentFor(staffA.email);
    await ready;
    const ticket = await createTicket({ summary: 'API-01 valid create', requesterId: requester1.id });

    const res = await postAction(agent, ticket.id, validCreateBody({
      attachmentNotes: 'See screenshot share-error.png on the ticket.'
    }));

    expect(res.status).toBe(201);
    const action = res.body.actionTaken;
    expect(action).toBeDefined();
    expect(action.ticketId).toBe(ticket.id);
    expect(action.performedBy).toEqual({ id: staffA.id, name: 'A4 Staff A' });
    expect(action.updatedBy).toEqual({ id: staffA.id, name: 'A4 Staff A' });
    expect(action.version).toBe(1);
    expect(action.description).toBe('Remapped the Finance share on the user laptop.');
    expect(action.result).toBe('Drive reachable after remap; waiting for user confirmation.');
    expect(action.followUpRequired).toBe(false);
    expect(action.followUpNote).toBeNull();
    expect(action.followUpCompletedAt).toBeNull();
    expect(action.attachmentNotes).toBe('See screenshot share-error.png on the ticket.');
    expect(action.clientRequestId).toBeUndefined();
    expect(typeof action.actionAt).toBe('string');
    expect(typeof action.createdAt).toBe('string');
    expect(typeof action.updatedAt).toBe('string');

    const row = await prisma.actionTaken.findUnique({ where: { id: action.id } });
    expect(row).not.toBeNull();
    expect(row!.ticketId).toBe(ticket.id);
    expect(row!.performedById).toBe(staffA.id);
    expect(row!.updatedById).toBe(staffA.id);
    expect(row!.version).toBe(1);
  });

  // API-02
  it('API-02: Staff B creates on Staff A ticket and on an unassigned ticket; owner unchanged', async () => {
    const { agent, ready } = agentFor(staffB.email);
    await ready;

    const owned = await createTicket({ summary: 'API-02 owned by staff A', ownerId: staffA.id, requesterId: requester1.id });
    const ownedRes = await postAction(agent, owned.id, validCreateBody());
    expect(ownedRes.status).toBe(201);
    expect(ownedRes.body.actionTaken.performedBy).toEqual({ id: staffB.id, name: 'A4 Staff B' });

    const ownerAfter = await prisma.ticket.findUnique({ where: { id: owned.id }, select: { ownerId: true, status: true } });
    expect(ownerAfter!.ownerId).toBe(staffA.id);

    const unassigned = await createTicket({ summary: 'API-02 unassigned', ownerId: null, requesterId: requester2.id });
    const unassignedRes = await postAction(agent, unassigned.id, validCreateBody());
    expect(unassignedRes.status).toBe(201);
    expect(unassignedRes.body.actionTaken.performedBy).toEqual({ id: staffB.id, name: 'A4 Staff B' });

    const unassignedAfter = await prisma.ticket.findUnique({ where: { id: unassigned.id }, select: { ownerId: true } });
    expect(unassignedAfter!.ownerId).toBeNull();
  });

  // API-03
  it('API-03: ignores client-supplied performedById/performedBy/version; updatedBy follows the editor', async () => {
    const { agent: staffAAgent, ready: readyA } = agentFor(staffA.email);
    await readyA;
    const { agent: staffBAgent, ready: readyB } = agentFor(staffB.email);
    await readyB;
    const ticket = await createTicket({ summary: 'API-03 identity ignored', ownerId: staffA.id });

    const createRes = await postAction(staffAAgent, ticket.id, validCreateBody({
      performedById: requester1.id,
      performedBy: { id: requester1.id, name: 'Not The Session User' },
      updatedById: requester1.id,
      version: 42,
      followUpCompletedAt: '2026-10-21T00:00:00.000Z'
    }));
    expect(createRes.status).toBe(201);
    const created = createRes.body.actionTaken;
    expect(created.performedBy).toEqual({ id: staffA.id, name: 'A4 Staff A' });
    expect(created.version).toBe(1);
    expect(created.followUpCompletedAt).toBeNull();

    const editRes = await patchAction(staffBAgent, ticket.id, created.id, {
      expectedVersion: 1,
      result: 'Drive reachable; user confirmed access.'
    });
    expect(editRes.status).toBe(200);
    const edited = editRes.body.actionTaken;
    expect(edited.performedBy).toEqual({ id: staffA.id, name: 'A4 Staff A' });
    expect(edited.updatedBy).toEqual({ id: staffB.id, name: 'A4 Staff B' });
    expect(edited.version).toBe(2);

    const row = await prisma.actionTaken.findUnique({ where: { id: created.id } });
    expect(row!.performedById).toBe(staffA.id);
    expect(row!.updatedById).toBe(staffB.id);
    expect(row!.version).toBe(2);
  });

  // API-04
  it('API-04: rejects invalid payloads with field errors and creates no row', async () => {
    const { agent, ready } = agentFor(staffA.email);
    await ready;
    const ticket = await createTicket({ summary: 'API-04 validation', ownerId: staffA.id });

    const attempts: Array<Record<string, unknown>> = [
      { description: 'Abc', result: 'ok result' },
      { description: 'd'.repeat(2001), result: 'ok result' },
      { result: 'ok result' },
      { description: 'valid description' },
      { description: 'valid description', result: 'x' },
      { description: 'valid description', result: 'ok result', actionAt: 'not-a-date' },
      { description: 'valid description', result: 'ok result', actionAt: '2020-01-01T00:00:00.000Z' },
      { description: 'valid description', result: 'ok result', actionAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() },
      { description: 'valid description', result: 'ok result', followUpRequired: true },
      { description: 'valid description', result: 'ok result', followUpRequired: true, followUpNote: 'abcd' },
      { description: 'valid description', result: 'ok result', attachmentNotes: 'x'.repeat(501) }
    ];
    const expectedKeys = [
      'description',
      'description',
      'description',
      'result',
      'result',
      'actionAt',
      'actionAt',
      'actionAt',
      'followUpNote',
      'followUpNote',
      'attachmentNotes'
    ];

    for (const [index, body] of attempts.entries()) {
      const res = await postAction(agent, ticket.id, body);
      expect(res.status, `attempt ${index} should be 400`).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.fields, `attempt ${index}`).toHaveProperty(expectedKeys[index]);
    }

    const count = await prisma.actionTaken.count({ where: { ticketId: ticket.id } });
    expect(count).toBe(0);
  });

  // API-05
  it('API-05: stores null note and completion when followUpRequired is false even if supplied', async () => {
    const { agent, ready } = agentFor(staffA.email);
    await ready;
    const ticket = await createTicket({ summary: 'API-05 note discarded', ownerId: staffA.id });

    const res = await postAction(agent, ticket.id, validCreateBody({
      followUpRequired: false,
      followUpNote: 'This note must not be stored anywhere.',
      followUpCompletedAt: '2026-10-21T00:00:00.000Z'
    }));

    expect(res.status).toBe(201);
    expect(res.body.actionTaken.followUpRequired).toBe(false);
    expect(res.body.actionTaken.followUpNote).toBeNull();
    expect(res.body.actionTaken.followUpCompletedAt).toBeNull();

    const row = await prisma.actionTaken.findUnique({ where: { id: res.body.actionTaken.id } });
    expect(row!.followUpNote).toBeNull();
    expect(row!.followUpCompletedAt).toBeNull();
  });

  // API-06
  it('API-06: blocks Requester/anonymous/missing-CSRF writes without changing any row', async () => {
    const ticket = await createTicket({ summary: 'API-06 access denied', requesterId: requester1.id, ownerId: staffA.id });
    const before = await prisma.actionTaken.count({ where: { ticketId: ticket.id } });

    const req = agentFor(requester1.email);
    await req.ready;
    const requesterCreate = await postAction(req.agent, ticket.id, validCreateBody());
    expect(requesterCreate.status).toBe(403);
    expect(requesterCreate.body.error.code).toBe('FORBIDDEN');

    const requesterUpdateTarget = await prisma.actionTaken.findFirst({ where: { ticketId: ticket.id } });
    const requesterPatch = await patchAction(req.agent, ticket.id, requesterUpdateTarget?.id ?? 1, {
      expectedVersion: 1,
      result: 'Requester must never edit this.'
    });
    expect(requesterPatch.status).toBe(403);
    expect(requesterPatch.body.error.code).toBe('FORBIDDEN');

    const anonymousCreate = await request(app)
      .post(`/api/staff/tickets/${ticket.id}/actions-taken`)
      .set(csrf, 'XMLHttpRequest')
      .send(validCreateBody());
    expect(anonymousCreate.status).toBe(401);
    expect(anonymousCreate.body.error.code).toBe('UNAUTHENTICATED');

    const anonymousPatch = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/actions-taken/1`)
      .set(csrf, 'XMLHttpRequest')
      .send({ expectedVersion: 1, result: 'Anonymous must never edit.' });
    expect(anonymousPatch.status).toBe(401);
    expect(anonymousPatch.body.error.code).toBe('UNAUTHENTICATED');

    const staff = agentFor(staffA.email);
    await staff.ready;
    const noCsrfCreate = await staff.agent
      .post(`/api/staff/tickets/${ticket.id}/actions-taken`)
      .send(validCreateBody());
    expect(noCsrfCreate.status).toBe(403);
    expect(noCsrfCreate.body.error.code).toBe('CSRF_CHECK_FAILED');

    const noCsrfPatch = await staff.agent
      .patch(`/api/staff/tickets/${ticket.id}/actions-taken/1`)
      .send({ expectedVersion: 1, result: 'Missing header must never apply.' });
    expect(noCsrfPatch.status).toBe(403);
    expect(noCsrfPatch.body.error.code).toBe('CSRF_CHECK_FAILED');

    const after = await prisma.actionTaken.count({ where: { ticketId: ticket.id } });
    expect(after).toBe(before);
  });

  // API-07
  it('API-07: Requester lists all Actions of their own ticket; another Requester gets 404', async () => {
    const staff = agentFor(staffA.email);
    await staff.ready;
    const ticket = await createTicket({ summary: 'API-07 requester read', requesterId: requester1.id, ownerId: staffA.id });

    const first = await postAction(staff.agent, ticket.id, validCreateBody({
      followUpRequired: true,
      followUpNote: 'Confirm with the user after restart tomorrow.',
      attachmentNotes: 'See screenshot share-error.png.'
    }));
    expect(first.status).toBe(201);
    const second = await postAction(staff.agent, ticket.id, validCreateBody({
      description: 'Validated the remapped share from a second workstation.',
      result: 'Share reachable from both workstations.'
    }));
    expect(second.status).toBe(201);

    const owner = agentFor(requester1.email);
    await owner.ready;
    const ownList = await owner.agent.get(`/api/tickets/${ticket.id}/actions-taken`);
    expect(ownList.status).toBe(200);
    expect(ownList.body.actionsTaken).toHaveLength(2);
    const action = ownList.body.actionsTaken[0];
    expect(action.description).toBe('Remapped the Finance share on the user laptop.');
    expect(action.result).toBe('Drive reachable after remap; waiting for user confirmation.');
    expect(action.followUpNote).toBe('Confirm with the user after restart tomorrow.');
    expect(action.attachmentNotes).toBe('See screenshot share-error.png.');
    expect(action.performedBy).toEqual({ id: staffA.id, name: 'A4 Staff A' });
    expect(action.updatedBy).toEqual({ id: staffA.id, name: 'A4 Staff A' });
    expect(action.clientRequestId).toBeUndefined();

    const other = agentFor(requester2.email);
    await other.ready;
    const otherList = await other.agent.get(`/api/tickets/${ticket.id}/actions-taken`);
    expect(otherList.status).toBe(404);
    expect(otherList.body.error.code).toBe('TICKET_NOT_FOUND');
  });

  // API-08
  it('API-08: PATCH with the correct expectedVersion bumps version, sets updatedBy, and touches Ticket updatedAt', async () => {
    const staff = agentFor(staffA.email);
    await staff.ready;
    const ticket = await createTicket({ summary: 'API-08 successful update', ownerId: staffA.id });

    const created = await postAction(staff.agent, ticket.id, validCreateBody());
    expect(created.status).toBe(201);
    const actionId = created.body.actionTaken.id;
    expect(created.body.actionTaken.createdAt).toBe(created.body.actionTaken.updatedAt);

    const staleTicketUpdatedAt = new Date(Date.now() - 60_000);
    await prisma.ticket.update({ where: { id: ticket.id }, data: { updatedAt: staleTicketUpdatedAt } });

    const res = await patchAction(staff.agent, ticket.id, actionId, {
      expectedVersion: 1,
      result: 'Drive reachable; user confirmed access.'
    });

    expect(res.status).toBe(200);
    const updated = res.body.actionTaken;
    expect(updated.version).toBe(2);
    expect(updated.updatedBy).toEqual({ id: staffA.id, name: 'A4 Staff A' });
    expect(updated.performedBy).toEqual({ id: staffA.id, name: 'A4 Staff A' });
    expect(updated.result).toBe('Drive reachable; user confirmed access.');
    expect(updated.description).toBe('Remapped the Finance share on the user laptop.');
    expect(updated.createdAt).toBe(created.body.actionTaken.createdAt);
    expect(updated.actionAt).toBe(created.body.actionTaken.actionAt);

    const ticketRow = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(ticketRow!.updatedAt.getTime()).toBeGreaterThan(staleTicketUpdatedAt.getTime());
    expect(ticketRow!.version).toBe(1);
  });

  // API-09
  it('API-09: stale expectedVersion returns 409 VERSION_CONFLICT with details.currentVersion; missing returns 400', async () => {
    const staff = agentFor(staffA.email);
    await staff.ready;
    const ticket = await createTicket({ summary: 'API-09 conflict', ownerId: staffA.id });

    const created = await postAction(staff.agent, ticket.id, validCreateBody());
    expect(created.status).toBe(201);
    const actionId = created.body.actionTaken.id;

    const missing = await patchAction(staff.agent, ticket.id, actionId, {
      result: 'Updated without a version.'
    });
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe('VALIDATION_ERROR');
    expect(missing.body.error.fields).toHaveProperty('expectedVersion');

    const first = await patchAction(staff.agent, ticket.id, actionId, {
      expectedVersion: 1,
      result: 'First successful update text.'
    });
    expect(first.status).toBe(200);
    expect(first.body.actionTaken.version).toBe(2);

    const stale = await patchAction(staff.agent, ticket.id, actionId, {
      expectedVersion: 1,
      result: 'Second update attempted from stale data.'
    });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('VERSION_CONFLICT');
    expect(stale.body.error.details).toEqual({ currentVersion: 2 });

    const row = await prisma.actionTaken.findUnique({ where: { id: actionId } });
    expect(row!.version).toBe(2);
    expect(row!.result).toBe('First successful update text.');
  });

  // API-10
  it('API-10: list order stays createdAt ASC, id ASC after editing actionAt; DELETE returns 404 and keeps the row', async () => {
    const staff = agentFor(staffA.email);
    await staff.ready;
    const ticket = await createTicket({ summary: 'API-10 stable order', ownerId: staffA.id });

    const a1 = await postAction(staff.agent, ticket.id, validCreateBody({
      description: 'First recorded action on the ticket.',
      result: 'First result recorded.'
    }));
    const a2 = await postAction(staff.agent, ticket.id, validCreateBody({
      description: 'Second recorded action on the ticket.',
      result: 'Second result recorded.'
    }));
    const a3 = await postAction(staff.agent, ticket.id, validCreateBody({
      description: 'Third recorded action on the ticket.',
      result: 'Third result recorded.'
    }));
    expect([a1.status, a2.status, a3.status]).toEqual([201, 201, 201]);
    const ids = [a1.body.actionTaken.id, a2.body.actionTaken.id, a3.body.actionTaken.id];

    const earlyActionAt = (await prisma.ticket.findUnique({ where: { id: ticket.id } }))!.createdAt.toISOString();
    const edited = await patchAction(staff.agent, ticket.id, ids[1], {
      expectedVersion: 1,
      actionAt: earlyActionAt
    });
    expect(edited.status).toBe(200);
    expect(edited.body.actionTaken.actionAt).toBe(earlyActionAt);

    const list = await staff.agent.get(`/api/tickets/${ticket.id}/actions-taken`);
    expect(list.status).toBe(200);
    expect(list.body.actionsTaken.map((action: { id: number }) => action.id)).toEqual(ids);

    const del = await staff.agent
      .delete(`/api/staff/tickets/${ticket.id}/actions-taken/${ids[0]}`)
      .set(csrf, 'XMLHttpRequest');
    expect(del.status).toBe(404);

    const remaining = await prisma.actionTaken.findMany({ where: { ticketId: ticket.id }, select: { id: true } });
    expect(remaining.map((row) => row.id).sort((x, y) => x - y)).toEqual([...ids].sort((x, y) => x - y));
  });

  // API-11
  it('API-11: create/update on Resolved, Closed, Cancelled tickets return 409 TICKET_ACTIONS_LOCKED; reads work', async () => {
    const staff = agentFor(staffA.email);
    await staff.ready;

    for (const status of ['Resolved', 'Closed', 'Cancelled']) {
      const locked = await createTicket({ summary: `API-11 locked create ${status}`, status, ownerId: staffA.id });
      const res = await postAction(staff.agent, locked.id, validCreateBody());
      expect(res.status, `create while ${status}`).toBe(409);
      expect(res.body.error.code).toBe('TICKET_ACTIONS_LOCKED');

      const list = await staff.agent.get(`/api/tickets/${locked.id}/actions-taken`);
      expect(list.status, `list while ${status}`).toBe(200);
      expect(list.body.actionsTaken).toEqual([]);
      expect(list.body.summary).toEqual({ total: 0, openFollowUps: 0 });
    }

    const ticket = await createTicket({ summary: 'API-11 locked update', ownerId: staffA.id });
    const created = await postAction(staff.agent, ticket.id, validCreateBody());
    expect(created.status).toBe(201);
    const actionId = created.body.actionTaken.id;

    for (const status of ['Resolved', 'Closed', 'Cancelled']) {
      await prisma.ticket.update({ where: { id: ticket.id }, data: { status } });
      const res = await patchAction(staff.agent, ticket.id, actionId, {
        expectedVersion: 1,
        result: 'Attempted edit while the ticket is locked.'
      });
      expect(res.status, `update while ${status}`).toBe(409);
      expect(res.body.error.code).toBe('TICKET_ACTIONS_LOCKED');

      const list = await staff.agent.get(`/api/tickets/${ticket.id}/actions-taken`);
      expect(list.status, `list while ${status}`).toBe(200);
      expect(list.body.actionsTaken).toHaveLength(1);
    }

    const row = await prisma.actionTaken.findUnique({ where: { id: actionId } });
    expect(row!.version).toBe(1);
    expect(row!.result).toBe('Drive reachable after remap; waiting for user confirmation.');
  });

  // API-12
  it('API-12: the same clientRequestId twice creates exactly one Action; the second returns 200', async () => {
    const staff = agentFor(staffA.email);
    await staff.ready;

    const sequentialTicket = await createTicket({ summary: 'API-12 sequential retry', ownerId: staffA.id });
    const clientRequestId = randomUUID();
    const first = await postAction(staff.agent, sequentialTicket.id, validCreateBody({ clientRequestId }));
    expect(first.status).toBe(201);
    const retry = await postAction(staff.agent, sequentialTicket.id, validCreateBody({ clientRequestId }));
    expect(retry.status).toBe(200);
    expect(retry.body.actionTaken.id).toBe(first.body.actionTaken.id);
    expect(await prisma.actionTaken.count({ where: { ticketId: sequentialTicket.id } })).toBe(1);
    expect(await prisma.actionTaken.count({
      where: { ticketId: sequentialTicket.id, clientRequestId }
    })).toBe(1);

    const parallelTicket = await createTicket({ summary: 'API-12 simultaneous requests', ownerId: staffA.id });
    const parallelKey = randomUUID();
    const [res1, res2] = await Promise.all([
      postAction(staff.agent, parallelTicket.id, validCreateBody({ clientRequestId: parallelKey })),
      postAction(staff.agent, parallelTicket.id, validCreateBody({ clientRequestId: parallelKey }))
    ]);
    expect([res1.status, res2.status].sort()).toEqual([200, 201]);
    expect(res1.body.actionTaken.id).toBe(res2.body.actionTaken.id);
    expect(await prisma.actionTaken.count({ where: { ticketId: parallelTicket.id } })).toBe(1);
    expect(await prisma.actionTaken.count({
      where: { ticketId: parallelTicket.id, clientRequestId: parallelKey }
    })).toBe(1);
  });

  // API-13
  it('API-13: followUpCompleted sets and clears followUpCompletedAt; rejected when no follow-up is required', async () => {
    const staff = agentFor(staffA.email);
    await staff.ready;

    const ticket = await createTicket({ summary: 'API-13 follow-up completion', ownerId: staffA.id });
    const created = await postAction(staff.agent, ticket.id, validCreateBody({
      followUpRequired: true,
      followUpNote: 'Confirm with the user after restart tomorrow.'
    }));
    expect(created.status).toBe(201);
    const actionId = created.body.actionTaken.id;

    const completed = await patchAction(staff.agent, ticket.id, actionId, {
      expectedVersion: 1,
      followUpCompleted: true
    });
    expect(completed.status).toBe(200);
    expect(completed.body.actionTaken.followUpCompletedAt).not.toBeNull();
    expect(completed.body.actionTaken.version).toBe(2);

    const cleared = await patchAction(staff.agent, ticket.id, actionId, {
      expectedVersion: 2,
      followUpCompleted: false
    });
    expect(cleared.status).toBe(200);
    expect(cleared.body.actionTaken.followUpCompletedAt).toBeNull();
    expect(cleared.body.actionTaken.version).toBe(3);

    const plain = await postAction(staff.agent, ticket.id, validCreateBody({
      description: 'Plain action without any follow-up requirement.',
      result: 'Nothing pending afterwards.'
    }));
    expect(plain.status).toBe(201);
    const rejected = await patchAction(staff.agent, ticket.id, plain.body.actionTaken.id, {
      expectedVersion: 1,
      followUpCompleted: true
    });
    expect(rejected.status).toBe(400);
    expect(rejected.body.error.code).toBe('VALIDATION_ERROR');
    expect(rejected.body.error.fields).toHaveProperty('followUpCompleted');

    const row = await prisma.actionTaken.findUnique({ where: { id: plain.body.actionTaken.id } });
    expect(row!.followUpCompletedAt).toBeNull();
    expect(row!.version).toBe(1);
  });

  // API-14
  it('API-14: list summary reports total and openFollowUps for zero, one, and many Actions', async () => {
    const staff = agentFor(staffA.email);
    await staff.ready;
    const ticket = await createTicket({ summary: 'API-14 summary', ownerId: staffA.id });

    const empty = await staff.agent.get(`/api/tickets/${ticket.id}/actions-taken`);
    expect(empty.status).toBe(200);
    expect(empty.body.summary).toEqual({ total: 0, openFollowUps: 0 });

    const first = await postAction(staff.agent, ticket.id, validCreateBody());
    expect(first.status).toBe(201);
    const one = await staff.agent.get(`/api/tickets/${ticket.id}/actions-taken`);
    expect(one.body.summary).toEqual({ total: 1, openFollowUps: 0 });

    const second = await postAction(staff.agent, ticket.id, validCreateBody({
      description: 'Second action carrying an open follow-up.',
      result: 'Follow-up still pending with the user.',
      followUpRequired: true,
      followUpNote: 'Re-check access after the reboot window.'
    }));
    expect(second.status).toBe(201);
    const two = await staff.agent.get(`/api/tickets/${ticket.id}/actions-taken`);
    expect(two.body.summary).toEqual({ total: 2, openFollowUps: 1 });

    const completed = await patchAction(staff.agent, ticket.id, second.body.actionTaken.id, {
      expectedVersion: 1,
      followUpCompleted: true
    });
    expect(completed.status).toBe(200);
    const twoDone = await staff.agent.get(`/api/tickets/${ticket.id}/actions-taken`);
    expect(twoDone.body.summary).toEqual({ total: 2, openFollowUps: 0 });

    const third = await postAction(staff.agent, ticket.id, validCreateBody({
      description: 'Third action with another open follow-up.',
      result: 'Second follow-up opened for verification.',
      followUpRequired: true,
      followUpNote: 'Verify the shared drive mapping once more.'
    }));
    expect(third.status).toBe(201);
    const three = await staff.agent.get(`/api/tickets/${ticket.id}/actions-taken`);
    expect(three.body.summary).toEqual({ total: 3, openFollowUps: 1 });
  });

  // API-15
  it('API-15: legacy Ticket with zero Actions returns 200 with [] and {0,0}; detail endpoints unaffected', async () => {
    const legacy = await createTicket({
      summary: 'API-15 legacy ticket',
      status: 'Resolved',
      requesterId: requester1.id,
      ownerId: staffA.id,
      withResolvedAt: true
    });

    const requester = agentFor(requester1.email);
    await requester.ready;
    const list = await requester.agent.get(`/api/tickets/${legacy.id}/actions-taken`);
    expect(list.status).toBe(200);
    expect(list.body.actionsTaken).toEqual([]);
    expect(list.body.summary).toEqual({ total: 0, openFollowUps: 0 });

    const detail = await requester.agent.get(`/api/tickets/${legacy.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.ticket.id).toBe(legacy.id);

    const staff = agentFor(staffA.email);
    await staff.ready;
    const staffDetail = await staff.agent.get(`/api/staff/tickets/${legacy.id}`);
    expect(staffDetail.status).toBe(200);
    expect(staffDetail.body.ticket.id).toBe(legacy.id);
    expect(staffDetail.body.comments).toEqual([]);
    expect(staffDetail.body.notes).toEqual([]);
  });

  // API-16
  it('API-16: bad ids return 400 INVALID_*_ID and actions of another ticket return 404 ACTION_NOT_FOUND', async () => {
    const staff = agentFor(staffA.email);
    await staff.ready;
    const ticket = await createTicket({ summary: 'API-16 target ticket', ownerId: staffA.id });
    const otherTicket = await createTicket({ summary: 'API-16 other ticket', ownerId: staffA.id });

    const created = await postAction(staff.agent, ticket.id, validCreateBody());
    expect(created.status).toBe(201);
    const actionId = created.body.actionTaken.id;

    const badTicketId = await staff.agent.get('/api/tickets/abc/actions-taken');
    expect(badTicketId.status).toBe(400);
    expect(badTicketId.body.error.code).toBe('INVALID_TICKET_ID');

    const zeroTicketId = await staff.agent.get('/api/tickets/0/actions-taken');
    expect(zeroTicketId.status).toBe(400);
    expect(zeroTicketId.body.error.code).toBe('INVALID_TICKET_ID');

    const missingTicket = await staff.agent.get('/api/tickets/99999999/actions-taken');
    expect(missingTicket.status).toBe(404);
    expect(missingTicket.body.error.code).toBe('TICKET_NOT_FOUND');

    const badStaffTicketId = await staff.agent
      .post('/api/staff/tickets/abc/actions-taken')
      .set(csrf, 'XMLHttpRequest')
      .send(validCreateBody());
    expect(badStaffTicketId.status).toBe(400);
    expect(badStaffTicketId.body.error.code).toBe('INVALID_TICKET_ID');

    const missingStaffTicket = await postAction(staff.agent, 99999999, validCreateBody());
    expect(missingStaffTicket.status).toBe(404);
    expect(missingStaffTicket.body.error.code).toBe('TICKET_NOT_FOUND');

    const badActionId = await staff.agent
      .patch(`/api/staff/tickets/${ticket.id}/actions-taken/abc`)
      .set(csrf, 'XMLHttpRequest')
      .send({ expectedVersion: 1, result: 'Attempted edit with a bad id.' });
    expect(badActionId.status).toBe(400);
    expect(badActionId.body.error.code).toBe('INVALID_ACTION_ID');

    const missingAction = await patchAction(staff.agent, ticket.id, 99999999, {
      expectedVersion: 1,
      result: 'Attempted edit of a missing action.'
    });
    expect(missingAction.status).toBe(404);
    expect(missingAction.body.error.code).toBe('ACTION_NOT_FOUND');

    const foreignAction = await patchAction(staff.agent, otherTicket.id, actionId, {
      expectedVersion: 1,
      result: 'Attempted edit through the wrong ticket.'
    });
    expect(foreignAction.status).toBe(404);
    expect(foreignAction.body.error.code).toBe('ACTION_NOT_FOUND');

    const row = await prisma.actionTaken.findUnique({ where: { id: actionId } });
    expect(row!.version).toBe(1);
    expect(row!.result).toBe('Drive reachable after remap; waiting for user confirmation.');
  });
});

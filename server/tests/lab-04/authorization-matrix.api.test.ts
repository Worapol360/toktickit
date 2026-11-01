/**
 * AUTH-01 (Actions Taken rows of api-spec.md §7) and AUTH-02 (missing CSRF header
 * on every new mutating endpoint) for Lab 4, Issue 2.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { app } from '../../src/server.js';
import prisma from '../../src/prisma.js';
import { restoreUsers, snapshotUsers, trackLoginSession, type FixtureSessionTracker } from './fixture-cleanup.js';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const localPasswordHash = '$2b$12$MvQuSTNtpiuJmfaKc7j0Nu0FipBQuY31F6ojkIMWw2OMTZoK5lUkq';
const SUMMARY_PREFIX = '[A4-AUTH]';
const csrf = 'X-Requested-With';
const FIXTURE_EMAILS = [
  'a4m_req1@example.com',
  'a4m_req2@example.com',
  'a4m_staff@example.com',
  'a4m_staff2@example.com',
  'a4m_admin@example.com',
  'a4m_pwc@example.com'
];
const sessionIds: FixtureSessionTracker = new Set();

function agentFor(email: string) {
  const agent = request.agent(app);
  const ready = agent
    .post('/api/auth/login')
    .set(csrf, 'XMLHttpRequest')
    .send({ email, password: 'LocalOnly1!' })
    .then(async (response) => {
      if (response.status === 200) await trackLoginSession(prisma, response, sessionIds);
      return response;
    });
  return { agent, ready };
}

// Dashboard rows cache their sessions (logged in once in beforeAll): bcrypt
// compares are CPU-only and this file already performs many logins — reuse
// keeps the full suite's CPU load within the budget of Lab 3's 5 s tests.
const dashboardSessions = new Map<string, Promise<request.SuperAgentTest>>();

async function dashboardAgentFor(email: string): Promise<request.SuperAgentTest> {
  const cached = dashboardSessions.get(email);
  if (cached) return cached;
  const login = (async () => {
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
  })();
  dashboardSessions.set(email, login);
  return login;
}

function validCreateBody(overrides: Record<string, unknown> = {}) {
  return {
    description: 'Recorded during the authorization matrix verification.',
    result: 'Matrix row verified for this role.',
    ...overrides
  };
}

describe('Authorization matrix for Actions Taken endpoints (AUTH-01, AUTH-02)', () => {
  let catId: number;
  let sysId: number;
  let ownerRequester: { id: number; email: string };
  let otherRequester: { id: number; email: string };
  let staffUser: { id: number; email: string };
  let adminUser: { id: number; email: string };
  let ticketId: number;
  let userSnapshots: Awaited<ReturnType<typeof snapshotUsers>>;

  async function cleanupFixtures() {
    await prisma.actionTaken.deleteMany({
      where: { ticket: { summary: { startsWith: SUMMARY_PREFIX } } }
    });
    await prisma.ticket.deleteMany({
      where: { summary: { startsWith: SUMMARY_PREFIX } }
    });
  }

  beforeAll(async () => {
    userSnapshots = await snapshotUsers(prisma, FIXTURE_EMAILS);
  });

  beforeEach(async () => {
    const cat = await prisma.category.findFirst({ where: { isActive: true } });
    const sys = await prisma.relatedSystem.findFirst({ where: { isActive: true } });
    if (!cat || !sys) {
      throw new Error('Test database is missing required seed categories/systems');
    }
    catId = cat.id;
    sysId = sys.id;

    const u1 = await prisma.user.upsert({
      where: { emailNormalized: 'a4m_req1@example.com' },
      update: { name: 'A4 Matrix Requester', role: 'REQUESTER', department: 'Support', passwordHash: localPasswordHash, mustChangePassword: false, isActive: true },
      create: {
        name: 'A4 Matrix Requester',
        email: 'a4m_req1@example.com',
        emailNormalized: 'a4m_req1@example.com',
        department: 'Support',
        role: 'REQUESTER',
        passwordHash: localPasswordHash,
        mustChangePassword: false,
        isActive: true
      }
    });
    const u2 = await prisma.user.upsert({
      where: { emailNormalized: 'a4m_req2@example.com' },
      update: { name: 'A4 Matrix Other Requester', role: 'REQUESTER', department: 'Operations', passwordHash: localPasswordHash, mustChangePassword: false, isActive: true },
      create: {
        name: 'A4 Matrix Other Requester',
        email: 'a4m_req2@example.com',
        emailNormalized: 'a4m_req2@example.com',
        department: 'Operations',
        role: 'REQUESTER',
        passwordHash: localPasswordHash,
        mustChangePassword: false,
        isActive: true
      }
    });
    const uStaff = await prisma.user.upsert({
      where: { emailNormalized: 'a4m_staff@example.com' },
      update: { name: 'A4 Matrix Staff', role: 'IT_STAFF', department: 'IT', passwordHash: localPasswordHash, mustChangePassword: false, isActive: true },
      create: {
        name: 'A4 Matrix Staff',
        email: 'a4m_staff@example.com',
        emailNormalized: 'a4m_staff@example.com',
        department: 'IT',
        role: 'IT_STAFF',
        passwordHash: localPasswordHash,
        mustChangePassword: false,
        isActive: true
      }
    });
    const uAdmin = await prisma.user.upsert({
      where: { emailNormalized: 'a4m_admin@example.com' },
      update: { name: 'A4 Matrix Admin', role: 'ADMINISTRATOR', department: 'IT', passwordHash: localPasswordHash, mustChangePassword: false, isActive: true },
      create: {
        name: 'A4 Matrix Admin',
        email: 'a4m_admin@example.com',
        emailNormalized: 'a4m_admin@example.com',
        department: 'IT',
        role: 'ADMINISTRATOR',
        passwordHash: localPasswordHash,
        mustChangePassword: false,
        isActive: true
      }
    });

    ownerRequester = { id: u1.id, email: u1.email };
    otherRequester = { id: u2.id, email: u2.email };
    staffUser = { id: uStaff.id, email: uStaff.email };
    adminUser = { id: uAdmin.id, email: uAdmin.email };

    await cleanupFixtures();

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: `TICK-TEST-A4M-${randomUUID().slice(0, 12)}`,
        summary: `${SUMMARY_PREFIX} Matrix fixture ticket`,
        description: 'Fixture ticket for the Lab 4 authorization matrix.',
        requestedPriority: 'Medium',
        itPriority: 'Medium',
        status: 'Open',
        requesterId: ownerRequester.id,
        ownerId: staffUser.id,
        categoryId: catId,
        relatedSystemId: sysId
      }
    });
    ticketId = ticket.id;
  });

  afterEach(async () => {
    await cleanupFixtures();
  });

  afterAll(async () => {
    await cleanupFixtures();
    await restoreUsers(prisma, FIXTURE_EMAILS, userSnapshots, sessionIds);
  });

  it('AUTH-01: GET /api/tickets/:id/actions-taken matches the role matrix', async () => {
    const url = `/api/tickets/${ticketId}/actions-taken`;
    const owner = agentFor(ownerRequester.email);
    await owner.ready;
    const other = agentFor(otherRequester.email);
    await other.ready;
    const staff = agentFor(staffUser.email);
    await staff.ready;
    const admin = agentFor(adminUser.email);
    await admin.ready;

    const anonymous = await request(app).get(url);
    const asOwner = await owner.agent.get(url);
    const asOther = await other.agent.get(url);
    const asStaff = await staff.agent.get(url);
    const asAdmin = await admin.agent.get(url);

    expect(anonymous.status).toBe(401);
    expect(anonymous.body.error.code).toBe('UNAUTHENTICATED');
    expect(asOwner.status).toBe(200);
    expect(asOther.status).toBe(404);
    expect(asOther.body.error.code).toBe('TICKET_NOT_FOUND');
    expect(asStaff.status).toBe(200);
    expect(asAdmin.status).toBe(200);
    expect(Array.isArray(asStaff.body.actionsTaken)).toBe(true);
  });

  it('AUTH-01: POST /api/staff/tickets/:id/actions-taken matches the role matrix', async () => {
    const url = `/api/staff/tickets/${ticketId}/actions-taken`;
    const owner = agentFor(ownerRequester.email);
    await owner.ready;
    const other = agentFor(otherRequester.email);
    await other.ready;
    const staff = agentFor(staffUser.email);
    await staff.ready;
    const admin = agentFor(adminUser.email);
    await admin.ready;

    const anonymous = await request(app)
      .post(url)
      .set(csrf, 'XMLHttpRequest')
      .send(validCreateBody());
    const asOwner = await postAs(owner.agent, url);
    const asOther = await postAs(other.agent, url);

    expect(anonymous.status).toBe(401);
    expect(asOwner.status).toBe(403);
    expect(asOwner.body.error.code).toBe('FORBIDDEN');
    expect(asOther.status).toBe(403);
    expect(asOther.body.error.code).toBe('FORBIDDEN');

    const deniedCount = await prisma.actionTaken.count({ where: { ticketId } });
    expect(deniedCount).toBe(0);

    const asStaff = await postAs(staff.agent, url);
    const asAdmin = await postAs(admin.agent, url);
    expect(asStaff.status).toBe(201);
    expect(asStaff.body.actionTaken.performedBy).toEqual({ id: staffUser.id, name: 'A4 Matrix Staff' });
    expect(asAdmin.status).toBe(201);
    expect(asAdmin.body.actionTaken.performedBy).toEqual({ id: adminUser.id, name: 'A4 Matrix Admin' });

    const allowedCount = await prisma.actionTaken.count({ where: { ticketId } });
    expect(allowedCount).toBe(2);
  });

  it('AUTH-01: PATCH /api/staff/tickets/:id/actions-taken/:actionId matches the role matrix', async () => {
    const staff = agentFor(staffUser.email);
    await staff.ready;
    const admin = agentFor(adminUser.email);
    await admin.ready;
    const owner = agentFor(ownerRequester.email);
    await owner.ready;
    const other = agentFor(otherRequester.email);
    await other.ready;

    const setup = await postAs(staff.agent, `/api/staff/tickets/${ticketId}/actions-taken`);
    expect(setup.status).toBe(201);
    const actionId = setup.body.actionTaken.id;

    async function patchAs(agent: request.SuperAgentTest, result: string) {
      const current = await prisma.actionTaken.findUnique({ where: { id: actionId }, select: { version: true } });
      return agent
        .patch(`/api/staff/tickets/${ticketId}/actions-taken/${actionId}`)
        .set(csrf, 'XMLHttpRequest')
        .send({ expectedVersion: current!.version, result });
    }

    const anonymous = await request(app)
      .patch(`/api/staff/tickets/${ticketId}/actions-taken/${actionId}`)
      .set(csrf, 'XMLHttpRequest')
      .send({ expectedVersion: 1, result: 'Anonymous attempt that must fail.' });
    const asOwner = await patchAs(owner.agent, 'Owner attempt that must fail.');
    const asOther = await patchAs(other.agent, 'Other requester attempt that must fail.');

    expect(anonymous.status).toBe(401);
    expect(asOwner.status).toBe(403);
    expect(asOwner.body.error.code).toBe('FORBIDDEN');
    expect(asOther.status).toBe(403);
    expect(asOther.body.error.code).toBe('FORBIDDEN');

    const afterDenied = await prisma.actionTaken.findUnique({ where: { id: actionId } });
    expect(afterDenied!.version).toBe(1);
    expect(afterDenied!.result).toBe('Matrix row verified for this role.');

    const asStaff = await patchAs(staff.agent, 'Staff edit applied by the matrix test.');
    expect(asStaff.status).toBe(200);
    expect(asStaff.body.actionTaken.updatedBy).toEqual({ id: staffUser.id, name: 'A4 Matrix Staff' });

    const asAdmin = await patchAs(admin.agent, 'Administrator edit applied by the matrix test.');
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body.actionTaken.updatedBy).toEqual({ id: adminUser.id, name: 'A4 Matrix Admin' });

    const finalRow = await prisma.actionTaken.findUnique({ where: { id: actionId } });
    expect(finalRow!.version).toBe(3);
    expect(finalRow!.performedById).toBe(staffUser.id);
  });

  it('AUTH-02: POST /api/staff/tickets/:id/actions-taken without the CSRF header is rejected before any DB change', async () => {
    const staff = agentFor(staffUser.email);
    await staff.ready;
    const before = await prisma.actionTaken.count({ where: { ticketId } });

    const res = await staff.agent
      .post(`/api/staff/tickets/${ticketId}/actions-taken`)
      .send(validCreateBody());

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_CHECK_FAILED');

    const after = await prisma.actionTaken.count({ where: { ticketId } });
    expect(after).toBe(before);
  });

  it('AUTH-02: PATCH /api/staff/tickets/:id/actions-taken/:actionId without the CSRF header changes nothing', async () => {
    const staff = agentFor(staffUser.email);
    await staff.ready;
    const setup = await postAs(staff.agent, `/api/staff/tickets/${ticketId}/actions-taken`);
    expect(setup.status).toBe(201);
    const actionId = setup.body.actionTaken.id;
    const before = await prisma.actionTaken.findUnique({ where: { id: actionId } });

    const res = await staff.agent
      .patch(`/api/staff/tickets/${ticketId}/actions-taken/${actionId}`)
      .send({ expectedVersion: before!.version, result: 'Must never be applied without the header.' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_CHECK_FAILED');

    const after = await prisma.actionTaken.findUnique({ where: { id: actionId } });
    expect(after!.version).toBe(before!.version);
    expect(after!.result).toBe(before!.result);
  });

  // ── Lab 4, Issue 4: status / owner / priority rows of api-spec.md §7 ──────

  async function nonOwnerStaffAgent() {
    const u = await prisma.user.upsert({
      where: { emailNormalized: 'a4m_staff2@example.com' },
      update: { name: 'A4 Matrix Staff 2', role: 'IT_STAFF', department: 'IT', passwordHash: localPasswordHash, mustChangePassword: false, isActive: true },
      create: {
        name: 'A4 Matrix Staff 2',
        email: 'a4m_staff2@example.com',
        emailNormalized: 'a4m_staff2@example.com',
        department: 'IT',
        role: 'IT_STAFF',
        passwordHash: localPasswordHash,
        mustChangePassword: false,
        isActive: true
      }
    });
    const login = agentFor(u.email);
    await login.ready;
    return login.agent;
  }

  it('AUTH-01: PATCH /api/staff/tickets/:id/status matches the role matrix (anonymous 401, Requesters 403, staff/admin 200)', async () => {
    const before = await prisma.ticket.findUnique({ where: { id: ticketId } });

    const anonymous = await request(app)
      .patch(`/api/staff/tickets/${ticketId}/status`)
      .set(csrf, 'XMLHttpRequest')
      .send({ status: 'In Progress' });
    expect(anonymous.status).toBe(401);
    expect(anonymous.body.error.code).toBe('UNAUTHENTICATED');

    const owner = agentFor(ownerRequester.email);
    await owner.ready;
    const asOwner = await owner.agent
      .patch(`/api/staff/tickets/${ticketId}/status`)
      .set(csrf, 'XMLHttpRequest')
      .send({ status: 'In Progress' });
    expect(asOwner.status).toBe(403);
    expect(asOwner.body.error.code).toBe('FORBIDDEN');

    const other = agentFor(otherRequester.email);
    await other.ready;
    const asOther = await other.agent
      .patch(`/api/staff/tickets/${ticketId}/status`)
      .set(csrf, 'XMLHttpRequest')
      .send({ status: 'In Progress' });
    expect(asOther.status).toBe(403);
    expect(asOther.body.error.code).toBe('FORBIDDEN');

    const afterDenied = await prisma.ticket.findUnique({ where: { id: ticketId } });
    expect(afterDenied).toEqual(before); // rejected callers never change the Ticket

    // Non-owner active IT Staff may change status (BR-14: not owner-only).
    const staff2 = await nonOwnerStaffAgent();
    const asStaff = await staff2
      .patch(`/api/staff/tickets/${ticketId}/status`)
      .set(csrf, 'XMLHttpRequest')
      .send({ status: 'In Progress' });
    expect(asStaff.status).toBe(200);
    expect(asStaff.body.ticket.status).toBe('In Progress');
    expect(asStaff.body.ticket.version).toBe(before!.version + 1);

    const admin = agentFor(adminUser.email);
    await admin.ready;
    const asAdmin = await admin.agent
      .patch(`/api/staff/tickets/${ticketId}/status`)
      .set(csrf, 'XMLHttpRequest')
      .send({ status: 'Waiting for Requester', expectedVersion: asStaff.body.ticket.version });
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body.ticket.status).toBe('Waiting for Requester');
  });

  it('AUTH-01: PATCH /api/staff/tickets/:id/owner matches the role matrix (non-owner IT Staff and Administrator succeed, BR-14)', async () => {
    const before = await prisma.ticket.findUnique({ where: { id: ticketId } });

    const anonymous = await request(app)
      .patch(`/api/staff/tickets/${ticketId}/owner`)
      .set(csrf, 'XMLHttpRequest')
      .send({ ownerId: adminUser.id });
    expect(anonymous.status).toBe(401);

    const owner = agentFor(ownerRequester.email);
    await owner.ready;
    const asOwner = await owner.agent
      .patch(`/api/staff/tickets/${ticketId}/owner`)
      .set(csrf, 'XMLHttpRequest')
      .send({ ownerId: adminUser.id });
    expect(asOwner.status).toBe(403);
    expect(asOwner.body.error.code).toBe('FORBIDDEN');

    const other = agentFor(otherRequester.email);
    await other.ready;
    const asOther = await other.agent
      .patch(`/api/staff/tickets/${ticketId}/owner`)
      .set(csrf, 'XMLHttpRequest')
      .send({ ownerId: adminUser.id });
    expect(asOther.status).toBe(403);
    expect(asOther.body.error.code).toBe('FORBIDDEN');

    const afterDenied = await prisma.ticket.findUnique({ where: { id: ticketId } });
    expect(afterDenied).toEqual(before);

    const staff2 = await nonOwnerStaffAgent();
    const asStaff = await staff2
      .patch(`/api/staff/tickets/${ticketId}/owner`)
      .set(csrf, 'XMLHttpRequest')
      .send({ ownerId: adminUser.id });
    expect(asStaff.status).toBe(200);
    expect(asStaff.body.ticket.ownerId).toBe(adminUser.id);
    expect(asStaff.body.ticket.version).toBe(before!.version + 1);

    const admin = agentFor(adminUser.email);
    await admin.ready;
    const asAdmin = await admin.agent
      .patch(`/api/staff/tickets/${ticketId}/owner`)
      .set(csrf, 'XMLHttpRequest')
      .send({ ownerId: staffUser.id, expectedVersion: asStaff.body.ticket.version });
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body.ticket.ownerId).toBe(staffUser.id);
  });

  it('AUTH-01: PATCH /api/staff/tickets/:id/priority matches the role matrix (non-owner IT Staff and Administrator succeed, BR-14)', async () => {
    const before = await prisma.ticket.findUnique({ where: { id: ticketId } });

    const anonymous = await request(app)
      .patch(`/api/staff/tickets/${ticketId}/priority`)
      .set(csrf, 'XMLHttpRequest')
      .send({ itPriority: 'Urgent' });
    expect(anonymous.status).toBe(401);

    const owner = agentFor(ownerRequester.email);
    await owner.ready;
    const asOwner = await owner.agent
      .patch(`/api/staff/tickets/${ticketId}/priority`)
      .set(csrf, 'XMLHttpRequest')
      .send({ itPriority: 'Urgent' });
    expect(asOwner.status).toBe(403);
    expect(asOwner.body.error.code).toBe('FORBIDDEN');

    const other = agentFor(otherRequester.email);
    await other.ready;
    const asOther = await other.agent
      .patch(`/api/staff/tickets/${ticketId}/priority`)
      .set(csrf, 'XMLHttpRequest')
      .send({ itPriority: 'Urgent' });
    expect(asOther.status).toBe(403);
    expect(asOther.body.error.code).toBe('FORBIDDEN');

    const afterDenied = await prisma.ticket.findUnique({ where: { id: ticketId } });
    expect(afterDenied).toEqual(before);

    const staff2 = await nonOwnerStaffAgent();
    const asStaff = await staff2
      .patch(`/api/staff/tickets/${ticketId}/priority`)
      .set(csrf, 'XMLHttpRequest')
      .send({ itPriority: 'Urgent' });
    expect(asStaff.status).toBe(200);
    expect(asStaff.body.ticket.itPriority).toBe('Urgent');
    expect(asStaff.body.ticket.version).toBe(before!.version + 1);

    const admin = agentFor(adminUser.email);
    await admin.ready;
    const asAdmin = await admin.agent
      .patch(`/api/staff/tickets/${ticketId}/priority`)
      .set(csrf, 'XMLHttpRequest')
      .send({ itPriority: 'High', expectedVersion: asStaff.body.ticket.version });
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body.ticket.itPriority).toBe('High');
  });

  it('AUTH-02: PATCH …/status, …/owner and …/priority without the CSRF header are rejected before any DB change', async () => {
    const staff = agentFor(staffUser.email);
    await staff.ready;
    const before = await prisma.ticket.findUnique({ where: { id: ticketId } });

    const statusRes = await staff.agent
      .patch(`/api/staff/tickets/${ticketId}/status`)
      .send({ status: 'In Progress' });
    const ownerRes = await staff.agent
      .patch(`/api/staff/tickets/${ticketId}/owner`)
      .send({ ownerId: adminUser.id });
    const priorityRes = await staff.agent
      .patch(`/api/staff/tickets/${ticketId}/priority`)
      .send({ itPriority: 'Urgent' });

    expect(statusRes.status).toBe(403);
    expect(statusRes.body.error.code).toBe('CSRF_CHECK_FAILED');
    expect(ownerRes.status).toBe(403);
    expect(ownerRes.body.error.code).toBe('CSRF_CHECK_FAILED');
    expect(priorityRes.status).toBe(403);
    expect(priorityRes.body.error.code).toBe('CSRF_CHECK_FAILED');

    const after = await prisma.ticket.findUnique({ where: { id: ticketId } });
    expect(after).toEqual(before);
  });

  // ── Lab 4, Issue 5: dashboard / health rows of api-spec.md §7 ─────────────
  // Nested describe: its beforeAll runs only after the rows above have
  // finished, so the Lab 1–3 rows keep their original timing (an eager
  // file-level pre-warm would delay them into Lab 3's cross-file sweeps),
  // while the dashboard sessions below are still warmed once, right before
  // the dashboard rows that use them.
  describe('dashboard and health rows (Issue 5)', () => {
    beforeAll(async () => {
      const specs = [
        { email: 'a4m_req1@example.com', name: 'A4 Matrix Requester', role: 'REQUESTER' as const, department: 'Support' },
        { email: 'a4m_req2@example.com', name: 'A4 Matrix Other Requester', role: 'REQUESTER' as const, department: 'Operations' },
        { email: 'a4m_staff@example.com', name: 'A4 Matrix Staff', role: 'IT_STAFF' as const, department: 'IT' },
        { email: 'a4m_admin@example.com', name: 'A4 Matrix Admin', role: 'ADMINISTRATOR' as const, department: 'IT' }
      ];
      for (const spec of specs) {
        await prisma.user.upsert({
          where: { emailNormalized: spec.email },
          update: { name: spec.name, role: spec.role, department: spec.department, passwordHash: localPasswordHash, mustChangePassword: false, isActive: true },
          create: {
            name: spec.name,
            email: spec.email,
            emailNormalized: spec.email,
            department: spec.department,
            role: spec.role,
            passwordHash: localPasswordHash,
            mustChangePassword: false,
            isActive: true
          }
        });
        await dashboardAgentFor(spec.email);
      }
    });

    it('AUTH-01: GET /api/dashboard/requester matches the role matrix (401/200/200/403/403)', async () => {
      const admin = await dashboardAgentFor(adminUser.email);
      const staff = await dashboardAgentFor(staffUser.email);
      const owner = await dashboardAgentFor(ownerRequester.email);
      const other = await dashboardAgentFor(otherRequester.email);

      const anonymous = await request(app).get('/api/dashboard/requester');
      const asAdmin = await admin.get('/api/dashboard/requester');
      const asStaff = await staff.get('/api/dashboard/requester');
      const asOwner = await owner.get('/api/dashboard/requester');
      const asOther = await other.get('/api/dashboard/requester');

      expect(anonymous.status).toBe(401);
      expect(anonymous.body.error.code).toBe('UNAUTHENTICATED');
      expect(asOwner.status).toBe(200);
      expect(asOther.status).toBe(200);
      expect(asStaff.status).toBe(403);
      expect(asStaff.body.error.code).toBe('FORBIDDEN');
      expect(asAdmin.status).toBe(403);
      expect(asAdmin.body.error.code).toBe('FORBIDDEN');

      // Requester payloads carry metrics and lists only — never user counts.
      expect(asOwner.body).toHaveProperty('metrics');
      expect(asOwner.body).toHaveProperty('needsAttention');
      expect(asOwner.body).not.toHaveProperty('users');
      expect(asOther.body).not.toHaveProperty('users');
    });

    it('AUTH-01: GET /api/dashboard/staff matches the role matrix (401/403/403/200/200+users)', async () => {
      const admin = await dashboardAgentFor(adminUser.email);
      const staff = await dashboardAgentFor(staffUser.email);
      const owner = await dashboardAgentFor(ownerRequester.email);
      const other = await dashboardAgentFor(otherRequester.email);

      const anonymous = await request(app).get('/api/dashboard/staff');
      const asAdmin = await admin.get('/api/dashboard/staff');
      const asStaff = await staff.get('/api/dashboard/staff');
      const asOwner = await owner.get('/api/dashboard/staff');
      const asOther = await other.get('/api/dashboard/staff');

      expect(anonymous.status).toBe(401);
      expect(anonymous.body.error.code).toBe('UNAUTHENTICATED');
      expect(asOwner.status).toBe(403);
      expect(asOwner.body.error.code).toBe('FORBIDDEN');
      expect(asOther.status).toBe(403);
      expect(asOther.body.error.code).toBe('FORBIDDEN');
      expect(asStaff.status).toBe(200);
      expect(asAdmin.status).toBe(200);

      // Matrix: +users only for Administrator; structurally absent for IT Staff.
      expect(asAdmin.body).toHaveProperty('users');
      expect(asStaff.body).not.toHaveProperty('users');
    });

    it('AUTH-01: GET /api/health is public — every role and anonymous callers get 200', async () => {
      const owner = await dashboardAgentFor(ownerRequester.email);
      const other = await dashboardAgentFor(otherRequester.email);
      const staff = await dashboardAgentFor(staffUser.email);
      const admin = await dashboardAgentFor(adminUser.email);

      const anonymous = await request(app).get('/api/health');
      const asOwner = await owner.get('/api/health');
      const asOther = await other.get('/api/health');
      const asStaff = await staff.get('/api/health');
      const asAdmin = await admin.get('/api/health');

      for (const response of [anonymous, asOwner, asOther, asStaff, asAdmin]) {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ok');
        expect(response.body.database).toBe('up');
        expect(typeof response.body.time).toBe('string');
      }
    });

    it('AUTH-01: a session with mustChangePassword is rejected on both dashboard endpoints (Lab 3 gate)', async () => {
      const pwc = await prisma.user.upsert({
        where: { emailNormalized: 'a4m_pwc@example.com' },
        update: { name: 'A4 Matrix PwC', role: 'IT_STAFF', department: 'IT', passwordHash: localPasswordHash, mustChangePassword: true, isActive: true },
        create: {
          name: 'A4 Matrix PwC',
          email: 'a4m_pwc@example.com',
          emailNormalized: 'a4m_pwc@example.com',
          department: 'IT',
          role: 'IT_STAFF',
          passwordHash: localPasswordHash,
          mustChangePassword: true,
          isActive: true
        }
      });

      const gated = agentFor(pwc.email);
      await gated.ready;

      const requesterDashboard = await gated.agent.get('/api/dashboard/requester');
      const staffDashboard = await gated.agent.get('/api/dashboard/staff');
      // The health endpoint is public and must stay reachable regardless.
      const health = await gated.agent.get('/api/health');

      expect(requesterDashboard.status).toBe(403);
      expect(requesterDashboard.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
      expect(staffDashboard.status).toBe(403);
      expect(staffDashboard.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
      expect(health.status).toBe(200);
    });
  });
});

function postAs(agent: request.SuperAgentTest, url: string) {
  return agent
    .post(url)
    .set('X-Requested-With', 'XMLHttpRequest')
    .send(validCreateBody());
}

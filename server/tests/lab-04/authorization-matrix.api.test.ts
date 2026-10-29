/**
 * AUTH-01 (Actions Taken rows of api-spec.md §7) and AUTH-02 (missing CSRF header
 * on every new mutating endpoint) for Lab 4, Issue 2.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { app } from '../../src/server.js';
import prisma from '../../src/prisma.js';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const localPasswordHash = '$2b$12$MvQuSTNtpiuJmfaKc7j0Nu0FipBQuY31F6ojkIMWw2OMTZoK5lUkq';
const SUMMARY_PREFIX = '[A4-AUTH]';
const csrf = 'X-Requested-With';

function agentFor(email: string) {
  const agent = request.agent(app);
  const ready = agent
    .post('/api/auth/login')
    .set(csrf, 'XMLHttpRequest')
    .send({ email, password: 'LocalOnly1!' });
  return { agent, ready };
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
});

function postAs(agent: request.SuperAgentTest, url: string) {
  return agent
    .post(url)
    .set('X-Requested-With', 'XMLHttpRequest')
    .send(validCreateBody());
}

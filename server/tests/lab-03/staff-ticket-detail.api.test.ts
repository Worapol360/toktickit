/**
 * API-16: Claim an unassigned ticket
 * API-17: Reassign an owned ticket; invalid ownerId
 * API-18: Update IT Priority
 * API-19: Status transition matrix enforcement
 * API-20: Staff ticket detail retrieval is not ownership-scoped
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, isValidStatusTransition, ALL_STATUSES } from '../../src/server.js';
import prisma from '../../src/prisma.js';

const localPasswordHash = '$2b$12$MvQuSTNtpiuJmfaKc7j0Nu0FipBQuY31F6ojkIMWw2OMTZoK5lUkq';

function agentFor(email: string) {
  const agent = request.agent(app);
  const ready = agent
    .post('/api/auth/login')
    .set('X-Requested-With', 'XMLHttpRequest')
    .send({ email, password: 'LocalOnly1!' });
  return { agent, ready };
}

describe('isValidStatusTransition pure function', () => {
  const permittedTransitions: Record<string, string[]> = {
    'New': ['Open', 'Cancelled'],
    'Open': ['In Progress', 'Cancelled'],
    'In Progress': ['Waiting for Requester', 'Resolved', 'Cancelled'],
    'Waiting for Requester': ['In Progress', 'Resolved', 'Cancelled'],
    'Resolved': ['Closed', 'Reopened'],
    'Closed': ['Reopened'],
    'Reopened': ['In Progress', 'Cancelled'],
    'Cancelled': []
  };

  const statuses = [
    'New',
    'Open',
    'In Progress',
    'Waiting for Requester',
    'Resolved',
    'Closed',
    'Reopened',
    'Cancelled'
  ];

  it('exhaustively validates all 64 status transition pairs', () => {
    for (const from of statuses) {
      for (const to of statuses) {
        const allowed = permittedTransitions[from]?.includes(to) ?? false;
        expect(
          isValidStatusTransition(from, to),
          `Transition from "${from}" to "${to}" should be ${allowed}`
        ).toBe(allowed);
      }
    }
  });

  it('rejects invalid or unknown statuses', () => {
    expect(isValidStatusTransition('Unknown', 'Open')).toBe(false);
    expect(isValidStatusTransition('New', 'Unknown')).toBe(false);
    expect(isValidStatusTransition('', '')).toBe(false);
  });
});

describe('Staff Ticket Detail API (API-16 to API-20)', () => {
  let catId: number;
  let sysId: number;
  let requester: { id: number; email: string };
  let staff1: { id: number; email: string };
  let staff2: { id: number; email: string };
  let inactiveStaff: { id: number; email: string };
  let adminUser: { id: number; email: string };

  beforeEach(async () => {
    const cat = await prisma.category.findFirst({ where: { isActive: true } });
    const sys = await prisma.relatedSystem.findFirst({ where: { isActive: true } });

    if (!cat || !sys) {
      throw new Error('Test database is missing required seed categories/systems');
    }

    catId = cat.id;
    sysId = sys.id;

    const uReq = await prisma.user.upsert({
      where: { emailNormalized: 'dt_req@example.com' },
      update: { passwordHash: localPasswordHash, mustChangePassword: false, isActive: true },
      create: {
        name: 'DT Requester',
        email: 'dt_req@example.com',
        emailNormalized: 'dt_req@example.com',
        department: 'Operations',
        role: 'REQUESTER',
        passwordHash: localPasswordHash,
        mustChangePassword: false,
        isActive: true
      }
    });

    const uStaff1 = await prisma.user.upsert({
      where: { emailNormalized: 'dt_staff1@example.com' },
      update: { passwordHash: localPasswordHash, mustChangePassword: false, isActive: true },
      create: {
        name: 'DT Staff 1',
        email: 'dt_staff1@example.com',
        emailNormalized: 'dt_staff1@example.com',
        department: 'IT',
        role: 'IT_STAFF',
        passwordHash: localPasswordHash,
        mustChangePassword: false,
        isActive: true
      }
    });

    const uStaff2 = await prisma.user.upsert({
      where: { emailNormalized: 'dt_staff2@example.com' },
      update: { passwordHash: localPasswordHash, mustChangePassword: false, isActive: true },
      create: {
        name: 'DT Staff 2',
        email: 'dt_staff2@example.com',
        emailNormalized: 'dt_staff2@example.com',
        department: 'IT',
        role: 'IT_STAFF',
        passwordHash: localPasswordHash,
        mustChangePassword: false,
        isActive: true
      }
    });

    const uInactStaff = await prisma.user.upsert({
      where: { emailNormalized: 'dt_inact_staff@example.com' },
      update: { passwordHash: localPasswordHash, mustChangePassword: false, isActive: false },
      create: {
        name: 'DT Inactive Staff',
        email: 'dt_inact_staff@example.com',
        emailNormalized: 'dt_inact_staff@example.com',
        department: 'IT',
        role: 'IT_STAFF',
        passwordHash: localPasswordHash,
        mustChangePassword: false,
        isActive: false
      }
    });

    const uAdmin = await prisma.user.upsert({
      where: { emailNormalized: 'dt_admin@example.com' },
      update: { passwordHash: localPasswordHash, mustChangePassword: false, isActive: true },
      create: {
        name: 'DT Admin',
        email: 'dt_admin@example.com',
        emailNormalized: 'dt_admin@example.com',
        department: 'IT',
        role: 'ADMINISTRATOR',
        passwordHash: localPasswordHash,
        mustChangePassword: false,
        isActive: true
      }
    });

    requester = { id: uReq.id, email: uReq.email };
    staff1 = { id: uStaff1.id, email: uStaff1.email };
    staff2 = { id: uStaff2.id, email: uStaff2.email };
    inactiveStaff = { id: uInactStaff.id, email: uInactStaff.email };
    adminUser = { id: uAdmin.id, email: uAdmin.email };

    // Clean up only rows created by this test file
    await prisma.publicComment.deleteMany({
      where: { ticket: { summary: { startsWith: '[DETAIL-TEST]' } } }
    });
    await prisma.internalNote.deleteMany({
      where: { ticket: { summary: { startsWith: '[DETAIL-TEST]' } } }
    });
    await prisma.ticket.deleteMany({
      where: { summary: { startsWith: '[DETAIL-TEST]' } }
    });
  });



  afterEach(async () => {
    await prisma.publicComment.deleteMany({
      where: { ticket: { summary: { startsWith: '[DETAIL-TEST]' } } }
    });
    await prisma.internalNote.deleteMany({
      where: { ticket: { summary: { startsWith: '[DETAIL-TEST]' } } }
    });
    await prisma.ticket.deleteMany({
      where: { summary: { startsWith: '[DETAIL-TEST]' } }
    });
  });

  async function createTestTicket(data: {
    ticketNumber: string;
    summary: string;
    description?: string;
    requestedPriority?: string;
    itPriority?: string;
    status?: string;
    ownerId?: number | null;
  }) {
    return prisma.ticket.create({
      data: {
        ticketNumber: data.ticketNumber,
        summary: `[DETAIL-TEST] ${data.summary}`,
        description: data.description ?? 'Test ticket description for detail',
        requestedPriority: data.requestedPriority ?? 'Medium',
        itPriority: data.itPriority ?? data.requestedPriority ?? 'Medium',
        status: data.status ?? 'New',
        requesterId: requester.id,
        ownerId: data.ownerId ?? null,
        categoryId: catId,
        relatedSystemId: sysId,
      }
    });
  }

  // API-20: Staff ticket detail retrieval is not ownership-scoped
  it('API-20: returns ticket + comments + notes for any staff member, not ownership-scoped', async () => {
    const ticket = await createTestTicket({
      ticketNumber: 'TICK-TEST-DT001',
      summary: 'Detail test ticket',
      ownerId: staff2.id
    });

    await prisma.publicComment.create({
      data: {
        ticketId: ticket.id,
        authorId: requester.id,
        content: 'Requester comment on ticket'
      }
    });

    await prisma.internalNote.create({
      data: {
        ticketId: ticket.id,
        authorId: staff2.id,
        content: 'Staff private internal note'
      }
    });

    const { agent, ready } = agentFor(staff1.email);
    await ready;

    const res = await agent.get(`/api/staff/tickets/${ticket.id}`);
    expect(res.status).toBe(200);
    expect(res.body.ticket).toBeDefined();
    expect(res.body.ticket.id).toBe(ticket.id);
    expect(res.body.ticket.summary).toBe(ticket.summary);
    expect(res.body.comments).toHaveLength(1);
    expect(res.body.comments[0].content).toBe('Requester comment on ticket');
    expect(res.body.notes).toHaveLength(1);
    expect(res.body.notes[0].content).toBe('Staff private internal note');
  });

  it('API-20: returns 404 for non-existent ticket ID and 400 for invalid ID', async () => {
    const { agent, ready } = agentFor(staff1.email);
    await ready;

    const resNotFound = await agent.get('/api/staff/tickets/999999');
    expect(resNotFound.status).toBe(404);
    expect(resNotFound.body.error.code).toBe('TICKET_NOT_FOUND');

    const resInvalid = await agent.get('/api/staff/tickets/invalid-id');
    expect(resInvalid.status).toBe(400);
    expect(resInvalid.body.error.code).toBe('INVALID_TICKET_ID');
  });

  // API-16: Claim an unassigned ticket
  it('API-16: claims an unassigned ticket and updates ownerId to claiming staff', async () => {
    const ticket = await createTestTicket({
      ticketNumber: 'TICK-TEST-DT002',
      summary: 'Unassigned ticket to claim',
      ownerId: null
    });

    const { agent, ready } = agentFor(staff1.email);
    await ready;

    const patchRes = await agent
      .patch(`/api/staff/tickets/${ticket.id}/owner`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ ownerId: staff1.id });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.ticket.ownerId).toBe(staff1.id);

    // Verify on re-fetch
    const getRes = await agent.get(`/api/staff/tickets/${ticket.id}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.ticket.ownerId).toBe(staff1.id);
  });

  // API-17: Reassign an owned ticket; invalid ownerId
  it('API-17: reassigns an owned ticket to another active staff/admin user', async () => {
    const ticket = await createTestTicket({
      ticketNumber: 'TICK-TEST-DT003',
      summary: 'Ticket to reassign',
      ownerId: staff1.id
    });

    const { agent, ready } = agentFor(staff1.email);
    await ready;

    const patchRes = await agent
      .patch(`/api/staff/tickets/${ticket.id}/owner`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ ownerId: staff2.id });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.ticket.ownerId).toBe(staff2.id);

    // Reassign to Administrator
    const patchAdminRes = await agent
      .patch(`/api/staff/tickets/${ticket.id}/owner`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ ownerId: adminUser.id });

    expect(patchAdminRes.status).toBe(200);
    expect(patchAdminRes.body.ticket.ownerId).toBe(adminUser.id);
  });

  it('API-17: rejects assignment to inactive user or requester role with 400 VALIDATION_ERROR', async () => {
    const ticket = await createTestTicket({
      ticketNumber: 'TICK-TEST-DT004',
      summary: 'Ticket for invalid owner test',
      ownerId: staff1.id
    });

    const { agent, ready } = agentFor(staff1.email);
    await ready;

    // Target is requester
    const resRequester = await agent
      .patch(`/api/staff/tickets/${ticket.id}/owner`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ ownerId: requester.id });


    expect(resRequester.status).toBe(400);
    expect(resRequester.body.error.code).toBe('VALIDATION_ERROR');

    // Target is inactive
    const resInactive = await agent
      .patch(`/api/staff/tickets/${ticket.id}/owner`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ ownerId: inactiveStaff.id });

    expect([400, 404]).toContain(resInactive.status);
    expect(['VALIDATION_ERROR', 'USER_NOT_FOUND']).toContain(resInactive.body.error.code);

    // Missing ownerId
    const resMissing = await agent
      .patch(`/api/staff/tickets/${ticket.id}/owner`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({});

    expect(resMissing.status).toBe(400);
    expect(resMissing.body.error.code).toBe('VALIDATION_ERROR');
  });

  // API-18: Update IT Priority
  it('API-18: updates itPriority while keeping requestedPriority unchanged', async () => {
    const ticket = await createTestTicket({
      ticketNumber: 'TICK-TEST-DT005',
      summary: 'Priority test ticket',
      requestedPriority: 'Low',
      itPriority: 'Low'
    });

    const { agent, ready } = agentFor(staff1.email);
    await ready;

    const patchRes = await agent
      .patch(`/api/staff/tickets/${ticket.id}/priority`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ itPriority: 'Urgent' });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.ticket.itPriority).toBe('Urgent');
    expect(patchRes.body.ticket.requestedPriority).toBe('Low');

    // Check DB record
    const updated = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(updated?.itPriority).toBe('Urgent');
    expect(updated?.requestedPriority).toBe('Low');
  });

  it('API-18: returns 400 VALIDATION_ERROR for unsupported priority values', async () => {
    const ticket = await createTestTicket({
      ticketNumber: 'TICK-TEST-DT006',
      summary: 'Bad priority test ticket'
    });

    const { agent, ready } = agentFor(staff1.email);
    await ready;

    const patchRes = await agent
      .patch(`/api/staff/tickets/${ticket.id}/priority`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ itPriority: 'Critical' });

    expect(patchRes.status).toBe(400);
    expect(patchRes.body.error.code).toBe('VALIDATION_ERROR');
  });

  // API-19: Status transition matrix enforcement via API
  it('API-19: allows valid status transition (New -> Open)', async () => {
    const ticket = await createTestTicket({
      ticketNumber: 'TICK-TEST-DT007',
      summary: 'Status transition New -> Open',
      status: 'New'
    });

    const { agent, ready } = agentFor(staff1.email);
    await ready;

    const patchRes = await agent
      .patch(`/api/staff/tickets/${ticket.id}/status`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ status: 'Open' });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.ticket.status).toBe('Open');
  });

  it('API-19: rejects non-permitted transition (New -> Resolved) with 409 INVALID_STATUS_TRANSITION and status is unchanged', async () => {
    const ticket = await createTestTicket({
      ticketNumber: 'TICK-TEST-DT008',
      summary: 'Invalid transition New -> Resolved',
      status: 'New'
    });

    const { agent, ready } = agentFor(staff1.email);
    await ready;

    const patchRes = await agent
      .patch(`/api/staff/tickets/${ticket.id}/status`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ status: 'Resolved' });

    expect(patchRes.status).toBe(409);
    expect(patchRes.body.error.code).toBe('INVALID_STATUS_TRANSITION');

    // Confirm DB status is unchanged
    const fetched = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(fetched?.status).toBe('New');
  });

  it('API-19: rejects transition from terminal Cancelled status with 409 INVALID_STATUS_TRANSITION', async () => {
    const ticket = await createTestTicket({
      ticketNumber: 'TICK-TEST-DT009',
      summary: 'Terminal cancelled ticket',
      status: 'Cancelled'
    });

    const { agent, ready } = agentFor(staff1.email);
    await ready;

    const patchRes = await agent
      .patch(`/api/staff/tickets/${ticket.id}/status`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ status: 'Open' });

    expect(patchRes.status).toBe(409);
    expect(patchRes.body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });
});

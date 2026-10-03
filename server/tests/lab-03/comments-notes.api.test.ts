/**
 * API-21: Empty/whitespace/oversize Public Comment and Internal Note
 * API-22: Public Comment create/retrieve visibility
 * API-23: Internal Note create/retrieve visibility
 * API-24: Mark-resolved action
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../../src/server.js';
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

describe('Comments and Notes API (API-21 to API-24)', () => {
  let catId: number;
  let sysId: number;
  let requester1: { id: number; email: string };
  let requester2: { id: number; email: string };
  let staffUser: { id: number; email: string };
  let adminUser: { id: number; email: string };

  beforeEach(async () => {
    const cat = await prisma.category.findFirst({ where: { isActive: true } });
    const sys = await prisma.relatedSystem.findFirst({ where: { isActive: true } });

    if (!cat || !sys) {
      throw new Error('Test database is missing required seed categories/systems');
    }

    catId = cat.id;
    sysId = sys.id;

    const u1 = await prisma.user.upsert({
      where: { emailNormalized: 'cm_req1@example.com' },
      update: { passwordHash: localPasswordHash, mustChangePassword: false, isActive: true },
      create: {
        name: 'CM Requester 1',
        email: 'cm_req1@example.com',
        emailNormalized: 'cm_req1@example.com',
        department: 'Support',
        role: 'REQUESTER',
        passwordHash: localPasswordHash,
        mustChangePassword: false,
        isActive: true
      }
    });

    const u2 = await prisma.user.upsert({
      where: { emailNormalized: 'cm_req2@example.com' },
      update: { passwordHash: localPasswordHash, mustChangePassword: false, isActive: true },
      create: {
        name: 'CM Requester 2',
        email: 'cm_req2@example.com',
        emailNormalized: 'cm_req2@example.com',
        department: 'Operations',
        role: 'REQUESTER',
        passwordHash: localPasswordHash,
        mustChangePassword: false,
        isActive: true
      }
    });

    const uStaff = await prisma.user.upsert({
      where: { emailNormalized: 'cm_staff@example.com' },
      update: { passwordHash: localPasswordHash, mustChangePassword: false, isActive: true },
      create: {
        name: 'CM Staff',
        email: 'cm_staff@example.com',
        emailNormalized: 'cm_staff@example.com',
        department: 'IT',
        role: 'IT_STAFF',
        passwordHash: localPasswordHash,
        mustChangePassword: false,
        isActive: true
      }
    });

    const uAdmin = await prisma.user.upsert({
      where: { emailNormalized: 'cm_admin@example.com' },
      update: { passwordHash: localPasswordHash, mustChangePassword: false, isActive: true },
      create: {
        name: 'CM Admin',
        email: 'cm_admin@example.com',
        emailNormalized: 'cm_admin@example.com',
        department: 'IT',
        role: 'ADMINISTRATOR',
        passwordHash: localPasswordHash,
        mustChangePassword: false,
        isActive: true
      }
    });

    requester1 = { id: u1.id, email: u1.email };
    requester2 = { id: u2.id, email: u2.email };
    staffUser = { id: uStaff.id, email: uStaff.email };
    adminUser = { id: uAdmin.id, email: uAdmin.email };

    // Scoped cleanup
    await prisma.publicComment.deleteMany({
      where: { ticket: { summary: { startsWith: '[COMMENTS-TEST]' } } }
    });


    await prisma.internalNote.deleteMany({
      where: { ticket: { summary: { startsWith: '[COMMENTS-TEST]' } } }
    });
    await prisma.ticket.deleteMany({
      where: { summary: { startsWith: '[COMMENTS-TEST]' } }
    });
  });

  afterEach(async () => {
    await prisma.publicComment.deleteMany({
      where: { ticket: { summary: { startsWith: '[COMMENTS-TEST]' } } }
    });
    await prisma.internalNote.deleteMany({
      where: { ticket: { summary: { startsWith: '[COMMENTS-TEST]' } } }
    });
    await prisma.ticket.deleteMany({
      where: { summary: { startsWith: '[COMMENTS-TEST]' } }
    });
  });

  async function createTestTicket(data: {
    ticketNumber: string;
    summary: string;
    requesterId?: number;
    status?: string;
  }) {
    return prisma.ticket.create({
      data: {
        ticketNumber: data.ticketNumber,
        summary: `[COMMENTS-TEST] ${data.summary}`,
        description: 'Ticket description for comments/notes test',
        requestedPriority: 'Medium',
        itPriority: 'Medium',
        status: data.status ?? 'New',
        requesterId: data.requesterId ?? requester1.id,
        categoryId: catId,
        relatedSystemId: sysId,
      }
    });
  }

  // API-21: Empty/whitespace/oversize Public Comment and Internal Note
  it('API-21: rejects empty, whitespace-only, <5 chars, and >2000 chars for Public Comments', async () => {
    const ticket = await createTestTicket({
      ticketNumber: 'TICK-TEST-CM001',
      summary: 'Public comment validation'
    });

    const { agent, ready } = agentFor(requester1.email);
    await ready;

    // Empty body
    const resEmpty = await agent
      .post(`/api/tickets/${ticket.id}/comments`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ content: '' });
    expect(resEmpty.status).toBe(400);
    expect(resEmpty.body.error.code).toBe('VALIDATION_ERROR');

    // Whitespace only
    const resWhitespace = await agent
      .post(`/api/tickets/${ticket.id}/comments`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ content: '    ' });
    expect(resWhitespace.status).toBe(400);
    expect(resWhitespace.body.error.code).toBe('VALIDATION_ERROR');

    // Under 5 characters
    const resTooShort = await agent
      .post(`/api/tickets/${ticket.id}/comments`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ content: 'Abc' });
    expect(resTooShort.status).toBe(400);
    expect(resTooShort.body.error.code).toBe('VALIDATION_ERROR');

    // Over 2000 characters
    const resTooLong = await agent
      .post(`/api/tickets/${ticket.id}/comments`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ content: 'a'.repeat(2001) });
    expect(resTooLong.status).toBe(400);
    expect(resTooLong.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('API-21: rejects empty, whitespace-only, <5 chars, and >2000 chars for Internal Notes', async () => {
    const ticket = await createTestTicket({
      ticketNumber: 'TICK-TEST-CM002',
      summary: 'Internal note validation'
    });

    const { agent, ready } = agentFor(staffUser.email);
    await ready;

    // Empty
    const resEmpty = await agent
      .post(`/api/staff/tickets/${ticket.id}/notes`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ content: '' });
    expect(resEmpty.status).toBe(400);
    expect(resEmpty.body.error.code).toBe('VALIDATION_ERROR');

    // Whitespace only
    const resWhitespace = await agent
      .post(`/api/staff/tickets/${ticket.id}/notes`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ content: '   \n  \t ' });
    expect(resWhitespace.status).toBe(400);
    expect(resWhitespace.body.error.code).toBe('VALIDATION_ERROR');

    // Under 5 chars
    const resTooShort = await agent
      .post(`/api/staff/tickets/${ticket.id}/notes`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ content: 'note' });
    expect(resTooShort.status).toBe(400);
    expect(resTooShort.body.error.code).toBe('VALIDATION_ERROR');

    // Over 2000 chars
    const resTooLong = await agent
      .post(`/api/staff/tickets/${ticket.id}/notes`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ content: 'n'.repeat(2001) });
    expect(resTooLong.status).toBe(400);
    expect(resTooLong.body.error.code).toBe('VALIDATION_ERROR');
  });

  // API-22: Public Comment create/retrieve visibility
  it('API-22: allows Requester, IT Staff, and Admin to post and read Public Comments', async () => {
    const ticket = await createTestTicket({
      ticketNumber: 'TICK-TEST-CM003',
      summary: 'Comment visibility test',
      requesterId: requester1.id
    });

    // 1. Requester posts a comment
    const reqAgent = agentFor(requester1.email);
    await reqAgent.ready;
    const postReq = await reqAgent.agent
      .post(`/api/tickets/${ticket.id}/comments`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ content: 'Requester comment message' });

    expect(postReq.status).toBe(201);
    expect(postReq.body.comment).toBeDefined();
    expect(postReq.body.comment.content).toBe('Requester comment message');
    expect(postReq.body.comment.authorId).toBe(requester1.id);
    expect(postReq.body.comment.createdAt).toBeDefined();

    // 2. IT Staff posts a public comment
    const staffAgent = agentFor(staffUser.email);
    await staffAgent.ready;
    const postStaff = await staffAgent.agent
      .post(`/api/tickets/${ticket.id}/comments`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ content: 'IT Staff public reply message' });

    expect(postStaff.status).toBe(201);
    expect(postStaff.body.comment.authorId).toBe(staffUser.id);

    // 3. Admin posts a public comment
    const adminAgent = agentFor(adminUser.email);
    await adminAgent.ready;
    const postAdmin = await adminAgent.agent
      .post(`/api/tickets/${ticket.id}/comments`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ content: 'Administrator public reply' });

    expect(postAdmin.status).toBe(201);
    expect(postAdmin.body.comment.authorId).toBe(adminUser.id);

    // 4. Requester retrieves comments — ordered createdAt ASC
    const getReq = await reqAgent.agent.get(`/api/tickets/${ticket.id}/comments`);
    expect(getReq.status).toBe(200);
    expect(getReq.body.comments).toHaveLength(3);
    expect(getReq.body.comments[0].content).toBe('Requester comment message');
    expect(getReq.body.comments[1].content).toBe('IT Staff public reply message');
    expect(getReq.body.comments[2].content).toBe('Administrator public reply');
  });

  it('API-22: returns 404 when a Requester tries to view/post comments on another requesters ticket', async () => {
    const ticket = await createTestTicket({
      ticketNumber: 'TICK-TEST-CM004',
      summary: 'Requester isolation ticket',
      requesterId: requester1.id
    });

    const otherReqAgent = agentFor(requester2.email);
    await otherReqAgent.ready;

    const getRes = await otherReqAgent.agent.get(`/api/tickets/${ticket.id}/comments`);
    expect(getRes.status).toBe(404);
    expect(getRes.body.error.code).toBe('TICKET_NOT_FOUND');

    const postRes = await otherReqAgent.agent
      .post(`/api/tickets/${ticket.id}/comments`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ content: 'Unauthorized comment attempt' });
    expect(postRes.status).toBe(404);
    expect(postRes.body.error.code).toBe('TICKET_NOT_FOUND');
  });

  // API-23: Internal Note create/retrieve visibility
  it('API-23: allows IT Staff & Admin to create/read notes; blocks Requester with 403', async () => {
    const ticket = await createTestTicket({
      ticketNumber: 'TICK-TEST-CM005',
      summary: 'Internal notes access test'
    });

    // Staff creates note
    const staffAgent = agentFor(staffUser.email);
    await staffAgent.ready;
    const postNote = await staffAgent.agent
      .post(`/api/staff/tickets/${ticket.id}/notes`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ content: 'Confidential internal staff note' });

    expect(postNote.status).toBe(201);
    expect(postNote.body.note.content).toBe('Confidential internal staff note');
    expect(postNote.body.note.authorId).toBe(staffUser.id);

    // Admin creates note
    const adminAgent = agentFor(adminUser.email);
    await adminAgent.ready;
    const postAdminNote = await adminAgent.agent
      .post(`/api/staff/tickets/${ticket.id}/notes`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ content: 'Confidential admin note' });

    expect(postAdminNote.status).toBe(201);

    // Staff retrieves notes
    const getNotes = await staffAgent.agent.get(`/api/staff/tickets/${ticket.id}/notes`);
    expect(getNotes.status).toBe(200);
    expect(getNotes.body.notes).toHaveLength(2);

    // Requester calls note endpoints -> 403 Forbidden
    const reqAgent = agentFor(requester1.email);
    await reqAgent.ready;

    const reqGetNotes = await reqAgent.agent.get(`/api/staff/tickets/${ticket.id}/notes`);
    expect(reqGetNotes.status).toBe(403);
    expect(reqGetNotes.body.notes).toBeUndefined();

    const reqPostNotes = await reqAgent.agent
      .post(`/api/staff/tickets/${ticket.id}/notes`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ content: 'Requester trying to post note' });
    expect(reqPostNotes.status).toBe(403);
  });

  it('API-23 & API-11: Requester ticket detail and comments endpoints NEVER contain notes or internalNotes', async () => {
    const ticket = await createTestTicket({
      ticketNumber: 'TICK-TEST-CM006',
      summary: 'Note leakage check ticket'
    });

    // Create an internal note
    await prisma.internalNote.create({
      data: {
        ticketId: ticket.id,
        authorId: staffUser.id,
        content: 'Secret internal note that must never leak'
      }
    });

    const reqAgent = agentFor(requester1.email);
    await reqAgent.ready;

    // 1. Check GET /api/tickets/:id
    const detailRes = await reqAgent.agent.get(`/api/tickets/${ticket.id}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.notes).toBeUndefined();
    expect(detailRes.body.internalNotes).toBeUndefined();
    expect(detailRes.body.ticket.notes).toBeUndefined();
    expect(detailRes.body.ticket.internalNotes).toBeUndefined();

    // 2. Check GET /api/tickets/:id/comments
    const commentsRes = await reqAgent.agent.get(`/api/tickets/${ticket.id}/comments`);
    expect(commentsRes.status).toBe(200);
    expect(commentsRes.body.notes).toBeUndefined();
    expect(commentsRes.body.internalNotes).toBeUndefined();
  });

  // API-24: Mark-resolved action
  it('API-24: sets requesterMarkedResolved=true without changing status', async () => {
    const ticket = await createTestTicket({
      ticketNumber: 'TICK-TEST-CM007',
      summary: 'Mark resolved test ticket',
      status: 'In Progress'
    });

    const reqAgent = agentFor(requester1.email);
    await reqAgent.ready;

    const res = await reqAgent.agent
      .post(`/api/tickets/${ticket.id}/mark-resolved`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send();

    expect(res.status).toBe(200);
    expect(res.body.ticket.requesterMarkedResolved).toBe(true);
    expect(res.body.ticket.status).toBe('In Progress');

    // Confirm in DB
    const fetched = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(fetched?.requesterMarkedResolved).toBe(true);
    expect(fetched?.status).toBe('In Progress');
  });

  it('API-24: returns 409 TICKET_ALREADY_CLOSED when ticket is Closed or Cancelled', async () => {
    const closedTicket = await createTestTicket({
      ticketNumber: 'TICK-TEST-CM008',
      summary: 'Closed ticket mark resolved',
      status: 'Closed'
    });

    const cancelledTicket = await createTestTicket({
      ticketNumber: 'TICK-TEST-CM009',
      summary: 'Cancelled ticket mark resolved',
      status: 'Cancelled'
    });

    const reqAgent = agentFor(requester1.email);
    await reqAgent.ready;

    const resClosed = await reqAgent.agent
      .post(`/api/tickets/${closedTicket.id}/mark-resolved`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send();

    expect(resClosed.status).toBe(409);
    expect(resClosed.body.error.code).toBe('TICKET_ALREADY_CLOSED');

    const resCancelled = await reqAgent.agent
      .post(`/api/tickets/${cancelledTicket.id}/mark-resolved`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send();

    expect(resCancelled.status).toBe(409);
    expect(resCancelled.body.error.code).toBe('TICKET_ALREADY_CLOSED');
  });

  it('API-24: returns 404 when called by non-owning Requester and 403 when called by IT Staff', async () => {
    const ticket = await createTestTicket({
      ticketNumber: 'TICK-TEST-CM010',
      summary: 'Unauthorized mark resolved',
      requesterId: requester1.id
    });

    // Other requester -> 404
    const req2Agent = agentFor(requester2.email);
    await req2Agent.ready;
    const resReq2 = await req2Agent.agent
      .post(`/api/tickets/${ticket.id}/mark-resolved`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send();

    expect(resReq2.status).toBe(404);

    // IT Staff -> 403
    const staffAgent = agentFor(staffUser.email);
    await staffAgent.ready;
    const resStaff = await staffAgent.agent
      .post(`/api/tickets/${ticket.id}/mark-resolved`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send();

    expect(resStaff.status).toBe(403);
  });
});

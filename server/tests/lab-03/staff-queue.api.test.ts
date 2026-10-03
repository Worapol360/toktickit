/**
 * API-13: Staff Queue search/filter/sort/pagination
 * API-14: Staff Queue invalid query parameters
 * API-15: Staff Queue role gate
 */
import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../../src/server.js';
import prisma from '../../src/prisma.js';

// Pre-hashed 'LocalOnly1!' with cost 12
const localPasswordHash = '$2b$12$MvQuSTNtpiuJmfaKc7j0Nu0FipBQuY31F6ojkIMWw2OMTZoK5lUkq';

// Helper: log in and return a supertest agent with session cookie
async function loginAs(email: string): Promise<request.Test & { agent: request.SuperAgentTest }> {
  const agent = request.agent(app);
  await agent
    .post('/api/auth/login')
    .set('X-Requested-With', 'XMLHttpRequest')
    .send({ email, password: 'LocalOnly1!' });
  return agent as unknown as request.Test & { agent: request.SuperAgentTest };
}

function agentFor(email: string) {
  const agent = request.agent(app);
  const ready = agent
    .post('/api/auth/login')
    .set('X-Requested-With', 'XMLHttpRequest')
    .send({ email, password: 'LocalOnly1!' });
  return { agent, ready };
}

// Seed a few tickets for queue tests
async function seedQueueTickets() {
  const [cat] = await prisma.category.findMany({ take: 1 });
  const [sys] = await prisma.relatedSystem.findMany({ take: 1 });
  const requester = await prisma.user.findFirst({ where: { role: 'REQUESTER', isActive: true }, orderBy: { id: 'asc' } });
  const staffUser = await prisma.user.findFirst({ where: { role: 'IT_STAFF', isActive: true }, orderBy: { id: 'asc' } });

  if (!cat || !sys || !requester || !staffUser) return;

  // Clear existing test tickets
  await prisma.ticket.deleteMany({ where: { summary: { startsWith: '[QUEUE-TEST]' } } });

  await prisma.ticket.createMany({
    data: [
      {
        ticketNumber: 'TICK-TEST-Q001',
        summary: '[QUEUE-TEST] Assigned ticket',
        description: 'A ticket assigned to IT staff',
        requestedPriority: 'High',
        itPriority: 'High',
        status: 'Open',
        requesterId: requester.id,
        ownerId: staffUser.id,
        categoryId: cat.id,
        relatedSystemId: sys.id,
      },
      {
        ticketNumber: 'TICK-TEST-Q002',
        summary: '[QUEUE-TEST] Unassigned ticket',
        description: 'An unassigned ticket',
        requestedPriority: 'Low',
        itPriority: 'Low',
        status: 'New',
        requesterId: requester.id,
        ownerId: null,
        categoryId: cat.id,
        relatedSystemId: sys.id,
      },
      {
        ticketNumber: 'TICK-TEST-Q003',
        summary: '[QUEUE-TEST] Urgent ticket',
        description: 'An urgent ticket',
        requestedPriority: 'Urgent',
        itPriority: 'Urgent',
        status: 'In Progress',
        requesterId: requester.id,
        ownerId: staffUser.id,
        categoryId: cat.id,
        relatedSystemId: sys.id,
      },
    ],
  });
}

beforeEach(async () => {
  const queueUsers = await prisma.user.findMany({
    where: {
      email: {
        in: [
          'marcus@example.com',
          'noah.it@example.com',
          'admin@example.com',
        ],
      },
    },
    select: { id: true }
  });
  await prisma.session.deleteMany({
    where: { userId: { in: queueUsers.map((u) => u.id) } }
  });

  await prisma.user.updateMany({
    where: {
      email: {
        in: [
          'marcus@example.com',
          'noah.it@example.com',
          'admin@example.com',
        ],
      },
    },
    data: {
      passwordHash: localPasswordHash,
      mustChangePassword: false,
    },
  });

  await seedQueueTickets();
});


describe('API-15: Staff Queue role gate', () => {
  it('returns 401 for unauthenticated request', async () => {
    const res = await request(app).get('/api/staff/tickets');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns 403 for REQUESTER role', async () => {
    const { agent, ready } = agentFor('marcus@example.com');
    await ready;
    const res = await agent.get('/api/staff/tickets');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 200 for IT_STAFF role', async () => {
    const { agent, ready } = agentFor('noah.it@example.com');
    await ready;
    const res = await agent.get('/api/staff/tickets');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('tickets');
    expect(res.body).toHaveProperty('pagination');
    expect(res.body).toHaveProperty('sort');
  });

  it('returns 200 for ADMINISTRATOR role', async () => {
    const { agent, ready } = agentFor('admin@example.com');
    await ready;
    const res = await agent.get('/api/staff/tickets');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('tickets');
  });
});

describe('API-13: Staff Queue search/filter/sort/pagination', () => {
  it('returns all tickets with default params (no filter)', async () => {
    const { agent, ready } = agentFor('noah.it@example.com');
    await ready;
    const res = await agent.get('/api/staff/tickets');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.tickets)).toBe(true);
    expect(res.body.pagination).toMatchObject({
      page: 1,
      pageSize: 10,
      hasNextPage: expect.any(Boolean),
      hasPreviousPage: false,
      totalItems: expect.any(Number),
      totalPages: expect.any(Number),
    });
    expect(res.body.sort).toEqual({ sortBy: 'createdAt', sortOrder: 'desc' });
  });

  it('filters by search term (summary match)', async () => {
    const { agent, ready } = agentFor('noah.it@example.com');
    await ready;
    const res = await agent.get('/api/staff/tickets?search=QUEUE-TEST');
    expect(res.status).toBe(200);
    expect(res.body.tickets.every((t: { summary: string }) => t.summary.includes('[QUEUE-TEST]'))).toBe(true);
    expect(res.body.pagination.totalItems).toBeGreaterThanOrEqual(3);
  });

  it('filters by status', async () => {
    const { agent, ready } = agentFor('noah.it@example.com');
    await ready;
    const res = await agent.get('/api/staff/tickets?search=QUEUE-TEST&status=New');
    expect(res.status).toBe(200);
    expect(res.body.tickets.every((t: { status: string }) => t.status === 'New')).toBe(true);
  });

  it('filters by itPriority', async () => {
    const { agent, ready } = agentFor('noah.it@example.com');
    await ready;
    const res = await agent.get('/api/staff/tickets?search=QUEUE-TEST&itPriority=Urgent');
    expect(res.status).toBe(200);
    expect(res.body.tickets.every((t: { itPriority: string }) => t.itPriority === 'Urgent')).toBe(true);
  });

  it('filters by ownerId=unassigned', async () => {
    const { agent, ready } = agentFor('noah.it@example.com');
    await ready;
    const res = await agent.get('/api/staff/tickets?search=QUEUE-TEST&ownerId=unassigned');
    expect(res.status).toBe(200);
    expect(res.body.tickets.every((t: { owner: null | object }) => t.owner === null)).toBe(true);
  });

  it('filters by ownerId (numeric — returns only assigned-to-that-owner)', async () => {
    const staffUser = await prisma.user.findFirst({ where: { role: 'IT_STAFF', isActive: true }, orderBy: { id: 'asc' } });
    const { agent, ready } = agentFor('noah.it@example.com');
    await ready;
    const res = await agent.get(`/api/staff/tickets?search=QUEUE-TEST&ownerId=${staffUser!.id}`);
    expect(res.status).toBe(200);
    expect(res.body.tickets.every((t: { owner: { id: number } | null }) => t.owner?.id === staffUser!.id)).toBe(true);
  });

  it('filters by categoryId', async () => {
    const [cat] = await prisma.category.findMany({ take: 1 });
    const { agent, ready } = agentFor('noah.it@example.com');
    await ready;
    const res = await agent.get(`/api/staff/tickets?search=QUEUE-TEST&categoryId=${cat.id}`);
    expect(res.status).toBe(200);
    expect(res.body.tickets.every((t: { category: { id: number } }) => t.category.id === cat.id)).toBe(true);
  });

  it('sorts by updatedAt ascending', async () => {
    const { agent, ready } = agentFor('noah.it@example.com');
    await ready;
    const res = await agent.get('/api/staff/tickets?search=QUEUE-TEST&sortBy=updatedAt&sortOrder=asc');
    expect(res.status).toBe(200);
    expect(res.body.sort).toEqual({ sortBy: 'updatedAt', sortOrder: 'asc' });
    const dates = res.body.tickets.map((t: { updatedAt: string }) => new Date(t.updatedAt).getTime());
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]).toBeGreaterThanOrEqual(dates[i - 1]);
    }
  });

  it('supports pagination — page 1 with pageSize 1', async () => {
    const { agent, ready } = agentFor('noah.it@example.com');
    await ready;
    const res = await agent.get('/api/staff/tickets?search=QUEUE-TEST&page=1&pageSize=1');
    expect(res.status).toBe(200);
    expect(res.body.tickets).toHaveLength(1);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.pageSize).toBe(1);
    expect(res.body.pagination.totalPages).toBeGreaterThanOrEqual(3);
    expect(res.body.pagination.hasNextPage).toBe(true);
    expect(res.body.pagination.hasPreviousPage).toBe(false);
  });

  it('each ticket in response includes owner shape (null when unassigned)', async () => {
    const { agent, ready } = agentFor('noah.it@example.com');
    await ready;
    const res = await agent.get('/api/staff/tickets?search=QUEUE-TEST');
    expect(res.status).toBe(200);
    for (const ticket of res.body.tickets) {
      if (ticket.owner !== null) {
        expect(ticket.owner).toMatchObject({ id: expect.any(Number), name: expect.any(String) });
      } else {
        expect(ticket.owner).toBeNull();
      }
      expect(ticket.itPriority).toBeDefined();
      expect(ticket.category).toMatchObject({ id: expect.any(Number), name: expect.any(String) });
    }
  });
});

describe('API-14: Staff Queue invalid query parameters', () => {
  it('returns 400 for unknown query parameter', async () => {
    const { agent, ready } = agentFor('noah.it@example.com');
    await ready;
    const res = await agent.get('/api/staff/tickets?unknownParam=foo');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_QUERY_PARAMETER');
  });

  it('returns 400 for non-positive page', async () => {
    const { agent, ready } = agentFor('noah.it@example.com');
    await ready;
    const res = await agent.get('/api/staff/tickets?page=0');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_QUERY_PARAMETER');
  });

  it('returns 400 for non-integer page', async () => {
    const { agent, ready } = agentFor('noah.it@example.com');
    await ready;
    const res = await agent.get('/api/staff/tickets?page=abc');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_QUERY_PARAMETER');
  });

  it('returns 400 for pageSize > 100', async () => {
    const { agent, ready } = agentFor('noah.it@example.com');
    await ready;
    const res = await agent.get('/api/staff/tickets?pageSize=101');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_QUERY_PARAMETER');
  });

  it('returns 400 for pageSize=0', async () => {
    const { agent, ready } = agentFor('noah.it@example.com');
    await ready;
    const res = await agent.get('/api/staff/tickets?pageSize=0');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_QUERY_PARAMETER');
  });

  it('returns 400 for unsupported itPriority value', async () => {
    const { agent, ready } = agentFor('noah.it@example.com');
    await ready;
    const res = await agent.get('/api/staff/tickets?itPriority=Critical');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_QUERY_PARAMETER');
  });

  it('returns 400 for unsupported status value', async () => {
    const { agent, ready } = agentFor('noah.it@example.com');
    await ready;
    const res = await agent.get('/api/staff/tickets?status=Invalid');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_QUERY_PARAMETER');
  });

  it('returns 400 for unsupported sortBy value', async () => {
    const { agent, ready } = agentFor('noah.it@example.com');
    await ready;
    const res = await agent.get('/api/staff/tickets?sortBy=invalidField');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_QUERY_PARAMETER');
  });

  it('returns 400 for unsupported sortOrder value', async () => {
    const { agent, ready } = agentFor('noah.it@example.com');
    await ready;
    const res = await agent.get('/api/staff/tickets?sortOrder=random');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_QUERY_PARAMETER');
  });

  it('returns 400 for invalid ownerId (neither integer nor "unassigned")', async () => {
    const { agent, ready } = agentFor('noah.it@example.com');
    await ready;
    const res = await agent.get('/api/staff/tickets?ownerId=notanid');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_QUERY_PARAMETER');
  });

  it('returns 400 for invalid categoryId', async () => {
    const { agent, ready } = agentFor('noah.it@example.com');
    await ready;
    const res = await agent.get('/api/staff/tickets?categoryId=nope');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_QUERY_PARAMETER');
  });
});

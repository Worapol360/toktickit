import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { sessionFindUniqueMock, ticketFindManyMock, ticketCountMock, connectMock } = vi.hoisted(() => ({
  sessionFindUniqueMock: vi.fn(),
  ticketFindManyMock: vi.fn(),
  ticketCountMock: vi.fn(),
  connectMock: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../src/prisma.js', () => ({
  default: {
    $connect: connectMock,
    session: { findUnique: sessionFindUniqueMock },
    ticket: { findMany: ticketFindManyMock, count: ticketCountMock }
  }
}));

import request from 'supertest';
import { app } from '../../src/server.js';

const authCookie = 'ttik_session=valid-requester-token';
const activeSession = {
  id: 1,
  userId: 1,
  tokenHash: 'test-token-hash',
  expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
  revokedAt: null,
  user: {
    id: 1,
    name: 'Aiko Tanaka',
    email: 'aiko@example.com',
    role: 'REQUESTER',
    isActive: true,
    mustChangePassword: false
  }
};

const ticket = {
  id: 11,
  ticketNumber: 'TICK-20260905-0011',
  summary: 'Cannot access shared drive',
  description: 'The Finance shared drive is unavailable.',
  requestedPriority: 'High',
  status: 'New',
  requesterId: 1,
  category: { id: 2, name: 'Hardware', code: 'HARDWARE', isActive: true },
  relatedSystem: { id: 1, name: 'File Services', code: 'FILE_SERVICES', isActive: true },
  attachments: [],
  createdAt: new Date('2026-09-05T12:00:00.000Z'),
  updatedAt: new Date('2026-09-05T12:00:00.000Z')
};

beforeEach(() => {
  sessionFindUniqueMock.mockResolvedValue(activeSession);
});

afterEach(() => vi.clearAllMocks());

describe('Issue 4 My Tickets API', () => {
  it('API-10 returns requester-scoped tickets with deterministic sorting and metadata', async () => {
    ticketCountMock.mockResolvedValue(1);
    ticketFindManyMock.mockResolvedValue([ticket]);

    const response = await request(app)
      .get('/api/tickets?search=drive&priority=High&categoryId=2&sortBy=createdAt&sortOrder=desc&page=1&pageSize=25')
      .set('Cookie', authCookie);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      tickets: [expect.objectContaining({ ticketNumber: ticket.ticketNumber })],
      pagination: {
        page: 1,
        pageSize: 25,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false
      },
      sort: { sortBy: 'createdAt', sortOrder: 'desc' }
    });
    expect(ticketFindManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ requesterId: 1 }),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 0,
      take: 25
    }));
  });

  it('API-11 returns 400 INVALID_QUERY_PARAMETER and treats empty values as omitted', async () => {
    ticketCountMock.mockResolvedValue(0);
    ticketFindManyMock.mockResolvedValue([]);

    const empty = await request(app)
      .get('/api/tickets?search=&status=&priority=&categoryId=&sortBy=&sortOrder=&page=&pageSize=')
      .set('Cookie', authCookie);
    expect(empty.status).toBe(200);

    const invalid = await request(app)
      .get('/api/tickets?unknown=value')
      .set('Cookie', authCookie);
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('INVALID_QUERY_PARAMETER');

    const oversized = await request(app)
      .get('/api/tickets?pageSize=101')
      .set('Cookie', authCookie);
    expect(oversized.status).toBe(400);
    expect(oversized.body.error.code).toBe('INVALID_QUERY_PARAMETER');
  });

  it('API-12 rejects invalid requester context and never accepts requesterId from the query', async () => {
    sessionFindUniqueMock.mockResolvedValueOnce(null);

    const unauthenticated = await request(app)
      .get('/api/tickets')
      .set('Cookie', 'ttik_session=invalid-token');

    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body.error.code).toBe('UNAUTHENTICATED');
    expect(ticketFindManyMock).not.toHaveBeenCalled();

    const queryRejection = await request(app)
      .get('/api/tickets?requesterId=2')
      .set('Cookie', authCookie);

    expect(queryRejection.status).toBe(400);
    expect(queryRejection.body.error.code).toBe('INVALID_QUERY_PARAMETER');
    expect(ticketFindManyMock).not.toHaveBeenCalled();
  });

  it('API-10 uses totalPages=0 for an empty unfiltered result', async () => {
    ticketCountMock.mockResolvedValue(0);
    ticketFindManyMock.mockResolvedValue([]);

    const response = await request(app)
      .get('/api/tickets')
      .set('Cookie', authCookie);

    expect(response.status).toBe(200);
    expect(response.body.pagination).toEqual({
      page: 1,
      pageSize: 10,
      totalItems: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false
    });
  });
});
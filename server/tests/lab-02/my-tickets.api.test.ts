import { afterEach, describe, expect, it, vi } from 'vitest';

const { requesterFindUniqueMock, ticketFindManyMock, ticketCountMock, categoryFindManyMock, connectMock } = vi.hoisted(() => ({
  requesterFindUniqueMock: vi.fn(),
  ticketFindManyMock: vi.fn(),
  ticketCountMock: vi.fn(),
  categoryFindManyMock: vi.fn(),
  connectMock: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../src/prisma.js', () => ({
  default: {
    $connect: connectMock,
    requesterUser: { findUnique: requesterFindUniqueMock },
    ticket: { findMany: ticketFindManyMock, count: ticketCountMock }
  }
}));

import request from 'supertest';
import { app } from '../../src/server.js';

const activeRequester = { id: 1, name: 'Aiko Tanaka', isActive: true };
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

afterEach(() => vi.clearAllMocks());

describe('Issue 4 My Tickets API', () => {
  it('API-10 returns requester-scoped tickets with deterministic sorting and metadata', async () => {
    requesterFindUniqueMock.mockResolvedValue(activeRequester);
    ticketCountMock.mockResolvedValue(1);
    ticketFindManyMock.mockResolvedValue([ticket]);

    const response = await request(app)
      .get('/api/tickets?search=drive&priority=High&categoryId=2&sortBy=createdAt&sortOrder=desc&page=1&pageSize=25')
      .set('X-Requester-Id', '1');

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
    requesterFindUniqueMock.mockResolvedValue(activeRequester);
    ticketCountMock.mockResolvedValue(0);
    ticketFindManyMock.mockResolvedValue([]);

    const empty = await request(app)
      .get('/api/tickets?search=&status=&priority=&categoryId=&sortBy=&sortOrder=&page=&pageSize=')
      .set('X-Requester-Id', '1');
    expect(empty.status).toBe(200);

    const invalid = await request(app)
      .get('/api/tickets?unknown=value')
      .set('X-Requester-Id', '1');
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('INVALID_QUERY_PARAMETER');

    const oversized = await request(app)
      .get('/api/tickets?pageSize=101')
      .set('X-Requester-Id', '1');
    expect(oversized.status).toBe(400);
    expect(oversized.body.error.code).toBe('INVALID_QUERY_PARAMETER');
  });

  it('API-12 rejects invalid requester context and never accepts requesterId from the query', async () => {
    requesterFindUniqueMock.mockResolvedValue(null);

    const response = await request(app)
      .get('/api/tickets?requesterId=2')
      .set('X-Requester-Id', 'not-a-number');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('REQUESTER_CONTEXT_INVALID');
    expect(ticketFindManyMock).not.toHaveBeenCalled();
  });

  it('API-10 uses totalPages=0 for an empty unfiltered result', async () => {
    requesterFindUniqueMock.mockResolvedValue(activeRequester);
    ticketCountMock.mockResolvedValue(0);
    ticketFindManyMock.mockResolvedValue([]);

    const response = await request(app)
      .get('/api/tickets')
      .set('X-Requester-Id', '1');

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
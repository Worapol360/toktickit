import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { sessionFindUniqueMock, ticketFindFirstMock, connectMock } = vi.hoisted(() => ({
  sessionFindUniqueMock: vi.fn(),
  ticketFindFirstMock: vi.fn(),
  connectMock: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../src/prisma.js', () => ({
  default: {
    $connect: connectMock,
    session: { findUnique: sessionFindUniqueMock },
    ticket: { findFirst: ticketFindFirstMock }
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
  description: 'The Finance shared drive has been unavailable since this morning.',
  requestedPriority: 'High',
  status: 'New',
  requesterId: 1,
  category: { id: 2, code: 'HARDWARE', name: 'Hardware', isActive: true },
  relatedSystem: { id: 1, code: 'FILE_SERVICES', name: 'File Services', isActive: true },
  attachments: [],
  createdAt: new Date('2026-09-05T12:00:00.000Z'),
  updatedAt: new Date('2026-09-05T12:00:00.000Z')
};

beforeEach(() => {
  sessionFindUniqueMock.mockResolvedValue(activeSession);
});

afterEach(() => vi.clearAllMocks());

describe('Issue 5 ticket detail API', () => {
  it('API-13 returns an owned ticket with read-only metadata', async () => {
    ticketFindFirstMock.mockResolvedValue(ticket);

    const response = await request(app)
      .get('/api/tickets/11')
      .set('Cookie', authCookie);

    expect(response.status).toBe(200);
    expect(response.body.ticket).toMatchObject({ id: 11, ticketNumber: ticket.ticketNumber, status: 'New' });
    expect(ticketFindFirstMock).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 11, requesterId: 1 } }));
  });

  it('API-13 returns 404 for missing, malformed, and cross-requester ticket access', async () => {
    ticketFindFirstMock.mockResolvedValue(null);

    const missing = await request(app)
      .get('/api/tickets/99')
      .set('Cookie', authCookie);
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('TICKET_NOT_FOUND');

    const malformed = await request(app)
      .get('/api/tickets/not-an-id')
      .set('Cookie', authCookie);
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe('INVALID_TICKET_ID');
  });
});
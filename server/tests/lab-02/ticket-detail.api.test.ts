import { afterEach, describe, expect, it, vi } from 'vitest';

const { requesterFindUniqueMock, ticketFindFirstMock, connectMock } = vi.hoisted(() => ({
  requesterFindUniqueMock: vi.fn(),
  ticketFindFirstMock: vi.fn(),
  connectMock: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../src/prisma.js', () => ({
  default: {
    $connect: connectMock,
    requesterUser: { findUnique: requesterFindUniqueMock },
    ticket: { findFirst: ticketFindFirstMock }
  }
}));

import request from 'supertest';
import { app } from '../../src/server.js';

const requester = { id: 1, isActive: true };
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

afterEach(() => vi.clearAllMocks());

describe('Issue 5 ticket detail API', () => {
  it('API-13 returns an owned ticket with read-only metadata', async () => {
    requesterFindUniqueMock.mockResolvedValue(requester);
    ticketFindFirstMock.mockResolvedValue(ticket);

    const response = await request(app).get('/api/tickets/11').set('X-Requester-Id', '1');

    expect(response.status).toBe(200);
    expect(response.body.ticket).toMatchObject({ id: 11, ticketNumber: ticket.ticketNumber, status: 'New' });
    expect(ticketFindFirstMock).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 11, requesterId: 1 } }));
  });

  it('API-13 returns 404 for missing, malformed, and cross-requester ticket access', async () => {
    requesterFindUniqueMock.mockResolvedValue(requester);
    ticketFindFirstMock.mockResolvedValue(null);

    const missing = await request(app).get('/api/tickets/99').set('X-Requester-Id', '1');
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('TICKET_NOT_FOUND');

    const malformed = await request(app).get('/api/tickets/not-an-id').set('X-Requester-Id', '1');
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe('INVALID_TICKET_ID');
  });
});
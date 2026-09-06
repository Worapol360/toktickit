import { afterEach, describe, expect, it, vi } from 'vitest';

const { requesterFindUniqueMock, ticketFindFirstMock, attachmentFindFirstMock, attachmentFindUniqueMock, attachmentUpdateMock, transactionMock, connectMock } = vi.hoisted(() => ({
  requesterFindUniqueMock: vi.fn(),
  ticketFindFirstMock: vi.fn(),
  attachmentFindFirstMock: vi.fn(),
  attachmentFindUniqueMock: vi.fn(),
  attachmentUpdateMock: vi.fn(),
  transactionMock: vi.fn(),
  connectMock: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../src/prisma.js', () => ({
  default: {
    $connect: connectMock,
    requesterUser: { findUnique: requesterFindUniqueMock },
    ticket: { findFirst: ticketFindFirstMock },
    attachment: { findFirst: attachmentFindFirstMock, findUnique: attachmentFindUniqueMock, update: attachmentUpdateMock },
    $transaction: transactionMock
  }
}));

import request from 'supertest';
import { app } from '../../src/server.js';

const requester = { id: 1, isActive: true };
const attachment = {
  id: 41,
  ticketId: 11,
  fileName: 'screen.png',
  fileSize: 245760,
  fileType: 'image/png',
  filePath: 'private/uuid.png',
  isRemoved: false,
  removalReason: null,
  createdAt: new Date('2026-09-05T12:00:00.000Z')
};

afterEach(() => vi.clearAllMocks());

describe('Issue 5 attachment API', () => {
  it('API-15 returns owned attachment metadata without filePath', async () => {
    requesterFindUniqueMock.mockResolvedValue(requester);
    attachmentFindFirstMock.mockResolvedValue({ ...attachment, ticket: { requesterId: 1 } });

    const response = await request(app).get('/api/tickets/11/attachments/41').set('X-Requester-Id', '1');

    expect(response.status).toBe(200);
    expect(response.body.attachment).toMatchObject({ id: 41, fileName: 'screen.png', isRemoved: false });
    expect(response.body.attachment.filePath).toBeUndefined();
  });

  it('API-14 rejects an upload batch that would exceed five active attachments', async () => {
    requesterFindUniqueMock.mockResolvedValue(requester);
    ticketFindFirstMock.mockResolvedValue({ id: 11, requesterId: 1, attachments: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }] });

    const response = await request(app)
      .post('/api/tickets/11/attachments')
      .set('X-Requester-Id', '1')
      .attach('attachments', Buffer.from('one'), 'one.png')
      .attach('attachments', Buffer.from('two'), 'two.png');

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('ATTACHMENT_LIMIT_EXCEEDED');
  });

  it('API-16 returns 404 for removed attachment downloads', async () => {
    requesterFindUniqueMock.mockResolvedValue(requester);
    attachmentFindFirstMock.mockResolvedValue({ ...attachment, isRemoved: true, ticket: { requesterId: 1 } });

    const response = await request(app).get('/api/tickets/11/attachments/41/download').set('X-Requester-Id', '1');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('ATTACHMENT_NOT_FOUND');
  });

  it('API-17/API-18 validates removal reasons and supports same-reason idempotency', async () => {
    requesterFindUniqueMock.mockResolvedValue(requester);
    attachmentFindUniqueMock.mockResolvedValue({ ...attachment, isRemoved: true, removalReason: 'Wrong version', ticket: { requesterId: 1 } });

    const invalid = await request(app).delete('/api/tickets/11/attachments/41').set('X-Requester-Id', '1').send({ removalReason: 'bad' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');

    const repeated = await request(app).delete('/api/tickets/11/attachments/41').set('X-Requester-Id', '1').send({ removalReason: 'Wrong version' });
    expect(repeated.status).toBe(200);
    expect(repeated.body.attachment.isRemoved).toBe(true);
  });
});
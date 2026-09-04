import { afterEach, describe, expect, it, vi } from 'vitest';

const { requesterFindUniqueMock, categoryFindUniqueMock, relatedSystemFindUniqueMock, relatedSystemFindManyMock, ticketCreateMock, ticketFindFirstMock, transactionMock, connectMock } = vi.hoisted(() => ({
  requesterFindUniqueMock: vi.fn(),
  categoryFindUniqueMock: vi.fn(),
  relatedSystemFindUniqueMock: vi.fn(),
  relatedSystemFindManyMock: vi.fn(),
  ticketCreateMock: vi.fn(),
  ticketFindFirstMock: vi.fn(),
  transactionMock: vi.fn(),
  connectMock: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../src/prisma.js', () => ({
  default: {
    $connect: connectMock,
    requesterUser: { findUnique: requesterFindUniqueMock },
    category: { findUnique: categoryFindUniqueMock },
    relatedSystem: { findUnique: relatedSystemFindUniqueMock, findMany: relatedSystemFindManyMock },
    ticket: { create: ticketCreateMock, findFirst: ticketFindFirstMock },
    $transaction: transactionMock
  }
}));

import request from 'supertest';
import { app } from '../../src/server.js';

const validBody = {
  summary: '  Cannot access shared drive  ',
  description: '  The Finance shared drive has been unavailable since this morning.  ',
  requestedPriority: 'High',
  categoryId: 1,
  relatedSystemId: 1
};

const activeRequester = { id: 1, name: 'Aiko Tanaka', email: 'aiko@example.com', department: 'Finance', isActive: true };
const activeCategory = { id: 1, name: 'Hardware', code: 'HARDWARE', isActive: true };
const activeRelatedSystem = { id: 1, name: 'File Services', code: 'FILE_SERVICES', isActive: true };

afterEach(() => {
  vi.clearAllMocks();
});

function arrangeValidCreation() {
  requesterFindUniqueMock.mockResolvedValue(activeRequester);
  categoryFindUniqueMock.mockResolvedValue(activeCategory);
  relatedSystemFindUniqueMock.mockResolvedValue(activeRelatedSystem);
  ticketFindFirstMock.mockResolvedValue(null);
  ticketCreateMock.mockResolvedValue({
    id: 101,
    ticketNumber: 'TICK-20260904-0001',
    summary: 'Cannot access shared drive',
    description: 'The Finance shared drive has been unavailable since this morning.',
    requestedPriority: 'High',
    status: 'New',
    requesterId: 1,
    categoryId: 1,
    relatedSystemId: 1,
    category: activeCategory,
    relatedSystem: activeRelatedSystem,
    attachments: [],
    createdAt: new Date('2026-09-04T09:30:00.000Z'),
    updatedAt: new Date('2026-09-04T09:30:00.000Z')
  });
  transactionMock.mockImplementation(async (callback: (transaction: { ticket: { create: typeof ticketCreateMock } }) => unknown) => callback({ ticket: { create: ticketCreateMock } }));
}

describe('Issue 3 Create Ticket API', () => {
  it('API-03 returns active related systems in stable order', async () => {
    relatedSystemFindManyMock.mockResolvedValue([activeRelatedSystem]);

    const response = await request(app).get('/api/related-systems');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ relatedSystems: [activeRelatedSystem] });
  });

  it('API-02/API-04 creates a trimmed New ticket for an active requester', async () => {
    arrangeValidCreation();

    const response = await request(app)
      .post('/api/tickets')
      .set('X-Requester-Id', '1')
      .send(validBody);

    expect(response.status).toBe(201);
    expect(response.body.ticket.ticketNumber).toMatch(/^TICK-\d{8}-\d{4}$/);
    expect(response.body.ticket.status).toBe('New');
    expect(response.body.ticket.summary).toBe('Cannot access shared drive');
    expect(ticketCreateMock).toHaveBeenCalled();
  });

  it('API-02 rejects missing, malformed, and inactive requester context', async () => {
    requesterFindUniqueMock.mockResolvedValue(null);

    for (const requesterId of [undefined, 'not-a-number', '99']) {
      const requestBuilder = request(app).post('/api/tickets').send(validBody);
      if (requesterId) requestBuilder.set('X-Requester-Id', requesterId);
      const response = await requestBuilder;
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('REQUESTER_CONTEXT_INVALID');
    }
  });

  it('API-05 returns field errors for invalid ticket metadata', async () => {
    requesterFindUniqueMock.mockResolvedValue(activeRequester);

    const response = await request(app)
      .post('/api/tickets')
      .set('X-Requester-Id', '1')
      .send({ summary: 'bad', description: 'short', requestedPriority: 'Unknown', categoryId: 'x' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.fields).toEqual(expect.objectContaining({
      summary: expect.any(String),
      description: expect.any(String),
      requestedPriority: expect.any(String),
      categoryId: expect.any(String),
      relatedSystemId: expect.any(String)
    }));
  });

  it('API-08 rejects an identical recent submission without creating another ticket', async () => {
    requesterFindUniqueMock.mockResolvedValue(activeRequester);
    ticketFindFirstMock.mockResolvedValue({ id: 101 });

    const response = await request(app)
      .post('/api/tickets')
      .set('X-Requester-Id', '1')
      .send(validBody);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('DUPLICATE_SUBMISSION');
    expect(ticketCreateMock).not.toHaveBeenCalled();
  });

  it('API-06/API-07 rejects invalid, oversized, and sixth attachments', async () => {
    arrangeValidCreation();

    const unsupported = await request(app)
      .post('/api/tickets')
      .set('X-Requester-Id', '1')
      .field(validBody)
      .attach('attachments', Buffer.from('not an executable'), 'malware.exe');

    expect(unsupported.status).toBe(400);
    expect(unsupported.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');
    expect(ticketCreateMock).not.toHaveBeenCalled();

    const oversized = await request(app)
      .post('/api/tickets')
      .set('X-Requester-Id', '1')
      .field(validBody)
      .attach('attachments', Buffer.alloc(5 * 1024 * 1024 + 1), 'large.pdf');

    expect(oversized.status).toBe(400);
    expect(oversized.body.error.code).toBe('FILE_TOO_LARGE');

    const tooMany = request(app)
      .post('/api/tickets')
      .set('X-Requester-Id', '1')
      .field(validBody);
    for (let index = 0; index < 6; index += 1) {
      tooMany.attach('attachments', Buffer.from(`valid image ${index}`), `screen-${index}.png`);
    }
    const tooManyResponse = await tooMany;

    expect(tooManyResponse.status).toBe(400);
    expect(tooManyResponse.body.error.code).toBe('ATTACHMENT_LIMIT_EXCEEDED');
  });

  it('API-09 rolls back ticket creation when attachment persistence fails', async () => {
    arrangeValidCreation();
    transactionMock.mockRejectedValue(new Error('attachment write failed'));

    const response = await request(app)
      .post('/api/tickets')
      .set('X-Requester-Id', '1')
      .field(validBody)
      .attach('attachments', Buffer.from('valid image'), 'screen.png');

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('ATTACHMENT_UPLOAD_FAILED');
  });
});
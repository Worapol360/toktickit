import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { findManyMock, sessionFindUniqueMock, connectMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  sessionFindUniqueMock: vi.fn(),
  connectMock: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../src/prisma.js', () => ({
  default: {
    $connect: connectMock,
    session: { findUnique: sessionFindUniqueMock },
    category: {
      findMany: findManyMock
    }
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

beforeEach(() => {
  sessionFindUniqueMock.mockResolvedValue(activeSession);
});

afterEach(() => {
  findManyMock.mockReset();
  sessionFindUniqueMock.mockReset();
});

describe('Issue 4 categories API', () => {
  it('returns categories from Prisma in a predictable order', async () => {
    findManyMock.mockResolvedValue([
      { id: 1, code: 'ACCOUNT_ACCESS', name: 'Account and Access', isActive: true },
      { id: 2, code: 'HARDWARE', name: 'Hardware', isActive: true },
      { id: 3, code: 'SOFTWARE', name: 'Software', isActive: true },
      { id: 4, code: 'NETWORK', name: 'Network', isActive: true }
    ]);

    const response = await request(app)
      .get('/api/categories')
      .set('Cookie', authCookie);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      categories: [
        { id: 1, code: 'ACCOUNT_ACCESS', name: 'Account and Access', isActive: true },
        { id: 2, code: 'HARDWARE', name: 'Hardware', isActive: true },
        { id: 3, code: 'SOFTWARE', name: 'Software', isActive: true },
        { id: 4, code: 'NETWORK', name: 'Network', isActive: true }
      ]
    });
    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        isActive: true
      },
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }]
    });
  });

  it('rejects unauthenticated access with 401 UNAUTHENTICATED', async () => {
    const response = await request(app).get('/api/categories');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
    expect(findManyMock).not.toHaveBeenCalled();
  });
});
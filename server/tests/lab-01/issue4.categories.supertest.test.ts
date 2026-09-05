import { afterEach, describe, expect, it, vi } from 'vitest';

const { findManyMock, connectMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  connectMock: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../src/prisma.js', () => ({
  default: {
    $connect: connectMock,
    category: {
      findMany: findManyMock
    }
  }
}));

import request from 'supertest';
import { app } from '../../src/server.js';

afterEach(() => {
  findManyMock.mockReset();
});

describe('Issue 4 categories API', () => {
  it('returns categories from Prisma in a predictable order', async () => {
    findManyMock.mockResolvedValue([
      { id: 1, code: 'ACCOUNT_ACCESS', name: 'Account and Access', isActive: true },
      { id: 2, code: 'HARDWARE', name: 'Hardware', isActive: true },
      { id: 3, code: 'SOFTWARE', name: 'Software', isActive: true },
      { id: 4, code: 'NETWORK', name: 'Network', isActive: true }
    ]);

    const response = await request(app).get('/api/categories');

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
});
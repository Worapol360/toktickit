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
      { id: 1, name: 'Account and Access' },
      { id: 2, name: 'Hardware' },
      { id: 3, name: 'Software' },
      { id: 4, name: 'Network' }
    ]);

    const response = await request(app).get('/api/categories');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      categories: [
        { id: 1, name: 'Account and Access' },
        { id: 2, name: 'Hardware' },
        { id: 3, name: 'Software' },
        { id: 4, name: 'Network' }
      ]
    });
    expect(findManyMock).toHaveBeenCalledWith({
      select: {
        id: true,
        name: true
      },
      orderBy: {
        id: 'asc'
      }
    });
  });
});
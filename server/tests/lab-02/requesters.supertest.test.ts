import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../../src/server.js';
import prisma from '../../src/prisma.js';

const requesterSeed = [
  { id: 1, name: 'Aiko Tanaka', email: 'aiko@example.com', department: 'Finance', isActive: true },
  { id: 2, name: 'Daniel Kim', email: 'daniel@example.com', department: 'IT', isActive: true },
  { id: 3, name: 'Marcus Lee', email: 'marcus@example.com', department: 'Operations', isActive: true },
  { id: 4, name: 'Priya Singh', email: 'priya@example.com', department: 'Support', isActive: true },
  { id: 5, name: 'Inactive User', email: 'inactive@example.com', department: 'Finance', isActive: false }
];

describe('Issue 2 requester context API', () => {
  beforeEach(async () => {
    await prisma.requesterUser.deleteMany();
    await prisma.requesterUser.createMany({ data: requesterSeed });
  });

  afterEach(async () => {
    await prisma.requesterUser.deleteMany();
  });

  it('GET /api/requesters returns only active requesters ordered by name then id', async () => {
    const response = await request(app).get('/api/requesters');

    expect(response.status).toBe(200);
    expect(response.body.requesters).toHaveLength(4);
    expect(response.body.requesters.map((requester: { name: string }) => requester.name)).toEqual([
      'Aiko Tanaka',
      'Daniel Kim',
      'Marcus Lee',
      'Priya Singh'
    ]);
    expect(response.body.requesters.every((requester: { isActive: boolean }) => requester.isActive === true)).toBe(true);
    expect(response.body.requesters.some((requester: { id: number }) => requester.id === 5)).toBe(false);
  });
});

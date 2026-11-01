import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/server.js';
import prisma from '../../src/prisma.js';

describe('Issue 2 health API', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('GET /api/health responds with service metadata', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.database).toBe('up');
    expect(typeof response.body.time).toBe('string');
    expect(response.body.time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(new Date(response.body.time).toISOString()).toBe(response.body.time);
    expect(response.body).not.toHaveProperty('service');
  });

  it('GET /api/health returns 503 degraded when the database check fails', async () => {
    vi.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('simulated connection failure'));

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      status: 'degraded',
      database: 'down'
    });
  });
});

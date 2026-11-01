import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/server.js';

describe('Issue 2 health API', () => {
  it('GET /api/health returns the expected payload', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.database).toBe('up');
    expect(typeof response.body.time).toBe('string');
    expect(response.body.time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(new Date(response.body.time).toISOString()).toBe(response.body.time);
    expect(response.body).not.toHaveProperty('service');
  });
});

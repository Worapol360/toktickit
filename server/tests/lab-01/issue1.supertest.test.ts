import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/server.js';

describe('Issue 2 health API', () => {
  it('GET /api/health returns the expected payload', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      service: 'TokTickIT API'
    });
  });
});

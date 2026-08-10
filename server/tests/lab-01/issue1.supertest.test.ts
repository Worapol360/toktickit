import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';

const app = express();

describe('Issue 1 server smoke test', () => {
  it('can create an Express app without routes', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(404);
  });
});

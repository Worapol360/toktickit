import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../../src/server.js';
import prisma from '../../src/prisma.js';

const localPasswordHash = '$2b$12$MvQuSTNtpiuJmfaKc7j0Nu0FipBQuY31F6ojkIMWw2OMTZoK5lUkq';

beforeEach(async () => {
  await prisma.session.deleteMany();

  await prisma.user.updateMany({
    where: {
      email: {
        in: [
          'aiko@example.com',
          'daniel@example.com',
          'inactive@example.com',
        ],
      },
    },
    data: {
      passwordHash: localPasswordHash,
      mustChangePassword: true,
    },
  });
});

describe('Lab 3 authentication API', () => {
  it('API-01 logs in an active user and establishes a session', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: 'aiko@example.com', password: 'LocalOnly1!' });

    expect(response.status).toBe(200);
    expect(response.body.user).toEqual(expect.objectContaining({
      email: 'aiko@example.com',
      role: 'REQUESTER'
    }));
    expect(response.headers['set-cookie']?.[0]).toMatch(/ttik_session=/);
  });

  it('API-02 uses the same generic response for unknown email and wrong password', async () => {
    const unknown = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: 'unknown@example.com', password: 'LocalOnly1!' });
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: 'aiko@example.com', password: 'wrong-password1' });

    expect(unknown.status).toBe(401);
    expect(wrongPassword.status).toBe(401);
    expect(unknown.body).toEqual(wrongPassword.body);
    expect(unknown.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('API-03 distinguishes correct credentials for an inactive account', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: 'inactive@example.com', password: 'LocalOnly1!' });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('ACCOUNT_INACTIVE');
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('API-04 blocks normal authenticated routes while password change is required', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: 'aiko@example.com', password: 'LocalOnly1!' });
    const response = await request(app)
      .get('/api/categories')
      .set('Cookie', login.headers['set-cookie']);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });

  it('API-05 changes the initial password and clears the flag', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').set('X-Requested-With', 'XMLHttpRequest').send({ email: 'aiko@example.com', password: 'LocalOnly1!' });
    const response = await agent
      .post('/api/auth/change-password')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ currentPassword: 'LocalOnly1!', newPassword: 'NewSecure1!', confirmNewPassword: 'NewSecure1!' });

    expect(response.status).toBe(200);
    expect(response.body.user.mustChangePassword).toBe(false);
  });

  it('API-06 revokes the session on logout', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').set('X-Requested-With', 'XMLHttpRequest').send({ email: 'daniel@example.com', password: 'LocalOnly1!' });
    const logout = await agent.post('/api/auth/logout').set('X-Requested-With', 'XMLHttpRequest');
    const me = await agent.get('/api/auth/me');

    expect(logout.status).toBe(204);
    expect(me.status).toBe(401);
    expect(me.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('API-07 returns only safe current-user fields', async () => {
    const unauthenticated = await request(app).get('/api/auth/me');

    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body.error.code).toBe('UNAUTHENTICATED');

    const agent = request.agent(app);
    await agent.post('/api/auth/login').set('X-Requested-With', 'XMLHttpRequest').send({ email: 'daniel@example.com', password: 'LocalOnly1!' });
    const authenticated = await agent.get('/api/auth/me');
    expect(authenticated.status).toBe(200);
    expect(authenticated.body).toEqual({
      id: 2,
      name: 'Daniel Kim',
      email: 'daniel@example.com',
      role: 'REQUESTER',
      mustChangePassword: true
    });
    expect(authenticated.body.passwordHash).toBeUndefined();
  });
});

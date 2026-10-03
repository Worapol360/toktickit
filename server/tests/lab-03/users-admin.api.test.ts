import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../../src/server.js';
import prisma from '../../src/prisma.js';

const localPasswordHash = '$2b$12$MvQuSTNtpiuJmfaKc7j0Nu0FipBQuY31F6ojkIMWw2OMTZoK5lUkq';

// Every user this file creates or owns carries the "testadm-fixture-" email prefix.
// Cleanup is always scoped to those emails — never an unscoped updateMany/deleteMany.
const ownedEmailPrefix = 'testadm-fixture-';
const secondAdminEmail = 'admin2@example.com';
// Dedicated admin for this test file to avoid depending on shared seed state.
const testAdminEmail = 'testadm-fixture-admin@example.com';
// The two dedicated admins are created/removed by beforeAll/afterAll and must
// survive the prefix-scoped afterEach cleanup (testadm-fixture-admin@ matches
// the prefix above; admin2@ does not, but is listed for clarity).
const excludedFromCleanup = [testAdminEmail, secondAdminEmail];

function agentFor(email: string) {
  const agent = request.agent(app);
  const ready = agent
    .post('/api/auth/login')
    .set('X-Requested-With', 'XMLHttpRequest')
    .send({ email, password: 'LocalOnly1!' });
  return { agent, ready };
}

async function createFixtureUser(email: string, overrides: { name?: string; role?: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR'; isActive?: boolean } = {}) {
  return prisma.user.create({
    data: {
      name: overrides.name ?? email.split('@')[0],
      email,
      emailNormalized: email.toLowerCase(),
      department: 'IT',
      passwordHash: localPasswordHash,
      role: overrides.role ?? 'REQUESTER',
      isActive: overrides.isActive ?? true,
      mustChangePassword: false
    }
  });
}

async function ownedEmails() {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: ownedEmailPrefix, notIn: excludedFromCleanup } },
    select: { email: true }
  });
  return users.map((user) => user.email);
}

// Create dedicated test admins once per test file to avoid race conditions
// in parallel test execution.
beforeAll(async () => {
  // Clean up any leftover fixture users from previous test runs (all historical prefixes).
  const prefixes = ['admintest.', 'testadm-', 'testadm-fixture-'];
  for (const prefix of prefixes) {
    const leftoverUsers = await prisma.user.findMany({
      where: { email: { startsWith: prefix } },
      select: { id: true }
    });
    if (leftoverUsers.length > 0) {
      await prisma.session.deleteMany({ where: { userId: { in: leftoverUsers.map((u) => u.id) } } });
      await prisma.user.deleteMany({ where: { id: { in: leftoverUsers.map((u) => u.id) } } });
    }
  }

  await prisma.user.upsert({
    where: { emailNormalized: testAdminEmail },
    update: { name: 'Test Admin', role: 'ADMINISTRATOR', isActive: true, mustChangePassword: false, passwordHash: localPasswordHash },
    create: {
      name: 'Test Admin',
      email: testAdminEmail,
      emailNormalized: testAdminEmail,
      department: 'IT',
      passwordHash: localPasswordHash,
      role: 'ADMINISTRATOR',
      isActive: true,
      mustChangePassword: false
    }
  });

  // API-30 needs a SECOND active Administrator so deactivating/role-changing
  // one of two can be tested without touching shared seed data.
  await prisma.user.upsert({
    where: { emailNormalized: secondAdminEmail },
    update: { name: 'Second Admin', role: 'ADMINISTRATOR', isActive: true, mustChangePassword: false, passwordHash: localPasswordHash },
    create: {
      name: 'Second Admin',
      email: secondAdminEmail,
      emailNormalized: secondAdminEmail,
      department: 'IT',
      passwordHash: localPasswordHash,
      role: 'ADMINISTRATOR',
      isActive: true,
      mustChangePassword: false
    }
  });
});

beforeEach(async () => {
  // Reset the test admin's name and flags in case a test modified them.
  await prisma.user.updateMany({
    where: { email: testAdminEmail },
    data: { name: 'Test Admin', role: 'ADMINISTRATOR', isActive: true, mustChangePassword: false }
  });
  // Reset the second admin's flags.
  await prisma.user.updateMany({
    where: { email: secondAdminEmail },
    data: { role: 'ADMINISTRATOR', isActive: true, mustChangePassword: false }
  });
});

afterAll(async () => {
  // Clean up our dedicated test admins.
  const emails = [testAdminEmail, secondAdminEmail];
  const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  await prisma.session.deleteMany({ where: { userId: { in: users.map((user) => user.id) } } });
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
});

afterEach(async () => {
  const emails = await ownedEmails();
  if (emails.length === 0) return;
  const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  await prisma.session.deleteMany({ where: { userId: { in: users.map((user) => user.id) } } });
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
});

// ─── All API tests (sequential to avoid shared admin state conflicts) ──────────

describe.sequential('Admin User API (API-25 to API-30)', () => {

  // ─── API-25: Admin user list search/role filter ──────────────────────────────
  it('returns the user list with safe fields for an Administrator', async () => {
    const { agent, ready } = agentFor(testAdminEmail);
    await ready;

    const response = await agent.get('/api/admin/users');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.users)).toBe(true);
    expect(response.body.users.length).toBeGreaterThan(0);

    const admin = response.body.users.find((user: { email: string }) => user.email === testAdminEmail);
    expect(admin).toMatchObject({ name: 'Test Admin', role: 'ADMINISTRATOR', isActive: true, mustChangePassword: false });
    expect(admin).toHaveProperty('id');
    expect(admin).toHaveProperty('createdAt');
    expect(admin.passwordHash).toBeUndefined();
  });

  it('filters by case-insensitive search over name and email', async () => {
    const { agent, ready } = agentFor(testAdminEmail);
    await ready;

    const byName = await agent.get('/api/admin/users').query({ search: 'NOAH' });
    expect(byName.status).toBe(200);
    expect(byName.body.users).toHaveLength(1);
    expect(byName.body.users[0]).toMatchObject({ name: 'Noah Williams', email: 'noah.it@example.com' });

    const byEmail = await agent.get('/api/admin/users').query({ search: 'priya.IT' });
    expect(byEmail.status).toBe(200);
    expect(byEmail.body.users).toHaveLength(1);
    expect(byEmail.body.users[0]).toMatchObject({ email: 'priya.it@example.com' });
  });

  it('filters by role', async () => {
    const { agent, ready } = agentFor(testAdminEmail);
    await ready;

    const response = await agent.get('/api/admin/users').query({ role: 'IT_STAFF' });
    expect(response.status).toBe(200);
    expect(response.body.users.length).toBeGreaterThan(0);
    expect(response.body.users.every((user: { role: string }) => user.role === 'IT_STAFF')).toBe(true);
  });

  it('combines search and role filter', async () => {
    const { agent, ready } = agentFor(testAdminEmail);
    await ready;

    const response = await agent.get('/api/admin/users').query({ search: 'priya', role: 'IT_STAFF' });
    expect(response.status).toBe(200);
    expect(response.body.users).toHaveLength(1);
    expect(response.body.users[0]).toMatchObject({ email: 'priya.it@example.com', role: 'IT_STAFF' });
  });

  it('rejects an unsupported role filter value', async () => {
    const { agent, ready } = agentFor(testAdminEmail);
    await ready;

    const response = await agent.get('/api/admin/users').query({ role: 'SUPERUSER' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_QUERY_PARAMETER');
  });

  it('returns 403 FORBIDDEN for Requester and IT Staff sessions', async () => {
    // Create dedicated test users with mustChangePassword=false to isolate
    // the FORBIDDEN check from the PASSWORD_CHANGE_REQUIRED middleware.
    const requesterUser = await createFixtureUser('testadm-fixture-403.requester@example.com', { role: 'REQUESTER' });
    const staffUser = await createFixtureUser('testadm-fixture-403.staff@example.com', { role: 'IT_STAFF' });

    const requester = agentFor(requesterUser.email);
    await requester.ready;
    const requesterResponse = await requester.agent.get('/api/admin/users');
    expect(requesterResponse.status).toBe(403);
    expect(requesterResponse.body.error.code).toBe('FORBIDDEN');

    const staff = agentFor(staffUser.email);
    await staff.ready;
    const staffResponse = await staff.agent.get('/api/admin/users');
    expect(staffResponse.status).toBe(403);
    expect(staffResponse.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 401 UNAUTHENTICATED without a session', async () => {
    const response = await request(app).get('/api/admin/users');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });
});

// ─── API-26: Create user, including duplicate email ───────────────────────────

describe('API-26: create user', () => {
  it('creates a user with exactly one role, hashed initial password, and mustChangePassword', async () => {
    const { agent, ready } = agentFor(testAdminEmail);
    await ready;

    const response = await agent
      .post('/api/admin/users')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ name: 'New Staffer', email: 'testadm-fixture-new@example.com', role: 'IT_STAFF', isActive: true, initialPassword: 'Temp1234' });

    expect(response.status).toBe(201);
    expect(response.body.user).toMatchObject({
      name: 'New Staffer',
      email: 'testadm-fixture-new@example.com',
      role: 'IT_STAFF',
      isActive: true,
      mustChangePassword: true
    });
    expect(response.body.user.passwordHash).toBeUndefined();

    // The stored hash must be a real bcrypt hash of the initial password.
    const stored = await prisma.user.findUnique({ where: { emailNormalized: 'testadm-fixture-new@example.com' } });
    expect(stored).not.toBeNull();
    expect(stored!.passwordHash).not.toBe('Temp1234');
    expect(stored!.passwordHash).not.toBe(localPasswordHash);

    // The initial password actually authenticates the new account.
    const loginCheck = agentFor('testadm-fixture-new@example.com');
    await loginCheck.ready;
    const loginResponse = await loginCheck.agent
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: 'testadm-fixture-new@example.com', password: 'Temp1234' });
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.user).toMatchObject({ email: 'testadm-fixture-new@example.com', mustChangePassword: true });
  });

  it('rejects a duplicate email case-insensitively', async () => {
    const { agent, ready } = agentFor(testAdminEmail);
    await ready;

    const first = await agent
      .post('/api/admin/users')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ name: 'First', email: 'testadm-fixture-dup@example.com', role: 'REQUESTER', initialPassword: 'Temp1234' });
    expect(first.status).toBe(201);

    const second = await agent
      .post('/api/admin/users')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ name: 'Second', email: 'testadm-fixture-DUP@example.com', role: 'IT_STAFF', initialPassword: 'Temp5678' });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('EMAIL_ALREADY_IN_USE');

    // Also collides with an existing seed email regardless of case.
    const seedCollision = await agent
      .post('/api/admin/users')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ name: 'Clone', email: 'ADMIN@example.com', role: 'REQUESTER', initialPassword: 'Temp5678' });
    expect(seedCollision.status).toBe(409);
    expect(seedCollision.body.error.code).toBe('EMAIL_ALREADY_IN_USE');
  });

  it('rejects invalid name, email, role, and initial password', async () => {
    const { agent, ready } = agentFor(testAdminEmail);
    await ready;

    const base = { name: 'Valid Name', email: 'testadm-fixture-validation@example.com', role: 'REQUESTER', initialPassword: 'Temp1234' };

    const missingName = await agent.post('/api/admin/users').set('X-Requested-With', 'XMLHttpRequest').send({ ...base, name: '  ' });
    expect(missingName.status).toBe(400);
    expect(missingName.body.error.code).toBe('VALIDATION_ERROR');

    const badEmail = await agent.post('/api/admin/users').set('X-Requested-With', 'XMLHttpRequest').send({ ...base, email: 'not-an-email' });
    expect(badEmail.status).toBe(400);
    expect(badEmail.body.error.code).toBe('VALIDATION_ERROR');

    const badRole = await agent.post('/api/admin/users').set('X-Requested-With', 'XMLHttpRequest').send({ ...base, role: 'SUPERUSER' });
    expect(badRole.status).toBe(400);
    expect(badRole.body.error.code).toBe('VALIDATION_ERROR');

    const shortPassword = await agent.post('/api/admin/users').set('X-Requested-With', 'XMLHttpRequest').send({ ...base, initialPassword: 'short' });
    expect(shortPassword.status).toBe(400);
    expect(shortPassword.body.error.code).toBe('VALIDATION_ERROR');

    const noDigitPassword = await agent.post('/api/admin/users').set('X-Requested-With', 'XMLHttpRequest').send({ ...base, initialPassword: 'NoDigitsHere' });
    expect(noDigitPassword.status).toBe(400);
    expect(noDigitPassword.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ─── API-27: Edit user name/email/role/active state ───────────────────────────

describe('API-27: edit user', () => {
  it('updates name, email, role, and activation state', async () => {
    const target = await createFixtureUser('testadm-fixture-edit@example.com', { name: 'Edit Me', role: 'REQUESTER' });
    const { agent, ready } = agentFor(testAdminEmail);
    await ready;

    const response = await agent
      .patch(`/api/admin/users/${target.id}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ name: 'Edited Name', email: 'testadm-fixture-edited@example.com', role: 'IT_STAFF', isActive: false });

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({
      id: target.id,
      name: 'Edited Name',
      email: 'testadm-fixture-edited@example.com',
      role: 'IT_STAFF',
      isActive: false
    });

    const stored = await prisma.user.findUnique({ where: { id: target.id } });
    expect(stored).toMatchObject({ name: 'Edited Name', emailNormalized: 'testadm-fixture-edited@example.com', role: 'IT_STAFF', isActive: false });
  });

  it('rejects invalid role and email values', async () => {
    const target = await createFixtureUser('testadm-fixture-editinvalid@example.com');
    const { agent, ready } = agentFor(testAdminEmail);
    await ready;

    const badRole = await agent
      .patch(`/api/admin/users/${target.id}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ role: 'SUPERUSER' });
    expect(badRole.status).toBe(400);
    expect(badRole.body.error.code).toBe('VALIDATION_ERROR');

    const badEmail = await agent
      .patch(`/api/admin/users/${target.id}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: 'not-an-email' });
    expect(badEmail.status).toBe(400);
    expect(badEmail.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('never applies a password sent in the edit body', async () => {
    const target = await createFixtureUser('testadm-fixture-nopassword@example.com');
    const { agent, ready } = agentFor(testAdminEmail);
    await ready;

    const response = await agent
      .patch(`/api/admin/users/${target.id}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ name: 'Renamed Only', password: 'Hacked123', initialPassword: 'Hacked123', newInitialPassword: 'Hacked123' });

    expect(response.status).toBe(200);
    expect(response.body.user.name).toBe('Renamed Only');

    const stored = await prisma.user.findUnique({ where: { id: target.id } });
    expect(stored!.name).toBe('Renamed Only');
    expect(stored!.passwordHash).toBe(localPasswordHash);
    expect(stored!.mustChangePassword).toBe(false);
  });

  it('rejects a duplicate email case-insensitively', async () => {
    const target = await createFixtureUser('testadm-fixture-dupedit@example.com');
    const { agent, ready } = agentFor(testAdminEmail);
    await ready;

    const response = await agent
      .patch(`/api/admin/users/${target.id}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: 'AIKO@example.com' });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('EMAIL_ALREADY_IN_USE');
  });

  it('returns 404 USER_NOT_FOUND for a nonexistent user', async () => {
    const { agent, ready } = agentFor(testAdminEmail);
    await ready;

    const response = await agent
      .patch('/api/admin/users/999999')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ name: 'Ghost' });
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('USER_NOT_FOUND');
  });
});

// ─── API-28: Set new initial password ─────────────────────────────────────────

describe('API-28: set new initial password', () => {
  it('sets mustChangePassword and revokes all of the target user\'s existing sessions', async () => {
    const target = await createFixtureUser('testadm-fixture-reset@example.com');
    const { agent, ready } = agentFor(testAdminEmail);
    await ready;

    // Establish a session for the target user.
    const targetLogin = agentFor('testadm-fixture-reset@example.com');
    await targetLogin.ready;
    const meBefore = await targetLogin.agent.get('/api/auth/me');
    expect(meBefore.status).toBe(200);

    const response = await agent
      .post(`/api/admin/users/${target.id}/reset-password`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ newInitialPassword: 'Temp5678' });

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({ id: target.id, mustChangePassword: true });

    // The previously valid session no longer authenticates.
    const meAfter = await targetLogin.agent.get('/api/auth/me');
    expect(meAfter.status).toBe(401);
    expect(meAfter.body.error.code).toBe('UNAUTHENTICATED');

    // The new initial password authenticates and forces a change.
    const relogin = await targetLogin.agent
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: 'testadm-fixture-reset@example.com', password: 'Temp5678' });
    expect(relogin.status).toBe(200);
    expect(relogin.body.user).toMatchObject({ email: 'testadm-fixture-reset@example.com', mustChangePassword: true });
  });

  it('rejects a weak new initial password', async () => {
    const target = await createFixtureUser('testadm-fixture-weakreset@example.com');
    const { agent, ready } = agentFor(testAdminEmail);
    await ready;

    const response = await agent
      .post(`/api/admin/users/${target.id}/reset-password`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ newInitialPassword: 'short' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 USER_NOT_FOUND for a nonexistent user', async () => {
    const { agent, ready } = agentFor(testAdminEmail);
    await ready;

    const response = await agent
      .post('/api/admin/users/999999/reset-password')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ newInitialPassword: 'Temp5678' });
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('USER_NOT_FOUND');
  });
});

// ─── API-29: Self-deactivation attempt ────────────────────────────────────────

describe('API-29: self-deactivation', () => {
  it('blocks an Administrator from deactivating their own account', async () => {
    const { agent, ready } = agentFor(testAdminEmail);
    await ready;

    const meResponse = await agent.get('/api/auth/me');
    const ownId = meResponse.body.id;

    const response = await agent
      .patch(`/api/admin/users/${ownId}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ isActive: false });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CANNOT_DEACTIVATE_SELF');

    const stored = await prisma.user.findUnique({ where: { id: ownId } });
    expect(stored!.isActive).toBe(true);
  });

  it('still allows an Administrator to edit their own name', async () => {
    const { agent, ready } = agentFor(testAdminEmail);
    await ready;

    const meResponse = await agent.get('/api/auth/me');
    const ownId = meResponse.body.id;

    const response = await agent
      .patch(`/api/admin/users/${ownId}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ name: 'Admin Renamed' });
    expect(response.status).toBe(200);
    expect(response.body.user.name).toBe('Admin Renamed');
  });
});

// ─── API-30: Last active Administrator protection ─────────────────────────────

describe('API-30: last active Administrator protection', () => {
  // BR-20 (LAST_ACTIVE_ADMIN) counts every active Administrator globally, so
  // deactivateOtherActiveAdmins() must also deactivate the shared seed admin.
  // Restore that shared account here so this file never leaves it inactive for
  // other test files.
  afterEach(async () => {
    await prisma.user.updateMany({
      where: { emailNormalized: 'admin@example.com' },
      data: { isActive: true }
    });
  });

  it('allows deactivating one of two active Administrators', async () => {
    const { agent, ready } = agentFor(testAdminEmail);
    await ready;

    const second = await prisma.user.findUnique({ where: { emailNormalized: secondAdminEmail } });
    const response = await agent
      .patch(`/api/admin/users/${second!.id}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ isActive: false });
    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({ id: second!.id, isActive: false });
  });

  // Helper to ensure only the seed admin and our second admin remain active.
  async function deactivateOtherActiveAdmins(agent: request.SuperAgentTest, keepIds: number[]) {
    const otherAdmins = await prisma.user.findMany({
      where: { role: 'ADMINISTRATOR', isActive: true, id: { notIn: keepIds } },
      select: { id: true }
    });
    for (const admin of otherAdmins) {
      await agent
        .patch(`/api/admin/users/${admin.id}`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ isActive: false });
    }
  }

  it('blocks self-deactivation even when the Administrator is the last active one', async () => {
    const { agent, ready } = agentFor(testAdminEmail);
    await ready;

    const second = await prisma.user.findUnique({ where: { emailNormalized: secondAdminEmail } });
    const meResponse = await agent.get('/api/auth/me');
    const myId = meResponse.body.id;

    // Deactivate our second admin AND any other active admins from other test fixtures.
    await deactivateOtherActiveAdmins(agent, [myId, second!.id]);

    // The self-deactivation check (BR-19) is enforced before the last-active-admin
    // check (BR-20), so the more specific CANNOT_DEACTIVATE_SELF applies here.
    const response = await agent
      .patch(`/api/admin/users/${myId}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ isActive: false });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CANNOT_DEACTIVATE_SELF');
  });

  it('allows role-changing one of two active Administrators', async () => {
    const { agent, ready } = agentFor(testAdminEmail);
    await ready;

    const second = await prisma.user.findUnique({ where: { emailNormalized: secondAdminEmail } });
    const response = await agent
      .patch(`/api/admin/users/${second!.id}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ role: 'IT_STAFF' });
    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({ id: second!.id, role: 'IT_STAFF' });
  });

  it('blocks an Administrator from changing their own role when they are the last active Administrator', async () => {
    const { agent, ready } = agentFor(testAdminEmail);
    await ready;

    const second = await prisma.user.findUnique({ where: { emailNormalized: secondAdminEmail } });
    const meResponse = await agent.get('/api/auth/me');
    const myId = meResponse.body.id;

    // Deactivate our second admin AND any other active admins from other test fixtures,
    // leaving ONLY the seed admin active.
    await deactivateOtherActiveAdmins(agent, [myId]);
    await agent
      .patch(`/api/admin/users/${second!.id}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ isActive: false });

    const response = await agent
      .patch(`/api/admin/users/${myId}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ role: 'IT_STAFF' });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('LAST_ACTIVE_ADMIN');
  });

  it('allows deactivating a non-Administrator user regardless of the admin count', async () => {
    const target = await createFixtureUser('testadm-fixture-deactivate@example.com', { role: 'REQUESTER' });
    const { agent, ready } = agentFor(testAdminEmail);
    await ready;

    const response = await agent
      .patch(`/api/admin/users/${target.id}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ isActive: false });
    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({ id: target.id, isActive: false });
  });
});

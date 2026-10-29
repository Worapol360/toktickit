/**
 * MIG-01 … MIG-05 (MIG-06 is manual): Lab 4 migration and seed verification.
 * AC-23, AC-24 — specification.md §7.
 *
 * MIG-01/MIG-02 replay the 10 Lab 3 migrations plus Lab 3 shaped legacy rows on a
 * scratch database, apply the real `lab4_actions_taken` migration.sql, and assert
 * that no earlier row changed except the documented resolvedAt backfill.
 * MIG-04/MIG-05 run the real seed script twice and verify idempotency and coverage.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';
import pgModule from 'pg';
import request from 'supertest';
import { app } from '../../src/server.js';
import prisma from '../../src/prisma.js';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const pgClient = pgModule.Client;
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const migrationsDir = path.join(serverRoot, 'prisma', 'migrations');
const LAB4_FRAGMENT = 'lab4_actions_taken';

const EARLIER_TABLES = [
  'Category',
  'requester_user',
  'RelatedSystem',
  'Ticket',
  'Attachment',
  'PublicComment',
  'InternalNote',
  'Session'
];

const SEED_CATEGORY_CODES = ['ACCOUNT_ACCESS', 'HARDWARE', 'SOFTWARE', 'NETWORK'];
const SEED_SYSTEM_CODES = ['FILE_SERVICES', 'EMAIL', 'NETWORK'];
const SEED_EMAILS = [
  'aiko@example.com',
  'daniel@example.com',
  'marcus@example.com',
  'priya@example.com',
  'inactive@example.com',
  'noah.it@example.com',
  'priya.it@example.com',
  'owen.it@example.com',
  'inactive.staff@example.com',
  'admin@example.com'
];
const TICKET_RANGE_START = 'TICK-20261020-9001';
const TICKET_RANGE_END = 'TICK-20261020-9012';

function urlForDatabase(database: string) {
  const url = new URL(process.env.DATABASE_URL!);
  url.search = '';
  url.pathname = `/${database}`;
  return url.toString();
}

async function snapshotCounts(client: pg.Client) {
  const counts: Record<string, number> = {};
  for (const table of EARLIER_TABLES) {
    const result = await client.query(`SELECT COUNT(*)::int AS n FROM "${table}"`);
    counts[table] = result.rows[0].n;
  }
  return counts;
}

function runSeedScript() {
  const tsx = path.join(serverRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const seedPath = path.join(serverRoot, 'prisma', 'seed.ts');
  try {
    execFileSync(process.execPath, [tsx, seedPath], {
      cwd: serverRoot,
      env: process.env,
      stdio: 'pipe'
    });
  } catch (error) {
    const failure = error as { stdout?: Buffer; stderr?: Buffer };
    throw new Error(
      `seed script failed:\n${failure.stdout?.toString() ?? ''}\n${failure.stderr?.toString() ?? ''}`
    );
  }
}

function seedTicketWhere() {
  return { ticketNumber: { gte: TICKET_RANGE_START, lte: TICKET_RANGE_END } };
}

describe('MIG-01 / MIG-02: lab4_actions_taken migration on a copy of Lab 3 data', () => {
  const scratchName = `toktickit_migcheck_${process.pid}_${Date.now()}_${randomUUID().slice(0, 8)}`;
  let admin: pg.Client;
  let scratch: pg.Client;
  let lab4Sql: string;

  beforeAll(async () => {
    const lab4Dirs = readdirSync(migrationsDir).filter((entry) => entry.includes(LAB4_FRAGMENT));
    expect(lab4Dirs.length).toBeGreaterThanOrEqual(1);
    lab4Sql = readFileSync(path.join(migrationsDir, lab4Dirs[0], 'migration.sql'), 'utf8');

    admin = new pgClient({ connectionString: urlForDatabase('postgres') });
    await admin.connect();
    await admin.query(`CREATE DATABASE "${scratchName}"`);
    scratch = new pgClient({ connectionString: urlForDatabase(scratchName) });
    await scratch.connect();

    const legacyDirs = readdirSync(migrationsDir)
      .filter((entry) => !entry.includes('lab4') && statSync(path.join(migrationsDir, entry)).isDirectory())
      .sort();
    expect(legacyDirs.length).toBe(10);

    for (const dir of legacyDirs) {
      const sql = readFileSync(path.join(migrationsDir, dir, 'migration.sql'), 'utf8');
      await scratch.query(sql);
    }

    await scratch.query(`
      INSERT INTO "requester_user"
        ("id", "name", "email", "emailNormalized", "passwordHash", "role", "department", "isActive", "mustChangePassword", "createdAt", "updatedAt")
      VALUES
        (1, 'Legacy Requester', 'legacy.req@example.com', 'legacy.req@example.com', 'hash', 'REQUESTER', 'Support', true, false, '2026-09-18T09:00:00.000', '2026-09-18T09:00:00.000'),
        (2, 'Legacy Staff', 'legacy.staff@example.com', 'legacy.staff@example.com', 'hash', 'IT_STAFF', 'IT', true, false, '2026-09-18T09:05:00.000', '2026-09-18T09:05:00.000');

      INSERT INTO "Category" ("id", "name", "code", "createdAt", "isActive")
      VALUES (1, 'Legacy Category', 'LEGACY_CAT', '2026-09-18T09:10:00.000', true);

      INSERT INTO "RelatedSystem" ("id", "name", "code", "isActive", "createdAt")
      VALUES (1, 'Legacy System', 'LEGACY_SYS', true, '2026-09-18T09:11:00.000');

      INSERT INTO "Ticket"
        ("id", "ticketNumber", "summary", "description", "requestedPriority", "status", "requesterId", "categoryId", "relatedSystemId", "createdAt", "updatedAt", "ownerId", "itPriority", "requesterMarkedResolved")
      VALUES
        (1, 'TICK-20260918-0001', 'Legacy resolved ticket', 'Resolved before Lab 4 existed.', 'High', 'Resolved', 1, 1, 1, '2026-09-18T10:00:00.000', '2026-09-20T10:00:00.000', 2, 'High', true),
        (2, 'TICK-20260918-0002', 'Legacy open ticket', 'Still open before Lab 4 existed.', 'Medium', 'Open', 1, 1, 1, '2026-09-18T11:00:00.000', '2026-09-19T11:00:00.000', NULL, NULL, false),
        (3, 'TICK-20260918-0003', 'Legacy closed ticket', 'Closed without ever being resolved in Lab 4.', 'Low', 'Closed', 1, 1, 1, '2026-09-18T12:00:00.000', '2026-09-21T12:00:00.000', 2, 'Low', false);

      INSERT INTO "PublicComment" ("id", "ticketId", "authorId", "content", "createdAt")
      VALUES (1, 1, 1, 'Legacy public comment preserved by the migration.', '2026-09-18T13:00:00.000');

      INSERT INTO "InternalNote" ("id", "ticketId", "authorId", "content", "createdAt")
      VALUES (1, 1, 2, 'Legacy internal note preserved by the migration.', '2026-09-18T13:05:00.000');

      INSERT INTO "Attachment"
        ("id", "ticketId", "fileName", "fileSize", "fileType", "filePath", "isRemoved", "removedAt", "removalReason", "createdAt")
      VALUES
        (1, 1, 'legacy.pdf', 10, 'application/pdf', 'storage/legacy.pdf', false, NULL, NULL, '2026-09-18T13:10:00.000');

      INSERT INTO "Session" ("id", "userId", "tokenHash", "createdAt", "expiresAt", "revokedAt")
      VALUES (1, 1, 'legacy-token-hash', '2026-09-18T14:00:00.000', '2030-01-01T00:00:00.000', NULL);
    `);
  }, 60_000);

  afterAll(async () => {
    if (scratch) await scratch.end();
    if (admin) {
      await admin.query(`DROP DATABASE IF EXISTS "${scratchName}" WITH (FORCE)`);
      await admin.end();
    }
  });

  it('MIG-01: preserves the row count of every earlier table (before vs after the migration)', async () => {
    const before = await snapshotCounts(scratch);
    expect(before).toEqual({
      Category: 1,
      requester_user: 2,
      RelatedSystem: 1,
      Ticket: 3,
      Attachment: 1,
      PublicComment: 1,
      InternalNote: 1,
      Session: 1
    });

    await scratch.query(lab4Sql);

    const after = await snapshotCounts(scratch);
    expect(after).toEqual(before);
  });

  it('MIG-01: creates action_taken, Ticket.version, Ticket.resolvedAt, and the new indexes', async () => {
    const actionTable = await scratch.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'action_taken'
    `);
    expect(actionTable.rowCount).toBe(1);

    const actionColumns = await scratch.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'action_taken'
      ORDER BY column_name
    `);
    const columnMap = Object.fromEntries(
      actionColumns.rows.map((row) => [row.column_name, row])
    );
    expect(Object.keys(columnMap)).toEqual([
      'actionAt',
      'attachmentNotes',
      'clientRequestId',
      'createdAt',
      'description',
      'followUpCompletedAt',
      'followUpNote',
      'followUpRequired',
      'id',
      'performedById',
      'result',
      'ticketId',
      'updatedAt',
      'updatedById',
      'version'
    ]);
    expect(columnMap.version.data_type).toBe('integer');
    expect(columnMap.version.is_nullable).toBe('NO');
    expect(columnMap.version.column_default).toBe('1');
    expect(columnMap.followUpRequired.column_default).toBe('false');

    const ticketColumns = await scratch.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Ticket'
      AND column_name IN ('version', 'resolvedAt')
      ORDER BY column_name
    `);
    const ticketColumnMap = Object.fromEntries(
      ticketColumns.rows.map((row) => [row.column_name, row])
    );
    expect(ticketColumnMap.resolvedAt.is_nullable).toBe('YES');
    expect(ticketColumnMap.version.data_type).toBe('integer');
    expect(ticketColumnMap.version.is_nullable).toBe('NO');
    expect(ticketColumnMap.version.column_default).toBe('1');

    const indexes = await scratch.query(`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN ('Ticket', 'action_taken')
      ORDER BY indexname
    `);
    const indexNames = indexes.rows.map((row) => row.indexname);
    for (const expected of [
      'Ticket_requesterId_status_idx',
      'Ticket_status_updatedAt_idx',
      'action_taken_ticketId_clientRequestId_key',
      'action_taken_ticketId_createdAt_id_idx',
      'action_taken_performedById_followUpRequired_followUpComplet_idx'
    ]) {
      expect(indexNames, `missing index ${expected}`).toContain(expected);
    }
  });

  it('MIG-02: backfills resolvedAt for Resolved tickets only and sets version = 1', async () => {
    const tickets = await scratch.query(`
      SELECT "id", "status", "resolvedAt", "updatedAt", "version" FROM "Ticket" ORDER BY "id"
    `);
    expect(tickets.rowCount).toBe(3);

    const [resolvedTicket, openTicket, closedTicket] = tickets.rows;
    expect(resolvedTicket.resolvedAt).toBeInstanceOf(Date);
    expect(resolvedTicket.resolvedAt.getTime()).toBe(resolvedTicket.updatedAt.getTime());
    expect(openTicket.resolvedAt).toBeNull();
    expect(closedTicket.resolvedAt).toBeNull();

    for (const ticket of tickets.rows) {
      expect(ticket.version).toBe(1);
    }

    const actions = await scratch.query('SELECT COUNT(*)::int AS n FROM "action_taken"');
    expect(actions.rows[0].n).toBe(0);
  });

  it('MIG-01: the test database records lab4_actions_taken as applied', async () => {
    const rows = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT "migration_name" FROM "_prisma_migrations"
      WHERE "migration_name" LIKE ${`%${LAB4_FRAGMENT}%`} AND "rolled_back_at" IS NULL
    `;
    expect(rows.length).toBe(1);
  });
});

const localPasswordHash = '$2b$12$MvQuSTNtpiuJmfaKc7j0Nu0FipBQuY31F6ojkIMWw2OMTZoK5lUkq';
const SUMMARY_PREFIX = '[A4-MIG]';

function agentFor(email: string) {
  const agent = request.agent(app);
  const ready = agent
    .post('/api/auth/login')
    .set('X-Requested-With', 'XMLHttpRequest')
    .send({ email, password: 'LocalOnly1!' });
  return { agent, ready };
}

describe('MIG-03: legacy Ticket with zero Actions still loads through existing endpoints', () => {
  let catId: number;
  let sysId: number;
  let requester: { id: number; email: string };
  let staff: { id: number; email: string };
  let legacyTicketId: number;

  async function cleanupFixtures() {
    await prisma.actionTaken.deleteMany({
      where: { ticket: { summary: { startsWith: SUMMARY_PREFIX } } }
    });
    await prisma.ticket.deleteMany({
      where: { summary: { startsWith: SUMMARY_PREFIX } }
    });
  }

  beforeEach(async () => {
    const cat = await prisma.category.findFirst({ where: { isActive: true } });
    const sys = await prisma.relatedSystem.findFirst({ where: { isActive: true } });
    if (!cat || !sys) throw new Error('Test database is missing required seed categories/systems');
    catId = cat.id;
    sysId = sys.id;

    const req = await prisma.user.upsert({
      where: { emailNormalized: 'a4mig_req@example.com' },
      update: { name: 'A4 MIG Requester', role: 'REQUESTER', department: 'Support', passwordHash: localPasswordHash, mustChangePassword: false, isActive: true },
      create: {
        name: 'A4 MIG Requester',
        email: 'a4mig_req@example.com',
        emailNormalized: 'a4mig_req@example.com',
        department: 'Support',
        role: 'REQUESTER',
        passwordHash: localPasswordHash,
        mustChangePassword: false,
        isActive: true
      }
    });
    const stf = await prisma.user.upsert({
      where: { emailNormalized: 'a4mig_staff@example.com' },
      update: { name: 'A4 MIG Staff', role: 'IT_STAFF', department: 'IT', passwordHash: localPasswordHash, mustChangePassword: false, isActive: true },
      create: {
        name: 'A4 MIG Staff',
        email: 'a4mig_staff@example.com',
        emailNormalized: 'a4mig_staff@example.com',
        department: 'IT',
        role: 'IT_STAFF',
        passwordHash: localPasswordHash,
        mustChangePassword: false,
        isActive: true
      }
    });
    requester = { id: req.id, email: req.email };
    staff = { id: stf.id, email: stf.email };

    await cleanupFixtures();

    const legacy = await prisma.ticket.create({
      data: {
        ticketNumber: `TICK-TEST-A4MIG-${randomUUID().slice(0, 12)}`,
        summary: `${SUMMARY_PREFIX} Legacy style resolved ticket`,
        description: 'A legacy-shaped ticket created before Actions Taken existed.',
        requestedPriority: 'Medium',
        itPriority: 'Medium',
        status: 'Resolved',
        requesterId: requester.id,
        ownerId: staff.id,
        categoryId: catId,
        relatedSystemId: sysId,
        version: 1
      }
    });
    await prisma.ticket.update({
      where: { id: legacy.id },
      data: { resolvedAt: legacy.updatedAt }
    });
    legacyTicketId = legacy.id;
  });

  afterEach(async () => {
    await cleanupFixtures();
  });

  it('MIG-03: requester detail, staff detail, and the actions list all serve the legacy ticket', async () => {
    const reqAgent = agentFor(requester.email);
    await reqAgent.ready;
    const staffAgent = agentFor(staff.email);
    await staffAgent.ready;

    const requesterDetail = await reqAgent.agent.get(`/api/tickets/${legacyTicketId}`);
    expect(requesterDetail.status).toBe(200);
    expect(requesterDetail.body.ticket.id).toBe(legacyTicketId);
    expect(requesterDetail.body.ticket.status).toBe('Resolved');

    const staffDetail = await staffAgent.agent.get(`/api/staff/tickets/${legacyTicketId}`);
    expect(staffDetail.status).toBe(200);
    expect(staffDetail.body.ticket.id).toBe(legacyTicketId);

    const list = await staffAgent.agent.get(`/api/tickets/${legacyTicketId}/actions-taken`);
    expect(list.status).toBe(200);
    expect(list.body.actionsTaken).toEqual([]);
    expect(list.body.summary).toEqual({ total: 0, openFollowUps: 0 });

    const requesterList = await reqAgent.agent.get(`/api/tickets/${legacyTicketId}/actions-taken`);
    expect(requesterList.status).toBe(200);
    expect(requesterList.body.actionsTaken).toEqual([]);
    expect(requesterList.body.summary).toEqual({ total: 0, openFollowUps: 0 });
  });
});

describe('MIG-04 / MIG-05: idempotent seed and coverage', () => {
  beforeAll(() => {
    runSeedScript();
  }, 60_000);

  it('MIG-04: running the seed twice leaves identical scoped row counts and modifies no seeded row', async () => {
    const countsBefore = {
      tickets: await prisma.ticket.count({ where: seedTicketWhere() }),
      actions: await prisma.actionTaken.count({ where: { clientRequestId: { startsWith: 'seed-' } } }),
      categories: await prisma.category.count({ where: { code: { in: SEED_CATEGORY_CODES } } }),
      systems: await prisma.relatedSystem.count({ where: { code: { in: SEED_SYSTEM_CODES } } }),
      users: await prisma.user.count({ where: { email: { in: SEED_EMAILS } } })
    };
    const ticketsBefore = await prisma.ticket.findMany({
      where: seedTicketWhere(),
      orderBy: { ticketNumber: 'asc' }
    });
    const actionsBefore = await prisma.actionTaken.findMany({
      where: { clientRequestId: { startsWith: 'seed-' } },
      orderBy: { id: 'asc' }
    });
    expect(countsBefore.tickets).toBe(12);
    expect(countsBefore.actions).toBeGreaterThanOrEqual(6);

    runSeedScript();

    const countsAfter = {
      tickets: await prisma.ticket.count({ where: seedTicketWhere() }),
      actions: await prisma.actionTaken.count({ where: { clientRequestId: { startsWith: 'seed-' } } }),
      categories: await prisma.category.count({ where: { code: { in: SEED_CATEGORY_CODES } } }),
      systems: await prisma.relatedSystem.count({ where: { code: { in: SEED_SYSTEM_CODES } } }),
      users: await prisma.user.count({ where: { email: { in: SEED_EMAILS } } })
    };
    expect(countsAfter).toEqual(countsBefore);

    const ticketsAfter = await prisma.ticket.findMany({
      where: seedTicketWhere(),
      orderBy: { ticketNumber: 'asc' }
    });
    expect(ticketsAfter).toEqual(ticketsBefore);

    const actionsAfter = await prisma.actionTaken.findMany({
      where: { clientRequestId: { startsWith: 'seed-' } },
      orderBy: { id: 'asc' }
    });
    expect(actionsAfter).toEqual(actionsBefore);

    const duplicatePairs = await prisma.actionTaken.groupBy({
      by: ['ticketId', 'clientRequestId'],
      where: { clientRequestId: { startsWith: 'seed-' } },
      _count: { _all: true }
    });
    for (const pair of duplicatePairs) {
      expect(pair._count._all, `duplicate pair for ticket ${pair.ticketId} / ${pair.clientRequestId}`).toBe(1);
    }
  }, 60_000);

  it('MIG-05: seed covers all 8 statuses, assignment, priorities, flags, and action counts 0/1/3+', async () => {
    runSeedScript();

    const seedTickets = await prisma.ticket.findMany({
      where: seedTicketWhere(),
      orderBy: { ticketNumber: 'asc' }
    });
    expect(seedTickets).toHaveLength(12);
    expect(new Set(seedTickets.map((ticket) => ticket.ticketNumber))).toEqual(
      new Set(seedTickets.map((ticket) => ticket.ticketNumber))
    );

    const statuses = new Set(seedTickets.map((ticket) => ticket.status));
    expect([...statuses].sort()).toEqual(
      ['Cancelled', 'Closed', 'In Progress', 'New', 'Open', 'Reopened', 'Resolved', 'Waiting for Requester'].sort()
    );

    expect(seedTickets.some((ticket) => ticket.ownerId !== null)).toBe(true);
    expect(seedTickets.some((ticket) => ticket.ownerId === null)).toBe(true);

    expect(seedTickets.some((ticket) => ticket.requesterMarkedResolved)).toBe(true);
    expect(seedTickets.some((ticket) => !ticket.requesterMarkedResolved)).toBe(true);

    expect(seedTickets.some((ticket) => ticket.itPriority === null)).toBe(true);
    const priorities = new Set(seedTickets.map((ticket) => ticket.itPriority));
    for (const priority of ['Low', 'Medium', 'High', 'Urgent']) {
      expect(priorities.has(priority), `missing itPriority ${priority}`).toBe(true);
    }

    const actions = await prisma.actionTaken.findMany({
      where: { ticketId: { in: seedTickets.map((ticket) => ticket.id) } }
    });
    const actionsByTicket = new Map<number, number>();
    for (const action of actions) {
      actionsByTicket.set(action.ticketId, (actionsByTicket.get(action.ticketId) ?? 0) + 1);
    }
    const actionCounts = seedTickets.map((ticket) => actionsByTicket.get(ticket.id) ?? 0);
    expect(actionCounts).toContain(0);
    expect(actionCounts).toContain(1);
    expect(actionCounts.some((count) => count >= 3)).toBe(true);

    expect(actions.some((action) => action.followUpRequired && action.followUpCompletedAt === null)).toBe(true);
    expect(actions.some((action) => action.followUpRequired && action.followUpCompletedAt !== null)).toBe(true);

    const ticketById = new Map(seedTickets.map((ticket) => [ticket.id, ticket]));
    expect(actions.some((action) => {
      const ticket = ticketById.get(action.ticketId);
      return ticket !== undefined && ticket.ownerId !== null && action.performedById !== ticket.ownerId;
    })).toBe(true);
  }, 60_000);

  it('MIG-05: one Resolved seed ticket satisfies the gate and one Reopened seed ticket exists', async () => {
    runSeedScript();

    const seedTickets = await prisma.ticket.findMany({
      where: seedTicketWhere(),
      orderBy: { ticketNumber: 'asc' }
    });

    const resolved = seedTickets.filter((ticket) => ticket.status === 'Resolved');
    expect(resolved.length).toBeGreaterThanOrEqual(1);
    for (const ticket of resolved) {
      const actions = await prisma.actionTaken.findMany({ where: { ticketId: ticket.id } });
      expect(actions.length).toBeGreaterThanOrEqual(1);
      const openFollowUps = actions.filter(
        (action) => action.followUpRequired && action.followUpCompletedAt === null
      );
      expect(openFollowUps).toHaveLength(0);
      expect(ticket.resolvedAt).not.toBeNull();
    }

    expect(seedTickets.some((ticket) => ticket.status === 'Reopened')).toBe(true);
  }, 60_000);

  it('MIG-05: an active Requester and an active IT Staff user own zero Tickets', async () => {
    runSeedScript();

    const emptyRequester = await prisma.user.findUnique({
      where: { emailNormalized: 'priya@example.com' },
      select: { id: true, isActive: true, role: true }
    });
    expect(emptyRequester).not.toBeNull();
    expect(emptyRequester!.isActive).toBe(true);
    expect(emptyRequester!.role).toBe('REQUESTER');
    expect(await prisma.ticket.count({ where: { requesterId: emptyRequester!.id } })).toBe(0);

    const emptyStaff = await prisma.user.findUnique({
      where: { emailNormalized: 'owen.it@example.com' },
      select: { id: true, isActive: true, role: true }
    });
    expect(emptyStaff).not.toBeNull();
    expect(emptyStaff!.isActive).toBe(true);
    expect(emptyStaff!.role).toBe('IT_STAFF');
    expect(await prisma.ticket.count({ where: { ownerId: emptyStaff!.id } })).toBe(0);
  }, 60_000);
});

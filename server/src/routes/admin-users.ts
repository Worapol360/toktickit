import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import {
  errorResponse,
  hashPassword,
  revokeAllSessions,
  validatePassword,
  type AuthenticatedRequest
} from '../auth.js';
import prisma from '../prisma.js';

const adminRoles = new Set(['REQUESTER', 'IT_STAFF', 'ADMINISTRATOR']);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AdminUserRow = {
  id: number;
  name: string;
  email: string;
  role: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR';
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
};

// Administrator-facing User shape (api-spec Section 2). Never includes passwordHash.
function adminUser(user: {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
}): AdminUserRow {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as AdminUserRow['role'],
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt
  };
}

function parsePositiveId(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function bodyHas(body: Record<string, unknown>, key: string) {
  return body[key] !== undefined;
}

export const adminUsersRouter = Router();

// GET /api/admin/users?search=&role=
adminUsersRouter.get('/', async (req, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const role = typeof req.query.role === 'string' ? req.query.role.trim() : '';
    if (role && !adminRoles.has(role)) {
      errorResponse(res, 400, 'INVALID_QUERY_PARAMETER', 'role must be REQUESTER, IT_STAFF, or ADMINISTRATOR.');
      return;
    }

    const where: Prisma.UserWhereInput = {
      ...(search ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ]
      } : {}),
      ...(role ? { role: role as AdminUserRow['role'] } : {})
    };

    const users = await prisma.user.findMany({
      where,
      orderBy: { name: 'asc' }
    });
    res.status(200).json({ users: users.map(adminUser) });
  } catch {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Unable to load users.');
  }
});

// POST /api/admin/users
adminUsersRouter.post('/', async (req, res) => {
  try {
    const body = req.body ?? {};
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const role = typeof body.role === 'string' ? body.role : '';
    const initialPassword = typeof body.initialPassword === 'string' ? body.initialPassword : '';
    const isActive = body.isActive === undefined ? true : body.isActive;

    const fields: Record<string, string> = {};
    if (!name) fields.name = 'Name is required';
    if (!emailPattern.test(email)) fields.email = 'Enter a valid email address';
    if (!adminRoles.has(role)) fields.role = 'Role must be REQUESTER, IT_STAFF, or ADMINISTRATOR';
    if (!validatePassword(initialPassword)) fields.initialPassword = 'Initial password must be at least 8 characters and include a letter and a number';
    if (typeof isActive !== 'boolean') fields.isActive = 'isActive must be a boolean';
    if (Object.keys(fields).length > 0) {
      errorResponse(res, 400, 'VALIDATION_ERROR', 'Request validation failed', fields);
      return;
    }

    const emailNormalized = email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { emailNormalized } });
    if (existing) {
      errorResponse(res, 409, 'EMAIL_ALREADY_IN_USE', 'This email address is already in use.');
      return;
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        emailNormalized,
        // department is required by the schema but is not part of the
        // administrator API contract, so new accounts get a neutral default.
        department: 'Unassigned',
        passwordHash: await hashPassword(initialPassword),
        role: role as AdminUserRow['role'],
        isActive,
        mustChangePassword: true
      }
    });
    res.status(201).json({ user: adminUser(user) });
  } catch {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Unable to create user.');
  }
});

// PATCH /api/admin/users/:id
adminUsersRouter.patch('/:id', async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (id === null) {
      errorResponse(res, 400, 'VALIDATION_ERROR', 'User ID must be a positive integer.');
      return;
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      errorResponse(res, 404, 'USER_NOT_FOUND', 'User not found.');
      return;
    }

    // Password is never accepted in this endpoint's body (BR-17): any
    // password / initialPassword / newInitialPassword / passwordHash field
    // sent here is silently ignored, never applied.
    const body = req.body ?? {};

    // (a) Validate supplied fields first.
    const data: {
      name?: string;
      email?: string;
      emailNormalized?: string;
      role?: AdminUserRow['role'];
      isActive?: boolean;
    } = {};
    const fields: Record<string, string> = {};
    if (bodyHas(body, 'name')) {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name) fields.name = 'Name is required';
      else data.name = name;
    }
    if (bodyHas(body, 'email')) {
      const email = typeof body.email === 'string' ? body.email.trim() : '';
      if (!emailPattern.test(email)) fields.email = 'Enter a valid email address';
      else {
        data.email = email;
        data.emailNormalized = email.toLowerCase();
      }
    }
    if (bodyHas(body, 'role')) {
      if (!adminRoles.has(body.role)) fields.role = 'Role must be REQUESTER, IT_STAFF, or ADMINISTRATOR';
      else data.role = body.role as AdminUserRow['role'];
    }
    if (bodyHas(body, 'isActive')) {
      if (typeof body.isActive !== 'boolean') fields.isActive = 'isActive must be a boolean';
      else data.isActive = body.isActive;
    }
    if (Object.keys(fields).length > 0) {
      errorResponse(res, 400, 'VALIDATION_ERROR', 'Request validation failed', fields);
      return;
    }

    // (b) Duplicate email, case-insensitive (BR-09).
    if (data.emailNormalized) {
      const duplicate = await prisma.user.findFirst({
        where: { emailNormalized: data.emailNormalized, id: { not: id } }
      });
      if (duplicate) {
        errorResponse(res, 409, 'EMAIL_ALREADY_IN_USE', 'This email address is already in use.');
        return;
      }
    }

    // (c) An Administrator cannot deactivate their own account (BR-19).
    if (data.isActive === false && id === (req as AuthenticatedRequest).user!.id) {
      errorResponse(res, 409, 'CANNOT_DEACTIVATE_SELF', 'You cannot deactivate your own account.');
      return;
    }

    // (d) At least one active Administrator must remain (BR-20) — count active
    // Administrators excluding the one being changed, for both a deactivation
    // and a role change away from ADMINISTRATOR.
    const deactivatingActiveAdmin = data.isActive === false && target.isActive && target.role === 'ADMINISTRATOR';
    const changingLastAdminRole = data.role !== undefined && data.role !== 'ADMINISTRATOR' && target.isActive && target.role === 'ADMINISTRATOR';
    if (deactivatingActiveAdmin || changingLastAdminRole) {
      const remainingActiveAdmins = await prisma.user.count({
        where: { role: 'ADMINISTRATOR', isActive: true, id: { not: id } }
      });
      if (remainingActiveAdmins === 0) {
        errorResponse(res, 409, 'LAST_ACTIVE_ADMIN', 'At least one active Administrator must remain.');
        return;
      }
    }

    const updated = await prisma.user.update({ where: { id }, data });
    res.status(200).json({ user: adminUser(updated) });
  } catch (error) {
    console.error('PATCH DEBUG:', error);
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Unable to update user.');
  }
});

// POST /api/admin/users/:id/reset-password
adminUsersRouter.post('/:id/reset-password', async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (id === null) {
      errorResponse(res, 400, 'VALIDATION_ERROR', 'User ID must be a positive integer.');
      return;
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      errorResponse(res, 404, 'USER_NOT_FOUND', 'User not found.');
      return;
    }

    const body = req.body ?? {};
    const newInitialPassword = typeof body.newInitialPassword === 'string' ? body.newInitialPassword : '';
    if (!validatePassword(newInitialPassword)) {
      errorResponse(res, 400, 'VALIDATION_ERROR', 'New initial password must be at least 8 characters and include a letter and a number.');
      return;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { passwordHash: await hashPassword(newInitialPassword), mustChangePassword: true }
    });
    await revokeAllSessions(id);
    res.status(200).json({ user: adminUser(updated) });
  } catch {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Unable to set new initial password.');
  }
});

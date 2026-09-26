import 'dotenv/config';
import express from 'express';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import type { Prisma } from '@prisma/client';
import prisma from './prisma.js';
import {
  clearSessionCookie,
  csrfGuard,
  errorResponse,
  hashPassword,
  login,
  requireAuth,
  requirePasswordChangeComplete,
  requireRole,
  safeUser,
  setSessionCookie,
  validatePassword,
  type AuthenticatedRequest
} from './auth.js';

export const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(express.json());
app.use(csrfGuard);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 6 }
});
const allowedFileTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf']);
const priorities = new Set(['Low', 'Medium', 'High', 'Urgent']);
const attachmentRoot = path.resolve(process.env.ATTACHMENT_STORAGE_PATH ?? 'storage/attachments');

type UploadedFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

function ticketNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `TICK-${date}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
}

function parsePositiveId(value: string) {
  if (!/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function safeAttachment(attachment: { filePath: string; [key: string]: unknown }) {
  const { filePath: _filePath, ...metadata } = attachment;
  return metadata;
}

function attachmentExtension(fileName: string) {
  return path.extname(fileName).toLowerCase();
}

async function storeAttachment(file: UploadedFile) {
  await mkdir(attachmentRoot, { recursive: true });
  const storedPath = path.join(attachmentRoot, `${randomUUID()}${attachmentExtension(file.originalname)}`);
  await writeFile(storedPath, file.buffer);
  return storedPath;
}

async function removeStoredFiles(paths: string[]) {
  await Promise.all(paths.map(async (storedPath) => {
    try {
      await unlink(storedPath);
    } catch {
      // Cleanup is best effort after a failed coordinated operation.
    }
  }));
}

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'TokTickIT API'
  });
});

app.post('/api/auth/login', async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) {
    errorResponse(res, 400, 'VALIDATION_ERROR', 'Request validation failed', {
      email: 'Enter a valid email address',
      password: 'Password is required'
    });
    return;
  }
  try {
    const result = await login(email, password);
    if (result.kind === 'invalid') {
      errorResponse(res, 401, 'INVALID_CREDENTIALS', 'Incorrect email or password.');
      return;
    }
    if (result.kind === 'inactive') {
      errorResponse(res, 403, 'ACCOUNT_INACTIVE', 'This account is inactive. Contact an Administrator.');
      return;
    }
    setSessionCookie(res, result.rawToken);
    res.status(200).json({ user: result.user });
  } catch {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Unable to sign in.');
  }
});

app.post('/api/auth/logout', requireAuth, async (req, res) => {
  try {
    const sessionId = (req as AuthenticatedRequest).sessionId;
    if (sessionId) await prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
    clearSessionCookie(res);
    res.status(204).send();
  } catch {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Unable to sign out.');
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.status(200).json(safeUser((req as AuthenticatedRequest).user!));
});

app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  const currentPassword = typeof req.body.currentPassword === 'string' ? req.body.currentPassword : '';
  const newPassword = typeof req.body.newPassword === 'string' ? req.body.newPassword : '';
  const confirmNewPassword = typeof req.body.confirmNewPassword === 'string' ? req.body.confirmNewPassword : '';
  if (!currentPassword || !validatePassword(newPassword)) {
    errorResponse(res, 400, 'VALIDATION_ERROR', 'Request validation failed');
    return;
  }
  if (newPassword !== confirmNewPassword) {
    errorResponse(res, 400, 'PASSWORD_MISMATCH', 'New passwords must match.');
    return;
  }
  try {
    const user = await prisma.user.findUnique({ where: { id: (req as AuthenticatedRequest).user!.id } });
    if (!user) {
      errorResponse(res, 401, 'UNAUTHENTICATED', 'Authentication is required.');
      return;
    }
    const bcrypt = await import('bcryptjs');
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      errorResponse(res, 401, 'CURRENT_PASSWORD_INCORRECT', 'Current password is incorrect.');
      return;
    }
    if (await bcrypt.compare(newPassword, user.passwordHash)) {
      errorResponse(res, 400, 'SAME_AS_CURRENT', 'New password must differ from the current password.');
      return;
    }
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false }
    });
    res.status(200).json({ user: safeUser(updated) });
  } catch {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Unable to change password.');
  }
});

app.use('/api/categories', requireAuth, requirePasswordChangeComplete);
app.use('/api/related-systems', requireAuth, requirePasswordChangeComplete);
app.use('/api/tickets', requireAuth, requirePasswordChangeComplete, requireRole('REQUESTER'));

function getRequesterContext(req: AuthenticatedRequest) {
  return req.user?.role === 'REQUESTER' ? req.user : null;
}

app.get('/api/categories', async (_req, res) => {
  const categories = await prisma.category.findMany({
    where: {
      isActive: true
    },
    select: {
      id: true,
      code: true,
      name: true,
      isActive: true
    },
    orderBy: [{ name: 'asc' }, { id: 'asc' }]
  });

  res.status(200).json({ categories });
});

app.get('/api/related-systems', async (_req, res) => {
  try {
    const relatedSystems = await prisma.relatedSystem.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true, isActive: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }]
    });
    res.status(200).json({ relatedSystems });
  } catch {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Unable to load related systems.');
  }
});

const ticketQueryParameters = new Set(['search', 'status', 'priority', 'categoryId', 'sortBy', 'sortOrder', 'page', 'pageSize']);
const ticketSortFields = new Set(['createdAt', 'ticketNumber', 'summary', 'requestedPriority', 'status']);
const ticketSortOrders = new Set(['asc', 'desc']);

function queryValue(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

function parsePositiveQueryInteger(value: string | undefined) {
  if (value === undefined || value === '') return undefined;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

app.get('/api/tickets', async (req, res) => {
  try {
    const requester = await getRequesterContext(req);
    if (!requester) {
      errorResponse(res, 400, 'REQUESTER_CONTEXT_INVALID', 'A valid active requester context is required.');
      return;
    }

    const unknownParameter = Object.keys(req.query).find((parameter) => !ticketQueryParameters.has(parameter));
    if (unknownParameter) {
      errorResponse(res, 400, 'INVALID_QUERY_PARAMETER', `Unknown query parameter: ${unknownParameter}`);
      return;
    }

    const search = queryValue(req.query.search)?.trim() ?? '';
    const status = queryValue(req.query.status)?.trim() ?? '';
    const priority = queryValue(req.query.priority)?.trim() ?? '';
    const categoryIdValue = queryValue(req.query.categoryId)?.trim() ?? '';
    const sortByValue = queryValue(req.query.sortBy)?.trim() ?? '';
    const sortOrderValue = queryValue(req.query.sortOrder)?.trim() ?? '';
    const pageValue = queryValue(req.query.page)?.trim() ?? '';
    const pageSizeValue = queryValue(req.query.pageSize)?.trim() ?? '';
    const fields: Record<string, string> = {};

    const categoryId = parsePositiveQueryInteger(categoryIdValue);
    const page = parsePositiveQueryInteger(pageValue) ?? 1;
    const pageSize = parsePositiveQueryInteger(pageSizeValue) ?? 10;
    if (categoryId === null) fields.categoryId = 'categoryId must be a positive integer';
    if (page === null) fields.page = 'page must be a positive integer';
    if (pageSize === null || pageSize > 100) fields.pageSize = 'pageSize must be between 1 and 100';
    if (status && status !== 'New') fields.status = 'status must be New';
    if (priority && !priorities.has(priority)) fields.priority = 'priority must be Low, Medium, High, or Urgent';
    if (sortByValue && !ticketSortFields.has(sortByValue)) fields.sortBy = 'sortBy is not supported';
    if (sortOrderValue && !ticketSortOrders.has(sortOrderValue)) fields.sortOrder = 'sortOrder must be asc or desc';
    if (Object.values(req.query).some((value) => Array.isArray(value) || (typeof value !== 'string' && value !== undefined))) {
      fields.query = 'Query parameters must have one scalar value';
    }
    if (Object.keys(fields).length > 0) {
      errorResponse(res, 400, 'INVALID_QUERY_PARAMETER', 'Request query parameters are invalid.', fields);
      return;
    }

    const sortBy = (sortByValue || 'createdAt') as 'createdAt' | 'ticketNumber' | 'summary' | 'requestedPriority' | 'status';
    const sortOrder = (sortOrderValue || 'desc') as 'asc' | 'desc';
    const where: Prisma.TicketWhereInput = {
      requesterId: requester.id,
      ...(search ? {
        OR: [
          { ticketNumber: { contains: search, mode: 'insensitive' } },
          { summary: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ]
      } : {}),
      ...(status ? { status } : {}),
      ...(priority ? { requestedPriority: priority } : {}),
      ...(categoryId ? { categoryId } : {})
    };
    const orderBy: Prisma.TicketOrderByWithRelationInput[] = [
      { [sortBy]: sortOrder },
      { id: 'desc' }
    ];
    const [totalItems, tickets] = await Promise.all([
      prisma.ticket.count({ where }),
      prisma.ticket.findMany({
        where,
        include: {
          category: true,
          relatedSystem: true,
          attachments: { where: { removedAt: null } }
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);

    res.status(200).json({
      tickets: tickets.map(({ attachments, ...ticket }) => ({
        ...ticket,
        attachments: attachments.map(({ filePath: _filePath, ...attachment }) => attachment)
      })),
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
        hasNextPage: totalPages > 0 && page < totalPages,
        hasPreviousPage: page > 1 && totalPages > 0
      },
      sort: { sortBy, sortOrder }
    });
  } catch {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Unable to load tickets.');
  }
});

app.get('/api/tickets/:id', async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (id === null) {
      errorResponse(res, 400, 'INVALID_TICKET_ID', 'Ticket ID must be a positive integer.');
      return;
    }
    const requester = await getRequesterContext(req);
    if (!requester) {
      errorResponse(res, 400, 'REQUESTER_CONTEXT_INVALID', 'A valid active requester context is required.');
      return;
    }

    const ticket = await prisma.ticket.findFirst({
      where: { id, requesterId: requester.id },
      include: { category: true, relatedSystem: true, attachments: true }
    });
    if (!ticket) {
      errorResponse(res, 404, 'TICKET_NOT_FOUND', 'Ticket not found.');
      return;
    }

    res.status(200).json({
      ticket: {
        ...ticket,
        attachments: ticket.attachments.map(safeAttachment)
      }
    });
  } catch {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Unable to load ticket.');
  }
});

app.post('/api/tickets/:id/attachments', (req, res, next) => {
  upload.array('attachments', 6)(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      errorResponse(res, 400, 'FILE_TOO_LARGE', 'Each attachment must be 5 MB or smaller.');
      return;
    }
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_COUNT') {
      errorResponse(res, 400, 'ATTACHMENT_LIMIT_EXCEEDED', 'A ticket can have at most 5 active attachments.');
      return;
    }
    if (error) {
      next(error);
      return;
    }
    next();
  });
}, async (req, res) => {
  const storedPaths: string[] = [];
  try {
    const ticketId = parsePositiveId(req.params.id);
    if (ticketId === null) {
      errorResponse(res, 400, 'INVALID_TICKET_ID', 'Ticket ID must be a positive integer.');
      return;
    }
    const requester = await getRequesterContext(req);
    if (!requester) {
      errorResponse(res, 400, 'REQUESTER_CONTEXT_INVALID', 'A valid active requester context is required.');
      return;
    }
    const files = ((req as express.Request & { files?: UploadedFile[] }).files) ?? [];
    if (files.length === 0) {
      errorResponse(res, 400, 'NO_FILE', 'At least one attachment is required.');
      return;
    }

    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, requesterId: requester.id },
      include: { attachments: { where: { removedAt: null } } }
    });
    if (!ticket) {
      errorResponse(res, 404, 'TICKET_NOT_FOUND', 'Ticket not found.');
      return;
    }
    if (ticket.attachments.length + files.length > 5) {
      errorResponse(res, 409, 'ATTACHMENT_LIMIT_EXCEEDED', 'A ticket can have at most 5 active attachments.');
      return;
    }
    for (const file of files) {
      const extension = attachmentExtension(file.originalname);
      if (!allowedFileTypes.has(file.mimetype) || !allowedExtensions.has(extension)) {
        errorResponse(res, 400, 'UNSUPPORTED_FILE_TYPE', 'Attachments must be JPG, JPEG, PNG, WEBP, or PDF.');
        return;
      }
    }

    const createdAttachments = await prisma.$transaction(async (transaction) => {
      const result = [];
      for (const file of files) {
        const storedPath = await storeAttachment(file);
        storedPaths.push(storedPath);
        result.push(await transaction.attachment.create({
          data: {
            ticketId,
            fileName: file.originalname,
            fileSize: file.size,
            fileType: file.mimetype,
            filePath: storedPath
          }
        }));
      }
      return result;
    });
    res.status(201).json({ attachments: createdAttachments.map(safeAttachment) });
  } catch {
    await removeStoredFiles(storedPaths);
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Unable to upload attachments.');
  }
});

app.get('/api/tickets/:ticketId/attachments/:attachmentId', async (req, res) => {
  try {
    const ticketId = parsePositiveId(req.params.ticketId);
    const attachmentId = parsePositiveId(req.params.attachmentId);
    if (ticketId === null || attachmentId === null) {
      errorResponse(res, 400, 'INVALID_PATH_PARAMETER', 'Ticket and attachment IDs must be positive integers.');
      return;
    }
    const requester = await getRequesterContext(req);
    if (!requester) {
      errorResponse(res, 400, 'REQUESTER_CONTEXT_INVALID', 'A valid active requester context is required.');
      return;
    }
    const attachment = await prisma.attachment.findFirst({
      where: { id: attachmentId, ticketId, ticket: { requesterId: requester.id } }
    });
    if (!attachment) {
      errorResponse(res, 404, 'ATTACHMENT_NOT_FOUND', 'Attachment not found.');
      return;
    }
    res.status(200).json({ attachment: safeAttachment(attachment) });
  } catch {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Unable to load attachment.');
  }
});

app.get('/api/tickets/:ticketId/attachments/:attachmentId/download', async (req, res) => {
  try {
    const ticketId = parsePositiveId(req.params.ticketId);
    const attachmentId = parsePositiveId(req.params.attachmentId);
    if (ticketId === null || attachmentId === null) {
      errorResponse(res, 400, 'INVALID_PATH_PARAMETER', 'Ticket and attachment IDs must be positive integers.');
      return;
    }
    const requester = await getRequesterContext(req);
    if (!requester) {
      errorResponse(res, 400, 'REQUESTER_CONTEXT_INVALID', 'A valid active requester context is required.');
      return;
    }
    const attachment = await prisma.attachment.findFirst({
      where: { id: attachmentId, ticketId, ticket: { requesterId: requester.id } }
    });
    if (!attachment || attachment.removedAt !== null) {
      errorResponse(res, 404, 'ATTACHMENT_NOT_FOUND', 'Attachment not found.');
      return;
    }
    let content: Buffer;
    try {
      content = await readFile(attachment.filePath);
    } catch {
      errorResponse(res, 500, 'FILE_UNAVAILABLE', 'Attachment file is unavailable.');
      return;
    }
    res.type(attachment.fileType).attachment(attachment.fileName).send(content);
  } catch {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Unable to download attachment.');
  }
});

app.delete('/api/tickets/:ticketId/attachments/:attachmentId', async (req, res) => {
  try {
    const ticketId = parsePositiveId(req.params.ticketId);
    const attachmentId = parsePositiveId(req.params.attachmentId);
    if (ticketId === null || attachmentId === null) {
      errorResponse(res, 400, 'INVALID_PATH_PARAMETER', 'Ticket and attachment IDs must be positive integers.');
      return;
    }
    const requester = await getRequesterContext(req);
    if (!requester) {
      errorResponse(res, 400, 'REQUESTER_CONTEXT_INVALID', 'A valid active requester context is required.');
      return;
    }
    const reason = typeof req.body.removalReason === 'string' ? req.body.removalReason.trim() : '';
    if (reason.length < 5 || reason.length > 250) {
      errorResponse(res, 400, 'VALIDATION_ERROR', 'Request validation failed', { removalReason: 'Removal reason must be between 5 and 250 characters' });
      return;
    }
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: { ticket: { select: { requesterId: true, id: true } } }
    });
    if (!attachment || attachment.ticketId !== ticketId || attachment.ticket.requesterId !== requester.id) {
      errorResponse(res, 404, 'ATTACHMENT_NOT_FOUND', 'Attachment not found.');
      return;
    }
    if (attachment.removedAt !== null) {
      if (attachment.removalReason === reason) {
        res.status(200).json({ attachment: safeAttachment(attachment) });
        return;
      }
      errorResponse(res, 409, 'ATTACHMENT_ALREADY_REMOVED', 'Attachment has already been removed.');
      return;
    }
    const updated = await prisma.attachment.update({ where: { id: attachmentId }, data: { isRemoved: true, removedAt: new Date(), removalReason: reason } });
    res.status(200).json({ attachment: safeAttachment(updated) });
  } catch {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Unable to remove attachment.');
  }
});

app.post('/api/tickets', (req, res, next) => {
  upload.array('attachments', 6)(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      errorResponse(res, 400, 'FILE_TOO_LARGE', 'Each attachment must be 5 MB or smaller.');
      return;
    }
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_COUNT') {
      errorResponse(res, 400, 'ATTACHMENT_LIMIT_EXCEEDED', 'A ticket can have at most 5 active attachments.');
      return;
    }
    if (error) {
      next(error);
      return;
    }
    next();
  });
}, async (req, res) => {
  try {
    const requester = await getRequesterContext(req);
    if (!requester) {
      errorResponse(res, 400, 'REQUESTER_CONTEXT_INVALID', 'A valid active requester context is required.');
      return;
    }

    const summary = typeof req.body.summary === 'string' ? req.body.summary.trim() : '';
    const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
    const requestedPriority = typeof req.body.requestedPriority === 'string' ? req.body.requestedPriority.trim() : '';
    const categoryId = Number(req.body.categoryId);
    const relatedSystemId = Number(req.body.relatedSystemId);
    const fields: Record<string, string> = {};

    if (summary.length < 5 || summary.length > 100) fields.summary = 'Summary must be between 5 and 100 characters';
    if (description.length < 10 || description.length > 2000) fields.description = 'Description must be between 10 and 2000 characters';
    if (!priorities.has(requestedPriority)) fields.requestedPriority = 'Priority must be Low, Medium, High, or Urgent';
    if (!Number.isInteger(categoryId) || categoryId < 1) fields.categoryId = 'Category must be a positive integer';
    if (!Number.isInteger(relatedSystemId) || relatedSystemId < 1) fields.relatedSystemId = 'Related system must be a positive integer';

    const files = ((req as express.Request & { files?: UploadedFile[] }).files) ?? [];
    if (files.length > 5) {
      errorResponse(res, 400, 'ATTACHMENT_LIMIT_EXCEEDED', 'A ticket can have at most 5 active attachments.');
      return;
    }
    for (const file of files) {
      const extension = file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase();
      if (!allowedFileTypes.has(file.mimetype) || !allowedExtensions.has(extension)) {
        errorResponse(res, 400, 'UNSUPPORTED_FILE_TYPE', 'Attachments must be JPG, JPEG, PNG, WEBP, or PDF.');
        return;
      }
    }

    const [category, relatedSystem] = await Promise.all([
      Number.isInteger(categoryId) && categoryId > 0 ? prisma.category.findUnique({ where: { id: categoryId } }) : null,
      Number.isInteger(relatedSystemId) && relatedSystemId > 0 ? prisma.relatedSystem.findUnique({ where: { id: relatedSystemId } }) : null
    ]);
    if (!category?.isActive) fields.categoryId = 'Category must reference an active category';
    if (!relatedSystem?.isActive) fields.relatedSystemId = 'Related system must reference an active related system';
    if (Object.keys(fields).length > 0) {
      errorResponse(res, 400, 'VALIDATION_ERROR', 'Request validation failed', fields);
      return;
    }

    const duplicate = await prisma.ticket.findFirst({
      where: {
        requesterId: requester.id,
        summary,
        description,
        createdAt: { gte: new Date(Date.now() - 5000) }
      }
    });
    if (duplicate) {
      errorResponse(res, 409, 'DUPLICATE_SUBMISSION', 'An identical ticket was submitted recently.');
      return;
    }

    const createdTicket = await prisma.$transaction(async (transaction) => transaction.ticket.create({
      data: {
        ticketNumber: ticketNumber(),
        summary,
        description,
        requestedPriority,
        status: 'New',
        requesterId: requester.id,
        categoryId,
        relatedSystemId,
        attachments: {
          create: files.map((file) => ({
            fileName: file.originalname,
            fileSize: file.size,
            fileType: file.mimetype,
            filePath: `memory/${file.originalname}`
          }))
        }
      },
      include: { category: true, relatedSystem: true, attachments: true }
    }));

    res.status(201).json({ ticket: { ...createdTicket, attachments: createdTicket.attachments.map(({ filePath: _path, ...attachment }) => attachment) } });
  } catch (error) {
    if (error instanceof Error && error.message.includes('attachment')) {
      errorResponse(res, 500, 'ATTACHMENT_UPLOAD_FAILED', 'Unable to commit ticket attachments. Please retry.');
      return;
    }
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Unable to create ticket.');
  }
});

// ─── IT Staff endpoints ───────────────────────────────────────────────────────

const staffStatuses = new Set([
  'New', 'Open', 'In Progress', 'Waiting for Requester',
  'Resolved', 'Closed', 'Reopened', 'Cancelled'
]);
const staffSortFields = new Set(['createdAt', 'ticketNumber', 'itPriority', 'status', 'updatedAt']);

// Apply auth + password-complete + role guard to all /api/staff/* routes
app.use('/api/staff', requireAuth, requirePasswordChangeComplete, requireRole('IT_STAFF', 'ADMINISTRATOR'));

app.get('/api/staff/tickets', async (req, res) => {
  try {
    const allowedParams = new Set([
      'search', 'status', 'itPriority', 'ownerId', 'categoryId',
      'sortBy', 'sortOrder', 'page', 'pageSize'
    ]);
    const unknownParam = Object.keys(req.query).find((p) => !allowedParams.has(p));
    if (unknownParam) {
      errorResponse(res, 400, 'INVALID_QUERY_PARAMETER', `Unknown query parameter: ${unknownParam}`);
      return;
    }

    // Guard against repeated params (array values)
    if (Object.values(req.query).some((v) => Array.isArray(v))) {
      errorResponse(res, 400, 'INVALID_QUERY_PARAMETER', 'Query parameters must have a single value.');
      return;
    }

    const search = queryValue(req.query.search)?.trim() ?? '';
    const statusVal = queryValue(req.query.status)?.trim() ?? '';
    const itPriorityVal = queryValue(req.query.itPriority)?.trim() ?? '';
    const ownerIdRaw = queryValue(req.query.ownerId)?.trim() ?? '';
    const categoryIdRaw = queryValue(req.query.categoryId)?.trim() ?? '';
    const sortByRaw = queryValue(req.query.sortBy)?.trim() ?? '';
    const sortOrderRaw = queryValue(req.query.sortOrder)?.trim() ?? '';
    const pageRaw = queryValue(req.query.page)?.trim() ?? '';
    const pageSizeRaw = queryValue(req.query.pageSize)?.trim() ?? '';

    const fields: Record<string, string> = {};

    const categoryId = parsePositiveQueryInteger(categoryIdRaw);
    if (categoryId === null) fields.categoryId = 'categoryId must be a positive integer';

    const page = parsePositiveQueryInteger(pageRaw);
    if (page === null) fields.page = 'page must be a positive integer';

    const pageSize = parsePositiveQueryInteger(pageSizeRaw);
    if (pageSize === null || (pageSize !== undefined && pageSize > 100)) {
      fields.pageSize = 'pageSize must be between 1 and 100';
    }

    if (statusVal && !staffStatuses.has(statusVal)) fields.status = 'status is not a valid ticket status';
    if (itPriorityVal && !priorities.has(itPriorityVal)) fields.itPriority = 'itPriority must be Low, Medium, High, or Urgent';
    if (sortByRaw && !staffSortFields.has(sortByRaw)) fields.sortBy = 'sortBy is not a supported sort field';
    if (sortOrderRaw && !ticketSortOrders.has(sortOrderRaw)) fields.sortOrder = 'sortOrder must be asc or desc';

    // ownerId: must be the literal string "unassigned" or a positive integer
    let ownerIdFilter: number | 'unassigned' | undefined;
    if (ownerIdRaw) {
      if (ownerIdRaw === 'unassigned') {
        ownerIdFilter = 'unassigned';
      } else {
        const parsed = parsePositiveQueryInteger(ownerIdRaw);
        if (parsed === null || parsed === undefined) {
          fields.ownerId = 'ownerId must be a positive integer or "unassigned"';
        } else {
          ownerIdFilter = parsed;
        }
      }
    }

    if (Object.keys(fields).length > 0) {
      errorResponse(res, 400, 'INVALID_QUERY_PARAMETER', 'Request query parameters are invalid.', fields);
      return;
    }

    const sortBy = (sortByRaw || 'createdAt') as 'createdAt' | 'ticketNumber' | 'itPriority' | 'status' | 'updatedAt';
    const sortOrder = (sortOrderRaw || 'desc') as 'asc' | 'desc';

    const where: Prisma.TicketWhereInput = {
      ...(search ? {
        OR: [
          { ticketNumber: { contains: search, mode: 'insensitive' } },
          { summary: { contains: search, mode: 'insensitive' } },
          { requester: { name: { contains: search, mode: 'insensitive' } } }
        ]
      } : {}),
      ...(statusVal ? { status: statusVal } : {}),
      ...(itPriorityVal ? { itPriority: itPriorityVal } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(ownerIdFilter === 'unassigned' ? { ownerId: null }
        : ownerIdFilter !== undefined ? { ownerId: ownerIdFilter }
        : {}),
    };

    const resolvedPage = page ?? 1;
    const resolvedPageSize = pageSize ?? 10;

    const [totalItems, tickets] = await Promise.all([
      prisma.ticket.count({ where }),
      prisma.ticket.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, code: true, isActive: true } },
          relatedSystem: { select: { id: true, name: true, code: true, isActive: true } },
          requester: { select: { id: true, name: true } },
          owner: { select: { id: true, name: true } },
        },
        orderBy: [{ [sortBy]: sortOrder }, { id: 'desc' }],
        skip: (resolvedPage - 1) * resolvedPageSize,
        take: resolvedPageSize,
      })
    ]);

    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / resolvedPageSize);

    res.status(200).json({
      tickets: tickets.map(({ ...ticket }) => ({
        ...ticket,
        // owner is already the safe shape from include select
      })),
      pagination: {
        page: resolvedPage,
        pageSize: resolvedPageSize,
        totalItems,
        totalPages,
        hasNextPage: totalPages > 0 && resolvedPage < totalPages,
        hasPreviousPage: resolvedPage > 1 && totalPages > 0,
      },
      sort: { sortBy, sortOrder },
    });
  } catch {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Unable to load tickets.');
  }
});

// ─── Infrastructure ───────────────────────────────────────────────────────────

async function verifyPrismaConnection() {
  try {
    await prisma.$connect();
    console.log('Connected to database');
  } catch (error) {
    console.error(`Failed to connect to database: ${error instanceof Error ? error.message : String(error)}`);
  }
}

verifyPrismaConnection();

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`TokTickIT API listening on port ${port}`);
  });
}

import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import prisma from './prisma.js';

export const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 6 }
});
const allowedFileTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf']);
const priorities = new Set(['Low', 'Medium', 'High', 'Urgent']);

type UploadedFile = {
  originalname: string;
  mimetype: string;
  size: number;
};

function errorResponse(res: express.Response, status: number, code: string, message: string, fields?: Record<string, string>) {
  res.status(status).json({ error: { code, message, ...(fields ? { fields } : {}) } });
}

async function getRequesterContext(req: express.Request) {
  const rawId = req.header('X-Requester-Id');
  if (!rawId || !/^\d+$/.test(rawId)) return null;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1) return null;
  const requester = await prisma.requesterUser.findUnique({ where: { id } });
  return requester?.isActive ? requester : null;
}

function ticketNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `TICK-${date}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
}

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'TokTickIT API'
  });
});

app.get('/api/categories', async (_req, res) => {
  const categories = await prisma.category.findMany({
    select: {
      id: true,
      name: true
    },
    orderBy: {
      id: 'asc'
    }
  });

  res.status(200).json({ categories });
});

app.get('/api/requesters', async (_req, res) => {
  try {
    const requesters = await prisma.requesterUser.findMany({
      where: {
        isActive: true
      },
      select: {
        id: true,
        name: true,
        email: true,
        department: true,
        isActive: true
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }]
    });

    res.status(200).json({ requesters });
  } catch (error) {
    console.error(`Failed to load requesters: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Unable to load requesters.'
      }
    });
  }
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

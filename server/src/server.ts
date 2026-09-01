import 'dotenv/config';
import express from 'express';
import prisma from './prisma.js';

export const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(express.json());

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

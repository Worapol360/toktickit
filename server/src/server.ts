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

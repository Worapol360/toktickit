import 'dotenv/config';
import express from 'express';
import prisma from './prisma.js';

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(express.json());

app.listen(port, () => {
  console.log(`TokTickIT API listening on port ${port}`);
});

async function verifyPrismaConnection() {
  await prisma.$connect();
  console.log('Prisma connected to PostgreSQL successfully.');
}

verifyPrismaConnection().catch((error) => {
  console.error('Prisma failed to connect to PostgreSQL:', error);
});

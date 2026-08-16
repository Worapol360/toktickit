import prisma from '../src/prisma.js';

const categoryNames = [
  'Account and Access',
  'Hardware',
  'Software',
  'Network',
] as const;

async function main() {
  for (const name of categoryNames) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log('Seeded categories successfully.');
}

main()
  .catch((error) => {
    console.error('Failed to seed categories:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
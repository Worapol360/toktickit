import prisma from '../src/prisma.js';

const categoryNames = [
  'Account and Access',
  'Hardware',
  'Software',
  'Network',
] as const;

const requesters = [
  { id: 1, name: 'Aiko Tanaka', email: 'aiko@example.com', department: 'Finance', isActive: true },
  { id: 2, name: 'Daniel Kim', email: 'daniel@example.com', department: 'IT', isActive: true },
  { id: 3, name: 'Marcus Lee', email: 'marcus@example.com', department: 'Operations', isActive: true },
  { id: 4, name: 'Priya Singh', email: 'priya@example.com', department: 'Support', isActive: true },
  { id: 5, name: 'Inactive User', email: 'inactive@example.com', department: 'Finance', isActive: false }
] as const;

async function main() {
  for (const name of categoryNames) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  await prisma.requesterUser.deleteMany();
  await prisma.requesterUser.createMany({
    data: requesters.map((requester) => ({
      id: requester.id,
      name: requester.name,
      email: requester.email,
      department: requester.department,
      isActive: requester.isActive
    })),
    skipDuplicates: true
  });

  console.log('Seeded categories and requesters successfully.');
}

main()
  .catch((error) => {
    console.error('Failed to seed categories and requesters:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
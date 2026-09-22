import bcrypt from 'bcryptjs';
import prisma from '../src/prisma.js';

const categories = [
  { name: 'Account and Access', code: 'ACCOUNT_ACCESS', isActive: true },
  { name: 'Hardware', code: 'HARDWARE', isActive: true },
  { name: 'Software', code: 'SOFTWARE', isActive: true },
  { name: 'Network', code: 'NETWORK', isActive: true },
] as const;

const users = [
  { id: 1, name: 'Aiko Tanaka', email: 'aiko@example.com', department: 'Finance', role: 'REQUESTER' as const, isActive: true },
  { id: 2, name: 'Daniel Kim', email: 'daniel@example.com', department: 'IT', role: 'REQUESTER' as const, isActive: true },
  { id: 3, name: 'Marcus Lee', email: 'marcus@example.com', department: 'Operations', role: 'REQUESTER' as const, isActive: true },
  { id: 4, name: 'Priya Singh', email: 'priya@example.com', department: 'Support', role: 'REQUESTER' as const, isActive: true },
  { id: 5, name: 'Inactive User', email: 'inactive@example.com', department: 'Finance', role: 'REQUESTER' as const, isActive: false },
  { id: 6, name: 'Noah Williams', email: 'noah.it@example.com', department: 'IT', role: 'IT_STAFF' as const, isActive: true },
  { id: 7, name: 'Priya Nair', email: 'priya.it@example.com', department: 'IT', role: 'IT_STAFF' as const, isActive: true },
  { id: 8, name: 'Owen Chen', email: 'owen.it@example.com', department: 'IT', role: 'IT_STAFF' as const, isActive: true },
  { id: 9, name: 'Inactive Staff', email: 'inactive.staff@example.com', department: 'IT', role: 'IT_STAFF' as const, isActive: false },
  { id: 10, name: 'Admin User', email: 'admin@example.com', department: 'IT', role: 'ADMINISTRATOR' as const, isActive: true },
] as const;

const relatedSystems = [
  { name: 'File Services', code: 'FILE_SERVICES' },
  { name: 'Email', code: 'EMAIL' },
  { name: 'Network', code: 'NETWORK' }
] as const;

async function main() {
  const password = 'LocalOnly1!';
  const passwordHash = await bcrypt.hash(password, 12);

  for (const category of categories) {
    await prisma.category.upsert({ where: { name: category.name }, update: { code: category.code, isActive: category.isActive }, create: category });
  }

  for (const user of users) {
    await prisma.user.upsert({
      where: { emailNormalized: user.email.toLowerCase() },
      update: { name: user.name, department: user.department, role: user.role, isActive: user.isActive },
      create: {
        ...(user.id ? { id: user.id } : {}),
        name: user.name,
        email: user.email,
        emailNormalized: user.email.toLowerCase(),
        department: user.department,
        passwordHash,
        role: user.role,
        isActive: user.isActive,
        mustChangePassword: true
      }
    });
  }

  for (const relatedSystem of relatedSystems) {
    await prisma.relatedSystem.upsert({ where: { code: relatedSystem.code }, update: { name: relatedSystem.name, isActive: true }, create: relatedSystem });
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log(`Local seed passwords: ${users.map((user) => `${user.email}=${password}`).join(', ')}`);
  }
  console.log('Seeded categories, related systems, and Lab 3 users successfully.');
}

main()
  .catch((error) => {
    console.error('Failed to seed categories, related systems, and users:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

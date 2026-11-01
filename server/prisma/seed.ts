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

// Lab 4 seed: Tickets TICK-20261020-9001..9012 (reserved range, zero collisions) covering
// all 8 statuses, assigned/unassigned, itPriority NULL, markedResolved, and Actions 0/1/3+.
const lab4Tickets = [
  { ticketNumber: 'TICK-20261020-9001', status: 'New', requesterId: 1, ownerId: null, itPriority: null, markedResolved: false, resolvedAt: false, summary: 'Seed: brand new unassigned request' },
  { ticketNumber: 'TICK-20261020-9002', status: 'Open', requesterId: 2, ownerId: 6, itPriority: 'Medium', markedResolved: false, resolvedAt: false, summary: 'Seed: shared drive access request' },
  { ticketNumber: 'TICK-20261020-9003', status: 'In Progress', requesterId: 3, ownerId: 7, itPriority: 'High', markedResolved: false, resolvedAt: false, summary: 'Seed: print spooler outage on floor 3' },
  { ticketNumber: 'TICK-20261020-9004', status: 'Waiting for Requester', requesterId: 1, ownerId: 6, itPriority: 'Medium', markedResolved: false, resolvedAt: false, summary: 'Seed: intermittent monitor blackout' },
  { ticketNumber: 'TICK-20261020-9005', status: 'Resolved', requesterId: 2, ownerId: 7, itPriority: 'Medium', markedResolved: true, resolvedAt: true, summary: 'Seed: failed laptop SSD replacement' },
  { ticketNumber: 'TICK-20261020-9006', status: 'Closed', requesterId: 3, ownerId: 6, itPriority: 'Low', markedResolved: true, resolvedAt: true, summary: 'Seed: duplicate badge printer request' },
  { ticketNumber: 'TICK-20261020-9007', status: 'Reopened', requesterId: 1, ownerId: 7, itPriority: 'Urgent', markedResolved: false, resolvedAt: false, summary: 'Seed: VPN drops returned after reopen' },
  { ticketNumber: 'TICK-20261020-9008', status: 'Cancelled', requesterId: 2, ownerId: null, itPriority: 'Low', markedResolved: false, resolvedAt: false, summary: 'Seed: cancelled desk relocation request' },
  { ticketNumber: 'TICK-20261020-9009', status: 'Open', requesterId: 3, ownerId: null, itPriority: 'Medium', markedResolved: false, resolvedAt: false, summary: 'Seed: unassigned login failure queue item' },
  { ticketNumber: 'TICK-20261020-9010', status: 'New', requesterId: 1, ownerId: 6, itPriority: 'High', markedResolved: false, resolvedAt: false, summary: 'Seed: new network printer installation' },
  { ticketNumber: 'TICK-20261020-9011', status: 'In Progress', requesterId: 2, ownerId: 7, itPriority: 'High', markedResolved: false, resolvedAt: false, summary: 'Seed: workstation crash under load' },
  { ticketNumber: 'TICK-20261020-9012', status: 'Closed', requesterId: 3, ownerId: 6, itPriority: 'Urgent', markedResolved: true, resolvedAt: true, summary: 'Seed: closed urgent firewall rule fix' }
] as const;

type Lab4SeedAction = {
  clientRequestId: string;
  performedById: number;
  minutesAfterCreate: number;
  description: string;
  result: string;
  followUpRequired?: true;
  followUpNote?: string;
  followUpCompletedMinutesAfter?: number;
  attachmentNotes?: string;
};

const lab4Actions: Record<string, readonly Lab4SeedAction[]> = {
  'TICK-20261020-9002': [
    { clientRequestId: 'seed-act-01', performedById: 6, minutesAfterCreate: 15, description: 'Reviewed the access request and confirmed group membership.', result: 'User added to Finance-Users; access restored.' }
  ],
  'TICK-20261020-9003': [
    { clientRequestId: 'seed-act-02', performedById: 7, minutesAfterCreate: 10, description: 'Restarted the file server print spooler service.', result: 'Spooler healthy; test print succeeded.' },
    { clientRequestId: 'seed-act-03', performedById: 8, minutesAfterCreate: 25, description: 'Validated the share permissions after the restart.', result: 'Share reachable from two workstations.' },
    { clientRequestId: 'seed-act-04', performedById: 7, minutesAfterCreate: 40, description: 'Scheduled a follow-up check with the floor supervisor.', result: 'Pending user confirmation.', followUpRequired: true, followUpNote: 'Re-check share access after the reboot window.' }
  ],
  'TICK-20261020-9004': [
    { clientRequestId: 'seed-act-05', performedById: 6, minutesAfterCreate: 20, description: 'Asked the user to confirm the new monitor cable seating.', result: 'Awaiting user confirmation before closing.', followUpRequired: true, followUpNote: 'Confirm the monitor stays stable for 24 hours.' }
  ],
  'TICK-20261020-9005': [
    { clientRequestId: 'seed-act-06', performedById: 7, minutesAfterCreate: 30, description: 'Replaced the failing SSD and restored the backup.', result: 'System boots; all files restored and verified.', followUpRequired: true, followUpNote: 'Verify the nightly backup completes.', followUpCompletedMinutesAfter: 120 }
  ],
  'TICK-20261020-9006': [
    { clientRequestId: 'seed-act-07', performedById: 6, minutesAfterCreate: 15, description: 'Closed the duplicate request after merging into the main ticket.', result: 'Duplicate closed; conversation merged.' },
    { clientRequestId: 'seed-act-08', performedById: 6, minutesAfterCreate: 45, description: 'Sent the closure summary to the requester.', result: 'Summary delivered by email.' },
    { clientRequestId: 'seed-act-09', performedById: 7, minutesAfterCreate: 90, description: 'Completed the final verification call with the requester.', result: 'Requester confirmed resolution on the call.', followUpRequired: true, followUpNote: 'Collect the signed closure form.', followUpCompletedMinutesAfter: 150 }
  ],
  'TICK-20261020-9007': [
    { clientRequestId: 'seed-act-10', performedById: 7, minutesAfterCreate: 20, description: 'Reopened after the issue returned; captured new VPN logs.', result: 'Logs collected; root cause under investigation.', followUpRequired: true, followUpNote: 'Check the logs again after the next occurrence.' }
  ],
  'TICK-20261020-9009': [
    { clientRequestId: 'seed-act-11', performedById: 8, minutesAfterCreate: 30, description: 'Triaged the unassigned queue and reproduced the login failure.', result: 'Reproduced; credential reset pending approval.' }
  ],
  'TICK-20261020-9010': [
    { clientRequestId: 'seed-act-12', performedById: 6, minutesAfterCreate: 10, description: 'Confirmed the new printer is joined to the domain.', result: 'Printer joined; test page printed.' }
  ],
  'TICK-20261020-9011': [
    { clientRequestId: 'seed-act-13', performedById: 7, minutesAfterCreate: 5, description: 'Collected the crash dump from the workstation.', result: 'Crash dump saved to the share.' },
    { clientRequestId: 'seed-act-14', performedById: 8, minutesAfterCreate: 35, description: 'Analyzed the dump and identified a driver conflict.', result: 'Outdated display driver flagged for replacement.', followUpRequired: true, followUpNote: 'Install the updated driver and confirm stability.' },
    { clientRequestId: 'seed-act-15', performedById: 7, minutesAfterCreate: 70, description: 'Updated the driver package on the test device.', result: 'Driver installs cleanly on the test device.', attachmentNotes: 'See crash-dump-report.pdf on the ticket.' }
  ]
};

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

  await prisma.$queryRaw`
    SELECT setval(
      pg_get_serial_sequence('"requester_user"', 'id'),
      COALESCE(MAX("id"), 1),
      MAX("id") IS NOT NULL
    )
    FROM "requester_user"
  `;

  for (const relatedSystem of relatedSystems) {
    await prisma.relatedSystem.upsert({ where: { code: relatedSystem.code }, update: { name: relatedSystem.name, isActive: true }, create: relatedSystem });
  }

  const accountCategory = await prisma.category.findUnique({ where: { code: 'ACCOUNT_ACCESS' } });
  const fileServices = await prisma.relatedSystem.findUnique({ where: { code: 'FILE_SERVICES' } });
  if (!accountCategory || !fileServices) {
    throw new Error('Seed categories/systems are missing; cannot create Lab 4 tickets.');
  }

  // Lab 4 tickets/actions: find-then-create so a rerun never modifies an existing row.
  for (const seedTicket of lab4Tickets) {
    let ticket = await prisma.ticket.findUnique({ where: { ticketNumber: seedTicket.ticketNumber } });
    if (!ticket) {
      ticket = await prisma.ticket.create({
        data: {
          ticketNumber: seedTicket.ticketNumber,
          summary: seedTicket.summary,
          description: `Lab 4 seed fixture (${seedTicket.ticketNumber}).`,
          requestedPriority: 'Medium',
          itPriority: seedTicket.itPriority,
          status: seedTicket.status,
          requesterMarkedResolved: seedTicket.markedResolved,
          requesterId: seedTicket.requesterId,
          ownerId: seedTicket.ownerId,
          categoryId: accountCategory.id,
          relatedSystemId: fileServices.id
        }
      });
      if (seedTicket.resolvedAt) {
        await prisma.ticket.update({
          where: { id: ticket.id },
          data: { resolvedAt: ticket.updatedAt }
        });
      }
    }

    for (const seedAction of lab4Actions[seedTicket.ticketNumber] ?? []) {
      const existingAction = await prisma.actionTaken.findFirst({
        where: { ticketId: ticket.id, clientRequestId: seedAction.clientRequestId }
      });
      if (existingAction) continue;

      const actionAt = new Date(ticket.createdAt.getTime() + seedAction.minutesAfterCreate * 60_000);
      const followUpCompletedAt =
        seedAction.followUpRequired && seedAction.followUpCompletedMinutesAfter !== undefined
          ? new Date(ticket.createdAt.getTime() + seedAction.followUpCompletedMinutesAfter * 60_000)
          : null;

      await prisma.actionTaken.create({
        data: {
          ticketId: ticket.id,
          actionAt,
          description: seedAction.description,
          result: seedAction.result,
          followUpRequired: seedAction.followUpRequired === true,
          followUpNote: seedAction.followUpRequired === true ? seedAction.followUpNote ?? null : null,
          followUpCompletedAt,
          attachmentNotes: seedAction.attachmentNotes ?? null,
          clientRequestId: seedAction.clientRequestId,
          performedById: seedAction.performedById,
          updatedById: seedAction.performedById
        }
      });
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log(`Local seed passwords: ${users.map((user) => `${user.email}=${password}`).join(', ')}`);
  }
  console.log('Seeded categories, related systems, Lab 3 users, and Lab 4 tickets/actions successfully.');
}

main()
  .catch((error) => {
    console.error('Failed to seed categories, related systems, and users:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

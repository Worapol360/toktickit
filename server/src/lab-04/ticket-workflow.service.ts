/**
 * Ticket workflow service (Lab 4, Issue 4).
 * PATCH /api/staff/tickets/:id/status — api-spec.md §4.1, specification.md
 * BR-13, BR-15, BR-16, BR-18, BR-20, BR-21, BR-22.
 *
 * All checks (version, transition, resolution gate) and the write run inside
 * ONE prisma.$transaction that locks the Ticket row with the shared
 * Issue 2 row-lock helper, re-reading status and version after the lock.
 * The gate counts Actions Taken inside the same transaction, and the final
 * write is a conditional update on version.
 */
import type { Prisma } from '@prisma/client';
import prisma from '../prisma.js';
import { isValidStatusTransition } from '../server.js';
import { evaluateResolutionGate } from './ticket-workflow-rules.js';
import { lockTicketRow } from './actions-taken.service.js';

const STAFF_STATUSES = new Set([
  'New', 'Open', 'In Progress', 'Waiting for Requester',
  'Resolved', 'Closed', 'Reopened', 'Cancelled'
]);

export type StatusChangeFailure =
  | { kind: 'validation'; fields: Record<string, string> }
  | { kind: 'ticket-not-found' }
  | { kind: 'version-conflict'; currentVersion: number }
  | { kind: 'invalid-transition'; from: string; to: string }
  | { kind: 'resolution-blocked'; reason: 'NO_ACTIONS_TAKEN' | 'OPEN_FOLLOW_UPS'; openFollowUps: number };

const STAFF_TICKET_INCLUDE = {
  category: true,
  relatedSystem: true,
  requester: { select: { id: true, name: true } },
  owner: { select: { id: true, name: true } }
} satisfies Prisma.TicketInclude;

export type StaffTicketPayload = Prisma.TicketGetPayload<{ include: typeof STAFF_TICKET_INCLUDE }>;

export type StatusChangeResult =
  | { status: 200; ticket: StaffTicketPayload }
  | { error: StatusChangeFailure };

/** Optional optimistic-concurrency token: absent/undefined is allowed (BR-21). */
export function parseOptionalExpectedVersion(value: unknown): { ok: true; value: number | null } | { ok: false } {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) return { ok: false };
  return { ok: true, value };
}

export async function changeTicketStatus(
  ticketId: number,
  status: string,
  rawExpectedVersion: unknown
): Promise<StatusChangeResult> {
  if (!STAFF_STATUSES.has(status)) {
    return { error: { kind: 'validation', fields: { status: 'Invalid status value.' } } };
  }

  const parsed = parseOptionalExpectedVersion(rawExpectedVersion);
  if (!parsed.ok) {
    return { error: { kind: 'validation', fields: { expectedVersion: 'expectedVersion must be a positive integer.' } } };
  }
  const expectedVersion = parsed.value;

  return prisma.$transaction(async (tx) => {
    const locked = await lockTicketRow(tx, ticketId);
    if (locked.length === 0) {
      return { error: { kind: 'ticket-not-found' } as const };
    }
    const current = locked[0];

    // Re-read state after the lock: stale expectedVersion loses (BR-21/BR-22).
    if (expectedVersion !== null && current.version !== expectedVersion) {
      return { error: { kind: 'version-conflict', currentVersion: current.version } as const };
    }

    // FR-07: the backend enforces the final matrix (BR-13).
    if (!isValidStatusTransition(current.status, status)) {
      return { error: { kind: 'invalid-transition', from: current.status, to: status } as const };
    }

    // FR-08: resolution gate inside the same locked transaction (BR-15/BR-16).
    if (status === 'Resolved') {
      const total = await tx.actionTaken.count({ where: { ticketId } });
      const openFollowUps = await tx.actionTaken.count({
        where: { ticketId, followUpRequired: true, followUpCompletedAt: null }
      });
      const gate = evaluateResolutionGate({ total, openFollowUps });
      if (!gate.pass) {
        return {
          error: {
            kind: 'resolution-blocked',
            reason: gate.reason,
            openFollowUps: gate.openFollowUps
          } as const
        };
      }
    }

    // Conditional write on version (BR-22); side effects per BR-17/BR-18.
    const updated = await tx.ticket.updateMany({
      where: { id: ticketId, version: current.version },
      data: {
        status,
        version: current.version + 1,
        ...(status === 'Resolved' ? { resolvedAt: new Date() } : {}),
        ...(status === 'Reopened' ? { resolvedAt: null, requesterMarkedResolved: false } : {})
      }
    });
    if (updated.count === 0) {
      const latest = await tx.ticket.findUnique({ where: { id: ticketId }, select: { version: true } });
      return { error: { kind: 'version-conflict', currentVersion: latest?.version ?? current.version } as const };
    }

    const ticket = await tx.ticket.findUniqueOrThrow({
      where: { id: ticketId },
      include: STAFF_TICKET_INCLUDE
    });
    return { status: 200 as const, ticket };
  });
}

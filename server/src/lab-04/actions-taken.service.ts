/**
 * Actions Taken service (Lab 4, Issue 2).
 * Transactional create/patch per specification.md BR-19 … BR-23 and
 * api-spec.md §3.1 … §3.3.
 */
import type { Prisma } from '@prisma/client';
import prisma from '../prisma.js';
import {
  validateCreateAction,
  validatePatchAction,
  type ValidatedPatchValues
} from './action-validator.js';

const ACTION_SELECT = {
  id: true,
  ticketId: true,
  actionAt: true,
  description: true,
  result: true,
  followUpRequired: true,
  followUpNote: true,
  followUpCompletedAt: true,
  attachmentNotes: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  performedBy: { select: { id: true, name: true } },
  updatedBy: { select: { id: true, name: true } }
} satisfies Prisma.ActionTakenSelect;

const LOCKED_STATUSES = ['Resolved', 'Closed', 'Cancelled'];

export type ActionsTakenFailure =
  | { kind: 'validation'; fields: Record<string, string> }
  | { kind: 'ticket-not-found' }
  | { kind: 'action-not-found' }
  | { kind: 'locked' }
  | { kind: 'version-conflict'; currentVersion: number };

export type ActionsTakenListResult = {
  actionsTaken: Array<Prisma.ActionTakenGetPayload<{ select: typeof ACTION_SELECT }>>;
  summary: { total: number; openFollowUps: number };
};

export async function listActionsTaken(ticketId: number): Promise<ActionsTakenListResult> {
  const actionsTaken = await prisma.actionTaken.findMany({
    where: { ticketId },
    select: ACTION_SELECT,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
  });

  let openFollowUps = 0;
  for (const action of actionsTaken) {
    if (action.followUpRequired && action.followUpCompletedAt === null) {
      openFollowUps += 1;
    }
  }

  return { actionsTaken, summary: { total: actionsTaken.length, openFollowUps } };
}

type CreateResult =
  | { status: 200 | 201; actionTaken: Prisma.ActionTakenGetPayload<{ select: typeof ACTION_SELECT }> }
  | { error: ActionsTakenFailure };

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

export async function createActionTaken(
  ticketId: number,
  performedById: number,
  rawBody: unknown,
  ticketCreatedAt: Date
): Promise<CreateResult> {
  const validation = validateCreateAction(rawBody, { ticketCreatedAt, now: new Date() });
  if (!validation.ok) {
    return { error: { kind: 'validation', fields: validation.fields } };
  }
  const value = validation.value;

  try {
    return await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: number; status: string }>>`
        SELECT "id", "status" FROM "Ticket" WHERE "id" = ${ticketId} FOR UPDATE
      `;
      if (locked.length === 0) {
        return { error: { kind: 'ticket-not-found' } as const };
      }
      if (LOCKED_STATUSES.includes(locked[0].status)) {
        return { error: { kind: 'locked' } as const };
      }

      if (value.clientRequestId !== null) {
        const existing = await tx.actionTaken.findUnique({
          where: {
            ticketId_clientRequestId: { ticketId, clientRequestId: value.clientRequestId }
          },
          select: ACTION_SELECT
        });
        if (existing) {
          return { status: 200 as const, actionTaken: existing };
        }
      }

      const actionTaken = await tx.actionTaken.create({
        data: {
          ticketId,
          actionAt: value.actionAt,
          description: value.description,
          result: value.result,
          followUpRequired: value.followUpRequired,
          followUpNote: value.followUpNote,
          followUpCompletedAt: value.followUpCompletedAt,
          attachmentNotes: value.attachmentNotes,
          clientRequestId: value.clientRequestId,
          performedById,
          updatedById: performedById
        },
        select: ACTION_SELECT
      });

      await tx.ticket.update({
        where: { id: ticketId },
        data: { updatedAt: new Date() }
      });

      return { status: 201 as const, actionTaken };
    });
  } catch (error) {
    if (isUniqueConstraintError(error) && value.clientRequestId !== null) {
      const existing = await prisma.actionTaken.findUnique({
        where: {
          ticketId_clientRequestId: { ticketId, clientRequestId: value.clientRequestId }
        },
        select: ACTION_SELECT
      });
      if (existing) {
        return { status: 200, actionTaken: existing };
      }
    }
    throw error;
  }
}

type PatchResult =
  | { status: 200; actionTaken: Prisma.ActionTakenGetPayload<{ select: typeof ACTION_SELECT }> }
  | { error: ActionsTakenFailure };

export async function patchActionTaken(
  ticketId: number,
  actionId: number,
  updatedById: number,
  rawBody: unknown
): Promise<PatchResult> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, status: true, createdAt: true }
  });
  if (!ticket) {
    return { error: { kind: 'ticket-not-found' } };
  }

  const existing = await prisma.actionTaken.findUnique({
    where: { id: actionId },
    select: {
      id: true,
      ticketId: true,
      actionAt: true,
      description: true,
      result: true,
      followUpRequired: true,
      followUpNote: true,
      followUpCompletedAt: true,
      attachmentNotes: true,
      version: true
    }
  });
  if (!existing || existing.ticketId !== ticketId) {
    return { error: { kind: 'action-not-found' } };
  }

  const validation = validatePatchAction(
    rawBody,
    {
      actionAt: existing.actionAt,
      description: existing.description,
      result: existing.result,
      followUpRequired: existing.followUpRequired,
      followUpNote: existing.followUpNote,
      followUpCompletedAt: existing.followUpCompletedAt,
      attachmentNotes: existing.attachmentNotes
    },
    { ticketCreatedAt: ticket.createdAt, now: new Date() }
  );
  if (!validation.ok) {
    return { error: { kind: 'validation', fields: validation.fields } };
  }
  const value: ValidatedPatchValues = validation.value;

  if (LOCKED_STATUSES.includes(ticket.status)) {
    return { error: { kind: 'locked' } };
  }

  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: number; status: string }>>`
      SELECT "id", "status" FROM "Ticket" WHERE "id" = ${ticketId} FOR UPDATE
    `;
    if (locked.length === 0) {
      return { error: { kind: 'ticket-not-found' } as const };
    }
    if (LOCKED_STATUSES.includes(locked[0].status)) {
      return { error: { kind: 'locked' } as const };
    }

    const updated = await tx.actionTaken.updateMany({
      where: { id: actionId, version: value.expectedVersion },
      data: {
        actionAt: value.actionAt,
        description: value.description,
        result: value.result,
        followUpRequired: value.followUpRequired,
        followUpNote: value.followUpNote,
        followUpCompletedAt: value.followUpCompletedAt,
        attachmentNotes: value.attachmentNotes,
        version: value.expectedVersion + 1,
        updatedById
      }
    });

    if (updated.count === 0) {
      const current = await tx.actionTaken.findUnique({
        where: { id: actionId },
        select: { version: true }
      });
      return {
        error: {
          kind: 'version-conflict',
          currentVersion: current?.version ?? existing.version
        } as const
      };
    }

    const actionTaken = await tx.actionTaken.findUniqueOrThrow({
      where: { id: actionId },
      select: ACTION_SELECT
    });

    await tx.ticket.update({
      where: { id: ticketId },
      data: { updatedAt: new Date() }
    });

    return { status: 200 as const, actionTaken };
  });
}

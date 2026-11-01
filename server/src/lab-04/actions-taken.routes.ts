/**
 * Actions Taken routes (Lab 4, Issue 2).
 * api-spec.md §3.1 (shared list), §3.2 (create), §3.3 (patch).
 * Role gates are applied per route (D-14); CSRF is handled by the global guard.
 */
import { Router } from 'express';
import prisma from '../prisma.js';
import { errorResponse, requireRole, type AuthenticatedRequest } from '../auth.js';
import { createActionTaken, listActionsTaken, patchActionTaken } from './actions-taken.service.js';

function parsePositiveId(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export const actionsTakenListRouter = Router({ mergeParams: true });

actionsTakenListRouter.get(
  '/:id/actions-taken',
  requireRole('REQUESTER', 'IT_STAFF', 'ADMINISTRATOR'),
  async (req, res) => {
    try {
      const ticketId = parsePositiveId(req.params.id);
      if (ticketId === null) {
        errorResponse(res, 400, 'INVALID_TICKET_ID', 'Ticket ID must be a positive integer.');
        return;
      }

      const user = (req as AuthenticatedRequest).user!;
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        select: { requesterId: true }
      });
      if (!ticket || (user.role === 'REQUESTER' && ticket.requesterId !== user.id)) {
        errorResponse(res, 404, 'TICKET_NOT_FOUND', 'Ticket not found.');
        return;
      }

      const result = await listActionsTaken(ticketId);
      res.status(200).json(result);
    } catch {
      errorResponse(res, 500, 'INTERNAL_ERROR', 'Unable to load actions taken.');
    }
  }
);

export const staffActionsTakenRouter = Router({ mergeParams: true });

staffActionsTakenRouter.post('/:id/actions-taken', async (req, res) => {
  try {
    const ticketId = parsePositiveId(req.params.id);
    if (ticketId === null) {
      errorResponse(res, 400, 'INVALID_TICKET_ID', 'Ticket ID must be a positive integer.');
      return;
    }

    const user = (req as AuthenticatedRequest).user!;
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, createdAt: true }
    });
    if (!ticket) {
      errorResponse(res, 404, 'TICKET_NOT_FOUND', 'Ticket not found.');
      return;
    }

    const result = await createActionTaken(ticketId, user.id, req.body, ticket.createdAt);
    if ('error' in result) {
      const failure = result.error;
      if (failure.kind === 'validation') {
        errorResponse(res, 400, 'VALIDATION_ERROR', 'Request validation failed.', failure.fields);
        return;
      }
      if (failure.kind === 'ticket-not-found') {
        errorResponse(res, 404, 'TICKET_NOT_FOUND', 'Ticket not found.');
        return;
      }
      if (failure.kind === 'locked') {
        errorResponse(res, 409, 'TICKET_ACTIONS_LOCKED', "Actions can't be changed while the Ticket is locked.");
        return;
      }
      errorResponse(res, 500, 'INTERNAL_ERROR', 'Unable to create action.');
      return;
    }

    res.status(result.status).json({ actionTaken: result.actionTaken });
  } catch {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Unable to create action.');
  }
});

staffActionsTakenRouter.patch('/:id/actions-taken/:actionId', async (req, res) => {
  try {
    const ticketId = parsePositiveId(req.params.id);
    if (ticketId === null) {
      errorResponse(res, 400, 'INVALID_TICKET_ID', 'Ticket ID must be a positive integer.');
      return;
    }
    const actionId = parsePositiveId(req.params.actionId);
    if (actionId === null) {
      errorResponse(res, 400, 'INVALID_ACTION_ID', 'Action ID must be a positive integer.');
      return;
    }

    const user = (req as AuthenticatedRequest).user!;
    const result = await patchActionTaken(ticketId, actionId, user.id, req.body);
    if ('error' in result) {
      const failure = result.error;
      if (failure.kind === 'validation') {
        errorResponse(res, 400, 'VALIDATION_ERROR', 'Request validation failed.', failure.fields);
        return;
      }
      if (failure.kind === 'ticket-not-found') {
        errorResponse(res, 404, 'TICKET_NOT_FOUND', 'Ticket not found.');
        return;
      }
      if (failure.kind === 'action-not-found') {
        errorResponse(res, 404, 'ACTION_NOT_FOUND', 'Action not found.');
        return;
      }
      if (failure.kind === 'locked') {
        errorResponse(res, 409, 'TICKET_ACTIONS_LOCKED', "Actions can't be changed while the Ticket is locked.");
        return;
      }
      errorResponse(
        res,
        409,
        'VERSION_CONFLICT',
        'This action was changed by someone else. Reload to see the latest version.',
        undefined,
        { currentVersion: failure.currentVersion }
      );
      return;
    }

    res.status(200).json({ actionTaken: result.actionTaken });
  } catch {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Unable to update action.');
  }
});

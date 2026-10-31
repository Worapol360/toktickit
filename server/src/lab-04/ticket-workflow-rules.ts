/**
 * Ticket workflow rules (Lab 4, Issue 4) — pure functions only.
 * specification.md BR-13, BR-15, BR-16 (D-05, D-06, D-15, D-17) and
 * api-spec.md §2.1, §4.1, §4.5.
 *
 * The transition matrix lives in the shared ticket-status module; these
 * functions only read it so the backend keeps a single source of truth and
 * the client keeps none.
 */
import { STATUS_TRANSITIONS } from './ticket-status.js';

/** BR-27 / D-17: statuses counted as "active" by statusGroup=active. */
export const ACTIVE_STATUSES: readonly string[] = [
  'New',
  'Open',
  'In Progress',
  'Waiting for Requester',
  'Reopened'
];

/** The statuses a Ticket currently in `from` may move to (BR-13 matrix). */
export function getAllowedTransitions(from: string): string[] {
  return [...(STATUS_TRANSITIONS[from] ?? [])];
}

export type ResolutionGateInput = {
  total: number;
  openFollowUps: number;
};

export type ResolutionGateResult =
  | { pass: true }
  | { pass: false; reason: 'NO_ACTIONS_TAKEN' | 'OPEN_FOLLOW_UPS'; openFollowUps: number };

/**
 * BR-15 / D-06: resolving requires at least one Action Taken and no open
 * follow-up (followUpRequired = true and followUpCompletedAt IS NULL).
 */
export function evaluateResolutionGate({ total, openFollowUps }: ResolutionGateInput): ResolutionGateResult {
  if (total <= 0) {
    return { pass: false, reason: 'NO_ACTIONS_TAKEN', openFollowUps: 0 };
  }
  if (openFollowUps > 0) {
    return { pass: false, reason: 'OPEN_FOLLOW_UPS', openFollowUps };
  }
  return { pass: true };
}

/** Staff-scoped Ticket view: adds allowedTransitions (api-spec §2.1, D-15). */
export function withAllowedTransitions<T extends { status: string }>(
  ticket: T
): T & { allowedTransitions: string[] } {
  return { ...ticket, allowedTransitions: getAllowedTransitions(ticket.status) };
}

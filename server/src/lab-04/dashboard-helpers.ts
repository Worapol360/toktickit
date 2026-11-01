/**
 * Dashboard helpers (Lab 4, Issue 5) — pure functions only.
 * specification.md BR-27, BR-28, D-08, D-18 and api-spec.md §5.
 */
import { ACTIVE_STATUSES } from './ticket-workflow-rules.js';

export { ACTIVE_STATUSES };

/** BR-27 / D-08: "Recent" = rolling last 7 x 24 hours from request time. */
export const RECENT_WINDOW_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The inclusive lower boundary of the rolling recent window. */
export function recentWindowStart(now: Date): Date {
  return new Date(now.getTime() - RECENT_WINDOW_DAYS * DAY_MS);
}

export function isActiveStatus(status: string): boolean {
  return ACTIVE_STATUSES.includes(status);
}

/** BR-27: an instant is "recent" when it is >= now - 7 days (inclusive edge). */
export function isWithinRecentWindow(instant: Date, now: Date): boolean {
  return instant.getTime() >= recentWindowStart(now).getTime();
}

/** D-18: itPriority = NULL is bucketed as "Unset". */
export type PriorityBucket = 'Low' | 'Medium' | 'High' | 'Urgent' | 'Unset';

export const PRIORITY_BUCKETS: readonly PriorityBucket[] = ['Low', 'Medium', 'High', 'Urgent', 'Unset'];

export function priorityBucket(itPriority: string | null | undefined): PriorityBucket {
  if (itPriority === 'Low' || itPriority === 'Medium' || itPriority === 'High' || itPriority === 'Urgent') {
    return itPriority;
  }
  return 'Unset';
}

/** api-spec.md §5.2: byStatus always contains all 8 statuses in this order. */
export const DASHBOARD_STATUS_ORDER: readonly string[] = [
  'New',
  'Open',
  'In Progress',
  'Waiting for Requester',
  'Resolved',
  'Closed',
  'Reopened',
  'Cancelled'
];

/** api-spec.md §5.2: myRecentActions[].description truncated to 120 characters. */
export const ACTION_DESCRIPTION_LIMIT = 120;

export function truncateActionDescription(description: string): string {
  if (description.length <= ACTION_DESCRIPTION_LIMIT) return description;
  return `${description.slice(0, ACTION_DESCRIPTION_LIMIT)}…`;
}

/**
 * UNIT-05: Dashboard helpers — Active status set, 7-day window edge,
 * priority bucket (NULL -> Unset), and description truncation.
 * specification.md BR-27, D-08, D-18; api-spec.md §5.2.
 */
import { describe, expect, it } from 'vitest';
import {
  ACTION_DESCRIPTION_LIMIT,
  ACTIVE_STATUSES,
  DASHBOARD_STATUS_ORDER,
  RECENT_WINDOW_DAYS,
  isActiveStatus,
  isWithinRecentWindow,
  priorityBucket,
  recentWindowStart,
  truncateActionDescription
} from '../../src/lab-04/dashboard-helpers.js';

describe('dashboard helpers (UNIT-05)', () => {
  it('Active status set is exactly the five BR-27 statuses', () => {
    expect([...ACTIVE_STATUSES].sort()).toEqual(
      ['In Progress', 'New', 'Open', 'Reopened', 'Waiting for Requester'].sort()
    );
    expect(ACTIVE_STATUSES).toHaveLength(5);
    expect(isActiveStatus('New')).toBe(true);
    expect(isActiveStatus('Open')).toBe(true);
    expect(isActiveStatus('In Progress')).toBe(true);
    expect(isActiveStatus('Waiting for Requester')).toBe(true);
    expect(isActiveStatus('Reopened')).toBe(true);
    expect(isActiveStatus('Resolved')).toBe(false);
    expect(isActiveStatus('Closed')).toBe(false);
    expect(isActiveStatus('Cancelled')).toBe(false);
  });

  it('recentWindowStart subtracts exactly 7 x 24 hours (rolling, no calendar boundary)', () => {
    const now = new Date('2026-10-28T03:00:00.000Z');
    const start = recentWindowStart(now);
    expect(start.toISOString()).toBe('2026-10-21T03:00:00.000Z');
    expect(RECENT_WINDOW_DAYS).toBe(7);
  });

  it('isWithinRecentWindow classifies the boundary instants inclusively', () => {
    const now = new Date('2026-10-28T03:00:00.000Z');
    const start = recentWindowStart(now);
    // Exactly at the boundary is inside (resolvedAt >= now - 7d).
    expect(isWithinRecentWindow(start, now)).toBe(true);
    // 1 ms before the boundary is outside.
    expect(isWithinRecentWindow(new Date(start.getTime() - 1), now)).toBe(false);
    // 1 ms after the boundary is inside.
    expect(isWithinRecentWindow(new Date(start.getTime() + 1), now)).toBe(true);
    // The request instant itself is inside.
    expect(isWithinRecentWindow(now, now)).toBe(true);
    // Just over 7 days old is outside.
    const justOverSevenDays = new Date(now.getTime() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000 - 2);
    expect(isWithinRecentWindow(justOverSevenDays, now)).toBe(false);
  });

  it('priorityBucket maps each known priority to itself and NULL/unknown to Unset (D-18)', () => {
    expect(priorityBucket('Low')).toBe('Low');
    expect(priorityBucket('Medium')).toBe('Medium');
    expect(priorityBucket('High')).toBe('High');
    expect(priorityBucket('Urgent')).toBe('Urgent');
    expect(priorityBucket(null)).toBe('Unset');
    expect(priorityBucket(undefined)).toBe('Unset');
    expect(priorityBucket('Critical')).toBe('Unset');
    expect(priorityBucket('')).toBe('Unset');
  });

  it('byStatus order is the api-spec §5.2 order and byPriority buckets are complete', () => {
    expect([...DASHBOARD_STATUS_ORDER]).toEqual([
      'New',
      'Open',
      'In Progress',
      'Waiting for Requester',
      'Resolved',
      'Closed',
      'Reopened',
      'Cancelled'
    ]);
    expect(DASHBOARD_STATUS_ORDER).toHaveLength(8);
  });

  it('truncateActionDescription keeps short text and truncates at 120 characters with an ellipsis', () => {
    const short = 'Checked the VPN logs and restarted the service.';
    expect(truncateActionDescription(short)).toBe(short);

    const exactlyAtLimit = 'x'.repeat(ACTION_DESCRIPTION_LIMIT);
    expect(truncateActionDescription(exactlyAtLimit)).toBe(exactlyAtLimit);

    const long = 'y'.repeat(ACTION_DESCRIPTION_LIMIT + 30);
    const truncated = truncateActionDescription(long);
    expect(truncated).toBe(`${'y'.repeat(ACTION_DESCRIPTION_LIMIT)}…`);
    expect(truncated.length).toBe(ACTION_DESCRIPTION_LIMIT + 1);
  });
});

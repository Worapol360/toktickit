/**
 * UNIT-01 (AC-12): isValidStatusTransition over all 64 (from, to) pairs —
 * exactly the 15 pairs of specification.md BR-13 are true, 49 false
 * (including every same-status pair).
 * UNIT-02 (AC-12, AC-21): getAllowedTransitions(from) for each status —
 * matches the matrix in specification.md §5.2; Cancelled -> [].
 *
 * The permitted pairs are spelled out here as an independent literal copy of
 * the documented matrix, so the test does not merely echo STATUS_TRANSITIONS.
 */
import { describe, expect, it } from 'vitest';
import { ALL_STATUSES, isValidStatusTransition } from '../../src/server.js';
import { getAllowedTransitions } from '../../src/lab-04/ticket-workflow-rules.js';

const PERMITTED_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['New', 'Open'],
  ['New', 'Cancelled'],
  ['Open', 'In Progress'],
  ['Open', 'Cancelled'],
  ['In Progress', 'Waiting for Requester'],
  ['In Progress', 'Resolved'],
  ['In Progress', 'Cancelled'],
  ['Waiting for Requester', 'In Progress'],
  ['Waiting for Requester', 'Resolved'],
  ['Waiting for Requester', 'Cancelled'],
  ['Resolved', 'Closed'],
  ['Resolved', 'Reopened'],
  ['Closed', 'Reopened'],
  ['Reopened', 'In Progress'],
  ['Reopened', 'Cancelled']
];

const EXPECTED_ALLOWED: Record<string, string[]> = {
  'New': ['Open', 'Cancelled'],
  'Open': ['In Progress', 'Cancelled'],
  'In Progress': ['Waiting for Requester', 'Resolved', 'Cancelled'],
  'Waiting for Requester': ['In Progress', 'Resolved', 'Cancelled'],
  'Resolved': ['Closed', 'Reopened'],
  'Closed': ['Reopened'],
  'Reopened': ['In Progress', 'Cancelled'],
  'Cancelled': []
};

describe('UNIT-01: isValidStatusTransition over all 64 (from, to) pairs', () => {
  it('accepts exactly the 15 permitted pairs of BR-13 and rejects the other 49', () => {
    expect(ALL_STATUSES).toHaveLength(8);

    const results: Array<[string, string, boolean]> = [];
    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        results.push([from, to, isValidStatusTransition(from, to)]);
      }
    }
    expect(results).toHaveLength(64);

    const accepted = results.filter(([, , allowed]) => allowed);
    expect(accepted).toHaveLength(15);
    expect(results.filter(([, , allowed]) => !allowed)).toHaveLength(49);

    for (const [from, to, allowed] of results) {
      const expected = PERMITTED_PAIRS.some(([f, t]) => f === from && t === to);
      expect([from, to, allowed]).toEqual([from, to, expected]);
    }
  });

  it('rejects every same-status transition and unknown statuses', () => {
    for (const status of ALL_STATUSES) {
      expect(isValidStatusTransition(status, status)).toBe(false);
    }
    expect(isValidStatusTransition('New', 'Not A Status')).toBe(false);
    expect(isValidStatusTransition('Not A Status', 'Open')).toBe(false);
  });
});

describe('UNIT-02: getAllowedTransitions(from)', () => {
  it('returns exactly the permitted "to" values for each of the 8 statuses', () => {
    for (const status of ALL_STATUSES) {
      expect(getAllowedTransitions(status)).toEqual(EXPECTED_ALLOWED[status]);
    }
  });

  it('returns [] for the terminal Cancelled status and for unknown statuses', () => {
    expect(getAllowedTransitions('Cancelled')).toEqual([]);
    expect(getAllowedTransitions('Cancelled')).toHaveLength(0);
    expect(getAllowedTransitions('Not A Status')).toEqual([]);
  });

  it('never returns the current status itself (same-status transitions are invalid)', () => {
    for (const status of ALL_STATUSES) {
      expect(getAllowedTransitions(status)).not.toContain(status);
    }
  });

  it('returns a fresh array so callers cannot mutate the shared matrix', () => {
    const first = getAllowedTransitions('New');
    first.push('Injected');
    expect(getAllowedTransitions('New')).toEqual(['Open', 'Cancelled']);
  });
});

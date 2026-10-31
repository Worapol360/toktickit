/**
 * UNIT-03 (AC-13): evaluateResolutionGate — specification.md BR-15 / D-06.
 *
 *   no actions            -> { pass: false, reason: 'NO_ACTIONS_TAKEN' }
 *   open follow-up(s)     -> { pass: false, reason: 'OPEN_FOLLOW_UPS', openFollowUps: n }
 *   >=1 action, none open -> { pass: true }
 */
import { describe, expect, it } from 'vitest';
import { evaluateResolutionGate } from '../../src/lab-04/ticket-workflow-rules.js';

describe('UNIT-03: evaluateResolutionGate', () => {
  it('blocks a ticket with no actions taken at all', () => {
    expect(evaluateResolutionGate({ total: 0, openFollowUps: 0 })).toEqual({
      pass: false,
      reason: 'NO_ACTIONS_TAKEN',
      openFollowUps: 0
    });
  });

  it('blocks when there are actions but one open follow-up', () => {
    expect(evaluateResolutionGate({ total: 1, openFollowUps: 1 })).toEqual({
      pass: false,
      reason: 'OPEN_FOLLOW_UPS',
      openFollowUps: 1
    });
  });

  it('reports the exact number of open follow-ups', () => {
    expect(evaluateResolutionGate({ total: 5, openFollowUps: 3 })).toEqual({
      pass: false,
      reason: 'OPEN_FOLLOW_UPS',
      openFollowUps: 3
    });
  });

  it('passes when at least one action exists and no follow-up is open', () => {
    expect(evaluateResolutionGate({ total: 1, openFollowUps: 0 })).toEqual({ pass: true });
    expect(evaluateResolutionGate({ total: 3, openFollowUps: 0 }).pass).toBe(true);
  });

  it('treats completed follow-ups as closed (pass) and never blocks on zero actions alone twice', () => {
    const result = evaluateResolutionGate({ total: 4, openFollowUps: 0 });
    expect(result.pass).toBe(true);
    expect(result).not.toHaveProperty('reason');
  });
});

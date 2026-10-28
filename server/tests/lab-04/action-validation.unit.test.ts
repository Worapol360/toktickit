/**
 * UNIT-04: Action input validator (create and patch merge)
 * AC-04, AC-09 — specification.md §5.1 (BR-03, BR-04, BR-05, BR-06), api-spec.md §3.2/§3.3
 */
import { describe, expect, it } from 'vitest';
import {
  validateCreateAction,
  validatePatchAction,
  type ExistingActionValues
} from '../../src/lab-04/action-validator.js';

const now = new Date('2026-10-28T12:00:00.000Z');
const ticketCreatedAt = new Date('2026-10-27T08:00:00.000Z');
const context = { ticketCreatedAt, now };

function createOk(raw: unknown) {
  const result = validateCreateAction(raw, context);
  if (!result.ok) throw new Error(`expected success, got fields: ${JSON.stringify(result.fields)}`);
  return result.value;
}

function createFields(raw: unknown) {
  const result = validateCreateAction(raw, context);
  if (result.ok) throw new Error('expected validation failure, got success');
  return result.fields;
}

function baseCreate(overrides: Record<string, unknown> = {}) {
  return {
    description: 'Remapped the Finance share on the laptop.',
    result: 'Drive reachable after remap.',
    ...overrides
  };
}

const baseExisting: ExistingActionValues = {
  actionAt: new Date('2026-10-27T09:00:00.000Z'),
  description: 'Checked the printer queue and restarted spooler.',
  result: 'Printer accepting jobs again.',
  followUpRequired: true,
  followUpNote: 'Confirm with the user after restart tomorrow.',
  followUpCompletedAt: null,
  attachmentNotes: 'See screenshot printer-error.png.'
};

function patchOk(raw: unknown, existing: ExistingActionValues = baseExisting) {
  const result = validatePatchAction(raw, existing, context);
  if (!result.ok) throw new Error(`expected success, got fields: ${JSON.stringify(result.fields)}`);
  return result.value;
}

function patchFields(raw: unknown, existing: ExistingActionValues = baseExisting) {
  const result = validatePatchAction(raw, existing, context);
  if (result.ok) throw new Error('expected validation failure, got success');
  return result.fields;
}

describe('UNIT-04 validateCreateAction', () => {
  it('trims description, result, follow-up note, and attachment notes', () => {
    const value = createOk(baseCreate({
      description: '  Checked mailbox permissions for the new hire.  ',
      result: '\n Access granted after sync.\t',
      followUpRequired: true,
      followUpNote: '  Verify mailbox after 24 hours.  ',
      attachmentNotes: '  mailbox.png  '
    }));
    expect(value.description).toBe('Checked mailbox permissions for the new hire.');
    expect(value.result).toBe('Access granted after sync.');
    expect(value.followUpNote).toBe('Verify mailbox after 24 hours.');
    expect(value.attachmentNotes).toBe('mailbox.png');
  });

  it('enforces description length bounds (5-2000) with the documented message', () => {
    expect(createFields(baseCreate({ description: 'Abc' })).description)
      .toBe('Enter a description of 5–2000 characters.');
    expect(createFields(baseCreate({ description: 'a'.repeat(2001) })).description)
      .toBe('Enter a description of 5–2000 characters.');
    expect(createFields(baseCreate({ description: '   ' })).description)
      .toBe('Enter a description of 5–2000 characters.');
    expect(createFields({ result: 'ok result' }).description)
      .toBe('Enter a description of 5–2000 characters.');
    expect(createOk(baseCreate({ description: 'a'.repeat(5) })).description).toHaveLength(5);
    expect(createOk(baseCreate({ description: 'a'.repeat(2000) })).description).toHaveLength(2000);
  });

  it('enforces result length bounds (2-1000) with the documented message', () => {
    expect(createFields(baseCreate({ result: 'x' })).result)
      .toBe('Enter a result of 2–1000 characters.');
    expect(createFields(baseCreate({ result: 'b'.repeat(1001) })).result)
      .toBe('Enter a result of 2–1000 characters.');
    expect(createFields({ description: 'valid description' }).result)
      .toBe('Enter a result of 2–1000 characters.');
    expect(createOk(baseCreate({ result: 'ok' })).result).toBe('ok');
  });

  it('requires a follow-up note only when followUpRequired is true', () => {
    const missing = createFields(baseCreate({ followUpRequired: true }));
    expect(missing.followUpNote)
      .toBe('Enter a follow-up note of 5–500 characters when follow-up is required.');

    const tooShort = createFields(baseCreate({ followUpRequired: true, followUpNote: 'abcd' }));
    expect(tooShort.followUpNote)
      .toBe('Enter a follow-up note of 5–500 characters when follow-up is required.');

    const tooLong = createFields(baseCreate({ followUpRequired: true, followUpNote: 'n'.repeat(501) }));
    expect(tooLong.followUpNote)
      .toBe('Enter a follow-up note of 5–500 characters when follow-up is required.');

    const valid = createOk(baseCreate({ followUpRequired: true, followUpNote: 'Confirm after restart.' }));
    expect(valid.followUpRequired).toBe(true);
    expect(valid.followUpNote).toBe('Confirm after restart.');
  });

  it('discards the follow-up note and stores null completion when followUpRequired is false', () => {
    const value = createOk(baseCreate({
      followUpRequired: false,
      followUpNote: 'This note must be discarded.',
      followUpCompletedAt: '2026-10-27T10:00:00.000Z'
    }));
    expect(value.followUpRequired).toBe(false);
    expect(value.followUpNote).toBeNull();
    expect(value.followUpCompletedAt).toBeNull();
  });

  it('defaults followUpRequired to false and keeps optional attachmentNotes within 500 chars', () => {
    expect(createOk(baseCreate()).followUpRequired).toBe(false);
    expect(createOk(baseCreate()).followUpNote).toBeNull();

    expect(createFields(baseCreate({ attachmentNotes: 'x'.repeat(501) })).attachmentNotes)
      .toBe('Attachment notes can be up to 500 characters.');
    expect(createOk(baseCreate({ attachmentNotes: 'x'.repeat(500) })).attachmentNotes).toHaveLength(500);
    expect(createOk(baseCreate({ attachmentNotes: '   ' })).attachmentNotes).toBeNull();
    expect(createOk(baseCreate()).attachmentNotes).toBeNull();
  });

  it('rejects non-boolean followUpRequired and non-string clientRequestId', () => {
    expect(createFields(baseCreate({ followUpRequired: 'yes' })).followUpRequired)
      .toBe('followUpRequired must be a boolean.');
    expect(createFields(baseCreate({ clientRequestId: 42 })).clientRequestId)
      .toBe('clientRequestId must be a string.');
  });

  it('defaults actionAt to server time and accepts a user-supplied instant within bounds', () => {
    const defaulted = createOk(baseCreate());
    expect(defaulted.actionAt.getTime()).toBe(now.getTime());

    const supplied = createOk(baseCreate({ actionAt: '2026-10-27T09:30:00.000Z' }));
    expect(supplied.actionAt.toISOString()).toBe('2026-10-27T09:30:00.000Z');
  });

  it('accepts boundary instants: actionAt equal to ticket.createdAt and equal to now + 5 minutes', () => {
    expect(createOk(baseCreate({ actionAt: ticketCreatedAt.toISOString() })).actionAt.getTime())
      .toBe(ticketCreatedAt.getTime());
    expect(createOk(baseCreate({ actionAt: new Date(now.getTime() + 5 * 60 * 1000).toISOString() })).actionAt.getTime())
      .toBe(now.getTime() + 5 * 60 * 1000);
  });

  it('rejects actionAt earlier than the ticket createdAt and later than now + 5 minutes', () => {
    const before = new Date(ticketCreatedAt.getTime() - 1);
    expect(createFields(baseCreate({ actionAt: before.toISOString() })).actionAt)
      .toBe('Action time cannot be before the Ticket was created.');

    const future = new Date(now.getTime() + 5 * 60 * 1000 + 1);
    expect(createFields(baseCreate({ actionAt: future.toISOString() })).actionAt)
      .toBe('Action time cannot be in the future.');
  });

  it('rejects unparseable actionAt values', () => {
    expect(createFields(baseCreate({ actionAt: 'not-a-date' })).actionAt)
      .toBe('Enter a valid action date and time.');
    expect(createFields(baseCreate({ actionAt: '2026-13-45T99:00:00.000Z' })).actionAt)
      .toBe('Enter a valid action date and time.');
  });

  it('ignores client-supplied identity, version, and completion fields on create (AC-09)', () => {
    const value = createOk(baseCreate({
      performedById: 4242,
      performedBy: { id: 4242, name: 'Not The Session User' },
      updatedById: 4242,
      updatedBy: { id: 4242, name: 'Not The Session User' },
      version: 99,
      followUpCompletedAt: '2026-10-27T10:00:00.000Z',
      followUpCompleted: true,
      id: 777,
      ticketId: 555
    }));
    expect(Object.keys(value).sort()).toEqual([
      'actionAt',
      'attachmentNotes',
      'clientRequestId',
      'description',
      'followUpCompletedAt',
      'followUpNote',
      'followUpRequired',
      'result'
    ]);
    expect(value.followUpCompletedAt).toBeNull();
    expect(value.clientRequestId).toBeNull();
  });

  it('passes a supplied clientRequestId through and defaults it to null', () => {
    expect(createOk(baseCreate({ clientRequestId: '6f1c2a8e-6a0d-4a63-9d5b-2f6f3b7c0a11' })).clientRequestId)
      .toBe('6f1c2a8e-6a0d-4a63-9d5b-2f6f3b7c0a11');
    expect(createOk(baseCreate()).clientRequestId).toBeNull();
  });

  it('reports multiple field errors at once', () => {
    const fields = createFields({ description: 'ab', result: '', followUpRequired: true, actionAt: 'nope' });
    expect(Object.keys(fields).sort()).toEqual(['actionAt', 'description', 'followUpNote', 'result']);
  });
});

describe('UNIT-04 validatePatchAction', () => {
  it('requires expectedVersion as a positive integer', () => {
    const withoutVersion = { result: 'Drive reachable; user confirmed.' };
    expect(patchFields(withoutVersion).expectedVersion).toBe('expectedVersion is required.');
    expect(patchFields({ expectedVersion: null, result: 'ok result' }).expectedVersion)
      .toBe('expectedVersion is required.');
    expect(patchFields({ expectedVersion: '1', result: 'ok result' }).expectedVersion)
      .toBe('expectedVersion must be a positive integer.');
    expect(patchFields({ expectedVersion: 0, result: 'ok result' }).expectedVersion)
      .toBe('expectedVersion must be a positive integer.');
    expect(patchFields({ expectedVersion: 1.5, result: 'ok result' }).expectedVersion)
      .toBe('expectedVersion must be a positive integer.');

    const ok = patchOk({ expectedVersion: 3, result: 'Drive reachable; user confirmed access.' });
    expect(ok.expectedVersion).toBe(3);
  });

  it('changes only the supplied fields and keeps the rest from the existing record', () => {
    const value = patchOk({ expectedVersion: 1, result: 'Drive reachable; user confirmed access.' });
    expect(value.result).toBe('Drive reachable; user confirmed access.');
    expect(value.description).toBe(baseExisting.description);
    expect(value.actionAt.getTime()).toBe(baseExisting.actionAt.getTime());
    expect(value.followUpRequired).toBe(true);
    expect(value.followUpNote).toBe(baseExisting.followUpNote);
    expect(value.followUpCompletedAt).toBeNull();
    expect(value.attachmentNotes).toBe(baseExisting.attachmentNotes);
  });

  it('trims supplied text fields and enforces their length bounds on the merged result', () => {
    const value = patchOk({ expectedVersion: 1, description: '  Updated description text.  ' });
    expect(value.description).toBe('Updated description text.');

    expect(patchFields({ expectedVersion: 1, description: 'no' }).description)
      .toBe('Enter a description of 5–2000 characters.');
    expect(patchFields({ expectedVersion: 1, result: 'x' }).result)
      .toBe('Enter a result of 2–1000 characters.');
    expect(patchFields({ expectedVersion: 1, attachmentNotes: 'x'.repeat(501) }).attachmentNotes)
      .toBe('Attachment notes can be up to 500 characters.');
  });

  it('sets and clears followUpCompletedAt only while followUpRequired is true (AC-11)', () => {
    const completed = patchOk({ expectedVersion: 1, followUpCompleted: true });
    expect(completed.followUpCompletedAt).not.toBeNull();
    expect(completed.followUpCompletedAt!.getTime()).toBe(now.getTime());

    const withCompleted: ExistingActionValues = {
      ...baseExisting,
      followUpCompletedAt: new Date('2026-10-27T11:00:00.000Z')
    };
    const cleared = patchOk({ expectedVersion: 2, followUpCompleted: false }, withCompleted);
    expect(cleared.followUpCompletedAt).toBeNull();

    const noFollowUp: ExistingActionValues = { ...baseExisting, followUpRequired: false, followUpNote: null };
    const fields = patchFields({ expectedVersion: 1, followUpCompleted: true }, noFollowUp);
    expect(fields.followUpCompleted)
      .toBe('Follow-up completion requires follow-up to be required.');
  });

  it('clears note and completion when the merged followUpRequired becomes false', () => {
    const value = patchOk({ expectedVersion: 1, followUpRequired: false });
    expect(value.followUpRequired).toBe(false);
    expect(value.followUpNote).toBeNull();
    expect(value.followUpCompletedAt).toBeNull();
  });

  it('requires a valid note when the merged followUpRequired becomes true', () => {
    const noNote: ExistingActionValues = { ...baseExisting, followUpRequired: false, followUpNote: null };

    expect(patchFields({ expectedVersion: 1, followUpRequired: true }, noNote).followUpNote)
      .toBe('Enter a follow-up note of 5–500 characters when follow-up is required.');

    const withNote = patchOk({ expectedVersion: 1, followUpRequired: true, followUpNote: 'Verify access tomorrow.' }, noNote);
    expect(withNote.followUpRequired).toBe(true);
    expect(withNote.followUpNote).toBe('Verify access tomorrow.');
  });

  it('rejects an actionAt outside the ticket/server bounds on patch', () => {
    expect(patchFields({ expectedVersion: 1, actionAt: '2020-01-01T00:00:00.000Z' }).actionAt)
      .toBe('Action time cannot be before the Ticket was created.');
    expect(patchFields({ expectedVersion: 1, actionAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString() }).actionAt)
      .toBe('Action time cannot be in the future.');
    expect(patchOk({ expectedVersion: 1, actionAt: '2026-10-27T10:15:00.000Z' }).actionAt.toISOString())
      .toBe('2026-10-27T10:15:00.000Z');
  });

  it('ignores identity, version, clientRequestId, and raw completion timestamps on patch (AC-09)', () => {
    const value = patchOk({
      expectedVersion: 1,
      performedById: 4242,
      performedBy: { id: 4242, name: 'Hacker' },
      updatedById: 4242,
      version: 99,
      followUpCompletedAt: '2026-10-27T12:00:00.000Z',
      clientRequestId: 'client-chosen-key'
    });
    expect(value).not.toHaveProperty('performedById');
    expect(value).not.toHaveProperty('performedBy');
    expect(value).not.toHaveProperty('version');
    expect(value).not.toHaveProperty('clientRequestId');
    expect(value.followUpCompletedAt).toBeNull();
  });
});

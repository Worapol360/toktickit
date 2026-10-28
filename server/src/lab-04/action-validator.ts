/**
 * Action Taken input validation (Lab 4, Issue 2).
 * specification.md §5.1 BR-03 … BR-06; api-spec.md §3.2 / §3.3.
 */

export type ExistingActionValues = {
  actionAt: Date;
  description: string;
  result: string;
  followUpRequired: boolean;
  followUpNote: string | null;
  followUpCompletedAt: Date | null;
  attachmentNotes: string | null;
};

export type ValidatedActionValues = {
  actionAt: Date;
  description: string;
  result: string;
  followUpRequired: boolean;
  followUpNote: string | null;
  followUpCompletedAt: Date | null;
  attachmentNotes: string | null;
  clientRequestId: string | null;
};

export type ValidatedPatchValues = Omit<ValidatedActionValues, 'clientRequestId'> & {
  expectedVersion: number;
};

export type ValidationContext = {
  ticketCreatedAt: Date;
  now?: Date;
};

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; fields: Record<string, string> };

const DESCRIPTION_MESSAGE = 'Enter a description of 5–2000 characters.';
const RESULT_MESSAGE = 'Enter a result of 2–1000 characters.';
const FOLLOW_UP_NOTE_MESSAGE = 'Enter a follow-up note of 5–500 characters when follow-up is required.';
const ATTACHMENT_NOTES_MESSAGE = 'Attachment notes can be up to 500 characters.';
const BEFORE_TICKET_CREATED_MESSAGE = 'Action time cannot be before the Ticket was created.';
const FUTURE_MESSAGE = 'Action time cannot be in the future.';
const INVALID_DATE_MESSAGE = 'Enter a valid action date and time.';
const EXPECTED_VERSION_REQUIRED_MESSAGE = 'expectedVersion is required.';
const EXPECTED_VERSION_INTEGER_MESSAGE = 'expectedVersion must be a positive integer.';
const FOLLOW_UP_REQUIRED_MESSAGE = 'followUpRequired must be a boolean.';
const CLIENT_REQUEST_ID_MESSAGE = 'clientRequestId must be a string.';
const FOLLOW_UP_COMPLETION_MESSAGE = 'Follow-up completion requires follow-up to be required.';
const FOLLOW_UP_COMPLETED_MESSAGE = 'followUpCompleted must be a boolean.';

const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseInstant(value: unknown): Date | null {
  if (typeof value !== 'string' && !(value instanceof Date)) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function checkActionBounds(
  actionAt: Date,
  ticketCreatedAt: Date,
  now: Date,
  fields: Record<string, string>
) {
  if (actionAt.getTime() < ticketCreatedAt.getTime()) {
    fields.actionAt = BEFORE_TICKET_CREATED_MESSAGE;
  } else if (actionAt.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) {
    fields.actionAt = FUTURE_MESSAGE;
  }
}

function validateDescription(
  source: Record<string, unknown>,
  fields: Record<string, string>
): string | null {
  if (typeof source.description !== 'string') {
    fields.description = DESCRIPTION_MESSAGE;
    return null;
  }
  const description = source.description.trim();
  if (description.length < 5 || description.length > 2000) {
    fields.description = DESCRIPTION_MESSAGE;
    return null;
  }
  return description;
}

function validateResult(
  source: Record<string, unknown>,
  fields: Record<string, string>
): string | null {
  if (typeof source.result !== 'string') {
    fields.result = RESULT_MESSAGE;
    return null;
  }
  const result = source.result.trim();
  if (result.length < 2 || result.length > 1000) {
    fields.result = RESULT_MESSAGE;
    return null;
  }
  return result;
}

function validateAttachmentNotes(
  source: Record<string, unknown>,
  fields: Record<string, string>
): string | null {
  if (source.attachmentNotes === undefined || source.attachmentNotes === null) return null;
  if (typeof source.attachmentNotes !== 'string') {
    fields.attachmentNotes = ATTACHMENT_NOTES_MESSAGE;
    return null;
  }
  const trimmed = source.attachmentNotes.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > 500) {
    fields.attachmentNotes = ATTACHMENT_NOTES_MESSAGE;
    return null;
  }
  return trimmed;
}

function validateFollowUpNoteValue(
  note: unknown,
  fields: Record<string, string>,
  key = 'followUpNote'
): string | null {
  const trimmed = typeof note === 'string' ? note.trim() : '';
  if (trimmed.length < 5 || trimmed.length > 500) {
    fields[key] = FOLLOW_UP_NOTE_MESSAGE;
    return null;
  }
  return trimmed;
}

export function validateCreateAction(
  raw: unknown,
  context: ValidationContext
): ValidationResult<ValidatedActionValues> {
  const source = isPlainObject(raw) ? raw : {};
  const fields: Record<string, string> = {};
  const now = context.now ?? new Date();

  const description = validateDescription(source, fields);
  const result = validateResult(source, fields);
  const attachmentNotes = validateAttachmentNotes(source, fields);

  let followUpRequired = false;
  if (source.followUpRequired !== undefined) {
    if (typeof source.followUpRequired !== 'boolean') {
      fields.followUpRequired = FOLLOW_UP_REQUIRED_MESSAGE;
    } else {
      followUpRequired = source.followUpRequired;
    }
  }

  let followUpNote: string | null = null;
  if (!fields.followUpRequired && followUpRequired) {
    followUpNote = validateFollowUpNoteValue(source.followUpNote, fields);
  }

  let clientRequestId: string | null = null;
  if (source.clientRequestId !== undefined && source.clientRequestId !== null) {
    if (typeof source.clientRequestId !== 'string') {
      fields.clientRequestId = CLIENT_REQUEST_ID_MESSAGE;
    } else {
      clientRequestId = source.clientRequestId.trim() === '' ? null : source.clientRequestId.trim();
    }
  }

  let actionAt = now;
  if (source.actionAt !== undefined && source.actionAt !== null) {
    const parsed = parseInstant(source.actionAt);
    if (!parsed) {
      fields.actionAt = INVALID_DATE_MESSAGE;
    } else {
      actionAt = parsed;
    }
  }
  if (!fields.actionAt) {
    checkActionBounds(actionAt, context.ticketCreatedAt, now, fields);
  }

  if (Object.keys(fields).length > 0) {
    return { ok: false, fields };
  }

  return {
    ok: true,
    value: {
      actionAt,
      description: description!,
      result: result!,
      followUpRequired,
      followUpNote,
      followUpCompletedAt: null,
      attachmentNotes,
      clientRequestId
    }
  };
}

export function validatePatchAction(
  raw: unknown,
  existing: ExistingActionValues,
  context: ValidationContext
): ValidationResult<ValidatedPatchValues> {
  const source = isPlainObject(raw) ? raw : {};
  const fields: Record<string, string> = {};
  const now = context.now ?? new Date();

  let expectedVersion: number | null = null;
  if (source.expectedVersion === undefined || source.expectedVersion === null) {
    fields.expectedVersion = EXPECTED_VERSION_REQUIRED_MESSAGE;
  } else if (
    typeof source.expectedVersion !== 'number' ||
    !Number.isInteger(source.expectedVersion) ||
    source.expectedVersion < 1
  ) {
    fields.expectedVersion = EXPECTED_VERSION_INTEGER_MESSAGE;
  } else {
    expectedVersion = source.expectedVersion;
  }

  let description = existing.description;
  if (source.description !== undefined) {
    const validated = validateDescription(source, fields);
    if (validated !== null) description = validated;
  }

  let result = existing.result;
  if (source.result !== undefined) {
    const validated = validateResult(source, fields);
    if (validated !== null) result = validated;
  }

  let attachmentNotes = existing.attachmentNotes;
  if (source.attachmentNotes !== undefined) {
    attachmentNotes = validateAttachmentNotes(source, fields);
  }

  let followUpRequired = existing.followUpRequired;
  if (source.followUpRequired !== undefined) {
    if (typeof source.followUpRequired !== 'boolean') {
      fields.followUpRequired = FOLLOW_UP_REQUIRED_MESSAGE;
    } else {
      followUpRequired = source.followUpRequired;
    }
  }

  let followUpNote = existing.followUpNote;
  let followUpCompletedAt = existing.followUpCompletedAt;
  if (!fields.followUpRequired) {
    if (!followUpRequired) {
      followUpNote = null;
      followUpCompletedAt = null;
      if (source.followUpCompleted === true) {
        fields.followUpCompleted = FOLLOW_UP_COMPLETION_MESSAGE;
      }
    } else {
      if (source.followUpNote !== undefined) {
        followUpNote = validateFollowUpNoteValue(source.followUpNote, fields);
      } else if (existing.followUpNote === null) {
        fields.followUpNote = FOLLOW_UP_NOTE_MESSAGE;
      }

      if (source.followUpCompleted !== undefined) {
        if (typeof source.followUpCompleted !== 'boolean') {
          fields.followUpCompleted = FOLLOW_UP_COMPLETED_MESSAGE;
        } else if (source.followUpCompleted) {
          followUpCompletedAt = now;
        } else {
          followUpCompletedAt = null;
        }
      }
    }
  }

  let actionAt = existing.actionAt;
  if (source.actionAt !== undefined && source.actionAt !== null) {
    const parsed = parseInstant(source.actionAt);
    if (!parsed) {
      fields.actionAt = INVALID_DATE_MESSAGE;
    } else {
      actionAt = parsed;
    }
  }
  if (!fields.actionAt) {
    checkActionBounds(actionAt, context.ticketCreatedAt, now, fields);
  }

  if (Object.keys(fields).length > 0 || expectedVersion === null) {
    return { ok: false, fields };
  }

  return {
    ok: true,
    value: {
      expectedVersion,
      actionAt,
      description,
      result,
      followUpRequired,
      followUpNote,
      followUpCompletedAt,
      attachmentNotes
    }
  };
}

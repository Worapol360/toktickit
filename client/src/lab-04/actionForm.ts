export const TIME_ZONE = 'Asia/Bangkok';

export const FIELD_MESSAGES = {
  description: 'Enter a description of 5–2000 characters.',
  result: 'Enter a result of 2–1000 characters.',
  followUpNote: 'Enter a follow-up note of 5–500 characters when follow-up is required.',
  attachmentNotes: 'Attachment notes can be up to 500 characters.',
  actionAtBeforeTicket: 'Action time cannot be before the Ticket was created.',
  actionAtFuture: 'Action time cannot be in the future.'
} as const;

export type ActionFormValues = {
  actionAt: string;
  description: string;
  result: string;
  followUpRequired: boolean;
  followUpNote: string;
  attachmentNotes: string;
};

export type ActionFormErrors = Partial<Record<keyof ActionFormValues, string>>;

export const ACTION_FORM_FIELD_ORDER: Array<Exclude<keyof ActionFormValues, 'followUpRequired'>> = [
  'actionAt',
  'description',
  'result',
  'followUpNote',
  'attachmentNotes'
];

// Mirrors BR-04: the server allows actionAt up to server time + 5 minutes.
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

export function validateActionForm(
  values: ActionFormValues,
  options: { ticketCreatedAtIso: string; nowIso: string }
): ActionFormErrors {
  const errors: ActionFormErrors = {};

  const description = values.description.trim();
  if (description.length < 5 || description.length > 2000) {
    errors.description = FIELD_MESSAGES.description;
  }

  const result = values.result.trim();
  if (result.length < 2 || result.length > 1000) {
    errors.result = FIELD_MESSAGES.result;
  }

  if (values.followUpRequired) {
    const note = values.followUpNote.trim();
    if (note.length < 5 || note.length > 500) {
      errors.followUpNote = FIELD_MESSAGES.followUpNote;
    }
  }

  const attachmentNotes = values.attachmentNotes.trim();
  if (attachmentNotes.length > 500) {
    errors.attachmentNotes = FIELD_MESSAGES.attachmentNotes;
  }

  const actionAtLocal = values.actionAt.trim();
  if (actionAtLocal) {
    const actionAtIso = bangkokLocalToIsoUtc(actionAtLocal);
    const actionAtMs = Date.parse(actionAtIso);
    if (!Number.isNaN(actionAtMs)) {
      const ticketCreatedMs = Date.parse(options.ticketCreatedAtIso);
      if (!Number.isNaN(ticketCreatedMs) && actionAtMs < ticketCreatedMs) {
        errors.actionAt = FIELD_MESSAGES.actionAtBeforeTicket;
      } else {
        const nowMs = Date.parse(options.nowIso);
        if (!Number.isNaN(nowMs) && actionAtMs > nowMs + FUTURE_TOLERANCE_MS) {
          errors.actionAt = FIELD_MESSAGES.actionAtFuture;
        }
      }
    }
  }

  return errors;
}

const bangkokPartsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});

const bangkokDisplayFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  dateStyle: 'medium',
  timeStyle: 'short'
});

/** ISO UTC string → "YYYY-MM-DDTHH:mm" as shown/entered in Asia/Bangkok (GMT+7). */
export function formatBangkokLocalInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const parts = bangkokPartsFormatter.formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  const hour = pick('hour') === '24' ? '00' : pick('hour');
  return `${pick('year')}-${pick('month')}-${pick('day')}T${hour}:${pick('minute')}`;
}

/** datetime-local value (local wall time in GMT+7) → ISO 8601 UTC string. */
export function bangkokLocalToIsoUtc(local: string): string {
  if (!local) return '';
  const parsed = new Date(`${local}:00+07:00`);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString();
}

/** ISO UTC string → human-readable time in Asia/Bangkok. */
export function formatBangkokDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return bangkokDisplayFormatter.format(date);
}

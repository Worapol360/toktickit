/**
 * Lab 4 Issue 3 — Actions Taken UI
 * UNIT-06: client form validators mirror BR-04/05/06 (messages per ui-spec §4.4)
 * UI-01: list renders all fields, stable order, "Edited" marker, empty state
 * UI-02: create form — follow-up note only when checked; messages under fields; summary + focus
 * UI-03: double-click Save — one POST; same clientRequestId on retry
 * UI-04: network/500/400 failure — message shown, typed data preserved
 * UI-05: 409 VERSION_CONFLICT — banner with Reload latest / Keep editing; no silent overwrite
 * UI-06: edit mode and Mark follow-up done — expectedVersion from state; list refreshes
 * UI-07: requester view — read-only list; Performed by read-only everywhere
 * UI-08: Resolved/Closed/Cancelled ticket — controls hidden with explanation; TICKET_ACTIONS_LOCKED handled
 * UI-09: loading, empty, forbidden, not-found states
 *
 * jsdom ignores media queries, so the table AND the cards are both in the DOM:
 * queries are scoped with within(table) or use getAllByRole(...)[0] where duplication is legitimate.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { ActionsTakenPanel } from '../../lab-04/ActionsTakenPanel';
import type { ActionTakenDto } from '../../lab-04/actionsTakenApi';
import {
  validateActionForm,
  bangkokLocalToIsoUtc,
  formatBangkokDateTime
} from '../../lab-04/actionForm';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

const TICKET_CREATED_AT = '2026-10-01T09:00:00.000Z';

const actionOne: ActionTakenDto = {
  id: 21,
  ticketId: 101,
  actionAt: '2026-10-21T08:45:00.000Z',
  description: 'Remapped the Finance share on the user laptop.',
  result: 'Drive reachable after remap; waiting for user confirmation.',
  performedBy: { id: 8, name: 'Noah Lim' },
  followUpRequired: true,
  followUpNote: 'Confirm with the user after restart tomorrow.',
  followUpCompletedAt: null,
  attachmentNotes: "See screenshot 'share-error.png' on the Ticket.",
  version: 1,
  updatedBy: { id: 8, name: 'Noah Lim' },
  createdAt: '2026-10-21T08:50:00.000Z',
  updatedAt: '2026-10-21T08:50:00.000Z'
};

// Earlier createdAt than actionOne; the UI must keep the order returned by the API (UI-01).
const actionTwo: ActionTakenDto = {
  id: 22,
  ticketId: 101,
  actionAt: '2026-10-20T03:00:00.000Z',
  description: 'Checked the VPN concentrator logs.',
  result: 'No errors found in logs.',
  performedBy: { id: 8, name: 'Noah Lim' },
  followUpRequired: false,
  followUpNote: null,
  followUpCompletedAt: null,
  attachmentNotes: null,
  version: 2,
  updatedBy: { id: 9, name: 'Priya Nair' },
  createdAt: '2026-10-20T03:05:00.000Z',
  updatedAt: '2026-10-21T09:00:00.000Z'
};

const actionThree: ActionTakenDto = {
  id: 23,
  ticketId: 101,
  actionAt: '2026-10-22T02:00:00.000Z',
  description: 'Restarted the access point in the meeting room.',
  result: 'Wireless stable for the rest of the day.',
  performedBy: { id: 9, name: 'Priya Nair' },
  followUpRequired: true,
  followUpNote: 'User confirmed access after restart.',
  followUpCompletedAt: '2026-10-22T08:00:00.000Z',
  attachmentNotes: null,
  version: 1,
  updatedBy: { id: 9, name: 'Priya Nair' },
  createdAt: '2026-10-22T02:10:00.000Z',
  updatedAt: '2026-10-22T08:00:00.000Z'
};

const threeActions: ActionTakenDto[] = [actionOne, actionTwo, actionThree];

function listBody(actions = threeActions) {
  const openFollowUps = actions.filter((a) => a.followUpRequired && !a.followUpCompletedAt).length;
  return { actionsTaken: actions, summary: { total: actions.length, openFollowUps } };
}

function renderStaff(overrides: Record<string, unknown> = {}) {
  return render(
    <ActionsTakenPanel
      ticketId={101}
      ticketStatus="In Progress"
      ticketCreatedAt={TICKET_CREATED_AT}
      viewer="staff"
      currentUserName="Bob IT Staff"
      {...overrides}
    />
  );
}

function renderRequester(overrides: Record<string, unknown> = {}) {
  return render(
    <ActionsTakenPanel
      ticketId={101}
      ticketStatus="In Progress"
      ticketCreatedAt={TICKET_CREATED_AT}
      viewer="requester"
      {...overrides}
    />
  );
}

function getActionsTable() {
  return screen.getByRole('table');
}

function tableRows() {
  return within(getActionsTable()).getAllByRole('row');
}

function tableDataRow(index: number) {
  return tableRows()[index];
}

function editButtonOfAction(rowIndex: number) {
  return within(tableDataRow(rowIndex)).getByRole('button', { name: 'Edit' });
}

async function openCreateForm() {
  fireEvent.click(screen.getByRole('button', { name: 'Add Action' }));
  return await screen.findByLabelText(/^action time/i);
}

function fillValidForm() {
  fireEvent.change(screen.getByLabelText(/^description/i), {
    target: { value: 'Visited the user desk and reinstalled the VPN client profile.' }
  });
  fireEvent.change(screen.getByLabelText(/^result/i), {
    target: { value: 'VPN stays connected after the reinstall.' }
  });
}

async function submitForm() {
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({})));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('UNIT-06: client form validators (BR-04/05/06, ui-spec §4.4)', () => {
  const baseValues = {
    actionAt: '',
    description: 'Valid description text',
    result: 'Valid result',
    followUpRequired: false,
    followUpNote: '',
    attachmentNotes: ''
  };
  const options = { ticketCreatedAtIso: TICKET_CREATED_AT, nowIso: '2026-10-21T09:00:00.000Z' };

  it('UNIT-06: accepts valid values', () => {
    expect(validateActionForm(baseValues, options)).toEqual({});
  });

  it('UNIT-06: description must be 5–2000 characters', () => {
    const errors = validateActionForm({ ...baseValues, description: 'abc' }, options);
    expect(errors.description).toBe('Enter a description of 5–2000 characters.');
    const tooLong = validateActionForm({ ...baseValues, description: 'x'.repeat(2001) }, options);
    expect(tooLong.description).toBe('Enter a description of 5–2000 characters.');
  });

  it('UNIT-06: result must be 2–1000 characters', () => {
    const errors = validateActionForm({ ...baseValues, result: 'a' }, options);
    expect(errors.result).toBe('Enter a result of 2–1000 characters.');
  });

  it('UNIT-06: follow-up note required (5–500) only when follow-up is required', () => {
    const unchecked = validateActionForm({ ...baseValues, followUpRequired: false, followUpNote: 'note' }, options);
    expect(unchecked.followUpNote).toBeUndefined();
    const checked = validateActionForm({ ...baseValues, followUpRequired: true, followUpNote: 'abc' }, options);
    expect(checked.followUpNote).toBe('Enter a follow-up note of 5–500 characters when follow-up is required.');
    const valid = validateActionForm({ ...baseValues, followUpRequired: true, followUpNote: 'Check the backup tomorrow morning.' }, options);
    expect(valid.followUpNote).toBeUndefined();
  });

  it('UNIT-06: attachment notes at most 500 characters', () => {
    const errors = validateActionForm({ ...baseValues, attachmentNotes: 'x'.repeat(501) }, options);
    expect(errors.attachmentNotes).toBe('Attachment notes can be up to 500 characters.');
  });

  it('UNIT-06: action time cannot be before the ticket was created or in the future', () => {
    // Ticket created 2026-10-01T09:00:00Z = 16:00 in Bangkok; now = 2026-10-21T09:00:00Z = 16:00 in Bangkok (+5 min tolerance).
    const tooEarly = validateActionForm({ ...baseValues, actionAt: '2026-10-01T15:59' }, options);
    expect(tooEarly.actionAt).toBe('Action time cannot be before the Ticket was created.');
    const future = validateActionForm({ ...baseValues, actionAt: '2026-10-21T16:10' }, options);
    expect(future.actionAt).toBe('Action time cannot be in the future.');
    const ok = validateActionForm({ ...baseValues, actionAt: '2026-10-21T16:00' }, options);
    expect(ok.actionAt).toBeUndefined();
  });

  it('UNIT-06: trims before checking lengths', () => {
    const errors = validateActionForm({ ...baseValues, description: '   ab   ', result: '  x  ' }, options);
    expect(errors.description).toBe('Enter a description of 5–2000 characters.');
    expect(errors.result).toBe('Enter a result of 2–1000 characters.');
  });

  it('UNIT-06: datetime-local value converts to ISO UTC by treating it as +07:00', () => {
    expect(bangkokLocalToIsoUtc('2026-10-21T15:45')).toBe('2026-10-21T08:45:00.000Z');
    expect(bangkokLocalToIsoUtc('')).toBe('');
  });

  it('UNIT-06: displays times in Asia/Bangkok via Intl', () => {
    const formatted = formatBangkokDateTime('2026-10-21T08:45:00.000Z');
    expect(formatted).toContain('15:45');
    expect(formatted).not.toContain('08:45');
  });
});

describe('UI-01: Actions Taken list', () => {
  it('UI-01: renders all fields in a table with th scope, caption, stable API order and Edited marker', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/actions-taken')) return Promise.resolve(jsonResponse(listBody()));
      return Promise.resolve(jsonResponse({}));
    }));

    renderStaff();

    expect(await screen.findByRole('heading', { name: /actions taken/i })).toBeTruthy();
    expect(screen.getAllByText('Visible to Requester').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/GMT\+7/).length).toBe(1);

    const table = await screen.findByRole('table');
    const headers = within(table).getAllByRole('columnheader').map((th) => th.textContent);
    expect(headers).toEqual([
      'Action time',
      'Description',
      'Result',
      'Performed by',
      'Follow-up',
      'Attachment notes',
      'Recorded',
      'Actions'
    ]);
    within(table).getAllByRole('columnheader').forEach((th) => expect(th).toHaveAttribute('scope', 'col'));
    const caption = table.querySelector('caption');
    expect(caption).toBeTruthy();

    // Stable order as returned by the API (first row is action 21 despite its later createdAt)
    const rows = tableRows();
    expect(rows[1].textContent).toContain('Remapped the Finance share on the user laptop.');
    expect(rows[2].textContent).toContain('Checked the VPN concentrator logs.');
    expect(rows[3].textContent).toContain('Restarted the access point in the meeting room');

    // Follow-up cues (text, not colour alone)
    expect(within(table).getByText(/Follow-up open/)).toBeTruthy();
    expect(within(table).getByText('✔ Follow-up done')).toBeTruthy();
    expect(within(table).getAllByText('Not required').length).toBe(1);

    // Edited marker when version > 1
    expect(within(table).getByText(/Edited by Priya Nair at/)).toBeTruthy();
    expect(within(table).queryByText(/Edited by Noah Lim/)).toBeNull();

    // Times shown in Asia/Bangkok (15:45 instead of 08:45 UTC)
    expect(within(tableDataRow(1)).getByText(/15:45/)).toBeTruthy();
  });

  it('UI-01: empty state shows "No actions recorded yet." and Add Action for staff', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/actions-taken')) return Promise.resolve(jsonResponse(listBody([])));
      return Promise.resolve(jsonResponse({}));
    }));

    renderStaff();

    expect(await screen.findByText('No actions recorded yet.')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Add Action' })).toHaveLength(1);
  });
});

describe('UI-02: create form validation', () => {
  it('UI-02: follow-up note appears only when the checkbox is checked and clearing on uncheck', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/actions-taken')) return Promise.resolve(jsonResponse(listBody([])));
      return Promise.resolve(jsonResponse({}));
    }));

    renderStaff();
    await openCreateForm();

    expect(screen.getByText('Bob IT Staff (automatic)')).toBeTruthy();
    expect(screen.queryByLabelText(/follow-up note/i)).toBeNull();

    fireEvent.click(screen.getByLabelText(/follow-up required/i));
    expect(screen.getByLabelText(/follow-up note/i)).toBeTruthy();

    // Uncheck hides and clears the note
    fireEvent.change(screen.getByLabelText(/follow-up note/i), { target: { value: 'Check the server room tomorrow.' } });
    fireEvent.click(screen.getByLabelText(/follow-up required/i));
    expect(screen.queryByLabelText(/follow-up note/i)).toBeNull();
    fireEvent.click(screen.getByLabelText(/follow-up required/i));
    expect((screen.getByLabelText(/follow-up note/i) as HTMLTextAreaElement).value).toBe('');
  });

  it('UI-02: shows messages under the fields, an error summary and moves focus to the first invalid field', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/actions-taken')) return Promise.resolve(jsonResponse(listBody([])));
      return Promise.resolve(jsonResponse({}));
    }));

    renderStaff();
    await openCreateForm();

    fireEvent.change(screen.getByLabelText(/^description/i), { target: { value: 'abc' } });
    fireEvent.change(screen.getByLabelText(/^result/i), { target: { value: 'x' } });
    fireEvent.click(screen.getByLabelText(/follow-up required/i));
    await submitForm();

    const summary = screen.getByRole('alert');
    expect(summary.textContent).toContain('Enter a description of 5–2000 characters.');
    expect(summary.textContent).toContain('Enter a result of 2–1000 characters.');
    expect(summary.textContent).toContain('Enter a follow-up note of 5–500 characters when follow-up is required.');

    const description = screen.getByLabelText(/^description/i);
    expect(description).toHaveAttribute('aria-invalid', 'true');
    const describedBy = description.getAttribute('aria-describedby') ?? '';
    expect(
      describedBy.split(/\s+/).some((id) => document.getElementById(id)?.textContent?.includes('Enter a description of 5–2000 characters.'))
    ).toBe(true);

    expect(document.activeElement).toBe(description);
  });

  it('UI-02: default action time is now in GMT+7 format and labelled once', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/actions-taken')) return Promise.resolve(jsonResponse(listBody([])));
      return Promise.resolve(jsonResponse({}));
    }));

    renderStaff();
    const input = await openCreateForm() as HTMLInputElement;
    expect(input.value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(screen.getAllByText(/GMT\+7/).length).toBe(1);
  });
});

describe('UI-03: double-click Save and idempotent clientRequestId', () => {
  it('UI-03: double-clicking Save sends exactly one POST', async () => {
    let resolveCreate: (value: Response) => void = () => {};
    const createResponse = new Promise<Response>((resolve) => { resolveCreate = resolve; });
    const fetchMock = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/actions-taken') && opts?.method === 'POST') return createResponse;
      if (url.includes('/actions-taken')) return Promise.resolve(jsonResponse(listBody([])));
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderStaff();
    await openCreateForm();
    fillValidForm();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    // Second click while the request is in flight is ignored (button disabled)
    fireEvent.click(screen.getByRole('button', { name: /saving/i }));

    resolveCreate(jsonResponse({
      actionTaken: {
        ...actionOne,
        id: 30,
        description: 'Visited the user desk and reinstalled the VPN client profile.',
        result: 'VPN stays connected after the reinstall.',
        followUpRequired: false,
        followUpNote: null,
        followUpCompletedAt: null,
        attachmentNotes: null,
        version: 1
      }
    }, 201));

    await waitFor(() => {
      expect(fetchMock.mock.calls.filter(([, opts]) => (opts as RequestInit | undefined)?.method === 'POST')).toHaveLength(1);
    });
  });

  it('UI-03: retry reuses the same clientRequestId generated when the form opened', async () => {
    let createCalls = 0;
    const seenClientRequestIds: string[] = [];
    const created = {
      ...actionOne,
      id: 31,
      description: 'Visited the user desk and reinstalled the VPN client profile.',
      result: 'VPN stays connected after the reinstall.',
      followUpRequired: false,
      followUpNote: null,
      followUpCompletedAt: null,
      attachmentNotes: null,
      version: 1
    };
    const fetchMock = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/actions-taken') && opts?.method === 'POST') {
        createCalls += 1;
        const body = JSON.parse(String(opts.body)) as { clientRequestId?: string };
        seenClientRequestIds.push(body.clientRequestId ?? '');
        if (createCalls === 1) return Promise.resolve(jsonResponse({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' } }, 500));
        return Promise.resolve(jsonResponse({ actionTaken: created }, 201));
      }
      if (url.includes('/actions-taken')) {
        return Promise.resolve(jsonResponse(listBody(createCalls >= 2 ? [created] : [])));
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderStaff();
    await openCreateForm();
    fillValidForm();
    await submitForm();

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain("We couldn't save the action. Your entries are kept — please try again.");
    });

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(screen.getAllByText(/Visited the user desk/).length).toBeGreaterThan(0);
    });
    expect(seenClientRequestIds).toHaveLength(2);
    expect(seenClientRequestIds[0]).toBeTruthy();
    expect(seenClientRequestIds[0]).toBe(seenClientRequestIds[1]);
    expect(screen.getAllByText('Action saved.')).toHaveLength(1);
  });
});

describe('UI-04: failures keep typed data', () => {
  it('UI-04: 500 shows the safe failure message, keeps entries and offers Retry without technical details', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/actions-taken') && opts?.method === 'POST') {
        return Promise.resolve(jsonResponse({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error at /api/staff/tickets/101/actions-taken' } }, 500));
      }
      if (url.includes('/actions-taken')) return Promise.resolve(jsonResponse(listBody([])));
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderStaff();
    await openCreateForm();
    const description = screen.getByLabelText(/^description/i);
    fireEvent.change(description, { target: { value: 'Typed text that must survive the failure.' } });
    fireEvent.change(screen.getByLabelText(/^result/i), { target: { value: 'Still a valid result.' } });
    await submitForm();

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain("We couldn't save the action. Your entries are kept — please try again.");
    });
    expect(screen.getByRole('alert').textContent).not.toContain('Internal server error');
    expect(screen.getByRole('alert').textContent).not.toContain('/api/');
    expect((screen.getByLabelText(/^description/i) as HTMLTextAreaElement).value).toBe('Typed text that must survive the failure.');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });

  it('UI-04: network failure shows the safe failure message and keeps entries', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/actions-taken') && opts?.method === 'POST') return Promise.reject(new TypeError('Failed to fetch'));
      if (url.includes('/actions-taken')) return Promise.resolve(jsonResponse(listBody([])));
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderStaff();
    await openCreateForm();
    fireEvent.change(screen.getByLabelText(/^description/i), { target: { value: 'Offline typed text stays here.' } });
    fireEvent.change(screen.getByLabelText(/^result/i), { target: { value: 'Still a valid result offline.' } });
    await submitForm();

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain("We couldn't save the action. Your entries are kept — please try again.");
    });
    expect((screen.getByLabelText(/^description/i) as HTMLTextAreaElement).value).toBe('Offline typed text stays here.');
  });

  it('UI-04: 400 VALIDATION_ERROR renders server field messages under the matching fields and keeps entries', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/actions-taken') && opts?.method === 'POST') {
        return Promise.resolve(jsonResponse({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed.',
            fields: { description: 'Enter a description of 5–2000 characters.', result: 'Enter a result of 2–1000 characters.' }
          }
        }, 400));
      }
      if (url.includes('/actions-taken')) return Promise.resolve(jsonResponse(listBody([])));
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderStaff();
    await openCreateForm();
    // Values pass the client check but the server rejects them
    fireEvent.change(screen.getByLabelText(/^description/i), { target: { value: 'Client thinks this is fine text.' } });
    fireEvent.change(screen.getByLabelText(/^result/i), { target: { value: 'Client thinks this result is fine.' } });
    await submitForm();

    await waitFor(() => {
      expect(screen.getAllByText('Enter a description of 5–2000 characters.').length).toBeGreaterThan(0);
    });
    const description = screen.getByLabelText(/^description/i);
    expect(description).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert').textContent).toContain('Enter a result of 2–1000 characters.');
    expect((description as HTMLTextAreaElement).value).toBe('Client thinks this is fine text.');
  });
});

describe('UI-05: version conflict', () => {
  it('UI-05: shows conflict banner with Reload latest / Keep editing and never overwrites silently', async () => {
    const editedAction = {
      ...actionTwo,
      version: 5,
      result: 'Server side newer result.',
      updatedBy: { id: 7, name: 'Sara Admin' },
      updatedAt: '2026-10-21T10:00:00.000Z'
    };
    let listCalls = 0;
    const fetchMock = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/actions-taken/22') && opts?.method === 'PATCH') {
        return Promise.resolve(jsonResponse({
          error: { code: 'VERSION_CONFLICT', message: 'Stale version.', details: { currentVersion: 5 } }
        }, 409));
      }
      if (url.includes('/actions-taken') && opts?.method === 'POST') {
        return Promise.resolve(jsonResponse({ actionTaken: actionOne }, 201));
      }
      if (url.includes('/actions-taken')) {
        listCalls += 1;
        return Promise.resolve(jsonResponse(listBody(listCalls === 1 ? threeActions : [actionOne, editedAction, actionThree])));
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderStaff();
    await waitFor(() => {
      expect(within(tableDataRow(2)).getByText('Checked the VPN concentrator logs.')).toBeTruthy();
    });

    fireEvent.click(editButtonOfAction(2));
    await waitFor(() => {
      expect((screen.getByLabelText(/^result/i) as HTMLTextAreaElement).value).toBe('No errors found in logs.');
    });
    fireEvent.change(screen.getByLabelText(/^result/i), { target: { value: 'My unsaved result text.' } });
    await submitForm();

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('This action was changed by someone else. Reload to see the latest version.');
    expect(screen.getByRole('button', { name: 'Reload latest' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Keep editing' })).toBeTruthy();

    // Nothing was overwritten
    expect((screen.getByLabelText(/^result/i) as HTMLTextAreaElement).value).toBe('My unsaved result text.');

    fireEvent.click(screen.getByRole('button', { name: 'Reload latest' }));

    // Latest server values are shown beside the user's unsaved text
    await waitFor(() => {
      expect(screen.getAllByText('Server side newer result.').length).toBeGreaterThan(0);
    });
    expect((screen.getByLabelText(/^result/i) as HTMLTextAreaElement).value).toBe('My unsaved result text.');

    // Keep editing dismisses the banner but keeps the form
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => {
      expect(screen.queryByText('This action was changed by someone else. Reload to see the latest version.')).toBeNull();
    });
    expect((screen.getByLabelText(/^result/i) as HTMLTextAreaElement).value).toBe('My unsaved result text.');
  });

  it('UI-05: Save without Reload latest resends the same stale expectedVersion and keeps every typed field', async () => {
    const patchBodies: Array<{ expectedVersion?: number; description?: string; result?: string }> = [];
    const fetchMock = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/actions-taken/22') && opts?.method === 'PATCH') {
        patchBodies.push(JSON.parse(String(opts.body)) as { expectedVersion?: number; description?: string; result?: string });
        return Promise.resolve(jsonResponse({
          error: { code: 'VERSION_CONFLICT', message: 'Stale version at PATCH /api/staff/tickets/101/actions-taken/22', details: { currentVersion: 5 } }
        }, 409));
      }
      if (url.includes('/actions-taken')) return Promise.resolve(jsonResponse(listBody()));
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderStaff();
    await waitFor(() => {
      expect(within(tableDataRow(2)).getByText('Checked the VPN concentrator logs.')).toBeTruthy();
    });

    fireEvent.click(editButtonOfAction(2));
    await waitFor(() => {
      expect((screen.getByLabelText(/^result/i) as HTMLTextAreaElement).value).toBe('No errors found in logs.');
    });
    fireEvent.change(screen.getByLabelText(/^description/i), { target: { value: 'Typed description kept through the conflict.' } });
    fireEvent.change(screen.getByLabelText(/^result/i), { target: { value: 'My unsaved result text.' } });
    await submitForm();

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('This action was changed by someone else. Reload to see the latest version.');
    expect(banner.textContent).not.toContain('/api/staff');
    expect(patchBodies).toHaveLength(1);
    expect(patchBodies[0].expectedVersion).toBe(actionTwo.version);
    expect((screen.getByLabelText(/^description/i) as HTMLTextAreaElement).value).toBe('Typed description kept through the conflict.');
    expect((screen.getByLabelText(/^result/i) as HTMLTextAreaElement).value).toBe('My unsaved result text.');

    // Retrying without "Reload latest" must keep sending the stale version instead of adopting the newer one.
    await submitForm();
    await waitFor(() => {
      expect(patchBodies).toHaveLength(2);
    });
    expect(patchBodies[1].expectedVersion).toBe(actionTwo.version);
    expect(patchBodies[1].description).toBe('Typed description kept through the conflict.');
    expect(patchBodies[1].result).toBe('My unsaved result text.');
    await waitFor(() => {
      expect(screen.getByText('This action was changed by someone else. Reload to see the latest version.')).toBeTruthy();
    });
    expect((screen.getByLabelText(/^description/i) as HTMLTextAreaElement).value).toBe('Typed description kept through the conflict.');
    expect((screen.getByLabelText(/^result/i) as HTMLTextAreaElement).value).toBe('My unsaved result text.');
  });

  it('UI-05: Reload latest sends nothing by itself; only the next explicit Save uses the refreshed version', async () => {
    const editedAction: ActionTakenDto = {
      ...actionTwo,
      version: 5,
      result: 'Server side newer result.',
      updatedBy: { id: 7, name: 'Sara Admin' },
      updatedAt: '2026-10-21T10:00:00.000Z'
    };
    let listCalls = 0;
    let patchCalls = 0;
    const patchBodies: Array<{ expectedVersion?: number; result?: string }> = [];
    const fetchMock = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/actions-taken/22') && opts?.method === 'PATCH') {
        patchCalls += 1;
        const body = JSON.parse(String(opts.body)) as { expectedVersion?: number; result?: string };
        patchBodies.push(body);
        if (patchCalls === 1) {
          return Promise.resolve(jsonResponse({
            error: { code: 'VERSION_CONFLICT', message: 'Stale version.', details: { currentVersion: 5 } }
          }, 409));
        }
        return Promise.resolve(jsonResponse({
          actionTaken: {
            ...editedAction,
            version: 6,
            result: body.result ?? editedAction.result,
            updatedAt: '2026-10-21T10:05:00.000Z'
          }
        }, 200));
      }
      if (url.includes('/actions-taken')) {
        listCalls += 1;
        return Promise.resolve(jsonResponse(listBody(listCalls === 1 ? threeActions : [actionOne, editedAction, actionThree])));
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderStaff();
    await waitFor(() => {
      expect(within(tableDataRow(2)).getByText('Checked the VPN concentrator logs.')).toBeTruthy();
    });

    fireEvent.click(editButtonOfAction(2));
    await waitFor(() => {
      expect((screen.getByLabelText(/^result/i) as HTMLTextAreaElement).value).toBe('No errors found in logs.');
    });
    fireEvent.change(screen.getByLabelText(/^result/i), { target: { value: 'My unsaved result text.' } });
    await submitForm();

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('This action was changed by someone else. Reload to see the latest version.');
    expect(patchBodies).toHaveLength(1);
    expect(patchBodies[0].expectedVersion).toBe(actionTwo.version);

    fireEvent.click(screen.getByRole('button', { name: 'Reload latest' }));
    await waitFor(() => {
      expect(screen.getAllByText('Server side newer result.').length).toBeGreaterThan(0);
    });
    // Re-fetching the latest version must not submit anything on its own.
    expect(patchBodies).toHaveLength(1);
    expect((screen.getByLabelText(/^result/i) as HTMLTextAreaElement).value).toBe('My unsaved result text.');

    await submitForm();
    await waitFor(() => {
      expect(patchBodies).toHaveLength(2);
    });
    expect(patchBodies[1].expectedVersion).toBe(editedAction.version);
    expect(patchBodies[1].result).toBe('My unsaved result text.');
    await waitFor(() => {
      expect(screen.queryByText('This action was changed by someone else. Reload to see the latest version.')).toBeNull();
    });
  });

  it('UI-05: Keep editing leaves the form editable with the typed text intact', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/actions-taken/22') && opts?.method === 'PATCH') {
        return Promise.resolve(jsonResponse({
          error: { code: 'VERSION_CONFLICT', message: 'Stale version.', details: { currentVersion: 5 } }
        }, 409));
      }
      if (url.includes('/actions-taken')) return Promise.resolve(jsonResponse(listBody()));
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderStaff();
    await waitFor(() => {
      expect(within(tableDataRow(2)).getByText('Checked the VPN concentrator logs.')).toBeTruthy();
    });

    fireEvent.click(editButtonOfAction(2));
    await waitFor(() => {
      expect((screen.getByLabelText(/^result/i) as HTMLTextAreaElement).value).toBe('No errors found in logs.');
    });
    fireEvent.change(screen.getByLabelText(/^result/i), { target: { value: 'My unsaved result text.' } });
    await submitForm();

    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => {
      expect(screen.queryByText('This action was changed by someone else. Reload to see the latest version.')).toBeNull();
    });

    const resultField = screen.getByLabelText(/^result/i) as HTMLTextAreaElement;
    expect(resultField.value).toBe('My unsaved result text.');
    expect(resultField.disabled).toBe(false);

    fireEvent.change(resultField, { target: { value: 'My unsaved result text, revised.' } });
    expect((screen.getByLabelText(/^result/i) as HTMLTextAreaElement).value).toBe('My unsaved result text, revised.');

    const saveButton = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(false);
  });
});

describe('UI-06: edit mode and follow-up completion', () => {
  it('UI-06: Edit opens the prefilled form and PATCH sends expectedVersion from state; list refreshes', async () => {
    let patchBody: Record<string, unknown> | null = null;
    let patched = false;
    const updatedAction = {
      ...actionOne,
      version: 2,
      result: 'User confirmed the drive is reachable.',
      updatedBy: { id: 2, name: 'Bob IT Staff' }
    };
    const fetchMock = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/actions-taken/21') && opts?.method === 'PATCH') {
        patchBody = JSON.parse(String(opts.body)) as Record<string, unknown>;
        patched = true;
        return Promise.resolve(jsonResponse({ actionTaken: updatedAction }));
      }
      if (url.includes('/actions-taken') && opts?.method === 'POST') {
        return Promise.resolve(jsonResponse({ actionTaken: actionOne }, 201));
      }
      if (url.includes('/actions-taken')) {
        return Promise.resolve(jsonResponse(listBody(patched ? [updatedAction, actionTwo, actionThree] : threeActions)));
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderStaff();
    await waitFor(() => {
      expect(within(tableDataRow(1)).getByText('Remapped the Finance share on the user laptop.')).toBeTruthy();
    });

    fireEvent.click(editButtonOfAction(1));

    await waitFor(() => {
      expect((screen.getByLabelText(/^description/i) as HTMLTextAreaElement).value).toBe('Remapped the Finance share on the user laptop.');
    });
    expect(screen.getByText('Noah Lim (automatic)')).toBeTruthy();
    expect((screen.getByLabelText(/follow-up required/i) as HTMLInputElement).checked).toBe(true);

    fireEvent.change(screen.getByLabelText(/^result/i), { target: { value: 'User confirmed the drive is reachable.' } });
    await submitForm();

    await waitFor(() => {
      expect(patchBody).toMatchObject({ expectedVersion: 1, result: 'User confirmed the drive is reachable.' });
    });
    await waitFor(() => {
      expect(within(tableDataRow(1)).getByText('User confirmed the drive is reachable.')).toBeTruthy();
    });
    expect(screen.getAllByText('Action saved.')).toHaveLength(1);
  });

  it('UI-06: Mark follow-up done PATCHes followUpCompleted with expectedVersion and refreshes the list', async () => {
    let patchCall = 0;
    const fetchMock = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/actions-taken/21') && opts?.method === 'PATCH') {
        patchCall += 1;
        const body = JSON.parse(String(opts.body)) as Record<string, unknown>;
        expect(body).toEqual({ expectedVersion: 1, followUpCompleted: true });
        return Promise.resolve(jsonResponse({ actionTaken: { ...actionOne, version: 2, followUpCompletedAt: '2026-10-23T04:00:00.000Z' } }));
      }
      if (url.includes('/actions-taken') && opts?.method === 'POST') {
        return Promise.resolve(jsonResponse({ actionTaken: actionOne }, 201));
      }
      if (url.includes('/actions-taken')) {
        const actions = patchCall === 0
          ? threeActions
          : [{ ...actionOne, version: 2, followUpCompletedAt: '2026-10-23T04:00:00.000Z' }, actionTwo, actionThree];
        return Promise.resolve(jsonResponse(listBody(actions)));
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderStaff();
    await waitFor(() => {
      expect(within(tableDataRow(1)).getByText('Remapped the Finance share on the user laptop.')).toBeTruthy();
    });

    fireEvent.click(within(tableDataRow(1)).getByRole('button', { name: 'Mark follow-up done' }));

    await waitFor(() => {
      expect(patchCall).toBe(1);
    });
    await waitFor(() => {
      expect(within(tableDataRow(1)).getByRole('button', { name: 'Reopen follow-up' })).toBeTruthy();
    });
    expect(within(tableDataRow(1)).getByText('✔ Follow-up done')).toBeTruthy();
  });

  it('UI-06: Reopen follow-up PATCHes followUpCompleted false', async () => {
    let patchBody: Record<string, unknown> | null = null;
    const doneAction = { ...actionOne, followUpCompletedAt: '2026-10-23T04:00:00.000Z', version: 2 };
    const fetchMock = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/actions-taken/21') && opts?.method === 'PATCH') {
        patchBody = JSON.parse(String(opts.body)) as Record<string, unknown>;
        return Promise.resolve(jsonResponse({ actionTaken: { ...doneAction, followUpCompletedAt: null, version: 3 } }));
      }
      if (url.includes('/actions-taken')) {
        return Promise.resolve(jsonResponse(listBody([doneAction, actionTwo, actionThree])));
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderStaff();
    await waitFor(() => {
      expect(within(tableDataRow(1)).getByText('Remapped the Finance share on the user laptop.')).toBeTruthy();
    });

    fireEvent.click(within(tableDataRow(1)).getByRole('button', { name: 'Reopen follow-up' }));

    await waitFor(() => {
      expect(patchBody).toEqual({ expectedVersion: 2, followUpCompleted: false });
    });
  });

  it('UI-06: opening another form while one is open asks to discard unsaved changes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/actions-taken')) return Promise.resolve(jsonResponse(listBody()));
      return Promise.resolve(jsonResponse({}));
    }));
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    renderStaff();
    await openCreateForm();
    fireEvent.change(screen.getByLabelText(/^description/i), { target: { value: 'Unsaved text in the create form.' } });

    fireEvent.click(screen.getByRole('button', { name: 'Add Action' }));
    expect(confirmSpy).toHaveBeenCalledWith('Discard unsaved changes?');
    expect((screen.getByLabelText(/^description/i) as HTMLTextAreaElement).value).toBe('Unsaved text in the create form.');
  });
});

describe('UI-07: requester read-only view', () => {
  it('UI-07: shows the list read-only with the visibility note and no staff controls', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/actions-taken')) return Promise.resolve(jsonResponse(listBody()));
      return Promise.resolve(jsonResponse({}));
    }));

    renderRequester();

    await waitFor(() => {
      expect(within(tableDataRow(1)).getByText('Remapped the Finance share on the user laptop.')).toBeTruthy();
    });
    expect(screen.getByText('These updates are visible to you and to IT Staff.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add Action' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark follow-up done' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reopen follow-up' })).toBeNull();
    // Same follow-up text cues
    expect(within(getActionsTable()).getByText(/Follow-up open/)).toBeTruthy();
  });

  it('UI-07: empty state for a requester is plain text only', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/actions-taken')) return Promise.resolve(jsonResponse(listBody([])));
      return Promise.resolve(jsonResponse({}));
    }));

    renderRequester();
    expect(await screen.findByText('No actions recorded yet.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add Action' })).toBeNull();
  });
});

describe('UI-08: locked ticket statuses', () => {
  it('UI-08: hides staff controls and explains why when the ticket is Resolved', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/actions-taken')) return Promise.resolve(jsonResponse(listBody()));
      return Promise.resolve(jsonResponse({}));
    }));

    renderStaff({ ticketStatus: 'Resolved' });
    await waitFor(() => {
      expect(within(tableDataRow(1)).getByText('Remapped the Finance share on the user laptop.')).toBeTruthy();
    });

    expect(screen.queryByRole('button', { name: 'Add Action' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark follow-up done' })).toBeNull();
    expect(screen.getByText("Actions can't be changed while the Ticket is Resolved. Reopen the Ticket to add or edit actions.")).toBeTruthy();
  });

  it('UI-08: handles 409 TICKET_ACTIONS_LOCKED on save and refreshes the ticket', async () => {
    const onActionsChanged = vi.fn();
    const fetchMock = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/actions-taken/21') && opts?.method === 'PATCH') {
        return Promise.resolve(jsonResponse({ error: { code: 'TICKET_ACTIONS_LOCKED', message: 'Locked.' } }, 409));
      }
      if (url.includes('/actions-taken')) return Promise.resolve(jsonResponse(listBody()));
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderStaff({ onActionsChanged });
    await waitFor(() => {
      expect(within(tableDataRow(1)).getByText('Remapped the Finance share on the user laptop.')).toBeTruthy();
    });

    fireEvent.click(editButtonOfAction(1));
    await waitFor(() => {
      expect(screen.getByLabelText(/^result/i)).toBeTruthy();
    });
    await submitForm();

    expect(await screen.findByText("Actions can't be changed while the Ticket is In Progress.")).toBeTruthy();
    await waitFor(() => {
      expect(onActionsChanged).toHaveBeenCalled();
    });
  });

  it('UI-08: 409 TICKET_ACTIONS_LOCKED keeps the typed data and shows no technical detail', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/actions-taken/21') && opts?.method === 'PATCH') {
        return Promise.resolve(jsonResponse({
          error: { code: 'TICKET_ACTIONS_LOCKED', message: 'Ticket is locked at /api/staff/tickets/101/actions-taken/21' }
        }, 409));
      }
      if (url.includes('/actions-taken')) return Promise.resolve(jsonResponse(listBody()));
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderStaff();
    await waitFor(() => {
      expect(within(tableDataRow(1)).getByText('Remapped the Finance share on the user laptop.')).toBeTruthy();
    });

    fireEvent.click(editButtonOfAction(1));
    await waitFor(() => {
      expect(screen.getByLabelText(/^description/i)).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText(/^description/i), { target: { value: 'Typed description that must survive the lock.' } });
    fireEvent.change(screen.getByLabelText(/^result/i), { target: { value: 'Typed result that must survive the lock.' } });
    await submitForm();

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain("Actions can't be changed while the Ticket is In Progress.");
    expect(banner.textContent).not.toContain('/api/staff');
    expect(banner.textContent).not.toContain('Ticket is locked at');
    expect((screen.getByLabelText(/^description/i) as HTMLTextAreaElement).value).toBe('Typed description that must survive the lock.');
    expect((screen.getByLabelText(/^result/i) as HTMLTextAreaElement).value).toBe('Typed result that must survive the lock.');
  });
});

describe('UI-09: loading, forbidden and not-found states', () => {
  it('UI-09: shows a loading state while fetching', () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise<Response>(() => {})));

    renderStaff();
    const loadingText = screen.getByText('Loading actions…');
    expect(loadingText.closest('[role="status"]')).toBeTruthy();
  });

  it('UI-09: forbidden state', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/actions-taken')) {
        return Promise.resolve(jsonResponse({ error: { code: 'FORBIDDEN', message: 'Forbidden.' } }, 403));
      }
      return Promise.resolve(jsonResponse({}));
    }));

    renderStaff();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("You don't have permission to change actions.");
  });

  it('UI-09: not-found state with a link back to the queue', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/actions-taken')) {
        return Promise.resolve(jsonResponse({ error: { code: 'TICKET_NOT_FOUND', message: 'Not found.' } }, 404));
      }
      return Promise.resolve(jsonResponse({}));
    }));

    renderStaff();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('This ticket or action is no longer available.');
    expect(screen.getByRole('link', { name: /back to the ticket queue/i })).toHaveAttribute('href', '/staff/tickets');
  });

  it('UI-09: safe failure on load offers Retry without technical details', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/actions-taken')) return Promise.reject(new TypeError('Failed to fetch'));
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderStaff();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("We couldn't load the actions. Please try again.");
    expect(alert.textContent).not.toContain('Failed to fetch');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });

  it('UI-09: 404 during save keeps the form visible until dismissed', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/actions-taken') && opts?.method === 'POST') {
        return Promise.resolve(jsonResponse({ error: { code: 'ACTION_NOT_FOUND', message: 'Gone.' } }, 404));
      }
      if (url.includes('/actions-taken')) return Promise.resolve(jsonResponse(listBody([])));
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderStaff();
    await openCreateForm();
    fillValidForm();
    await submitForm();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('This ticket or action is no longer available.');
    expect((screen.getByLabelText(/^description/i) as HTMLTextAreaElement).value).toContain('Visited the user desk');

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => {
      expect(screen.queryByLabelText(/^description/i)).toBeNull();
    });
  });
});

describe('success announcement and request shape', () => {
  it('announces "Action saved." through a status live region after create', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/actions-taken') && opts?.method === 'POST') {
        return Promise.resolve(jsonResponse({
          actionTaken: {
            ...actionOne,
            id: 40,
            description: 'Visited the user desk and reinstalled the VPN client profile.',
            result: 'VPN stays connected after the reinstall.',
            followUpRequired: false,
            followUpNote: null,
            followUpCompletedAt: null,
            attachmentNotes: null,
            version: 1
          }
        }, 201));
      }
      if (url.includes('/actions-taken')) return Promise.resolve(jsonResponse(listBody([])));
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderStaff();
    await openCreateForm();
    fillValidForm();
    await submitForm();

    await waitFor(() => {
      expect(screen.getAllByText('Action saved.')).toHaveLength(1);
    });
    const liveRegion = screen.getAllByText('Action saved.')[0].closest('[role="status"]');
    expect(liveRegion).toBeTruthy();
  });

  it('sends create payloads with converted actionAt, CSRF header and same-origin credentials', async () => {
    let requestBody: Record<string, unknown> | null = null;
    let requestInit: RequestInit | null = null;
    const fetchMock = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/actions-taken') && opts?.method === 'POST') {
        requestBody = JSON.parse(String(opts.body)) as Record<string, unknown>;
        requestInit = opts;
        return Promise.resolve(jsonResponse({
          actionTaken: {
            ...actionOne,
            id: 41,
            description: 'Visited the user desk and reinstalled the VPN client profile.',
            result: 'VPN stays connected after the reinstall.',
            followUpRequired: false,
            followUpNote: null,
            followUpCompletedAt: null,
            attachmentNotes: null,
            version: 1
          }
        }, 201));
      }
      if (url.includes('/actions-taken')) return Promise.resolve(jsonResponse(listBody([])));
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderStaff();
    const timeInput = await openCreateForm() as HTMLInputElement;
    fillValidForm();
    await submitForm();

    await waitFor(() => {
      expect(requestBody).toBeTruthy();
    });
    expect(requestBody!.actionAt).toBe(bangkokLocalToIsoUtc(timeInput.value));
    expect(requestBody!.followUpRequired).toBe(false);
    expect(requestBody!.followUpNote).toBeUndefined();
    expect(requestInit!.credentials).toBe('same-origin');
    expect((requestInit!.headers as Record<string, string>)['X-Requested-With']).toBe('XMLHttpRequest');
    expect(fetchMock).toHaveBeenCalledWith('/api/staff/tickets/101/actions-taken', expect.anything());
  });

  it('cancel closes the create form and returns focus to Add Action', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/actions-taken')) return Promise.resolve(jsonResponse(listBody([])));
      return Promise.resolve(jsonResponse({}));
    }));

    renderStaff();
    const addButton = screen.getByRole('button', { name: 'Add Action' });
    fireEvent.click(addButton);
    await screen.findByLabelText(/^action time/i);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByLabelText(/^action time/i)).toBeNull();
    });
    expect(document.activeElement).toBe(addButton);
  });
});

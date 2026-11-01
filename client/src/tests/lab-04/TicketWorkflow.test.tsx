/**
 * Lab 4 Issue 4 — Ticket workflow UI (tests.md UI-11 … UI-17, AC-21, AC-14, AC-15)
 *
 * UI-11: status select options are exactly `allowedTransitions`; no control when none
 * UI-12: confirmation dialog for Cancelled/Resolved/Closed/Reopened targets; none for
 *        New→Open, Open→In Progress, In Progress↔Waiting for Requester
 * UI-13: Resolved selected with total = 0 or open follow-ups → Update disabled + helper
 *        text linked with aria-describedby
 * UI-14: backend RESOLUTION_BLOCKED / INVALID_STATUS_TRANSITION / VERSION_CONFLICT →
 *        inline messages; reloaded where required; state kept where required; a repeat
 *        click without reload sends the same expectedVersion
 * UI-15: successful change → status badge, controls and announcement refresh
 * UI-16: dialog accessibility (role=dialog, aria-modal, labelled, focus trap, Esc,
 *        focus returns, verb confirm button)
 * UI-17: "Requester reports resolved" badge from requesterMarkedResolved; no effect on
 *        status controls
 * BR-21/F4: status, owner and priority PATCHes carry expectedVersion
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { StaffTicketDetail } from '../../pages/StaffTicketDetail';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

const BASE_TICKET = {
  id: 101,
  ticketNumber: 'TICK-20261020-0101',
  summary: 'Finance printer offline for all users',
  description: 'The shared Finance printer shows offline on every workstation.',
  requestedPriority: 'High',
  itPriority: 'High',
  status: 'In Progress',
  version: 3,
  resolvedAt: null,
  requesterMarkedResolved: false,
  requester: { id: 1, name: 'Alice Requester', email: 'alice@example.com', department: 'Sales' },
  ownerId: null,
  owner: null,
  category: { id: 2, code: 'HARDWARE', name: 'Hardware', isActive: true },
  relatedSystem: { id: 3, code: 'PRINTER', name: 'Print Service', isActive: true },
  attachments: [],
  createdAt: '2026-10-20T09:00:00.000Z',
  updatedAt: '2026-10-20T09:00:00.000Z',
  allowedTransitions: ['Waiting for Requester', 'Resolved', 'Cancelled']
};

type FetchOptions = {
  ticket?: Record<string, unknown>;
  summary?: { total: number; openFollowUps: number };
  assignableOwners?: Array<{ id: number; name: string }>;
  onStatusPatch?: (callIndex: number, body: Record<string, unknown>) => { status: number; body: unknown };
  onOwnerPatch?: (callIndex: number, body: Record<string, unknown>) => { status: number; body: unknown };
  onPriorityPatch?: (callIndex: number, body: Record<string, unknown>) => { status: number; body: unknown };
};

function makeFetch(options: FetchOptions = {}) {
  const counters = { detailGet: 0, actionsGet: 0, statusPatch: 0, ownerPatch: 0, priorityPatch: 0 };
  const statusBodies: Array<Record<string, unknown>> = [];
  const ownerBodies: Array<Record<string, unknown>> = [];
  const priorityBodies: Array<Record<string, unknown>> = [];
  const ticket = options.ticket ?? BASE_TICKET;
  const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
    if (method === 'PATCH' && String(url).endsWith('/status')) {
      const index = counters.statusPatch++;
      statusBodies.push(body ?? {});
      const result = options.onStatusPatch?.(index, body ?? {}) ?? { status: 200, body: { ticket } };
      return Promise.resolve(jsonResponse(result.body, result.status));
    }
    if (method === 'PATCH' && String(url).endsWith('/owner')) {
      const index = counters.ownerPatch++;
      ownerBodies.push(body ?? {});
      const result = options.onOwnerPatch?.(index, body ?? {}) ?? { status: 200, body: { ticket: { ...ticket, owner: { id: 2, name: 'Bob IT Staff' }, ownerId: 2 } } };
      return Promise.resolve(jsonResponse(result.body, result.status));
    }
    if (method === 'PATCH' && String(url).endsWith('/priority')) {
      const index = counters.priorityPatch++;
      priorityBodies.push(body ?? {});
      const result = options.onPriorityPatch?.(index, body ?? {}) ?? { status: 200, body: { ticket: { ...ticket, itPriority: body?.itPriority } } };
      return Promise.resolve(jsonResponse(result.body, result.status));
    }
    if (method === 'GET' && String(url).endsWith('/actions-taken')) {
      counters.actionsGet++;
      return Promise.resolve(jsonResponse({
        actionsTaken: [],
        summary: options.summary ?? { total: 2, openFollowUps: 0 }
      }));
    }
    if (method === 'GET' && String(url).endsWith('/assignable-owners')) {
      return Promise.resolve(jsonResponse({ owners: options.assignableOwners ?? [{ id: 3, name: 'Carol IT Staff' }] }));
    }
    if (method === 'GET' && String(url).includes('/api/staff/tickets/101')) {
      counters.detailGet++;
      return Promise.resolve(jsonResponse({ ticket, comments: [], notes: [] }));
    }
    return Promise.resolve(jsonResponse({}));
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, counters, statusBodies, ownerBodies, priorityBodies };
}

function makeTicket(status: string, allowedTransitions: string[], extra: Record<string, unknown> = {}) {
  return { ...BASE_TICKET, status, allowedTransitions, ...extra };
}

function statusSelect() {
  return screen.getByLabelText('Change status') as HTMLSelectElement;
}

async function renderDetail(ticketId = 101) {
  render(<StaffTicketDetail ticketId={ticketId} currentUserId={2} onBack={vi.fn()} />);
  await screen.findByText('TICK-20261020-0101');
}

describe('Ticket workflow UI (UI-11 … UI-17)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('UI-11: the status select lists exactly allowedTransitions from the API', async () => {
    makeFetch({ ticket: makeTicket('In Progress', ['Waiting for Requester', 'Resolved', 'Cancelled']) });
    await renderDetail();

    const options = Array.from(statusSelect().options).map((option) => option.value);
    expect(options).toEqual(['Waiting for Requester', 'Resolved', 'Cancelled']);
    // The current status is not an option and the client carries no matrix of its own.
    expect(options).not.toContain('In Progress');
    expect(options).not.toContain('Open');
  });

  it('UI-11: with no allowed transitions the control is replaced by explanatory text', async () => {
    makeFetch({ ticket: makeTicket('Cancelled', []) });
    await renderDetail();

    expect(screen.queryByLabelText('Change status')).toBeNull();
    expect(screen.getByText('No further status changes are possible.')).toBeInTheDocument();
  });

  const confirmPairs: Array<{ from: string; to: string; verb: RegExp }> = [
    { from: 'In Progress', to: 'Cancelled', verb: /cancel ticket/i },
    { from: 'In Progress', to: 'Resolved', verb: /mark as resolved/i },
    { from: 'Resolved', to: 'Closed', verb: /close ticket/i },
    { from: 'Resolved', to: 'Reopened', verb: /reopen ticket/i }
  ];

  it.each(confirmPairs)(
    'UI-12: $from → $to asks for confirmation naming both statuses and sends nothing until confirmed',
    async ({ from, to, verb }) => {
      const { fetchMock, statusBodies } = makeFetch({ ticket: makeTicket(from, [to]) });
      await renderDetail();

      fireEvent.change(statusSelect(), { target: { value: to } });
      const updateButton = screen.getByRole('button', { name: 'Update status' });
      if (to === 'Resolved') {
        await waitFor(() => expect(updateButton).toBeEnabled());
      }
      fireEvent.click(updateButton);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(within(dialog).getByText(`Change status from ${from} to ${to}?`)).toBeInTheDocument();

      // Nothing was sent yet — Cancel closes the dialog without a PATCH.
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(fetchMock).not.toHaveBeenCalledWith(
        '/api/staff/tickets/101/status',
        expect.objectContaining({ method: 'PATCH' })
      );

      // Confirm with the verb button.
      fireEvent.click(screen.getByRole('button', { name: 'Update status' }));
      const reopenedDialog = screen.getByRole('dialog');
      fireEvent.click(within(reopenedDialog).getByRole('button', { name: verb }));
      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/staff/tickets/101/status',
          expect.objectContaining({ method: 'PATCH' })
        )
      );
      expect(statusBodies[0].status).toBe(to);
      expect(statusBodies[0].expectedVersion).toBe(3);
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    }
  );

  const directPairs: Array<{ from: string; to: string }> = [
    { from: 'New', to: 'Open' },
    { from: 'Open', to: 'In Progress' },
    { from: 'In Progress', to: 'Waiting for Requester' }
  ];

  it.each(directPairs)(
    'UI-12: $from → $to updates immediately with no confirmation dialog',
    async ({ from, to }) => {
      const { fetchMock } = makeFetch({ ticket: makeTicket(from, [to]) });
      await renderDetail();

      fireEvent.change(statusSelect(), { target: { value: to } });
      fireEvent.click(screen.getByRole('button', { name: 'Update status' }));

      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/staff/tickets/101/status',
          expect.objectContaining({ method: 'PATCH' })
        )
      );
      expect(screen.queryByRole('dialog')).toBeNull();
    }
  );

  it('UI-13: Resolved with no actions disables Update status and explains why (aria-describedby)', async () => {
    makeFetch({
      ticket: makeTicket('In Progress', ['Waiting for Requester', 'Resolved', 'Cancelled']),
      summary: { total: 0, openFollowUps: 0 }
    });
    await renderDetail();

    const updateButton = screen.getByRole('button', { name: 'Update status' });
    expect(updateButton).toBeEnabled();

    fireEvent.change(statusSelect(), { target: { value: 'Resolved' } });

    await waitFor(() => expect(updateButton).toBeDisabled());
    const helper = screen.getByText('Record at least one action before resolving.');
    expect(helper).toBeInTheDocument();
    const describedBy = updateButton.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)).toBe(helper);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('UI-13: Resolved with open follow-ups disables Update status with the exact count', async () => {
    makeFetch({
      ticket: makeTicket('Waiting for Requester', ['In Progress', 'Resolved', 'Cancelled']),
      summary: { total: 2, openFollowUps: 3 }
    });
    await renderDetail();

    fireEvent.change(statusSelect(), { target: { value: 'Resolved' } });

    await waitFor(() => expect(screen.getByRole('button', { name: 'Update status' })).toBeDisabled());
    expect(screen.getByText('Complete 3 open follow-up(s) before resolving.')).toBeInTheDocument();
  });

  it('UI-14: RESOLUTION_BLOCKED shows the inline message, keeps state and reloads nothing', async () => {
    const { fetchMock, counters } = makeFetch({
      ticket: makeTicket('In Progress', ['Waiting for Requester', 'Resolved', 'Cancelled']),
      summary: { total: 1, openFollowUps: 0 },
      onStatusPatch: () => ({
        status: 409,
        body: {
          error: {
            code: 'RESOLUTION_BLOCKED',
            message: 'Resolve needs at least one Action Taken.',
            details: { reason: 'NO_ACTIONS_TAKEN', openFollowUps: 0 }
          }
        }
      })
    });
    await renderDetail();

    fireEvent.change(statusSelect(), { target: { value: 'Resolved' } });
    const updateButton = screen.getByRole('button', { name: 'Update status' });
    await waitFor(() => expect(updateButton).toBeEnabled());
    fireEvent.click(updateButton);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /mark as resolved/i }));

    const alert = await screen.findByText('Record at least one action before resolving.');
    expect(alert.closest('[role="alert"]')).not.toBeNull();
    // Nothing else changed: dialog closed, selection kept, no reload, no re-send.
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(statusSelect().value).toBe('Resolved');
    await waitFor(() => expect(counters.detailGet).toBe(1));
    expect(counters.statusPatch).toBe(1);
  });

  it('UI-14: INVALID_STATUS_TRANSITION shows the message and reloads without re-sending', async () => {
    const { counters } = makeFetch({
      ticket: makeTicket('In Progress', ['Waiting for Requester', 'Resolved', 'Cancelled']),
      onStatusPatch: () => ({
        status: 409,
        body: {
          error: { code: 'INVALID_STATUS_TRANSITION', message: 'Status transition from In Progress to Waiting for Requester is not permitted.' }
        }
      })
    });
    await renderDetail();

    fireEvent.change(statusSelect(), { target: { value: 'Waiting for Requester' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update status' }));

    const alert = await screen.findByText('That status change is no longer allowed. The ticket may have changed — reloaded.');
    expect(alert.closest('[role="alert"]')).not.toBeNull();
    await waitFor(() => expect(counters.detailGet).toBeGreaterThanOrEqual(2));
    // Selection cleared by the reload, and no PATCH was re-sent automatically.
    await waitFor(() => expect(statusSelect().value).toBe(''));
    expect(counters.statusPatch).toBe(1);
  });

  it('UI-14: VERSION_CONFLICT shows the message and reloads without re-sending', async () => {
    const { counters } = makeFetch({
      ticket: makeTicket('Open', ['In Progress', 'Cancelled']),
      onStatusPatch: () => ({
        status: 409,
        body: { error: { code: 'VERSION_CONFLICT', message: 'Ticket was updated by someone else.', details: { currentVersion: 4 } } }
      })
    });
    await renderDetail();

    fireEvent.change(statusSelect(), { target: { value: 'In Progress' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update status' }));

    const alert = await screen.findByText('This ticket was updated by someone else. Reloaded the latest version.');
    expect(alert.closest('[role="alert"]')).not.toBeNull();
    await waitFor(() => expect(counters.detailGet).toBeGreaterThanOrEqual(2));
    await waitFor(() => expect(statusSelect().value).toBe(''));
    expect(counters.statusPatch).toBe(1);
  });

  it('UI-14: a repeat click without reload sends the same expectedVersion again', async () => {
    const { statusBodies } = makeFetch({
      ticket: makeTicket('In Progress', ['Waiting for Requester', 'Resolved', 'Cancelled']),
      summary: { total: 1, openFollowUps: 0 },
      onStatusPatch: () => ({
        status: 409,
        body: {
          error: {
            code: 'RESOLUTION_BLOCKED',
            message: 'Resolve needs at least one Action Taken.',
            details: { reason: 'NO_ACTIONS_TAKEN', openFollowUps: 0 }
          }
        }
      })
    });
    await renderDetail();

    fireEvent.change(statusSelect(), { target: { value: 'Resolved' } });
    const updateButton = screen.getByRole('button', { name: 'Update status' });
    await waitFor(() => expect(updateButton).toBeEnabled());
    fireEvent.click(updateButton);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /mark as resolved/i }));
    await screen.findByText('Record at least one action before resolving.');

    fireEvent.click(updateButton);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /mark as resolved/i }));
    await waitFor(() => expect(statusBodies).toHaveLength(2));
    expect(statusBodies[0].expectedVersion).toBe(3);
    expect(statusBodies[1].expectedVersion).toBe(3);
  });

  it('UI-15: a successful change refreshes the badge and controls and announces the new status', async () => {
    const updatedTicket = makeTicket('Waiting for Requester', ['In Progress', 'Resolved', 'Cancelled'], { version: 4 });
    makeFetch({
      ticket: makeTicket('In Progress', ['Waiting for Requester', 'Resolved', 'Cancelled']),
      onStatusPatch: () => ({ status: 200, body: { ticket: updatedTicket } })
    });
    await renderDetail();

    fireEvent.change(statusSelect(), { target: { value: 'Waiting for Requester' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update status' }));

    const announcement = await screen.findByText('Status changed to Waiting for Requester.');
    expect(announcement).toHaveAttribute('role', 'status');

    await waitFor(() => {
      expect(document.querySelector('.status-badge')?.textContent).toBe('Waiting for Requester');
    });
    const options = Array.from(statusSelect().options).map((option) => option.value);
    expect(options).toEqual(['In Progress', 'Resolved', 'Cancelled']);
  });

  it('UI-16: the confirmation dialog is labelled, traps focus, closes on Esc and returns focus', async () => {
    makeFetch({
      ticket: makeTicket('Resolved', ['Closed', 'Reopened']),
      summary: { total: 1, openFollowUps: 0 }
    });
    await renderDetail();

    fireEvent.change(statusSelect(), { target: { value: 'Closed' } });
    const updateButton = screen.getByRole('button', { name: 'Update status' });
    fireEvent.click(updateButton);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy as string)?.textContent).toBe('Change status from Resolved to Closed?');
    expect(dialog.contains(document.activeElement)).toBe(true);

    const cancelButton = within(dialog).getByRole('button', { name: 'Cancel' });
    const confirmButton = within(dialog).getByRole('button', { name: /close ticket/i });
    cancelButton.focus();
    fireEvent.keyDown(cancelButton, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(confirmButton);

    confirmButton.focus();
    fireEvent.keyDown(confirmButton, { key: 'Tab' });
    expect(document.activeElement).toBe(cancelButton);
    expect(dialog.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Update status' })));
  });

  it('UI-17: the "Requester reports resolved" badge is shown with an icon and does not affect the controls', async () => {
    makeFetch({
      ticket: makeTicket('Resolved', ['Closed', 'Reopened'], { requesterMarkedResolved: true })
    });
    await renderDetail();

    const badge = screen.getByText(/Requester reports resolved/);
    expect(badge).toBeInTheDocument();
    expect(badge.querySelector('[aria-hidden="true"]')).not.toBeNull();

    // Status control still lists exactly allowedTransitions.
    expect(Array.from(statusSelect().options).map((option) => option.value)).toEqual(['Closed', 'Reopened']);
  });

  it('UI-17: requesterMarkedResolved=false does not show the requester-resolved badge', async () => {
    makeFetch({
      ticket: makeTicket('Resolved', ['Closed', 'Reopened'], { requesterMarkedResolved: false })
    });
    await renderDetail();

    expect(screen.queryByText(/Requester reports resolved/)).toBeNull();
  });

  it('UI-14: owner VERSION_CONFLICT reloads without retry and clears reassignment selection', async () => {
    const { counters, ownerBodies } = makeFetch({
      ticket: makeTicket('In Progress', ['Waiting for Requester']),
      assignableOwners: [{ id: 3, name: 'Carol IT Staff' }],
      onOwnerPatch: () => ({
        status: 409,
        body: { error: { code: 'VERSION_CONFLICT', message: 'Ticket was updated by someone else.' } }
      })
    });
    await renderDetail();

    fireEvent.click(screen.getByRole('button', { name: 'Reassign' }));
    const ownerSelect = await screen.findByRole('combobox', { name: 'Select new owner' });
    fireEvent.change(ownerSelect, { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByText('This ticket was updated by someone else. Reloaded the latest version.');
    await waitFor(() => expect(counters.detailGet).toBeGreaterThanOrEqual(2));
    expect(ownerBodies).toHaveLength(1);
    expect((screen.getByRole('combobox', { name: 'Select new owner' }) as HTMLSelectElement).value).toBe('');
  });

  it('UI-14: priority VERSION_CONFLICT reloads without automatic retry', async () => {
    const { counters, priorityBodies } = makeFetch({
      ticket: makeTicket('In Progress', ['Waiting for Requester']),
      onPriorityPatch: () => ({
        status: 409,
        body: { error: { code: 'VERSION_CONFLICT', message: 'Ticket was updated by someone else.' } }
      })
    });
    await renderDetail();

    fireEvent.change(screen.getByLabelText('IT Priority'), { target: { value: 'Urgent' } });
    await screen.findByText('This ticket was updated by someone else. Reloaded the latest version.');
    await waitFor(() => expect(counters.detailGet).toBeGreaterThanOrEqual(2));
    expect(priorityBodies).toHaveLength(1);
  });

  it('BR-21/F4: status, owner and priority PATCHes carry expectedVersion from the loaded ticket', async () => {
    const { fetchMock, ownerBodies, priorityBodies, statusBodies } = makeFetch({
      ticket: makeTicket('In Progress', ['Waiting for Requester', 'Resolved', 'Cancelled'])
    });
    await renderDetail();

    fireEvent.click(screen.getByRole('button', { name: /^claim$/i }));
    await waitFor(() => expect(ownerBodies).toHaveLength(1));
    expect(ownerBodies[0].expectedVersion).toBe(3);

    fireEvent.change(screen.getByLabelText('IT Priority'), { target: { value: 'Urgent' } });
    await waitFor(() => expect(priorityBodies).toHaveLength(1));
    expect(priorityBodies[0].expectedVersion).toBe(3);

    fireEvent.change(statusSelect(), { target: { value: 'Waiting for Requester' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update status' }));
    await waitFor(() => expect(statusBodies).toHaveLength(1));
    expect(statusBodies[0].expectedVersion).toBe(3);
    expect(fetchMock).toHaveBeenCalled();
  });

  it('GUARD-01: a missing allowedTransitions field shows an unavailable message with a reload action, not the empty-state text', async () => {
    const ticketMissingTransitions: Record<string, unknown> = { ...BASE_TICKET };
    delete ticketMissingTransitions.allowedTransitions;
    const { counters } = makeFetch({ ticket: ticketMissingTransitions });
    await renderDetail();

    // Missing (undefined) must be distinguished from a present-but-empty array.
    expect(screen.getByText('Status options are unavailable. Please reload.')).toBeInTheDocument();
    expect(screen.queryByText('No further status changes are possible.')).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Change status' })).toBeNull();

    ticketMissingTransitions.allowedTransitions = ['In Progress', 'Cancelled'];
    fireEvent.click(screen.getByRole('button', { name: /reload/i }));
    await waitFor(() => expect(counters.detailGet).toBeGreaterThanOrEqual(2));
    expect(screen.queryByText('Status options are unavailable. Please reload.')).toBeNull();
    expect(screen.queryByText('No further status changes are possible.')).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Change status' })).toBeInTheDocument();
    expect(
      Array.from((screen.getByRole('combobox', { name: 'Change status' }) as HTMLSelectElement).options)
        .map((option) => option.value)
    ).toEqual(['In Progress', 'Cancelled']);
  });

  it('BR-21/F4 (sequence): owner → priority → status PATCHes chain the version returned by each prior response', async () => {
    const fixture = makeTicket('In Progress', ['Waiting for Requester', 'Resolved', 'Cancelled']);
    const ownerResponse = { ...fixture, ownerId: 2, owner: { id: 2, name: 'Bob IT Staff' }, version: 4 };
    const priorityResponse = { ...fixture, ownerId: 2, owner: { id: 2, name: 'Bob IT Staff' }, itPriority: 'Urgent', version: 5 };
    const statusResponse = {
      ...fixture,
      status: 'Waiting for Requester',
      version: 6,
      allowedTransitions: ['In Progress', 'Resolved', 'Cancelled']
    };
    const { ownerBodies, priorityBodies, statusBodies } = makeFetch({
      ticket: fixture,
      onOwnerPatch: () => ({ status: 200, body: { ticket: ownerResponse } }),
      onPriorityPatch: () => ({ status: 200, body: { ticket: priorityResponse } }),
      onStatusPatch: () => ({ status: 200, body: { ticket: statusResponse } })
    });
    await renderDetail();

    // Loaded ticket is version 3 (BASE_TICKET).
    // 1) Owner change sends the loaded version and applies the response version 4.
    fireEvent.click(screen.getByRole('button', { name: /^claim$/i }));
    await waitFor(() => expect(ownerBodies[0]).toEqual({ ownerId: 2, expectedVersion: 3 }));
    await waitFor(() => expect(screen.queryByRole('button', { name: /^claim$/i })).toBeNull());

    // 2) Priority change must now send version 4 from the owner response, not 3.
    fireEvent.change(screen.getByLabelText('IT Priority'), { target: { value: 'Urgent' } });
    await waitFor(() => expect(priorityBodies[0]).toEqual({ itPriority: 'Urgent', expectedVersion: 4 }));
    await waitFor(() => expect((screen.getByLabelText('IT Priority') as HTMLSelectElement).value).toBe('Urgent'));

    // 3) Status change must send version 5 from the priority response, not 3 or 4.
    fireEvent.change(statusSelect(), { target: { value: 'Waiting for Requester' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update status' }));
    await waitFor(() => expect(statusBodies[0]).toEqual({ status: 'Waiting for Requester', expectedVersion: 5 }));

    // The applied responses also refresh the controls from the server state.
    await waitFor(() => {
      expect(document.querySelector('.status-badge')?.textContent).toBe('Waiting for Requester');
    });
    expect(Array.from(statusSelect().options).map((option) => option.value)).toEqual([
      'In Progress',
      'Resolved',
      'Cancelled'
    ]);
  });

  it('GUARD-02: Reload recovery — a ticket that gains allowedTransitions renders the select with exactly the API options', async () => {
    const recoverable: Record<string, unknown> = { ...BASE_TICKET };
    delete recoverable.allowedTransitions;
    const { counters } = makeFetch({ ticket: recoverable });
    await renderDetail();

    // Start in the missing-field failure state.
    expect(screen.getByText('Status options are unavailable. Please reload.')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Change status' })).toBeNull();

    // The next API response includes the field (simulated on the same fixture object).
    recoverable.allowedTransitions = ['In Progress', 'Cancelled'];
    fireEvent.click(screen.getByRole('button', { name: /reload/i }));

    const recoveredSelect = await screen.findByRole('combobox', { name: 'Change status' });
    await waitFor(() => expect(counters.detailGet).toBeGreaterThanOrEqual(2));
    expect(screen.queryByText('Status options are unavailable. Please reload.')).toBeNull();
    expect(screen.queryByText('No further status changes are possible.')).toBeNull();
    expect(
      Array.from((recoveredSelect as HTMLSelectElement).options).map((option) => option.value)
    ).toEqual(['In Progress', 'Cancelled']);
  });
});

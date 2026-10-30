/**
 * Lab 4 Issue 3 — Actions Taken area only
 * STY-01: follow-up state always carries a text label (and glyph), never colour alone
 * STY-02: shared-content marker "Visible to Requester" present with an aria-hidden icon
 * STY-03: form controls labelled; aria-invalid and aria-describedby on errors
 * STY-04: rendering the new screens produces no console.error / console.warn calls
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ActionsTakenPanel } from '../../lab-04/ActionsTakenPanel';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

const actions = [
  {
    id: 21,
    ticketId: 101,
    actionAt: '2026-10-21T08:45:00.000Z',
    description: 'Remapped the Finance share on the user laptop.',
    result: 'Drive reachable after remap.',
    performedBy: { id: 8, name: 'Noah Lim' },
    followUpRequired: true,
    followUpNote: 'Confirm with the user after restart tomorrow.',
    followUpCompletedAt: null,
    attachmentNotes: null,
    version: 1,
    updatedBy: { id: 8, name: 'Noah Lim' },
    createdAt: '2026-10-21T08:50:00.000Z',
    updatedAt: '2026-10-21T08:50:00.000Z'
  },
  {
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
    version: 1,
    updatedBy: { id: 8, name: 'Noah Lim' },
    createdAt: '2026-10-20T03:05:00.000Z',
    updatedAt: '2026-10-20T03:05:00.000Z'
  },
  {
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
  }
];

function listBody() {
  return { actionsTaken: actions, summary: { total: 3, openFollowUps: 1 } };
}

function stubListFetch() {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    if (url.includes('/actions-taken')) return Promise.resolve(jsonResponse(listBody()));
    return Promise.resolve(jsonResponse({}));
  }));
}

function renderStaff() {
  return render(
    <ActionsTakenPanel
      ticketId={101}
      ticketStatus="In Progress"
      ticketCreatedAt="2026-10-01T09:00:00.000Z"
      viewer="staff"
      currentUserName="Bob IT Staff"
    />
  );
}

beforeEach(() => {
  stubListFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('STY-01: follow-up cues carry text, not colour alone', () => {
  it('STY-01: shows Not required, ⚠ Follow-up open with note, and ✔ Follow-up done as text', async () => {
    renderStaff();

    const table = await screen.findByRole('table');
    await within(table).findByText('Remapped the Finance share on the user laptop.');

    expect(within(table).getAllByText('Not required').length).toBe(1);
    expect(within(table).getAllByText(/Follow-up open/).length).toBe(1);
    expect(within(table).getAllByText(/Confirm with the user after restart tomorrow\./).length).toBe(1);
    expect(within(table).getAllByText('✔ Follow-up done').length).toBe(1);

    // The glyphs sit next to the words (not as the only carrier of meaning)
    const openCue = within(table).getByText(/Follow-up open/);
    expect(openCue.textContent).toContain('⚠');
    const doneCue = within(table).getByText('✔ Follow-up done');
    expect(doneCue.textContent).toContain('✔');
  });
});

describe('STY-02: shared-content marker', () => {
  it('STY-02: Actions Taken area is labelled "Visible to Requester" with an aria-hidden icon', async () => {
    renderStaff();

    const label = (await screen.findAllByText('Visible to Requester'))[0];
    expect(label).toBeTruthy();
    const icon = label.parentElement?.querySelector('[aria-hidden="true"]') ?? label.querySelector('[aria-hidden="true"]');
    expect(icon).toBeTruthy();
  });
});

describe('STY-03: form control accessibility', () => {
  it('STY-03: every control has a visible label; errors set aria-invalid and aria-describedby', async () => {
    renderStaff();

    fireEvent.click(screen.getByRole('button', { name: 'Add Action' }));
    await screen.findByLabelText(/^action time/i);

    // Visible labels on every control
    expect(screen.getByLabelText(/^action time/i)).toBeTruthy();
    expect(screen.getByLabelText(/^description/i)).toBeTruthy();
    expect(screen.getByLabelText(/^result/i)).toBeTruthy();
    expect(screen.getByLabelText(/follow-up required/i)).toBeTruthy();
    expect(screen.getByLabelText(/attachment notes/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const description = screen.getByLabelText(/^description/i);
    expect(description).toHaveAttribute('aria-invalid', 'true');
    const describedBy = description.getAttribute('aria-describedby') ?? '';
    expect(describedBy.length).toBeGreaterThan(0);
    const message = describedBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ');
    expect(message).toContain('Enter a description of 5–2000 characters.');

    const result = screen.getByLabelText(/^result/i);
    expect(result).toHaveAttribute('aria-invalid', 'true');
    expect(result.getAttribute('aria-describedby')).toBeTruthy();
  });
});

describe('STY-04: no console noise on the new screens', () => {
  it('STY-04: staff list + create form + requester view render without console.error/warn', async () => {
    const errorSpy = vi.spyOn(console, 'error');
    const warnSpy = vi.spyOn(console, 'warn');

    const { unmount } = renderStaff();
    {
      const table = await screen.findByRole('table');
      await within(table).findByText('Remapped the Finance share on the user laptop.');
    }

    fireEvent.click(screen.getByRole('button', { name: 'Add Action' }));
    await screen.findByLabelText(/^action time/i);
    fireEvent.change(screen.getByLabelText(/^description/i), { target: { value: 'Valid description text for the counter.' } });
    unmount();

    render(
      <ActionsTakenPanel
        ticketId={101}
        ticketStatus="In Progress"
        ticketCreatedAt="2026-10-01T09:00:00.000Z"
        viewer="requester"
      />
    );
    const requesterTable = await screen.findByRole('table');
    await within(requesterTable).findByText('Remapped the Finance share on the user laptop.');

    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

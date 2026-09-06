import { describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CreateTicket } from './CreateTicket';

const formOptions = {
  categories: [{ id: 1, name: 'Hardware' }],
  relatedSystems: [{ id: 1, name: 'File Services' }]
};

function renderForm(fetchMock = vi.fn()) {
  vi.stubGlobal('fetch', fetchMock);
  return render(<CreateTicket requesterId="1" {...formOptions} />);
}

function fillValidForm() {
  fireEvent.change(screen.getByLabelText(/summary/i), { target: { value: 'Cannot access shared drive' } });
  fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'The Finance shared drive has been unavailable since this morning.' } });
  fireEvent.change(screen.getByLabelText(/category/i), { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText(/related system/i), { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText(/requested priority/i), { target: { value: 'High' } });
}

describe('Issue 3 Create Ticket screen', () => {
  it('UI-02 shows required validation and focuses the first invalid field', () => {
    renderForm();

    fireEvent.click(screen.getByRole('button', { name: /create ticket/i }));

    expect(screen.getByText(/summary must be between 5 and 100/i)).toBeTruthy();
    expect(screen.getByLabelText(/summary/i)).toHaveFocus();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('UI-03 presents attachment rules and blocks invalid files', () => {
    renderForm();
    const input = screen.getByLabelText(/attachments/i) as HTMLInputElement;

    expect(screen.getByText(/JPG, JPEG, PNG, WEBP, or PDF/i)).toBeTruthy();
    expect(screen.getByText(/5 MB/i)).toBeTruthy();

    fireEvent.change(input, {
      target: { files: [new File(['invalid'], 'malware.exe', { type: 'application/octet-stream' })] }
    });

    expect(screen.getByText(/unsupported file type/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /create ticket/i })).toBeDisabled();
  });

  it('UI-04 enters busy state, reports success, and preserves fields on API failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ticket: { ticketNumber: 'TICK-20260904-0001', status: 'New' }
    }), { status: 201, headers: { 'Content-Type': 'application/json' } }));
    renderForm(fetchMock);
    fillValidForm();

    fireEvent.click(screen.getByRole('button', { name: /create ticket/i }));
    expect(screen.getByRole('button', { name: /creating ticket/i })).toBeDisabled();

    await waitFor(() => expect(screen.getByText(/TICK-20260904-0001/i)).toBeTruthy());
    expect(screen.getByText(/^New$/)).toBeTruthy();

    const failingFetch = vi.fn().mockRejectedValue(new Error('offline'));
    cleanup();
    renderForm(failingFetch);
    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: /create ticket/i }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/unable to create ticket/i));
    expect(screen.getByLabelText(/summary/i)).toHaveValue('Cannot access shared drive');
    expect(screen.getByLabelText(/description/i)).toHaveValue('The Finance shared drive has been unavailable since this morning.');
  });
});
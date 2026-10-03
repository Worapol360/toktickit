import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { RequesterTicketDetail } from '../RequesterTicketDetail';

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const ticket = {
  id: 11,
  ticketNumber: 'TICK-20260905-0011',
  summary: 'Cannot access shared drive',
  description: 'The Finance shared drive has been unavailable since this morning.',
  requestedPriority: 'High',
  status: 'New',
  category: { id: 2, code: 'HARDWARE', name: 'Hardware', isActive: true },
  relatedSystem: { id: 1, code: 'FILE_SERVICES', name: 'File Services', isActive: true },
  attachments: [],
  createdAt: '2026-09-05T12:00:00.000Z',
  updatedAt: '2026-09-05T12:00:00.000Z'
};

describe('Issue 5 requester ticket detail', () => {
  it('UI-07 renders read-only ticket fields and attachment region', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/comments')) {
        return Promise.resolve(response({ comments: [] }));
      }
      return Promise.resolve(response({ ticket }));
    }));
    render(<RequesterTicketDetail requesterId="1" ticketId={11} onBack={vi.fn()} />);

    expect(await screen.findByText('TICK-20260905-0011')).toBeTruthy();
    expect(screen.getByText('Cannot access shared drive')).toBeTruthy();
    expect(screen.getByText('New')).toBeTruthy();
    expect(screen.getByRole('heading', { name: /attachments/i })).toBeTruthy();
  });

  it('UI-07 shows a safe not-found state with a back action', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(response({ error: { code: 'TICKET_NOT_FOUND' } }, 404))));
    render(<RequesterTicketDetail requesterId="1" ticketId={99} onBack={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Ticket not found')).toBeTruthy());
    expect(screen.getByRole('button', { name: /back to my tickets/i })).toBeTruthy();
  });

  it('UI-08: renders public comments and "Problem Appears Resolved" action with no status/priority edit controls', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/tickets/11/comments')) {
        return Promise.resolve(response({
          comments: [
            {
              id: 1,
              ticketId: 11,
              authorId: 1,
              content: 'Comment from requester',
              createdAt: '2026-09-05T12:10:00.000Z',
              author: { id: 1, name: 'Requester User', role: 'REQUESTER' }
            }
          ]
        }));
      }
      if (url.includes('/api/tickets/11')) {
        return Promise.resolve(response({ ticket: { ...ticket, requesterMarkedResolved: false } }));
      }
      return Promise.resolve(response({}));
    }));

    render(<RequesterTicketDetail requesterId="1" ticketId={11} onBack={vi.fn()} />);

    expect(await screen.findByText('TICK-20260905-0011')).toBeTruthy();

    // Check "Problem Appears Resolved" button exists
    const resolveBtn = screen.getByRole('button', { name: /problem appears resolved/i });
    expect(resolveBtn).toBeTruthy();

    // Ensure NO status or priority select / dropdown exists
    expect(screen.queryByLabelText(/it priority/i)).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();

    // Check Public Comments heading and comment content
    expect(screen.getByRole('heading', { name: /public comments/i })).toBeTruthy();
    expect(screen.getByText('Comment from requester')).toBeTruthy();
  });

  it('UI-08: clicking "Problem Appears Resolved" calls mark-resolved and shows confirmation badge', async () => {
    const { fireEvent } = await import('@testing-library/react');

    const fetchMock = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/api/tickets/11/mark-resolved') && opts?.method === 'POST') {
        return Promise.resolve(response({ ticket: { ...ticket, requesterMarkedResolved: true } }));
      }
      if (url.includes('/api/tickets/11/comments')) {
        return Promise.resolve(response({ comments: [] }));
      }
      if (url.includes('/api/tickets/11')) {
        return Promise.resolve(response({ ticket: { ...ticket, requesterMarkedResolved: false } }));
      }
      return Promise.resolve(response({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<RequesterTicketDetail requesterId="1" ticketId={11} onBack={vi.fn()} />);

    const resolveBtn = await screen.findByRole('button', { name: /problem appears resolved/i });
    fireEvent.click(resolveBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/tickets/11/mark-resolved',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'X-Requested-With': 'XMLHttpRequest' })
        })
      );
    });

    // Confirmation badge should appear
    expect(await screen.findByText(/you marked this as appearing resolved/i)).toBeTruthy();
  });

  it('UI-08: hides "Problem Appears Resolved" button when ticket status is Closed or Cancelled', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/tickets/11/comments')) {
        return Promise.resolve(response({ comments: [] }));
      }
      if (url.includes('/api/tickets/11')) {
        return Promise.resolve(response({ ticket: { ...ticket, status: 'Closed' } }));
      }
      return Promise.resolve(response({}));
    }));

    render(<RequesterTicketDetail requesterId="1" ticketId={11} onBack={vi.fn()} />);

    expect(await screen.findByText('TICK-20260905-0011')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /problem appears resolved/i })).toBeNull();
  });
});
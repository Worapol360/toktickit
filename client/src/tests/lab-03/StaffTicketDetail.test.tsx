import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { StaffTicketDetail } from '../../pages/StaffTicketDetail';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

const mockTicket = {
  id: 101,
  ticketNumber: 'TICK-20260905-0101',
  summary: 'VPN disconnects every 15 minutes',
  description: 'The corporate VPN drops connection frequently during work hours.',
  requestedPriority: 'High',
  itPriority: 'High',
  status: 'Open',
  requesterMarkedResolved: false,
  requesterId: 1,
  requester: { id: 1, name: 'Alice Requester', email: 'alice@example.com', department: 'Sales' },
  ownerId: null,
  owner: null,
  categoryId: 2,
  category: { id: 2, code: 'NETWORK', name: 'Network', isActive: true },
  relatedSystemId: 1,
  relatedSystem: { id: 1, code: 'VPN', name: 'VPN Service', isActive: true },
  attachments: [],
  createdAt: '2026-09-05T12:00:00.000Z',
  updatedAt: '2026-09-05T12:00:00.000Z'
};

const mockComments = [
  {
    id: 1,
    ticketId: 101,
    authorId: 1,
    content: 'Initial public comment from requester',
    createdAt: '2026-09-05T12:30:00.000Z',
    author: { id: 1, name: 'Alice Requester', role: 'REQUESTER' }
  }
];

const mockNotes = [
  {
    id: 1,
    ticketId: 101,
    authorId: 2,
    content: 'Initial internal note about firewall logs',
    createdAt: '2026-09-05T12:45:00.000Z',
    author: { id: 2, name: 'Bob IT Staff', role: 'IT_STAFF' }
  }
];

describe('StaffTicketDetail Component (UI-04, UI-05, STYLE-02)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('UI-04: renders ticket details, unassigned ownership pill, claim action, and priority/status controls', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/staff/tickets/101')) {
        return Promise.resolve(jsonResponse({
          ticket: mockTicket,
          comments: mockComments,
          notes: mockNotes
        }));
      }
      return Promise.resolve(jsonResponse({}));
    }));

    render(<StaffTicketDetail ticketId={101} currentUserId={2} onBack={vi.fn()} />);

    expect(await screen.findByText('TICK-20260905-0101')).toBeTruthy();
    expect(screen.getByText('VPN disconnects every 15 minutes')).toBeTruthy();

    // Ownership: Unassigned pill and Claim button
    expect(screen.getByText('Unassigned')).toBeTruthy();
    expect(screen.getByRole('button', { name: /claim/i })).toBeTruthy();

    // IT Priority editable select
    const prioritySelect = screen.getByLabelText(/it priority/i) as HTMLSelectElement;
    expect(prioritySelect).toBeTruthy();
    expect(prioritySelect.value).toBe('High');

    // Status select showing disabled options with reasons
    const statusSelect = screen.getByLabelText(/status/i) as HTMLSelectElement;
    expect(statusSelect).toBeTruthy();
    expect(statusSelect.value).toBe('Open');

    // From Open, permitted is In Progress and Cancelled. New, Resolved, Closed should be disabled.
    const options = Array.from(statusSelect.options);
    const newOption = options.find((o) => o.value === 'New');
    const inProgressOption = options.find((o) => o.value === 'In Progress');
    const closedOption = options.find((o) => o.value === 'Closed');

    expect(newOption?.disabled).toBe(true);
    expect(inProgressOption?.disabled).toBe(false);
    expect(closedOption?.disabled).toBe(true);
  });

  it('UI-04: allows claiming a ticket and updating priority and status', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/api/staff/tickets/101/owner') && opts?.method === 'PATCH') {
        return Promise.resolve(jsonResponse({
          ticket: { ...mockTicket, ownerId: 2, owner: { id: 2, name: 'Bob IT Staff' } }
        }));
      }
      if (url.includes('/api/staff/tickets/101/priority') && opts?.method === 'PATCH') {
        return Promise.resolve(jsonResponse({
          ticket: { ...mockTicket, itPriority: 'Urgent' }
        }));
      }
      if (url.includes('/api/staff/tickets/101/status') && opts?.method === 'PATCH') {
        return Promise.resolve(jsonResponse({
          ticket: { ...mockTicket, status: 'In Progress' }
        }));
      }
      if (url.includes('/api/staff/tickets/101')) {
        return Promise.resolve(jsonResponse({
          ticket: mockTicket,
          comments: mockComments,
          notes: mockNotes
        }));
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<StaffTicketDetail ticketId={101} currentUserId={2} onBack={vi.fn()} />);

    expect(await screen.findByText('TICK-20260905-0101')).toBeTruthy();

    // 1. Claim ticket
    const claimButton = screen.getByRole('button', { name: /claim/i });
    fireEvent.click(claimButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/staff/tickets/101/owner',
        expect.objectContaining({
          method: 'PATCH',
          headers: expect.objectContaining({ 'X-Requested-With': 'XMLHttpRequest' }),
          body: JSON.stringify({ ownerId: 2 })
        })
      );
    });

    // 2. Change IT Priority
    const prioritySelect = screen.getByLabelText(/it priority/i);
    fireEvent.change(prioritySelect, { target: { value: 'Urgent' } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/staff/tickets/101/priority',
        expect.objectContaining({
          method: 'PATCH',
          headers: expect.objectContaining({ 'X-Requested-With': 'XMLHttpRequest' }),
          body: JSON.stringify({ itPriority: 'Urgent' })
        })
      );
    });

    // 3. Change Status to In Progress
    const statusSelect = screen.getByLabelText(/status/i);
    fireEvent.change(statusSelect, { target: { value: 'In Progress' } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/staff/tickets/101/status',
        expect.objectContaining({
          method: 'PATCH',
          headers: expect.objectContaining({ 'X-Requested-With': 'XMLHttpRequest' }),
          body: JSON.stringify({ status: 'In Progress' })
        })
      );
    });
  });

  it('UI-05 & STYLE-02: renders separate Public Comments and Internal Notes containers with warning tint and lock icon', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/staff/tickets/101')) {
        return Promise.resolve(jsonResponse({
          ticket: mockTicket,
          comments: mockComments,
          notes: mockNotes
        }));
      }
      return Promise.resolve(jsonResponse({}));
    }));

    render(<StaffTicketDetail ticketId={101} currentUserId={2} onBack={vi.fn()} />);

    expect(await screen.findByText('TICK-20260905-0101')).toBeTruthy();

    // Public comments section
    const publicHeading = screen.getByRole('heading', { name: /public comments/i });
    expect(publicHeading).toBeTruthy();
    expect(screen.getByText('Initial public comment from requester')).toBeTruthy();

    // Internal notes section - distinct header, lock icon with accessible name
    const notesHeading = screen.getByRole('heading', { name: /internal notes/i });
    expect(notesHeading).toBeTruthy();
    expect(screen.getByText('Initial internal note about firewall logs')).toBeTruthy();

    const lockIcon = screen.getByLabelText(/internal — staff only/i);
    expect(lockIcon).toBeTruthy();

    // Check separate composers exist
    expect(screen.getByPlaceholderText(/add a public comment/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/add an internal note/i)).toBeTruthy();
  });

  it('UI-05: posting a public comment does not post an internal note, and vice versa', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/api/tickets/101/comments') && opts?.method === 'POST') {
        return Promise.resolve(jsonResponse({
          comment: {
            id: 2,
            ticketId: 101,
            authorId: 2,
            content: 'New public staff update',
            createdAt: '2026-09-05T13:00:00.000Z',
            author: { id: 2, name: 'Bob IT Staff', role: 'IT_STAFF' }
          }
        }, 201));
      }
      if (url.includes('/api/staff/tickets/101/notes') && opts?.method === 'POST') {
        return Promise.resolve(jsonResponse({
          note: {
            id: 2,
            ticketId: 101,
            authorId: 2,
            content: 'New private staff note',
            createdAt: '2026-09-05T13:05:00.000Z',
            author: { id: 2, name: 'Bob IT Staff', role: 'IT_STAFF' }
          }
        }, 201));
      }
      if (url.includes('/api/staff/tickets/101')) {
        return Promise.resolve(jsonResponse({
          ticket: mockTicket,
          comments: mockComments,
          notes: mockNotes
        }));
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<StaffTicketDetail ticketId={101} currentUserId={2} onBack={vi.fn()} />);

    expect(await screen.findByText('TICK-20260905-0101')).toBeTruthy();

    // Post public comment
    const commentInput = screen.getByPlaceholderText(/add a public comment/i);
    const postCommentBtn = screen.getByRole('button', { name: /post comment/i });

    fireEvent.change(commentInput, { target: { value: 'New public staff update' } });
    fireEvent.click(postCommentBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/tickets/101/comments',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'X-Requested-With': 'XMLHttpRequest' }),
          body: JSON.stringify({ content: 'New public staff update' })
        })
      );
    });

    // Post internal note
    const noteInput = screen.getByPlaceholderText(/add an internal note/i);
    const addNoteBtn = screen.getByRole('button', { name: /add note|save note/i });

    fireEvent.change(noteInput, { target: { value: 'New private staff note' } });
    fireEvent.click(addNoteBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/staff/tickets/101/notes',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'X-Requested-With': 'XMLHttpRequest' }),
          body: JSON.stringify({ content: 'New private staff note' })
        })
      );
    });
  });
});

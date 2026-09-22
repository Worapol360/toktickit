/**
 * UI-03: Staff Queue controls and result states
 * STYLE-01: Role and ownership badge tokens
 * RESP-01: Desktop layout (>=992px)
 * RESP-02: Tablet layout (768-991px)
 * RESP-03: Mobile layout (<768px)
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StaffTicketQueue } from '../../pages/StaffTicketQueue';

const categories = [
  { id: 1, code: 'HARDWARE', name: 'Hardware', isActive: true },
];

const itStaff = [
  { id: 6, name: 'Noah Williams' },
  { id: 7, name: 'Priya Nair' },
];

function mockTicket(overrides = {}) {
  return {
    id: 101,
    ticketNumber: 'TICK-20260825-0001',
    summary: 'Cannot access shared drive',
    description: 'The Finance shared drive has been unavailable.',
    requestedPriority: 'High',
    itPriority: 'High',
    status: 'Open',
    requesterId: 1,
    owner: { id: 6, name: 'Noah Williams' },
    requesterMarkedResolved: false,
    category: categories[0],
    relatedSystem: { id: 1, name: 'File Services', code: 'FILE_SERVICES', isActive: true },
    attachments: [],
    createdAt: '2026-08-25T09:30:00.000Z',
    updatedAt: '2026-08-25T09:30:00.000Z',
    ...overrides,
  };
}

function paginationResponse(tickets: unknown[], total = tickets.length) {
  return {
    tickets,
    pagination: {
      page: 1,
      pageSize: 10,
      totalItems: total,
      totalPages: total === 0 ? 0 : Math.ceil(total / 10),
      hasNextPage: false,
      hasPreviousPage: false,
    },
    sort: { sortBy: 'createdAt', sortOrder: 'desc' },
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function setupFetch(tickets: unknown[] = [], status = 200) {
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (String(url).startsWith('/api/categories')) {
      return Promise.resolve(jsonResponse({ categories }));
    }
    if (String(url).startsWith('/api/staff/tickets')) {
      if (status === 403) {
        return Promise.resolve(jsonResponse({ error: { code: 'FORBIDDEN', message: 'Forbidden' } }, 403));
      }
      if (status === 500) {
        return Promise.resolve(jsonResponse({ error: { code: 'INTERNAL_ERROR', message: 'Server error' } }, 500));
      }
      return Promise.resolve(jsonResponse(paginationResponse(tickets), 200));
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

// ─── UI-03: Controls and result states ────────────────────────────────────────

describe('UI-03: StaffTicketQueue controls and states', () => {
  it('shows loading skeleton while fetching', async () => {
    let resolve!: (v: Response) => void;
    const pending = new Promise<Response>((r) => { resolve = r; });
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (String(url).startsWith('/api/categories')) return Promise.resolve(jsonResponse({ categories }));
      return pending;
    }));

    render(<StaffTicketQueue onOpenTicket={vi.fn()} />);
    expect(screen.getByRole('status')).toBeTruthy();

    // Resolve to avoid dangling
    resolve(jsonResponse(paginationResponse([])));
  });

  it('shows empty state when no tickets exist', async () => {
    setupFetch([]);
    render(<StaffTicketQueue onOpenTicket={vi.fn()} />);
    expect(await screen.findByText(/no tickets/i)).toBeTruthy();
  });

  it('shows no-results state with Clear Filters action when filters active', async () => {
    setupFetch([]);
    render(<StaffTicketQueue onOpenTicket={vi.fn()} />);

    const search = await screen.findByLabelText('Search tickets');
    fireEvent.change(search, { target: { value: 'nothing' } });
    fireEvent.submit(search.closest('form')!);

    await waitFor(() => expect(screen.getByText(/no matching/i)).toBeTruthy());
    expect(screen.getByRole('button', { name: /clear filters/i })).toBeTruthy();
  });

  it('shows forbidden state when API returns 403', async () => {
    setupFetch([], 403);
    render(<StaffTicketQueue onOpenTicket={vi.fn()} />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText(/forbidden|permission|access/i)).toBeTruthy();
  });

  it('shows failure state with Retry button on server error', async () => {
    setupFetch([], 500);
    render(<StaffTicketQueue onOpenTicket={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy();
  });

  it('renders search input and filter controls', async () => {
    setupFetch([]);
    render(<StaffTicketQueue onOpenTicket={vi.fn()} />);
    expect(await screen.findByLabelText('Search tickets')).toBeTruthy();
    expect(screen.getByLabelText(/status/i)).toBeTruthy();
    expect(screen.getByLabelText(/it priority/i)).toBeTruthy();
    expect(screen.getByLabelText(/owner/i)).toBeTruthy();
    expect(screen.getByLabelText(/category/i)).toBeTruthy();
  });

  it('Owner filter includes an "Unassigned" option', async () => {
    setupFetch([]);
    render(<StaffTicketQueue onOpenTicket={vi.fn()} />);
    await screen.findByLabelText('Search tickets');
    const ownerSelect = screen.getByLabelText(/owner/i);
    expect(ownerSelect.innerHTML).toContain('Unassigned');
  });

  it('Clear Filters button resets all filters', async () => {
    setupFetch([]);
    render(<StaffTicketQueue onOpenTicket={vi.fn()} />);

    const search = await screen.findByLabelText('Search tickets');
    fireEvent.change(search, { target: { value: 'test' } });
    fireEvent.submit(search.closest('form')!);

    await waitFor(() => screen.getByText(/no matching/i));
    fireEvent.click(screen.getByRole('button', { name: /clear filters/i }));
    expect(search).toHaveValue('');
  });

  it('renders ticket data in desktop table with required columns', async () => {
    setupFetch([mockTicket()]);
    render(<StaffTicketQueue onOpenTicket={vi.fn()} />);

    expect(await screen.findByRole('columnheader', { name: 'Ticket No.' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Created Date' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Summary' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Category' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Requested Priority' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'IT Priority' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Current Status' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Ticket Owner' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Last Updated' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Actions' })).toBeTruthy();

    expect(screen.getByText('TICK-20260825-0001')).toBeTruthy();
  });

  it('renders "Open" action stub per ticket', async () => {
    const onOpenTicket = vi.fn();
    setupFetch([mockTicket()]);
    render(<StaffTicketQueue onOpenTicket={onOpenTicket} />);

    await screen.findByText('TICK-20260825-0001');
    fireEvent.click(screen.getByRole('button', { name: /open/i }));
    expect(onOpenTicket).toHaveBeenCalledWith(101);
  });

  it('shows "Unassigned" badge when ticket has no owner', async () => {
    setupFetch([mockTicket({ owner: null })]);
    render(<StaffTicketQueue onOpenTicket={vi.fn()} />);

    await screen.findByText('TICK-20260825-0001');
    expect(screen.getAllByText('Unassigned').length).toBeGreaterThan(0);
  });

  it('shows pagination controls when multiple pages exist', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (String(url).startsWith('/api/categories')) return Promise.resolve(jsonResponse({ categories }));
      return Promise.resolve(jsonResponse({
        tickets: [mockTicket()],
        pagination: {
          page: 1, pageSize: 1, totalItems: 3, totalPages: 3,
          hasNextPage: true, hasPreviousPage: false,
        },
        sort: { sortBy: 'createdAt', sortOrder: 'desc' },
      }));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<StaffTicketQueue onOpenTicket={vi.fn()} />);
    await screen.findByText('TICK-20260825-0001');
    expect(screen.getByRole('navigation', { name: /pages/i })).toBeTruthy();
  });
});

// ─── STYLE-01: Role / ownership badge tokens ──────────────────────────────────

describe('STYLE-01: Badge styling tokens', () => {
  it('priority badge has priority-badge class', async () => {
    setupFetch([mockTicket()]);
    render(<StaffTicketQueue onOpenTicket={vi.fn()} />);
    await screen.findByText('TICK-20260825-0001');

    const badges = document.querySelectorAll('.priority-badge');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('status badge has status-badge class', async () => {
    setupFetch([mockTicket()]);
    render(<StaffTicketQueue onOpenTicket={vi.fn()} />);
    await screen.findByText('TICK-20260825-0001');

    const badges = document.querySelectorAll('.status-badge');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('Unassigned badge has ownership-badge class', async () => {
    setupFetch([mockTicket({ owner: null })]);
    render(<StaffTicketQueue onOpenTicket={vi.fn()} />);
    await screen.findByText('TICK-20260825-0001');

    const badges = document.querySelectorAll('.ownership-badge');
    expect(badges.length).toBeGreaterThan(0);
  });
});

// ─── RESP-01 / RESP-02 / RESP-03: Responsive layout ─────────────────────────

describe('RESP-01: Desktop layout (>=992px)', () => {
  it('table is present in the DOM (visible at desktop width)', async () => {
    setupFetch([mockTicket()]);
    render(<StaffTicketQueue onOpenTicket={vi.fn()} />);
    await screen.findByText('TICK-20260825-0001');
    expect(document.querySelector('.tickets-table')).toBeTruthy();
  });
});

describe('RESP-02: Tablet layout (768-991px)', () => {
  it('both table and card regions are present in DOM (CSS handles visibility)', async () => {
    setupFetch([mockTicket()]);
    render(<StaffTicketQueue onOpenTicket={vi.fn()} />);
    await screen.findByText('TICK-20260825-0001');
    // Both containers exist; CSS media queries control which is shown at tablet width.
    expect(document.querySelector('.tickets-table')).toBeTruthy();
    expect(document.querySelector('.ticket-cards')).toBeTruthy();
  });
});

describe('RESP-03: Mobile layout (<768px)', () => {
  it('card region is present in DOM with required fields', async () => {
    setupFetch([mockTicket()]);
    render(<StaffTicketQueue onOpenTicket={vi.fn()} />);
    await screen.findByText('TICK-20260825-0001');

    const cards = document.querySelectorAll('.ticket-card');
    expect(cards.length).toBeGreaterThan(0);

    // Each card must show ticket number, summary, status, itPriority, owner, dates
    const card = cards[0];
    expect(card.textContent).toContain('TICK-20260825-0001');
    expect(card.textContent).toContain('Cannot access shared drive');
    expect(card.textContent).toContain('Open');
    expect(card.textContent).toContain('High');
    expect(card.textContent).toContain('Noah Williams');
  });

  it('card has Open action', async () => {
    const onOpenTicket = vi.fn();
    setupFetch([mockTicket()]);
    render(<StaffTicketQueue onOpenTicket={onOpenTicket} />);
    await screen.findByText('TICK-20260825-0001');

    const cardOpen = screen.getAllByRole('button', { name: /open/i });
    expect(cardOpen.length).toBeGreaterThan(0);
  });
});

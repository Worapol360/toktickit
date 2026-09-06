import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MyTickets } from '../MyTickets';

const categories = [
  { id: 2, code: 'HARDWARE', name: 'Hardware', isActive: true }
];

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

describe('Issue 4 My Tickets screen', () => {
  it('UI-05 renders the empty state with a Create Ticket action', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/categories') {
        return Promise.resolve(response({ categories }));
      }

      if (url.startsWith('/api/tickets')) {
        return Promise.resolve(response({
          tickets: [],
          pagination: {
            page: 1,
            pageSize: 10,
            totalItems: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false
          },
          sort: {
            sortBy: 'createdAt',
            sortOrder: 'desc'
          }
        }));
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    render(
      <MyTickets
        requesterId="1"
        onCreateTicket={vi.fn()}
        onViewTicket={vi.fn()}
      />
    );

    expect(
      await screen.findByText('No tickets submitted yet')
    ).toBeTruthy();

    expect(
      screen.getByRole('button', { name: 'Create Ticket' })
    ).toBeTruthy();
  });

  it('UI-05 distinguishes no-results and clears active filters', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/categories') {
        return Promise.resolve(response({ categories }));
      }

      if (url.startsWith('/api/tickets')) {
        return Promise.resolve(response({
          tickets: [],
          pagination: {
            page: 1,
            pageSize: 10,
            totalItems: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false
          },
          sort: {
            sortBy: 'createdAt',
            sortOrder: 'desc'
          }
        }));
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    render(
      <MyTickets
        requesterId="1"
        onCreateTicket={vi.fn()}
        onViewTicket={vi.fn()}
      />
    );

    const search = await screen.findByLabelText('Search tickets');

    fireEvent.change(search, {
      target: { value: 'missing' }
    });

    fireEvent.submit(search.closest('form')!);

    await waitFor(() =>
      expect(
        screen.getByText('No matching tickets found')
      ).toBeTruthy()
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Clear Filters' })
    );

    expect(search).toHaveValue('');
  });

  it('UI-05 renders desktop ticket columns and links to detail without implementing detail content', async () => {
    const onViewTicket = vi.fn();

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/categories') {
        return Promise.resolve(response({ categories }));
      }

      if (url.startsWith('/api/tickets')) {
        return Promise.resolve(response({
          tickets: [
            {
              id: 11,
              ticketNumber: 'TICK-20260905-0011',
              summary: 'Cannot access shared drive',
              category: categories[0],
              requestedPriority: 'High',
              status: 'New',
              createdAt: '2026-09-05T12:00:00.000Z',
              updatedAt: '2026-09-05T12:00:00.000Z'
            }
          ],
          pagination: {
            page: 1,
            pageSize: 10,
            totalItems: 1,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false
          },
          sort: {
            sortBy: 'createdAt',
            sortOrder: 'desc'
          }
        }));
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    render(
      <MyTickets
        requesterId="1"
        onCreateTicket={vi.fn()}
        onViewTicket={onViewTicket}
      />
    );

    expect(
      await screen.findByRole('columnheader', { name: 'Ticket No.' })
    ).toBeTruthy();

    expect(
      screen.getByRole('columnheader', { name: 'Created Date' })
    ).toBeTruthy();

    expect(
      screen.getByRole('columnheader', { name: 'Summary' })
    ).toBeTruthy();

    expect(
      screen.getByRole('columnheader', { name: 'Category' })
    ).toBeTruthy();

    expect(
      screen.getByRole('columnheader', { name: 'Requested Priority' })
    ).toBeTruthy();

    expect(
      screen.getByRole('columnheader', { name: 'Current Status' })
    ).toBeTruthy();

    expect(
      screen.getByRole('columnheader', { name: 'Last Updated' })
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: 'View details' })
    );

    expect(onViewTicket).toHaveBeenCalledWith(11);
  });
});
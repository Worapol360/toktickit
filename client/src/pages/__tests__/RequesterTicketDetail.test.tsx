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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ticket })));
    render(<RequesterTicketDetail requesterId="1" ticketId={11} onBack={vi.fn()} />);

    expect(await screen.findByText('TICK-20260905-0011')).toBeTruthy();
    expect(screen.getByText('Cannot access shared drive')).toBeTruthy();
    expect(screen.getByText('New')).toBeTruthy();
    expect(screen.getByRole('heading', { name: /attachments/i })).toBeTruthy();
  });

  it('UI-07 shows a safe not-found state with a back action', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ error: { code: 'TICKET_NOT_FOUND' } }, 404)));
    render(<RequesterTicketDetail requesterId="1" ticketId={99} onBack={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Ticket not found')).toBeTruthy());
    expect(screen.getByRole('button', { name: /back to my tickets/i })).toBeTruthy();
  });
});
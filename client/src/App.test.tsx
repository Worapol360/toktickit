import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App shell', () => {
  beforeEach(() => {
    window.sessionStorage.setItem('toktickit-selected-requester-id', '1');
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('/api/requesters')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ requesters: [{ id: 1, name: 'Aiko Tanaka', email: 'a@x.com', department: 'IT', isActive: true }] }),
        } as Response);
      }
      if (url.includes('/api/tickets')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ tickets: [], total: 0, page: 1, totalPages: 0 }),
        } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ categories: [], relatedSystems: [] }) } as Response);
    }));
  });

  it('renders the shared header and My Tickets by default', async () => {
    render(<App />);
    expect(screen.getByText('TokTickIT')).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'My Tickets' })).toBeTruthy();
  });
});
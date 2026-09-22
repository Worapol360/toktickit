import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App shell', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('/api/auth/me')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ user: { id: 1, name: 'Aiko Tanaka', email: 'aiko@example.com', role: 'REQUESTER', mustChangePassword: false } }),
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
    expect(await screen.findByText('TokTickIT')).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'My Tickets' })).toBeTruthy();
  });
});
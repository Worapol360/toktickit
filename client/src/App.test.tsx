import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App';

const SESSION_KEY = 'toktickit-selected-requester-id';
const mockRequesters = [
  { id: 1, name: 'Aiko Tanaka', email: 'aiko@example.com', department: 'Finance', isActive: true },
  { id: 2, name: 'Daniel Kim', email: 'daniel@example.com', department: 'IT', isActive: true }
];

beforeEach(() => {
  window.sessionStorage.setItem(SESSION_KEY, '1');
});

afterEach(() => {
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe('TokTickIT category list', () => {
  it('loads and displays categories from the API in order', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      if (url.includes('/api/requesters')) {
        return new Response(JSON.stringify({ requesters: mockRequesters }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        categories: [
          { id: 2, name: 'Hardware' },
          { id: 5, name: 'Network' }
        ]
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }));

    render(<App />);

    expect(screen.getByRole('status').textContent).toContain('Loading categories...');

    expect(await screen.findByText('Hardware')).toBeTruthy();
    expect(screen.getByText('Network')).toBeTruthy();
    expect(screen.getByText('ID 2')).toBeTruthy();
    expect(screen.getByText('ID 5')).toBeTruthy();
  });

  it('shows an error state when the API request fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      if (url.includes('/api/requesters')) {
        return new Response(JSON.stringify({ requesters: mockRequesters }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      throw new Error('network error');
    }));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('System Status: Offline — Unable to connect to TokTickIT API');
    });
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TokTickIT category list', () => {
  it('loads and displays categories from the API in order', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        categories: [
          { id: 2, name: 'Hardware' },
          { id: 5, name: 'Network' }
        ]
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    ));

    render(<App />);

    expect(screen.getByRole('status').textContent).toContain('Loading categories...');

    expect(await screen.findByText('Hardware')).toBeTruthy();
    expect(screen.getByText('Network')).toBeTruthy();
    expect(screen.getByText('ID 2')).toBeTruthy();
    expect(screen.getByText('ID 5')).toBeTruthy();
  });

  it('shows an error state when the API request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('System Status: Offline — Unable to connect to TokTickIT API');
    });
  });
});

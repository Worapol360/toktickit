import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../App';

function installFetch(role: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR') {
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (url.includes('/api/auth/me')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ user: { id: 1, name: 'Test User', email: 'test@example.com', role, mustChangePassword: false } }) } as Response);
    if (url.includes('/api/dashboard/')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ generatedAt: new Date().toISOString(), windowDays: 7, metrics: role === 'REQUESTER' ? { openTickets: { label: 'My Open Tickets', value: 0, drilldown: null }, waitingForRequester: { label: 'Waiting for Me', value: 0, drilldown: null }, resolved: { label: 'Resolved', value: 0, drilldown: null } } : { unassigned: { label: 'Unassigned', value: 0, drilldown: null }, myOwned: { label: 'My Owned Tickets', value: 0, drilldown: null }, myOpenFollowUps: { label: 'My Open Follow-ups', value: 0, drilldown: null } }, needsAttention: [], recentlyUpdated: [], recentlyResolved: [], byStatus: [], byPriority: [], recentTickets: [], myRecentActions: [] }) } as Response);
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ categories: [], relatedSystems: [] }) } as Response);
  }));
}

describe('App navigation', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/dashboard');
  });
  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('puts Dashboard first for requesters', async () => {
    installFetch('REQUESTER');
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Dashboard' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByRole('button')[0]).toHaveTextContent('Dashboard');
  });

  it('renders staff dashboard at the role landing route', async () => {
    installFetch('IT_STAFF');
    window.history.replaceState({}, '', '/');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Welcome back, Test User' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
  });

  it.each([
    ['REQUESTER', '/staff/tickets', '/'],
    ['IT_STAFF', '/create-ticket', '/dashboard'],
    ['ADMINISTRATOR', '/tickets/42', '/dashboard'],
  ] as const)('redirects %s away from an unauthorized route without rendering its page', async (role, route, expectedPath) => {
    installFetch(role);
    window.history.replaceState({}, '', route);
    render(<App />);
    if (expectedPath === '/') {
      expect(await screen.findByRole('heading', { name: 'My Tickets' })).toBeTruthy();
    } else {
      expect(await screen.findByRole('heading', { name: 'Welcome back, Test User' })).toBeTruthy();
    }
    expect(window.location.pathname).toBe(expectedPath);
  });
});

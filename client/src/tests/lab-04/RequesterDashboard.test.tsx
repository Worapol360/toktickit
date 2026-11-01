import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { RequesterDashboard } from '../../lab-04/Dashboard';

const data = {
  generatedAt: '2026-10-28T03:00:00.000Z',
  windowDays: 7,
  metrics: {
    openTickets: { label: 'My Open Tickets', value: 3, drilldown: { path: '/', query: { statusGroup: 'active' } } },
    waitingForRequester: { label: 'Waiting for Me', value: 1, drilldown: { path: '/', query: { status: 'Waiting for Requester' } } },
    resolved: { label: 'Resolved', value: 2, drilldown: { path: '/', query: { status: 'Resolved' } } }
  },
  needsAttention: [{ id: 1, ticketNumber: 'TICK-1', summary: 'Waiting', status: 'Waiting for Requester', updatedAt: '2026-10-28T03:00:00.000Z' }],
  recentlyUpdated: [],
  recentlyResolved: []
};

describe('RequesterDashboard', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(data) })));
  });

  it('renders backend metrics, lists, and drilldown links', async () => {
    const onNavigate = vi.fn();
    render(<RequesterDashboard userName="Aiko Tanaka" onNavigate={onNavigate} />);

    expect(await screen.findByRole('heading', { name: 'Welcome back, Aiko Tanaka' })).toBeTruthy();
    expect(screen.getByText('My Open Tickets')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('Needs your attention')).toBeTruthy();
    expect(screen.getByText(/GMT\+7/)).toBeTruthy();
    screen.getByRole('link', { name: 'View My Open Tickets (3)' }).click();
    expect(onNavigate).toHaveBeenCalledWith('/?statusGroup=active');
  });

  it('shows loading, empty, and retryable failure states', async () => {
    let resolveRequest!: (value: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { resolveRequest = resolve; })));
    render(<RequesterDashboard userName="Aiko Tanaka" onNavigate={vi.fn()} />);
    expect(screen.getByText('Loading dashboard…')).toBeTruthy();
    resolveRequest({ ok: true, json: () => Promise.resolve({ ...data, needsAttention: [], recentlyUpdated: [], recentlyResolved: [], metrics: { openTickets: { ...data.metrics.openTickets, value: 0 }, waitingForRequester: { ...data.metrics.waitingForRequester, value: 0 }, resolved: { ...data.metrics.resolved, value: 0 } } }) } as Response);
    await waitFor(() => expect(screen.getAllByText('No tickets to show yet.')).toHaveLength(3));
    expect(screen.getAllByRole('link', { name: 'View My Tickets' })).toHaveLength(3);
  });

  it('clears the session when the dashboard returns 401', async () => {
    const expireSession = vi.fn();
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({}) })));
    render(<RequesterDashboard userName="Aiko Tanaka" onNavigate={vi.fn()} onSessionExpired={expireSession} />);
    expect(await screen.findByText('Your session has expired. Please sign in again.')).toBeTruthy();
    expect(expireSession).toHaveBeenCalledOnce();
  });
});

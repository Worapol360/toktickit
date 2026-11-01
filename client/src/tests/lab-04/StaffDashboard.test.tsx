import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StaffDashboard } from '../../lab-04/Dashboard';

const data = {
  generatedAt: '2026-10-28T03:00:00.000Z',
  windowDays: 7,
  metrics: {
    unassigned: { label: 'Unassigned', value: 4, drilldown: { path: '/staff/tickets', query: { ownerId: 'unassigned', statusGroup: 'active' } } },
    myOwned: { label: 'My Owned Tickets', value: 2, drilldown: { path: '/staff/tickets', query: { ownerId: '7', statusGroup: 'active' } } },
    myOpenFollowUps: { label: 'My Open Follow-ups', value: 1, drilldown: null }
  },
  byStatus: ['New', 'Open', 'In Progress', 'Waiting for Requester', 'Resolved', 'Closed', 'Reopened', 'Cancelled'].map((status) => ({ status, value: 0, drilldown: { path: '/staff/tickets', query: { status } } })),
  byPriority: ['Low', 'Medium', 'High', 'Urgent', 'Unset'].map((priority) => ({ priority, value: 0, drilldown: priority === 'Unset' ? null : { path: '/staff/tickets', query: { itPriority: priority, statusGroup: 'active' } } })),
  recentTickets: [],
  myRecentActions: [],
  users: { activeRequesters: 4, activeItStaff: 2, activeAdministrators: 1, inactive: 1 }
};

describe('StaffDashboard', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(data) })));
  });

  it('renders status and priority grids and administrator users', async () => {
    render(<StaffDashboard userName="Staff User" onNavigate={vi.fn()} />);
    expect(await screen.findByRole('heading', { name: 'Welcome back, Staff User' })).toBeTruthy();
    expect(screen.getByText('By status')).toBeTruthy();
    expect(screen.getByText('By IT Priority')).toBeTruthy();
    expect(screen.getByText('Users')).toBeTruthy();
    expect(screen.getByText('My Open Follow-ups')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View users' })).toHaveAttribute('href', '/admin/users');
  });

  it('shows a safe failure with retry', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ error: { message: 'internal details' } }) })));
    render(<StaffDashboard userName="Staff User" onNavigate={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't load the dashboard. Please try again.");
    expect(screen.queryByText('internal details')).toBeNull();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });

  it('provides queue actions for empty staff panels', async () => {
    render(<StaffDashboard userName="Staff User" onNavigate={vi.fn()} />);
    expect(await screen.findAllByRole('link', { name: 'Ticket Queue' })).toHaveLength(2);
  });
});

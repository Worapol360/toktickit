export type Drilldown = { path: string; query: Record<string, string> } | null;

export type TicketSummary = {
  id: number;
  ticketNumber: string;
  summary: string;
  status: string;
  updatedAt: string;
  resolvedAt?: string | null;
  itPriority?: string | null;
  owner?: { id: number; name: string } | null;
  requesterMarkedResolved?: boolean;
};

export type Metric = { label: string; value: number; drilldown: Drilldown };

export type RequesterDashboardData = {
  generatedAt: string;
  windowDays: number;
  metrics: {
    openTickets: Metric;
    waitingForRequester: Metric;
    resolved: Metric;
  };
  needsAttention: TicketSummary[];
  recentlyUpdated: TicketSummary[];
  recentlyResolved: TicketSummary[];
};

export type StaffDashboardData = {
  generatedAt: string;
  windowDays: number;
  metrics: {
    unassigned: Metric;
    myOwned: Metric;
    myOpenFollowUps: Metric;
  };
  byStatus: Array<{ status: string; value: number; drilldown: Drilldown }>;
  byPriority: Array<{ priority: string; value: number; drilldown: Drilldown }>;
  recentTickets: TicketSummary[];
  myRecentActions: Array<{
    id: number;
    ticketId: number;
    ticketNumber: string;
    description: string;
    followUpRequired: boolean;
    followUpOpen: boolean;
    createdAt: string;
  }>;
  users?: {
    activeRequesters: number;
    activeItStaff: number;
    activeAdministrators: number;
    inactive: number;
  };
};

export async function fetchDashboard<T>(role: 'requester' | 'staff'): Promise<T> {
  const response = await fetch(`/api/dashboard/${role}`, { credentials: 'same-origin' });
  const body = await response.json().catch(() => ({})) as T & { error?: { message?: string } };
  if (!response.ok) {
    const error = new Error(body.error?.message ?? 'Unable to load the dashboard.');
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  if (!body || typeof body !== 'object' || !('metrics' in body)) {
    throw new Error('Unable to load the dashboard.');
  }
  return body;
}

export function drilldownUrl(drilldown: Drilldown): string | null {
  if (!drilldown) return null;
  const query = new URLSearchParams(drilldown.query).toString();
  return query ? `${drilldown.path}?${query}` : drilldown.path;
}

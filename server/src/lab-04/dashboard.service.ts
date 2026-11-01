/**
 * Dashboard service (Lab 4, Issue 5).
 * specification.md §5.4 (BR-25 … BR-31, D-08, D-10, D-18), api-spec.md §5.
 *
 * All metrics are computed from PostgreSQL at request time; scope is always
 * taken from the session user id passed by the route (never from a parameter).
 * Lists are capped at 5 and ordered newest first with id DESC as tie-break.
 * A7: plain count queries may run in Promise.all; findMany with include runs
 * sequentially (Prisma + adapter-pg lesson).
 */
import prisma from '../prisma.js';
import {
  ACTIVE_STATUSES,
  DASHBOARD_STATUS_ORDER,
  PRIORITY_BUCKETS,
  RECENT_WINDOW_DAYS,
  priorityBucket,
  recentWindowStart,
  truncateActionDescription
} from './dashboard-helpers.js';

type DrilldownQuery = Record<string, string>;
type Drilldown = { path: string; query: DrilldownQuery } | null;

type Metric = { label: string; value: number; drilldown: Drilldown };

export type RequesterDashboard = {
  generatedAt: string;
  windowDays: number;
  metrics: {
    openTickets: Metric;
    waitingForRequester: Metric;
    resolved: Metric;
  };
  needsAttention: Array<{
    id: number;
    ticketNumber: string;
    summary: string;
    status: string;
    updatedAt: Date;
  }>;
  recentlyUpdated: Array<{
    id: number;
    ticketNumber: string;
    summary: string;
    status: string;
    updatedAt: Date;
  }>;
  recentlyResolved: Array<{
    id: number;
    ticketNumber: string;
    summary: string;
    status: string;
    updatedAt: Date;
    resolvedAt: Date | null;
  }>;
};

export type StaffDashboard = {
  generatedAt: string;
  windowDays: number;
  metrics: {
    unassigned: Metric;
    myOwned: Metric;
    myOpenFollowUps: Metric;
  };
  byStatus: Array<{ status: string; value: number; drilldown: Drilldown }>;
  byPriority: Array<{ priority: string; value: number; drilldown: Drilldown }>;
  recentTickets: Array<{
    id: number;
    ticketNumber: string;
    summary: string;
    status: string;
    itPriority: string | null;
    owner: { id: number; name: string } | null;
    requesterMarkedResolved: boolean;
    updatedAt: Date;
  }>;
  myRecentActions: Array<{
    id: number;
    ticketId: number;
    ticketNumber: string;
    description: string;
    followUpRequired: boolean;
    followUpOpen: boolean;
    createdAt: Date;
  }>;
  users?: {
    activeRequesters: number;
    activeItStaff: number;
    activeAdministrators: number;
    inactive: number;
  };
};

const requesterSummarySelect = {
  id: true,
  ticketNumber: true,
  summary: true,
  status: true,
  updatedAt: true
} as const;

export async function buildRequesterDashboard(userId: number): Promise<RequesterDashboard> {
  const now = new Date();
  const windowStart = recentWindowStart(now);

  // Plain counts only — safe to run concurrently (A7).
  const [openTickets, waitingForRequester, resolved] = await Promise.all([
    prisma.ticket.count({ where: { requesterId: userId, status: { in: [...ACTIVE_STATUSES] } } }),
    prisma.ticket.count({ where: { requesterId: userId, status: 'Waiting for Requester' } }),
    prisma.ticket.count({ where: { requesterId: userId, status: 'Resolved' } })
  ]);

  const needsAttention = await prisma.ticket.findMany({
    where: { requesterId: userId, status: 'Waiting for Requester' },
    select: requesterSummarySelect,
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: 5
  });

  const recentlyUpdated = await prisma.ticket.findMany({
    where: { requesterId: userId },
    select: requesterSummarySelect,
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: 5
  });

  const recentlyResolved = await prisma.ticket.findMany({
    where: { requesterId: userId, status: 'Resolved', resolvedAt: { gte: windowStart } },
    select: { ...requesterSummarySelect, resolvedAt: true },
    orderBy: [{ resolvedAt: 'desc' }, { id: 'desc' }],
    take: 5
  });

  return {
    generatedAt: now.toISOString(),
    windowDays: RECENT_WINDOW_DAYS,
    metrics: {
      openTickets: {
        label: 'My Open Tickets',
        value: openTickets,
        drilldown: { path: '/', query: { statusGroup: 'active' } }
      },
      waitingForRequester: {
        label: 'Waiting for Me',
        value: waitingForRequester,
        drilldown: { path: '/', query: { status: 'Waiting for Requester' } }
      },
      resolved: {
        label: 'Resolved',
        value: resolved,
        drilldown: { path: '/', query: { status: 'Resolved' } }
      }
    },
    needsAttention,
    recentlyUpdated,
    recentlyResolved
  };
}

export async function buildStaffDashboard(userId: number, includeUsers: boolean): Promise<StaffDashboard> {
  const now = new Date();

  // Plain counts only — safe to run concurrently (A7).
  const [unassigned, myOwned, myOpenFollowUps] = await Promise.all([
    prisma.ticket.count({ where: { ownerId: null, status: { in: [...ACTIVE_STATUSES] } } }),
    prisma.ticket.count({ where: { ownerId: userId, status: { in: [...ACTIVE_STATUSES] } } }),
    prisma.actionTaken.count({
      where: { performedById: userId, followUpRequired: true, followUpCompletedAt: null }
    })
  ]);

  // byStatus: all tickets grouped by status (BR-28 table, zeros filled in).
  const statusGroups = await prisma.ticket.groupBy({ by: ['status'], _count: { _all: true } });
  const statusCounts = new Map(statusGroups.map((group) => [group.status, group._count._all]));
  const byStatus = DASHBOARD_STATUS_ORDER.map((status) => ({
    status,
    value: statusCounts.get(status) ?? 0,
    drilldown: { path: '/staff/tickets', query: { status } } satisfies Drilldown
  }));

  // byPriority: Active tickets grouped by itPriority (NULL -> Unset, D-18).
  const priorityGroups = await prisma.ticket.groupBy({
    by: ['itPriority'],
    where: { status: { in: [...ACTIVE_STATUSES] } },
    _count: { _all: true }
  });
  const priorityCounts = new Map<string, number>();
  for (const group of priorityGroups) {
    const bucket = priorityBucket(group.itPriority);
    priorityCounts.set(bucket, (priorityCounts.get(bucket) ?? 0) + group._count._all);
  }
  const byPriority = PRIORITY_BUCKETS.map((priority) => ({
    priority,
    value: priorityCounts.get(priority) ?? 0,
    drilldown: (priority === 'Unset'
      ? null
      : { path: '/staff/tickets', query: { itPriority: priority, statusGroup: 'active' } }) satisfies Drilldown
  }));

  const recentTickets = await prisma.ticket.findMany({
    select: {
      id: true,
      ticketNumber: true,
      summary: true,
      status: true,
      itPriority: true,
      requesterMarkedResolved: true,
      updatedAt: true,
      owner: { select: { id: true, name: true } }
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: 5
  });

  const recentActionRows = await prisma.actionTaken.findMany({
    where: { performedById: userId },
    select: {
      id: true,
      description: true,
      followUpRequired: true,
      followUpCompletedAt: true,
      createdAt: true,
      ticket: { select: { id: true, ticketNumber: true } }
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 5
  });
  const myRecentActions = recentActionRows.map((action) => ({
    id: action.id,
    ticketId: action.ticket.id,
    ticketNumber: action.ticket.ticketNumber,
    description: truncateActionDescription(action.description),
    followUpRequired: action.followUpRequired,
    followUpOpen: action.followUpRequired && action.followUpCompletedAt === null,
    createdAt: action.createdAt
  }));

  const dashboard: StaffDashboard = {
    generatedAt: now.toISOString(),
    windowDays: RECENT_WINDOW_DAYS,
    metrics: {
      unassigned: {
        label: 'Unassigned',
        value: unassigned,
        drilldown: { path: '/staff/tickets', query: { ownerId: 'unassigned', statusGroup: 'active' } }
      },
      myOwned: {
        label: 'My Owned Tickets',
        value: myOwned,
        drilldown: { path: '/staff/tickets', query: { ownerId: String(userId), statusGroup: 'active' } }
      },
      myOpenFollowUps: {
        label: 'My Open Follow-ups',
        value: myOpenFollowUps,
        drilldown: null
      }
    },
    byStatus,
    byPriority,
    recentTickets,
    myRecentActions
  };

  // BR-31 / D-10: users counts exist only for Administrator (structurally absent otherwise).
  if (includeUsers) {
    const [activeRequesters, activeItStaff, activeAdministrators, inactive] = await Promise.all([
      prisma.user.count({ where: { role: 'REQUESTER', isActive: true } }),
      prisma.user.count({ where: { role: 'IT_STAFF', isActive: true } }),
      prisma.user.count({ where: { role: 'ADMINISTRATOR', isActive: true } }),
      prisma.user.count({ where: { isActive: false } })
    ]);
    dashboard.users = { activeRequesters, activeItStaff, activeAdministrators, inactive };
  }

  return dashboard;
}

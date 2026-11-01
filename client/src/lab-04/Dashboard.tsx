import { useCallback, useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { drilldownUrl, fetchDashboard, type Drilldown, type Metric, type RequesterDashboardData, type StaffDashboardData, type TicketSummary } from './dashboardApi';
import { formatBangkokDateTime } from './actionForm';

type DashboardProps = {
  userName: string;
  onNavigate: (route: string) => void;
  onSessionExpired?: () => void;
};

function AppLink({ href, onNavigate, children, className }: { href: string; onNavigate: (route: string) => void; children: ReactNode; className?: string }) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.currentTarget.target === '_blank') return;
    event.preventDefault();
    onNavigate(href);
  };
  return <a href={href} className={className} onClick={handleClick}>{children}</a>;
}

function formatTime(value: string) {
  const formatted = formatBangkokDateTime(value);
  return formatted ? `${formatted} GMT+7` : '';
}

function MetricCard({ metric, onNavigate }: { metric: Metric; onNavigate: (route: string) => void }) {
  const destination = drilldownUrl(metric.drilldown);
  return (
    <article className="dashboard-card">
      <p className="dashboard-card-label">{metric.label}</p>
      <strong className="dashboard-card-value">{metric.value}</strong>
      {destination && <AppLink href={destination} onNavigate={onNavigate} className="dashboard-link">View {metric.label} ({metric.value})</AppLink>}
    </article>
  );
}

function ListPanel({ title, items, onNavigate, destination, emptyText, emptyAction, timeField = 'updatedAt', staff = false }: {
  title: string;
  items: TicketSummary[];
  onNavigate: (route: string) => void;
  destination?: string;
  emptyText: string;
  emptyAction?: { label: string; href: string };
  timeField?: 'updatedAt' | 'resolvedAt';
  staff?: boolean;
}) {
  const headingId = `dashboard-panel-${title.toLowerCase().replace(/ /g, '-')}`;
  return (
    <section className="dashboard-panel" aria-labelledby={headingId}>
      <h2 id={headingId}>{title}</h2>
      {items.length === 0 ? <><p className="dashboard-empty">{emptyText}</p>{emptyAction && <AppLink href={emptyAction.href} onNavigate={onNavigate} className="dashboard-link">{emptyAction.label}</AppLink>}</> : (
        <ul className="dashboard-list">
          {items.map((item) => (
            <li key={item.id}>
              <AppLink href={staff ? `/staff/tickets/${item.id}` : `/tickets/${item.id}`} onNavigate={onNavigate} className="dashboard-ticket-link">
                {item.ticketNumber}
              </AppLink>
              <span>{item.summary}</span>
              <span className="badge status-badge">{item.status}</span>
              <time dateTime={item[timeField] ?? item.updatedAt}>{formatTime(item[timeField] ?? item.updatedAt)}</time>
              {item.requesterMarkedResolved && <span className="badge priority-badge">Requester reports resolved</span>}
            </li>
          ))}
        </ul>
      )}
      {destination && <AppLink href={destination} onNavigate={onNavigate} className="dashboard-link">View all</AppLink>}
    </section>
  );
}

function DashboardState({ message, action }: { message: string; action?: { label: string; onClick: () => void } }) {
  const role = message.startsWith('Loading') ? 'status' : message.startsWith("We couldn't") ? 'alert' : undefined;
  return <section className="dashboard-state" role={role}><p>{message}</p>{action && <button type="button" onClick={action.onClick}>{action.label}</button>}</section>;
}

function DashboardLayout({ title, userName, onNavigate, onRefresh, refreshing, children }: DashboardProps & { title: string; onRefresh: () => void; refreshing: boolean; children: ReactNode }) {
  return (
    <section className="dashboard-page" aria-labelledby="dashboard-title">
      <div className="dashboard-heading">
        <div><h1 id="dashboard-title">Welcome back, {userName}</h1><p>{title}</p></div>
        <button type="button" onClick={onRefresh} disabled={refreshing}>{refreshing ? 'Refreshing...' : 'Refresh'}</button>
      </div>
      <p className="visually-hidden" aria-live="polite">{refreshing ? '' : 'Dashboard updated'}</p>
      {children}
    </section>
  );
}

export function RequesterDashboard({ userName, onNavigate, onSessionExpired }: DashboardProps) {
  const [data, setData] = useState<RequesterDashboardData | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'forbidden' | 'unauthorized' | 'error'>('loading');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setState('loading');
    try { setData(await fetchDashboard<RequesterDashboardData>('requester')); setState('ready'); }
    catch (error) {
      const status = (error as Error & { status?: number }).status;
      if (status === 401) onSessionExpired?.();
      setState(status === 401 ? 'unauthorized' : status === 403 ? 'forbidden' : 'error');
    } finally { setRefreshing(false); }
  }, [onSessionExpired]);
  useEffect(() => { void load(); }, [load]);
  if (state === 'loading') return <DashboardState message="Loading dashboard…" />;
  if (state === 'forbidden') return <DashboardState message="You do not have access to this dashboard." action={{ label: 'Go to My Tickets', onClick: () => onNavigate('/') }} />;
  if (state === 'unauthorized') return <DashboardState message="Your session has expired. Please sign in again." />;
  if (state === 'error' || !data) return <DashboardState message="We couldn't load the dashboard. Please try again." action={{ label: 'Retry', onClick: () => void load() }} />;
  return (
    <DashboardLayout title="Your requester dashboard" userName={userName} onNavigate={onNavigate} onRefresh={() => void load(true)} refreshing={refreshing}>
      <div className="dashboard-grid dashboard-metrics">{Object.values(data.metrics).map((metric) => <MetricCard key={metric.label} metric={metric} onNavigate={onNavigate} />)}</div>
      <div className="dashboard-grid dashboard-panels">
        <ListPanel title="Needs your attention" items={data.needsAttention} onNavigate={onNavigate} emptyText="No tickets to show yet." emptyAction={{ label: 'View My Tickets', href: '/' }} />
        <ListPanel title="Recently updated" items={data.recentlyUpdated} onNavigate={onNavigate} destination="/" emptyText="No tickets to show yet." emptyAction={{ label: 'View My Tickets', href: '/' }} />
        <ListPanel title="Recently resolved" items={data.recentlyResolved} onNavigate={onNavigate} emptyText="No tickets to show yet." emptyAction={{ label: 'View My Tickets', href: '/' }} timeField="resolvedAt" />
      </div>
      <div className="dashboard-actions"><button type="button" onClick={() => onNavigate('/create-ticket')}>Create Ticket</button><button type="button" onClick={() => onNavigate('/')}>View My Tickets</button></div>
    </DashboardLayout>
  );
}

function DrilldownTile({ label, value, drilldown, onNavigate }: { label: string; value: number; drilldown: Drilldown; onNavigate: (route: string) => void }) {
  const destination = drilldownUrl(drilldown);
  return <article className="dashboard-tile"><strong>{value}</strong><span>{label}</span>{destination && <AppLink href={destination} onNavigate={onNavigate} className="dashboard-link">View {label}</AppLink>}</article>;
}

export function StaffDashboard({ userName, onNavigate, onSessionExpired }: DashboardProps) {
  const [data, setData] = useState<StaffDashboardData | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'forbidden' | 'unauthorized' | 'error'>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setState('loading');
    try { setData(await fetchDashboard<StaffDashboardData>('staff')); setState('ready'); }
    catch (error) {
      const status = (error as Error & { status?: number }).status;
      if (status === 401) onSessionExpired?.();
      setState(status === 401 ? 'unauthorized' : status === 403 ? 'forbidden' : 'error');
    } finally { setRefreshing(false); }
  }, [onSessionExpired]);
  useEffect(() => { void load(); }, [load]);
  if (state === 'loading') return <DashboardState message="Loading dashboard…" />;
  if (state === 'forbidden') return <DashboardState message="You do not have access to this dashboard." action={{ label: 'Go to My Tickets', onClick: () => onNavigate('/') }} />;
  if (state === 'unauthorized') return <DashboardState message="Your session has expired. Please sign in again." />;
  if (state === 'error' || !data) return <DashboardState message="We couldn't load the dashboard. Please try again." action={{ label: 'Retry', onClick: () => void load() }} />;
  return (
    <DashboardLayout title="Your staff dashboard" userName={userName} onNavigate={onNavigate} onRefresh={() => void load(true)} refreshing={refreshing}>
      <div className="dashboard-grid dashboard-metrics">{Object.values(data.metrics).map((metric) => <MetricCard key={metric.label} metric={metric} onNavigate={onNavigate} />)}</div>
      {data.users && <section className="dashboard-panel"><h2>Users</h2><div className="dashboard-tile-grid"><div className="dashboard-tile"><strong>{data.users.activeRequesters}</strong><span>Active Requesters</span></div><div className="dashboard-tile"><strong>{data.users.activeItStaff}</strong><span>Active IT Staff</span></div><div className="dashboard-tile"><strong>{data.users.activeAdministrators}</strong><span>Active Administrators</span></div><div className="dashboard-tile"><strong>{data.users.inactive}</strong><span>Inactive</span></div></div><AppLink href="/admin/users" onNavigate={onNavigate} className="dashboard-link">View users</AppLink></section>}
      <section className="dashboard-panel"><h2>By status</h2><div className="dashboard-tile-grid">{data.byStatus.map((item) => <DrilldownTile key={item.status} label={item.status} value={item.value} drilldown={item.drilldown} onNavigate={onNavigate} />)}</div></section>
      <section className="dashboard-panel"><h2>By IT Priority</h2><div className="dashboard-tile-grid">{data.byPriority.map((item) => <DrilldownTile key={item.priority} label={item.priority} value={item.value} drilldown={item.drilldown} onNavigate={onNavigate} />)}</div></section>
      <div className="dashboard-grid dashboard-panels">
        <ListPanel title="Recent tickets" items={data.recentTickets} onNavigate={onNavigate} staff emptyText="Nothing to show yet." emptyAction={{ label: 'Ticket Queue', href: '/staff/tickets' }} />
        <section className="dashboard-panel"><h2>My recent actions</h2>{data.myRecentActions.length === 0 ? <><p className="dashboard-empty">Nothing to show yet.</p><AppLink href="/staff/tickets" onNavigate={onNavigate} className="dashboard-link">Ticket Queue</AppLink></> : <ul className="dashboard-list">{data.myRecentActions.map((action) => <li key={action.id}><AppLink href={`/staff/tickets/${action.ticketId}`} onNavigate={onNavigate} className="dashboard-ticket-link">{action.ticketNumber}</AppLink><span>{action.description}</span><span>{action.followUpOpen ? 'Follow-up open' : action.followUpRequired ? 'Follow-up complete' : 'No follow-up'}</span><time dateTime={action.createdAt}>{formatTime(action.createdAt)}</time></li>)}</ul>}</section>
      </div>
      <div className="dashboard-actions"><button type="button" onClick={() => onNavigate('/staff/tickets')}>Ticket Queue</button><button type="button" onClick={() => onNavigate('/staff/tickets?ownerId=unassigned&statusGroup=active')}>Unassigned Tickets</button></div>
    </DashboardLayout>
  );
}

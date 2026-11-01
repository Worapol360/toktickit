import { useCallback, useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { ChangePassword } from './ChangePassword';
import { Login } from './Login';
import { CreateTicket } from './lab-02/CreateTicket';
import { RequesterTicketDetail } from './pages/RequesterTicketDetail';
import { StaffTicketDetail } from './pages/StaffTicketDetail';
import { StaffTicketQueue } from './pages/StaffTicketQueue';
import { MyTickets } from './pages/MyTickets';
import { UserManagement } from './pages/UserManagement';
import { RequesterDashboard, StaffDashboard } from './lab-04/Dashboard';

type Option = { id: number; name: string };

function roleName(role: string) {
  return role === 'IT_STAFF' ? 'IT Staff' : role === 'ADMINISTRATOR' ? 'Administrator' : 'Requester';
}

function currentUrl() {
  return `${window.location.pathname || '/'}${window.location.search}`;
}

function routePath(route: string) {
  return new URL(route, window.location.origin).pathname;
}

function forcedRouteFor(role: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR', route: string): string | null {
  const path = routePath(route);
  if (path === '/') return role === 'REQUESTER' ? null : '/dashboard';
  if (path === '/dashboard') return null;
  if (path === '/create-ticket' || /^\/tickets\/\d+$/.test(path)) {
    return role === 'REQUESTER' ? null : role === 'IT_STAFF' || role === 'ADMINISTRATOR' ? '/dashboard' : '/';
  }
  if (path === '/staff/tickets' || /^\/staff\/tickets\/\d+$/.test(path)) {
    return role === 'IT_STAFF' || role === 'ADMINISTRATOR' ? null : '/';
  }
  if (path === '/admin/users') return role === 'ADMINISTRATOR' ? null : role === 'IT_STAFF' ? '/dashboard' : '/';
  return role === 'REQUESTER' ? '/' : '/dashboard';
}

function AppShell({ currentRoute, onNavigate, onLogout, children }: { currentRoute: string; onNavigate: (route: string) => void; onLogout: () => void; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return null;
  const currentPath = routePath(currentRoute);
  const isDashboard = currentPath === '/dashboard';
  const isStaffRoute = currentPath.startsWith('/staff/tickets');
  const isRequesterRoute = currentPath === '/' || currentPath.startsWith('/tickets/');
  return <main style={{ minHeight: '100vh', background: '#F6FAF8', color: '#17221C' }}>
    <header className="app-header" style={{ background: '#006B3C', color: '#FFFFFF', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <strong>TokTickIT</strong>
      <nav
        className="app-nav"
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
        }}
      >
        <button type="button" aria-current={isDashboard ? 'page' : undefined} onClick={() => onNavigate('/dashboard')}>Dashboard</button>
        {user.role === 'IT_STAFF' ? (
          <button type="button" aria-current={isStaffRoute ? 'page' : undefined} onClick={() => onNavigate('/staff/tickets')}>Ticket Queue</button>
        ) : user.role === 'ADMINISTRATOR' ? (
          <>
            <button type="button" aria-current={isStaffRoute ? 'page' : undefined} onClick={() => onNavigate('/staff/tickets')}>Ticket Queue</button>
            <button type="button" aria-current={currentRoute === '/admin/users' ? 'page' : undefined} onClick={() => onNavigate('/admin/users')}>User Management</button>
          </>
        ) : (
          <>
            <button type="button" aria-current={isRequesterRoute ? 'page' : undefined} onClick={() => onNavigate('/')}>My Tickets</button>
            <button type="button" aria-current={currentRoute === '/create-ticket' ? 'page' : undefined} onClick={() => onNavigate('/create-ticket')}>Create Ticket</button>
          </>
        )}
      </nav>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span>{user?.name}</span><span aria-label="Role" style={{ borderRadius: 999, padding: '4px 8px', background: '#EAF6EF', color: '#006B3C' }}>{user && roleName(user.role)}</span><button type="button" onClick={onLogout}>Logout</button></div>
    </header>
    <section style={{ maxWidth: 1200, margin: '32px auto', padding: '0 24px' }}>{children}</section>
  </main>;
}

function AuthenticatedApp() {
  const { user, loading, login, logout, expireSession, changePassword } = useAuth();
  const [route, setRoute] = useState(currentUrl);
  const [categories, setCategories] = useState<Option[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<Option[]>([]);
  const [error, setError] = useState('');

  useEffect(() => { const onPopState = () => setRoute(currentUrl()); window.addEventListener('popstate', onPopState); return () => window.removeEventListener('popstate', onPopState); }, []);
  useLayoutEffect(() => {
    if (!user || user.mustChangePassword) return;
    const forcedRoute = forcedRouteFor(user.role, route);
    if (forcedRoute) {
      window.history.replaceState({}, '', forcedRoute);
      setRoute(forcedRoute);
    }
  }, [route, user]);
  useEffect(() => { if (!user || user.mustChangePassword) return; void Promise.all([fetch('/api/categories', { credentials: 'same-origin' }).then((response) => response.json()), fetch('/api/related-systems', { credentials: 'same-origin' }).then((response) => response.json())]).then(([categoryBody, systemBody]) => { setCategories(categoryBody.categories ?? []); setRelatedSystems(systemBody.relatedSystems ?? []); }).catch(() => setError('Unable to load ticket options.')); }, [user]);

  const navigate = useCallback((nextRoute: string, replace = false) => {
    const url = new URL(nextRoute, window.location.origin);
    const destination = `${url.pathname}${url.search}`;
    if (replace) window.history.replaceState({}, '', nextRoute);
    else window.history.pushState({}, '', nextRoute);
    setRoute(destination);
  }, []);
  if (loading) return <main><p role="status">Loading...</p></main>;
  if (!user) return <Login onLogin={async ({ email, password }) => {
    const result = await login(email, password);
    if (result.user) {
      window.history.replaceState({}, '', '/dashboard');
      setRoute('/dashboard');
    }
    return result;
  }} />;
  if (user.mustChangePassword) return <ChangePassword onChangePassword={changePassword} />;

  const forcedRoute = forcedRouteFor(user.role, route);
  if (forcedRoute) {
    return <main><p role="status">Loading...</p></main>;
  }
  const effectiveRoute = route;
  const effectivePath = routePath(effectiveRoute);
  let content: ReactNode;
  const staffQueue = effectivePath === '/staff/tickets';
  const staffDetail = effectivePath.match(/^\/staff\/tickets\/(\d+)$/);
  const detail = effectivePath.match(/^\/tickets\/(\d+)$/);
  const adminUsers = effectivePath === '/admin/users';
  const dashboard = effectivePath === '/dashboard';

  if (dashboard) {
    content = user.role === 'REQUESTER'
      ? <RequesterDashboard userName={user.name} onNavigate={navigate} onSessionExpired={expireSession} />
      : <StaffDashboard userName={user.name} onNavigate={navigate} onSessionExpired={expireSession} />;
  } else if (adminUsers && user.role === 'ADMINISTRATOR') {
    content = <UserManagement currentUserId={user.id} />;
  } else if (staffQueue) {
    content = (
      <StaffTicketQueue
        onOpenTicket={(id) => navigate(`/staff/tickets/${id}`)}
      />
    );
  } else if (staffDetail) {
    content = (
      <StaffTicketDetail
        ticketId={Number(staffDetail[1])}
        currentUserId={user.id}
        onBack={() => navigate('/staff/tickets')}
      />
    );
  } else if (effectivePath === '/create-ticket' && user.role === 'REQUESTER') content = <CreateTicket requesterId={String(user.id)} categories={categories} relatedSystems={relatedSystems} onCancel={() => navigate('/')} />;
  else if (detail) content = <RequesterTicketDetail requesterId={String(user.id)} ticketId={Number(detail[1])} onBack={() => navigate('/')} />;
  else content = <MyTickets requesterId={String(user.id)} onCreateTicket={() => navigate('/create-ticket')} onViewTicket={(id) => navigate(`/tickets/${id}`)} />;

  return <AppShell currentRoute={effectiveRoute} onNavigate={navigate} onLogout={() => void logout().then(() => navigate('/', true))}>{error && <p role="alert">{error}</p>}{content}</AppShell>;
}

export default function App() { return <AuthProvider><AuthenticatedApp /></AuthProvider>; }

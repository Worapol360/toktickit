import { useEffect, useState, type ReactNode } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { ChangePassword } from './ChangePassword';
import { Login } from './Login';
import { CreateTicket } from './lab-02/CreateTicket';
import { RequesterTicketDetail } from './pages/RequesterTicketDetail';
import { MyTickets } from './pages/MyTickets';

type Option = { id: number; name: string };

function roleName(role: string) {
  return role === 'IT_STAFF' ? 'IT Staff' : role === 'ADMINISTRATOR' ? 'Administrator' : 'Requester';
}

function AppShell({ currentRoute, onNavigate, onLogout, children }: { currentRoute: string; onNavigate: (route: string) => void; onLogout: () => void; children: ReactNode }) {
  const { user } = useAuth();
  return <main style={{ minHeight: '100vh', background: '#F6FAF8', color: '#17221C' }}>
    <header className="app-header" style={{ background: '#006B3C', color: '#FFFFFF', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <strong>TokTickIT</strong>
      <nav className="app-nav" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button type="button" aria-current={currentRoute === '/' ? 'page' : undefined} onClick={() => onNavigate('/')}>My Tickets</button>
        <button type="button" aria-current={currentRoute === '/create-ticket' ? 'page' : undefined} onClick={() => onNavigate('/create-ticket')}>Create Ticket</button>
      </nav>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span>{user?.name}</span><span aria-label="Role" style={{ borderRadius: 999, padding: '4px 8px', background: '#EAF6EF', color: '#006B3C' }}>{user && roleName(user.role)}</span><button type="button" onClick={onLogout}>Logout</button></div>
    </header>
    <section style={{ maxWidth: 1200, margin: '32px auto', padding: '0 24px' }}>{children}</section>
  </main>;
}

function AuthenticatedApp() {
  const { user, loading, login, logout, changePassword } = useAuth();
  const [route, setRoute] = useState(() => window.location.pathname || '/');
  const [categories, setCategories] = useState<Option[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<Option[]>([]);
  const [error, setError] = useState('');

  useEffect(() => { const onPopState = () => setRoute(window.location.pathname || '/'); window.addEventListener('popstate', onPopState); return () => window.removeEventListener('popstate', onPopState); }, []);
  useEffect(() => { if (!user || user.mustChangePassword) return; void Promise.all([fetch('/api/categories', { credentials: 'same-origin' }).then((response) => response.json()), fetch('/api/related-systems', { credentials: 'same-origin' }).then((response) => response.json())]).then(([categoryBody, systemBody]) => { setCategories(categoryBody.categories ?? []); setRelatedSystems(systemBody.relatedSystems ?? []); }).catch(() => setError('Unable to load ticket options.')); }, [user]);

  const navigate = (nextRoute: string) => { window.history.pushState({}, '', nextRoute); setRoute(nextRoute); };
  if (loading) return <main><p role="status">Loading...</p></main>;
  if (!user) return <Login onLogin={async ({ email, password }) => login(email, password)} />;
  if (user.mustChangePassword) return <ChangePassword onChangePassword={changePassword} />;

  let content: ReactNode;
  const detail = route.match(/^\/tickets\/(\d+)$/);
  if (route === '/create-ticket') content = <CreateTicket requesterId={String(user.id)} categories={categories} relatedSystems={relatedSystems} onCancel={() => navigate('/')} />;
  else if (detail) content = <RequesterTicketDetail requesterId={String(user.id)} ticketId={Number(detail[1])} onBack={() => navigate('/')} />;
  else content = <MyTickets requesterId={String(user.id)} onCreateTicket={() => navigate('/create-ticket')} onViewTicket={(id) => navigate(`/tickets/${id}`)} />;

  return <AppShell currentRoute={route} onNavigate={navigate} onLogout={() => void logout().then(() => navigate('/'))}>{error && <p role="alert">{error}</p>}{content}</AppShell>;
}

export default function App() { return <AuthProvider><AuthenticatedApp /></AuthProvider>; }

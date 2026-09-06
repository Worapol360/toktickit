import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { RequesterSelectionScreen } from './lab-02/RequesterSelection';
import { CreateTicket } from './lab-02/CreateTicket';
import { RequesterTicketDetail } from './pages/RequesterTicketDetail';
import { MyTickets } from './pages/MyTickets';

type Requester = {
  id: number;
  name: string;
  email: string;
  department: string;
  isActive: boolean;
};

type Category = {
  id: number;
  name: string;
};

type RelatedSystem = {
  id: number;
  name: string;
};

const SESSION_KEY = 'toktickit-selected-requester-id';

function getStoredRequesterId() {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.sessionStorage.getItem(SESSION_KEY) ?? '';
}

// --- Shared Green Zen layout: wraps every authenticated page ---
function AppShell({
  currentRoute,
  selectedRequester,
  onNavigate,
  onChangeRequester,
  children,
}: {
  currentRoute: string;
  selectedRequester: Requester | null;
  onNavigate: (route: string) => void;
  onChangeRequester: () => void;
  children: ReactNode;
}) {
  return (
    <main style={{ minHeight: '100vh', background: '#F6FAF8', color: '#17221C' }}>
      <header
        style={{
          background: '#006B3C',
          color: '#FFFFFF',
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <strong>TokTickIT</strong>
        </div>
        <nav style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            type="button"
            aria-current={currentRoute === '/' ? 'page' : undefined}
            onClick={() => onNavigate('/')}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#FFFFFF',
              padding: 0,
              fontWeight: currentRoute === '/' ? 700 : 400,
              textDecoration: currentRoute === '/' ? 'underline' : 'none',
            }}
          >
            My Tickets
          </button>
          <button
            type="button"
            aria-current={currentRoute === '/create-ticket' ? 'page' : undefined}
            onClick={() => onNavigate('/create-ticket')}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.35)',
              color: '#FFFFFF',
              borderRadius: '6px',
              padding: '8px 12px',
              fontWeight: currentRoute === '/create-ticket' ? 700 : 400,
            }}
          >
            Create Ticket
          </button>
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>{selectedRequester ? selectedRequester.name : 'No requester selected'}</span>
          <button
            type="button"
            onClick={onChangeRequester}
            style={{ background: '#FFFFFF', color: '#006B3C', border: 'none', borderRadius: '6px', padding: '8px 12px' }}
          >
            Change Requester
          </button>
        </div>
      </header>

      <section style={{ maxWidth: '1200px', margin: '32px auto', padding: '0 24px' }}>
        {children}
      </section>
    </main>
  );
}

export default function App() {
  const [requesters, setRequesters] = useState<Requester[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<RelatedSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState('');
  const [relatedSystemsError, setRelatedSystemsError] = useState('');
  const [selectedRequesterId, setSelectedRequesterId] = useState<string>(getStoredRequesterId());
  const [pendingRequesterId, setPendingRequesterId] = useState<string>(getStoredRequesterId());
  const [currentRoute, setCurrentRoute] = useState(() => {
    if (typeof window === 'undefined') {
      return '/';
    }

    return window.location.pathname || '/';
  });

  const selectedRequester = useMemo(
    () => requesters.find((requester) => String(requester.id) === selectedRequesterId) ?? null,
    [requesters, selectedRequesterId]
  );

  async function loadRequesters() {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/requesters');
      const payload = await response.json() as { requesters?: Requester[] };

      if (!response.ok || !Array.isArray(payload.requesters)) {
        throw new Error('Failed to load requesters');
      }

      setRequesters(payload.requesters);
    } catch {
      setRequesters([]);
      setError('Unable to load Development Requesters. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRequesters();
  }, []);

  useEffect(() => {
    async function loadRelatedSystems() {
      try {
        const response = await fetch('/api/related-systems');
        const payload = await response.json() as { relatedSystems?: RelatedSystem[] };
        if (!response.ok || !Array.isArray(payload.relatedSystems)) throw new Error('Failed to load related systems');
        setRelatedSystems(payload.relatedSystems);
      } catch {
        setRelatedSystemsError('Unable to load related systems.');
      }
    }

    void loadRelatedSystems();
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadCategories() {
      setCategoriesLoading(true);
      setCategoriesError('');

      try {
        const response = await fetch('/api/categories');

        if (!response.ok) {
          throw new Error('Failed to load categories');
        }

        const payload = await response.json() as { categories?: Category[] };

        if (!Array.isArray(payload.categories)) {
          throw new Error('Unexpected categories payload');
        }

        if (isActive) {
          setCategories(payload.categories);
        }
      } catch {
        if (isActive) {
          setCategories([]);
          setCategoriesError('System Status: Offline — Unable to connect to TokTickIT API');
        }
      } finally {
        if (isActive) {
          setCategoriesLoading(false);
        }
      }
    }

    void loadCategories();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    setPendingRequesterId(selectedRequesterId);
  }, [selectedRequesterId]);

  useEffect(() => {
    const handleRouteChange = () => {
      setCurrentRoute(window.location.pathname || '/');
    };

    window.addEventListener('popstate', handleRouteChange);
    return () => window.removeEventListener('popstate', handleRouteChange);
  }, []);

  useEffect(() => {
    if (!selectedRequesterId && currentRoute !== '/select-requester') {
      window.history.replaceState({}, '', '/select-requester');
      setCurrentRoute('/select-requester');
    }

    if (selectedRequesterId && currentRoute === '/select-requester') {
      window.history.replaceState({}, '', '/');
      setCurrentRoute('/');
    }
  }, [selectedRequesterId, currentRoute]);

  const navigateTo = (route: string) => {
    window.history.pushState({}, '', route);
    setCurrentRoute(route);
  };

  const handleContinue = () => {
    if (!pendingRequesterId) {
      return;
    }

    window.sessionStorage.setItem(SESSION_KEY, pendingRequesterId);
    setSelectedRequesterId(pendingRequesterId);
    navigateTo('/');
  };

  const handleRequesterSelectionChange = (nextValue: string) => {
    setPendingRequesterId(nextValue);
  };

  const goToRequesterSelection = () => {
    window.sessionStorage.removeItem(SESSION_KEY);
    setSelectedRequesterId('');
    setPendingRequesterId('');
    navigateTo('/select-requester');
  };

  // Requester Selection screen: NO header/layout wraps this one.
  if (currentRoute === '/select-requester') {
    return (
      <RequesterSelectionScreen
        requesters={requesters}
        loading={loading}
        error={error}
        selectedRequesterId={pendingRequesterId}
        onSelectionChange={handleRequesterSelectionChange}
        onContinue={handleContinue}
        onRetry={loadRequesters}
      />
    );
  }

  // Determine which page content to render inside the shared shell.
  let pageContent: ReactNode;

  const ticketDetailMatch = currentRoute.match(/^\/tickets\/(\d+)$/);

  if (currentRoute === '/create-ticket') {
    pageContent = (
      <CreateTicket
        requesterId={selectedRequesterId}
        categories={categories}
        relatedSystems={relatedSystems}
        onCancel={() => navigateTo('/')}
      />
    );
  } else if (ticketDetailMatch) {
    pageContent = (
      <RequesterTicketDetail
        requesterId={selectedRequesterId}
        ticketId={Number(ticketDetailMatch[1])}
        onBack={() => navigateTo('/')}
      />
    );
  } else {
    // Default / unknown route: normalize to "/" and show My Tickets.
    if (currentRoute !== '/') {
      window.history.replaceState({}, '', '/');
      pageContent = null;
    } else {
      pageContent = (
        <MyTickets
          requesterId={selectedRequesterId}
          onCreateTicket={() => navigateTo('/create-ticket')}
          onViewTicket={(ticketId) => navigateTo(`/tickets/${ticketId}`)}
        />
      );
    }
  }

  return (
    <AppShell
      currentRoute={currentRoute}
      selectedRequester={selectedRequester}
      onNavigate={navigateTo}
      onChangeRequester={goToRequesterSelection}
    >
      {currentRoute === '/create-ticket' && relatedSystemsError && (
        <p className="text-danger" role="alert">{relatedSystemsError}</p>
      )}
      {currentRoute === '/create-ticket' && categoriesError && (
        <p className="text-danger" role="alert">{categoriesError}</p>
      )}
      {pageContent}
    </AppShell>
  );
}
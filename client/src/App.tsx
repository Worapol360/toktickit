import { useEffect, useMemo, useState } from 'react';
import { RequesterSelectionScreen } from './lab-02/RequesterSelection';

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

const SESSION_KEY = 'toktickit-selected-requester-id';

function getStoredRequesterId() {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.sessionStorage.getItem(SESSION_KEY) ?? '';
}

export default function App() {
  const [requesters, setRequesters] = useState<Requester[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState('');
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

  return (
    <main style={{ minHeight: '100vh', background: '#F6FAF8', color: '#17221C', padding: '24px' }}>
      <header style={{ background: '#006B3C', color: '#FFFFFF', padding: '16px 24px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <strong>TikTockIT</strong>
        </div>
        <nav style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span aria-current="page">My Tickets</span>
          <button type="button" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.35)', color: '#FFFFFF', borderRadius: '6px', padding: '8px 12px' }}>
            Create Ticket
          </button>
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>{selectedRequester ? selectedRequester.name : 'No requester selected'}</span>
          <button type="button" onClick={goToRequesterSelection} style={{ background: '#FFFFFF', color: '#006B3C', border: 'none', borderRadius: '6px', padding: '8px 12px' }}>
            Change Requester
          </button>
        </div>
      </header>

      <section style={{ maxWidth: '1200px', margin: '32px auto', background: '#FFFFFF', borderRadius: '8px', padding: '24px', border: '1px solid #D7E2DC' }}>
        <div className="text-center mb-4">
          <h1 className="display-6 fw-semibold mb-2">TokTickIT IT Service Desk</h1>
          <p className="text-muted mb-0">Service categories loaded from PostgreSQL via Prisma</p>
        </div>

        <div className="d-flex justify-content-center mb-4">
          <button type="button" className="btn btn-primary px-4" onClick={() => window.location.reload()}>
            Check System
          </button>
        </div>

        {categoriesLoading ? (
          <p className="text-center text-muted mb-0" role="status">Loading categories...</p>
        ) : categoriesError ? (
          <p className="text-center text-danger mb-0" role="alert">{categoriesError}</p>
        ) : (
          <ul className="list-group list-group-flush">
            {categories.map((category) => (
              <li key={category.id} className="list-group-item d-flex justify-content-between align-items-center px-0">
                <span>{category.name}</span>
                <span className="badge text-bg-secondary rounded-pill">ID {category.id}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

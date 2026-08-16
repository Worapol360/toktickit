import { useEffect, useState } from 'react';

type Category = {
  id: number;
  name: string;
};

export default function App() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isActive = true;

    async function loadCategories() {
      setIsLoading(true);
      setErrorMessage('');

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
          setErrorMessage('System Status: Offline — Unable to connect to TokTickIT API');
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadCategories();

    return () => {
      isActive = false;
    };
  }, []);

  async function refreshCategories() {
    setIsLoading(true);

    try {
      const response = await fetch('/api/categories');

      if (!response.ok) {
        throw new Error('Failed to load categories');
      }

      const payload = await response.json() as { categories?: Category[] };

      if (!Array.isArray(payload.categories)) {
        throw new Error('Unexpected categories payload');
      }

      setCategories(payload.categories);
      setErrorMessage('');
    } catch {
      setCategories([]);
      setErrorMessage('System Status: Offline — Unable to connect to TokTickIT API');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="d-flex min-vh-100 align-items-center justify-content-center bg-light">
      <section className="card shadow-sm border-0 rounded-4 p-4" style={{ width: 'min(92vw, 640px)' }}>
        <div className="text-center mb-4">
          <h1 className="display-6 fw-semibold mb-2">TokTickIT IT Service Desk</h1>
          <p className="text-muted mb-0">Service categories loaded from PostgreSQL via Prisma</p>
        </div>

        <div className="d-flex justify-content-center mb-4">
          <button type="button" className="btn btn-primary px-4" onClick={refreshCategories}>
            Check System
          </button>
        </div>

        {isLoading ? (
          <p className="text-center text-muted mb-0" role="status">Loading categories...</p>
        ) : errorMessage ? (
          <p className="text-center text-danger mb-0" role="alert">{errorMessage}</p>
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

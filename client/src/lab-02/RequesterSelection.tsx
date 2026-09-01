import { useEffect, useState, type ChangeEvent } from 'react';

type Requester = {
  id: number;
  name: string;
  email: string;
  department: string;
  isActive: boolean;
};

type RequesterSelectionScreenProps = {
  requesters: Requester[];
  loading: boolean;
  error: string;
  selectedRequesterId: string;
  onSelectionChange: (value: string) => void;
  onContinue: () => void;
  onRetry: () => void;
};

export function RequesterSelectionScreen({
  requesters,
  loading,
  error,
  selectedRequesterId,
  onSelectionChange,
  onContinue,
  onRetry
}: RequesterSelectionScreenProps) {
  const [internalRequesterId, setInternalRequesterId] = useState(selectedRequesterId);

  useEffect(() => {
    setInternalRequesterId(selectedRequesterId);
  }, [selectedRequesterId]);

  const currentRequesterId = internalRequesterId;
  const hasSelection = currentRequesterId !== '';

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextValue = event.target.value;
    setInternalRequesterId(nextValue);
    onSelectionChange(nextValue);
  };

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#F6FAF8', padding: '24px' }}>
      <section
        aria-label="Development Requester Selection"
        style={{
          width: 'min(100%, 560px)',
          background: '#FFFFFF',
          borderRadius: '8px',
          border: '1px solid #D7E2DC',
          padding: '32px 24px',
          boxShadow: '0 2px 8px rgba(23, 34, 28, 0.08)'
        }}
      >
        <h1 style={{ margin: 0, fontSize: '32px', lineHeight: '40px' }}>Development Requester Selection</h1>
        <p style={{ marginTop: '12px', color: '#5D6B63' }}>
          Choose the active requester context used for development testing only.
        </p>

        {loading ? (
          <p role="status" style={{ marginTop: '20px', color: '#5D6B63' }}>
            Loading Development Requesters...
          </p>
        ) : error ? (
          <div role="alert" style={{ marginTop: '20px', background: '#FDECEC', border: '1px solid #B42318', borderRadius: '6px', padding: '12px 16px', color: '#B42318' }}>
            <p style={{ margin: 0 }}>{error}</p>
            <button type="button" onClick={onRetry} style={{ marginTop: '12px', background: 'transparent', border: 'none', color: '#006B3C', fontWeight: 600, cursor: 'pointer' }}>
              Retry
            </button>
          </div>
        ) : requesters.length === 0 ? (
          <div style={{ marginTop: '20px', padding: '16px', background: '#F3F6F4', borderRadius: '6px', color: '#17221C' }}>
            No active requesters are available.
          </div>
        ) : (
          <div style={{ marginTop: '20px' }}>
            <label htmlFor="requester-select" style={{ display: 'block', fontWeight: 600, marginBottom: '8px' }}>
              Development Requester <span aria-hidden="true">*</span>
            </label>
            <select
              id="requester-select"
              aria-label="Development Requester *"
              value={currentRequesterId}
              onChange={handleChange}
              style={{
                width: '100%',
                minHeight: '44px',
                borderRadius: '6px',
                border: '1px solid #D7E2DC',
                padding: '10px 12px',
                background: '#FFFFFF'
              }}
            >
              <option value="">Select a requester</option>
              {requesters.map((requester) => (
                <option key={requester.id} value={String(requester.id)}>
                  {requester.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            disabled={!hasSelection || loading || Boolean(error)}
            onClick={onContinue}
            style={{
              minHeight: '44px',
              padding: '10px 18px',
              borderRadius: '6px',
              border: 'none',
              background: !hasSelection || loading || Boolean(error) ? '#B0C9BE' : '#006B3C',
              color: '#FFFFFF',
              cursor: !hasSelection || loading || Boolean(error) ? 'not-allowed' : 'pointer',
              fontWeight: 600
            }}
          >
            Continue
          </button>
        </div>
      </section>
    </main>
  );
}

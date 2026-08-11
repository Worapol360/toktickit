import { useState } from 'react';

export default function App() {
  const [statusMessage, setStatusMessage] = useState('');

  async function checkSystemHealth() {
    try {
      const response = await fetch('/api/health');

      if (!response.ok) {
        throw new Error('Unable to connect to TokTickIT API');
      }

      const payload = await response.json() as { status?: string; service?: string };

      if (payload.status === 'ok' && payload.service === 'TokTickIT API') {
        setStatusMessage(`System Status: Online — ${payload.service}`);
      } else {
        throw new Error('Unexpected health payload');
      }
    } catch {
      setStatusMessage('System Status: Offline — Unable to connect to TokTickIT API');
    }
  }

  return (
    <main className="d-flex min-vh-100 align-items-center justify-content-center bg-light">
      <section className="card shadow-sm border-0 rounded-4 p-4 text-center" style={{ width: 'min(92vw, 560px)' }}>
        <h1 className="display-6 fw-semibold mb-4">TokTickIT IT Service Desk</h1>
        <button type="button" className="btn btn-primary" onClick={checkSystemHealth}>Check System</button>
        <p className="text-muted mt-3 mb-0">{statusMessage}</p>
      </section>
    </main>
  );
}

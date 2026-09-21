import { useEffect, useState } from 'react';
import { AttachmentSection, type Attachment } from './AttachmentSection';

type Ticket = {
  id: number;
  ticketNumber: string;
  summary: string;
  description: string;
  requestedPriority: string;
  status: string;
  category: { name: string };
  relatedSystem: { name: string };
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
};

type RequesterTicketDetailProps = { requesterId: string; ticketId: number; onBack: () => void };

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export function RequesterTicketDetail({ requesterId, ticketId, onBack }: RequesterTicketDetailProps) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');

  const loadTicket = async () => {
    setLoading(true);
    setError('');
    setNotFound(false);
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, { credentials: 'same-origin' });
      if (response.status === 404) {
        setNotFound(true);
        return;
      }
      const body = await response.json() as { ticket?: Ticket; error?: { message?: string } };
      if (!response.ok || !body.ticket) throw new Error(body.error?.message ?? 'Unable to load ticket.');
      setTicket(body.ticket);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load ticket.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadTicket(); }, [requesterId, ticketId]);

  if (loading) return <main aria-label="Ticket detail"><p role="status">Loading ticket...</p></main>;
  if (notFound) return <main aria-label="Ticket detail"><h1>Ticket not found</h1><p>The requested ticket is unavailable.</p><button type="button" onClick={onBack}>Back to My Tickets</button></main>;
  if (error || !ticket) return <main aria-label="Ticket detail"><div role="alert">{error || 'Unable to load ticket.'}</div><button type="button" onClick={() => void loadTicket()}>Retry</button><button type="button" onClick={onBack}>Back to My Tickets</button></main>;

  return (
    <main aria-label="Ticket detail">
      <button type="button" onClick={onBack}>Back to My Tickets</button>
      <article>
        <h1>{ticket.ticketNumber}</h1>
        <p>Status: <strong>{ticket.status}</strong></p>
        <dl>
          <dt>Summary</dt><dd>{ticket.summary}</dd>
          <dt>Description</dt><dd>{ticket.description}</dd>
          <dt>Category</dt><dd>{ticket.category.name}</dd>
          <dt>Related System</dt><dd>{ticket.relatedSystem.name}</dd>
          <dt>Requested Priority</dt><dd>{ticket.requestedPriority}</dd>
          <dt>Created Date</dt><dd>{formatDate(ticket.createdAt)}</dd>
          <dt>Last Updated</dt><dd>{formatDate(ticket.updatedAt)}</dd>
        </dl>
      </article>
      <AttachmentSection ticketId={ticket.id} requesterId={requesterId} attachments={ticket.attachments} onChanged={() => void loadTicket()} />
    </main>
  );
}
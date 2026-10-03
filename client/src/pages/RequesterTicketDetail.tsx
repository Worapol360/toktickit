import { useEffect, useState } from 'react';
import { AttachmentSection, type Attachment } from './AttachmentSection';
import { CommentThread, type PublicComment } from './CommentThread';

type Ticket = {
  id: number;
  ticketNumber: string;
  summary: string;
  description: string;
  requestedPriority: string;
  status: string;
  requesterMarkedResolved?: boolean;
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
  const [comments, setComments] = useState<PublicComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState('');

  const loadTicketAndComments = async () => {
    setLoading(true);
    setError('');
    setNotFound(false);
    try {
      const [ticketRes, commentsRes] = await Promise.all([
        fetch(`/api/tickets/${ticketId}`, { credentials: 'same-origin' }),
        fetch(`/api/tickets/${ticketId}/comments`, { credentials: 'same-origin' })
      ]);

      if (ticketRes.status === 404) {
        setNotFound(true);
        return;
      }

      const ticketBody = await ticketRes.json() as { ticket?: Ticket; error?: { message?: string } };
      if (!ticketRes.ok || !ticketBody.ticket) throw new Error(ticketBody.error?.message ?? 'Unable to load ticket.');
      setTicket(ticketBody.ticket);

      if (commentsRes.ok) {
        const commentsBody = await commentsRes.json() as { comments?: PublicComment[] };
        setComments(commentsBody.comments ?? []);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load ticket.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadTicketAndComments(); }, [requesterId, ticketId]);

  const handleMarkResolved = async () => {
    if (!ticket) return;
    setResolving(true);
    setResolveError('');
    try {
      const response = await fetch(`/api/tickets/${ticket.id}/mark-resolved`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'same-origin'
      });
      const body = await response.json();
      if (!response.ok || !body.ticket) {
        throw new Error(body.error?.message ?? 'Failed to mark problem as resolved.');
      }
      setTicket((prev) => prev ? { ...prev, requesterMarkedResolved: true } : prev);
    } catch (err) {
      setResolveError(err instanceof Error ? err.message : 'Failed to mark problem as resolved.');
    } finally {
      setResolving(false);
    }
  };

  if (loading) return <main aria-label="Ticket detail"><p role="status">Loading ticket...</p></main>;
  if (notFound) return <main aria-label="Ticket detail"><h1>Ticket not found</h1><p>The requested ticket is unavailable.</p><button type="button" onClick={onBack}>Back to My Tickets</button></main>;
  if (error || !ticket) return <main aria-label="Ticket detail"><div role="alert">{error || 'Unable to load ticket.'}</div><button type="button" onClick={() => void loadTicketAndComments()}>Retry</button><button type="button" onClick={onBack}>Back to My Tickets</button></main>;

  const isClosedOrCancelled = ['Closed', 'Cancelled'].includes(ticket.status);

  return (
    <main aria-label="Ticket detail">
      <button type="button" onClick={onBack} style={{ marginBottom: 16 }}>Back to My Tickets</button>
      <article style={{ background: '#FFFFFF', border: '1px solid #D7E2DC', borderRadius: 8, padding: 24, marginBottom: 24 }}>
        <h1>{ticket.ticketNumber}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <p style={{ margin: 0 }}>Status: <strong className="badge status-badge">{ticket.status}</strong></p>
          {!isClosedOrCancelled && (
            ticket.requesterMarkedResolved ? (
              <span className="badge" style={{ background: '#EAF6EF', color: '#006B3C', fontWeight: 600 }}>
                You marked this as appearing resolved
              </span>
            ) : (
              <button
                type="button"
                onClick={handleMarkResolved}
                disabled={resolving}
                style={{
                  background: '#FFFFFF',
                  color: '#006B3C',
                  border: '1px solid #006B3C',
                  borderRadius: 6,
                  padding: '4px 12px',
                  fontWeight: 600,
                  cursor: resolving ? 'not-allowed' : 'pointer',
                  minWidth: 'auto'
                }}
              >
                {resolving ? 'Marking...' : 'Problem Appears Resolved'}
              </button>
            )
          )}
        </div>
        {resolveError && <div role="alert" style={{ color: '#B42318', marginBottom: 12 }}>{resolveError}</div>}
        <dl>
          <dt>Summary</dt><dd>{ticket.summary}</dd>
          <dt>Description</dt><dd>{ticket.description}</dd>
          <dt>Category</dt><dd>{ticket.category.name}</dd>
          <dt>Related System</dt><dd>{ticket.relatedSystem.name}</dd>
          <dt>Requested Priority</dt><dd><span className="badge priority-badge">{ticket.requestedPriority}</span></dd>
          <dt>Created Date</dt><dd>{formatDate(ticket.createdAt)}</dd>
          <dt>Last Updated</dt><dd>{formatDate(ticket.updatedAt)}</dd>
        </dl>
      </article>
      <AttachmentSection ticketId={ticket.id} requesterId={requesterId} attachments={ticket.attachments} onChanged={() => void loadTicketAndComments()} />
      <CommentThread
        ticketId={ticket.id}
        comments={comments}
        onCommentAdded={(newComment) => setComments((prev) => [...prev, newComment])}
      />
    </main>
  );
}
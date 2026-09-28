import { useEffect, useState } from 'react';
import { AttachmentSection, type Attachment } from './AttachmentSection';
import { CommentThread, type PublicComment } from './CommentThread';
import { InternalNotesSection, type InternalNote } from './InternalNotesSection';

type UserOption = {
  id: number;
  name: string;
  role: string;
};

type Ticket = {
  id: number;
  ticketNumber: string;
  summary: string;
  description: string;
  requestedPriority: string;
  itPriority?: string | null;
  status: string;
  requesterMarkedResolved?: boolean;
  requester?: { id: number; name: string; email?: string; department?: string } | null;
  ownerId?: number | null;
  owner?: { id: number; name: string; email?: string; role?: string } | null;
  category: { id: number; name: string; code?: string; isActive?: boolean };
  relatedSystem: { id: number; name: string; code?: string; isActive?: boolean };
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
};

const ALL_STATUSES = [
  'New',
  'Open',
  'In Progress',
  'Waiting for Requester',
  'Resolved',
  'Closed',
  'Reopened',
  'Cancelled'
];

const PERMITTED_TRANSITIONS: Record<string, string[]> = {
  'New': ['Open', 'Cancelled'],
  'Open': ['In Progress', 'Cancelled'],
  'In Progress': ['Waiting for Requester', 'Resolved', 'Cancelled'],
  'Waiting for Requester': ['In Progress', 'Resolved', 'Cancelled'],
  'Resolved': ['Closed', 'Reopened'],
  'Closed': ['Reopened'],
  'Reopened': ['In Progress', 'Cancelled'],
  'Cancelled': []
};

const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];

type StaffTicketDetailProps = {
  ticketId: number;
  currentUserId?: number;
  onBack: () => void;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export function StaffTicketDetail({ ticketId, currentUserId, onBack }: StaffTicketDetailProps) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<PublicComment[]>([]);
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [savingPriority, setSavingPriority] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingOwner, setSavingOwner] = useState(false);
  const [showReassign, setShowReassign] = useState(false);
  const [staffUsers, setStaffUsers] = useState<UserOption[]>([]);
  const [selectedReassignUser, setSelectedReassignUser] = useState<string>('');

  const loadTicketData = async () => {
    setLoading(true);
    setError('');
    setNotFound(false);
    try {
      const response = await fetch(`/api/staff/tickets/${ticketId}`, { credentials: 'same-origin' });
      if (response.status === 404) {
        setNotFound(true);
        return;
      }
      const body = await response.json();
      if (!response.ok || !body.ticket) {
        throw new Error(body.error?.message ?? 'Unable to load ticket details.');
      }
      setTicket(body.ticket);
      setComments(body.comments ?? []);
      setNotes(body.notes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load ticket details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTicketData();
  }, [ticketId]);

  const handleClaim = async () => {
    if (!ticket || !currentUserId) return;
    setSavingOwner(true);
    setActionError('');
    try {
      const res = await fetch(`/api/staff/tickets/${ticket.id}/owner`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'same-origin',
        body: JSON.stringify({ ownerId: currentUserId })
      });
      const body = await res.json();
      if (!res.ok || !body.ticket) {
        throw new Error(body.error?.message ?? 'Failed to claim ticket.');
      }
      setTicket((prev) => prev ? { ...prev, ...body.ticket } : prev);
      setShowReassign(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to claim ticket.');
    } finally {
      setSavingOwner(false);
    }
  };

  const handleOpenReassign = async () => {
    setShowReassign(true);
    setActionError('');
    try {
      // If admin users endpoint or mock staff users available
      const res = await fetch('/api/admin/users', { credentials: 'same-origin' });
      if (res.ok) {
        const body = await res.json();
        const activeStaff = (body.users ?? []).filter((u: any) => u.isActive && (u.role === 'IT_STAFF' || u.role === 'ADMINISTRATOR'));
        setStaffUsers(activeStaff);
      }
    } catch {
      // Best effort
    }
  };

  const handleReassign = async () => {
    if (!ticket || !selectedReassignUser) return;
    setSavingOwner(true);
    setActionError('');
    try {
      const res = await fetch(`/api/staff/tickets/${ticket.id}/owner`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'same-origin',
        body: JSON.stringify({ ownerId: Number(selectedReassignUser) })
      });
      const body = await res.json();
      if (!res.ok || !body.ticket) {
        throw new Error(body.error?.message ?? 'Failed to reassign ticket.');
      }
      setTicket((prev) => prev ? { ...prev, ...body.ticket } : prev);
      setShowReassign(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to reassign ticket.');
    } finally {
      setSavingOwner(false);
    }
  };

  const handlePriorityChange = async (newPriority: string) => {
    if (!ticket) return;
    setSavingPriority(true);
    setActionError('');
    try {
      const res = await fetch(`/api/staff/tickets/${ticket.id}/priority`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'same-origin',
        body: JSON.stringify({ itPriority: newPriority })
      });
      const body = await res.json();
      if (!res.ok || !body.ticket) {
        throw new Error(body.error?.message ?? 'Failed to update IT Priority.');
      }
      setTicket((prev) => prev ? { ...prev, itPriority: body.ticket.itPriority } : prev);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update IT Priority.');
    } finally {
      setSavingPriority(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!ticket) return;
    setSavingStatus(true);
    setActionError('');
    try {
      const res = await fetch(`/api/staff/tickets/${ticket.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'same-origin',
        body: JSON.stringify({ status: newStatus })
      });
      const body = await res.json();
      if (!res.ok || !body.ticket) {
        throw new Error(body.error?.message ?? 'Failed to update status.');
      }
      setTicket((prev) => prev ? { ...prev, status: body.ticket.status } : prev);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update status.');
    } finally {
      setSavingStatus(false);
    }
  };

  if (loading) return <main aria-label="Staff ticket detail"><p role="status">Loading ticket details...</p></main>;
  if (notFound) return <main aria-label="Staff ticket detail"><h1>Ticket not found</h1><p>The requested ticket does not exist.</p><button type="button" onClick={onBack}>Back to Queue</button></main>;
  if (error || !ticket) return <main aria-label="Staff ticket detail"><div role="alert">{error || 'Unable to load ticket.'}</div><button type="button" onClick={() => void loadTicketData()}>Retry</button><button type="button" onClick={onBack}>Back to Queue</button></main>;

  const allowedNextStatuses = PERMITTED_TRANSITIONS[ticket.status] ?? [];

  return (
    <main aria-label="Staff ticket detail">
      <button type="button" onClick={onBack} style={{ marginBottom: 16 }}>Back to Queue</button>

      <article style={{ background: '#FFFFFF', border: '1px solid #D7E2DC', borderRadius: 8, padding: 24, marginBottom: 24 }}>
        <h1>{ticket.ticketNumber}</h1>

        {actionError && (
          <div role="alert" style={{ background: '#FDECEC', color: '#B42318', padding: '10px 16px', borderRadius: 6, marginBottom: 16 }}>
            {actionError}
          </div>
        )}

        {/* Staff Controls Section */}
        <section
          aria-label="Staff Controls"
          style={{
            background: '#F6FAF8',
            border: '1px solid #D7E2DC',
            borderRadius: 8,
            padding: 16,
            marginBottom: 24,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 16
          }}
        >
          {/* Ownership control */}
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Ticket Owner</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {ticket.owner ? (
                <span style={{ fontWeight: 600 }}>{ticket.owner.name}</span>
              ) : (
                <span className="badge ownership-badge">Unassigned</span>
              )}

              {ticket.ownerId !== currentUserId && (
                <button
                  type="button"
                  onClick={handleClaim}
                  disabled={savingOwner}
                  style={{
                    background: '#006B3C',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: 6,
                    padding: '4px 12px',
                    fontWeight: 600,
                    cursor: savingOwner ? 'not-allowed' : 'pointer',
                    minWidth: 'auto'
                  }}
                >
                  {savingOwner ? 'Claiming...' : 'Claim'}
                </button>
              )}

              <button
                type="button"
                onClick={() => (showReassign ? setShowReassign(false) : void handleOpenReassign())}
                style={{
                  background: '#FFFFFF',
                  color: '#17221C',
                  border: '1px solid #D7E2DC',
                  borderRadius: 6,
                  padding: '4px 12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  minWidth: 'auto'
                }}
              >
                {showReassign ? 'Cancel' : 'Reassign'}
              </button>
            </div>

            {showReassign && (
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                <select
                  aria-label="Select new owner"
                  value={selectedReassignUser}
                  onChange={(e) => setSelectedReassignUser(e.target.value)}
                  style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #D7E2DC' }}
                >
                  <option value="">Select staff user...</option>
                  {staffUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role === 'ADMINISTRATOR' ? 'Admin' : 'IT Staff'})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleReassign}
                  disabled={savingOwner || !selectedReassignUser}
                  style={{
                    background: '#006B3C',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: 6,
                    padding: '4px 8px',
                    fontWeight: 600,
                    minWidth: 'auto'
                  }}
                >
                  Save
                </button>
              </div>
            )}
          </div>

          {/* IT Priority control */}
          <div>
            <label htmlFor="it-priority-select" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
              IT Priority
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <select
                id="it-priority-select"
                aria-label="IT Priority"
                value={ticket.itPriority ?? ticket.requestedPriority}
                onChange={(e) => handlePriorityChange(e.target.value)}
                disabled={savingPriority}
                style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #D7E2DC', fontWeight: 600 }}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: 13, color: '#556960' }}>
                (Req: <span className="badge priority-badge">{ticket.requestedPriority}</span>)
              </span>
            </div>
          </div>

          {/* Status control */}
          <div>
            <label htmlFor="ticket-status-select" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
              Status
            </label>
            <select
              id="ticket-status-select"
              aria-label="Status"
              value={ticket.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={savingStatus}
              style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #D7E2DC', fontWeight: 600 }}
            >
              {ALL_STATUSES.map((statusName) => {
                const isCurrent = statusName === ticket.status;
                const isAllowed = isCurrent || allowedNextStatuses.includes(statusName);
                return (
                  <option
                    key={statusName}
                    value={statusName}
                    disabled={!isAllowed}
                  >
                    {statusName}{!isAllowed ? ` (Not permitted from ${ticket.status})` : ''}
                  </option>
                );
              })}
            </select>
          </div>
        </section>

        {/* Ticket Metadata */}
        <dl>
          <dt>Summary</dt><dd>{ticket.summary}</dd>
          <dt>Description</dt><dd>{ticket.description}</dd>
          <dt>Requester</dt><dd>{ticket.requester?.name ?? 'Requester'} ({ticket.requester?.email ?? ''})</dd>
          <dt>Category</dt><dd>{ticket.category.name}</dd>
          <dt>Related System</dt><dd>{ticket.relatedSystem.name}</dd>
          <dt>Requested Priority</dt><dd><span className="badge priority-badge">{ticket.requestedPriority}</span></dd>
          <dt>IT Priority</dt><dd><span className="badge priority-badge">{ticket.itPriority ?? ticket.requestedPriority}</span></dd>
          <dt>Created Date</dt><dd>{formatDate(ticket.createdAt)}</dd>
          <dt>Last Updated</dt><dd>{formatDate(ticket.updatedAt)}</dd>
        </dl>
      </article>

      <AttachmentSection ticketId={ticket.id} requesterId={String(ticket.requester?.id ?? '')} attachments={ticket.attachments} onChanged={() => void loadTicketData()} />

      <CommentThread
        ticketId={ticket.id}
        comments={comments}
        onCommentAdded={(newComment) => setComments((prev) => [...prev, newComment])}
      />

      <InternalNotesSection
        ticketId={ticket.id}
        notes={notes}
        onNoteAdded={(newNote) => setNotes((prev) => [...prev, newNote])}
      />
    </main>
  );
}

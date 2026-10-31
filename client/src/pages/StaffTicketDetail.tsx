import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';

import { ActionsTakenPanel } from '../lab-04/ActionsTakenPanel';
import { AttachmentSection, type Attachment } from './AttachmentSection';
import { CommentThread, type PublicComment } from './CommentThread';
import { InternalNotesSection, type InternalNote } from './InternalNotesSection';

type UserOption = {
  id: number;
  name: string;
};

type Ticket = {
  id: number;
  ticketNumber: string;
  summary: string;
  description: string;
  requestedPriority: string;
  itPriority?: string | null;
  status: string;
  version: number;
  resolvedAt?: string | null;
  allowedTransitions?: string[];
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

const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];

const CONFIRM_VERBS: Record<string, string> = {
  Resolved: 'Mark as Resolved',
  Cancelled: 'Cancel Ticket',
  Closed: 'Close Ticket',
  Reopened: 'Reopen Ticket'
};

function needsConfirmation(from: string, to: string): boolean {
  return to === 'Cancelled' || to === 'Resolved' || to === 'Reopened' || (from === 'Resolved' && to === 'Closed');
}

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
  const [selectedStatus, setSelectedStatus] = useState('');
  const [statusAlert, setStatusAlert] = useState('');
  const [statusAnnouncement, setStatusAnnouncement] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [actionsSummary, setActionsSummary] = useState({ total: 0, openFollowUps: 0 });
  const [reloadNonce, setReloadNonce] = useState(0);
  const [panelReloadToken, setPanelReloadToken] = useState(0);
  const updateStatusButtonRef = useRef<HTMLButtonElement | null>(null);
  const statusSelectRef = useRef<HTMLSelectElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogWasOpenRef = useRef(false);

  const loadTicketData = async (quiet = false) => {
    if (!quiet) {
      setLoading(true);
      setError('');
      setNotFound(false);
    }
    try {
      const response = await fetch(`/api/staff/tickets/${ticketId}`, { credentials: 'same-origin' });
      if (response.status === 404) {
        if (!quiet) setNotFound(true);
        return;
      }
      const body = await response.json();
      if (!response.ok || !body.ticket) {
        throw new Error(body.error?.message ?? 'Unable to load ticket details.');
      }
      setTicket(body.ticket);
      setComments(body.comments ?? []);
      setNotes(body.notes ?? []);
      if (quiet) setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load ticket details.');
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    void loadTicketData();
  }, [ticketId]);

  // Conflicted status changes reload the Ticket + actions; the PATCH is never re-sent.
  useEffect(() => {
    if (reloadNonce === 0) return;
    void loadTicketData(true);
    setPanelReloadToken((token) => token + 1);
  }, [reloadNonce]);

  // Focus returns to the control that opened the confirmation dialog.
  useEffect(() => {
    if (confirmOpen) {
      dialogWasOpenRef.current = true;
      confirmButtonRef.current?.focus();
      return;
    }
    if (dialogWasOpenRef.current) {
      dialogWasOpenRef.current = false;
      updateStatusButtonRef.current?.focus();
    }
  }, [confirmOpen]);

  // A controlled select with an empty value keeps the browser's selection otherwise;
  // clear it when nothing is selected (initial state, after success or a conflict reload).
  useEffect(() => {
    const node = statusSelectRef.current;
    if (node && selectedStatus === '' && node.selectedIndex !== -1) {
      node.selectedIndex = -1;
    }
  }, [selectedStatus, ticket]);

  const handleSummaryChange = (summary: { total: number; openFollowUps: number }) => {
    setActionsSummary((prev) =>
      prev.total === summary.total && prev.openFollowUps === summary.openFollowUps ? prev : summary
    );
  };

  const handleReloadAfterConflict = (message: string) => {
    setStatusAlert(message);
    setSelectedStatus('');
    setSelectedReassignUser('');
    setConfirmOpen(false);
    setReloadNonce((nonce) => nonce + 1);
  };

  const refreshTicketMeta = async () => {
    try {
      const response = await fetch(`/api/staff/tickets/${ticketId}`, { credentials: 'same-origin' });
      if (!response.ok) return;
      const body = await response.json();
      if (body.ticket) {
        setTicket((prev) => prev ? {
          ...prev,
          status: body.ticket.status ?? prev.status,
          updatedAt: body.ticket.updatedAt ?? prev.updatedAt
        } : prev);
      }
    } catch {
      // Best effort: keep the currently displayed summary.
    }
  };

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
        body: JSON.stringify({ ownerId: currentUserId, expectedVersion: ticket.version })
      });
      const body = await res.json();
      if (!res.ok || !body.ticket) {
        if (res.status === 409 && body.error?.code === 'VERSION_CONFLICT') {
          handleReloadAfterConflict('This ticket was updated by someone else. Reloaded the latest version.');
          return;
        }
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
    if (!ticket) return;
    setShowReassign(true);
    setActionError('');
    try {
      const res = await fetch(`/api/staff/tickets/${ticket.id}/assignable-owners`, { credentials: 'same-origin' });
      if (res.ok) {
        const body = await res.json();
        setStaffUsers(body.owners ?? []);
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
        body: JSON.stringify({ ownerId: Number(selectedReassignUser), expectedVersion: ticket.version })
      });
      const body = await res.json();
      if (!res.ok || !body.ticket) {
        if (res.status === 409 && body.error?.code === 'VERSION_CONFLICT') {
          handleReloadAfterConflict('This ticket was updated by someone else. Reloaded the latest version.');
          return;
        }
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
        body: JSON.stringify({ itPriority: newPriority, expectedVersion: ticket.version })
      });
      const body = await res.json();
      if (!res.ok || !body.ticket) {
        if (res.status === 409 && body.error?.code === 'VERSION_CONFLICT') {
          handleReloadAfterConflict('This ticket was updated by someone else. Reloaded the latest version.');
          return;
        }
        throw new Error(body.error?.message ?? 'Failed to update IT Priority.');
      }
      setTicket((prev) => prev ? { ...prev, ...body.ticket } : prev);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update IT Priority.');
    } finally {
      setSavingPriority(false);
    }
  };

  const handleStatusSelectChange = (value: string) => {
    setSelectedStatus(value);
    setStatusAlert('');
  };

  const performStatusChange = async (newStatus: string) => {
    if (!ticket || !newStatus) return;
    setSavingStatus(true);
    setStatusAlert('');
    try {
      const res = await fetch(`/api/staff/tickets/${ticket.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'same-origin',
        body: JSON.stringify({ status: newStatus, expectedVersion: ticket.version })
      });
      const body = await res.json();
      if (res.ok && body.ticket) {
        setTicket(body.ticket as Ticket);
        setSelectedStatus('');
        setStatusAlert('');
        setStatusAnnouncement(`Status changed to ${body.ticket.status}.`);
        return;
      }
      const code = body.error?.code as string | undefined;
      const details = (body.error?.details ?? {}) as { reason?: string; openFollowUps?: number };
      if (code === 'RESOLUTION_BLOCKED') {
        setStatusAlert(
          details.reason === 'OPEN_FOLLOW_UPS'
            ? `Complete ${details.openFollowUps ?? 0} open follow-up(s) before resolving.`
            : 'Record at least one action before resolving.'
        );
        setConfirmOpen(false);
        return;
      }
      if (code === 'INVALID_STATUS_TRANSITION') {
        handleReloadAfterConflict('That status change is no longer allowed. The ticket may have changed — reloaded.');
        return;
      }
      if (code === 'VERSION_CONFLICT') {
        handleReloadAfterConflict('This ticket was updated by someone else. Reloaded the latest version.');
        return;
      }
      setStatusAlert(body.error?.message ?? 'Failed to update status.');
      setConfirmOpen(false);
    } catch {
      setStatusAlert('Failed to update status.');
      setConfirmOpen(false);
    } finally {
      setSavingStatus(false);
    }
  };

  const handleUpdateStatus = () => {
    if (!ticket || !selectedStatus) return;
    if (needsConfirmation(ticket.status, selectedStatus)) {
      setStatusAlert('');
      setConfirmOpen(true);
      return;
    }
    void performStatusChange(selectedStatus);
  };

  const handleCancelConfirm = () => {
    setConfirmOpen(false);
  };

  const handleConfirmStatusChange = () => {
    const newStatus = selectedStatus;
    setConfirmOpen(false);
    void performStatusChange(newStatus);
  };

  const handleConfirmKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      setConfirmOpen(false);
      return;
    }
    if (event.key === 'Tab') {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!active || !dialog.contains(active)) {
        event.preventDefault();
        first.focus();
        return;
      }
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  if (loading) return <main aria-label="Staff ticket detail"><p role="status">Loading ticket details...</p></main>;
  if (notFound) return <main aria-label="Staff ticket detail"><h1>Ticket not found</h1><p>The requested ticket does not exist.</p><button type="button" onClick={onBack}>Back to Queue</button></main>;
  if (error || !ticket) return <main aria-label="Staff ticket detail"><div role="alert">{error || 'Unable to load ticket.'}</div><button type="button" onClick={() => void loadTicketData()}>Retry</button><button type="button" onClick={onBack}>Back to Queue</button></main>;

  // Missing (field absent) is a load/contract failure; an empty array is a valid
  // "no transitions left" state (D-15: only the server computes the matrix).
  const transitionsFromServer = ticket.allowedTransitions;
  const allowedTransitionsMissing = !Array.isArray(transitionsFromServer);
  const allowedNextStatuses: string[] = Array.isArray(transitionsFromServer) ? transitionsFromServer : [];
  const gateBlocked =
    selectedStatus === 'Resolved' && (actionsSummary.total === 0 || actionsSummary.openFollowUps > 0);
  const gateMessage =
    actionsSummary.total === 0
      ? 'Record at least one action before resolving.'
      : `Complete ${actionsSummary.openFollowUps} open follow-up(s) before resolving.`;

  return (
    <main aria-label="Staff ticket detail">
      <button type="button" onClick={onBack} style={{ marginBottom: 16 }}>Back to Queue</button>

      <article style={{ background: '#FFFFFF', border: '1px solid #D7E2DC', borderRadius: 8, padding: 24, marginBottom: 24 }}>
        <h1>
          {ticket.ticketNumber}{' '}
          <span className="badge status-badge">{ticket.status}</span>
        </h1>

        {ticket.requesterMarkedResolved && (
          <p>
            <span className="badge requester-resolved-badge">
              <span aria-hidden="true">✔</span> Requester reports resolved
            </span>
          </p>
        )}

        <p role="status">{statusAnnouncement}</p>

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
                      {u.name}
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
              Change status
            </label>
            {allowedTransitionsMissing ? (
              <p>
                Status options are unavailable. Please reload.{' '}
                <button
                  type="button"
                  onClick={() => void loadTicketData(true)}
                  style={{
                    background: '#FFFFFF',
                    color: '#17221C',
                    border: '1px solid #D7E2DC',
                    borderRadius: 6,
                    padding: '4px 10px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Reload
                </button>
              </p>
            ) : allowedNextStatuses.length === 0 ? (
              <span>No further status changes are possible.</span>
            ) : (
              <>
                <select
                  id="ticket-status-select"
                  ref={statusSelectRef}
                  aria-label="Change status"
                  value={selectedStatus}
                  onChange={(e) => handleStatusSelectChange(e.target.value)}
                  style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #D7E2DC', fontWeight: 600 }}
                >
                  {allowedNextStatuses.map((statusName) => (
                    <option key={statusName} value={statusName}>
                      {statusName}
                    </option>
                  ))}
                </select>
                <div style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    ref={updateStatusButtonRef}
                    onClick={handleUpdateStatus}
                    disabled={savingStatus || gateBlocked}
                    aria-describedby={gateBlocked ? 'resolve-gate-help' : undefined}
                    style={{
                      background: '#006B3C',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: 6,
                      padding: '6px 14px',
                      fontWeight: 600,
                      cursor: savingStatus || gateBlocked ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {savingStatus ? 'Updating...' : 'Update status'}
                  </button>
                  {gateBlocked && (
                    <p id="resolve-gate-help" style={{ margin: '6px 0 0', fontSize: 13, color: '#B42318' }}>
                      {gateMessage}
                    </p>
                  )}
                </div>
                {statusAlert && (
                  <div role="alert" style={{ marginTop: 8, background: '#FDECEC', color: '#B42318', padding: '8px 12px', borderRadius: 6 }}>
                    {statusAlert}
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {confirmOpen && selectedStatus && ticket && (
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="status-confirm-title"
            tabIndex={-1}
            onKeyDown={handleConfirmKeyDown}
            style={{
              marginTop: 16,
              background: '#FFFFFF',
              border: '1px solid #D7E2DC',
              borderRadius: 8,
              padding: 20
            }}
          >
            <h2 id="status-confirm-title" style={{ marginTop: 0 }}>
              Change status from {ticket.status} to {selectedStatus}?
            </h2>
            <p>
              {selectedStatus === 'Resolved'
                ? 'The requester will see the ticket as resolved. You can reopen it later.'
                : 'This changes what the requester and staff see in the queue.'}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleCancelConfirm}
                style={{
                  background: '#FFFFFF',
                  color: '#17221C',
                  border: '1px solid #D7E2DC',
                  borderRadius: 6,
                  padding: '6px 14px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                ref={confirmButtonRef}
                onClick={handleConfirmStatusChange}
                style={{
                  background: '#006B3C',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 6,
                  padding: '6px 14px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {CONFIRM_VERBS[selectedStatus] ?? 'Confirm'}
              </button>
            </div>
          </div>
        )}

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

      <ActionsTakenPanel
        ticketId={ticket.id}
        ticketStatus={ticket.status}
        ticketCreatedAt={ticket.createdAt}
        viewer="staff"
        onActionsChanged={() => void refreshTicketMeta()}
        onSummaryChange={handleSummaryChange}
        reloadToken={panelReloadToken}
      />

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

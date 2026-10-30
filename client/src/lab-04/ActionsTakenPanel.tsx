import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useOptionalAuth } from '../AuthContext';
import {
  ACTION_FORM_FIELD_ORDER,
  bangkokLocalToIsoUtc,
  formatBangkokDateTime,
  formatBangkokLocalInput,
  validateActionForm,
  type ActionFormErrors,
  type ActionFormValues
} from './actionForm';
import {
  ActionsApiError,
  createActionTaken,
  listActionsTaken,
  newClientRequestId,
  updateActionTaken,
  type ActionTakenDto,
  type ActionsTakenListResponse
} from './actionsTakenApi';

const TIME_ZONE_LABEL = 'All times in GMT+7';

const LOCKED_STATUSES = ['Resolved', 'Closed', 'Cancelled'];

const SAFE_SAVE_ERROR = "We couldn't save the action. Your entries are kept — please try again.";
const SAFE_LOAD_ERROR = "We couldn't load the actions. Please try again.";
const CONFLICT_MESSAGE = 'This action was changed by someone else. Reload to see the latest version.';
const FORBIDDEN_MESSAGE = "You don't have permission to change actions.";
const NOT_FOUND_MESSAGE = 'This ticket or action is no longer available.';
const SAVED_ANNOUNCEMENT = 'Action saved.';

const FIELD_IDS: Record<Exclude<keyof ActionFormValues, 'followUpRequired'>, string> = {
  actionAt: 'action-at',
  description: 'action-description',
  result: 'action-result',
  followUpNote: 'action-followup-note',
  attachmentNotes: 'action-attachment-notes'
};

type Viewer = 'staff' | 'requester';

export type ActionsTakenPanelProps = {
  ticketId: number;
  ticketStatus: string;
  ticketCreatedAt: string;
  viewer: Viewer;
  currentUserName?: string;
  onActionsChanged?: () => void;
};

type LoadState = 'loading' | 'ready' | 'forbidden' | 'notfound' | 'error';

type WriteFailure = {
  kind: 'validation' | 'locked' | 'conflict' | 'forbidden' | 'notfound' | 'safe';
  message: string;
};

type LoadOutcome = Pick<ActionsTakenListResponse, 'actionsTaken' | 'summary'>;

const EMPTY_LIST: LoadOutcome = { actionsTaken: [], summary: { total: 0, openFollowUps: 0 } };

function emptyFormValues(actionAtLocal: string): ActionFormValues {
  return {
    actionAt: actionAtLocal,
    description: '',
    result: '',
    followUpRequired: false,
    followUpNote: '',
    attachmentNotes: ''
  };
}

function valuesFromAction(action: ActionTakenDto): ActionFormValues {
  return {
    actionAt: formatBangkokLocalInput(action.actionAt),
    description: action.description,
    result: action.result,
    followUpRequired: action.followUpRequired,
    followUpNote: action.followUpNote ?? '',
    attachmentNotes: action.attachmentNotes ?? ''
  };
}

function lockedExplanation(status: string) {
  return `Actions can't be changed while the Ticket is ${status}. Reopen the Ticket to add or edit actions.`;
}

function FollowUpCue({ action }: { action: ActionTakenDto }) {
  if (!action.followUpRequired) return <>Not required</>;
  if (!action.followUpCompletedAt) {
    return <span className="followup-open">⚠ Follow-up open — {action.followUpNote}</span>;
  }
  return <span className="followup-done">✔ Follow-up done</span>;
}

function EditedMarker({ action }: { action: ActionTakenDto }) {
  if (action.version <= 1) return null;
  return (
    <span className="actions-edited-marker">
      Edited by {action.updatedBy.name} at {formatBangkokDateTime(action.updatedAt)}
    </span>
  );
}

export function ActionsTakenPanel({
  ticketId,
  ticketStatus,
  ticketCreatedAt,
  viewer,
  currentUserName,
  onActionsChanged
}: ActionsTakenPanelProps) {
  const auth = useOptionalAuth();
  const userName = currentUserName ?? auth?.user?.name ?? '';

  const [list, setList] = useState<LoadOutcome>(EMPTY_LIST);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [refreshToken, setRefreshToken] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const [highlightId, setHighlightId] = useState<number | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [expectedVersion, setExpectedVersion] = useState<number | null>(null);
  const [clientRequestId, setClientRequestId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<ActionFormValues>(() => emptyFormValues(''));
  const [formErrors, setFormErrors] = useState<ActionFormErrors>({});
  const [failure, setFailure] = useState<WriteFailure | null>(null);
  const [conflictLatest, setConflictLatest] = useState<ActionTakenDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [markingId, setMarkingId] = useState<number | null>(null);

  const addButtonRef = useRef<HTMLButtonElement | null>(null);

  const locked = LOCKED_STATUSES.includes(ticketStatus);
  const staffCanWrite = viewer === 'staff' && !locked;
  const actions = list.actionsTaken;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadState('loading');
      try {
        const next = await listActionsTaken(ticketId);
        if (cancelled) return;
        setList(next);
        setLoadState('ready');
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ActionsApiError && err.status === 403) setLoadState('forbidden');
        else if (err instanceof ActionsApiError && err.status === 404) setLoadState('notfound');
        else setLoadState('error');
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [ticketId, refreshToken]);

  useEffect(() => {
    if (highlightId == null) return;
    const timer = window.setTimeout(() => setHighlightId(null), 6000);
    return () => window.clearTimeout(timer);
  }, [highlightId]);

  useEffect(() => {
    if (!formOpen) return;
    document.getElementById(FIELD_IDS.actionAt)?.focus();
  }, [formOpen, editingId]);

  const focusFirstInvalid = (fields: Record<string, string>) => {
    const first = ACTION_FORM_FIELD_ORDER.find((field) => Boolean(fields[field]));
    if (first) document.getElementById(FIELD_IDS[first])?.focus();
  };

  const applyWriteError = (err: unknown) => {
    if (err instanceof ActionsApiError) {
      if (err.status === 400) {
        const fields = (err.fields ?? {}) as ActionFormErrors;
        setFormErrors((prev) => ({ ...prev, ...fields }));
        focusFirstInvalid(fields);
        setFailure({ kind: 'validation', message: err.message });
        return;
      }
      if (err.status === 409 && err.code === 'VERSION_CONFLICT') {
        setFailure({ kind: 'conflict', message: CONFLICT_MESSAGE });
        return;
      }
      if (err.status === 409 && err.code === 'TICKET_ACTIONS_LOCKED') {
        setFailure({ kind: 'locked', message: `Actions can't be changed while the Ticket is ${ticketStatus}.` });
        onActionsChanged?.();
        return;
      }
      if (err.status === 403) {
        setFailure({ kind: 'forbidden', message: FORBIDDEN_MESSAGE });
        return;
      }
      if (err.status === 404) {
        setFailure({ kind: 'notfound', message: NOT_FOUND_MESSAGE });
        return;
      }
    }
    setFailure({ kind: 'safe', message: SAFE_SAVE_ERROR });
  };

  const confirmDiscard = () => !formOpen || window.confirm('Discard unsaved changes?');

  const openCreate = () => {
    if (!confirmDiscard()) return;
    setFormValues(emptyFormValues(formatBangkokLocalInput(new Date().toISOString())));
    setFormErrors({});
    setFailure(null);
    setConflictLatest(null);
    setEditingId(null);
    setExpectedVersion(null);
    setClientRequestId(newClientRequestId());
    setFormOpen(true);
  };

  const openEdit = (action: ActionTakenDto) => {
    if (!confirmDiscard()) return;
    setFormValues(valuesFromAction(action));
    setFormErrors({});
    setFailure(null);
    setConflictLatest(null);
    setEditingId(action.id);
    setExpectedVersion(action.version);
    setClientRequestId(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    const wasCreate = editingId == null;
    setFormOpen(false);
    setFormErrors({});
    setFailure(null);
    setConflictLatest(null);
    setEditingId(null);
    setExpectedVersion(null);
    setClientRequestId(null);
    if (wasCreate) addButtonRef.current?.focus();
  };

  const buildPayload = () => ({
    ...(formValues.actionAt ? { actionAt: bangkokLocalToIsoUtc(formValues.actionAt) } : {}),
    description: formValues.description.trim(),
    result: formValues.result.trim(),
    followUpRequired: formValues.followUpRequired,
    ...(formValues.followUpRequired ? { followUpNote: formValues.followUpNote.trim() } : {}),
    ...(formValues.attachmentNotes.trim() ? { attachmentNotes: formValues.attachmentNotes.trim() } : {})
  });

  const submitForm = async () => {
    if (saving) return;
    const errors = validateActionForm(formValues, {
      ticketCreatedAtIso: ticketCreatedAt,
      nowIso: new Date().toISOString()
    });
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setFailure(null);
      focusFirstInvalid(errors);
      return;
    }
    setFormErrors({});
    setFailure(null);
    setSaving(true);
    try {
      const saved = editingId == null
        ? await createActionTaken(ticketId, { ...buildPayload(), clientRequestId: clientRequestId ?? newClientRequestId() })
        : await updateActionTaken(ticketId, editingId, { ...buildPayload(), expectedVersion: expectedVersion ?? 1 });
      setAnnouncement(SAVED_ANNOUNCEMENT);
      setHighlightId(saved.id);
      setFormOpen(false);
      setFormErrors({});
      setEditingId(null);
      setExpectedVersion(null);
      setClientRequestId(null);
      setConflictLatest(null);
      setRefreshToken((token) => token + 1);
      onActionsChanged?.();
    } catch (err) {
      applyWriteError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleMarkFollowUp = async (action: ActionTakenDto, completed: boolean) => {
    if (markingId != null) return;
    setMarkingId(action.id);
    setFailure(null);
    try {
      await updateActionTaken(ticketId, action.id, {
        expectedVersion: action.version,
        followUpCompleted: completed
      });
      setAnnouncement(completed ? 'Follow-up marked done.' : 'Follow-up reopened.');
      setRefreshToken((token) => token + 1);
      onActionsChanged?.();
    } catch (err) {
      applyWriteError(err);
    } finally {
      setMarkingId(null);
    }
  };

  const handleReloadLatest = async () => {
    try {
      const next = await listActionsTaken(ticketId);
      setList(next);
      setLoadState('ready');
      const latest = editingId == null ? null : next.actionsTaken.find((action) => action.id === editingId) ?? null;
      setConflictLatest(latest);
      if (latest) setExpectedVersion(latest.version);
    } catch {
      // Keep the current list and the user's unsaved text.
    }
  };

  const setField = <K extends keyof ActionFormValues>(field: K, value: ActionFormValues[K]) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
    setFormErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  const knownErrors: Array<[string, string]> = [];
  for (const field of ACTION_FORM_FIELD_ORDER) {
    const message = formErrors[field];
    if (message) knownErrors.push([field, message]);
  }
  const otherErrors = Object.entries(formErrors)
    .filter(([field, message]) => !(ACTION_FORM_FIELD_ORDER as ReadonlyArray<string>).includes(field) && Boolean(message));
  const summaryEntries: Array<[string, string]> = [...knownErrors, ...otherErrors];
  const showErrorSummary = formOpen && summaryEntries.length > 0;

  const editingAction = editingId == null ? null : actions.find((action) => action.id === editingId) ?? null;
  const performedByText = editingAction
    ? `${editingAction.performedBy.name} (automatic)`
    : userName ? `${userName} (automatic)` : '(automatic)';

  const visibleActions = formOpen && editingId != null
    ? actions.filter((action) => action.id !== editingId)
    : actions;

  const errorProps = (field: Exclude<keyof ActionFormValues, 'followUpRequired'>, helpId?: string) => {
    const hasError = Boolean(formErrors[field]);
    const describedBy = [helpId, hasError ? `${FIELD_IDS[field]}-error` : null].filter(Boolean).join(' ');
    return {
      id: FIELD_IDS[field],
      'aria-invalid': hasError ? 'true' as const : undefined,
      'aria-describedby': describedBy || undefined
    };
  };

  const fieldError = (field: Exclude<keyof ActionFormValues, 'followUpRequired'>) => (
    formErrors[field]
      ? <p className="actions-field-error" id={`${FIELD_IDS[field]}-error`}>{formErrors[field]}</p>
      : null
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submitForm();
  };

  const conflictBanner = failure?.kind === 'conflict' ? (
    <div role="alert" className="actions-banner actions-banner-conflict">
      <p>{CONFLICT_MESSAGE}</p>
      {conflictLatest && (
        <div className="actions-conflict-latest">
          <p><strong>Latest saved version</strong></p>
          <dl>
            <dt>Description</dt>
            <dd>{conflictLatest.description}</dd>
            <dt>Result</dt>
            <dd>{conflictLatest.result}</dd>
            <dt>Follow-up</dt>
            <dd><FollowUpCue action={conflictLatest} /></dd>
          </dl>
        </div>
      )}
      <div className="actions-banner-actions">
        <button type="button" className="actions-btn actions-btn-secondary actions-btn-small" onClick={() => void handleReloadLatest()}>
          Reload latest
        </button>
        {formOpen && (
          <button type="button" className="actions-btn actions-btn-secondary actions-btn-small" onClick={() => setFailure(null)}>
            Keep editing
          </button>
        )}
      </div>
    </div>
  ) : null;

  const failureBanner = failure && failure.kind !== 'validation' && failure.kind !== 'conflict' ? (
    <div
      role="alert"
      className={`actions-banner ${failure.kind === 'locked' || failure.kind === 'safe' ? 'actions-banner-conflict' : 'actions-banner-error'}`}
    >
      <p>{failure.message}</p>
      {formOpen && failure.kind === 'safe' && (
        <div className="actions-banner-actions">
          <button type="button" className="actions-btn actions-btn-secondary actions-btn-small" onClick={() => void submitForm()}>
            Retry
          </button>
        </div>
      )}
      {formOpen && failure.kind === 'notfound' && (
        <div className="actions-banner-actions">
          <button type="button" className="actions-btn actions-btn-secondary actions-btn-small" onClick={closeForm}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  ) : null;

  return (
    <section className="actions-panel" aria-labelledby="actions-taken-heading">
      <div className="actions-panel-header">
        <h2 id="actions-taken-heading">Actions Taken</h2>
        {loadState === 'ready' && <span className="actions-count">{actions.length} recorded</span>}
        <span className="actions-shared-label">
          <span aria-hidden="true">👁</span>
          {' '}
          Visible to Requester
        </span>
        <span className="actions-tz-label">{TIME_ZONE_LABEL}</span>
        {staffCanWrite && (
          <button type="button" ref={addButtonRef} className="actions-btn actions-btn-primary" onClick={openCreate}>
            Add Action
          </button>
        )}
      </div>

      {viewer === 'requester' && (
        <p className="actions-viewer-note">These updates are visible to you and to IT Staff.</p>
      )}

      {locked && (
        <p className="actions-locked-note">{lockedExplanation(ticketStatus)}</p>
      )}

      <p role="status" className="visually-hidden">{announcement}</p>

      {loadState === 'loading' && (
        <div role="status" aria-live="polite">
          <p>Loading actions…</p>
          <div className="actions-skeleton-row" />
          <div className="actions-skeleton-row" />
          <div className="actions-skeleton-row" />
        </div>
      )}

      {loadState === 'forbidden' && (
        <div role="alert" className="actions-banner actions-banner-error">
          <p>{FORBIDDEN_MESSAGE}</p>
        </div>
      )}

      {loadState === 'notfound' && (
        <div role="alert" className="actions-banner actions-banner-error">
          <p>{NOT_FOUND_MESSAGE}</p>
          <p>
            <a href={viewer === 'staff' ? '/staff/tickets' : '/'}>
              {viewer === 'staff' ? 'Back to the Ticket Queue' : 'Back to My Tickets'}
            </a>
          </p>
        </div>
      )}

      {loadState === 'error' && (
        <div role="alert" className="actions-banner actions-banner-error">
          <p>{SAFE_LOAD_ERROR}</p>
          <div className="actions-banner-actions">
            <button type="button" className="actions-btn actions-btn-secondary actions-btn-small" onClick={() => setRefreshToken((token) => token + 1)}>
              Retry
            </button>
          </div>
        </div>
      )}

      {loadState === 'ready' && !formOpen && failure && (
        <div className="actions-failure-region">
          {conflictBanner}
          {failureBanner}
        </div>
      )}

      {formOpen && (
        <form className="actions-form" onSubmit={handleSubmit} aria-label={editingId == null ? 'Add Action' : 'Edit Action'}>
          <h3>{editingId == null ? 'Add Action' : 'Edit Action'}</h3>

          {conflictBanner}
          {failureBanner}

          {showErrorSummary && (
            <div role="alert" className="actions-error-summary">
              <p>Check the highlighted fields and try again.</p>
              <ul>
                {summaryEntries.map(([field, message]) => (
                  <li key={field}>{message}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="actions-form-grid">
            <div className="actions-field">
              <span className="actions-field-label">Performed by</span>
              <p className="actions-performed-by">{performedByText}</p>
            </div>

            <div className="actions-field">
              <label htmlFor={FIELD_IDS.actionAt}>Action time</label>
              <input
                {...errorProps('actionAt')}
                type="datetime-local"
                value={formValues.actionAt}
                onChange={(event) => setField('actionAt', event.target.value)}
                disabled={saving}
              />
              {fieldError('actionAt')}
            </div>

            <div className="actions-field">
              <label htmlFor={FIELD_IDS.description}>
                Description <span className="actions-required-marker">(required)</span>
              </label>
              <textarea
                {...errorProps('description')}
                rows={3}
                value={formValues.description}
                onChange={(event) => setField('description', event.target.value)}
                disabled={saving}
              />
              <span className="actions-counter" aria-hidden="true">{formValues.description.length}/2000</span>
              {fieldError('description')}
            </div>

            <div className="actions-field">
              <label htmlFor={FIELD_IDS.result}>
                Result <span className="actions-required-marker">(required)</span>
              </label>
              <textarea
                {...errorProps('result')}
                rows={3}
                value={formValues.result}
                onChange={(event) => setField('result', event.target.value)}
                disabled={saving}
              />
              <span className="actions-counter" aria-hidden="true">{formValues.result.length}/1000</span>
              {fieldError('result')}
            </div>

            <div className="actions-field actions-field-checkbox">
              <label htmlFor="action-followup-required">
                <input
                  id="action-followup-required"
                  type="checkbox"
                  checked={formValues.followUpRequired}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setFormValues((prev) => ({
                      ...prev,
                      followUpRequired: checked,
                      followUpNote: checked ? prev.followUpNote : ''
                    }));
                    setFormErrors((prev) => (prev.followUpNote ? { ...prev, followUpNote: undefined } : prev));
                  }}
                  disabled={saving}
                />
                Follow-up required?
              </label>
            </div>

            {formValues.followUpRequired && (
              <div className="actions-field">
                <label htmlFor={FIELD_IDS.followUpNote}>
                  Follow-up note <span className="actions-required-marker">(required)</span>
                </label>
                <textarea
                  {...errorProps('followUpNote')}
                  rows={2}
                  value={formValues.followUpNote}
                  onChange={(event) => setField('followUpNote', event.target.value)}
                  disabled={saving}
                />
                <span className="actions-counter" aria-hidden="true">{formValues.followUpNote.length}/500</span>
                {fieldError('followUpNote')}
              </div>
            )}

            <div className="actions-field">
              <label htmlFor={FIELD_IDS.attachmentNotes}>Attachment notes</label>
              <textarea
                {...errorProps('attachmentNotes', 'action-attachment-notes-help')}
                rows={2}
                value={formValues.attachmentNotes}
                onChange={(event) => setField('attachmentNotes', event.target.value)}
                disabled={saving}
              />
              <p className="actions-field-hint" id="action-attachment-notes-help">
                What file or image to look for (for example: &apos;screenshot share-error.png&apos;).
              </p>
              {fieldError('attachmentNotes')}
            </div>
          </div>

          <div className="actions-form-buttons">
            <button type="submit" className="actions-btn actions-btn-primary" disabled={saving} aria-busy={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="actions-btn actions-btn-secondary" onClick={closeForm} disabled={saving}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {loadState === 'ready' && actions.length === 0 && (
        <p className="actions-empty">No actions recorded yet.</p>
      )}

      {loadState === 'ready' && (
        <>
          <table className="actions-table">
            <caption className="visually-hidden">Actions taken on this ticket, visible to the Requester</caption>
            <thead>
              <tr>
                <th scope="col">Action time</th>
                <th scope="col">Description</th>
                <th scope="col">Result</th>
                <th scope="col">Performed by</th>
                <th scope="col">Follow-up</th>
                <th scope="col">Attachment notes</th>
                <th scope="col">Recorded</th>
                {viewer === 'staff' && <th scope="col">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {visibleActions.map((action) => (
                <tr key={action.id} className={highlightId === action.id ? 'actions-row-highlight' : undefined}>
                  <td><time dateTime={action.actionAt}>{formatBangkokDateTime(action.actionAt)}</time></td>
                  <td>{action.description}</td>
                  <td>{action.result}</td>
                  <td>{action.performedBy.name}</td>
                  <td><FollowUpCue action={action} /></td>
                  <td>{action.attachmentNotes ?? '—'}</td>
                  <td>
                    <time dateTime={action.createdAt}>{formatBangkokDateTime(action.createdAt)}</time>
                    <EditedMarker action={action} />
                  </td>
                  {viewer === 'staff' && (
                    <td>
                      <div className="actions-row-actions">
                        {staffCanWrite && (
                          <button
                            type="button"
                            className="actions-btn actions-btn-secondary actions-btn-small"
                            onClick={() => openEdit(action)}
                          >
                            Edit
                          </button>
                        )}
                        {staffCanWrite && action.followUpRequired && !action.followUpCompletedAt && (
                          <button
                            type="button"
                            className="actions-btn actions-btn-secondary actions-btn-small"
                            disabled={markingId != null}
                            onClick={() => void handleMarkFollowUp(action, true)}
                          >
                            Mark follow-up done
                          </button>
                        )}
                        {staffCanWrite && action.followUpRequired && Boolean(action.followUpCompletedAt) && (
                          <button
                            type="button"
                            className="actions-btn actions-btn-secondary actions-btn-small"
                            disabled={markingId != null}
                            onClick={() => void handleMarkFollowUp(action, false)}
                          >
                            Reopen follow-up
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="actions-cards">
            {visibleActions.map((action) => (
              <article
                key={action.id}
                className={highlightId === action.id ? 'actions-card actions-row-highlight' : 'actions-card'}
              >
                <dl>
                  <dt>Action time</dt>
                  <dd><time dateTime={action.actionAt}>{formatBangkokDateTime(action.actionAt)}</time></dd>
                  <dt>Description</dt>
                  <dd>{action.description}</dd>
                  <dt>Result</dt>
                  <dd>{action.result}</dd>
                  <dt>Performed by</dt>
                  <dd>{action.performedBy.name}</dd>
                  <dt>Follow-up</dt>
                  <dd><FollowUpCue action={action} /></dd>
                  <dt>Attachment notes</dt>
                  <dd>{action.attachmentNotes ?? '—'}</dd>
                  <dt>Recorded</dt>
                  <dd>
                    <time dateTime={action.createdAt}>{formatBangkokDateTime(action.createdAt)}</time>
                    <EditedMarker action={action} />
                  </dd>
                </dl>
                {viewer === 'staff' && (
                  <div className="actions-row-actions">
                    {staffCanWrite && (
                      <button
                        type="button"
                        className="actions-btn actions-btn-secondary actions-btn-small"
                        onClick={() => openEdit(action)}
                      >
                        Edit
                      </button>
                    )}
                    {staffCanWrite && action.followUpRequired && !action.followUpCompletedAt && (
                      <button
                        type="button"
                        className="actions-btn actions-btn-secondary actions-btn-small"
                        disabled={markingId != null}
                        onClick={() => void handleMarkFollowUp(action, true)}
                      >
                        Mark follow-up done
                      </button>
                    )}
                    {staffCanWrite && action.followUpRequired && Boolean(action.followUpCompletedAt) && (
                      <button
                        type="button"
                        className="actions-btn actions-btn-secondary actions-btn-small"
                        disabled={markingId != null}
                        onClick={() => void handleMarkFollowUp(action, false)}
                      >
                        Reopen follow-up
                      </button>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

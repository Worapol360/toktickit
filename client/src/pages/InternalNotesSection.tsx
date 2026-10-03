import { useState, type FormEvent } from 'react';

export type InternalNote = {
  id: number;
  ticketId: number;
  authorId: number;
  content: string;
  createdAt: string;
  author?: {
    id: number;
    name: string;
    role: string;
  };
};

type InternalNotesSectionProps = {
  ticketId: number;
  notes: InternalNote[];
  onNoteAdded: (note: InternalNote) => void;
};

export function InternalNotesSection({ ticketId, notes, onNoteAdded }: InternalNotesSectionProps) {
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (trimmed.length < 5 || trimmed.length > 2000) {
      setError('Note must be between 5 and 2000 characters.');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      const response = await fetch(`/api/staff/tickets/${ticketId}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'same-origin',
        body: JSON.stringify({ content: trimmed })
      });

      const body = await response.json();
      if (!response.ok || !body.note) {
        throw new Error(body.error?.message ?? 'Failed to add internal note.');
      }

      setContent('');
      onNoteAdded(body.note);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add internal note.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      aria-labelledby="internal-notes-heading"
      style={{
        marginTop: 32,
        background: '#FFFBEB',
        border: '1px solid #FDE68A',
        borderRadius: 8,
        padding: 24
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span
          role="img"
          aria-label="Internal — staff only"
          style={{ fontSize: 20 }}
        >
          🔒
        </span>
        <h2
          id="internal-notes-heading"
          style={{
            margin: 0,
            fontSize: 20,
            color: '#92400E'
          }}
        >
          Internal Notes — not visible to Requester
        </h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
        {notes.length === 0 ? (
          <p style={{ color: '#92400E', fontStyle: 'italic', margin: 0 }}>No internal notes yet.</p>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              style={{
                background: '#FFFFFF',
                border: '1px solid #FDE68A',
                borderRadius: 8,
                padding: '16px 20px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <strong>{note.author?.name ?? 'Staff'}</strong>
                  <span
                    className="badge"
                    style={{
                      borderRadius: 999,
                      padding: '2px 8px',
                      fontSize: 12,
                      fontWeight: 600,
                      background: note.author?.role === 'ADMINISTRATOR' ? '#006B3C' : '#EAF6EF',
                      color: note.author?.role === 'ADMINISTRATOR' ? '#FFFFFF' : '#006B3C'
                    }}
                  >
                    {note.author?.role === 'ADMINISTRATOR' ? 'Administrator' : 'IT Staff'}
                  </span>
                </div>
                <time style={{ color: '#78350F', fontSize: 13 }} dateTime={note.createdAt}>
                  {new Date(note.createdAt).toLocaleString()}
                </time>
              </div>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#17221C' }}>{note.content}</p>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} style={{ background: '#FFFFFF', border: '1px solid #FDE68A', borderRadius: 8, padding: 20 }}>
        <label htmlFor="internal-note-input" style={{ display: 'block', fontWeight: 600, color: '#92400E', marginBottom: 8 }}>
          Add Internal Note
        </label>
        <textarea
          id="internal-note-input"
          placeholder="Add an internal note..."
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            if (error) setError('');
          }}
          disabled={submitting}
          rows={4}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: 12,
            borderRadius: 6,
            border: error ? '1px solid #B42318' : '1px solid #FDE68A',
            fontSize: 14,
            fontFamily: 'inherit',
            resize: 'vertical'
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <div>
            {error && <span role="alert" style={{ color: '#B42318', fontSize: 13, fontWeight: 500 }}>{error}</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: content.length > 2000 ? '#B42318' : '#78350F' }}>
              {content.length}/2000
            </span>
            <button
              type="submit"
              disabled={submitting || content.trim().length === 0}
              aria-busy={submitting ? 'true' : undefined}
              style={{
                background: '#D97706',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 6,
                padding: '8px 16px',
                fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer'
              }}
            >
              {submitting ? 'Adding...' : 'Add Note'}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

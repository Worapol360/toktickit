import { useState, type FormEvent } from 'react';

export type PublicComment = {
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

type CommentThreadProps = {
  ticketId: number;
  comments: PublicComment[];
  onCommentAdded: (comment: PublicComment) => void;
};

function roleBadgeName(role?: string) {
  if (role === 'IT_STAFF') return 'IT Staff';
  if (role === 'ADMINISTRATOR') return 'Administrator';
  return 'Requester';
}

function roleBadgeStyle(role?: string) {
  if (role === 'ADMINISTRATOR') {
    return { background: '#006B3C', color: '#FFFFFF' };
  }
  if (role === 'IT_STAFF') {
    return { background: '#EAF6EF', color: '#006B3C' };
  }
  return { background: '#EAF6F7', color: '#176B87' };
}

export function CommentThread({ ticketId, comments, onCommentAdded }: CommentThreadProps) {
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (trimmed.length < 5 || trimmed.length > 2000) {
      setError('Comment must be between 5 and 2000 characters.');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      const response = await fetch(`/api/tickets/${ticketId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'same-origin',
        body: JSON.stringify({ content: trimmed })
      });

      const body = await response.json();
      if (!response.ok || !body.comment) {
        throw new Error(body.error?.message ?? 'Failed to post comment.');
      }

      setContent('');
      onCommentAdded(body.comment);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post comment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section aria-labelledby="public-comments-heading" style={{ marginTop: 32 }}>
      <h2 id="public-comments-heading" style={{ fontSize: 20, marginBottom: 16 }}>Public Comments</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
        {comments.length === 0 ? (
          <p style={{ color: '#556960', fontStyle: 'italic' }}>No public comments yet.</p>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              style={{
                background: '#FFFFFF',
                border: '1px solid #D7E2DC',
                borderRadius: 8,
                padding: '16px 20px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <strong>{comment.author?.name ?? 'User'}</strong>
                  <span
                    className="badge"
                    style={{
                      borderRadius: 999,
                      padding: '2px 8px',
                      fontSize: 12,
                      fontWeight: 600,
                      ...roleBadgeStyle(comment.author?.role)
                    }}
                  >
                    {roleBadgeName(comment.author?.role)}
                  </span>
                </div>
                <time style={{ color: '#556960', fontSize: 13 }} dateTime={comment.createdAt}>
                  {new Date(comment.createdAt).toLocaleString()}
                </time>
              </div>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#17221C' }}>{comment.content}</p>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} style={{ background: '#FFFFFF', border: '1px solid #D7E2DC', borderRadius: 8, padding: 20 }}>
        <label htmlFor="public-comment-input" style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>
          Add Public Comment
        </label>
        <textarea
          id="public-comment-input"
          placeholder="Add a public comment..."
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
            border: error ? '1px solid #B42318' : '1px solid #D7E2DC',
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
            <span style={{ fontSize: 12, color: content.length > 2000 ? '#B42318' : '#556960' }}>
              {content.length}/2000
            </span>
            <button
              type="submit"
              disabled={submitting || content.trim().length === 0}
              aria-busy={submitting ? 'true' : undefined}
              style={{
                background: '#006B3C',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 6,
                padding: '8px 16px',
                fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer'
              }}
            >
              {submitting ? 'Posting...' : 'Post Comment'}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

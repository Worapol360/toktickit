import { useRef, useState, type ChangeEvent } from 'react';

export type Attachment = {
  id: number;
  fileName: string;
  fileSize: number;
  fileType: string;
  isRemoved: boolean;
  removalReason: string | null;
  createdAt: string;
};

type AttachmentSectionProps = {
  ticketId: number;
  requesterId: string;
  attachments: Attachment[];
  onChanged: () => void;
};

type PendingFile = { id: string; file: File; status: 'uploading' | 'invalid' | 'ready'; error?: string };

function formatSize(size: number) {
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

export function AttachmentSection({ ticketId, requesterId, attachments, onChanged }: AttachmentSectionProps) {
  const [selectedAttachment, setSelectedAttachment] = useState<Attachment | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    const availableSlots = 5 - attachments.filter((attachment) => !attachment.isRemoved).length;
    const pending = files.map((file, index) => {
      const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
      const invalidReason = file.size > 5 * 1024 * 1024
        ? 'File exceeds 5 MB'
        : !['jpg', 'jpeg', 'png', 'webp', 'pdf'].includes(extension)
          ? 'Unsupported file type'
          : index >= availableSlots
            ? 'Attachment limit exceeded'
            : undefined;
      return { id: `${file.name}-${file.size}-${index}`, file, status: invalidReason ? 'invalid' as const : 'uploading' as const, ...(invalidReason ? { error: invalidReason } : {}) };
    });
    setPendingFiles(pending);
    const validFiles = pending.filter((item) => item.status === 'uploading');
    if (validFiles.length === 0) return;
    const body = new FormData();
    validFiles.forEach(({ file }) => body.append('attachments', file));
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/tickets/${ticketId}/attachments`, { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest' }, body });
      if (!response.ok) throw new Error('Unable to upload attachment.');
      setPendingFiles((current) => current.map((item) => item.status === 'uploading' ? { ...item, status: 'ready' } : item));
      onChanged();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to upload attachment.');
      setPendingFiles((current) => current.map((item) => item.status === 'uploading' ? { ...item, status: 'ready' } : item));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = async () => {
    if (!selectedAttachment || reason.trim().length < 5 || reason.trim().length > 250) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/tickets/${ticketId}/attachments/${selectedAttachment.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ removalReason: reason.trim() })
      });
      if (!response.ok) throw new Error('Unable to remove attachment.');
      setSelectedAttachment(null);
      setReason('');
      onChanged();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Unable to remove attachment.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="attachments-heading">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 id="attachments-heading">Attachments</h2>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}>Add attachment</button>
        <input ref={inputRef} hidden type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={upload} />
      </div>
      <p>JPG, JPEG, PNG, WEBP, or PDF. Maximum 5 MB per file and up to 5 files.</p>
      {error && <p role="alert">{error}</p>}
      {pendingFiles.map((item) => <p key={item.id}>{item.file.name} <span>{item.status === 'uploading' ? 'Uploading' : item.status === 'invalid' ? `Invalid: ${item.error}` : 'Ready'}</span></p>)}
      <ul>
        {attachments.map((attachment) => (
          <li key={attachment.id} aria-label={attachment.isRemoved ? 'Removed attachment' : 'Active attachment'} style={{ opacity: attachment.isRemoved ? 0.55 : 1 }}>
            <strong>{attachment.fileName}</strong>
            <span> {attachment.fileType} {formatSize(attachment.fileSize)}</span>
            <span> {attachment.isRemoved ? 'Removed' : 'Active'}</span>
            {attachment.isRemoved ? <span>Removal reason: <strong>{attachment.removalReason}</strong></span> : (
              <>
                {attachment.fileType.startsWith('image/') && <button type="button" onClick={() => window.open(`/api/tickets/${ticketId}/attachments/${attachment.id}/download`, '_blank')}>Preview</button>}
                <button type="button" onClick={() => window.open(`/api/tickets/${ticketId}/attachments/${attachment.id}/download`, '_blank')}>Download</button>
                <button type="button" onClick={() => setSelectedAttachment(attachment)}>Remove attachment</button>
              </>
            )}
          </li>
        ))}
      </ul>
      {selectedAttachment && (
        <div role="dialog" aria-modal="true" aria-labelledby="remove-attachment-title">
          <h3 id="remove-attachment-title">Remove attachment</h3>
          <label htmlFor="removal-reason">Removal reason</label>
          <textarea id="removal-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
          <button type="button" onClick={() => { setSelectedAttachment(null); setReason(''); }} disabled={busy}>Cancel</button>
          <button type="button" onClick={remove} disabled={busy || reason.trim().length < 5 || reason.trim().length > 250}>Confirm removal</button>
        </div>
      )}
    </section>
  );
}
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';

type Option = { id: number; name: string };

type CreateTicketProps = {
  requesterId: string;
  categories: Option[];
  relatedSystems: Option[];
  onCancel?: () => void;
};

type FormValues = {
  summary: string;
  description: string;
  categoryId: string;
  relatedSystemId: string;
  requestedPriority: string;
};

const initialValues: FormValues = {
  summary: '',
  description: '',
  categoryId: '',
  relatedSystemId: '',
  requestedPriority: ''
};

const maxFileSize = 5 * 1024 * 1024;
const allowedExtensions = new Set(['jpg', 'jpeg', 'png', 'webp', 'pdf']);

export function CreateTicket({ requesterId, categories, relatedSystems, onCancel }: CreateTicketProps) {
  const [values, setValues] = useState(initialValues);
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<{ ticketNumber: string; status: string } | null>(null);
  const firstInvalidRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>(null);

  useEffect(() => {
    if (Object.keys(errors).length > 0 || fileError) {
      const firstInvalid = document.querySelector('[aria-invalid="true"]') as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
      firstInvalid?.focus();
      firstInvalidRef.current = firstInvalid;
    }
  }, [errors, fileError]);

  const updateValue = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '' }));
    setFormError('');
  };

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    const invalid = selected.find((file) => {
      const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
      return file.size > maxFileSize || !allowedExtensions.has(extension);
    });
    if (invalid) {
      setFileError(invalid.size > maxFileSize ? 'File exceeds 5 MB' : 'Unsupported file type');
      setFiles([]);
      return;
    }
    if (selected.length > 5) {
      setFileError('A maximum of 5 attachments is allowed');
      setFiles([]);
      return;
    }
    setFileError('');
    setFiles(selected);
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    const summary = values.summary.trim();
    const description = values.description.trim();
    if (summary.length < 5 || summary.length > 100) nextErrors.summary = 'Summary must be between 5 and 100 characters';
    if (description.length < 10 || description.length > 2000) nextErrors.description = 'Description must be between 10 and 2000 characters';
    if (!values.categoryId) nextErrors.categoryId = 'Category is required';
    if (!values.relatedSystemId) nextErrors.relatedSystemId = 'Related System is required';
    if (!values.requestedPriority) nextErrors.requestedPriority = 'Requested Priority is required';
    setErrors(nextErrors);
    return nextErrors;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const nextErrors = validate();
    if (fileError || Object.keys(nextErrors).length > 0) {
      setFormError('Please correct the highlighted fields before submitting.');
      return;
    }

    setBusy(true);
    setFormError('');
    const payload = new FormData();
    payload.append('summary', values.summary.trim());
    payload.append('description', values.description.trim());
    payload.append('categoryId', values.categoryId);
    payload.append('relatedSystemId', values.relatedSystemId);
    payload.append('requestedPriority', values.requestedPriority);
    files.forEach((file) => payload.append('attachments', file));

    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'X-Requester-Id': requesterId },
        body: payload
      });
      const body = await response.json() as { ticket?: { ticketNumber: string; status: string }; error?: { message?: string } };
      if (!response.ok || !body.ticket) throw new Error(body.error?.message ?? 'Unable to create ticket');
      setSuccess(body.ticket);
    } catch (error) {
      setFormError(error instanceof Error && error.message.startsWith('Unable to create ticket')
        ? error.message
        : 'Unable to create ticket. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (success) {
    return (
      <main aria-label="Create Ticket" style={{ minHeight: '100vh', background: '#F6FAF8', padding: '32px 16px' }}>
        <section role="status" style={{ maxWidth: '720px', margin: '0 auto', background: '#FFFFFF', border: '1px solid #D7E2DC', borderRadius: '8px', padding: '32px' }}>
          <h1>Ticket created successfully</h1>
          <p>Ticket number: <strong>{success.ticketNumber}</strong></p>
          <p>Status: <strong>{success.status}</strong></p>
          <button type="button" onClick={onCancel}>Back to workspace</button>
        </section>
      </main>
    );
  }

  return (
    <main aria-label="Create Ticket" style={{ minHeight: '100vh', background: '#F6FAF8', padding: '32px 16px' }}>
      <form onSubmit={submit} noValidate aria-busy={busy} style={{ maxWidth: '720px', margin: '0 auto', background: '#FFFFFF', border: '1px solid #D7E2DC', borderRadius: '8px', padding: '32px' }}>
        <h1>Create Ticket</h1>
        <p>* means required</p>
        {formError && <div role="alert" style={{ background: '#FDECEC', color: '#B42318', padding: '12px', marginBottom: '16px' }}>{formError}</div>}
        <label htmlFor="summary">Summary *</label>
        <input id="summary" name="summary" value={values.summary} onChange={updateValue} aria-invalid={Boolean(errors.summary)} aria-describedby={errors.summary ? 'summary-error' : undefined} required />
        {errors.summary && <p id="summary-error">{errors.summary}</p>}

        <label htmlFor="description">Description *</label>
        <textarea id="description" name="description" value={values.description} onChange={updateValue} aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? 'description-error' : undefined} required />
        {errors.description && <p id="description-error">{errors.description}</p>}

        <label htmlFor="categoryId">Category *</label>
        <select id="categoryId" name="categoryId" value={values.categoryId} onChange={updateValue} aria-invalid={Boolean(errors.categoryId)} required>
          <option value="">Select a category</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        {errors.categoryId && <p>{errors.categoryId}</p>}

        <label htmlFor="relatedSystemId">Related System *</label>
        <select id="relatedSystemId" name="relatedSystemId" value={values.relatedSystemId} onChange={updateValue} aria-invalid={Boolean(errors.relatedSystemId)} required>
          <option value="">Select a related system</option>
          {relatedSystems.map((system) => <option key={system.id} value={system.id}>{system.name}</option>)}
        </select>
        {errors.relatedSystemId && <p>{errors.relatedSystemId}</p>}

        <label htmlFor="requestedPriority">Requested Priority *</label>
        <select id="requestedPriority" name="requestedPriority" value={values.requestedPriority} onChange={updateValue} aria-invalid={Boolean(errors.requestedPriority)} required>
          <option value="">Select a priority</option>
          {['Low', 'Medium', 'High', 'Urgent'].map((priority) => <option key={priority} value={priority}>{priority}</option>)}
        </select>
        {errors.requestedPriority && <p>{errors.requestedPriority}</p>}

        <label htmlFor="attachments">Attachments</label>
        <p>JPG, JPEG, PNG, WEBP, or PDF. Maximum 5 MB per file and 5 files.</p>
        <input id="attachments" type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={handleFiles} aria-invalid={Boolean(fileError)} />
        {fileError && <p>{fileError}</p>}
        {files.map((file) => <p key={`${file.name}-${file.size}`}>{file.name} <span>Ready</span></p>)}

        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          {onCancel && <button type="button" onClick={onCancel} disabled={busy}>Cancel</button>}
          <button type="submit" disabled={busy || Boolean(fileError)}>{busy ? 'Creating Ticket...' : 'Create Ticket'}</button>
        </div>
      </form>
    </main>
  );
}
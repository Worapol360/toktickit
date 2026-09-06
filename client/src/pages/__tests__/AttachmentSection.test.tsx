import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AttachmentSection } from '../AttachmentSection';

const attachment = {
  id: 41,
  fileName: 'screen.png',
  fileSize: 245760,
  fileType: 'image/png',
  isRemoved: false,
  removalReason: null,
  createdAt: '2026-09-05T12:00:00.000Z'
};

describe('Issue 5 attachment section', () => {
  it('UI-08 renders active metadata and add attachment control', () => {
    render(<AttachmentSection ticketId={11} requesterId="1" attachments={[attachment]} onChanged={vi.fn()} />);

    expect(screen.getByText('screen.png')).toBeTruthy();
    expect(screen.getByText(/Active/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /add attachment/i })).toBeTruthy();
  });

  it('UI-08 renders removed metadata without download or preview actions', () => {
    render(<AttachmentSection ticketId={11} requesterId="1" attachments={[{ ...attachment, isRemoved: true, removalReason: 'Wrong version' }]} onChanged={vi.fn()} />);

    expect(screen.getByText(/Removed/i)).toBeTruthy();
    expect(screen.getByText('Wrong version')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /download/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /preview/i })).toBeNull();
  });

  it('UI-08 requires a valid reason before soft removal', () => {
    render(<AttachmentSection ticketId={11} requesterId="1" attachments={[attachment]} onChanged={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /remove attachment/i }));

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('button', { name: /confirm removal/i })).toBeDisabled();
  });
});
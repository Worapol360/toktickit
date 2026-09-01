import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequesterSelectionScreen } from './RequesterSelection';

afterEach(() => {
  cleanup();
});

describe('RequesterSelectionScreen', () => {
  it('displays loading while requesters are being fetched', () => {
    render(
      <RequesterSelectionScreen
        requesters={[]}
        loading={true}
        error={''}
        selectedRequesterId={''}
        onSelectionChange={vi.fn()}
        onContinue={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    expect(screen.getByRole('status').textContent).toContain('Loading Development Requesters...');
  });

  it('keeps Continue disabled until a valid requester is selected', () => {
    render(
      <RequesterSelectionScreen
        requesters={[
          { id: 1, name: 'Aiko Tanaka', email: 'aiko@example.com', department: 'Finance', isActive: true },
          { id: 2, name: 'Daniel Kim', email: 'daniel@example.com', department: 'IT', isActive: true }
        ]}
        loading={false}
        error={''}
        selectedRequesterId={''}
        onSelectionChange={vi.fn()}
        onContinue={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    const continueButton = screen.getByRole('button', { name: 'Continue' });
    expect((continueButton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Development Requester *'), { target: { value: '1' } });
    expect((continueButton as HTMLButtonElement).disabled).toBe(false);
  });
});

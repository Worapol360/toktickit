import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Login } from '../../Login';

describe('Login', () => {
  it('UI-01 validates fields, shows busy state, and distinguishes auth failures', async () => {
    let resolveLogin: (result: { code: string }) => void = () => undefined;
    const onLogin = vi.fn().mockImplementation(() => new Promise<{ code: string }>((resolve) => { resolveLogin = resolve; }));
    render(<Login onLogin={onLogin} />);

    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(screen.getByText(/enter a valid email/i)).toBeTruthy();
    expect(screen.getByText(/password is required/i)).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'aiko@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'LocalOnly1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(await screen.findByRole('button', { name: 'Signing In...' })).toBeDisabled();

    resolveLogin({ code: 'INVALID_CREDENTIALS' });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/incorrect email or password/i));
    expect(screen.getByLabelText('Email')).toHaveValue('aiko@example.com');
    expect(screen.getByLabelText('Password')).toHaveValue('');

    onLogin.mockResolvedValue({ code: 'ACCOUNT_INACTIVE' });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'LocalOnly1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/account is inactive/i));
    expect(screen.getByRole('alert')).toHaveStyle({ backgroundColor: '#FFF7DB' });
  });
});

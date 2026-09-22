import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChangePassword } from '../../ChangePassword';

describe('ChangePassword', () => {
  it('UI-02 validates mismatch and same-as-current, then saves', async () => {
    const onChangePassword = vi.fn().mockResolvedValue({ ok: true });
    render(<ChangePassword onChangePassword={onChangePassword} />);

    fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'LocalOnly1!' } });
    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'LocalOnly1!' } });
    fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'Different1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save New Password' }));

    expect(screen.getByText(/must differ from the current password/i)).toBeTruthy();
    expect(screen.getByText(/must match the new password/i)).toBeTruthy();

    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'NewSecure1!' } });
    fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'NewSecure1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save New Password' }));

    await waitFor(() => expect(onChangePassword).toHaveBeenCalledWith({
      currentPassword: 'LocalOnly1!',
      newPassword: 'NewSecure1!',
      confirmNewPassword: 'NewSecure1!'
    }));
  });
});

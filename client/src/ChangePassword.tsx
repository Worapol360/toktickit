import { useState, type FormEvent } from 'react';

type PasswordValues = { currentPassword: string; newPassword: string; confirmNewPassword: string };
type ChangePasswordProps = { onChangePassword: (values: PasswordValues) => Promise<{ code?: string; ok?: boolean }> };

export function ChangePassword({ onChangePassword }: ChangePasswordProps) {
  const [values, setValues] = useState<PasswordValues>({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    const errors = [
      values.newPassword === values.currentPassword ? 'New password must differ from the current password.' : '',
      values.newPassword !== values.confirmNewPassword ? 'Confirmation must match the new password.' : ''
    ].filter(Boolean);
    if (errors.length) { setError(errors.join(' ')); return; }
    if (values.newPassword.length < 8 || !/[A-Za-z]/.test(values.newPassword) || !/\d/.test(values.newPassword)) { setError('New password must be at least 8 characters and include a letter and a number.'); return; }
    setBusy(true);
    const result = await onChangePassword(values);
    setBusy(false);
    if (result.code) setError(result.code === 'CURRENT_PASSWORD_INCORRECT' ? 'Current password is incorrect.' : 'Unable to change password.');
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#F6FAF8', padding: 24 }}>
      <section aria-label="Change Password" style={{ width: 'min(100%, 520px)', background: '#FFFFFF', border: '1px solid #D7E2DC', borderRadius: 8, padding: 32 }}>
        <h1>Change password</h1>
        <p>You must set a new password before continuing.</p>
        <p>Password must be at least 8 characters and include a letter and a number.</p>
        {error && <p role="alert">{error}</p>}
        <form onSubmit={submit} aria-busy={busy}>
          {(['currentPassword', 'newPassword', 'confirmNewPassword'] as const).map((name) => {
            const label = name === 'currentPassword' ? 'Current Password' : name === 'newPassword' ? 'New Password' : 'Confirm New Password';
            return <div key={name}><label htmlFor={name}>{label}</label><input id={name} type="password" value={values[name]} onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))} /></div>;
          })}
          <button type="submit" disabled={busy}>{busy ? 'Saving New Password...' : 'Save New Password'}</button>
        </form>
      </section>
    </main>
  );
}

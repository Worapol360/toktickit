import { useRef, useState, type FormEvent } from 'react';

type LoginResult = { code?: string; user?: unknown };

type LoginProps = { onLogin: (credentials: { email: string; password: string }) => Promise<LoginResult> };

export function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [failure, setFailure] = useState<LoginResult | null>(null);
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) nextErrors.email = 'Enter a valid email address.';
    if (!password) nextErrors.password = 'Password is required.';
    setErrors(nextErrors);
    setFailure(null);
    if (Object.keys(nextErrors).length) {
      emailRef.current?.focus();
      return;
    }
    setBusy(true);
    const result = await onLogin({ email: email.trim(), password });
    setBusy(false);
    if (result.code) {
      setFailure(result);
      if (result.code === 'INVALID_CREDENTIALS') setPassword('');
    }
  }

  const inactive = failure?.code === 'ACCOUNT_INACTIVE';
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#F6FAF8', padding: 24 }}>
      <section aria-label="Sign in" style={{ width: 'min(100%, 440px)', background: '#FFFFFF', border: '1px solid #D7E2DC', borderRadius: 8, padding: 32 }}>
        <p style={{ color: '#006B3C', fontWeight: 700 }}>TokTickIT</p>
        <h1>Sign in</h1>
        {failure && <div role="alert" style={{ background: inactive ? '#FFF7DB' : '#FDECEC', color: inactive ? '#9A6700' : '#B42318', border: `1px solid ${inactive ? '#9A6700' : '#B42318'}`, padding: 12, marginBottom: 16 }}>{inactive ? 'This account is inactive. Contact an Administrator.' : 'Incorrect email or password.'}</div>}
        <form onSubmit={submit} noValidate aria-busy={busy}>
          <label htmlFor="login-email">Email</label>
          <input ref={emailRef} id="login-email" value={email} onChange={(event) => setEmail(event.target.value)} aria-invalid={Boolean(errors.email)} />
          {errors.email && <p role="alert">{errors.email}</p>}
          <label htmlFor="login-password">Password</label>
          <input id="login-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} aria-invalid={Boolean(errors.password)} />
          {errors.password && <p role="alert">{errors.password}</p>}
          <button type="submit" disabled={busy} style={{ marginTop: 16 }}>{busy ? 'Signing In...' : 'Sign In'}</button>
        </form>
      </section>
    </main>
  );
}

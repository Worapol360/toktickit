import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type User = { id: number; name: string; email: string; role: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR'; mustChangePassword: boolean };
type AuthContextValue = { user: User | null; loading: boolean; login: (email: string, password: string) => Promise<{ code?: string; user?: User }>; logout: () => Promise<void>; changePassword: (values: { currentPassword: string; newPassword: string; confirmNewPassword: string }) => Promise<{ code?: string; ok?: boolean }> };
const AuthContext = createContext<AuthContextValue | null>(null);

async function jsonRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, { credentials: 'same-origin', ...init });
  const body = await response.json().catch(() => ({}));
  return { response, body } as { response: Response; body: { user?: User; error?: { code?: string } } };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { void jsonRequest('/api/auth/me').then(({ response, body }) => { if (response.ok && body.user) setUser(body.user); }).finally(() => setLoading(false)); }, []);
  async function login(email: string, password: string) { const { response, body } = await jsonRequest('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: JSON.stringify({ email, password }) }); if (response.ok && body.user) setUser(body.user); return response.ok ? { user: body.user } : { code: body.error?.code }; }
  async function logout() { await jsonRequest('/api/auth/logout', { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest' } }); setUser(null); }
  async function changePassword(values: { currentPassword: string; newPassword: string; confirmNewPassword: string }) { const { response, body } = await jsonRequest('/api/auth/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: JSON.stringify(values) }); if (response.ok && body.user) setUser(body.user); return response.ok ? { ok: true } : { code: body.error?.code }; }
  return <AuthContext.Provider value={{ user, loading, login, logout, changePassword }}>{children}</AuthContext.Provider>;
}

export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error('useAuth must be used inside AuthProvider'); return context; }

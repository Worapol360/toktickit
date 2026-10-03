import { useEffect, useState, type FormEvent } from 'react';
import { PasswordRuleHint } from '../components/PasswordRuleHint';

type Role = 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR';

type AdminUser = {
  id: number;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
};

type UserManagementProps = {
  currentUserId: number;
};

const roleLabels: Record<Role, string> = {
  REQUESTER: 'Requester',
  IT_STAFF: 'IT Staff',
  ADMINISTRATOR: 'Administrator',
};

const roleBadgeClass = (role: Role) => `role-badge-${role.toLowerCase().replace('_', '-')}`;

const statusClass = (isActive: boolean) => (isActive ? 'user-status-active' : 'user-status-inactive');
const statusLabel = (isActive: boolean) => (isActive ? 'Active' : 'Inactive');

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

export function UserManagement({ currentUserId }: UserManagementProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Dialog states
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);

  // Form states
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    role: 'REQUESTER' as Role,
    isActive: true,
    initialPassword: '',
  });
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});

  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    role: 'REQUESTER' as Role,
    isActive: true,
  });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [lastAdminError, setLastAdminError] = useState('');

  const [resetForm, setResetForm] = useState({ newInitialPassword: '' });
  const [resetError, setResetError] = useState('');

  async function loadUsers() {
    setLoading(true);
    setError('');
    setForbidden(false);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (roleFilter) params.set('role', roleFilter);
      const response = await fetch(`/api/admin/users?${params}`, { credentials: 'same-origin' });
      if (response.status === 403) {
        setForbidden(true);
        setLoading(false);
        return;
      }
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || 'Failed to load users');
      setUsers(body.users || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load users.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, [search, roleFilter]);

  function handleSearchSubmit(event: FormEvent) {
    event.preventDefault();
    loadUsers();
  }

  function clearFilters() {
    setSearch('');
    setRoleFilter('');
  }

  const hasActiveFilters = search || roleFilter;

  // Create dialog
  function openCreate() {
    setCreateForm({ name: '', email: '', role: 'REQUESTER', isActive: true, initialPassword: '' });
    setCreateErrors({});
    setCreateOpen(true);
  }

  function closeCreate() {
    setCreateOpen(false);
    setCreateErrors({});
  }

  async function submitCreate(event: FormEvent) {
    event.preventDefault();
    setCreateErrors({});
    setLastAdminError('');

    const errors: Record<string, string> = {};
    if (!createForm.name.trim()) errors.name = 'Name is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createForm.email)) errors.email = 'Enter a valid email address';
    if (!createForm.initialPassword || createForm.initialPassword.length < 8 || !/[A-Za-z]/.test(createForm.initialPassword) || !/\d/.test(createForm.initialPassword)) {
      errors.initialPassword = 'Initial password must be at least 8 characters and include a letter and a number';
    }
    if (Object.keys(errors).length) {
      setCreateErrors(errors);
      return;
    }

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'same-origin',
        body: JSON.stringify({
          name: createForm.name.trim(),
          email: createForm.email.trim(),
          role: createForm.role,
          isActive: createForm.isActive,
          initialPassword: createForm.initialPassword,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        if (response.status === 409 && body.error?.code === 'EMAIL_ALREADY_IN_USE') {
          setCreateErrors({ email: body.error.fields?.email || 'This email address is already in use.' });
        } else {
          setCreateErrors({ form: body.error?.message || 'Unable to create user.' });
        }
        return;
      }
      setSuccessMessage('User created.');
      closeCreate();
      loadUsers();
    } catch {
      setCreateErrors({ form: 'Unable to create user.' });
    }
  }

  // Edit dialog
  function openEdit(user: AdminUser) {
    setEditForm({
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    });
    setEditErrors({});
    setLastAdminError('');
    setEditTarget(user);
  }

  function closeEdit() {
    setEditTarget(null);
    setEditErrors({});
    setLastAdminError('');
  }

  function openResetFromEdit(user: AdminUser) {
    closeEdit();
    setResetForm({ newInitialPassword: '' });
    setResetError('');
    setResetTarget(user);
  }

  async function submitEdit(event: FormEvent) {
    event.preventDefault();
    if (!editTarget) return;
    setEditErrors({});
    setLastAdminError('');

    const errors: Record<string, string> = {};
    if (!editForm.name.trim()) errors.name = 'Name is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email)) errors.email = 'Enter a valid email address';
    if (Object.keys(errors).length) {
      setEditErrors(errors);
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${editTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'same-origin',
        body: JSON.stringify({
          name: editForm.name.trim(),
          email: editForm.email.trim(),
          role: editForm.role,
          isActive: editForm.isActive,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        if (response.status === 409 && body.error?.code === 'EMAIL_ALREADY_IN_USE') {
          setEditErrors({ email: body.error.fields?.email || 'This email address is already in use.' });
        } else if (response.status === 409 && body.error?.code === 'LAST_ACTIVE_ADMIN') {
          setLastAdminError('You cannot deactivate or change the role of the last active Administrator. At least one active Administrator must remain.');
        } else {
          setEditErrors({ form: body.error?.message || 'Unable to update user.' });
        }
        return;
      }
      setSuccessMessage('User updated.');
      closeEdit();
      loadUsers();
    } catch {
      setEditErrors({ form: 'Unable to update user.' });
    }
  }

  // Reset password dialog
  function closeReset() {
    setResetTarget(null);
    setResetError('');
  }

  async function submitReset(event: FormEvent) {
    event.preventDefault();
    if (!resetTarget) return;
    setResetError('');

    if (!resetForm.newInitialPassword || resetForm.newInitialPassword.length < 8 || !/[A-Za-z]/.test(resetForm.newInitialPassword) || !/\d/.test(resetForm.newInitialPassword)) {
      setResetError('New initial password must be at least 8 characters and include a letter and a number');
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${resetTarget.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'same-origin',
        body: JSON.stringify({ newInitialPassword: resetForm.newInitialPassword }),
      });
      const body = await response.json();
      if (!response.ok) {
        setResetError(body.error?.message || 'Unable to set new initial password.');
        return;
      }
      setSuccessMessage('New initial password set.');
      closeReset();
      loadUsers();
    } catch {
      setResetError('Unable to set new initial password.');
    }
  }

  const isSelf = (userId: number) => userId === currentUserId;

  return (
    <section className="user-management" aria-label="User Management">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ margin: 0 }}>User Management</h1>
        <button type="button" className="primary-action" onClick={openCreate}>Create User</button>
      </header>

      <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ display: 'grid', gap: 4, minWidth: 200 }}>
          Search users
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email" />
        </label>
        <label style={{ display: 'grid', gap: 4, minWidth: 180 }}>
          Role filter
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as Role | '')}>
            <option value="">All roles</option>
            <option value="REQUESTER">Requester</option>
            <option value="IT_STAFF">IT Staff</option>
            <option value="ADMINISTRATOR">Administrator</option>
          </select>
        </label>
        <button type="submit" className="primary-action">Search</button>
        {hasActiveFilters && <button type="button" className="secondary-action" onClick={clearFilters}>Clear Filters</button>}
      </form>

      {successMessage && <p role="status" style={{ marginBottom: 16, color: '#006B3C' }}>{successMessage}</p>}
      {lastAdminError && (
        <div role="alert" className="error-banner" style={{ marginBottom: 16 }}>
          {lastAdminError}
        </div>
      )}
      {error && (
        <div role="alert" className="error-banner" style={{ marginBottom: 16 }}>
          {error}
          <button type="button" onClick={loadUsers} style={{ marginLeft: 12 }}>Retry</button>
        </div>
      )}
      {forbidden && (
        <div role="alert" className="error-banner" style={{ marginBottom: 16 }}>
          <h2>Access forbidden</h2>
          <p>You do not have permission to manage users.</p>
        </div>
      )}

      <div className="user-list-region" aria-live="polite" aria-busy={loading}>
        {loading && <p role="status">Loading users...</p>}

        {!loading && !error && !forbidden && users.length === 0 && (
          <div className="state-panel">
            <h2>No users found</h2>
            <p>There are no user accounts yet.</p>
          </div>
        )}

        {!loading && !error && !forbidden && users.length > 0 && (
          <>
            <table className="users-table">
              <caption>User accounts</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>
                      <span className={`badge ${roleBadgeClass(user.role)}`}>{roleLabels[user.role]}</span>
                    </td>
                    <td>
                      <span className={statusClass(user.isActive)}>{statusLabel(user.isActive)}</span>
                    </td>
                    <td>
                      <button type="button" onClick={() => openEdit(user)}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="user-cards">
              {users.map((user) => (
                <article className="user-card" key={user.id}>
                  <h2>{user.name}</h2>
                  <p>{user.email}</p>
                  <dl>
                    <dt>Role</dt>
                    <dd><span className={`badge ${roleBadgeClass(user.role)}`}>{roleLabels[user.role]}</span></dd>
                    <dt>Status</dt>
                    <dd><span className={statusClass(user.isActive)}>{statusLabel(user.isActive)}</span></dd>
                    <dt>Created</dt>
                    <dd>{formatDate(user.createdAt)}</dd>
                  </dl>
                  <button type="button" onClick={() => openEdit(user)}>Edit</button>
                </article>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Create User Dialog */}
      {createOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="create-user-title" className="dialog-overlay">
          <div className="dialog-panel">
            <h2 id="create-user-title">Create User</h2>
            <form onSubmit={submitCreate}>
              <div style={{ display: 'grid', gap: 16 }}>
                <div>
                  <label htmlFor="create-name">Name</label>
                  <input id="create-name" type="text" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} />
                  {createErrors.name && <p role="alert" style={{ color: '#b42318', marginTop: 4 }}>{createErrors.name}</p>}
                </div>
                <div>
                  <label htmlFor="create-email">Email</label>
                  <input id="create-email" type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} />
                  {createErrors.email && <p role="alert" style={{ color: '#b42318', marginTop: 4 }}>{createErrors.email}</p>}
                </div>
                <div>
                  <label htmlFor="create-role">Role</label>
                  <select id="create-role" value={createForm.role} onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as Role })}>
                    <option value="REQUESTER">Requester</option>
                    <option value="IT_STAFF">IT Staff</option>
                    <option value="ADMINISTRATOR">Administrator</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="create-active" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input id="create-active" type="checkbox" checked={createForm.isActive} onChange={(e) => setCreateForm({ ...createForm, isActive: e.target.checked })} />
                    Active
                  </label>
                </div>
                <div>
                  <label htmlFor="create-initial-password">Initial Password</label>
                  <input id="create-initial-password" type="password" value={createForm.initialPassword} onChange={(e) => setCreateForm({ ...createForm, initialPassword: e.target.value })} />
                  <PasswordRuleHint />
                  {createErrors.initialPassword && <p role="alert" style={{ color: '#b42318', marginTop: 4 }}>{createErrors.initialPassword}</p>}
                </div>
                {createErrors.form && <p role="alert" style={{ color: '#b42318' }}>{createErrors.form}</p>}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button type="submit" className="primary-action">Create User</button>
                  <button type="button" className="secondary-action" onClick={closeCreate}>Cancel</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Dialog */}
      {editTarget && (
        <div role="dialog" aria-modal="true" aria-labelledby="edit-user-title" className="dialog-overlay">
          <div className="dialog-panel">
            <h2 id="edit-user-title">Edit User</h2>
            <form onSubmit={submitEdit}>
              <div style={{ display: 'grid', gap: 16 }}>
                <div>
                  <label htmlFor="edit-name">Name</label>
                  <input id="edit-name" type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="edit-email">Email</label>
                  <input id="edit-email" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                  {editErrors.email && <p role="alert" style={{ color: '#b42318', marginTop: 4 }}>{editErrors.email}</p>}
                </div>
                <div>
                  <label htmlFor="edit-role">Role</label>
                  <select id="edit-role" value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value as Role })}>
                    <option value="REQUESTER">Requester</option>
                    <option value="IT_STAFF">IT Staff</option>
                    <option value="ADMINISTRATOR">Administrator</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="edit-active" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      id="edit-active"
                      type="checkbox"
                      checked={editForm.isActive}
                      onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                      disabled={isSelf(editTarget.id)}
                    />
                    Active
                    {isSelf(editTarget.id) && <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>You cannot deactivate your own account</span>}
                  </label>
                </div>
                {lastAdminError && <div role="alert" className="error-banner" style={{ marginTop: 8 }}>{lastAdminError}</div>}
                {editErrors.form && <p role="alert" style={{ color: '#b42318' }}>{editErrors.form}</p>}
                <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit" className="primary-action">Save Changes</button>
                    <button type="button" className="secondary-action" onClick={() => openResetFromEdit(editTarget!)}>Set New Initial Password</button>
                  </div>
                  <button type="button" className="secondary-action" onClick={closeEdit}>Cancel</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Dialog */}
      {resetTarget && (
        <div role="dialog" aria-modal="true" aria-labelledby="reset-password-title" className="dialog-overlay">
          <div className="dialog-panel">
            <h2 id="reset-password-title">Set New Initial Password</h2>
            <form onSubmit={submitReset}>
              <div style={{ display: 'grid', gap: 16 }}>
                <div>
                  <label htmlFor="reset-password">New Initial Password</label>
                  <input id="reset-password" type="password" value={resetForm.newInitialPassword} onChange={(e) => setResetForm({ ...resetForm, newInitialPassword: e.target.value })} />
                  <PasswordRuleHint />
                  {resetError && <p role="alert" style={{ color: '#b42318', marginTop: 4 }}>{resetError}</p>}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
                  <button type="button" className="secondary-action" onClick={closeReset}>Cancel</button>
                  <button type="submit" className="primary-action">Set Password</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
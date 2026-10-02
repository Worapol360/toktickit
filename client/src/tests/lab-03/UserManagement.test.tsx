/**
 * UI-06: User Management list, search, filter, create/edit
 * UI-07: User Management safety-rule feedback
 * RESP-03: Mobile layout (<768px) — cards region present alongside the table
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { UserManagement } from '../../pages/UserManagement';

const currentAdmin = {
  id: 10,
  name: 'Admin User',
  email: 'admin@example.com',
  role: 'ADMINISTRATOR',
  isActive: true,
  mustChangePassword: false,
  createdAt: '2026-09-01T02:00:00.000Z',
};

const noah = {
  id: 6,
  name: 'Noah Williams',
  email: 'noah.it@example.com',
  role: 'IT_STAFF',
  isActive: true,
  mustChangePassword: false,
  createdAt: '2026-09-01T02:00:00.000Z',
};

const aiko = {
  id: 1,
  name: 'Aiko Tanaka',
  email: 'aiko@example.com',
  role: 'REQUESTER',
  isActive: true,
  mustChangePassword: false,
  createdAt: '2026-09-01T02:00:00.000Z',
};

function makeResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const apiBodies = {
  list: { users: [currentAdmin, noah, aiko] },
  create: {
    user: {
      id: 11,
      name: 'New Person',
      email: 'new.person@example.com',
      role: 'IT_STAFF',
      isActive: true,
      mustChangePassword: true,
      createdAt: '2026-09-01T02:00:00.000Z',
    },
  },
  update: { user: noah },
  reset: { user: noah },
};

const errorCodeToStatus: Record<string, number> = {
  EMAIL_ALREADY_IN_USE: 409,
  FORBIDDEN: 403,
  LAST_ACTIVE_ADMIN: 409,
  CANNOT_DEACTIVATE_SELF: 409,
  USER_NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
};

function statusForBody(body: unknown) {
  if (body && typeof body === 'object' && 'error' in body) {
    const err = (body as { error?: { code?: string } }).error;
    if (err?.code && errorCodeToStatus[err.code]) return errorCodeToStatus[err.code];
    return 400;
  }
  return 200;
}

function setupFetch() {
  const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const target = String(url);
    const method = init?.method ?? 'GET';
    const resetMatch = target.match(/^\/api\/admin\/users\/\d+\/reset-password$/);
    if (resetMatch && method === 'POST') {
      const status = statusForBody(apiBodies.reset);
      return Promise.resolve(makeResponse(apiBodies.reset, status));
    }
    const updateMatch = target.match(/^\/api\/admin\/users\/\d+$/);
    if (updateMatch && method === 'PATCH') {
      const status = statusForBody(apiBodies.update);
      return Promise.resolve(makeResponse(apiBodies.update, status));
    }
    if (target.startsWith('/api/admin/users') && method === 'POST') {
      const status = statusForBody(apiBodies.create);
      return Promise.resolve(makeResponse(apiBodies.create, status));
    }
    if (target.startsWith('/api/admin/users') && method === 'GET') {
      const status = statusForBody(apiBodies.list);
      return Promise.resolve(makeResponse(apiBodies.list, status));
    }
    throw new Error(`Unexpected fetch: ${target}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function editRowByName(name: string) {
  const row = within(screen.getByRole('table')).getByText(name).closest('tr')!;
  fireEvent.click(within(row as HTMLElement).getByRole('button', { name: 'Edit' }));
}

beforeEach(() => {
  vi.restoreAllMocks();
  apiBodies.list = { users: [currentAdmin, noah, aiko] };
  apiBodies.create = {
    user: {
      id: 11,
      name: 'New Person',
      email: 'new.person@example.com',
      role: 'IT_STAFF',
      isActive: true,
      mustChangePassword: true,
      createdAt: '2026-09-01T02:00:00.000Z',
    },
  };
  apiBodies.update = { user: noah };
  apiBodies.reset = { user: noah };
});

// ─── UI-06: List, search, filter, create/edit ─────────────────────────────────

describe('UI-06: UserManagement list, search, filter, create/edit', () => {
  it('renders the required columns and per-row data in the desktop table', async () => {
    setupFetch();
    render(<UserManagement currentUserId={10} />);

    expect(await screen.findByRole('columnheader', { name: 'Name' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Email' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Role' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Actions' })).toBeTruthy();

    const table = screen.getByRole('table');
    expect(within(table).getByText('Noah Williams')).toBeTruthy();
    expect(within(table).getByText('noah.it@example.com')).toBeTruthy();
    expect(within(table).getByText('IT Staff')).toBeTruthy();
    expect(within(table).getAllByText('Active')).toHaveLength(3);
    expect(within(table).getAllByRole('button', { name: 'Edit' })).toHaveLength(3);
  });

  it('renders the mobile card layout with the same fields', async () => {
    setupFetch();
    render(<UserManagement currentUserId={10} />);
    await screen.findByRole('columnheader', { name: 'Name' });

    const cards = document.querySelectorAll('.user-card');
    expect(cards).toHaveLength(3);
    expect(cards[1].textContent).toContain('Noah Williams');
    expect(cards[1].textContent).toContain('noah.it@example.com');
    expect(cards[1].textContent).toContain('IT Staff');
    expect(cards[1].textContent).toContain('Active');
  });

it('renders role badges with role-specific classes', async () => {
    setupFetch();
    render(<UserManagement currentUserId={10} />);
    await screen.findByRole('columnheader', { name: 'Name' });

    expect(document.querySelectorAll('.role-badge-requester')).toHaveLength(2);
    expect(document.querySelectorAll('.role-badge-it-staff')).toHaveLength(2);
    expect(document.querySelectorAll('.role-badge-administrator')).toHaveLength(2);
  });

  it('filters the list by search term', async () => {
    const fetchMock = setupFetch();
    render(<UserManagement currentUserId={10} />);
    await screen.findByRole('columnheader', { name: 'Name' });

    apiBodies.list = { users: [noah] };
    const search = screen.getByLabelText('Search users');
    fireEvent.change(search, { target: { value: 'noah' } });
    fireEvent.submit(search.closest('form')!);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('search=noah'),
        expect.anything(),
      ),
    );
    await waitFor(() =>
      expect(within(screen.getByRole('table')).queryByText('Aiko Tanaka')).toBeNull(),
    );
    expect(within(screen.getByRole('table')).getByText('Noah Williams')).toBeTruthy();
  });

  it('filters the list by role', async () => {
    const fetchMock = setupFetch();
    render(<UserManagement currentUserId={10} />);
    await screen.findByRole('columnheader', { name: 'Name' });

    fireEvent.change(screen.getByLabelText('Role filter'), {
      target: { value: 'IT_STAFF' },
    });

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('role=IT_STAFF'),
        expect.anything(),
      ),
    );
  });

  it('creates a user with an initial password and refreshes the list', async () => {
    const fetchMock = setupFetch();
    render(<UserManagement currentUserId={10} />);
    await screen.findByRole('columnheader', { name: 'Name' });

    fireEvent.click(screen.getByRole('button', { name: 'Create User' }));
    const dialog = await screen.findByRole('dialog', { name: 'Create User' });

    expect(within(dialog).getByLabelText('Name')).toBeTruthy();
    expect(within(dialog).getByLabelText('Email')).toBeTruthy();
    expect(within(dialog).getByLabelText('Role')).toBeTruthy();
    expect(within(dialog).getByLabelText('Active')).toBeTruthy();
    expect(within(dialog).getByLabelText('Initial Password')).toBeTruthy();
    expect(
      within(dialog).getByText(
        /at least 8 characters and include a letter and a number/i,
      ),
    ).toBeTruthy();

    fireEvent.change(within(dialog).getByLabelText('Name'), {
      target: { value: 'New Person' },
    });
    fireEvent.change(within(dialog).getByLabelText('Email'), {
      target: { value: 'new.person@example.com' },
    });
    fireEvent.change(within(dialog).getByLabelText('Role'), {
      target: { value: 'IT_STAFF' },
    });
    fireEvent.change(within(dialog).getByLabelText('Initial Password'), {
      target: { value: 'Temp1234' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create User' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/users',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'New Person',
            email: 'new.person@example.com',
            role: 'IT_STAFF',
            isActive: true,
            initialPassword: 'Temp1234',
          }),
        }),
      ),
    );
    expect(await screen.findByRole('status')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows an inline email error when the email is already in use', async () => {
    setupFetch();
    render(<UserManagement currentUserId={10} />);
    await screen.findByRole('columnheader', { name: 'Name' });

    apiBodies.create = {
      error: {
        code: 'EMAIL_ALREADY_IN_USE',
        message: 'This email address is already in use.',
        fields: { email: 'This email address is already in use.' },
      },
    };

    fireEvent.click(screen.getByRole('button', { name: 'Create User' }));
    const dialog = await screen.findByRole('dialog', { name: 'Create User' });

    fireEvent.change(within(dialog).getByLabelText('Name'), {
      target: { value: 'Duplicate Person' },
    });
    fireEvent.change(within(dialog).getByLabelText('Email'), {
      target: { value: 'aiko@example.com' },
    });
    fireEvent.change(within(dialog).getByLabelText('Initial Password'), {
      target: { value: 'Temp1234' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create User' }));

    expect(
      await within(dialog).findByText(/already in use/i),
    ).toBeTruthy();
    expect(screen.getByRole('dialog', { name: 'Create User' })).toBeTruthy();
  });

  it('edits a user without ever showing a password field', async () => {
    const fetchMock = setupFetch();
    render(<UserManagement currentUserId={10} />);
    await screen.findByRole('columnheader', { name: 'Name' });

    editRowByName('Noah Williams');
    const dialog = await screen.findByRole('dialog', { name: 'Edit User' });

    expect(within(dialog).getByLabelText('Name')).toBeTruthy();
    expect(within(dialog).getByLabelText('Email')).toBeTruthy();
    expect(within(dialog).getByLabelText('Role')).toBeTruthy();
    expect(within(dialog).getByLabelText('Active')).toBeTruthy();
    expect(within(dialog).queryByLabelText(/password/i)).toBeNull();

    fireEvent.change(within(dialog).getByLabelText('Name'), {
      target: { value: 'Noah Edited' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save Changes' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/users/6',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({
            name: 'Noah Edited',
            email: 'noah.it@example.com',
            role: 'IT_STAFF',
            isActive: true,
          }),
        }),
      ),
    );
    expect(await screen.findByRole('status')).toBeTruthy();
  });

  it('sets a new initial password from a separate one-field dialog', async () => {
    const fetchMock = setupFetch();
    render(<UserManagement currentUserId={10} />);
    await screen.findByRole('columnheader', { name: 'Name' });

    editRowByName('Noah Williams');
    const editDialog = await screen.findByRole('dialog', { name: 'Edit User' });
    fireEvent.click(
      within(editDialog).getByRole('button', { name: 'Set New Initial Password' }),
    );

    const resetDialog = await screen.findByRole('dialog', {
      name: 'Set New Initial Password',
    });
    expect(within(resetDialog).getByLabelText('New Initial Password')).toBeTruthy();
    expect(
      within(resetDialog).getByText(
        /at least 8 characters and include a letter and a number/i,
      ),
    ).toBeTruthy();

    fireEvent.change(within(resetDialog).getByLabelText('New Initial Password'), {
      target: { value: 'Temp5678' },
    });
    fireEvent.click(within(resetDialog).getByRole('button', { name: 'Set Password' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/users/6/reset-password',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ newInitialPassword: 'Temp5678' }),
        }),
      ),
    );
    expect(await screen.findByRole('status')).toBeTruthy();
  });

  it('shows the forbidden state when the API returns 403', async () => {
    setupFetch();
    apiBodies.list = {
      error: {
        code: 'FORBIDDEN',
        message: 'You do not have permission to perform this action.',
      },
    };
    render(<UserManagement currentUserId={10} />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/forbidden|permission/i);
  });
});

// ─── UI-07: Safety-rule feedback ──────────────────────────────────────────────

describe('UI-07: UserManagement safety-rule feedback', () => {
  it('disables the Active toggle with a caption on the signed-in Administrator\'s own row', async () => {
    setupFetch();
    render(<UserManagement currentUserId={10} />);
    await screen.findByRole('columnheader', { name: 'Name' });

    editRowByName('Admin User');
    const dialog = await screen.findByRole('dialog', { name: 'Edit User' });

    const toggle = within(dialog).getByRole('checkbox', { name: /Active/i });
    expect(toggle).toBeDisabled();
    expect(
      within(dialog).getByText(/cannot deactivate your own account/i),
    ).toBeTruthy();
  });

  it('keeps the Active toggle enabled when editing another user', async () => {
    setupFetch();
    render(<UserManagement currentUserId={10} />);
    await screen.findByRole('columnheader', { name: 'Name' });

    editRowByName('Aiko Tanaka');
    const dialog = await screen.findByRole('dialog', { name: 'Edit User' });

    expect(within(dialog).getByRole('checkbox', { name: /Active/i })).toBeEnabled();
    expect(
      within(dialog).queryByText(/cannot deactivate your own account/i),
    ).toBeNull();
  });

  it('shows a failure banner when the last active Administrator is blocked', async () => {
    setupFetch();
    render(<UserManagement currentUserId={10} />);
    await screen.findByRole('columnheader', { name: 'Name' });

    apiBodies.update = {
      error: {
        code: 'LAST_ACTIVE_ADMIN',
        message: 'At least one active Administrator must remain.',
      },
    };

    editRowByName('Admin User');
    const dialog = await screen.findByRole('dialog', { name: 'Edit User' });

    fireEvent.change(within(dialog).getByLabelText('Role'), {
      target: { value: 'IT_STAFF' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save Changes' }));

    const alert = await within(dialog).findByRole('alert');
    expect(alert.textContent).toMatch(/last active Administrator/i);
    expect(alert.textContent).toMatch(/at least one active Administrator must remain/i);
  });
});

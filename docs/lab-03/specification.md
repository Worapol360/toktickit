# Lab 3 Sprint Engineering Specification

## 1. Sprint Goal
Replace the temporary Development Requester selector with real, role-based authentication so that Requesters, IT Staff, and Administrators each operate through an authenticated identity with server-enforced permissions. Deliver a shared IT Staff Ticket Queue and Ticket Detail workflow (ownership, IT Priority, status, Public Comments, Internal Notes) and a minimalist Administrator User Management screen, while preserving every Lab 2 Requester capability and existing Ticket/Attachment data.

## 2. Stakeholder Request Interpretation
The system must move from a development-only requester switcher to secure login with first-login password change. Requesters keep using the Lab 2 ticket functions, now tied to their authenticated account instead of a selected `requesterId`. IT Staff need a queue to find and work tickets: claim/reassign ownership, set IT Priority, move a ticket through its permitted statuses, and communicate through Public Comments while keeping Internal Notes private. Requesters may flag that a problem appears resolved, but only IT Staff/Administrator can formally resolve or close a ticket. Administrators need a simple screen to create accounts, assign one role, edit basic information, activate/deactivate accounts, and issue a new initial password. Every protected action must be enforced by the backend, not by hiding a button.

## 3. Scope

### Included
- Email + password authentication, session establishment, logout, and current-user retrieval.
- Mandatory first-login password change for accounts with an initial/reset password.
- Role-based navigation and server-side authorization for Requester, IT Staff, and Administrator.
- Migration of Lab 2 Development Requester records into the authenticated `User` model, preserving existing Ticket/Attachment ownership.
- Continued Requester Ticket/Attachment functions from Lab 2, now scoped to the authenticated identity.
- Requester Public Comments and a "Problem Appears Resolved" indication on owned tickets.
- IT Staff Ticket Queue: search, filters, sort, pagination, ownership/status visibility.
- IT Staff Ticket Detail: claim/reassign ownership, set IT Priority, permitted status transitions, Public Comments, Internal Notes.
- Minimalist Administrator User Management: list (search by name/email, optional role filter), create user (one role), edit basic information, activate/deactivate, set new initial password.
- Zen Green UI extensions consistent with the Lab 2 design language.

### Excluded (deferred beyond Lab 3)
- Email invitations, password-reset email, multi-factor authentication, social login, single sign-on.
- Self-registration or Requester-created accounts.
- Actions Taken by IT Staff (deferred to Lab 4, along with the rule blocking resolution while Actions Taken are incomplete).
- Formal SLA calculation, escalation rules, and notification services.
- Dashboards and KPI analytics beyond simple queue counts.
- Multi-tenant organizations, departments, and customer administration.
- Multiple roles per user, user deletion, bulk user operations, import/export, and account-history screens.
- Profile photos and extended user-profile management.
- Account unlocking, administrator-approval workflows, and advanced identity-management functions.
- Mandatory pagination, multi-column sorting, and multiple simultaneous filters on the user list.

## 4. Functional Requirements
- **FR-01**: The system shall authenticate a user by email and password and establish a server-tracked session on success.
- **FR-02**: The system shall block access to normal application screens until a user flagged `mustChangePassword` saves a valid new password.
- **FR-03**: The system shall provide a logout action that revokes the session on the server, not only on the client.
- **FR-04**: The system shall provide a current-user endpoint that returns the authenticated identity, role, and password-change flag, or an unauthenticated response.
- **FR-05**: The system shall present only the navigation and actions permitted for the authenticated user's role.
- **FR-06**: The system shall enforce authorization for every protected endpoint on the server, independent of what the client UI displays.
- **FR-07**: The system shall let a Requester create and manage only their own Tickets and Attachments, using the authenticated identity instead of a client-supplied `requesterId`.
- **FR-08**: The system shall let a Requester post Public Comments on their own Ticket and indicate that the reported problem appears resolved.
- **FR-09**: The system shall let IT Staff and Administrator retrieve a shared Ticket Queue with search, filters, sorting, and pagination.
- **FR-10**: The system shall let IT Staff and Administrator claim an unassigned Ticket or reassign an already-owned Ticket.
- **FR-11**: The system shall let IT Staff and Administrator set IT Priority and change Ticket status according to the approved transition matrix.
- **FR-12**: The system shall let IT Staff and Administrator post Public Comments and Internal Notes, with Internal Notes withheld from Requester responses.
- **FR-13**: The system shall let an Administrator list, search, and optionally role-filter user accounts; create a user with one role and an initial password; edit name/email/role/activation state; and set a new initial password.
- **FR-14**: The system shall enforce Administrator safety rules: no duplicate email addresses, no self-deactivation, and at least one active Administrator at all times.

## 5. Business Rules

### 5.1 Role Authorization Matrix
| Action | Requester | IT Staff | Administrator |
|---|---|---|---|
| Create/view/manage own Tickets & Attachments | ✅ | ❌ (not as Requester) | ❌ (not as Requester) |
| Post Public Comment on an owned/queued Ticket | ✅ (own only) | ✅ | ✅ |
| Mark "Problem Appears Resolved" | ✅ (own only) | ❌ | ❌ |
| View IT Staff Ticket Queue / any Ticket Detail | ❌ | ✅ | ✅ |
| Claim / reassign Ticket ownership | ❌ | ✅ | ✅ |
| Set IT Priority | ❌ | ✅ | ✅ |
| Change Ticket status (formal transitions incl. Resolved/Closed) | ❌ | ✅ | ✅ |
| Create / view Internal Notes | ❌ | ✅ | ✅ |
| View, create, edit user accounts | ❌ | ❌ | ✅ |
| Deactivate/reactivate a user account | ❌ | ❌ | ✅ (not own account) |

A hidden or disabled frontend control is a usability aid only; every row above must be enforced at the API layer regardless of what the client sends.

### 5.2 Ticket Status Transition Matrix
Permitted statuses: `New`, `Open`, `In Progress`, `Waiting for Requester`, `Resolved`, `Closed`, `Reopened`, `Cancelled`.

| From | Allowed To | Who |
|---|---|---|
| New | Open, Cancelled | IT Staff, Administrator |
| Open | In Progress, Cancelled | IT Staff, Administrator |
| In Progress | Waiting for Requester, Resolved, Cancelled | IT Staff, Administrator |
| Waiting for Requester | In Progress, Resolved, Cancelled | IT Staff, Administrator |
| Resolved | Closed, Reopened | IT Staff, Administrator |
| Closed | Reopened | IT Staff, Administrator |
| Reopened | In Progress, Cancelled | IT Staff, Administrator |
| Cancelled | *(terminal — no further transition)* | — |

Any transition not listed above is rejected with a validation error and the current status is unchanged. Requesters never perform a formal status transition; their only related action is BR-15 below.

### 5.3 Numbered Business Rules
- **BR-01**: Only a user with `isActive = true` and a matching password hash may authenticate.
- **BR-02**: A user with `mustChangePassword = true` cannot reach normal application screens until a new password passing validation is saved; the change-password endpoint remains the only reachable authenticated action until then.
- **BR-03**: The authenticated session identity determines Requester ownership for every Ticket/Attachment/Comment operation; a `requesterId` supplied by the client is never trusted.
- **BR-04**: Public Comments are visible to the Ticket's Requester, IT Staff, and Administrator. Internal Notes are visible only to IT Staff and Administrator and must never be present in a Requester-facing response.
- **BR-05**: A Requester may set `requesterMarkedResolved = true` on their own Ticket but cannot set Current Status to `Resolved`, `Closed`, or any other formal status directly.
- **BR-06**: A failed login due to an unknown email or an incorrect password returns the same generic `INVALID_CREDENTIALS` response; the system never reveals whether the email is registered.
- **BR-07**: A login attempt against a correctly-authenticated but `isActive = false` account returns a distinct `ACCOUNT_INACTIVE` response without disclosing role, ticket, or other account details.
- **BR-08**: Logout revokes the session record server-side; a previously valid session token is rejected on any subsequent request after logout.
- **BR-09**: Email addresses are unique case-insensitively across all users; creating or editing a user to a duplicate email is rejected.
- **BR-10**: The current-user endpoint never returns `passwordHash` or other sensitive credential fields.
- **BR-11**: A Ticket has zero or one primary Ticket Owner; only an active IT Staff or Administrator user may be set as owner. Claiming an unassigned Ticket sets the current IT Staff/Administrator as owner; reassignment may target any other active IT Staff/Administrator.
- **BR-12**: Requested Priority is fixed at Ticket creation. IT Priority initially copies Requested Priority and may thereafter be changed only by IT Staff or Administrator.
- **BR-13**: Ticket status changes must follow the transition matrix in Section 5.2 and may be performed only by IT Staff or Administrator.
- **BR-14**: Public Comments and Internal Notes are append-only in Lab 3 (no edit or delete). Empty or whitespace-only content is rejected. Content is trimmed and limited to 5–2000 characters. Each entry records its author and creation time from the backend, never from the client.
- **BR-15**: The "Problem Appears Resolved" action is available only to the owning Requester and only while the Ticket is not already `Closed` or `Cancelled`; it does not alter Current Status.
- **BR-16**: An Administrator creates a user with exactly one role (`REQUESTER`, `IT_STAFF`, or `ADMINISTRATOR`), a name, an email, an activation state, and a system-issued initial password; the created account has `mustChangePassword = true`.
- **BR-17**: An Administrator may edit a user's name, email, role, and activation state; password changes happen only through the explicit "set new initial password" action, never through the general edit action.
- **BR-18**: Setting a new initial password immediately sets `mustChangePassword = true` for that user and invalidates that user's existing sessions.
- **BR-19**: An Administrator cannot deactivate or otherwise remove their own account.
- **BR-20**: The system must always retain at least one active Administrator; an action that would deactivate or reassign the role of the last active Administrator is rejected.
- **BR-21**: Deactivation, never deletion, is the only way to remove a user's access; deactivated users cannot authenticate (BR-01) and cannot be selected as a new Ticket Owner (BR-11).
- **BR-22**: All Lab 2 Requester validation and lifecycle rules (Ticket field validation, attachment format/size/count limits, soft-removal with reason, duplicate-submission protection, upload compensation) continue to apply unchanged, now enforced against the authenticated Requester's session identity.
- **BR-23**: Existing Lab 2 Ticket ownership and Attachment records must remain intact and correctly attributed after the Development-Requester-to-User migration; no Ticket may become orphaned or reassigned to the wrong Requester.

## 6. UI Specification Summary
Full detail lives in `docs/lab-03/ui-spec.md`. Summary of new/changed screens:
- **Login** — email/password form, validation, busy state, safe failure feedback, distinct inactive-account messaging.
- **Change Password** — mandatory when `mustChangePassword = true`; current password, new password, confirmation, password rules, and blocked navigation until saved.
- **Application shell** — Development Requester display and switcher removed; replaced by authenticated user name, role badge, and Logout; navigation renders only role-permitted destinations.
- **Requester Ticket Detail** — unchanged Lab 2 layout plus a Public Comments thread and a "Problem Appears Resolved" action; Requester fields remain read-only for status/priority.
- **IT Staff Ticket Queue** — new screen; desktop table / mobile cards with search, filters, sort, pagination, ownership and status badges, and an open-detail action.
- **IT Staff Ticket Detail** — extends the Ticket Detail surface with ownership controls, IT Priority control, permitted status control, a Public Comments thread, and a visually distinct Internal Notes thread.
- **Administrator User Management** — new screen; list with Name/Email/Role/Status/Edit, search, optional role filter, create/edit forms, and a "set new initial password" action.

All new screens reuse the Zen Green tokens, form conventions, badges, and responsive rules established in Lab 2 (Section 2 of `docs/lab-02/ui-spec.md`), extended as documented in `docs/lab-03/ui-spec.md`.

## 7. Data Changes

### 7.1 `User` (evolves `RequesterUser`)
The Lab 2 `RequesterUser` table is extended in place — the same primary keys are preserved so existing `Ticket.requesterId` foreign keys remain valid without a data migration of Ticket rows.
- `id`, `name`, `email` (unique, case-insensitive), `passwordHash`, `role` (`REQUESTER` | `IT_STAFF` | `ADMINISTRATOR`), `isActive`, `mustChangePassword`, `createdAt`, `updatedAt`.
- Index on `email` (unique) and on `role` (queue/admin filtering).

### 7.2 `Session`
- `id`, `userId` (FK → `User`), `tokenHash` (the raw token is never stored), `createdAt`, `expiresAt`, `revokedAt` (nullable).
- Index on `tokenHash` and on `userId`.

### 7.3 `Ticket` (extended)
Adds to the Lab 2 shape:
- `ownerId` (FK → `User`, nullable) — the primary Ticket Owner.
- `itPriority` (same enum as `requestedPriority`).
- `status` enum expanded to `New | Open | In Progress | Waiting for Requester | Resolved | Closed | Reopened | Cancelled`.
- `requesterMarkedResolved` (boolean, default `false`).
- `requesterId` now references `User` (role `REQUESTER`) instead of the retired `RequesterUser` table name.
- New composite index `(ownerId, status)` for queue filtering; existing `(requesterId, createdAt DESC)` index from Lab 2 is retained.

### 7.4 `PublicComment`
- `id`, `ticketId` (FK), `authorId` (FK → `User`), `content`, `createdAt`.

### 7.5 `InternalNote`
- `id`, `ticketId` (FK), `authorId` (FK → `User`, role `IT_STAFF`/`ADMINISTRATOR`), `content`, `createdAt`.

### 7.6 Migration Strategy
1. Add `passwordHash`, `role`, `mustChangePassword` columns to the existing requester table (default `role = 'REQUESTER'`, `mustChangePassword = true`) and rename the table/model to `User`.
2. Backfill every existing Requester with a locally-generated initial password (documented in the seed script for developer reference only; never a real secret) and `mustChangePassword = true`.
3. Insert new IT Staff and Administrator seed accounts directly into `User`.
4. Add `ownerId`, `itPriority` (backfilled from `requestedPriority`), `requesterMarkedResolved` (`false`), and the expanded `status` enum to `Ticket` via `npx prisma migrate dev`, then `npx prisma generate`.
5. Remove the Lab 2 `GET /api/requesters` development-selector endpoint and the client-side Development Requester selector/context state.
6. Verify via regression tests that every pre-existing Ticket and Attachment is still reachable by its correct (now authenticated) Requester.

### 7.7 Seed Data
- 4 active + 1 inactive Requester accounts.
- 3 active + 1 inactive IT Staff accounts.
- 1 active Administrator account.
- Realistic Tickets spread across Requesters, statuses, priorities, and assigned/unassigned ownership.
- Example Public Comments and Internal Notes containing no sensitive information.
- Seed script is idempotent (safe to re-run); documented local-only credentials, never committed as real secrets.

## 8. API Contract Summary
Full detail lives in `docs/lab-03/api-spec.md`. Endpoint groups:
- **Auth**: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/change-password`.
- **Requester (Lab 2 continuation)**: `GET /api/categories`, `GET /api/related-systems`, `POST /api/tickets`, `GET /api/tickets`, `GET /api/tickets/:id`, attachment endpoints, plus new `GET/POST /api/tickets/:id/comments` and `POST /api/tickets/:id/mark-resolved`.
- **IT Staff**: `GET /api/staff/tickets`, `GET /api/staff/tickets/:id`, `PATCH /api/staff/tickets/:id/owner`, `PATCH /api/staff/tickets/:id/priority`, `PATCH /api/staff/tickets/:id/status`, `GET/POST /api/staff/tickets/:id/notes`.
- **Administrator**: `GET /api/admin/users`, `POST /api/admin/users`, `PATCH /api/admin/users/:id`, `POST /api/admin/users/:id/reset-password`.
- Authentication uses an httpOnly, server-tracked session cookie (see `api-spec.md` Section 1 for full session/CSRF decisions). The Lab 2 `X-Requester-Id` header and `GET /api/requesters` endpoint are retired.

## 9. Acceptance Criteria
- **AC-01**: Given an active user with valid credentials, when the user logs in, then the backend establishes authenticated access and returns the permitted user identity and role.
- **AC-02**: Given a user who must change the initial password, when login succeeds, then normal application screens remain unavailable until a valid new password is saved.
- **AC-03**: Given an authenticated Requester, when the client supplies another `requesterId`, then the backend still applies the authenticated identity and does not return another Requester's data.
- **AC-04**: Given a Requester account, when an Internal Note endpoint is requested, then the operation is rejected without exposing note content.
- **AC-05**: Given an active account with correct credentials but `isActive = false`, when login is attempted, then it is rejected with `ACCOUNT_INACTIVE` and no session is established.
- **AC-06**: Given an unknown email or an incorrect password, when login is attempted, then a generic `INVALID_CREDENTIALS` response is returned that does not reveal which condition occurred.
- **AC-07**: Given an authenticated user, when logout is invoked, then the session is revoked server-side and a subsequent request using the old session token is treated as unauthenticated.
- **AC-08**: Given a Requester, when navigating to or calling an IT Staff Queue or Administrator endpoint, then both the UI navigation and the API reject the access as forbidden.
- **AC-09**: Given an unassigned Ticket, when an IT Staff member claims it, then `ownerId` is set to that member and reflected in both Queue and Detail views.
- **AC-10**: Given a Ticket owned by one IT Staff member, when a second IT Staff member reassigns it, then ownership updates to the new owner.
- **AC-11**: Given IT Staff or Administrator, when IT Priority is updated, then IT Priority changes while Requested Priority remains unchanged.
- **AC-12**: Given a status transition not present in the approved matrix, when attempted, then the request is rejected with a validation error and Current Status is unchanged.
- **AC-13**: Given a Requester on their own Ticket, when "Problem Appears Resolved" is used, then `requesterMarkedResolved` becomes `true` while Current Status is unaffected, and the Requester cannot set a formal status.
- **AC-14**: Given IT Staff/Administrator, when submitting an empty or whitespace-only Public Comment or Internal Note, then the submission is rejected with a validation error.
- **AC-15**: Given a Ticket with both Public Comments and Internal Notes, when a Requester views Ticket Detail, then only Public Comments are present in the response.
- **AC-16**: Given an Administrator, when creating a user with an email already in use (case-insensitive), then creation is rejected with a duplicate-email error.
- **AC-17**: Given an Administrator, when setting a new initial password for a user, then `mustChangePassword` becomes `true` and the user is required to change it at the next login.
- **AC-18**: Given the only active Administrator account, when deactivation or a role change away from Administrator is attempted, then the action is rejected.
- **AC-19**: Given an Administrator, when attempting to deactivate their own account, then the action is rejected.
- **AC-20**: Given pre-existing Lab 2 Tickets and Attachments, when the Lab 3 migration completes, then all data and ownership remain intact and reachable through the new authenticated Requester flow.

## 10. Definition of Done
- Engineering documentation (`specification.md`, `api-spec.md`, `ui-spec.md`, `tests.md`) completed and approved before implementation PRs merge.
- Migration from `RequesterUser`/Development Requester to authenticated `User` completed with zero data loss, verified by regression tests.
- Every endpoint in Section 8 enforces authentication and the Section 5.1 authorization matrix server-side.
- All Lab 2 Requester functions pass their original Lab 2 tests (or updated equivalents) using authenticated identity instead of `X-Requester-Id`.
- IT Staff Queue, Ticket Detail, Public Comments, and Internal Notes implemented per Sections 5–8 and covered by passing tests.
- Administrator User Management implemented per Sections 5–8, including all safety rules, and covered by passing tests.
- All unit, API, UI component, style, responsive, authorization, migration/regression, and E2E tests in `tests.md` pass on `lab3-staging` before the Release PR to `main`.
- Screenshot evidence captured under `artifacts/lab-03/screenshots/` for all required screens and states across desktop, tablet, and mobile.

## 11. Assumptions and Decisions
- **Session mechanism**: Server-tracked sessions with an opaque token stored in an httpOnly, `SameSite=Lax`, `Secure`-in-production cookie; only a hash of the token is persisted (`Session.tokenHash`). This was chosen over a stateless JWT specifically so logout can immediately revoke access server-side (BR-08), which a pure stateless JWT cannot do without an additional blocklist.
- **CSRF mitigation**: State-changing requests must include a custom `X-Requested-With: XMLHttpRequest` header in addition to the `SameSite=Lax` cookie; this is the course-scope mitigation and is documented as a known simplification versus a full CSRF-token scheme.
- **Password hashing**: bcrypt with a cost factor of 12.
- **Password rules**: minimum 8 characters, at least one letter and one number; the new password must differ from the current password.
- **Session lifetime**: 8-hour fixed expiration from issuance; no sliding renewal in Lab 3.
- **Migration approach**: in-place table evolution (Section 7.6) rather than a parallel table with a mapping step, to guarantee existing Ticket foreign keys never change.
- **IT Priority values**: reuses the exact same enum as Requested Priority (`Low`, `Medium`, `High`, `Urgent`) rather than a separate scale.
- **Internal Note / Public Comment length limit**: 5–2000 characters, matching the Lab 2 Ticket Description limit for consistency.
- **Administrator self-service**: Administrators do not perform IT Staff ticket operations in Lab 3 unless explicitly acting through a second IT Staff account; the Section 5.1 matrix treats Administrator as having IT Staff-equivalent Ticket permissions per the handout's minimum table, but User Management remains Administrator-only.

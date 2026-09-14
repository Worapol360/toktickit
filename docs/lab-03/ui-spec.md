# Lab 3 UI Specification

## 1. Purpose and visual direction
Lab 3 extends the Lab 2 Zen Green service-desk visual language to authenticated, role-based screens: Login, mandatory Change Password, the IT Staff Ticket Queue and Ticket Detail, and the Administrator User Management screen. New screens must read as part of the same application, not a second visual system. All tokens, spacing, and control-state rules below are unchanged from `docs/lab-02/ui-spec.md` Sections 2, 5, 9, 10, and 11, reproduced here so this document is self-contained, plus the Lab 3 additions in Sections 4–8.

## 2. Design tokens (unchanged from Lab 2)

### 2.1 Color tokens
| Token | Value | Intended use |
|---|---|---|
| `--color-primary` | `#006B3C` | Header, primary buttons, active nav, links |
| `--color-primary-hover` | `#0B7A46` | Hover/pressed state |
| `--color-primary-active` | `#00552F` | Keyboard focus/pressed reinforcement |
| `--color-page` | `#F6FAF8` | Main page background |
| `--color-pale` | `#EAF6EF` | Selected rows, info panels, soft success backgrounds |
| `--color-surface` | `#FFFFFF` | Cards, forms, tables, dialogs |
| `--color-surface-muted` | `#F3F6F4` | Read-only fields, disabled controls, skeletons |
| `--color-border` | `#D7E2DC` | Default borders |
| `--color-border-strong` | `#AFC5B8` | Hovered/emphasized borders |
| `--color-text` | `#17221C` | Primary text |
| `--color-text-muted` | `#5D6B63` | Supporting text |
| `--color-text-on-primary` | `#FFFFFF` | Text on primary green surfaces |
| `--color-error` | `#B42318` | Validation, destructive, failure |
| `--color-error-bg` | `#FDECEC` | Error banners/invalid fields |
| `--color-warning` | `#9A6700` | Warnings |
| `--color-warning-bg` | `#FFF7DB` | Warning badges/callouts |
| `--color-success` | `#18794E` | Success, active/healthy status |
| `--color-success-bg` | `#E7F5EC` | Success banners/badges |
| `--color-info` | `#176B87` | Neutral informational callouts |
| `--color-info-bg` | `#EAF6F7` | Info panels |

### 2.2 Typography, spacing, shape
Identical to Lab 2 Sections 2.2–2.3: one sans-serif family, the `--font-display` through `--font-caption` scale, 4px spacing unit, 16/24/32px gutters (mobile/tablet/desktop), 1200px max content width, 40px minimum control height (44px primary), 6px control radius, 8px card radius, 999px badge radius.

## 3. Application shell and navigation (changed from Lab 2)

The Development Requester display and "Change Requester" action are **removed**. The trailing shell area now shows:
- The authenticated user's name and a role badge (`Requester`, `IT Staff`, or `Administrator`) using the badge treatment in Section 8.
- A `Logout` action (tertiary button) that immediately revokes the session and returns to Login.

Navigation renders **only** the destinations permitted for the current role — an unauthorized destination must not appear even in a disabled state, since its mere presence would imply the feature exists:

| Role | Visible navigation |
|---|---|
| Requester | My Tickets, Create Ticket |
| IT Staff | Ticket Queue |
| Administrator | User Management |

The current route keeps the Lab 2 non-color active indicator and `aria-current="page"` equivalent. On mobile, navigation may collapse into a menu, but the user's name/role and Logout must remain discoverable and keyboard accessible.

## 4. Login and Change Password

### 4.1 Login
A centered card on `--color-page`, matching the Lab 2 Development Requester Selection surface proportions. Contains: brand mark, `Email` and `Password` fields (each with a visible label, not placeholder-only), a `Sign In` primary button, and a single-line failure banner region above the form.

States:
- **Editable** — both fields editable, `Sign In` enabled once both are non-empty.
- **Validation** — inline error below each invalid field (empty email, malformed email, empty password); first invalid field receives focus on submit.
- **Busy** — `Sign In` becomes `Signing In...`, disabled, spinner, `aria-busy="true"`.
- **Invalid credentials** — a single error banner ("Incorrect email or password.") above the form; password field is cleared, email is retained; no field-level distinction between "email not found" and "wrong password" (BR-06).
- **Inactive account** — a distinct banner ("This account is inactive. Contact an Administrator.") using `--color-warning`/`--color-warning-bg`, visually different from the invalid-credentials banner so a real user can tell the difference from a typo.
- **Success** — redirects into the role-appropriate landing screen (My Tickets / Ticket Queue / User Management), or to Change Password if `mustChangePassword` is `true`.

### 4.2 Mandatory Change Password
Presented immediately after a login where `mustChangePassword = true`, replacing the normal landing screen — the application shell nav is present but every other route redirects back here until the password is changed. Contains: a short explanation ("You must set a new password before continuing"), `Current Password`, `New Password`, `Confirm New Password`, password rule helper text (min 8 characters, at least one letter and one number), and a `Save New Password` primary action.

States mirror Login (Editable, Validation, Busy, Failure, Success) plus:
- **Mismatch** — inline error under `Confirm New Password` when it differs from `New Password`.
- **Same as current** — inline error under `New Password` when it equals `Current Password`.
- **Success** — brief confirmation, then automatic continuation into the normal application (no separate click required).

## 5. Requester regression additions

The Lab 2 Requester Ticket Detail screen (Section 4.4 of `docs/lab-02/ui-spec.md`) keeps its read-only metadata surface and attachment history unchanged, and adds:

- A **Public Comments** thread below the attachment history: each entry shows author name, role badge, timestamp, and content, oldest first. A comment composer (textarea + `Post Comment` primary button) sits below the thread with the same validation/busy/failure states as other forms (empty/whitespace blocked, 5–2000 characters).
- A **"Problem Appears Resolved"** secondary action near the ticket status area, visible only while status is not `Closed`/`Cancelled`. On success it shows an inline confirmation badge ("You marked this as appearing resolved") without changing the displayed Current Status badge.
- The Development Requester selector screen and its route are removed entirely.

## 6. IT Staff Ticket Queue

New screen, structurally parallel to Lab 2's My Tickets (Section 7 of `docs/lab-02/ui-spec.md`).

### 6.1 Controls
- Search input (`Search tickets`) covering ticket number, summary, requester name.
- Filters: Status, IT Priority, Ticket Owner (including an explicit `Unassigned` option), Category.
- Sort control (field + direction), default `Created Date` descending.
- `Clear Filters` secondary action.

### 6.2 Desktop table
Required columns: Ticket No., Created Date, Summary, Category, Requested Priority, IT Priority, Current Status, Ticket Owner, Last Updated, Actions (Open action). Justify any additional column against unreadable-mega-grid risk; do not add columns beyond what fits without horizontal scroll at 992px.

### 6.3 Mobile cards (<768px)
One card per ticket showing ticket number, summary, status, IT Priority, owner (or "Unassigned" badge), created/updated dates, and an `Open` action, following the same two-column label/value rhythm as Lab 2's My Tickets cards.

### 6.4 States
Loading skeleton, Empty (no tickets exist yet — rare, but defined), No-Results (search/filter yields zero), Forbidden (non-Staff role reaching the route directly — should not normally be reachable via nav, but the state must exist for direct-URL access), and Failure (with retry), matching the Lab 2 reusable-state table (Section 9).

## 7. IT Staff Ticket Detail

Extends the same Ticket Detail surface as Section 5 above, with staff-only additions:

- **Ownership control**: shows current owner or "Unassigned"; a `Claim` primary action when unassigned or owned by someone else, and a `Reassign` action opening a small owner-picker limited to active IT Staff/Administrator users.
- **IT Priority control**: an editable select (read-only Requested Priority stays visible alongside it for comparison), using the same priority badge treatment as Requested Priority.
- **Status control**: an editable select constrained client-side to the permitted next statuses from the current status (mirroring the Section 5.2 transition matrix in `specification.md`); a disabled option is never silently hidden — instead the full set is shown with non-permitted values disabled and labeled, so staff understand why an option is unavailable.
- **Public Comments thread**: identical presentation to Section 5, with the composer available to staff too.
- **Internal Notes thread**: visually distinct from Public Comments — a `--color-warning-bg` tinted panel with a lock icon and an explicit "Internal Notes — not visible to Requester" header, its own composer, same validation/busy/failure rules. The two threads must never share a single visual container, to prevent a staff member posting a private note into the public thread by mistake.

## 8. Administrator User Management

New screen, single view with an inline create/edit surface (no full-page navigation away from the list).

### 8.1 List
Table (desktop) / cards (mobile, same card pattern as Sections 6.3/7.3) showing Name, Email, Role (badge), Status (Active/Inactive badge, `--color-success`/`--color-text-muted` treatment), and an `Edit` action per row. No pagination, no multi-column sort (out of scope) — the list is expected to remain small enough to scan.

### 8.2 Controls
`Search users` input (name/email), optional Role filter select, `Create User` primary action.

### 8.3 Create / Edit form
A dialog or inline panel with Name, Email, Role (select), Active toggle, and — create only — an `Initial Password` field with the same rule helper text as Change Password. The edit form never shows a password field; it instead exposes a separate `Set New Initial Password` tertiary action that opens a focused one-field dialog.

### 8.4 States and safety feedback
- **Validation** — inline errors for invalid name/email/role/password, standard placement rules from Lab 2 Section 5.2.
- **Duplicate email** — inline error under the Email field, not just a banner, so the exact cause is unambiguous.
- **Self-deactivation blocked** — the Active toggle is disabled with an inline explanatory caption ("You cannot deactivate your own account") when editing the signed-in Administrator's own row; the same rule is enforced again server-side.
- **Last-active-Administrator blocked** — attempting to deactivate or change the role of the last active Administrator shows a failure banner explaining the rule rather than a generic error.
- **Forbidden** — a non-Administrator reaching this route directly sees the standard Forbidden state (Section 6.4) rather than a blank or broken screen.
- **Success** — inline confirmation on create/edit/reset-password, list refreshes in place without a full page reload.

## 9. Reusable application states (unchanged from Lab 2)
Every data-driven Lab 3 screen defines Initial, Loading, Validation, Submitting, Success, Failure, Empty, and No-Results per `docs/lab-02/ui-spec.md` Section 9, plus a **Forbidden** state (banner explaining the role restriction, with a link back to a permitted screen) used specifically for direct-URL access to an unauthorized route.

## 10. Badges (extended)
In addition to Lab 2's Requested Priority and Status badges: **IT Priority** reuses the identical priority badge treatment; **Role** badges use `--color-info-bg`/`--color-info` for Requester, `--color-pale`/`--color-primary` for IT Staff, and `--color-primary` filled with `--color-text-on-primary` for Administrator; **Ownership** uses a neutral pill (`--color-surface-muted`) reading "Unassigned" when `owner` is `null`.

## 11. Responsive layout rules (unchanged from Lab 2)
Desktop ≥992px, Tablet 768–991px, Mobile <768px — identical gutter, max-width, table-to-card, and one-column-form rules as `docs/lab-02/ui-spec.md` Section 10, applied to all Lab 3 screens (Login/Change Password use the same centered-card pattern as the Lab 2 Development Requester Selection screen).

## 12. Accessibility requirements (unchanged from Lab 2)
All rules from `docs/lab-02/ui-spec.md` Section 11 apply, plus: the Internal Notes panel's lock icon must have an accessible name ("Internal — staff only"), and the Forbidden state must be announced via the same live-region pattern used for Failure states.

## 13. Visual inspection and evidence
Cover Login, Change Password, Staff Ticket Queue, Staff Ticket Detail (including Internal Notes panel), Requester Ticket Detail (Public Comments + Problem Appears Resolved), and Administrator User Management (list, create, edit, reset-password dialog, safety-rule states) at desktop, tablet, and mobile. Save under:

`artifacts/lab-03/screenshots/<screen>/<viewport>/<state>.png`

Required checks add to the Lab 2 checklist: role badge and navigation correctness per role, Public Comments vs. Internal Notes visual separation, disabled-with-explanation states for the two Administrator safety rules, and the distinct Invalid-Credentials vs. Inactive-Account banners on Login.

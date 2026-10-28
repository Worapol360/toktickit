# Lab 4 UI Specification

Companion files: [`specification.md`](./specification.md) · [`api-spec.md`](./api-spec.md) · [`tests.md`](./tests.md)

This document extends `docs/lab-03/ui-spec.md`. Components, tokens, and conventions not mentioned here are unchanged. Where this file and Lab 3 disagree, this file wins for Lab 4 screens.

## 1. Zen Green design tokens

Values verified in the current `AppShell` are marked ✔. New Lab 4 tokens are marked NEW and must be added to the shared token table when implemented (no ad-hoc hex values in components).

| Token | Value | Use |
|---|---|---|
| `--color-primary` ✔ | `#006B3C` | Header, primary buttons, links, focus accents |
| `--color-on-primary` ✔ | `#FFFFFF` | Text on primary |
| `--color-bg` ✔ | `#F6FAF8` | Page background |
| `--color-text` ✔ | `#17221C` | Body text |
| `--color-surface-tint` ✔ | `#EAF6EF` | Role badge, "shared with Requester" label, info panels |
| `--color-warning-bg` NEW | `#FFF4D6` | Private (staff-only) label, open follow-up, gate hints |
| `--color-warning-text` NEW | `#5C3D00` | Text on warning background |
| `--color-danger` NEW | `#B3261E` | Error text, invalid borders |
| `--color-danger-bg` NEW | `#FDECEA` | Error banners |

Rules: every text/background pair must reach WCAG AA contrast (≥ 4.5:1 normal text, ≥ 3:1 large text and UI borders) — verified in the checklist (§9). Colour is never the only carrier of meaning (§7).

## 2. Navigation and routes

| Role | Nav entries (in order) | Landing after login |
|---|---|---|
| Requester | Dashboard · My Tickets · Create Ticket | `/dashboard` |
| IT Staff | Dashboard · Ticket Queue | `/dashboard` |
| Administrator | Dashboard · Ticket Queue · User Management | `/dashboard` |

| Route | Requester | IT Staff | Administrator |
|---|---|---|---|
| `/dashboard` | Requester Dashboard | Staff Dashboard | Staff Dashboard + user counts |
| `/` | My Tickets | redirect → `/dashboard` | redirect → `/dashboard` |
| `/create-ticket` | Create Ticket | — | — |
| `/tickets/:id` | Requester Ticket Detail (Actions read-only) | — | — |
| `/staff/tickets` | — | Ticket Queue | Ticket Queue |
| `/staff/tickets/:id` | — | Staff Ticket Detail (Actions editable) | Staff Ticket Detail |
| `/admin/users` | — | — | User Management |

- The active entry carries `aria-current="page"` and a non-colour cue (bold + underline/bottom border). Detail routes keep their parent entry active (`/tickets/:id` → My Tickets; `/staff/tickets/:id` → Ticket Queue).
- A role opening a route that is not theirs sees the Lab 3 forbidden/redirect behavior (no flash of other-role content).
- Query strings from drill-downs (`?status=…`, `?statusGroup=active`, `?ownerId=…`, `?itPriority=…`) are read on load by My Tickets / Ticket Queue and shown as visible, removable filter chips; invalid values are ignored with the normal "no filter" state.
- `AppShell` cleanup: guard `user` once instead of repeating `user &&` / `user.role` checks in the nav, keep a single role badge, and keep the header at 100% width without overflow on mobile (menu wraps; no horizontal scroll).

## 3. Dashboards

### 3.1 Shared structure

- Page heading `Welcome back, {name}` (h1) + secondary line + **Refresh** button (re-calls the endpoint; announces "Dashboard updated" through a polite live region).
- **Metric card**: label (visible text), value (large), optional "View" link as an `<a>`/link button with an accessible name such as "View My Open Tickets (3)". Cards without a drill-down are not links.
- **List panel**: heading, up to 5 rows (ticket number as link, summary, status badge, relative or absolute time in `Asia/Bangkok`), and a "View all" link where a destination exists.
- Values come from the backend; the UI never recomputes them (BR-25).
- Layout: desktop ≥ 992px: metric cards in one row (wrapping), list panels in two columns. Tablet 768–991px: cards 2 per row, panels stacked. Mobile < 768px: single column, cards full width. No horizontal page scroll at any width.

### 3.2 Requester Dashboard

| Area | Content | Destination |
|---|---|---|
| Cards | My Open Tickets · Waiting for Me · Resolved | `/` with `statusGroup=active` / `status=Waiting for Requester` / `status=Resolved` |
| Panel "Needs your attention" | Tickets waiting for the Requester (≤5) | `/tickets/:id` |
| Panel "Recently updated" | ≤5 latest | `/tickets/:id`; "View all" → `/` |
| Panel "Recently resolved" | ≤5 Resolved in last 7 days | `/tickets/:id` |
| Quick actions | Create Ticket · View My Tickets | existing routes |

### 3.3 IT Staff / Administrator Dashboard

| Area | Content | Destination |
|---|---|---|
| Cards | Unassigned · My Owned Tickets · My Open Follow-ups (not a link) | Ticket Queue with filters from the API `drilldown` |
| "By status" grid | 8 status tiles with counts (zeros shown) | `/staff/tickets?status=…` |
| "By IT Priority" grid | Low · Medium · High · Urgent · Unset (Unset not a link) | `/staff/tickets?itPriority=…&statusGroup=active` |
| Panel "Recent tickets" | ≤5, with "Requester reports resolved" badge when `requesterMarkedResolved` | `/staff/tickets/:id` |
| Panel "My recent actions" | ≤5 (ticket number, shortened description, follow-up state text) | `/staff/tickets/:ticketId` |
| Administrator only: "Users" card | active Requesters / IT Staff / Administrators, inactive | `/admin/users` |
| Quick actions | Ticket Queue · Unassigned Tickets | existing routes |

### 3.4 Dashboard states

| State | Behavior |
|---|---|
| Loading | Skeleton cards/panels inside a container with `role="status"` and text "Loading dashboard…". Layout does not jump when data arrives. |
| Success | Cards, grids, and panels as above; Refresh enabled. |
| Empty (zero counts) | Cards show `0`; panels show "No tickets to show yet." (Requester) or "Nothing to show yet." (Staff) with a relevant action link (Create Ticket / Ticket Queue). Never a blank panel. |
| Forbidden (`403`) | "You do not have access to this dashboard." with a link to the user's own home. |
| Unauthenticated (`401`) | Existing Lab 3 behavior: return to Login. |
| Safe failure (network / `500`) | `role="alert"` message "We couldn't load the dashboard. Please try again." + **Retry** button. No technical details, no console errors. Previously loaded data may remain visible with a "may be out of date" note after a failed refresh. |

## 4. Actions Taken on Staff Ticket Detail

### 4.1 Placement

Order on `/staff/tickets/:id`: Ticket summary and workflow controls (§5) → **Actions Taken** → Public Comments (shared) → Internal Notes (private). Each region has its own heading (`h2`) so keyboard and screen-reader users can jump between them.

### 4.2 List

- Heading "Actions Taken" with a "Visible to Requester" label (shared-content marker, §7) and the count; button **Add Action** (staff only).
- Desktop (≥ 992px): table with columns **Action time · Description · Result · Performed by · Follow-up · Attachment notes · Recorded · Actions**. Narrower than 992px: one card per Action with the same fields as label/value pairs (labels always visible). Long text wraps (`overflow-wrap: anywhere`) and is never clipped; the table must not cause page-level horizontal scroll (wrap inside the cell, not a scroll container).
- Order is stable (`createdAt ASC, id ASC`, BR-09). A row shows "Edited" with the editor's name and time when `version > 1`.
- Follow-up cell: `Not required` · `⚠ Follow-up open — {note}` · `✔ Follow-up done`. Open follow-ups use the warning tokens plus the ⚠ glyph and the words.
- Times are shown in `Asia/Bangkok` and labelled "GMT+7" once per screen.
- Empty: "No actions recorded yet." (+ Add Action for staff; plain text only for Requester).

### 4.3 Modes

| Mode | Trigger | Description |
|---|---|---|
| View | default | Read-only row/card. Staff also get **Edit** and, for an open follow-up, **Mark follow-up done** (and **Reopen follow-up** for a done one). |
| Create | **Add Action** | Inline form panel above the list (not a modal). Focus moves to the first field; **Cancel** returns focus to **Add Action**. |
| Edit | **Edit** on a row/card | The row/card is replaced by the same form, prefilled; the Action's `version` is kept in state and sent as `expectedVersion`. Only one form is open at a time (opening another asks to discard unsaved changes). |

Requester Ticket Detail shows the same list in **View mode only**: no Add/Edit/Mark buttons, a short note "These updates are visible to you and to IT Staff.", and the same follow-up text cues.

When the Ticket is `Resolved`, `Closed`, or `Cancelled`, staff controls are hidden/disabled and the panel shows "Actions can't be changed while the Ticket is {status}. Reopen the Ticket to add or edit actions." (backend `TICKET_ACTIONS_LOCKED` is still handled if it occurs).

### 4.4 Form fields

| Field | Control | Required | Notes / validation message (shown directly under the field) |
|---|---|:-:|---|
| Performed by | read-only text "{current user name} (automatic)" | — | Not editable; on edit shows the original performer. |
| Action time | `datetime-local` | no | Default = now (GMT+7). "Action time cannot be before the Ticket was created." / "Action time cannot be in the future." |
| Description | textarea | yes | "Enter a description of 5–2000 characters." Live character counter. |
| Result | textarea | yes | "Enter a result of 2–1000 characters." |
| Follow-up required? | checkbox | no | Unchecked by default. |
| Follow-up note | textarea | when checked | Visible only when the checkbox is checked; "Enter a follow-up note of 5–500 characters when follow-up is required." Unchecking hides it and clears it. |
| Attachment notes | textarea | no | Helper text "What file or image to look for (for example: 'screenshot share-error.png')." "Attachment notes can be up to 500 characters." |

Form behavior:

- Every control has a visible `<label>`; errors use `aria-invalid="true"` and `aria-describedby` pointing at the message. Client checks mirror backend rules, but server `fields` messages are always rendered under the matching field.
- On submit with errors: an error summary (`role="alert"`) appears at the top of the form and focus moves to the first invalid field.
- **Save** disables while the request is in flight (shows "Saving…"); a `clientRequestId` is generated once per opened Create form and reused on retry (BR-23, FR-17).
- Recoverable failures (validation, network, conflict) keep everything the user typed (FR-19).
- Success: form closes, the list reloads (new/edited row highlighted briefly and announced via `role="status"`: "Action saved."), Ticket summary `updatedAt` refreshes.

### 4.5 Actions Taken states

| State | Behavior |
|---|---|
| Loading | "Loading actions…" (`role="status"`), skeleton rows. |
| Empty | See §4.2. |
| Validation (`400`) | Field messages + summary as above. |
| Forbidden (`403`) | Staff controls absent for Requester; if a write still returns `403`: "You don't have permission to change actions." |
| Not found (`404`) | "This ticket or action is no longer available." with a link back to the queue; form data stays visible until dismissed. |
| Conflict (`409 VERSION_CONFLICT`) | Banner (`role="alert"`): "This action was changed by someone else. Reload to see the latest version." Buttons **Reload latest** (re-fetches and shows the latest values beside the user's unsaved text) and **Keep editing**. Nothing is overwritten silently. |
| Locked (`409 TICKET_ACTIONS_LOCKED`) | "Actions can't be changed while the Ticket is {status}." and refresh of the Ticket status. |
| Safe failure (`500`/network) | "We couldn't save the action. Your entries are kept — please try again." + Retry; no technical detail. |

## 5. Ticket workflow and resolution feedback

- **Status control** (staff): a select labelled "Change status" lists only `allowedTransitions` from the API (the client has no copy of the matrix). With `Cancelled` ticket or no options: control replaced by text "No further status changes are possible."
- **Update status** button. Confirmation dialog is required for these (from → to) pairs: any `→ Cancelled`, `→ Resolved`, `Resolved → Closed`, and any `→ Reopened`. No dialog for `New → Open`, `Open → In Progress`, `In Progress ↔ Waiting for Requester`. Dialog text names both statuses ("Change status from Resolved to Closed?").
- **Dialog accessibility:** `role="dialog"`, `aria-modal="true"`, labelled by its title, focus moves inside on open and is trapped, **Esc** and **Cancel** close it, focus returns to the control that opened it, confirm button has a clear verb ("Mark as Resolved").
- **Resolution guidance:** when `Resolved` is selected and the Actions `summary` shows `total = 0` or `openFollowUps > 0`, the **Update status** button is disabled and helper text (linked with `aria-describedby`) explains: "Record at least one action before resolving." or "Complete {n} open follow-up(s) before resolving." The backend remains the authority: a `409 RESOLUTION_BLOCKED` response shows the same message inline (`role="alert"`) without closing the page or losing state.
- **Other errors:** `409 INVALID_STATUS_TRANSITION` → "That status change is no longer allowed. The ticket may have changed — reloaded."; `409 VERSION_CONFLICT` → "This ticket was updated by someone else. Reloaded the latest version." (UI re-fetches ticket + actions and re-renders controls).
- **Success:** the Ticket summary (status badge, `resolvedAt` where shown, `allowedTransitions`, owner, version) refreshes from the response; announcement "Status changed to {status}." in a `role="status"` region.
- **Requester advisory:** staff see a badge "Requester reports resolved" (text + icon) when `requesterMarkedResolved` is true. It does not enable or disable any control. The Requester's "Problem Appears Resolved" button keeps Lab 3 behavior and is hidden for `Closed`/`Cancelled`.
- All version tokens are held in state from the last fetch (never from the DOM) and sent as `expectedVersion`; fetches after a write happen in a `useEffect` reacting to state, not inline after `setState`.

## 6. Responsive rules

| Viewport | Width | Rules |
|---|---|---|
| Desktop | ≥ 992px | Table layout for Actions Taken and the Staff Queue; dashboards in multi-column grids. |
| Tablet | 768–991px | Card layout for Actions; dashboard cards 2 per row; forms single column. |
| Mobile | < 768px | Single column; nav wraps; cards full width; buttons ≥ 44px touch height; dialogs fit within the viewport with internal scroll. |

If the Lab 3 Staff Queue switches from table to cards at a different width than 992px, Actions Taken follows the Lab 3 value instead and the change is recorded in the Issue 3 PR. No screen may produce horizontal page scrolling, clipped text, or overlapping controls at 320px, 390px, 768px, 1024px, and 1280px.

## 7. Visual language, accessibility, and non-colour cues

- **Private vs shared:** Internal Notes show a lock icon + "Private — IT Staff only" in warning tokens; Public Comments and Actions Taken show an eye/people icon + "Visible to Requester" in surface-tint. The text is always present.
- **Status and priority** badges always include the text label (and a small glyph for status); priorities always show the word.
- **Follow-up** state is always text (`Not required`, `⚠ Follow-up open`, `✔ Follow-up done`).
- **Focus:** a visible focus ring (≥ 2px, contrast ≥ 3:1) on every interactive element; never `outline: none` without replacement. Logical tab order follows the visual order.
- **Semantics:** one `h1` per page, `h2` per region; tables have `<th scope>` and a caption (visually hidden); form controls have labels; icons are `aria-hidden` when text is adjacent; live regions for save/refresh/status announcements.
- **Keyboard:** all actions work without a mouse; dialogs trap focus; Esc closes; no keyboard traps elsewhere.
- **Motion/timeouts:** no auto-dismissing messages shorter than 6 seconds; no required animation.

## 8. Cleanup of earlier-lab UI (FR-22)

Audit and remove/fix, one concern per commit: temporary dev selectors or labels left from Lab 2 (requester selector, `X-Requester-Id` remnants), duplicate or inconsistent buttons and badges, placeholder or "TODO/lorem/test" text, `console.log`/`console.error` noise, dead links and unreachable routes, inline-style duplicates that diverge from tokens, and the repeated `user &&` guards in `AppShell`. Each removal must be covered by the Lab 1–3 regression suites staying green.

## 9. Visual and accessibility checklist (Part 9 evidence)

Mark each row for Desktop / Tablet / Mobile with a screenshot path or test ID.

| # | Check | Method | D | T | M |
|---|---|---|:-:|:-:|:-:|
| 1 | Zen Green tokens only; no off-palette colours | `tokens-lint` script + visual review | ☐ | ☐ | ☐ |
| 2 | Text/background contrast ≥ 4.5:1 (UI borders ≥ 3:1) | contrast check of each token pair | ☐ | ☐ | ☐ |
| 3 | Nav shows correct entries per role; active page indicated | manual + `UI-25` | ☐ | ☐ | ☐ |
| 4 | Dashboard cards: label, value, accessible drill-down name | RTL + manual | ☐ | ☐ | ☐ |
| 5 | Dashboard loading / empty / forbidden / error states | RTL + manual | ☐ | ☐ | ☐ |
| 6 | Actions Taken list/cards: all 7 fields visible, stable order | manual + `UI-01` | ☐ | ☐ | ☐ |
| 7 | Create and edit forms: labels, required markers, helper text | RTL + manual | ☐ | ☐ | ☐ |
| 8 | Validation messages directly under fields; summary + focus move | RTL + manual | ☐ | ☐ | ☐ |
| 9 | Performed by read-only; Requester view read-only | `UI-07` + manual | ☐ | ☐ | ☐ |
| 10 | Conflict, locked, safe-failure feedback; entries preserved | `UI-04`, `UI-05` | ☐ | ☐ | ☐ |
| 11 | Status control lists only permitted transitions; dialogs per pair | `UI-11`, `UI-12` | ☐ | ☐ | ☐ |
| 12 | Dialog focus trap, Esc, focus return | `UI-16` + manual | ☐ | ☐ | ☐ |
| 13 | Private vs shared labels present (text + icon) | `STY-02` | ☐ | ☐ | ☐ |
| 14 | Status/priority/follow-up not conveyed by colour alone | `STY-01` + greyscale screenshot | ☐ | ☐ | ☐ |
| 15 | Keyboard-only walk-through of dashboard, Actions form, workflow | `RESP-04` + manual | ☐ | ☐ | ☐ |
| 16 | Visible focus ring everywhere | manual | ☐ | ☐ | ☐ |
| 17 | No clipping/overlap; wrapped long text | manual + `RESP-01` | ☐ | ☐ | ☐ |
| 18 | No horizontal page scroll at 320 / 390 / 768 / 1024 / 1280 px | `RESP-01` | ☐ | ☐ | ☐ |
| 19 | No console errors/warnings on any Lab 4 screen | `STY-04` + manual | ☐ | ☐ | ☐ |
| 20 | No placeholder text, broken links, unfinished controls | manual route walk (all roles) | ☐ | ☐ | ☐ |

Screenshots are saved as `artifacts/lab-04/screenshots/<screen>/<viewport>/<state>.png` with screens `staff-dashboard`, `requester-dashboard`, `actions-taken` (states: `loading`, `empty`, `list`, `create`, `edit`, `validation`, `conflict`, `forbidden`, `error` where applicable); viewports `desktop`, `tablet`, `mobile`.

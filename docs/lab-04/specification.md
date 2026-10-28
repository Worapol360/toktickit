# Lab 4 Specification — Actions Taken, Dashboards, and Final Regression

Companion files: [`ui-spec.md`](./ui-spec.md) · [`api-spec.md`](./api-spec.md) · [`tests.md`](./tests.md)

## 1. Sprint Goal

Deliver the last core piece of the TokTickIT service-desk workflow: IT Staff and Administrators record the actual work on a Ticket as **Actions Taken**; the Ticket can only be **Resolved** when that work is complete; Requesters and IT Staff get concise, backend-calculated **dashboards** that link to the detailed screens; and the whole application (Labs 1–3 plus Lab 4) is hardened, responsive, accessible, and consistent in the Zen Green design language.

## 2. Stakeholder Request (Interpretation)

The desk can already receive Tickets and talk to Requesters. It now needs a reliable record of *what was done* on each Ticket, by *whom*, and *what is still pending*. The primary Ticket Owner stays responsible for coordinating the Ticket, but any IT Staff member may do and record work. A Requester can say "this looks fixed", but only IT Staff may formally move a Ticket to Resolved, and only after the work is recorded and no follow-up is outstanding. Dashboards are a starting point, not a replacement for the Ticket Queue and My Tickets. Finally, the product must feel like one application.

## 3. Scope

**Included**

- `ActionTaken` model, migration, seed, REST API, and Ticket Detail UI (IT Staff/Administrator write, Requester read).
- Final Ticket status-transition matrix, resolution gate, and stale-update (optimistic concurrency) handling.
- Requester dashboard and IT Staff dashboard (Administrator = Staff dashboard + concise user counts), with drill-down.
- `GET /api/health`.
- Final regression, accessibility, responsive, visual-consistency, README, and cleanup pass.

**Explicitly excluded** (handout §4.2): SLA clocks/escalation/on-call/breach notifications; email/SMS/LINE/push; spare parts, purchasing, cost accounting; time-sheets/payroll/labour cost; multi-level approvals/e-signatures; BI tools/report builders/exports; multi-tenant/production-scale cloud; any feature not listed in this document. Also excluded by decision: Action Taken edit history, deletion of Actions Taken, file upload on Actions Taken (Attachment Notes are text only), Action-level status or assignee (see D-01, D-02).

## 4. Functional Requirements

**Actions Taken**

| ID | Requirement |
|---|---|
| FR-01 | IT Staff/Administrator can create an Action Taken on any Ticket whose status allows it (BR-10). |
| FR-02 | The Ticket's Requester (owner only), IT Staff, and Administrator can list all Actions Taken of a Ticket. |
| FR-03 | IT Staff/Administrator can update an Action Taken (any IT Staff member, not only its performer). |
| FR-04 | IT Staff/Administrator can mark a required follow-up as completed (and un-complete it). |
| FR-05 | Requesters can never create or change an Action Taken. |
| FR-06 | Actions Taken cannot be deleted. |

**Ticket workflow**

| ID | Requirement |
|---|---|
| FR-07 | The backend enforces the final status-transition matrix (BR-13) for every status change. |
| FR-08 | The backend blocks `→ Resolved` unless the resolution gate passes (BR-15), even when the UI is bypassed. |
| FR-09 | Stale updates are detected with a `version` check and rejected with `409 VERSION_CONFLICT` (BR-20, BR-21). |
| FR-10 | The Requester "Problem Appears Resolved" action stays advisory and never changes `status` (Lab 3 behavior kept). |
| FR-11 | The staff Ticket response lists `allowedTransitions`; the UI shows only those and refreshes the Ticket summary after success. |
| FR-12 | `resolvedAt` is maintained on transitions; `requesterMarkedResolved` resets on `→ Reopened` (BR-17, BR-18). |

**Dashboards**

| ID | Requirement |
|---|---|
| FR-13 | `GET /api/dashboard/requester` returns metrics and short lists for the authenticated Requester only. |
| FR-14 | `GET /api/dashboard/staff` returns operational metrics and short lists for IT Staff/Administrator; Administrators also get `users` counts. |
| FR-15 | Each metric has a defined query, empty behavior, and a drill-down destination where practical. |
| FR-16 | Navigation shows a role-appropriate **Dashboard** entry with active-page indication; login lands on `/dashboard`. |

**Hardening**

| ID | Requirement |
|---|---|
| FR-17 | Repeated clicks and network retries on "create Action" do not create duplicates (BR-23). |
| FR-18 | Loading, validation, success, empty, forbidden, conflict, not-found, and safe-failure feedback is consistent on all new screens. |
| FR-19 | Forms keep entered data after recoverable failures (validation, conflict, network). |
| FR-20 | `GET /api/health` reports service and database availability without leaking internals. |
| FR-21 | All Lab 1–3 behavior continues to work (full regression). |
| FR-22 | Console errors, broken links, placeholder text, unfinished controls, and duplicate/obsolete UI are removed; README is current. |
| FR-23 | All new and existing screens meet the responsive and accessibility rules in `ui-spec.md`. |

## 5. Business Rules

### 5.1 Actions Taken

| ID | Rule |
|---|---|
| BR-01 | An Action Taken belongs to exactly one Ticket (required FK, never reassigned to another Ticket). |
| BR-02 | The Ticket Owner coordinates the Ticket, but any active IT Staff/Administrator may create or edit Actions on any Ticket. The Ticket does not need an owner, and the performer does not need to be the owner. |
| BR-03 | **Performed by** is the authenticated user at creation. It is derived from the session, never accepted from the client, and immutable. `updatedBy` records the last editor. |
| BR-04 | **Action Date/Time** (`actionAt`) defaults to the server time of creation, may be set by the user, must not be earlier than the Ticket's `createdAt` and must not be later than server time + 5 minutes. The system timestamp `createdAt` ("Recorded at") is separate and read-only. |
| BR-05 | `description`: required, trimmed, 5–2000 chars. `result`: required, trimmed, 2–1000 chars. `attachmentNotes`: optional, trimmed, ≤ 500 chars (text only; says what file/image to look for). All are plain text and rendered escaped. |
| BR-06 | `followUpRequired` is boolean (default `false`). When `true`, `followUpNote` is required (trimmed, 5–500 chars). When `false`, `followUpNote` and `followUpCompletedAt` are stored as `null` (any supplied note is discarded). |
| BR-07 | A follow-up is **open** when `followUpRequired = true` and `followUpCompletedAt IS NULL`. Completion may be set or cleared only while `followUpRequired = true`. |
| BR-08 | Actions are append-only at record level: no delete endpoint exists. Edits change the row in place, increment `version`, and update `updatedAt`/`updatedBy`. |
| BR-09 | Actions are listed in stable order `createdAt ASC, id ASC` (editing `actionAt` never reorders the list). |
| BR-10 | Writes are allowed only while the Ticket status is `New`, `Open`, `In Progress`, `Waiting for Requester`, or `Reopened`. In `Resolved`, `Closed`, or `Cancelled` writes return `409 TICKET_ACTIONS_LOCKED`; reads always work. Consequence: a Resolved Ticket can never hold an open follow-up. |
| BR-11 | Actions Taken are **shared content**: the owning Requester sees every field of every Action on their Ticket (including follow-up and attachment notes). Internal Notes remain staff-only. |
| BR-12 | Deactivated users cannot sign in (Lab 3), so they cannot write. Their past Actions remain and still show their name. |

### 5.2 Ticket status and resolution

| ID | Rule |
|---|---|
| BR-13 | Final transition matrix (unchanged from Lab 3 so that no earlier test changes meaning; 15 permitted pairs of 64): see table below. `Cancelled` is terminal. Same-status "transitions" are invalid. |
| BR-14 | Only IT Staff and Administrator may change status; Requester receives `403 FORBIDDEN` on every staff endpoint. Both staff roles may perform every permitted transition. |
| BR-15 | **Resolution gate.** `→ Resolved` (from `In Progress` or `Waiting for Requester`) succeeds only if the Ticket has **at least one** Action Taken **and no open follow-up**. Otherwise `409 RESOLUTION_BLOCKED` with `details.reason` = `NO_ACTIONS_TAKEN` or `OPEN_FOLLOW_UPS` (plus `openFollowUps` count). The check runs on the server inside the status-change transaction. |
| BR-16 | The gate applies only to new transitions to `Resolved`. Legacy Tickets that are already `Resolved`/`Closed` without Actions stay valid and are not modified. A Ticket that is Reopened and later resolved again is evaluated against all its Actions. `→ Cancelled` is never gated. |
| BR-17 | `requesterMarkedResolved` is advisory: setting it never changes `status`. It is reset to `false` when the Ticket moves to `Reopened`. Lab 3 rule kept: marking is rejected with `409 TICKET_ALREADY_CLOSED` for `Closed`/`Cancelled`. |
| BR-18 | `resolvedAt` is set to the server time when status becomes `Resolved`, kept on `Resolved → Closed`, and cleared on `→ Reopened`. |
| BR-19 | Changing owner (Lab 3 rule) must still reference an active IT Staff/Administrator; this is the "inactive assignee rejection". |

**Transition matrix (from → permitted to)**

| From \ To | New | Open | In Progress | Waiting for Requester | Resolved | Closed | Reopened | Cancelled |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **New** |  | ✔ |  |  |  |  |  | ✔ |
| **Open** |  |  | ✔ |  |  |  |  | ✔ |
| **In Progress** |  |  |  | ✔ | ✔ (gate) |  |  | ✔ |
| **Waiting for Requester** |  |  | ✔ |  | ✔ (gate) |  |  | ✔ |
| **Resolved** |  |  |  |  |  | ✔ |  ✔ |  |
| **Closed** |  |  |  |  |  |  | ✔ |  |
| **Reopened** |  |  | ✔ |  |  |  |  | ✔ |
| **Cancelled** |  |  |  |  |  |  |  |  |

Roles: IT Staff ✔ and Administrator ✔ for every ✔ above; Requester ✘ for all.

### 5.3 Concurrency, atomicity, idempotency

| ID | Rule |
|---|---|
| BR-20 | `Ticket.version` and `ActionTaken.version` start at 1 and increase by 1 on every successful mutation of that row. |
| BR-21 | Action Taken `PATCH` **requires** `expectedVersion`. Ticket `PATCH` endpoints (`owner`, `priority`, `status`) **accept** an optional `expectedVersion` (kept optional so Lab 3 clients/tests remain valid); when present and different from the stored version the request is rejected with `409 VERSION_CONFLICT` and nothing changes. The UI always sends it. |
| BR-22 | Status change, Action create, and Action update run in one DB transaction that locks the Ticket row (`SELECT … FOR UPDATE`), so the resolution gate cannot race with a concurrent follow-up change. The final write uses a conditional update on `version`. |
| BR-23 | Action create accepts an optional `clientRequestId` (UUID generated by the form when it opens). A repeated request with the same `(ticketId, clientRequestId)` returns the existing Action with `200` instead of creating another. |
| BR-24 | Creating or updating an Action also sets the Ticket's `updatedAt` (so dashboards' "recently updated" reflects work). It does not change the Ticket's `version`. Comments and Notes keep their Lab 3 behavior. |

### 5.4 Dashboards

| ID | Rule |
|---|---|
| BR-25 | All metrics are calculated by the backend from PostgreSQL at request time. The client never computes or caches a metric as truth. |
| BR-26 | The Requester dashboard takes no user identifier; scope is always the session user. IT Staff/Administrator dashboards are not ownership-scoped (same visibility as the Ticket Queue). |
| BR-27 | **Active statuses** = `New`, `Open`, `In Progress`, `Waiting for Requester`, `Reopened`. "Recent" = rolling last 7 × 24 hours from request time. Timestamps are ISO-8601 UTC; the UI displays them in `Asia/Bangkok` (UTC+7, no DST). No metric uses calendar-day boundaries. |
| BR-28 | Metric definitions are in the table below. Lists contain at most 5 items and always ordered newest first with `id DESC` as tie-break. |
| BR-29 | Empty behavior: counts are `0`, lists are `[]` (never `null`), and the UI shows an explicit empty state. |
| BR-30 | Every count that has a drill-down uses the same filter as its destination list, so the number on the card equals the number of results (`statusGroup=active` is added to both ticket list endpoints for this purpose). |
| BR-31 | `users` counts exist only in the Administrator response (structurally absent for IT Staff). |
| BR-32 | The backend enforces every rule the UI shows; error bodies never expose stack traces, SQL, or file paths. |
| BR-33 | CSRF header rules (`X-Requested-With`) from Lab 3 apply to every new mutating endpoint. |

**Dashboard metric definitions**

| Dashboard | Metric (key) | Query | Empty | Drill-down |
|---|---|---|---|---|
| Requester | My Open Tickets (`openTickets`) | own Tickets, status ∈ Active | 0 | `/?statusGroup=active` |
| Requester | Waiting for Me (`waitingForRequester`) | own Tickets, status = `Waiting for Requester` | 0 | `/?status=Waiting for Requester` |
| Requester | Resolved (`resolved`) | own Tickets, status = `Resolved` | 0 | `/?status=Resolved` |
| Requester | Needs Attention (list) | own `Waiting for Requester`, `updatedAt` desc, ≤5 | `[]` | row → `/tickets/:id` |
| Requester | Recently Updated (list) | own Tickets any status, `updatedAt` desc, ≤5 | `[]` | row → `/tickets/:id`; "View all" → `/` |
| Requester | Recently Resolved (list) | own `Resolved`, `resolvedAt ≥ now−7d`, `resolvedAt` desc, ≤5 | `[]` | row → `/tickets/:id` |
| IT Staff | Unassigned (`unassigned`) | `ownerId IS NULL` and status ∈ Active | 0 | `/staff/tickets?ownerId=unassigned&statusGroup=active` |
| IT Staff | My Owned (`myOwned`) | `ownerId = me` and status ∈ Active | 0 | `/staff/tickets?ownerId=<me>&statusGroup=active` |
| IT Staff | My Open Follow-ups (`myOpenFollowUps`) | Actions with `performedById = me`, follow-up open | 0 | none (card not a link; items shown in list below) |
| IT Staff | By Status (`byStatus`, 8 entries) | all Tickets grouped by status | 0 each | `/staff/tickets?status=<s>` |
| IT Staff | By IT Priority (`byPriority`) | Active Tickets grouped by `itPriority` (`null` → `Unset`) | 0 each | `/staff/tickets?itPriority=<p>&statusGroup=active` (none for `Unset`) |
| IT Staff | Recent Tickets (list) | all Tickets, `updatedAt` desc, ≤5, with requester-resolved badge | `[]` | row → `/staff/tickets/:id` |
| IT Staff | My Recent Actions (list) | Actions with `performedById = me`, `createdAt` desc, ≤5 | `[]` | row → `/staff/tickets/:ticketId` |
| Administrator | Users (`users`) | active Requesters / IT Staff / Administrators and inactive users | 0 | `/admin/users` |

## 6. UI Specification Summary

Full detail: [`ui-spec.md`](./ui-spec.md).

- **Navigation:** Requester — Dashboard, My Tickets, Create Ticket. IT Staff — Dashboard, Ticket Queue. Administrator — Dashboard, Ticket Queue, User Management. Active item uses `aria-current="page"`. Route `/dashboard` serves the role-specific dashboard; `/` remains My Tickets for Requesters and redirects Staff/Administrator to `/dashboard`.
- **Staff Ticket Detail:** new Actions Taken area (list/table on desktop, cards on narrow screens), create mode, view mode, edit mode, follow-up completion; status control lists only `allowedTransitions` with a confirmation per (from → to); resolution-gate failures are explained inline.
- **Requester Ticket Detail:** read-only Actions Taken list, labeled as visible to the Requester.
- **Dashboards:** concise metric cards (label, value, drill-down action) plus short lists; loading, empty, forbidden, and safe-failure states.
- **Private vs shared:** Internal Notes are visually and textually marked private; Public Comments and Actions Taken are marked as visible to the Requester.
- **Responsive/accessibility:** same breakpoints as Labs 2–3 (desktop ≥ 992px, tablet 768–991px, mobile < 768px), no horizontal page scroll, visible focus, keyboard operation, non-color status cues.

## 7. Data Changes

### 7.1 Prisma additions

```prisma
model ActionTaken {
  id                  Int       @id @default(autoincrement())
  ticketId            Int
  actionAt            DateTime
  description         String
  result              String
  performedById       Int
  followUpRequired    Boolean   @default(false)
  followUpNote        String?
  followUpCompletedAt DateTime?
  attachmentNotes     String?
  clientRequestId     String?
  version             Int       @default(1)
  updatedById         Int
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  ticket              Ticket    @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  performedBy         User      @relation("ActionPerformedBy", fields: [performedById], references: [id])
  updatedBy           User      @relation("ActionUpdatedBy", fields: [updatedById], references: [id])

  @@unique([ticketId, clientRequestId])
  @@index([ticketId, createdAt, id])
  @@index([performedById, followUpRequired, followUpCompletedAt])
  @@map("action_taken")
}

// Ticket: add
//   version      Int       @default(1)
//   resolvedAt   DateTime?
//   actionsTaken ActionTaken[]
//   @@index([status, updatedAt(sort: Desc)])
//   @@index([requesterId, status])
// User: add
//   actionsPerformed ActionTaken[] @relation("ActionPerformedBy")
//   actionsUpdated   ActionTaken[] @relation("ActionUpdatedBy")
```

`@@unique([ticketId, clientRequestId])` is safe with `NULL` `clientRequestId` because PostgreSQL treats NULLs as distinct.

### 7.2 Database-design decisions (justified)

| # | Decision | Reason | Alternative rejected |
|---|---|---|---|
| DD-1 | Integer `version` column on `Ticket` and `ActionTaken` for optimistic concurrency. | Exact, cheap to compare, independent of timestamp resolution/clock skew, and trivially exposed in JSON for `expectedVersion`. | Comparing `updatedAt` (millisecond precision and ISO round-trip issues; `@updatedAt` also changes for non-workflow writes such as BR-24). |
| DD-2 | Follow-up state as `followUpRequired` + nullable `followUpCompletedAt` on `ActionTaken`, no Action status enum. | Smallest model that makes "Actions Taken incomplete" (the Lab 3 deferral) decidable by one indexed query; keeps D-01 (no Action status). | A separate `status` enum or a `FollowUp` table (extra states and joins the handout does not ask for). |
| DD-3 | `Ticket.resolvedAt` column. | "Recently resolved" must reflect when the Ticket was resolved, not any later `updatedAt` change; also gives the backfill a concrete, testable rule. | Deriving from `updatedAt` (drifts) or a status-history table (new feature, out of scope). |
| DD-4 | `onDelete: Cascade` from `Ticket` to `ActionTaken`, but no application path deletes Tickets or Actions. | Mirrors `PublicComment`/`InternalNote`/`Attachment`; avoids orphan rows without enabling deletion in the app (BR-08). | `Restrict` (blocks future admin clean-up for no current benefit). |
| DD-5 | Indexes `[ticketId, createdAt, id]` (list order), `[performedById, followUpRequired, followUpCompletedAt]` (staff dashboard), `[status, updatedAt desc]` and `[requesterId, status]` (dashboards). | Each index backs one documented query so dashboard calls stay fast on the seed and on realistic volumes. | No extra indexes (full scans on every dashboard load). |

### 7.3 Migration, backfill, rollback

- One Prisma migration, e.g. `npx prisma migrate dev --name lab4_actions_taken`, then `npx prisma generate`. Data changes live **in the migration SQL**, never in `seed.ts`.
- The migration: creates `action_taken`; adds `Ticket.version` `NOT NULL DEFAULT 1`; adds `Ticket.resolvedAt` nullable; adds indexes; **backfill** `UPDATE "Ticket" SET "resolvedAt" = "updatedAt" WHERE status = 'Resolved' AND "resolvedAt" IS NULL`.
- All Lab 1–3 rows are untouched (no column dropped or retyped). Legacy Tickets have zero Actions Taken; the API returns `[]`, the UI shows the empty state, dashboards count them normally (BR-16, BR-29). `Closed` legacy Tickets keep `resolvedAt = NULL` and are not "recently resolved".
- **Rollback/recovery:** take `pg_dump` before migrating; reverse SQL (`DROP TABLE action_taken; ALTER TABLE "Ticket" DROP COLUMN "resolvedAt", DROP COLUMN "version";` plus index drops) is stored in `docs/lab-04/rollback.sql` and rehearsed on the test DB. Restoring the dump is the primary recovery path.
- **Migration test:** apply the migration to a test DB loaded with Lab 3 seed data; assert row counts per table before/after are equal and legacy Tickets still load through `GET /api/tickets` and `GET /api/staff/tickets/:id`.

### 7.4 Seed (idempotent)

- Extend `seed.ts` with `upsert` on natural keys: Tickets by `ticketNumber` (reserved range `TICK-20261020-9001` … `9012`; verify the ticket-number generator cannot collide), Actions by `(ticketId, clientRequestId = 'seed-…')`. Re-running creates no duplicates and does not modify existing rows.
- Seeded Tickets (12) cover all 8 statuses, all IT Priorities (one with `itPriority = NULL`), assigned and unassigned, requester-marked-resolved true/false.
- Actions Taken coverage: Tickets with **0**, **1**, and **3+** Actions; at least one open follow-up and one completed follow-up; an Action performed by a different IT Staff member than the Ticket Owner; one Resolved Ticket (gate satisfied) and one Reopened Ticket.
- Dashboard coverage: at least one active Requester and one IT Staff user with **zero** Tickets/owned Tickets (empty-state demo), others with non-zero metrics. Seeded timestamps are relative to the first seed run so "recent" metrics are non-zero; a fresh demo needs `db:reset` + seed.
- Dev-only seed credentials stay in README/constants; no real secrets are committed.

## 8. API Contract

Summary only; full request/response shapes are in [`api-spec.md`](./api-spec.md).

| Method & path | Roles | Purpose |
|---|---|---|
| `GET /api/tickets/:id/actions-taken` | Requester (owner), IT Staff, Administrator | List Actions + summary |
| `POST /api/staff/tickets/:id/actions-taken` | IT Staff, Administrator | Create Action (`201`, or `200` on duplicate `clientRequestId`) |
| `PATCH /api/staff/tickets/:id/actions-taken/:actionId` | IT Staff, Administrator | Update Action (`expectedVersion` required) |
| `PATCH /api/staff/tickets/:id/status` | IT Staff, Administrator | Matrix + gate + optional `expectedVersion` |
| `PATCH /api/staff/tickets/:id/owner`, `/priority` | IT Staff, Administrator | Optional `expectedVersion` |
| `GET /api/dashboard/requester` | Requester | Requester metrics |
| `GET /api/dashboard/staff` | IT Staff, Administrator | Staff metrics (+`users` for Administrator) |
| `GET /api/tickets`, `GET /api/staff/tickets` | as Lab 3 | New optional `statusGroup=active` filter |
| `GET /api/health` | public | Service/DB health |

New error codes: `VERSION_CONFLICT` (409), `RESOLUTION_BLOCKED` (409), `TICKET_ACTIONS_LOCKED` (409), `ACTION_NOT_FOUND` (404). Existing envelope `{ error: { code, message, fields? } }` is kept; `details` is added only for the two 409 codes that need structured data.

## 9. Acceptance Criteria

| ID | Criterion |
|---|---|
| AC-01 | Given a permitted IT Staff user and valid data, when an Action Taken is created, then it is saved under the correct Ticket with the authenticated user as Performed by and the server-set `createdAt`. |
| AC-02 | Given an authenticated Requester, when dashboard data is retrieved, then only metrics and recent Tickets owned by that Requester are returned (no other user's data, no `users` counts). |
| AC-03 | Given a Ticket owned by Staff A, when Staff B creates an Action, then it succeeds and shows Staff B as performer while the Ticket Owner remains Staff A; an unassigned Ticket also accepts Actions. |
| AC-04 | Given `followUpRequired = true` without a valid note, then the request is rejected with `400 VALIDATION_ERROR` and field errors; with `false`, any note is discarded; invalid lengths/dates are rejected per BR-04/05/06. |
| AC-05 | Given a Requester, when calling any Action create/update endpoint, then `403 FORBIDDEN`; when listing Actions of their own Ticket, then all Actions are returned; for another Requester's Ticket, then `404 TICKET_NOT_FOUND`; unauthenticated gets `401`. |
| AC-06 | Given an Action at version *n*, when updated with `expectedVersion = n`, then it succeeds and version becomes *n+1*; with a stale value, then `409 VERSION_CONFLICT` and no change; a missing `expectedVersion` is `400`. |
| AC-07 | Given any Ticket, then Actions are returned in `createdAt ASC, id ASC` order (stable after edits), and no endpoint can delete an Action. |
| AC-08 | Given a Ticket in `Resolved`, `Closed`, or `Cancelled`, when creating/updating an Action, then `409 TICKET_ACTIONS_LOCKED`; reads still succeed. |
| AC-09 | Given a client-supplied `performedById`/`performedBy`, then it is ignored; Performed by always equals the session user, and never changes on update. |
| AC-10 | Given the same `clientRequestId` submitted twice (double click/retry), then exactly one Action exists and the second response returns it with `200`. |
| AC-11 | Given an open follow-up, when marked completed (and later un-completed), then `followUpCompletedAt` is set/cleared; for `followUpRequired = false` the request is `400`. |
| AC-12 | Given every (from, to) pair of the 8 statuses, then exactly the 15 pairs in the matrix are accepted and the other 49 return `409 INVALID_STATUS_TRANSITION`; Requester gets `403`. |
| AC-13 | Given a Ticket with no Actions or with an open follow-up, when a client calls the status API directly with `Resolved`, then `409 RESOLUTION_BLOCKED` with the correct `details.reason`; with ≥1 Action and no open follow-up it succeeds. |
| AC-14 | Given `Requester marks resolved`, then `status` is unchanged; on `→ Resolved` `resolvedAt` is set; on `→ Reopened` `resolvedAt` is cleared and `requesterMarkedResolved` becomes `false`. |
| AC-15 | Given a stale `expectedVersion` on status/owner/priority, then `409 VERSION_CONFLICT` and the Ticket is unchanged; every successful Ticket mutation increments `version`; an omitted `expectedVersion` still works (Lab 3 compatible). |
| AC-16 | Given seeded data, then Requester metrics equal direct DB queries for the same user, and a Requester with no Tickets sees zeros and empty lists. |
| AC-17 | Given IT Staff and Administrator sessions, then staff metrics equal direct DB queries; `users` appears only for Administrator; Requester gets `403` on the staff dashboard and staff get `403` on the requester dashboard. |
| AC-18 | Given any metric with a drill-down, then following its link lists exactly as many Tickets as the card's value (consistency of `statusGroup` and other filters). |
| AC-19 | Given dashboard screens, then loading, empty, forbidden, and safe-failure states render without console errors, and cards/lists are keyboard-operable. |
| AC-20 | Given Staff Ticket Detail, then Actions can be listed, created, viewed, edited, and follow-ups completed; validation appears next to fields; double-click creates one Action; a conflict shows a clear message and keeps the user's input; a Requester sees the list read-only. |
| AC-21 | Given a Ticket, then the status control shows only `allowedTransitions`, asks for confirmation per (from → to), explains gate failures, and refreshes the summary status after success. |
| AC-22 | Given each role, then navigation lists the correct entries with the active page indicated, login lands on `/dashboard`, and every Lab 1–3 route is still reachable by permitted roles only. |
| AC-23 | Given a database with Lab 3 data, when the Lab 4 migration runs, then no existing row is lost or altered except documented backfill, and legacy Tickets work with zero Actions. |
| AC-24 | Given the seed is run twice, then row counts are identical after the second run and the coverage in §7.4 is present. |
| AC-25 | Given the complete Lab 1–3 automated and E2E suites, then they pass unchanged in meaning (setup migrations only; no weakened assertions). |
| AC-26 | Given desktop, tablet, and mobile viewports, then all major Lab 4 screens have no clipping, overlap, or horizontal page scroll, visible focus, labeled controls, and non-color status cues. |
| AC-27 | Given `GET /api/health`, then it returns `200` when the DB is reachable and `503` when not, without internal details; unexpected failures elsewhere return the safe `500 INTERNAL_ERROR` envelope. |

Every AC maps to planned tests in [`tests.md`](./tests.md).

## 10. Definition of Done (Product Completion)

- [ ] `specification.md`, `tests.md`, `ui-spec.md`, `api-spec.md` approved and merged **before** Issues 2–5 start.
- [ ] Every FR, BR, and AC is implemented and each AC has at least one passing automated test.
- [ ] `npm test` and `npm run build` pass in `server/` and `client/`; the server suite passes 3 consecutive runs with no manual DB cleanup and no leftover fixture rows.
- [ ] No unscoped `updateMany/deleteMany`; shared seed users mutated by tests are restored.
- [ ] Playwright E2E (`e2e/lab-04/*.spec.ts` plus Lab 2–3 specs) passes from a clean DB reset with no silent fallback paths.
- [ ] Migration applied to a copy of Lab 3 data with row-count verification; rollback rehearsed; seed run twice.
- [ ] Backend enforces every rule the UI shows (roles, status matrix, gate, validation limits, mandatory password change).
- [ ] Manual click-through per role (Requester, IT Staff, Administrator) of every route and nav entry; screenshots at desktop/tablet/mobile saved to `artifacts/lab-04/screenshots/`.
- [ ] Visual/accessibility checklist in `ui-spec.md` completed.
- [ ] No console errors, broken links, placeholder text, or unfinished controls; obsolete Lab 2/3 UI removed.
- [ ] README setup, seed, migration, test, and demo instructions current; `.gitignore` covers `cookies*.txt` and local secrets.
- [ ] Dashboard figures for at least three metrics verified against SQL (evidence kept).
- [ ] `ai-use.md` and `reviewer.md` updated after each PR; all Issues in **Done**; `lab4-staging` merged to `main` by release PR.

## 11. Assumptions and Decisions

| ID | Decision | Reason |
|---|---|---|
| D-01 | An Action Taken has **no status and no assignee** of its own. Its fields are exactly those in handout §3/§8.3 plus system fields. | The handout lists the fields explicitly; adding Action-level workflow would be unapproved scope. |
| D-02 | In handout Part 6, "assign", "status transition", "complete", "cancel", and "inactive-assignee rejection" mean: assign the **Ticket Owner**, change **Ticket status** (including `Resolved`, `Closed`, `Cancelled`), complete a **follow-up**, and reject an inactive owner. The "approved assignee" wording in AC-01 means the Ticket Owner assigned by existing rules. | Resolves a handout inconsistency without changing the data model; all of these already exist or are added here. |
| D-03 | Performed by is always the session user (BR-03). | "(auto)" in the handout. |
| D-04 | Actions are editable by any IT Staff/Administrator but never deletable; only the last editor is tracked, no per-edit history. | Handout allows update (§4.3) and requires append-only behavior (Part 7); history is out of scope. |
| D-05 | `version` integer for optimistic concurrency; required for Action `PATCH`, optional for existing Ticket `PATCH` endpoints. | Handout §6.1 requires stale-update handling; optional keeps Lab 3 contracts intact. The status transition check and row lock still protect clients that omit it. |
| D-06 | Resolution gate = ≥ 1 Action and no open follow-up, using `followUpCompletedAt`. | Lab 3 deferred "block resolution while Actions Taken are incomplete"; this makes "incomplete" precise with one field. |
| D-07 | Requester advisory flag stays non-authoritative; it is shown as a badge to staff and reset on Reopen. | Handout §4.5; avoids a stale "looks fixed" flag after reopening. |
| D-08 | Dashboard time zone `Asia/Bangkok`, recent = rolling 7 days, no calendar-day metrics. | Handout §6.2 asks for explicit time zone/boundaries; rolling windows avoid midnight edge cases. |
| D-09 | `clientRequestId` for idempotent create. | Handout §8.5 requires protection from repeated clicks and retries beyond disabling a button. |
| D-10 | Administrator dashboard = Staff dashboard + `users` counts. | Handout §4.6. |
| D-11 | `Action Date/Time` is user-editable (`actionAt`) while "created date/time" (`createdAt`) is system-set; the UI shows both ("Action time", "Recorded"). | Handout uses both phrasings (§3 vs §8.3); supporting both costs one column and removes the ambiguity. |
| D-12 | Action writes are locked in `Resolved`/`Closed`/`Cancelled` (BR-10). | Guarantees the invariant "Resolved ⇒ no open follow-up" without re-running the gate on every Action edit. |
| D-13 | The matrix is unchanged from Lab 3 (15 permitted pairs). Lab 4 adds roles, the gate, and versioning. | The Lab 3 matrix already fits the handout lifecycle; changing it would break accepted tests. |
| D-14 | `GET /api/tickets/:id/actions-taken` is a shared endpoint with its own role gate (Requester owner / staff / admin); writes live under `/api/staff/...`. | Avoids the Lab 3 bug where a whole router was gated by one role. |
| D-15 | Staff ticket responses include `allowedTransitions` computed by the server; the client does not duplicate the matrix. | Keeps the backend as the single authority (handout §8.4). |
| D-16 | `/dashboard` is the new landing route for all roles; `/` stays My Tickets for Requesters and redirects Staff/Administrator to `/dashboard`. | Minimizes route changes in `App.tsx`, where regressions recur, and keeps Lab 2/3 E2E paths valid. |
| D-17 | `statusGroup=active` is added as an optional filter to both ticket list endpoints. | Needed so dashboard counts equal drill-down results (BR-30); additive and backward compatible. |
| D-18 | `itPriority = NULL` is counted as `Unset` on the dashboard and has no drill-down. | Lab 3 allows a null IT Priority; avoids silently dropping Tickets from the totals. |
| D-19 | Ticket `updatedAt` is also touched by Action writes (BR-24) but not by comments/notes. | Dashboards reflect work done while leaving Lab 3 comment/note code unchanged. |
| D-20 | Action list has no pagination (typical ≤ 100 per Ticket); a performance-smoke test covers 200 Actions. | Keeps the UI and API simple; the dashboard lists are capped at 5. |

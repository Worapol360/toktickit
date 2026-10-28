# Lab 4 Test Plan (Test DD)

Companion files: [`specification.md`](./specification.md) · [`api-spec.md`](./api-spec.md) · [`ui-spec.md`](./ui-spec.md)

Status values in the **Final** column: `Planned` → `Pass` / `Fail`. Every row is updated from the real run on `main` before submission.

## 1. Test strategy and rules

- **TDD:** for each Issue the failing tests listed for it are written first, then the implementation (see §4).
- **Layers:** unit (pure logic), API/integration (Vitest + Supertest against `toktickit_test`), UI component (Vitest + React Testing Library), UI style/accessibility, responsive (Playwright viewports), authorization, workflow, migration/regression, performance-smoke, and end-to-end (Playwright).
- **Fixtures (Lab 3 lessons):** each test file creates its own fixtures with a unique prefix and removes them in a scoped `afterEach/afterAll`. Never use unscoped `updateMany/deleteMany`. Any shared seed user a test mutates is restored. Do not "fix" a victim test to hide a polluting test.
- **Regression rule:** Lab 1–3 tests may be changed only in their **setup** (e.g., adding `version`, new routes), never by weakening `expect(...)`. Retired tests are deleted in their own commit with a reason.
- **jsdom:** media queries are ignored, so table and card layouts both exist in the DOM; use `within(table)`, role queries, and `getAllByRole(...)[0]` where duplication is legitimate.
- **Type safety:** Vitest does not type-check, so `npm run build` is part of every verification.
- **Commands (server and client):**
  ```bash
  npm test            # plain, parallel run (not only single files)
  npm run build
  ```
  Server suite must pass **3 consecutive runs** without manual DB cleanup, then a leftover-row query on the test DB must return nothing. E2E: `npx playwright test e2e/lab-02 e2e/lab-03 e2e/lab-04` from a DB reset + seed.
- **Confirm the DB:** tests use `.env.test` (`toktickit_test`); scripts using `dotenv/config` read the dev DB. State which DB each manual check used.

## 2. Planned tests

Paths: server `server/tests/lab-04/…`, client `client/src/lab-04/__tests__/…` (adjust to the existing Lab 3 client test convention if it differs), e2e `e2e/lab-04/…`.

### 2.1 Unit

| Test ID | Type | Req / AC | What it tests | Expected result | Automated test file | Final |
|---|---|---|---|---|---|---|
| UNIT-01 | Unit | AC-12 | `isValidStatusTransition` over all 64 (from, to) pairs | Exactly the 15 pairs of BR-13 are true; 49 false (including same-status) | `status-transitions.unit.test.ts` | Planned |
| UNIT-02 | Unit | AC-12, AC-21 | `getAllowedTransitions(from)` for each status | Matches the matrix; `Cancelled` → `[]` | `status-transitions.unit.test.ts` | Planned |
| UNIT-03 | Unit | AC-13 | `evaluateResolutionGate(actions)` | no actions → `NO_ACTIONS_TAKEN`; open follow-up → `OPEN_FOLLOW_UPS` + count; all done / none required → pass | `resolution-gate.unit.test.ts` | Planned |
| UNIT-04 | Unit | AC-04, AC-09 | Action input validator (create and patch merge) | Trimming, length bounds, follow-up note rule, `actionAt` bounds, unknown fields ignored, note discarded when not required | `action-validation.unit.test.ts` | Planned |
| UNIT-05 | Unit | AC-16, AC-17 | Dashboard helpers: Active status set, 7-day window edge, priority bucket (`NULL` → `Unset`) | Boundary instants classified as specified | `dashboard-helpers.unit.test.ts` | Planned |
| UNIT-06 | Unit | AC-20 | Client form validators mirror BR-04/05/06 | Same messages as `ui-spec.md` §4.4 | `ActionsTaken.test.tsx` | Planned |

### 2.2 API / integration — Actions Taken

| Test ID | Type | Req / AC | What it tests | Expected result | Automated test file | Final |
|---|---|---|---|---|---|---|
| API-01 | API | AC-01 | Create a valid Action | `201`, saved under the correct Ticket, `performedBy` = session user, `version` = 1 | `actions-taken.api.test.ts` | Planned |
| API-02 | API | AC-03 | Staff B creates on Staff A's Ticket; and on an unassigned Ticket | `201`; performer = B; owner unchanged | `actions-taken.api.test.ts` | Planned |
| API-03 | API | AC-09 | Client sends `performedById`/`performedBy`; later edit by another staff | Ignored; performer unchanged; `updatedBy` = editor | `actions-taken.api.test.ts` | Planned |
| API-04 | API | AC-04 | Invalid payloads (short/long text, missing result, bad dates, follow-up without note) | `400 VALIDATION_ERROR` with the right `fields`; no row created | `actions-taken.api.test.ts` | Planned |
| API-05 | API | AC-04 | `followUpRequired=false` with a note | `201`; note and completion stored as `null` | `actions-taken.api.test.ts` | Planned |
| API-06 | API | AC-05 | Requester create/update; anonymous; missing CSRF header | `403 FORBIDDEN` / `401` / `403 CSRF_CHECK_FAILED`; no row change | `actions-taken.api.test.ts` | Planned |
| API-07 | API | AC-05 | Requester lists own Ticket; another Requester's Ticket | all Actions incl. all fields / `404 TICKET_NOT_FOUND` | `actions-taken.api.test.ts` | Planned |
| API-08 | API | AC-06 | Update with correct `expectedVersion` | `200`, version +1, `updatedBy` set, Ticket `updatedAt` refreshed | `actions-taken.api.test.ts` | Planned |
| API-09 | API | AC-06 | Stale `expectedVersion`; missing `expectedVersion` | `409 VERSION_CONFLICT` (`details.currentVersion`), no change; `400` when missing | `actions-taken.api.test.ts` | Planned |
| API-10 | API | AC-07 | Order after editing `actionAt`; `DELETE` attempt | Order by `createdAt, id` unchanged; `404` and row still exists | `actions-taken.api.test.ts` | Planned |
| API-11 | API | AC-08 | Create/update while Resolved, Closed, Cancelled; list in those statuses | `409 TICKET_ACTIONS_LOCKED`; list `200` | `actions-taken.api.test.ts` | Planned |
| API-12 | API | AC-10 | Same `clientRequestId` twice, and two simultaneous requests | exactly one row; second response `200` with the same Action | `actions-taken.api.test.ts` | Planned |
| API-13 | API | AC-11 | `followUpCompleted` true/false; on an Action with no follow-up | `followUpCompletedAt` set/cleared; `400` when not required | `actions-taken.api.test.ts` | Planned |
| API-14 | API | AC-01 | List `summary` | `total` and `openFollowUps` correct for 0/1/many | `actions-taken.api.test.ts` | Planned |
| API-15 | API | AC-23 | Legacy Ticket with zero Actions | `200`, `[]`, `{0,0}`; Ticket detail unaffected | `actions-taken.api.test.ts` | Planned |
| API-16 | API | AC-05 | Bad ids; action of another Ticket | `400 INVALID_*_ID`; `404 ACTION_NOT_FOUND` | `actions-taken.api.test.ts` | Planned |

### 2.3 Workflow (API)

| Test ID | Type | Req / AC | What it tests | Expected result | Automated test file | Final |
|---|---|---|---|---|---|---|
| WF-01 | Workflow | AC-12 | Table-driven: every (from, to) pair through `PATCH …/status` | 15 × `200`; 49 × `409 INVALID_STATUS_TRANSITION` | `ticket-workflow.api.test.ts` | Planned |
| WF-02 | Authorization | AC-12 | Requester and anonymous call status endpoint | `403` / `401`; status unchanged | `ticket-workflow.api.test.ts` | Planned |
| WF-03 | Workflow | AC-13 | Resolve with no Actions (from In Progress and from Waiting) via direct API | `409 RESOLUTION_BLOCKED`, `reason = NO_ACTIONS_TAKEN` | `ticket-workflow.api.test.ts` | Planned |
| WF-04 | Workflow | AC-13 | Resolve with an open follow-up, then after completing it | blocked with `openFollowUps = n`; then `200` | `ticket-workflow.api.test.ts` | Planned |
| WF-05 | Workflow | AC-13, AC-14 | Resolve with ≥1 Action and no open follow-up | `200`; `resolvedAt` set | `ticket-workflow.api.test.ts` | Planned |
| WF-06 | Workflow | AC-14 | Requester mark-resolved; Reopen; Close | status unchanged by mark; Reopen clears `resolvedAt` and flag; Close keeps `resolvedAt` | `ticket-workflow.api.test.ts` | Planned |
| WF-07 | Workflow | AC-15 | Stale `expectedVersion` on status, owner, priority; omitted `expectedVersion` | `409 VERSION_CONFLICT`, unchanged; omitted still `200`; each success `version +1` | `ticket-workflow.api.test.ts` | Planned |
| WF-08 | Workflow | AC-13 | Race: resolve while another request adds an open follow-up | Invariant holds: never `Resolved` with an open follow-up (one request fails with a documented code) | `ticket-workflow.api.test.ts` | Planned |
| WF-09 | Workflow | AC-15 | Two concurrent status changes with the same `expectedVersion` | exactly one `200`, one `409` | `ticket-workflow.api.test.ts` | Planned |
| WF-10 | Workflow | AC-21 | `allowedTransitions` in staff responses; absent in Requester responses | present/correct; structurally absent | `ticket-workflow.api.test.ts` | Planned |
| WF-11 | Workflow | AC-12 | Cancel with open follow-ups | `200` (gate does not apply) | `ticket-workflow.api.test.ts` | Planned |
| WF-12 | Regression | AC-25 | Owner change to inactive / non-staff user still rejected; priority rules intact | same Lab 3 errors | `ticket-workflow.api.test.ts` | Planned |
| WF-13 | Workflow | AC-18 | `statusGroup=active` on both list endpoints; unknown value; `statusGroup` + `status` | correct filtering; `400 INVALID_QUERY_PARAMETER` | `ticket-workflow.api.test.ts` | Planned |

### 2.4 Dashboards (API)

| Test ID | Type | Req / AC | What it tests | Expected result | Automated test file | Final |
|---|---|---|---|---|---|---|
| RD-01 | API | AC-16 | Requester metrics vs direct DB queries on fixtures | every value equals the query result | `requester-dashboard.api.test.ts` | Planned |
| RD-02 | Authorization | AC-02 | Other Requesters' Tickets present in DB | none appear in any metric or list; no `users` | `requester-dashboard.api.test.ts` | Planned |
| RD-03 | API | AC-16 | Requester with no Tickets | zeros; lists `[]` (not `null`) | `requester-dashboard.api.test.ts` | Planned |
| RD-04 | Authorization | AC-17 | Staff/Admin/anonymous call requester dashboard | `403` / `401` | `requester-dashboard.api.test.ts` | Planned |
| RD-05 | API | AC-18 | Follow each `drilldown` against `GET /api/tickets` | `totalItems` equals card value | `requester-dashboard.api.test.ts` | Planned |
| RD-06 | API | AC-16 | List ordering, ≤5 cap, 7-day `recentlyResolved` boundary | as BR-27/BR-28 | `requester-dashboard.api.test.ts` | Planned |
| SD-01 | API | AC-17 | Staff metrics vs SQL | equal | `staff-dashboard.api.test.ts` | Planned |
| SD-02 | API | AC-17 | `byStatus` (8 entries incl. zeros) and `byPriority` (`Unset`) | complete and correct | `staff-dashboard.api.test.ts` | Planned |
| SD-03 | API | AC-17 | `myOwned`, `myOpenFollowUps`, `myRecentActions` for two different staff | scoped to the caller | `staff-dashboard.api.test.ts` | Planned |
| SD-04 | Authorization | AC-17 | `users` for Administrator vs IT Staff | present only for Administrator | `staff-dashboard.api.test.ts` | Planned |
| SD-05 | Authorization | AC-17 | Requester/anonymous call staff dashboard | `403` / `401` | `staff-dashboard.api.test.ts` | Planned |
| SD-06 | API | AC-18 | Follow each `drilldown` against `GET /api/staff/tickets` | `totalItems` equals card value | `staff-dashboard.api.test.ts` | Planned |
| SD-07 | API | AC-16 | Staff with zero owned Tickets/Actions | zeros and `[]` | `staff-dashboard.api.test.ts` | Planned |

### 2.5 Authorization, health, migration/seed, performance-smoke

| Test ID | Type | Req / AC | What it tests | Expected result | Automated test file | Final |
|---|---|---|---|---|---|---|
| AUTH-01 | Authorization | AC-05, AC-17 | Table-driven matrix of `api-spec.md` §7 (all new endpoints × anonymous/Requester owner/other Requester/IT Staff/Administrator) | every cell matches | `authorization-matrix.api.test.ts` | Planned |
| AUTH-02 | Authorization | AC-05 | Missing CSRF header on every new mutating endpoint | `403 CSRF_CHECK_FAILED` before any DB change | `authorization-matrix.api.test.ts` | Planned |
| AUTH-03 | Authorization | AC-25 | `mustChangePassword = true` session on new endpoints | rejected like other protected endpoints | `authorization-matrix.api.test.ts` | Planned |
| HEALTH-01 | API | AC-27 | `GET /api/health` with DB up | `200 { status: "ok", database: "up" }` | `health.api.test.ts` | Planned |
| HEALTH-02 | API | AC-27 | DB failure simulated | `503 { status: "degraded", database: "down" }` | `health.api.test.ts` | Planned |
| HEALTH-03 | API | AC-27 | Forced internal error on a new endpoint | `500 INTERNAL_ERROR`, no stack/SQL/path in body | `health.api.test.ts` | Planned |
| MIG-01 | Migration | AC-23 | Apply migration on a copy of Lab 3 data | row counts of all earlier tables equal before/after | `migration-seed.test.ts` | Planned |
| MIG-02 | Migration | AC-23 | Backfill | `resolvedAt = updatedAt` for `Resolved`; `NULL` otherwise; `version = 1` | `migration-seed.test.ts` | Planned |
| MIG-03 | Migration | AC-23 | Legacy Tickets through existing endpoints | load normally with zero Actions | `migration-seed.test.ts` | Planned |
| MIG-04 | Migration | AC-24 | Run seed twice | identical row counts; no duplicates | `migration-seed.test.ts` | Planned |
| MIG-05 | Migration | AC-24 | Seed coverage | all 8 statuses, assigned/unassigned, Tickets with 0/1/3+ Actions, open and done follow-ups, zero-metric users | `migration-seed.test.ts` | Planned |
| MIG-06 | Migration | AC-23 | Rehearse `rollback.sql` on a scratch DB | Lab 3 schema restored; earlier data intact | manual + recorded output | Planned |
| PERF-01 | Perf-smoke | AC-27 | Both dashboard endpoints on the seed (after one warm-up call) | each responds in < 500 ms | `performance-smoke.api.test.ts` | Planned |
| PERF-02 | Perf-smoke | AC-27 | List 200 Actions on one Ticket | responds in < 500 ms | `performance-smoke.api.test.ts` | Planned |

### 2.6 UI component

| Test ID | Type | Req / AC | What it tests | Expected result | Automated test file | Final |
|---|---|---|---|---|---|---|
| UI-01 | UI | AC-20 | Actions list renders all fields, stable order, "Edited" marker, empty state | as `ui-spec.md` §4.2 | `ActionsTaken.test.tsx` | Planned |
| UI-02 | UI | AC-20 | Create form: follow-up note appears only when checked and is required; messages under fields; error summary + focus | as §4.4 | `ActionsTaken.test.tsx` | Planned |
| UI-03 | UI | AC-20 | Double-click Save | one POST; same `clientRequestId` on retry | `ActionsTaken.test.tsx` | Planned |
| UI-04 | UI | AC-20 | Network/`500`/`400` failure | message shown, typed data preserved | `ActionsTaken.test.tsx` | Planned |
| UI-05 | UI | AC-20 | `409 VERSION_CONFLICT` | conflict banner with Reload latest / Keep editing; no silent overwrite | `ActionsTaken.test.tsx` | Planned |
| UI-06 | UI | AC-20 | Edit mode and Mark follow-up done | PATCH includes `expectedVersion` from state; list refreshes | `ActionsTaken.test.tsx` | Planned |
| UI-07 | UI | AC-20, AC-05 | Requester view | list visible; no Add/Edit/Mark controls; Performed by read-only everywhere | `ActionsTaken.test.tsx` | Planned |
| UI-08 | UI | AC-08, AC-20 | Ticket in Resolved/Closed/Cancelled | controls hidden/disabled with explanation; `TICKET_ACTIONS_LOCKED` handled | `ActionsTaken.test.tsx` | Planned |
| UI-09 | UI | AC-20 | Loading, empty, forbidden, not-found states | texts and roles as §4.5 | `ActionsTaken.test.tsx` | Planned |
| UI-11 | UI | AC-21 | Status select options | exactly `allowedTransitions`; none for Cancelled | `TicketWorkflow.test.tsx` | Planned |
| UI-12 | UI | AC-21 | Confirmation dialog per (from → to) | dialog for Cancelled/Resolved/Closed/Reopened pairs; none for New→Open, Open→In Progress, In Progress↔Waiting | `TicketWorkflow.test.tsx` | Planned |
| UI-13 | UI | AC-21 | Resolved selected with `total = 0` or open follow-ups | Update disabled + helper text with `aria-describedby` | `TicketWorkflow.test.tsx` | Planned |
| UI-14 | UI | AC-21 | Backend `RESOLUTION_BLOCKED` / `INVALID_STATUS_TRANSITION` / `VERSION_CONFLICT` | inline messages; data reloaded; state kept | `TicketWorkflow.test.tsx` | Planned |
| UI-15 | UI | AC-21 | Successful change | summary status badge, controls, and announcement refresh | `TicketWorkflow.test.tsx` | Planned |
| UI-16 | UI | AC-21, AC-26 | Dialog accessibility | `role=dialog`, focus trap, Esc closes, focus returns | `TicketWorkflow.test.tsx` | Planned |
| UI-17 | UI | AC-14 | "Requester reports resolved" badge | shown from `requesterMarkedResolved`; no effect on controls | `TicketWorkflow.test.tsx` | Planned |
| UI-18 | UI | AC-19 | Staff dashboard cards, grids, lists | values from API; links use `drilldown`; Unset and follow-up cards not links | `StaffDashboard.test.tsx` | Planned |
| UI-19 | UI | AC-19 | Staff dashboard loading/empty/forbidden/error + Retry | states as §3.4 | `StaffDashboard.test.tsx` | Planned |
| UI-20 | UI | AC-17 | Users card | rendered only when `users` present | `StaffDashboard.test.tsx` | Planned |
| UI-22 | UI | AC-19 | Requester dashboard cards and panels | values and links as §3.2 | `RequesterDashboard.test.tsx` | Planned |
| UI-23 | UI | AC-19 | Requester dashboard loading/empty/forbidden/error | states as §3.4 | `RequesterDashboard.test.tsx` | Planned |
| UI-25 | UI | AC-22 | Nav per role with `aria-current`; detail routes keep parent active | entries as `ui-spec.md` §2 | `AppNavigation.test.tsx` | Planned |
| UI-26 | UI | AC-22 | Routing: `/` redirects staff to `/dashboard`; drill-down query read by My Tickets and Ticket Queue | as spec | `AppNavigation.test.tsx` | Planned |

(`UI-10`, `UI-21`, `UI-24` intentionally unused.)

### 2.7 UI style, responsive, accessibility

| Test ID | Type | Req / AC | What it tests | Expected result | Automated test file | Final |
|---|---|---|---|---|---|---|
| STY-01 | UI style | AC-26 | Status badges, priorities, follow-up | text label (and glyph) always present, not colour-only | `LabFourStyle.test.tsx` | Planned |
| STY-02 | UI style | AC-26 | Private vs shared labels | "Private — IT Staff only" on Notes; "Visible to Requester" on Comments/Actions | `LabFourStyle.test.tsx` | Planned |
| STY-03 | UI style | AC-26 | Form controls | labelled; `aria-invalid` and `aria-describedby` on errors | `LabFourStyle.test.tsx` | Planned |
| STY-04 | UI style | AC-19, AC-26 | Render every new screen with `console.error/warn` spied | no calls | `LabFourStyle.test.tsx` | Planned |
| STY-05 | UI style | AC-26 | `tokens-lint`: no off-palette hex in Lab 4 files | passes | `scripts/tokens-lint` (run in CI) | Planned |
| RESP-01 | Responsive | AC-26 | For each new screen at 320/390/768/1024/1280 px | `scrollWidth ≤ clientWidth`; no clipped text | `e2e/lab-04/responsive.spec.ts` | Planned |
| RESP-02 | Responsive | AC-26 | Actions table ↔ cards switch at the breakpoint | table ≥ 992 px, cards below | `e2e/lab-04/responsive.spec.ts` | Planned |
| RESP-03 | Responsive | AC-26 | Screenshot capture per screen/viewport/state | files at `artifacts/lab-04/screenshots/…` | `e2e/lab-04/responsive.spec.ts` | Planned |
| RESP-04 | Accessibility | AC-26 | Keyboard-only walk: dashboard → Actions form → status dialog; focus visible | all operable; focus never lost | `e2e/lab-04/responsive.spec.ts` | Planned |
| RESP-05 | Accessibility | AC-26 | Optional automated accessibility scan (only if a test-only `@axe-core/playwright` devDependency is approved in the PR) | no serious/critical violations | `e2e/lab-04/responsive.spec.ts` | Planned |

### 2.8 End-to-end and full regression

| Test ID | Type | Req / AC | What it tests | Expected result | Automated test file | Final |
|---|---|---|---|---|---|---|
| E2E-01 | E2E | AC-01, AC-03, AC-05, AC-20 | Staff A (owner) and Staff B each add Actions to one Ticket; Requester views read-only | different performers visible; Requester has no edit controls | `actions-taken-flow.spec.ts` | Planned |
| E2E-02 | E2E | AC-06, AC-20 | Edit an Action; second browser context edits the same Action from stale data | success, then conflict message with input preserved | `actions-taken-flow.spec.ts` | Planned |
| E2E-03 | E2E | AC-10, AC-20 | Double-click Save | exactly one Action appears | `actions-taken-flow.spec.ts` | Planned |
| E2E-04 | E2E | AC-13, AC-21 | Try to resolve (blocked) → add Action with follow-up (blocked) → complete follow-up → resolve; summary status updates | blocked messages shown; final status Resolved | `ticket-resolution.spec.ts` | Planned |
| E2E-05 | E2E | AC-14 | Requester "Problem Appears Resolved" keeps status; staff see badge; staff Reopen clears it | as BR-17/18 | `ticket-resolution.spec.ts` | Planned |
| E2E-06 | E2E | AC-16, AC-17, AC-18 | Requester, IT Staff, Administrator dashboards: values, drill-down counts equal list totals, Administrator users card | consistent | `dashboards.spec.ts` | Planned |
| E2E-07 | E2E | AC-22 | Login landing and navigation per role; active page | as `ui-spec.md` §2 | `dashboards.spec.ts` | Planned |
| REG-01 | Regression | AC-25 | Full server suite (Lab 1–3: 12 files / 106 tests baseline, plus Lab 4) | all pass, 3 consecutive runs, no leftovers | `npm test` in `server/` | Planned |
| REG-02 | Regression | AC-25 | Full client suite (Lab 1–3: 11 files / 55 tests baseline, plus Lab 4) | all pass | `npm test` in `client/` | Planned |
| REG-03 | Regression | AC-25 | `npm run build` in `server/` and `client/` | success, no type errors | build output | Planned |
| REG-04 | Regression | AC-25 | Playwright `e2e/lab-02` and `e2e/lab-03` | all pass from reset DB | existing specs | Planned |
| REG-05 | Regression | AC-25 | Manual per-role click-through: authentication and forced password change, My Tickets, Ticket Detail, Attachments, Public Comments, Staff Queue/operations, Internal Notes, Administrator user management | all routes/nav entries reachable by permitted roles only | checklist + screenshots | Planned |

## 3. Acceptance-Criterion traceability

| AC | Tests |
|---|---|
| AC-01 | API-01, API-14, E2E-01 |
| AC-02 | RD-02 |
| AC-03 | API-02, E2E-01 |
| AC-04 | UNIT-04, API-04, API-05 |
| AC-05 | API-06, API-07, API-16, AUTH-01, AUTH-02, UI-07, E2E-01 |
| AC-06 | API-08, API-09, UI-05, UI-06, E2E-02 |
| AC-07 | API-10 |
| AC-08 | API-11, UI-08 |
| AC-09 | UNIT-04, API-03 |
| AC-10 | API-12, UI-03, E2E-03 |
| AC-11 | API-13, UI-06 |
| AC-12 | UNIT-01, UNIT-02, WF-01, WF-02, WF-11 |
| AC-13 | UNIT-03, WF-03, WF-04, WF-05, WF-08, E2E-04 |
| AC-14 | WF-05, WF-06, UI-17, E2E-05 |
| AC-15 | WF-07, WF-09, UI-14 |
| AC-16 | UNIT-05, RD-01, RD-03, RD-06, SD-07, E2E-06 |
| AC-17 | UNIT-05, RD-04, SD-01 – SD-05, AUTH-01, UI-20, E2E-06 |
| AC-18 | WF-13, RD-05, SD-06, E2E-06 |
| AC-19 | UI-18, UI-19, UI-22, UI-23, STY-04 |
| AC-20 | UNIT-06, UI-01 – UI-09, E2E-01 – E2E-03 |
| AC-21 | UNIT-02, WF-10, UI-11 – UI-16, E2E-04 |
| AC-22 | UI-25, UI-26, E2E-07 |
| AC-23 | API-15, MIG-01 – MIG-03, MIG-06 |
| AC-24 | MIG-04, MIG-05 |
| AC-25 | WF-12, AUTH-03, REG-01 – REG-05 |
| AC-26 | UI-16, STY-01 – STY-05, RESP-01 – RESP-05 |
| AC-27 | HEALTH-01 – HEALTH-03, PERF-01, PERF-02 |

Every AC (AC-01 … AC-27) has at least one planned test.

## 4. TDD order by Issue

| Issue | Failing tests written first | Regression gate before PR |
|---|---|---|
| 1 — Specification & Test Plan | none (documents only) | review: AC ↔ test table complete |
| 2 — Actions Taken foundation | UNIT-04, API-01 – API-16, AUTH-01 (Actions rows), AUTH-02, MIG-01 – MIG-06 | Lab 1–3 server suite ×3, `npm run build` |
| 3 — Actions Taken UI | UNIT-06, UI-01 – UI-09, STY-01 – STY-04 | client suite, build, 3-viewport screenshots |
| 4 — Ticket workflow & gate | UNIT-01 – UNIT-03, WF-01 – WF-13, UI-11 – UI-17 | Lab 3 status/owner/priority tests unchanged in meaning |
| 5 — Role dashboards | UNIT-05, RD-01 – RD-06, SD-01 – SD-07, UI-18 – UI-26, PERF-01/02, HEALTH-01 – 03 | all suites, route/nav listing per role |
| Release integration on `lab4-staging` | E2E-01 – E2E-07, RESP-01 – RESP-05, STY-05, REG-01 – REG-05 | full pass from DB reset; checklist in `ui-spec.md` §9 |

## 5. Final results (to be filled from `main`)

| Suite | Command | Files / tests | Result | Date |
|---|---|---|---|---|
| Server | `cd server && npm test` | — | Planned | — |
| Client | `cd client && npm test` | — | Planned | — |
| Builds | `npm run build` (server, client) | — | Planned | — |
| E2E | `npx playwright test e2e/lab-02 e2e/lab-03 e2e/lab-04` | — | Planned | — |

Paste the raw terminal output (redirected to a file and `cat`-ed) for Part 3 of the submission; do not paraphrase it.

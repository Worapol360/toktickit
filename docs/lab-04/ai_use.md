# AI Prompt & Tool Usage Log - Lab 04

This document records selected interactions with AI tools (primarily GitHub Copilot) during the implementation and verification of Lab 4.

## Prompt History

### Prompt 1 — Sprint Specification & Test Plan

```text
**Prompt1: Sprint Specification & Test Plan (docs only)**
 
Context: TokTickIT, Lab 4 Issue 1 — Sprint Specification & Test Plan. This is
the first Issue of Lab 3 and must be fully completed and approved before any
other Issue starts, per the project's Spec-Driven Development workflow.
 
Read these files in full before writing anything:
- docs/lab-03/specification.md
- docs/lab-03/api-spec.md
- docs/lab-03/ui-spec.md
- docs/lab-03/tests.md
- The Lab 4 handout excerpt provided separately in this conversation
Do not write any code, migrations, or component files in this Issue. This
Issue produces documentation only.
 
Deliverables — create exactly these four files, matching the heading
structure, numbering style, and level of detail of the Lab 3 equivalents:
docs/lab-03/specification.md, api-spec.md, ui-spec.md, tests.md. Number
Functional Requirements as FR-01..., Business Rules as BR-01..., Acceptance
Criteria as AC-01... — restart numbering from 01 for this sprint. Any point
where the handout is ambiguous must be written as an explicit entry under
"Assumptions and Decisions" — do not silently pick one option without
flagging it.
```

**Reflection:**
ใช้ AI ช่วยจัดทำเอกสารข้อกำหนดของ Sprint ก่อนเริ่มพัฒนา โดยกำหนดให้ยึดเอกสารเดิมและ handout เป็นหลัก รวมถึงแยกสิ่งที่ยังไม่ชัดเจนไว้ใน Assumptions and Decisions ทำให้มีข้อตกลงร่วมกันก่อนเริ่มเขียนโค้ด และช่วยลดการตีความ requirement ไม่ตรงกัน

---

### Prompt 2 — Issue 2: Actions Taken API (Backend)

```text

You are implementing Issue 2 of Lab 4 (BACKEND ONLY) in the TokTickIT repo.

SOURCE OF TRUTH - read these first and follow them exactly. Do not re-derive or change rules:
- docs/lab-04/specification.md: section 5.1 (BR-01..BR-12), section 5.3 (BR-20..BR-24), section 7 (data changes, migration, backfill, seed), section 9 (AC-01..AC-11, AC-23, AC-24), section 11 (decisions D-01..D-20)
- docs/lab-04/api-spec.md: section 1, section 2.2, section 3 (all), section 7
- docs/lab-04/tests.md: UNIT-04, API-01..API-16, MIG-01..MIG-05, AUTH-01/AUTH-02 (Actions Taken rows only)

SCOPE - IN:
1. Prisma: add the ActionTaken model; add Ticket.version (Int, default 1) and Ticket.resolvedAt (DateTime?); add the relations and indexes from specification section 7.1. Create ONE migration (name: lab4_actions_taken). The backfill SQL (resolvedAt = updatedAt for status 'Resolved') goes INSIDE the migration SQL, never in seed.ts. Never use prisma migrate reset. Run npx prisma generate afterwards. Apply the migration to the test DB the same way the repo already does (check package.json scripts / README).
2. Write docs/lab-04/rollback.sql (reverse SQL as in specification section 7.3, using the real table/column names from the generated migration).
3. New code goes in NEW files under server/src/lab-04/ (validator, service, route handlers). Touch server/src/server.ts ONLY to register the new routes (and, if needed, to extend errorResponse with an OPTIONAL backward-compatible "details" argument).
4. Endpoints (api-spec section 3): 
   - GET /api/tickets/:id/actions-taken  (shared endpoint with its OWN role gate: REQUESTER owner only, IT_STAFF, ADMINISTRATOR; mirror the existing Public Comments GET pattern; Requester on another Requester's ticket -> 404 TICKET_NOT_FOUND)
   - POST /api/staff/tickets/:id/actions-taken
   - PATCH /api/staff/tickets/:id/actions-taken/:actionId
   - NO DELETE endpoint.
5. Rules to implement: performedBy and updatedBy come from the session only; client-sent performedById/performedBy/version/followUpCompletedAt are ignored on create; validation limits and messages per BR-04/05/06; followUpNote and followUpCompletedAt stored as null when followUpRequired=false; followUpCompleted boolean on PATCH; expectedVersion REQUIRED on PATCH, mismatch -> 409 VERSION_CONFLICT with details.currentVersion; writes blocked when Ticket status is Resolved/Closed/Cancelled -> 409 TICKET_ACTIONS_LOCKED (reads always work); list ordered createdAt ASC, id ASC plus summary {total, openFollowUps}; creating/updating an Action also sets Ticket.updatedAt (do NOT change Ticket.version).
6. Atomicity and idempotency (BR-22, BR-23): create and update run in one prisma.$transaction that locks the Ticket row (SELECT ... FOR UPDATE via $queryRaw; check the real table name via @@map). Create is idempotent on (ticketId, clientRequestId): existing row -> return it with 200; also handle the unique-violation race by re-reading and returning 200. PATCH uses a conditional update on version inside the transaction. Do not use Promise.all around multiple multi-relation include queries (Prisma + adapter-pg lesson).
7. Seed (specification section 7.4): extend the existing seed idempotently with upsert on natural keys (tickets by ticketNumber in the reserved range TICK-20261020-9001..9012; actions by (ticketId, clientRequestId "seed-...")). Cover all 8 statuses, assigned/unassigned, requester-marked-resolved true/false, one ticket with itPriority NULL, tickets with 0 / 1 / 3+ actions, one open and one completed follow-up, one action by a different IT Staff than the ticket owner, one Resolved ticket (>=1 action, no open follow-up), one Reopened ticket, and ensure at least one active Requester and one IT Staff user have zero tickets. Check the ticket-number generator cannot collide with the reserved range; if it can, STOP and report. Dev-only passwords stay where they already are; no new secrets.

SCOPE - OUT (do NOT do these, they belong to Issues 3-5):
- anything in client/, App.tsx, vitest.config.ts
- changing PATCH status/owner/priority behavior, expectedVersion on those endpoints, allowedTransitions, resolution gate, resolvedAt maintenance on status change, statusGroup filter, dashboards, /api/health
- exposing Ticket.version/resolvedAt in existing Ticket JSON responses

METHOD (TDD):
a. Write the failing tests first: server/tests/lab-04/action-validation.unit.test.ts (UNIT-04), server/tests/lab-04/actions-taken.api.test.ts (API-01..API-16), server/tests/lab-04/migration-seed.test.ts (MIG-01..MIG-05; MIG-06 is manual). Add Actions rows of AUTH-01 and AUTH-02 in server/tests/lab-04/authorization-matrix.api.test.ts. Reuse the existing Lab 3 login/session/CSRF helpers.
b. Implement until green.
c. Test hygiene (hard rules): every test creates its own fixtures with a unique prefix and cleans up with scoped deletes; NEVER unscoped updateMany/deleteMany; restore any shared seed user you mutate; for the concurrency tests (API-12 two simultaneous identical requests) use Promise.all of two requests and assert exactly one row.
d. EXISTING TESTS: do not edit any existing test file. If an existing test fails, STOP and report the failure with the raw output instead of changing it. Never weaken an expect(...).

STOP CONDITIONS - stop and report (do not guess) if: the spec conflicts with the real code/schema; the ticket-number generator can collide; the test DB cannot be migrated; or an existing test breaks.

DELIVERABLE EVIDENCE (raw output, not summaries). Write command output to files in $env:TEMP, then print them:
1. git status and git diff --stat
2. cd server; npm test (run it 3 times in a row), npm run build
3. cd client; npm test, npm run build (must still pass; client has no changes)
4. grep/Select-String proving: (a) no performedById is read from req.body, (b) no DELETE route for actions-taken, (c) no unscoped deleteMany/updateMany in the new test files
5. the generated migration.sql contents
Do NOT commit; leave changes in the working tree.
```

**Reflection:**
ใช้ AI ช่วยพัฒนา Backend สำหรับ Actions Taken ตาม API specification ตั้งแต่ฐานข้อมูลและ migration ไปจนถึง validation, authorization, transaction และ tests การกำหนด scope กับ stop conditions ช่วยป้องกันไม่ให้ AI ไปแก้ส่วนของ Issue อื่น และทำให้ตรวจสอบผลจาก test และหลักฐานได้

---

### Prompt 3 — Client TypeScript Build Fix

```text

TASK: Fix the 4 TypeScript build errors in the TokTickIT client, on branch fix/lab4-client-build-baseline (created from lab4-staging). This is a baseline fix. Keep the change minimal.

KNOWN ERRORS (from `cd client && npm run build`):
1. client/src/App.tsx:42  TS18047: 'user' is possibly 'null' (expression: user.role === 'ADMINISTRATOR')
2. client/src/tests/lab-03/UserManagement.test.tsx:274  TS2353: property 'error' does not exist in type '{ user: ... }'
3. client/src/tests/lab-03/UserManagement.test.tsx:378  TS2353: property 'error' does not exist in type '{ users: ... }'
4. client/src/tests/lab-03/UserManagement.test.tsx:428  TS2353: property 'error' does not exist in type '{ user: ... }'
The same 4 errors occur on lab4-staging, so they are pre-existing and NOT caused by Lab 4 Issue 2. Client tests currently pass (11 files / 55 tests).

HARD RULES:
- Do not use @ts-ignore, @ts-expect-error, `as any`, `as unknown as`, or non-null assertions (!) to silence errors.
- Do not change any expect(...) assertion, test name, or test logic. Only types/mocks' declared types may change in the test file.
- Do not change production API behavior or the error envelope { error: { code, message, fields? } } (documented in docs/lab-03/api-spec.md section 1.2).
- Do not restructure the navigation in App.tsx (Issue 5 will rework it). Make the smallest possible change.
- Do not touch server/, package.json, package-lock.json, tsconfig files, vitest.config.ts, or docs/.
- Do not commit. Leave changes in the working tree.

PHASE 1 - INVESTIGATE (read-only; print findings before editing anything):
A. Reproduce: cd client; npm run build  -> save full output to $env:TEMP\build_before.txt and show it. Then run `git checkout -- client/tsconfig.app.tsbuildinfo` if that generated file changed.
B. App.tsx: show lines 25-80 (the AppShell nav). Show how `user` is obtained in AppShell (useAuth) and the declared type of `user` in AuthContext. Explain exactly why TypeScript considers `user` nullable at line 42 (narrowing lost across the ternary?). State whether this is a missing null guard (type-flow issue) or a real runtime bug. Note AuthenticatedApp returns early when !user.
C. Test file: show lines 255-285, 365-385, 415-435 of client/src/tests/lab-03/UserManagement.test.tsx, and the definition of the helper/mock/function whose type causes the error (where the `{ user }` / `{ users }` response type is declared). Show how the component under test (client/src/pages/UserManagement.tsx) reads error responses, and whether the tests assert on the error text. Report the real server error shape used by the app.
D. Run: git log --oneline -3 -- client/src/App.tsx client/src/tests/lab-03/UserManagement.test.tsx ; npm ls typescript . Report the TypeScript version.
E. Print a short diagnosis: root cause per error and the planned minimal fix.

PHASE 2 - FIX (only if Phase 1 confirms): 
(a) App.tsx is a narrowing/null-guard issue only, and (b) the test errors come from a mock/helper response type that only models the success shape.
If either is NOT confirmed, STOP after Phase 1 and report; do not edit anything.
Planned fixes:
- App.tsx: guard `user` with the smallest change (e.g. `user?.role === 'ADMINISTRATOR'`, or one local `const role = user?.role` used by the nav conditions). Keep rendered output identical for every role.
- Tests: widen the declared TYPE of the response in the helper/mock to a success-or-error union that matches the real envelope, e.g. `T | { error: { code: string; message: string; fields?: Record<string, string> } }`. Change declarations only; keep every mock value and every expect unchanged.

VERIFICATION (raw output, write to $env:TEMP then print):
1. cd client; npm run build  (must pass, 0 errors)  -> then `git checkout -- client/tsconfig.app.tsbuildinfo` if it changed
2. cd client; npm test  (expect 11 files / 55 tests, all pass)
3. cd server; npm run build; npm test is NOT required (no server changes)
4. git status; git diff --stat; git diff (full diff, it should be small)
5. Select-String proof that the diff contains none of: @ts-ignore, @ts-expect-error, "as any", "as unknown", and that no line containing "expect(" was added or removed.
6. Console warnings in the test output: report if any new ones appear.

If anything unexpected happens (build still failing, a test fails, the diff touches more than App.tsx and UserManagement.test.tsx), STOP and report the raw output.
```

**Reflection:**
ใช้ AI ตรวจและแก้ปัญหา TypeScript build โดยให้ตรวจสาเหตุก่อนแก้ และจำกัดไฟล์ที่อนุญาตให้เปลี่ยน พร้อมห้ามลดความเข้มงวดของ assertions ใน tests วิธีนี้ช่วยแยกปัญหาเดิมของโปรเจกต์ออกจากปัญหาที่เกิดจาก Lab 4 และทำให้การแก้ไขมีขอบเขตชัดเจน

---

### Prompt 4 — Issue 3: Actions Taken UI (Frontend)

```text

You are implementing Issue 3 of Lab 4 (FRONTEND ONLY) in the TokTickIT repo. The Actions Taken API already exists and is merged.

SOURCE OF TRUTH - read first and follow exactly:
- docs/lab-04/ui-spec.md: section 1 (tokens), section 4 (all), section 6 (responsive), section 7 (visual language and accessibility)
- docs/lab-04/api-spec.md: section 2.2 and section 3 (request/response shapes and error codes)
- docs/lab-04/specification.md: BR-03..BR-12, BR-20, BR-21, BR-23, AC-20
- docs/lab-04/tests.md: UNIT-06, UI-01..UI-09, STY-01..STY-04

SCOPE - IN:
1. Staff Ticket Detail (/staff/tickets/:id): add the Actions Taken area between the ticket summary and Public Comments. Desktop (>=992px) table, narrower = cards (same fields, labels always visible). Fields: Action time, Description, Result, Performed by, Follow-up, Attachment notes, Recorded (createdAt). Stable order as returned by the API. Show an "Edited by ... at ..." marker when version > 1. Follow-up cell text cues: "Not required", "Follow-up open - {note}" with a warning glyph, "Follow-up done". Label the region "Visible to Requester" (text + icon).
2. Modes: View, Create (inline form opened by an "Add Action" button, not a modal), Edit (same form inline, prefilled). Performed by is read-only text "{name} (automatic)". Fields, validation messages and helper text exactly as in ui-spec section 4.4. Follow-up note appears only when "Follow-up required?" is checked and is cleared when unchecked. "Mark follow-up done" / "Reopen follow-up" actions send followUpCompleted via PATCH.
3. Requester Ticket Detail (/tickets/:id): show the same list READ-ONLY (no Add/Edit/Mark controls) with the note "These updates are visible to you and to IT Staff."
4. When the ticket status is Resolved, Closed or Cancelled: hide/disable the staff controls and show the explanation text from ui-spec section 4.3; still handle a 409 TICKET_ACTIONS_LOCKED response.
5. States per ui-spec section 4.5: loading, empty, validation (400 field messages under the matching field + error summary with focus moved to the first invalid field), forbidden, not found, conflict (409 VERSION_CONFLICT banner with "Reload latest" and "Keep editing", never silently overwrite), safe failure (keep entered data, Retry, no technical details).
6. Behavior rules: Save button disabled while the request is in flight; generate ONE clientRequestId (crypto.randomUUID) when the Create form opens and reuse it on retry; keep the Action's version in React state from the last fetch and send it as expectedVersion on PATCH; recoverable failures keep what the user typed; do NOT fetch right after setState in a handler - use a useEffect reacting to state; announce "Action saved." through a role="status" live region.
7. Time handling: show and enter times in Asia/Bangkok (GMT+7). Format with Intl.DateTimeFormat using timeZone "Asia/Bangkok". Convert the datetime-local value to an ISO UTC string by treating it as +07:00. Label "GMT+7" once per screen.
8. Accessibility: visible labels on every control, aria-invalid and aria-describedby on errors, visible focus ring, keyboard operation, th scope + visually hidden table caption, icons aria-hidden when text is adjacent, h2 per region.
9. Styling: reuse the repo's existing token mechanism (CSS variables / shared styles). Add only the NEW tokens from ui-spec section 1 there. No off-palette hex values in new code. Reuse existing badge/button/form/table/card conventions from the Lab 3 Staff Queue and Ticket Detail.
10. API calls: reuse the existing fetch helper pattern (credentials same-origin; X-Requested-With: XMLHttpRequest on POST/PATCH). Put new calls in a small module, e.g. client/src/lab-04/actionsTakenApi.ts, and new UI in client/src/lab-04/ (component names ActionsTakenPanel etc.). Edit StaffTicketDetail.tsx and RequesterTicketDetail.tsx only to mount the panel.

SCOPE - OUT (belongs to Issues 4-5, do NOT do):
- status change controls, confirmation dialogs, resolution hints, allowedTransitions, dashboards, nav/route changes, App.tsx, any backend/server change, new npm dependencies, vitest.config.ts

METHOD (TDD):
a. Write the failing tests first in the repo's existing client test location (if the Lab 3 convention differs from client/src/lab-04/__tests__/, follow the convention and tell me): ActionsTaken.test.tsx (UNIT-06, UI-01..UI-09) and LabFourStyle.test.tsx (STY-01..STY-04, Actions area only).
b. Implement until green.
c. jsdom ignores CSS media queries, so table AND cards are both in the DOM: use within(table), role-based queries (findByRole), and getAllByRole(...)[0] where duplication is legitimate.
d. Do not edit existing tests. If an existing test fails, STOP and report the raw output. Never weaken an expect(...).

STOP CONDITIONS - stop and report if: the API response differs from api-spec section 3; an existing component's structure makes the panel impossible to mount without a larger refactor; or an existing test breaks.

DELIVERABLE EVIDENCE (raw output, write to $env:TEMP then print):
1. git status and git diff --stat
2. cd client; npm test; npm run build
3. cd server; npm test; npm run build (must still pass; server has no changes)
4. Select-String proofs: no localStorage/sessionStorage use, no hex colors outside the token definitions in new files, no fetch call placed directly after a setState in a handler
Do NOT commit; leave changes in the working tree.
```

**Reflection:**
ใช้ AI ช่วยสร้างส่วนแสดงและจัดการ Actions Taken บนหน้า Ticket Detail โดยอ้างอิง UI/API specification ครอบคลุม responsive layout, validation, accessibility และการจัดการ error state การระบุสิ่งที่ห้ามทำและให้เขียน tests ก่อนช่วยให้การพัฒนาตรงตามข้อกำหนดมากขึ้น

---

### Prompt 5 — Peer Review of Actions Taken UI

```text

CONTEXT
Branch: feature/lab4-3-actions-taken-ui (Lab 4 Issue 3, FRONTEND ONLY, PR is open). A peer reviewer left a comment. Your job: verify each point against the real code with evidence, and fix ONLY real gaps that live in the client UI of this PR. Specs: docs/lab-04/specification.md (BR-01..BR-12, BR-20, BR-21, BR-23, AC-03, AC-05, AC-06), docs/lab-04/api-spec.md section 3 and 7, docs/lab-04/ui-spec.md section 4.4-4.5, docs/lab-04/tests.md (API-02, API-04, API-05, API-06, AUTH-01, UI-04, UI-05, UI-07).

PEER COMMENT (summary)
1. Backend must enforce that a Requester cannot create/edit/delete Actions Taken even via API / UI bypass.
2. An IT Staff who is not the Ticket Owner / not permitted should not have write access.
3. Follow-up note validation must be enforced in the backend, not only the UI.
4. A 409 conflict must not overwrite silently and must preserve what the user typed.

HARD RULES
- Do NOT modify anything under server/, prisma/, docs/, vitest.config.ts, package.json, package-lock.json.
- Do NOT edit existing test files or weaken any expect(...). You may ADD new tests in the Lab 4 client test files.
- No @ts-ignore, as any, as unknown, non-null assertions.
- Do not change the backend authorization model. Point 2 conflicts with the approved spec (BR-02: any active IT Staff/Administrator may create/edit Actions on any Ticket; AC-03; test API-02; handout 4.3 and BR-02). Do NOT implement owner-only writes.
- If you find a real BACKEND gap in point 1 or 3, do NOT fix it here. STOP and report it with evidence so it can go into a separate fix/ branch.
- If tests time out because the machine is loaded, report it; do not change timeouts or config.
- Do not commit. Leave changes in the working tree.

PHASE 1 - VERIFY (read-only; print findings per point BEFORE editing anything)
Point 1 (Requester bypass):
 a. Show the route definitions and role gates for GET/POST/PATCH actions-taken in server/src/lab-04/* and where they are registered in server/src/server.ts (file:line). Confirm POST/PATCH are under /api/staff with a gate for IT_STAFF/ADMINISTRATOR only, that a Requester gets 403 FORBIDDEN, and that no DELETE route exists for actions-taken (Select-String for "delete" in server/src/lab-04 and for router.delete / app.delete near actions-taken).
 b. Run: cd server; npx vitest run tests/lab-04/actions-taken.api.test.ts tests/lab-04/authorization-matrix.api.test.ts and list the test names that cover Requester create/update/delete attempts (API-06, API-10, AUTH-01) with their pass/fail result.
Point 2 (non-owner staff):
 a. Show the spec text (BR-02, AC-03, D-14) and the test API-02 that proves a non-owner IT Staff may create an Action. State plainly: this is by design and not a gap.
Point 3 (follow-up note):
 a. Show the backend validation code for followUpRequired/followUpNote (file:line), including PATCH merge behavior, and the tests that cover it (UNIT-04, API-04, API-05) with results.
Point 4 (409 and data preservation) - CLIENT:
 a. Show the client code path for a 409 VERSION_CONFLICT on PATCH in client/src/lab-04/ (file:line): confirm the form state (all typed fields) is kept, the conflict banner has role="alert", "Reload latest" shows the latest server values WITHOUT discarding or silently replacing the user's unsaved text (user's text must stay visible/available, e.g. side by side or restorable), "Keep editing" keeps the form editable, and the next Save does not auto-resubmit the stale version or silently use the new version without the user's action.
 b. Same check for 400, 500, network failure, and 409 TICKET_ACTIONS_LOCKED: typed data preserved, no technical detail shown.
 c. Show the existing client tests that cover this (UI-04, UI-05) and what they actually assert. Identify any behavior in 4a/4b that is NOT covered by an assertion.
 d. Manual-style check by reading code: can a double click or retry after a conflict create a duplicate or overwrite? (clientRequestId reuse on create; expectedVersion on update.)
Print a table: point | verdict (ALREADY ENFORCED / BY DESIGN (spec) / GAP) | evidence (file:line, test names, results).

PHASE 2 - FIX (only for GAPS in point 4 that are in client/ code of this PR)
- Write a failing test first (add to client/src/lab-04/__tests__/ActionsTaken.test.tsx or wherever the Lab 4 tests live), then the minimal fix in client/src/lab-04/*.
- Required behavior: on 409 VERSION_CONFLICT the user's typed values are never lost; nothing is overwritten without an explicit user action; the banner and buttons follow docs/lab-04/ui-spec.md section 4.5.
- If there is no gap, make NO code changes and say so.

VERIFICATION (raw output, write to $env:TEMP then print)
1. cd client; npm test ; npm run build  (expect all pass; if worker timeouts occur, report them, do not change config)
2. cd server; npx vitest run tests/lab-04 (read-only verification, no server changes)
3. git status ; git diff --stat ; git diff (if anything changed)
4. Select-String proof: no changes under server/, no existing expect(...) removed or modified.

FINAL REPORT FORMAT
- The verdict table for the 4 points.
- Files changed (if any) and why.
- A short English draft reply I can post on the PR comment, one paragraph per point, factual, citing test IDs and spec IDs (BR-02/AC-03 for point 2), no overclaiming.
```

**Reflection:**
ใช้ AI ตรวจ comment จาก peer reviewer เทียบกับโค้ดและ specification ก่อนตัดสินใจแก้ไข โดยแยกประเด็นที่เป็น bug จริงออกจากประเด็นที่ขัดกับ requirement ที่ตกลงไว้ ทำให้ไม่รีบแก้ตาม comment โดยไม่ตรวจสอบ และหลีกเลี่ยงการเปลี่ยน authorization rule ที่ถูกต้องอยู่แล้ว

---

### Prompt 6 — Issue 4: Ticket Workflow

```text

You are implementing Issue 4 of Lab 4 (BACKEND + FRONTEND) in the TokTickIT repo: final Ticket status workflow, resolution gate, and stale-update handling. Issues 2 (Actions Taken API) and 3 (Actions Taken UI) are merged.

SOURCE OF TRUTH - read first and follow exactly; do not re-derive or change rules:
- docs/lab-04/specification.md: section 5.2 (BR-13..BR-19 and the transition matrix), section 5.3 (BR-20..BR-24), FR-07..FR-12, AC-12..AC-15, AC-21, decisions D-05, D-06, D-12, D-13, D-15, D-17
- docs/lab-04/api-spec.md: section 1.1, section 2.1, section 4 (all), section 7
- docs/lab-04/ui-spec.md: section 5 (all), section 7
- docs/lab-04/tests.md: UNIT-01..UNIT-03, WF-01..WF-13, UI-11..UI-17, and the status/owner/priority rows of AUTH-01 and AUTH-02

SCOPE - IN (backend):
B1. Keep STATUS_TRANSITIONS and isValidStatusTransition in server/src/server.ts exactly as they are (exported, unchanged behavior). Add NEW pure functions in a new file under server/src/lab-04/: getAllowedTransitions(from) and evaluateResolutionGate({ total, openFollowUps }) returning pass or { reason: 'NO_ACTIONS_TAKEN' | 'OPEN_FOLLOW_UPS', openFollowUps }.
B2. PATCH /api/staff/tickets/:id/status: keep the route and the existing check order for id/404/status value, then add, per api-spec 4.1: optional expectedVersion (positive integer, else 400 VALIDATION_ERROR) -> 409 VERSION_CONFLICT with details.currentVersion -> 409 INVALID_STATUS_TRANSITION -> 409 RESOLUTION_BLOCKED (only for target Resolved; details.reason and details.openFollowUps). Implement the logic in a new service file under server/src/lab-04/ and make the route handler delegate to it. Do all checks and the write inside ONE prisma.$transaction that locks the Ticket row (reuse the row-lock helper written in Issue 2; do not write a second one), re-reading status and version after the lock. The gate counts Actions inside the same transaction (total, and open follow-ups = followUpRequired true and followUpCompletedAt null). The final write is a conditional update on version. Side effects: version +1; to Resolved sets resolvedAt = now; to Reopened clears resolvedAt and sets requesterMarkedResolved = false; Resolved -> Closed keeps resolvedAt. Cancelling is never gated.
B3. PATCH /api/staff/tickets/:id/owner and /priority: keep Lab 3 validation and responses; add optional expectedVersion (409 VERSION_CONFLICT when stale) and version +1 on success. Keep the Lab 3 rule that ownerId must be an active IT Staff/Administrator.
B4. Requester mark-resolved (POST /api/tickets/:id/mark-resolved): keep the Lab 3 contract exactly (including 409 TICKET_ALREADY_CLOSED for Closed/Cancelled and never changing status); add version +1 on success. Locate the handler with Select-String first.
B5. Ticket JSON: every ticket object returned must include version and resolvedAt (api-spec 2.1). First check with Select-String how responses are built (include vs select); with include, scalar fields may already be present - verify, do not assume. Staff-scoped ticket objects (everything under /api/staff/tickets*, including PATCH responses and the queue) also include allowedTransitions computed with getAllowedTransitions(ticket.status). allowedTransitions must be structurally ABSENT from every Requester-scoped response, and internalNotes must stay absent from Requester responses.
B6. statusGroup (additive, D-17): GET /api/tickets and GET /api/staff/tickets accept statusGroup=active (statuses New, Open, In Progress, Waiting for Requester, Reopened), combined with other filters by AND. Unknown value, or statusGroup together with status -> 400 INVALID_QUERY_PARAMETER. Existing query behavior stays unchanged.
B7. Do not use Promise.all around multiple multi-relation include queries (Prisma + adapter-pg lesson). Use the existing errorResponse helper and the existing { error: { code, message, details? } } envelope; no stack traces or SQL in responses.

SCOPE - IN (frontend):
F1. Staff Ticket Detail: locate the existing status control (client/src/pages/StaffTicketDetail.tsx or its child) and adapt it, do not rebuild the page. Options come ONLY from ticket.allowedTransitions returned by the API; remove any client-side copy of the transition matrix used for rendering options (Select-String for the status names to find it). If allowedTransitions is empty (Cancelled): show "No further status changes are possible."
F2. Confirmation dialog per (from -> to) pair: required for any -> Cancelled, any -> Resolved, Resolved -> Closed, and any -> Reopened; NOT for New -> Open, Open -> In Progress, In Progress <-> Waiting for Requester. The dialog text names both statuses. Accessibility per ui-spec section 5: role="dialog", aria-modal="true", labelled by its title, focus moves inside and is trapped, Esc and Cancel close it, focus returns to the element that opened it, confirm button has a clear verb. Reuse the existing dialog component if one exists.
F3. Resolution guidance: use the Actions summary { total, openFollowUps } that the Issue 3 Actions Taken panel already fetches (lift it up with a callback or shared state; do not add a second source of truth, and keep it updated after every Action create/edit/follow-up change). When Resolved is selected and total is 0 or openFollowUps > 0: disable "Update status" and show helper text linked with aria-describedby ("Record at least one action before resolving." / "Complete {n} open follow-up(s) before resolving."). The backend stays the authority.
F4. Versioning: keep ticket.version in React state from the last fetch/response and send it as expectedVersion on status, owner, and priority PATCH requests. After every successful PATCH replace the ticket in state from the response (status, version, resolvedAt, owner, itPriority, allowedTransitions) so a later action does not use a stale version.
F5. Errors, per ui-spec section 5: 409 RESOLUTION_BLOCKED -> inline role="alert" message with the same texts as F3, page state kept; 409 INVALID_STATUS_TRANSITION -> "That status change is no longer allowed. The ticket may have changed - reloaded."; 409 VERSION_CONFLICT -> "This ticket was updated by someone else. Reloaded the latest version."; for the last two re-fetch ticket and actions through a useEffect that reacts to a state value (for example a reload counter). Never fetch directly after setState inside a handler. Network/500 -> safe message, nothing lost.
F6. Success: the Ticket summary (status badge, resolvedAt where shown, allowedTransitions, owner, version) refreshes from the response; announce "Status changed to {status}." in a role="status" live region; the Issue 3 Actions panel must receive the new ticket status so it locks (Resolved/Closed/Cancelled) or unlocks (Reopened) immediately.
F7. Show a badge "Requester reports resolved" (text + icon, not colour-only) to staff when requesterMarkedResolved is true. It must not enable or disable any control.
F8. Requester Ticket Detail: keep "Problem Appears Resolved" behavior (advisory, hidden for Closed/Cancelled); the Requester UI never uses allowedTransitions.

SCOPE - OUT (do NOT do): Prisma schema or migrations; changes to the Actions Taken API; dashboards, /api/health, navigation or route changes, App.tsx; new npm dependencies; vitest.config.ts; docs/.

METHOD (TDD):
a. Write failing tests first. Server (server/tests/lab-04/): status-transitions.unit.test.ts (UNIT-01 all 64 pairs: exactly 15 true; UNIT-02 getAllowedTransitions), resolution-gate.unit.test.ts (UNIT-03), ticket-workflow.api.test.ts (WF-01..WF-13), plus the status/owner/priority rows in authorization-matrix.api.test.ts (AUTH-01, AUTH-02). Client (client/src/lab-04/__tests__/ or the existing Lab 4 test folder): TicketWorkflow.test.tsx (UI-11..UI-17).
b. Implement until green.
c. Test hygiene (hard rules): each test creates its own fixtures with a unique prefix and cleans up with scoped deletes; NEVER unscoped updateMany/deleteMany; restore any shared seed user you mutate. WF-08 and WF-09 (concurrency) use Promise.all of simultaneous requests and assert the invariant: never Resolved with an open follow-up, and exactly one 200 for two status changes with the same expectedVersion. In jsdom the table and cards both exist in the DOM: use within(), role queries, and getAllByRole(...)[0] where duplication is legitimate.
d. EXISTING TESTS: do not edit any existing test file. If an existing server or client test fails (for example a toEqual on a ticket object that now has extra fields, or a Lab 3 client test that depends on a client-side matrix), STOP and report the raw failure with the test name and line instead of changing it. Never weaken an expect(...).

STOP CONDITIONS - stop and report (do not guess) if: the spec conflicts with the real code; the existing status UI cannot be adapted without a large refactor; an existing test breaks; or tests time out because the machine is loaded (report it, do not change timeouts or config).

DELIVERABLE EVIDENCE (raw output, write to $env:TEMP then print):
1. git status and git diff --stat
2. cd server; npm test (3 consecutive runs), npm run build
3. cd client; npm test, npm run build
4. Select-String proofs: (a) STATUS_TRANSITIONS/isValidStatusTransition unchanged in server.ts (git diff on those lines is empty); (b) the client no longer contains a hard-coded transition matrix in non-test files; (c) allowedTransitions never appears in a Requester-scoped response path; (d) no unscoped deleteMany/updateMany and no localStorage/sessionStorage in new files; (e) the status handler delegates to the new service and the transaction contains the lock, gate and conditional update.
5. For WF-08 and WF-09: print the test code and the passing result.
Do NOT commit; leave changes in the working tree.
```

**Reflection:**
ใช้ AI พัฒนา workflow การเปลี่ยนสถานะ Ticket, resolution gate และ stale-update handling พร้อมกำหนดให้ทดสอบก่อน implement และรักษา test เดิมไว้ ช่วยให้การเปลี่ยนสถานะมีเงื่อนไขชัดเจนและลดความเสี่ยงจากการแก้ไขข้อมูลทับกัน

---

### Prompt 7 — Issue 4: Existing Test Fixture Migration and Guard

```text

CONTEXT
Branch: feature/lab4-4-ticket-workflow (Lab 4 Issue 4). Two existing Lab 3 tests fail in client/src/tests/lab-03/StaffTicketDetail.test.tsx:
- "UI-04: renders ticket details, unassigned ownership pill, claim action, and priority/status controls" (fails at line 88: screen.getByLabelText(/status/i))
- "UI-04: allows claiming a ticket and updating priority and status" (fails at line 166, same query)
The UI renders "No further status changes are possible." instead of the status select. Hypothesis: the Lab 3 fixtures do not include allowedTransitions, which Issue 4 now requires (spec D-15, F1, api-spec 2.1). This is an intentional contract change, handled under our rule "migrate setup only, never weaken expect(...)". You are now given LIMITED permission to edit this ONE test file, as defined below.

HARD RULES
- Do NOT reintroduce a hard-coded transition matrix in any non-test file. Do not import STATUS_TRANSITIONS or any production matrix into tests; write literal arrays in fixtures.
- Do NOT delete or rename any test, remove or loosen any expect(...) (no toBeTruthy replacements, no removed assertions, no skipped tests).
- Do NOT change vitest.config.ts, timeouts, server code, docs, or any other existing test file. If another existing test fails, STOP and report it.
- No @ts-ignore, as any, as unknown, non-null assertions.
- Do not commit. Leave changes in the working tree.

PHASE 1 - REPORT (read-only; print before editing)
1. Show client/src/tests/lab-03/StaffTicketDetail.test.tsx lines 1-200 (fixtures, helpers, the two failing tests).
2. Show the status control code in client/src/pages/StaffTicketDetail.tsx (or its child) as it is now, and git diff lab4-staging for that area.
3. Show how the Lab 3 version of the status control behaved (git show lab4-staging:client/src/pages/StaffTicketDetail.tsx for the status part): did selecting an option send the PATCH immediately, or was there a button? Does the Issue 4 UI now require "Update status" and/or a confirmation dialog for the pairs used by these tests (Open -> In Progress)?
4. Confirm the root cause: print the fixture ticket object and state whether allowedTransitions, version and resolvedAt are present.
5. List every other test file under client/src/tests that builds a staff-scoped ticket fixture and could be affected (Select-String for "itPriority" and "owner" in client/src/tests), without editing them.

PHASE 2 - PRODUCTION GUARD (test first)
In the Issue 4 status control: distinguish "missing" from "empty". If allowedTransitions is not an array, show a safe-failure message ("Status options are unavailable. Please reload.") with a reload action; do NOT show "No further status changes are possible." in that case. If it is an empty array, show "No further status changes are possible." Write the failing test first in TicketWorkflow.test.tsx (new test; do not edit existing ones), then the minimal fix.

PHASE 3 - FIXTURE MIGRATION (only this file, only these categories)
Allowed edits in StaffTicketDetail.test.tsx:
 (a) add allowedTransitions, version and resolvedAt to the staff ticket fixtures and to mocked PATCH responses, matching docs/lab-04/api-spec.md 2.1 and the matrix in docs/lab-04/specification.md BR-13 (for example Open -> ["In Progress","Cancelled"]; after a successful change to In Progress, the response carries version +1 and allowedTransitions ["Waiting for Requester","Resolved","Cancelled"]);
 (b) adjust interaction steps ONLY where the Issue 4 UI intentionally changed them (for example clicking "Update status" after selecting an option; confirm dialog only for the pairs listed in ui-spec section 5);
 (c) where a request body assertion now fails ONLY because the UI sends expectedVersion (owner, priority, status), update the expected body to include the expectedVersion from the fixture.
Every outcome assertion (status shown, owner shown, priority shown, request made) must remain at least as strict as before. After the first failure is fixed, later lines in the same tests may fail; handle each by the same three categories or STOP and report if it fits none.

VERIFICATION (raw output to $env:TEMP then print)
1. cd client; npx vitest run src/tests/lab-03/StaffTicketDetail.test.tsx
2. cd client; npm test (full suite; if worker timeouts appear, report them, do not change config). Report test counts before/after: baseline client = 99 tests, count must not decrease.
3. cd client; npm run build
4. cd server; npm test (once) and npm run build (no server changes expected)
5. git status; git diff --stat; git diff for the test file
6. Select-String proof: the test file diff contains no removed "expect(" line without an equal or stricter replacement; no skip/only; no new import of production transition constants.
7. A one-paragraph classification for the PR (bug / test migration / spec decision / retired test) per changed hunk.
```

**Reflection:**
ใช้ AI ตรวจปัญหา test เดิมที่ได้รับผลจาก workflow ใหม่ โดยให้ตรวจ fixture และพฤติกรรมเดิมก่อน จากนั้นอนุญาตให้แก้เฉพาะจุดที่ระบุ และห้ามลบหรือทำให้ assertions อ่อนลง ช่วยให้ปรับ test ให้เข้ากับ contract ใหม่โดยยังรักษาความหมายของการทดสอบ

---

### Prompt 8 — Issue 5: Dashboards and Navigation

```text

You are implementing Issue 5 of Lab 4 (BACKEND + FRONTEND) in the TokTickIT repo: role dashboards, drill-down, navigation, and health. Issues 2, 3 and 4 are merged (ActionTaken API, Actions UI, workflow with version/resolvedAt/statusGroup).

SOURCE OF TRUTH - read first and follow exactly; do not re-derive or change rules:
- docs/lab-04/specification.md: section 5.4 (BR-25..BR-33 and the metric definition table), FR-13..FR-16, FR-18, FR-20, FR-22, AC-02, AC-16..AC-19, AC-22, AC-27, decisions D-08, D-10, D-16, D-17, D-18
- docs/lab-04/api-spec.md: section 5 (all), section 6, section 7
- docs/lab-04/ui-spec.md: section 2 (navigation and routes), section 3 (dashboards), section 7, section 8
- docs/lab-04/tests.md: UNIT-05, RD-01..RD-06, SD-01..SD-07, HEALTH-01..HEALTH-03, PERF-01, PERF-02, UI-18..UI-20, UI-22, UI-23, UI-25, UI-26, dashboard/health rows of AUTH-01

=== PART A - BACKEND ===
A1. New files under server/src/lab-04/ (dashboard helpers, service, route handlers). Touch server/src/server.ts only to register routes.
A2. GET /api/dashboard/requester: role REQUESTER only (own route gate; staff/admin get 403 FORBIDDEN; anonymous 401). No parameters; scope is the session user only. Response exactly as api-spec 5.1 (generatedAt, windowDays 7, metrics openTickets/waitingForRequester/resolved with label, value and drilldown, needsAttention, recentlyUpdated, recentlyResolved). Definitions per the spec table: openTickets = own tickets with status in the Active set (New, Open, In Progress, Waiting for Requester, Reopened); waitingForRequester = status Waiting for Requester; resolved = status Resolved (no time window); needsAttention = own Waiting for Requester, updatedAt desc then id desc, max 5; recentlyUpdated = own tickets any status, updatedAt desc then id desc, max 5; recentlyResolved = own Resolved with resolvedAt >= now - 7 days, resolvedAt desc then id desc, max 5. Summary item shapes per api-spec 2.3 (requester items: id, ticketNumber, summary, status, updatedAt; recentlyResolved also resolvedAt).
A3. GET /api/dashboard/staff: roles IT_STAFF and ADMINISTRATOR (own route gate; requester 403). Response exactly as api-spec 5.2: metrics unassigned (ownerId null and Active), myOwned (ownerId = session user and Active), myOpenFollowUps (Actions with performedById = me, followUpRequired true, followUpCompletedAt null; drilldown null); byStatus: ALWAYS all 8 statuses in the order New, Open, In Progress, Waiting for Requester, Resolved, Closed, Reopened, Cancelled, zeros included, over all tickets; byPriority: Low, Medium, High, Urgent, Unset over Active tickets (itPriority NULL counts as Unset, drilldown null for Unset); recentTickets (max 5, updatedAt desc then id desc, with itPriority, owner and requesterMarkedResolved); myRecentActions (max 5, createdAt desc then id desc, with ticketId, ticketNumber, description truncated to 120 characters, followUpRequired, followUpOpen, createdAt); users { activeRequesters, activeItStaff, activeAdministrators, inactive } present ONLY for ADMINISTRATOR and structurally absent (not null) for IT_STAFF.
A4. Drilldown objects exactly as the spec table: { path, query }. Requester: path "/" with query statusGroup=active, or status=Waiting for Requester, or status=Resolved. Staff: path "/staff/tickets" with ownerId=unassigned&statusGroup=active, ownerId=<session user id as string>&statusGroup=active, status=<s>, itPriority=<p>&statusGroup=active; users drilldown path "/admin/users". BR-30: a count must equal the totalItems of its destination list; the numbers must be computed with the same filters.
A5. Empty behavior: counts 0 and lists [] (never null). Timestamps ISO UTC. "Recent" = rolling 7x24 hours from request time. Dashboard queries read the database at request time; no caching. Accept no user identifier parameter anywhere.
A6. GET /api/health (public, no auth, no CSRF): 200 { status: "ok", database: "up", time } when a trivial query (prisma.$queryRaw SELECT 1) succeeds; 503 { status: "degraded", database: "down" } when it fails. No connection strings, versions, stack traces or paths. First check with Select-String whether a /api/health route already exists; if it exists with a different shape used by existing tests, STOP and report.
A7. Queries: use simple count/groupBy/findMany with a select of only the needed fields. Run them sequentially, or Promise.all only for plain count queries without include (Prisma + adapter-pg lesson). Errors return the safe 500 INTERNAL_ERROR envelope through the existing errorResponse helper.
A8. Tests first (server/tests/lab-04/): dashboard-helpers.unit.test.ts (UNIT-05: Active set, 7-day boundary, Unset bucket), requester-dashboard.api.test.ts (RD-01..RD-06), staff-dashboard.api.test.ts (SD-01..SD-07), health.api.test.ts (HEALTH-01..HEALTH-03; for HEALTH-02 simulate a DB failure with a mock/spy, never by stopping the real DB), performance-smoke.api.test.ts (PERF-01 both dashboards under 500 ms after one warm-up call on the seed; PERF-02 listing 200 Actions on one ticket under 500 ms), and the dashboard/health rows of authorization-matrix.api.test.ts (AUTH-01). RD-01/SD-01 compare every metric to an independent direct Prisma query on the test's own fixtures. RD-05/SD-06 follow every drilldown against GET /api/tickets and GET /api/staff/tickets and assert totalItems equals the card value. Fixtures: own prefix, scoped cleanup only, never unscoped updateMany/deleteMany, restore any shared seed user you mutate; make assertions robust against other fixtures by scoping to your own created users where the metric is global (for global staff metrics, assert deltas against a baseline measured before creating fixtures).

=== PART B - FRONTEND === (run only after PART A tests and server build pass)
B1. New files under client/src/lab-04/ (for example dashboard/RequesterDashboard.tsx, StaffDashboard.tsx, dashboardApi.ts, shared MetricCard and ListPanel). Reuse the existing fetch pattern (credentials same-origin) and the Asia/Bangkok time helper from Issue 3. Tokens only from ui-spec section 1; no off-palette hex values.
B2. Dashboards per ui-spec section 3: heading "Welcome back, {name}", Refresh button (announces "Dashboard updated" in a polite live region), metric cards (label, value, drill-down link with an accessible name such as "View My Open Tickets (3)"; cards with drilldown null are NOT links), Requester panels (Needs your attention, Recently updated, Recently resolved) and quick actions, Staff cards, By status grid (8 tiles with counts), By IT Priority grid (Unset not a link), Recent tickets (with "Requester reports resolved" badge, text + icon), My recent actions (follow-up state as text: Not required / Follow-up open / Follow-up done), Administrator-only Users card rendered only when the response contains users. Rows link to /tickets/:id (Requester) or /staff/tickets/:id (staff). Layout: desktop >= 992px multi-column; tablet 768-991px 2 cards per row; mobile < 768px single column; no horizontal page scroll.
B3. States per ui-spec section 3.4: loading skeleton in a role="status" container with "Loading dashboard..." and no layout jump; empty ("No tickets to show yet." for Requester, "Nothing to show yet." for staff, with a relevant link); forbidden (403) "You do not have access to this dashboard." with a link to the user's own home; 401 keeps the existing return-to-login behavior; safe failure role="alert" "We couldn't load the dashboard. Please try again." with a Retry button, no technical details; after a failed refresh keep the previous data with a "may be out of date" note.
B3b. Fetch in a useEffect (reload counter for Refresh/Retry); never fetch directly after setState in a handler.
B4. App.tsx (targeted additions only; do not restructure): (1) add route /dashboard rendering RequesterDashboard for REQUESTER and StaffDashboard for IT_STAFF/ADMINISTRATOR; (2) add a "Dashboard" nav entry as the FIRST entry for every role with aria-current="page" plus a visible non-colour cue; Requester nav: Dashboard, My Tickets, Create Ticket; IT Staff: Dashboard, Ticket Queue; Administrator: Dashboard, Ticket Queue, User Management; (3) after a successful login navigate to /dashboard; (4) IT_STAFF and ADMINISTRATOR visiting "/" are redirected (replace) to /dashboard; REQUESTER keeps "/" as My Tickets; (5) detail routes keep their parent entry active (/tickets/:id -> My Tickets, /staff/tickets/:id -> Ticket Queue) via a small isActive helper; (6) cleanup in AppShell only: one guard for user instead of the repeated user && / user.role checks, a single role badge, header wraps on narrow screens without horizontal scrolling.
B5. IMPORTANT query-string pitfall: App.tsx currently stores the route as window.location.pathname and matches with equality (for example route === '/staff/tickets'). A drill-down URL contains a query string, so navigate() must split path and query: keep route as pathname only, push the full URL with history.pushState, and read window.location.search separately (also on popstate). Do not break existing route matching.
B6. Drill-down consumption: My Tickets and the Staff Ticket Queue read status, statusGroup, ownerId and itPriority from window.location.search on load and apply them as initial filters, shown as visible removable filter chips (for example "Active tickets", "Unassigned", "Owner: me", "Priority: Urgent"). statusGroup and status are mutually exclusive: never send both (the API returns 400); picking a status clears statusGroup and vice versa. Invalid values are ignored (no filter). Pass statusGroup to GET /api/tickets and GET /api/staff/tickets. Make the smallest changes to these two pages; keep every existing filter/sort/pagination behavior.
B7. Tests first (client/src/lab-04/__tests__/ or the existing Lab 4 test folder): StaffDashboard.test.tsx (UI-18..UI-20), RequesterDashboard.test.tsx (UI-22, UI-23), AppNavigation.test.tsx (UI-25 entries per role with aria-current and parent-active on detail routes; UI-26 redirect of "/" for staff, query string read by My Tickets and Ticket Queue, status/statusGroup exclusivity). Extend the style tests for the new screens (status/priority/follow-up not colour-only, no console.error or console.warn during render). In jsdom both table and cards exist: use within(), role queries, getAllByRole(...)[0] where duplication is legitimate.

SCOPE - OUT (do NOT do): Prisma schema or migrations; changes to Actions Taken or workflow behavior; Playwright/E2E specs, responsive specs, README updates and screenshots (the final integration pass handles them); new npm dependencies; vitest.config.ts; docs/.

HARD RULES: Do not edit existing test files or weaken any expect(...). If an existing test fails because of the new navigation/landing behavior (for example an App test that expects the Ticket Queue or My Tickets right after login), STOP and report the raw failure with test name and line; do not change it. No @ts-ignore, as any, as unknown or non-null assertions. No localStorage/sessionStorage. Dev-only passwords stay where they are. If tests time out because the machine is loaded, report it; do not change timeouts or config.

STOP CONDITIONS - stop and report (do not guess) if: the spec conflicts with the real schema or code; /api/health already exists with a different shape; an existing test breaks; or a drill-down cannot produce the same count as its card with the existing list endpoints.

DELIVERABLE EVIDENCE (raw output, write to $env:TEMP then print):
1. git status and git diff --stat
2. cd server; npm test (3 consecutive runs), npm run build
3. cd client; npm test, npm run build
4. Select-String proofs: (a) dashboard routes have their own role gates and no router-wide gate; (b) no request parameter or body is used to choose the user in dashboard code; (c) users appears only inside the ADMINISTRATOR branch; (d) no unscoped deleteMany/updateMany in new tests; (e) navigate() no longer puts a query string into the route used for matching; (f) status and statusGroup are never sent together.
5. For RD-05 and SD-06: print the code and the passing results.
Do NOT commit; leave changes in the working tree.
```

**Reflection:**
ใช้ AI พัฒนา Dashboard แยกตาม role พร้อม drill-down, navigation และ health endpoint โดยระบุ metric, filter, response shape และ test ที่ต้องผ่านอย่างละเอียด ทำให้การพัฒนาครอบคลุมทั้ง Backend และ Frontend และเชื่อมโยงผลบน Dashboard กับหน้ารายการจริง

---

### Prompt 9 — Issue 5: Read-only Investigation of Flaky Tests

```text

CONTEXT
Branch: feature/lab4-5-dashboards (Lab 4 Issue 5), changes uncommitted. Server tests are unstable: 3 consecutive full runs gave 4, 14, 17 failures (passes 215, 205, 202). Failures include a workflow stale-version test, PERF-01/PERF-02 (500 ms threshold) and some existing Lab 3 tests (timeouts). Client builds pass; client tests pass with a single worker (130/130). Goal: find the root cause with evidence. THIS IS A READ-ONLY INVESTIGATION.

HARD RULES
- Do NOT modify, create or delete any file. Do not run git add/commit/stash/reset/checkout/clean. Do not touch vitest.config.ts. Do not raise timeouts, and do not relax the 500 ms threshold.
- Run commands only against the TEST database (server/.env.test -> toktickit_test). First print the DATABASE_URL host/dbname (mask the password) used by the tests and by `dotenv/config` scripts, and confirm they differ.
- Do not run the full suite more than the 3 runs requested below.
- Report raw output. Separate verified facts from hypotheses. Do not claim a root cause without evidence.

STEPS
1. DB state snapshot BEFORE any run: counts of tickets, users, action_taken, sessions (find the real table names with \dt or information_schema), and the list of users (email, role, isActive). Save to $env:TEMP\db_0.txt.
2. Run the full server suite 3 times in a row, WITHOUT cleaning the DB between runs, each with: npx vitest run --reporter=default --reporter=json --outputFile=$env:TEMP\sN.json *> $env:TEMP\sN.txt . After each run take the same DB snapshot (db_1, db_2, db_3).
3. From the three JSON files build a table: test name | file | failed in run 1/2/3 | message type (assertion vs timeout vs other) | duration. Classify each failing test as DETERMINISTIC, ACCUMULATING (fails only in later runs), or FLAKY. Diff the DB snapshots: which table grew, and what do the extra rows look like (email/summary patterns)? Identify which test file creates them (Select-String for the pattern in server/tests).
4. For every test file that creates or mutates data, check: unique prefix cleanup, scoped delete only, restoration of shared seed users, and any unscoped updateMany/deleteMany or findFirst without ordering/own-fixture filter. List violations with file:line.
5. Dashboard safety: Select-String server/src/lab-04 dashboard and health files for update/create/upsert/delete/executeRaw/$transaction (dashboard must be read-only). Print `git diff --stat` for server/src files other than dashboard/health to show whether Issue 5 touched workflow, ticket, or Action code.
6. Stale-version failure: print the failing test code and the exact failure message. State whether it is an assertion or a timeout/lock wait, whether it uses its own ticket fixture or a shared/seed ticket, and where it reads the version it sends. Run that test file alone 3 times and report.
7. Global-metric race check: for staff-dashboard.api.test.ts, list every assertion that compares a GLOBAL metric (unassigned, byStatus, byPriority, recentTickets, users) to a database count, and say how it protects itself from tickets/users created by other test files running in parallel.
8. PERF: print the code of performance-smoke.api.test.ts. State what is inside the timed section (is fixture creation of 200 Actions excluded? is there a warm-up?). Run the file alone 3 times and print each measured duration; also print the durations observed in the full-suite runs. Then run EXPLAIN (ANALYZE, BUFFERS) for the main dashboard queries on the current test DB data (or report the Prisma queries and count queries per request).
9. Baseline: report whether a clone/worktree of the commit before Issue 5 can be run. If one exists outside OneDrive, run the server suite 3 times there and report failures; otherwise just say so (do not create files in the repo to do this).
10. Machine: report free RAM, node processes, and whether OneDrive sync is active for the repo path.

FINAL REPORT
- Table of failing tests with classification.
- DB growth table across runs.
- Ranked root-cause hypotheses with the evidence for and against each (data pollution, global-metric race, pool/lock contention, PERF measurement, real Issue 5 regression, machine load).
- Recommended minimal fixes, each labelled: bug / test isolation fix / measurement fix / config change (needs a separate chore PR) / not Issue 5's problem. Do not apply them.
```

**Reflection:**
ใช้ AI ตรวจสอบความไม่เสถียรของ Server tests โดยกำหนดให้เป็น read-only และใช้เฉพาะ test database พร้อมเก็บ snapshot ก่อนและหลังการรัน ช่วยให้หาสาเหตุจากหลักฐาน เช่น ข้อมูลสะสม การทำงานพร้อมกัน หรือ performance ได้ โดยไม่รีบแก้ config หรือเปลี่ยนเกณฑ์ทดสอบ

---

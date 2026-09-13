# Lab 3 Test Specification

## 1. Test Strategy

Lab 3 adds authentication/authorization, IT Staff workflows, and Administrator user management on top of the Lab 2 Requester baseline. Layers:

- **Unit tests**: password rule validation, status-transition matrix logic, query-parameter parsing for the Staff Queue, comment/note length trimming.
- **API tests**: Supertest against the server with an isolated database, covering auth, authorization, staff ticket operations, comments/notes, and admin user management — status codes, response shapes, and every safe-error case.
- **UI component tests**: Login, Change Password, Staff Ticket Queue, Staff Ticket Detail, User Management, and the extended Requester Ticket Detail — form behavior, state retention, role-conditional rendering, focus, and accessible names.
- **UI style tests**: Zen Green tokens on new screens, role/ownership badges, and the Public-Comments-vs-Internal-Notes visual separation.
- **Responsive tests**: desktop/tablet/mobile for the Staff Queue and User Management screens.
- **Security/authorization tests**: every protected endpoint checked against all three roles, including direct-API attempts that bypass the UI.
- **Migration/regression tests**: every Lab 2 Requester test re-run against the authenticated flow to confirm no capability or data was lost.
- **E2E tests**: full authentication lifecycle, the IT Staff ticket workflow, and the Administrator user-management workflow in a browser.

Fixtures use the seed data defined in `specification.md` Section 7.7 (≥4 active + 1 inactive Requester, ≥3 active + 1 inactive IT Staff, ≥1 active Administrator) plus a temporary second Administrator fixture where a test must deactivate/role-change an Administrator without violating BR-20 on the seed data itself.

## 2. Planned Tests

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final Status |
|---|---|---|---|---|---|---|
| API-01 | API | FR-01, AC-01 | Valid login | `200`; session cookie set; correct user/role shape returned | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-02 | API | BR-06, AC-06 | Invalid credentials (unknown email / wrong password) | `401 INVALID_CREDENTIALS`, identical response for both cases | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-03 | API | BR-07, AC-05 | Login against an inactive account | `403 ACCOUNT_INACTIVE`, no session established | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-04 | API | BR-02, AC-02 | `mustChangePassword` blocks other authenticated endpoints | Any non-auth endpoint returns a blocking response until password is changed | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-05 | API | BR-02 | Change password: success, mismatch, same-as-current, wrong current password | Success clears `mustChangePassword`; each invalid case returns its documented `400`/`401` code | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-06 | API | BR-08, AC-07 | Logout revokes session | `204`; a subsequent request with the old cookie returns `401 UNAUTHENTICATED` | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-07 | API | BR-10 | Current-user endpoint shape and unauthenticated case | `200` with safe fields only (no `passwordHash`); `401` when no session | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-08 | API | AC-08 | Requester calls Staff/Admin endpoints directly | Every Staff and Admin endpoint returns `403 FORBIDDEN` for a Requester session | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| API-09 | API | BR-03, AC-03 | Client-supplied `requesterId` is ignored | Ticket create/list uses session identity regardless of a spoofed body/query `requesterId` | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| API-10 | API | BR-04, AC-04 | Requester requests Internal Notes endpoints | `403 FORBIDDEN`; response contains no note content | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| API-11 | API | BR-04, AC-15 | Requester-scoped Ticket Detail/comments payload | Response never contains an `internalNotes`/`notes` field, even empty | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| API-12 | API | AC-08 | IT Staff calls Administrator endpoints directly | Every `/api/admin/*` endpoint returns `403 FORBIDDEN` for an IT Staff session | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| API-13 | API | FR-09 | Staff Queue search/filter/sort/pagination | Correct result set and pagination metadata for each parameter combination, including `ownerId=unassigned` | `server/tests/lab-03/staff-queue.api.test.ts` | Planned |
| API-14 | API | FR-09 | Staff Queue invalid query parameters | `400 INVALID_QUERY_PARAMETER` for unknown params, bad page/pageSize, unsupported enum values | `server/tests/lab-03/staff-queue.api.test.ts` | Planned |
| API-15 | API | AC-08 | Staff Queue role gate | `403` for Requester; `200` for IT Staff and Administrator | `server/tests/lab-03/staff-queue.api.test.ts` | Planned |
| API-16 | API | BR-11, AC-09 | Claim an unassigned ticket | `ownerId` set to the claiming IT Staff/Admin; reflected on re-fetch | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-17 | API | BR-11, AC-10 | Reassign an owned ticket; invalid `ownerId` | Reassignment succeeds to another active IT Staff/Admin; inactive/Requester target returns `400 VALIDATION_ERROR` | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-18 | API | BR-12, AC-11 | Update IT Priority | `itPriority` changes; `requestedPriority` unchanged; unsupported value returns `400` | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-19 | API | BR-13, AC-12 | Status transition matrix enforcement | Every permitted transition succeeds; every non-listed transition returns `409 INVALID_STATUS_TRANSITION` with status unchanged | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-20 | API | FR-09 | Staff ticket detail retrieval is not ownership-scoped | Any active IT Staff/Admin can retrieve any ticket by ID; nonexistent ID returns `404 TICKET_NOT_FOUND` | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-21 | API | BR-14, AC-14 | Empty/whitespace/oversize Public Comment and Internal Note | `400 VALIDATION_ERROR` for empty, whitespace-only, and >2000-character content on both entities | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| API-22 | API | BR-04 | Public Comment create/retrieve visibility | Requester (own ticket), IT Staff, and Administrator can all create/read; author and timestamp are backend-assigned | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| API-23 | API | BR-04, AC-04 | Internal Note create/retrieve visibility | IT Staff/Admin succeed; Requester attempt returns `403` with no content leak | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| API-24 | API | BR-05, BR-15, AC-13 | Mark-resolved action | Sets `requesterMarkedResolved=true` without changing `status`; blocked with `409` when status is `Closed`/`Cancelled`; only the owning Requester may call it | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| API-25 | API | FR-13 | Admin user list search/role filter | Correct filtered results; non-Administrator returns `403` | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-26 | API | BR-09, BR-16, AC-16 | Create user, including duplicate email | Valid create returns `201` with `mustChangePassword:true`; case-insensitive duplicate email returns `409 EMAIL_ALREADY_IN_USE` | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-27 | API | BR-17 | Edit user name/email/role/active state | Fields update correctly; invalid role/email returns `400`; password field in the edit body is ignored, never applied | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-28 | API | BR-18, AC-17 | Set new initial password | `mustChangePassword` becomes `true`; target user's existing sessions are revoked | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-29 | API | BR-19, AC-19 | Self-deactivation attempt | `409 CANNOT_DEACTIVATE_SELF` when an Administrator edits their own account with `isActive:false` | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-30 | API | BR-20, AC-18 | Last active Administrator protection | `409 LAST_ACTIVE_ADMIN` when deactivating or role-changing the sole active Administrator; succeeds once a second active Administrator exists | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| MIG-01 | Migration/Regression | BR-22, BR-23, AC-20 | Lab 2 data and Requester capability survive migration | Every pre-existing Ticket/Attachment is reachable and correctly owned by its migrated Requester; all Lab 2 create/list/detail/attachment tests pass using session auth instead of `X-Requester-Id` | `server/tests/lab-02/*.test.ts` (updated) + `server/tests/lab-03/authorization.api.test.ts` | Planned |
| UI-01 | UI component | AC-01, AC-06, BR-07 | Login form states | Validation, busy state, and visually distinct Invalid-Credentials vs. Inactive-Account banners render correctly | `client/src/tests/lab-03/Login.test.tsx` | Planned |
| UI-02 | UI component | AC-02, BR-02 | Change Password mandatory flow | Screen blocks other navigation until saved; mismatch/same-as-current inline errors; success continues automatically into the app | `client/src/tests/lab-03/ChangePassword.test.tsx` | Planned |
| UI-03 | UI component | FR-09 | Staff Queue controls and result states | Search, filters (incl. Unassigned), sort, pagination, loading/empty/no-results/forbidden/failure states render and behave correctly | `client/src/tests/lab-03/StaffTicketQueue.test.tsx` | Planned |
| UI-04 | UI component | AC-09, AC-10, AC-11 | Staff Ticket Detail ownership/priority/status controls | Claim/Reassign actions, editable IT Priority, and a status select that disables (not hides) non-permitted transitions with a visible reason | `client/src/tests/lab-03/StaffTicketDetail.test.tsx` | Planned |
| UI-05 | UI component | BR-04 | Public Comments vs. Internal Notes separation | Two visually and structurally distinct threads/composers; posting to one never affects the other | `client/src/tests/lab-03/StaffTicketDetail.test.tsx` | Planned |
| UI-06 | UI component | FR-13, AC-16 | User Management list, search, filter, create/edit | List renders required columns; search/role filter work; duplicate-email shows an inline field error | `client/src/tests/lab-03/UserManagement.test.tsx` | Planned |
| UI-07 | UI component | AC-18, AC-19 | User Management safety-rule feedback | Active toggle disabled with caption on the signed-in Administrator's own row; last-active-Administrator failure banner renders on the blocked action | `client/src/tests/lab-03/UserManagement.test.tsx` | Planned |
| UI-08 | UI component | AC-13, BR-05 | Requester Ticket Detail additions | Public Comments thread and "Problem Appears Resolved" action render and behave correctly; no status/priority edit controls are present for a Requester | `client/src/tests/lab-02/RequesterTicketDetail.test.tsx` (updated) | Planned |
| STYLE-01 | UI style | UI spec Sections 3, 10 | Role and ownership badge tokens | Requester/IT Staff/Administrator role badges and the Unassigned ownership pill use the documented tokens | `client/src/tests/lab-03/StaffTicketQueue.test.tsx` | Planned |
| STYLE-02 | UI style | UI spec Section 7 | Internal Notes panel visual distinction | Warning-tint container, lock icon with accessible name, and separate composer from Public Comments | `client/src/tests/lab-03/StaffTicketDetail.test.tsx` | Planned |
| RESP-01 | Responsive | UI spec Sections 6, 8, 11 | Desktop layout (>=992px) for Staff Queue and User Management | Full table/list layouts render within viewport; no clipping/overlap/horizontal scroll | `client/src/tests/lab-03/StaffTicketQueue.test.tsx`, `UserManagement.test.tsx` | Planned |
| RESP-02 | Responsive | UI spec Sections 6, 8, 11 | Tablet layout (768-991px) | Gutters, wrapping filters, and table/card choice remain readable with no clipping/overlap/horizontal scroll | `client/src/tests/lab-03/StaffTicketQueue.test.tsx`, `UserManagement.test.tsx` | Planned |
| RESP-03 | Responsive | UI spec Sections 6, 8, 11 | Mobile layout (<768px) | Staff Queue and User Management switch to card layouts with all required fields visible; no horizontal scroll | `client/src/tests/lab-03/StaffTicketQueue.test.tsx`, `UserManagement.test.tsx` | Planned |
| A11Y-01 | UI component | UI spec Section 12 | Keyboard/assistive-technology behavior on Login, Change Password, and the Internal Notes composer | Tab/Shift+Tab/Enter reach controls in logical order; focus rings visible; error/live states are programmatically associated | `client/src/tests/lab-03/Login.test.tsx`, `StaffTicketDetail.test.tsx` | Planned |
| E2E-01 | E2E | AC-01, AC-02, AC-05, AC-06, AC-07, AC-08 | Full authentication lifecycle | Valid/invalid/inactive login, mandatory first-login password change, role-correct navigation, logout, and blocked direct access after logout, across all three roles | `e2e/lab-03/authentication.spec.ts` | Planned |
| E2E-02 | E2E | AC-09, AC-10, AC-11, AC-12, AC-13, AC-14, AC-15 | IT Staff ticket workflow | Claim, reassign, set IT Priority, valid/invalid status transitions, post Public Comment and Internal Note, Requester sees only the Public Comment and can mark resolved | `e2e/lab-03/staff-ticket-flow.spec.ts` | Planned |
| E2E-03 | E2E | AC-16, AC-17, AC-18, AC-19 | Administrator user-management workflow | Create user, duplicate-email rejection, edit, set new initial password and confirm forced change at next login, blocked self-deactivation, blocked last-Administrator removal | `e2e/lab-03/user-administration.spec.ts` | Planned |

## 3. Acceptance-Criterion Traceability

| Acceptance Criterion | Covered by Test IDs |
|---|---|
| AC-01 | API-01, UI-01, E2E-01 |
| AC-02 | API-04, API-05, UI-02, E2E-01 |
| AC-03 | API-09 |
| AC-04 | API-10, API-23 |
| AC-05 | API-03, UI-01, E2E-01 |
| AC-06 | API-02, UI-01, E2E-01 |
| AC-07 | API-06, E2E-01 |
| AC-08 | API-08, API-12, API-15, UI-03, UI-06, E2E-01 |
| AC-09 | API-16, UI-04, E2E-02 |
| AC-10 | API-17, UI-04, E2E-02 |
| AC-11 | API-18, UI-04, E2E-02 |
| AC-12 | API-19, E2E-02 |
| AC-13 | API-24, UI-08, E2E-02 |
| AC-14 | API-21, E2E-02 |
| AC-15 | API-11, E2E-02 |
| AC-16 | API-26, UI-06, E2E-03 |
| AC-17 | API-28, E2E-03 |
| AC-18 | API-30, UI-07, E2E-03 |
| AC-19 | API-29, UI-07, E2E-03 |
| AC-20 | MIG-01 |

### Business-rule coverage

| Business Rule | Covered by Test IDs |
|---|---|
| BR-01 – BR-02 | API-01, API-03, API-04, API-05, UI-01, UI-02 |
| BR-03 | API-09 |
| BR-04 | API-10, API-11, API-22, API-23, UI-05, STYLE-02 |
| BR-05, BR-15 | API-24, UI-08 |
| BR-06, BR-07 | API-02, API-03, UI-01 |
| BR-08 | API-06 |
| BR-09 | API-26, API-27 |
| BR-10 | API-07 |
| BR-11 | API-16, API-17, UI-04 |
| BR-12 | API-18 |
| BR-13 | API-19 |
| BR-14 | API-21 |
| BR-16, BR-17, BR-18 | API-26, API-27, API-28 |
| BR-19 | API-29, UI-07 |
| BR-20 | API-30, UI-07 |
| BR-21 | API-27, API-29, API-30 |
| BR-22, BR-23 | MIG-01 |

## 4. Responsive and Visual Checklist

Run at desktop (>=992px), tablet (768-991px), and mobile (<768px), in addition to the full Lab 2 checklist:

- [ ] Login and Change Password use the same centered-card pattern and tokens as the retired Development Requester Selection screen.
- [ ] The shell shows the authenticated user's name, role badge, and Logout at every width; no unauthorized navigation destination is ever rendered for any role.
- [ ] Staff Ticket Queue table (desktop) and cards (mobile/tablet) show ownership, IT Priority, and status without horizontal scroll or clipping.
- [ ] Public Comments and Internal Notes are two visually distinct containers on Staff Ticket Detail at every width; the lock icon/header remains legible on mobile.
- [ ] Status-select options that are not permitted from the current status are visibly disabled, not hidden, and are still legible at mobile width.
- [ ] Administrator User Management list/cards show Name, Email, Role, Status, and Edit at every width; create/edit dialogs fit the viewport without horizontal scroll.
- [ ] The self-deactivation-blocked and last-active-Administrator-blocked messages are legible and non-overlapping at mobile width.
- [ ] Invalid-Credentials and Inactive-Account banners on Login are visually distinguishable from each other at every width.
- [ ] Visual evidence saved under `artifacts/lab-03/screenshots/<screen>/<viewport>/<state>.png`.

## 5. Test Commands

### Server unit and API tests
```bash
cd server
npm test
npx vitest run tests/lab-03
```

### Client unit and UI component tests
```bash
cd client
npm test
npx vitest run src/tests/lab-03
```

### Full project test run
```bash
npm test
```

### E2E tests
```bash
npx playwright test e2e/lab-03/authentication.spec.ts
npx playwright test e2e/lab-03/staff-ticket-flow.spec.ts
npx playwright test e2e/lab-03/user-administration.spec.ts
```

For interactive debugging or visual evidence:
```bash
npx playwright test e2e/lab-03 --headed
npx playwright show-report
```

The E2E environment must have the client and API available, seeded Requester/IT Staff/Administrator data per Section 7.7 of `specification.md`, and isolated test database/session storage state, separate from any manual-testing database (carried forward from the Lab 2 lesson on test/dev database separation).

## 6. Final Results

Placeholder: complete after implementation and execution of the planned test suite.

| Result | Value |
|---|---|
| Tests executed | TBD |
| Passed | TBD |
| Failed | TBD |
| Blocked | TBD |
| Visual evidence location | `artifacts/lab-03/screenshots/` |
| Overall result | TBD |

## 7. Known Limitations or Deferred Tests

Explicitly excluded from Lab 3 and deferred:

- Email invitations, password-reset email, multi-factor authentication, social login, single sign-on.
- Actions Taken by IT Staff, and the resulting rule blocking resolution while Actions Taken are incomplete (Lab 4).
- Formal SLA calculation, escalation rules, and notification services.
- Dashboards and KPI analytics beyond simple queue counts.
- Multi-tenant organizations, departments, and customer administration.
- User deletion, bulk user operations, import/export, and account-history screens; mandatory pagination, multi-column sorting, and multiple simultaneous filters on the user list.
- Production-grade deployment, cloud infrastructure, and load/performance testing.

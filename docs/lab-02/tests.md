# Lab 2 Test Specification

## 1. Test Strategy

Testing uses layered evidence, from fast deterministic checks to complete requester workflows:

- **Unit tests:** Validate pure rules such as trimming, field lengths, enum values, file type/size/count limits, query parsing, ticket-number formatting, and pagination calculations.
- **API tests:** Use Supertest against the server application and isolated database/file-storage fixtures. Verify status codes, response shapes, validation, ownership isolation, idempotency, transaction compensation, and attachment lifecycle behavior.
- **UI component tests:** Use the client component test runner and DOM/user-event assertions. Verify form behavior, state retention, loading/error/empty/no-results states, accessible names, focus, and disabled/busy controls.
- **UI style tests:** Inspect rendered styles and visual snapshots for Zen Green tokens, typography, spacing, control states, badges, table/card presentation, and screenshot evidence.
- **Responsive tests:** Render or inspect the UI at desktop (>=992px), tablet (768-991px), and mobile (<768px) widths. Verify responsive transformations and absence of clipping, overlap, or horizontal scrolling.
- **E2E tests:** Exercise the requester selector, ticket creation, My Tickets, Ticket Detail, attachment upload/removal, requester switching, and failure recovery in a browser.

The test suite must use independent requester fixtures, including at least two active requesters and one inactive requester. Every requester-scoped API request supplies the selected development requester context. Tests must not treat the development selector as real authentication.

## 2. Planned Tests

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final Status |
|---|---|---|---|---|---|---|
| API-01 | API | FR-01, BR-03, BR-04, AC-05 | Lists development requesters and excludes inactive records | `200 OK`; only active requesters are returned in the documented shape and stable order | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-02 | API | FR-01, BR-03, AC-01 | Establishes an active requester context for a valid ticket request | The selected active requester context is accepted; missing, malformed, or inactive context returns `400` | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-03 | API | FR-01, BR-04 | Lists active categories and related systems for form controls | `GET /api/categories` and `GET /api/related-systems` return only active records with documented shapes | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-04 | API | FR-02, BR-01, BR-02, AC-01 | Creates a valid ticket with metadata | `201 Created`; backend generates a unique `TICK-YYYYMMDD-XXXX` number, sets status to `New`, trims values, and returns the ticket | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-05 | API | BR-06 | Validates required fields and boundaries | Missing fields, summary under 5/over 100, description under 10/over 2000, missing selections, invalid types, and inactive references return `400` with field errors | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-06 | API | BR-07, AC-03 | Validates initial attachment format and size | JPG/JPEG/PNG/WEBP/PDF files at or below 5 MB are accepted; files over 5 MB and unsupported types return clear `400` errors and no ticket is created | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-07 | API | BR-07 | Enforces maximum active attachment count during creation | A sixth active attachment is rejected with the documented limit error; removed attachments do not consume active capacity | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-08 | API | BR-10 | Rejects an identical submission within five seconds | Same requester, trimmed summary, and trimmed description return `409 DUPLICATE_SUBMISSION`; no duplicate ticket is created; a different requester or later submission is allowed | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-09 | API | BR-12, BR-11 | Compensates when an initial attachment upload fails | Ticket creation and files are coordinated; failed upload rolls back or marks the ticket incomplete according to the contract and returns an attachment failure response | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-10 | API | FR-04, BR-05, BR-13, AC-02, AC-06 | Lists only the active requester's tickets with search/filter/sort/pagination | `200 OK`; search covers ticket number/summary/description, filters apply, default sort is `createdAt DESC`, page size defaults to 10, and pagination metadata is correct | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| API-11 | API | BR-13 | Validates My Tickets query parameters | Unknown parameters, invalid page/pageSize, pageSize over 100, unsupported filters, sort fields, or sort directions return `400 INVALID_QUERY_PARAMETER` | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| API-12 | API | BR-05, AC-02, AC-07 | Verifies multi-requester list isolation | Requester A never receives requester B's tickets, including through search, filters, sorting, or pagination; changing context returns only the new requester's records | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| API-13 | API | FR-03, BR-05 | Protects ticket detail ownership | Owned ticket returns `200`; missing or cross-requester ticket consistently returns `404` without existence leakage | `server/tests/lab-02/ticket-detail.api.test.ts` | Planned |
| API-14 | API | FR-05, BR-07, BR-08, AC-04 | Uploads additional attachments to an owned ticket | Valid file returns `201`; invalid type/size/no file or active count over five returns the documented `400`/`409`; unowned ticket returns `404` | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| API-15 | API | BR-08, AC-04 | Retrieves attachment metadata across its lifecycle | Active and removed attachment metadata return `200`; file path is never exposed; wrong ticket or owner returns `404` | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| API-16 | API | BR-08, AC-04 | Disables binary access for removed/unavailable attachments | Active file downloads with correct content headers; removed files return `404` and no binary; missing storage returns `FILE_UNAVAILABLE` | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| API-17 | API | FR-06, BR-08, BR-09, AC-04 | Soft-removes an attachment with rationale | Valid confirmation reason (5-250 trimmed characters) sets `isRemoved=true`, retains metadata, and returns the reason; invalid/missing reason returns `400` | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| API-18 | API | BR-05, BR-09 | Protects attachment removal and repeated removal | Cross-requester/missing resources return `404`; repeated removal with a different reason returns `409`; same-reason repeat follows documented idempotency | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| UI-01 | UI component | FR-01, BR-03, BR-04, AC-05 | Renders requester selector and context guidance | Only active requesters appear; required selection, testing-only notice, disabled-until-selected Continue, and context display are accessible | `client/src/tests/lab-02/CreateTicket.test.tsx` | Planned |
| UI-02 | UI component | BR-06, BR-11, AC-09 | Validates and retains Create Ticket form data | Required markers, boundary errors, inline messages, first-invalid focus, trimmed values, and all entered values remain after API/network failure | `client/src/tests/lab-02/CreateTicket.test.tsx` | Planned |
| UI-03 | UI component | BR-07, AC-03 | Presents attachment selection and file errors | Accepted formats/5 MB/5-file guidance is visible; invalid type, oversized file, and sixth active file show inline and summary errors and block submit | `client/src/tests/lab-02/AttachmentSection.test.tsx` | Planned |
| UI-04 | UI component | BR-10, BR-12, AC-01, AC-09 | Handles Create Ticket submitting, success, and failure states | Submit becomes busy and disabled immediately; success displays ticket number/status; failure displays retryable error while preserving form and valid files | `client/src/tests/lab-02/CreateTicket.test.tsx` | Planned |
| UI-05 | UI component | FR-04, BR-13, AC-06, AC-08 | Renders My Tickets controls and result states | Search, category/status/priority filters, sort, clear, page controls, result summary, loading skeleton, empty list, and no-results reset are present and behave correctly | `client/src/tests/lab-02/MyTickets.test.tsx` | Planned |
| UI-06 | UI component | BR-05, AC-02, AC-07 | Refreshes and clears My Tickets on requester switch | Switching active requester clears stale rows, refreshes the list, and displays only the newly selected requester's tickets | `client/src/tests/lab-02/MyTickets.test.tsx` | Planned |
| UI-07 | UI component | FR-03, BR-02, AC-04 | Renders read-only ticket detail | Ticket number, status `New`, metadata, description, and attachment history are readable; requester cannot edit immutable ticket fields | `client/src/tests/lab-02/RequesterTicketDetail.test.tsx` | Planned |
| UI-08 | UI component | FR-06, BR-08, BR-09, AC-04, AC-11 | Handles attachment detail states and removal dialog | Active/uploading/invalid/removed/unavailable states are distinct; removed actions are disabled; confirmation requires 5-250 characters, traps focus, supports Escape, and restores focus | `client/src/tests/lab-02/AttachmentSection.test.tsx` | Planned |
| STYLE-01 | UI style | Section 6, UI spec tokens | Verifies Zen Green visual tokens and component hierarchy | Primary `#006B3C`, hover `#0B7A46`, pale `#EAF6EF`, page/surface/text/error/warning/success tokens, typography, spacing, borders, radii, and button hierarchy match the UI specification | `client/src/tests/lab-02/CreateTicket.test.tsx` | Planned |
| STYLE-02 | UI style | UI spec, BR-02, AC-06 | Verifies table, cards, badges, and states | Desktop table has required columns; mobile cards retain required data; priority/status badges use text plus non-color indicators; empty/no-results/loading/error states are visually distinct | `client/src/tests/lab-02/MyTickets.test.tsx` | Planned |
| RESP-01 | Responsive | Section 6, AC-10, UI spec | Checks desktop layout at >=992px | Full shell/table layout renders within the viewport; no clipping, overlap, or horizontal scroll; form and filter regions follow desktop rules | `client/src/tests/lab-02/MyTickets.test.tsx` | Planned |
| RESP-02 | Responsive | Section 6, AC-10, UI spec | Checks tablet layout at 768-991px | Gutters, wrapping filters, form columns, and table/card choice remain readable with no clipping, overlap, or horizontal scroll | `client/src/tests/lab-02/MyTickets.test.tsx` | Planned |
| RESP-03 | Responsive | Section 6, AC-10, UI spec | Checks mobile layout below 768px | Navigation remains discoverable; forms/filters stack; ticket cards replace table; long text wraps; dialogs and attachment rows fit without horizontal scroll | `client/src/tests/lab-02/MyTickets.test.tsx` | Planned |
| A11Y-01 | UI component | AC-11, UI spec | Verifies keyboard and assistive technology behavior | Tab/Shift+Tab/Enter/Space/Escape reach controls in logical order; focus rings are visible; labels/errors/live states are programmatically associated | `client/src/tests/lab-02/AttachmentSection.test.tsx` | Planned |
| E2E-01 | E2E | AC-01, AC-02, AC-04, AC-07, AC-08, AC-09, AC-11 | Runs the requester ticket lifecycle for multiple requesters | Select active requester, create ticket, verify generated number and My Tickets visibility, switch requester, confirm isolation, open detail, remove attachment, and recover from failure without data loss | `e2e/lab-02/requester-ticket-flow.spec.ts` | Planned |

## 3. Acceptance-Criterion Traceability

| Acceptance Criterion | Covered by Test IDs |
|---|---|
| AC-01 | API-02, API-04, UI-04, E2E-01 |
| AC-02 | API-10, API-12, API-13, UI-06, E2E-01 |
| AC-03 | API-06, UI-03 |
| AC-04 | API-15, API-16, API-17, API-18, UI-07, UI-08, E2E-01 |
| AC-05 | API-01, UI-01 |
| AC-06 | API-10, API-11, UI-05 |
| AC-07 | API-12, UI-06, E2E-01 |
| AC-08 | UI-05, E2E-01 |
| AC-09 | API-09, UI-02, UI-04, E2E-01 |
| AC-10 | RESP-01, RESP-02, RESP-03, E2E-01 |
| AC-11 | UI-08, A11Y-01, E2E-01 |

### Business-rule coverage

| Business Rule | Covered by Test IDs |
|---|---|
| BR-01 | API-04 |
| BR-02 | API-04, UI-07 |
| BR-03 | API-01, API-02, UI-01 |
| BR-04 | API-01, API-03, UI-01 |
| BR-05 | API-10, API-12, API-13, API-14, API-15, API-18, UI-06, E2E-01 |
| BR-06 | API-05, UI-02 |
| BR-07 | API-06, API-07, API-14, UI-03 |
| BR-08 | API-15, API-16, API-17, UI-07, UI-08 |
| BR-09 | API-17, API-18, UI-08 |
| BR-10 | API-08, UI-04 |
| BR-11 | API-09, UI-02, UI-04 |
| BR-12 | API-09, UI-04 |
| BR-13 | API-10, API-11, UI-05 |

## 4. Responsive and Visual Checklist

Run the checklist at desktop (>=992px), tablet (768-991px), and mobile (<768px):

- [ ] Page gutters are 32px desktop, 24px tablet, and 16px mobile; content remains within the 1200px maximum width.
- [ ] The application shell, active navigation, requester context, and page title remain visible and usable at each width.
- [ ] Desktop My Tickets uses a semantic table with Ticket No., Created Date, Summary, Category, Requested Priority, Current Status, Last Updated, and Actions.
- [ ] Mobile My Tickets uses cards containing all required ticket information and a View details action.
- [ ] Tablet layout stays readable and switches to cards when a table would become unsafe to compress.
- [ ] Forms, filter controls, dialogs, banners, attachment rows, and long ticket text do not clip, overlap, or create horizontal scrolling.
- [ ] Loading skeletons preserve the final control/table/card dimensions and do not cause layout shifts.
- [ ] Primary, secondary, tertiary, destructive, disabled, focused, and busy buttons are distinguishable and retain stable dimensions.
- [ ] Zen Green tokens are used consistently: primary `#006B3C`, hover `#0B7A46`, pale `#EAF6EF`, white surfaces, readable text, and semantic error/warning/success treatments.
- [ ] Priority and status badges have consistent text labels, contrast, and a non-color indicator at every width.
- [ ] Empty-list and no-results states use different text and actions; no-results includes filter reset.
- [ ] Active, uploading, invalid, removed, and unavailable attachment states are visually distinct and expose only appropriate actions.
- [ ] Visible keyboard focus indicators, required markers, validation text, and system error banners remain legible and non-overlapping.
- [ ] Visual evidence is saved using `artifacts/lab-02/screenshots/<screen>/<viewport>/<state>.png`, with viewport dimensions and state recorded.

## 5. Test Commands

Commands are run from the relevant project directory unless noted otherwise.

### Server unit and API tests

```bash
cd server
npm test
npx vitest run tests/lab-02
```

### Client unit and UI component tests

```bash
cd client
npm test
npx vitest run src/tests/lab-02
```

### Full project test run

```bash
npm test
```

Run this from the repository root when a root test script is provided; otherwise run the server and client commands separately.

### E2E tests

```bash
npx playwright test e2e/lab-02/requester-ticket-flow.spec.ts
```

For interactive debugging or visual evidence:

```bash
npx playwright test e2e/lab-02/requester-ticket-flow.spec.ts --headed
npx playwright show-report
```

The E2E environment must have the client and API available, seeded requester/category/system data, and isolated test storage/database state.

## 6. Final Results

Placeholder: complete after implementation and execution of the planned test suite.

| Result | Value |
|---|---|
| Tests executed | TBD |
| Passed | TBD |
| Failed | TBD |
| Blocked | TBD |
| Visual evidence location | `artifacts/lab-02/screenshots/` |
| Overall result | TBD |

## 7. Known Limitations or Deferred Tests

The following are explicitly excluded from Lab 2 and are deferred:

- Real authentication, including SSO, JWT, passwords, session security, and production identity management. The development requester selector is a testing context only.
- IT Staff Dashboard and Ticket Queue workflows.
- Internal notes, comments, and SLA assignment workflows.
- Requester-driven ticket status transitions. Status is created as `New` and is immutable in Lab 2.
- Administrative category creation and system configuration.

Security testing for production authentication, authorization beyond the Lab 2 requester-context contract, and operational deployment testing are also deferred until the corresponding features are implemented.

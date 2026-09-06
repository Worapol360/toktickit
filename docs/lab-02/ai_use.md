# AI Prompt & Tool Usage Log - Lab 02

This document records the interaction with AI tools (GitHub Copilot) during the implementation of Lab2

## Prompt History
### Issue 1

**Prompt1: Core Backend Infrastructure & Ticket Creation API**

Act as a coding agent. Read only docs/lab-02/specification.md, docs/lab-02/api-spec.md,
and docs/lab-02/ui-spec.md. Do not scan other files in the workspace. Do not write code yet.

I'm about to implement Issue 2: Development Requester Context — the RequesterUser model,
seed data, GET /api/requesters endpoint, and the Development Requester Selection screen.
Before writing any code, list any ambiguities, conflicts, or missing details in the spec
that you need clarified for this specific scope. Also list your proposed implementation order.


Reflection: การสั่งให้ AI อ่านและวิเคราะห์สเปกงานก่อนเริ่มเขียนโค้ดช่วยประหยัดเวลาได้เยอะ เพราะทำให้โครงสร้างฐานข้อมูลและระบบตรวจสอบข้อมูลถูกต้องตรงตามโจทย์ตั้งแต่รอบแรกโดยไม่ต้องมานั่งแก้ซ้ำซ้อน

---
### Issue 2
**Prompt2: Requester Context & Session Persistence Setup**

Scope: Issue 2 only (branch feature/lab2-2-requester-context). Do not implement Create Ticket, 
My Tickets, or Ticket Detail — those are separate Issues.

Clarifications for the ambiguities you raised:
- Prisma model name: RequesterUser. API/JSON response uses field names id, name, email, 
  department, isActive (matching DB fields exactly, camelCase, no mapping layer).
- Seed data: propose your own realistic sample data (at least 4 active + 1 inactive), 
  deterministic and idempotent.
- Initial app flow: route-based page (e.g. /select-requester). If no requester is in context, 
  redirect here before any other screen is accessible.
- Context persistence: store in React state + sessionStorage (not localStorage) — persists 
  across reload, cleared when the browser session ends.
- Error state copy: "Unable to load Development Requesters. Please try again." with a Retry 
  button that re-fetches the list. Preserve any existing selection if retry fails again.
- Remove the Cancel button entirely — only Continue, since there's no other screen to cancel to 
  before a requester is selected.
- Continue button is disabled from initial page load until a valid selection is made.
- "Active only" filtering happens server-side (API only returns active requesters); no 
  client-side re-validation needed.
- Selected requester ID propagates to requester-scoped requests via the X-Requester-Id header, 
  per api-spec.md.

Implement:
- Prisma model RequesterUser (id, name, email, department, isActive) — reuse existing driver 
  adapter pattern in src/prisma.ts
- Idempotent seed script (4+ active, 1+ inactive requesters)
- GET /api/requesters — active only, ordered by name then id, consistent error envelope on failure
- Supertest test for this endpoint (server/tests/lab-02/)
- Development Requester Selection screen (route-based) per ui-spec.md: dropdown, loading state, 
  empty state, API-failure state with retry, Continue-only (no Cancel), keyboard-accessible
- App shell requester context (React state + sessionStorage), displays requester name + 
  "Change Requester" action after selection
- Route guard: redirect to selection screen if no requester is in context
- Vitest test for the selection screen component (client/.../lab-02 tests/)

Do not add authentication, passwords, sessions, or Lab 3 functionality.

Reflection: การกำหนดเงื่อนไขทางเทคนิคให้ชัดเจน เช่น เลือกใช้ sessionStorage แทน localStorage และบังคับส่ง Header เฉพาะ ช่วยป้องกันปัญหาข้อมูลรั่วไหลข้ามผู้ใช้งานได้อย่างราบรื่น

**Prompt4: Test Isolation & Environment Setup**

Fix test isolation in client/: React Testing Library renders are not being cleaned up 
between tests, causing duplicate DOM elements across test cases within the same file.

Current vitest.config.ts has no setupFiles configured. Create client/src/test-setup.ts 
that imports '@testing-library/jest-dom' and registers afterEach(cleanup) from 
'@testing-library/react'. Then update vitest.config.ts to register it as setupFiles.

Also check if @testing-library/jest-dom is installed as a dependency; install it if missing.

Reflection: การทดสอบด้วยตัวเองทำให้เจอจุดบกพร่องเล็กๆ น้อยๆ ที่มองข้าม เช่น หน้าจอเด้งเปลี่ยนหน้าเร็วเกินไป การระบุจุดแก้ให้ AI เจาะจงช่วยแก้ปัญหา UX ตรงนี้ได้โดยไม่กระทบโค้ดส่วนอื่น

**Prompt8: UX Flow & State Refinement for Requester Selection**

Scope: Issue 2 only. Two UX bugs found during manual testing:

Bug 1: Selecting a requester from the dropdown immediately navigates past the selection 
screen, without waiting for the user to click Continue. Per the approved spec, the dropdown 
selection should only enable the Continue button — navigation must only happen when the 
user explicitly clicks Continue.

Fix: Check the onChange handler for the requester dropdown. It should only update the 
selected value and enable the Continue button. The actual context-setting and navigation 
logic must be inside the Continue button's onClick handler, not the dropdown's onChange.

Bug 2: Clicking "Change Requester" in the header does not return the user to the 
Requester Selection screen.

Fix: Check the onClick handler for the "Change Requester" button. It must clear the stored 
requester context (sessionStorage key toktickit-selected-requester-id) and trigger navigation 
back to the Requester Selection screen (or trigger the route guard to redirect there).

After fixing both, run the full test suite (client and server) to confirm nothing else breaks, 
then manually verify: select a requester → Continue is enabled but page doesn't change → 
click Continue → main app loads → click Change Requester → returns to selection screen.

Reflection: การให้ AI ช่วยจัดการเซ็ตอัพ Environment ของเครื่องมือทดสอบ ช่วยแก้ปัญหาเทสต์รันแล้วรวนและทำให้ชุดทดสอบฝั่ง  frontend เสถียรขึ้นมาก

---
### Issue 3
**Prompt9: Create Ticket API and Client-side Form Implementation**

Contract: docs/lab-02/specification.md, docs/lab-02/api-spec.md, docs/lab-02/ui-spec.md, docs/lab-02/tests.md.

Scope: Issue 3 — Create Ticket ONLY. Do not implement My Tickets or Ticket Detail.

1. First implement the planned failing tests for Create Ticket from tests.md (server/tests/lab-02/create-ticket.api.test.ts and client/src/lab-02/CreateTicket.test.tsx). Confirm they fail for the expected reason.
2. Implement POST /api/tickets per api-spec.md: BR-01 (unique Ticket Number), BR-02 (status New), BR-06 (validation), BR-10 (dedup), BR-11 (form preserved on failure), BR-12 (rollback on attachment failure), BR-07 (attachment rules).
3. Implement the Create Ticket screen per ui-spec.md: all required UI states (initial, validation failure, submitting/busy, success, API failure, invalid-attachment).
4. Use the existing X-Requester-Id context from Issue 2. Do not modify App.tsx routing/guard logic already merged in Issue 2.
5. Preserve all existing Lab 1/2 content — do not replace shared files wholesale.
6. Report which AC-IDs and test IDs are completed at the end.

Reflection: การทำ TDD แล้วค่อยๆ แก้จนเทสต์ผ่าน พร้อมจัดการข้อผิดพลาดอย่างระบบ Rollback ตอนอัปโหลดไฟล์พัง ทำให้มั่นใจได้ว่าระบบจัดการข้อมูลปลอดภัยและรัดกุม

---
### Issue 4
**Prompt13: My Tickets List API with Strict Query Validation & Pagination**

Contract: docs/lab-02/specification.md, docs/lab-02/api-spec.md, docs/lab-02/ui-spec.md, docs/lab-02/tests.md.

Scope: Issue 4 — My Tickets ONLY. Do not implement Requester Ticket Detail content (link only) or attachment management.

Resolved Ambiguities & Decisions (STRICTLY FOLLOW):
1. Query Parameters & Validation:
   - Accept search, status, priority, categoryId, sortBy, sortOrder, page, pageSize.
   - Any unknown, malformed, or out-of-range query parameters MUST return 400 Bad Request with { "error": { "code": "INVALID_QUERY_PARAMETER" } }.
   - Empty string values (e.g. categoryId=) must be treated as omitted filters.
2. Sorting:
   - Primary default sort: createdAt DESC.
   - Deterministic tie-breaker sort: id DESC.
   - Allowed sort fields: createdAt, ticketNumber, summary, requestedPriority, status.
3. Pagination & Metadata:
   - Default page=1, pageSize=10. Allowed page sizes in UI: 10, 25, 50 (max 100).
   - Response metadata shape must match api-spec.md (totalItems, totalPages, page, pageSize, hasNextPage, hasPreviousPage).
   - If totalItems is 0, totalPages must be 0.
4. UI States & Distinction:
   - Empty State: totalItems = 0 with NO active search/filters -> Show "No tickets submitted yet" + "Create Ticket" action.
   - No-Results State: totalItems = 0 WITH active search/filters -> Show "No matching tickets found" + "Clear Filters" action.
   - Sorting alone does NOT count as an active filter for No-Results state.
5. Requester Switching Behavior (AC-07):
   - When X-Requester-Id changes, clear search/filter/page state, restore default sort (createdAt DESC), clear stale rows immediately, and fetch new requester's unfiltered page 1.
6. Responsive Breakpoints:
   - Desktop >=992px (Table view), Mobile <768px (Card view), Tablet 768px-991px (Table or Cards depending on readability).
7. Categories Integration:
   - Category filter dropdown must consume the corrected active-only GET /api/categories endpoint.

Execution Steps:
1. First, create failing API tests in server/tests/lab-02/my-tickets.api.test.ts and component tests in client/src/pages/__tests__/MyTickets.test.tsx per tests.md. Confirm they fail for expected reasons.
2. Implement GET /api/tickets in server/src/server.ts per api-spec.md with requester scoping via X-Requester-Id, search, filters, deterministic sorting, pagination, and strict query validation.
3. Implement the My Tickets UI screen per ui-spec.md using the resolved UI states, responsive layout, and requester switch behavior.
4. Do not modify Create Ticket (Issue 3) files except where explicitly shared.
5. Report completed AC-IDs and test IDs when finished.

Reflection: การตั้งเงื่อนไขให้ API ตีกลับเป็น Error 400 Bad Request ทันทีเมื่อผู้ใช้ส่งค่าพารามิเตอร์ผิดพลาด ช่วยให้ระบบ backend เสถียรและผ่านตามเกณฑ์ได้หมด

**Prompt16: Component Bug Fix เรื่อง Duplicate DOM Roles**

The test file MyTickets.test.tsx must NOT be modified.

In MyTickets.tsx:
Fix the remaining failure in the desktop table test where screen.getByRole('button', { name: 'View details' }) finds duplicate buttons (from desktop table and mobile view rendering simultaneously).

Requirement:
1. Ensure the "View details" button inside ticket rows is accessible as expected by the test suite without duplicate roles/accessible names interfering with screen.getByRole.
2. Modify client/src/pages/MyTickets.tsx ONLY. Do NOT touch MyTickets.test.tsx.

After fixing, run:
npx vitest run src/pages/__tests__/MyTickets.test.tsx
And verify all 3 test cases pass.

Reflection: การแก้ปัญหาเรื่องชื่อปุ่มซ้ำกันระหว่างหน้าจอคอมพิวเตอร์และมือถือ ช่วยให้ Testing Library หาปุ่มเจอและทำงานได้อย่างแม่นยำขึ้นโดยไม่ไปกวนการแสดงผลจริง

---
### Issue 5
**Prompt18: Requester Ticket Detail & Attachment Lifecycle (TDD & Security Contracts)**

Contract: docs/lab-02/specification.md, docs/lab-02/api-spec.md, docs/lab-02/ui-spec.md,
docs/lab-02/tests.md — all ambiguities are now resolved as documented.

Scope: Issue 5 — Requester Ticket Detail & Attachments ONLY.

1. First implement the planned failing tests from tests.md
   (server/tests/lab-02/ticket-detail.api.test.ts,
   server/tests/lab-02/attachments.api.test.ts,
   client/.../RequesterTicketDetail.test.tsx,
   client/.../AttachmentSection.test.tsx). Confirm they fail for the expected reason.

2. Implement GET /api/tickets/:id per api-spec.md:
   - Owned-only retrieval enforced at the database query boundary.
   - Return 404 (not 403) for ownership or missing ticket failures, consistent with BR-05 to prevent existence leakage.

3. Implement attachment endpoints adhering strictly to resolved rules:
   - Upload (add to existing ticket): Enforce max-5-active-attachments limit atomically (reject entire batch with 409 ATTACHMENT_LIMIT_EXCEEDED if exceeded). Store files using local disk with generated UUID filenames while retaining original filename (`fileName`), never exposing `filePath`.
   - Metadata retrieval: Owned-only check returning 404 on mismatch.
   - Download (active only): Return binary with original filename. If file is removed/isRemoved=true, return 404 ATTACHMENT_NOT_FOUND.
   - Soft-remove: Require a mandatory free-text reason (5-250 characters) and confirmation. Enforce idempotency (repeated removal with same reason succeeds; repeated removal with a different reason returns 409 ATTACHMENT_ALREADY_REMOVED).

4. Implement the Requester Ticket Detail screen per ui-spec.md:
   - Read-only ticket header fields.
   - Attachment history list displaying active, uploading, invalid, and removed states (with muted surface, removed label, retained metadata, and preview/download disabled).
   - Add-attachment control and soft-remove flow with reason modal/input.
   - Unowned/missing ticket UI: Show a safe "Ticket not found" message with a "Back to My Tickets" action (no automatic destructive redirects).

5. Explicitly out of scope: Do not implement Public Comments, Internal Notes, Actions Taken, or any status changes beyond the initial New status set in Issue 3.

6. Report which AC-IDs and test IDs are completed at the end.

Reflection: การเน้นย้ำเรื่องความปลอดภัย เช่น ตอบกลับ 404 แทน 403 เมื่อพยายามเข้าถึงข้อมูลคนอื่น เพื่อไม่ให้รู้ว่ามีข้อมูลนั้นอยู่จริง ทำให้ระบบมีความปลอดภัยและจัดการไฟล์แนบทำงานได้สมบูรณ์ตามต้องการ
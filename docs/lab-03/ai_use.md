# AI Prompt & Tool Usage Log - Lab 03
 
This document records the interaction with AI tools (GitHub Copilot / coding agents) during the implementation of Lab3
 
## Prompt History
### Issue 1
 
**Prompt1: Sprint Specification & Test Plan (docs only)**
 
Context: TokTickIT, Lab 3 Issue 1 — Sprint Specification & Test Plan. This is
the first Issue of Lab 3 and must be fully completed and approved before any
other Issue starts, per the project's Spec-Driven Development workflow.
 
Read these files in full before writing anything:
- docs/lab-02/specification.md
- docs/lab-02/api-spec.md
- docs/lab-02/ui-spec.md
- docs/lab-02/tests.md
- The Lab 3 handout excerpt provided separately in this conversation
Do not write any code, migrations, or component files in this Issue. This
Issue produces documentation only.
 
Deliverables — create exactly these four files, matching the heading
structure, numbering style, and level of detail of the Lab 2 equivalents:
docs/lab-03/specification.md, api-spec.md, ui-spec.md, tests.md. Number
Functional Requirements as FR-01..., Business Rules as BR-01..., Acceptance
Criteria as AC-01... — restart numbering from 01 for this sprint. Any point
where the handout is ambiguous must be written as an explicit entry under
"Assumptions and Decisions" — do not silently pick one option without
flagging it.
 
Reflection: การให้ AI อ่าน Lab2 doc เดิมก่อนแล้วค่อยร่าง Lab3 ตามโครงเดียวกัน ช่วยให้เอกสารชุดใหม่สม่ำเสมอกับของเก่า ไม่ต้องมาปรับ format ทีหลัง และการบังคับให้เขียน "Assumptions and Decisions" ทุกจุดที่ spec ไม่ชัด ทำให้เรารู้ตัวตั้งแต่ต้นว่ามีจุดไหนต้องตัดสินใจเอง แทนที่จะปล่อยให้ AI เดาเองแล้วมาเจอปัญหาทีหลัง
 
---
### Issue 2
 
**Prompt2: Authentication Foundation & Requester Migration (initial implementation)**
 
Context: You are implementing Issue 2 of Lab 3 for the TokTickIT project
(Prisma + @prisma/adapter-pg + pg.Pool, Express server, React client).
 
Read ONLY these two files before starting: docs/lab-03/specification.md
(Sections 5.1, 5.3 BR-01–BR-10, BR-16–BR-23, Section 7, Section 11),
docs/lab-03/api-spec.md (Sections 1, 3).
 
Implement in order, TDD: evolve RequesterUser into a User model in place
(keep same primary key so existing Ticket foreign keys stay intact), add a
Session model, bcrypt hashing, login/logout/me/change-password endpoints,
auth + mustChangePassword + CSRF middleware, remove the Lab 2
X-Requester-Id mechanism and GET /api/requesters, Login/ChangePassword
screens.
 
Constraints: Never touch any Lab 2 test file's assertions — if a test fails
because it still sends X-Requester-Id, add a session-based setup helper
instead and flag it with a diff, don't delete or weaken assertions.
 
Reflection: จุดที่ช่วยเราได้เยอะคือการสั่งให้ "evolve RequesterUser เป็น User โดยใช้ primary key เดิม" แทนที่จะสร้างตารางใหม่แล้ว migrate data — ทำให้ Ticket เก่าทั้งหมดไม่หลุดจาก Requester เดิมเลยแม้แต่แถวเดียว และกฎ "ห้ามแก้ assertion ของ Lab2 test เด็ดขาด" ที่ใส่ไว้ตั้งแต่ prompt แรก ช่วยป้องกันไม่ให้ AI ไปลดมาตรฐานเทสต์เก่าเพื่อให้ผ่านง่ายๆ
 
**Prompt3: Investigate-only — no context carried from previous agent**
 
We are working on CPE334 Software Engineering Lab 3 – Issue 2. You are
entering this repository with no context from the previous agent, so do not
assume you already understand the current implementation.
 
For this first step, inspect and analyze only. Do not modify any files yet.
Read Lab 3 specs, relevant Lab 2 specs, current backend implementation,
current tests, and git state. Then run the test suite and classify every
failure into one of: (1) implementation bug, (2) expected Lab 2 test
migration, (3) open specification decision, (4) retired functionality/test.
Report the categories/related-systems auth question and the
/api/tickets REQUESTER-role question as open decisions — do not choose
yourself. After completing the analysis, stop and wait for explicit
approval before making changes.
 
Reflection: พรอมต์นี้สำคัญมากตอนที่ agent ตัวเดิมหมด quota กลางคันแล้วต้องเปลี่ยนตัวใหม่ การบอกตรงๆ ว่า "คุณไม่มี context จาก agent ตัวก่อน ห้ามสันนิษฐานว่ารู้แล้ว" ช่วยกัน agent ใหม่ไม่ให้เดามั่วหรือแก้ของเดิมทับโดยไม่รู้ที่มา และการแยกหมวดปัญหาออกเป็น 4 ประเภทก่อนแก้ ทำให้เราเห็นชัดว่าอะไรคือบั๊กจริง อะไรคือแค่ test เก่ายังไม่ migrate
 
**Prompt4: Approved decisions — migrate Lab2 tests to session auth**
 
Continue from your inspection report. The following decisions are already
confirmed: /api/categories and /api/related-systems stay authenticated per
api-spec.md; /api/tickets REQUESTER role middleware stays unchanged; do not
restore X-Requester-Id, RequesterUser, or /api/requesters.
 
Migrate only: create-ticket.api.test.ts, my-tickets.api.test.ts,
ticket-detail.api.test.ts, attachments.api.test.ts — from X-Requester-Id to
an authenticated REQUESTER session using the ttik_session cookie, plus
X-Requested-With on mutating requests. Keep existing business-logic
assertions unchanged. Do not modify requesters.supertest.test.ts yet — just
report whether it should be deleted or archived and wait for approval.
 
Reflection: การแยกขั้นตอนเป็น "investigate ก่อน → รอ approve → ค่อยแก้เฉพาะจุดที่ confirm แล้ว" ทำให้เรา control scope ได้ดีกว่าสั่งแก้รวดเดียวตั้งแต่แรกมาก เพราะพอรู้ชัดแล้วว่าอะไรคือ production bug อะไรคือแค่ test ต้อง migrate เลยสั่ง AI แก้ได้ตรงจุด ไม่เสีย quota ไปกับการลองผิดลองถูก
 
---
### Issue 3
 
**Prompt5: IT Staff Ticket Queue**
 
Context: TokTickIT, Lab 3 Issue 3 — IT Staff Ticket Queue. Auth foundation
(Issue 2) is merged. Read ONLY docs/lab-03/specification.md Section 5.1 &
FR-09, api-spec.md Section 5.1, ui-spec.md Section 6, tests.md API-13/14/15,
UI-03, STYLE-01, RESP-01/02/03. Do NOT read Section 7/8 (Staff Detail /
User Management) — separate Issues. Do NOT implement claim/reassign/
priority/status/comments/notes — Queue is read-only navigation to a detail
screen that doesn't exist yet; a stub "Open" button is fine.
 
Implement a new router at /api/staff/tickets (separate from /api/tickets,
do not touch it) with requireAuth + requirePasswordChangeComplete + role
check for IT_STAFF/ADMINISTRATOR, search/filter/sort/pagination per
api-spec.md — NOT ownership-scoped, returns tickets across all requesters.
Plus a StaffTicketQueue client screen reusing Lab 2's My Tickets state
components where possible.
 
Reflection: การกันขอบเขตด้วยคำว่า "ห้ามอ่าน Section 7/8 เด็ดขาด" และ "ห้ามทำ claim/reassign ตอนนี้" ช่วยให้ AI โฟกัสแค่ Queue อย่างเดียวจริงๆ ไม่หลุดไปทำของ Issue ถัดไปก่อนเวลา ซึ่งถ้าไม่กันไว้แบบนี้เสี่ยงมากที่จะไปชนกับโค้ดของ Issue 4 ที่ยังไม่เริ่มทำ
 
---
### Issue 4
 
**Prompt6: IT Staff Ticket Operations & Requester Public Comments**
 
Context: TokTickIT, Lab 3 Issue 4. Auth foundation (Issue 2) and IT Staff
Ticket Queue (Issue 3) are merged. Read Section 5.1/5.2, BR-04/05/11-15,
FR-08/10/11/12, api-spec.md 4.1/4.2/5.2-5.6, ui-spec.md 5 & 7.
 
Extend /api/staff/tickets/:id for staff detail (not ownership-scoped),
PATCH owner/priority/status (status must enforce the EXACT transition
matrix via a pure, separately unit-testable isValidStatusTransition(from,
to) function), GET/POST notes. Extend the Requester /api/tickets router
with GET/POST comments (shared service function, not duplicated between
staff and requester paths) and POST mark-resolved. Client: extend the
existing RequesterTicketDetail component (do not rewrite it), build a new
StaffTicketDetail screen with a visually and structurally separate Internal
Notes panel from Public Comments.
 
Reflection: การขอให้เขียน status transition เป็นฟังก์ชันแยก (isValidStatusTransition) ที่ test ได้เองโดยไม่ต้องยิง API ทำให้ตอนทวนว่า matrix ครบทุกคู่ (8x8) ทำได้ง่ายกว่าไปไล่เช็คทีละ endpoint มาก และการบอกชัดว่า "ขยาย RequesterTicketDetail เดิม ห้ามเขียนใหม่" ช่วยป้องกันบั๊กแบบที่เคยเจอใน Lab2 ที่ agent เผลอทับโค้ดเดิมที่ยังใช้งานอยู่
 
**Prompt7: Approved with conditions — catching a role-gate gap**
 
Approved with the following conditions. Update the plan accordingly, then
proceed. (1) POST/GET /api/tickets/:id/comments must be accessible to the
ticket's Requester (owner only), IT_STAFF, and ADMINISTRATOR. The existing
/api/tickets mount has requireRole('REQUESTER') on the whole router, which
would return 403 to IT Staff. Give the comments routes their own role gate
without loosening the gate on any other /api/tickets route. (2) GET
/api/staff/tickets/:id already exists from Issue 3 — extend it, do not add
a duplicate. (3) The unit test for isValidStatusTransition() must cover
every (from, to) pair, not just examples. (4) Add assertions that
Requester-facing responses never contain a notes/internalNotes field.
 
Reflection: จุดนี้คือตอนที่เราจับได้ว่า plan ที่ AI เสนอมาจะทำให้ IT Staff โพสต์ Public Comment ไม่ได้เลย เพราะ role gate เดิมล็อกทั้ง router ไว้แค่ REQUESTER การอ่าน plan ให้ละเอียดก่อน approve แทนที่จะกด yes ผ่านๆ ช่วยจับบั๊กได้ตั้งแต่ก่อนเขียนโค้ดจริง ประหยัดเวลากว่าไปเจอตอน test fail เยอะมาก
 
---
### Issue 5
 
**Prompt8: Investigate root cause before touching any test fixture**
 
Before modifying staff-queue.api.test.ts, investigate the root cause of the
test-state contamination first. Evidence we already have: admin@example.com
login returns 403 ACCOUNT_INACTIVE, so the subsequent GET
/api/staff/tickets returns 401 because no session was created. Do NOT
modify code yet.
 
Step 1 — grep admin@example.com and isActive:false usage in
users-admin.api.test.ts; for every match determine whether it targets the
shared seed admin or a dedicated fixture, and whether cleanup restores it.
 
Step 2 — report CASE A (users-admin.api.test.ts deactivates the shared
admin without restoring it → fix there, do not patch staff-queue just to
hide the problem) or CASE B (it already uses a dedicated fixture → apply
the minimal staff-queue fixture fix instead). Do NOT modify
auth.ts/server.ts authentication middleware, Staff Queue production
routes, or production authentication behavior under any circumstance.
 
Reflection: นี่คือบทเรียนที่ได้ราคาแพงที่สุดใน Lab3 — ตอนแรกเราเกือบจะสั่งให้แก้ staff-queue.api.test.ts ตรงๆ เพราะเห็นมัน fail ก่อน แต่พอบังคับให้ AI หา root cause จริงก่อน ถึงเจอว่าต้นตออยู่ที่ test อีกไฟล์ (users-admin) ที่ deactivate admin ตัวกลางแล้วไม่ restore คืน ถ้าแก้ตามอาการตอนแรกจะกลายเป็นการกลบบั๊กไว้ ไม่ใช่แก้จริง
 
**Prompt9: Stop before changes — investigate a newly discovered latent issue**
 
The root-cause fix for admin@example.com is approved: keep the API-30
afterEach that restores admin@example.com to isActive:true; do not modify
staff-queue.api.test.ts; production code remains untouched.
 
For the newly discovered latent cleanup issue, stop before making any
changes. First show me the relevant current code/diff for ownedEmailPrefix,
beforeAll/beforeEach/afterEach/afterAll, and the fixture creation helpers
in users-admin.api.test.ts, plus seedQueueTickets() in
staff-queue.api.test.ts. Explain exactly what fixture emails are created,
what the current cleanup prefix matches, which records remain after the
tests run, why staff-queue can pick up those leftovers, and whether fixing
this is necessary for Issue 5 or a separate cleanup task. Do not modify
code. Do not commit.
 
Reflection: ระหว่างแก้บั๊กแรก AI ดันไปเจอบั๊กที่สอง (prefix พิมพ์ผิดซ้ำคำทำให้ cleanup ไม่ทำงานเลย) การสั่ง "หยุดก่อน อธิบายให้ฟังก่อน อย่าเพิ่งแก้" ทำให้เราเห็นภาพรวมทั้งสองบั๊กพร้อมกันก่อนตัดสินใจ แทนที่จะปล่อยให้ AI ไล่แก้ไปเรื่อยๆ จนเราตามไม่ทันว่าแก้อะไรไปแล้วบ้าง

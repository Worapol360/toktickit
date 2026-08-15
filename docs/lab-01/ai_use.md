# AI Prompt & Tool Usage Log - Lab 01

This document records the interaction with AI tools (GitHub Copilot) during the implementation of Lab1

## Prompt History

**Issue 1**
*Prompt1: Frontend Setup*
Implement frontend for Issue 1:
- create React + TypeScript + Vite app in folder client/
- install Bootstrap and import Bootstrap CSS in.`

Reflection: สั่งครั้งเดียวผ่าน ไม่ต้องไปแก้เพิ่มเพราะขอบเขตงานชัดเจนและเล็ก

*Prompt2: แก้ ts-node-dev ไม่ compatible กับ TypeScript v7*
STOP executing lab instructions automatically. Only fix the dev runner issue in server/: (because ts-node-dev isnt compatible with typescript ver7.0.2):
change from ts-node-dev to tsx instead
- uninstall ts-node-dev
- install tsx and typescript ver5.6.0
- update script "dev" in server/package.json to use tsx watch

Reflection: เจอปัญหา ts-node-dev ไม่ compatible กับ TypeScript v7 (version7 ใช้ไม่ได้) ต้องบอกอาการและวิธีแก้ให้ AI แบบเจาะจงแทนที่จะให้มันเดา

*Prompt3: ดึง scope กลับหลัง AI ทำเกิน — ลบ /api/health, /api/categories ออกจาก Issue 1* 
Focus only on the scope of Issue 1. Do not add routes or features for other issues.
- open server/src/server.ts. now,it has /api/health and /api/categories route, which is for Issue 2 and Issue 4, not Issue 1
- remove the /api/health and /api/categories routes from server/src/server.ts.
- keep only the basic Express app setup that listens on the  port. Do not include any business logic or extra route (ill add it later)

Reflection: พอแนบไฟล์โจทย์ให้ copilot ดู มันแอบไปอ่าน feature ของ Issue อื่นแล้วทำเกินสั่ง หลังจากนั้นเลยต้องเติมประโยค "Focus strictly on scope" ทุก prompt เพื่อกันไม่ให้เป็นซ้ำ

*Prompt6: Testing setup พร้อม scope guard ละเอียด* 
Focus strictly on the scope of Issue 1 only. Do not write test about /api/health, /api/categories or routes that does not in the project yet,Do not create new routes just to have something to test. Do not modify schema.prisma or add any Prisma model.
setup testing for Issue1:
- setup Vitest in folder client/ with script "test" in package.json and add one test file that successfully passes.
- setup Supertest in folder server/ with script "test" in package.jsonand add one test file that successfully passes.

Reflection: ปรับคำสั่งให้ชัดเจนขึ้นว่า ห้ามเขียนเทสต์ให้ฟีเจอร์ที่ยังไม่ได้ทำ และห้ามสร้างโค้ดหลอกๆ ขึ้นมาเพื่อเทสต์ ผลคือทำให้ไม่หลุดขอบเขตอีกเหมือนรอบก่อน แปลว่า constraint มีผล

*Prompt8: Refinement ตาม feedback ของ peer reviewer*
Focus on Issue 1 scope refinement:
1. Check if prisma.config.ts is strictly necessary. If not needed, delete prisma.config.ts and ensure schema.prisma handles environment variables properly.
2. In server/src/server.ts, add a quick database connection check using Prisma on startup. Log "Connected to database" on success or "Failed to connect to database: <error>" on failure, without crashing or adding extra routes.

Reflection: หลังจาก peer review กลับมาปรับ โดยย่อยคำสั่งให้มันก่อน และสั่งแก้ให้ตรงกับ feedback แต่ละข้อ (ลบไฟล์ที่ไม่จำเป็น + เพิ่ม db connection check)

**Issue 2**
*Prompt9: Implement Health Check, GET /api/health + frontend status display*
Scope: Issue 2 only. Do not touch category/database seed logic.
Acceptance criteria:

GET /api/health returns 200 with {status:"ok", service:"TokTickIT API"}
Add a Supertest test for /api/health in server/tests
React UI calls /api/health & displays status, show "System Status: Offline — Unable to connect to TokTickIT API" on error
Implement all of the above in one pass. Do not add /api/categories or any Prisma model/migration.Do not run any terminal commands automatically

Reflection: ทำรอบเดียวผ่าน criteria เพราะระบุ constraint ชัดแต่แรก (scope เฉพาะ Issue 2, ห้ามแตะ category/seed logic, ห้ามรัน terminal command เอง) เรียนรู้มาจาก Issue 1 ที่เคยทำเกิน TT

**Issue 3**
*Prompt10: Category model + idempotent seed*
Scope: Issue 3 only. Do not touch health-check or frontend UI.
Acceptance criteria:

add Prisma model Category (id, unique name, createdAt)
run migration to create the table
seed exactly 4 categories: Account and Access, Hardware, Software, Network
seed script must be idempotent (safe to run multiple times without creating duplicates)
implement all of the above in one pass. do not add any API route for category or frontend change (that is for Issue 4). use the existing Prisma client setup (driver adapter pattern) already configure in src/prisma.ts, do not change it.

Reflection: ผ่านครบตาม criteria แต่เจอปัญหาแยกตอนหลัง เรื่อง prisma.config.ts ไม่รู้จัก seed command (Prisma v6+) เป็นปัญหาเวอร์ชันของเครื่องมือ ทำให้ต้องเช็คว่าเครื่องมือที่ใช้มีเวอร์ชันที่ใช้จริงได้

**Issue 4**
*Prompt14: Category list API + UI*
Scope: Issue 4 only. The Category model, migration, and seed already exist from Issue 3, do not modify schema.prisma or the seed script.

Acceptance criteria:

GET /api/categories retrieves categories from PostgreSQL through Prisma.
The API returns each category ID and name in a predictable order.
A Supertest test verifies the response.
React displays the categories returned by the API, not hard-coded values.
Loading and error states are shown.
A Vitest test verifies the category-list UI behavior.
Implement all of the above in one pass. Reuse the existing Prisma client setup in src/prisma.ts.

Reflection: คำสั่งจะยาวและมีเงื่อนไขเยอะ แต่ทำผ่านครบในรอบเดียว เพราะมีการเขียน constraint ที่ดี

*Prompt15: Peer review prompt สำหรับ Issue 4*
Review this PR for Issue 4: Display the IT Request Category List against the acceptance criteria below.
Ignore node_modules, lockfiles, and auto-generated build files.

Acceptance Criteria:
- GET /api/categories retrieves categories from PostgreSQL through Prisma.
- The API returns each category ID and name in a predictable order.
- A Supertest test verifies the response.
- React displays the categories returned by the API, not hard-coded values.
- Loading and error states are shown.
- A Vitest test verifies the category-list UI behavior.
- Does not modify schema.prisma or the seed script (that belongs to Issue 3)
check for critical bugs, security risks, or hardcoded secrets

Output format only:
- PASS/FAIL per criteria
- blocking issues (if any)

Reflection: ใช้ AI review PR ของเพื่อนแล้วเจอว่า diff มีไฟล์ build/vendor หลุดเข้ามาเยอะมาก ทำให้รู้ว่า AI ช่วยรีวิวมีประโยชน์มากในการเช็คความเรียบร้อยของไฟล์
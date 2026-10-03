# Peer Reviewer Information
 
* **Name-Surname:** Krittamate Niyomthum
* **Student ID:** 67070501053
* **GitHub Username:** Khawpun124
---
 
### Pull Request Links Lab3
 
* **PR Link Issue 1:** https://github.com/Worapol360/toktickit/pull/30
* **PR Link Issue 2:** https://github.com/Worapol360/toktickit/pull/31
* **PR Link Issue fix (auth test isolation):** https://github.com/Worapol360/toktickit/pull/32
* **PR Link Issue 3:** https://github.com/Worapol360/toktickit/pull/33
* **PR Link Issue 4:** https://github.com/Worapol360/toktickit/pull/34
* **PR Link Issue 5:** https://github.com/Worapol360/toktickit/pull/35
* **PR Link lab3-staging:** https://github.com/Worapol360/toktickit/pull/36
---
 
### Review Comments
 
**Comment Issue 1:**
 
* *From Peer:* Pass all acceptance criteria :)
* *To Peer:* Pass all acceptance criteria for Issue1

**Comment Issue 2:**
 
* *From Peer:* ตรงตาม Acceptance criteria :)
* *To Peer:* 

1.

    สรุปสิ่งที่ต้องแก้

    1.ลบ X-Requester-Id
    - ตอนนี้ใครก็สามารถปลอมเป็น user คนอื่นได้
    - ต้องใช้ user จากการ login เท่านั้น
    2.ลบ Development Requester Selector
    - ไม่ให้เลือก Requester เองแล้ว
    - ต้องใช้ account ที่ login อยู่
    3.บังคับเปลี่ยนรหัสผ่านที่ Backend
    - ตอนนี้บังคับแค่หน้าเว็บ
    - ต้องทำให้ API ก็เข้าไม่ได้จนกว่าจะเปลี่ยน password
    4.แก้รหัสผ่านของ User ที่ migrate
    - ตอนนี้ password ใน migration กับที่เขียนไว้ในเอกสารไม่ตรงกัน
    - ต้องทำให้เหลือวิธีเดียว และ login ได้จริง

2.

    ข้อ 4: Migration password ยังไม่ตรงกัน

    - ใน migration.sql บรรทัด 69 ยังใช้ hash ตัวเดิมอยู่ ซึ่งไม่ตรงกับ password ChangeMe123! ที่ระบุใน README และ constants.ts
    - แก้ hash ใน migration.sql ให้ตรงกับ ChangeMe123! แล้ว verify ว่า user ที่ migrate จาก Lab 2 สามารถ login ด้วย password ได้จริง

3.ครบถ้วนตาม acceptance criteria

**Comment Issue 3:**
 
* *From Peer:* ผ่านตามเกณฑ์ Acceptance criteria :)
* *To Peer:* 
1.

    เจอ issue ที่ติดมาจาก lab3-staging
    ปัญหา:
    - ในไฟล์ 20260914113900_add_user_and_session_models/migration.sql มีการผูก FK Ticket.requesterId -> User.id แต่ยังไม่มีขั้นตอนย้ายข้อมูลจาก RequesterUser ไป User ในไฟล์นี้
    - ฟังก์ชัน runUserMigration() ไปอยู่ใน prisma/seed.ts ซึ่งรันหลัง prisma migrate dev ทำให้ถ้ารันกับ DB เดิมของ Lab 2 งานจะ Fail ทันทีเพราะหา FK ไม่เจอ

    สิ่งที่ต้องทำ:
    - เช็กวิธีจัดการย้ายข้อมูลให้ถูกต้องตาม Prisma migration flow (โดยยังไม่ต้องแก้ไฟล์ migration เก่าตรงๆ ถ้าถูก apply ไปแล้ว)เพื่อรักษาข้อมูล RequesterUser และ Ticket ownership ไว้

2.ถูกต้องครบถวนตาม criteria

**Comment Issue 4:**
 
* *From Peer:* ครบถ้วนตาม description :)
* *To Peer:* 
1.

    ช่วยแก้ 2 จุด:
    1.StaffTicketQueueScreen.tsx ปุ่ม View ใช้ /tickets/:id ซึ่งเป็น route ของ Requester และมี ownership check ทำให้ Staff กดดู Ticket ของ requester คนอื่นแล้วเจอ 404 ตอนนี้ควรเปลี่ยนให้ใช้ Staff detail endpoint/route ตาม GET /api/staff/tickets/:id ใน spec
    2.currentStatus ยังไม่มี whitelist validation เหมือน priority ถ้าส่ง status ที่ไม่ถูกต้อง เช่น asdf อาจทำให้ API ตอบ 500 แนะนำเพิ่ม validation และ test

2.

    แก้:

    - ลบ cookies.txt ออกจาก commit ,ลบไฟล์แล้ว commit ใหม่ได้เลย
    - เพิ่ม cookies.txt ใน .gitignore

3.ครบถ้วนตาม acceptance criteria

**Comment Issue 5:**
 
* *From Peer:* 
* *To Peer:* 
1.

    จุดที่ต้องแก้:

    1.Attachments
    - GET /api/tickets/:id/attachments และ GET /api/attachments/:id/download ยังเช็ค ownership แบบ Requester ทำให้ Staff เปิด attachment ของ ticket คนอื่นไม่ได้
    - ตอนนี้ UI แสดง No attachments found. แทน error ทำให้เกิด silent failure แนะนำให้ปรับ endpoint ให้ Staff/Admin เข้าถึงได้ตามสิทธิ์ของ Staff Ticket Detail
    2.Internal Notes
    - POST /api/tickets/:id/notes ยังไม่จำกัด content ที่ 2000 ตัวอักษรที่ backend
    - Client มี maxLength แล้ว แต่ backend ก็ควร validate ให้ตรงกับ BR-16
    3.Status Confirmation
    - ตอนนี้ confirmation เช็คจาก status ปลายทางอย่างเดียว ทำให้ Resolved → Closed และ Resolved → Reopened มี confirmation ทั้งที่ spec ไม่ต้องการ
    - แนะนำให้เช็คเป็นคู่ From → To ตาม Status Transition Matrix


2.ครบถ้วนตาม criteria

**Comment Issue 6:**
 
* *To Peer:* 
1.

    สิ่งที่ต้องแก้:
    ระบบสร้าง/รีเซ็ตรหัสผ่านฝั่ง Admin ไม่ยอมเช็คความปลอดภัยของรหัสผ่าน (Password Strength)
    ปัญหา: ตอนนี้ Admin สามารถตั้งรหัสผ่านง่ายๆ เช่น "a" หรือ "1" ให้ User ได้ เพราะระบบเช็คแค่ว่าห้ามเว้นว่าง ทำให้รหัสผ่านเดาง่ายเกินไป

    จุดที่ต้องแก้ฝั่ง Server:
    - ไฟล์ POST /api/admin/users (ตอนสร้าง User) และ POST /api/admin/users/:id/reset-password (ตอนรีเซ็ตรหัสผ่าน): ให้เพิ่มการเรียกใช้ฟังก์ชัน validatePasswordRules() เพื่อบังคับใช้กฎรหัสผ่าน (8 ตัวอักษรขึ้นไป, มีตัวพิมพ์ใหญ่-เล็ก, ตัวเลข, สัญลักษณ์) ถ้าไม่ผ่าน ให้ส่ง Error 400 กลับไป

    จุดที่ต้องแก้ฝั่ง Client (UserManagementScreen.tsx):
    - ฟอร์ม Create User: แก้ฟังก์ชัน handleCreate ให้เช็ค passwordRules.isValid ก่อนส่งข้อมูล (กดปุ่ม Submit ไม่ได้ หรือสั่งบล็อกพร้อมเตือน ถ้าตั้งรหัสผ่านไม่ผ่านเกณฑ์)
    - ฟอร์ม Reset Password: เพิ่มตัวกล่อง Checklist เช็กรหัสผ่านแบบ Live Checklist ให้เหมือนหน้า Change Password เพื่อความสวยงามและใช้งานง่าย

    จุดที่ต้องแก้ฝั่ง Test (users-admin.api.test.ts):
    - เขียน Automated Test เพิ่มเติม กรณีที่มีการส่ง Weak Password เข้ามา เพื่อทดสอบว่าระบบบล็อกได้ถูกต้องจริงๆ

2.ครบถ้วนตาม criteria

**Comment Issue 7:**
 
* *To Peer:* 

1.

    สิ่งที่ต้องแก้:
    1. แก้ไข Fallback ใน AC-02 E2E Test
    - ใน authentication.spec.ts (AC-02) มีโค้ด fallback ข้ามหน้า Mandatory Password Change เมื่อรันซ้ำ ทำให้ test ผ่านโดยไม่ได้ assert จริง ๆ
    - วิธีแก้: ให้เพิ่มการ reset DB ก่อนรัน E2E suite ทุกครั้ง (เช่นใช้ server/scripts/reset-db.ts) และตัด fallback นั้นออก เพื่อให้ทดสอบและ assert หน้าเปลี่ยนรหัสผ่านได้จริง

    2. เพิ่ม E2E Test ลงใน GitHub Actions CI
    - ไฟล์ .github/workflows/ci.yml ยังไม่มีการรัน Playwright E2E ทำให้ต้องทดสอบด้วยมืออย่างเดียว เสี่ยงต่อการเกิด regression
    - วิธีแก้: เพิ่ม E2E job (รันคำสั่ง npm run test:e2e) เข้าไปใน CI workflow พร้อมใส่ขั้นตอน reset DB ก่อนรันเทสด้วย
 
2.ครบถ้วนตาม criteria
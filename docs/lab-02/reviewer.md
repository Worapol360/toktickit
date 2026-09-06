# Peer Reviewer Information

* **Name-Surname:** Krittamate Niyomthum
* **Student ID:** 67070501053
* **GitHub Username:** Khawpun124

---

### Pull Request Links Lab2

* **PR Link Issue 1:** https://github.com/Worapol360/toktickit/pull/16
* **PR Link Issue 2:** https://github.com/Worapol360/toktickit/pull/17
* **PR Link Issue 3:** https://github.com/Worapol360/toktickit/pull/18
* **PR Link Issue fix 3:** https://github.com/Worapol360/toktickit/pull/19
* **PR Link Issue 4:** https://github.com/Worapol360/toktickit/pull/20
* **PR Link Issue 5:** https://github.com/Worapol360/toktickit/pull/21
* **PR Link lab2-staging:** https://github.com/Worapol360/toktickit/pull/22

---

### Review Comments

**Comment Issue 1:**

* *From Peer:* ตรงตามเกณฑ์ใน Labsheet_02 อย่างครบถ้วน


* *To Peer:* 1.ช่องทางส่ง Requester ID ให้ใช้แบบเดียว:
ต้องแก้: ใน specification.md ดันเผลอเขียนว่าส่งได้ทั้ง Header หรือ Query Param แต่ใน api-spec.md บังคับใช้เฉพาะ Header (X-Requester-Id)

2.ฟันธงรหัส Error (HTTP Status Code) ตอนไม่ส่งหรือส่ง Requester ID ผิด:
ต้องแก้: ใน api-spec.md เขียนรหัสปนกันมั่วระหว่าง 400 กับ 401

3.อธิบายเรื่องการเช็กตัวอักษร Summary ให้เคลียร์:
ต้องแก้: ใน Spec บอกหน้าบ้านต้องบล็อกไม่ให้ส่งถ้าน้อยกว่า 5 ตัวอักษร แต่ในเอกสาร Test ดันมีเทสต์ฝั่งหลังบ้านรอเช็ก Error 400 ด้วย ทำให้อ่านแล้วดูขัดแย้ง


**Comment Issue 2:** 

* *From Peer:* ครบถ้วนตาม Acceptance Criteria :)


* *To Peer:* แก้ให้ GET /api/categories คืนค่าเฉพาะ Active Records
,Prisma Schema ของ Category ยังไม่มีฟิลด์ isActive
Route ยังไม่ได้ทำการ Filter where: { isActive: true }



**Comment Issue 3:** 

* *From Peer:* 
1. ครบถ้วนตาม Acceptance Criteria :)
2. ทุกอย่างสอดคล้องกับที่บอกในคำอธิบาย PR - ได้แก้ schema, seed data, endpoint alignment ครบถ้วนแล้ว :)

* *To Peer:* ผ่าน acceptance criteria หมดทุกข้อ


**Comment Issue 4:** 

* *From Peer:* ครบถ้วนตาม Acceptance Criteria :)


* *To Peer:* ในไฟล์ server/src/app.ts ตรงส่วนตัวกรอง Priority และ Status ให้เขียนเช็คค่าที่ส่งมาด้วย ถ้าส่งค่ามั่วๆ หรือผิดจากที่กำหนดไว้ ต้องส่งกลับเป็น 400 Bad Request ทันที
รัน Test ให้ผ่านทั้งหมด และให้ระบบ CI ติ๊กเครื่องหมายถูก

**Comment Issue 5:** 
* *From Peer:* สิ่งที่ต้องแก้ไข

Database Migration & Schema: ต้องอัปเดตโมเดล Attachment ใน prisma/schema.prisma ให้มีฟิลด์ removedAt (DateTime, nullable) และ removalReason (String, nullable, max 250 chars) จากนั้นรัน npx prisma migrate dev เพื่อป้องกัน Runtime Error ใน server.ts
Environment & Gitignore: กำหนดค่า ATTACHMENT_STORAGE_PATH ใน .env / .env.example และเพิ่ม storage/ ลงใน .gitignore
Scope Verification: รันคำสั่ง git diff lab2-staging --stat เพื่อยืนยันว่าไม่มีการเปลี่ยนแปลงนอกเหนือจาก 11 ไฟล์ที่เกี่ยวข้องกับ Issue #5
PR Body: เติม Acceptance Criteria IDs (เช่น AC-13, AC-14) ลงในส่วนที่เว้นว่างไว้

* *To Peer:* สิ่งที่ต้องแก้ (Blocking):

ลบไฟล์ขยะเมื่อ Auth ไม่ผ่าน: เพิ่มโค้ดลบทิ้งไฟล์ที่อัปโหลดมา หากคำขอไม่ผ่านการตรวจสอบสิทธิ์
แก้ปัญหา Race Condition อัปโหลดเกิน 5 ไฟล์: ปรับการเช็คจำนวนไฟล์ร่วมกับการบันทึกให้เป็น Transaction เดียวกัน ป้องกันการกดอัปโหลดพร้อมกันแล้วทะลุกำหนด
Non-blocking:

จำกัดความยาวข้อความ removalReason
ปรับการเช็คชนิดไฟล์ให้อ่านเงื่อนไขตรงกันทั้ง Client และ Server
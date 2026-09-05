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
* **PR Link Issue 5:** 
* **PR Link lab2-staging:** 

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


* *To Peer:*

**Comment Issue 5:** 
* *From Peer:*


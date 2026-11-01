# Peer Reviewer Information
 
* **Name-Surname:** Krittamate Niyomthum
* **Student ID:** 67070501053
* **GitHub Username:** Khawpun124
---
 
### Pull Request Links Lab3
 
* **PR Link Issue 1:** https://github.com/Worapol360/toktickit/pull/44
* **PR Link Issue 2:** https://github.com/Worapol360/toktickit/pull/45
* **PR Link Issue fix (Restore client TypeScript build on lab4-staging):** https://github.com/Worapol360/toktickit/pull/47
* **PR Link Issue 3:** https://github.com/Worapol360/toktickit/pull/48
* **PR Link Issue 4:** https://github.com/Worapol360/toktickit/pull/49
* **PR Link Issue 5:** https://github.com/Worapol360/toktickit/pull/50
* **PR Link lab4-staging:** https://github.com/Worapol360/toktickit/pull/51
---
 
### Review Comments
 
**Comment Issue 1:**
 
* *From Peer:* ตรงตาม acceptance criteria ของขั้น Spec DD + Test DD ก่อนเริ่ม implementation :)
* *To Peer:* 
1. สิ่งที่ต้องแก้ไข:

API กับ UI ขัดแย้งกัน: api-spec.md ระบุว่าห้ามเปลี่ยน status ผ่าน Edit endpoint แต่ ui-spec.md กลับให้เปลี่ยน status ใน Edit dialog ควรปรับให้ตรงกันและระบุวิธีเปลี่ยน status ที่ชัดเจน
Rollback ยังไม่ชัดเจน: ใน specification.md ควรระบุตำแหน่งสคริปต์และขั้นตอน rollback ที่ทำตามได้จริง พร้อมวิธีตรวจสอบว่ากู้คืนข้อมูลเดิมได้ครบ
Migration ยังขาดรายละเอียด: ใน specification.md ควรระบุวิธีจัดการเมื่อ migration ล้มเหลวกลางทาง วิธีรันซ้ำ และวิธีตรวจสอบข้อมูลหลัง backfill
Dashboard และ Timezone: ควรระบุให้ชัดว่าการกรองข้อมูลใช้ UTC และกำหนดขอบเขตช่วง 30 วันให้แน่นอน เพื่อให้ Backend และ UI แสดงผลตรงกัน
Test Traceability: ตรวจสอบใน tests.md ว่า Acceptance Criteria ทุกข้อเชื่อมกับ test ที่มีอยู่จริง และปรับรายการที่ยังไม่ตรงกันให้ครบ
E2E Test ไม่ผ่าน: ตรวจสอบ CI log เพื่อหาสาเหตุและแก้ไขปัญหาที่พบก่อน merge
ส่วนสถานะ Test ที่เป็น Pending ควรตรวจสอบว่ารายการใดจำเป็นต้องทดสอบใน Issue นี้ และบันทึกผลตามจริง ไม่ควรเปลี่ยนเป็น Pass หากยังไม่ได้ทดสอบ

2. กฎของ Result ตอนสร้าง Action: ใน tests.md มีการระบุไว้แล้วว่า ถ้าสร้าง Action ด้วยสถานะ COMPLETED ต้องมี Result แต่ในส่วน POST ของ api-spec.md ยังระบุไม่ชัดว่า Result เป็นข้อมูลที่จำเป็นในกรณีนี้ อยากให้เพิ่มกฎนี้ใน API spec ให้ตรงกับ test plan

การเรียงรายการ Needs your attention: ใน ui-spec.md ระบุว่าให้เรียงรายการที่รอนานที่สุดไว้ก่อน แต่ใน api-spec.md ใช้ updatedAt จากเก่าไปใหม่ ซึ่งอาจไม่ใช่รายการที่รอนานที่สุดจริง ๆ หาก Ticket ถูกแก้ไขหลังจากเข้าสถานะ WAITING_FOR_REQUESTER แล้ว อยากให้ช่วยกำหนดหลักการเรียงให้ชัดเจน และปรับ UI spec กับ API spec ให้ตรงกัน

3. สิ่งที่อยากให้แก้:

ระบุเงื่อนไข Urgent Tickets ใน UI spec: ใน docs/lab-04/ui-spec.md บรรทัด 80–85 ระบุเพียงลำดับการแสดงผล แต่ยังไม่ได้ระบุว่า Ticket ต้องเป็น Active และมี IT Priority = HIGH ตาม specification.md และ api-spec.md ช่วยเพิ่มเงื่อนไขนี้ใน UI spec และเพิ่ม assertion ใน UI test หากยังไม่มี

ระบุ Timezone ของ waitingSince ใน UI spec: ใน docs/lab-04/ui-spec.md บรรทัด 115 ระบุเพียงการแสดงวันที่และเวลา ช่วยระบุให้ชัดว่าต้องแสดงเวลาตาม Browser timezone และห้ามใช้เวลานี้คำนวณหรือกรองรายการ เพื่อให้สอดคล้องกับ specification.md และ api-spec.md

4. ผ่านตาม acceptance criteria issue1 หมดเรียบร้อย

**Comment Issue 2:**
 
* *From Peer:* ตรงตาม acceptance criteria ของ issue2 แล้ว

**Comment Issue Fix:**
 
* *From Peer:* 
1. มีข้อเสนอก่อน merge คือ structure ของ mock response ที่กำหนดว่าเป็น success หรือ error ตอนนี้ทำ inline ในแต่ละ test แล้ว และครอบคลุมเฉพาะ endpoint บางตัวเท่านั้น หากสามารถรวมเป็น shared type เช่น ApiResult<T> หรือ ErrorEnvelope แล้ว reuse ในทุก mock จะปลอดภัยและสะอาดขึ้นกว่า
สิ่งนี้จะช่วยให้ contract ของ API สะท้อนชัดขึ้น ลดโอกาสเกิด TypeScript regression ใน mock ที่แตกต่างกันในอนาคต และทำให้การเพิ่ม endpoint ใหม่ไม่เสี่ยงต่อการลืม update type อีกต่อไป :)

2. ทำครบตาม PR scope แล้ว :)

* *To Peer:* 

**Comment Issue 3:**
 
* *From Peer:* 
1. UI อาจทำให้ผู้ใช้ไม่เห็น control ได้แล้ว แต่สิ่งสำคัญคือ backend ยังต้อง enforce ว่า:

Requester ไม่สามารถ create/edit/delete Actions Taken ได้ แม้ผ่าน API หรือ bypass UI
IT Staff ที่ไม่ใช่ Ticket Owner / ไม่ได้รับอนุญาต ไม่ควรเข้าถึง write action
Follow-up note validation ต้องบังคับที่ backend เช่นเดียวกับ UI
conflict/409 ต้องไม่ overwrite silently และต้อง preserve ข้อมูลที่ผู้ใช้พิมพ์ไว้

2. ขอบคุณสำหรับการตรวจสอบและยืนยันข้อมูลที่ละเอียด
จากการตรวจสอบทั้ง Backend, Frontend, Spec และ Tests แล้ว เห็นว่า concern ที่เคยมีเรื่อง authorization, follow-up validation, 409 conflict handling และ regression coverage ได้รับการพิสูจน์แล้วว่าใช้งานตาม requirement อย่างถูกต้อง:

Requester ไม่สามารถแก้ไข Actions Taken ผ่าน API ได้ เพราะ backend ตรวจสอบ role และปฏิเสธด้วย 403
IT Staff/Admin มีสิทธิ์ตาม BR-02 และ AC-03 ที่กำหนดให้สามารถจัดการ Actions Taken ของ Ticket ได้
Follow-up note validation ถูก enforce ที่ backend เมื่อเปิดใช้งาน follow-up
409 Conflict ไม่ overwrite ข้อมูลโดยอัตโนมัติ และ preserve ข้อความที่ผู้ใช้พิมพ์ไว้
เพิ่ม Regression Tests อีก 4 กรณี และผลทดสอบล่าสุดผ่านทั้งหมด:
Client Tests: 99/99
Client Build: Passed
Lab 4 Server Tests: 54/54
ดังนั้นจากมุมมองของ review point นี้ ไม่พบ blocking issue ที่ต้องแก้ไขเพิ่มเติมอีกแล้ว

**Comment Issue 4:**
 
* *From Peer:* 
1. ขอให้ช่วยเช็ค เกี่ยวกับการออกแบบ dependency ระหว่าง module ใน PR นี้ : server.ts import withAllowedTransitions จาก ticket-workflow-rules.ts ในขณะที่ workflow-rules module ก็ import STATUS_TRANSITIONS กลับมาจาก server.ts ทำให้เกิด circular dependency ระหว่าง canonical status matrix กับ helper layer
สิ่งนี้มีความเสี่ยง เพราะ module initialization order ใน ESM อาจมีผลต่อการ resolve symbol และในบางกรณีอาจได้รับค่าแบบ partially initialized หรือ drift ระหว่าง transition table กับ helper logic ซึ่งอาจทำให้ status validation และ allowedTransitions มีพฤติกรรมที่ไม่สอดคล้องกันใน runtime
นี่คือ business logic หลักของ workflow และควรไม่พึ่งพา boot ordering จึงควรแยก transition matrix ออกเป็น module แยกต่างหาก (เช่น ticket-status.ts) และให้ทั้ง server และ workflow helper import จาก single source of truth เดียวกัน เพื่อให้กฎการเปลี่ยนสถานะมีความ deterministic ลดความเสี่ยงในการเกิด runtime bug ระหว่างการ start app หรือ initialization ระหว่าง test

2. ผ่านข้อกำหนด Acceptance criteria ทั้งหมดแล้ว :)

**Comment Issue 5:**
 
* *From Peer:* 
1. ขอให้ช่วยดู 4 จุดนี้หน่อย :

“No existing test modified” ไม่ตรงกับ diff มี test files ที่ถูกแก้ไขจริง เช่น:
client/src/tests/lab-03/StaffTicketDetail.test.tsx
server/tests/lab-01/issue1.supertest.test.ts
server/tests/lab-01/issue2.health-supertest.test.ts
ดังนั้นข้อความนี้ใน PR summary นั้นไม่ถูกต้องตาม repository state
“Screenshots: artifacts/lab-04/screenshots/...” ไม่เห็นใน changed files หรือ repo tree ที่ผมเห็น
ถ้า screenshot จริงอยู่ ต้องมี artifact/output files แต่จาก diff ไม่ปรากฏชัด
“3 consecutive green runs” / “builds pass” / “metrics vs database: paste SQL + screenshots” เป็น evidence ที่ไม่สามารถยืนยันจาก PR metadata หรือ changed files ได้
มันเป็นสิ่งที่ต้องมี CI log หรือ artifact จริง
“Out of scope: E2E specs” แต่ใน diff มีเพิ่ม AppNavigation, Dashboard test หลายตัวแล้ว
มันไม่ใช่ข้อผิดพลาดโดยตัวเอง แต่ก็ทำให้เรื่อง “out of scope” ดูไม่คมเท่าที่ควร

2. ผ่าน Acceptance criteria ทั้งหมดแล้ว :)


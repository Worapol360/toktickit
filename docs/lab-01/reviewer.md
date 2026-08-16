# Peer Reviewer Information

- **Name-Surname:** Krittamate Niyomthum
- **Student ID:** 67070501053
- **GitHub Username:** Khawpun124

- **PR Link Issue 1:** https://github.com/Worapol360/toktickit/pull/5
- **PR Link Issue 2:** https://github.com/Worapol360/toktickit/pull/6
- **PR Link Issue 3:** https://github.com/Worapol360/toktickit/pull/7
- **PR Link Issue 4:** 

- **Comment Issue 1:**
*From Peer:*
1.ผ่านเกณฑ์ของ Issue 1 ทั้งหมด แต่มีที่อยากให้ดู 2 จุด:
prisma.config.ts ตือไฟล์ extra ที่อาจไม่ต้องใช้ใน Issue 1
ไฟล์ใน docs/lab-01/ ยังขาดใน Issue 1
2.ครบถ้วนตาม Issue 1

*To Peer:*
1.ตอนนี้ใน PR มันมีแค่ 4 ไฟล์ โครงสร้างยังไม่ตรง ขาด:

client/src/
docs/lab1(ai_use.md,reviewer.md)
server/prisma/ , server/src/ , server/tests/lab-01
gitignore
อาจจะลืม get add . ก่อน push
2.Pass all acceptance criteria for Issue 1

- **Comment Issue 2:** 
*From Peer:*ครบถ้วนตามเกณฑ์ Issue 2 ทั้งหมด
*To Peer:*
1.ช่วยปรับข้อความ error ตอน Backend ล่ม ใน app.tsx ให้ชัดเจนกว่านี้ได้มั้ย ตาม criteria:A useful error message appears when the backend is unavailable. ในใบแล็บ
2.Pass all acceptance criteria for Issue 2


- **Comment Issue 3:** 
*From Peer:*ครบถ้วนตามเกณฑ์ของ Issue 3 ทั้งหมด
*To Peer:*
1.แก้ไฟล์ docker-compose.yml: มีการใส่ hardcode password ตรงๆ
POSTGRES_PASSWORD: toktickit_dev_password

ช่วยแก้ให้ดึงค่าจากตัวแปรใน .env แทน
2.Pass all acceptance criteria for Issue 3

- **Comment Issue 4:** 
*From Peer:*
*To Peer:*
1.- ตอนนี้เปิด PR เข้า main ทำให้มีไฟล์ส่วนเกินติดมา ให้เปลี่ยน base branch เป็น lab1-staging
- เอาไฟล์ส่วนเกินออก ใน PR ดันแค่ไฟล์ source หรือ test ที่เกี่ยวกับ Issue 4 พอ

# Workflow Automation Lab

## โครงสร้าง

```
shared/                 ข้อมูล + ตรรกะที่ไม่แตะหน้าเว็บ (ใช้ซ้ำฝั่ง backend ได้ด้วย require())
  variables.js          คำอธิบายตัวแปร {{...}}
  blocks.js             BLOCK_CATALOG — ชนิดบล็อกทั้งหมด
  levels.js             LEVELS — โจทย์แต่ละด่าน + checks (เงื่อนไขผ่านด่าน)
  checker.js            checkFlow(level, flow, catalog) — ระบบตรวจคำตอบ
frontend/
  index.html            หน้าใช้งาน
  css/app.css
  js/api/storage.js     Api — ตัวกลางอ่าน/เขียนข้อมูล (ตอนนี้ใช้ localStorage)
  js/app.js             state + โหลด/บันทึกด่าน
  js/engine/            กระดาน: viewport, palette, canvas, interaction (ลาก/ต่อสาย)
  js/ui/                inspector (แผงขวา), modals (ตรวจ/ส่งออก/คำใบ้)
```

## วิธีเปิด

ดับเบิลคลิก `frontend/index.html` ได้เลย (ใช้ `<script>` แบบธรรมดา ไม่ใช่ ES module จึงโหลดจาก `file://` ได้) หรือเปิดผ่าน local server:

```bash
python -m http.server 5173
```

แล้วเข้า http://localhost:5173/frontend/

## เพิ่มด่านใหม่

เพิ่ม object ใน `shared/levels.js` พร้อม `checks` — ชนิด check ที่ใช้ได้อธิบายไว้หัวไฟล์ `shared/checker.js`

## AI Coach (ทางเลือก) — ใช้ Google Antigravity SDK

หลังส่งตรวจแล้วยังไม่ผ่าน จะมีปุ่ม "🧑‍🏫 ขอคำแนะนำจาก AI" โค้ชจะดู flow + ผลตรวจ แล้วให้คำใบ้ (ยิ่งส่งตรวจหลายครั้ง คำใบ้ยิ่งชัด) ถ้าไม่เปิด backend ปุ่มนี้จะแจ้งให้ใช้คำใบ้ปกติ ส่วนอื่นของแอปทำงานเหมือนเดิม

```
backend/
  server.py             Starlette: GET /health, POST /coach (ผูก 127.0.0.1:8787)
  coach.py              สร้าง prompt + เรียก Agent ของ SDK (ตอบเป็น schema CoachReply)
  test_backend.py       ทดสอบโดยไม่เรียกโมเดลจริง
```

**ติดตั้ง (ครั้งแรก)** — ติดตั้งจากไฟล์ wheel ในเครื่อง ไม่ต้องโหลดจากอินเทอร์เน็ต:

```bash
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install --no-index --find-links "C:\WORK\Google Antigravity SDK\wheels" google-antigravity
```

**ตั้งค่า API key** — สร้างไฟล์ `backend/.env` (ถูก gitignore แล้ว) ใส่บรรทัดเดียว โดยขอ key ที่ https://aistudio.google.com/app/api-keys

```
GEMINI_API_KEY=ใส่คีย์ของคุณ
```

**เปิด backend**

```bash
backend/.venv/Scripts/python.exe -m uvicorn server:app --app-dir backend --host 127.0.0.1 --port 8787
```

**ทดสอบ**

```bash
cd backend
.venv/Scripts/python.exe -m unittest test_backend -v
```

**ความปลอดภัย:** agent ถูกจำกัดให้มี tool เดียวคือ `finish` (ปิดไฟล์/คำสั่ง/เว็บ/subagent) เพราะข้อความใน flow มาจากผู้เรียน, จำกัดงบ token และขนาดอินพุต, และ backend ไม่ส่งรายละเอียด error ภายในออกไป การเรียกโมเดลมีค่าใช้จ่ายตามการใช้งาน

## ต่อ backend ภายหลัง

เขียน object ที่มีเมธอดเดียวกับ `LocalApi` ใน `frontend/js/api/storage.js` (`getLevels`, `loadFlow`, `saveFlow`, `checkLevel`, `getProgress`) ที่เรียก `fetch()` แทน แล้วเปลี่ยน `const Api = ...` บรรทัดสุดท้าย ส่วน UI ไม่ต้องแก้

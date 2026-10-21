# Workflow Automation Lab

## โครงสร้าง

```
shared/                 ข้อมูล + ตรรกะที่ไม่แตะหน้าเว็บ (ใช้ซ้ำฝั่ง backend ได้ด้วย require())
  variables.js          คำอธิบายตัวแปร {{...}}
  blocks.js             BLOCK_CATALOG — ชนิดบล็อกทั้งหมด
  levels.js             รวมด่านทั้งหมดเป็น LEVELS + TRACKS (5 สาย, 30 ด่าน)
  levels/               ไฟล์ด่านแยกตามสาย: core, basics, conditions, data, ai, cases (+ _helpers.js)
  checker.js            checkFlow / deriveChecks / checkPrediction — ระบบตรวจคำตอบ
  simulator.js          simulateFlow — จำลองการทำงานของ flow (ปุ่ม ▶)
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

1. เพิ่ม object ด่านในไฟล์ของสายที่เกี่ยวข้อง `shared/levels/<สาย>.js` (ใช้ `node(...)` / `link(...)` ช่วยวางบล็อกและต่อสาย ดูตัวอย่างใน `basics.js`) ใส่ `template` (เฉลย) — ระบบจะ**สร้าง checks จากเฉลยให้เอง** ถ้าต้องการข้อตรวจเพิ่มใส่ `extraChecks` หรือเขียน `checks` ทั้งหมดเอง (ชนิด check ดูหัวไฟล์ `shared/checker.js`)
2. เพิ่ม id ของด่านใน `TRACKS` ที่ `shared/levels.js`
3. เพิ่ม `<script>` ของไฟล์ใหม่ (ถ้าสร้างไฟล์สายใหม่) ใน `frontend/index.html`
4. รัน `node tests/levels.test.js` — ต้องผ่านทั้งหมด (เฉลยต้องผ่าน, โจทย์เริ่มต้นต้องไม่ผ่าน, เฉลยรันจำลองแล้วไม่มีคำเตือน)

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

**ล็อกอินด้วยบัญชี Google (Vertex AI Standard Mode — ไม่ใช้ API key)**

1. ติดตั้ง [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) (ต้องมีคำสั่ง `gcloud`)
2. มี Google Cloud Project ที่เปิดใช้ Vertex AI API และบัญชีของคุณมีสิทธิ์ใช้ (เช่น role `Vertex AI User`) — การเรียกโมเดลคิดค่าใช้จ่ายกับ project นี้
3. ล็อกอิน (เปิดเบราว์เซอร์ให้ Sign in) แล้วตั้งค่า project

```bash
gcloud auth application-default login
```

4. สร้างไฟล์ `backend/.env` (ถูก gitignore แล้ว) — ไม่มีรหัสผ่านหรือคีย์อยู่ในไฟล์นี้

```
GOOGLE_CLOUD_PROJECT=รหัส-project-ของคุณ
GOOGLE_CLOUD_LOCATION=us-central1
```

backend จะอ่านไฟล์ล็อกอินที่ gcloud สร้างไว้ (`%APPDATA%\gcloud\application_default_credentials.json`) ตรวจสถานะได้ที่ `GET http://127.0.0.1:8787/health` (`reason` = `no_login` หรือ `no_project` ถ้ายังไม่พร้อม)
**เปิด backend**

```bash
backend/.venv/Scripts/python.exe -m uvicorn server:app --app-dir backend --host 127.0.0.1 --port 8787
```

**ทดสอบ**

```bash
cd backend
.venv/Scripts/python.exe -m unittest test_backend -v
```

**ความปลอดภัย:** agent ถูกจำกัดให้มี tool เดียวคือ `finish` (ปิดไฟล์/คำสั่ง/เว็บ/subagent) เพราะข้อความใน flow มาจากผู้เรียน, จำกัดงบ token และขนาดอินพุต, และ backend ไม่ส่งรายละเอียด error ภายในออกไป การเรียกโมเดลมีค่าใช้จ่ายตามการใช้งานกับ Google Cloud project ที่ตั้งไว้ ไม่มี API key หรือรหัสผ่านถูกเก็บในโปรเจกต์ (ไฟล์ล็อกอินอยู่ในโฟลเดอร์ของผู้ใช้ที่ gcloud สร้างให้)

## ต่อ backend ภายหลัง

เขียน object ที่มีเมธอดเดียวกับ `LocalApi` ใน `frontend/js/api/storage.js` (`getLevels`, `loadFlow`, `saveFlow`, `checkLevel`, `getProgress`) ที่เรียก `fetch()` แทน แล้วเปลี่ยน `const Api = ...` บรรทัดสุดท้าย ส่วน UI ไม่ต้องแก้

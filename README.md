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

## AI Coach (ทางเลือก)

หลังส่งตรวจแล้วยังไม่ผ่าน จะมีปุ่ม "🧑‍🏫 ขอคำแนะนำจาก AI" โค้ชจะดู flow + ผลตรวจ แล้วให้คำใบ้ (ยิ่งส่งตรวจหลายครั้ง คำใบ้ยิ่งชัด) ถ้าไม่เปิด backend ปุ่มนี้จะแจ้งให้ใช้คำใบ้ปกติ ส่วนอื่นของแอปทำงานเหมือนเดิม

```
backend/
  server.py             Starlette: GET /health, POST /coach (ผูก 127.0.0.1:8787)
  coach.py              สร้าง prompt + เรียกโมเดล (เลือกผู้ให้บริการอัตโนมัติ) ตอบเป็น schema CoachReply
  test_backend.py       ทดสอบโดยไม่เรียกโมเดลจริง
.env                    ค่าตั้งค่าและ API key (ถูก gitignore) — ดูรูปแบบใน .env.example
```

**ผู้ให้บริการ AI** เลือกอัตโนมัติ: (1) มี API key → เรียก API ที่เข้ากันได้กับ OpenAI (Thirx) (2) ไม่มี key แต่ล็อกอิน Google + ตั้ง project → Vertex AI ผ่าน Google Antigravity SDK

**ตั้งค่า (ใช้ API key)** — คัดลอก `.env.example` เป็น `.env` ที่รากโปรเจกต์ แล้วใส่คีย์ของคุณ (ไฟล์นี้ถูก gitignore อย่า commit):

```
THIRX_API_KEY=ใส่คีย์ของคุณ
THIRX_BASE_URL=https://ai.thirx.com/v1
THIRX_MODEL=Qwen3.8-27B-free
```

ใช้ชื่อตัวแปร `OPENAI_API_KEY` / `OPENAI_BASE_URL` แทนได้ ตัวแปรหนึ่งตัวอ่านจากไฟล์ `.env` ที่รากโปรเจกต์ หรือ `backend/.env` หรือ environment ของเครื่อง `THIRX_BASE_URL` ต้องเป็น `https://` (ยกเว้น localhost) เพื่อไม่ให้ส่งคีย์แบบไม่เข้ารหัส

**ติดตั้ง (ครั้งแรก)** — สร้าง venv และติดตั้งจากไฟล์ wheel ของ Antigravity SDK ในเครื่อง (ใช้เฉพาะเส้นทาง Vertex แต่ backend นำเข้าไว้เสมอ):

```bash
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install --no-index --find-links "C:\WORK\Google Antigravity SDK\wheels" google-antigravity
```

**เปิด backend**

```bash
backend/.venv/Scripts/python.exe -m uvicorn server:app --app-dir backend --host 127.0.0.1 --port 8787
```

ตรวจสถานะ: `GET http://127.0.0.1:8787/health` → `ai: true` และ `provider: "openai"` เมื่อพร้อม ถ้าไม่พร้อมจะมี `reason` = `no_api_key` หรือ `no_project` (ไม่แสดงค่าคีย์)

**ทางเลือกสำรอง: Google Login (Vertex AI Standard Mode)** — ไม่ต้องมี key แต่ต้องติดตั้ง [Google Cloud CLI](https://cloud.google.com/sdk/docs/install), ผูก billing กับ project, เปิด Vertex AI API แล้วรัน `gcloud auth application-default login` และตั้ง `GOOGLE_CLOUD_PROJECT` / `GOOGLE_CLOUD_LOCATION` ใน `.env`

**ทดสอบ**

```bash
cd backend
.venv/Scripts/python.exe -m unittest test_backend -v
```

**ความปลอดภัยและข้อมูลส่วนตัว**
- API key อยู่ฝั่ง backend เท่านั้น ไม่ถูกส่งไปหน้าเว็บ ไม่ถูกบันทึกลง log และไม่แสดงใน `/health` (มีเทสต์ยืนยัน)
- เส้นทาง API key เรียกโมเดลแบบแชทธรรมดา **ไม่มี tool ใดๆ** ส่วนเส้นทาง Vertex จำกัด agent ให้มี tool เดียวคือ `finish` (ปิดไฟล์/คำสั่ง/เว็บ/subagent) เพราะข้อความใน flow มาจากผู้เรียน
- ข้อมูลของผู้เรียนถูกห่อด้วยแท็กและสั่งให้ถือเป็น "ข้อมูล" ไม่ใช่คำสั่ง, จำกัดขนาดอินพุตและจำนวนงานพร้อมกัน, และ backend ไม่ส่งรายละเอียด error ภายในออกไป
- **ข้อมูล flow และผลตรวจของผู้เรียนจะถูกส่งไปยังผู้ให้บริการ AI** (`ai.thirx.com` ตามค่าเริ่มต้น) เมื่อกดปุ่มขอคำแนะนำ ควรแจ้งผู้เรียนและอย่าให้ใส่ข้อมูลส่วนตัวจริงในโจทย์ฝึก

## ต่อ backend ภายหลัง

เขียน object ที่มีเมธอดเดียวกับ `LocalApi` ใน `frontend/js/api/storage.js` (`getLevels`, `loadFlow`, `saveFlow`, `checkLevel`, `getProgress`) ที่เรียก `fetch()` แทน แล้วเปลี่ยน `const Api = ...` บรรทัดสุดท้าย ส่วน UI ไม่ต้องแก้

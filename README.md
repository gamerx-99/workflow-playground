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

## ต่อ backend ภายหลัง

เขียน object ที่มีเมธอดเดียวกับ `LocalApi` ใน `frontend/js/api/storage.js` (`getLevels`, `loadFlow`, `saveFlow`, `checkLevel`, `getProgress`) ที่เรียก `fetch()` แทน แล้วเปลี่ยน `const Api = ...` บรรทัดสุดท้าย ส่วน UI ไม่ต้องแก้

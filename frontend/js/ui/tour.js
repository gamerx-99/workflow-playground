// ---------------------------------------------------------
// ONBOARDING TOUR (ทัวร์แนะนำการใช้งานครั้งแรก)
// ---------------------------------------------------------

const TOUR_STEPS = [
  {
    title: '⚡ ยินดีต้อนรับสู่ Workflow Automation Lab!',
    badge: 'เริ่มต้นใช้งาน',
    icon: '👋',
    content: `
      แอปพลิเคชันสำหรับ<b>ฝึกฝน</b>และ<b>ออกแบบ</b>ระบบ Workflow Automation อย่างมืออาชีพ
      <br><br>
      มี 3 มุมมองหลักให้เลือกใช้ที่แถบด้านบน:
      <ul class="list-disc pl-5 mt-2 space-y-1 text-slate-300">
        <li><b>🏠 หน้าแรก:</b> ดูความคืบหน้ารวม 30 ด่านใน 5 สายการเรียนรู้ และกดเล่นต่อ</li>
        <li><b>🎯 โหมดฝึก:</b> แก้โจทย์ automation ตั้งแต่พื้นฐานจนถึงระดับธุรกิจจริง</li>
        <li><b>🎨 โหมดสตูดิโอ:</b> ออกแบบ flow อิสระ บันทึกหลายโปรเจกต์ และสร้างด่านเอง</li>
      </ul>
    `
  },
  {
    title: '📋 แผงโจทย์และคำใบ้เปิดทีละขั้น (แผงซ้าย)',
    badge: 'โหมดฝึก',
    icon: '🎯',
    content: `
      ในโหมดฝึก แผงด้านซ้ายจะมีแท็บ <b>"โจทย์ & คำใบ้"</b> แสดงเป้าหมาย ข้อมูลตัวอย่าง และเงื่อนไขที่ต้องทำให้ผ่าน
      <br><br>
      💡 <b>คำใบ้เปิดทีละขั้น (Progressive Hints):</b>
      <br>
      ระบบจะเปิดคำใบ้ทีละขั้น ไม่สปอยล์ทั้งหมดในคราวเดียว:
      <ul class="list-disc pl-5 mt-1 space-y-0.5 text-slate-300">
        <li>ขั้นที่ 1: แนวคิดหลักและบล็อกที่ต้องใช้</li>
        <li>ขั้นที่ 2: เส้นทางและการต่อสายเชื่อมโยง</li>
        <li>ขั้นที่ 3: ตัวแปรและการตั้งค่าเงื่อนไขละเอียด</li>
      </ul>
    `
  },
  {
    title: '📦 คลังบล็อก (16 ชนิด)',
    badge: 'การสร้าง Flow',
    icon: '🧩',
    content: `
      สลับแท็บไปยัง <b>"คลังบล็อก"</b> ในแผงซ้าย เพื่อเลือกบล็อกที่มีครบทุกประเภท:
      <ul class="list-disc pl-5 mt-2 space-y-1 text-slate-300">
        <li><b>Trigger:</b> ฟอร์ม, แชท LINE, ตั้งเวลา Schedule, Webhook</li>
        <li><b>Logic:</b> เงื่อนไข IF (True/False), Switch แยกสาย, Loop วนลูปข้อมูล</li>
        <li><b>Action & Data:</b> Google Sheets, LINE Message, Telegram, HTTP API</li>
        <li><b>AI & Helper:</b> วิเคราะห์ข้อความด้วย AI, จัดรูปแบบ Formatter</li>
      </ul>
      <span class="text-cyan-300">💡 คลิกที่บล็อกเพื่อเพิ่มลงกลางกระดาน หรือลากวางได้ตามสะดวก!</span>
    `
  },
  {
    title: '🌐 กระดานออกแบบ (Canvas)',
    badge: 'การต่อสาย & ทริค',
    icon: '🔗',
    content: `
      บนกระดาน คุณสามารถจัดวางบล็อกได้อย่างอิสระ:
      <ul class="list-disc pl-5 mt-2 space-y-1 text-slate-300">
        <li><b>การเชื่อมสาย:</b> คลิกจุดวงกลมขาออก (ขวา) ของบล็อกต้นทาง แล้วลากไปคลิกจุดวงกลมขาเข้า (ซ้าย) ของบล็อกปลายทาง</li>
        <li><b>ลบเส้นเชื่อม:</b> คลิกที่เส้นเชื่อมที่ต้องการลบ</li>
        <li><b>ซูม & แพน:</b> ใช้ปุ่ม ➕/➖ หรือกด Spacebar ค้างไว้แล้วคลิกลากเพื่อแพนกระดาน</li>
      </ul>
    `
  },
  {
    title: '⚙️ ตั้งค่าบล็อก & ตัวช่วยแทรกตัวแปร',
    badge: 'Smart Variables',
    icon: '⚡',
    content: `
      เมื่อคลิกที่บล็อกใดๆ บนกระดาน แผงด้านขวาจะแสดงหน้าต่างตั้งค่า:
      <ul class="list-disc pl-5 mt-2 space-y-1 text-slate-300">
        <li>คลิกช่องข้อความที่ต้องการ แล้วกดปุ่มตัวแปรสีฟ้าเพื่อแทรก <code class="text-cyan-300 font-mono-code">{{ตัวแปร}}</code> เข้าช่องทันที</li>
        <li>มีปุ่ม <b>"⚡ เติมตัวแปรแนะนำอัตโนมัติ"</b> สำหรับช่วยตั้งค่าให้ถูกต้องตามมาตรฐาน</li>
      </ul>
    `
  },
  {
    title: '▶ จำลองการทำงาน & ✅ ส่งตรวจด่าน',
    badge: 'การประเมินผล',
    icon: '🚀',
    content: `
      เมื่อต่อ flow เสร็จแล้ว:
      <ul class="list-disc pl-5 mt-2 space-y-1.5 text-slate-300">
        <li><b>▶ จำลองการทำงาน (Run):</b> ป้อนข้อมูลตัวอย่าง (Scenarios) เข้า Trigger แล้วดูข้อมูลไหลผ่านแต่ละบล็อกจริง</li>
        <li><b>✅ ส่งตรวจด่านนี้:</b> ระบบตรวจตามเกณฑ์ทุกข้อ พร้อมแท็บผลตรวจในแผงขวา</li>
        <li><b>🧑‍🏫 AI Coach:</b> หากติดขัด สามารถขอคำแนะนำจาก AI Coach ได้</li>
        <li><b>✨ ดูเฉลย:</b> จะปลดล็อกให้ดูเฉลยตัวอย่างหลังจากพยายามส่งตรวจแล้ว 1 ครั้ง!</li>
      </ul>
    `
  },
  {
    title: '🎨 โหมด Studio & สร้างด่านเอง',
    badge: 'ความสามารถใหม่',
    icon: '🎉',
    content: `
      ในโหมด <b>Studio</b> คุณสามารถ:
      <ul class="list-disc pl-5 mt-2 space-y-1.5 text-slate-300">
        <li>สร้างและบันทึกได้ <b>หลายโปรเจกต์</b> แยกกันอย่างอิสระ</li>
        <li>นำเข้า (Import) และส่งออก (Export) เป็นไฟล์ <b>JSON</b></li>
        <li><b>สร้างด่านแบบฝึกหัดเอง:</b> ออกแบบ flow บนกระดาน แล้วกดปุ่ม <b>"🎓 สร้างด่านแบบฝึกหัด"</b> ระบบจะวิเคราะห์ flow และสร้างเกณฑ์ตรวจ (checks) ให้อัตโนมัติ พร้อมส่งออกให้ผู้อื่นเล่นได้ทันที!</li>
      </ul>
      <br>
      <div class="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-indigo-200 text-center font-semibold">
        พร้อมลุยแล้วหรือยัง? ขอให้สนุกกับการเรียนรู้ Workflow Automation ครับ! 🚀
      </div>
    `
  }
];

let currentTourIndex = 0;

function openTour(startIndex = 0) {
  currentTourIndex = startIndex;
  renderTourStep();
  document.getElementById('tour-modal').classList.remove('hidden');
}

function closeTour() {
  document.getElementById('tour-modal').classList.add('hidden');
  Api.setTourSeen(true);
}

function nextTourStep() {
  if (currentTourIndex < TOUR_STEPS.length - 1) {
    currentTourIndex++;
    renderTourStep();
  } else {
    closeTour();
  }
}

function prevTourStep() {
  if (currentTourIndex > 0) {
    currentTourIndex--;
    renderTourStep();
  }
}

function renderTourStep() {
  const step = TOUR_STEPS[currentTourIndex];
  const isFirst = currentTourIndex === 0;
  const isLast = currentTourIndex === TOUR_STEPS.length - 1;

  document.getElementById('tour-step-badge').textContent = `${step.badge} (${currentTourIndex + 1}/${TOUR_STEPS.length})`;
  document.getElementById('tour-step-icon').textContent = step.icon;
  document.getElementById('tour-step-title').textContent = step.title;
  document.getElementById('tour-step-content').innerHTML = step.content;

  document.getElementById('tour-prev-btn').classList.toggle('hidden', isFirst);
  document.getElementById('tour-next-btn').innerHTML = isLast ? '<span>เสร็จสิ้น / เริ่มใช้งาน 🎉</span>' : '<span>ถัดไป ➔</span>';

  // Render progress dots
  const dotsContainer = document.getElementById('tour-dots');
  dotsContainer.innerHTML = TOUR_STEPS.map((_, i) => `
    <div class="w-2 h-2 rounded-full transition-all ${i === currentTourIndex ? 'w-5 bg-indigo-500' : 'bg-slate-700'}"></div>
  `).join('');
}

async function checkAutoOpenTour() {
  const seen = await Api.isTourSeen();
  if (!seen) {
    setTimeout(() => {
      openTour(0);
    }, 600);
  }
}

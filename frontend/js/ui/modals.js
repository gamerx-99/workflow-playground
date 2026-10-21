// ---------------------------------------------------------
// 11. VARIABLE DIAGNOSTIC CHECKER & EXPORT
// ---------------------------------------------------------
function checkVariablesInFlow() {
  const modal = document.getElementById('var-check-modal');
  const body = document.getElementById('var-check-body');

  if (nodes.length === 0) {
    body.innerHTML = `<div class="p-4 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200">ยังไม่มีบล็อกบนกระดานครับ ลองวางบล็อกก่อนนะ!</div>`;
    modal.classList.remove('hidden');
    return;
  }

  body.innerHTML = nodes.map(node => {
    const def = BLOCK_CATALOG.find(b => b.type === node.type);
    const status = evaluateNodeVariableStatus(node, def);
    return `
      <div class="p-3.5 rounded-xl border ${status.ok ? 'bg-emerald-950/25 border-emerald-500/30' : 'bg-amber-950/35 border-amber-500/40'} flex items-start justify-between gap-3">
        <div class="space-y-1">
          <div class="font-bold text-white flex items-center gap-2">
            <span>${def.icon} [#${node.id}] ${def.title}</span>
            <span class="text-[10px] px-2 py-0.5 rounded ${status.ok ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}">${status.shortBadge}</span>
          </div>
          <p class="text-slate-300 text-[11px]">${status.detail}</p>
        </div>
        ${!status.ok && def.smartPreset ? `
          <button onclick="applySmartPreset(${node.id}); checkVariablesInFlow();"
            class="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold cursor-pointer">
            ⚡ เติมให้อัตโนมัติ
          </button>
        ` : ''}
      </div>
    `;
  }).join('');

  modal.classList.remove('hidden');
}

function closeVarCheckModal() {
  document.getElementById('var-check-modal').classList.add('hidden');
}

async function submitLevelCheck() {
  const allLevels = await Api.getLevels();
  const level = allLevels.find(l => String(l.id) === String(currentLevelId));
  if (!level) return;

  if (level.mode === 'predict') {
    openPredictModal(level);
    return;
  }
  const result = await Api.checkLevel(currentLevelId, { nodes, connections });
  showCheckResult(result);
}

// ตัวเลขคะแนนล่าสุดบนปุ่มส่งตรวจ (ผลละเอียดแจ้งเป็นหน้าต่างหลังส่งตรวจอยู่แล้ว จึงไม่ต้องมีแผง "ผลตรวจ" แยก)
function updateSubmitResultChip(result) {
  const chip = document.getElementById('submit-result-chip');
  if (!chip) return;
  if (!result) {
    chip.classList.add('hidden');
    return;
  }
  chip.textContent = `${result.score}/${result.total}`;
  chip.classList.remove('hidden');
  chip.classList.toggle('text-emerald-200', !!result.passed);
  chip.classList.toggle('text-amber-200', !result.passed);
}

function showCheckResult(result) {
  lastCheckResult = result;
  updateSubmitResultChip(result);
  if (result.passed && !passedLevelIds.includes(currentLevelId)) {
    passedLevelIds.push(currentLevelId);
    renderLevelTabs();
  }
  attemptsByLevel[currentLevelId] = (attemptsByLevel[currentLevelId] || 0) + 1;

  // ปลดล็อกปุ่มดูเฉลยทันทีหลังส่งตรวจ
  const levelObj = LEVELS.find(l => l.id === currentLevelId) || { id: currentLevelId };
  updateTemplateButtonState(levelObj);

  const coachBtn = document.getElementById('coach-btn');
  if (coachBtn) coachBtn.classList.toggle('hidden', result.passed);

  document.getElementById('level-check-header').innerHTML = `
    <div class="flex items-center gap-2.5">
      <span class="text-2xl">${result.passed ? '🎉' : '🧐'}</span>
      <div>
        <h2 class="font-bold text-base ${result.passed ? 'text-emerald-300' : 'text-white'}">
          ${result.passed ? 'ผ่านด่านนี้แล้ว!' : 'ยังไม่ผ่าน — เหลืออีกนิดเดียว'}
        </h2>
        <p class="text-xs text-slate-400">ผ่าน ${result.score} จาก ${result.total} ข้อ</p>
      </div>
    </div>
    <button onclick="closeLevelCheckModal()" class="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold cursor-pointer">✕</button>
  `;

  document.getElementById('level-check-body').innerHTML = `
    <div class="h-2 rounded-full bg-slate-800 overflow-hidden mb-3">
      <div class="h-full ${result.passed ? 'bg-emerald-500' : 'bg-amber-400'}" style="width: ${result.total ? Math.round(result.score / result.total * 100) : 0}%"></div>
    </div>
    ${result.items.map(item => `
      <div class="p-2.5 rounded-xl border ${item.ok ? 'bg-emerald-950/25 border-emerald-500/30' : 'bg-rose-950/30 border-rose-500/40'} flex items-start gap-2.5">
        <span class="shrink-0">${item.ok ? '✅' : '❌'}</span>
        <div class="space-y-0.5">
          <div class="font-semibold ${item.ok ? 'text-emerald-200' : 'text-white'}">${escapeHtml(item.label)}</div>
          ${item.ok ? '' : `<div class="text-[11px] text-rose-200/90">${escapeHtml(item.detail)}</div>`}
        </div>
      </div>
    `).join('')}
    <div id="coach-box" class="hidden"></div>
  `;

  document.getElementById('level-check-modal').classList.remove('hidden');
}

const COACH_FALLBACK_TEXT = {
  offline: 'ยังไม่ได้เปิด backend ของ AI Coach — ใช้ปุ่ม "💡 ดูคำใบ้" ไปก่อนได้ครับ (วิธีเปิดอยู่ใน README หัวข้อ AI Coach)',
  no_api_key: 'เปิด backend แล้ว แต่ยังไม่ได้ตั้ง THIRX_API_KEY ในไฟล์ .env — ดูวิธีใน README หัวข้อ AI Coach หรือใช้ปุ่ม "💡 ดูคำใบ้" ไปก่อนได้ครับ',
  no_project: 'ล็อกอิน Google แล้ว แต่ยังไม่ได้ตั้ง GOOGLE_CLOUD_PROJECT ใน backend/.env — ใช้ปุ่ม "💡 ดูคำใบ้" ไปก่อนได้ครับ',
  auth_failed: 'API key ถูกปฏิเสธโดยผู้ให้บริการ AI (key ผิดหรือหมดอายุ) — ตรวจ THIRX_API_KEY ในไฟล์ .env แล้วเปิด backend ใหม่',
  bad_base_url: 'THIRX_BASE_URL ต้องขึ้นต้นด้วย https:// (เพื่อไม่ให้ส่ง key แบบไม่เข้ารหัส) — แก้ในไฟล์ .env แล้วเปิด backend ใหม่',
  busy: 'โค้ชกำลังช่วยคนอื่นอยู่ ลองใหม่อีกครั้งในอีกสักครู่นะครับ',
  timeout: 'โค้ชใช้เวลานานเกินไป ลองใหม่อีกครั้งนะครับ',
  failed: 'โค้ชตอบไม่ได้ในตอนนี้ ใช้ปุ่ม "💡 ดูคำใบ้" ไปก่อนได้ครับ'
};

async function askCoach() {
  const box = document.getElementById('coach-box');
  const btn = document.getElementById('coach-btn');
  if (box) {
    box.classList.remove('hidden');
    box.innerHTML = '<div class="p-3 rounded-xl bg-violet-950/40 border border-violet-500/30 text-violet-200 animate-pulse">🧑‍🏫 โค้ชกำลังดู flow ของคุณ...</div>';
  }
  if (btn) btn.disabled = true;

  const out = await Api.coach(currentLevelId, { nodes, connections }, lastCheckResult, attemptsByLevel[currentLevelId] || 1);
  if (btn) btn.disabled = false;

  if (!box) return;

  if (!out.ok) {
    box.innerHTML = `<div class="p-3 rounded-xl bg-slate-950 border border-slate-700 text-slate-300">${escapeHtml(COACH_FALLBACK_TEXT[out.reason] || COACH_FALLBACK_TEXT.failed)}</div>`;
    return;
  }

  const r = out.reply;
  box.innerHTML = `
    <div class="p-3.5 rounded-xl bg-violet-950/40 border border-violet-500/40 space-y-2 mt-2">
      <div class="font-bold text-violet-200">🧑‍🏫 คำแนะนำจากโค้ช AI</div>
      <div class="text-slate-200"><b>ตอนนี้:</b> ${escapeHtml(r.diagnosis)}</div>
      <div class="text-slate-100"><b>💡 คำใบ้:</b> ${escapeHtml(r.hint)}</div>
      <div class="text-emerald-200"><b>👉 ลองทำต่อ:</b> ${escapeHtml(r.next_step)}</div>
      <div class="text-[11px] text-slate-400">📚 ${escapeHtml(r.concept)}</div>
    </div>`;
}

function closeLevelCheckModal() {
  document.getElementById('level-check-modal').classList.add('hidden');
}

function toggleHint() {
  // สลับเปิดแผงซ้ายไปยังแท็บโจทย์ & คำใบ้ด้วย
  const leftSidebar = document.getElementById('left-sidebar');
  if (leftSidebar && leftSidebar.classList.contains('hidden')) {
    leftSidebar.classList.remove('hidden');
  }
  switchLeftSidebarTab('mission');
  document.getElementById('hint-banner').classList.toggle('hidden');
}

async function loadTemplateForCurrentLevel() {
  const allLevels = await Api.getLevels();
  const levelObj = allLevels.find(l => String(l.id) === String(currentLevelId));
  const source = levelObj && (levelObj.start || levelObj.template);
  if (!source) return;

  nodes = JSON.parse(JSON.stringify(source.nodes));
  connections = JSON.parse(JSON.stringify(source.connections));
  nextNodeId = Math.max(...nodes.map(n => n.id), 0) + 1;
  selectedNodeId = nodes[0] ? nodes[0].id : null;

  saveCurrentLevelToStorage();
  renderCanvas();
  renderInspector();
  centerCanvasView();
}

function clearCanvasConfirm() {
  nodes = [];
  connections = [];
  selectedNodeId = null;
  nextNodeId = 1;
  saveCurrentLevelToStorage();
  renderCanvas();
  renderInspector();
  centerCanvasView();
}

function openGuideModal() {
  document.getElementById('guide-modal').classList.remove('hidden');
}
function closeGuideModal() {
  document.getElementById('guide-modal').classList.add('hidden');
}

function openExportModal() {
  const levelObj = LEVELS.find(l => l.id === currentLevelId) || { id: currentLevelId, title: 'Workflow' };
  const lines = [];
  lines.push(`=== 📋 ส่งตรวจแบบฝึกหัด Workflow Automation ===`);
  lines.push(`🎯 ด่านที่ทำ: ด่านที่ ${levelObj.id} - ${levelObj.title}`);
  lines.push(`📦 จำนวนบล็อกทั้งหมด: ${nodes.length} บล็อก | จำนวนเส้นเชื่อม: ${connections.length} เส้น`);
  lines.push('');

  if (nodes.length === 0) {
    lines.push(`(ยังไม่มีบล็อกถูกวางบนกระดาน)`);
  } else {
    lines.push(`--- 1. รายละเอียดและการตั้งค่าตัวแปรในแต่ละบล็อก ---`);
    nodes.forEach((n, i) => {
      const def = BLOCK_CATALOG.find(b => b.type === n.type);
      const cfgPairs = Object.entries(n.config || {})
        .filter(([_, v]) => v !== '')
        .map(([k, v]) => `${k}: "${String(v).replace(/\n/g, ' / ')}"`)
        .join(' | ');
      lines.push(`${i + 1}. [#${n.id} ${def ? def.title : n.type}] (${def ? def.badge : ''})`);
      lines.push(`   ⚙️ ตั้งค่า: ${cfgPairs}`);
    });

    lines.push('');
    lines.push(`--- 2. เส้นทางการเชื่อมโยง (Connections) ---`);
    if (connections.length === 0) {
      lines.push(`(ยังไม่มีการลากเส้นเชื่อมระหว่างบล็อก)`);
    } else {
      connections.forEach((c, idx) => {
        const fromNode = nodes.find(n => n.id === c.fromNode);
        const toNode = nodes.find(n => n.id === c.toNode);
        const fromDef = fromNode ? BLOCK_CATALOG.find(b => b.type === fromNode.type) : null;
        const toDef = toNode ? BLOCK_CATALOG.find(b => b.type === toNode.type) : null;

        let branchLabel = '';
        if (c.fromPort === 'true') branchLabel = ' [สายจริง True ✅]';
        if (c.fromPort === 'false') branchLabel = ' [สายเท็จ False ❌]';
        if (c.fromPort === 'route_a') branchLabel = ' [สาย A]';
        if (c.fromPort === 'route_b') branchLabel = ' [สาย B]';
        if (c.fromPort === 'route_c') branchLabel = ' [สาย C]';
        if (c.fromPort === 'each') branchLabel = ' [วนลูปทีละชิ้น]';
        if (c.fromPort === 'done') branchLabel = ' [เมื่อจบ Loop]';

        lines.push(`เส้นที่ ${idx + 1}: [#${c.fromNode} ${fromDef ? fromDef.title : ''}]${branchLabel} ➔ [#${c.toNode} ${toDef ? toDef.title : ''}]`);
      });
    }
  }

  lines.push(`==============================================`);

  document.getElementById('export-textarea').value = lines.join('\n');
  document.getElementById('copy-success-msg').classList.add('hidden');
  document.getElementById('export-modal').classList.remove('hidden');
}

function closeExportModal() {
  document.getElementById('export-modal').classList.add('hidden');
}

function copyExportText() {
  const textarea = document.getElementById('export-textarea');
  textarea.select();
  navigator.clipboard.writeText(textarea.value).then(() => {
    document.getElementById('copy-success-msg').classList.remove('hidden');
  }).catch(() => {
    document.execCommand('copy');
    document.getElementById('copy-success-msg').classList.remove('hidden');
  });
}

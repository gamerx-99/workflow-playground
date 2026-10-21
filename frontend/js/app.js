// ---------------------------------------------------------
// 3. STATE MANAGEMENT
// ---------------------------------------------------------
let currentAppMode = 'home'; // 'home' | 'practice' | 'studio'
let currentLevelId = 1;
let nodes = [];
let connections = [];
let selectedNodeId = null;
let lastFocusedFieldKey = null; // จำว่าผู้ใช้คลิกช่องไหนล่าสุด จะได้แทรกตัวแปรถูกช่อง!
let nextNodeId = 1;

let canvasZoom = 1.0;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let scrollStartLeft = 0;
let scrollStartTop = 0;
let spaceKeyPressed = false;

let draggingNodeId = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

let activeWire = null;
let showCursorRing = true;

let passedLevelIds = [];
let lastRun = null; // ผลจำลองการทำงานล่าสุด (ล้างทิ้งทุกครั้งที่แก้ flow)
let lastCheckResult = null; // ผลส่งตรวจล่าสุด (ใช้ส่งให้ AI Coach)
const attemptsByLevel = {}; // จำนวนครั้งที่ส่งตรวจแล้วยังไม่ผ่าน ต่อด่าน

let leftSidebarTab = 'mission'; // 'mission' | 'palette'
let activeRevealedHintSteps = {}; // จำว่าด่านนี้เปิดคำใบ้ถึงขั้นไหนแล้ว { [levelId]: 1 | 2 | 3 }

const MODE_LABELS = {
  build: '🛠 ต่อเอง',
  fill: '✏️ เติมช่องว่าง',
  debug: '🐞 หาจุดผิด',
  predict: '🔮 ทายผลลัพธ์',
  sandbox: '🧪 อิสระ'
};

const DIFFICULTY_STARS = { 1: '★☆☆', 2: '★★☆', 3: '★★★' };

// ---------------------------------------------------------
// 4. INITIALIZATION & ROUTING
// ---------------------------------------------------------
window.addEventListener('DOMContentLoaded', async () => {
  passedLevelIds = (await Api.getProgress()).passed;

  // ตรวจหาด่านที่ยังไม่ผ่าน
  const resumeId = TRACKS.flatMap(t => t.levelIds).find(id => !passedLevelIds.includes(id));
  currentLevelId = resumeId !== undefined ? resumeId : 1;

  // เริ่มต้นที่หน้าแรก (Home View)
  await switchView('home');

  // ตรวจสอบสถานะการเชื่อมต่อ Backend / บัญชีผู้ใช้ (Phase 5b)
  if (typeof initAuthAndBackendUi === 'function') {
    await initAuthAndBackendUi();
  }

  // ตรวจสอบเปิดทัวร์แนะนำอัตโนมัติหากเป็นการเข้าใช้ครั้งแรก
  await checkAutoOpenTour();

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activeWire) cancelWiring();
    if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      spaceKeyPressed = true;
      const vp = document.getElementById('workspace-viewport');
      if (vp) vp.classList.add('panning');
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId) {
      const activeTag = document.activeElement ? document.activeElement.tagName : '';
      if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA' && activeTag !== 'SELECT') {
        deleteNode(selectedNodeId);
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      spaceKeyPressed = false;
      const vp = document.getElementById('workspace-viewport');
      if (vp && !isPanning) vp.classList.remove('panning');
    }
  });
});

// ---------------------------------------------------------
// VIEW SWITCHER: HOME / PRACTICE / STUDIO
// ---------------------------------------------------------
async function switchView(mode, optLevelId = null) {
  currentAppMode = mode;

  // อัปเดตปุ่ม Nav ด้านบน
  ['home', 'practice', 'studio'].forEach(m => {
    const btn = document.getElementById(`nav-tab-${m}`);
    const mobileBtn = document.getElementById(`mobile-nav-tab-${m}`);
    const isActive = m === mode;
    const activeClasses = 'bg-indigo-600 text-white shadow shadow-indigo-500/30 font-semibold';
    const inactiveClasses = 'text-slate-300 hover:bg-slate-800 hover:text-white font-medium';

    if (btn) {
      btn.className = `px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer ${isActive ? activeClasses : inactiveClasses}`;
    }
    if (mobileBtn) {
      mobileBtn.className = `px-3 py-2 rounded-xl text-xs flex items-center gap-2 transition cursor-pointer ${isActive ? activeClasses : inactiveClasses}`;
    }
  });

  const homeView = document.getElementById('view-home');
  const workspaceView = document.getElementById('view-workspace');
  const practiceControls = document.getElementById('practice-controls');
  const studioControls = document.getElementById('studio-controls');
  const missionBar = document.getElementById('mission-bar');

  if (mode === 'home') {
    closeBlockPopover();
    if (homeView) homeView.classList.remove('hidden');
    if (workspaceView) workspaceView.classList.add('hidden');
    await renderHomeView();
    return;
  }

  // เข้าสู่ Workspace
  if (homeView) homeView.classList.add('hidden');
  if (workspaceView) workspaceView.classList.remove('hidden');

  if (mode === 'practice') {
    if (practiceControls) practiceControls.classList.remove('hidden');
    if (studioControls) studioControls.classList.add('hidden');
    if (missionBar) missionBar.classList.remove('hidden');

    renderPalette();
    const targetId = optLevelId !== null ? optLevelId : currentLevelId;
    await loadLevelState(targetId);
  } else if (mode === 'studio') {
    if (practiceControls) practiceControls.classList.add('hidden');
    if (studioControls) studioControls.classList.remove('hidden');
    if (missionBar) missionBar.classList.add('hidden');

    renderPalette();
    switchLeftSidebarTab('palette'); // Studio ไม่มีโจทย์ — เปิดคลังบล็อกให้เลย (เดิมแผงซ้ายว่างเปล่า)
    await loadStudioProject();
  }

  // จัดตำแหน่งมุมมอง Canvas
  centerCanvasView();
}

function saveCurrentLevelToStorage() {
  lastRun = null;
  if (currentAppMode === 'studio') {
    scheduleStudioAutosave();
  } else {
    Api.saveFlow(currentLevelId, { nodes, connections, nextNodeId });
  }
}

// ---------------------------------------------------------
// PRACTICE MODE LEVEL LOADING & MANAGEMENT
// ---------------------------------------------------------
async function loadLevelState(levelId) {
  cancelWiring();
  currentLevelId = levelId;
  selectedNodeId = null;
  lastFocusedFieldKey = null;

  const allLevels = await Api.getLevels();
  const levelObj = allLevels.find(l => String(l.id) === String(levelId)) || allLevels[0];

  // Header & Mission Bar Labels
  const badgeEl = document.getElementById('level-badge');
  const titleEl = document.getElementById('mission-title');
  const descEl = document.getElementById('mission-desc');
  const modeEl = document.getElementById('level-mode');
  const hintContentEl = document.getElementById('hint-content');

  if (badgeEl) badgeEl.textContent = levelObj.badge || `ด่านที่ ${levelObj.id}`;
  if (titleEl) titleEl.textContent = levelObj.title;
  if (descEl) descEl.textContent = levelObj.desc;
  if (modeEl) modeEl.textContent = MODE_LABELS[levelObj.mode || 'build'];
  if (hintContentEl) hintContentEl.innerHTML = levelHint(levelObj, BLOCK_CATALOG);

  const hintBanner = document.getElementById('hint-banner');
  if (hintBanner) hintBanner.classList.add('hidden');

  // อัปเดตสถานะปุ่มดูเฉลย (Unlock Solution)
  updateTemplateButtonState(levelObj);

  renderLevelTabs(allLevels);
  renderLeftSidebarMissionTab(levelObj);

  lastRun = null;
  if (typeof updateSubmitResultChip === 'function') updateSubmitResultChip(null); // เปลี่ยนด่าน = ล้างคะแนนของด่านก่อนหน้า

  const saved = await Api.loadFlow(levelId);
  const initial = levelObj.start ? JSON.parse(JSON.stringify(levelObj.start)) : { nodes: [], connections: [] };
  nodes = saved ? saved.nodes : initial.nodes;
  connections = saved ? saved.connections : initial.connections;
  nextNodeId = saved ? saved.nextNodeId : Math.max(0, ...nodes.map(n => n.id)) + 1;

  renderCanvas();
  renderInspector();
  centerCanvasView(); // เปิดด่านแล้วเริ่มที่กึ่งกลางของงาน
}

// ปลดล็อกเฉลยเมื่อพยายามส่งตรวจแล้วอย่างน้อย 1 ครั้ง หรือผ่านแล้ว
function isSolutionUnlocked(levelId) {
  return passedLevelIds.includes(levelId) || (attemptsByLevel[levelId] && attemptsByLevel[levelId] > 0);
}

function updateTemplateButtonState(levelObj) {
  const btn = document.getElementById('template-btn');
  if (!btn) return;

  const isStartMode = !!levelObj.start;
  const unlocked = isSolutionUnlocked(levelObj.id);

  // ปุ่มเป็นไอคอนล้วน (class "tip" ใน index.html) — รายละเอียดแสดงเป็น tooltip ตอนชี้เมาส์
  const base = 'tip w-8 h-8 rounded-lg border text-sm transition cursor-pointer flex items-center justify-center';
  const setBtn = (icon, label, tip, colors) => {
    btn.textContent = icon;
    btn.setAttribute('aria-label', label);
    btn.setAttribute('data-tip', `${label}\n${tip}`);
    btn.setAttribute('data-tip-edge', 'right');
    btn.className = `${base} ${colors}`;
  };

  if (isStartMode) {
    setBtn('↺', 'เริ่มโจทย์ใหม่', 'รีเซ็ตกระดานกลับไปยังโจทย์เริ่มต้น', 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700');
  } else if (unlocked) {
    setBtn('✨', 'วางเฉลยตัวอย่าง', 'วาง flow เฉลยของด่านนี้ลงกระดาน (ปลดล็อกแล้ว)', 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40');
  } else {
    setBtn('🔒', 'ดูเฉลย (ล็อกอยู่)', 'ปลดล็อกหลังกดส่งตรวจด่านนี้อย่างน้อย 1 ครั้ง', 'bg-slate-800/80 text-slate-400 border-slate-700');
  }
}

// เมื่อกดปุ่มดูเฉลย
function handleTemplateBtnClick() {
  const levelObj = LEVELS.find(l => l.id === currentLevelId) || (nodes.length ? { id: currentLevelId } : null);
  if (!levelObj) return;

  if (levelObj.start) {
    // รีเซ็ตโจทย์เริ่มต้น
    loadTemplateForCurrentLevel();
    return;
  }

  if (!isSolutionUnlocked(currentLevelId)) {
    alert('💡 เพื่อประโยชน์ในการเรียนรู้สูงสุด ขอให้ลองวางบล็อกแล้วกดปุ่ม "✅ ส่งตรวจด่านนี้" ดูก่อนสัก 1 ครั้งนะครับ แล้วระบบจะปลดล็อกเฉลยให้ทันทีครับ!');
    return;
  }

  if (confirm('คุณต้องการวาง Flow เฉลยตัวอย่างลงบนกระดานใช่หรือไม่?')) {
    loadTemplateForCurrentLevel();
  }
}

// ---------------------------------------------------------
// LEFT SIDEBAR TABS: MISSION & PALETTE
// ---------------------------------------------------------
function switchLeftSidebarTab(tab) {
  leftSidebarTab = tab;
  const missionTabBtn = document.getElementById('tab-btn-mission');
  const paletteTabBtn = document.getElementById('tab-btn-palette');
  const missionSection = document.getElementById('mission-sidebar-content');
  const paletteSection = document.getElementById('palette-sidebar-content');

  const activeCls = 'border-b-2 border-indigo-500 text-white font-bold bg-slate-900/60';
  const inactiveCls = 'text-slate-400 hover:text-slate-200 font-medium';

  if (missionTabBtn) missionTabBtn.className = `flex-1 py-2 text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${tab === 'mission' ? activeCls : inactiveCls}`;
  if (paletteTabBtn) paletteTabBtn.className = `flex-1 py-2 text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${tab === 'palette' ? activeCls : inactiveCls}`;

  if (missionSection) missionSection.classList.toggle('hidden', tab !== 'mission');
  if (paletteSection) paletteSection.classList.toggle('hidden', tab !== 'palette');
}

// เรนเดอร์แท็บโจทย์ & คำใบ้เปิดทีละขั้นในแผงซ้าย
async function renderLeftSidebarMissionTab(levelObj) {
  const container = document.getElementById('mission-sidebar-content');
  if (!container) return;

  const currentStep = activeRevealedHintSteps[levelObj.id] || 1;
  const hints = typeof getProgressiveHints === 'function' ? getProgressiveHints(levelObj, BLOCK_CATALOG) : [];

  container.innerHTML = `
    <div class="p-3.5 space-y-4 text-xs">
      
      <!-- MISSION CARD -->
      <div class="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            ${levelObj.badge || `ด่านที่ ${levelObj.id}`}
          </span>
          <span class="text-amber-300 text-[10px]">${DIFFICULTY_STARS[levelObj.difficulty || 1]}</span>
        </div>
        <h4 class="font-bold text-white text-sm leading-snug">${escapeHtml(levelObj.title)}</h4>
        <p class="text-slate-300 leading-relaxed text-[11px]">${escapeHtml(levelObj.desc)}</p>
      </div>

      <!-- PROGRESSIVE HINTS ACCORDION -->
      <div class="space-y-2 pt-1">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-amber-300 flex items-center gap-1">
            <span>💡</span> คำใบ้เปิดทีละขั้น
          </span>
          <span class="text-[10px] text-slate-400">ขั้น ${currentStep}/3</span>
        </div>

        <div class="space-y-2">
          ${hints.map((h, idx) => {
            const stepNum = idx + 1;
            const isRevealed = stepNum <= currentStep;
            return `
              <div class="rounded-xl border transition-all duration-200 overflow-hidden ${
                isRevealed ? 'bg-amber-950/20 border-amber-500/30' : 'bg-slate-950/60 border-slate-800'
              }">
                <div class="p-2.5 flex items-center justify-between gap-2 cursor-pointer" onclick="toggleHintStep(${levelObj.id}, ${stepNum})">
                  <div class="flex items-center gap-2">
                    <span class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isRevealed ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-500'
                    }">${stepNum}</span>
                    <span class="font-semibold text-[11px] ${isRevealed ? 'text-amber-200' : 'text-slate-400'}">${escapeHtml(h.title)}</span>
                  </div>
                  <span class="text-xs text-slate-500">${isRevealed ? '▼' : '🔒'}</span>
                </div>
                ${isRevealed ? `
                  <div class="px-3 pb-3 text-[11px] text-slate-300 leading-relaxed border-t border-amber-500/10 pt-2">
                    ${h.text}
                  </div>
                ` : `
                  <div class="px-3 pb-2.5 text-[10px] text-slate-500 flex items-center justify-between">
                    <span>ยังไม่เปิดคำใบ้ขั้นนี้</span>
                    <button onclick="revealNextHintStep(${levelObj.id}, ${stepNum})" class="text-amber-400 hover:text-amber-300 font-semibold cursor-pointer">
                      🔓 เปิดดูขั้นที่ ${stepNum}
                    </button>
                  </div>
                `}
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- SHORTCUTS & HINTS -->
      <div class="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5 text-[11px] text-slate-400">
        <div class="font-semibold text-cyan-300">🎯 เคล็ดลับด่านนี้:</div>
        <div>• คลิกที่บล็อกเพื่อเปิดตัวช่วยแทรกตัวแปรในแผงขวา</div>
        <div>• เมื่อต่อสายเสร็จ กดปุ่ม <b>"▶ จำลองการทำงาน"</b> เพื่อดูการไหลของข้อมูล</div>
      </div>

    </div>
  `;
}

function revealNextHintStep(levelId, step) {
  activeRevealedHintSteps[levelId] = step;
  const levelObj = LEVELS.find(l => l.id === levelId) || { id: levelId };
  renderLeftSidebarMissionTab(levelObj);
}

function toggleHintStep(levelId, step) {
  const cur = activeRevealedHintSteps[levelId] || 1;
  if (step <= cur) {
    // toggle between hiding higher steps
    activeRevealedHintSteps[levelId] = step > 1 ? step - 1 : 1;
  } else {
    activeRevealedHintSteps[levelId] = step;
  }
  const levelObj = LEVELS.find(l => l.id === levelId) || { id: levelId };
  renderLeftSidebarMissionTab(levelObj);
}


// ---------------------------------------------------------
// LEVEL NAVIGATION
// ---------------------------------------------------------
function adjacentLevelId(step, allLevels) {
  const levels = allLevels || LEVELS;
  const order = TRACKS.flatMap(t => t.levelIds);
  const next = order[order.indexOf(currentLevelId) + step];
  return next === undefined ? null : next;
}

function renderLevelTabs(allLevels) {
  const container = document.getElementById('level-tabs');
  if (!container) return;

  const levels = allLevels || LEVELS;
  const level = levels.find(l => String(l.id) === String(currentLevelId)) || levels[0];
  const prev = adjacentLevelId(-1, levels);
  const next = adjacentLevelId(1, levels);

  const navBtn = (id, label) => `
    <button ${id === null ? 'disabled' : `onclick="loadLevelState(${typeof id === 'string' ? `'${id}'` : id})"`}
      class="w-7 h-7 rounded-lg text-xs ${id === null ? 'text-slate-700' : 'text-slate-300 hover:bg-slate-800 cursor-pointer'}">${label}</button>`;

  container.innerHTML = `
    ${navBtn(prev, '◀')}
    <button onclick="openLevelPicker()" title="เลือกด่าน"
      class="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-600 text-white shadow shadow-indigo-500/30 cursor-pointer max-w-[200px] truncate">
      ${passedLevelIds.includes(level.id) ? '✅ ' : ''}${escapeHtml(level.shortName || level.title)} ▾
    </button>
    ${navBtn(next, '▶')}
    <span class="text-[10px] text-slate-500 px-1.5 hidden md:inline">ผ่าน ${passedLevelIds.length}/${LEVELS.length}</span>`;
}

// หน้าต่างเลือกด่าน แบ่งตามสาย (+ สาย Custom หากมี)
async function openLevelPicker() {
  const body = document.getElementById('level-picker-body');
  const allLevels = await Api.getLevels();
  const customLevels = await Api.getCustomLevels();

  const tracksToDisplay = [...TRACKS];
  if (customLevels.length > 0) {
    tracksToDisplay.push({
      id: 'custom',
      icon: '🎓',
      name: 'ด่านสร้างเอง (Custom)',
      desc: 'ด่านแบบฝึกหัดที่คุณหรือเพื่อนสร้างขึ้นใน Studio',
      levelIds: customLevels.map(l => l.id)
    });
  }

  body.innerHTML = tracksToDisplay.map(track => {
    const levels = track.levelIds.map(id => allLevels.find(l => String(l.id) === String(id))).filter(Boolean);
    const done = levels.filter(l => passedLevelIds.includes(l.id)).length;
    const firstOpen = levels.findIndex(l => !passedLevelIds.includes(l.id));

    return `
      <section class="space-y-2">
        <div class="flex items-center justify-between">
          <h3 class="font-bold text-sm text-white">${track.icon} ${escapeHtml(track.name)}</h3>
          <span class="text-[11px] text-slate-400">${done}/${levels.length} ด่าน</span>
        </div>
        <div class="h-1.5 rounded-full bg-slate-800 overflow-hidden"><div class="h-full bg-emerald-500" style="width:${Math.round(done / (levels.length || 1) * 100)}%"></div></div>
        <p class="text-[11px] text-slate-500">${escapeHtml(track.desc)}</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          ${levels.map((l, i) => {
            const passed = passedLevelIds.includes(l.id);
            const recommended = i === firstOpen;
            const locked = !passed && firstOpen !== -1 && i > firstOpen;
            return `
              <button onclick="pickLevel(${typeof l.id === 'string' ? `'${l.id}'` : l.id})"
                class="text-left p-2.5 rounded-xl border cursor-pointer transition ${
                  String(l.id) === String(currentLevelId) ? 'border-indigo-400 bg-indigo-950/40'
                  : passed ? 'border-emerald-500/30 bg-emerald-950/20 hover:border-emerald-400'
                  : recommended ? 'border-amber-400/60 bg-amber-950/20 hover:border-amber-300'
                  : 'border-slate-800 bg-slate-950 hover:border-slate-600'} ${locked ? 'opacity-60' : ''}">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-xs font-semibold text-white truncate">${passed ? '✅' : locked ? '🔒' : recommended ? '👉' : '▫️'} ${escapeHtml(l.shortName || l.title)}</span>
                  <span class="text-[10px] text-amber-300 shrink-0">${DIFFICULTY_STARS[l.difficulty || 1]}</span>
                </div>
                <div class="text-[10px] text-indigo-300 mt-0.5">${MODE_LABELS[l.mode || 'build']}</div>
                <div class="text-[11px] text-slate-400 mt-0.5 line-clamp-2">${escapeHtml(l.title)}</div>
              </button>`;
          }).join('')}
        </div>
      </section>`;
  }).join('');

  document.getElementById('level-picker-modal').classList.remove('hidden');
}

function closeLevelPicker() {
  document.getElementById('level-picker-modal').classList.add('hidden');
}

function pickLevel(id) {
  closeLevelPicker();
  loadLevelState(id);
}

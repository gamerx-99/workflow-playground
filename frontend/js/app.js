// ---------------------------------------------------------
// 3. STATE MANAGEMENT
// ---------------------------------------------------------
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
const attemptsByLevel = {}; // จำนวนครั้งที่ส่งตรวจแล้วยังไม่ผ่าน ต่อด่าน — ยิ่งหลายครั้งโค้ชยิ่งบอกชัดขึ้น

const MODE_LABELS = {
  build: '🛠 ต่อเอง',
  fill: '✏️ เติมช่องว่าง',
  debug: '🐞 หาจุดผิด',
  predict: '🔮 ทายผลลัพธ์',
  sandbox: '🧪 อิสระ'
};

// ---------------------------------------------------------
// 4. INITIALIZATION
// ---------------------------------------------------------
window.addEventListener('DOMContentLoaded', async () => {
  passedLevelIds = (await Api.getProgress()).passed;
  renderLevelTabs();
  renderPalette();
  // เปิดมาที่ด่านแรกที่ยังไม่ผ่าน (ตามลำดับสาย) — ถ้าผ่านหมดแล้วเริ่มที่ด่านแรก
  const resumeId = TRACKS.flatMap(t => t.levelIds).find(id => !passedLevelIds.includes(id));
  loadLevelState(resumeId !== undefined ? resumeId : 1);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activeWire) cancelWiring();
    if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      spaceKeyPressed = true;
      document.getElementById('workspace-viewport').classList.add('panning');
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
      if (!isPanning) document.getElementById('workspace-viewport').classList.remove('panning');
    }
  });
});

function saveCurrentLevelToStorage() {
  lastRun = null;
  Api.saveFlow(currentLevelId, { nodes, connections, nextNodeId });
}

async function loadLevelState(levelId) {
  cancelWiring();
  currentLevelId = levelId;
  selectedNodeId = null;
  lastFocusedFieldKey = null;

  const levelObj = LEVELS.find(l => l.id === levelId);
  document.getElementById('level-badge').textContent = levelObj.badge;
  document.getElementById('mission-title').textContent = levelObj.title;
  document.getElementById('mission-desc').textContent = levelObj.desc;
  document.getElementById('hint-content').innerHTML = levelHint(levelObj, BLOCK_CATALOG);
  document.getElementById('hint-banner').classList.add('hidden');

  renderLevelTabs();

  lastRun = null;
  document.getElementById('level-mode').textContent = MODE_LABELS[levelObj.mode || 'build'];
  document.getElementById('template-btn').textContent = levelObj.start ? '↺ เริ่มโจทย์ใหม่' : '✨ วางโครงตัวอย่าง';

  const saved = await Api.loadFlow(levelId);
  const initial = levelObj.start ? JSON.parse(JSON.stringify(levelObj.start)) : { nodes: [], connections: [] };
  nodes = saved ? saved.nodes : initial.nodes;
  connections = saved ? saved.connections : initial.connections;
  nextNodeId = saved ? saved.nextNodeId : Math.max(0, ...nodes.map(n => n.id)) + 1;

  renderCanvas();
  renderInspector();
}

// ด่านถัดไป/ก่อนหน้าตามลำดับในสาย (ข้ามสายเมื่อถึงปลายสาย)
function adjacentLevelId(step) {
  const order = TRACKS.flatMap(t => t.levelIds);
  const next = order[order.indexOf(currentLevelId) + step];
  return next === undefined ? null : next;
}

function renderLevelTabs() {
  const container = document.getElementById('level-tabs');
  const level = LEVELS.find(l => l.id === currentLevelId);
  const prev = adjacentLevelId(-1);
  const next = adjacentLevelId(1);
  const navBtn = (id, label) => `
    <button ${id === null ? 'disabled' : `onclick="loadLevelState(${id})"`}
      class="w-7 h-7 rounded-lg text-xs ${id === null ? 'text-slate-700' : 'text-slate-300 hover:bg-slate-800 cursor-pointer'}">${label}</button>`;

  container.innerHTML = `
    ${navBtn(prev, '◀')}
    <button onclick="openLevelPicker()" title="เลือกด่าน"
      class="px-3 py-1 rounded-lg text-xs font-semibold bg-indigo-600 text-white shadow shadow-indigo-500/30 cursor-pointer max-w-[260px] truncate">
      ${passedLevelIds.includes(level.id) ? '✅ ' : ''}${escapeHtml(level.shortName)} ▾
    </button>
    ${navBtn(next, '▶')}
    <span class="text-[10px] text-slate-500 px-1.5 hidden md:inline">ผ่านแล้ว ${passedLevelIds.length}/${LEVELS.length}</span>`;
}

const DIFFICULTY_STARS = { 1: '★☆☆', 2: '★★☆', 3: '★★★' };

// หน้าต่างเลือกด่าน แบ่งตามสาย (ปลดล็อกแบบแนะนำ: ด่านที่ยังไม่ถึงลำดับขึ้น 🔒 แต่ยังกดเข้าได้)
function openLevelPicker() {
  const body = document.getElementById('level-picker-body');
  body.innerHTML = TRACKS.map(track => {
    const levels = track.levelIds.map(id => LEVELS.find(l => l.id === id));
    const done = levels.filter(l => passedLevelIds.includes(l.id)).length;
    const firstOpen = levels.findIndex(l => !passedLevelIds.includes(l.id));
    return `
      <section class="space-y-2">
        <div class="flex items-center justify-between">
          <h3 class="font-bold text-sm text-white">${track.icon} ${escapeHtml(track.name)}</h3>
          <span class="text-[11px] text-slate-400">${done}/${levels.length} ด่าน</span>
        </div>
        <div class="h-1.5 rounded-full bg-slate-800 overflow-hidden"><div class="h-full bg-emerald-500" style="width:${Math.round(done / levels.length * 100)}%"></div></div>
        <p class="text-[11px] text-slate-500">${escapeHtml(track.desc)}</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          ${levels.map((l, i) => {
            const passed = passedLevelIds.includes(l.id);
            const recommended = i === firstOpen;
            const locked = !passed && firstOpen !== -1 && i > firstOpen;
            return `
              <button onclick="pickLevel(${l.id})"
                class="text-left p-2.5 rounded-xl border cursor-pointer transition ${
                  l.id === currentLevelId ? 'border-indigo-400 bg-indigo-950/40'
                  : passed ? 'border-emerald-500/30 bg-emerald-950/20 hover:border-emerald-400'
                  : recommended ? 'border-amber-400/60 bg-amber-950/20 hover:border-amber-300'
                  : 'border-slate-800 bg-slate-950 hover:border-slate-600'} ${locked ? 'opacity-60' : ''}">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-xs font-semibold text-white truncate">${passed ? '✅' : locked ? '🔒' : recommended ? '👉' : '▫️'} ${escapeHtml(l.shortName)}</span>
                  <span class="text-[10px] text-amber-300 shrink-0">${DIFFICULTY_STARS[l.difficulty]}</span>
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

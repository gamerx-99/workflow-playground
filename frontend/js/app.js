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
  loadLevelState(2); // เปิดมาที่ด่าน 2 หรือด่านที่กำลังทำต่อได้เลย

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
  document.getElementById('hint-content').innerHTML = levelObj.hint;
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

function renderLevelTabs() {
  const container = document.getElementById('level-tabs');
  container.innerHTML = LEVELS.map(lvl => {
    const active = lvl.id === currentLevelId;
    const passed = passedLevelIds.includes(lvl.id);
    return `
      <button onclick="loadLevelState(${lvl.id})"
        class="px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
          active
            ? 'bg-indigo-600 text-white shadow shadow-indigo-500/30'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
        }">
        ${passed ? '✅ ' : ''}${lvl.shortName}
      </button>
    `;
  }).join('');
}

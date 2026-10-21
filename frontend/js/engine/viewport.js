// ---------------------------------------------------------
// 5. SIDEBAR TOGGLES & ZOOM / PAN & RESPONSIVE
// ---------------------------------------------------------
function toggleLeftPanel() {
  document.getElementById('left-sidebar').classList.toggle('hidden');
}

function toggleMobileNav() {
  const nav = document.getElementById('mobile-nav');
  if (nav) nav.classList.toggle('hidden');
}

const CANVAS_WORLD_WIDTH = 3000;
const CANVAS_WORLD_HEIGHT = 2000;
const NODE_FALLBACK_SIZE = { w: 250, h: 130 };

// จุดกึ่งกลางของพื้นที่ที่มองเห็นอยู่ ในพิกัดของกระดาน (world) — ใช้ซูมโดยไม่เลื่อนภาพ และวางบล็อกใหม่กลางจอ
function viewCenterInWorld() {
  const vp = document.getElementById('workspace-viewport');
  const sizer = document.getElementById('canvas-sizer');
  return {
    x: (vp.scrollLeft + vp.clientWidth / 2 - sizer.offsetLeft) / canvasZoom,
    y: (vp.scrollTop + vp.clientHeight / 2 - sizer.offsetTop) / canvasZoom
  };
}

// เลื่อนมุมมองให้จุด (wx, wy) ของกระดานอยู่กึ่งกลางหน้าจอ
function scrollWorldPointToCenter(wx, wy, smooth = false) {
  const vp = document.getElementById('workspace-viewport');
  const sizer = document.getElementById('canvas-sizer');
  vp.scrollTo({
    left: Math.max(0, Math.round(sizer.offsetLeft + wx * canvasZoom - vp.clientWidth / 2)),
    top: Math.max(0, Math.round(sizer.offsetTop + wy * canvasZoom - vp.clientHeight / 2)),
    behavior: smooth ? 'smooth' : 'auto'
  });
}

// จุดกึ่งกลางของบล็อกทั้งหมดบนกระดาน (ถ้ายังไม่มีบล็อก = กึ่งกลางของกระดานทั้งผืน)
function contentCenterInWorld() {
  if (!nodes.length) return { x: CANVAS_WORLD_WIDTH / 2, y: CANVAS_WORLD_HEIGHT / 2 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  nodes.forEach(n => {
    const el = document.getElementById(`node-el-${n.id}`);
    const w = (el && el.offsetWidth) || NODE_FALLBACK_SIZE.w;
    const h = (el && el.offsetHeight) || NODE_FALLBACK_SIZE.h;
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + w);
    maxY = Math.max(maxY, n.y + h);
  });
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

function changeZoom(delta) {
  const center = viewCenterInWorld();
  canvasZoom = Math.min(1.5, Math.max(0.5, +(canvasZoom + delta).toFixed(2)));
  applyZoom();
  scrollWorldPointToCenter(center.x, center.y); // ซูมแล้วภาพยังอยู่ตรงเดิม ไม่หลุดไปมุมซ้าย
}

function resetZoom() {
  const center = viewCenterInWorld();
  canvasZoom = 1.0;
  applyZoom();
  scrollWorldPointToCenter(center.x, center.y);
}

function applyZoom() {
  const world = document.getElementById('canvas-world');
  world.style.transform = `scale(${canvasZoom})`;
  // ให้พื้นที่เลื่อน (scroll) เท่ากับขนาดที่มองเห็นจริงหลังซูม ไม่เหลือที่ว่างเกินขวา/ล่าง
  const sizer = document.getElementById('canvas-sizer');
  sizer.style.width = `${CANVAS_WORLD_WIDTH * canvasZoom}px`;
  sizer.style.height = `${CANVAS_WORLD_HEIGHT * canvasZoom}px`;
  document.getElementById('zoom-label').textContent = `${Math.round(canvasZoom * 100)}%`;
  renderConnections();
  positionBlockPopover();
}

// ย้ายกลุ่มบล็อกทั้งชุดให้อยู่กึ่งกลางของกระดาน (รักษาตำแหน่งสัมพัทธ์ระหว่างบล็อกไว้เหมือนเดิม)
// จำเป็นเพราะกระดานเริ่มที่มุมซ้ายบน — งานที่วางไว้ใกล้มุมจะเลื่อนมาอยู่กลางจอไม่ได้ ถ้าไม่ย้ายตำแหน่ง
// คืน true ถ้ามีการย้ายจริง
function recenterNodesInWorld() {
  if (!nodes.length) return false;
  const c = contentCenterInWorld();
  const dx = Math.round(CANVAS_WORLD_WIDTH / 2 - c.x);
  const dy = Math.round(CANVAS_WORLD_HEIGHT / 2 - c.y);
  if (dx === 0 && dy === 0) return false;
  nodes.forEach(n => {
    n.x += dx;
    n.y += dy;
  });
  renderCanvas();
  return true;
}

// จัดมุมมองให้อยู่กึ่งกลางของงาน (ถ้ามีบล็อก) หรือกึ่งกลางของกระดาน (ถ้ากระดานว่าง)
// moveNodes = true: ย้ายบล็อกมาไว้กลางกระดานก่อน (ใช้ตอนเปิดด่าน/โปรเจกต์/เฉลย/นำเข้า และปุ่ม "จัดกลาง")
function centerCanvasView(smooth = false, moveNodes = true) {
  const vp = document.getElementById('workspace-viewport');
  if (!vp) return;
  if (!vp.clientWidth) {
    requestAnimationFrame(() => centerCanvasView(smooth, moveNodes)); // มุมมองยังถูกซ่อนอยู่ รอให้แสดงก่อน
    return;
  }
  if (moveNodes) recenterNodesInWorld();
  const c = contentCenterInWorld();
  scrollWorldPointToCenter(c.x, c.y, smooth);
}

// ปุ่ม "จัดกลาง": ผู้ใช้สั่งเอง จึงบันทึกตำแหน่งใหม่ด้วย
function centerCanvasViewByButton() {
  const moved = recenterNodesInWorld();
  if (moved) saveCurrentLevelToStorage();
  const c = contentCenterInWorld();
  scrollWorldPointToCenter(c.x, c.y, true);
}

function toggleCursorHighlight() {
  showCursorRing = !showCursorRing;
  const btn = document.getElementById('cursor-toggle-btn');
  const ring = document.getElementById('custom-cursor-ring');
  const base = 'tip rounded-lg w-8 h-7 text-xs font-medium shadow-lg transition cursor-pointer flex items-center justify-center';
  if (showCursorRing) {
    btn.setAttribute('data-tip', 'เป้าชี้เมาส์: เปิดอยู่\nวงแหวนช่วยให้เห็นตำแหน่งเมาส์บนกระดานชัดขึ้น (คลิกเพื่อปิด)');
    btn.className = `${base} bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/30`;
  } else {
    btn.setAttribute('data-tip', 'เป้าชี้เมาส์: ปิดอยู่\nคลิกเพื่อเปิดวงแหวนชี้ตำแหน่งเมาส์');
    btn.className = `${base} bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700`;
    ring.style.display = 'none';
  }
  btn.setAttribute('data-tip-edge', 'left');
}

function hideCustomCursor() {
  const ring = document.getElementById('custom-cursor-ring');
  if (ring) ring.style.display = 'none';
}

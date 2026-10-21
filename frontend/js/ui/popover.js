// ---------------------------------------------------------
// BLOCK POPOVER — หน้าต่างตั้งค่าบล็อกที่เด้งขึ้นข้างบล็อกที่คลิก (แทนแผงตั้งค่าด้านขวา)
//
// - เนื้อหาคือ renderInspector() เดิม (ช่อง, ปุ่มแทรกตัวแปร, ตัวช่วยเติมอัตโนมัติ) แค่ย้ายมาอยู่ในหน้าต่างลอย
// - ตำแหน่ง: ขวาของบล็อก (ถ้าที่ไม่พอสลับไปซ้าย/ใต้บล็อก) และเลื่อนตามเมื่อบล็อกถูกลาก/กระดานเลื่อน/ซูม
// - ลากที่แถบหัวเพื่อย้ายไปวางที่อื่นได้ (จำตำแหน่งไว้จนกว่าจะเลือกบล็อกอื่น)
// - ปิดด้วยปุ่ม ✕, กด Esc, หรือคลิกพื้นที่ว่างบนกระดาน (ยกเลิกการเลือกบล็อก)
// ---------------------------------------------------------
let popoverNodeId = null;
let popoverManualPos = null; // { left, top } เมื่อผู้ใช้ลากหน้าต่างเอง

const POPOVER_MARGIN = 8;
const POPOVER_GAP = 14;

function isBlockPopoverOpen() {
  const pop = document.getElementById('block-popover');
  return !!pop && !pop.classList.contains('hidden');
}

function openBlockPopover() {
  const pop = document.getElementById('block-popover');
  if (!pop || !selectedNodeId) return;

  const node = nodes.find(n => n.id === selectedNodeId);
  const def = node && BLOCK_CATALOG.find(b => b.type === node.type);
  if (!def) return;

  if (popoverNodeId !== selectedNodeId) popoverManualPos = null; // เลือกบล็อกใหม่ = กลับไปอยู่ข้างบล็อก
  popoverNodeId = selectedNodeId;

  document.getElementById('block-popover-title').textContent = `${def.icon} #${node.id} ${def.title}`;
  pop.classList.remove('hidden');
  positionBlockPopover();
}

function closeBlockPopover() {
  const pop = document.getElementById('block-popover');
  if (pop) pop.classList.add('hidden');
  popoverNodeId = null;
  popoverManualPos = null;
}

function clampToWindow(left, top, width, height) {
  return {
    left: Math.max(POPOVER_MARGIN, Math.min(left, window.innerWidth - width - POPOVER_MARGIN)),
    top: Math.max(POPOVER_MARGIN, Math.min(top, window.innerHeight - height - POPOVER_MARGIN))
  };
}

// วางหน้าต่างให้อยู่ข้างบล็อกที่เลือก โดยไม่ทับบล็อกถ้าเป็นไปได้ และไม่ล้นหน้าจอ
function positionBlockPopover() {
  if (!isBlockPopoverOpen()) return;
  const pop = document.getElementById('block-popover');
  const pw = pop.offsetWidth;
  const ph = pop.offsetHeight;

  if (popoverManualPos) {
    const p = clampToWindow(popoverManualPos.left, popoverManualPos.top, pw, ph);
    pop.style.left = `${p.left}px`;
    pop.style.top = `${p.top}px`;
    return;
  }

  const nodeEl = document.getElementById(`node-el-${selectedNodeId}`);
  if (!nodeEl) return;

  const r = nodeEl.getBoundingClientRect();

  // ตรวจที่ว่างกับ "ขอบหน้าต่างเบราว์เซอร์" (ไม่ใช่ขอบกระดาน) เพราะหน้าต่างตั้งค่าเป็นของลอย
  // จะทับแผงคลังบล็อกด้านซ้ายก็ได้ ดีกว่าไปทับตัวบล็อกที่กำลังแก้อยู่
  let left = r.right + POPOVER_GAP; // 1) ขวาของบล็อก
  let top = r.top;
  if (left + pw > window.innerWidth - POPOVER_MARGIN) {
    left = r.left - POPOVER_GAP - pw; // 2) ซ้ายของบล็อก
  }
  if (left < POPOVER_MARGIN) {
    left = r.left + (r.width - pw) / 2; // 3) สองข้างไม่พอจริงๆ: วางใต้บล็อก (หรือเหนือบล็อกถ้าใต้ไม่พอ)
    top = r.bottom + POPOVER_GAP;
    if (top + ph > window.innerHeight - POPOVER_MARGIN) top = r.top - POPOVER_GAP - ph;
  }

  const p = clampToWindow(left, top, pw, ph);
  pop.style.left = `${p.left}px`;
  pop.style.top = `${p.top}px`;
}

// ---------- ลากที่แถบหัวเพื่อย้ายหน้าต่าง ----------
function initBlockPopover() {
  const header = document.getElementById('block-popover-header');
  const pop = document.getElementById('block-popover');
  const viewport = document.getElementById('workspace-viewport');
  if (!header || !pop) return;

  let drag = null;
  header.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return; // ปุ่มปิดต้องกดได้ตามปกติ
    const rect = pop.getBoundingClientRect();
    drag = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    header.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  header.addEventListener('pointermove', (e) => {
    if (!drag) return;
    popoverManualPos = { left: e.clientX - drag.dx, top: e.clientY - drag.dy };
    positionBlockPopover();
  });
  const endDrag = () => { drag = null; };
  header.addEventListener('pointerup', endDrag);
  header.addEventListener('pointercancel', endDrag);

  window.addEventListener('resize', positionBlockPopover);
  if (viewport) viewport.addEventListener('scroll', positionBlockPopover, { passive: true });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isBlockPopoverOpen() && !activeWire) closeBlockPopover();
  });
}

window.addEventListener('DOMContentLoaded', initBlockPopover);

// ---------------------------------------------------------
// 5. SIDEBAR TOGGLES & ZOOM / PAN
// ---------------------------------------------------------
function toggleLeftPanel() {
  document.getElementById('left-sidebar').classList.toggle('hidden');
}
function toggleRightPanel() {
  document.getElementById('right-sidebar').classList.toggle('hidden');
}
function changeZoom(delta) {
  canvasZoom = Math.min(1.5, Math.max(0.5, +(canvasZoom + delta).toFixed(2)));
  applyZoom();
}
function resetZoom() {
  canvasZoom = 1.0;
  applyZoom();
}
function applyZoom() {
  const world = document.getElementById('canvas-world');
  world.style.transform = `scale(${canvasZoom})`;
  document.getElementById('zoom-label').textContent = `${Math.round(canvasZoom * 100)}%`;
  renderConnections();
}
function centerCanvasView() {
  document.getElementById('workspace-viewport').scrollTo({ left: 0, top: 0, behavior: 'smooth' });
}
function toggleCursorHighlight() {
  showCursorRing = !showCursorRing;
  const btn = document.getElementById('cursor-toggle-btn');
  const ring = document.getElementById('custom-cursor-ring');
  if (showCursorRing) {
    btn.textContent = '🎯 เป้าชี้เมาส์: เปิดอยู่';
    btn.className = 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 rounded-lg px-2.5 py-1 text-xs font-medium shadow-lg hover:bg-cyan-500/30 transition cursor-pointer';
  } else {
    btn.textContent = '🎯 เป้าชี้เมาส์: ปิด';
    btn.className = 'bg-slate-800 border border-slate-700 text-slate-400 rounded-lg px-2.5 py-1 text-xs font-medium shadow-lg hover:bg-slate-700 transition cursor-pointer';
    ring.style.display = 'none';
  }
}
function hideCustomCursor() {
  document.getElementById('custom-cursor-ring').style.display = 'none';
}

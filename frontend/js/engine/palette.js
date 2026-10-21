// ---------------------------------------------------------
// 6. RENDER PALETTE
// ---------------------------------------------------------
function renderPalette() {
  const container = document.getElementById('palette-container');
  const searchVal = (document.getElementById('palette-search')?.value || '').trim().toLowerCase();

  const filtered = BLOCK_CATALOG.filter(b => {
    if (!searchVal) return true;
    return b.title.toLowerCase().includes(searchVal) ||
           b.badge.toLowerCase().includes(searchVal) ||
           b.category.toLowerCase().includes(searchVal);
  });

  const categories = [...new Set(filtered.map(b => b.category))];
  const colorMap = {
    amber: 'border-amber-500/30 hover:border-amber-400 bg-amber-500/5 text-amber-300',
    purple: 'border-purple-500/30 hover:border-purple-400 bg-purple-500/5 text-purple-300',
    cyan: 'border-cyan-500/30 hover:border-cyan-400 bg-cyan-500/5 text-cyan-300',
    sky: 'border-sky-500/30 hover:border-sky-400 bg-sky-500/5 text-sky-300',
    emerald: 'border-emerald-500/30 hover:border-emerald-400 bg-emerald-500/5 text-emerald-300'
  };

  container.innerHTML = categories.map(cat => {
    const items = filtered.filter(b => b.category === cat);
    return `
      <div>
        <div class="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 px-1">${cat}</div>
        <div class="space-y-1.5">
          ${items.map(item => `
            <div draggable="true"
                 ondragstart="onPaletteDragStart(event, '${item.type}')"
                 onclick="addNodeToCanvas('${item.type}')"
                 class="p-2 rounded-xl border ${colorMap[item.color]} cursor-pointer transition flex items-center gap-2.5 group">
              <div class="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center text-base shrink-0 group-hover:scale-110 transition">
                ${item.icon}
              </div>
              <div class="min-w-0 flex-1">
                <div class="text-xs font-semibold text-slate-100 truncate">${item.title}</div>
                <div class="text-[10px] text-slate-400 truncate">${item.badge}</div>
              </div>
              <span class="text-xs opacity-60 group-hover:opacity-100 font-bold">+</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

// ---------------------------------------------------------
// 7. ADD, DUPLICATE, DELETE NODES
// ---------------------------------------------------------
function onPaletteDragStart(e, blockType) {
  e.dataTransfer.setData('text/plain', blockType);
}
function onCanvasDragOver(e) {
  e.preventDefault();
}
function onCanvasDrop(e) {
  e.preventDefault();
  const blockType = e.dataTransfer.getData('text/plain');
  if (!blockType) return;
  const worldRect = document.getElementById('canvas-world').getBoundingClientRect();
  const x = Math.max(20, Math.round((e.clientX - worldRect.left) / canvasZoom - 115));
  const y = Math.max(20, Math.round((e.clientY - worldRect.top) / canvasZoom - 40));
  addNodeToCanvas(blockType, x, y);
}

function addNodeToCanvas(blockType, x, y) {
  const def = BLOCK_CATALOG.find(b => b.type === blockType);
  if (!def) return;

  const vp = document.getElementById('workspace-viewport');
  if (x === undefined || y === undefined) {
    const offset = (nodes.length % 7) * 32;
    x = Math.round((vp.scrollLeft + 100) / canvasZoom) + offset;
    y = Math.round((vp.scrollTop + 120) / canvasZoom) + offset;
  }

  const newNode = {
    id: nextNodeId++,
    type: blockType,
    x,
    y,
    config: JSON.parse(JSON.stringify(def.defaultConfig))
  };

  nodes.push(newNode);
  selectedNodeId = newNode.id;
  lastFocusedFieldKey = def.primaryField || (def.fields[0] ? def.fields[0].key : null);
  saveCurrentLevelToStorage();
  renderCanvas();
  renderInspector();
}

function deleteNode(nodeId, evt) {
  if (evt) evt.stopPropagation();
  nodes = nodes.filter(n => n.id !== nodeId);
  connections = connections.filter(c => c.fromNode !== nodeId && c.toNode !== nodeId);
  if (selectedNodeId === nodeId) {
    selectedNodeId = null;
    lastFocusedFieldKey = null;
  }
  saveCurrentLevelToStorage();
  renderCanvas();
  renderInspector();
}

function duplicateNode(nodeId, evt) {
  if (evt) evt.stopPropagation();
  const orig = nodes.find(n => n.id === nodeId);
  if (!orig) return;
  const def = BLOCK_CATALOG.find(b => b.type === orig.type);
  const copy = {
    id: nextNodeId++,
    type: orig.type,
    x: orig.x + 40,
    y: orig.y + 40,
    config: JSON.parse(JSON.stringify(orig.config))
  };
  nodes.push(copy);
  selectedNodeId = copy.id;
  lastFocusedFieldKey = def ? def.primaryField : null;
  saveCurrentLevelToStorage();
  renderCanvas();
  renderInspector();
}

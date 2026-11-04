// ---------------------------------------------------------
// 9. DRAG, PAN, WIRE EVENTS
// ---------------------------------------------------------
let touchDragNodeId = null;
let touchStartX = 0;
let touchStartY = 0;
let hasTouchMoved = false;
let isWireMode = false;
let suppressNodeClickUntil = 0;

function toggleWireMode(forceState) {
  isWireMode = typeof forceState === 'boolean' ? forceState : !isWireMode;
  updateWireModeUi();

  if (isWireMode) {
    if (selectedNodeId && nodes.some(n => n.id === selectedNodeId)) {
      startWiringFromNode(selectedNodeId);
    } else {
      updateWiringIndicator();
    }
  } else {
    cancelWiring();
  }
}

function updateWireModeUi() {
  const btn = document.getElementById('wire-mode-btn');
  const mobBtn = document.getElementById('mobile-dock-wire-btn');

  if (btn) {
    if (isWireMode) {
      btn.className = 'tip bg-indigo-600 border border-indigo-400 text-white font-semibold rounded-lg px-2.5 py-1 text-xs shadow-lg shadow-indigo-600/40 cursor-pointer flex items-center gap-1.5 animate-pulse';
    } else {
      btn.className = 'tip bg-slate-900/95 backdrop-blur border border-slate-700/80 text-slate-300 hover:text-white rounded-lg px-2 py-1 text-xs font-medium shadow-lg hover:bg-slate-800 transition cursor-pointer flex items-center gap-1';
    }
  }
  if (mobBtn) {
    if (isWireMode) {
      mobBtn.className = 'flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-lg shadow-indigo-600/40 border border-indigo-400 cursor-pointer animate-pulse';
    } else {
      mobBtn.className = 'flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700 cursor-pointer';
    }
  }
}

function startWiringFromNode(nodeId, optPortId = null, evt = null) {
  if (evt) {
    evt.stopPropagation();
    evt.preventDefault();
  }

  const node = nodes.find(n => n.id === nodeId);
  if (!node) return;
  const def = BLOCK_CATALOG.find(b => b.type === node.type);
  if (!def) return;

  const nodeOutputs = typeof getNodeOutputs === 'function' ? getNodeOutputs(node, def) : (def.outputs || []);
  if (!nodeOutputs || nodeOutputs.length === 0) {
    return;
  }

  let chosenPort = optPortId;
  if (!chosenPort) {
    const connectedPorts = new Set(connections.filter(c => c.fromNode === nodeId).map(c => c.fromPort));
    const freePort = nodeOutputs.find(out => !connectedPorts.has(out.id));
    chosenPort = freePort ? freePort.id : nodeOutputs[0].id;
  }

  activeWire = { fromNode: nodeId, fromPort: chosenPort };
  if (typeof closeBlockPopover === 'function') closeBlockPopover();

  updateWiringIndicator();

  const startPos = getPortCenterOnWorld(nodeId, chosenPort);
  const tempWire = document.getElementById('temp-wire');
  if (tempWire && startPos) {
    tempWire.classList.remove('hidden');
    tempWire.setAttribute('d', `M ${startPos.x} ${startPos.y} L ${startPos.x} ${startPos.y}`);
  }

  renderCanvas();
}

function completeWiringToNode(targetNodeId, optTargetPortId = null) {
  if (!activeWire) return false;

  if (activeWire.fromNode === targetNodeId) {
    // แตะบล็อกเดิม -> ยกเลิกการต่อสายถ้าไม่ได้อยู่ใน persistent mode
    if (!isWireMode) cancelWiring();
    return false;
  }

  const targetNode = nodes.find(n => n.id === targetNodeId);
  if (!targetNode) {
    cancelWiring();
    return false;
  }

  const targetDef = BLOCK_CATALOG.find(b => b.type === targetNode.type);
  if (!targetDef || !targetDef.inputs || targetDef.inputs.length === 0) {
    const ind = document.getElementById('wiring-indicator');
    if (ind) {
      ind.innerHTML = `
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-amber-400 font-bold">⚠️ บล็อกจุดเริ่มต้น (Trigger) ไม่สามารถรับสายเข้าได้</span>
        </div>
        <button type="button" onclick="cancelWiring()" class="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-xs">✕ ปิด</button>
      `;
      ind.classList.remove('hidden');
    }
    return false;
  }

  const targetPort = optTargetPortId || targetDef.inputs[0].id;

  const exists = connections.some(c =>
    c.fromNode === activeWire.fromNode &&
    c.fromPort === activeWire.fromPort &&
    c.toNode === targetNodeId &&
    c.toPort === targetPort
  );

  if (!exists) {
    connections.push({
      fromNode: activeWire.fromNode,
      fromPort: activeWire.fromPort,
      toNode: targetNodeId,
      toPort: targetPort
    });
    saveCurrentLevelToStorage();
  }

  if (isWireMode) {
    // โหมดต่อสายต่อเนื่อง: ให้ขยับ targetNode เป็นต้นทางตัวต่อไปทันที (Chaining)
    const targetOutputs = typeof getNodeOutputs === 'function' ? getNodeOutputs(targetNode, targetDef) : (targetDef.outputs || []);
    if (targetOutputs.length > 0) {
      startWiringFromNode(targetNodeId);
    } else {
      cancelWiring();
    }
  } else {
    cancelWiring();
  }

  renderCanvas();
  return true;
}

function setActiveWirePort(portId) {
  if (!activeWire) return;
  activeWire.fromPort = portId;
  updateWiringIndicator();
  const startPos = getPortCenterOnWorld(activeWire.fromNode, portId);
  const tempWire = document.getElementById('temp-wire');
  if (tempWire && startPos) {
    tempWire.setAttribute('d', `M ${startPos.x} ${startPos.y} L ${startPos.x} ${startPos.y}`);
  }
}

function updateWiringIndicator() {
  const ind = document.getElementById('wiring-indicator');
  if (!ind) return;

  if (!activeWire) {
    if (isWireMode) {
      ind.innerHTML = `
        <div class="flex items-center gap-2 min-w-0">
          <span class="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-ping shrink-0"></span>
          <span class="text-xs font-bold text-indigo-300">🔗 โหมดต่อสาย:</span>
          <span class="text-xs text-white truncate">แตะบล็อกที่ 1 (ต้นทาง) เพื่อเริ่มต่อสาย</span>
        </div>
        <button type="button" onclick="toggleWireMode(false)" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold border border-slate-700 cursor-pointer">
          ✕ ปิดโหมด
        </button>
      `;
      ind.classList.remove('hidden');
    } else {
      ind.classList.add('hidden');
    }
    return;
  }

  const fromNode = nodes.find(n => n.id === activeWire.fromNode);
  if (!fromNode) {
    cancelWiring();
    return;
  }

  const def = BLOCK_CATALOG.find(b => b.type === fromNode.type);
  const outputs = def && typeof getNodeOutputs === 'function' ? getNodeOutputs(fromNode, def) : ((def && def.outputs) || []);

  let portSwitcherHtml = '';
  if (outputs.length > 1) {
    portSwitcherHtml = `
      <div class="flex items-center gap-1 bg-slate-950/80 p-0.5 rounded-lg border border-slate-800">
        ${outputs.map(out => {
          const isSelected = out.id === activeWire.fromPort;
          const activeCls = 'bg-indigo-600 text-white font-bold shadow-sm';
          const inactiveCls = 'text-slate-400 hover:text-slate-200 hover:bg-slate-800';
          return `<button type="button" onclick="setActiveWirePort('${out.id}')" class="px-2 py-0.5 rounded text-[10px] transition cursor-pointer ${isSelected ? activeCls : inactiveCls}">${typeof escapeHtml === 'function' ? escapeHtml(out.label) : out.label}</button>`;
        }).join('')}
      </div>
    `;
  }

  ind.innerHTML = `
    <div class="flex items-center gap-2 min-w-0">
      <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0"></span>
      <span class="text-xs font-semibold text-emerald-300 truncate">
        #${fromNode.id} ${typeof escapeHtml === 'function' ? escapeHtml(def ? (def.cleanTitle || def.title) : 'บล็อก') : ''}
      </span>
      <span class="text-slate-400 text-[11px] hidden sm:inline">➜</span>
      <span class="text-xs text-white font-bold truncate">แตะบล็อกปลายทางเพื่อเชื่อมต่อ</span>
    </div>
    <div class="flex items-center gap-2 shrink-0">
      ${portSwitcherHtml}
      <button type="button" onclick="cancelWiring()" class="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[11px] font-semibold cursor-pointer transition">
        ✕ ยกเลิก
      </button>
    </div>
  `;

  ind.classList.remove('hidden');
}

function cancelWiring() {
  activeWire = null;
  const tempWire = document.getElementById('temp-wire');
  if (tempWire) tempWire.classList.add('hidden');
  updateWiringIndicator();
  renderCanvas();
}

function onNodeTouchStart(e, nodeId) {
  if (e.target.closest('.port-dot') || e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) return;
  if (!e.touches || !e.touches[0]) return;

  // ถ้ากำลังต่อสายอยู่ ให้เชื่อมต่อทันทีที่แตะบล็อกเป้าหมาย!
  if (activeWire) {
    e.stopPropagation();
    e.preventDefault();
    suppressNodeClickUntil = Date.now() + 500;
    completeWiringToNode(nodeId);
    return;
  }

  // ถ้าอยู่ใน Wire Mode และยังไม่มี activeWire ให้เริ่มต่อสายจากบล็อกนี้ทันที!
  if (isWireMode) {
    e.stopPropagation();
    e.preventDefault();
    suppressNodeClickUntil = Date.now() + 500;
    startWiringFromNode(nodeId);
    return;
  }

  const touch = e.touches[0];
  touchDragNodeId = nodeId;
  draggingNodeId = nodeId;
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
  hasTouchMoved = false;

  const changedSelection = selectedNodeId !== nodeId;
  selectedNodeId = nodeId;

  const node = nodes.find(n => n.id === nodeId);
  if (!node) return;
  const def = BLOCK_CATALOG.find(b => b.type === node.type);
  if (changedSelection && def) {
    lastFocusedFieldKey = def.primaryField || (def.fields[0] ? def.fields[0].key : null);
  }

  const worldRect = document.getElementById('canvas-world').getBoundingClientRect();
  dragOffsetX = (touch.clientX - worldRect.left) / canvasZoom - node.x;
  dragOffsetY = (touch.clientY - worldRect.top) / canvasZoom - node.y;

  renderCanvas();
}

function onNodeTouchMove(e) {
  if (!touchDragNodeId || !e.touches || !e.touches[0]) return;
  const touch = e.touches[0];

  const dist = Math.hypot(touch.clientX - touchStartX, touch.clientY - touchStartY);
  if (dist > 6) {
    hasTouchMoved = true;
    if (e.cancelable) e.preventDefault(); // ป้องกัน canvas scroll ระหว่างลากบล็อก
  }

  if (!hasTouchMoved) return;

  const worldEl = document.getElementById('canvas-world');
  if (!worldEl) return;
  const worldRect = worldEl.getBoundingClientRect();
  const mouseWorldX = Math.max(0, Math.round((touch.clientX - worldRect.left) / canvasZoom));
  const mouseWorldY = Math.max(0, Math.round((touch.clientY - worldRect.top) / canvasZoom));

  const node = nodes.find(n => n.id === touchDragNodeId);
  if (!node) return;
  node.x = Math.max(16, Math.min(2720, Math.round(mouseWorldX - dragOffsetX)));
  node.y = Math.max(16, Math.min(1850, Math.round(mouseWorldY - dragOffsetY)));

  const nodeEl = document.getElementById(`node-el-${node.id}`);
  if (nodeEl) {
    nodeEl.style.left = `${node.x}px`;
    nodeEl.style.top = `${node.y}px`;
  }
  renderConnections();
  positionBlockPopover();
}

function onNodeTouchEnd(e) {
  if (touchDragNodeId !== null) {
    const wasMoved = hasTouchMoved;
    touchDragNodeId = null;
    draggingNodeId = null;
    hasTouchMoved = false;

    saveCurrentLevelToStorage();

    if (!wasMoved) {
      // แตะที่บล็อก (Tap) โดยไม่ได้ลาก -> สลับเปิด/ปิดหน้าต่างตั้งค่าบล็อก
      renderInspector();
    }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('touchmove', onNodeTouchMove, { passive: false });
  window.addEventListener('touchend', onNodeTouchEnd);
  window.addEventListener('touchcancel', onNodeTouchEnd);
}

function onNodeMouseDown(e, nodeId) {
  if (e.target.closest('.port-dot') || e.target.closest('button')) return;

  // ถ้ากำลังต่อสายอยู่ หรืออยู่ใน Wire Mode ให้ปล่อยให้ onNodeClick จัดการเชื่อมต่อ
  if (activeWire || isWireMode) {
    return;
  }

  e.stopPropagation();

  const changedSelection = selectedNodeId !== nodeId;
  selectedNodeId = nodeId;
  draggingNodeId = nodeId;

  const node = nodes.find(n => n.id === nodeId);
  const def = BLOCK_CATALOG.find(b => b.type === node.type);
  if (changedSelection && def) {
    lastFocusedFieldKey = def.primaryField || (def.fields[0] ? def.fields[0].key : null);
  }

  const worldRect = document.getElementById('canvas-world').getBoundingClientRect();
  dragOffsetX = (e.clientX - worldRect.left) / canvasZoom - node.x;
  dragOffsetY = (e.clientY - worldRect.top) / canvasZoom - node.y;

  renderCanvas();
  if (changedSelection) renderInspector();
}

function onNodeClick(e, nodeId) {
  e.stopPropagation();
  if (Date.now() < suppressNodeClickUntil) {
    suppressNodeClickUntil = 0;
    return;
  }
  if (typeof canvasErrorNodeIds !== 'undefined' && canvasErrorNodeIds.has(nodeId)) {
    canvasErrorNodeIds.delete(nodeId);
  }

  // ถ้ากำลังต่อสายอยู่ -> แตะบล็อกใดๆ คือการเลือกบล็อกเป้าหมาย!
  if (activeWire) {
    completeWiringToNode(nodeId);
    return;
  }

  // ถ้าอยู่ในโหมดต่อสาย (isWireMode) และยังไม่มี activeWire -> แตะเพื่อเริ่มต่อสาย
  if (isWireMode) {
    startWiringFromNode(nodeId);
    return;
  }

  if (selectedNodeId !== nodeId) {
    selectedNodeId = nodeId;
    const node = nodes.find(n => n.id === nodeId);
    const def = node ? BLOCK_CATALOG.find(b => b.type === node.type) : null;
    lastFocusedFieldKey = def ? def.primaryField : null;
    renderCanvas();
    renderInspector();
  } else if (!isBlockPopoverOpen()) {
    renderInspector();
  }
}

function onOutputPortMouseDown(e, nodeId, portId) {
  e.stopPropagation();
  e.preventDefault();
  startWiringFromNode(nodeId, portId);
}

function onInputPortClick(e, targetNodeId, targetPortId) {
  e.stopPropagation();
  e.preventDefault();
  if (activeWire) {
    completeWiringToNode(targetNodeId, targetPortId);
  }
}

function onViewportMouseDown(e) {
  if (e.target.id === 'canvas-world' || e.target.id === 'connections-svg' || e.target.id === 'workspace-viewport' || spaceKeyPressed) {
    if (activeWire) {
      cancelWiring();
      return;
    }
    if (isWireMode) {
      toggleWireMode(false);
      return;
    }
    selectedNodeId = null;
    renderCanvas();
    renderInspector();

    isPanning = true;
    const vp = document.getElementById('workspace-viewport');
    vp.classList.add('panning');
    panStartX = e.clientX;
    panStartY = e.clientY;
    scrollStartLeft = vp.scrollLeft;
    scrollStartTop = vp.scrollTop;
  }
}

function onViewportMouseMove(e) {
  const ring = document.getElementById('custom-cursor-ring');
  if (showCursorRing && ring) {
    ring.style.display = 'block';
    ring.style.left = `${e.clientX}px`;
    ring.style.top = `${e.clientY}px`;
  }

  const worldEl = document.getElementById('canvas-world');
  if (!worldEl) return;
  const worldRect = worldEl.getBoundingClientRect();
  const mouseWorldX = Math.max(0, Math.round((e.clientX - worldRect.left) / canvasZoom));
  const mouseWorldY = Math.max(0, Math.round((e.clientY - worldRect.top) / canvasZoom));
  const coordsEl = document.getElementById('mouse-coords');
  if (coordsEl) coordsEl.textContent = `X: ${mouseWorldX}, Y: ${mouseWorldY}`;

  if (isPanning) {
    const vp = document.getElementById('workspace-viewport');
    if (vp) {
      vp.scrollLeft = scrollStartLeft - (e.clientX - panStartX);
      vp.scrollTop = scrollStartTop - (e.clientY - panStartY);
    }
    return;
  }

  if (draggingNodeId !== null) {
    const node = nodes.find(n => n.id === draggingNodeId);
    if (!node) return;
    node.x = Math.max(16, Math.min(2720, Math.round(mouseWorldX - dragOffsetX)));
    node.y = Math.max(16, Math.min(1850, Math.round(mouseWorldY - dragOffsetY)));

    const nodeEl = document.getElementById(`node-el-${node.id}`);
    if (nodeEl) {
      nodeEl.style.left = `${node.x}px`;
      nodeEl.style.top = `${node.y}px`;
    }
    renderConnections();
    positionBlockPopover();
  }

  if (activeWire) {
    const startPos = getPortCenterOnWorld(activeWire.fromNode, activeWire.fromPort);
    if (!startPos) return;
    const dx = Math.max(40, Math.abs(mouseWorldX - startPos.x) * 0.4);
    const d = `M ${startPos.x} ${startPos.y} C ${startPos.x + dx} ${startPos.y}, ${mouseWorldX - dx} ${mouseWorldY}, ${mouseWorldX} ${mouseWorldY}`;
    const tempWire = document.getElementById('temp-wire');
    if (tempWire) tempWire.setAttribute('d', d);
  }
}

function onViewportMouseUp() {
  if (isPanning) {
    isPanning = false;
    if (!spaceKeyPressed) {
      const vp = document.getElementById('workspace-viewport');
      if (vp) vp.classList.remove('panning');
    }
  }
  if (draggingNodeId !== null) {
    draggingNodeId = null;
    saveCurrentLevelToStorage();
  }
}

// ---------------------------------------------------------
// 9. DRAG, PAN, WIRE EVENTS
// ---------------------------------------------------------
function onNodeMouseDown(e, nodeId) {
  if (e.target.closest('.port-dot') || e.target.closest('button')) return;
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
  if (selectedNodeId !== nodeId) {
    selectedNodeId = nodeId;
    const node = nodes.find(n => n.id === nodeId);
    const def = node ? BLOCK_CATALOG.find(b => b.type === node.type) : null;
    lastFocusedFieldKey = def ? def.primaryField : null;
    renderCanvas();
    renderInspector();
  }
}

function onOutputPortMouseDown(e, nodeId, portId) {
  e.stopPropagation();
  e.preventDefault();
  activeWire = { fromNode: nodeId, fromPort: portId };
  document.getElementById('wiring-indicator').classList.remove('hidden');

  const startPos = getPortCenterOnWorld(nodeId, portId);
  const tempWire = document.getElementById('temp-wire');
  if (startPos) {
    tempWire.classList.remove('hidden');
    tempWire.setAttribute('d', `M ${startPos.x} ${startPos.y} L ${startPos.x} ${startPos.y}`);
  }
}

function onInputPortClick(e, targetNodeId, targetPortId) {
  e.stopPropagation();
  e.preventDefault();
  if (!activeWire) return;
  if (activeWire.fromNode === targetNodeId) {
    cancelWiring();
    return;
  }

  const exists = connections.some(c =>
    c.fromNode === activeWire.fromNode &&
    c.fromPort === activeWire.fromPort &&
    c.toNode === targetNodeId
  );

  if (!exists) {
    connections.push({
      fromNode: activeWire.fromNode,
      fromPort: activeWire.fromPort,
      toNode: targetNodeId,
      toPort: targetPortId
    });
    saveCurrentLevelToStorage();
  }
  cancelWiring();
  renderCanvas();
}

function cancelWiring() {
  activeWire = null;
  document.getElementById('wiring-indicator').classList.add('hidden');
  document.getElementById('temp-wire').classList.add('hidden');
}

function onViewportMouseDown(e) {
  if (e.target.id === 'canvas-world' || e.target.id === 'connections-svg' || e.target.id === 'workspace-viewport' || spaceKeyPressed) {
    if (activeWire) {
      cancelWiring();
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
  if (showCursorRing) {
    ring.style.display = 'block';
    ring.style.left = `${e.clientX}px`;
    ring.style.top = `${e.clientY}px`;
  }

  const worldEl = document.getElementById('canvas-world');
  const worldRect = worldEl.getBoundingClientRect();
  const mouseWorldX = Math.max(0, Math.round((e.clientX - worldRect.left) / canvasZoom));
  const mouseWorldY = Math.max(0, Math.round((e.clientY - worldRect.top) / canvasZoom));
  document.getElementById('mouse-coords').textContent = `X: ${mouseWorldX}, Y: ${mouseWorldY}`;

  if (isPanning) {
    const vp = document.getElementById('workspace-viewport');
    vp.scrollLeft = scrollStartLeft - (e.clientX - panStartX);
    vp.scrollTop = scrollStartTop - (e.clientY - panStartY);
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
  }

  if (activeWire) {
    const startPos = getPortCenterOnWorld(activeWire.fromNode, activeWire.fromPort);
    if (!startPos) return;
    const dx = Math.max(40, Math.abs(mouseWorldX - startPos.x) * 0.4);
    const d = `M ${startPos.x} ${startPos.y} C ${startPos.x + dx} ${startPos.y}, ${mouseWorldX - dx} ${mouseWorldY}, ${mouseWorldX} ${mouseWorldY}`;
    document.getElementById('temp-wire').setAttribute('d', d);
  }
}

function onViewportMouseUp() {
  if (isPanning) {
    isPanning = false;
    if (!spaceKeyPressed) document.getElementById('workspace-viewport').classList.remove('panning');
  }
  if (draggingNodeId !== null) {
    draggingNodeId = null;
    saveCurrentLevelToStorage();
  }
}

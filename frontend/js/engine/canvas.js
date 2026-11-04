// ---------------------------------------------------------
// 8. RENDER CANVAS
// ---------------------------------------------------------
const ROUTE_COLORS = ['emerald', 'amber', 'rose', 'sky', 'purple', 'cyan'];
let canvasErrorNodeIds = new Set();

function setCanvasErrorNodes(nodeIds) {
  canvasErrorNodeIds = new Set(nodeIds || []);
  renderCanvas();
}

function clearCanvasErrorNodes() {
  if (canvasErrorNodeIds.size > 0) {
    canvasErrorNodeIds.clear();
    renderCanvas();
  }
}

function getNodeOutputs(node, def) {
  if (node.type === 'logic_switch') {
    let routes = [];
    if (Array.isArray(node.config && node.config.routes) && node.config.routes.length > 0) {
      routes = node.config.routes.map((r, i) => ({
        id: r.id || `route_${String.fromCharCode(97 + i)}`,
        label: r.label || `สาย ${String.fromCharCode(65 + i)}`,
        color: ROUTE_COLORS[i % ROUTE_COLORS.length]
      }));
    } else {
      routes = [
        { id: 'route_a', label: 'สาย A', color: 'emerald' },
        { id: 'route_b', label: 'สาย B', color: 'amber' },
        { id: 'route_c', label: 'สาย C', color: 'rose' }
      ];
    }
    return [
      ...routes,
      { id: 'default', label: 'กรณีอื่นๆ (Default)', color: 'slate' }
    ];
  }
  return (def && def.outputs) || [];
}

function renderCanvas() {
  const nodesLayer = document.getElementById('nodes-layer');
  const emptyHint = document.getElementById('canvas-empty-hint');
  const stats = document.getElementById('canvas-stats');

  stats.textContent = `บล็อก: ${nodes.length} | เส้นเชื่อม: ${connections.length}`;
  emptyHint.style.display = nodes.length === 0 ? 'flex' : 'none';

  const headerColors = {
    amber: 'from-amber-500/25 to-amber-600/5 border-amber-500/40 text-amber-300',
    purple: 'from-purple-500/25 to-purple-600/5 border-purple-500/40 text-purple-300',
    cyan: 'from-cyan-500/25 to-cyan-600/5 border-cyan-500/40 text-cyan-300',
    sky: 'from-sky-500/25 to-sky-600/5 border-sky-500/40 text-sky-300',
    emerald: 'from-emerald-500/25 to-emerald-600/5 border-emerald-500/40 text-emerald-300'
  };

  nodesLayer.innerHTML = nodes.map(node => {
    const def = BLOCK_CATALOG.find(b => b.type === node.type);
    if (!def) return '';
    const isSelected = node.id === selectedNodeId;
    const hasError = canvasErrorNodeIds.has(node.id);
    const summaryText = getNodeSummaryPreview(node, def);
    const varStatus = evaluateNodeVariableStatus(node, def);
    const nodeOutputs = getNodeOutputs(node, def);
    const minHeight = Math.max(130, nodeOutputs.length * 36);

    const isWireSource = activeWire && activeWire.fromNode === node.id;
    const isWireTargetCandidate = activeWire && activeWire.fromNode !== node.id && def.inputs && def.inputs.length > 0;
    const isWireDisabled = activeWire && (!def.inputs || def.inputs.length === 0);

    let borderClass = 'border-slate-700/90';
    if (isSelected) borderClass = 'selected border-indigo-500';
    if (hasError) borderClass = 'border-rose-500 ring-4 ring-rose-500/60 shadow-2xl shadow-rose-500/50 animate-pulse';
    if (isWireSource) {
      borderClass = 'wire-source';
    } else if (isWireTargetCandidate) {
      borderClass = 'wire-target-candidate';
    } else if (isWireDisabled) {
      borderClass = 'border-slate-800/60 opacity-60';
    }

    return `
      <div id="node-el-${node.id}"
           style="left: ${node.x}px; top: ${node.y}px; width: 250px; min-height: ${minHeight}px;"
           onmousedown="onNodeMouseDown(event, ${node.id})"
           ontouchstart="onNodeTouchStart(event, ${node.id})"
           onclick="onNodeClick(event, ${node.id})"
           class="workflow-node pointer-events-auto absolute bg-slate-900/95 backdrop-blur rounded-2xl border ${borderClass} shadow-xl">

        <!-- Header -->
        <div class="px-3 py-2 rounded-t-2xl bg-gradient-to-r ${headerColors[def.color]} border-b border-slate-800 flex items-center justify-between gap-1.5">
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-base shrink-0">${def.icon}</span>
            <div class="min-w-0">
              <div class="text-[10px] font-bold uppercase tracking-wider opacity-75">#${node.id} • ${def.badge}${
                lastRun && lastRun.visited[node.id] ? ` <span class="ml-1 px-1.5 rounded bg-emerald-500/30 text-emerald-200">▶ ลำดับ ${lastRun.visited[node.id]}</span>` : ''
              }</div>
              <div class="text-xs font-bold text-white truncate">${def.cleanTitle || def.title}</div>
            </div>
          </div>
          <div class="flex items-center gap-0.5 shrink-0">
            ${nodeOutputs.length > 0 ? `
              <button type="button" onclick="startWiringFromNode(${node.id}, null, event)" title="ต่อสายเชื่อมไปยังบล็อกอื่น (หรือแตะบล็อกนี้แล้วแตะบล็อกเป้าหมาย)"
                class="w-6 h-6 rounded hover:bg-indigo-600/30 text-indigo-300 hover:text-white flex items-center justify-center text-xs transition cursor-pointer">
                🔗
              </button>
            ` : ''}
            <button onclick="duplicateNode(${node.id}, event)" title="ทำซ้ำบล็อกนี้"
              class="w-5 h-5 rounded hover:bg-slate-800 text-slate-400 hover:text-indigo-300 flex items-center justify-center text-[11px] transition cursor-pointer">
              ⧉
            </button>
            <button onclick="deleteNode(${node.id}, event)" title="ลบบล็อกนี้"
              class="w-5 h-5 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 flex items-center justify-center text-xs transition cursor-pointer">
              ✕
            </button>
          </div>
        </div>

        ${isWireSource ? `
          <div class="bg-emerald-950/90 border-b border-emerald-500/50 px-2.5 py-1 text-[10px] font-bold text-emerald-300 flex items-center justify-between">
            <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span> <span>กำลังส่งสายออก</span></span>
            <span class="text-[9px] bg-emerald-500/20 px-1 rounded border border-emerald-500/30">ต้นทาง</span>
          </div>
        ` : ''}
        ${isWireTargetCandidate ? `
          <div class="bg-indigo-950/90 border-b border-indigo-500/50 px-2.5 py-1 text-[10px] font-bold text-indigo-300 flex items-center justify-between">
            <span>👉 แตะที่นี่เพื่อเชื่อมต่อ</span>
            <span class="text-xs">⚡</span>
          </div>
        ` : ''}

        ${hasError ? `
          <div class="bg-rose-950/80 border-b border-rose-500/40 px-2.5 py-1 text-[10px] font-bold text-rose-300 flex items-center gap-1.5">
            <span class="animate-bounce">⚠️</span>
            <span>บล็อกนี้มีปัญหา ตรวจสอบการเชื่อมต่อหรือตัวแปร</span>
          </div>
        ` : ''}

        <!-- Body -->
        <div class="p-3 text-[11px] text-slate-300 space-y-1.5">
          <div class="bg-slate-950/90 border border-slate-800/90 rounded-lg p-2 font-mono-code text-[10px] text-slate-300 leading-relaxed break-words max-h-24 overflow-hidden">
            ${escapeHtml(summaryText)}
          </div>

          <!-- Variable Health Indicator Badge on Card -->
          <div class="flex items-center justify-between pt-0.5">
            <span class="text-[10px] px-1.5 py-0.5 rounded border ${
              varStatus.ok
                ? 'bg-emerald-950/50 border-emerald-500/30 text-emerald-300'
                : 'bg-amber-950/60 border-amber-500/40 text-amber-300'
            }">
              ${varStatus.shortBadge}
            </span>
          </div>
        </div>

        <!-- Input Port -->
        ${def.inputs.map(inp => `
          <div id="port-${node.id}-${inp.id}"
               onpointerdown="onInputPortClick(event, ${node.id}, '${inp.id}')"
               title="คลิกหรือแตะเพื่อรับสายเชื่อม (Input)"
               class="port-dot absolute -left-2.5 top-1/2 -translate-y-1/2 bg-slate-200 border-2 border-slate-900 flex items-center justify-center">
          </div>
        `).join('')}

        <!-- Output Ports -->
        ${(() => {
          const total = nodeOutputs.length;
          return nodeOutputs.map((out, idx) => {
            const pct = total === 1 ? 50 : ((idx + 1) / (total + 1)) * 100;
            const topStyle = `top: ${pct.toFixed(1)}%; transform: translateY(-50%);`;

            let dotColor = 'bg-indigo-500';
            let labelColor = 'text-indigo-300';
            if (out.color === 'emerald') { dotColor = 'bg-emerald-500'; labelColor = 'text-emerald-300'; }
            if (out.color === 'rose') { dotColor = 'bg-rose-500'; labelColor = 'text-rose-300'; }
            if (out.color === 'amber') { dotColor = 'bg-amber-400'; labelColor = 'text-amber-300'; }
            if (out.color === 'sky') { dotColor = 'bg-sky-500'; labelColor = 'text-sky-300'; }
            if (out.color === 'purple') { dotColor = 'bg-purple-500'; labelColor = 'text-purple-300'; }
            if (out.color === 'cyan') { dotColor = 'bg-cyan-500'; labelColor = 'text-cyan-300'; }
            if (out.color === 'slate') { dotColor = 'bg-slate-500'; labelColor = 'text-slate-300'; }

            return `
              <div style="${topStyle}" class="absolute -right-2.5 flex items-center">
                ${total > 1 ? `<span class="mr-2 text-[9px] font-bold ${labelColor} bg-slate-950/95 px-1.5 py-0.5 rounded border border-slate-800 shadow">${out.label}</span>` : ''}
                <div id="port-${node.id}-${out.id}"
                     onpointerdown="onOutputPortMouseDown(event, ${node.id}, '${out.id}')"
                     title="คลิกหรือแตะเพื่อลากสายเชื่อม (${out.label})"
                     class="port-dot ${dotColor} border-2 border-slate-900">
                </div>
              </div>
            `;
          }).join('');
        })()}
      </div>
    `;
  }).join('');

  renderConnections();
  positionBlockPopover(); // บล็อกถูกวาดใหม่ทั้งชุด — ให้หน้าต่างตั้งค่าตามไปอยู่ข้างบล็อกเดิม
}

function evaluateNodeVariableStatus(node, def) {
  if (node.type.startsWith('trigger_')) {
    return {
      ok: true,
      shortBadge: `📤 ส่งออก: ${def.producedVars.slice(0, 2).join(', ')}`,
      detail: `บล็อกจุดเริ่มต้น ทำหน้าที่ผลิตตัวแปร ${def.producedVars.join(', ')} ส่งให้บล็อกถัดไป`
    };
  }
  if (node.type === 'logic_delay') {
    return { ok: true, shortBadge: '⏳ ตั้งเวลารอเรียบร้อย', detail: 'บล็อกหน่วงเวลาไม่จำเป็นต้องใช้ตัวแปร' };
  }

  const pKey = def.primaryField;
  const val = String((node.config && node.config[pKey]) || '');
  const matches = val.match(/\{\{[a-zA-Z0-9_]+\}\}/g);

  if (matches && matches.length > 0) {
    return {
      ok: true,
      shortBadge: `✅ ใช้ตัวแปร: ${matches.slice(0, 2).join(', ')}`,
      detail: `ใส่ตัวแปร ${matches.join(', ')} ในช่องหลัก (${pKey}) เรียบร้อยแล้ว!`
    };
  } else {
    return {
      ok: false,
      shortBadge: `⚠️ ยังไม่ได้ใส่ {{ตัวแปร}} ในช่องหลัก`,
      detail: `ในช่อง "${pKey}" ยังไม่มีตัวแปร {{...}} ลองกดปุ่ม "⚡ เติมตัวแปรแนะนำอัตโนมัติ" ด้านขวาได้เลยครับ`
    };
  }
}

function getNodeSummaryPreview(node, def) {
  const c = node.config || {};
  switch (node.type) {
    case 'trigger_form': return `ฟอร์ม: "${c.formName || '-'}"`;
    case 'trigger_schedule': return `รัน: ${c.frequency === 'daily' ? 'ทุกวัน' : c.frequency} เวลา ${c.time || '08:00'} น.`;
    case 'trigger_chat': return `รับแชทจาก: ${c.channel || 'LINE OA'} (${c.eventType || 'message'})`;
    case 'trigger_webhook': return `Webhook [${c.method || 'POST'}] จาก: ${c.sourceSystem || '-'}`;
    case 'logic_if': {
      if (Array.isArray(c.conditions) && c.conditions.length > 1) {
        const preview = c.conditions.slice(0, 2).map(cond => `${cond.leftValue || '?'} ${cond.operator || '=='} ${cond.rightValue || '?'}`).join(` ${c.conditionLogic || 'AND'} `);
        return `ถ้า (${preview}${c.conditions.length > 2 ? ' ...' : ''})`;
      }
      return `ถ้า ${c.leftValue || '?'} ${c.operator || '=='} ${c.rightValue || '?'}`;
    }
    case 'logic_switch': {
      const routes = Array.isArray(c.routes) && c.routes.length > 0
        ? c.routes
        : [{ condition: c.caseA }, { condition: c.caseB }, { condition: c.caseC }].filter(r => r.condition);
      const preview = routes.slice(0, 3).map((r, i) => `${String.fromCharCode(65 + i)}=${r.condition || '-'}`).join(' | ');
      return `แยกสายด้วย ${c.switchField || '?'}: ${preview}${routes.length > 3 ? ` (+${routes.length - 3})` : ''}`;
    }
    case 'logic_loop': return `วนลูปข้อมูล: ${c.sourceList || '{{sheet_rows}}'}`;
    case 'logic_delay': return `หน่วงเวลารอ: ${c.duration || '15 นาที'}`;
    case 'ai_agent': return `Prompt: "${(c.prompt || '').substring(0, 62)}${(c.prompt || '').length > 62 ? '...' : ''}"`;
    case 'data_formatter': return `รูปแบบ: "${(c.template || '').substring(0, 60)}"`;
    case 'action_http': return `${c.method || 'GET'} ${c.endpoint || ''}`;
    case 'action_sheets': {
      const chMap = { google_sheets: 'Sheets', excel_365: 'Excel', lark_base: 'Lark', airtable: 'Airtable' };
      const ch = chMap[c.channel] || 'Spreadsheet';
      return `[${ch} / ${c.operation === 'read_rows' ? 'ดึง' : 'บันทึก'}] "${c.sheetName || '-'}" ➔ ${c.columns || ''}`;
    }
    case 'action_line': {
      const chMap = { line: 'LINE', telegram: 'Telegram', wechat: 'WeChat', slack: 'Slack', discord: 'Discord' };
      const ch = chMap[c.channel] || 'Notification';
      return `[${ch}] ${c.target ? `➔ ${c.target}: ` : ''}"${(c.messageTemplate || '').substring(0, 50)}"`;
    }
    case 'action_telegram': return `${c.platform || 'Bot'}: "${(c.message || '').substring(0, 55)}"`;
    case 'action_email': return `ถึง: ${c.toEmail || '-'} | ${c.subject || '-'}`;
    case 'action_calendar': return `นัดหมาย [${c.provider === 'outlook_calendar' ? 'Outlook' : 'Google'}]: ${c.eventTitle || '-'}`;
    default: return 'ตั้งค่าเรียบร้อย';
  }
}

function getPortCenterOnWorld(nodeId, portId) {
  const portEl = document.getElementById(`port-${nodeId}-${portId}`);
  const worldEl = document.getElementById('canvas-world');
  if (!portEl || !worldEl) return null;
  const pRect = portEl.getBoundingClientRect();
  const wRect = worldEl.getBoundingClientRect();
  return {
    x: (pRect.left - wRect.left + pRect.width / 2) / canvasZoom,
    y: (pRect.top - wRect.top + pRect.height / 2) / canvasZoom
  };
}

function renderConnections() {
  const layer = document.getElementById('connections-layer');
  if (!layer) return;

  layer.innerHTML = connections.map((conn, index) => {
    const p1 = getPortCenterOnWorld(conn.fromNode, conn.fromPort);
    const p2 = getPortCenterOnWorld(conn.toNode, conn.toPort);
    if (!p1 || !p2) return '';

    const dx = Math.max(60, Math.abs(p2.x - p1.x) * 0.45);
    const d = `M ${p1.x} ${p1.y} C ${p1.x + dx} ${p1.y}, ${p2.x - dx} ${p2.y}, ${p2.x} ${p2.y}`;

    let strokeColor = '#818cf8';
    let marker = 'url(#arrow-default)';
    if (conn.fromPort === 'true' || conn.fromPort === 'route_a' || conn.fromPort === 'each') {
      strokeColor = '#34d399';
      marker = 'url(#arrow-true)';
    } else if (conn.fromPort === 'false' || conn.fromPort === 'route_c') {
      strokeColor = '#fb7185';
      marker = 'url(#arrow-false)';
    } else if (conn.fromPort === 'route_b' || conn.fromPort === 'done') {
      strokeColor = '#fbbf24';
      marker = 'url(#arrow-route)';
    } else if (conn.fromPort === 'route_d') {
      strokeColor = '#38bdf8';
      marker = 'url(#arrow-route)';
    } else if (conn.fromPort === 'route_e') {
      strokeColor = '#c084fc';
      marker = 'url(#arrow-route)';
    } else if (conn.fromPort === 'route_f') {
      strokeColor = '#22d3ee';
      marker = 'url(#arrow-route)';
    } else if (conn.fromPort === 'default') {
      strokeColor = '#94a3b8';
      marker = 'url(#arrow-default)';
    }

    return `
      <g onclick="deleteConnection(${index}, event)">
        <path d="${d}" class="connection-path${lastRun && lastRun.usedConnections.includes(index) ? ' connection-active' : ''}" stroke="${strokeColor}" marker-end="${marker}">
          <title>คลิกที่เส้นเพื่อลบสายเชื่อมนี้</title>
        </path>
      </g>
    `;
  }).join('');
}

function deleteConnection(index, evt) {
  if (evt) evt.stopPropagation();
  connections.splice(index, 1);
  saveCurrentLevelToStorage();
  renderCanvas();
}

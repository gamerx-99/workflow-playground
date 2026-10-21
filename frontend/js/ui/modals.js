// ---------------------------------------------------------
// 11. VARIABLE DIAGNOSTIC CHECKER & EXPORT
// ---------------------------------------------------------
function checkVariablesInFlow() {
  const modal = document.getElementById('var-check-modal');
  const body = document.getElementById('var-check-body');

  if (nodes.length === 0) {
    body.innerHTML = `<div class="p-4 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200">ยังไม่มีบล็อกบนกระดานครับ ลองวางบล็อกก่อนนะ!</div>`;
    modal.classList.remove('hidden');
    return;
  }

  body.innerHTML = nodes.map(node => {
    const def = BLOCK_CATALOG.find(b => b.type === node.type);
    const status = evaluateNodeVariableStatus(node, def);
    return `
      <div class="p-3.5 rounded-xl border ${status.ok ? 'bg-emerald-950/25 border-emerald-500/30' : 'bg-amber-950/35 border-amber-500/40'} flex items-start justify-between gap-3">
        <div class="space-y-1">
          <div class="font-bold text-white flex items-center gap-2">
            <span>${def.icon} [#${node.id}] ${def.title}</span>
            <span class="text-[10px] px-2 py-0.5 rounded ${status.ok ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}">${status.shortBadge}</span>
          </div>
          <p class="text-slate-300 text-[11px]">${status.detail}</p>
        </div>
        ${!status.ok && def.smartPreset ? `
          <button onclick="applySmartPreset(${node.id}); checkVariablesInFlow();"
            class="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold cursor-pointer">
            ⚡ เติมให้อัตโนมัติ
          </button>
        ` : ''}
      </div>
    `;
  }).join('');

  modal.classList.remove('hidden');
}

function closeVarCheckModal() {
  document.getElementById('var-check-modal').classList.add('hidden');
}

async function submitLevelCheck() {
  const result = await Api.checkLevel(currentLevelId, { nodes, connections });
  if (result.passed && !passedLevelIds.includes(currentLevelId)) {
    passedLevelIds.push(currentLevelId);
    renderLevelTabs();
  }

  document.getElementById('level-check-header').innerHTML = `
    <div class="flex items-center gap-2.5">
      <span class="text-2xl">${result.passed ? '🎉' : '🧐'}</span>
      <div>
        <h2 class="font-bold text-base ${result.passed ? 'text-emerald-300' : 'text-white'}">
          ${result.passed ? 'ผ่านด่านนี้แล้ว!' : 'ยังไม่ผ่าน — เหลืออีกนิดเดียว'}
        </h2>
        <p class="text-xs text-slate-400">ผ่าน ${result.score} จาก ${result.total} ข้อ</p>
      </div>
    </div>
    <button onclick="closeLevelCheckModal()" class="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold cursor-pointer">✕</button>
  `;

  document.getElementById('level-check-body').innerHTML = `
    <div class="h-2 rounded-full bg-slate-800 overflow-hidden mb-3">
      <div class="h-full ${result.passed ? 'bg-emerald-500' : 'bg-amber-400'}" style="width: ${result.total ? Math.round(result.score / result.total * 100) : 0}%"></div>
    </div>
    ${result.items.map(item => `
      <div class="p-2.5 rounded-xl border ${item.ok ? 'bg-emerald-950/25 border-emerald-500/30' : 'bg-rose-950/30 border-rose-500/40'} flex items-start gap-2.5">
        <span class="shrink-0">${item.ok ? '✅' : '❌'}</span>
        <div class="space-y-0.5">
          <div class="font-semibold ${item.ok ? 'text-emerald-200' : 'text-white'}">${escapeHtml(item.label)}</div>
          ${item.ok ? '' : `<div class="text-[11px] text-rose-200/90">${escapeHtml(item.detail)}</div>`}
        </div>
      </div>
    `).join('')}
  `;

  document.getElementById('level-check-modal').classList.remove('hidden');
}

function closeLevelCheckModal() {
  document.getElementById('level-check-modal').classList.add('hidden');
}

function toggleHint() {
  document.getElementById('hint-banner').classList.toggle('hidden');
}

function loadTemplateForCurrentLevel() {
  const levelObj = LEVELS.find(l => l.id === currentLevelId);
  if (!levelObj || !levelObj.template) return;

  nodes = JSON.parse(JSON.stringify(levelObj.template.nodes));
  connections = JSON.parse(JSON.stringify(levelObj.template.connections));
  nextNodeId = Math.max(...nodes.map(n => n.id), 0) + 1;
  selectedNodeId = nodes[0] ? nodes[0].id : null;

  saveCurrentLevelToStorage();
  renderCanvas();
  renderInspector();
}

function clearCanvasConfirm() {
  nodes = [];
  connections = [];
  selectedNodeId = null;
  nextNodeId = 1;
  saveCurrentLevelToStorage();
  renderCanvas();
  renderInspector();
}

function openGuideModal() {
  document.getElementById('guide-modal').classList.remove('hidden');
}
function closeGuideModal() {
  document.getElementById('guide-modal').classList.add('hidden');
}

function openExportModal() {
  const levelObj = LEVELS.find(l => l.id === currentLevelId);
  const lines = [];
  lines.push(`=== 📋 ส่งตรวจแบบฝึกหัด Workflow Automation ===`);
  lines.push(`🎯 ด่านที่ทำ: ด่านที่ ${levelObj.id} - ${levelObj.title}`);
  lines.push(`📦 จำนวนบล็อกทั้งหมด: ${nodes.length} บล็อก | จำนวนเส้นเชื่อม: ${connections.length} เส้น`);
  lines.push('');

  if (nodes.length === 0) {
    lines.push(`(ยังไม่มีบล็อกถูกวางบนกระดาน)`);
  } else {
    lines.push(`--- 1. รายละเอียดและการตั้งค่าตัวแปรในแต่ละบล็อก ---`);
    nodes.forEach((n, i) => {
      const def = BLOCK_CATALOG.find(b => b.type === n.type);
      const cfgPairs = Object.entries(n.config || {})
        .filter(([_, v]) => v !== '')
        .map(([k, v]) => `${k}: "${String(v).replace(/\n/g, ' / ')}"`)
        .join(' | ');
      lines.push(`${i + 1}. [#${n.id} ${def ? def.title : n.type}] (${def ? def.badge : ''})`);
      lines.push(`   ⚙️ ตั้งค่า: ${cfgPairs}`);
    });

    lines.push('');
    lines.push(`--- 2. เส้นทางการเชื่อมโยง (Connections) ---`);
    if (connections.length === 0) {
      lines.push(`(ยังไม่มีการลากเส้นเชื่อมระหว่างบล็อก)`);
    } else {
      connections.forEach((c, idx) => {
        const fromNode = nodes.find(n => n.id === c.fromNode);
        const toNode = nodes.find(n => n.id === c.toNode);
        const fromDef = fromNode ? BLOCK_CATALOG.find(b => b.type === fromNode.type) : null;
        const toDef = toNode ? BLOCK_CATALOG.find(b => b.type === toNode.type) : null;

        let branchLabel = '';
        if (c.fromPort === 'true') branchLabel = ' [สายจริง True ✅]';
        if (c.fromPort === 'false') branchLabel = ' [สายเท็จ False ❌]';
        if (c.fromPort === 'route_a') branchLabel = ' [สาย A]';
        if (c.fromPort === 'route_b') branchLabel = ' [สาย B]';
        if (c.fromPort === 'route_c') branchLabel = ' [สาย C]';
        if (c.fromPort === 'each') branchLabel = ' [วนลูปทีละชิ้น]';
        if (c.fromPort === 'done') branchLabel = ' [เมื่อจบ Loop]';

        lines.push(`เส้นที่ ${idx + 1}: [#${c.fromNode} ${fromDef ? fromDef.title : ''}]${branchLabel} ➔ [#${c.toNode} ${toDef ? toDef.title : ''}]`);
      });
    }
  }

  lines.push(`==============================================`);

  document.getElementById('export-textarea').value = lines.join('\n');
  document.getElementById('copy-success-msg').classList.add('hidden');
  document.getElementById('export-modal').classList.remove('hidden');
}

function closeExportModal() {
  document.getElementById('export-modal').classList.add('hidden');
}

function copyExportText() {
  const textarea = document.getElementById('export-textarea');
  textarea.select();
  navigator.clipboard.writeText(textarea.value).then(() => {
    document.getElementById('copy-success-msg').classList.remove('hidden');
  }).catch(() => {
    document.execCommand('copy');
    document.getElementById('copy-success-msg').classList.remove('hidden');
  });
}

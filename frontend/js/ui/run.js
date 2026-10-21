// ---------------------------------------------------------
// ▶ จำลองการทำงาน (Run) และหน้าต่างทายผล (Predict)
// ---------------------------------------------------------
function openRunModal() {
  const triggers = [...new Set(nodes.filter(n => n.type.startsWith('trigger_')).map(n => n.type))];
  const picker = document.getElementById('run-scenarios');

  picker.innerHTML = triggers.length === 0
    ? '<div class="text-amber-300">ยังไม่มีบล็อกจุดเริ่มต้น (Trigger) บนกระดาน</div>'
    : triggers.map(type => {
        const def = BLOCK_CATALOG.find(b => b.type === type);
        return `
          <label class="flex items-center gap-2 text-xs text-slate-300">
            <span class="shrink-0">${def.icon} ${def.title}</span>
            <select data-trigger="${type}" class="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white">
              ${TRIGGER_SCENARIOS[type].map(s => `<option value="${s.id}">${s.label}</option>`).join('')}
            </select>
          </label>`;
      }).join('');

  document.getElementById('run-result').innerHTML = '';
  document.getElementById('run-modal').classList.remove('hidden');
  if (triggers.length) runSimulation();
}

function closeRunModal() {
  document.getElementById('run-modal').classList.add('hidden');
}

function clearRunResult() {
  lastRun = null;
  renderCanvas();
  closeRunModal();
}

function runSimulation() {
  const scenarios = {};
  document.querySelectorAll('#run-scenarios select').forEach(sel => {
    scenarios[sel.dataset.trigger] = sel.value;
  });

  lastRun = simulateFlow({ nodes, connections }, BLOCK_CATALOG, { scenarios });
  renderRunResult(lastRun);
  renderCanvas();
}

function renderRunResult(run) {
  const chips = (obj, color) => Object.entries(obj).map(([k, v]) => `
    <div class="text-[10px] font-mono-code ${color} break-words"><b>{{${escapeHtml(k.replace(/[{}]/g, ''))}}}</b> = ${escapeHtml(String(v)).replace(/\n/g, ' ⏎ ')}</div>`).join('');

  const steps = run.steps.map(s => {
    const used = Object.keys(s.used).length;
    const produced = Object.keys(s.produced).length;
    return `
      <div class="p-2.5 rounded-xl border ${s.warnings.length ? 'bg-amber-950/30 border-amber-500/40' : 'bg-slate-950 border-slate-800'} space-y-1">
        <div class="font-semibold text-white">${s.order}. ${s.icon} [#${s.nodeId}] ${escapeHtml(s.title)}</div>
        <div class="text-slate-300 whitespace-pre-line">${escapeHtml(s.output)}</div>
        ${used ? `<div><div class="text-[10px] text-slate-500">ตัวแปรที่บล็อกนี้ใช้</div>${chips(s.used, 'text-cyan-300')}</div>` : ''}
        ${produced ? `<div><div class="text-[10px] text-slate-500">ตัวแปรที่บล็อกนี้ส่งต่อ</div>${chips(s.produced, 'text-emerald-300')}</div>` : ''}
        ${s.warnings.map(w => `<div class="text-[11px] text-amber-300">⚠️ ${escapeHtml(w)}</div>`).join('')}
      </div>`;
  }).join('');

  const messages = run.messages.map(m => `
    <div class="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30">
      <div class="text-[10px] text-emerald-300 font-semibold">📨 ${escapeHtml(m.channel)} ➔ ${escapeHtml(m.targetLabel)}</div>
      <div class="text-slate-100 whitespace-pre-line mt-0.5">${escapeHtml(m.text)}</div>
    </div>`).join('');

  const sheets = run.sheets.map(s => `
    <div class="p-2 rounded-lg bg-sky-950/30 border border-sky-500/30 text-slate-200">
      📊 ${s.op === 'read_rows' ? 'ดึงจาก' : 'เพิ่มแถวใน'} <b>${escapeHtml(s.sheet)}</b>
      <span class="font-mono-code text-[10px] text-slate-400">${escapeHtml(s.detail)}</span>
    </div>`).join('');

  document.getElementById('run-result').innerHTML = `
    ${run.warnings.map(w => `<div class="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200">⚠️ ${escapeHtml(w)}</div>`).join('')}
    <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider pt-1">ขั้นตอนที่ทำงาน (${run.steps.length})</div>
    ${steps || '<div class="text-slate-500">ไม่มีขั้นตอนที่ทำงาน</div>'}
    <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider pt-2">📊 ผลต่อชีต (${run.sheets.length})</div>
    ${sheets || '<div class="text-slate-500">ไม่มีการเขียน/อ่านชีต</div>'}
    <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider pt-2">📨 ข้อความที่ส่งออกไป (${run.messages.length})</div>
    ${messages || '<div class="text-slate-500">ไม่มีการส่งข้อความเลย</div>'}`;
}

// ---------- ด่านทายผล ----------
function openPredictModal(level) {
  document.getElementById('predict-body').innerHTML = level.questions.map((q, qi) => `
    <div class="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
      <div class="font-semibold text-white text-xs">ข้อ ${qi + 1}: ${escapeHtml(q.text)}</div>
      ${q.options.map((o, oi) => `
        <label class="flex items-start gap-2 text-xs text-slate-300 cursor-pointer hover:text-white">
          <input type="radio" name="predict-${qi}" value="${oi}" class="mt-0.5" />
          <span>${escapeHtml(o.label)}</span>
        </label>`).join('')}
    </div>`).join('');
  document.getElementById('predict-modal').classList.remove('hidden');
}

function closePredictModal() {
  document.getElementById('predict-modal').classList.add('hidden');
}

async function submitPredictAnswers() {
  const level = LEVELS.find(l => l.id === currentLevelId);
  const answers = level.questions.map((_, qi) => {
    const picked = document.querySelector(`input[name="predict-${qi}"]:checked`);
    return picked ? Number(picked.value) : undefined;
  });
  closePredictModal();
  showCheckResult(await Api.checkLevel(currentLevelId, { nodes, connections }, answers));
}

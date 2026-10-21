// ---------------------------------------------------------
// 10. SMART INSPECTOR & TARGETED VARIABLE INSERTION
// ---------------------------------------------------------
function setFocusedField(fieldKey) {
  lastFocusedFieldKey = fieldKey;
  // อัปเดตป้ายบอกช่องที่กำลังเลือกโดยไม่ทำลาย focus ของคีย์บอร์ด
  const indicator = document.getElementById('target-field-indicator');
  if (indicator) {
    indicator.textContent = `กำลังเลือกช่อง: "${fieldKey}" (กดปุ่มตัวแปรด้านล่างเพื่อแทรกเข้าช่องนี้ได้เลย)`;
  }
}

function renderInspector() {
  const container = document.getElementById('inspector-content');
  if (!selectedNodeId) {
    container.innerHTML = `
      <div class="h-full flex flex-col items-center justify-center text-center text-slate-500 py-12">
        <div class="text-3xl mb-2">👆</div>
        <p class="text-xs font-medium text-slate-300">คลิกเลือกบล็อกบนกระดาน</p>
        <p class="text-[11px] text-slate-500 mt-1 max-w-[230px]">
          ระบบจะแสดงคำแนะนำว่าบล็อกนั้นต้องใช้ตัวแปรอะไร พร้อมปุ่มเติมตัวแปรอัตโนมัติครับ
        </p>
      </div>
    `;
    return;
  }

  const node = nodes.find(n => n.id === selectedNodeId);
  if (!node) return;
  const def = BLOCK_CATALOG.find(b => b.type === node.type);
  if (!lastFocusedFieldKey) {
    lastFocusedFieldKey = def.primaryField || (def.fields[0] ? def.fields[0].key : null);
  }

  const availableVars = getAvailableVariablesForNode();

  container.innerHTML = `
    <div class="space-y-3.5">
      <!-- Node Title -->
      <div class="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2.5">
        <span class="text-xl">${def.icon}</span>
        <div class="min-w-0 flex-1">
          <div class="text-[10px] font-bold text-indigo-400 uppercase">บล็อก #${node.id} • ${def.badge}</div>
          <div class="text-xs font-bold text-white truncate">${def.title}</div>
        </div>
      </div>

      <!-- Smart Variable Coach Box -->
      <div class="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/40 space-y-2">
        <div class="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5">
          <span>💡 คำแนะนำตัวแปรสำหรับบล็อกนี้:</span>
        </div>
        <p class="text-[11px] text-slate-200 leading-relaxed whitespace-pre-line">${def.varAdvice || ''}</p>
        ${def.smartPreset ? `
          <button onclick="applySmartPreset(${node.id})"
            class="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow flex items-center justify-center gap-1.5 transition cursor-pointer">
            <span>⚡ เติมตัวแปรแนะนำให้บล็อกนี้อัตโนมัติ</span>
          </button>
        ` : ''}
      </div>

      <!-- Dynamic Form Fields -->
      <div class="space-y-3">
        ${def.fields.map(f => {
          const val = node.config[f.key] !== undefined ? node.config[f.key] : '';
          const isPrimary = f.key === def.primaryField;
          const labelBadge = isPrimary
            ? `<span class="ml-1 px-1.5 py-0.5 text-[9px] rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">ช่องใส่ตัวแปรหลัก</span>`
            : '';

          if (f.type === 'select') {
            return `
              <div>
                <label class="block text-[11px] font-semibold text-slate-300 mb-1">${f.label}</label>
                <select onchange="updateNodeConfig(${node.id}, '${f.key}', this.value)"
                  class="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500">
                  ${f.options.map(opt => `
                    <option value="${opt.value}" ${val === opt.value ? 'selected' : ''}>${opt.label}</option>
                  `).join('')}
                </select>
              </div>
            `;
          } else if (f.type === 'textarea') {
            return `
              <div>
                <label class="block text-[11px] font-semibold text-slate-200 mb-1">${f.label} ${labelBadge}</label>
                <textarea id="field-${node.id}-${f.key}" rows="3"
                  onfocus="setFocusedField('${f.key}')"
                  oninput="updateNodeConfig(${node.id}, '${f.key}', this.value)"
                  placeholder="${f.placeholder || ''}"
                  class="w-full bg-slate-950 border ${isPrimary ? 'border-cyan-500/50' : 'border-slate-700'} rounded-lg p-2.5 text-xs font-mono-code text-white focus:outline-none focus:border-cyan-400">${escapeHtml(val)}</textarea>
              </div>
            `;
          } else {
            return `
              <div>
                <label class="block text-[11px] font-semibold text-slate-200 mb-1">${f.label} ${labelBadge}</label>
                <input id="field-${node.id}-${f.key}" type="text" value="${escapeHtml(val)}"
                  onfocus="setFocusedField('${f.key}')"
                  oninput="updateNodeConfig(${node.id}, '${f.key}', this.value)"
                  placeholder="${f.placeholder || ''}"
                  class="w-full bg-slate-950 border ${isPrimary ? 'border-cyan-500/50' : 'border-slate-700'} rounded-lg px-2.5 py-1.5 text-xs font-mono-code text-white focus:outline-none focus:border-cyan-400" />
              </div>
            `;
          }
        }).join('')}
      </div>

      <!-- Variable Quick Insert Pills with Thai Meaning -->
      <div class="p-3 rounded-xl bg-indigo-950/35 border border-indigo-500/30 space-y-2">
        <div class="text-[11px] font-bold text-indigo-300">
          🔗 คลิกปุ่มตัวแปรด้านล่างเพื่อแทรกเข้าช่องหลัก:
        </div>
        <div id="target-field-indicator" class="text-[10px] text-cyan-300 bg-slate-950/80 px-2 py-1 rounded border border-slate-800">
          ช่องเป้าหมายปัจจุบัน: "${lastFocusedFieldKey || def.primaryField}"
        </div>
        <div class="space-y-1.5 pt-1">
          ${availableVars.map(v => {
            const info = VARIABLE_DICTIONARY[v] || { label: 'ข้อมูลจากบล็อกก่อนหน้า', source: 'Flow' };
            return `
              <button onclick="insertVariableIntoTargetField(${node.id}, '${v}')"
                class="w-full text-left px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-indigo-600/40 border border-indigo-500/30 hover:border-indigo-400 transition flex items-center justify-between gap-2 group cursor-pointer">
                <span class="font-mono-code text-[11px] font-bold text-amber-300 group-hover:text-white">+ ${v}</span>
                <span class="text-[10px] text-slate-400 group-hover:text-slate-200 truncate">${info.label}</span>
              </button>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Produced Variables Info -->
      ${def.producedVars.length > 0 ? `
        <div class="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
          <div class="text-[11px] font-semibold text-emerald-400">📤 ตัวแปรที่บล็อกนี้ผลิตส่งให้บล็อกถัดไป:</div>
          <div class="space-y-1">
            ${def.producedVars.map(v => {
              const info = VARIABLE_DICTIONARY[v] || { label: '' };
              return `
                <div class="text-[11px] flex items-center justify-between bg-emerald-950/30 border border-emerald-500/20 px-2 py-1 rounded">
                  <span class="font-mono-code text-emerald-300 font-semibold">${v}</span>
                  <span class="text-[10px] text-slate-400">${info.label}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function applySmartPreset(nodeId) {
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return;
  const def = BLOCK_CATALOG.find(b => b.type === node.type);
  if (!def || !def.smartPreset) return;

  const availVars = getAvailableVariablesForNode();
  const newCfg = def.smartPreset(availVars, node.config);
  node.config = { ...node.config, ...newCfg };

  saveCurrentLevelToStorage();
  renderCanvas();
  renderInspector();
}

function autoFillAllNodesVariables() {
  const availVars = getAvailableVariablesForNode();
  nodes.forEach(node => {
    const def = BLOCK_CATALOG.find(b => b.type === node.type);
    if (def && def.smartPreset) {
      const newCfg = def.smartPreset(availVars, node.config);
      node.config = { ...node.config, ...newCfg };
    }
  });
  saveCurrentLevelToStorage();
  renderCanvas();
  renderInspector();
  checkVariablesInFlow();
}

function updateNodeConfig(nodeId, key, value) {
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return;
  node.config[key] = value;
  saveCurrentLevelToStorage();
  renderCanvas();
}

function getAvailableVariablesForNode() {
  const vars = new Set();
  nodes.forEach(n => {
    const d = BLOCK_CATALOG.find(b => b.type === n.type);
    if (d && d.producedVars) {
      d.producedVars.forEach(v => vars.add(v));
    }
  });
  if (vars.size === 0) {
    ['{{customer_name}}', '{{phone}}', '{{amount}}', '{{message_text}}', '{{ai_result}}'].forEach(v => vars.add(v));
  }
  return Array.from(vars);
}

function insertVariableIntoTargetField(nodeId, variableStr) {
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return;
  const def = BLOCK_CATALOG.find(b => b.type === node.type);

  // เลือกช่องที่ผู้ใช้คลิกล่าสุด หรือใช้ primaryField ของบล็อกนั้น (ไม่เอาไปยัดช่องสุดท้ายมั่วๆ แล้ว!)
  let targetKey = lastFocusedFieldKey || def.primaryField;
  const validField = def.fields.find(f => f.key === targetKey && (f.type === 'text' || f.type === 'textarea'));
  if (!validField) {
    const fallback = def.fields.find(f => f.key === def.primaryField) || def.fields.find(f => f.type === 'textarea' || f.type === 'text');
    if (!fallback) return;
    targetKey = fallback.key;
  }

  const currentVal = node.config[targetKey] || '';
  if (targetKey === 'leftValue' || targetKey === 'switchField' || targetKey === 'sourceList') {
    // ช่องพวกนี้มักใส่ตัวแปรเดี่ยวๆ แทนที่ของเดิมได้เลย
    node.config[targetKey] = variableStr;
  } else {
    node.config[targetKey] = currentVal ? `${currentVal} ${variableStr}` : variableStr;
  }

  saveCurrentLevelToStorage();
  renderCanvas();
  renderInspector();
}

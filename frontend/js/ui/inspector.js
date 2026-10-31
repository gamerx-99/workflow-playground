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
    container.innerHTML = '';
    closeBlockPopover(); // ไม่ได้เลือกบล็อก = ไม่มีหน้าต่างตั้งค่า
    return;
  }

  const node = nodes.find(n => n.id === selectedNodeId);
  if (!node) {
    closeBlockPopover();
    return;
  }
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
        ${node.type === 'logic_switch' ? renderSwitchFields(node, def) : (node.type === 'logic_if' ? renderIfFields(node, def) : def.fields.map(f => {
          if (f.key === 'customTarget' && node.config.target !== 'custom') return '';
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

  openBlockPopover(); // แสดงหน้าต่างตั้งค่าข้างบล็อกที่เลือก (ดู ui/popover.js)
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

// ---------------------------------------------------------
// DYNAMIC SWITCH ROUTE HANDLERS (MULTI-ROUTE 3+)
// ---------------------------------------------------------
function getSwitchRoutes(node) {
  if (Array.isArray(node.config && node.config.routes) && node.config.routes.length > 0) {
    return node.config.routes;
  }
  const routes = [
    { id: 'route_a', label: 'สาย A', condition: (node.config && node.config.caseA) || 'จองที่พัก', operator: '==' },
    { id: 'route_b', label: 'สาย B', condition: (node.config && node.config.caseB) || 'สั่งอาหาร', operator: '==' },
    { id: 'route_c', label: 'สาย C', condition: (node.config && node.config.caseC) || 'ติดต่อสอบถามทั่วไป', operator: '==' }
  ];
  if (!node.config) node.config = {};
  node.config.routes = routes;
  return routes;
}

function renderSwitchFields(node, def) {
  const switchVal = (node.config && node.config.switchField) || '';
  const routes = getSwitchRoutes(node);
  const routeColors = [
    'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
    'text-amber-300 border-amber-500/40 bg-amber-500/10',
    'text-rose-300 border-rose-500/40 bg-rose-500/10',
    'text-sky-300 border-sky-500/40 bg-sky-500/10',
    'text-purple-300 border-purple-500/40 bg-purple-500/10',
    'text-cyan-300 border-cyan-500/40 bg-cyan-500/10'
  ];

  return `
    <div>
      <label class="block text-[11px] font-semibold text-slate-200 mb-1">
        🎯 ตัวแปรที่ใช้แยกสาย (ใส่ตัวแปรที่นี่)
        <span class="ml-1 px-1.5 py-0.5 text-[9px] rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">ช่องใส่ตัวแปรหลัก</span>
      </label>
      <input id="field-${node.id}-switchField" type="text" value="${escapeHtml(switchVal)}"
        onfocus="setFocusedField('switchField')"
        oninput="updateNodeConfig(${node.id}, 'switchField', this.value)"
        placeholder="เช่น {{service_type}}"
        class="w-full bg-slate-950 border border-cyan-500/50 rounded-lg px-2.5 py-1.5 text-xs font-mono-code text-white focus:outline-none focus:border-cyan-400" />
    </div>

    <div class="space-y-2 pt-2 border-t border-slate-800">
      <div class="flex items-center justify-between">
        <label class="text-[11px] font-bold text-slate-300 flex items-center gap-1">
          <span>🧭</span> เส้นทางเงื่อนไข (${routes.length} สาย)
        </label>
        <span class="text-[10px] text-slate-400">เพิ่มสายได้ไม่จำกัด</span>
      </div>

      <div class="space-y-2">
        ${routes.map((r, i) => {
          const colorClass = routeColors[i % routeColors.length];
          const op = r.operator || '==';
          return `
            <div class="p-2 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-bold px-2 py-0.5 rounded border ${colorClass}">
                  ${escapeHtml(r.label || `สาย ${String.fromCharCode(65 + i)}`)}
                </span>
                ${routes.length > 2 ? `
                  <button type="button" onclick="removeSwitchRoute(${node.id}, ${i})" title="ลบสายนี้"
                    class="text-slate-500 hover:text-rose-400 text-xs px-1 cursor-pointer">✕</button>
                ` : ''}
              </div>
              <div class="flex items-center gap-1.5">
                <select onchange="updateSwitchRouteOperator(${node.id}, ${i}, this.value)"
                  class="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-indigo-500">
                  <option value="==" ${op === '==' ? 'selected' : ''}>== เท่ากับ</option>
                  <option value="contains" ${op === 'contains' ? 'selected' : ''}>🔍 มีคำว่า</option>
                  <option value="starts_with" ${op === 'starts_with' ? 'selected' : ''}>▶️ ขึ้นต้น</option>
                  <option value="!=" ${op === '!=' ? 'selected' : ''}>!= ไม่เท่ากับ</option>
                  <option value=">=" ${op === '>=' ? 'selected' : ''}>&gt;= มากกว่าเท่ากับ</option>
                  <option value="<=" ${op === '<=' ? 'selected' : ''}>&lt;= น้อยกว่าเท่ากับ</option>
                  <option value=">" ${op === '>' ? 'selected' : ''}>&gt; มากกว่า</option>
                  <option value="<" ${op === '<' ? 'selected' : ''}>&lt; น้อยกว่า</option>
                </select>
                <input type="text" value="${escapeHtml(r.condition || '')}"
                  placeholder="เช่น ค่าที่ต้องการเทียบ"
                  oninput="updateSwitchRouteCondition(${node.id}, ${i}, this.value)"
                  class="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500" />
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <div class="p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
        <div class="flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded-full bg-slate-500 inline-block"></span>
          <span class="font-bold text-slate-300">กรณีอื่นๆ (Default)</span>
        </div>
        <span class="text-[10px] text-slate-400">ทำงานเมื่อไม่ตรงกับสายใดๆ</span>
      </div>

      <button type="button" onclick="addSwitchRoute(${node.id})"
        class="w-full py-1.5 px-3 rounded-xl border border-dashed border-indigo-500/50 hover:border-indigo-400 text-indigo-300 hover:text-indigo-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer bg-indigo-500/5 hover:bg-indigo-500/10 mt-1">
        <span>➕ เพิ่มเส้นทางใหม่ (สาย ${String.fromCharCode(65 + routes.length)})</span>
      </button>
    </div>
  `;
}

function addSwitchRoute(nodeId) {
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return;
  const routes = getSwitchRoutes(node);
  const nextIdx = routes.length;
  const letter = String.fromCharCode(65 + nextIdx);
  routes.push({
    id: `route_${letter.toLowerCase()}`,
    label: `สาย ${letter}`,
    condition: '',
    operator: '=='
  });
  node.config.routes = routes;
  syncSwitchLegacyFields(node);
  saveCurrentLevelToStorage();
  renderCanvas();
  renderInspector();
}

function removeSwitchRoute(nodeId, routeIndex) {
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return;
  const routes = getSwitchRoutes(node);
  if (routes.length <= 2) return;
  const removed = routes.splice(routeIndex, 1)[0];
  if (removed && typeof connections !== 'undefined') {
    connections = connections.filter(c => !(c.fromNode === nodeId && c.fromPort === removed.id));
  }
  routes.forEach((r, idx) => {
    const letter = String.fromCharCode(65 + idx);
    r.id = `route_${letter.toLowerCase()}`;
    r.label = `สาย ${letter}`;
  });
  node.config.routes = routes;
  syncSwitchLegacyFields(node);
  saveCurrentLevelToStorage();
  renderCanvas();
  renderInspector();
}

function updateSwitchRouteCondition(nodeId, routeIndex, value) {
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return;
  const routes = getSwitchRoutes(node);
  if (routes[routeIndex]) {
    routes[routeIndex].condition = value;
  }
  node.config.routes = routes;
  syncSwitchLegacyFields(node);
  saveCurrentLevelToStorage();
  renderCanvas();
}

function updateSwitchRouteOperator(nodeId, routeIndex, value) {
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return;
  const routes = getSwitchRoutes(node);
  if (routes[routeIndex]) {
    routes[routeIndex].operator = value;
  }
  node.config.routes = routes;
  saveCurrentLevelToStorage();
  renderCanvas();
}

function syncSwitchLegacyFields(node) {
  if (Array.isArray(node.config.routes)) {
    node.config.caseA = node.config.routes[0]?.condition || '';
    node.config.caseB = node.config.routes[1]?.condition || '';
    node.config.caseC = node.config.routes[2]?.condition || '';
  }
}

// ---------------------------------------------------------
// DYNAMIC MULTI-CONDITION IF HANDLERS (AND / OR)
// ---------------------------------------------------------
function getIfConditions(node) {
  if (Array.isArray(node.config && node.config.conditions) && node.config.conditions.length > 0) {
    return node.config.conditions;
  }
  const conds = [
    {
      leftValue: (node.config && node.config.leftValue) || '{{amount}}',
      operator: (node.config && node.config.operator) || '>=',
      rightValue: (node.config && node.config.rightValue) || '1000'
    }
  ];
  if (!node.config) node.config = {};
  node.config.conditions = conds;
  if (!node.config.conditionLogic) node.config.conditionLogic = 'AND';
  return conds;
}

function renderIfFields(node, def) {
  const conds = getIfConditions(node);
  const logic = (node.config && node.config.conditionLogic) || 'AND';

  const opOptions = [
    { value: '>=', label: '>= มากกว่าหรือเท่ากับ' },
    { value: '>', label: '> มากกว่า' },
    { value: '<=', label: '<= น้อยกว่าหรือเท่ากับ' },
    { value: '<', label: '< น้อยกว่า' },
    { value: '==', label: '== เท่ากับ' },
    { value: '!=', label: '!= ไม่เท่ากับ' },
    { value: 'contains', label: 'มีคำว่า (Contains)' },
    { value: 'not_contains', label: 'ไม่มีคำว่า (Not Contains)' },
    { value: 'starts_with', label: 'ขึ้นต้นด้วย (Starts With)' },
    { value: 'ends_with', label: 'ลงท้ายด้วย (Ends With)' },
    { value: 'is_empty', label: 'เป็นค่าว่าง (Is Empty)' },
    { value: 'is_not_empty', label: 'มีค่า ไม่ว่าง (Is Not Empty)' }
  ];

  return `
    <div class="space-y-2.5">
      <div class="flex items-center justify-between pb-1 border-b border-slate-800">
        <label class="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
          <span>🔀</span> เงื่อนไขการตรวจสอบ (${conds.length} ข้อ)
        </label>
        <div class="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
          <button type="button" onclick="setIfLogic(${node.id}, 'AND')"
            class="px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${logic === 'AND' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}">
            AND (และ)
          </button>
          <button type="button" onclick="setIfLogic(${node.id}, 'OR')"
            class="px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${logic === 'OR' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'}">
            OR (หรือ)
          </button>
        </div>
      </div>

      <div class="space-y-2">
        ${conds.map((c, i) => `
          <div class="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/30">
                เงื่อนไขข้อที่ ${i + 1}
              </span>
              ${conds.length > 1 ? `
                <button type="button" onclick="removeIfCondition(${node.id}, ${i})" title="ลบเงื่อนไขข้อนี้"
                  class="text-slate-500 hover:text-rose-400 text-xs px-1 cursor-pointer">✕</button>
              ` : ''}
            </div>

            <div>
              <label class="block text-[10px] text-slate-400 mb-0.5">🎯 1. ค่าที่ตรวจ (ใส่ตัวแปร)</label>
              <input id="field-${node.id}-cond-left-${i}" type="text" value="${escapeHtml(c.leftValue || '')}"
                placeholder="เช่น {{amount}} หรือ {{ai_result}}"
                onfocus="setFocusedField('cond-left-${i}')"
                oninput="updateIfConditionField(${node.id}, ${i}, 'leftValue', this.value)"
                class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono-code text-white focus:outline-none focus:border-indigo-500" />
            </div>

            <div class="grid grid-cols-2 gap-1.5">
              <div>
                <label class="block text-[10px] text-slate-400 mb-0.5">2. เครื่องหมาย</label>
                <select onchange="updateIfConditionField(${node.id}, ${i}, 'operator', this.value)"
                  class="w-full bg-slate-900 border border-slate-700 rounded-lg px-1.5 py-1 text-[11px] text-white focus:outline-none focus:border-indigo-500">
                  ${opOptions.map(op => `
                    <option value="${op.value}" ${c.operator === op.value ? 'selected' : ''}>${op.label}</option>
                  `).join('')}
                </select>
              </div>

              <div>
                <label class="block text-[10px] text-slate-400 mb-0.5">3. ค่าที่ใช้เทียบ</label>
                <input id="field-${node.id}-cond-right-${i}" type="text" value="${escapeHtml(c.rightValue || '')}"
                  placeholder="เช่น 1000 หรือ ด่วน"
                  onfocus="setFocusedField('cond-right-${i}')"
                  oninput="updateIfConditionField(${node.id}, ${i}, 'rightValue', this.value)"
                  class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500" />
              </div>
            </div>
          </div>
        `).join('')}
      </div>

      <button type="button" onclick="addIfCondition(${node.id})"
        class="w-full py-1.5 px-3 rounded-xl border border-dashed border-purple-500/50 hover:border-purple-400 text-purple-300 hover:text-purple-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer bg-purple-500/5 hover:bg-purple-500/10">
        <span>➕ เพิ่มเงื่อนไข (${logic === 'AND' ? 'AND และ' : 'OR หรือ'})</span>
      </button>
    </div>
  `;
}

function setIfLogic(nodeId, logic) {
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return;
  if (!node.config) node.config = {};
  node.config.conditionLogic = logic;
  saveCurrentLevelToStorage();
  renderCanvas();
  renderInspector();
}

function addIfCondition(nodeId) {
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return;
  const conds = getIfConditions(node);
  conds.push({
    leftValue: '{{amount}}',
    operator: '>=',
    rightValue: '1000'
  });
  node.config.conditions = conds;
  syncIfLegacyFields(node);
  saveCurrentLevelToStorage();
  renderCanvas();
  renderInspector();
}

function removeIfCondition(nodeId, index) {
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return;
  const conds = getIfConditions(node);
  if (conds.length <= 1) return;
  conds.splice(index, 1);
  node.config.conditions = conds;
  syncIfLegacyFields(node);
  saveCurrentLevelToStorage();
  renderCanvas();
  renderInspector();
}

function updateIfConditionField(nodeId, index, key, value) {
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return;
  const conds = getIfConditions(node);
  if (conds[index]) {
    conds[index][key] = value;
  }
  node.config.conditions = conds;
  syncIfLegacyFields(node);
  saveCurrentLevelToStorage();
  renderCanvas();
}

function syncIfLegacyFields(node) {
  if (Array.isArray(node.config.conditions) && node.config.conditions[0]) {
    node.config.leftValue = node.config.conditions[0].leftValue || '';
    node.config.operator = node.config.conditions[0].operator || '==';
    node.config.rightValue = node.config.conditions[0].rightValue || '';
  }
}

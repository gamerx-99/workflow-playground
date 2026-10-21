// ---------------------------------------------------------
// STUDIO MODE & LEVEL CREATOR (โหมดออกแบบ & สร้างด่านเอง)
// ---------------------------------------------------------

let currentStudioProject = null;
let studioAutosaveTimeout = null;

// โหลดโปรเจกต์ Studio ที่กำลังเปิดอยู่
async function loadStudioProject(projectId = null) {
  const projects = await Api.listProjects();
  const targetId = projectId || (await Api.getActiveProjectId());
  let proj = projects.find(p => p.id === targetId) || projects[0];

  currentStudioProject = proj;
  await Api.setActiveProjectId(proj.id);

  // นำ flow ขึ้นกระดาน
  cancelWiring();
  selectedNodeId = null;
  lastFocusedFieldKey = null;
  lastRun = null;

  nodes = proj.flow ? JSON.parse(JSON.stringify(proj.flow.nodes || [])) : [];
  connections = proj.flow ? JSON.parse(JSON.stringify(proj.flow.connections || [])) : [];
  nextNodeId = proj.flow ? (proj.flow.nextNodeId || (Math.max(0, ...nodes.map(n => n.id)) + 1)) : 1;

  renderStudioHeaderControls();
  renderCanvas();
  renderInspector();
  centerCanvasView();
}

// อัปเดตแถบควบคุมด้านบนสำหรับโหมด Studio
async function renderStudioHeaderControls() {
  const container = document.getElementById('studio-controls');
  if (!container) return;

  const projects = await Api.listProjects();
  const activeId = currentStudioProject ? currentStudioProject.id : projects[0].id;

  container.innerHTML = `
    <div class="flex items-center gap-1.5 flex-wrap">
      <!-- Project Selector -->
      <div class="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
        <span class="text-[11px] text-slate-400 pl-1.5">📁 โปรเจกต์:</span>
        <select onchange="onStudioProjectChange(this.value)" class="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-medium focus:outline-none focus:border-indigo-500 cursor-pointer">
          ${projects.map(p => `
            <option value="${p.id}" ${p.id === activeId ? 'selected' : ''}>
              ${escapeHtml(p.name)}
            </option>
          `).join('')}
        </select>
        <button onclick="promptCreateNewProject()" title="สร้างโปรเจกต์ใหม่" class="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center text-xs font-bold cursor-pointer transition">
          ➕
        </button>
        <button onclick="promptRenameProject()" title="เปลี่ยนชื่อโปรเจกต์" class="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs cursor-pointer transition">
          ✏️
        </button>
        <button onclick="promptDeleteProject()" title="ลบโปรเจกต์นี้" class="w-7 h-7 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 flex items-center justify-center text-xs cursor-pointer transition">
          🗑️
        </button>
      </div>

      <!-- Quick Action Buttons -->
      <div class="flex items-center gap-1">
        <button onclick="saveStudioProjectNow()" class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1 cursor-pointer transition">
          <span>💾 บันทึก</span>
          <span id="studio-save-indicator" class="text-[10px] text-emerald-400">✓</span>
        </button>
        <button onclick="openExportFlowModal()" class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium flex items-center gap-1 cursor-pointer transition">
          <span>📤 ส่งออก JSON</span>
        </button>
        <button onclick="openImportFlowModal()" class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium flex items-center gap-1 cursor-pointer transition">
          <span>📥 นำเข้า JSON</span>
        </button>
        <button onclick="openCreateLevelWizard()" class="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 flex items-center gap-1.5 cursor-pointer transition">
          <span>🎓 สร้างด่านแบบฝึกหัด</span>
        </button>
      </div>
    </div>
  `;
}

async function onStudioProjectChange(projectId) {
  await saveStudioProjectNow();
  await loadStudioProject(projectId);
}

async function promptCreateNewProject() {
  const name = prompt('กรุณาตั้งชื่อโปรเจกต์ใหม่:', `โปรเจกต์ ${Date.now().toString().slice(-4)}`);
  if (!name || !name.trim()) return;
  const newProj = await Api.createProject(name.trim());
  await loadStudioProject(newProj.id);
}

async function promptRenameProject() {
  if (!currentStudioProject) return;
  const newName = prompt('แก้ไขชื่อโปรเจกต์:', currentStudioProject.name);
  if (!newName || !newName.trim()) return;
  currentStudioProject.name = newName.trim();
  await Api.saveProject(currentStudioProject);
  renderStudioHeaderControls();
}

async function promptDeleteProject() {
  if (!currentStudioProject) return;
  const projects = await Api.listProjects();
  if (projects.length <= 1) {
    alert('คุณต้องมีโปรเจกต์อย่างน้อย 1 รายการในสตูดิโอครับ');
    return;
  }
  if (!confirm(`คุณต้องการลบโปรเจกต์ "${currentStudioProject.name}" ใช่หรือไม่?`)) return;
  await Api.deleteProject(currentStudioProject.id);
  await loadStudioProject();
}

async function saveStudioProjectNow() {
  if (!currentStudioProject) return;
  currentStudioProject.flow = {
    nodes: JSON.parse(JSON.stringify(nodes)),
    connections: JSON.parse(JSON.stringify(connections)),
    nextNodeId
  };
  await Api.saveProject(currentStudioProject);
  const ind = document.getElementById('studio-save-indicator');
  if (ind) {
    ind.textContent = '✓ บันทึกแล้ว';
    setTimeout(() => { if (ind) ind.textContent = '✓'; }, 2000);
  }
}

function scheduleStudioAutosave() {
  if (currentAppMode !== 'studio') return;
  const ind = document.getElementById('studio-save-indicator');
  if (ind) ind.textContent = '...';
  clearTimeout(studioAutosaveTimeout);
  studioAutosaveTimeout = setTimeout(() => {
    saveStudioProjectNow();
  }, 1000);
}

// ---------------------------------------------------------
// LEVEL CREATOR WIZARD (ตัวช่วยสร้างด่านแบบฝึกหัด)
// ---------------------------------------------------------

let wizardDerivedChecks = [];
let wizardTemplateFlow = null;

function openCreateLevelWizard() {
  if (nodes.length === 0) {
    alert('กรุณาวางบล็อกและต่อสายบนกระดานให้เรียบร้อยก่อนสร้างเป็นด่านแบบฝึกหัดครับ');
    return;
  }

  wizardTemplateFlow = {
    nodes: JSON.parse(JSON.stringify(nodes)),
    connections: JSON.parse(JSON.stringify(connections))
  };

  const modal = document.getElementById('create-level-modal');
  const levelTitleInput = document.getElementById('wizard-title');
  const levelShortInput = document.getElementById('wizard-short');
  const levelDescInput = document.getElementById('wizard-desc');

  if (currentStudioProject && (!levelTitleInput.value || levelTitleInput.value === '')) {
    levelTitleInput.value = currentStudioProject.name;
    levelShortInput.value = currentStudioProject.name.slice(0, 10);
  }

  // คำนวณ checks อัตโนมัติจาก flow ปัจจุบัน
  calculateWizardChecks();

  // สร้างคำใบ้เริ่มต้น
  autoPopulateWizardHints();

  modal.classList.remove('hidden');
}

function closeCreateLevelWizard() {
  document.getElementById('create-level-modal').classList.add('hidden');
}

function calculateWizardChecks() {
  const tempLevel = {
    template: wizardTemplateFlow
  };
  wizardDerivedChecks = deriveChecks(tempLevel, BLOCK_CATALOG);
  renderWizardChecksPreview();
}

function renderWizardChecksPreview() {
  const container = document.getElementById('wizard-checks-preview');
  if (!container) return;

  container.innerHTML = `
    <div class="space-y-1.5">
      <div class="text-[11px] font-bold text-slate-300 flex items-center justify-between">
        <span>เกณฑ์ตรวจที่สร้างให้อัตโนมัติ (${wizardDerivedChecks.length} ข้อ):</span>
        <button type="button" onclick="calculateWizardChecks()" class="text-[10px] text-cyan-400 hover:text-cyan-300">↺ คำนวณใหม่</button>
      </div>
      <div class="space-y-1 max-h-36 overflow-y-auto p-2 rounded-xl bg-slate-950 border border-slate-800 text-[11px]">
        ${wizardDerivedChecks.map((chk, i) => {
          let label = chk.label || '';
          if (!label) {
            if (chk.type === 'block') label = `ต้องมีบล็อก ${chk.block} อย่างน้อย ${chk.min || 1} บล็อก`;
            else if (chk.type === 'link') label = `เชื่อมจาก ${chk.from}${chk.port ? ` (${chk.port})` : ''} ➔ ${chk.to}`;
            else if (chk.type === 'vars') label = `บล็อก ${chk.block} ช่อง ${chk.field} ต้องมีตัวแปร {{${chk.vars.join('}}, {{')}}}`;
            else if (chk.type === 'value') label = `บล็อก ${chk.block} ช่อง ${chk.field} ค่าต้องเป็น ${chk.oneOf.join(' หรือ ')}`;
            else if (chk.type === 'reachable') label = `ทุกบล็อกต้องเชื่อมต่อและส่งข้อมูลถึงกันได้`;
            else if (chk.type === 'upstreamVars') label = `ตัวแปรที่ใช้ต้องมีบล็อกต้นทางส่งมาจริง`;
            else label = `ตรวจเงื่อนไข ${chk.type}`;
          }
          return `<div class="text-slate-300 flex items-center gap-1.5"><span>•</span> <span>${escapeHtml(label)}</span></div>`;
        }).join('')}
      </div>
    </div>
  `;
}

function autoPopulateWizardHints() {
  const tempLevel = {
    template: wizardTemplateFlow
  };
  const hints = getProgressiveHints(tempLevel, BLOCK_CATALOG);
  const h1 = document.getElementById('wizard-hint-1');
  const h2 = document.getElementById('wizard-hint-2');
  const h3 = document.getElementById('wizard-hint-3');

  if (h1 && !h1.value) h1.value = hints[0].text.replace(/<[^>]*>/g, '');
  if (h2 && !h2.value) h2.value = hints[1].text.replace(/<[^>]*>/g, '');
  if (h3 && !h3.value) h3.value = hints[2].text.replace(/<[^>]*>/g, '');
}

function testWizardCheck() {
  const resultBox = document.getElementById('wizard-test-result');
  const tempLevel = {
    template: wizardTemplateFlow,
    checks: wizardDerivedChecks
  };
  const result = checkFlow(tempLevel, wizardTemplateFlow, BLOCK_CATALOG);
  
  resultBox.innerHTML = `
    <div class="p-3 rounded-xl border ${result.passed ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200' : 'bg-rose-950/40 border-rose-500/40 text-rose-200'} text-xs">
      <b>${result.passed ? '✅ ตรวจสอบผ่าน 100%!' : '❌ ยังไม่ผ่านเกณฑ์'}</b>
      <div>ผ่าน ${result.score} จาก ${result.total} ข้อ (Flow เฉลยนี้พร้อมใช้งานสำหรับด่านใหม่)</div>
    </div>
  `;
}

function buildCustomLevelObjectFromForm() {
  const title = (document.getElementById('wizard-title').value || '').trim() || 'ด่านแบบฝึกหัดใหม่';
  const shortName = (document.getElementById('wizard-short').value || '').trim() || title.slice(0, 8);
  const track = document.getElementById('wizard-track').value || 'custom';
  const difficulty = parseInt(document.getElementById('wizard-difficulty').value || '2', 10);
  const mode = document.getElementById('wizard-mode').value || 'build';
  const desc = (document.getElementById('wizard-desc').value || '').trim() || 'สร้าง flow ตามเป้าหมายที่กำหนด';

  const h1 = (document.getElementById('wizard-hint-1').value || '').trim();
  const h2 = (document.getElementById('wizard-hint-2').value || '').trim();
  const h3 = (document.getElementById('wizard-hint-3').value || '').trim();

  const customLevel = {
    id: 'custom_' + Date.now(),
    title,
    shortName,
    badge: 'สร้างเอง',
    track,
    difficulty,
    mode,
    desc,
    hints: [h1, h2, h3],
    template: wizardTemplateFlow,
    checks: wizardDerivedChecks,
    createdAt: Date.now()
  };

  // ถ้าเป็นโหมด fill หรือ debug: จัดเตรียมกระดานเริ่มต้น (start)
  if (mode === 'fill' || mode === 'debug') {
    customLevel.start = JSON.parse(JSON.stringify(wizardTemplateFlow));
    if (mode === 'fill') {
      // ล้างช่องตัวแปรของ action nodes
      customLevel.start.nodes.forEach(n => {
        if (!n.type.startsWith('trigger_') && n.config) {
          Object.keys(n.config).forEach(k => {
            if (typeof n.config[k] === 'string' && n.config[k].includes('{{')) {
              n.config[k] = '';
            }
          });
        }
      });
    }
  }

  return customLevel;
}

async function saveCustomLevelToApp() {
  const levelObj = buildCustomLevelObjectFromForm();
  await Api.saveCustomLevel(levelObj);
  alert(`บันทึกด่าน "${levelObj.title}" เรียบร้อยแล้ว!\nสามารถเข้าไปเล่นได้ในโหมดฝึก หรือในหน้าแรกหมวด "ด่านสร้างเอง" ครับ`);
  closeCreateLevelWizard();
  if (confirm('คุณต้องการสลับไปทดลองเล่นด่านนี้ในโหมดฝึกทันทีเลยไหมครับ?')) {
    switchView('practice', levelObj.id);
  }
}

function exportCustomLevelAsJsonFile() {
  const levelObj = buildCustomLevelObjectFromForm();
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(levelObj, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `level_${levelObj.shortName.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'custom'}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

// ---------------------------------------------------------
// FLOW IMPORT / EXPORT
// ---------------------------------------------------------

function openExportFlowModal() {
  const flow = {
    name: currentStudioProject ? currentStudioProject.name : 'Flow Export',
    version: 1,
    exportedAt: new Date().toISOString(),
    nodes,
    connections,
    nextNodeId
  };
  const json = JSON.stringify(flow, null, 2);
  const modal = document.getElementById('flow-import-export-modal');
  document.getElementById('flow-io-title').textContent = '📤 ส่งออก Flow (JSON)';
  document.getElementById('flow-io-desc').textContent = 'คัดลอกข้อความ JSON ด้านล่าง หรือกดปุ่มดาวน์โหลดเป็นไฟล์ .json';
  document.getElementById('flow-io-textarea').value = json;
  document.getElementById('flow-io-textarea').readOnly = true;
  document.getElementById('flow-io-download-btn').classList.remove('hidden');
  document.getElementById('flow-io-apply-btn').classList.add('hidden');
  modal.classList.remove('hidden');
}

function openImportFlowModal() {
  const modal = document.getElementById('flow-import-export-modal');
  document.getElementById('flow-io-title').textContent = '📥 นำเข้า Flow (JSON)';
  document.getElementById('flow-io-desc').textContent = 'วางข้อความ JSON หรือเลือกไฟล์ .json จากคอมพิวเตอร์ของคุณเพื่อนำขึ้นกระดาน';
  document.getElementById('flow-io-textarea').value = '';
  document.getElementById('flow-io-textarea').readOnly = false;
  document.getElementById('flow-io-download-btn').classList.add('hidden');
  document.getElementById('flow-io-apply-btn').classList.remove('hidden');
  modal.classList.remove('hidden');
}

function closeFlowIoModal() {
  document.getElementById('flow-import-export-modal').classList.add('hidden');
}

function downloadExportedFlowFile() {
  const json = document.getElementById('flow-io-textarea').value;
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(json);
  const a = document.createElement('a');
  a.setAttribute('href', dataStr);
  a.setAttribute('download', `${(currentStudioProject ? currentStudioProject.name : 'flow').replace(/[^a-zA-Z0-9ก-๙]/g, '_')}.json`);
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function applyImportedFlow() {
  const raw = document.getElementById('flow-io-textarea').value;
  if (!raw || !raw.trim()) {
    alert('กรุณาวางข้อความ JSON ก่อนครับ');
    return;
  }
  try {
    const data = JSON.parse(raw);
    const importedNodes = data.nodes || [];
    const importedConns = data.connections || [];
    if (!Array.isArray(importedNodes)) throw new Error('ข้อมูล nodes ต้องเป็น Array');

    nodes = importedNodes;
    connections = importedConns;
    nextNodeId = data.nextNodeId || (Math.max(0, ...nodes.map(n => n.id)) + 1);

    renderCanvas();
    renderInspector();
    centerCanvasView();
    saveStudioProjectNow();
    closeFlowIoModal();
    alert(`นำเข้า Flow สำเร็จ! (บล็อก: ${nodes.length}, เส้นเชื่อม: ${connections.length})`);
  } catch (e) {
    alert(`เกิดข้อผิดพลาดในการนำเข้า: ${e.message}`);
  }
}

function handleFlowFileUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('flow-io-textarea').value = e.target.result;
  };
  reader.readAsText(file);
}

// นำเข้าด่านแบบฝึกหัด (Custom Level JSON)
function openImportLevelModal() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const levelData = JSON.parse(event.target.result);
        if (!levelData.title || !levelData.template) {
          throw new Error('ไฟล์นี้ไม่ใช่ไฟล์ด่านแบบฝึกหัดที่ถูกต้อง (ต้องมี title และ template)');
        }
        const saved = await Api.saveCustomLevel(levelData, { asNew: true });
        alert(`นำเข้าด่าน "${saved.title}" สำเร็จแล้ว!`);
        if (confirm('ต้องการเปิดเล่นด่านนี้ในโหมดฝึกทันทีเลยไหมครับ?')) {
          switchView('practice', saved.id);
        } else {
          renderHomeView();
        }
      } catch (err) {
        alert(`นำเข้าด่านไม่สำเร็จ: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

// ---------------------------------------------------------
// API LAYER — ตัวกลางระหว่างหน้าเว็บกับแหล่งข้อมูล
// ตอนนี้ใช้ localStorage ในเบราว์เซอร์ (ทำงานออฟไลน์ได้)
// เมื่อมี backend: เขียน object ใหม่ที่มีเมธอดเหมือนกันแต่เรียก fetch('/api/...') แล้วสลับ Api = RemoteApi
// ทุกเมธอดคืน Promise เพื่อให้สลับไปใช้ backend จริงได้โดยไม่ต้องแก้ส่วน UI
// ---------------------------------------------------------
const STORAGE_KEY = 'workflow_automation_lab_smart_var_v3';
const PROGRESS_KEY = 'workflow_automation_lab_progress_v1';
const COACH_BASE_URL = 'http://127.0.0.1:8787'; // backend/server.py

function readStore(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function writeStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {}
}

const LocalApi = {
  // GET /levels
  async getLevels() {
    return LEVELS;
  },

  // GET /levels/:id/flow
  async loadFlow(levelId) {
    const saved = readStore(STORAGE_KEY, {})[levelId];
    if (!saved || !Array.isArray(saved.nodes)) return null;
    return {
      nodes: saved.nodes,
      connections: saved.connections || [],
      nextNodeId: saved.nextNodeId || (saved.nodes.length + 1)
    };
  },

  // PUT /levels/:id/flow
  async saveFlow(levelId, flow) {
    const all = readStore(STORAGE_KEY, {});
    all[levelId] = flow;
    writeStore(STORAGE_KEY, all);
  },

  // POST /levels/:id/check — ตรวจคำตอบ และบันทึกว่าผ่านด่านแล้วถ้าผ่าน
  // ด่านทายผล (predict) ส่ง answers แทน flow
  async checkLevel(levelId, flow, answers) {
    const level = LEVELS.find(l => l.id === levelId);
    if (!level) throw new Error(`ไม่พบด่าน ${levelId}`);
    const result = level.mode === 'predict'
      ? checkPrediction(level, answers, BLOCK_CATALOG)
      : checkFlow(level, flow, BLOCK_CATALOG);
    if (result.passed) {
      const progress = readStore(PROGRESS_KEY, { passed: [] });
      if (!progress.passed.includes(levelId)) {
        progress.passed.push(levelId);
        writeStore(PROGRESS_KEY, progress);
      }
    }
    return result;
  },

  // GET /progress
  async getProgress() {
    return readStore(PROGRESS_KEY, { passed: [] });
  },

  // POST /coach (backend Python + Antigravity SDK) — คืน { ok, reply } หรือ { ok:false, reason }
  // reason: offline | no_api_key | busy | timeout | failed
  async coach(levelId, flow, checkResult, attempt) {
    const level = LEVELS.find(l => l.id === levelId);
    const body = {
      level_id: levelId,
      level_title: level.title,
      level_desc: level.desc,
      mode: level.mode || 'build',
      flow: { nodes: flow.nodes, connections: flow.connections },
      check_items: checkResult.items.map(i => ({ ok: i.ok, label: i.label, detail: i.detail || '' })),
      attempt
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 70000);
    try {
      const res = await fetch(`${COACH_BASE_URL}/coach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      if (res.ok) return { ok: true, reply: await res.json() };
      const err = (await res.json().catch(() => ({}))).error;
      const reasons = { no_api_key: 'no_api_key', busy: 'busy', timeout: 'timeout' };
      return { ok: false, reason: reasons[err] || 'failed' };
    } catch (e) {
      return { ok: false, reason: e.name === 'AbortError' ? 'timeout' : 'offline' };
    } finally {
      clearTimeout(timer);
    }
  }
};

const Api = LocalApi;

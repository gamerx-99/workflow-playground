// ---------------------------------------------------------
// API LAYER — ตัวกลางระหว่างหน้าเว็บกับแหล่งข้อมูล
// ตอนนี้ใช้ localStorage ในเบราว์เซอร์ (ทำงานออฟไลน์ได้)
// เมื่อมี backend: เขียน object ใหม่ที่มีเมธอดเหมือนกันแต่เรียก fetch('/api/...') แล้วสลับ Api = RemoteApi
// ทุกเมธอดคืน Promise เพื่อให้สลับไปใช้ backend จริงได้โดยไม่ต้องแก้ส่วน UI
// ---------------------------------------------------------
const STORAGE_KEY = 'workflow_automation_lab_smart_var_v3';
const PROGRESS_KEY = 'workflow_automation_lab_progress_v1';

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
  async checkLevel(levelId, flow) {
    const level = LEVELS.find(l => l.id === levelId);
    if (!level) throw new Error(`ไม่พบด่าน ${levelId}`);
    const result = checkFlow(level, flow, BLOCK_CATALOG);
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
  }
};

const Api = LocalApi;

// ---------------------------------------------------------
// API LAYER — ตัวกลางระหว่างหน้าเว็บกับแหล่งข้อมูล
// ตอนนี้ใช้ localStorage ในเบราว์เซอร์ (ทำงานออฟไลน์ได้)
// เมื่อมี backend: เขียน object ใหม่ที่มีเมธอดเหมือนกันแต่เรียก fetch('/api/...') แล้วสลับ Api = RemoteApi
// ทุกเมธอดคืน Promise เพื่อให้สลับไปใช้ backend จริงได้โดยไม่ต้องแก้ส่วน UI
// ---------------------------------------------------------
const STORAGE_KEY = 'workflow_automation_lab_smart_var_v3';
const PROGRESS_KEY = 'workflow_automation_lab_progress_v1';
const STUDIO_PROJECTS_KEY = 'workflow_automation_lab_studio_projects_v1';
const STUDIO_ACTIVE_ID_KEY = 'workflow_automation_lab_studio_active_id_v1';
const CUSTOM_LEVELS_KEY = 'workflow_automation_lab_custom_levels_v1';
const TOUR_SEEN_KEY = 'workflow_automation_lab_tour_seen_v1';
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

// ด่านสร้างเอง: ทำความสะอาดทุกครั้งที่อ่าน/เขียน (กัน XSS จากไฟล์ด่านที่นำเข้า — ดู shared/sanitize.js)
function cleanCustomLevel(raw) {
  const level = sanitizeCustomLevel(raw, BLOCK_CATALOG, TRACKS.map(t => t.id), CHECK_RUNNERS);
  [['createdAt', raw.createdAt], ['updatedAt', raw.updatedAt]].forEach(([k, v]) => {
    if (Number.isFinite(Number(v))) level[k] = Number(v);
  });
  return level;
}

function readCustomLevels() {
  const stored = readStore(CUSTOM_LEVELS_KEY, []);
  return (Array.isArray(stored) ? stored : []).flatMap(raw => {
    try {
      return [cleanCustomLevel(raw)];
    } catch (e) {
      return []; // ข้ามด่านที่พัง/ไม่ปลอดภัย แทนที่จะทำให้ทั้งแอปล่ม
    }
  });
}

const LocalApi = {
  // GET /levels (รวมด่านหลัก 30 ด่าน + ด่านสร้างเอง Custom)
  async getLevels() {
    return [...LEVELS, ...readCustomLevels()];
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
    const all = await this.getLevels();
    const level = all.find(l => String(l.id) === String(levelId));
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

  // --- STUDIO PROJECTS MANAGEMENT ---
  // ดึงรายการโปรเจกต์ทั้งหมดใน Studio
  async listProjects() {
    const list = readStore(STUDIO_PROJECTS_KEY, null);
    if (!list || !Array.isArray(list) || list.length === 0) {
      const defaultProj = {
        id: 'proj_default',
        name: 'โปรเจกต์หลักของฉัน',
        updatedAt: Date.now(),
        flow: { nodes: [], connections: [], nextNodeId: 1 }
      };
      writeStore(STUDIO_PROJECTS_KEY, [defaultProj]);
      writeStore(STUDIO_ACTIVE_ID_KEY, defaultProj.id);
      return [defaultProj];
    }
    return list;
  },

  async getActiveProjectId() {
    const projects = await this.listProjects();
    const activeId = readStore(STUDIO_ACTIVE_ID_KEY, null);
    if (activeId && projects.some(p => p.id === activeId)) return activeId;
    const fallbackId = projects[0].id;
    writeStore(STUDIO_ACTIVE_ID_KEY, fallbackId);
    return fallbackId;
  },

  async setActiveProjectId(id) {
    writeStore(STUDIO_ACTIVE_ID_KEY, id);
  },

  async getProject(id) {
    const list = await this.listProjects();
    return list.find(p => p.id === id) || null;
  },

  async saveProject(project) {
    const list = await this.listProjects();
    const idx = list.findIndex(p => p.id === project.id);
    const updated = { ...project, updatedAt: Date.now() };
    if (idx >= 0) {
      list[idx] = updated;
    } else {
      list.push(updated);
    }
    writeStore(STUDIO_PROJECTS_KEY, list);
    return updated;
  },

  async createProject(name = 'โปรเจกต์ใหม่') {
    const list = await this.listProjects();
    const newProj = {
      id: 'proj_' + Date.now(),
      name,
      updatedAt: Date.now(),
      flow: { nodes: [], connections: [], nextNodeId: 1 }
    };
    list.push(newProj);
    writeStore(STUDIO_PROJECTS_KEY, list);
    writeStore(STUDIO_ACTIVE_ID_KEY, newProj.id);
    return newProj;
  },

  async deleteProject(id) {
    let list = await this.listProjects();
    if (list.length <= 1) {
      throw new Error('ไม่สามารถลบโปรเจกต์สุดท้ายได้');
    }
    list = list.filter(p => p.id !== id);
    writeStore(STUDIO_PROJECTS_KEY, list);
    const active = await this.getActiveProjectId();
    if (active === id) {
      writeStore(STUDIO_ACTIVE_ID_KEY, list[0].id);
    }
    return list;
  },

  // --- CUSTOM LEVELS MANAGEMENT ---
  async getCustomLevels() {
    return readCustomLevels();
  },

  // บันทึกด่านที่ผู้ใช้สร้าง/นำเข้า — ผ่าน sanitizeCustomLevel เสมอ (ไฟล์ด่านที่แชร์กันเป็นข้อมูลที่ไม่น่าเชื่อถือ)
  // asNew: true (ตอนนำเข้าไฟล์) = ออก id ใหม่เสมอ กันไฟล์ของคนอื่นไปทับด่านของเราที่ id ซ้ำกัน
  // ถ้าข้อมูลไม่ถูกต้องจะ throw Error ข้อความภาษาไทย
  async saveCustomLevel(customLevel, { asNew = false } = {}) {
    const list = await this.getCustomLevels();
    const levelToSave = cleanCustomLevel(asNew ? { ...customLevel, id: undefined } : customLevel);
    levelToSave.updatedAt = Date.now();
    const id = levelToSave.id;
    const idx = list.findIndex(l => String(l.id) === String(id));
    if (idx >= 0) {
      list[idx] = levelToSave;
    } else {
      list.push(levelToSave);
    }
    writeStore(CUSTOM_LEVELS_KEY, list);
    return levelToSave;
  },

  async deleteCustomLevel(id) {
    let list = await this.getCustomLevels();
    list = list.filter(l => String(l.id) !== String(id));
    writeStore(CUSTOM_LEVELS_KEY, list);
    return list;
  },

  // --- TOUR ONBOARDING ---
  async isTourSeen() {
    return !!readStore(TOUR_SEEN_KEY, false);
  },

  async setTourSeen(seen = true) {
    writeStore(TOUR_SEEN_KEY, seen);
  },

  // POST /coach (backend Python + Antigravity SDK)
  async coach(levelId, flow, checkResult, attempt) {
    const all = await this.getLevels();
    const level = all.find(l => String(l.id) === String(levelId));
    const body = {
      level_id: levelId,
      level_title: level ? level.title : 'Custom Level',
      level_desc: level ? level.desc : '',
      mode: level ? (level.mode || 'build') : 'build',
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
      const known = ['no_api_key', 'no_project', 'auth_failed', 'bad_base_url', 'busy', 'timeout'];
      return { ok: false, reason: known.includes(err) ? err : 'failed' };
    } catch (e) {
      return { ok: false, reason: e.name === 'AbortError' ? 'timeout' : 'offline' };
    } finally {
      clearTimeout(timer);
    }
  }
};

const Api = LocalApi;

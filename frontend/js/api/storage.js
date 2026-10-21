// ---------------------------------------------------------
// API LAYER — ตัวกลางระหว่างหน้าเว็บกับแหล่งข้อมูล
// รองรับทั้งโหมด Local (LocalStorage) และ Remote (Node.js + SQLite Backend Phase 5b)
// ---------------------------------------------------------
const STORAGE_KEY = 'workflow_automation_lab_smart_var_v3';
const PROGRESS_KEY = 'workflow_automation_lab_progress_v1';
const STUDIO_PROJECTS_KEY = 'workflow_automation_lab_studio_projects_v1';
const STUDIO_ACTIVE_ID_KEY = 'workflow_automation_lab_studio_active_id_v1';
const CUSTOM_LEVELS_KEY = 'workflow_automation_lab_custom_levels_v1';
const TOUR_SEEN_KEY = 'workflow_automation_lab_tour_seen_v1';

const COACH_BASE_URL = 'http://127.0.0.1:8787'; // backend/server.py (Python)
const REMOTE_API_BASE = 'http://127.0.0.1:8788'; // backend/api_server.js (Node SQLite)
const AUTH_TOKEN_KEY = 'workflow_auth_token_v1';
const AUTH_USER_KEY = 'workflow_auth_user_v1';
const API_MODE_KEY = 'workflow_api_mode_v1'; // 'local' | 'remote'

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
      return [];
    }
  });
}

// ---------------------------------------------------------
// 1. LOCAL API (โหมดออฟไลน์ / LocalStorage)
// ---------------------------------------------------------
const LocalApi = {
  mode: 'local',

  async getLevels() {
    return [...LEVELS, ...readCustomLevels()];
  },

  async loadFlow(levelId) {
    const saved = readStore(STORAGE_KEY, {})[levelId];
    if (!saved || !Array.isArray(saved.nodes)) return null;
    return {
      nodes: saved.nodes,
      connections: saved.connections || [],
      nextNodeId: saved.nextNodeId || (saved.nodes.length + 1)
    };
  },

  async saveFlow(levelId, flow) {
    const all = readStore(STORAGE_KEY, {});
    all[levelId] = flow;
    writeStore(STORAGE_KEY, all);
  },

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

  async getProgress() {
    return readStore(PROGRESS_KEY, { passed: [] });
  },

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

  async getCustomLevels() {
    return readCustomLevels();
  },

  async saveCustomLevel(customLevel) {
    const cleaned = cleanCustomLevel(customLevel);
    const list = await this.getCustomLevels();
    const idx = list.findIndex(l => String(l.id) === String(cleaned.id));
    if (idx >= 0) {
      list[idx] = cleaned;
    } else {
      list.push(cleaned);
    }
    writeStore(CUSTOM_LEVELS_KEY, list);
    return cleaned;
  },

  async deleteCustomLevel(id) {
    let list = await this.getCustomLevels();
    list = list.filter(l => String(l.id) !== String(id));
    writeStore(CUSTOM_LEVELS_KEY, list);
    return list;
  },

  async isTourSeen() {
    return !!readStore(TOUR_SEEN_KEY, false);
  },

  async setTourSeen(seen = true) {
    writeStore(TOUR_SEEN_KEY, seen);
  },

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

// ---------------------------------------------------------
// 2. REMOTE API (Phase 5b: Node.js + SQLite Server)
// ---------------------------------------------------------
const RemoteApi = {
  mode: 'remote',

  getToken() {
    return readStore(AUTH_TOKEN_KEY, null);
  },

  setToken(token) {
    writeStore(AUTH_TOKEN_KEY, token);
  },

  getCurrentUser() {
    return readStore(AUTH_USER_KEY, null);
  },

  setCurrentUser(user) {
    writeStore(AUTH_USER_KEY, user);
  },

  async fetchApi(path, options = {}) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };

    const res = await fetch(`${REMOTE_API_BASE}${path}`, {
      ...options,
      headers
    });

    const data = await res.json().catch(() => ({ ok: false, error: 'Cannot parse server response' }));
    if (!res.ok && !data.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    return data;
  },

  // Auth Methods
  // สมัครเองได้เป็นนักเรียนเท่านั้น; ผู้สอนต้องส่ง teacherCode ที่ถูกต้อง (server ตรวจกับ TEACHER_SIGNUP_CODE)
  async register(username, password, displayName, teacherCode = '') {
    const data = await this.fetchApi('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, displayName, ...(teacherCode ? { teacherCode } : {}) })
    });
    if (data.ok && data.token) {
      this.setToken(data.token);
      this.setCurrentUser(data.user);
    }
    return data;
  },

  async login(username, password) {
    const data = await this.fetchApi('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    if (data.ok && data.token) {
      this.setToken(data.token);
      this.setCurrentUser(data.user);
    }
    return data;
  },

  async logout() {
    try {
      await this.fetchApi('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    this.setToken(null);
    this.setCurrentUser(null);
  },

  async getMe() {
    try {
      const data = await this.fetchApi('/api/auth/me');
      if (data.ok) {
        this.setCurrentUser(data.user);
        return data.user;
      }
    } catch (e) {
      this.setToken(null);
      this.setCurrentUser(null);
    }
    return null;
  },

  // Levels & Progress
  async getLevels() {
    try {
      const data = await this.fetchApi('/api/levels');
      return data.levels;
    } catch (e) {
      // Fallback local if server offline
      return LocalApi.getLevels();
    }
  },

  async loadFlow(levelId) {
    try {
      const data = await this.fetchApi(`/api/levels/${levelId}/flow`);
      return data.flow;
    } catch (e) {
      return LocalApi.loadFlow(levelId);
    }
  },

  async saveFlow(levelId, flow) {
    try {
      await this.fetchApi(`/api/levels/${levelId}/flow`, {
        method: 'PUT',
        body: JSON.stringify(flow)
      });
    } catch (e) {
      await LocalApi.saveFlow(levelId, flow);
    }
  },

  async checkLevel(levelId, flow, answers) {
    try {
      const data = await this.fetchApi(`/api/levels/${levelId}/check`, {
        method: 'POST',
        body: JSON.stringify({ flow, answers })
      });
      return data;
    } catch (e) {
      return LocalApi.checkLevel(levelId, flow, answers);
    }
  },

  async getProgress() {
    try {
      const data = await this.fetchApi('/api/progress');
      return { passed: data.passed || [] };
    } catch (e) {
      return LocalApi.getProgress();
    }
  },

  // Studio Projects
  async listProjects() {
    try {
      const data = await this.fetchApi('/api/projects');
      if (data.projects && data.projects.length) return data.projects;
      return LocalApi.listProjects();
    } catch (e) {
      return LocalApi.listProjects();
    }
  },

  async getActiveProjectId() {
    return LocalApi.getActiveProjectId();
  },

  async setActiveProjectId(id) {
    return LocalApi.setActiveProjectId(id);
  },

  async getProject(id) {
    const list = await this.listProjects();
    return list.find(p => p.id === id) || null;
  },

  async saveProject(project) {
    try {
      await this.fetchApi(`/api/projects/${project.id}`, {
        method: 'PUT',
        body: JSON.stringify(project)
      });
    } catch (e) {
      await LocalApi.saveProject(project);
    }
    return project;
  },

  async createProject(name = 'โปรเจกต์ใหม่') {
    try {
      const data = await this.fetchApi('/api/projects', {
        method: 'POST',
        body: JSON.stringify({ name })
      });
      if (data.project) return data.project;
    } catch (e) {}
    return LocalApi.createProject(name);
  },

  async deleteProject(id) {
    try {
      await this.fetchApi(`/api/projects/${id}`, { method: 'DELETE' });
    } catch (e) {}
    return LocalApi.deleteProject(id);
  },

  // Custom Levels
  async getCustomLevels() {
    try {
      const data = await this.fetchApi('/api/custom-levels');
      return data.customLevels || [];
    } catch (e) {
      return LocalApi.getCustomLevels();
    }
  },

  async saveCustomLevel(level) {
    try {
      const data = await this.fetchApi('/api/custom-levels', {
        method: 'POST',
        body: JSON.stringify(level)
      });
      if (data.level) return data.level;
    } catch (e) {}
    return LocalApi.saveCustomLevel(level);
  },

  async deleteCustomLevel(id) {
    try {
      await this.fetchApi(`/api/custom-levels/${id}`, { method: 'DELETE' });
    } catch (e) {}
    return LocalApi.deleteCustomLevel(id);
  },

  async isTourSeen() {
    return LocalApi.isTourSeen();
  },

  async setTourSeen(seen) {
    return LocalApi.setTourSeen(seen);
  },

  async coach(levelId, flow, checkResult, attempt) {
    return LocalApi.coach(levelId, flow, checkResult, attempt);
  },

  // Share via Link / Code
  async shareFlow(type, title, data) {
    return this.fetchApi('/api/share', {
      method: 'POST',
      body: JSON.stringify({ type, title, data })
    });
  },

  async getShare(code) {
    return this.fetchApi(`/api/share/${code}`);
  },

  // Teacher Classroom Dashboard
  async getTeacherOverview() {
    return this.fetchApi('/api/teacher/overview');
  },

  // ซิงค์ข้อมูลจาก LocalStorage ขึ้น Server
  async syncLocalToServer() {
    const localProgress = await LocalApi.getProgress();
    const localProjects = await LocalApi.listProjects();
    const localCustomLevels = await LocalApi.getCustomLevels();

    let syncedLevels = 0;
    let syncedProjects = 0;
    let syncedCustom = 0;

    // 1. ซิงค์ flows ของแต่ละด่านที่เคยทำไว้
    const allStore = readStore(STORAGE_KEY, {});
    for (const [lvlId, flow] of Object.entries(allStore)) {
      if (flow && flow.nodes && flow.nodes.length) {
        await this.saveFlow(lvlId, flow);
        syncedLevels++;
      }
    }

    // 2. ซิงค์ Studio Projects
    for (const proj of localProjects) {
      if (proj.flow && proj.flow.nodes && proj.flow.nodes.length) {
        await this.createProject(proj.name, proj.flow);
        syncedProjects++;
      }
    }

    // 3. ซิงค์ Custom Levels
    for (const cl of localCustomLevels) {
      await this.saveCustomLevel(cl);
      syncedCustom++;
    }

    return {
      ok: true,
      syncedLevels,
      syncedProjects,
      syncedCustom
    };
  }
};

// ---------------------------------------------------------
// 3. DYNAMIC API SWITCHER
// ---------------------------------------------------------
function getApiMode() {
  return readStore(API_MODE_KEY, 'local');
}

function setApiMode(mode) {
  const valid = ['local', 'remote', 'supabase'];
  const newMode = valid.includes(mode) ? mode : 'local';
  writeStore(API_MODE_KEY, newMode);
  if (typeof updateBackendStatusUi === 'function') {
    updateBackendStatusUi();
  }
}

function getActiveApi() {
  const mode = getApiMode();
  if (mode === 'supabase' && typeof SupabaseApi !== 'undefined') return SupabaseApi;
  if (mode === 'remote') return RemoteApi;
  return LocalApi;
}

// Global Api Proxy: สลับ backend ได้อัตโนมัติโดยที่ UI ไม่ต้องเขียนแก้ใหม่!
const Api = new Proxy({}, {
  get(_, prop) {
    const target = getActiveApi();
    if (typeof target[prop] === 'function') {
      return target[prop].bind(target);
    }
    return target[prop];
  }
});

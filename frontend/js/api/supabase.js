// ---------------------------------------------------------
// SUPABASE API LAYER (PHASE 7)
// ตัวกลางระหว่างหน้าเว็บกับฐานข้อมูลและ Auth บน Supabase
// สอดคล้องกับโครงสร้างและเมธอดเดียวกับ LocalApi และ RemoteApi
// ---------------------------------------------------------

const SUPABASE_USER_KEY = 'workflow_supabase_user_v1';

const SupabaseApi = {
  mode: 'supabase',
  _client: null,

  getClient() {
    if (this._client) return this._client;
    const config = window.SUPABASE_CONFIG;
    if (!config || !config.url || !config.anonKey) {
      console.warn('⚠️ Supabase config is missing.');
      return null;
    }
    if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
      this._client = window.supabase.createClient(config.url, config.anonKey);
      return this._client;
    }
    return null;
  },

  getCurrentUser() {
    return readStore(SUPABASE_USER_KEY, null);
  },

  setCurrentUser(user) {
    writeStore(SUPABASE_USER_KEY, user);
  },

  // แปลง username ให้เป็นรูปแบบ email สำหรับ Supabase Auth ถ้าจำเป็น
  formatAuthEmail(identifier) {
    if (!identifier) return '';
    return identifier.includes('@') ? identifier : `${identifier.trim().toLowerCase()}@workflow.lab`;
  },

  // ---------------------------------------------------------
  // Auth Methods
  // ---------------------------------------------------------
  async register(identifier, password, displayName, teacherCode = '') {
    const client = this.getClient();
    if (!client) throw new Error('Supabase client is not loaded');

    const email = this.formatAuthEmail(identifier);
    const username = identifier.includes('@') ? identifier.split('@')[0] : identifier;
    const role = (teacherCode && teacherCode === 'classroom-secret') ? 'teacher' : 'student';

    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          display_name: displayName || username,
          role
        }
      }
    });

    if (error) throw new Error(error.message);

    const userObj = {
      id: data.user?.id,
      username,
      displayName: displayName || username,
      role
    };

    if (data.session) {
      this.setCurrentUser(userObj);
    }

    return {
      ok: true,
      user: userObj,
      session: data.session
    };
  },

  async login(identifier, password) {
    const client = this.getClient();
    if (!client) throw new Error('Supabase client is not loaded');

    const email = this.formatAuthEmail(identifier);
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw new Error(error.message);

    // ดึง profile เพิ่มเติม
    let profile = null;
    try {
      const { data: profData } = await client
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();
      profile = profData;
    } catch (e) {}

    const meta = data.user.user_metadata || {};
    const userObj = {
      id: data.user.id,
      username: profile?.username || meta.username || email.split('@')[0],
      displayName: profile?.display_name || meta.display_name || email.split('@')[0],
      role: profile?.role || meta.role || 'student'
    };

    this.setCurrentUser(userObj);
    return { ok: true, user: userObj, session: data.session };
  },

  async logout() {
    const client = this.getClient();
    if (client) {
      try {
        await client.auth.signOut();
      } catch (e) {}
    }
    this.setCurrentUser(null);
    return { ok: true };
  },

  async getMe() {
    const client = this.getClient();
    if (!client) return null;
    try {
      let { data: { user }, error } = await client.auth.getUser();
      
      // ถ้ายังไม่มี User ให้ล็อกอินเป็น Guest / Anonymous อัตโนมัติในเบื้องหลัง
      if (!user) {
        try {
          const { data: anonData } = await client.auth.signInAnonymously();
          if (anonData && anonData.user) {
            user = anonData.user;
          }
        } catch (e) {
          // ถ้า Supabase ยังไม่ได้เปิดฟังก์ชัน Anonymous sign-in ให้ fallback เป็น Guest ID ประจำเครื่อง
        }
      }

      if (!user) {
        let guestId = readStore('workflow_guest_id_v1', null);
        if (!guestId) {
          guestId = 'guest_' + Math.random().toString(36).substring(2, 10);
          writeStore('workflow_guest_id_v1', guestId);
        }
        const guestUser = {
          id: guestId,
          username: 'guest',
          displayName: 'ผู้เรียน (Guest)',
          role: 'student'
        };
        this.setCurrentUser(guestUser);
        return guestUser;
      }

      let profile = null;
      try {
        const { data: profData } = await client
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        profile = profData;
      } catch (e) {}

      const meta = user.user_metadata || {};
      const userObj = {
        id: user.id,
        username: profile?.username || meta.username || (user.email ? user.email.split('@')[0] : 'guest'),
        displayName: profile?.display_name || meta.display_name || (user.email ? user.email.split('@')[0] : 'ผู้เรียน (Guest)'),
        role: profile?.role || meta.role || 'student'
      };

      this.setCurrentUser(userObj);
      return userObj;
    } catch (e) {
      return null;
    }
  },

  // ---------------------------------------------------------
  // Levels & Progress
  // ---------------------------------------------------------
  async getLevels() {
    const custom = await this.getCustomLevels();
    return [...LEVELS, ...custom];
  },

  async loadFlow(levelId) {
    const client = this.getClient();
    const user = this.getCurrentUser();
    if (!client || !user) return LocalApi.loadFlow(levelId);

    try {
      const { data, error } = await client
        .from('flows')
        .select('flow_json')
        .eq('level_id', parseInt(levelId, 10))
        .single();

      if (error || !data || !data.flow_json) {
        return LocalApi.loadFlow(levelId);
      }
      return data.flow_json;
    } catch (e) {
      return LocalApi.loadFlow(levelId);
    }
  },

  async saveFlow(levelId, flow) {
    const client = this.getClient();
    const user = this.getCurrentUser();
    // บันทึกลง local เสมอเพื่อความเร็ว
    await LocalApi.saveFlow(levelId, flow);

    if (!client || !user) return;
    try {
      await client.from('flows').upsert({
        user_id: user.id,
        level_id: parseInt(levelId, 10),
        flow_json: flow,
        updated_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn('⚠️ Supabase saveFlow failed:', e);
    }
  },

  async checkLevel(levelId, flow, answers) {
    const result = await LocalApi.checkLevel(levelId, flow, answers);
    const client = this.getClient();
    const user = this.getCurrentUser();

    if (client && user && result.passed) {
      try {
        const passedCount = result.items ? result.items.filter(i => i.ok).length : 1;
        const totalCount = result.items ? result.items.length : 1;
        await client.from('progress').upsert({
          user_id: user.id,
          level_id: parseInt(levelId, 10),
          passed: true,
          score: passedCount,
          total: totalCount,
          updated_at: new Date().toISOString()
        });
      } catch (e) {
        console.warn('⚠️ Supabase update progress failed:', e);
      }
    }
    return result;
  },

  async getProgress() {
    const client = this.getClient();
    const user = this.getCurrentUser();
    if (!client || !user) return LocalApi.getProgress();

    try {
      const { data, error } = await client
        .from('progress')
        .select('level_id, passed')
        .eq('passed', true);

      if (error || !data) return LocalApi.getProgress();
      const passedList = data.map(d => d.level_id);
      return { passed: passedList };
    } catch (e) {
      return LocalApi.getProgress();
    }
  },

  // ---------------------------------------------------------
  // Studio Projects
  // ---------------------------------------------------------
  async listProjects() {
    const client = this.getClient();
    const user = this.getCurrentUser();
    if (!client || !user) return LocalApi.listProjects();

    try {
      const { data, error } = await client
        .from('projects')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error || !data || data.length === 0) {
        return LocalApi.listProjects();
      }

      return data.map(p => ({
        id: p.id,
        name: p.name,
        flow: p.flow_json,
        updatedAt: new Date(p.updated_at).getTime()
      }));
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
    await LocalApi.saveProject(project);
    const client = this.getClient();
    const user = this.getCurrentUser();
    if (!client || !user) return project;

    try {
      await client.from('projects').upsert({
        id: project.id,
        user_id: user.id,
        name: project.name,
        flow_json: project.flow,
        updated_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn('⚠️ Supabase saveProject failed:', e);
    }
    return project;
  },

  async createProject(name = 'โปรเจกต์ใหม่', flow = null) {
    const newProj = {
      id: 'proj_' + Date.now(),
      name,
      updatedAt: Date.now(),
      flow: flow || { nodes: [], connections: [], nextNodeId: 1 }
    };

    await LocalApi.saveProject(newProj);
    await this.setActiveProjectId(newProj.id);

    const client = this.getClient();
    const user = this.getCurrentUser();
    if (client && user) {
      try {
        await client.from('projects').insert({
          id: newProj.id,
          user_id: user.id,
          name: newProj.name,
          flow_json: newProj.flow,
          updated_at: new Date().toISOString()
        });
      } catch (e) {}
    }
    return newProj;
  },

  async deleteProject(id) {
    await LocalApi.deleteProject(id);
    const client = this.getClient();
    const user = this.getCurrentUser();
    if (client && user) {
      try {
        await client.from('projects').delete().eq('id', id);
      } catch (e) {}
    }
    return this.listProjects();
  },

  // ---------------------------------------------------------
  // Custom Levels
  // ---------------------------------------------------------
  async getCustomLevels() {
    const client = this.getClient();
    if (!client) return LocalApi.getCustomLevels();

    try {
      const { data, error } = await client
        .from('custom_levels')
        .select('*')
        .order('created_at', { ascending: false });

      if (error || !data) return LocalApi.getCustomLevels();
      return data.map(d => d.level_json);
    } catch (e) {
      return LocalApi.getCustomLevels();
    }
  },

  async saveCustomLevel(level) {
    const cleaned = cleanCustomLevel(level);
    await LocalApi.saveCustomLevel(cleaned);

    const client = this.getClient();
    const user = this.getCurrentUser();
    if (client && user) {
      try {
        await client.from('custom_levels').upsert({
          id: String(cleaned.id),
          user_id: user.id,
          title: cleaned.title || 'ด่านสร้างเอง',
          level_json: cleaned,
          updated_at: new Date().toISOString()
        });
      } catch (e) {
        console.warn('⚠️ Supabase saveCustomLevel failed:', e);
      }
    }
    return cleaned;
  },

  async deleteCustomLevel(id) {
    await LocalApi.deleteCustomLevel(id);
    const client = this.getClient();
    const user = this.getCurrentUser();
    if (client && user) {
      try {
        await client.from('custom_levels').delete().eq('id', String(id));
      } catch (e) {}
    }
    return this.getCustomLevels();
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

  // ---------------------------------------------------------
  // Share via Shortcode
  // ---------------------------------------------------------
  async shareFlow(type, title, data) {
    const client = this.getClient();
    const user = this.getCurrentUser();
    if (!client || !user) {
      return RemoteApi.shareFlow(type, title, data);
    }

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { error } = await client.from('shares').insert({
      code,
      user_id: user.id,
      type,
      title: title || 'แชร์ Workflow',
      data_json: data
    });

    if (error) throw new Error(error.message);
    return { ok: true, code, url: `${window.location.origin}${window.location.pathname}?share=${code}` };
  },

  async getShare(code) {
    const client = this.getClient();
    if (!client) return RemoteApi.getShare(code);

    const { data, error } = await client
      .from('shares')
      .select('*')
      .eq('code', code.toUpperCase())
      .single();

    if (error || !data) return { ok: false, error: 'ไม่พบรหัสแชร์นี้' };
    return {
      ok: true,
      share: {
        code: data.code,
        type: data.type,
        title: data.title,
        data: data.data_json,
        createdAt: data.created_at
      }
    };
  },

  // ---------------------------------------------------------
  // Teacher Overview
  // ---------------------------------------------------------
  async getTeacherOverview() {
    const client = this.getClient();
    if (!client) return { ok: false, error: 'Supabase client unavailable' };

    try {
      const { data: students, error: profErr } = await client
        .from('profiles')
        .select('*')
        .eq('role', 'student');

      if (profErr) throw new Error(profErr.message);

      const { data: progressData, error: progErr } = await client
        .from('progress')
        .select('*');

      if (progErr) throw new Error(progErr.message);

      const overview = (students || []).map(st => {
        const userProg = (progressData || []).filter(p => p.user_id === st.id);
        const passedCount = userProg.filter(p => p.passed).length;
        return {
          id: st.id,
          username: st.username,
          displayName: st.display_name,
          passedLevels: passedCount,
          totalLevels: 30,
          progress: userProg
        };
      });

      return {
        ok: true,
        stats: {
          totalStudents: students ? students.length : 0,
          students: overview
        }
      };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  },

  // ซิงค์ข้อมูล LocalStorage ขึ้น Supabase
  async syncLocalToServer() {
    const localProjects = await LocalApi.listProjects();
    const localCustomLevels = await LocalApi.getCustomLevels();

    let syncedLevels = 0;
    let syncedProjects = 0;
    let syncedCustom = 0;

    const allStore = readStore(STORAGE_KEY, {});
    for (const [lvlId, flow] of Object.entries(allStore)) {
      if (flow && flow.nodes && flow.nodes.length) {
        await this.saveFlow(lvlId, flow);
        syncedLevels++;
      }
    }

    for (const proj of localProjects) {
      if (proj.flow && proj.flow.nodes && proj.flow.nodes.length) {
        await this.saveProject(proj);
        syncedProjects++;
      }
    }

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

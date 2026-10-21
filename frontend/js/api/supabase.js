// ---------------------------------------------------------
// SUPABASE API LAYER (PHASE 7)
// ตัวกลางระหว่างหน้าเว็บกับฐานข้อมูลและ Auth บน Supabase
// สอดคล้องกับโครงสร้างและเมธอดเดียวกับ LocalApi และ RemoteApi
// ---------------------------------------------------------

const SUPABASE_USER_KEY = 'workflow_supabase_user_v1';

// รหัสผ่านขั้นต่ำฝั่งหน้าเว็บ (ฝั่ง Supabase ตั้งค่าได้ที่ Authentication → Policies ควรตั้งให้ตรงหรือเข้มกว่า)
const SUPABASE_MIN_PASSWORD = 8;
const SUPABASE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// แปลงข้อผิดพลาดของ Supabase Auth เป็นข้อความภาษาไทยที่ผู้เรียนเข้าใจ (เก็บ error.code เดิมไว้ให้หน้าจอเลือกแสดงปุ่มช่วยเหลือ เช่น "ส่งอีเมลยืนยันอีกครั้ง")
// ไม่แสดง message ดิบของ Supabase ตรงๆ เพราะเป็นภาษาอังกฤษและบางข้อความบอกรายละเอียดภายในมากเกินไป
const SUPABASE_AUTH_ERRORS = {
  invalid_credentials: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
  email_not_confirmed: 'ยังไม่ได้ยืนยันอีเมล — กรุณากดลิงก์ในอีเมลที่ส่งให้ตอนสมัคร (ถ้าไม่พบ กดส่งอีเมลยืนยันอีกครั้งได้)',
  user_already_exists: 'อีเมลนี้สมัครไว้แล้ว — ลองเข้าสู่ระบบ หรือกด "ลืมรหัสผ่าน"',
  email_exists: 'อีเมลนี้สมัครไว้แล้ว — ลองเข้าสู่ระบบ หรือกด "ลืมรหัสผ่าน"',
  weak_password: 'รหัสผ่านง่ายเกินไป — ใช้ตัวอักษรผสมตัวเลข และยาวขึ้น',
  same_password: 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม',
  email_address_invalid: 'รูปแบบอีเมลไม่ถูกต้อง',
  validation_failed: 'ข้อมูลที่กรอกไม่ถูกต้อง กรุณาตรวจอีเมลและรหัสผ่านอีกครั้ง',
  over_email_send_rate_limit: 'ส่งอีเมลถี่เกินไป กรุณารอสักครู่แล้วลองใหม่ (ระบบจำกัดจำนวนอีเมลต่อชั่วโมง)',
  over_request_rate_limit: 'ลองถี่เกินไป กรุณารอสักครู่แล้วลองใหม่',
  signup_disabled: 'ขณะนี้ปิดรับสมัครสมาชิกใหม่',
  otp_expired: 'ลิงก์หมดอายุหรือถูกใช้ไปแล้ว — กรุณาขอลิงก์ใหม่',
  session_not_found: 'หมดเวลาเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่',
  not_authenticated: 'กรุณาเข้าสู่ระบบก่อน'
};

function supabaseAuthError(error, fallback = 'เกิดข้อผิดพลาดในการเชื่อมต่อระบบสมาชิก กรุณาลองใหม่') {
  const code = (error && (error.code || error.error_code)) || '';
  const err = new Error(SUPABASE_AUTH_ERRORS[code] || fallback);
  err.code = code || 'unknown';
  return err;
}

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
      // กดลิงก์ "ลืมรหัสผ่าน" ในอีเมลแล้วกลับมาที่หน้านี้ → SDK ตั้ง session ชั่วคราวให้และส่งเหตุการณ์นี้ เพื่อให้หน้าจอเปิดฟอร์มตั้งรหัสผ่านใหม่
      if (this._client.auth && typeof this._client.auth.onAuthStateChange === 'function') {
        this._client.auth.onAuthStateChange((event) => {
          if (event === 'PASSWORD_RECOVERY' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
            window.dispatchEvent(new CustomEvent('supabase-password-recovery'));
          }
        });
      }
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

  // ใช้อีเมลจริงเท่านั้น (ต้องรับอีเมลยืนยัน/รีเซ็ตรหัสผ่านได้) — ไม่แปลงชื่อผู้ใช้เป็นอีเมลปลอมอีกแล้ว
  normalizeEmail(email) {
    const value = String(email || '').trim().toLowerCase();
    if (!SUPABASE_EMAIL_RE.test(value) || value.length > 254) {
      const err = new Error('กรุณากรอกอีเมลให้ถูกต้อง เช่น name@example.com');
      err.code = 'email_address_invalid';
      throw err;
    }
    return value;
  },

  // ลิงก์ที่ Supabase จะพากลับมาหลังกดลิงก์ในอีเมล (ต้องอยู่ในรายการ Redirect URLs ของโปรเจกต์ ไม่งั้น Supabase จะใช้ Site URL แทน)
  redirectUrl() {
    return `${window.location.origin}${window.location.pathname}`;
  },

  // ---------------------------------------------------------
  // Auth Methods
  // ---------------------------------------------------------
  async register(email, password, displayName) {
    const client = this.getClient();
    if (!client) throw new Error('Supabase client is not loaded');

    const cleanEmail = this.normalizeEmail(email);
    if (String(password || '').length < SUPABASE_MIN_PASSWORD) {
      const err = new Error(`รหัสผ่านต้องยาวอย่างน้อย ${SUPABASE_MIN_PASSWORD} ตัวอักษร`);
      err.code = 'weak_password';
      throw err;
    }
    const shownName = String(displayName || '').trim().slice(0, 60) || cleanEmail.split('@')[0];

    // ห้ามส่ง role ไปกับ metadata และห้ามตรวจรหัสผู้สอนฝั่งหน้าเว็บ: โค้ดฝั่งนี้ใครก็เปิดอ่าน/แก้ได้ และ public key ยิง Auth API ตรงได้
    // ทุกบัญชีเริ่มเป็น student เสมอ (trigger ในฐานข้อมูลบังคับ) การเป็นผู้สอนต้องผ่าน claimTeacher() หลังล็อกอิน
    const { data, error } = await client.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo: this.redirectUrl(),
        data: { username: cleanEmail.split('@')[0], display_name: shownName }
      }
    });

    if (error) throw supabaseAuthError(error, 'สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่');

    // เปิด "Confirm email" ไว้: สมัครแล้วยังไม่มี session จนกว่าจะกดลิงก์ยืนยันในอีเมล
    // ถ้าอีเมลนี้เคยสมัครแล้ว Supabase จะตอบเหมือนสมัครสำเร็จ (identities ว่าง) เพื่อไม่บอกว่าอีเมลไหนมีบัญชีอยู่ — เราตอบข้อความเดียวกันทั้งสองกรณี
    if (!data.session) {
      return { ok: true, needsConfirmation: true, email: cleanEmail, user: null, session: null };
    }

    // กรณีโปรเจกต์ปิด Confirm email: ได้ session ทันที
    const userObj = await this.getMe();
    return { ok: true, needsConfirmation: false, email: cleanEmail, user: userObj, session: data.session };
  },

  async resendConfirmation(email) {
    const client = this.getClient();
    if (!client) throw new Error('Supabase client is not loaded');
    const cleanEmail = this.normalizeEmail(email);
    const { error } = await client.auth.resend({
      type: 'signup',
      email: cleanEmail,
      options: { emailRedirectTo: this.redirectUrl() }
    });
    if (error) throw supabaseAuthError(error, 'ส่งอีเมลยืนยันไม่สำเร็จ กรุณาลองใหม่');
    return { ok: true, email: cleanEmail };
  },

  // ขอลิงก์ตั้งรหัสผ่านใหม่ทางอีเมล — ตอบเหมือนกันไม่ว่าอีเมลนั้นมีบัญชีหรือไม่ (ไม่บอกว่าอีเมลไหนสมัครไว้)
  async requestPasswordReset(email) {
    const client = this.getClient();
    if (!client) throw new Error('Supabase client is not loaded');
    const cleanEmail = this.normalizeEmail(email);
    const { error } = await client.auth.resetPasswordForEmail(cleanEmail, { redirectTo: this.redirectUrl() });
    if (error) throw supabaseAuthError(error, 'ขอลิงก์ตั้งรหัสผ่านใหม่ไม่สำเร็จ กรุณาลองใหม่');
    return { ok: true, email: cleanEmail };
  },

  // ตั้งรหัสผ่านใหม่ (ใช้ได้เมื่อมี session — หลังกดลิงก์ในอีเมลรีเซ็ต หรือผู้ที่ล็อกอินอยู่แล้ว)
  async updatePassword(newPassword) {
    const client = this.getClient();
    if (!client) throw new Error('Supabase client is not loaded');
    if (String(newPassword || '').length < SUPABASE_MIN_PASSWORD) {
      const err = new Error(`รหัสผ่านต้องยาวอย่างน้อย ${SUPABASE_MIN_PASSWORD} ตัวอักษร`);
      err.code = 'weak_password';
      throw err;
    }
    const { error } = await client.auth.updateUser({ password: newPassword });
    if (error) throw supabaseAuthError(error, 'ตั้งรหัสผ่านใหม่ไม่สำเร็จ กรุณาขอลิงก์ใหม่แล้วลองอีกครั้ง');
    return { ok: true };
  },

  // ขอเป็นผู้สอนด้วยรหัส — ฐานข้อมูลเป็นผู้ตรวจ (ฟังก์ชัน claim_teacher) และจำกัดการเดารหัส 5 ครั้ง/15 นาที
  async claimTeacher(code) {
    const client = this.getClient();
    if (!client) throw new Error('Supabase client is not loaded');
    const { data, error } = await client.rpc('claim_teacher', { code: String(code || '') });
    if (error) throw supabaseAuthError(error, error.message || 'ยืนยันรหัสผู้สอนไม่สำเร็จ');
    if (data === true) await this.getMe(); // โหลดบทบาทใหม่จากฐานข้อมูล
    return data === true;
  },

  async login(email, password) {
    const client = this.getClient();
    if (!client) throw new Error('Supabase client is not loaded');

    const cleanEmail = this.normalizeEmail(email);
    const { data, error } = await client.auth.signInWithPassword({ email: cleanEmail, password });
    if (error) throw supabaseAuthError(error, 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่');

    const userObj = await this.getMe();
    return { ok: true, user: userObj || null, session: data.session };
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
      const { data: { user } } = await client.auth.getUser();

      // ยังไม่ได้ล็อกอิน = ไม่มีผู้ใช้ (ใช้ข้อมูลในเครื่องแบบ Local ต่อไป ไม่เขียนขึ้นคลาวด์)
      // เดิมสร้างบัญชี anonymous ให้อัตโนมัติ — เลิกแล้ว เพราะเราให้ผู้เรียนล็อกอินจริง
      // และบัญชี anonymous ทุกบัญชีเป็นแถวใน auth.users ที่ใครก็สร้างรัวๆ ได้
      if (!user || user.is_anonymous) {
        this.setCurrentUser(null);
        return null;
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
      const fallbackName = user.email ? user.email.split('@')[0] : 'ผู้เรียน';
      const userObj = {
        id: user.id,
        email: user.email || '',
        username: profile?.username || meta.username || fallbackName,
        displayName: profile?.display_name || meta.display_name || fallbackName,
        // บทบาทเชื่อเฉพาะค่าจากตาราง profiles (ฝั่งฐานข้อมูล) — metadata ผู้ใช้แก้เองได้จึงไม่ใช้ แม้ดึงโปรไฟล์ไม่สำเร็จก็เป็น student
        role: profile?.role === 'teacher' || profile?.role === 'admin' ? profile.role : 'student'
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
    // ยังไม่ล็อกอิน = ไม่แตะตารางบนคลาวด์ (anon ไม่มีสิทธิ์อยู่แล้ว) ใช้ด่านที่เก็บในเครื่องแทน
    if (!client || !this.getCurrentUser()) return LocalApi.getCustomLevels();

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

    // รหัสแชร์ออกโดยฐานข้อมูล (trigger สุ่มแบบ CSPRNG) — ไม่สร้างฝั่งหน้าเว็บ (Math.random เดาได้) และไม่ยอมรับรหัสที่ client ส่งมา
    const { data: row, error } = await client.from('shares').insert({
      user_id: user.id,
      type: type === 'level' ? 'level' : 'project',
      title: String(title || 'แชร์ Workflow').slice(0, 200),
      data_json: data
    }).select('code').single();

    if (error) throw new Error(error.message);
    return { ok: true, code: row.code, url: `${window.location.origin}${window.location.pathname}?share=${row.code}` };
  },

  // อ่านทีละรหัสผ่านฟังก์ชัน get_share (ตารางไม่เปิดให้ list) คืนรูปแบบเดียวกับ RemoteApi.getShare ที่ checkIncomingShare ใช้
  async getShare(code) {
    const client = this.getClient();
    if (!client) return RemoteApi.getShare(code);

    const { data, error } = await client.rpc('get_share', { p_code: String(code || '') });
    const row = Array.isArray(data) ? data[0] : null;
    if (error || !row) return { ok: false, error: 'ไม่พบรหัสแชร์นี้' };
    return {
      ok: true,
      code: row.code,
      type: row.type,
      title: row.title,
      author: row.author || 'ผู้ใช้ทั่วไป',
      createdAt: row.created_at,
      data: row.data_json
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

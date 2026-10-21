// ---------------------------------------------------------
// WORKFLOW LAB BACKEND API SERVER (PHASE 5B)
// Node.js + SQLite (node:sqlite) + Zero External Dependencies
// ---------------------------------------------------------
const http = require('node:http');
const crypto = require('node:crypto');
const { initDb, hashPassword } = require('./db.js');

// โหลดตรรกะและข้อมูลจาก shared/
const { LEVELS, TRACKS } = require('../shared/levels.js');
const { BLOCK_CATALOG } = require('../shared/blocks.js');
const { checkFlow, checkPrediction, CHECK_RUNNERS } = require('../shared/checker.js');
const { sanitizeCustomLevel, sanitizeFlow } = require('../shared/sanitize.js');

const PORT = parseInt(process.env.API_PORT || '8788', 10);
const PYTHON_COACH_URL = process.env.COACH_URL || 'http://127.0.0.1:8787/coach';
const MAX_BODY_BYTES = 2 * 1024 * 1024;

// ---------------------------------------------------------
// ความปลอดภัย: เว็บอื่นที่ผู้ใช้เปิดอยู่ในเบราว์เซอร์เดียวกัน เรียก API บน localhost นี้ได้ (CORS ไม่ได้กันการ "ส่งคำขอ" ไปถึง
// กันแค่การอ่านผลลัพธ์) จึงต้อง "ปฏิเสธคำขอ" ที่มี Origin นอกรายการอนุญาต ไม่ใช่แค่ไม่ส่ง header ตอบกลับ
// ค่าเริ่มต้น: เฉพาะหน้าเว็บของเราที่ http://localhost:5173 / http://127.0.0.1:5173
// เปิดเพิ่มด้วย ALLOWED_ORIGINS="http://localhost:5173,https://lab.example.com"
// (ไม่รวม "null" โดยค่าเริ่มต้น เพราะหน้าที่ถูก sandbox จะส่ง Origin: null ได้ ทำให้เลี่ยงการป้องกันนี้ได้ — เปิดเองเฉพาะเมื่อจำเป็นต้องใช้ file://)
// ---------------------------------------------------------
const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];
function allowedOrigins() {
  const fromEnv = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  return fromEnv.length ? fromEnv : DEFAULT_ALLOWED_ORIGINS;
}

// จำกัดจำนวนครั้งที่ล็อกอินผิด (กันเดารหัสผ่าน): ผิดเกิน LOGIN_MAX_FAILS ครั้งใน LOGIN_WINDOW_MS ต่อ (IP + ชื่อผู้ใช้)
const LOGIN_MAX_FAILS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const COACH_MAX_PER_MINUTE = 10;

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function safeEqualHex(a, b) {
  const ba = Buffer.from(String(a), 'hex');
  const bb = Buffer.from(String(b), 'hex');
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

function createServer(dbInstance = null) {
  const db = dbInstance || initDb();
  const loginFails = new Map(); // key -> [timestamps]
  const coachCalls = new Map(); // userId -> [timestamps]

  function recentCount(map, key, windowMs) {
    const now = Date.now();
    const list = (map.get(key) || []).filter(t => now - t < windowMs);
    map.set(key, list);
    return list.length;
  }
  function record(map, key) {
    const list = map.get(key) || [];
    list.push(Date.now());
    map.set(key, list);
  }

  // Helper ส่ง JSON (ส่ง Access-Control-Allow-Origin เฉพาะ origin ที่อนุญาต ไม่ใช้ '*')
  function sendJson(res, statusCode, data) {
    const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Vary': 'Origin' };
    if (res.corsOrigin) {
      headers['Access-Control-Allow-Origin'] = res.corsOrigin;
      headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
    }
    res.writeHead(statusCode, headers);
    res.end(JSON.stringify(data));
  }

  function sendError(res, statusCode, message, code = 'ERROR') {
    sendJson(res, statusCode, { ok: false, error: message, code });
  }

  // อ่าน Body ของ Request (จำกัดขนาด — เกินแล้วหยุดอ่านและตัดการเชื่อมต่อ)
  function parseBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      let size = 0;
      let done = false;
      const fail = (err) => { if (!done) { done = true; reject(err); } };
      req.on('data', chunk => {
        if (done) return;
        size += chunk.length;
        if (size > MAX_BODY_BYTES) {
          const err = new Error('Request body too large');
          err.statusCode = 413;
          fail(err);
          req.destroy();
          return;
        }
        body += chunk;
      });
      req.on('end', () => {
        if (done) return;
        done = true;
        if (!body) return resolve({});
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          const err = new Error('Invalid JSON');
          err.statusCode = 400;
          reject(err);
        }
      });
      req.on('error', fail);
    });
  }

  // ตรวจสอบตัวตนผู้ใช้จาก Header Authorization
  // token ในฐานข้อมูลเก็บเป็นค่า SHA-256 (ไม่เก็บ token ดิบ) — ถ้าฐานข้อมูลรั่ว ก็เอาไปสวมสิทธิ์ไม่ได้
  function authenticate(req) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7).trim();
    if (!token) return null;

    const session = db.prepare(`
      SELECT s.token, s.expires_at, u.id, u.username, u.display_name, u.role
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ? AND s.expires_at > ?
    `).get(sha256(token), Date.now());

    return session || null;
  }

  function issueSession(userId) {
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare(`
      INSERT INTO sessions (token, user_id, created_at, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(sha256(token), userId, Date.now(), Date.now() + 30 * 24 * 60 * 60 * 1000); // อายุ 30 วัน
    return token;
  }

  const server = http.createServer(async (req, res) => {
    // ตรวจ Origin: มี Origin แต่ไม่อยู่ในรายการอนุญาต = ปฏิเสธทันที (ไม่ประมวลผลคำขอ)
    const origin = req.headers['origin'];
    if (origin) {
      if (!allowedOrigins().includes(origin)) {
        return sendError(res, 403, 'Origin ไม่ได้รับอนุญาต', 'ORIGIN_FORBIDDEN');
      }
      res.corsOrigin = origin;
    }

    // CORS Preflight
    if (req.method === 'OPTIONS') {
      const headers = { 'Vary': 'Origin' };
      if (res.corsOrigin) {
        headers['Access-Control-Allow-Origin'] = res.corsOrigin;
        headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
        headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
        headers['Access-Control-Max-Age'] = '86400';
      }
      res.writeHead(204, headers);
      res.end();
      return;
    }

    // คำขอที่มีเนื้อหา ต้องเป็น application/json เท่านั้น (บังคับให้เว็บอื่นต้องผ่าน preflight ซึ่งถูกปฏิเสธข้างบน)
    if (['POST', 'PUT'].includes(req.method) && !String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
      return sendError(res, 415, 'ต้องส่งเป็น application/json', 'UNSUPPORTED_MEDIA_TYPE');
    }

    const reqUrl = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
    const pathname = reqUrl.pathname;
    const method = req.method;

    try {
      // ---------------------------------------------------------
      // 1. HEALTH CHECK
      // ---------------------------------------------------------
      if (pathname === '/api/health' && method === 'GET') {
        return sendJson(res, 200, {
          ok: true,
          phase: '5b',
          mode: 'remote-sqlite',
          timestamp: Date.now()
        });
      }

      // ---------------------------------------------------------
      // 2. AUTHENTICATION & USERS
      // ---------------------------------------------------------
      // สมัครสมาชิกใหม่
      if (pathname === '/api/auth/register' && method === 'POST') {
        const body = await parseBody(req);
        const { username, password, displayName, teacherCode } = body;

        if (typeof username !== 'string' || typeof password !== 'string') {
          return sendError(res, 400, 'รูปแบบข้อมูลไม่ถูกต้อง');
        }
        if (!username || username.trim().length < 3) {
          return sendError(res, 400, 'ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร');
        }
        if (!password || password.length < 6) {
          return sendError(res, 400, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
        }

        const cleanUsername = username.trim().toLowerCase();
        const existing = db.prepare(`SELECT id FROM users WHERE username = ?`).get(cleanUsername);
        if (existing) {
          return sendError(res, 409, 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว');
        }

        const userId = 'user_' + crypto.randomBytes(8).toString('hex');
        const salt = crypto.randomBytes(16).toString('hex');
        const passwordHash = hashPassword(password, salt);
        // สมัครเองได้เฉพาะ "นักเรียน" — บทบาทผู้สอนต้องใส่รหัสลับที่ผู้ดูแลตั้งไว้ใน TEACHER_SIGNUP_CODE (ถ้าไม่ตั้ง = สมัครผู้สอนเองไม่ได้)
        // ห้ามเชื่อ role ที่ส่งมาจากฝั่งผู้ใช้ ไม่งั้นใครก็สมัครเป็นผู้สอนแล้วเห็นข้อมูลนักเรียนทั้งห้องได้
        const teacherSecret = process.env.TEACHER_SIGNUP_CODE || '';
        let userRole = 'student';
        if (teacherCode !== undefined && teacherCode !== '') {
          const given = crypto.createHash('sha256').update(String(teacherCode)).digest();
          const expected = crypto.createHash('sha256').update(teacherSecret).digest();
          if (!teacherSecret || !crypto.timingSafeEqual(given, expected)) {
            return sendError(res, 403, 'รหัสสำหรับสมัครเป็นผู้สอนไม่ถูกต้อง');
          }
          userRole = 'teacher';
        }
        const name = ((typeof displayName === 'string' && displayName.trim()) || username).slice(0, 80);

        db.prepare(`
          INSERT INTO users (id, username, password_hash, salt, display_name, role, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, cleanUsername, passwordHash, salt, name, userRole, Date.now());

        const token = issueSession(userId);

        return sendJson(res, 201, {
          ok: true,
          token,
          user: { id: userId, username: cleanUsername, displayName: name, role: userRole }
        });
      }

      // เข้าสู่ระบบ
      if (pathname === '/api/auth/login' && method === 'POST') {
        const body = await parseBody(req);
        const { username, password } = body;

        if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
          return sendError(res, 400, 'กรุณาระบุชื่อผู้ใช้และรหัสผ่าน');
        }

        const cleanUsername = username.trim().toLowerCase();
        const throttleKey = `${req.socket.remoteAddress}|${cleanUsername}`;
        if (recentCount(loginFails, throttleKey, LOGIN_WINDOW_MS) >= LOGIN_MAX_FAILS) {
          return sendError(res, 429, 'ล็อกอินผิดหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่', 'TOO_MANY_ATTEMPTS');
        }

        const user = db.prepare(`SELECT * FROM users WHERE username = ?`).get(cleanUsername);
        // คำนวณแฮชเสมอแม้ไม่พบผู้ใช้ เพื่อให้เวลาตอบไม่บอกว่าชื่อผู้ใช้มีอยู่จริงหรือไม่
        const testHash = hashPassword(password, user ? user.salt : '0'.repeat(32));
        if (!user || !safeEqualHex(testHash, user.password_hash)) {
          record(loginFails, throttleKey);
          return sendError(res, 401, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        }
        loginFails.delete(throttleKey);

        const token = issueSession(user.id);

        return sendJson(res, 200, {
          ok: true,
          token,
          user: { id: user.id, username: user.username, displayName: user.display_name, role: user.role }
        });
      }

      // ออกจากระบบ
      if (pathname === '/api/auth/logout' && method === 'POST') {
        const auth = authenticate(req);
        if (auth) {
          db.prepare(`DELETE FROM sessions WHERE token = ?`).run(auth.token); // auth.token คือค่าแฮชที่เก็บในฐานข้อมูล
        }
        return sendJson(res, 200, { ok: true });
      }

      // ข้อมูลผู้ใช้ปัจจุบัน
      if (pathname === '/api/auth/me' && method === 'GET') {
        const auth = authenticate(req);
        if (!auth) return sendError(res, 401, 'ยังไม่ได้เข้าสู่ระบบ');
        return sendJson(res, 200, {
          ok: true,
          user: { id: auth.id, username: auth.username, displayName: auth.display_name, role: auth.role }
        });
      }

      // ---------------------------------------------------------
      // 3. LEVELS & SERVER-SIDE CHECKER
      // ---------------------------------------------------------
      // GET /api/levels — ส่งรายชื่อด่าน (ซ่อน template จากนักเรียน เพื่อความปลอดภัย!)
      if (pathname === '/api/levels' && method === 'GET') {
        const auth = authenticate(req);
        const isTeacher = auth && auth.role === 'teacher';

        // ด่านในระบบ 30 ด่าน
        const safeLevels = LEVELS.map(l => {
          const copy = { ...l };
          // ซ่อนเฉลย (template) จากผู้เรียน
          if (!isTeacher) {
            delete copy.template;
          }
          return copy;
        });

        // ด่าน Custom จากฐานข้อมูล — เฉลยเห็นได้เฉพาะเจ้าของด่านและผู้สอน
        const customRows = db.prepare(`SELECT user_id, level_json FROM custom_levels`).all();
        const customLevels = customRows.map(r => {
          const l = JSON.parse(r.level_json);
          if (!isTeacher && !(auth && auth.id === r.user_id)) delete l.template;
          return l;
        });

        return sendJson(res, 200, {
          ok: true,
          levels: [...safeLevels, ...customLevels]
        });
      }

      // GET /api/levels/:id/flow — โหลด flow ของด่านสำหรับผู้ใช้ปัจจุบัน
      const flowMatch = pathname.match(/^\/api\/levels\/([^/]+)\/flow$/);
      if (flowMatch && method === 'GET') {
        const auth = authenticate(req);
        const levelId = flowMatch[1];
        const userId = auth ? auth.id : 'guest';

        const row = db.prepare(`SELECT flow_json FROM flows WHERE user_id = ? AND level_id = ?`).get(userId, levelId);
        if (!row) {
          return sendJson(res, 200, { ok: true, flow: null });
        }
        return sendJson(res, 200, { ok: true, flow: JSON.parse(row.flow_json) });
      }

      // PUT /api/levels/:id/flow — บันทึก flow ของด่าน
      if (flowMatch && method === 'PUT') {
        const auth = authenticate(req);
        const levelId = flowMatch[1];
        const userId = auth ? auth.id : 'guest';
        const body = await parseBody(req);

        db.prepare(`
          INSERT INTO flows (user_id, level_id, flow_json, updated_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(user_id, level_id) DO UPDATE SET
            flow_json = excluded.flow_json,
            updated_at = excluded.updated_at
        `).run(userId, levelId, JSON.stringify(body), Date.now());

        return sendJson(res, 200, { ok: true });
      }

      // POST /api/levels/:id/check — ตรวจคำตอบที่ฝั่ง Server (Zero-Trust)
      const checkMatch = pathname.match(/^\/api\/levels\/([^/]+)\/check$/);
      if (checkMatch && method === 'POST') {
        const auth = authenticate(req);
        const levelId = checkMatch[1];
        const userId = auth ? auth.id : 'guest';
        const body = await parseBody(req);
        const { flow, answers } = body;

        // ค้นหาด่านต้นฉบับที่มี template เฉลยสมบูรณ์
        let fullLevel = LEVELS.find(l => String(l.id) === String(levelId));
        if (!fullLevel) {
          const row = db.prepare(`SELECT level_json FROM custom_levels WHERE id = ?`).get(levelId);
          if (row) fullLevel = JSON.parse(row.level_json);
        }

        if (!fullLevel) {
          return sendError(res, 404, `ไม่พบด่านรหัส ${levelId}`);
        }

        // รันการตรวจด้วย shared/checker.js
        const result = fullLevel.mode === 'predict'
          ? checkPrediction(fullLevel, answers, BLOCK_CATALOG)
          : checkFlow(fullLevel, flow || { nodes: [], connections: [] }, BLOCK_CATALOG);

        // บันทึกความคืบหน้าลง SQLite (แยกรายผู้ใช้)
        const currentProgress = db.prepare(`SELECT attempts, passed FROM progress WHERE user_id = ? AND level_id = ?`).get(userId, levelId);
        const newAttempts = (currentProgress ? currentProgress.attempts : 0) + 1;
        const isPassed = (result.passed ? 1 : (currentProgress && currentProgress.passed ? 1 : 0));

        db.prepare(`
          INSERT INTO progress (user_id, level_id, passed, score, total, attempts, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id, level_id) DO UPDATE SET
            passed = MAX(progress.passed, excluded.passed),
            score = MAX(progress.score, excluded.score),
            total = excluded.total,
            attempts = excluded.attempts,
            updated_at = excluded.updated_at
        `).run(userId, levelId, isPassed, result.score, result.total, newAttempts, Date.now());

        return sendJson(res, 200, {
          ok: true,
          passed: result.passed,
          score: result.score,
          total: result.total,
          items: result.items
        });
      }

      // GET /api/progress — ดึงความคืบหน้าของผู้ใช้
      if (pathname === '/api/progress' && method === 'GET') {
        const auth = authenticate(req);
        const userId = auth ? auth.id : 'guest';

        const rows = db.prepare(`SELECT level_id, passed, score, total, attempts, updated_at FROM progress WHERE user_id = ?`).all(userId);
        const passedIds = rows.filter(r => r.passed === 1).map(r => r.level_id);

        return sendJson(res, 200, {
          ok: true,
          passed: passedIds,
          details: rows
        });
      }

      // ---------------------------------------------------------
      // 4. STUDIO PROJECTS MANAGEMENT
      // ---------------------------------------------------------
      if (pathname === '/api/projects' && method === 'GET') {
        const auth = authenticate(req);
        const userId = auth ? auth.id : 'guest';
        const rows = db.prepare(`SELECT id, name, flow_json, updated_at FROM projects WHERE user_id = ? ORDER BY updated_at DESC`).all(userId);
        const projects = rows.map(r => ({
          id: r.id,
          name: r.name,
          updatedAt: r.updated_at,
          flow: JSON.parse(r.flow_json)
        }));
        return sendJson(res, 200, { ok: true, projects });
      }

      if (pathname === '/api/projects' && method === 'POST') {
        const auth = authenticate(req);
        const userId = auth ? auth.id : 'guest';
        const body = await parseBody(req);
        const id = (typeof body.id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(body.id)) ? body.id : ('proj_' + crypto.randomBytes(6).toString('hex'));
        const name = ((typeof body.name === 'string' && body.name.trim()) || 'โปรเจกต์ใหม่').slice(0, 120);
        const flow = body.flow || { nodes: [], connections: [], nextNodeId: 1 };
        const now = Date.now();

        if (db.prepare(`SELECT 1 FROM projects WHERE id = ?`).get(id)) {
          return sendError(res, 409, 'รหัสโปรเจกต์นี้ถูกใช้งานแล้ว', 'CONFLICT');
        }
        db.prepare(`
          INSERT INTO projects (id, user_id, name, flow_json, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(id, userId, name, JSON.stringify(flow), now);

        return sendJson(res, 201, {
          ok: true,
          project: { id, name, updatedAt: now, flow }
        });
      }

      const projMatch = pathname.match(/^\/api\/projects\/([^/]+)$/);
      if (projMatch && method === 'PUT') {
        const auth = authenticate(req);
        const userId = auth ? auth.id : 'guest';
        const id = projMatch[1];
        const body = await parseBody(req);
        const now = Date.now();

        db.prepare(`
          UPDATE projects
          SET name = COALESCE(?, name),
              flow_json = COALESCE(?, flow_json),
              updated_at = ?
          WHERE id = ? AND user_id = ?
        `).run(body.name || null, body.flow ? JSON.stringify(body.flow) : null, now, id, userId);

        return sendJson(res, 200, { ok: true });
      }

      if (projMatch && method === 'DELETE') {
        const auth = authenticate(req);
        const userId = auth ? auth.id : 'guest';
        const id = projMatch[1];

        db.prepare(`DELETE FROM projects WHERE id = ? AND user_id = ?`).run(id, userId);
        return sendJson(res, 200, { ok: true });
      }

      // ---------------------------------------------------------
      // 5. CUSTOM LEVELS MANAGEMENT
      // ---------------------------------------------------------
      if (pathname === '/api/custom-levels' && method === 'GET') {
        // เฉลย (template) เห็นได้เฉพาะเจ้าของด่านและผู้สอน — เหมือนกับ GET /api/levels
        const auth = authenticate(req);
        const isTeacher = auth && auth.role === 'teacher';
        const rows = db.prepare(`SELECT id, user_id, title, level_json, created_at FROM custom_levels ORDER BY created_at DESC`).all();
        const customLevels = rows.map(r => {
          const l = JSON.parse(r.level_json);
          if (!isTeacher && !(auth && auth.id === r.user_id)) delete l.template;
          return l;
        });
        return sendJson(res, 200, { ok: true, customLevels });
      }

      if (pathname === '/api/custom-levels' && method === 'POST') {
        const auth = authenticate(req);
        if (!auth) return sendError(res, 401, 'ต้องเข้าสู่ระบบก่อนสร้างหรือแก้ไขด่าน', 'UNAUTHORIZED');
        const body = await parseBody(req);

        // ทำความสะอาดระดับความปลอดภัย (XSS Prevention) — ข้อมูลไม่ถูกต้องตอบ 400 ไม่ใช่ 500
        let sanitized;
        try {
          sanitized = sanitizeCustomLevel(body, BLOCK_CATALOG, TRACKS.map(t => t.id), CHECK_RUNNERS);
        } catch (e) {
          return sendError(res, 400, e.message, 'INVALID_LEVEL');
        }
        const id = sanitized.id;
        const now = Date.now();

        // แก้ไขทับด่านเดิมได้เฉพาะเจ้าของด่านหรือผู้สอน (กันคนอื่นเดา id แล้วเขียนทับ)
        const existing = db.prepare(`SELECT user_id FROM custom_levels WHERE id = ?`).get(id);
        if (existing && existing.user_id !== auth.id && auth.role !== 'teacher') {
          return sendError(res, 403, 'ไม่ใช่เจ้าของด่านนี้', 'FORBIDDEN');
        }

        db.prepare(`
          INSERT INTO custom_levels (id, user_id, title, level_json, created_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            level_json = excluded.level_json
        `).run(id, auth.id, sanitized.title, JSON.stringify(sanitized), now);

        return sendJson(res, 201, { ok: true, level: sanitized });
      }

      const customLevelMatch = pathname.match(/^\/api\/custom-levels\/([^/]+)$/);
      if (customLevelMatch && method === 'DELETE') {
        const auth = authenticate(req);
        if (!auth) return sendError(res, 401, 'ต้องเข้าสู่ระบบก่อนลบด่าน', 'UNAUTHORIZED');
        const id = customLevelMatch[1];
        const existing = db.prepare(`SELECT user_id FROM custom_levels WHERE id = ?`).get(id);
        if (!existing) return sendError(res, 404, 'ไม่พบด่านนี้', 'NOT_FOUND');
        if (existing.user_id !== auth.id && auth.role !== 'teacher') {
          return sendError(res, 403, 'ไม่ใช่เจ้าของด่านนี้', 'FORBIDDEN');
        }
        db.prepare(`DELETE FROM custom_levels WHERE id = ?`).run(id);
        return sendJson(res, 200, { ok: true });
      }

      // ---------------------------------------------------------
      // 6. SHARE FLOW / LEVEL VIA SHORT LINK
      // ---------------------------------------------------------
      if (pathname === '/api/share' && method === 'POST') {
        const auth = authenticate(req);
        if (!auth) return sendError(res, 401, 'ต้องเข้าสู่ระบบก่อนแชร์', 'UNAUTHORIZED');
        const body = await parseBody(req);
        const { type, title, data } = body; // type: 'project' | 'level'

        if (!data) return sendError(res, 400, 'ข้อมูลที่ต้องการแชร์ว่างเปล่า');
        const shareType = type === 'level' ? 'level' : 'project';

        // ตรวจและทำความสะอาดข้อมูลก่อนเก็บ — คนที่เปิดลิงก์จะได้รับเฉพาะข้อมูลที่ผ่านการตรวจแล้ว
        let cleanData;
        try {
          if (shareType === 'level') {
            cleanData = sanitizeCustomLevel(data, BLOCK_CATALOG, TRACKS.map(t => t.id), CHECK_RUNNERS);
          } else {
            const flow = sanitizeFlow(data, BLOCK_CATALOG, 'flow ที่แชร์');
            cleanData = { ...flow, nextNodeId: Math.max(0, ...flow.nodes.map(n => n.id)) + 1 };
          }
        } catch (e) {
          return sendError(res, 400, e.message, 'INVALID_SHARE_DATA');
        }

        const code = crypto.randomBytes(4).toString('hex'); // 8 ตัวอักษร เช่น 4a8f9c1b
        const now = Date.now();
        const cleanTitle = String(title || 'Shared Workflow').slice(0, 120).replace(/[<>"'`]/g, '');

        db.prepare(`
          INSERT INTO shares (code, user_id, type, title, data_json, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(code, auth.id, shareType, cleanTitle, JSON.stringify(cleanData), now);

        return sendJson(res, 201, {
          ok: true,
          code,
          shareUrl: `?share=${code}`
        });
      }

      const shareMatch = pathname.match(/^\/api\/share\/([a-zA-Z0-9]+)$/);
      if (shareMatch && method === 'GET') {
        const code = shareMatch[1];
        const row = db.prepare(`
          SELECT s.code, s.type, s.title, s.data_json, s.created_at, u.display_name as author
          FROM shares s
          LEFT JOIN users u ON s.user_id = u.id
          WHERE s.code = ?
        `).get(code);

        if (!row) {
          return sendError(res, 404, 'ไม่พบข้อมูลที่แชร์หรือลิงก์หมดอายุแล้ว');
        }

        return sendJson(res, 200, {
          ok: true,
          code: row.code,
          type: row.type,
          title: row.title,
          author: row.author || 'ผู้ใช้ทั่วไป',
          createdAt: row.created_at,
          data: JSON.parse(row.data_json)
        });
      }

      // ---------------------------------------------------------
      // 7. TEACHER / CLASSROOM DASHBOARD
      // ---------------------------------------------------------
      if (pathname === '/api/teacher/overview' && method === 'GET') {
        const auth = authenticate(req);
        if (!auth || auth.role !== 'teacher') {
          return sendError(res, 403, 'เฉพาะผู้สอนเท่านั้นที่สามารถดูแดชบอร์ดห้องเรียนได้');
        }

        // 1. รายชื่อนักเรียนและความคืบหน้า
        const students = db.prepare(`
          SELECT 
            u.id, 
            u.username, 
            u.display_name, 
            u.created_at,
            COUNT(CASE WHEN p.passed = 1 THEN 1 END) as passed_count,
            COALESCE(SUM(p.score), 0) as total_score,
            COALESCE(SUM(p.attempts), 0) as total_attempts,
            MAX(p.updated_at) as last_active
          FROM users u
          LEFT JOIN progress p ON u.id = p.user_id
          WHERE u.role = 'student'
          GROUP BY u.id
          ORDER BY passed_count DESC, total_score DESC
        `).all();

        // 2. สถิติความยากของแต่ละด่าน
        const levelStats = db.prepare(`
          SELECT 
            level_id,
            COUNT(CASE WHEN passed = 1 THEN 1 END) as passed_students,
            AVG(attempts) as avg_attempts,
            AVG(score) as avg_score
          FROM progress
          GROUP BY level_id
          ORDER BY level_id ASC
        `).all();

        return sendJson(res, 200, {
          ok: true,
          totalStudents: students.length,
          totalLevels: LEVELS.length,
          students,
          levelStats
        });
      }

      // ---------------------------------------------------------
      // 8. AI COACH PROXY (ส่งต่อไปยัง Python Backend บนพอร์ต 8787)
      // ---------------------------------------------------------
      if (pathname === '/api/coach' && method === 'POST') {
        // การเรียก AI มีค่าใช้จ่าย: ต้องล็อกอิน และจำกัดจำนวนครั้งต่อนาทีต่อผู้ใช้
        const auth = authenticate(req);
        if (!auth) return sendError(res, 401, 'ต้องเข้าสู่ระบบก่อนใช้ AI Coach', 'UNAUTHORIZED');
        if (recentCount(coachCalls, auth.id, 60 * 1000) >= COACH_MAX_PER_MINUTE) {
          return sendError(res, 429, 'ขอคำแนะนำถี่เกินไป กรุณารอสักครู่', 'RATE_LIMITED');
        }
        record(coachCalls, auth.id);
        const body = await parseBody(req);
        const postData = JSON.stringify(body);

        const coachReq = http.request(PYTHON_COACH_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          },
          timeout: 70000
        }, (coachRes) => {
          let replyData = '';
          coachRes.on('data', chunk => { replyData += chunk; });
          coachRes.on('end', () => {
            try {
              const parsed = JSON.parse(replyData);
              return sendJson(res, coachRes.statusCode, { ok: coachRes.statusCode === 200, reply: parsed });
            } catch (e) {
              return sendJson(res, 502, { ok: false, error: 'coach_bad_response' });
            }
          });
        });

        coachReq.on('error', (err) => {
          return sendJson(res, 200, {
            ok: false,
            reason: 'offline',
            message: 'เซิร์ฟเวอร์ AI Coach (Python 8787) ยังไม่ได้เปิดใช้งาน'
          });
        });

        coachReq.write(postData);
        coachReq.end();
        return;
      }

      // Route Not Found
      return sendError(res, 404, 'Endpoint not found', 'NOT_FOUND');

    } catch (err) {
      // ความผิดพลาดที่ผู้ใช้ก่อ (JSON เสีย/ใหญ่เกิน) ตอบตามจริง; ความผิดพลาดภายในไม่ส่งรายละเอียดออกไป (บันทึกไว้ฝั่งเซิร์ฟเวอร์)
      if (err && err.statusCode && err.statusCode < 500) {
        return sendError(res, err.statusCode, err.message, 'BAD_REQUEST');
      }
      console.error('Server error:', err);
      return sendError(res, 500, 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์', 'INTERNAL_ERROR');
    }
  });

  return { server, db };
}

if (require.main === module) {
  const { server } = createServer();
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`⚡ Workflow Automation Lab — Backend API Server (Phase 5b) running on http://127.0.0.1:${PORT}`);
  });
}

module.exports = { createServer };

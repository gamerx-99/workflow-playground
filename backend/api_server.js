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
const { sanitizeCustomLevel } = require('../shared/sanitize.js');

const PORT = parseInt(process.env.API_PORT || '8788', 10);
const PYTHON_COACH_URL = process.env.COACH_URL || 'http://127.0.0.1:8787/coach';

function createServer(dbInstance = null) {
  const db = dbInstance || initDb();

  // Helper ส่ง JSON
  function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end(JSON.stringify(data));
  }

  function sendError(res, statusCode, message, code = 'ERROR') {
    sendJson(res, statusCode, { ok: false, error: message, code });
  }

  // อ่าน Body ของ Request
  function parseBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk;
        if (body.length > 2 * 1024 * 1024) { // จำกัด 2MB
          reject(new Error('Request body too large'));
        }
      });
      req.on('end', () => {
        if (!body) return resolve({});
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error('Invalid JSON'));
        }
      });
      req.on('error', reject);
    });
  }

  // ตรวจสอบตัวตนผู้ใช้จาก Header Authorization
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
    `).get(token, Date.now());

    return session || null;
  }

  const server = http.createServer(async (req, res) => {
    // CORS Preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400'
      });
      res.end();
      return;
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
        const { username, password, displayName, role } = body;

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
        const userRole = (role === 'teacher') ? 'teacher' : 'student';
        const name = (displayName && displayName.trim()) || username;

        db.prepare(`
          INSERT INTO users (id, username, password_hash, salt, display_name, role, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, cleanUsername, passwordHash, salt, name, userRole, Date.now());

        // สร้าง Session Token อายุ 30 วัน
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
        db.prepare(`
          INSERT INTO sessions (token, user_id, created_at, expires_at)
          VALUES (?, ?, ?, ?)
        `).run(token, userId, Date.now(), expiresAt);

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

        if (!username || !password) {
          return sendError(res, 400, 'กรุณาระบุชื่อผู้ใช้และรหัสผ่าน');
        }

        const cleanUsername = username.trim().toLowerCase();
        const user = db.prepare(`SELECT * FROM users WHERE username = ?`).get(cleanUsername);
        if (!user) {
          return sendError(res, 401, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        }

        const testHash = hashPassword(password, user.salt);
        if (testHash !== user.password_hash) {
          return sendError(res, 401, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        }

        // สร้าง Session Token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
        db.prepare(`
          INSERT INTO sessions (token, user_id, created_at, expires_at)
          VALUES (?, ?, ?, ?)
        `).run(token, user.id, Date.now(), expiresAt);

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
          db.prepare(`DELETE FROM sessions WHERE token = ?`).run(auth.token);
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

        // ด่าน Custom จากฐานข้อมูล
        const customRows = db.prepare(`SELECT level_json FROM custom_levels`).all();
        const customLevels = customRows.map(r => {
          const l = JSON.parse(r.level_json);
          if (!isTeacher) delete l.template;
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
        const id = body.id || ('proj_' + Date.now());
        const name = (body.name && body.name.trim()) || 'โปรเจกต์ใหม่';
        const flow = body.flow || { nodes: [], connections: [], nextNodeId: 1 };
        const now = Date.now();

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
        const rows = db.prepare(`SELECT id, title, level_json, created_at FROM custom_levels ORDER BY created_at DESC`).all();
        const customLevels = rows.map(r => JSON.parse(r.level_json));
        return sendJson(res, 200, { ok: true, customLevels });
      }

      if (pathname === '/api/custom-levels' && method === 'POST') {
        const auth = authenticate(req);
        const userId = auth ? auth.id : 'guest';
        const body = await parseBody(req);

        // ทำความสะอาดระดับความปลอดภัย (XSS Prevention)
        const sanitized = sanitizeCustomLevel(body, BLOCK_CATALOG, TRACKS.map(t => t.id), CHECK_RUNNERS);
        const id = sanitized.id;
        const now = Date.now();

        db.prepare(`
          INSERT INTO custom_levels (id, user_id, title, level_json, created_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            level_json = excluded.level_json
        `).run(id, userId, sanitized.title, JSON.stringify(sanitized), now);

        return sendJson(res, 201, { ok: true, level: sanitized });
      }

      const customLevelMatch = pathname.match(/^\/api\/custom-levels\/([^/]+)$/);
      if (customLevelMatch && method === 'DELETE') {
        const id = customLevelMatch[1];
        db.prepare(`DELETE FROM custom_levels WHERE id = ?`).run(id);
        return sendJson(res, 200, { ok: true });
      }

      // ---------------------------------------------------------
      // 6. SHARE FLOW / LEVEL VIA SHORT LINK
      // ---------------------------------------------------------
      if (pathname === '/api/share' && method === 'POST') {
        const auth = authenticate(req);
        const userId = auth ? auth.id : 'guest';
        const body = await parseBody(req);
        const { type, title, data } = body; // type: 'project' | 'level'

        if (!data) return sendError(res, 400, 'ข้อมูลที่ต้องการแชร์ว่างเปล่า');

        const code = crypto.randomBytes(4).toString('hex'); // 8 ตัวอักษร เช่น 4a8f9c1b
        const now = Date.now();

        db.prepare(`
          INSERT INTO shares (code, user_id, type, title, data_json, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(code, userId, type || 'project', title || 'Shared Workflow', JSON.stringify(data), now);

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
      console.error('Server error:', err);
      return sendError(res, 500, err.message, 'INTERNAL_ERROR');
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

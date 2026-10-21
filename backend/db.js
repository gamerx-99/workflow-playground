// ---------------------------------------------------------
// DATABASE MODULE — ใช้ SQLite ใน Node v24 (node:sqlite)
// ---------------------------------------------------------
const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');
const path = require('node:path');

// DB_PATH แบบ relative (เช่น backend/workflow_lab.db ใน .env) อิงจากรากโปรเจกต์ ไม่ใช่โฟลเดอร์ที่สั่งรัน
const DB_PATH = process.env.DB_PATH
  ? path.resolve(path.join(__dirname, '..'), process.env.DB_PATH)
  : path.join(__dirname, 'workflow_lab.db');

function initDb(dbPath = DB_PATH) {
  const db = new DatabaseSync(dbPath);

  // WAL mode for fast concurrent reads
  db.exec(`PRAGMA journal_mode = WAL;`);

  // ตารางผู้ใช้งาน
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student',
      created_at INTEGER NOT NULL
    );
  `);

  // ตาราง Sessions สำหรับเก็บ Login Tokens
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // ตารางความคืบหน้าของแต่ละด่าน (แยกรายคน)
  db.exec(`
    CREATE TABLE IF NOT EXISTS progress (
      user_id TEXT NOT NULL,
      level_id INTEGER NOT NULL,
      passed INTEGER NOT NULL DEFAULT 0,
      score INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL DEFAULT 0,
      attempts INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, level_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // ตาราง Flow ของแต่ละด่าน (แยกรายคน)
  db.exec(`
    CREATE TABLE IF NOT EXISTS flows (
      user_id TEXT NOT NULL,
      level_id INTEGER NOT NULL,
      flow_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, level_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // ตารางโปรเจกต์ใน Studio (แยกรายคน)
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      flow_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // ตารางด่านสร้างเอง Custom Levels
  db.exec(`
    CREATE TABLE IF NOT EXISTS custom_levels (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      level_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // ตารางการแชร์ด่านหรือ Flow ผ่านลิงก์ (Share Link)
  db.exec(`
    CREATE TABLE IF NOT EXISTS shares (
      code TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      data_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // ตรวจสอบและสร้างบัญชีเริ่มต้น: อาจารย์ (teacher) และนักเรียน (student)
  seedDefaultUsers(db);

  return db;
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

// บัญชีตัวอย่าง (teacher/teacher123, student/student123) ไว้ใช้พัฒนาและสาธิตเท่านั้น — รหัสผ่านเป็นที่รู้กัน
// ปิดการสร้างได้ด้วย NODE_ENV=production หรือ SEED_DEMO_USERS=0 (แนะนำเมื่อเปิดใช้งานจริง)
function seedDefaultUsers(db) {
  if (process.env.NODE_ENV === 'production' || process.env.SEED_DEMO_USERS === '0') return;
  console.warn('⚠️  สร้างบัญชีตัวอย่าง teacher/student ที่รหัสผ่านเป็นที่รู้กัน — ห้ามใช้ในระบบจริง (ตั้ง SEED_DEMO_USERS=0 เพื่อปิด)');
  const findUser = db.prepare(`SELECT id FROM users WHERE username = ?`);

  // 1. บัญชีผู้สอน (Teacher)
  if (!findUser.get('teacher')) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword('teacher123', salt);
    db.prepare(`
      INSERT INTO users (id, username, password_hash, salt, display_name, role, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('user_teacher_default', 'teacher', hash, salt, 'อาจารย์ผู้สอน (Demo)', 'teacher', Date.now());
  }

  // 2. บัญชีนักเรียนตัวอย่าง (Student)
  if (!findUser.get('student')) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword('student123', salt);
    db.prepare(`
      INSERT INTO users (id, username, password_hash, salt, display_name, role, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('user_student_demo', 'student', hash, salt, 'นักเรียนทดสอบ (Demo)', 'student', Date.now());
  }
}

module.exports = {
  initDb,
  hashPassword
};

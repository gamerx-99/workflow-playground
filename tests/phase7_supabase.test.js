// ---------------------------------------------------------
// PHASE 7: SUPABASE INTEGRATION TEST SUITE
// ---------------------------------------------------------
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

// Load environment from .env
for (const file of [path.join(__dirname, '..', '.env'), path.join(__dirname, '..', 'backend', '.env')]) {
  try {
    process.loadEnvFile(file);
  } catch (e) {}
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

let passedTests = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ok   ${name}`);
    passedTests++;
  } catch (e) {
    console.error(`  FAIL ${name}: ${e.message}`);
    process.exit(1);
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ok   ${name}`);
    passedTests++;
  } catch (e) {
    console.error(`  FAIL ${name}: ${e.message}`);
    process.exit(1);
  }
}

async function run() {
  console.log('--- Phase 7: Supabase Integration & Schema Validation ---');

  test('.env มีการกำหนดค่า Supabase ครบถ้วนและถูกต้อง', () => {
    assert.ok(SUPABASE_URL, 'SUPABASE_URL ต้องไม่ว่างเปล่า');
    assert.match(SUPABASE_URL, /^https:\/\/[a-z0-9-]+\.supabase\.co$/, 'SUPABASE_URL ต้องเป็นรูปแบบ https://...supabase.co');
    assert.ok(SUPABASE_ANON_KEY, 'SUPABASE_ANON_KEY หรือ PUBLISHABLE_KEY ต้องไม่ว่างเปล่า');
    assert.ok(SUPABASE_SECRET_KEY, 'SUPABASE_SECRET_KEY ต้องไม่ว่างเปล่า');
  });

  test('ไฟล์ migration SQL (supabase/migrations/20261021_init_schema.sql) มีโครงสร้างครบตาม Roadmap', () => {
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20261021_init_schema.sql');
    assert.ok(fs.existsSync(migrationPath), 'ไฟล์ migration ต้องมีอยู่จริง');
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    // ตรวจสอบตารางที่ต้องมี
    const requiredTables = ['profiles', 'progress', 'flows', 'projects', 'custom_levels', 'shares', 'level_solutions'];
    for (const table of requiredTables) {
      assert.ok(sql.includes(`CREATE TABLE IF NOT EXISTS public.${table}`), `ต้องมีคำสั่งสร้างตาราง public.${table}`);
      assert.ok(sql.includes(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`), `ตาราง public.${table} ต้องเปิด RLS`);
    }

    // ตรวจสอบ trigger สำหรับ new user
    assert.ok(sql.includes('handle_new_user()'), 'ต้องมีฟังก์ชัน handle_new_user');
    assert.ok(sql.includes('TRIGGER on_auth_user_created'), 'ต้องมี Trigger on_auth_user_created');
  });

  test('ไฟล์ตั้งค่า frontend (supabase-config.js) ตรงกับ .env', () => {
    const configPath = path.join(__dirname, '..', 'frontend', 'js', 'api', 'supabase-config.js');
    assert.ok(fs.existsSync(configPath), 'frontend/js/api/supabase-config.js ต้องมีอยู่จริง');
    const content = fs.readFileSync(configPath, 'utf-8');
    assert.ok(content.includes(SUPABASE_URL), 'supabase-config.js ต้องมี SUPABASE_URL ที่ถูกต้อง');
    assert.ok(content.includes(SUPABASE_ANON_KEY), 'supabase-config.js ต้องมี ANON_KEY ที่ถูกต้อง');
  });

  test('frontend/js/api/supabase.js มีเมธอดครบตามมาตรฐาน Api Contract', () => {
    const apiPath = path.join(__dirname, '..', 'frontend', 'js', 'api', 'supabase.js');
    assert.ok(fs.existsSync(apiPath), 'frontend/js/api/supabase.js ต้องมีอยู่จริง');
    const code = fs.readFileSync(apiPath, 'utf-8');

    const expectedMethods = [
      'register', 'login', 'logout', 'getMe',
      'getLevels', 'loadFlow', 'saveFlow', 'checkLevel', 'getProgress',
      'listProjects', 'getProject', 'saveProject', 'createProject', 'deleteProject',
      'getCustomLevels', 'saveCustomLevel', 'deleteCustomLevel',
      'shareFlow', 'getShare', 'getTeacherOverview', 'syncLocalToServer'
    ];

    for (const m of expectedMethods) {
      assert.ok(code.includes(`${m}(`) || code.includes(`async ${m}(`), `SupabaseApi ต้องมีเมธอด ${m}`);
    }
  });

  test('frontend/index.html โหลดสคริปต์ Supabase และตัวเลือกโหมด Supabase Cloud', () => {
    const htmlPath = path.join(__dirname, '..', 'frontend', 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf-8');
    assert.ok(html.includes('@supabase/supabase-js'), 'index.html ต้องโหลด supabase-js');
    assert.ok(html.includes('js/api/supabase-config.js'), 'index.html ต้องโหลด supabase-config.js');
    assert.ok(html.includes('js/api/supabase.js'), 'index.html ต้องโหลด supabase.js');
    assert.ok(html.includes('id="backend-mode-supabase"'), 'index.html ต้องมีตัวเลือกโหมด backend-mode-supabase');
  });

  await asyncTest('Live Supabase Auth API เชื่อมต่อได้จริง (HTTP 200)', async () => {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      headers: { 'apikey': SUPABASE_ANON_KEY }
    });
    assert.strictEqual(res.status, 200, `Supabase Auth health check ต้องคืนค่า 200 (ได้ ${res.status})`);
  });

  await asyncTest('Live Supabase PostgREST API เชื่อมต่อได้จริง และตารางทั้งหมดถูกสร้างแล้ว', async () => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: {
        'apikey': SUPABASE_SECRET_KEY,
        'Authorization': `Bearer ${SUPABASE_SECRET_KEY}`
      }
    });
    assert.strictEqual(res.status, 200, `Supabase PostgREST ต้องคืนค่า 200 (ได้ ${res.status})`);
    const data = await res.json();
    const paths = Object.keys(data.paths || {}).map(p => p.replace(/^\//, ''));
    const expectedTables = ['profiles', 'progress', 'flows', 'projects', 'custom_levels', 'shares', 'level_solutions'];
    for (const t of expectedTables) {
      assert.ok(paths.includes(t), `ตาราง ${t} ต้องพร้อมใช้งานบน Supabase`);
    }
  });

  await asyncTest('Live RLS Verification: Service Role อ่านเฉลยได้ 30 ด่าน แต่ Anon Key ถูกบล็อก (ได้ 0)', async () => {
    // 1. Service Role
    const secretRes = await fetch(`${SUPABASE_URL}/rest/v1/level_solutions?select=level_id`, {
      headers: {
        'apikey': SUPABASE_SECRET_KEY,
        'Authorization': `Bearer ${SUPABASE_SECRET_KEY}`
      }
    });
    const secretData = await secretRes.json();
    assert.strictEqual(secretData.length, 30, 'Service Role ต้องอ่านเฉลยได้ครบทั้ง 30 ด่าน');

    // 2. Anon Key (Client)
    const anonRes = await fetch(`${SUPABASE_URL}/rest/v1/level_solutions?select=level_id`, {
      headers: { 'apikey': SUPABASE_ANON_KEY }
    });
    const anonData = await anonRes.json();
    assert.strictEqual(anonData.length, 0, 'RLS ต้องป้องกันไม่ให้ Anon Key เข้าถึงเฉลย (ต้องได้ 0 แถว)');
  });

  console.log(`\n✅ All ${passedTests} Phase 7 Supabase tests passed!`);
}

run().catch(console.error);

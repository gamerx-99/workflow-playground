// รัน: node tests/phase5b_security.test.js
// ทดสอบความปลอดภัยของ backend/api_server.js (เซิร์ฟเวอร์ในโปรเซสนี้ + ฐานข้อมูลชั่วคราว ไม่แตะฐานข้อมูลจริง)
const assert = require('assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../backend/api_server.js');
const { initDb } = require('../backend/db.js');
const { LEVELS } = require('../shared/levels.js');

let failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.message}`); }
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-sec-'));
let base = '';
let db;

async function call(method, p, { body, token, headers = {}, raw, contentType = 'application/json' } = {}) {
  const res = await fetch(base + p, {
    method,
    headers: { ...(contentType ? { 'Content-Type': contentType } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: raw !== undefined ? raw : (body !== undefined ? JSON.stringify(body) : undefined)
  });
  let json = null;
  try { json = await res.json(); } catch (e) {}
  return { status: res.status, json, acao: res.headers.get('access-control-allow-origin') };
}

const level = (over = {}) => ({
  id: 'custom_5551', title: 'ด่านทดสอบ', mode: 'build', difficulty: 1,
  template: LEVELS.find(l => l.id === 9).template, ...over
});

(async () => {
  console.log('--- Phase 5b Security ---');
  db = initDb(path.join(tmpDir, 'sec.db'));
  const { server } = createServer(db);
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;

  const reg = async (username, extra = {}) => (await call('POST', '/api/auth/register', { body: { username, password: 'secret12', ...extra } })).json;

  await test('สมัครเองแล้วส่ง role=teacher มาก็ได้เป็น student เท่านั้น (ไม่มีทางยกระดับสิทธิ์)', async () => {
    const r = await reg('mallory', { role: 'teacher' });
    assert.strictEqual(r.user.role, 'student');
    const ov = await call('GET', '/api/teacher/overview', { token: r.token });
    assert.strictEqual(ov.status, 403);
  });

  await test('teacherCode: ผิด = 403, ไม่ได้ตั้งรหัสที่ server = สมัครผู้สอนไม่ได้เลย, ถูก = เป็นผู้สอน', async () => {
    delete process.env.TEACHER_SIGNUP_CODE;
    assert.strictEqual((await call('POST', '/api/auth/register', { body: { username: 'wannabe1', password: 'secret12', teacherCode: 'anything' } })).status, 403);
    assert.strictEqual((await call('POST', '/api/auth/register', { body: { username: 'wannabe2', password: 'secret12', teacherCode: '' } })).status, 201);
    process.env.TEACHER_SIGNUP_CODE = 'classroom-secret';
    assert.strictEqual((await call('POST', '/api/auth/register', { body: { username: 'wannabe3', password: 'secret12', teacherCode: 'wrong' } })).status, 403);
    const ok = await call('POST', '/api/auth/register', { body: { username: 'realteacher', password: 'secret12', teacherCode: 'classroom-secret' } });
    assert.strictEqual(ok.json.user.role, 'teacher');
    delete process.env.TEACHER_SIGNUP_CODE;
  });

  await test('token ในฐานข้อมูลเป็นค่าแฮช ไม่ใช่ token ดิบ และใช้ token จริงล็อกอินได้ตามปกติ', async () => {
    const r = await reg('hashcheck');
    const rows = db.prepare(`SELECT token FROM sessions`).all().map(x => x.token);
    assert.ok(!rows.includes(r.token), 'พบ token ดิบในฐานข้อมูล');
    assert.strictEqual((await call('GET', '/api/auth/me', { token: r.token })).status, 200);
    await call('POST', '/api/auth/logout', { token: r.token });
    assert.strictEqual((await call('GET', '/api/auth/me', { token: r.token })).status, 401);
  });

  await test('ล็อกอินผิดซ้ำๆ ถูกจำกัด (429) และข้อความไม่บอกว่าชื่อผู้ใช้มีอยู่หรือไม่', async () => {
    const msgs = new Set();
    let last;
    for (let i = 0; i < 12; i++) {
      last = await call('POST', '/api/auth/login', { body: { username: 'student', password: 'wrong' + i } });
      if (last.status === 401) msgs.add(last.json.error);
    }
    assert.strictEqual(last.status, 429);
    const unknown = await call('POST', '/api/auth/login', { body: { username: 'no-such-user', password: 'x' } });
    assert.ok(msgs.has(unknown.json.error), 'ข้อความ error ของผู้ใช้ที่ไม่มีอยู่ต่างจากรหัสผ่านผิด');
  });

  await test('Origin นอกรายการ (รวมถึง null) ถูกปฏิเสธ 403 ก่อนประมวลผล ส่วน origin ของเราได้ ACAO ตรงตัว', async () => {
    for (const origin of ['https://evil.example', 'null']) {
      const r = await call('POST', '/api/auth/register', { body: { username: 'evil' + origin.length, password: 'secret12' }, headers: { Origin: origin } });
      assert.strictEqual(r.status, 403, origin);
      assert.ok(!r.acao, 'ต้องไม่ส่ง Access-Control-Allow-Origin');
    }
    assert.strictEqual(db.prepare(`SELECT 1 FROM users WHERE username LIKE 'evil%'`).get(), undefined, 'คำขอที่ถูกปฏิเสธต้องไม่สร้างผู้ใช้');
    const ok = await call('GET', '/api/health', { headers: { Origin: 'http://localhost:5173' } });
    assert.strictEqual(ok.acao, 'http://localhost:5173');
    const noOrigin = await call('GET', '/api/health');
    assert.strictEqual(noOrigin.status, 200);
    assert.ok(!noOrigin.acao, 'ไม่ควรเป็น *');
  });

  await test('POST/PUT ที่ไม่ใช่ application/json ถูกปฏิเสธ 415 (กัน "simple request" ข้ามเว็บ)', async () => {
    const r = await call('POST', '/api/auth/register', { raw: JSON.stringify({ username: 'plain1', password: 'secret12' }), contentType: 'text/plain' });
    assert.strictEqual(r.status, 415);
    assert.strictEqual(db.prepare(`SELECT 1 FROM users WHERE username = 'plain1'`).get(), undefined);
  });

  await test('body ใหญ่เกิน 2MB ตอบ 413 และ JSON เสียตอบ 400 (ไม่ใช่ 500)', async () => {
    const big = await call('POST', '/api/auth/login', { raw: '{"username":"' + 'a'.repeat(2 * 1024 * 1024 + 10) + '"}' }).catch(e => ({ status: 'conn-closed' }));
    assert.ok([413, 'conn-closed'].includes(big.status), String(big.status));
    const bad = await call('POST', '/api/auth/login', { raw: '{not json' });
    assert.strictEqual(bad.status, 400);
  });

  const owner = await reg('levelowner');
  const other = await reg('otherstudent');
  const teacher = (await call('POST', '/api/auth/login', { body: { username: 'teacher', password: 'teacher123' } })).json;

  await test('ด่านสร้างเอง: ไม่ล็อกอินเขียน/ลบไม่ได้ (401), คนอื่นเขียนทับ/ลบไม่ได้ (403), เจ้าของและผู้สอนทำได้', async () => {
    assert.strictEqual((await call('POST', '/api/custom-levels', { body: level() })).status, 401);
    assert.strictEqual((await call('POST', '/api/custom-levels', { body: level(), token: owner.token })).status, 201);
    assert.strictEqual((await call('POST', '/api/custom-levels', { body: level({ title: 'HIJACK' }), token: other.token })).status, 403);
    assert.strictEqual((await call('DELETE', '/api/custom-levels/custom_5551')).status, 401);
    assert.strictEqual((await call('DELETE', '/api/custom-levels/custom_5551', { token: other.token })).status, 403);
    const list = await call('GET', '/api/custom-levels', { token: owner.token });
    assert.strictEqual(list.json.customLevels[0].title, 'ด่านทดสอบ', 'ชื่อต้องไม่ถูกเขียนทับ');
    assert.strictEqual((await call('POST', '/api/custom-levels', { body: level({ title: 'แก้โดยเจ้าของ' }), token: owner.token })).status, 201);
    assert.strictEqual((await call('DELETE', '/api/custom-levels/custom_5551', { token: teacher.token })).status, 200);
  });

  await test('เฉลยของด่านสร้างเอง: เจ้าของ/ผู้สอนเห็น, คนอื่นและผู้ไม่ล็อกอินไม่เห็น (ทั้ง /api/levels และ /api/custom-levels)', async () => {
    await call('POST', '/api/custom-levels', { body: level({ id: 'custom_5552' }), token: owner.token });
    const has = async (p, token) => {
      const r = await call('GET', p, { token });
      const list = r.json.levels || r.json.customLevels;
      return !!list.find(l => l.id === 'custom_5552').template;
    };
    for (const p of ['/api/levels', '/api/custom-levels']) {
      assert.strictEqual(await has(p, owner.token), true, p + ' เจ้าของ');
      assert.strictEqual(await has(p, teacher.token), true, p + ' ผู้สอน');
      assert.strictEqual(await has(p, other.token), false, p + ' คนอื่น');
      assert.strictEqual(await has(p), false, p + ' ไม่ล็อกอิน');
    }
  });

  await test('ด่านที่ข้อมูลไม่ถูกต้องตอบ 400 พร้อมเหตุผล และไม่รั่วข้อความภายในของฐานข้อมูล', async () => {
    const bad = await call('POST', '/api/custom-levels', { body: { title: 'x', template: { nodes: [{ id: 1, type: 'evil', config: {} }], connections: [] } }, token: owner.token });
    assert.strictEqual(bad.status, 400);
    const a = await call('POST', '/api/projects', { body: { id: 'p-dup', name: 'a' }, token: owner.token });
    const dup = await call('POST', '/api/projects', { body: { id: 'p-dup', name: 'b' }, token: owner.token });
    assert.strictEqual(a.status, 201);
    assert.strictEqual(dup.status, 409);
    assert.ok(!/SQLITE|constraint|UNIQUE/i.test(JSON.stringify(dup.json)));
    const weird = await call('POST', '/api/projects', { body: { id: "x'; DROP TABLE users;--", name: 'n' }, token: owner.token });
    assert.strictEqual(weird.status, 201);
    assert.ok(/^proj_[0-9a-f]+$/.test(weird.json.project.id), 'id แปลกต้องถูกแทนที่ด้วย id ที่ออกให้');
    assert.ok(db.prepare(`SELECT 1 FROM users LIMIT 1`).get(), 'ตาราง users ต้องยังอยู่');
  });

  await test('แชร์: ต้องล็อกอิน, flow ผิดโครงสร้าง = 400, ข้อมูลที่ได้กลับมาผ่านการทำความสะอาดแล้ว', async () => {
    const flow = LEVELS.find(l => l.id === 9).template;
    assert.strictEqual((await call('POST', '/api/share', { body: { type: 'project', title: 't', data: flow } })).status, 401);
    assert.strictEqual((await call('POST', '/api/share', { body: { type: 'project', title: 't', data: { nodes: [{ id: 1, type: 'evil', config: {} }], connections: [] } }, token: owner.token })).status, 400);
    const longCfg = JSON.parse(JSON.stringify(flow));
    longCfg.nodes[0].config.formName = 'x'.repeat(5000);
    longCfg.nodes[0].extraField = '<script>alert(1)</script>';
    const made = await call('POST', '/api/share', { body: { type: 'project', title: '<img src=x onerror=alert(1)>', data: longCfg }, token: owner.token });
    assert.strictEqual(made.status, 201);
    const got = await call('GET', `/api/share/${made.json.code}`);
    assert.ok(!/[<>"'`]/.test(got.json.title), 'ชื่อที่แชร์ต้องไม่มีอักขระเปิดแท็ก');
    assert.strictEqual(got.json.data.nodes[0].config.formName.length, 1000);
    assert.ok(!('extraField' in got.json.data.nodes[0]), 'ฟิลด์แปลกปลอมต้องถูกตัดทิ้ง');
    const lvl = await call('POST', '/api/share', { body: { type: 'level', title: 'L', data: level({ badge: '<img src=x onerror=alert(1)>' }) }, token: owner.token });
    assert.ok(!/[<>"'`]/.test((await call('GET', `/api/share/${lvl.json.code}`)).json.data.badge));
  });

  await test('AI Coach proxy: ต้องล็อกอิน (401) และจำกัด 10 ครั้ง/นาที/ผู้ใช้ (429)', async () => {
    process.env.COACH_URL = 'http://127.0.0.1:9/never'; // ไม่เรียกของจริง
    assert.strictEqual((await call('POST', '/api/coach', { body: { level_id: 1 } })).status, 401);
    let statuses = [];
    for (let i = 0; i < 11; i++) statuses.push((await call('POST', '/api/coach', { body: { level_id: 1 }, token: other.token })).status);
    assert.strictEqual(statuses[10], 429, statuses.join(','));
    assert.ok(statuses.slice(0, 10).every(s => s !== 429 && s !== 401));
  });

  await test('ปิดการสร้างบัญชีตัวอย่างได้ด้วย SEED_DEMO_USERS=0 (หรือ NODE_ENV=production)', async () => {
    process.env.SEED_DEMO_USERS = '0';
    const clean = initDb(path.join(tmpDir, 'noseed.db'));
    assert.strictEqual(clean.prepare(`SELECT COUNT(*) AS n FROM users`).get().n, 0);
    delete process.env.SEED_DEMO_USERS;
    process.env.NODE_ENV = 'production';
    const prod = initDb(path.join(tmpDir, 'prod.db'));
    assert.strictEqual(prod.prepare(`SELECT COUNT(*) AS n FROM users`).get().n, 0);
    delete process.env.NODE_ENV;
  });

  server.close();
  console.log(failed ? `\n${failed} test(s) failed` : '\n✅ All Phase 5b security tests passed!');
  process.exit(failed ? 1 : 0);
})();

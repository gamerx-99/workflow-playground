// ทดสอบ migration + RLS บน Postgres จริง (PGlite — Postgres ที่รันในโปรเซส ไม่ต้องมี Docker/Supabase CLI)
// ใช้ตัวแทนของ schema `auth` และ role ของ Supabase (anon / authenticated / service_role) เพื่อให้ RLS ทำงานจริง
//
// ติดตั้งครั้งแรก (แพ็กเกจนี้ใช้เฉพาะตอนทดสอบ ไม่เข้าไปในแอป):
//   cd supabase/tests && npm install
// รัน:
//   node supabase/tests/rls.test.js
const assert = require('node:assert');
const path = require('node:path');
const { makeDb, signUp, as, attempt } = require('./harness.js');

const MIGRATIONS = [
  path.join(__dirname, '..', 'migrations', '20261021_init_schema.sql'),
  path.join(__dirname, '..', 'migrations', '20261022000000_fix_auth_rls.sql')
];

let failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.message}`); }
}

(async () => {
  console.log('--- Supabase RLS / Auth migration tests (real Postgres via PGlite) ---');
  const db = await makeDb(MIGRATIONS);
  const q = (sql, params) => db.query(sql, params);

  const alice = { id: await signUp(db, { email: 'alice@x.test', meta: { username: 'alice', display_name: 'Alice' } }) };
  const bob = { id: await signUp(db, { email: 'bob@x.test', meta: { username: 'bob' } }) };
  const guest = { id: await signUp(db, { email: null, anonymous: true }), anonymous: true };
  const teacherSeed = { id: await signUp(db, { email: 'teach@x.test', meta: { username: 'teach' } }) };
  await q(`update public.profiles set role = 'teacher' where id = $1`, [teacherSeed.id]); // ตั้งด้วยมือ (เหมือน SQL ของผู้ดูแล)

  await test('สมัครพร้อม role=teacher ใน metadata ก็ได้เป็น student เท่านั้น', async () => {
    const id = await signUp(db, { email: 'mallory@x.test', meta: { username: 'mallory', role: 'teacher' } });
    assert.strictEqual((await q(`select role from public.profiles where id = $1`, [id])).rows[0].role, 'student');
  });

  await test('username ถูกล้างอักขระแปลก/จำกัดความยาว และชื่อซ้ำไม่ทำให้สมัครล้ม (ต่อท้ายตัวสุ่ม)', async () => {
    const a = await signUp(db, { email: 'd1@x.test', meta: { username: '<img src=x>Dup User!!' } });
    const b = await signUp(db, { email: 'd2@x.test', meta: { username: '<img src=x>Dup User!!' } });
    const names = (await q(`select username from public.profiles where id in ($1, $2) order by created_at, username`, [a, b])).rows.map(r => r.username);
    names.forEach(n => assert.ok(/^[a-z0-9_.-]+$/.test(n) && n.length <= 32, n));
    assert.notStrictEqual(names[0], names[1]);
    const long = await signUp(db, { email: 'long@x.test', meta: { username: 'x'.repeat(200), display_name: 'ย'.repeat(200) } });
    const p = (await q(`select username, display_name from public.profiles where id = $1`, [long])).rows[0];
    assert.ok(p.username.length <= 32 && p.display_name.length <= 60);
  });

  await test('ผู้ใช้ anonymous ได้โปรไฟล์ชื่อ guest_… และเป็น student', async () => {
    const p = (await q(`select username, role from public.profiles where id = $1`, [guest.id])).rows[0];
    assert.ok(p.username.startsWith('guest_') && p.role === 'student');
  });

  await test('อ่าน profiles/progress/custom_levels ได้ปกติ (ไม่เกิด infinite recursion เหมือนไฟล์เดิม)', async () => {
    for (const t of ['profiles', 'progress', 'custom_levels']) {
      const r = await as(db, alice, () => attempt(() => q(`select * from public.${t}`)));
      assert.ok(r.ok, `${t}: ${r.error}`);
    }
  });

  await test('นักเรียนเห็นแต่โปรไฟล์ตัวเอง, ผู้สอนเห็นทั้งหมด, anon ไม่เห็นเลย (และไม่ error)', async () => {
    assert.deepStrictEqual((await as(db, alice, () => q(`select id from public.profiles`))).rows.map(r => r.id), [alice.id]);
    assert.ok((await as(db, teacherSeed, () => q(`select id from public.profiles`))).rows.length >= 4);
    const anon = await as(db, null, () => attempt(() => q(`select id from public.profiles`)));
    assert.ok(!anon.ok, 'anon ไม่ควรมีสิทธิ์อ่านตาราง profiles เลย');
  });

  await test('นักเรียนแก้ role/username ของตัวเองไม่ได้ (สิทธิ์ระดับคอลัมน์) แต่แก้ display_name ได้', async () => {
    const role = await as(db, alice, () => attempt(() => q(`update public.profiles set role = 'teacher' where id = $1`, [alice.id])));
    assert.ok(!role.ok, 'แก้ role ได้!');
    const uname = await as(db, alice, () => attempt(() => q(`update public.profiles set username = 'boss' where id = $1`, [alice.id])));
    assert.ok(!uname.ok, 'แก้ username ได้!');
    const ok = await as(db, alice, () => attempt(() => q(`update public.profiles set display_name = 'Alice Wonder' where id = $1 returning display_name`, [alice.id])));
    assert.ok(ok.ok && ok.value.rows[0].display_name === 'Alice Wonder');
    const other = await as(db, alice, () => q(`update public.profiles set display_name = 'hacked' where id = $1 returning id`, [bob.id]));
    assert.strictEqual(other.rows.length, 0, 'แก้โปรไฟล์คนอื่นได้!');
    const ins = await as(db, alice, () => attempt(() => q(`insert into public.profiles (id, username, role) values (gen_random_uuid(), 'fake', 'teacher')`)));
    assert.ok(!ins.ok, 'insert โปรไฟล์เองได้!');
  });

  await test('claim_teacher: ยังไม่ตั้งรหัส = false เสมอ, รหัสผิด = false, รหัสถูก = เป็นผู้สอน', async () => {
    assert.strictEqual((await as(db, alice, () => q(`select public.claim_teacher('anything') as ok`))).rows[0].ok, false);
    await q(`insert into private.app_config (key, value) values ('teacher_signup_code', 'classroom-123')`);
    assert.strictEqual((await as(db, alice, () => q(`select public.claim_teacher('wrong') as ok`))).rows[0].ok, false);
    assert.strictEqual((await q(`select role from public.profiles where id = $1`, [alice.id])).rows[0].role, 'student');
    assert.strictEqual((await as(db, bob, () => q(`select public.claim_teacher('classroom-123') as ok`))).rows[0].ok, true);
    assert.strictEqual((await q(`select role from public.profiles where id = $1`, [bob.id])).rows[0].role, 'teacher');
  });

  await test('claim_teacher: เดารหัสผิดเกิน 5 ครั้งถูกบล็อก (แม้ครั้งที่ 6 จะใส่รหัสถูก), anonymous เรียกไม่ได้, anon (ไม่ล็อกอิน) เรียกไม่ได้', async () => {
    const eve = { id: await signUp(db, { email: 'eve@x.test', meta: { username: 'eve' } }) };
    for (let i = 0; i < 5; i++) await as(db, eve, () => q(`select public.claim_teacher('guess${i}')`));
    const blocked = await as(db, eve, () => attempt(() => q(`select public.claim_teacher('classroom-123')`)));
    assert.ok(!blocked.ok && /รอ 15 นาที/.test(blocked.error), blocked.error);
    assert.strictEqual((await q(`select role from public.profiles where id = $1`, [eve.id])).rows[0].role, 'student');
    assert.ok(!(await as(db, guest, () => attempt(() => q(`select public.claim_teacher('classroom-123')`)))).ok);
    assert.ok(!(await as(db, null, () => attempt(() => q(`select public.claim_teacher('classroom-123')`)))).ok);
  });

  await test('private.app_config / ตารางเฉลย client อ่านไม่ได้', async () => {
    assert.ok(!(await as(db, alice, () => attempt(() => q(`select * from private.app_config`)))).ok);
    await q(`insert into public.level_solutions (level_id, template_json) values (1, '{"nodes":[]}')`);
    assert.ok(!(await as(db, alice, () => attempt(() => q(`select * from public.level_solutions`)))).ok);
    assert.ok(!(await as(db, null, () => attempt(() => q(`select * from public.level_solutions`)))).ok);
  });

  await test('progress: เขียน/อ่านของตัวเองได้, ของคนอื่นไม่ได้, ค่าเกินเหตุผลถูกปฏิเสธ, ผู้สอนอ่านได้ทั้งหมด', async () => {
    const mine = `insert into public.progress (user_id, level_id, passed, score, total, attempts) values ($1, 1, true, 5, 5, 1)`;
    assert.ok((await as(db, alice, () => attempt(() => q(mine, [alice.id])))).ok);
    assert.ok(!(await as(db, alice, () => attempt(() => q(mine.replace('1, true', '2, true'), [bob.id])))).ok, 'เขียน progress ให้คนอื่นได้!');
    assert.ok(!(await as(db, alice, () => attempt(() => q(`insert into public.progress (user_id, level_id, passed, score, total) values ($1, 3, true, 99, 5)`, [alice.id])))).ok, 'score > total ผ่านได้');
    assert.ok(!(await as(db, guest, () => attempt(() => q(`insert into public.progress (user_id, level_id, passed, score, total) values ($1, 1, true, 1, 1)`, [guest.id])))).ok, 'anonymous เขียน progress ได้');
    assert.strictEqual((await as(db, bob, () => q(`select user_id from public.progress where user_id <> $1`, [bob.id]))).rows.length, 1, 'bob (ผู้สอนแล้ว) ต้องเห็นของ alice');
    const eve = (await q(`select id from public.profiles where username = 'eve'`)).rows[0];
    assert.strictEqual((await as(db, { id: eve.id }, () => q(`select * from public.progress`))).rows.length, 0, 'นักเรียนอื่นเห็น progress ของคนอื่น');
    await as(db, alice, () => q(`update public.progress set attempts = 2 where user_id = $1 and level_id = 1`, [alice.id]));
    assert.strictEqual((await as(db, bob, () => q(`update public.progress set attempts = 99 where user_id = $1 returning 1`, [alice.id]))).rows.length, 0, 'ผู้สอนแก้ progress นักเรียนได้ (ไม่ควร — ผู้สอนอ่านอย่างเดียว)');
  });

  await test('flows/projects: แยกเฉพาะเจ้าของ, anon เข้าไม่ได้', async () => {
    await as(db, alice, () => q(`insert into public.flows (user_id, level_id, flow_json) values ($1, 1, '{"nodes":[]}')`, [alice.id]));
    await as(db, alice, () => q(`insert into public.projects (id, user_id, name, flow_json) values ('p1', $1, 'A', '{}')`, [alice.id]));
    const eve = (await q(`select id from public.profiles where username = 'eve'`)).rows[0];
    assert.strictEqual((await as(db, { id: eve.id }, () => q(`select * from public.flows`))).rows.length, 0);
    assert.strictEqual((await as(db, { id: eve.id }, () => q(`select * from public.projects`))).rows.length, 0);
    assert.strictEqual((await as(db, { id: eve.id }, () => q(`delete from public.projects where id = 'p1' returning id`))).rows.length, 0, 'ลบโปรเจกต์คนอื่นได้!');
    assert.ok(!(await as(db, null, () => attempt(() => q(`select * from public.flows`)))).ok);
  });

  await test('custom_levels: เจ้าของอ่าน/แก้/ลบได้, คนอื่นและ anon เห็น/แก้/ลบไม่ได้ (เฉลยไม่รั่ว), ผู้สอนอ่านและจัดการได้, id/ขนาดถูกตรวจ', async () => {
    const lvl = (id, title = 'ด่านของ alice') => q(`insert into public.custom_levels (id, user_id, title, level_json) values ($1, $2, $3, '{"template":{"nodes":[]}}')`, [id, alice.id, title]);
    assert.ok((await as(db, alice, () => attempt(() => lvl('custom_111')))).ok);
    const eve = (await q(`select id from public.profiles where username = 'eve'`)).rows[0];
    assert.strictEqual((await as(db, { id: eve.id }, () => q(`select * from public.custom_levels`))).rows.length, 0, 'คนอื่นอ่านด่านพร้อมเฉลยได้');
    assert.strictEqual((await as(db, { id: eve.id }, () => q(`update public.custom_levels set title = 'HIJACK' where id = 'custom_111' returning id`))).rows.length, 0);
    assert.strictEqual((await as(db, { id: eve.id }, () => q(`delete from public.custom_levels where id = 'custom_111' returning id`))).rows.length, 0);
    const steal = await as(db, { id: eve.id }, () => attempt(() => q(`insert into public.custom_levels (id, user_id, title, level_json) values ('custom_111', $1, 'steal', '{}') on conflict (id) do update set title = 'steal', user_id = $1`, [eve.id])));
    assert.ok(!steal.ok, 'upsert ทับด่านคนอื่นได้');
    assert.strictEqual((await q(`select title from public.custom_levels where id = 'custom_111'`)).rows[0].title, 'ด่านของ alice');
    assert.ok((await as(db, teacherSeed, () => q(`select * from public.custom_levels`))).rows.length >= 1, 'ผู้สอนอ่านไม่ได้');
    assert.ok(!(await as(db, guest, () => attempt(() => lvl('custom_222')))).ok, 'anonymous สร้างด่านได้');
    assert.ok(!(await as(db, alice, () => attempt(() => lvl('1')))).ok, 'id ที่ไม่ใช่ custom_<เลข> ผ่านได้ (ชนกับด่านระบบ)');
    assert.ok(!(await as(db, null, () => attempt(() => q(`select * from public.custom_levels`)))).ok);
  });

  await test('shares: ไม่เปิดให้ list, ดูทีละรหัสผ่าน get_share ได้ (แม้ไม่ล็อกอิน), รหัสถูกออกโดยฐานข้อมูล, ต้องล็อกอินจริงถึงสร้างได้', async () => {
    const made = await as(db, alice, () => q(`insert into public.shares (code, user_id, type, title, data_json) values ('AAAAAA', $1, 'project', 'แชร์', '{"nodes":[]}') returning code`, [alice.id]));
    const code = made.rows[0].code;
    assert.notStrictEqual(code, 'AAAAAA', 'ใช้รหัสที่ client ส่งมา');
    assert.ok(/^[0-9A-F]{10}$/.test(code), code);
    const eve = (await q(`select id from public.profiles where username = 'eve'`)).rows[0];
    assert.strictEqual((await as(db, { id: eve.id }, () => q(`select * from public.shares`))).rows.length, 0, 'นักเรียนอื่น list shares ได้');
    assert.ok(!(await as(db, null, () => attempt(() => q(`select * from public.shares`)))).ok, 'anon list shares ได้');
    const viaRpc = await as(db, null, () => q(`select * from public.get_share($1)`, [code.toLowerCase()]));
    assert.strictEqual(viaRpc.rows.length, 1);
    assert.strictEqual(viaRpc.rows[0].title, 'แชร์');
    assert.strictEqual(viaRpc.rows[0].author, 'Alice Wonder');
    assert.strictEqual((await as(db, null, () => q(`select * from public.get_share('NOPE')`))).rows.length, 0);
    assert.ok(!(await as(db, guest, () => attempt(() => q(`insert into public.shares (user_id, type, title, data_json) values ($1, 'project', 't', '{}')`, [guest.id])))).ok, 'anonymous สร้างลิงก์แชร์ได้');
    assert.ok(!(await as(db, alice, () => attempt(() => q(`insert into public.shares (user_id, type, title, data_json) values ($1, 'evil-type', 't', '{}')`, [alice.id])))).ok, 'type แปลกผ่านได้');
    assert.ok(!(await as(db, alice, () => attempt(() => q(`insert into public.shares (user_id, type, title, data_json) values ($1, 'project', $2, '{}')`, [bob.id, 'x'])))).ok, 'สร้างแชร์แทนคนอื่นได้');
  });

  await test('migration รันซ้ำได้ (idempotent) และ service_role ยังข้าม RLS ได้ตามปกติ', async () => {
    const fix = require('node:fs').readFileSync(MIGRATIONS[1], 'utf8');
    await db.exec(fix);
    await db.exec(fix);
    await db.exec(`set role service_role`);
    const n = (await q(`select count(*)::int as n from public.profiles`)).rows[0].n;
    await db.exec(`reset role`);
    assert.ok(n >= 6);
  });

  console.log(failed ? `\n${failed} test(s) failed` : '\n✅ All Supabase RLS tests passed!');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('HARNESS FAILED', e); process.exit(1); });

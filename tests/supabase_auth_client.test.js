// รัน: node tests/supabase_auth_client.test.js
// ทดสอบตรรกะล็อกอินฝั่งหน้าเว็บ (frontend/js/api/supabase.js) ด้วย Supabase client จำลอง — ไม่ต่อเครือข่าย ไม่สร้างบัญชีจริง
// ตรวจ: อีเมลจริง + ยืนยันอีเมล + ลืมรหัสผ่าน + ส่งอีเมลยืนยันซ้ำ + ข้อความผิดพลาดภาษาไทย + ไม่เชื่อ role จากฝั่งผู้ใช้
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SOURCE_PATH = path.join(__dirname, '..', 'frontend', 'js', 'api', 'supabase.js');
const SOURCE = fs.readFileSync(SOURCE_PATH, 'utf8');

let failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.stack.split('\n').slice(0, 3).join('\n       ')}`); }
}

// สร้าง SupabaseApi ใหม่ทุกเทสต์ พร้อม client จำลองที่บันทึกการเรียกไว้
function load(overrides = {}) {
  const calls = [];
  const listeners = [];
  const events = [];
  const store = new Map();
  const ok = (data = {}) => ({ data, error: null });

  const auth = {
    signUp: async (a) => { calls.push(['signUp', a]); return overrides.signUp || ok({ user: { id: 'u1', identities: [{ id: 'i' }] }, session: null }); },
    signInWithPassword: async (a) => { calls.push(['signInWithPassword', a]); return overrides.signIn || ok({ user: { id: 'u1' }, session: { access_token: 't' } }); },
    resend: async (a) => { calls.push(['resend', a]); return overrides.resend || ok(); },
    resetPasswordForEmail: async (e, o) => { calls.push(['resetPasswordForEmail', e, o]); return overrides.reset || ok(); },
    updateUser: async (a) => { calls.push(['updateUser', a]); return overrides.update || ok({ user: { id: 'u1' } }); },
    getUser: async () => { calls.push(['getUser']); return overrides.getUser || ok({ user: null }); },
    signOut: async () => { calls.push(['signOut']); return ok(); },
    onAuthStateChange: (cb) => { listeners.push(cb); return { data: { subscription: { unsubscribe() {} } } }; }
    // ตั้งใจไม่มี signInAnonymously — ถ้าโค้ดเรียกจะพังทันที
  };
  const client = {
    auth,
    rpc: async (fn, args) => { calls.push(['rpc', fn, args]); return overrides.rpc || { data: false, error: null }; },
    from: (table) => { calls.push(['from', table]); return {
      select: () => ({ eq: () => ({ single: async () => (overrides.profile ? ok(overrides.profile) : { data: null, error: { message: 'x' } }) }) })
    }; }
  };

  const window = {
    SUPABASE_CONFIG: { url: 'https://x.supabase.co', anonKey: 'sb_publishable_test' },
    supabase: { createClient: () => client },
    location: { origin: 'https://lab.example.com', pathname: '/frontend/index.html' },
    dispatchEvent: (e) => { events.push(e); }
  };
  const ctx = vm.createContext({
    window,
    console,
    CustomEvent: class { constructor(type) { this.type = type; } },
    readStore: (k, f) => (store.has(k) ? store.get(k) : f),
    writeStore: (k, v) => store.set(k, v)
  });
  vm.runInContext(`${SOURCE}\n;globalThis.__api = SupabaseApi; globalThis.__errors = SUPABASE_AUTH_ERRORS; globalThis.__min = SUPABASE_MIN_PASSWORD;`, ctx);
  return { api: ctx.__api, calls, listeners, events, store, errors: ctx.__errors, minPassword: ctx.__min };
}

const plain = (x) => JSON.parse(JSON.stringify(x));
const rejects = async (promise) => { try { await promise; } catch (e) { return e; } throw new Error('คาดว่าจะ reject แต่สำเร็จ'); };
const thai = (s) => /[฀-๿]/.test(s);

(async () => {
  console.log('--- Supabase auth client (อีเมลจริง + ยืนยันอีเมล) ---');

  await test('normalizeEmail: ตัดช่องว่าง/ตัวพิมพ์ใหญ่ และปฏิเสธรูปแบบที่ไม่ใช่อีเมล (รวมชื่อผู้ใช้เปล่าๆ)', async () => {
    const { api } = load();
    assert.strictEqual(api.normalizeEmail('  Alice@Example.COM '), 'alice@example.com');
    for (const bad of ['alice', 'alice@', '@x.com', 'a b@x.com', 'a@b', '', null, undefined, 'a@b.c', `${'x'.repeat(250)}@x.com`]) {
      const e = await rejects(Promise.resolve().then(() => api.normalizeEmail(bad)));
      assert.strictEqual(e.code, 'email_address_invalid', String(bad));
      assert.ok(thai(e.message));
    }
  });

  await test('สมัคร: ส่งอีเมลจริง + redirect กลับหน้านี้ + metadata ไม่มี role, ผลคือ "รอยืนยันอีเมล" (ยังไม่ล็อกอิน)', async () => {
    const { api, calls } = load();
    const res = await api.register('Alice@Example.com', 'password123', 'Alice');
    const [, arg] = calls.find(c => c[0] === 'signUp');
    assert.strictEqual(arg.email, 'alice@example.com');
    assert.strictEqual(arg.options.emailRedirectTo, 'https://lab.example.com/frontend/index.html');
    assert.deepStrictEqual(plain(Object.keys(arg.options.data).sort()), ['display_name', 'username']);
    assert.ok(!JSON.stringify(arg).includes('role') && !JSON.stringify(arg).includes('teacher'));
    assert.deepStrictEqual(plain([res.needsConfirmation, res.email, res.user, res.session]), [true, 'alice@example.com', null, null]);
    assert.strictEqual(api.getCurrentUser(), null, 'ยังไม่ควรถือว่าล็อกอิน');
  });

  await test('สมัคร: รหัสผ่านสั้นกว่าขั้นต่ำหรืออีเมลผิดรูปแบบ ถูกปฏิเสธก่อนยิงไป Supabase', async () => {
    const { api, calls, minPassword } = load();
    assert.ok(minPassword >= 8);
    assert.strictEqual((await rejects(api.register('a@example.com', 'short', 'A'))).code, 'weak_password');
    assert.strictEqual((await rejects(api.register('not-an-email', 'password123', 'A'))).code, 'email_address_invalid');
    assert.ok(!calls.some(c => c[0] === 'signUp'));
  });

  await test('สมัครซ้ำด้วยอีเมลที่มีบัญชีแล้ว (identities ว่าง) ตอบเหมือนสมัครใหม่ — ไม่บอกว่าอีเมลไหนมีบัญชีอยู่', async () => {
    const fresh = load();
    const dup = load({ signUp: { data: { user: { id: 'u2', identities: [] }, session: null }, error: null } });
    const a = await fresh.api.register('new@example.com', 'password123', 'N');
    const b = await dup.api.register('new@example.com', 'password123', 'N');
    assert.deepStrictEqual(plain(a), plain(b));
  });

  await test('สมัคร: โปรเจกต์ปิด Confirm email (ได้ session ทันที) = ล็อกอินเลยและโหลดผู้ใช้จากฐานข้อมูล', async () => {
    const { api } = load({
      signUp: { data: { user: { id: 'u1' }, session: { access_token: 't' } }, error: null },
      getUser: { data: { user: { id: 'u1', email: 'a@example.com', user_metadata: {} } }, error: null },
      profile: { username: 'a', display_name: 'A', role: 'student' }
    });
    const res = await api.register('a@example.com', 'password123', 'A');
    assert.strictEqual(res.needsConfirmation, false);
    assert.strictEqual(res.user.email, 'a@example.com');
  });

  await test('ข้อความผิดพลาดเป็นภาษาไทยตามรหัส และเก็บ code ไว้; ข้อความภาษาอังกฤษดิบ/รายละเอียดภายในไม่หลุดถึงผู้ใช้', async () => {
    const cases = {
      invalid_credentials: /ไม่ถูกต้อง/, email_not_confirmed: /ยืนยันอีเมล/, over_email_send_rate_limit: /ถี่เกินไป/, user_already_exists: /สมัครไว้แล้ว/, weak_password: /ง่ายเกินไป/
    };
    for (const [code, re] of Object.entries(cases)) {
      const { api } = load({ signIn: { data: null, error: { code, message: 'Internal: relation auth.users failed at 10.0.0.5' } } });
      const e = await rejects(api.login('a@example.com', 'whatever123'));
      assert.strictEqual(e.code, code);
      assert.ok(re.test(e.message), `${code}: ${e.message}`);
      assert.ok(!/Internal|auth\.users|10\.0\.0\.5/.test(e.message), 'ข้อความภายในหลุดถึงผู้ใช้');
    }
    const { api } = load({ signIn: { data: null, error: { code: 'something_new', message: 'English raw message' } } });
    const e = await rejects(api.login('a@example.com', 'x'));
    assert.ok(thai(e.message) && !/English raw/.test(e.message));
    assert.strictEqual(e.code, 'something_new');
  });

  await test('ล็อกอิน: ใช้อีเมลจริง ไม่แปลงชื่อผู้ใช้เป็นอีเมลปลอม และไม่เชื่อ role จาก metadata ของผู้ใช้', async () => {
    const { api, calls } = load({
      getUser: { data: { user: { id: 'u1', email: 'a@example.com', user_metadata: { role: 'teacher' } } }, error: null }
      // ไม่มี profile (ดึงไม่สำเร็จ) -> ต้องเป็น student ไม่ใช่ teacher ตาม metadata
    });
    await rejects(api.login('alice', 'password123'));
    assert.ok(!calls.some(c => c[0] === 'signInWithPassword'), 'ยิงล็อกอินด้วยชื่อผู้ใช้เปล่าๆ');
    const res = await api.login('A@Example.com', 'password123');
    assert.strictEqual(calls.find(c => c[0] === 'signInWithPassword')[1].email, 'a@example.com');
    assert.strictEqual(res.user.role, 'student');
  });

  await test('บทบาทมาจากตาราง profiles เท่านั้น (teacher/admin ได้ ค่าอื่นเป็น student)', async () => {
    for (const [dbRole, expected] of [['teacher', 'teacher'], ['admin', 'admin'], ['student', 'student'], ['superuser', 'student'], [null, 'student']]) {
      const { api } = load({
        getUser: { data: { user: { id: 'u1', email: 'a@example.com', user_metadata: {} } }, error: null },
        profile: { username: 'a', display_name: 'A', role: dbRole }
      });
      assert.strictEqual((await api.getMe()).role, expected, String(dbRole));
    }
  });

  await test('getMe: ยังไม่ล็อกอิน/เป็นบัญชี anonymous = ไม่มีผู้ใช้ และไม่สร้างบัญชี anonymous อัตโนมัติ', async () => {
    const out = load();
    assert.strictEqual(await out.api.getMe(), null);
    const anon = load({ getUser: { data: { user: { id: 'g', is_anonymous: true } }, error: null } });
    assert.strictEqual(await anon.api.getMe(), null);
    assert.strictEqual(anon.api.getCurrentUser(), null);
    assert.ok(!SOURCE.includes('signInAnonymously'));
  });

  await test('ส่งอีเมลยืนยันอีกครั้ง: เรียก resend แบบ signup พร้อม redirect และตรวจอีเมลก่อน', async () => {
    const { api, calls } = load();
    await api.resendConfirmation(' A@Example.com ');
    assert.deepStrictEqual(plain(calls.find(c => c[0] === 'resend')[1]), { type: 'signup', email: 'a@example.com', options: { emailRedirectTo: 'https://lab.example.com/frontend/index.html' } });
    assert.strictEqual((await rejects(api.resendConfirmation('nope'))).code, 'email_address_invalid');
  });

  await test('ลืมรหัสผ่าน: ขอลิงก์ทางอีเมล (ผลเหมือนกันไม่ว่ามีบัญชีหรือไม่) และแปลงข้อผิดพลาดเรื่องส่งถี่', async () => {
    const { api, calls } = load();
    const res = await api.requestPasswordReset('A@Example.com');
    assert.deepStrictEqual(plain(calls.find(c => c[0] === 'resetPasswordForEmail').slice(1)), ['a@example.com', { redirectTo: 'https://lab.example.com/frontend/index.html' }]);
    assert.deepStrictEqual(plain(res), { ok: true, email: 'a@example.com' });
    const limited = load({ reset: { data: null, error: { code: 'over_email_send_rate_limit' } } });
    assert.match((await rejects(limited.api.requestPasswordReset('a@example.com'))).message, /ถี่เกินไป/);
  });

  await test('ตั้งรหัสผ่านใหม่: ต้องยาวพอ, เรียก updateUser, แปลงข้อผิดพลาด same_password', async () => {
    const { api, calls } = load();
    assert.strictEqual((await rejects(api.updatePassword('short'))).code, 'weak_password');
    assert.ok(!calls.some(c => c[0] === 'updateUser'));
    await api.updatePassword('a-long-new-password');
    assert.deepStrictEqual(plain(calls.find(c => c[0] === 'updateUser')[1]), { password: 'a-long-new-password' });
    const same = load({ update: { data: null, error: { code: 'same_password' } } });
    assert.match((await rejects(same.api.updatePassword('a-long-new-password'))).message, /ไม่ซ้ำ/);
  });

  await test('เหตุการณ์ PASSWORD_RECOVERY (กดลิงก์รีเซ็ตรหัสผ่านในอีเมล) ถูกส่งต่อให้หน้าจอเปิดฟอร์มตั้งรหัสใหม่; เหตุการณ์อื่นไม่ส่ง', async () => {
    const { api, listeners, events } = load();
    api.getClient();
    assert.strictEqual(listeners.length, 1);
    listeners[0]('SIGNED_IN', {});
    assert.strictEqual(events.length, 0);
    listeners[0]('PASSWORD_RECOVERY', {});
    assert.deepStrictEqual(plain(events.map(e => e.type)), ['supabase-password-recovery']);
  });

  await test('claimTeacher: ให้ฐานข้อมูลตรวจรหัส (rpc claim_teacher) — ไม่ตรวจในหน้าเว็บ', async () => {
    const { api, calls } = load({ rpc: { data: false, error: null } });
    assert.strictEqual(await api.claimTeacher('guess'), false);
    assert.deepStrictEqual(plain(calls.find(c => c[0] === 'rpc').slice(1)), ['claim_teacher', { code: 'guess' }]);
    const blocked = load({ rpc: { data: null, error: { message: 'raw', code: 'otp_expired' } } });
    assert.ok(thai((await rejects(blocked.api.claimTeacher('x'))).message));
  });


  await test('ยังไม่ล็อกอิน: ไม่ยิงอ่านตารางบนคลาวด์ (ด่านสร้างเอง) — ใช้ข้อมูลในเครื่องแทน', async () => {
    const { api, calls } = load();
    api.setCurrentUser(null);
    api.getClient();
    // LocalApi ไม่ถูกโหลดในเทสต์นี้ จึงจับว่ามีการพยายามเรียก LocalApi (ReferenceError) แต่ต้องไม่มี from(...) ถูกเรียกก่อน
    await api.getCustomLevels().catch(() => {});
    assert.ok(!calls.some(c => c[0] === 'from'), 'ไปอ่านตาราง custom_levels ทั้งที่ยังไม่ล็อกอิน');
  });
  await test('ซอร์สโค้ดไม่เหลือแพทเทิร์นอันตรายเดิม (อีเมลปลอม, รหัสผู้สอนในหน้าเว็บ, role จาก metadata, anonymous อัตโนมัติ)', async () => {
    for (const banned of ['workflow.lab', 'classroom-secret', 'meta.role', 'signInAnonymously', 'formatAuthEmail']) {
      assert.ok(!SOURCE.includes(banned), `ยังมี ${banned}`);
    }
  });

  console.log(failed ? `\n${failed} test(s) failed` : '\n✅ All Supabase auth client tests passed!');
  process.exit(failed ? 1 : 0);
})();

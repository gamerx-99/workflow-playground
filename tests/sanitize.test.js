// รัน: node tests/sanitize.test.js — ตรวจตัวทำความสะอาดด่านที่ผู้ใช้สร้าง/นำเข้า (กัน XSS และไฟล์ด่านที่พัง)
const assert = require('assert');
const { BLOCK_CATALOG } = require('../shared/blocks.js');
const { LEVELS, TRACKS } = require('../shared/levels.js');
const { checkFlow, deriveChecks, CHECK_RUNNERS } = require('../shared/checker.js');
const { sanitizeCustomLevel } = require('../shared/sanitize.js');

let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.message}`); }
}
const trackIds = TRACKS.map(t => t.id);
const san = raw => sanitizeCustomLevel(raw, BLOCK_CATALOG, trackIds, CHECK_RUNNERS);
const evil = '<img src=x onerror="alert(1)"> \'x\' `y`';
const base = () => JSON.parse(JSON.stringify({
  title: 'ด่านทดสอบ', desc: 'โจทย์', mode: 'build', difficulty: 2,
  template: LEVELS.find(l => l.id === 9).template
}));

console.log('XSS');
test('ข้อความทุกช่องที่ผู้ใช้ควบคุม ไม่มีอักขระ < > " \' ` หลงเหลือ', () => {
  const lvl = { ...base(), title: evil, shortName: evil, badge: evil, desc: evil, hint: evil, hints: [evil, evil, evil],
    checks: [{ type: 'block', block: 'trigger_form', label: evil }] };
  const out = san(lvl);
  const strings = [out.title, out.shortName, out.badge, out.desc, out.hint, ...out.hints, out.checks[0].label];
  strings.forEach(s => assert.ok(!/[<>"'`]/.test(s), `ยังมีอักขระอันตราย: ${s}`));
  assert.ok(out.title.includes('img src=x'), 'ข้อความควรยังอ่านได้');
});
test('ค่า config ของบล็อกถูกจำกัดความยาว และไม่รับ object/array ซ้อน', () => {
  const lvl = base();
  lvl.template.nodes[0].config = { formName: 'x'.repeat(5000), nested: { a: 1 }, list: [1] };
  const cfg = san(lvl).template.nodes[0].config;
  assert.strictEqual(cfg.formName.length, 1000);
  assert.ok(!('nested' in cfg) && !('list' in cfg));
});

console.log('ความถูกต้องของไฟล์ด่าน');
test('ด่านปกติผ่านและยังตรวจเฉลยของตัวเองผ่าน (ไม่ทำให้ด่านที่ถูกต้องพัง)', () => {
  const out = san(base());
  assert.ok(checkFlow({ ...out, checks: undefined }, out.template, BLOCK_CATALOG).passed);
  assert.ok(deriveChecks(out, BLOCK_CATALOG).length > 0);
});
test('id ที่ไม่ใช่รูป custom_<เลข> ถูกแทนที่ (กันทับด่านระบบ)', () => {
  assert.ok(/^custom_\d+$/.test(san({ ...base(), id: 1 }).id));
  assert.ok(/^custom_\d+$/.test(san({ ...base(), id: '__proto__' }).id));
  assert.strictEqual(san({ ...base(), id: 'custom_123' }).id, 'custom_123');
});
test('track ที่ไม่รู้จักกลายเป็น custom, mode ที่ไม่รู้จักกลายเป็น build, ความยากนอกช่วงกลายเป็น 1', () => {
  const out = san({ ...base(), track: 'hack', mode: 'predict', difficulty: 99 });
  assert.deepStrictEqual([out.track, out.mode, out.difficulty], ['custom', 'build', 1]);
});
test('ปฏิเสธ: ไม่ใช่ object / ไม่มี title / ไม่มี template', () => {
  assert.throws(() => san(null));
  assert.throws(() => san([]));
  assert.throws(() => san({ template: base().template }), /title/);
  assert.throws(() => san({ title: 'x' }), /template/);
});
test('ปฏิเสธ: ชนิดบล็อกที่ไม่มีในคลัง', () => {
  const lvl = base(); lvl.template.nodes[0].type = 'evil_block';
  assert.throws(() => san(lvl), /ไม่รู้จักชนิดบล็อก/);
});
test('ปฏิเสธ: id บล็อกซ้ำ, สายอ้างบล็อก/พอร์ตที่ไม่มี', () => {
  const dup = base(); dup.template.nodes[1].id = dup.template.nodes[0].id;
  assert.throws(() => san(dup), /ซ้ำ/);
  const ghost = base(); ghost.template.connections[0].toNode = 999;
  assert.throws(() => san(ghost), /ไม่มี/);
  const port = base(); port.template.connections[0].fromPort = 'nope';
  assert.throws(() => san(port), /พอร์ต/);
});
test('ปฏิเสธ: บล็อกมากเกินกำหนด / ไม่มีบล็อกเลย', () => {
  const many = base(); many.template.nodes = Array.from({ length: 61 }, (_, i) => ({ id: i, type: 'logic_delay', x: 0, y: 0, config: {} })); many.template.connections = [];
  assert.throws(() => san(many), /บล็อก/);
  const none = base(); none.template = { nodes: [], connections: [] };
  assert.throws(() => san(none), /บล็อก/);
});
test('โหมด fill/debug ต้องมี start และ start ถูกตรวจเหมือน template', () => {
  assert.throws(() => san({ ...base(), mode: 'fill' }), /start/);
  const ok = san({ ...base(), mode: 'fill', start: base().template });
  assert.strictEqual(ok.mode, 'fill');
  const bad = base(); bad.template.nodes[0].type = 'x';
  assert.throws(() => san({ ...base(), mode: 'debug', start: bad.template }));
});
test('checks: ชนิดที่ checker ไม่รู้จักทำให้ทิ้งทั้งชุด (ระบบสร้างจากเฉลยแทน), ชนิดที่รู้จักผ่านโดยตัดฟิลด์แปลกปลอม', () => {
  assert.strictEqual(san({ ...base(), checks: [{ type: 'eval', code: 'x' }] }).checks, undefined);
  const ok = san({ ...base(), checks: [{ type: 'block', block: 'trigger_form', min: 1, evil: '<script>' }] });
  assert.deepStrictEqual(ok.checks, [{ type: 'block', block: 'trigger_form', min: 1 }]);
});
test('ด่านระบบทั้ง 30 (ที่ไม่ใช่ predict) ส่งผ่าน sanitize ได้ และเฉลยยังผ่านการตรวจ', () => {
  LEVELS.filter(l => l.template && l.mode !== 'predict' && l.mode !== 'sandbox').forEach(l => {
    const out = san({ title: l.title, desc: l.desc, mode: l.start ? l.mode : 'build', start: l.start, template: l.template });
    assert.ok(checkFlow({ ...out, checks: undefined }, out.template, BLOCK_CATALOG).passed, `ด่าน ${l.id}`);
  });
});

console.log(failed ? `\n${failed} test(s) failed` : '\nall sanitize tests passed');
process.exit(failed ? 1 : 0);

// รัน: node tests/phase4_studio_custom_levels.test.js
// ตรวจสอบความถูกต้องของ Phase 4:
// 1. ระบบคำใบ้เปิดทีละขั้น (Progressive Hints 3 ขั้น)
// 2. การสร้างเกณฑ์ตรวจอัตโนมัติ (deriveChecks) สำหรับด่านสร้างเอง (Custom Level)
// 3. การตรวจสอบด่าน Custom ที่สร้างขึ้นว่าผ่านการตรวจ (Self-Check) 100%
// 4. โครงสร้างข้อมูล Studio Project และ Custom Level JSON
const assert = require('assert');
const { BLOCK_CATALOG } = require('../shared/blocks.js');
const { LEVELS, TRACKS } = require('../shared/levels.js');
const { checkFlow, deriveChecks } = require('../shared/checker.js');
const { getProgressiveHints } = require('../shared/hints.js');

let failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ok   ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL ${name}\n       ${e.message}`);
  }
}

console.log('--- Phase 4: Progressive Hints ---');

test('ทุกด่านในระบบ (30 ด่าน) ต้องสร้าง Progressive Hints ครบ 3 ขั้นตอน', () => {
  LEVELS.forEach(level => {
    const hints = getProgressiveHints(level, BLOCK_CATALOG);
    assert.strictEqual(hints.length, 3, `ด่าน ${level.id} คำใบ้ไม่ครบ 3 ขั้น`);
    hints.forEach(h => {
      assert.ok(h.step >= 1 && h.step <= 3, `ด่าน ${level.id} step เลขไม่ถูกต้อง: ${h.step}`);
      assert.ok(h.title && h.title.length > 0, `ด่าน ${level.id} ไม่มี title ใน step ${h.step}`);
      assert.ok(h.text && h.text.length > 0, `ด่าน ${level.id} text ว่างใน step ${h.step}`);
    });
  });
});

test('ด่านที่กำหนด hints array เอง ต้องใช้ค่านั้นตรงตามขั้น', () => {
  const customLevel = {
    id: 'test_hints',
    hints: ['ขั้นที่หนึ่งนะ', 'ขั้นที่สองนะ', 'ขั้นที่สามนะ']
  };
  const hints = getProgressiveHints(customLevel, BLOCK_CATALOG);
  assert.strictEqual(hints.length, 3);
  assert.strictEqual(hints[0].text, 'ขั้นที่หนึ่งนะ');
  assert.strictEqual(hints[1].text, 'ขั้นที่สองนะ');
  assert.strictEqual(hints[2].text, 'ขั้นที่สามนะ');
});

console.log('--- Phase 4: Studio Level Creator & deriveChecks ---');

test('สร้างด่านเอง (Custom Level) จาก Flow ใน Studio แล้ว deriveChecks ตรวจผ่าน 100%', () => {
  // จำลอง Flow ที่ผู้ใช้ออกแบบใน Studio: Form -> IF -> LINE & Sheets
  const studioFlow = {
    nodes: [
      { id: 1, type: 'trigger_form', config: { title: 'แบบฟอร์มสั่งซื้อ' }, x: 60, y: 60 },
      { id: 2, type: 'logic_if', config: { leftVar: '{{amount}}', operator: '>', rightValue: '1000' }, x: 390, y: 60 },
      { id: 3, type: 'action_line', config: { target: 'notify', messageTemplate: 'ออเดอร์ยอดสูง {{amount}} บาท จาก {{customer_name}}' }, x: 720, y: 30 },
      { id: 4, type: 'action_sheets', config: { sheetName: 'Orders', operation: 'appendRow' }, x: 720, y: 150 }
    ],
    connections: [
      { fromNode: 1, fromPort: 'out', toNode: 2, toPort: 'in' },
      { fromNode: 2, fromPort: 'true', toNode: 3, toPort: 'in' },
      { fromNode: 2, fromPort: 'false', toNode: 4, toPort: 'in' }
    ]
  };

  const customLevel = {
    id: 'custom_test_1',
    title: 'ทดสอบระบบสร้างด่าน Studio',
    shortName: 'ทดสอบ',
    difficulty: 2,
    mode: 'build',
    template: studioFlow
  };

  // สร้าง checks อัตโนมัติจาก template
  const checks = deriveChecks(customLevel, BLOCK_CATALOG);
  assert.ok(checks.length >= 5, `checks ต้องมีอย่างน้อย 5 ข้อ แต่ได้ ${checks.length}`);

  // ตรวจสอบชนิด checks ที่สร้าง
  const checkTypes = checks.map(c => c.type);
  assert.ok(checkTypes.includes('block'), 'ต้องมี check ชนิด block');
  assert.ok(checkTypes.includes('link'), 'ต้องมี check ชนิด link');
  assert.ok(checkTypes.includes('vars'), 'ต้องมี check ชนิด vars');
  assert.ok(checkTypes.includes('reachable'), 'ต้องมี check ชนิด reachable');
  assert.ok(checkTypes.includes('upstreamVars'), 'ต้องมี check ชนิด upstreamVars');

  // ตรวจคำตอบ (Zero-Trust verification on template)
  const result = checkFlow({ ...customLevel, checks }, studioFlow, BLOCK_CATALOG);
  assert.strictEqual(result.passed, true, 'Flow เฉลยต้องผ่านการตรวจ 100%');
  assert.strictEqual(result.score, result.total, 'คะแนนต้องเต็ม');

  // กระดานเปล่าต้องไม่ผ่าน
  const emptyResult = checkFlow({ ...customLevel, checks }, { nodes: [], connections: [] }, BLOCK_CATALOG);
  assert.strictEqual(emptyResult.passed, false, 'กระดานเปล่าต้องไม่ผ่าน');
});

test('โหมด fill ของ Custom Level ต้องเตรียม start flow โดยลบเฉพาะตัวแปรใน Action', () => {
  const template = {
    nodes: [
      { id: 1, type: 'trigger_chat', config: {}, x: 60, y: 60 },
      { id: 2, type: 'action_line', config: { target: 'notify', messageTemplate: 'สวัสดีคุณ {{user_name}} ได้รับข้อความ {{message_text}} แล้ว' }, x: 390, y: 60 }
    ],
    connections: [
      { fromNode: 1, fromPort: 'out', toNode: 2, toPort: 'in' }
    ]
  };

  const start = JSON.parse(JSON.stringify(template));
  start.nodes.forEach(n => {
    if (!n.type.startsWith('trigger_') && n.config) {
      Object.keys(n.config).forEach(k => {
        if (typeof n.config[k] === 'string' && n.config[k].includes('{{')) {
          n.config[k] = '';
        }
      });
    }
  });

  assert.strictEqual(start.nodes[1].config.messageTemplate, '', 'ช่อง messageTemplate ต้องถูกล้างสำหรับโหมด fill');
  
  const customLevel = {
    id: 'custom_fill_test',
    mode: 'fill',
    template,
    start
  };
  const checks = deriveChecks(customLevel, BLOCK_CATALOG);
  const startResult = checkFlow({ ...customLevel, checks }, start, BLOCK_CATALOG);
  assert.strictEqual(startResult.passed, false, 'โจทย์เริ่มต้นของ fill ต้องยังไม่ผ่านเพราะยังไม่ได้เติมตัวแปร');
});

console.log('--- Phase 4: Studio Project Serialization ---');

test('โครงสร้างข้อมูล Studio Project สามารถแปลงเป็น JSON และอ่านกลับมาได้อย่างถูกต้อง', () => {
  const project = {
    id: 'proj_12345',
    name: 'ระบบออเดอร์หน้าร้าน',
    updatedAt: Date.now(),
    flow: {
      nodes: [{ id: 1, type: 'trigger_webhook', config: {}, x: 100, y: 100 }],
      connections: [],
      nextNodeId: 2
    }
  };

  const jsonStr = JSON.stringify(project);
  const parsed = JSON.parse(jsonStr);
  assert.strictEqual(parsed.id, project.id);
  assert.strictEqual(parsed.name, project.name);
  assert.strictEqual(parsed.flow.nodes.length, 1);
  assert.strictEqual(parsed.flow.nodes[0].type, 'trigger_webhook');
});

if (failed > 0) {
  console.log(`\n❌ Failed tests: ${failed}`);
  process.exit(1);
} else {
  console.log('\n✅ All Phase 4 Studio and Custom Levels tests passed!');
}

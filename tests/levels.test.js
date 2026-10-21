// รัน: node tests/levels.test.js
// ตรวจว่าด่านทุกด่านสอดคล้องกัน: เฉลยต้องผ่าน, โจทย์เริ่มต้นต้องไม่ผ่าน, ตัวจำลองต้องให้ผลตามที่คาด
const assert = require('assert');
const { BLOCK_CATALOG } = require('../shared/blocks.js');
const { LEVELS, TRACKS } = require('../shared/levels.js');
const { checkFlow, checkPrediction, correctOptionIndex, levelHint } = require('../shared/checker.js');
const { simulateFlow, TRIGGER_SCENARIOS } = require('../shared/simulator.js');

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

const empty = { nodes: [], connections: [] };

console.log('structure');
const validTypes = new Set(BLOCK_CATALOG.map(b => b.type));
test('id ไม่ซ้ำ และทุกด่านอยู่ในสายพอดี 1 สาย', () => {
  const ids = LEVELS.map(l => l.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'มี id ซ้ำ');
  const inTracks = TRACKS.flatMap(t => t.levelIds);
  assert.strictEqual(new Set(inTracks).size, inTracks.length, 'มี id ซ้ำใน TRACKS');
  assert.deepStrictEqual([...inTracks].sort((a, b) => a - b), [...ids].sort((a, b) => a - b));
});
test(`มีทั้งหมด ${LEVELS.length} ด่าน (ต้อง >= 30) และทุกสายมีอย่างน้อย 5 ด่าน`, () => {
  assert.ok(LEVELS.length >= 30);
  TRACKS.forEach(t => assert.ok(t.levelIds.length >= 5, `สาย ${t.name} มี ${t.levelIds.length} ด่าน`));
});
test('ทุกด่านมีข้อมูลครบ (ชื่อ โจทย์ ความยาก 1-3 และเฉลยหรือคำถาม)', () => {
  LEVELS.forEach(l => {
    ['shortName', 'badge', 'title', 'desc'].forEach(k => assert.ok(l[k], `ด่าน ${l.id} ไม่มี ${k}`));
    assert.ok([1, 2, 3].includes(l.difficulty), `ด่าน ${l.id} difficulty ไม่ถูกต้อง`);
    assert.ok(l.template || (l.mode === 'predict' && l.questions && l.start), `ด่าน ${l.id} ไม่มี template/questions`);
  });
});
test('ทุกบล็อกในเฉลย/โจทย์เริ่มต้น เป็นชนิดที่มีอยู่จริง และเส้นเชื่อมอ้างบล็อก/พอร์ตที่มีจริง', () => {
  LEVELS.forEach(l => [l.template, l.start].filter(Boolean).forEach(flow => {
    const ids = new Set(flow.nodes.map(n => n.id));
    assert.strictEqual(ids.size, flow.nodes.length, `ด่าน ${l.id} มี id บล็อกซ้ำ`);
    flow.nodes.forEach(n => assert.ok(validTypes.has(n.type), `ด่าน ${l.id}: ไม่รู้จัก ${n.type}`));
    flow.connections.forEach(c => {
      assert.ok(ids.has(c.fromNode) && ids.has(c.toNode), `ด่าน ${l.id}: สายอ้างบล็อกที่ไม่มี`);
      const from = flow.nodes.find(n => n.id === c.fromNode);
      const def = BLOCK_CATALOG.find(b => b.type === from.type);
      assert.ok(def.outputs.some(o => o.id === c.fromPort), `ด่าน ${l.id}: บล็อก #${from.id} ไม่มีพอร์ต ${c.fromPort}`);
    });
  }));
});
test('ทุกด่านมีคำใบ้ (levelHint) ไม่ว่าง', () => {
  LEVELS.forEach(l => assert.ok(levelHint(l, BLOCK_CATALOG).length > 20, `ด่าน ${l.id}`));
});

console.log('levels');
LEVELS.forEach(level => {
  if (level.mode === 'predict') {
    test(`L${level.id} predict: ทุกข้อมีตัวเลือกที่ถูกต้องพอดี 1 ตัว`, () => {
      level.questions.forEach((q, i) => {
        const matches = q.options.filter(o => correctOptionIndex(level, { ...q, options: [o] }, BLOCK_CATALOG) === 0);
        assert.strictEqual(matches.length, 1, `ข้อ ${i + 1} มีตัวเลือกที่ถูก ${matches.length} ตัว`);
      });
    });
    test(`L${level.id} predict: ตอบถูกหมดผ่าน / ตอบผิดไม่ผ่าน`, () => {
      const right = level.questions.map(q => correctOptionIndex(level, q, BLOCK_CATALOG));
      assert.ok(checkPrediction(level, right, BLOCK_CATALOG).passed);
      assert.ok(!checkPrediction(level, [], BLOCK_CATALOG).passed);
    });
    return;
  }

  test(`L${level.id} เฉลย (template) ผ่านทุกข้อ`, () => {
    const r = checkFlow(level, level.template, BLOCK_CATALOG);
    const bad = r.items.filter(i => !i.ok).map(i => i.label);
    if (level.mode === 'sandbox') return; // sandbox: template เป็นแค่จุดเริ่ม ไม่ใช่เฉลย
    assert.ok(r.passed, `ไม่ผ่าน: ${bad.join(' | ')}`);
  });
  test(`L${level.id} กระดานเปล่าไม่ผ่าน`, () => {
    assert.ok(!checkFlow(level, empty, BLOCK_CATALOG).passed);
  });
  if (level.start) {
    test(`L${level.id} โจทย์เริ่มต้น (start) ยังไม่ผ่าน`, () => {
      assert.ok(!checkFlow(level, level.start, BLOCK_CATALOG).passed);
    });
  }
});

console.log('simulator vs level templates');
LEVELS.filter(l => l.template && l.mode !== 'sandbox').forEach(level => {
  test(`L${level.id} เฉลยรันจำลองแล้วไม่มีคำเตือนในขั้นตอนใดเลย (ทุกชุดข้อมูลตัวอย่าง)`, () => {
    const triggerTypes = [...new Set(level.template.nodes.filter(n => n.type.startsWith('trigger_')).map(n => n.type))];
    triggerTypes.forEach(type => {
      TRIGGER_SCENARIOS[type].forEach(s => {
        const r = simulateFlow(level.template, BLOCK_CATALOG, { scenarios: { [type]: s.id } });
        const warned = r.steps.filter(st => st.warnings.length).map(st => `#${st.nodeId}: ${st.warnings[0]}`);
        assert.deepStrictEqual(warned, [], `ชุด ${s.id}`);
        assert.ok(r.steps.length >= 2, 'ไม่ทำงานเลย');
      });
    });
  });
});

console.log('simulator');
const level2 = LEVELS.find(l => l.id === 2);
test('IF: amount 2500 ไปสาย VIP', () => {
  const r = simulateFlow(level2.template, BLOCK_CATALOG, { overrides: { amount: '2500' } });
  assert.deepStrictEqual(r.outcome, { sheets: ['รายชื่อลูกค้า VIP'], messages: ['vip_team'] });
});
test('IF: amount 300 ไปสายทั่วไป และไม่ส่ง LINE', () => {
  const r = simulateFlow(level2.template, BLOCK_CATALOG, { overrides: { amount: '300' } });
  assert.deepStrictEqual(r.outcome, { sheets: ['รายชื่อลูกค้าทั่วไป'], messages: [] });
});
test('ข้อความ LINE แทนค่าตัวแปรจริง', () => {
  const r = simulateFlow(level2.template, BLOCK_CATALOG, { overrides: { amount: '2500' } });
  assert.ok(r.messages[0].text.includes('สมชาย ใจดี') && r.messages[0].text.includes('2500'));
});
test('ใช้ตัวแปรที่ไม่มีใครส่งมา → เตือน', () => {
  const level7 = LEVELS.find(l => l.id === 7);
  const r = simulateFlow(level7.start, BLOCK_CATALOG);
  assert.ok(r.steps.some(s => s.warnings.length > 0));
  assert.ok(r.warnings.some(w => w.includes('#5')), 'ควรเตือนบล็อกที่ไม่ได้ทำงาน');
});
test('Switch: webhook cancel ไปสาย C (Telegram)', () => {
  const level6 = LEVELS.find(l => l.id === 6);
  const r = simulateFlow(level6.template, BLOCK_CATALOG, { scenarios: { trigger_webhook: 'cancel' } });
  assert.deepStrictEqual(r.outcome.messages, ['ห้องออเดอร์ยกเลิก']);
});
test('AI: Prompt ไม่มี message_text → เตือน', () => {
  const flow = {
    nodes: [
      { id: 1, type: 'trigger_chat', x: 0, y: 0, config: {} },
      { id: 2, type: 'ai_agent', x: 0, y: 0, config: { taskType: 'sentiment_triage', prompt: 'วิเคราะห์ข้อความลูกค้า' } }
    ],
    connections: [{ fromNode: 1, fromPort: 'out', toNode: 2, toPort: 'in' }]
  };
  const r = simulateFlow(flow, BLOCK_CATALOG);
  assert.ok(r.steps[1].warnings.length > 0);
});
test('AI + IF contains: ข้อความด่วนไปสาย true', () => {
  const level4 = LEVELS.find(l => l.id === 4);
  const r = simulateFlow(level4.template, BLOCK_CATALOG, { scenarios: { trigger_chat: 'urgent' } });
  assert.deepStrictEqual(r.outcome.messages, ['vip_team']);
});
test('Loop: วนครบทุกแถวแล้วออกสาย done', () => {
  const flow = {
    nodes: [
      { id: 1, type: 'trigger_schedule', x: 0, y: 0, config: {} },
      { id: 2, type: 'action_sheets', x: 0, y: 0, config: { operation: 'read_rows', sheetName: 'คิว', columns: '{{current_date}}' } },
      { id: 3, type: 'logic_loop', x: 0, y: 0, config: { sourceList: '{{sheet_rows}}' } },
      { id: 4, type: 'action_line', x: 0, y: 0, config: { target: 'admin_group', messageTemplate: '{{loop_item}}' } }
    ],
    connections: [
      { fromNode: 1, fromPort: 'out', toNode: 2, toPort: 'in' },
      { fromNode: 2, fromPort: 'out', toNode: 3, toPort: 'in' },
      { fromNode: 3, fromPort: 'each', toNode: 4, toPort: 'in' }
    ]
  };
  const r = simulateFlow(flow, BLOCK_CATALOG);
  assert.strictEqual(r.messages.length, 3);
});
test('ไม่มี Trigger → ok=false', () => {
  assert.strictEqual(simulateFlow(empty, BLOCK_CATALOG).ok, false);
});
test('สายวนเป็นวง ไม่ค้าง', () => {
  const flow = {
    nodes: [
      { id: 1, type: 'trigger_form', x: 0, y: 0, config: {} },
      { id: 2, type: 'logic_delay', x: 0, y: 0, config: {} },
      { id: 3, type: 'logic_delay', x: 0, y: 0, config: {} }
    ],
    connections: [
      { fromNode: 1, fromPort: 'out', toNode: 2, toPort: 'in' },
      { fromNode: 2, fromPort: 'out', toNode: 3, toPort: 'in' },
      { fromNode: 3, fromPort: 'out', toNode: 2, toPort: 'in' }
    ]
  };
  const r = simulateFlow(flow, BLOCK_CATALOG);
  assert.ok(r.steps.length <= 300 && r.warnings.some(w => w.includes('300')));
});

console.log(failed ? `\n${failed} test(s) failed` : '\nall tests passed');
process.exit(failed ? 1 : 0);

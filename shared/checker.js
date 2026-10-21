// ---------------------------------------------------------
// ระบบตรวจคำตอบ (Level Checker)
// ใช้ได้ทั้งฝั่งเบราว์เซอร์ และฝั่ง backend (Node) ในอนาคต — เป็น pure function ไม่แตะ DOM
//
// checkFlow(level, flow, catalog) → { passed, score, total, items: [{ ok, label, detail }] }
//   flow = { nodes: [...], connections: [...] }
//
// ชนิดของ check ที่รองรับ (ใส่ใน level.checks):
//   { type: 'block', block: 'action_line', min: 1 }          มีบล็อกชนิดนี้อย่างน้อย min ตัว ('trigger_*' = ชนิดใดก็ได้ที่ขึ้นต้นด้วย trigger_)
//   { type: 'link', from: 'logic_if', port: 'true', to: 'action_sheets' }   มีเส้นเชื่อมจากบล็อก A (พอร์ตที่ระบุ) ไปบล็อก B
//   { type: 'vars', block: 'action_line', field: 'messageTemplate', vars: ['{{amount}}'] }  ช่องนี้มีตัวแปรครบ
//   { type: 'value', block: 'logic_if', field: 'operator', oneOf: ['>=', '>'] }             ช่องนี้มีค่าตามที่กำหนด
//   { type: 'distinct', block: 'action_sheets', field: 'sheetName' }    บล็อกชนิดนี้ทุกตัวตั้งค่าช่องนี้ไม่ซ้ำกัน
//   { type: 'minBlocks', min: 3 }                                        มีบล็อกบนกระดานอย่างน้อย min ตัว
//   { type: 'reachable' }       ทุกบล็อกต่อสายมาจาก Trigger (ไม่มีบล็อกลอย)
//   { type: 'upstreamVars' }    ตัวแปรทุกตัวที่ใช้ ต้องมาจากบล็อกก่อนหน้าในสายเดียวกัน
// ทุก check ใส่ label เองได้ ถ้าไม่ใส่ระบบจะสร้างข้อความภาษาไทยให้อัตโนมัติ
// ---------------------------------------------------------

const VAR_PATTERN = /\{\{[a-zA-Z0-9_]+\}\}/g;

function checkFlow(level, flow, catalog) {
  const nodes = (flow && flow.nodes) || [];
  const connections = (flow && flow.connections) || [];
  const ctx = { nodes, connections, catalog };

  const checks = level.checks || deriveChecks(level, catalog);
  const items = checks.map(check => {
    const runner = CHECK_RUNNERS[check.type];
    if (!runner) return { ok: false, label: `ไม่รู้จักชนิดการตรวจ "${check.type}"`, detail: '' };
    const res = runner(check, ctx);
    return { ok: res.ok, label: check.label || res.label, detail: res.detail || '' };
  });

  const score = items.filter(i => i.ok).length;
  return { passed: items.length > 0 && score === items.length, score, total: items.length, items };
}

// ---------------------------------------------------------
// สร้าง checks อัตโนมัติจากเฉลย (level.template) — ใช้เมื่อด่านไม่ได้เขียน checks เอง
//   - ต้องมีบล็อกครบชนิด/จำนวนตามเฉลย
//   - ต้องต่อสายครบทุกคู่ชนิดบล็อก (และพอร์ต เมื่อบล็อกต้นทางมีหลายพอร์ต)
//   - ช่องข้อความที่เฉลยใช้ {{ตัวแปร}} ต้องมีตัวแปรเหล่านั้น (ถ้ามีบล็อกชนิดเดียวกันหลายตัว ต้องมีครบทุกตัว)
//   - ช่องที่เป็นตัวตัดสิน (operator / rightValue / operation) ต้องตรงเฉลย
//   - ชีตหลายตัวต้องตั้งชื่อไม่ซ้ำกัน
//   - level.extraChecks เพิ่มข้อตรวจเองได้ และมีกฎกลาง reachable + upstreamVars เสมอ
// ---------------------------------------------------------
const DECISIVE_FIELDS = { logic_if: ['operator', 'rightValue'], action_sheets: ['operation'] };

function deriveChecks(level, catalog) {
  const tpl = level.template;
  if (!tpl) return [];
  const checks = [];
  const byType = {};
  tpl.nodes.forEach(n => (byType[n.type] = byType[n.type] || []).push(n));

  Object.entries(byType).forEach(([type, list]) => checks.push({ type: 'block', block: type, min: list.length }));

  const seenLinks = new Set();
  tpl.connections.forEach(c => {
    const from = tpl.nodes.find(n => n.id === c.fromNode);
    const to = tpl.nodes.find(n => n.id === c.toNode);
    const def = catalog.find(b => b.type === from.type);
    const port = (def && def.outputs.length > 1) ? c.fromPort : undefined;
    const key = `${from.type}|${port}|${to.type}`;
    if (seenLinks.has(key)) return;
    seenLinks.add(key);
    checks.push({ type: 'link', from: from.type, port, to: to.type });
  });

  Object.entries(byType).forEach(([type, list]) => {
    if (type.startsWith('trigger_')) return;
    const def = catalog.find(b => b.type === type);
    if (!def) return;
    def.fields.filter(f => f.type !== 'select').forEach(f => {
      const sets = list.map(n => new Set(varsIn(n.config && n.config[f.key])));
      const common = [...sets[0]].filter(v => sets.every(s => s.has(v)));
      if (common.length) checks.push({ type: 'vars', block: type, field: f.key, vars: common, all: list.length > 1 });
    });
    (DECISIVE_FIELDS[type] || []).forEach(key => {
      const values = list.map(n => String((n.config && n.config[key]) || '').trim());
      if (values.every(v => v === values[0]) && values[0] !== '') {
        checks.push({ type: 'value', block: type, field: key, oneOf: [values[0]] });
      }
    });
  });

  const sheets = byType.action_sheets || [];
  const sheetNames = sheets.map(n => String((n.config && n.config.sheetName) || '').trim());
  if (sheets.length > 1 && new Set(sheetNames).size === sheetNames.length) {
    checks.push({ type: 'distinct', block: 'action_sheets', field: 'sheetName' });
  }

  return [...checks, ...(level.extraChecks || []), { type: 'reachable' }, { type: 'upstreamVars' }];
}

// ---------- helpers ----------
function blockTitle(type, catalog) {
  if (type.endsWith('*')) {
    const prefix = type.slice(0, -1);
    if (prefix === 'trigger_') return 'จุดเริ่มต้น (Trigger)';
    return `บล็อกกลุ่ม ${prefix}`;
  }
  const def = catalog.find(b => b.type === type);
  return def ? def.title : type;
}

function matchesType(node, type) {
  return type.endsWith('*') ? node.type.startsWith(type.slice(0, -1)) : node.type === type;
}

function nodesOfType(ctx, type) {
  return ctx.nodes.filter(n => matchesType(n, type));
}

function varsIn(value) {
  return String(value || '').match(VAR_PATTERN) || [];
}

function portLabel(type, portId, catalog) {
  const def = catalog.find(b => b.type === type);
  const port = def && def.outputs.find(o => o.id === portId);
  return port ? port.label : portId;
}

// ไล่หาบล็อกทั้งหมดที่อยู่ "ก่อนหน้า" nodeId ตามทิศทางของเส้นเชื่อม
function upstreamNodeIds(ctx, nodeId) {
  const seen = new Set();
  const stack = [nodeId];
  while (stack.length) {
    const cur = stack.pop();
    ctx.connections.filter(c => c.toNode === cur).forEach(c => {
      if (!seen.has(c.fromNode)) {
        seen.add(c.fromNode);
        stack.push(c.fromNode);
      }
    });
  }
  return seen;
}

// ---------- check runners ----------
const CHECK_RUNNERS = {
  block(check, ctx) {
    const min = check.min || 1;
    const count = nodesOfType(ctx, check.block).length;
    const title = blockTitle(check.block, ctx.catalog);
    return {
      ok: count >= min,
      label: min > 1 ? `มีบล็อก [${title}] อย่างน้อย ${min} ตัว` : `มีบล็อก [${title}]`,
      detail: count >= min ? `พบ ${count} ตัว` : `ตอนนี้มี ${count} ตัว — ลากบล็อกนี้จากคลังด้านซ้ายมาวางเพิ่ม`
    };
  },

  link(check, ctx) {
    const fromTitle = blockTitle(check.from, ctx.catalog);
    const toTitle = blockTitle(check.to, ctx.catalog);
    const portText = check.port ? ` (สาย "${portLabel(check.from, check.port, ctx.catalog)}")` : '';
    const ok = ctx.connections.some(c => {
      const from = ctx.nodes.find(n => n.id === c.fromNode);
      const to = ctx.nodes.find(n => n.id === c.toNode);
      return from && to && matchesType(from, check.from) && matchesType(to, check.to) &&
        (!check.port || c.fromPort === check.port);
    });
    return {
      ok,
      label: `ต่อสายจาก [${fromTitle}]${portText} ➔ [${toTitle}]`,
      detail: ok ? 'ต่อสายถูกต้อง' : `ลากสายจากจุด Output ของ [${fromTitle}]${portText} ไปคลิกจุด Input ของ [${toTitle}]`
    };
  },

  vars(check, ctx) {
    const title = blockTitle(check.block, ctx.catalog);
    const candidates = nodesOfType(ctx, check.block);
    const label = `บล็อก [${title}] ช่อง "${check.field}" ใช้ตัวแปร ${check.vars.join(', ')}`;
    if (candidates.length === 0) return { ok: false, label, detail: 'ยังไม่มีบล็อกนี้บนกระดาน' };

    const evaluated = candidates
      .map(n => ({ node: n, missing: check.vars.filter(v => !varsIn(n.config && n.config[check.field]).includes(v)) }))
      .sort((a, b) => a.missing.length - b.missing.length);
    // all = บล็อกชนิดนี้ทุกตัวต้องมีตัวแปรครบ, ไม่เช่นนั้นขอแค่ตัวใดตัวหนึ่ง
    const worst = check.all ? evaluated[evaluated.length - 1] : evaluated[0];
    return {
      ok: worst.missing.length === 0,
      label: check.all ? `${label} (ทุกบล็อก)` : label,
      detail: worst.missing.length === 0 ? 'ใส่ตัวแปรครบแล้ว' : `ยังขาด ${worst.missing.join(', ')} (บล็อก #${worst.node.id})`
    };
  },

  value(check, ctx) {
    const title = blockTitle(check.block, ctx.catalog);
    const candidates = nodesOfType(ctx, check.block);
    const label = `บล็อก [${title}] ช่อง "${check.field}" เป็น ${check.oneOf.map(v => `"${v}"`).join(' หรือ ')}`;
    if (candidates.length === 0) return { ok: false, label, detail: 'ยังไม่มีบล็อกนี้บนกระดาน' };

    // ตัวเลขเทียบแบบไม่สนลูกน้ำ (1,000 = 1000)
    const norm = s => String(s == null ? '' : s).trim().replace(/^(\d[\d,]*)$/, m => m.replace(/,/g, ''));
    const hit = candidates.find(n => check.oneOf.map(norm).includes(norm(n.config && n.config[check.field])));
    const current = candidates.map(n => `#${n.id}: "${(n.config && n.config[check.field]) || ''}"`).join(', ');
    return { ok: !!hit, label, detail: hit ? 'ตั้งค่าถูกต้อง' : `ค่าปัจจุบัน ${current}` };
  },

  distinct(check, ctx) {
    const title = blockTitle(check.block, ctx.catalog);
    const values = nodesOfType(ctx, check.block).map(n => String((n.config && n.config[check.field]) || '').trim());
    const ok = values.length > 1 && new Set(values).size === values.length;
    return {
      ok,
      label: `บล็อก [${title}] แต่ละตัวตั้งค่า "${check.field}" ไม่ซ้ำกัน`,
      detail: ok ? 'ตั้งชื่อแยกกันเรียบร้อย' : `ค่าปัจจุบัน: ${values.map(v => `"${v}"`).join(', ') || '-'}`
    };
  },

  minBlocks(check, ctx) {
    return {
      ok: ctx.nodes.length >= check.min,
      label: `มีบล็อกบนกระดานอย่างน้อย ${check.min} ตัว`,
      detail: `ตอนนี้มี ${ctx.nodes.length} ตัว`
    };
  },

  reachable(check, ctx) {
    const orphans = ctx.nodes.filter(n =>
      !n.type.startsWith('trigger_') &&
      ![...upstreamNodeIds(ctx, n.id)].some(id => {
        const up = ctx.nodes.find(x => x.id === id);
        return up && up.type.startsWith('trigger_');
      })
    );
    return {
      ok: ctx.nodes.length > 0 && orphans.length === 0,
      label: 'ทุกบล็อกต่อสายมาจากจุดเริ่มต้น (ไม่มีบล็อกลอย)',
      detail: orphans.length === 0 ? 'ทุกบล็อกอยู่ในสายงาน' : `บล็อกที่ยังไม่ได้ต่อสายจาก Trigger: ${orphans.map(n => `#${n.id}`).join(', ')}`
    };
  },

  upstreamVars(check, ctx) {
    const problems = [];
    ctx.nodes.forEach(n => {
      if (n.type.startsWith('trigger_')) return;
      const available = new Set();
      upstreamNodeIds(ctx, n.id).forEach(id => {
        const up = ctx.nodes.find(x => x.id === id);
        const def = up && ctx.catalog.find(b => b.type === up.type);
        if (def) def.producedVars.forEach(v => available.add(v));
      });
      const used = new Set(Object.values(n.config || {}).flatMap(varsIn));
      const missing = [...used].filter(v => !available.has(v));
      if (missing.length) problems.push(`#${n.id} ใช้ ${missing.join(', ')} แต่ไม่มีบล็อกก่อนหน้าส่งตัวแปรนี้มา`);
    });
    return {
      ok: problems.length === 0,
      label: 'ตัวแปรทุกตัวที่ใช้ มาจากบล็อกก่อนหน้าในสายเดียวกัน',
      detail: problems.length === 0 ? 'การส่งต่อตัวแปรถูกต้องทั้งหมด' : problems.join(' • ')
    };
  }
};

// คำใบ้ของด่าน: ใช้ level.hint ถ้ามี ไม่เช่นนั้นสร้างจากรายการข้อตรวจ (ตัวบอกว่าต้องมี/ต้องต่ออะไรบ้าง)
function levelHint(level, catalog) {
  if (level.hint) return level.hint;
  if (level.mode === 'predict') return '💡 ไล่ตามเส้นเชื่อมจาก Trigger ทีละบล็อก แล้วเช็คเงื่อนไขของแต่ละบล็อกกับข้อมูลตัวอย่าง';
  const labels = checkFlow(level, { nodes: [], connections: [] }, catalog).items.map(i => i.label);
  return `💡 <b>โพยด่านนี้ (สิ่งที่ต้องทำให้ครบ):</b><br>${labels.map((l, i) => `${i + 1}. ${l}`).join('<br>')}`;
}

// ---------------------------------------------------------
// ด่านทายผล (mode: 'predict')
// คำตอบที่ถูกคำนวณจาก simulateFlow(level.start) แล้วเทียบกับ outcome ของแต่ละตัวเลือก
// answers = [indexของตัวเลือกที่เลือกในแต่ละข้อ]
// ---------------------------------------------------------
function sameOutcome(a, b) {
  return JSON.stringify(a.sheets) === JSON.stringify(b.sheets) &&
    JSON.stringify(a.messages) === JSON.stringify(b.messages);
}

function correctOptionIndex(level, question, catalog) {
  const simulate = typeof simulateFlow !== 'undefined' ? simulateFlow : require('./simulator.js').simulateFlow;
  const sim = simulate(level.start, catalog, { overrides: question.overrides, scenarios: question.scenarios });
  return question.options.findIndex(o => sameOutcome(o.outcome, sim.outcome));
}

function checkPrediction(level, answers, catalog) {
  const items = level.questions.map((q, i) => {
    const correct = correctOptionIndex(level, q, catalog);
    const picked = answers ? answers[i] : undefined;
    const ok = picked !== undefined && picked === correct;
    return {
      ok,
      label: `ข้อ ${i + 1}: ${q.text}`,
      detail: picked === undefined
        ? 'ยังไม่ได้เลือกคำตอบ'
        : ok ? q.explain : 'ยังไม่ถูก ลองไล่ตามสายใน Flow อีกครั้ง หรือกด ▶ จำลองการทำงานเพื่อดูว่าข้อมูลไหลไปทางไหน'
    };
  });
  const score = items.filter(i => i.ok).length;
  return { passed: items.length > 0 && score === items.length, score, total: items.length, items };
}

if (typeof module !== 'undefined') module.exports = { checkFlow, checkPrediction, correctOptionIndex, deriveChecks, levelHint, CHECK_RUNNERS };

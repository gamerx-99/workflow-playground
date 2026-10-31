// ---------------------------------------------------------
// ตัวจำลองการทำงาน (Flow Simulator)
// ไม่แตะ DOM — ใช้ได้ทั้งเบราว์เซอร์และ Node
//
// simulateFlow(flow, catalog, opts) → {
//   ok, steps[], messages[], sheets[], warnings[], visited{nodeId: order}, usedConnections[], outcome
// }
//   opts.scenarios = { trigger_form: 'vip' }   เลือกชุดข้อมูลตัวอย่างของ Trigger แต่ละชนิด (ค่าเริ่มต้น = ชุดแรก)
//   opts.overrides = { amount: '2500' }        ทับค่าตัวแปรที่ Trigger ส่งออก
//
// ค่าตัวแปรไหลไปตามเส้นเชื่อมเท่านั้น: บล็อกที่ไม่ได้อยู่ท้ายสายของบล็อกผู้ผลิตตัวแปร จะมองไม่เห็นตัวแปรนั้น
// ---------------------------------------------------------

const SIM_VAR_RE = /\{\{([a-zA-Z0-9_]+)\}\}/g;

const SAMPLE_SHEET_ROWS = [
  '09:00 | สมหญิง | ตัดผม',
  '10:30 | วิชัย | ทำสี',
  '13:00 | มานี | สระ-ไดร์'
];

const TRIGGER_SCENARIOS = {
  trigger_form: [
    { id: 'normal', label: 'ลูกค้าทั่วไป โอน 500 บาท', vars: { customer_name: 'สมชาย ใจดี', phone: '081-234-5678', service_type: 'ตัดผม', amount: '500', message: 'ขอคิวช่วงบ่าย' } },
    { id: 'vip', label: 'ลูกค้า VIP โอน 2,500 บาท', vars: { customer_name: 'สมชาย ใจดี', phone: '081-234-5678', service_type: 'ทำสี', amount: '2500', message: 'ขอช่างประจำ' } }
  ],
  trigger_schedule: [
    { id: 'morning', label: '08:00 น. ของวันนี้', vars: { current_date: '2026-10-21', current_time: '08:00' } }
  ],
  trigger_chat: [
    { id: 'normal', label: 'ลูกค้าถามราคาทั่วไป', vars: { user_name: 'คุณมาลี', message_text: 'สวัสดีครับ สนใจสอบถามราคาบริการหน่อยครับ', reply_token: 'rt-8a21' } },
    { id: 'urgent', label: 'ลูกค้าแจ้งเรื่องด่วน', vars: { user_name: 'คุณมาลี', message_text: 'ด่วนมากครับ โอนเงินแล้วแต่ยังไม่ได้รับของ ช่วยด้วย', reply_token: 'rt-8a21' } }
  ],
  trigger_webhook: [
    { id: 'paid', label: 'ชำระเงินสำเร็จ', vars: { order_id: 'ORD-1042', customer_name: 'สมชาย ใจดี', amount: '1800', payment_status: 'โอนเงินสำเร็จ' } },
    { id: 'pending', label: 'รอชำระเงิน', vars: { order_id: 'ORD-1042', customer_name: 'สมชาย ใจดี', amount: '1800', payment_status: 'รอชำระเงิน' } },
    { id: 'cancel', label: 'ยกเลิกรายการ', vars: { order_id: 'ORD-1042', customer_name: 'สมชาย ใจดี', amount: '1800', payment_status: 'ยกเลิกรายการ' } }
  ]
};

const TARGET_LABELS = {
  admin_group: 'กลุ่มแอดมิน',
  vip_team: 'ทีม VIP / เคสด่วน',
  reply_customer: 'ลูกค้า (ตอบกลับแชท)'
};

function simToNumber(value) {
  const cleaned = String(value).replace(/,/g, '').trim();
  return cleaned !== '' && !isNaN(Number(cleaned)) ? Number(cleaned) : null;
}

function simCompare(left, op, right) {
  const ln = simToNumber(left);
  const rn = simToNumber(right);
  const numeric = ln !== null && rn !== null;
  const lStr = String(left == null ? '' : left).trim();
  const rStr = String(right == null ? '' : right).trim();

  switch (op) {
    case '>=': return numeric && ln >= rn;
    case '>': return numeric && ln > rn;
    case '<=': return numeric && ln <= rn;
    case '<': return numeric && ln < rn;
    case '==': return numeric ? ln === rn : lStr === rStr;
    case '!=': return numeric ? ln !== rn : lStr !== rStr;
    case 'contains': return lStr.toLowerCase().includes(rStr.toLowerCase());
    case 'not_contains': return !lStr.toLowerCase().includes(rStr.toLowerCase());
    case 'starts_with': return lStr.toLowerCase().startsWith(rStr.toLowerCase());
    case 'ends_with': return lStr.toLowerCase().endsWith(rStr.toLowerCase());
    case 'is_empty': return lStr === '';
    case 'is_not_empty': return lStr !== '';
    default: return false;
  }
}

function simIsUrgentText(text) {
  return /ด่วน|ช่วยด้วย|ไม่ได้รับ|เร่ง/.test(text || '');
}

// รัน 1 บล็อก → { forks: [{ port, vars }], produced, output, effects, warnings, used }
function simRunNode(node, def, inVars, state, opts) {
  const cfg = node.config || {};
  const vars = { ...inVars };
  const used = {};
  const missing = new Set();
  const render = (text) => String(text == null ? '' : text).replace(SIM_VAR_RE, (m, key) => {
    if (key in vars) {
      used[m] = vars[key];
      return vars[key];
    }
    missing.add(m);
    return m;
  });

  const result = { produced: {}, output: '', effects: [], warnings: [], forks: null };
  const single = (merged) => [{ port: 'out', vars: { ...vars, ...merged } }];

  switch (node.type) {
    case 'trigger_form':
    case 'trigger_schedule':
    case 'trigger_chat':
    case 'trigger_webhook': {
      const list = TRIGGER_SCENARIOS[node.type];
      const wanted = opts.scenarios && opts.scenarios[node.type];
      const scenario = list.find(s => s.id === wanted) || list[0];
      result.produced = { ...scenario.vars, ...(opts.overrides || {}) };
      result.output = `ข้อมูลตัวอย่าง: ${scenario.label}`;
      result.forks = single(result.produced);
      break;
    }

    case 'logic_if': {
      const condList = Array.isArray(cfg.conditions) && cfg.conditions.length > 0
        ? cfg.conditions
        : [{ leftValue: cfg.leftValue, operator: cfg.operator || '==', rightValue: cfg.rightValue }];

      const results = [];
      const summaries = [];

      condList.forEach(c => {
        const left = render(c.leftValue);
        const right = render(c.rightValue);
        if (/\{\{/.test(left)) result.warnings.push(`ช่อง "${c.leftValue || 'ค่าที่ต้องการตรวจ'}" ยังไม่มีค่า จึงถือว่าเงื่อนไขเป็นเท็จ`);
        const subYes = !/\{\{/.test(left) && simCompare(left, c.operator || '==', right);
        results.push(subYes);
        summaries.push(`${left || '(ว่าง)'} ${c.operator || '=='} ${right || '(ว่าง)'}`);
      });

      const logic = (cfg.conditionLogic || 'AND').toUpperCase();
      const yes = logic === 'OR' ? results.some(Boolean) : results.every(Boolean);

      result.output = condList.length > 1
        ? `ตรวจ (${summaries.join(` ${logic} `)}) ➔ ${yes ? 'จริง (True)' : 'เท็จ (False)'}`
        : `${summaries[0] || ''} ➔ ${yes ? 'จริง (True)' : 'เท็จ (False)'}`;
      result.forks = [{ port: yes ? 'true' : 'false', vars }];
      break;
    }

    case 'logic_switch': {
      const value = render(cfg.switchField).trim();
      let routes = [];
      if (Array.isArray(cfg.routes) && cfg.routes.length > 0) {
        routes = cfg.routes.map((r, i) => [
          r.id || `route_${String.fromCharCode(97 + i)}`,
          r.condition || '',
          r.label || `สาย ${String.fromCharCode(65 + i)}`,
          r.operator || '=='
        ]);
      } else {
        routes = [
          ['route_a', cfg.caseA, 'สาย A', '=='],
          ['route_b', cfg.caseB, 'สาย B', '=='],
          ['route_c', cfg.caseC, 'สาย C', '==']
        ];
      }
      const hit = routes.find(([, c, , op]) => {
        if (!c && op !== 'is_empty') return false;
        return simCompare(value, op || '==', c);
      });
      if (hit) {
        result.output = `ค่า "${value || '(ว่าง)'}"  ➔  ${hit[2] || hit[0]}`;
        result.forks = [{ port: hit[0], vars }];
      } else {
        result.output = `ค่า "${value || '(ว่าง)'}"  ➔  ไม่ตรงเงื่อนไขสายใด (ส่งไปสาย Default)`;
        result.forks = [{ port: 'default', vars }];
      }
      break;
    }

    case 'logic_loop': {
      const list = render(cfg.sourceList);
      if (/\{\{/.test(list)) result.warnings.push('ช่อง "รายการที่จะวนลูป" ยังไม่มีค่า');
      const maxIter = parseInt(cfg.maxIterations, 10) || 20;
      const items = /\{\{/.test(list) ? [] : list.split('\n').map(s => s.trim()).filter(Boolean).slice(0, Math.min(maxIter, 50));
      result.output = `วนลูป ${items.length} รายการ (โหมด: ${cfg.loopMode || 'item_by_item'})`;
      result.forks = [
        ...items.map(item => ({ port: 'each', vars: { ...vars, loop_item: item } })),
        { port: 'done', vars }
      ];
      result.produced = { loop_item: items[0] || '' };
      break;
    }

    case 'logic_delay': {
      const unit = cfg.timeUnit || 'minutes';
      const dur = cfg.duration || '15 นาที';
      result.output = `รอ ${dur} [${unit}] (${cfg.reason || '-'})`;
      result.forks = single({});
      break;
    }

    case 'ai_agent': {
      const prompt = render(cfg.prompt);
      const hasInput = Object.entries(vars).some(([, v]) => String(v).length > 2 && prompt.includes(String(v)));
      let aiResult;
      let aiReply;
      if (!hasInput) {
        result.warnings.push('Prompt ไม่มีข้อมูลให้ AI อ่านเลย (ต้องแทรกตัวแปร เช่น {{message_text}} ลงในคำสั่ง)');
        aiResult = 'ไม่มีข้อมูลให้วิเคราะห์';
        aiReply = 'ขออภัย ระบบไม่ได้รับข้อมูลที่ต้องใช้';
      } else {
        const urgent = simIsUrgentText(vars.message_text);
        aiResult = urgent ? 'ด่วน' : 'ปกติ';
        aiReply = urgent
          ? 'ขออภัยในความไม่สะดวก ทีมงานกำลังรีบตรวจสอบให้ทันทีค่ะ'
          : 'ขอบคุณที่ติดต่อมาค่ะ ทีมงานจะตอบกลับโดยเร็ว';
      }
      result.produced = { ai_result: aiResult, ai_reply: aiReply };
      const modelTag = cfg.model ? `[${cfg.model}] ` : '';
      result.output = `AI ${modelTag}ตอบ: ${aiResult}`;
      result.forks = single(result.produced);
      break;
    }

    case 'data_formatter': {
      let text = render(cfg.template);
      if (cfg.formatMode === 'json_transform') {
        text = JSON.stringify({ data: text, formattedAt: new Date().toISOString() });
      } else if (cfg.formatMode === 'date_format') {
        const pattern = cfg.dateFormatPattern || 'th_long';
        text = pattern === 'th_long'
          ? '31 ตุลาคม 2569'
          : (pattern === 'th_short' ? '31 ต.ค. 69' : '2026-10-31');
      } else if (cfg.formatMode === 'number_format') {
        const num = parseFloat(text.replace(/[^0-9.-]/g, '')) || 0;
        text = `${num.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`;
      }
      result.produced = { formatted_text: text };
      result.output = text;
      result.forks = single(result.produced);
      break;
    }

    case 'action_http': {
      const method = (cfg.method || 'GET').toUpperCase();
      const endpoint = render(cfg.endpoint || '');
      render(cfg.headers);
      render(cfg.bodyPayload);
      result.produced = { api_data: '{"status":"ok","items":3}', api_status: '200' };
      result.output = `${method} ${endpoint}  ➔  [200 OK] ได้ข้อมูลกลับมา`;
      result.forks = single(result.produced);
      break;
    }

    case 'action_sheets': {
      const sheet = render(cfg.sheetName) || '(ไม่มีชื่อชีต)';
      const columns = render(cfg.columns);
      if (cfg.operation === 'read_rows') {
        result.produced = { sheet_rows: SAMPLE_SHEET_ROWS.join('\n'), row_number: String(SAMPLE_SHEET_ROWS.length) };
        result.output = `ดึงข้อมูลจากชีต "${sheet}" ได้ ${SAMPLE_SHEET_ROWS.length} แถว (เงื่อนไข: ${columns})`;
        result.effects.push({ kind: 'sheet', op: 'read_rows', sheet, detail: columns });
      } else if (cfg.operation === 'update_row') {
        result.produced = { row_number: '1' };
        result.output = `อัปเดตแถวในชีต "${sheet}": ${columns}`;
        result.effects.push({ kind: 'sheet', op: 'update_row', sheet, detail: columns });
      } else if (cfg.operation === 'delete_row') {
        result.output = `ลบแถวในชีต "${sheet}": ${columns}`;
        result.effects.push({ kind: 'sheet', op: 'delete_row', sheet, detail: columns });
      } else if (cfg.operation === 'clear_sheet') {
        result.output = `ล้างข้อมูลในชีต "${sheet}" ทั้งหมด`;
        result.effects.push({ kind: 'sheet', op: 'clear', sheet, detail: 'all' });
      } else {
        state.sheetRows[sheet] = (state.sheetRows[sheet] || 0) + 1;
        result.produced = { row_number: String(state.sheetRows[sheet]) };
        result.output = `เพิ่มแถวที่ ${state.sheetRows[sheet]} ในชีต "${sheet}": ${columns}`;
        result.effects.push({ kind: 'sheet', op: 'append_row', sheet, detail: columns });
      }
      result.forks = single(result.produced);
      break;
    }

    case 'action_line': {
      const text = render(cfg.messageTemplate);
      const ch = cfg.channel || 'LINE';
      const targetLabel = cfg.target === 'custom'
        ? (render(cfg.customTarget) || 'กำหนดเอง')
        : (TARGET_LABELS[cfg.target] || cfg.target || 'แอดมิน');
      result.output = `ส่ง ${ch.toUpperCase()} ถึง ${targetLabel}`;
      result.effects.push({ kind: 'message', channel: ch, target: cfg.target, targetLabel, text });
      result.forks = single({});
      break;
    }

    case 'action_telegram': {
      const text = render(cfg.message);
      result.output = `ส่ง ${cfg.platform} ไปห้อง "${cfg.chatId}"`;
      result.effects.push({ kind: 'message', channel: cfg.platform, target: cfg.chatId, targetLabel: cfg.chatId, text });
      result.forks = single({});
      break;
    }

    case 'action_email': {
      const text = `หัวข้อ: ${render(cfg.subject)}\n${render(cfg.body)}`;
      result.output = `ส่งอีเมลถึง ${cfg.toEmail}`;
      result.effects.push({ kind: 'message', channel: 'Email', target: cfg.toEmail, targetLabel: cfg.toEmail, text });
      result.forks = single({});
      break;
    }

    case 'action_calendar': {
      const title = render(cfg.eventTitle);
      render(cfg.eventDate);
      render(cfg.notes);
      result.produced = { event_link: 'https://calendar.example/event/1' };
      result.output = `สร้างนัดหมาย: ${title}`;
      result.effects.push({ kind: 'message', channel: 'Calendar', target: 'calendar', targetLabel: 'ปฏิทิน', text: title });
      result.forks = single(result.produced);
      break;
    }

    default:
      result.output = 'ผ่าน';
      result.forks = single({});
  }

  missing.forEach(m => result.warnings.push(`ใช้ ${m} แต่ไม่มีบล็อกก่อนหน้าส่งตัวแปรนี้มา — ในระบบจริงจะได้ค่าว่าง`));
  result.used = used;
  return result;
}

const SIM_MAX_STEPS = 300;

function simulateFlow(flow, catalog, opts = {}) {
  const nodes = (flow && flow.nodes) || [];
  const connections = (flow && flow.connections) || [];
  const state = { sheetRows: {} };
  const out = { ok: true, steps: [], messages: [], sheets: [], warnings: [], visited: {}, usedConnections: [], outcome: { sheets: [], messages: [] } };

  const triggers = nodes.filter(n => n.type.startsWith('trigger_'));
  if (triggers.length === 0) {
    out.ok = false;
    out.warnings.push('ยังไม่มีบล็อกจุดเริ่มต้น (Trigger) — ไม่มีอะไรให้เริ่มทำงาน');
    return out;
  }

  const usedConns = new Set();
  const queue = triggers.map(node => ({ node, vars: {} }));
  let count = 0;

  while (queue.length && count < SIM_MAX_STEPS) {
    const { node, vars } = queue.shift();
    const def = catalog.find(b => b.type === node.type);
    if (!def) continue;
    count++;

    const res = simRunNode(node, def, vars, state, opts);
    const order = out.steps.length + 1;
    if (!(node.id in out.visited)) out.visited[node.id] = order;

    out.steps.push({
      order,
      nodeId: node.id,
      type: node.type,
      title: def.title,
      icon: def.icon,
      output: res.output,
      used: res.used,
      produced: res.produced,
      warnings: res.warnings
    });

    res.effects.forEach(e => {
      if (e.kind === 'message') {
        out.messages.push(e);
        out.outcome.messages.push(e.target);
      } else {
        out.sheets.push(e);
        out.outcome.sheets.push(e.sheet);
      }
    });

    res.forks.forEach(fork => {
      connections.forEach((c, idx) => {
        if (c.fromNode === node.id && c.fromPort === fork.port) {
          const next = nodes.find(n => n.id === c.toNode);
          if (next) {
            usedConns.add(idx);
            queue.push({ node: next, vars: fork.vars });
          }
        }
      });
    });
  }

  if (count >= SIM_MAX_STEPS) out.warnings.push('หยุดจำลองเพราะรันเกิน 300 ขั้นตอน (อาจมีสายวนซ้ำไม่จบ)');
  out.usedConnections = [...usedConns];
  const orphans = nodes.filter(n => !(n.id in out.visited));
  if (orphans.length) out.warnings.push(`บล็อกที่ไม่ได้ทำงานเลย: ${orphans.map(n => `#${n.id}`).join(', ')} (ยังไม่ได้ต่อสายมาจาก Trigger)`);
  return out;
}

if (typeof module !== 'undefined') module.exports = { simulateFlow, TRIGGER_SCENARIOS, TARGET_LABELS };

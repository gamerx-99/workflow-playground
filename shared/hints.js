// ---------------------------------------------------------
// PROGRESSIVE HINTS SYSTEM (คำใบ้เปิดทีละขั้น 3 ระดับ)
// ---------------------------------------------------------
// ขั้นที่ 1: 🧩 แนวคิด & บล็อกที่จำเป็น (Concept & Blocks)
// ขั้นที่ 2: 🔗 การเชื่อมต่อ & ทางเดินข้อมูล (Connections & Routing)
// ขั้นที่ 3: 🎯 ตัวแปร & เงื่อนไขละเอียด (Variables & Configuration)
// ---------------------------------------------------------

function getProgressiveHints(level, catalog) {
  if (!level) return [];

  // หากด่านระบุ progressiveHints หรือ hints เป็น Array 3 ขั้นไว้แล้ว ให้ใช้โดยตรง
  if (Array.isArray(level.progressiveHints) && level.progressiveHints.length === 3) {
    return level.progressiveHints;
  }
  if (Array.isArray(level.hints) && level.hints.length === 3) {
    return [
      { step: 1, title: '🧩 แนวคิด & บล็อกที่จำเป็น', text: level.hints[0] },
      { step: 2, title: '🔗 การเชื่อมต่อ & ทางเดินข้อมูล', text: level.hints[1] },
      { step: 3, title: '🎯 ตัวแปร & เงื่อนไขละเอียด', text: level.hints[2] }
    ];
  }

  const tpl = level.template || level.start;
  const nodes = (tpl && tpl.nodes) || [];
  const conns = (tpl && tpl.connections) || [];

  // --- Step 1: วิเคราะห์บล็อกที่ต้องใช้ ---
  let step1Text = '';
  if (level.mode === 'predict') {
    step1Text = 'ด่านนี้เป็นโหมดทายผลลัพธ์: ตรวจดูบล็อกจุดเริ่มต้น (Trigger) และการประมวลผลตามลำดับ เพื่อดูว่าเมื่อข้อมูลเข้าแล้วจะไหลไปทางใด';
  } else if (nodes.length > 0) {
    const triggerNodes = nodes.filter(n => n.type.startsWith('trigger_'));
    const logicNodes = nodes.filter(n => n.type.startsWith('logic_'));
    const actionNodes = nodes.filter(n => n.type.startsWith('action_') || n.type.startsWith('ai_') || n.type.startsWith('helper_'));

    const triggerNames = triggerNodes.map(n => {
      const def = catalog.find(b => b.type === n.type);
      return def ? def.title : n.type;
    });
    const actionNames = actionNodes.map(n => {
      const def = catalog.find(b => b.type === n.type);
      return def ? def.title : n.type;
    });
    const logicNames = logicNodes.map(n => {
      const def = catalog.find(b => b.type === n.type);
      return def ? def.title : n.type;
    });

    const parts = [];
    if (triggerNames.length) parts.push(`เริ่มด้วย Trigger: <b>${[...new Set(triggerNames)].join(', ')}</b>`);
    if (logicNames.length) parts.push(`ใช้ตัวประมวลผล/เงื่อนไข: <b>${[...new Set(logicNames)].join(', ')}</b>`);
    if (actionNames.length) parts.push(`และปลายทาง/การทำงาน: <b>${[...new Set(actionNames)].join(', ')}</b>`);
    step1Text = `ต้องใช้ทั้งหมด <b>${nodes.length}</b> บล็อก:<br>• ${parts.join('<br>• ')}`;
  } else {
    step1Text = 'เลือกวางบล็อกจุดเริ่มต้น (Trigger) ที่ตรงกับโจทย์ แล้วเลือกบล็อกปลายทาง (Action) ที่ต้องการให้ทำงาน';
  }

  // --- Step 2: วิเคราะห์การเชื่อมสาย ---
  let step2Text = '';
  if (level.mode === 'predict') {
    step2Text = 'สังเกตเส้นเชื่อมแต่ละเส้น โดยเฉพาะบล็อกเงื่อนไข (IF/Switch) ว่าพอร์ต True/False หรือสาย A/B เชื่อมต่อไปยังบล็อกใดบ้าง';
  } else if (conns.length > 0) {
    const connDescriptions = conns.map(c => {
      const fromNode = nodes.find(n => n.id === c.fromNode);
      const toNode = nodes.find(n => n.id === c.toNode);
      const fromDef = fromNode ? catalog.find(b => b.type === fromNode.type) : null;
      const toDef = toNode ? catalog.find(b => b.type === toNode.type) : null;
      const fromTitle = fromDef ? fromDef.title : 'บล็อกต้นทาง';
      const toTitle = toDef ? toDef.title : 'บล็อกปลายทาง';

      let portDesc = '';
      if (c.fromPort === 'true') portDesc = ' (สายจริง True ✅)';
      else if (c.fromPort === 'false') portDesc = ' (สายเท็จ False ❌)';
      else if (c.fromPort === 'route_a') portDesc = ' (สาย A)';
      else if (c.fromPort === 'route_b') portDesc = ' (สาย B)';
      else if (c.fromPort === 'route_c') portDesc = ' (สาย C)';
      else if (c.fromPort === 'each') portDesc = ' (วนทีละรายการ)';
      else if (c.fromPort === 'done') portDesc = ' (เมื่อวนครบ)';

      return `เชื่อมจาก <b>${fromTitle}</b>${portDesc} ➔ <b>${toTitle}</b>`;
    });
    const uniqueConns = [...new Set(connDescriptions)];
    step2Text = `มีเส้นเชื่อมทั้งหมด <b>${conns.length}</b> เส้น:<br>• ${uniqueConns.slice(0, 5).join('<br>• ')}${uniqueConns.length > 5 ? `<br>• ...และอีก ${uniqueConns.length - 5} เส้น` : ''}`;
  } else {
    step2Text = 'ลากสายจากจุดวงกลมขาออก (ขวา) ของบล็อกต้นทาง ไปยังจุดวงกลมขาเข้า (ซ้าย) ของบล็อกปลายทาง';
  }

  // --- Step 3: วิเคราะห์ตัวแปรและค่าละเอียด ---
  let step3Text = '';
  if (level.hint) {
    step3Text = level.hint;
  } else if (level.mode === 'predict') {
    step3Text = 'เทียบค่าตัวแปรใน Scenario กับเงื่อนไขในบล็อก IF/Switch ว่าค่าเข้าเงื่อนไขสายใด แล้วอ่านผลลัพธ์ที่ปลายทาง';
  } else {
    // หาตัวแปรและ config สำคัญจาก template
    const varItems = [];
    nodes.forEach(n => {
      if (n.type.startsWith('trigger_')) return;
      const def = catalog.find(b => b.type === n.type);
      if (!def) return;
      const cfg = n.config || {};
      const foundVars = [];
      Object.entries(cfg).forEach(([k, v]) => {
        if (typeof v === 'string') {
          const matches = v.match(/\{\{([a-zA-Z0-9_]+)\}\}/g);
          if (matches) foundVars.push(...matches);
        }
      });
      if (foundVars.length) {
        varItems.push(`<b>${def.title}</b>: ใช้ตัวแปร <code>${[...new Set(foundVars)].join(', ')}</code>`);
      }
      if (n.type === 'logic_if' && cfg.operator && cfg.rightValue) {
        varItems.push(`<b>IF</b>: ตรวจสอบเงื่อนไข <code>${cfg.operator} ${cfg.rightValue}</code>`);
      }
    });

    if (varItems.length > 0) {
      step3Text = `การตั้งค่าตัวแปรและเงื่อนไขที่สำคัญ:<br>• ${[...new Set(varItems)].join('<br>• ')}`;
    } else {
      step3Text = 'ตรวจสอบให้แน่ใจว่าแทรกตัวแปร {{...}} ในช่องข้อความของบล็อก Action ครบถ้วนตามโจทย์';
    }
  }

  return [
    { step: 1, title: '🧩 แนวคิด & บล็อกที่จำเป็น', text: step1Text },
    { step: 2, title: '🔗 การเชื่อมต่อ & ทางเดินข้อมูล', text: step2Text },
    { step: 3, title: '🎯 ตัวแปร & เงื่อนไขละเอียด', text: step3Text }
  ];
}

if (typeof module !== 'undefined') {
  module.exports = { getProgressiveHints };
}

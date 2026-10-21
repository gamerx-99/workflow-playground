// ---------------------------------------------------------
// ตรวจและทำความสะอาดด่านที่ผู้ใช้สร้าง/นำเข้า (Custom Level) — ไม่แตะ DOM ใช้ได้ทั้งเบราว์เซอร์และ Node
//
// เหตุผล: ไฟล์ด่านแชร์ข้ามคนได้ จึงเป็น "ข้อมูลที่ไม่น่าเชื่อถือ" ส่วนที่หน้าเว็บแสดงผ่าน innerHTML
// (badge, hint, hints, label ของข้อตรวจ) ถ้าไม่ escape จะรันสคริปต์ในหน้าเว็บได้ (XSS)
//
// sanitizeCustomLevel(raw, catalog, trackIds) → level ที่ปลอดภัย หรือ throw Error(ข้อความภาษาไทย)
//   - จำกัดชนิด/ความยาวทุกช่อง, escape HTML ในข้อความทุกช่อง
//   - ตรวจ template/start: ชนิดบล็อกต้องมีในคลัง, id ไม่ซ้ำ, สายอ้างบล็อกและพอร์ตที่มีจริง, ตัดช่องที่ไม่รู้จัก
//   - checks: เก็บเฉพาะชนิดที่ checker รู้จักและเฉพาะฟิลด์ที่กำหนด (ถ้าไม่ผ่านจะทิ้ง แล้วระบบสร้างจากเฉลยให้ใหม่)
//   - id ต้องอยู่ในรูป custom_<ตัวเลข> ไม่เช่นนั้นสร้างใหม่ (กันทับ id ของด่านระบบ)
// ---------------------------------------------------------

const SANITIZE_LIMITS = { nodes: 60, connections: 120, text: 1000, coord: 3000 };
const CUSTOM_MODES = ['build', 'fill', 'debug'];

// ทำให้ข้อความ "ปลอดภัยทุกบริบท" (ใส่ใน innerHTML, escapeHtml, textContent หรือ attribute ก็ได้ โดยไม่ถูก escape ซ้ำจนอ่านไม่ออก)
// ด้วยการแทนตัวอักษรที่เปิดแท็ก/ปิดค่า attribute ด้วยอักขระหน้าตาคล้ายกันที่ไม่มีความหมายใน HTML
function escapeText(value, max) {
  return String(value == null ? '' : value)
    .slice(0, max)
    .replace(/</g, '‹')
    .replace(/>/g, '›')
    .replace(/"/g, '”')
    .replace(/'/g, '’')
    .replace(/`/g, '′');
}

function sanitizeFlow(flow, catalog, name) {
  if (!flow || !Array.isArray(flow.nodes) || !Array.isArray(flow.connections || [])) {
    throw new Error(`${name} ต้องมี nodes และ connections`);
  }
  if (flow.nodes.length === 0 || flow.nodes.length > SANITIZE_LIMITS.nodes) {
    throw new Error(`${name} ต้องมีบล็อก 1-${SANITIZE_LIMITS.nodes} ตัว`);
  }
  const ids = new Set();
  const nodes = flow.nodes.map(n => {
    const def = catalog.find(b => b.type === (n && n.type));
    if (!def) throw new Error(`${name}: ไม่รู้จักชนิดบล็อก "${escapeText(n && n.type, 40)}"`);
    const id = Number(n.id);
    if (!Number.isFinite(id) || ids.has(id)) throw new Error(`${name}: id บล็อกไม่ถูกต้องหรือซ้ำ`);
    ids.add(id);
    const config = {};
    Object.entries(n.config && typeof n.config === 'object' ? n.config : {}).forEach(([k, v]) => {
      if (typeof v === 'string' || typeof v === 'number') config[String(k).slice(0, 40)] = String(v).slice(0, SANITIZE_LIMITS.text);
    });
    const clamp = v => Math.max(0, Math.min(SANITIZE_LIMITS.coord, Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0));
    return { id, type: def.type, x: clamp(n.x), y: clamp(n.y), config };
  });

  const rawConns = flow.connections || [];
  if (rawConns.length > SANITIZE_LIMITS.connections) throw new Error(`${name} มีเส้นเชื่อมมากเกินไป`);
  const connections = rawConns.map(c => {
    const from = nodes.find(n => n.id === Number(c && c.fromNode));
    const to = nodes.find(n => n.id === Number(c && c.toNode));
    if (!from || !to) throw new Error(`${name}: เส้นเชื่อมอ้างบล็อกที่ไม่มี`);
    const fromDef = catalog.find(b => b.type === from.type);
    const toDef = catalog.find(b => b.type === to.type);
    if (!fromDef.outputs.some(o => o.id === c.fromPort)) throw new Error(`${name}: บล็อก #${from.id} ไม่มีพอร์ต "${escapeText(c.fromPort, 20)}"`);
    if (!toDef.inputs.some(i => i.id === c.toPort)) throw new Error(`${name}: บล็อก #${to.id} ไม่มีพอร์ตรับ "${escapeText(c.toPort, 20)}"`);
    return { fromNode: from.id, fromPort: c.fromPort, toNode: to.id, toPort: c.toPort };
  });
  return { nodes, connections };
}

const CHECK_STRING_FIELDS = ['block', 'from', 'to', 'port', 'field'];

function sanitizeChecks(checks, runners) {
  if (!Array.isArray(checks) || checks.length === 0 || checks.length > 80) return null;
  const out = [];
  for (const c of checks) {
    if (!c || typeof c.type !== 'string' || !Object.prototype.hasOwnProperty.call(runners, c.type)) return null;
    const clean = { type: c.type };
    CHECK_STRING_FIELDS.forEach(k => {
      if (c[k] !== undefined) clean[k] = escapeText(c[k], 60);
    });
    ['vars', 'oneOf'].forEach(k => {
      if (c[k] !== undefined) {
        if (!Array.isArray(c[k]) || c[k].length > 20) throw new Error('รูปแบบเกณฑ์ตรวจไม่ถูกต้อง');
        clean[k] = c[k].map(v => String(v).slice(0, 200));
      }
    });
    if (c.min !== undefined) clean.min = Math.max(1, Math.min(60, Math.round(Number(c.min)) || 1));
    if (c.all !== undefined) clean.all = !!c.all;
    if (c.label !== undefined) clean.label = escapeText(c.label, 300);
    out.push(clean);
  }
  return out;
}

function sanitizeCustomLevel(raw, catalog, trackIds = [], runners = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('ไฟล์ด่านไม่ถูกต้อง');
  if (typeof raw.title !== 'string' || !raw.title.trim()) throw new Error('ด่านต้องมี title');

  const mode = CUSTOM_MODES.includes(raw.mode) ? raw.mode : 'build';
  const level = {
    id: /^custom_\d+$/.test(String(raw.id || '')) ? String(raw.id) : `custom_${Date.now()}`,
    isCustom: true,
    track: trackIds.includes(raw.track) ? raw.track : 'custom',
    mode,
    difficulty: [1, 2, 3].includes(Number(raw.difficulty)) ? Number(raw.difficulty) : 1,
    title: escapeText(raw.title, 200),
    shortName: escapeText(raw.shortName || raw.title, 80),
    badge: escapeText(raw.badge || 'ด่านสร้างเอง', 200),
    desc: escapeText(raw.desc, 800),
    template: sanitizeFlow(raw.template, catalog, 'template (เฉลย)')
  };
  if (raw.hint) level.hint = escapeText(raw.hint, 2000);
  if (Array.isArray(raw.hints)) level.hints = raw.hints.slice(0, 3).map(h => escapeText(h, 800));
  if (mode !== 'build') {
    if (!raw.start) throw new Error(`ด่านโหมด ${mode} ต้องมี start (โจทย์เริ่มต้น)`);
    level.start = sanitizeFlow(raw.start, catalog, 'start (โจทย์เริ่มต้น)');
  }
  const checks = sanitizeChecks(raw.checks, runners);
  if (checks) level.checks = checks;
  return level;
}

if (typeof module !== 'undefined') module.exports = { sanitizeCustomLevel, sanitizeFlow, escapeText };

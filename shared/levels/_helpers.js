// ตัวช่วยเขียนด่าน — ใช้ได้ทั้งเบราว์เซอร์ (global WF) และ Node (require)
globalThis.WF = globalThis.WF || { levels: {}, helpers: {} };

const WF_COL_WIDTH = 330;
const WF_ROW_HEIGHT = 170;

WF.helpers = {
  // บล็อกที่วางตามตาราง: คอลัมน์ c, แถว r
  node: (id, type, config, c, r) => ({
    id,
    type,
    x: 60 + c * WF_COL_WIDTH,
    y: 60 + r * WF_ROW_HEIGHT,
    config
  }),
  // เส้นเชื่อม (port คือพอร์ตขาออกของบล็อกต้นทาง เช่น 'out', 'true', 'false', 'route_a', 'each', 'done')
  link: (from, to, port = 'out') => ({ fromNode: from, fromPort: port, toNode: to, toPort: 'in' }),
  COMMON_CHECKS: [{ type: 'reachable' }, { type: 'upstreamVars' }]
};

if (typeof module !== 'undefined') module.exports = WF.helpers;

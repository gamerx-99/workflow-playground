// ---------------------------------------------------------
// รวมด่านทั้งหมดจากโฟลเดอร์ shared/levels/ เป็น LEVELS + TRACKS
//
// เพิ่มด่านใหม่: เขียนในไฟล์ของสายที่เกี่ยวข้อง (shared/levels/<สาย>.js) แล้วเพิ่ม id ใน TRACKS ด้านล่าง
// ด่านที่มี template แต่ไม่มี checks → ระบบสร้าง checks จากเฉลยให้อัตโนมัติ (ดู deriveChecks ใน checker.js)
//
// ฟิลด์ของด่าน: id, shortName, badge, title, desc, hint?, mode? (build|fill|debug|predict|sandbox),
//   difficulty (1-3 ดาว), template (เฉลย), start? (กระดานเริ่มต้นของ fill/debug/predict),
//   checks? (เขียนเอง), extraChecks? (เพิ่มจากที่สร้างให้), questions? (เฉพาะ predict)
// ---------------------------------------------------------
if (typeof require !== 'undefined') {
  ['core', 'basics', 'conditions', 'data', 'ai', 'cases'].forEach(name => require(`./levels/${name}.js`));
}

const TRACKS = [
  { id: 'basics', icon: '🧱', name: 'พื้นฐานตัวแปร', desc: 'Trigger → Action และการส่งต่อตัวแปร {{...}}', levelIds: [1, 9, 10, 11, 12, 13] },
  { id: 'conditions', icon: '🔀', name: 'เงื่อนไข', desc: 'IF, Switch และการทายว่าข้อมูลจะไหลไปสายไหน', levelIds: [2, 14, 15, 16, 17, 7, 8] },
  { id: 'data', icon: '📊', name: 'ข้อมูล & Loop', desc: 'อ่านชีต, วนลูป, Formatter, เรียก API', levelIds: [3, 18, 19, 20, 21, 22] },
  { id: 'ai', icon: '🤖', name: 'AI & API', desc: 'บล็อก AI, HTTP และตัวแปรที่ได้จากผลลัพธ์', levelIds: [4, 23, 24, 25, 26, 27] },
  { id: 'cases', icon: '🏪', name: 'เคสธุรกิจจริง', desc: 'Flow ครบวงจร: คลินิก รีสอร์ท ร้านออนไลน์ และสนามอิสระ', levelIds: [28, 6, 29, 30, 5] }
];

// ความยากของด่านแกนหลัก (id 1-8) — ด่านใหม่ระบุ difficulty ในไฟล์ของตัวเอง
const CORE_DIFFICULTY = { 1: 1, 2: 2, 3: 2, 4: 3, 5: 3, 6: 2, 7: 2, 8: 2 };

const LEVELS = (() => {
  const all = Object.values(WF.levels).flat();
  const byId = new Map(all.map(l => [l.id, l]));
  const ordered = [];
  TRACKS.forEach(track => {
    track.levelIds.forEach((id, index) => {
      const level = byId.get(id);
      level.track = track.id;
      level.trackIndex = index;
      level.difficulty = level.difficulty || CORE_DIFFICULTY[id] || 1;
      ordered.push(level);
    });
  });
  return ordered;
})();

if (typeof module !== 'undefined') module.exports = { LEVELS, TRACKS };

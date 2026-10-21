// ---------------------------------------------------------
// SEED SUPABASE LEVEL SOLUTIONS
// บันทึกเฉลยด่านทั้ง 30 ด่านขึ้นตาราง level_solutions บน Supabase
// (ตารางนี้จำกัดสิทธิ์เฉพาะ Service Role เท่านั้น เพื่อความปลอดภัย)
// ---------------------------------------------------------
const path = require('node:path');

// Load environment variables
for (const file of [path.join(__dirname, '.env'), path.join(__dirname, '..', '.env')]) {
  try {
    process.loadEnvFile(file);
  } catch (e) {}
}

const { LEVELS } = require('../shared/levels.js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

async function seedSolutions() {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env');
    process.exit(1);
  }

  console.log(`🚀 กำลังนำเฉลยทั้ง ${LEVELS.length} ด่านขึ้นสู่ Supabase level_solutions...`);

  const payload = LEVELS.map(lvl => ({
    level_id: lvl.id,
    template_json: lvl.template || { mode: lvl.mode || 'build', questions: lvl.questions || [] },
    checks_json: lvl.checks || lvl.extraChecks || null
  }));

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/level_solutions?on_conflict=level_id`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SECRET_KEY,
        'Authorization': `Bearer ${SUPABASE_SECRET_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errText}`);
    }

    const inserted = await res.json();
    console.log(`✅ บันทึกเฉลยด่านสำเร็จเรียบร้อยแล้ว: ${inserted.length} ด่าน!`);
  } catch (err) {
    console.error(`❌ เกิดข้อผิดพลาดในการบันทึกเฉลย: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  seedSolutions().catch(console.error);
}

module.exports = { seedSolutions };

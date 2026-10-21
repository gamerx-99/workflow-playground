// ---------------------------------------------------------
// SUPABASE CONNECTION & HEALTH CHECK SCRIPT
// ---------------------------------------------------------
const path = require('node:path');

// Load .env
for (const file of [path.join(__dirname, '.env'), path.join(__dirname, '..', '.env')]) {
  try {
    process.loadEnvFile(file);
  } catch (e) {
    if (e.code !== 'ENOENT') console.warn(`Warning loading ${file}: ${e.message}`);
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

async function checkSupabase() {
  console.log('='.repeat(60));
  console.log('⚡ Workflow Lab — Supabase Connection Health Check');
  console.log('='.repeat(60));

  if (!SUPABASE_URL) {
    console.error('❌ Error: SUPABASE_URL is not set in .env');
    process.exit(1);
  }
  console.log(`📡 URL: ${SUPABASE_URL}`);
  console.log(`🔑 Publishable/Anon Key: ${SUPABASE_ANON_KEY ? SUPABASE_ANON_KEY.slice(0, 15) + '...' : '❌ Missing'}`);
  console.log(`🔐 Secret/Service Key:   ${SUPABASE_SECRET_KEY ? SUPABASE_SECRET_KEY.slice(0, 15) + '...' : '❌ Missing'}`);
  console.log('-'.repeat(60));

  let authOk = false;
  let restOk = false;
  let tables = [];

  // 1. Check Auth (GoTrue)
  try {
    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      headers: { 'apikey': SUPABASE_ANON_KEY }
    });
    if (authRes.ok) {
      const authData = await authRes.json();
      console.log(`✅ Supabase Auth (GoTrue): Connected! Version: ${authData.version || 'OK'}`);
      authOk = true;
    } else {
      console.log(`⚠️ Supabase Auth returned status ${authRes.status}: ${await authRes.text()}`);
    }
  } catch (e) {
    console.error(`❌ Cannot connect to Supabase Auth: ${e.message}`);
  }

  // 2. Check PostgREST with Secret Key
  try {
    const restRes = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: {
        'apikey': SUPABASE_SECRET_KEY,
        'Authorization': `Bearer ${SUPABASE_SECRET_KEY}`
      }
    });
    if (restRes.ok) {
      const restData = await restRes.json();
      console.log(`✅ Supabase PostgREST: Connected! Engine: ${restData.info?.title || 'standard public schema'}`);
      restOk = true;
      const paths = Object.keys(restData.paths || {}).filter(p => p !== '/');
      tables = paths.map(p => p.replace(/^\//, ''));
    } else {
      console.log(`⚠️ Supabase PostgREST returned status ${restRes.status}: ${await restRes.text()}`);
    }
  } catch (e) {
    console.error(`❌ Cannot connect to Supabase PostgREST: ${e.message}`);
  }

  // 3. Schema Check
  console.log('-'.repeat(60));
  const expectedTables = ['profiles', 'progress', 'flows', 'projects', 'custom_levels', 'shares', 'level_solutions'];
  console.log('📋 Database Tables Status:');
  expectedTables.forEach(t => {
    const exists = tables.includes(t);
    console.log(`   ${exists ? '✅' : '⬜'} ${t}: ${exists ? 'Ready' : 'Not yet created (run migration)'}`);
  });

  console.log('='.repeat(60));
  if (authOk && restOk) {
    console.log('✨ ผลลัพธ์: การเชื่อมต่อ Supabase สำเร็จสมบูรณ์!');
    if (tables.length === 0) {
      console.log('💡 คำแนะนำ: นำโค้ด SQL ใน supabase/migrations/20261021_init_schema.sql');
      console.log('   ไปวางและกด Run ใน Supabase Dashboard -> SQL Editor เพื่อสร้างตารางทั้งหมด');
    }
  } else {
    console.log('❌ ผลลัพธ์: ไม่สามารถเชื่อมต่อ Supabase บางส่วนได้ กรุณาตรวจสอบ URL และ Key ใน .env');
  }
  console.log('='.repeat(60));
}

if (require.main === module) {
  checkSupabase().catch(console.error);
}

module.exports = { checkSupabase };

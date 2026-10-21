// รัน: node tests/phase5b_backend_api.test.js
// ทดสอบ Phase 5b: Backend API Server + SQLite
const assert = require('assert');
const http = require('node:http');
const { createServer } = require('../backend/api_server.js');
const { initDb } = require('../backend/db.js');

let failed = 0;
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => console.log(`  ok   ${name}`))
    .catch((e) => {
      failed++;
      console.log(`  FAIL ${name}\n       ${e.message}`);
    });
}

function request(port, path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(`http://127.0.0.1:${port}${path}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

async function runTests() {
  console.log('--- Phase 5b: Backend API & SQLite Testing ---');

  // ใช้ in-memory database สำหรับการทดสอบ
  const testDb = initDb(':memory:');
  const { server } = createServer(testDb);

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  let studentToken = '';
  let teacherToken = '';

  await test('GET /api/health ตอบกลับสถานะระบบถูกต้อง', async () => {
    const res = await request(port, '/api/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ok, true);
    assert.strictEqual(res.body.phase, '5b');
  });

  await test('POST /api/auth/register สามารถสร้างผู้ใช้ใหม่และได้ Token', async () => {
    const res = await request(port, '/api/auth/register', {
      method: 'POST',
      body: {
        username: 'alice_student',
        password: 'password123',
        displayName: 'Alice Student',
        role: 'student'
      }
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.ok, true);
    assert.ok(res.body.token);
    assert.strictEqual(res.body.user.username, 'alice_student');
    studentToken = res.body.token;
  });

  await test('POST /api/auth/login เข้าสู่ระบบด้วยบัญชีเริ่มต้น (Teacher Demo)', async () => {
    const res = await request(port, '/api/auth/login', {
      method: 'POST',
      body: { username: 'teacher', password: 'teacher123' }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ok, true);
    assert.strictEqual(res.body.user.role, 'teacher');
    teacherToken = res.body.token;
  });

  await test('GET /api/levels ซ่อนเฉลย (template) จากนักเรียน เพื่อความปลอดภัย', async () => {
    const resStudent = await request(port, '/api/levels', {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert.strictEqual(resStudent.status, 200);
    const hasTemplateStudent = resStudent.body.levels.some(l => l.template !== undefined);
    assert.strictEqual(hasTemplateStudent, false, 'นักเรียนต้องมองไม่เห็น template');

    const resTeacher = await request(port, '/api/levels', {
      headers: { Authorization: `Bearer ${teacherToken}` }
    });
    assert.strictEqual(resTeacher.status, 200);
    const hasTemplateTeacher = resTeacher.body.levels.some(l => l.template !== undefined);
    assert.strictEqual(hasTemplateTeacher, true, 'อาจารย์ต้องมองเห็น template');
  });

  await test('POST /api/levels/:id/check ตรวจคำตอบที่ Server ด้วยเฉลยที่ซ่อนอยู่ (Level 1)', async () => {
    const { LEVELS } = require('../shared/levels.js');
    const validFlowL1 = LEVELS.find(l => l.id === 1).template;

    const resValid = await request(port, '/api/levels/1/check', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: { flow: validFlowL1 }
    });
    assert.strictEqual(resValid.status, 200);
    assert.strictEqual(resValid.body.passed, true, 'Flow ที่ถูกเกณฑ์ต้องผ่าน');

    // กระดานเปล่าต้องไม่ผ่าน
    const resEmpty = await request(port, '/api/levels/1/check', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: { flow: { nodes: [], connections: [] } }
    });
    assert.strictEqual(resEmpty.status, 200);
    assert.strictEqual(resEmpty.body.passed, false, 'กระดานเปล่าต้องไม่ผ่าน');
  });

  await test('GET /api/progress บันทึกผลด่านที่ผ่านแล้วของนักเรียนใน SQLite', async () => {
    const res = await request(port, '/api/progress', {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.passed.includes(1), 'ด่าน 1 ต้องอยู่ในรายการ passed');
  });

  await test('PUT & GET /api/levels/:id/flow สามารถบันทึกและโหลด Flow ของผู้เรียนได้', async () => {
    const sampleFlow = {
      nodes: [{ id: 10, type: 'trigger_chat', config: {}, x: 100, y: 100 }],
      connections: [],
      nextNodeId: 11
    };
    const putRes = await request(port, '/api/levels/2/flow', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: sampleFlow
    });
    assert.strictEqual(putRes.status, 200);

    const getRes = await request(port, '/api/levels/2/flow', {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert.strictEqual(getRes.status, 200);
    assert.strictEqual(getRes.body.flow.nodes[0].id, 10);
  });

  await test('Studio Projects CRUD บน Server', async () => {
    // 1. Create project
    const createRes = await request(port, '/api/projects', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: { name: 'ระบบแจ้งเตือนออเดอร์', flow: { nodes: [], connections: [] } }
    });
    assert.strictEqual(createRes.status, 201);
    const projId = createRes.body.project.id;

    // 2. List projects
    const listRes = await request(port, '/api/projects', {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert.strictEqual(listRes.status, 200);
    assert.ok(listRes.body.projects.some(p => p.id === projId));

    // 3. Delete project
    const delRes = await request(port, `/api/projects/${projId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert.strictEqual(delRes.status, 200);
  });

  await test('ระบบแชร์ Flow ผ่าน Short Link (POST & GET /api/share)', async () => {
    const shareData = {
      type: 'project',
      title: 'Flow ส่งการบ้าน',
      data: { nodes: [{ id: 1, type: 'trigger_webhook', config: {} }], connections: [] }
    };
    const shareRes = await request(port, '/api/share', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: shareData
    });
    assert.strictEqual(shareRes.status, 201);
    assert.ok(shareRes.body.code);

    const fetchShare = await request(port, `/api/share/${shareRes.body.code}`);
    assert.strictEqual(fetchShare.status, 200);
    assert.strictEqual(fetchShare.body.title, 'Flow ส่งการบ้าน');
    assert.strictEqual(fetchShare.body.author, 'Alice Student');
  });

  await test('Teacher Classroom Dashboard (GET /api/teacher/overview)', async () => {
    // นักเรียนธรรมดาไม่มีสิทธิ์ดู
    const studentAccess = await request(port, '/api/teacher/overview', {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert.strictEqual(studentAccess.status, 403, 'นักเรียนต้องถูกปฏิเสธ (403)');

    // อาจารย์เข้าดูได้
    const teacherAccess = await request(port, '/api/teacher/overview', {
      headers: { Authorization: `Bearer ${teacherToken}` }
    });
    assert.strictEqual(teacherAccess.status, 200);
    assert.ok(teacherAccess.body.totalStudents >= 1);
    assert.ok(Array.isArray(teacherAccess.body.students));
    assert.ok(Array.isArray(teacherAccess.body.levelStats));
  });

  server.close();

  if (failed > 0) {
    console.log(`\n❌ Failed tests: ${failed}`);
    process.exit(1);
  } else {
    console.log('\n✅ All Phase 5b Backend API & SQLite tests passed!');
  }
}

runTests();

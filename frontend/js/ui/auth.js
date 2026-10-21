// ---------------------------------------------------------
// AUTHENTICATION, BACKEND (REMOTE / SUPABASE) & TEACHER DASHBOARD UI
// ---------------------------------------------------------

function getAuthActiveApi() {
  const mode = getApiMode();
  if (mode === 'supabase' && typeof SupabaseApi !== 'undefined') return SupabaseApi;
  if (mode === 'remote') return RemoteApi;
  return LocalApi;
}

async function initAuthAndBackendUi() {
  handleAuthRedirectErrors(); // ลิงก์ในอีเมลหมดอายุ/ใช้แล้ว → แจ้งเป็นภาษาไทย
  const mode = getApiMode();
  if (mode === 'remote') {
    try {
      await RemoteApi.getMe();
    } catch (e) {}
  } else if (mode === 'supabase' && typeof SupabaseApi !== 'undefined') {
    try {
      await SupabaseApi.getMe();
    } catch (e) {}
  }

  updateBackendStatusUi();

  // ตรวจสอบว่ามี ?share=CODE ใน URL หรือไม่
  checkIncomingShare();
}

// ป้ายสถานะโหมดการเชื่อมต่อ/ผู้ใช้ — แสดงแบบกะทัดรัด (ไอคอน + ชื่อสั้น) ชี้เมาส์แล้วมีรายละเอียดเด้งออกมา
function backendBadgeHtml({ icon, label, tip, tone }) {
  const tones = {
    ok: 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60',
    info: 'bg-cyan-950/50 border-cyan-500/30 text-cyan-300 hover:bg-cyan-900/50',
    warn: 'bg-amber-950/50 border-amber-500/30 text-amber-300 hover:bg-amber-900/50',
    local: 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
  };
  return `
    <button type="button" onclick="openAuthModal()" aria-label="${escapeHtml(tip.split('\n')[0])}" data-tip="${escapeHtml(tip)}" data-tip-edge="right"
      class="tip h-8 px-2.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap ${tones[tone]}">
      <span>${icon}</span>
      ${label ? `<span class="hidden xl:inline truncate max-w-[110px]">${escapeHtml(label)}</span>` : ''}
    </button>
  `;
}

function updateBackendStatusUi() {
  const badge = document.getElementById('backend-status-badge');
  if (!badge) return;

  const mode = getApiMode();
  const api = getAuthActiveApi();
  const user = api.getCurrentUser ? api.getCurrentUser() : null;
  const name = user ? (user.displayName || user.username) : '';
  const isTeacher = !!user && user.role === 'teacher';

  if (mode === 'supabase' && user) {
    badge.innerHTML = backendBadgeHtml({ icon: '☁️', label: name, tone: 'ok', tip: `${name}${isTeacher ? ' (ผู้สอน)' : ''}\nเชื่อมต่อ Supabase Cloud แล้ว\nคลิกเพื่อดูบัญชี / สลับโหมด` });
  } else if (mode === 'supabase') {
    badge.innerHTML = backendBadgeHtml({ icon: '☁️', label: 'ยังไม่ล็อกอิน', tone: 'info', tip: 'Supabase — ยังไม่ล็อกอิน\nคลิกเพื่อล็อกอิน / สมัครสมาชิก' });
  } else if (mode === 'remote' && user) {
    badge.innerHTML = backendBadgeHtml({ icon: isTeacher ? '👨‍🏫' : '🧑‍🎓', label: name, tone: 'ok', tip: `${name} (${isTeacher ? 'ผู้สอน' : 'นักเรียน'})\nเชื่อมต่อ API Server แล้ว\nคลิกเพื่อดูบัญชี / สลับโหมด` });
  } else if (mode === 'remote') {
    badge.innerHTML = backendBadgeHtml({ icon: '🌐', label: 'ยังไม่ล็อกอิน', tone: 'warn', tip: 'API Server — ยังไม่ล็อกอิน\nคลิกเพื่อล็อกอิน / สมัครสมาชิก' });
  } else {
    badge.innerHTML = backendBadgeHtml({ icon: '💻', label: 'โหมดเครื่อง', tone: 'local', tip: 'โหมดเครื่อง (Local)\nข้อมูลเก็บในเบราว์เซอร์นี้เท่านั้น\nคลิกเพื่อล็อกอิน / สลับไปใช้เซิร์ฟเวอร์' });
  }
}

function openAuthModal() {
  const modal = document.getElementById('auth-modal');
  const mode = getApiMode();
  const api = getAuthActiveApi();
  const user = api.getCurrentUser ? api.getCurrentUser() : null;

  document.getElementById('auth-recovery-view')?.classList.add('hidden');
  document.getElementById('auth-user-view').classList.toggle('hidden', !user);
  document.getElementById('auth-login-view').classList.toggle('hidden', !!user);
  applyAuthFormsForMode();
  hideAuthMessages();

  if (user) {
    document.getElementById('auth-logged-name').textContent = user.displayName || user.username;
    document.getElementById('auth-logged-role').textContent = user.role === 'teacher' ? '👨‍🏫 ผู้สอน (Teacher)' : '🧑‍🎓 นักเรียน (Student)';
    const teacherBtn = document.getElementById('auth-teacher-dash-btn');
    if (teacherBtn) teacherBtn.classList.toggle('hidden', user.role !== 'teacher');

    const emailEl = document.getElementById('auth-logged-email');
    if (emailEl) {
      emailEl.textContent = user.email || '';
      emailEl.classList.toggle('hidden', !user.email);
    }
    // ช่องกรอกรหัสผู้สอน: เฉพาะโหมด Supabase และบัญชีที่ยังเป็นนักเรียน
    document.getElementById('claim-teacher-box')?.classList.toggle('hidden', !(isSupabaseAuthMode() && user.role !== 'teacher'));
  }

  // Radio button mode
  const localRadio = document.getElementById('backend-mode-local');
  const remoteRadio = document.getElementById('backend-mode-remote');
  const supabaseRadio = document.getElementById('backend-mode-supabase');
  if (localRadio) localRadio.checked = mode === 'local';
  if (remoteRadio) remoteRadio.checked = mode === 'remote';
  if (supabaseRadio) supabaseRadio.checked = mode === 'supabase';

  modal.classList.remove('hidden');
}

function closeAuthModal() {
  document.getElementById('auth-modal').classList.add('hidden');
}

function switchAuthTab(tab) {
  document.getElementById('auth-tab-login').classList.toggle('hidden', tab !== 'login');
  document.getElementById('auth-tab-register').classList.toggle('hidden', tab !== 'register');

  document.getElementById('btn-tab-login').className = tab === 'login'
    ? 'flex-1 py-2 text-xs font-bold text-white border-b-2 border-indigo-500'
    : 'flex-1 py-2 text-xs text-slate-400 hover:text-white font-medium';
  document.getElementById('btn-tab-register').className = tab === 'register'
    ? 'flex-1 py-2 text-xs font-bold text-white border-b-2 border-indigo-500'
    : 'flex-1 py-2 text-xs text-slate-400 hover:text-white font-medium';
}

// ---------------------------------------------------------
// ฟอร์มล็อกอิน/สมัคร: โหมด Supabase ใช้ "อีเมลจริง + ยืนยันอีเมล + ลืมรหัสผ่านทางอีเมล"
// โหมด Local/Remote (Node API) ยังใช้ชื่อผู้ใช้ตามเดิม
// ---------------------------------------------------------
let pendingConfirmEmail = ''; // อีเมลที่รอยืนยัน (ไว้ใช้กับปุ่ม "ส่งอีเมลยืนยันอีกครั้ง")

function isSupabaseAuthMode() {
  return getApiMode() === 'supabase' && typeof SupabaseApi !== 'undefined';
}

// ปรับป้ายชื่อ/ชนิดช่องกรอก/ปุ่มให้ตรงกับโหมดที่ใช้อยู่
function applyAuthFormsForMode() {
  const sb = isSupabaseAuthMode();
  const setField = (id, labelId, labelText, type, placeholder, autocomplete) => {
    const input = document.getElementById(id);
    const label = document.getElementById(labelId);
    if (label) label.textContent = labelText;
    if (input) {
      input.type = type;
      input.placeholder = placeholder;
      input.autocomplete = autocomplete;
    }
  };

  setField('login-username', 'login-id-label', sb ? 'อีเมล (Email):' : 'ชื่อผู้ใช้ (Username):', sb ? 'email' : 'text', sb ? 'name@example.com' : '', sb ? 'email' : 'username');
  setField('reg-username', 'reg-id-label', sb ? 'อีเมล (Email) — ต้องเป็นอีเมลจริงที่รับข้อความได้:' : 'ชื่อผู้ใช้ (Username):', sb ? 'email' : 'text', sb ? 'name@example.com' : 'ตัวอักษรภาษาอังกฤษหรือตัวเลข', sb ? 'email' : 'username');

  const regPass = document.getElementById('reg-password');
  if (regPass) {
    regPass.minLength = sb ? SUPABASE_MIN_PASSWORD : 6;
    regPass.placeholder = `อย่างน้อย ${sb ? SUPABASE_MIN_PASSWORD : 6} ตัวอักษร`;
    regPass.autocomplete = 'new-password';
  }

  // โหมด Supabase: ทุกคนสมัครเป็นนักเรียน แล้วค่อยกรอกรหัสผู้สอนหลังล็อกอิน (ที่หน้าบัญชี) — ซ่อนช่องบทบาท/รหัสผู้สอนในฟอร์มสมัคร
  document.getElementById('reg-role-group')?.classList.toggle('hidden', sb);
  document.getElementById('reg-teacher-code-box')?.classList.add('hidden');
  const roleSel = document.getElementById('reg-role');
  if (roleSel && sb) roleSel.value = 'student';

  document.getElementById('forgot-password-row')?.classList.toggle('hidden', !sb);
  document.getElementById('demo-login-box')?.classList.toggle('hidden', sb); // บัญชี Demo เป็นของ API Server เท่านั้น
  const submit = document.getElementById('login-submit-btn');
  if (submit) submit.textContent = sb ? 'เข้าสู่ระบบ' : 'เข้าสู่ระบบเซิร์ฟเวอร์';
}

function hideAuthMessages() {
  document.getElementById('auth-error-msg')?.classList.add('hidden');
  document.getElementById('auth-info-msg')?.classList.add('hidden');
}

// แสดงข้อความ (ใช้ textContent ทั้งหมด — ข้อความมาจากเซิร์ฟเวอร์/ผู้ใช้ จึงไม่ใส่ HTML)
// opts.resendEmail: แนบปุ่ม "ส่งอีเมลยืนยันอีกครั้ง"
function showAuthMessage(boxId, message, opts = {}) {
  const other = document.getElementById(boxId === 'auth-error-msg' ? 'auth-info-msg' : 'auth-error-msg');
  if (other) other.classList.add('hidden');
  const box = document.getElementById(boxId);
  if (!box) return;
  box.textContent = boxId === 'auth-error-msg' ? `❌ ${message}` : `✉️ ${message}`;
  if (opts.resendEmail) {
    pendingConfirmEmail = opts.resendEmail;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'ส่งอีเมลยืนยันอีกครั้ง';
    btn.className = 'block mt-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-semibold cursor-pointer';
    btn.addEventListener('click', handleResendConfirmation);
    box.appendChild(btn);
  }
  box.classList.remove('hidden');
}
const showAuthError = (message, opts) => showAuthMessage('auth-error-msg', message, opts);
const showAuthInfo = (message, opts) => showAuthMessage('auth-info-msg', message, opts);

async function handleLogin(e) {
  if (e) e.preventDefault();
  const userEl = document.getElementById('login-username');
  const passEl = document.getElementById('login-password');

  try {
    hideAuthMessages();
    if (isSupabaseAuthMode()) {
      const res = await SupabaseApi.login(userEl.value, passEl.value);
      if (!res.user) throw new Error('เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่');
    } else {
      await RemoteApi.login(userEl.value.trim(), passEl.value);
      setApiMode('remote');
    }
    closeAuthModal();
    alert('เข้าสู่ระบบสำเร็จเรียบร้อยแล้ว!');
    location.reload();
  } catch (err) {
    showAuthError(err.message, err.code === 'email_not_confirmed' ? { resendEmail: userEl.value.trim() } : {});
  }
}

async function handleRegister(e) {
  if (e) e.preventDefault();
  const userEl = document.getElementById('reg-username');
  const passEl = document.getElementById('reg-password');
  const nameEl = document.getElementById('reg-displayname');
  const roleEl = document.getElementById('reg-role');

  try {
    hideAuthMessages();
    if (isSupabaseAuthMode()) {
      const res = await SupabaseApi.register(userEl.value, passEl.value, nameEl.value);
      if (res.needsConfirmation) {
        // ยังไม่ถือว่าล็อกอิน: ต้องกดลิงก์ยืนยันในอีเมลก่อน (ข้อความเดียวกันไม่ว่าอีเมลนั้นเคยสมัครไว้หรือไม่)
        passEl.value = '';
        switchAuthTab('login');
        document.getElementById('login-username').value = res.email;
        showAuthInfo(`ถ้าอีเมล ${res.email} ใช้สมัครได้ เราส่งลิงก์ยืนยันไปให้แล้ว — เปิดอีเมล (ตรวจโฟลเดอร์สแปมด้วย) กดลิงก์ แล้วกลับมาเข้าสู่ระบบ`, { resendEmail: res.email });
        return;
      }
      closeAuthModal();
      alert('สมัครสมาชิกและเข้าสู่ระบบเรียบร้อยแล้ว!');
      location.reload();
      return;
    }

    const teacherCode = roleEl.value === 'teacher' ? document.getElementById('reg-teacher-code').value : '';
    await RemoteApi.register(userEl.value.trim(), passEl.value, nameEl.value.trim(), teacherCode);
    setApiMode('remote');
    closeAuthModal();
    alert('สมัครสมาชิกและเข้าสู่ระบบเรียบร้อยแล้ว!');
    location.reload();
  } catch (err) {
    showAuthError(err.message);
  }
}

async function handleResendConfirmation() {
  try {
    await SupabaseApi.resendConfirmation(pendingConfirmEmail);
    showAuthInfo(`ส่งอีเมลยืนยันไปที่ ${pendingConfirmEmail} อีกครั้งแล้ว (ถ้ายังไม่พบ รอสักครู่และตรวจโฟลเดอร์สแปม)`);
  } catch (err) {
    showAuthError(err.message);
  }
}

// ลืมรหัสผ่าน: ส่งลิงก์ตั้งรหัสใหม่ไปที่อีเมลในช่องล็อกอิน — ตอบเหมือนกันไม่ว่าอีเมลนั้นมีบัญชีหรือไม่
async function handleForgotPassword() {
  const email = document.getElementById('login-username').value;
  try {
    hideAuthMessages();
    if (!String(email).trim()) {
      showAuthError('กรอกอีเมลของคุณในช่องด้านบนก่อน แล้วกด "ลืมรหัสผ่าน"');
      return;
    }
    const res = await SupabaseApi.requestPasswordReset(email);
    showAuthInfo(`ถ้า ${res.email} มีบัญชีอยู่ เราส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้แล้ว — เปิดอีเมลแล้วกดลิงก์ (ลิงก์มีอายุจำกัด)`);
  } catch (err) {
    showAuthError(err.message);
  }
}

// หลังกดลิงก์รีเซ็ตรหัสผ่านในอีเมล → เปิดหน้าตั้งรหัสผ่านใหม่
function openRecoveryView() {
  const modal = document.getElementById('auth-modal');
  ['auth-user-view', 'auth-login-view'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
  document.getElementById('auth-recovery-view')?.classList.remove('hidden');
  modal?.classList.remove('hidden');
}

async function handleRecoverySubmit(e) {
  if (e) e.preventDefault();
  const p1 = document.getElementById('recovery-password').value;
  const p2 = document.getElementById('recovery-password2').value;
  const errEl = document.getElementById('recovery-error-msg');
  const fail = (msg) => { errEl.textContent = `❌ ${msg}`; errEl.classList.remove('hidden'); };
  errEl.classList.add('hidden');

  if (p1 !== p2) return fail('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
  try {
    await SupabaseApi.updatePassword(p1);
    history.replaceState(null, '', window.location.pathname); // ล้าง token ออกจาก URL
    alert('ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว! คุณเข้าสู่ระบบอยู่');
    location.reload();
  } catch (err) {
    fail(err.message);
  }
}

// ผู้ที่ล็อกอินแล้วกรอกรหัสผู้สอน — ฐานข้อมูลตรวจรหัสและจำกัดการเดา (ไม่ตรวจรหัสในหน้าเว็บ)
async function handleClaimTeacher() {
  const input = document.getElementById('claim-teacher-code');
  try {
    const ok = await SupabaseApi.claimTeacher(input.value);
    input.value = '';
    if (ok) {
      alert('ยืนยันรหัสสำเร็จ — บัญชีนี้เป็นผู้สอนแล้ว');
      location.reload();
    } else {
      alert('รหัสผู้สอนไม่ถูกต้อง');
    }
  } catch (err) {
    alert(err.message);
  }
}

// กดลิงก์ในอีเมลแล้วเจอปัญหา (ลิงก์หมดอายุ/ถูกใช้แล้ว) Supabase จะพากลับมาพร้อม error ใน URL — แปลเป็นข้อความไทยแล้วล้างออกจาก URL
function handleAuthRedirectErrors() {
  const params = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
  const query = new URLSearchParams(window.location.search || '');
  const code = params.get('error_code') || query.get('error_code');
  if (!code) return;
  const message = SUPABASE_AUTH_ERRORS[code] || 'ลิงก์จากอีเมลใช้ไม่ได้ กรุณาขอลิงก์ใหม่';
  history.replaceState(null, '', window.location.pathname);
  setTimeout(() => alert(`⚠️ ${message}`), 400);
}

window.addEventListener('supabase-password-recovery', openRecoveryView);

async function quickLoginDemo(role) {
  const userEl = document.getElementById('login-username');
  const passEl = document.getElementById('login-password');
  if (role === 'teacher') {
    userEl.value = 'teacher';
    passEl.value = 'teacher123';
  } else {
    userEl.value = 'student';
    passEl.value = 'student123';
  }
  await handleLogin();
}

async function handleLogout() {
  const api = getAuthActiveApi();
  if (api.logout) {
    await api.logout();
  }
  updateBackendStatusUi();
  closeAuthModal();
  alert('ออกจากระบบเรียบร้อยแล้ว');
  location.reload();
}

function handleBackendModeChange(newMode) {
  setApiMode(newMode);
  updateBackendStatusUi();
  applyAuthFormsForMode(); // เปลี่ยนช่อง "ชื่อผู้ใช้" ↔ "อีเมล" ให้ตรงโหมดทันที
  if (newMode === 'supabase') {
    alert('สลับเป็นโหมด Supabase Cloud แล้ว (เชื่อมต่อฐานข้อมูลและ Auth บนคลาวด์)');
  } else if (newMode === 'remote') {
    alert('สลับเป็นโหมดเซิร์ฟเวอร์ Remote API แล้ว (บันทึกข้อมูลและตรวจคำตอบผ่าน Backend SQLite)');
  } else {
    alert('สลับเป็นโหมด LocalStorage แล้ว (ข้อมูลบันทึกในเบราว์เซอร์เครื่องนี้เท่านั้น)');
  }
}

// ซิงค์ข้อมูล Local ขึ้น Server / Supabase
async function handleSyncLocalToServer() {
  const api = getAuthActiveApi();
  const user = api.getCurrentUser ? api.getCurrentUser() : null;
  if (!user) {
    alert('กรุณาเข้าสู่ระบบก่อนทำการซิงค์ข้อมูลขึ้นเซิร์ฟเวอร์ครับ');
    return;
  }

  const modeName = getApiMode() === 'supabase' ? 'Supabase Cloud' : 'Server';
  if (!confirm(`คุณต้องการนำ Flow และโปรเจกต์จากเครื่องนี้ (LocalStorage) ขึ้นไปบันทึกบนบัญชี ${modeName} ของคุณใช่หรือไม่?`)) return;

  try {
    const res = await api.syncLocalToServer();
    alert(`ซิงค์ข้อมูลสำเร็จ!\n• Flow ด่านที่ทำ: ${res.syncedLevels} ด่าน\n• โปรเจกต์ Studio: ${res.syncedProjects} โปรเจกต์\n• ด่านสร้างเอง: ${res.syncedCustom} ด่าน`);
  } catch (err) {
    alert(`การซิงค์ข้อมูลขัดข้อง: ${err.message}`);
  }
}

// ---------------------------------------------------------
// TEACHER CLASSROOM DASHBOARD MODAL
// ---------------------------------------------------------
async function openTeacherDashboard() {
  const modal = document.getElementById('teacher-modal');
  const body = document.getElementById('teacher-dashboard-body');
  body.innerHTML = '<div class="p-8 text-center text-slate-400">กำลังโหลดข้อมูลห้องเรียน...</div>';
  modal.classList.remove('hidden');

  try {
    const api = getAuthActiveApi();
    const data = await api.getTeacherOverview();
    renderTeacherDashboard(data);
  } catch (err) {
    body.innerHTML = `<div class="p-6 text-center text-rose-300">เกิดข้อผิดพลาด: ${err.message}</div>`;
  }
}

function closeTeacherDashboard() {
  document.getElementById('teacher-modal').classList.add('hidden');
}

function renderTeacherDashboard(data) {
  const body = document.getElementById('teacher-dashboard-body');
  const { totalStudents, totalLevels, students, levelStats } = data;

  body.innerHTML = `
    <div class="space-y-6 text-xs">
      
      <!-- SUMMARY CARDS -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div class="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
          <div class="text-[11px] text-slate-400 font-medium">จำนวนนักเรียนทั้งหมด</div>
          <div class="text-2xl font-extrabold text-white">${totalStudents} <span class="text-xs font-normal text-slate-400">คน</span></div>
        </div>
        <div class="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
          <div class="text-[11px] text-slate-400 font-medium">ด่านในระบบ</div>
          <div class="text-2xl font-extrabold text-indigo-400">${totalLevels} <span class="text-xs font-normal text-slate-400">ด่าน</span></div>
        </div>
        <div class="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
          <div class="text-[11px] text-slate-400 font-medium">การตรวจคำตอบ (ความคืบหน้า)</div>
          <div class="text-2xl font-extrabold text-emerald-400">
            ${students.length ? Math.round(students.reduce((acc, s) => acc + s.passed_count, 0) / (students.length * totalLevels) * 100) : 0}%
          </div>
        </div>
      </div>

      <!-- STUDENTS ROSTER TABLE -->
      <div class="space-y-2">
        <h3 class="font-bold text-sm text-white flex items-center gap-1.5">
          <span>🧑‍🎓</span> รายชื่อนักเรียนและความคืบหน้า
        </h3>
        <div class="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-900 border-b border-slate-800 text-slate-400">
              <tr>
                <th class="py-2.5 px-3">ชื่อนักเรียน</th>
                <th class="py-2.5 px-3">Username</th>
                <th class="py-2.5 px-3 text-center">ผ่านด่าน</th>
                <th class="py-2.5 px-3 text-center">คะแนนรวม</th>
                <th class="py-2.5 px-3 text-center">จำนวนครั้งที่ส่งตรวจ</th>
                <th class="py-2.5 px-3 text-right">ใช้งานล่าสุด</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/80 text-slate-300">
              ${students.length === 0 ? `
                <tr><td colspan="6" class="p-4 text-center text-slate-500">ยังไม่มีนักเรียนลงทะเบียนในระบบ</td></tr>
              ` : students.map(s => `
                <tr class="hover:bg-slate-900/40">
                  <td class="py-2.5 px-3 font-semibold text-white">${escapeHtml(s.display_name)}</td>
                  <td class="py-2.5 px-3 text-slate-400 font-mono-code">${escapeHtml(s.username)}</td>
                  <td class="py-2.5 px-3 text-center">
                    <span class="px-2 py-0.5 rounded-full font-bold ${s.passed_count === totalLevels ? 'bg-emerald-500/20 text-emerald-300' : 'bg-indigo-500/20 text-indigo-300'}">
                      ${s.passed_count}/${totalLevels}
                    </span>
                  </td>
                  <td class="py-2.5 px-3 text-center font-bold text-emerald-400">${s.total_score}</td>
                  <td class="py-2.5 px-3 text-center text-slate-400">${s.total_attempts}</td>
                  <td class="py-2.5 px-3 text-right text-slate-400 text-[11px]">
                    ${s.last_active ? new Date(s.last_active).toLocaleString('th-TH') : '-'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}

// ---------------------------------------------------------
// SHARE VIA SHORT LINK
// ---------------------------------------------------------
async function openShareStudioModal() {
  const modal = document.getElementById('share-modal');
  const inputEl = document.getElementById('share-url-input');
  const statusEl = document.getElementById('share-status-msg');

  statusEl.textContent = 'กำลังสร้างลิงก์สำหรับแชร์...';
  modal.classList.remove('hidden');

  try {
    const data = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      connections: JSON.parse(JSON.stringify(connections)),
      nextNodeId
    };
    const title = currentStudioProject ? currentStudioProject.name : 'Shared Workflow';
    const api = getAuthActiveApi();
    const res = await api.shareFlow('project', title, data);

    const fullUrl = `${window.location.origin}${window.location.pathname}?share=${res.code}`;
    inputEl.value = fullUrl;
    statusEl.innerHTML = `✅ ลิงก์แชร์พร้อมแล้ว! รหัสแชร์: <b>${res.code}</b>`;
  } catch (err) {
    statusEl.innerHTML = `❌ เกิดข้อผิดพลาด: ${escapeHtml(err.message)} (ต้องเปิด Backend API Server พอร์ต 8788 ก่อน)`;
  }
}

function closeShareModal() {
  document.getElementById('share-modal').classList.add('hidden');
}

function copyShareUrl() {
  const inputEl = document.getElementById('share-url-input');
  inputEl.select();
  navigator.clipboard.writeText(inputEl.value).then(() => {
    alert('คัดลอกลิงก์แชร์ลงใน Clipboard แล้ว!');
  }).catch(() => {
    document.execCommand('copy');
    alert('คัดลอกลิงก์แชร์แล้ว!');
  });
}

// ตรวจสอบเมื่อมีคนเปิดเข้ามาด้วยลิงก์ ?share=CODE
async function checkIncomingShare() {
  const params = new URLSearchParams(window.location.search);
  const shareCode = params.get('share');
  if (!shareCode) return;

  try {
    const api = getAuthActiveApi();
    const res = await api.getShare(shareCode);
    if (!res.ok) return;

    setTimeout(async () => {
      if (!confirm(`พบ Workflow ที่แชร์มา:\n"${res.title}" โดย ${res.author}\n\nต้องการเปิดในโหมดสตูดิโอ (Studio) เลยหรือไม่?`)) return;
      try {
        // ข้อมูลจากลิงก์เป็นข้อมูลที่ไม่น่าเชื่อถือ — ตรวจและทำความสะอาดก่อนนำขึ้นกระดานเสมอ
        const flow = sanitizeFlow(res.data, BLOCK_CATALOG, 'Flow ที่แชร์มา');
        await switchView('studio');
        nodes = flow.nodes;
        connections = flow.connections;
        nextNodeId = Math.max(0, ...nodes.map(n => n.id)) + 1;
        renderCanvas();
        renderInspector();
        centerCanvasView();
        if (typeof saveStudioProjectNow === 'function') {
          saveStudioProjectNow();
        }
      } catch (e) {
        alert(`เปิด Flow ที่แชร์มาไม่ได้: ${e.message}`);
      }
    }, 600);
  } catch (e) {
    console.warn('Cannot load shared flow:', e);
  }
}

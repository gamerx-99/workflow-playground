// ---------------------------------------------------------
// HOME VIEW (หน้าแรก / Dashboard สรุปภาพรวมและเลือกสายการเรียนรู้)
// ---------------------------------------------------------

async function renderHomeView() {
  const homeContainer = document.getElementById('view-home');
  if (!homeContainer) return;

  const passed = (await Api.getProgress()).passed;
  const allLevels = await Api.getLevels();
  const customLevels = await Api.getCustomLevels();

  // คำนวณความคืบหน้ารวมของด่านหลัก 30 ด่าน
  const coreLevels = LEVELS;
  const corePassed = passed.filter(id => coreLevels.some(l => l.id === id)).length;
  const totalCore = coreLevels.length;
  const corePercent = Math.round((corePassed / totalCore) * 100);

  // หาด่านถัดไปที่แนะนำให้เล่นต่อ
  const resumeId = TRACKS.flatMap(t => t.levelIds).find(id => !passed.includes(id));
  const resumeLevel = resumeId !== undefined ? allLevels.find(l => l.id === resumeId) : allLevels[0];

  // เตรียม Tracks รวมทั้ง Custom Track หากมีด่านสร้างเอง
  const displayTracks = [...TRACKS];
  if (customLevels.length > 0) {
    displayTracks.push({
      id: 'custom',
      icon: '🎓',
      name: 'ด่านสร้างเอง (Custom)',
      desc: 'ด่านแบบฝึกหัดที่คุณหรือเพื่อนสร้างขึ้นใน Studio',
      levelIds: customLevels.map(l => l.id)
    });
  }

  homeContainer.innerHTML = `
    <div class="max-w-6xl mx-auto px-4 py-8 space-y-8">
      
      <!-- HERO & OVERALL PROGRESS -->
      <section class="bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div class="absolute -right-10 -bottom-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div class="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div class="space-y-2 max-w-2xl">
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
              <span>⚡ Workflow Automation Lab</span>
              <span class="text-slate-500">•</span>
              <span>เวอร์ชันใหม่ Phase 4</span>
            </div>
            <h1 class="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              ที่ฝึกและที่ออกแบบระบบ <span class="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-indigo-300 to-purple-400">Workflow Automation</span>
            </h1>
            <p class="text-slate-300 text-xs sm:text-sm leading-relaxed">
              ฝึกฝนตั้งแต่พื้นฐานตัวแปร เงื่อนไข การจัดการข้อมูล วนลูป AI ไปจนถึงเคสธุรกิจจริง พร้อมสตูดิโออิสระสำหรับออกแบบและสร้างด่านแบ่งปันผู้อื่น
            </p>
          </div>

          <!-- RESUME / STATS CARD -->
          <div class="w-full lg:w-80 bg-slate-950/80 backdrop-blur border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3.5 shrink-0">
            <div class="flex items-center justify-between text-xs">
              <span class="text-slate-400 font-medium">ความคืบหน้ารวม</span>
              <span class="font-bold text-emerald-400">${corePassed}/${totalCore} ด่าน (${corePercent}%)</span>
            </div>
            <div class="h-2.5 rounded-full bg-slate-800 overflow-hidden">
              <div class="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-500" style="width: ${corePercent}%"></div>
            </div>

            <div class="pt-1">
              ${corePassed === totalCore ? `
                <div class="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-center text-xs text-emerald-300 font-semibold mb-2">
                  🎉 ผ่านครบทุกด่านหลักแล้ว!
                </div>
              ` : `
                <div class="text-[11px] text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <span class="text-amber-400">👉</span> แนะนำทำต่อ:
                  <b class="text-slate-200 truncate">${resumeLevel ? escapeHtml(resumeLevel.shortName) : ''}</b>
                </div>
              `}
              <div class="flex gap-2">
                <button onclick="switchView('practice', ${resumeLevel ? (typeof resumeLevel.id === 'string' ? `'${resumeLevel.id}'` : resumeLevel.id) : 1})" 
                  class="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer transition">
                  <span>▶ ${corePassed === totalCore ? 'ทบทวนด่าน' : 'เล่นต่อทันที'}</span>
                </button>
                <button onclick="openTour()" title="เปิดทัวร์แนะนำ" 
                  class="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 cursor-pointer transition">
                  ❓ ทัวร์
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- TRACKS GRID -->
      <section class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span>📚 สายการเรียนรู้ (5 หมวดหมู่)</span>
            </h2>
            <p class="text-xs text-slate-400">เลือกสายที่คุณสนใจ หรือกดเข้าทำด่านที่แนะนำ</p>
          </div>
          <button onclick="switchView('studio')" class="hidden sm:inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-medium">
            <span>🎨 ไปยังโหมดออกแบบ Studio ➔</span>
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          ${displayTracks.map(track => {
            const trackLevels = track.levelIds.map(id => allLevels.find(l => String(l.id) === String(id))).filter(Boolean);
            const doneCount = trackLevels.filter(l => passed.includes(l.id)).length;
            const trackPercent = trackLevels.length ? Math.round((doneCount / trackLevels.length) * 100) : 0;
            const firstUnfinished = trackLevels.find(l => !passed.includes(l.id));

            return `
              <div class="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 flex flex-col justify-between shadow-lg transition-all duration-200 hover:shadow-indigo-500/5">
                <div class="space-y-3">
                  <div class="flex items-start justify-between gap-2">
                    <div class="flex items-center gap-2.5">
                      <div class="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-xl shadow-inner">
                        ${track.icon}
                      </div>
                      <div>
                        <h3 class="font-bold text-sm text-white">${escapeHtml(track.name)}</h3>
                        <span class="text-[11px] text-slate-400">${doneCount}/${trackLevels.length} ด่าน (${trackPercent}%)</span>
                      </div>
                    </div>
                    <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full ${trackPercent === 100 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'}">
                      ${trackPercent === 100 ? '✅ ครบแล้ว' : `${trackPercent}%`}
                    </span>
                  </div>

                  <p class="text-xs text-slate-400 line-clamp-2 leading-relaxed">${escapeHtml(track.desc)}</p>

                  <div class="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div class="h-full bg-emerald-500 transition-all" style="width: ${trackPercent}%"></div>
                  </div>

                  <!-- Mini Level Pills List -->
                  <div class="pt-1 flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    ${trackLevels.map((lvl, idx) => {
                      const isPassed = passed.includes(lvl.id);
                      const isNext = firstUnfinished && firstUnfinished.id === lvl.id;
                      return `
                        <button onclick="switchView('practice', ${typeof lvl.id === 'string' ? `'${lvl.id}'` : lvl.id})"
                          class="px-2 py-1 rounded-lg text-[10px] font-medium border flex items-center gap-1 transition cursor-pointer ${
                            isPassed ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300 hover:border-emerald-400'
                            : isNext ? 'bg-amber-950/40 border-amber-500/40 text-amber-300 hover:border-amber-300 animate-pulse'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                          }" title="${escapeHtml(lvl.title)}">
                          <span>${isPassed ? '✅' : isNext ? '👉' : '▫️'}</span>
                          <span class="truncate max-w-[100px]">${escapeHtml(lvl.shortName)}</span>
                        </button>
                      `;
                    }).join('')}
                  </div>
                </div>

                <div class="pt-4 mt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <button onclick="switchView('practice', ${firstUnfinished ? (typeof firstUnfinished.id === 'string' ? `'${firstUnfinished.id}'` : firstUnfinished.id) : (typeof trackLevels[0].id === 'string' ? `'${trackLevels[0].id}'` : trackLevels[0].id)})"
                    class="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition">
                    <span>${doneCount === trackLevels.length ? '↺ ทบทวนสายนี้' : '▶ ลุยสายนี้'}</span>
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </section>

      <!-- STUDIO / CREATOR SPOTLIGHT -->
      <section class="bg-gradient-to-r from-slate-900 via-purple-950/30 to-slate-900 border border-purple-500/20 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div class="space-y-2 flex-1">
          <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/30 text-xs font-medium">
            <span>🎨 Studio & Level Creator</span>
          </div>
          <h3 class="text-lg font-bold text-white">ต้องการออกแบบ Flow อิสระ หรือสร้างด่านส่งให้เพื่อนเล่น?</h3>
          <p class="text-xs text-slate-300 leading-relaxed max-w-xl">
            ใช้โหมดสตูดิโอ (Studio) เพื่อต่อ Flow ได้ไม่จำกัด บันทึกได้หลายโปรเจกต์ นำเข้าและส่งออกเป็นไฟล์ JSON และมีตัวช่วยสร้างด่านแบบฝึกหัดพร้อมคำนวณเกณฑ์ตรวจคำตอบให้อัตโนมัติ!
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-3 shrink-0">
          <button onclick="switchView('studio')" 
            class="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 flex items-center gap-2 cursor-pointer transition">
            <span>🎨 เข้าสู่โหมด Studio</span>
          </button>
          <button onclick="openImportLevelModal()" 
            class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition">
            <span>📥 นำเข้าไฟล์ด่าน (.json)</span>
          </button>
        </div>
      </section>

    </div>
  `;
}

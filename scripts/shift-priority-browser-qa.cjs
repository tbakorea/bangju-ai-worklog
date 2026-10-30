const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    for (const width of [390, 820, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      await page.goto(process.env.WORKLOG_URL || 'http://127.0.0.1:8783/index.html');
      const attendance = await page.evaluate(() => {
        const employee = { id: 'qa-hwang', name: '황보동미', org: '비욘드 피트니스', workHours: '16:00-24:00' };
        // Reproduce stale earlier attendance overriding the agreed evening shift.
        const originalPattern = getRecentFitnessAttendanceStartPattern;
        getRecentFitnessAttendanceStartPattern = () => ({ minutes: 480, source: 'recent-pattern', samples: 8 });
        const log = { clockIn: '16:00', clockOut: '24:00', attendanceStatus: '퇴근' };
        const normal = getAttendanceStatusForLog(employee, log, todayKey);
        const late = getAttendanceStatusForLog(employee, { ...log, clockIn: '16:10' }, todayKey);
        const dailyOverride = getAttendanceStatusForLog(employee, { ...log, workHoursOverride: '17:00-24:00', clockIn: '17:00' }, todayKey);
        const coverageStart = getAttendanceExpectedStart({ ...employee, id: 'qa-coverage', workHours: '06:00-24:00' }, {}, todayKey).minutes;
        getRecentFitnessAttendanceStartPattern = () => null;
        const unknownCoverage = getAttendanceExpectedStart({ ...employee, id: 'qa-coverage', workHours: '06:00-24:00' }, {}, todayKey);
        getRecentFitnessAttendanceStartPattern = originalPattern;
        return { normal, late, dailyOverride, coverageStart, unknownCoverage, midnight: timeToMinutes('24:00') };
      });
      assert.equal(attendance.normal, '정상');
      assert.equal(attendance.late, '지각');
      assert.equal(attendance.dailyOverride, '정상');
      assert.equal(attendance.coverageStart, 480);
      assert.equal(attendance.unknownCoverage, null);
      assert.equal(attendance.midnight, 1440);
      for (const view of ['bangju-log', 'fitness-log']) {
        const sizes = await page.evaluate(view => {
          authState.user = { id: 'qa-employee', email: 'qa@example.test' };
          state.profile = { ...state.profile, name: view === 'fitness-log' ? '황보동미' : '검증직원', nickname: '', email: 'qa@example.test', org: view === 'fitness-log' ? '비욘드 피트니스' : '(주)방주', workplace: view === 'fitness-log' ? '비욘드 피트니스' : '재무', primaryWork: view === 'fitness-log' ? '고객응대' : '재무', role: view === 'fitness-log' ? '인포데스크' : '직원', workHours: '16:00-24:00', approvalStatus: 'approved', accessPreset: 'employee', permissions: {} };
          state.selectedEmployeeId = 'profile-user';
          normalizeState();
          switchView(view);
          const board = document.getElementById(view === 'fitness-log' ? 'fitnessTaskBoard' : 'worklogTaskBoard');
          board.innerHTML = ['진행중', '위임', '연기', '취소', 'A'].map(status => `<div class="task-row"><button class="task-cycle">○</button><div class="task-status-cell">${renderTaskMetaControl({ status, priority: status === 'A' ? 'A' : '?' })}</div><div class="task-text-cell"><input class="task-text-input" value="직원 우선업무 확인" /></div><button class="task-delete">×</button></div>`).join('');
          return [...board.querySelectorAll('select')].map(select => {
            const style = getComputedStyle(select);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
            const r = select.getBoundingClientRect();
            const text = select.closest('.task-row').querySelector('.task-text-cell').getBoundingClientRect();
            return { label: select.value, font: parseFloat(style.fontSize), fits: ctx.measureText(select.value).width + 2 <= r.width, overlaps: r.right > text.left + 1, visible: r.width > 0 };
          });
        }, view);
        for (const size of sizes) {
          assert.equal(size.visible, true, `${width}/${view}/${size.label}: visible`);
          assert.equal(size.fits, true, `${width}/${view}/${size.label}: text fits`);
          assert.equal(size.overlaps, false, `${width}/${view}/${size.label}: adjacent task`);
          if (size.label !== 'A') assert.ok(size.font <= 12);
        }
        await page.screenshot({ path: `/tmp/shift-priority-${view}-${width}.png` });
      }
      console.log(`Shift/priority QA passed (${width}px): Korean labels fit, no overlap; 16:00-24:00 normal, real lateness retained`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });

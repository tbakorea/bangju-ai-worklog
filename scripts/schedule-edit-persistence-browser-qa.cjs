const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { existsSync } = require('node:fs');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'].find(existsSync), headless: true });
  try {
    for (const width of [390, 820, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      if (process.env.BASELINE_APP) await page.route('**/app.js*', route => route.fulfill({ path: process.env.BASELINE_APP, contentType: 'text/javascript' }));
      await page.goto(process.env.WORKLOG_URL || 'http://127.0.0.1:8782/index.html');
      const result = await page.evaluate(() => window.eval(`(() => {
        // Isolate persistence from authentication/network; permission UI is covered
        // by visual-smoke. Use the actual dialog, input handlers and local storage.
        canEditCurrentWorklog = () => true;
        guardWorklogEdit = () => true;
        confirmWorklogEventDeletion = () => true;
        promptAttendanceBeforeWorklogInput = () => {};
        scheduleRemoteSave = () => {};
        rerenderScheduleAfterFitnessEdit = () => {};
        renderReport = () => {};
        const date = getActiveDateKey();
        const results = [];
        for (const view of ['fitness-log', 'worklog']) {
          const log = getSelectedLog();
          const entry = log.schedule[0];
          entry.items = [createScheduleItem('기존 업무')];
          syncScheduleEntryText(entry);
          openScheduleTypeEditor(entry, log, view);
          // Background read replaces the stored log while the dialog is open.
          const replacement = JSON.parse(JSON.stringify(log));
          state.employeeLogs[date][log.employeeId] = replacement;
          fitnessScheduleEditorState.selectedType = '업무';
          document.getElementById('fitnessScheduleEditorText').value = '동기화 후 추가';
          document.getElementById('fitnessScheduleEditorText').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true }));
          results.push(document.getElementById('fitnessScheduleEditorText').value === '동기화 후 추가');
          addFitnessScheduleEditorItem({ close: false });
          const live = replacement.schedule.find(row => row.time === entry.time);
          results.push(live.items.some(item => item.text === '동기화 후 추가'));
          results.push(JSON.parse(localStorage.getItem(storageKey)).employeeLogs[date][log.employeeId].schedule.some(row => row.items.some(item => item.text === '동기화 후 추가')));
          // A read/summary normalization must not detach the delete handler array.
          getScheduleEntryText(live);
          document.querySelector('[data-remove-schedule-item="0"]').click();
          results.push(!live.items.some(item => item.text === '기존 업무'));
          closeFitnessScheduleEditor();
          const row = renderAppointmentRow(live, replacement);
          document.body.append(row);
          const newer = JSON.parse(JSON.stringify(replacement));
          state.employeeLogs[date][log.employeeId] = newer;
          const input = row.querySelector('input');
          input.value = '직접입력 유지';
          input.dispatchEvent(new Event('input'));
          flushDeferredStateSave();
          results.push(newer.schedule.some(row => row.items.some(item => item.text === '직접입력 유지')));
          row.querySelector('.schedule-item-delete').click();
          results.push(!newer.schedule.some(row => row.items.some(item => item.text === '직접입력 유지')));
          row.remove();
        }
        cancelDeferredInputRenders();
        return results;
      })()`));
      assert.ok(result.every(Boolean), `${width}px: ${JSON.stringify(result)}`);
      console.log(`PASS ${width}px: fitness/shared dialog + inline input, hydration, deletion, local persistence`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

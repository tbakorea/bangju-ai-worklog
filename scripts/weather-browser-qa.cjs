const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    for (const width of [390, 820, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      await page.goto(process.env.WORKLOG_URL || 'http://127.0.0.1:8782/index.html');
      const result = await page.evaluate(async () => {
        authState.user = { id: 'weather-qa', email: 'weather@example.test' };
        state.profile = { ...state.profile, org: '(주)방주', role: '직원', approvalStatus: 'approved', accessPreset: 'employee' };
        state.selectedEmployeeId = 'bangju-finance-manager';
        state.selectedDateKey = todayKey;
        const site = getSiteWeatherKeyForEmployee(getSelectedEmployee());
        state.siteWeatherAddresses[site] = '울산광역시 남구';
        applyRemoteWeatherForDate(null, todayKey, authState.user.id);
        let calls = 0;
        let response = { current: { weather_code: 2 }, daily: { time: [todayKey], temperature_2m_min: [-3], temperature_2m_max: [0] } };
        const originalFetch = window.fetch;
        window.fetch = async () => { calls++; if (response instanceof Error) throw response; return { ok: true, json: async () => response }; };
        const captured = [];
        const originalFrom = supabaseClient.from;
        supabaseClient.from = () => ({ upsert: async row => { captured.push(JSON.parse(JSON.stringify(row))); return { error: null }; } });
        const fetching = requestWeatherForSite(site, getSiteWeatherAddress(site), todayKey, { silent: true, scope: '' });
        state.selectedDateKey = '2026-01-01';
        const record = await fetching;
        const range = formatWeatherTemperatureRange(record);
        const previous = JSON.stringify(record);
        response = new Error('offline');
        await requestWeatherForSite(site, getSiteWeatherAddress(site), todayKey, { silent: true, scope: '' });
        const retained = JSON.stringify(getWeatherRecordForSite(site, todayKey)) === previous;
        response = { daily: { time: ['1999-01-01'], temperature_2m_min: [7], temperature_2m_max: [8] }, current: { weather_code: 0 } };
        await requestWeatherForSite(site, getSiteWeatherAddress(site), todayKey, { silent: true, scope: '' });
        const wrongDateRetained = JSON.stringify(getWeatherRecordForSite(site, todayKey)) === previous;
        state.weatherCache[getWeatherCacheKey(site, '2026-01-01')] = { ...record, dateKey: '2026-01-01' };
        weatherRemoteDates.add(`${authState.user.id}::2026-01-01`);
        const beforePast = calls;
        await requestWeatherForSite(site, getSiteWeatherAddress(site), '2026-01-01', { silent: true, scope: '' });
        const noPastFetch = calls === beforePast;
        const noCrossSite = getWeatherRecordForSite('different-site', todayKey) === null;
        state.selectedDateKey = '2026-01-01';
        await saveRemoteSnapshot(todayKey);
        const saved = captured.find(row => row.log_date === todayKey);
        state.weatherCache = {};
        weatherRemoteDates.clear();
        // Same authoritative hydration path used by loadRemoteWorklogForActiveDate.
        applyRemoteWeatherForDate(saved.state, todayKey, authState.user.id);
        const restored = formatWeatherTemperatureRange(getWeatherRecordForSite(site, todayKey));
        state.weatherCache[getWeatherCacheKey(site, '2026-01-01')] = { ...record, dateKey: '2026-01-01' };
        applyRemoteWeatherForDate(null, '2026-01-01', authState.user.id);
        const missing = getWeatherRecordForSite(site, '2026-01-01') === null;
        const historyMarkup = getHistoricalWeatherBannerMarkup(null, site);
        renderHistoricalWeatherBanners('2026-01-01');
        const pastText = document.getElementById('worklogPulseText').textContent;
        state.weatherCache[getWeatherCacheKey(site, '2026-01-02')] = { ...record, dateKey: '2026-01-02' };
        weatherRemoteDates.add(`${authState.user.id}::2026-01-02`);
        renderHistoricalWeatherBanners('2026-01-02');
        const recordedPastText = document.getElementById('worklogPulseText').textContent;
        // Missing minima stay missing; complete records cannot be degraded by a partial response.
        response = { current: { weather_code: 2 }, daily: { time: [todayKey], temperature_2m_min: [null], temperature_2m_max: [4] } };
        await requestWeatherForSite(site, getSiteWeatherAddress(site), todayKey, { silent: true, scope: '' });
        const partialRetained = formatWeatherTemperatureRange(getWeatherRecordForSite(site, todayKey)) === range;
        const otherSite = '비욘드 피트니스';
        state.siteWeatherAddresses[otherSite] = '서울';
        const partial = await requestWeatherForSite(otherSite, '서울', todayKey, { silent: true, scope: '' });
        const partialRange = formatWeatherTemperatureRange(partial);
        const futureDate = new Date(Date.parse(todayKey) + 86400000).toISOString().slice(0, 10);
        const distantDate = new Date(Date.parse(todayKey) + 30 * 86400000).toISOString().slice(0, 10);
        applyRemoteWeatherForDate(null, futureDate, authState.user.id);
        response = { current: { weather_code: 0 }, daily: { time: [futureDate], weather_code: [61], temperature_2m_min: [6], temperature_2m_max: [16] } };
        const forecast = await requestWeatherForSite(site, getSiteWeatherAddress(site), futureDate, { silent: true, scope: '' });
        const forecastCorrect = forecast?.recordType === 'forecast' && getWeatherConditionIcon(forecast) === '🌧️' && formatWeatherTemperatureRange(forecast) === '6°/16°';
        renderHistoricalWeatherBanners(futureDate);
        const forecastText = document.getElementById('worklogPulseText').textContent;
        await saveRemoteSnapshot(futureDate);
        const savedForecast = captured.find(row => row.log_date === futureDate);
        const beforeDistant = calls;
        await requestWeatherForSite(site, getSiteWeatherAddress(site), distantDate, { silent: true, scope: '' });
        const distantNotQueried = calls === beforeDistant && getMissingWeatherLabel(distantDate) === '예보 대기';
        const historyDate = '2026-01-03';
        applyRemoteWeatherForDate(null, historyDate, authState.user.id);
        response = { daily: { time: [historyDate], weather_code: [3], temperature_2m_min: [-2], temperature_2m_max: [8] } };
        const history = await requestWeatherForSite(site, getSiteWeatherAddress(site), historyDate, { silent: true, scope: '' });
        const historyCorrect = history?.recordType === 'history' && formatWeatherTemperatureRange(history) === '-2°/8°';
        // A forecast that has become today's record must refresh even when recently fetched.
        const forecastMustRefresh = needsWeatherRefresh({ ...record, recordType: 'forecast', address: getSiteWeatherAddress(site) }, todayKey);
        clearWeatherCacheForSite(site);
        const addressChangePreserves = Boolean(getWeatherRecordForSite(site, todayKey));
        const beforeUnknown = calls;
        await requestWeatherForSite('unknown', '', todayKey, { silent: true, scope: '' });
        const unknownNotQueried = calls === beforeUnknown;
        state.selectedDateKey = todayKey;
        switchView('bangju-log');
        renderWeatherDateButtons(todayKey);
        const chip = document.getElementById('todayJumpButton');
        const box = chip.getBoundingClientRect();
        const children = [...chip.children].map(el => { const r = el.getBoundingClientRect(); return { left:r.left, right:r.right, top:r.top, bottom:r.bottom }; });
        const oneLine = children.length === 2 && children[0].left < children[1].left && Math.min(children[0].bottom, children[1].bottom) > Math.max(children[0].top, children[1].top);
        const contained = children.every(r => r.left >= box.left - 1 && r.right <= box.right + 1);
        const dateLabel = document.getElementById('worklogDayTitle');
        const dateUnclipped = dateLabel.scrollWidth <= dateLabel.clientWidth + 1;
        const text = chip.textContent;
        const missingRange = formatWeatherTemperatureRange({ temperatureMin: '', temperatureMax: undefined });
        window.fetch = originalFetch;
        supabaseClient.from = originalFrom;
        authState.saveTimers?.forEach(clearTimeout);
        weatherRetryTimers.forEach(clearTimeout);
        return { range, retained, wrongDateRetained, noPastFetch, noCrossSite, restored, missing, historyMarkup, pastText, recordedPastText, partialRetained, partialRange, forecastCorrect, forecastText, savedForecast, distantNotQueried, historyCorrect, forecastMustRefresh, addressChangePreserves, unknownNotQueried, oneLine, contained, dateUnclipped, text, missingRange, savedRow: saved, savedDate: saved.log_date };
      });
      assert.equal(result.range, '-3°/0°');
      assert.equal(result.restored, '-3°/0°');
      assert.equal(result.partialRange, '—/4°');
      assert.equal(result.missingRange, '—/—');
      for (const key of ['retained','wrongDateRetained','noPastFetch','noCrossSite','missing','partialRetained','addressChangePreserves','unknownNotQueried','oneLine','contained','dateUnclipped','forecastCorrect','distantNotQueried','historyCorrect','forecastMustRefresh']) assert.equal(result[key], true, `${width}: ${key}`);
      assert.match(result.historyMarkup, /기록 없음/);
      assert.match(result.pastText, /기록 없음/);
      assert.match(result.forecastText, /6°\/16°/);
      assert.match(result.recordedPastText, /-3°\/0°/);
      assert.doesNotMatch(result.text, /구름|맑음|최저|최고/);
      await page.screenshot({ path: `/tmp/worklog-weather-${width}.png` });
      // A new document has no in-memory weather authorization/cache. Read the server
      // snapshot through the real loader (other product subsystems are isolated).
      await page.reload();
      const afterReload = await page.evaluate(async saved => {
        authState.user = { id: saved.user_id, email: 'weather@example.test' };
        state.selectedDateKey = saved.log_date;
        state.weatherCache = { stale: { temperatureMin: 99 } };
        const noop = async () => null;
        loadLatestRemoteSiteWeatherSettings = noop;
        loadSharedSiteWeatherSettings = noop;
        loadRemoteExecutiveCarryoverContext = noop;
        loadVisibleStaffWorklogsForDate = noop;
        loadCoworkerWorklogsForDate = noop;
        loadRemoteDagymDailyAnalysis = noop;
        loadRemoteDagymSyncHealth = noop;
        loadRemoteLaborPayrollDrafts = noop;
        loadRemoteLeaveRequests = noop;
        loadDagymMonthlyPtSchedules = noop;
        ensureTodayDagymDailyAnalysis = noop;
        renderAll = () => {};
        renderWeatherWidgets = () => {};
        const read = {
          select() { return this; }, eq() { return this; }, order() { return this; }, limit() { return this; },
          async maybeSingle() { return { data: { state: saved.state, updated_at: saved.updated_at }, error: null }; }
        };
        supabaseClient.from = () => read;
        await loadRemoteWorklogForActiveDate();
        const weather = Object.values(saved.state.weatherCache)[0];
        return formatWeatherTemperatureRange(getWeatherRecordForSite(weather.siteKey, saved.log_date));
      }, result.savedRow);
      const restoredForecast = await page.evaluate(async saved => {
        state.selectedDateKey = saved.log_date;
        supabaseClient.from = () => ({
          select() { return this; }, eq() { return this; }, order() { return this; }, limit() { return this; },
          async maybeSingle() { return { data: { state: saved.state, updated_at: saved.updated_at }, error: null }; }
        });
        await loadRemoteWorklogForActiveDate();
        const weather = Object.values(saved.state.weatherCache)[0];
        const restored = getWeatherRecordForSite(weather.siteKey, saved.log_date);
        return restored?.recordType === 'forecast' && formatWeatherTemperatureRange(restored) === '6°/16°';
      }, result.savedForecast);
      assert.equal(restoredForecast, true, `${width}: forecast DB restore`);
      assert.equal(afterReload, '-3°/0°', `${width}: reload through DB loader`);
      console.log(`Weather QA passed (${width}px): date/site isolation, DB snapshot restore, failure retention, missing/zero/negative, one-line bounds`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });

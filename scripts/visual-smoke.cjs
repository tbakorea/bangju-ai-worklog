const { chromium } = require("playwright");
const { existsSync } = require("node:fs");

const target = process.env.WORKLOG_URL || "http://127.0.0.1:8782/index.html";
const localChrome = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
].find((path) => existsSync(path));

function fail(message, details = "") {
  throw new Error(`${message}${details ? `: ${details}` : ""}`);
}

async function openPage(browser, viewport) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(target, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  return { page, errors };
}

async function seedApprovedBangjuEmployee(page) {
  await page.evaluate(() => {
    window.eval(`
      authState.user = { id: "qa-finance-manager", email: "finance.manager@example.com" };
      state.profile = {
        ...state.profile,
        email: "finance.manager@example.com",
        org: "(주)방주",
        workplace: "본사",
        role: "재무과장",
        name: "재무과장",
        nickname: "재무",
        primaryWork: "자금 회계 보고",
        approvalStatus: "approved",
        accessPreset: "employee",
        permissions: {}
      };
      state.selectedEmployeeId = "bangju-finance-manager";
      normalizeState();
    `);
  });
}

async function checkTabletRepresentativeWorklogChrome(browser) {
  const { page, errors } = await openPage(browser, { width: 1024, height: 768 });
  await page.evaluate(() => {
    window.eval(`
      authState.user = { id: "qa-representative", email: "j3010@ymail.com" };
      state.profile = {
        ...state.profile,
        email: "j3010@ymail.com",
        org: "(주)방주",
        role: "대표",
        name: "정찬훈",
        approvalStatus: "approved",
        accessPreset: "representative",
        permissions: {}
      };
      state.selectedEmployeeId = "bangju-finance-manager";
      normalizeState();
      switchView("bangju-log");
      document.body.classList.remove("physical-phone-device");
      const exitButton = document.getElementById("returnToWorklogOverviewButton");
      if (exitButton) exitButton.hidden = false;
      const modeButton = document.getElementById("globalViewModeButton");
      if (modeButton) modeButton.hidden = false;
      dockGlobalHeaderActions("today");
      const weatherButton = document.getElementById("todayJumpButton");
      if (weatherButton) {
        weatherButton.hidden = false;
        weatherButton.disabled = true;
        weatherButton.classList.add("is-weather-today");
        weatherButton.dataset.weatherStatus = "ready";
        weatherButton.innerHTML = '<i aria-hidden="true">☀️</i><small>24°/31°</small>';
      }
    `);
  });
  await page.waitForTimeout(180);

  const metrics = await page.evaluate(() => {
    const rect = (selector) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const box = node.getBoundingClientRect();
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
    };
    const overlaps = (a, b) => Boolean(a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top);
    const exit = rect("#returnToWorklogOverviewButton");
    const identity = rect("#worklogIdentityBadge");
    const dock = rect("#view-today > .section-menu-dock");
    const weather = rect("#todayJumpButton");
    const title = rect("#view-today .worklog-today-title");
    const icon = document.querySelector("#todayJumpButton i");
    const range = document.querySelector("#todayJumpButton small");
    return {
      exit,
      identity,
      dock,
      weather,
      title,
      exitDockOverlap: overlaps(exit, dock),
      exitIdentityOverlap: overlaps(exit, identity),
      exitHitTarget: exit
        ? document.elementFromPoint(exit.left + (exit.width / 2), exit.top + (exit.height / 2))?.id || ""
        : "",
      weatherWidth: weather?.width || 0,
      weatherIconSize: icon ? Number.parseFloat(getComputedStyle(icon).fontSize) : 0,
      weatherRangeSize: range ? Number.parseFloat(getComputedStyle(range).fontSize) : 0,
      horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });

  if (!metrics.exit || !metrics.dock || metrics.exitDockOverlap) {
    fail("tablet representative return action should not overlap the section menu dock", JSON.stringify(metrics));
  }
  if (metrics.exitIdentityOverlap || metrics.exitHitTarget !== "returnToWorklogOverviewButton") {
    fail("tablet representative return action should remain unobstructed by the employee identity badge", JSON.stringify(metrics));
  }
  if (metrics.weatherWidth < 120 || metrics.weatherIconSize < 27 || metrics.weatherRangeSize < 14) {
    fail("tablet current-day weather should use the available date-row space", JSON.stringify(metrics));
  }
  if (metrics.horizontalOverflow > 2) fail("tablet employee worklog has horizontal overflow", JSON.stringify(metrics));
  await page.evaluate(() => switchView("worklog-overview"));
  await page.waitForTimeout(160);
  const ceoOverview = await page.evaluate(() => {
    const shell = document.querySelector(".worklog-shell")?.getBoundingClientRect();
    const eyebrow = document.querySelector(".worklog-overview-hero p");
    const title = document.querySelector(".worklog-overview-hero h2");
    return {
      mode: document.body.dataset.viewMode || "",
      layout: document.body.dataset.layoutMode || "",
      responsiveFlow: document.body.dataset.responsiveFlow || "",
      shellWidth: shell?.width || 0,
      eyebrowHeight: eyebrow?.getBoundingClientRect().height || 0,
      eyebrowFits: !eyebrow || eyebrow.scrollWidth <= eyebrow.clientWidth + 2,
      titleHeight: title?.getBoundingClientRect().height || 0,
      titleFits: !title || title.scrollWidth <= title.clientWidth + 2,
      modeLabel: document.getElementById("globalViewModeLabel")?.textContent?.trim() || "",
      horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  if (ceoOverview.mode !== "ceo" || ceoOverview.layout !== "wide" || ceoOverview.responsiveFlow !== "landscape"
    || ceoOverview.shellWidth < 980 || ceoOverview.shellWidth > 1024
    || ceoOverview.eyebrowHeight > 24 || !ceoOverview.eyebrowFits
    || ceoOverview.titleHeight > 48 || !ceoOverview.titleFits
    || ceoOverview.modeLabel !== "클래식" || ceoOverview.horizontalOverflow > 2) {
    fail("landscape CEO overview should automatically use the continuous wide canvas", JSON.stringify(ceoOverview));
  }
  await page.evaluate(() => toggleGlobalViewMode());
  await page.waitForTimeout(160);
  const classicOverview = await page.evaluate(() => ({
    mode: document.body.dataset.viewMode || "",
    layout: document.body.dataset.layoutMode || "",
    shellWidth: document.querySelector(".worklog-shell")?.getBoundingClientRect().width || 0,
    modeLabel: document.getElementById("globalViewModeLabel")?.textContent?.trim() || "",
    horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
  }));
  if (classicOverview.mode !== "classic" || classicOverview.layout !== "wide"
    || classicOverview.shellWidth < 900 || classicOverview.modeLabel !== "CEO"
    || classicOverview.horizontalOverflow > 2) {
    fail("Classic worklog overview should use the available desktop canvas", JSON.stringify(classicOverview));
  }
  await page.setViewportSize({ width: 1000, height: 600 });
  await page.evaluate(() => {
    localStorage.setItem("beyond-worklog-global-view-mode", "ceo");
    renderResponsiveMode();
    switchView("worklog-overview");
  });
  await page.waitForTimeout(180);
  const shortLandscapeOverview = await page.evaluate(() => {
    const shell = document.querySelector(".worklog-shell")?.getBoundingClientRect();
    const hero = document.querySelector(".worklog-overview-hero")?.getBoundingClientRect();
    const title = document.querySelector(".worklog-overview-hero h2");
    return {
      flow: document.body.dataset.responsiveFlow || "",
      density: document.body.dataset.viewportDensity || "",
      layout: document.body.dataset.layoutMode || "",
      shellWidth: shell?.width || 0,
      heroHeight: hero?.height || 0,
      titleFits: !title || title.scrollWidth <= title.clientWidth + 2,
      titleWritingMode: title ? getComputedStyle(title).writingMode : "",
      horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  if (shortLandscapeOverview.flow !== "landscape" || shortLandscapeOverview.density !== "high"
    || shortLandscapeOverview.layout !== "wide" || shortLandscapeOverview.shellWidth < 970
    || shortLandscapeOverview.heroHeight > 100 || !shortLandscapeOverview.titleFits
    || shortLandscapeOverview.titleWritingMode !== "horizontal-tb" || shortLandscapeOverview.horizontalOverflow > 2) {
    fail("short landscape window should fill width with a high-density horizontal command board", JSON.stringify(shortLandscapeOverview));
  }
  await page.evaluate(() => switchView("bangju-log"));
  await page.waitForTimeout(180);
  const shortLandscapeWorklog = await page.evaluate(() => {
    const task = document.querySelector("#view-today .worklog-task-panel")?.getBoundingClientRect();
    const schedule = document.querySelector("#view-today .worklog-schedule-panel")?.getBoundingClientRect();
    const coworker = document.querySelector("#view-today .worklog-coworker-page")?.getBoundingClientRect();
    return {
      taskBesideSchedule: Boolean(task && schedule && schedule.left > task.left && Math.abs(task.top - schedule.top) < 6),
      coworkerBesideDaily: Boolean(schedule && coworker && coworker.left > schedule.right && Math.abs(task?.top - coworker.top) < 8),
      coworkerDisplay: document.querySelector("#view-today .worklog-coworker-page")
        ? getComputedStyle(document.querySelector("#view-today .worklog-coworker-page")).display : "none",
      horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  if (!shortLandscapeWorklog.taskBesideSchedule || !shortLandscapeWorklog.coworkerBesideDaily
    || shortLandscapeWorklog.coworkerDisplay === "none" || shortLandscapeWorklog.horizontalOverflow > 2) {
    fail("short landscape employee worklog should show personal and coworker pages continuously", JSON.stringify(shortLandscapeWorklog));
  }
  const liveFitnessMetrics = await page.evaluate(() => {
    setSelectedDateKey(todayKey);
    const pages = getFitnessLogPages();
    const employeePage = pages.find((page) => page.type === "employee" && page.id === "fitness-info-kimyoungchae")
      || pages.find((page) => page.type === "employee");
    state.fitnessLogPage = pages.indexOf(employeePage);
    state.fitnessLogPageId = employeePage?.id || "";
    state.selectedEmployeeId = employeePage?.id || state.selectedEmployeeId;
    switchView("fitness-log");
    state.fitnessLogPage = 1;
    renderAll();
    refreshCurrentTimeIndicators();
    const currentPage = getCurrentFitnessLogPage();
    const clock = document.querySelector("#fitnessCurrentTime");
    const time = document.querySelector("#fitnessAppointmentList .appointment-time");
    const centerSheet = (() => {
      state.worklogOverviewScope = "fitness";
      switchView("worklog-overview");
      return document.querySelector(".overview-fitness-center-sheet")?.getBoundingClientRect();
    })();
    const employeeSheet = document.querySelector(".is-fitness-native-projection");
    const employeeHead = employeeSheet?.querySelector(".overview-fitness-native-head")?.getBoundingClientRect();
    const summaryCell = employeeSheet?.querySelector(".overview-fitness-summary > div span")?.getBoundingClientRect();
    const saturdayEmployee = {
      ...findEmployeeRecordById("fitness-weekday-info-idabin"),
      id: "fitness-saturday-only-qa",
      name: "토요일 근무자",
      weeklyWorkHours: { sat: "10:00-18:00" }
    };
    const offDutyDateKey = "2026-08-10";
    state.employeeLogs[offDutyDateKey] ||= {};
    state.employeeLogs[offDutyDateKey][saturdayEmployee.id] = createEmployeeLog(saturdayEmployee, state.profile, offDutyDateKey);
    const saturdayModel = getOverviewEmployeeSummaryModel(
      getWorklogOverviewGroups().find((group) => group.id === "fitness"),
      saturdayEmployee.id,
      saturdayEmployee,
      offDutyDateKey
    );
    const saturdayAlerts = buildEmployeeInsightAlerts(saturdayEmployee, saturdayModel.dayLog, saturdayModel);
    return {
      selectedPageId: currentPage?.id || "",
      intendedPageId: employeePage?.id || "",
      selectedPageType: currentPage?.type || "",
      clockText: clock?.textContent?.trim() || "",
      clockHidden: Boolean(clock?.hidden),
      timeText: time?.textContent?.trim() || "",
      timeSingleLine: !time || time.scrollHeight <= time.clientHeight + 2,
      centerSheetHeight: centerSheet?.height || 0,
      employeeSheetWidth: employeeSheet?.getBoundingClientRect().width || 0,
      employeeHeadHeight: employeeHead?.height || 0,
      summaryCellHeight: summaryCell?.height || 0,
      saturdayWorkStatus: saturdayModel.workStatus?.key || "",
      saturdayAttendance: saturdayModel.attendance || "",
      saturdaySignalCount: saturdayModel.signalCount,
      saturdayAlertTitles: saturdayAlerts.map((item) => item.title),
      horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  if (!liveFitnessMetrics.intendedPageId || liveFitnessMetrics.selectedPageId !== liveFitnessMetrics.intendedPageId
    || liveFitnessMetrics.selectedPageType !== "employee") {
    fail("representative fitness employee page should survive rerenders without returning to center operations", JSON.stringify(liveFitnessMetrics));
  }
  if (liveFitnessMetrics.clockHidden || !/^현재 \d{2}:\d{2}$/.test(liveFitnessMetrics.clockText)
    || !/^\d{2}:\d{2}$/.test(liveFitnessMetrics.timeText) || !liveFitnessMetrics.timeSingleLine) {
    fail("fitness schedule should show live time and keep schedule times on one line", JSON.stringify(liveFitnessMetrics));
  }
  if (liveFitnessMetrics.centerSheetHeight > 560 || liveFitnessMetrics.horizontalOverflow > 2) {
    fail("fitness center overview should not reserve a tall empty sheet", JSON.stringify(liveFitnessMetrics));
  }
  if (liveFitnessMetrics.saturdayWorkStatus !== "off"
    || liveFitnessMetrics.saturdayAttendance !== "근태 확인 제외"
    || liveFitnessMetrics.saturdaySignalCount !== 0
    || liveFitnessMetrics.saturdayAlertTitles.includes("근태 확인")
    || liveFitnessMetrics.saturdayAlertTitles.includes("업무일지 공백")) {
    fail("off-duty employees should not receive attendance or blank-worklog warnings", JSON.stringify(liveFitnessMetrics));
  }
  if (liveFitnessMetrics.employeeSheetWidth > 360
    || liveFitnessMetrics.employeeHeadHeight > 74
    || liveFitnessMetrics.summaryCellHeight > 45) {
    fail("representative fitness cards should use a compact horizontal and vertical density", JSON.stringify(liveFitnessMetrics));
  }
  const rolloverDate = await page.evaluate(() => {
    const liveDateKey = formatDateKey(new Date());
    todayKey = getPreviousDateKey(liveDateKey);
    state.selectedDateKey = todayKey;
    refreshCurrentTimeIndicators();
    return { liveDateKey, todayKey, selectedDateKey: state.selectedDateKey };
  });
  if (rolloverDate.todayKey !== rolloverDate.liveDateKey || rolloverDate.selectedDateKey !== rolloverDate.liveDateKey) {
    fail("a long-open app should automatically roll from a stale date to the live date", JSON.stringify(rolloverDate));
  }
  const resumedDate = await page.evaluate(() => {
    authState.user = null;
    state.selectedDateKey = getPreviousDateKey(todayKey);
    localStorage.setItem(storageKey, JSON.stringify(state));
    const resumeEvent = new Event("pageshow");
    Object.defineProperty(resumeEvent, "persisted", { value: true });
    window.dispatchEvent(resumeEvent);
    return {
      selectedDateKey: state.selectedDateKey,
      todayKey,
      storedDateKey: JSON.parse(localStorage.getItem(storageKey) || "{}").selectedDateKey || "",
    };
  });
  if (resumedDate.selectedDateKey !== resumedDate.todayKey || resumedDate.storedDateKey !== resumedDate.todayKey) {
    fail("reopened tablet app should restore the live today date", JSON.stringify(resumedDate));
  }
  if (errors.length) fail("tablet representative worklog page errors", errors.join(" | "));
  await page.close();
}

async function checkDesktopEmployeeWorklog(browser) {
  const { page, errors } = await openPage(browser, { width: 1440, height: 900 });
  await seedApprovedBangjuEmployee(page);
  await page.evaluate(() => {
    localStorage.setItem("beyond-worklog-global-view-mode", "classic");
    window.switchView?.("bangju-log");
    document.body.classList.remove("physical-phone-device");
  });
  await page.waitForTimeout(250);

  const metrics = await page.evaluate(() => {
    const shell = document.querySelector(".worklog-shell");
    const reportView = document.querySelector("#view-report");
    const today = document.querySelector("#view-today");
    const dateTitle = document.querySelector("#worklogDayTitle");
    const reportBox = document.querySelector("#employeeReport");
    const memoBox = document.querySelector("#employeeMemo");
    const taskPanel = document.querySelector(".worklog-task-panel");
    const schedulePanel = document.querySelector(".worklog-schedule-panel");
    const coworkerPanel = document.querySelector(".worklog-coworker-page");
    const taskRect = taskPanel?.getBoundingClientRect();
    const coworkerRect = coworkerPanel?.getBoundingClientRect();
    const pulse = document.querySelector("#worklogPulse");
    const pulseText = document.querySelector("#worklogPulseText")?.textContent?.replace(/\s+/g, " ").trim() || "";
    return {
      activeView: document.body.dataset.activeView,
      layoutMode: document.body.dataset.layoutMode,
      shellWidth: shell?.getBoundingClientRect().width || 0,
      reportDisplay: getComputedStyle(reportView).display,
      todayDisplay: getComputedStyle(today).display,
      dateFont: parseFloat(getComputedStyle(dateTitle).fontSize),
      reportHeight: reportBox?.getBoundingClientRect().height || 0,
      memoHeight: memoBox?.getBoundingClientRect().height || 0,
      taskWidth: taskPanel?.getBoundingClientRect().width || 0,
      scheduleWidth: schedulePanel?.getBoundingClientRect().width || 0,
      coworkerDisplay: coworkerPanel ? getComputedStyle(coworkerPanel).display : "none",
      coworkerWidth: coworkerRect?.width || 0,
      coworkerBesideDaily: Boolean(taskRect && coworkerRect && coworkerRect.left > taskRect.right && Math.abs(coworkerRect.top - taskRect.top) < 5),
      scrollHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
      pulseText,
      pulseLabel: pulse ? getComputedStyle(pulse, "::before").content : "",
      pulseHeight: pulse?.getBoundingClientRect().height || 0,
    };
  });

  if (metrics.activeView !== "bangju-log") fail("desktop active view mismatch", metrics.activeView);
  if (metrics.layoutMode !== "wide") fail("desktop worklog should automatically use wide classic layout", metrics.layoutMode);
  if (metrics.reportDisplay !== "none") fail("inactive report view leaked under worklog", metrics.reportDisplay);
  if (metrics.todayDisplay !== "grid") fail("desktop worklog should use compact grid", metrics.todayDisplay);
  if (metrics.dateFont > 36) fail("desktop date font is too large", `${metrics.dateFont}px`);
  if (metrics.shellWidth < 1200 || metrics.shellWidth > 1400) fail("desktop employee shell should use the available classic width", `${metrics.shellWidth}px`);
  if (metrics.reportHeight > 100 || metrics.memoHeight > 100) fail("report/memo tail is too tall", `${metrics.reportHeight}/${metrics.memoHeight}`);
  const widthRatio = metrics.taskWidth / Math.max(1, metrics.scheduleWidth);
  if (widthRatio < 0.88 || widthRatio > 1.12) fail("task/schedule columns are not balanced", String(widthRatio));
  if (metrics.coworkerDisplay === "none" || metrics.coworkerWidth < 260 || !metrics.coworkerBesideDaily) {
    fail("desktop worklog should show coworker worklogs beside the personal worklog", JSON.stringify(metrics));
  }
  if (metrics.scrollHeight > metrics.viewportHeight * 1.9) fail("desktop worklog still has excessive vertical tail", `${metrics.scrollHeight}/${metrics.viewportHeight}`);
  if (!metrics.pulseLabel.includes("오늘 집중") || metrics.pulseHeight < 42
    || /오늘 실행|운영 신호|님,/.test(metrics.pulseText) || metrics.pulseText.length > 42) {
    fail("worklog focus banner should be short, prominent, and action-oriented", JSON.stringify(metrics));
  }

  await page.evaluate(() => {
    window.setSelectedDateKey?.("2026-07-22");
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(120);
  await page.dispatchEvent("#view-today", "pointerdown", { pointerId: 1, clientX: 520, clientY: 260, bubbles: true });
  await page.dispatchEvent("#view-today", "pointerup", { pointerId: 1, clientX: 520, clientY: 390, bubbles: true });
  await page.waitForTimeout(450);
  const prevSwipeDate = await page.evaluate(() => JSON.parse(localStorage.getItem("beyond-worklog-state-v1") || "{}").selectedDateKey);
  if (prevSwipeDate !== "2026-07-21") fail("vertical pull-down should move to previous date", prevSwipeDate);

  await page.evaluate(() => {
    window.setSelectedDateKey?.("2026-07-22");
    window.scrollTo(0, document.scrollingElement?.scrollHeight || 0);
  });
  await page.waitForTimeout(120);
  await page.dispatchEvent("#view-today", "pointerdown", { pointerId: 2, clientX: 520, clientY: 620, bubbles: true });
  await page.dispatchEvent("#view-today", "pointerup", { pointerId: 2, clientX: 520, clientY: 470, bubbles: true });
  await page.waitForTimeout(450);
  const nextSwipeDate = await page.evaluate(() => JSON.parse(localStorage.getItem("beyond-worklog-state-v1") || "{}").selectedDateKey);
  if (nextSwipeDate !== "2026-07-23") fail("vertical push-up should move to next date", nextSwipeDate);

  await page.evaluate(() => {
    window.setTodayPageMode?.("common");
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(150);
  const commonSchedule = await page.evaluate(() => {
    const board = document.querySelector("#commonScheduleBoard");
    return {
      title: board?.querySelector(".common-week-header strong")?.textContent?.trim() || "",
      sectionCount: board?.querySelectorAll(".company-common-section").length || 0,
      hasPriorityControl: Boolean(board?.querySelector(".priority-select, .task-status-cell, .overview-priority-box")),
      hasSectionTitles: /부서 월간 핵심일정|개인 주간 실행이벤트/.test(board?.textContent || ""),
      hasAddButton: Boolean(board?.querySelector("[data-common-add-section]")),
      hasLegacyWeeklyCopy: /Beyond Work Weekly|일간 페이지에 업무를 입력하세요/.test(board?.textContent || ""),
    };
  });
  if (!commonSchedule.title.includes("실행일정")) fail("common page should be company common schedule", JSON.stringify(commonSchedule));
  if (commonSchedule.sectionCount !== 4) fail("common page should render four execution sections", JSON.stringify(commonSchedule));
  if (!commonSchedule.hasSectionTitles) fail("common page should show monthly and weekly section titles", JSON.stringify(commonSchedule));
  if (!commonSchedule.hasAddButton) fail("common page should expose add controls for editable common sections", JSON.stringify(commonSchedule));
  if (commonSchedule.hasPriorityControl) fail("common schedule should not expose priority controls", JSON.stringify(commonSchedule));
  if (commonSchedule.hasLegacyWeeklyCopy) fail("legacy weekly summary copy leaked into common schedule", JSON.stringify(commonSchedule));

  await page.evaluate(() => {
    state.fitnessLogPage = 1;
    window.switchView?.("fitness-log");
  });
  await page.waitForTimeout(220);
  const fitnessDesktop = await page.evaluate(() => {
    const rect = (selector) => document.querySelector(selector)?.getBoundingClientRect() || null;
    const task = rect("#view-fitness-log .fitness-log-task-panel");
    const schedule = rect("#view-fitness-log .fitness-log-schedule-panel");
    const coworkers = rect("#fitnessDesktopCoworkerBoard");
    return {
      activeView: document.body.dataset.activeView,
      layoutMode: document.body.dataset.layoutMode,
      shellWidth: document.querySelector(".worklog-shell")?.getBoundingClientRect().width || 0,
      desktopGridDisplay: getComputedStyle(document.querySelector(".fitness-desktop-worklog-grid")).display,
      coworkerDisplay: getComputedStyle(document.querySelector("#fitnessDesktopCoworkerBoard")).display,
      coworkerCount: document.querySelectorAll("#fitnessDesktopCoworkerBoard .fitness-desktop-coworker-card").length,
      columnsAligned: Boolean(task && schedule && coworkers && Math.abs(task.top - schedule.top) < 5 && Math.abs(task.top - coworkers.top) < 5 && task.right <= schedule.left && schedule.right <= coworkers.left),
      taskRect: task ? { left: task.left, top: task.top, right: task.right, width: task.width } : null,
      scheduleRect: schedule ? { left: schedule.left, top: schedule.top, right: schedule.right, width: schedule.width } : null,
      coworkerRect: coworkers ? { left: coworkers.left, top: coworkers.top, right: coworkers.right, width: coworkers.width } : null,
      openButtonCount: document.querySelectorAll("#fitnessDesktopCoworkerBoard [data-fitness-desktop-open]").length,
    };
  });
  if (fitnessDesktop.activeView !== "fitness-log" || fitnessDesktop.layoutMode !== "wide" || fitnessDesktop.shellWidth < 1200) {
    fail("desktop fitness worklog should open in the wide classic surface", JSON.stringify(fitnessDesktop));
  }
  if (fitnessDesktop.desktopGridDisplay !== "grid" || fitnessDesktop.coworkerDisplay !== "grid" || fitnessDesktop.coworkerCount < 2 || !fitnessDesktop.columnsAligned || fitnessDesktop.openButtonCount !== fitnessDesktop.coworkerCount) {
    fail("desktop fitness worklog should align personal tasks, schedule, and coworker worklogs", JSON.stringify(fitnessDesktop));
  }

  if (errors.length) fail("desktop page errors", errors.join(" | "));
  await page.close();
}

async function checkPhoneWorklog(browser) {
  const { page, errors } = await openPage(browser, { width: 390, height: 844 });
  await seedApprovedBangjuEmployee(page);
  await page.evaluate(() => {
    window.switchView?.("bangju-log");
    document.body.classList.add("physical-phone-device");
    document.body.dataset.layoutMode = "phone";
    document.body.dataset.viewMode = "ceo";
  });
  await page.waitForTimeout(250);
  const metrics = await page.evaluate(() => {
    const taskPanel = document.querySelector(".worklog-task-panel");
    const schedulePanel = document.querySelector(".worklog-schedule-panel");
    const reportView = document.querySelector("#view-report");
    return {
      taskWidth: taskPanel?.getBoundingClientRect().width || 0,
      scheduleWidth: schedulePanel?.getBoundingClientRect().width || 0,
      reportDisplay: getComputedStyle(reportView).display,
      taskAiBefore: getComputedStyle(document.querySelector(".day-task-panel .ai-section-button")).display,
      scheduleAiBefore: getComputedStyle(document.querySelector(".day-schedule-panel .ai-section-button")).display,
    };
  });
  if (metrics.reportDisplay !== "none") fail("phone inactive report view leaked", metrics.reportDisplay);
  if (metrics.taskAiBefore !== "none" || metrics.scheduleAiBefore !== "none") fail("worklog coaching buttons should stay hidden outside expanded panels", JSON.stringify(metrics));
  const widthRatio = metrics.taskWidth / Math.max(1, metrics.scheduleWidth);
  if (widthRatio < 0.82 || widthRatio > 1.18) fail("phone task/schedule split is not balanced", String(widthRatio));

  const expandIcon = await page.evaluate(() => {
    const button = document.querySelector(".day-task-panel [data-mobile-focus-open='tasks']");
    return {
      lens: getComputedStyle(button, "::before").content,
      handle: getComputedStyle(button, "::after").content,
    };
  });
  if (!expandIcon.lens.includes("+") || expandIcon.handle !== '""') {
    fail("phone worklog expand icon should be a plus magnifier", JSON.stringify(expandIcon));
  }

  await page.click(".day-task-panel [data-mobile-focus-open='tasks']");
  await page.waitForTimeout(100);
  const panelTapFocus = await page.evaluate(() => ({
    focused: document.querySelector("#worklogMain")?.classList.contains("is-focus-tasks"),
    aiVisible: getComputedStyle(document.querySelector(".day-task-panel .ai-section-button")).display !== "none",
  }));
  if (!panelTapFocus.focused || !panelTapFocus.aiVisible) fail("phone worklog task expand button should open focus mode with coaching", JSON.stringify(panelTapFocus));

  const taskFocusScroll = await page.evaluate(() => {
    const panel = document.querySelector(".day-task-panel");
    const addButton = document.querySelector("#worklogTaskBoard .worklog-add-row");
    const style = panel ? getComputedStyle(panel) : null;
    return {
      maxHeight: style?.maxHeight || "",
      overflowY: style?.overflowY || "",
      panelClientHeight: panel?.clientHeight || 0,
      panelScrollHeight: panel?.scrollHeight || 0,
      addButtonVisible: Boolean(addButton && getComputedStyle(addButton).display !== "none"),
    };
  });
  if (taskFocusScroll.maxHeight !== "none"
    || taskFocusScroll.overflowY !== "visible"
    || taskFocusScroll.panelScrollHeight > taskFocusScroll.panelClientHeight + 2
    || !taskFocusScroll.addButtonVisible) {
    fail("phone worklog task focus should expose the full panel and add button", JSON.stringify(taskFocusScroll));
  }

  const collapseIcon = await page.evaluate(() => {
    const button = document.querySelector(".day-task-panel [data-mobile-focus-close]");
    return {
      lens: getComputedStyle(button, "::before").content,
      handle: getComputedStyle(button, "::after").content,
    };
  });
  if (!collapseIcon.lens.includes("-") || collapseIcon.handle !== '""') {
    fail("phone worklog collapse icon should be a minus magnifier", JSON.stringify(collapseIcon));
  }

  await page.click(".day-task-panel [data-mobile-focus-close]");
  await page.waitForTimeout(150);
  const taskRestored = await page.evaluate(() => ({
    restored: !document.querySelector("#worklogMain")?.classList.contains("is-mobile-focus-active"),
    aiHidden: getComputedStyle(document.querySelector(".day-task-panel .ai-section-button")).display === "none",
  }));
  if (!taskRestored.restored || !taskRestored.aiHidden) fail("phone worklog task focus close button did not restore split mode", JSON.stringify(taskRestored));

  await page.click(".day-schedule-panel [data-mobile-focus-open='schedule']");
  await page.waitForTimeout(100);
  const scheduleTapFocus = await page.evaluate(() => document.querySelector("#worklogMain")?.classList.contains("is-focus-schedule"));
  if (!scheduleTapFocus) fail("phone worklog schedule expand button should open focus mode");

  await page.click(".day-schedule-panel [data-mobile-focus-close]");
  await page.waitForTimeout(150);
  const restored = await page.evaluate(() => !document.querySelector("#worklogMain")?.classList.contains("is-mobile-focus-active"));
  if (!restored) fail("phone worklog schedule focus close button did not restore split mode");

  const undoDelete = await page.evaluate(() => {
    const rowsBefore = document.querySelectorAll("#worklogTaskBoard .worklog-task-row").length;
    document.querySelector("#worklogTaskBoard .task-delete")?.click();
    const toast = document.querySelector("#undoToast");
    toast?.querySelector("button")?.click();
    const rowsAfter = document.querySelectorAll("#worklogTaskBoard .worklog-task-row").length;
    return {
      rowsBefore,
      rowsAfter,
      hasUndo: Boolean(toast?.textContent?.includes("되돌리기")),
    };
  });
  if (!undoDelete.hasUndo || undoDelete.rowsAfter !== undoDelete.rowsBefore) {
    fail("worklog delete undo should restore task rows", JSON.stringify(undoDelete));
  }

  if (errors.length) fail("phone page errors", errors.join(" | "));
  await page.close();
}

async function checkExplicitWorklogExpandOutsidePhoneMode(browser) {
  const { page, errors } = await openPage(browser, { width: 430, height: 900 });
  await seedApprovedBangjuEmployee(page);
  await page.evaluate(() => {
    window.switchView?.("bangju-log");
    document.body.classList.remove("physical-phone-device", "smartphone-device");
    document.body.dataset.layoutMode = "classic";
    document.body.dataset.viewMode = "classic";
    window.setTodayPageMode?.("daily");
  });
  await page.waitForTimeout(250);

  await page.click(".day-task-panel [data-mobile-focus-open='tasks']");
  await page.waitForTimeout(120);
  const taskFocus = await page.evaluate(() => {
    const main = document.querySelector("#worklogMain");
    const taskPanel = document.querySelector(".day-task-panel");
    const schedulePanel = document.querySelector(".day-schedule-panel");
    return {
      focused: main?.classList.contains("is-focus-tasks"),
      taskVisible: taskPanel ? getComputedStyle(taskPanel).display !== "none" : false,
      scheduleHidden: schedulePanel ? getComputedStyle(schedulePanel).display === "none" : false,
    };
  });
  if (!taskFocus.focused || !taskFocus.taskVisible || !taskFocus.scheduleHidden) {
    fail("explicit worklog task expand should work outside phone mode", JSON.stringify(taskFocus));
  }

  await page.click(".day-task-panel [data-mobile-focus-close]");
  await page.waitForTimeout(150);
  await page.click(".day-schedule-panel [data-mobile-focus-open='schedule']");
  await page.waitForTimeout(120);
  const scheduleFocus = await page.evaluate(() => {
    const main = document.querySelector("#worklogMain");
    const taskPanel = document.querySelector(".day-task-panel");
    const schedulePanel = document.querySelector(".day-schedule-panel");
    return {
      focused: main?.classList.contains("is-focus-schedule"),
      taskHidden: taskPanel ? getComputedStyle(taskPanel).display === "none" : false,
      scheduleVisible: schedulePanel ? getComputedStyle(schedulePanel).display !== "none" : false,
    };
  });
  if (!scheduleFocus.focused || !scheduleFocus.taskHidden || !scheduleFocus.scheduleVisible) {
    fail("explicit worklog schedule expand should work outside phone mode", JSON.stringify(scheduleFocus));
  }

  await page.click(".day-schedule-panel [data-mobile-focus-close]");
  await page.waitForTimeout(150);
  const restored = await page.evaluate(() => !document.querySelector("#worklogMain")?.classList.contains("is-mobile-focus-active"));
  if (!restored) fail("explicit worklog expand close should restore split mode");

  if (errors.length) fail("explicit worklog expand errors", errors.join(" | "));
  await page.close();
}

async function checkOverviewCommandBoard(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("beyond-worklog-state-v1", JSON.stringify({
      selectedDateKey: "2026-07-23",
      selectedEmployeeId: "bangju-finance-manager",
      profile: {
        email: "j3010@ymail.com",
        role: "대표",
        name: "Benny",
        nickname: "베니",
        approvalStatus: "approved",
      },
      employeeLogs: {},
    }));
    localStorage.setItem("beyond-worklog-global-view-mode", "ceo");
  });
  await page.goto(target, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    document.body.classList.add("physical-phone-device");
    document.body.dataset.layoutMode = "phone";
    document.body.dataset.viewMode = "ceo";
    window.setSelectedDateKey?.("2026-08-02");
    window.eval(`
      siteWeatherAddressTargets.forEach((target, index) => {
        state.siteWeatherAddresses[target.key] = "울산광역시 대표 설정 " + (index + 1);
        state.weatherCache[getWeatherCacheKey(target.key, "2026-08-02")] = {
          siteKey: target.key,
          dateKey: "2026-08-02",
          location: "울산 " + target.label,
          condition: "맑음",
          weatherCode: 0,
          temperature: 25 + index,
          humidity: 58
        };
      });
      switchView("worklog-overview");
    `);
  });
  await page.waitForTimeout(350);

  const metrics = await page.evaluate(() => {
    const title = document.querySelector(".worklog-overview-hero h2");
    const dateTitle = document.querySelector("#overviewDateTitle");
    const header = document.querySelector(".worklog-header");
    const hero = document.querySelector(".worklog-overview-hero");
    const dateYear = document.querySelector("#overviewDateYear")?.getBoundingClientRect();
    const dateDay = document.querySelector("#overviewDateDay")?.getBoundingClientRect();
    const headerRect = header?.getBoundingClientRect();
    const heroRect = hero?.getBoundingClientRect();
    const hiddenTaskChrome = [...document.querySelectorAll(".overview-task-marker, .overview-priority-box")]
      .every((node) => getComputedStyle(node).display === "none");
    return {
      activeView: document.body.dataset.activeView,
      denied: Boolean(document.querySelector(".worklog-overview-denied")),
      titleText: title?.textContent?.trim() || "",
      titleColor: title ? getComputedStyle(title).color : "",
      titleHeight: title?.getBoundingClientRect().height || 0,
      subtitleCount: document.querySelectorAll(".worklog-overview-hero > div:first-child > span").length,
      dateText: dateTitle?.textContent?.trim() || "",
      dateFits: dateTitle ? dateTitle.scrollWidth <= dateTitle.clientWidth + 2 : false,
      dateSingleLine: Boolean(dateYear && dateDay && Math.abs(dateYear.top - dateDay.top) <= 2),
      headerHeroGap: headerRect && heroRect ? heroRect.top - headerRect.bottom : 0,
      heroHeight: heroRect?.height || 0,
      scopeCount: document.querySelectorAll("[data-overview-scope]").length,
      weatherCount: document.querySelectorAll("#overviewSiteWeatherBoard .site-weather-board-grid article").length,
      weatherRecordedCount: document.querySelectorAll("#overviewSiteWeatherBoard .site-weather-board-grid article.has-weather").length,
      weatherText: document.querySelector("#overviewSiteWeatherBoard")?.textContent?.replace(/\s+/g, " ").trim() || "",
      weatherHeight: document.querySelector("#overviewSiteWeatherBoard")?.getBoundingClientRect().height || 0,
      recoveredWeatherAddressCount: (() => {
        state.siteWeatherAddresses = {};
        return mergeSiteWeatherAddressesFromSnapshots([{ state: { siteWeatherAddresses: {
          "비욘드 피트니스": "울산광역시 남구 피트니스 주소",
          "(주)방주 · 재무": "울산광역시 남구 본사 주소"
        } } }]);
      })(),
      activeScope: document.querySelector("[data-overview-scope].is-active")?.dataset.overviewScope || "",
      allCommandCount: document.querySelectorAll(".overview-all-command").length,
      businessBoardCount: document.querySelectorAll(".overview-all-business-board").length,
      businessSnapshotCount: document.querySelectorAll(".overview-business-snapshot").length,
      signalReportCount: document.querySelectorAll(".representative-signal-report").length,
      signalSummaryCount: document.querySelectorAll(".representative-signal-summary article").length,
      signalRowCount: document.querySelectorAll(".representative-signal-list > article").length,
      signalActionCount: document.querySelectorAll(".representative-signal-list [data-overview-employee]").length,
      signalText: document.querySelector(".representative-signal-report")?.textContent?.replace(/\s+/g, " ").trim() || "",
      improvementCount: document.querySelectorAll(".overview-improvement-strip span").length,
      hiddenTaskChrome,
      hiddenReserveSheets: !/예비|미배정|spare/i.test(document.querySelector("#worklogOverviewGrid")?.textContent || ""),
    };
  });

  if (metrics.activeView !== "worklog-overview") fail("overview active view mismatch", metrics.activeView);
  if (metrics.denied) fail("representative overview should not be denied");
  if (metrics.titleText !== "전 사업장 업무일지") fail("overview title mismatch", metrics.titleText);
  if (metrics.titleColor !== "rgb(255, 254, 250)") fail("overview title color is not high contrast", metrics.titleColor);
  if (metrics.titleHeight > 45) fail("overview title wrapped or became too tall", `${metrics.titleHeight}px`);
  if (metrics.subtitleCount) fail("overview subtitle should be removed", String(metrics.subtitleCount));
  if (!metrics.dateFits) fail("overview date title is clipped", metrics.dateText);
  if (!metrics.dateSingleLine) fail("overview date should stay on one line", metrics.dateText);
  if (metrics.dateText !== "2026.08.02(日)") fail("overview date should keep year, month, day, and weekday", metrics.dateText);
  if (metrics.headerHeroGap < 10) fail("overview header overlaps command board", `${metrics.headerHeroGap}px`);
  if (metrics.heroHeight > 190) fail("overview hero is too tall on phone mode", `${metrics.heroHeight}px`);
  if (metrics.scopeCount < 4 || metrics.activeScope !== "all") fail("overview scope selector is not initialized", JSON.stringify({ count: metrics.scopeCount, active: metrics.activeScope }));
  if (metrics.weatherCount !== 7 || metrics.weatherRecordedCount !== 7 || !metrics.weatherText.includes("사업장별 날씨") || !metrics.weatherText.includes("비욘드 피트니스")) {
    fail("representative overview should show all configured site weather records", JSON.stringify(metrics));
  }
  if (metrics.weatherHeight > 300 || metrics.recoveredWeatherAddressCount !== 2) {
    fail("representative weather should stay compact and recover saved site addresses", JSON.stringify(metrics));
  }
  if (!metrics.allCommandCount) fail("overview all-scope command board is missing");
  if (!metrics.businessBoardCount || metrics.businessSnapshotCount < 3) fail("overview all-scope business snapshots are missing", JSON.stringify(metrics));
  if (metrics.signalReportCount !== 1
    || metrics.signalSummaryCount !== 4
    || metrics.signalRowCount < 1
    || metrics.signalRowCount > 8
    || metrics.signalActionCount !== metrics.signalRowCount
    || !metrics.signalText.includes("직원 이상신호 자동 보고")
    || !metrics.signalText.includes("인사평가나 징계 판정이 아닙니다")) {
    fail("representative overview should render an evidence-based employee signal report", JSON.stringify(metrics));
  }
  if (metrics.improvementCount < 10) fail("overview should show today's 10 improvements", String(metrics.improvementCount));
  if (!metrics.hiddenTaskChrome) fail("overview task markers/priorities should be hidden");
  if (!metrics.hiddenReserveSheets) fail("overview should hide reserve/unassigned sheets");
  await page.click('[data-overview-scope="fitness"]');
  await page.waitForTimeout(150);
  const fitnessFilter = await page.evaluate(() => ({
    activeScope: document.querySelector("[data-overview-scope].is-active")?.dataset.overviewScope || "",
    siteText: document.querySelector("#worklogOverviewGrid")?.textContent || "",
    centerSheets: document.querySelectorAll(".overview-fitness-center-sheet").length,
    rosterCards: document.querySelectorAll(".overview-fitness-roster-compact article").length,
    insightCount: document.querySelectorAll(".overview-insight-panel").length,
    fitnessSummaryCount: document.querySelectorAll(".overview-fitness-summary").length,
    directivePanelCount: document.querySelectorAll(".overview-directive-panel").length,
    fitnessSheets: document.querySelectorAll(".worklog-overview-employee-sheet.is-fitness-sheet").length,
    nonFitnessSheets: document.querySelectorAll('.worklog-overview-employee-sheet:not(.is-fitness-sheet)').length,
    firstCardIsCenter: document.querySelector('.worklog-overview-site[data-overview-site="fitness"] .overview-site-carousel')?.firstElementChild?.classList.contains("overview-fitness-center-sheet") || false,
    employeeOrder: [...document.querySelectorAll('.worklog-overview-site[data-overview-site="fitness"] .overview-sheet-head > [data-overview-employee]')]
      .map((button) => button.closest(".worklog-overview-employee-sheet")?.querySelector(".overview-sheet-head h3")?.textContent?.trim() || ""),
  }));
  if (fitnessFilter.activeScope !== "fitness") fail("overview fitness scope did not activate", fitnessFilter.activeScope);
  if (!/비욘드 피트니스/.test(fitnessFilter.siteText)) fail("overview fitness scope missing fitness label");
  if (!fitnessFilter.centerSheets) fail("overview fitness scope should start with center operations sheet", JSON.stringify(fitnessFilter));
  if (!fitnessFilter.firstCardIsCenter) fail("overview fitness center status should be the first card", JSON.stringify(fitnessFilter));
  if (fitnessFilter.employeeOrder.join("|") !== "센터장 박주홍|트레이너 홍현규|인포데스크 신세민|인포데스크 이다빈|인포데스크 김영채") {
    fail("overview fitness employees should follow the fixed operating order", JSON.stringify(fitnessFilter.employeeOrder));
  }
  if (!fitnessFilter.rosterCards) fail("overview fitness center sheet should show fitness roster cards", JSON.stringify(fitnessFilter));
  if (!fitnessFilter.insightCount) fail("overview employee insight alerts are missing");
  if (!fitnessFilter.fitnessSummaryCount) fail("fitness overview should render fitness-specific summary");
  if (!fitnessFilter.directivePanelCount) fail("overview directive panels are missing");
  if (!fitnessFilter.fitnessSheets || fitnessFilter.nonFitnessSheets) fail("overview fitness scope should show only fitness sheets", JSON.stringify(fitnessFilter));
  if (/재무대리|재무과장|공유사업부|김성민/.test(fitnessFilter.siteText)) fail("overview fitness scope leaked non-fitness employees", fitnessFilter.siteText.slice(0, 500));
  const isomiHistorical = await page.evaluate(() => window.eval(`(() => {
    const dateKey = "2026-07-31";
    authState.user = { id: "owner-user", email: "j3010@ymail.com" };
    authState.approvalRows = [];
    authState.approvalRowsLoaded = false;
    state.selectedDateKey = dateKey;
    state.employeeLogs[dateKey] = {};
    const oldIsomiLog = createEmployeeLog({
      id: "profile-isomi-auth",
      name: "이소미",
      org: "(주)방주",
      role: "재무 대리"
    }, {}, dateKey);
    oldIsomiLog.tasks[0].text = "7월 31일 지출 정산 마감";
    oldIsomiLog.schedule[0].text = "법인카드 증빙 정리";
    mergeVisibleStaffWorklogStates([{
      user_id: "isomi-auth",
      updated_at: "2026-07-31T18:10:00.000Z",
      state: {
        profile: {
          name: "이소미",
          email: "isomi@example.com",
          org: "(주)방주",
          role: "재무 대리",
          approvalStatus: "approved"
        },
        selectedEmployeeId: "profile-isomi-auth",
        employeeLogs: { [dateKey]: { "profile-isomi-auth": oldIsomiLog } }
      }
    }], dateKey);
    authState.approvalRows = [{
      id: "isomi-auth",
      email: "isomi@example.com",
      name: "이소미",
      org: "(주)방주",
      role: "재무 대리",
      workplace: "본사",
      approval_status: "approved"
    }];
    authState.approvalRowsLoaded = true;
    state.worklogOverviewScope = "bangju";
    normalizeState();
    renderDateNav();
    renderWorklogOverview();
    const entry = getOverviewGroupEmployeeEntries(getWorklogOverviewGroups().find((group) => group.id === "bangju"))
      .find(({ employee }) => employee.name === "이소미");
    const card = [...document.querySelectorAll(".worklog-overview-employee-sheet")]
      .find((item) => item.querySelector("h3")?.textContent.includes("이소미"));
    return JSON.stringify({
      employeeId: entry?.employeeId || "",
      storedTask: state.employeeLogs[dateKey]?.[entry?.employeeId]?.tasks?.[0]?.text || "",
      cardText: card?.textContent?.replace(/\\s+/g, " ").trim() || ""
    });
  })()`));
  const isomiHistoricalMetrics = JSON.parse(isomiHistorical);
  if (isomiHistoricalMetrics.employeeId !== "bangju-finance-assistant"
    || isomiHistoricalMetrics.storedTask !== "7월 31일 지출 정산 마감"
    || !isomiHistoricalMetrics.cardText.includes("7월 31일 지출 정산 마감")
    || !isomiHistoricalMetrics.cardText.includes("법인카드 증빙 정리")) {
    fail("representative overview should preserve Isomi's July 31 worklog after approval directory loads", isomiHistorical);
  }
  const allStaffSync = await page.evaluate(() => window.eval(`(() => {
    const dateKey = "2026-08-02";
    const staff = [
      ["bangju-finance-manager", "최희진", "(주)방주", "재무과장", "finance-manager@example.com"],
      ["bangju-finance-assistant", "이소미", "(주)방주", "재무 대리", "isomi@example.com"],
      ["beyond-fitness-manager", "박주홍", "(주)방주 / 비욘드 피트니스 지사", "센터장", "pjhong0@naver.com"],
      ["fitness-trainer-1", "홍현규", "(주)방주 / 비욘드 피트니스 지사", "트레이너", "trainer@example.com"],
      ["fitness-weekday-info-idabin", "이다빈", "(주)방주 / 비욘드 피트니스 지사", "인포데스크", "idabin@example.com"],
      ["fitness-info-kimyoungchae", "김영채", "(주)방주 / 비욘드 피트니스 지사", "인포데스크", "yckim1558@naver.com"],
      ["fitness-info-shinsemin", "신세민", "(주)방주 / 비욘드 피트니스 지사", "인포데스크", "tpals2990@naver.com"],
      ["fitness-weekday-info", "홍길동", "(주)방주 / 비욘드 피트니스 지사", "인포데스크", "projch@naver.com"],
      ["beyond-company-leader", "김성민", "(주)비욘드컴퍼니", "실장", "ksm@example.com"],
      ["beyond-shared-manager", "추소영", "(주)비욘드컴퍼니 / 공유사업부", "공유사업부 매니저", "choo@example.com"]
    ];
    state.selectedDateKey = dateKey;
    state.employeeLogs[dateKey] = {};
    authState.approvalRows = [];
    authState.approvalRowsLoaded = false;
    const rows = staff.map(([expectedId, name, org, role, email], index) => {
      const userId = "staff-auth-" + index;
      const legacyId = [expectedId, "profile-user", userId, "profile-" + userId][index % 4];
      const log = createEmployeeLog({ id: legacyId, name, org, role, email }, {}, dateKey);
      log.tasks[0].text = "전직원동기화-" + expectedId;
      log.schedule[0].text = "시간표동기화-" + expectedId;
      return {
        user_id: userId,
        updated_at: "2026-08-02T" + String(10 + index).padStart(2, "0") + ":00:00.000Z",
        state: {
          profile: { name, org, role, email, workplace: /피트니스/.test(org) ? "비욘드 피트니스" : "", approvalStatus: "approved" },
          selectedEmployeeId: legacyId,
          employeeLogs: { [dateKey]: { [legacyId]: log } }
        }
      };
    });
    mergeVisibleStaffWorklogStates(rows, dateKey);
    authState.approvalRows = rows.map((row) => ({
      id: row.user_id,
      email: row.state.profile.email,
      name: row.state.profile.name,
      org: row.state.profile.org,
      role: row.state.profile.role,
      workplace: row.state.profile.workplace,
      weekly_work_hours: row.state.profile.name === "추소영" ? { mon: "09:00-18:00" } : {},
      approval_status: "approved"
    }));
    authState.approvalRowsLoaded = true;
    normalizeState();
    const overviewIds = getWorklogOverviewGroups().flatMap(getOverviewGroupEmployeeEntries).map(({ employeeId }) => employeeId);
    const failures = staff.flatMap(([expectedId]) => {
      const log = getEmployeeLogForDate(expectedId, dateKey);
      const expectedTask = "전직원동기화-" + expectedId;
      const expectedSchedule = "시간표동기화-" + expectedId;
      const errors = [];
      if (log.tasks?.[0]?.text !== expectedTask) errors.push(expectedId + ":task");
      if (!(log.schedule || []).some((entry) => String(entry.text || "").includes(expectedSchedule))) errors.push(expectedId + ":schedule");
      if (!overviewIds.includes(expectedId)) errors.push(expectedId + ":overview-id");
      return errors;
    });
    return JSON.stringify({ failures, overviewIds });
  })()`));
  const allStaffSyncMetrics = JSON.parse(allStaffSync);
  if (allStaffSyncMetrics.failures.length) {
    fail("representative overview should synchronize every assigned employee through canonical worklog IDs", allStaffSync);
  }
  const scheduleTypeCatalogMetrics = await page.evaluate(() => window.eval(`(() => {
    const finance = findEmployeeRecordById("bangju-finance-manager");
    const project = findEmployeeRecordById("beyond-company-leader");
    const shared = findEmployeeRecordById("beyond-shared-manager");
    const fitness = findEmployeeRecordById("beyond-fitness-manager");
    const construction = { id: "construction-qa", org: "(주)비제이종합건설", role: "공사부장", workplace: "동천체육관 현장" };
    const options = (employee) => getScheduleTypeOptionsForLog({ employeeId: employee.id });
    return JSON.stringify({
      financeKey: getScheduleTypeCatalogKey(finance),
      finance: options(finance),
      project: options(project),
      shared: options(shared),
      fitness: options(fitness),
      construction: scheduleTypeCatalog[getScheduleTypeCatalogKey(construction)],
      financeInference: inferScheduleType("세금계산서 증빙 정산", options(finance)),
      projectInference: inferScheduleType("욕실 시공 현장 확인", options(project)),
      sharedInference: inferScheduleType("신규 입주 상담", options(shared)),
      constructionInference: inferScheduleType("현장 안전 점검", scheduleTypeCatalog.construction),
      generalEditorConnected: /openWorklogScheduleEditor/.test(document.documentElement.innerHTML) || typeof openWorklogScheduleEditor === "function"
    });
  })()`));
  const scheduleTypeCatalog = JSON.parse(scheduleTypeCatalogMetrics);
  if (scheduleTypeCatalog.financeKey !== "finance"
    || scheduleTypeCatalog.finance.includes("유료PT")
    || scheduleTypeCatalog.finance.includes("무료PT")
    || !["회계/장부", "자금/이체", "세무/신고", "급여/노무", "증빙/정산"].every((item) => scheduleTypeCatalog.finance.includes(item))
    || !["견적/계약", "설계/디자인", "시공/현장"].every((item) => scheduleTypeCatalog.project.includes(item))
    || !["입주/상담", "계약/수납", "공간/시설"].every((item) => scheduleTypeCatalog.shared.includes(item))
    || !["유료PT", "무료PT", "회원관리"].every((item) => scheduleTypeCatalog.fitness.includes(item))
    || !["공정/시공", "안전/점검", "자재/발주"].every((item) => scheduleTypeCatalog.construction.includes(item))
    || scheduleTypeCatalog.financeInference !== "증빙/정산"
    || scheduleTypeCatalog.projectInference !== "시공/현장"
    || scheduleTypeCatalog.sharedInference !== "입주/상담"
    || scheduleTypeCatalog.constructionInference !== "안전/점검"
    || !scheduleTypeCatalog.generalEditorConnected) {
    fail("schedule type catalog should follow each employee's business site and role", scheduleTypeCatalogMetrics);
  }
  const signalDetection = await page.evaluate(() => window.eval(`(() => {
    const dateKey = "2026-08-02";
    const employeeId = "bangju-finance-manager";
    const employee = findEmployeeRecordById(employeeId);
    const group = getWorklogOverviewGroups().find((item) => item.id === "bangju");
    const log = getEmployeeLogForDate(employeeId, dateKey);
    const previousStatus = log.attendanceStatus;
    const previousReport = log.report;
    log.attendanceStatus = "결석";
    log.report = "현장 안전사고 및 환불 민원 확인 필요";
    const model = getOverviewEmployeeSummaryModel(group, employeeId, employee, dateKey);
    const signals = detectRepresentativeEmployeeSignals(model, dateKey);
    log.attendanceStatus = previousStatus;
    log.report = previousReport;
    return JSON.stringify(signals.map(({ level, category, title, evidence, action }) => ({ level, category, title, evidence, action })));
  })()`));
  const signalDetectionMetrics = JSON.parse(signalDetection);
  if (!signalDetectionMetrics.some((item) => item.level === "critical" && item.category === "근태")
    || !signalDetectionMetrics.some((item) => item.level === "critical" && item.category === "안전·운영")
    || !signalDetectionMetrics.some((item) => item.category === "고객·금전")
    || signalDetectionMetrics.some((item) => !item.evidence || !item.action)) {
    fail("employee signal engine should classify attendance, safety, and customer risks with evidence and actions", signalDetection);
  }
  const overviewProjection = await page.evaluate(() => window.eval(`(() => {
    const dateKey = "2026-08-02";
    const writtenId = "bangju-finance-manager";
    const blankId = "bangju-finance-assistant";
    const written = getEmployeeLogForDate(writtenId, dateKey);
    written.report = "";
    written.tasks[0].text = "보고서 문장 없이 작성한 업무일지";
    const blank = getEmployeeLogForDate(blankId, dateKey);
    blank.report = "";
    blank.tasks = Array.from({ length: 8 }, (_, index) => ({ id: "blank-task-" + index, text: "", status: "예정", done: false }));
    blank.schedule = Array.from({ length: 11 }, (_, index) => ({ id: "blank-schedule-" + index, time: String(8 + index).padStart(2, "0") + ":00", text: "" }));
    state.worklogOverviewScope = "all";
    renderWorklogOverview();
    const worklogKpi = [...document.querySelectorAll(".overview-all-kpis article")]
      .find((node) => node.querySelector("span")?.textContent.trim() === "업무일지");
    state.worklogOverviewScope = "bangju";
    renderWorklogOverview();
    const blankCard = [...document.querySelectorAll(".worklog-overview-employee-sheet")]
      .find((item) => item.querySelector("h3")?.textContent.includes("이소미"));
    return JSON.stringify({
      kpiText: worklogKpi?.textContent?.replace(/\\s+/g, " ").trim() || "",
      taskRows: blankCard?.querySelectorAll(".overview-task-mini").length ?? -1,
      scheduleRows: blankCard?.querySelectorAll(".overview-schedule-mini").length ?? -1,
    });
  })()`));
  const overviewProjectionMetrics = JSON.parse(overviewProjection);
  if (!overviewProjectionMetrics.kpiText.includes("업무일지")
    || !overviewProjectionMetrics.kpiText.match(/[1-9][0-9]*\/10/)
    || overviewProjectionMetrics.taskRows !== 3
    || overviewProjectionMetrics.scheduleRows !== 3) {
    fail("representative overview should count any written worklog and keep empty previews compact", overviewProjection);
  }
  const bangjuCoworkerNavigation = await page.evaluate(() => window.eval(`(() => {
    state.selectedEmployeeId = "bangju-finance-manager";
    switchView("bangju-log");
    setTodayPageMode("coworker");
    const board = document.querySelector("#coworkerWorklogBoard");
    const names = [...(board?.querySelectorAll(".coworker-worklog-item header b") || [])].map((node) => node.textContent.trim());
    const boardText = board?.textContent?.replace(/\\s+/g, " ").trim() || "";
    const isomiButton = board?.querySelector('[data-coworker-worklog-open="bangju-finance-assistant"]');
    isomiButton?.click();
    const exitButton = document.getElementById("returnToWorklogOverviewButton");
    const result = {
      names,
      boardText,
      selectedAfterOpen: state.selectedEmployeeId,
      pageModeAfterOpen: document.querySelector("#worklogMain")?.dataset.todayPage || "",
      exitVisible: Boolean(exitButton && !exitButton.hidden),
      exitText: exitButton?.textContent?.replace(/\\s+/g, " ").trim() || "",
      fitnessLeak: /박주홍|홍현규|신세민|이다빈|김영채|피트니스/.test(boardText),
    };
    exitButton?.click();
    result.returnedView = document.body.dataset.activeView || "";
    return JSON.stringify(result);
  })()`));
  const bangjuCoworkerMetrics = JSON.parse(bangjuCoworkerNavigation);
  if (!bangjuCoworkerMetrics.names[0]?.includes("이소미")
    || bangjuCoworkerMetrics.fitnessLeak
    || bangjuCoworkerMetrics.selectedAfterOpen !== "bangju-finance-assistant"
    || bangjuCoworkerMetrics.pageModeAfterOpen !== "daily"
    || !bangjuCoworkerMetrics.exitVisible
    || !bangjuCoworkerMetrics.exitText.includes("전체 업무일지")
    || bangjuCoworkerMetrics.returnedView !== "worklog-overview") {
    fail("Bangju coworker navigation should open Isomi without leaking fitness staff and return to all worklogs", bangjuCoworkerNavigation);
  }
  const overviewDetailOpen = await page.evaluate(() => window.eval(`(() => {
    state.companyCommonWeeks ||= {};
    state.companyCommonWeeks["beyond-company"] ||= {};
    state.companyCommonWeeks["beyond-company"][getActiveWeekKey(state.selectedDateKey)] = {
      weekKey: getActiveWeekKey(state.selectedDateKey),
      sections: {
        departmentMonthly: [],
        departmentWeekly: [{ id: "common-overview-test", text: "전 사업장 공통 보고", owner: "김성민", eventStatus: "확정", done: false }],
        personalMonthly: [],
        personalWeekly: []
      },
      days: {}
    };
    state.worklogOverviewScope = "beyond";
    renderWorklogOverview();
    const carousel = document.querySelector('.worklog-overview-site[data-overview-site="beyond"] .overview-site-carousel');
    const employeeOrder = [...(carousel?.querySelectorAll("[data-overview-employee]") || [])]
      .map((button) => button.dataset.overviewEmployee);
    const statusLabels = [...(carousel?.querySelectorAll(".overview-work-status") || [])]
      .map((item) => ({ key: item.dataset.shiftStatus, text: item.textContent.replace(/\\s+/g, " ").trim() }));
    const commonFirst = Boolean(carousel?.firstElementChild?.classList.contains("overview-common-sheet"));
    const commonText = carousel?.firstElementChild?.textContent?.replace(/\\s+/g, " ").trim() || "";
    const liveStatus = getOverviewWorkStatus(
      { role: "실장", workHours: "09:00-18:00" },
      { clockIn: "09:00", attendanceStatus: "출근" },
      todayKey,
      new Date(todayKey + "T10:00:00")
    );
    const todayWrittenStatus = getOverviewWorkStatus(
      { role: "실장", workHours: "09:00-18:00" },
      { tasks: [{ text: "오늘 작성 업무", status: "예정" }], schedule: [] },
      todayKey,
      new Date(todayKey + "T10:00:00")
    );
    const pastWorkedStatus = getOverviewWorkStatus(
      { role: "실장", workHours: "09:00-18:00" },
      { tasks: [{ text: "과거 작성 업무", status: "완료" }], schedule: [], report: "업무 완료" },
      getPreviousDateKey(todayKey),
      new Date(todayKey + "T10:00:00")
    );
    const pastMissingStatus = getOverviewWorkStatus(
      { role: "실장", workHours: "09:00-18:00" },
      { tasks: [], schedule: [] },
      getPreviousDateKey(todayKey),
      new Date(todayKey + "T10:00:00")
    );
    const openButton = document.querySelector('[data-overview-employee="beyond-company-leader"]');
    openButton?.click();
    const taskText = [...document.querySelectorAll("#worklogTaskBoard .task-text-input")]
      .map((input) => input.value)
      .find((value) => value.includes("전직원동기화-beyond-company-leader")) || "";
    const scheduleText = [...document.querySelectorAll("#worklogAppointmentList .schedule-text-input")]
      .map((input) => input.value)
      .find((value) => value.includes("시간표동기화-beyond-company-leader")) || "";
    const exitButton = document.getElementById("returnToWorklogOverviewButton");
    const result = {
      activeView: document.body.dataset.activeView || "",
      selectedEmployeeId: state.selectedEmployeeId,
      taskText,
      taskRows: document.querySelectorAll("#worklogTaskBoard .worklog-task-row").length,
      scheduleText,
      exitVisible: Boolean(exitButton && !exitButton.hidden),
      analysisVisible: !document.querySelector("#representativeEmployeeAnalysis")?.hidden,
      analysisKpis: document.querySelectorAll("#representativeEmployeeAnalysis .representative-analysis-kpis article").length,
      analysisCompetencies: document.querySelectorAll("#representativeEmployeeAnalysis .representative-competency-panel label").length,
      analysisText: document.querySelector("#representativeEmployeeAnalysis")?.textContent?.replace(/\s+/g, " ").trim() || "",
      commonFirst,
      commonText,
      employeeOrder,
      statusLabels,
      liveStatus,
      todayWrittenStatus,
      pastWorkedStatus,
      pastMissingStatus,
    };
    exitButton?.click();
    result.returnedView = document.body.dataset.activeView || "";
    return JSON.stringify(result);
  })()`));
  const overviewDetailMetrics = JSON.parse(overviewDetailOpen);
  if (overviewDetailMetrics.activeView !== "beyond-log"
    || overviewDetailMetrics.selectedEmployeeId !== "beyond-company-leader"
    || !overviewDetailMetrics.taskText
    || overviewDetailMetrics.taskRows !== 3
    || !overviewDetailMetrics.scheduleText
    || !overviewDetailMetrics.exitVisible
    || !overviewDetailMetrics.analysisVisible
    || overviewDetailMetrics.analysisKpis !== 4
    || overviewDetailMetrics.analysisCompetencies !== 5
    || !overviewDetailMetrics.analysisText.includes("결근 판정이 아니며")
    || !overviewDetailMetrics.commonFirst
    || !overviewDetailMetrics.commonText.includes("전 사업장 공통 보고")
    || overviewDetailMetrics.employeeOrder[0] !== "beyond-company-leader"
    || overviewDetailMetrics.employeeOrder[1] !== "beyond-shared-manager"
    || !overviewDetailMetrics.statusLabels.some((item) => item.key === "off" && item.text.includes("비번"))
    || overviewDetailMetrics.liveStatus?.key !== "working"
    || overviewDetailMetrics.liveStatus?.label !== "근무중"
    || overviewDetailMetrics.todayWrittenStatus?.key !== "working"
    || overviewDetailMetrics.todayWrittenStatus?.label !== "근무중"
    || overviewDetailMetrics.pastWorkedStatus?.key !== "worked"
    || overviewDetailMetrics.pastWorkedStatus?.label !== "근무함"
    || overviewDetailMetrics.pastMissingStatus?.key !== "unrecorded"
    || overviewDetailMetrics.pastMissingStatus?.label !== "미기록"
    || overviewDetailMetrics.returnedView !== "worklog-overview") {
    fail("representative employee detail should preserve the overview worklog and provide an exit", overviewDetailOpen);
  }
  const staleProfileSync = await page.evaluate(() => window.eval(`(() => {
    authState.approvalRows = [
      { id: "isomi-live-user", email: "isomi@example.com", name: "이소미", org: "(주)방주", role: "재무 대리", workplace: "본사", approval_status: "approved" },
      { id: "youngchae-live-user", email: "yckim1558@naver.com", name: "김영채", org: "(주)방주 / 비욘드 피트니스 지사", role: "인포데스크", workplace: "비욘드 피트니스", approval_status: "approved" },
      { id: "choosoyoung-live-user", email: "choo@example.com", name: "추소영", org: "(주)비욘드컴퍼니 / 공유사업부", role: "공유사업부 매니저", workplace: "공유사업부", approval_status: "approved" }
    ];
    authState.approvalRowsLoaded = true;
    const rows = [
      ["2026-07-31", "isomi-live-user", "bangju-finance-assistant", "이소미 7월31일 실제업무"],
      ["2026-08-02", "youngchae-live-user", "fitness-info-kimyoungchae", "김영채 8월2일 실제업무"],
      ["2026-08-03", "choosoyoung-live-user", "beyond-shared-manager", "추소영 오늘 실제업무"]
    ].map(([dateKey, userId, expectedId, marker], index) => {
      const log = createEmployeeLog({ id: "profile-user", name: "과거 프로필", org: "미분류", role: "직원" }, {}, dateKey);
      log.tasks[0].text = marker;
      return {
        user_id: userId,
        updated_at: "2026-08-02T1" + index + ":00:00.000Z",
        state: {
          profile: { name: "과거 프로필", email: "old-" + index + "@example.com", org: "미분류", role: "직원" },
          selectedEmployeeId: "profile-user",
          employeeLogs: { [dateKey]: { "profile-user": log } }
        },
        dateKey,
        expectedId,
        marker
      };
    });
    rows.forEach((row) => {
      state.employeeLogs[row.dateKey] = {};
      mergeVisibleStaffWorklogStates([row], row.dateKey);
    });
    return JSON.stringify(rows.map(({ dateKey, expectedId, marker }) => ({
      dateKey,
      expectedId,
      marker,
      stored: state.employeeLogs[dateKey]?.[expectedId]?.tasks?.[0]?.text || ""
    })));
  })()`));
  const staleProfileMetrics = JSON.parse(staleProfileSync);
  if (staleProfileMetrics.some((item) => item.stored !== item.marker)) {
    fail("representative overview should map historical worklogs by employee account UUID even when snapshot profiles are stale", staleProfileSync);
  }
  const isomiTodaySync = await page.evaluate(() => window.eval(`(() => {
    const dateKey = "2026-08-05";
    authState.user = { id: "owner-user", email: "j3010@ymail.com" };
    authState.approvalRows = [
      { id: "isomi-current-user", email: "isomi-current@example.com", name: "이소미", org: "(주)방주", role: "재무 대리", approval_status: "approved" },
      { id: "isomi-legacy-user", email: "isomi-legacy@example.com", name: "이소미", org: "(주)방주", role: "재무 대리", approval_status: "approved" }
    ];
    authState.approvalRowsLoaded = true;
    state.employeeLogs[dateKey] = {};
    const currentLog = createEmployeeLog({ id: "bangju-finance-assistant", name: "이소미", org: "(주)방주", role: "재무 대리" }, {}, dateKey);
    currentLog.tasks[0].text = "이소미 오늘 실제업무";
    const legacyLog = createEmployeeLog({ id: "profile-user", name: "이소미", org: "(주)방주", role: "재무 대리" }, {}, dateKey);
    legacyLog.tasks[0].text = "이소미 이전 복제계정 업무";
    mergeVisibleStaffWorklogStates([
      {
        user_id: "isomi-legacy-user",
        updated_at: "2026-08-05T09:10:00.000Z",
        state: { profile: { name: "이소미", org: "(주)방주", role: "재무 대리" }, ownerEmployeeId: "profile-user", ownerWorklog: legacyLog }
      },
      {
        user_id: "isomi-current-user",
        updated_at: "2026-08-05T09:00:00.000Z",
        state: { profile: { name: "이소미", org: "(주)방주", role: "재무 대리" }, ownerEmployeeId: "bangju-finance-assistant", ownerWorklog: currentLog }
      }
    ], dateKey);
    return state.employeeLogs[dateKey]?.["bangju-finance-assistant"]?.tasks?.[0]?.text || "";
  })()`));
  if (isomiTodaySync !== "이소미 오늘 실제업무") {
    fail("representative overview should prefer Isomi's canonical owner worklog over a newer legacy duplicate", isomiTodaySync);
  }
  const localUnsyncedProtection = await page.evaluate(() => window.eval(`(() => {
    const dateKey = "2026-08-05";
    authState.user = { id: "isomi-current-user", email: "isomi-current@example.com" };
    state.profile = { ...defaultProfile, name: "이소미", org: "(주)방주", role: "재무 대리", email: "isomi-current@example.com", approvalStatus: "approved" };
    const localLog = createEmployeeLog({ id: "bangju-finance-assistant", name: "이소미", org: "(주)방주", role: "재무 대리" }, state.profile, dateKey);
    localLog.tasks[0].text = "아직 전송되지 않은 이소미 업무";
    localLog.updatedAt = "2026-08-05T09:30:00.000Z";
    state.employeeLogs[dateKey] = { "bangju-finance-assistant": localLog };
    const remoteLog = createEmployeeLog({ id: "bangju-finance-assistant", name: "이소미", org: "(주)방주", role: "재무 대리" }, state.profile, dateKey);
    remoteLog.tasks[0].text = "이전 원격 업무";
    remoteLog.updatedAt = "2026-08-05T09:00:00.000Z";
    mergeOwnRemoteEmployeeLogs({ [dateKey]: { "bangju-finance-assistant": remoteLog } });
    return state.employeeLogs[dateKey]?.["bangju-finance-assistant"]?.tasks?.[0]?.text || "";
  })()`));
  if (localUnsyncedProtection !== "아직 전송되지 않은 이소미 업무") {
    fail("employee login should not overwrite a newer unsynced local worklog with an older remote snapshot", localUnsyncedProtection);
  }
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.evaluate(() => {
    authState.user = { id: "owner-user", email: "j3010@ymail.com" };
    state.profile = {
      ...defaultProfile,
      email: "j3010@ymail.com",
      role: "대표",
      name: "Benny",
      nickname: "베니",
      approvalStatus: "approved",
    };
    state.worklogOverviewScope = "all";
    localStorage.setItem("beyond-worklog-global-view-mode", "classic");
    setSelectedDateKey("2026-08-02");
    switchView("worklog-overview");
    renderResponsiveMode();
  });
  await page.waitForTimeout(250);
  const desktopMetrics = await page.evaluate(() => {
    const shell = document.querySelector(".worklog-shell")?.getBoundingClientRect();
    const hero = document.querySelector(".worklog-overview-hero")?.getBoundingClientRect();
    const dateTitle = document.querySelector("#overviewDateTitle");
    const dateYear = document.querySelector("#overviewDateYear")?.getBoundingClientRect();
    const dateDay = document.querySelector("#overviewDateDay")?.getBoundingClientRect();
    const kpiTops = [...document.querySelectorAll(".overview-all-kpis article")].map((node) => Math.round(node.getBoundingClientRect().top));
    const businessTops = [...document.querySelectorAll(".overview-business-snapshot")].slice(0, 3).map((node) => Math.round(node.getBoundingClientRect().top));
    return {
      layoutMode: document.body.dataset.layoutMode || "",
      shellWidth: shell?.width || 0,
      heroHeight: hero?.height || 0,
      dateText: dateTitle?.textContent?.trim() || "",
      dateFits: dateTitle ? dateTitle.scrollWidth <= dateTitle.clientWidth + 2 : false,
      dateSingleLine: Boolean(dateYear && dateDay && Math.abs(dateYear.top - dateDay.top) <= 2),
      kpiColumns: new Set(kpiTops).size === 1 ? kpiTops.length : 0,
      businessColumns: businessTops.filter((top) => top === businessTops[0]).length,
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  if (desktopMetrics.layoutMode !== "wide" || desktopMetrics.shellWidth < 1100) {
    fail("representative overview should use the desktop canvas", JSON.stringify(desktopMetrics));
  }
  if (!desktopMetrics.dateFits || !desktopMetrics.dateSingleLine || desktopMetrics.dateText !== "2026.08.02(日)") {
    fail("desktop overview date should stay intact on one line", JSON.stringify(desktopMetrics));
  }
  if (desktopMetrics.heroHeight > 115 || desktopMetrics.kpiColumns !== 6 || desktopMetrics.businessColumns < 3 || desktopMetrics.horizontalOverflow > 2) {
    fail("desktop overview should keep a compact information-dense grid", JSON.stringify(desktopMetrics));
  }
  if (errors.length) fail("overview page errors", errors.join(" | "));
  await page.close();
}

async function checkControlTower(browser) {
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("beyond-worklog-state-v1", JSON.stringify({
      selectedDateKey: "2026-07-23",
      profile: {
        email: "j3010@ymail.com",
        role: "대표",
        name: "Benny",
        nickname: "베니",
        approvalStatus: "approved",
      },
      employeeLogs: {},
    }));
  });
  await page.goto(target, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    document.body.classList.remove("physical-phone-device");
    document.body.dataset.layoutMode = "classic";
    document.body.dataset.viewMode = "classic";
    window.eval(`
      siteWeatherAddressTargets.forEach((target, index) => {
        state.siteWeatherAddresses[target.key] = "울산광역시 사업장 " + (index + 1);
        state.weatherCache[getWeatherCacheKey(target.key, todayKey)] = {
          siteKey: target.key,
          dateKey: todayKey,
          location: "울산 " + target.label,
          condition: index % 2 ? "흐림" : "맑음",
          weatherCode: index % 2 ? 3 : 0,
          temperature: 24 + index,
          temperatureMin: 20 + index,
          temperatureMax: 28 + index,
          humidity: 55 + index,
          fetchedAt: new Date().toISOString(),
        };
      });
      switchView("control");
    `);
  });
  await page.waitForTimeout(350);

  const metrics = await page.evaluate(() => {
    const hero = document.querySelector(".control-tower-hero");
    const body = document.querySelector("#controlTowerBody");
    return {
      activeView: document.body.dataset.activeView,
      denied: Boolean(document.querySelector("#controlAccessCard:not([hidden])")),
      bodyHidden: body?.hidden,
      heroHeight: hero?.getBoundingClientRect().height || 0,
      kpiCount: document.querySelectorAll("#controlKpiGrid article").length,
      briefingCount: document.querySelectorAll("#controlBriefingList article").length,
      siteCount: document.querySelectorAll("#controlSiteGrid article").length,
      weatherCount: document.querySelectorAll("#controlSiteWeatherBoard .site-weather-board-grid article").length,
      weatherRecordedCount: document.querySelectorAll("#controlSiteWeatherBoard .site-weather-board-grid article.has-weather").length,
      weatherText: document.querySelector("#controlSiteWeatherBoard")?.textContent?.replace(/\s+/g, " ").trim() || "",
      jumpCount: document.querySelectorAll("[data-control-jump]").length,
      titleText: document.querySelector(".control-tower-hero h2")?.textContent?.trim() || "",
    };
  });

  if (metrics.activeView !== "control") fail("control tower active view mismatch", metrics.activeView);
  if (metrics.denied || metrics.bodyHidden) fail("representative control tower should be visible");
  if (metrics.titleText !== "방주그룹 통합관제") fail("control tower title mismatch", metrics.titleText);
  if (metrics.heroHeight > 180) fail("control tower hero is too tall", `${metrics.heroHeight}px`);
  if (metrics.kpiCount !== 6) fail("control tower should focus on six compact KPIs", String(metrics.kpiCount));
  if (metrics.briefingCount !== 3) fail("control tower briefing should show three signals", String(metrics.briefingCount));
  if (metrics.siteCount < 3) fail("control tower should show business site signals", String(metrics.siteCount));
  if (metrics.weatherCount !== 7 || metrics.weatherRecordedCount !== 7 || !metrics.weatherText.includes("비욘드 피트니스") || !metrics.weatherText.includes("맑음")) {
    fail("representative control tower should show weather for every configured site address", JSON.stringify(metrics));
  }
  if (metrics.jumpCount !== 4) fail("control tower action shortcuts missing", String(metrics.jumpCount));
  if (errors.length) fail("control tower page errors", errors.join(" | "));
  await page.close();
}

async function checkRepresentativeProfileSeparation(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("beyond-worklog-state-v1", JSON.stringify({
      selectedDateKey: "2026-07-23",
      selectedEmployeeId: "beyond-fitness-manager",
      fitnessWritableEmployeeId: "beyond-fitness-manager",
      profile: {
        email: "j3010@ymail.com",
        role: "대표",
        name: "정찬훈",
        nickname: "베니",
        org: "(주)방주",
        approvalStatus: "approved",
      },
      employeeLogs: {},
    }));
  });
  await page.goto(target, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    document.body.classList.add("physical-phone-device");
    document.body.dataset.layoutMode = "phone";
    document.body.dataset.viewMode = "ceo";
    window.switchView?.("fitness-log");
  });
  await page.waitForTimeout(350);
  await page.evaluate(() => {
    const page = window.eval("getCurrentFitnessLogPage()");
    const employeeId = page?.id || "beyond-fitness-manager";
    const log = window.eval("getFitnessEmployeeLogForDate")(page?.employee || { id: employeeId }, "2026-07-23")
      || window.eval(`getEmployeeLogForDate(${JSON.stringify(employeeId)}, "2026-07-23")`);
    log.tasks = Array.from({ length: 8 }, (_, index) => ({
      id: `representative-blank-${index}`,
      priority: "?",
      text: "",
      status: "미완료",
      done: false,
    }));
    const scheduleEntry = log.schedule.find((entry) => entry.time === "06:00") || log.schedule[0];
    scheduleEntry.text = "(시설청결)웨이트존 청소기/(시설청결)웨이트존 거울닦기";
    delete scheduleEntry.items;
    window.eval("renderFitnessWorklog")?.(log);
  });
  await page.waitForTimeout(120);
  const metrics = await page.evaluate(() => {
    const header = document.querySelector("#globalHeaderTitle")?.textContent?.trim() || "";
    const pager = document.querySelector("#fitnessLogPagerTitle")?.textContent?.trim() || "";
    const view = document.querySelector("#view-fitness-log");
    const exitButton = document.querySelector("#returnToFitnessWorklogOverviewButton");
    const identityBadge = document.querySelector("#fitnessIdentityBadge");
    const exitRect = exitButton?.getBoundingClientRect();
    const identityRect = identityBadge?.getBoundingClientRect();
    const firstScheduleRow = document.querySelector("#fitnessAppointmentList .fitness-appointment-row");
    const filledScheduleRow = document.querySelector("#fitnessAppointmentList .fitness-appointment-row.is-filled");
    const firstScheduleTime = firstScheduleRow?.querySelector(".appointment-time");
    const smartScheduleRow = window.eval("renderFitnessAppointmentRow")({
      time: "06:00",
      text: "(시설청결)웨이트존 청소기/(시설청결)웨이트존 거울닦기",
      status: "예정",
      mergeDown: false,
    }, window.eval("getSelectedLog")());
    const snapshot = window.eval("buildRemoteSnapshot()");
    return {
      header,
      pager,
      identityBadge: document.querySelector("#fitnessIdentityBadge")?.textContent?.trim() || "",
      permission: view?.dataset.fitnessPermission || "",
      pageType: view?.dataset.fitnessPageType || "",
      selectedEmployeeId: window.state?.selectedEmployeeId || "",
      exitVisible: Boolean(exitButton && !exitButton.hidden),
      exitIdentityOverlap: Boolean(exitRect && identityRect
        && exitRect.left < identityRect.right && exitRect.right > identityRect.left
        && exitRect.top < identityRect.bottom && exitRect.bottom > identityRect.top),
      exitHitTarget: exitRect
        ? document.elementFromPoint(exitRect.left + (exitRect.width / 2), exitRect.top + (exitRect.height / 2))?.id || ""
        : "",
      analysisVisible: !document.querySelector("#fitnessRepresentativeEmployeeAnalysis")?.hidden,
      analysisKpis: document.querySelectorAll("#fitnessRepresentativeEmployeeAnalysis .representative-analysis-kpis article").length,
      analysisCompetencies: document.querySelectorAll("#fitnessRepresentativeEmployeeAnalysis .representative-competency-panel label").length,
      analysisText: document.querySelector("#fitnessRepresentativeEmployeeAnalysis")?.textContent?.replace(/\s+/g, " ").trim() || "",
      taskRows: document.querySelectorAll("#fitnessTaskBoard .worklog-task-row").length,
      firstScheduleText: filledScheduleRow?.querySelector(".fitness-appointment-summary")?.textContent?.replace(/\s+/g, " ").trim() || "",
      smartScheduleText: smartScheduleRow.querySelector(".fitness-appointment-summary")?.textContent?.replace(/\s+/g, " ").trim() || "",
      firstScheduleTimeWhiteSpace: firstScheduleTime ? getComputedStyle(firstScheduleTime).whiteSpace : "",
      firstScheduleTimeHeight: firstScheduleTime?.getBoundingClientRect().height || 0,
      snapshotOwnerEmployeeId: snapshot.ownerEmployeeId || "",
      snapshotHasOwnerWorklog: Boolean(snapshot.ownerWorklog),
      snapshotEmployeeIds: Object.keys(snapshot.employeeLogs?.[snapshot.selectedDateKey] || {}),
    };
  });
  if (/정찬훈|베니|benny/i.test(metrics.header + metrics.pager + metrics.identityBadge)) {
    fail("representative profile leaked into fitness manager sheet", `${metrics.header} / ${metrics.pager}`);
  }
  if (!/센터장|박주홍/.test(metrics.header + metrics.pager + metrics.identityBadge)) {
    fail("fitness manager identity missing after representative separation", `${metrics.header} / ${metrics.pager}`);
  }
  if (metrics.permission !== "readonly" || metrics.pageType !== "coworker") {
    fail("representative should only read the fitness manager sheet", `${metrics.permission}/${metrics.pageType}`);
  }
  if (!metrics.exitVisible
    || metrics.exitIdentityOverlap
    || metrics.exitHitTarget !== "returnToFitnessWorklogOverviewButton"
    || !metrics.analysisVisible
    || metrics.analysisKpis !== 4
    || metrics.analysisCompetencies !== 5
    || !metrics.analysisText.includes("근태·역량 분석")
    || !metrics.analysisText.includes("결근 판정이 아니며")
    || metrics.taskRows !== 3) {
    fail("representative fitness detail should provide an overview exit and keep only three blank priority rows", JSON.stringify(metrics));
  }
  if (metrics.smartScheduleText !== "(시설청결) 웨이트존 청소기, 웨이트존 거울 닦기") {
    fail("same-time fitness facility tasks should be grouped into one smart label", metrics.smartScheduleText);
  }
  if (metrics.firstScheduleTimeWhiteSpace !== "nowrap" || metrics.firstScheduleTimeHeight > 24) {
    fail("fitness schedule time should stay on one line in the narrow representative view", JSON.stringify(metrics));
  }
  if (metrics.snapshotOwnerEmployeeId || metrics.snapshotHasOwnerWorklog || metrics.snapshotEmployeeIds.includes("profile-user")) {
    fail("representative remote snapshot must not contain a personal worklog", JSON.stringify(metrics));
  }
  await page.click("#returnToFitnessWorklogOverviewButton");
  if (await page.evaluate(() => document.body.dataset.activeView) !== "worklog-overview") {
    fail("representative fitness detail exit should return to the employee worklog overview");
  }
  if (errors.length) fail("representative separation page errors", errors.join(" | "));
  await page.close();
}

async function checkNonControlRoleTextDoesNotBecomeRepresentative(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("beyond-worklog-state-v1", JSON.stringify({
      selectedDateKey: "2026-07-23",
      selectedEmployeeId: "profile-user",
      profile: {
        email: "kim.sungmin@example.com",
        role: "대표",
        name: "김성민",
        nickname: "김성민",
        org: "(주)방주",
        workplace: "본사",
        primaryWork: "기획/관리",
        approvalStatus: "approved",
        accessPreset: "owner",
        permissions: { executiveRoom: true, staffApproval: true, worklogAll: true },
      },
      employeeLogs: {},
    }));
  });
  await page.goto(target, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    document.body.classList.add("physical-phone-device");
    document.body.dataset.layoutMode = "phone";
    document.body.dataset.viewMode = "ceo";
    window.eval(`
      authState.user = { id: "kim-sungmin", email: "kim.sungmin@example.com" };
      normalizeState();
      switchView(getInitialLandingView());
    `);
  });
  await page.waitForTimeout(350);
  const metrics = await page.evaluate(() => window.eval(`JSON.stringify({
    activeView: document.body.dataset.activeView,
    representative: isRepresentativeProfile(),
    approvalAuthority: hasApprovalAuthority(),
    worklogOverview: canAccessWorklogOverview(),
    profileRole: state.profile.role,
    accessPreset: state.profile.accessPreset
  })`));
  const parsed = JSON.parse(metrics);
  if (parsed.representative) fail("non-control role text should not grant representative access", metrics);
  if (parsed.approvalAuthority) fail("non-control role text should not grant approval authority", metrics);
  if (parsed.worklogOverview) fail("non-control role text should not open all-worklog overview", metrics);
  if (parsed.activeView === "executive" || parsed.activeView === "worklog-overview") {
    fail("non-control role text should land on an employee worklog", metrics);
  }
  if (errors.length) fail("non-control representative regression page errors", errors.join(" | "));
  await page.close();
}

async function checkDelegatedPermissionMenus(browser) {
  const { page, errors } = await openPage(browser, { width: 390, height: 844 });
  const matrix = await page.evaluate(() => window.eval(`(() => {
    authState.user = { id: "delegated-menu-user", email: "delegated@example.com" };
    const run = (permissions) => {
      state.profile = {
        ...defaultProfile,
        name: "권한위임 직원",
        role: "직원",
        org: "(주)방주",
        workplace: "본사",
        email: "delegated@example.com",
        approvalStatus: "approved",
        accessPreset: "employee",
        permissions
      };
      normalizeState();
      renderMainMenuAuthButton();
      return [...document.querySelectorAll("#mainMenuPopover button")]
        .filter((button) => !button.hidden)
        .map((button) => button.textContent.replace(/\\s+/g, " ").trim());
    };
    const worklogAll = run({ worklogAll: true });
    const staffOnly = run({ staffManage: true });
    const laborApproval = run({ laborSite: true, staffApproval: true });
    authState.user = { id: "fitness-manager-delegated", email: "pjhong0@naver.com" };
    state.profile = applyProfilePlacementOverride({ ...defaultProfile, email: "pjhong0@naver.com", approvalStatus: "approved", permissions: { worklogAll: true } });
    normalizeState();
    renderMainMenuAuthButton();
    const pinnedAccount = [...document.querySelectorAll("#mainMenuPopover button")]
      .filter((button) => !button.hidden)
      .map((button) => button.textContent.replace(/\\s+/g, " ").trim());
    authState.user = { id: "delegated-menu-user", email: "delegated@example.com" };
    state.profile.permissions = {};
    state.profile.email = "delegated@example.com";
    state.profile.accessPreset = "employee";
    normalizeState();
    switchView("staff");
    return JSON.stringify({ worklogAll, staffOnly, laborApproval, pinnedAccount, guardedView: document.body.dataset.activeView });
  })()`));
  const parsed = JSON.parse(matrix);
  if (!parsed.worklogAll.includes("전직원 업무일지") || parsed.worklogAll.some((label) => /직원$|노무|승인요청|통합관제/.test(label))) {
    fail("worklogAll delegation should build only the proportional all-worklog menu", matrix);
  }
  if (!parsed.staffOnly.includes("직원") || parsed.staffOnly.some((label) => /전직원 업무일지|노무|승인요청/.test(label))) {
    fail("staffManage delegation should expose staff without unrelated labor or approval menus", matrix);
  }
  if (!parsed.laborApproval.includes("소속 노무") || !parsed.laborApproval.some((label) => label.startsWith("승인요청")) || parsed.laborApproval.includes("직원")) {
    fail("laborSite and staffApproval should expose labor and approval independently", matrix);
  }
  if (!parsed.pinnedAccount.includes("전직원 업무일지")) {
    fail("fixed fitness account placement must preserve remotely delegated menu permissions", matrix);
  }
  if (parsed.guardedView === "staff") fail("hidden staff route should remain guarded", matrix);
  if (errors.length) fail("delegated permission menu page errors", errors.join(" | "));
  await page.close();
}

async function checkKimSungminAccountIsEmployeeOnly(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("beyond-worklog-state-v1", JSON.stringify({
      selectedDateKey: "2026-07-27",
      selectedEmployeeId: "bangju-finance-manager",
      profile: {
        email: "tbakorea@gmail.com",
        role: "대표",
        name: "김성민",
        nickname: "김성민",
        org: "(주)방주",
        workplace: "본사",
        primaryWork: "기획/관리",
        approvalStatus: "approved",
        accessPreset: "owner",
        permissions: {
          executiveRoom: true,
          controlTower: true,
          worklogAll: true,
          staffApproval: true,
          staffManage: true,
          laborAll: true,
        },
      },
      employeeLogs: {},
    }));
    localStorage.setItem("beyond-worklog-global-view-mode", "ceo");
  });
  await page.goto(target, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    document.body.classList.add("physical-phone-device");
    document.body.dataset.layoutMode = "phone";
    document.body.dataset.viewMode = "ceo";
    window.eval(`
      authState.user = { id: "tbakorea-user", email: "tbakorea@gmail.com" };
      normalizeState();
      enforceAuthProfileBoundary(authState.user);
      normalizeProfilePlacementForAuth();
      enforceAuthProfileBoundary(authState.user);
      switchView(getInitialLandingView());
    `);
  });
  await page.waitForTimeout(350);
  const metrics = await page.evaluate(() => window.eval(`JSON.stringify({
    activeView: document.body.dataset.activeView,
    representative: isRepresentativeProfile(),
    approvalAuthority: hasApprovalAuthority(),
    worklogOverview: canAccessWorklogOverview(),
    staffManage: hasProfilePermission("staffManage"),
    worklogAll: hasProfilePermission("worklogAll"),
    laborAll: hasProfilePermission("laborAll"),
    accessPreset: state.profile.accessPreset,
    permissionKeys: Object.keys(state.profile.permissions || {}).filter((key) => state.profile.permissions[key]),
    selectedEmployeeId: state.selectedEmployeeId,
    ownEditableEmployeeId: getOwnEditableEmployeeIdForView(activeView),
    title: document.querySelector("#globalHeaderTitle")?.textContent?.trim() || "",
    badge: document.querySelector("#worklogIdentityBadge")?.textContent?.trim()
      || document.querySelector("#fitnessIdentityBadge")?.textContent?.trim()
      || "",
    visibleMenuItems: Array.from(document.querySelectorAll("#mainMenuPopover button"))
      .filter((button) => !button.hidden && getComputedStyle(button).display !== "none")
      .map((button) => button.textContent.trim().replace(/\\s+/g, " "))
  })`));
  const parsed = JSON.parse(metrics);
  if (parsed.representative || parsed.approvalAuthority || parsed.worklogOverview || parsed.staffManage || parsed.worklogAll || parsed.laborAll) {
    fail("Kim Sungmin account should be employee-only", metrics);
  }
  if (parsed.accessPreset !== "employee" || parsed.permissionKeys.length) {
    fail("Kim Sungmin account should not retain stale representative permissions", metrics);
  }
  if (parsed.activeView !== "beyond-log") fail("Kim Sungmin account should land on Beyond employee worklog", metrics);
  if (parsed.selectedEmployeeId !== "beyond-company-leader" || parsed.ownEditableEmployeeId !== "beyond-company-leader") {
    fail("Kim Sungmin account should be mapped to the Beyond company leader sheet", metrics);
  }
  if (!/김성민|TBA|비욘드/.test(`${parsed.title} ${parsed.badge}`)) {
    fail("Kim Sungmin employee identity should be visible on the worklog", metrics);
  }
  if (parsed.visibleMenuItems.some((label) => /가입승인|통합관제|대표경영|직원명부/.test(label))) {
    fail("Kim Sungmin employee menu should not show representative-only items", metrics);
  }
  if (errors.length) fail("Kim Sungmin employee-only regression page errors", errors.join(" | "));
  await page.close();
}

async function checkUnmappedEmployeeDoesNotInheritFitnessManager(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("beyond-worklog-state-v1", JSON.stringify({
      selectedDateKey: "2026-07-27",
      selectedEmployeeId: "beyond-fitness-manager",
      fitnessWritableEmployeeId: "beyond-fitness-manager",
      profile: {
        email: "projch@naver.com",
        role: "직원",
        name: "홍길동",
        nickname: "홍길동",
        org: "(주)방주",
        workplace: "본사",
        primaryWork: "기획/관리",
        approvalStatus: "approved",
        accessPreset: "employee",
        permissions: {},
      },
      employeeLogs: {},
    }));
    localStorage.setItem("beyond-worklog-global-view-mode", "ceo");
  });
  await page.goto(target, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    document.body.classList.add("physical-phone-device");
    document.body.dataset.layoutMode = "phone";
    document.body.dataset.viewMode = "ceo";
    window.eval(`
      authState.user = { id: "hong-gildong", email: "projch@naver.com" };
      normalizeState();
      switchView(getInitialLandingView());
    `);
  });
  await page.waitForTimeout(350);
  const metrics = await page.evaluate(() => window.eval(`JSON.stringify({
    activeView: document.body.dataset.activeView,
    selectedEmployeeId: state.selectedEmployeeId,
    representative: isRepresentativeProfile(),
    ownEditableEmployeeId: getOwnEditableEmployeeIdForView(activeView),
    selectedEmployee: getEmployeeAdminLabel(getSelectedEmployee()),
    header: document.querySelector("#globalHeaderTitle")?.textContent?.trim() || "",
    identityBadge: document.querySelector("#worklogIdentityBadge")?.textContent?.trim() || "",
    lockBanner: document.querySelector("#worklogEditLockBanner")?.textContent?.trim() || "",
    lockHidden: document.querySelector("#worklogEditLockBanner")?.hidden ?? true
  })`));
  const parsed = JSON.parse(metrics);
  if (parsed.representative) fail("fitness info employee should not become representative", metrics);
  if (parsed.activeView !== "fitness-log") fail("Hong profile should land on fitness worklog", metrics);
  if (parsed.selectedEmployeeId !== "fitness-weekday-info" || parsed.ownEditableEmployeeId !== "fitness-weekday-info") {
    fail("Hong profile should use the weekday fitness info worklog slot", metrics);
  }
  if (/박주홍|센터장|beyond-fitness-manager/.test(`${parsed.selectedEmployee} ${parsed.header} ${parsed.identityBadge} ${parsed.lockBanner}`)) {
    fail("Hong profile inherited fitness manager label", metrics);
  }
  if (!/홍길동/.test(`${parsed.selectedEmployee} ${parsed.header} ${parsed.identityBadge}`)) {
    fail("Hong profile identity should be visible on own worklog", metrics);
  }
  if (!/피트니스/.test(`${parsed.header} ${parsed.identityBadge}`) || !/인포/.test(`${parsed.header} ${parsed.identityBadge}`)) {
    fail("worklog identity badge should show fitness affiliation and info role", metrics);
  }
  if (!parsed.lockHidden && /열람 전용|본인 업무일지만/.test(parsed.lockBanner)) {
    fail("own fitness worklog should not show readonly banner", metrics);
  }
  await page.fill("#fitnessTaskBoard .task-text-input", "홍길동 업무 입력 저장 확인");
  await page.waitForTimeout(350);
  const saveMetrics = await page.evaluate(() => window.eval(`JSON.stringify({
    disabled: document.querySelector("#fitnessTaskBoard .task-text-input")?.disabled ?? true,
    value: document.querySelector("#fitnessTaskBoard .task-text-input")?.value || "",
    selectedDateKey: state.selectedDateKey,
    savedText: state.employeeLogs?.[state.selectedDateKey]?.["fitness-weekday-info"]?.tasks?.[0]?.text || "",
    storageText: JSON.parse(localStorage.getItem("beyond-worklog-state-v1") || "{}").employeeLogs?.[state.selectedDateKey]?.["fitness-weekday-info"]?.tasks?.[0]?.text || ""
  })`));
  const saved = JSON.parse(saveMetrics);
  if (saved.disabled) fail("Hong own fitness worklog input should be enabled", saveMetrics);
  if (saved.value !== "홍길동 업무 입력 저장 확인" || saved.savedText !== saved.value || saved.storageText !== saved.value) {
    fail("Hong own fitness worklog input should persist to weekday info log", saveMetrics);
  }
  const coworkerMetrics = await page.evaluate(() => window.eval(`(() => {
    const dateKey = "2026-08-02";
    state.selectedDateKey = dateKey;
    state.employeeLogs[dateKey] = {};
    const kimLog = createEmployeeLog({
      id: "profile-user",
      name: "김영채",
      email: "yckim1558@naver.com",
      org: "(주)방주 / 비욘드 피트니스 지사",
      workplace: "비욘드 피트니스",
      role: "인포데스크"
    }, {}, dateKey);
    kimLog.tasks[0].text = "김영채 8월2일 동료 공유 업무";
    kimLog.schedule[0].text = "일요일 센터 오픈 점검";
    mergeVisibleStaffWorklogStates([{
      user_id: "kimyoungchae-auth",
      updated_at: "2026-08-02T18:30:00.000Z",
      state: {
        profile: {
          name: "김영채",
          email: "yckim1558@naver.com",
          org: "(주)방주 / 비욘드 피트니스 지사",
          workplace: "비욘드 피트니스",
          role: "인포데스크",
          approvalStatus: "approved"
        },
        ownerEmployeeId: "fitness-info-kimyoungchae",
        ownerWorklog: kimLog,
        employeeLogs: { [dateKey]: { "profile-user": kimLog } }
      }
    }], dateKey);
    normalizeState();
    const pages = getFitnessLogPages();
    const kimPageIndex = pages.findIndex((page) => page.employee?.name === "김영채");
    state.fitnessLogPage = kimPageIndex;
    state.selectedEmployeeId = pages[kimPageIndex]?.id || "";
    renderEntries();
    return JSON.stringify({
      kimPageIndex,
      pageType: document.querySelector("#view-fitness-log")?.dataset.fitnessPageType || "",
      permission: document.querySelector("#view-fitness-log")?.dataset.fitnessPermission || "",
      taskText: document.querySelector("#fitnessTaskBoard .task-text-input")?.value || "",
      scheduleText: document.querySelector("#fitnessAppointmentList .fitness-appointment-summary")?.textContent?.trim() || "",
      taskDisabled: document.querySelector("#fitnessTaskBoard .task-text-input")?.disabled ?? false,
      remoteLoadIncludesCoworkers: String(loadRemoteWorklogForActiveDate).includes("loadCoworkerWorklogsForDate")
    });
  })()`));
  const coworker = JSON.parse(coworkerMetrics);
  if (coworker.kimPageIndex < 0
    || coworker.pageType !== "coworker"
    || coworker.permission !== "readonly"
    || coworker.taskText !== "김영채 8월2일 동료 공유 업무"
    || !coworker.scheduleText.includes("일요일 센터 오픈 점검")
    || !coworker.taskDisabled
    || !coworker.remoteLoadIncludesCoworkers) {
    fail("Hong coworker view should load Kim Young-chae's August 2 remote worklog as read-only", coworkerMetrics);
  }
  if (errors.length) fail("Hong fitness identity regression page errors", errors.join(" | "));
  await page.close();
}

async function checkUnclassifiedFitnessEmployeeCanEditOwnProfileWorklog(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("beyond-worklog-state-v1", JSON.stringify({
      selectedDateKey: "2026-07-27",
      selectedEmployeeId: "beyond-fitness-manager",
      fitnessWritableEmployeeId: "beyond-fitness-manager",
      profile: {
        email: "shinsemin@example.com",
        role: "직원",
        name: "신세민",
        nickname: "신세민",
        org: "(주)비욘드컴퍼니",
        workplace: "비욘드 피트니스",
        primaryWork: "센터 운영 보조",
        workHours: "16:00-20:00",
        approvalStatus: "approved",
        accessPreset: "employee",
        permissions: {},
      },
      employeeLogs: {},
    }));
    localStorage.setItem("beyond-worklog-global-view-mode", "ceo");
  });
  await page.goto(target, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    document.body.classList.add("physical-phone-device");
    document.body.dataset.layoutMode = "phone";
    document.body.dataset.viewMode = "ceo";
    window.eval(`
      authState.user = { id: "shin-semin-user", email: "shinsemin@example.com" };
      normalizeState();
      switchView(getInitialLandingView());
    `);
  });
  await page.waitForTimeout(350);
  const metrics = await page.evaluate(() => window.eval(`JSON.stringify({
    activeView: document.body.dataset.activeView,
    selectedEmployeeId: state.selectedEmployeeId,
    fitnessWritableEmployeeId: state.fitnessWritableEmployeeId,
    ownEditableEmployeeId: getOwnEditableEmployeeIdForView(activeView),
    canEdit: canEditCurrentWorklog(activeView),
    selectedEmployee: getEmployeeAdminLabel(getSelectedEmployee()),
    header: document.querySelector("#globalHeaderTitle")?.textContent?.trim() || "",
    identityBadge: document.querySelector("#fitnessIdentityText")?.textContent?.trim() || "",
    lockBanner: document.querySelector("#fitnessReadOnlyNotice")?.textContent?.trim() || "",
    lockHidden: document.querySelector("#fitnessReadOnlyNotice")?.hidden ?? true,
    taskDisabled: document.querySelector("#fitnessTaskBoard .task-text-input")?.disabled ?? true,
    scheduleTimes: (state.employeeLogs?.[state.selectedDateKey]?.["fitness-info-shinsemin"]?.schedule || []).map((entry) => entry.time)
  })`));
  const parsed = JSON.parse(metrics);
  if (parsed.activeView !== "fitness-log") fail("unclassified fitness employee should land on fitness worklog", metrics);
  if (parsed.selectedEmployeeId !== "fitness-info-shinsemin" || parsed.fitnessWritableEmployeeId !== "fitness-info-shinsemin") {
    fail("named fitness employee should use the canonical Shin Semin worklog slot", metrics);
  }
  if (parsed.ownEditableEmployeeId !== "fitness-info-shinsemin" || !parsed.canEdit || parsed.taskDisabled) {
    fail("named fitness employee own worklog should be editable", metrics);
  }
  if (!/신세민/.test(`${parsed.selectedEmployee} ${parsed.header} ${parsed.identityBadge}`)) {
    fail("unclassified fitness employee identity should be visible", metrics);
  }
  if (!parsed.lockHidden && /열람 전용|본인 업무일지만/.test(parsed.lockBanner)) {
    fail("unclassified fitness employee own page should not show readonly banner", metrics);
  }
  if (parsed.scheduleTimes[0] !== "16:00" || parsed.scheduleTimes.at(-1) !== "20:00" || parsed.scheduleTimes.includes("08:00")) {
    fail("unclassified fitness employee schedule should follow profile work hours", metrics);
  }
  await page.click("#fitnessCoachingTicker");
  await page.waitForTimeout(120);
  const coachingClosePlacement = await page.evaluate(() => {
    const sheet = document.querySelector("#fitnessCoachingSheet");
    const close = document.querySelector("#fitnessCoachingCloseButton");
    const sheetRect = sheet?.getBoundingClientRect();
    const closeRect = close?.getBoundingClientRect();
    return {
      visible: Boolean(sheet && !sheet.hidden && sheet.classList.contains("is-open")),
      topGap: sheetRect && closeRect ? closeRect.top - sheetRect.top : 999,
      rightGap: sheetRect && closeRect ? sheetRect.right - closeRect.right : 999,
    };
  });
  if (!coachingClosePlacement.visible || coachingClosePlacement.topGap > 14 || coachingClosePlacement.rightGap > 14) {
    fail("fitness coaching close button should stay at the sheet's upper-right corner", JSON.stringify(coachingClosePlacement));
  }
  await page.click("#fitnessCoachingCloseButton");
  await page.waitForTimeout(180);
  await page.fill("#fitnessTaskBoard .task-text-input", "신세민 업무 입력 저장 확인");
  await page.waitForTimeout(350);
  const saveMetrics = await page.evaluate(() => window.eval(`JSON.stringify({
    disabled: document.querySelector("#fitnessTaskBoard .task-text-input")?.disabled ?? true,
    value: document.querySelector("#fitnessTaskBoard .task-text-input")?.value || "",
    selectedDateKey: state.selectedDateKey,
    savedText: state.employeeLogs?.[state.selectedDateKey]?.["fitness-info-shinsemin"]?.tasks?.[0]?.text || "",
    storageText: JSON.parse(localStorage.getItem("beyond-worklog-state-v1") || "{}").employeeLogs?.[state.selectedDateKey]?.["fitness-info-shinsemin"]?.tasks?.[0]?.text || ""
  })`));
  const saved = JSON.parse(saveMetrics);
  if (saved.disabled) fail("unclassified fitness employee input should remain enabled", saveMetrics);
  if (saved.value !== "신세민 업무 입력 저장 확인" || saved.savedText !== saved.value || saved.storageText !== saved.value) {
    fail("unclassified fitness employee input should persist to profile worklog", saveMetrics);
  }
  if (errors.length) fail("unclassified fitness employee regression page errors", errors.join(" | "));
  await page.close();
}

async function checkFitnessManagerCanEditOwnWorklog(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("beyond-worklog-state-v1", JSON.stringify({
      selectedDateKey: "2026-07-27",
      selectedEmployeeId: "fitness-weekday-info",
      fitnessWritableEmployeeId: "fitness-weekday-info",
      fitnessLogPage: 2,
      profile: {
        email: "pjhong0@naver.com",
        role: "센터장",
        name: "박주홍",
        nickname: "박주홍",
        org: "(주)비욘드컴퍼니",
        workplace: "비욘드 피트니스",
        primaryWork: "피트니스 운영총괄 PT 수업",
        workHours: "06:00-24:00",
        approvalStatus: "approved",
        accessPreset: "employee",
        permissions: {},
      },
      employeeLogs: {
        "2026-07-26": {
          "beyond-fitness-manager": {
            employeeId: "beyond-fitness-manager",
            tasks: [],
            schedule: [],
            fitnessOps: { ptRegular: "2", consultation: "1" },
            fitnessOpsManual: { ptRegular: true, consultation: true },
          },
        },
        "2026-07-27": {
          "beyond-fitness-manager": {
            employeeId: "beyond-fitness-manager",
            tasks: [],
            schedule: [],
            fitnessOps: { ptRegular: "3", ptFree: "1", consultation: "2", customerNew: "1" },
            fitnessOpsManual: { ptRegular: true, ptFree: true, consultation: true, customerNew: true },
          },
          "fitness-trainer-1": {
            employeeId: "fitness-trainer-1",
            tasks: [{ priority: "A", text: "홍현규 전용 PT 업무", status: "예정", done: false }],
            schedule: [],
            report: "홍현규 전용 보고",
            fitnessOps: { ptRegular: "7", ptOther: "1" },
            fitnessOpsManual: { ptRegular: true, ptOther: true },
          },
        },
        "2026-08-01": {
          "beyond-fitness-manager": {
            employeeId: "beyond-fitness-manager",
            tasks: [],
            schedule: [],
            fitnessOps: { ptRegular: "11", consultation: "4" },
            fitnessOpsManual: { ptRegular: true, consultation: true },
          },
        },
      },
    }));
    localStorage.setItem("beyond-worklog-global-view-mode", "ceo");
  });
  await page.goto(target, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    document.body.classList.add("physical-phone-device");
    document.body.dataset.layoutMode = "phone";
    document.body.dataset.viewMode = "ceo";
    window.eval(`
      authState.user = { id: "park-juhong-user", email: "pjhong0@naver.com" };
      normalizeState();
      switchView(getInitialLandingView());
    `);
  });
  await page.waitForTimeout(350);
  const metrics = await page.evaluate(() => window.eval(`JSON.stringify({
    activeView: document.body.dataset.activeView,
    selectedEmployeeId: state.selectedEmployeeId,
    fitnessWritableEmployeeId: state.fitnessWritableEmployeeId,
    ownEditableEmployeeId: getOwnEditableEmployeeIdForView(activeView),
    currentEmployeeId: getCurrentWorklogEmployeeId(activeView),
    canEdit: canEditCurrentWorklog(activeView),
    selectedEmployee: getEmployeeAdminLabel(getSelectedEmployee()),
    header: document.querySelector("#globalHeaderTitle")?.textContent?.trim() || "",
    identityBadge: document.querySelector("#fitnessIdentityText")?.textContent?.trim() || "",
    lockBanner: document.querySelector("#fitnessReadOnlyNotice")?.textContent?.trim() || "",
    lockHidden: document.querySelector("#fitnessReadOnlyNotice")?.hidden ?? true,
    taskDisabled: document.querySelector("#fitnessTaskBoard .task-text-input")?.disabled ?? true,
    scheduleTimes: (state.employeeLogs?.[state.selectedDateKey]?.["beyond-fitness-manager"]?.schedule || []).map((entry) => entry.time),
    managerCandidateIds: getFitnessEmployeeLogCandidateIds(getFitnessCenterEmployees().find((employee) => isFitnessManagerRosterIdentity(employee)) || {}),
    managerVisibleTask: document.querySelector("#fitnessTaskBoard .task-text-input")?.value || "",
    ownPageClass: document.querySelector("#view-fitness-log")?.classList.contains("is-own-page") || false,
    ownPanelBackground: getComputedStyle(document.querySelector("#view-fitness-log .fitness-log-task-panel")).backgroundImage,
    personalMonthHidden: document.querySelector("#fitnessPersonalMonthSummary")?.hidden ?? false,
    representativeAnalysisHidden: document.querySelector("#fitnessRepresentativeEmployeeAnalysis")?.hidden ?? false,
    compactTotals: [...document.querySelectorAll("#fitnessOpsSummaryButton .ops-summary-metric strong")].map((node) => node.textContent.trim()),
    julyManager: buildFitnessCenterEmployeeMonthRow(getFitnessCenterEmployees().find((employee) => isFitnessManagerRosterIdentity(employee)), "2026-07").ops,
    augustManager: buildFitnessCenterEmployeeMonthRow(getFitnessCenterEmployees().find((employee) => isFitnessManagerRosterIdentity(employee)), "2026-08").ops,
    julyTrainer: buildFitnessCenterEmployeeMonthRow(getFitnessCenterEmployees().find((employee) => /홍현규/.test(employee.name || "")), "2026-07").ops,
  })`));
  const parsed = JSON.parse(metrics);
  if (parsed.activeView !== "fitness-log") fail("Park fitness manager should land on fitness worklog", metrics);
  if (parsed.selectedEmployeeId !== "beyond-fitness-manager" || parsed.fitnessWritableEmployeeId !== "beyond-fitness-manager") {
    fail("Park fitness manager should use the center manager worklog slot", metrics);
  }
  if (parsed.ownEditableEmployeeId !== "beyond-fitness-manager" || parsed.currentEmployeeId !== "beyond-fitness-manager" || !parsed.canEdit || parsed.taskDisabled) {
    fail("Park fitness manager own worklog should be editable", metrics);
  }
  if (!/박주홍/.test(`${parsed.selectedEmployee} ${parsed.header} ${parsed.identityBadge}`) || !/센터장/.test(`${parsed.selectedEmployee} ${parsed.header} ${parsed.identityBadge}`)) {
    fail("Park fitness manager identity should be visible", metrics);
  }
  if (!parsed.lockHidden && /열람 전용|본인 업무일지만/.test(parsed.lockBanner)) {
    fail("Park fitness manager own page should not show readonly banner", metrics);
  }
  if (parsed.managerCandidateIds.includes("fitness-trainer-1") || parsed.managerVisibleTask === "홍현규 전용 PT 업무") {
    fail("Park fitness manager must not inherit Hong Hyeon-gyu's trainer worklog", metrics);
  }
  if (!parsed.ownPageClass || !parsed.ownPanelBackground.includes("gradient")) {
    fail("Park own worklog should use the distinct own-page background", metrics);
  }
  if (!parsed.personalMonthHidden || parsed.compactTotals.join(",") !== "0/11,0/0,0/4,0/0"
    || Number(parsed.julyManager.ptRegular) !== 5 || Number(parsed.julyManager.consultation) !== 3
    || Number(parsed.augustManager.ptRegular) !== 11 || Number(parsed.julyTrainer.ptRegular) !== 7) {
    fail("fitness personal totals must accumulate within the selected month and reset for the next month", metrics);
  }
  if (!parsed.representativeAnalysisHidden) {
    fail("employee own worklog must not expose representative attendance and competency analysis", metrics);
  }
  if (parsed.scheduleTimes[0] !== "06:00" || parsed.scheduleTimes.at(-1) !== "24:00" || parsed.scheduleTimes.includes("08:00") === false) {
    fail("Park fitness manager schedule should follow 06:00-24:00 profile work hours", metrics);
  }
  const fitnessAiBefore = await page.evaluate(() => ({
    task: getComputedStyle(document.querySelector("#view-fitness-log .fitness-log-task-panel .ai-section-button")).display,
    schedule: getComputedStyle(document.querySelector("#view-fitness-log .fitness-log-schedule-panel .ai-section-button")).display,
  }));
  if (fitnessAiBefore.task !== "none" || fitnessAiBefore.schedule !== "none") {
    fail("fitness coaching buttons should stay hidden outside expanded panels", JSON.stringify(fitnessAiBefore));
  }
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.evaluate(() => {
    document.body.dataset.viewMode = "ceo";
    renderResponsiveMode();
  });
  await page.click('#view-fitness-log .fitness-log-task-panel [data-mobile-focus-open="tasks"]');
  await page.waitForTimeout(120);
  const fitnessTaskFocus = await page.evaluate(() => {
    const view = document.querySelector("#view-fitness-log");
    const panel = view?.querySelector(".fitness-log-task-panel");
    const board = panel?.querySelector(".worklog-task-board");
    const rect = panel?.getBoundingClientRect();
    const close = panel?.querySelector("[data-mobile-focus-close]");
    return {
      focused: view?.classList.contains("is-focus-tasks") || false,
      bodyLocked: document.body.classList.contains("is-fitness-focus-open"),
      position: panel ? getComputedStyle(panel).position : "",
      viewportFit: Boolean(rect && Math.abs(rect.left) < 2 && Math.abs(rect.top) < 2
        && Math.abs(rect.width - innerWidth) < 2 && Math.abs(rect.height - innerHeight) < 2),
      scheduleHidden: getComputedStyle(view.querySelector(".fitness-log-schedule-panel")).display === "none",
      aiVisible: getComputedStyle(panel.querySelector(".ai-section-button")).display !== "none",
      closeVisible: getComputedStyle(close).display !== "none",
      closeLabel: close?.textContent?.trim() || "",
      role: panel?.getAttribute("role") || "",
      modal: panel?.getAttribute("aria-modal") || "",
      scrollable: ["auto", "scroll"].includes(getComputedStyle(board).overflowY),
      maxRowHeight: Math.max(0, ...[...panel.querySelectorAll(".task-row")].map((row) => row.getBoundingClientRect().height)),
      boardAlign: getComputedStyle(board).alignContent,
    };
  });
  if (!fitnessTaskFocus.focused || !fitnessTaskFocus.bodyLocked || fitnessTaskFocus.position !== "fixed"
    || !fitnessTaskFocus.viewportFit || !fitnessTaskFocus.scheduleHidden || !fitnessTaskFocus.aiVisible
    || !fitnessTaskFocus.closeVisible || fitnessTaskFocus.closeLabel !== "닫기"
    || fitnessTaskFocus.role !== "dialog" || fitnessTaskFocus.modal !== "true" || !fitnessTaskFocus.scrollable
    || fitnessTaskFocus.maxRowHeight > 72 || fitnessTaskFocus.boardAlign !== "start") {
    fail("fitness priority-task expand button should open a full-screen coaching workspace", JSON.stringify(fitnessTaskFocus));
  }
  await page.click('#view-fitness-log .fitness-log-task-panel [data-section-ai="fitness-tasks"]');
  await page.waitForTimeout(120);
  const fitnessTaskCoaching = await page.evaluate(() => {
    const panel = document.querySelector("#view-fitness-log .fitness-log-task-panel");
    const sheet = document.querySelector("#fitnessCoachingSheet");
    const backdrop = document.querySelector("#fitnessCoachingBackdrop");
    const sheetRect = sheet?.getBoundingClientRect();
    return {
      visible: Boolean(sheet && !sheet.hidden && sheet.classList.contains("is-open") && Number(getComputedStyle(sheet).opacity) > 0),
      backdropVisible: Boolean(backdrop && !backdrop.hidden),
      abovePanel: Number(getComputedStyle(sheet).zIndex) > Number(getComputedStyle(panel).zIndex),
      backdropAbovePanel: Number(getComputedStyle(backdrop).zIndex) > Number(getComputedStyle(panel).zIndex),
      insideViewport: Boolean(sheetRect && sheetRect.top >= 0 && sheetRect.bottom <= innerHeight + 1),
      subtitle: document.querySelector("#fitnessCoachingSheetSub")?.textContent?.trim() || "",
      coachingCount: document.querySelectorAll("#fitnessCoachingDetailList article").length,
      focusRemainsOpen: document.querySelector("#view-fitness-log")?.classList.contains("is-focus-tasks") || false,
    };
  });
  if (!fitnessTaskCoaching.visible || !fitnessTaskCoaching.backdropVisible || !fitnessTaskCoaching.abovePanel
    || !fitnessTaskCoaching.backdropAbovePanel || !fitnessTaskCoaching.insideViewport
    || fitnessTaskCoaching.subtitle !== "오늘의 우선업무 실행 코칭" || fitnessTaskCoaching.coachingCount < 3
    || !fitnessTaskCoaching.focusRemainsOpen) {
    fail("fitness coaching sheet should stay visible above the expanded task workspace", JSON.stringify(fitnessTaskCoaching));
  }
  await page.click("#fitnessCoachingCloseButton");
  await page.waitForTimeout(180);
  const fitnessTaskCoachingClosed = await page.evaluate(() => ({
    hidden: document.querySelector("#fitnessCoachingSheet")?.hidden ?? false,
    focusRemainsOpen: document.querySelector("#view-fitness-log")?.classList.contains("is-focus-tasks") || false,
    triggerFocused: document.activeElement?.matches?.('[data-section-ai="fitness-tasks"]') || false,
  }));
  if (!fitnessTaskCoachingClosed.hidden || !fitnessTaskCoachingClosed.focusRemainsOpen || !fitnessTaskCoachingClosed.triggerFocused) {
    fail("closing fitness coaching should return to the expanded task workspace", JSON.stringify(fitnessTaskCoachingClosed));
  }
  await page.click("#view-fitness-log .fitness-log-task-panel [data-mobile-focus-close]");
  await page.waitForTimeout(120);
  const fitnessTaskRestored = await page.evaluate(() => ({
    restored: !document.querySelector("#view-fitness-log")?.classList.contains("is-mobile-focus-active"),
    bodyUnlocked: !document.body.classList.contains("is-fitness-focus-open"),
    aiHidden: getComputedStyle(document.querySelector("#view-fitness-log .fitness-log-task-panel .ai-section-button")).display === "none",
  }));
  if (!fitnessTaskRestored.restored || !fitnessTaskRestored.bodyUnlocked || !fitnessTaskRestored.aiHidden) {
    fail("fitness priority-task close button should restore the normal worklog", JSON.stringify(fitnessTaskRestored));
  }
  await page.click('#view-fitness-log .fitness-log-schedule-panel [data-mobile-focus-open="schedule"]');
  await page.waitForTimeout(120);
  const fitnessScheduleFocus = await page.evaluate(() => {
    const view = document.querySelector("#view-fitness-log");
    const panel = view?.querySelector(".fitness-log-schedule-panel");
    const list = panel?.querySelector(".worklog-appointment-list");
    const rect = panel?.getBoundingClientRect();
    const close = panel?.querySelector("[data-mobile-focus-close]");
    return {
      focused: view?.classList.contains("is-focus-schedule") || false,
      bodyLocked: document.body.classList.contains("is-fitness-focus-open"),
      position: panel ? getComputedStyle(panel).position : "",
      viewportFit: Boolean(rect && Math.abs(rect.left) < 2 && Math.abs(rect.top) < 2
        && Math.abs(rect.width - innerWidth) < 2 && Math.abs(rect.height - innerHeight) < 2),
      taskHidden: getComputedStyle(view.querySelector(".fitness-log-task-panel")).display === "none",
      aiVisible: getComputedStyle(panel.querySelector(".ai-section-button")).display !== "none",
      closeVisible: getComputedStyle(close).display !== "none",
      closeLabel: close?.textContent?.trim() || "",
      role: panel?.getAttribute("role") || "",
      modal: panel?.getAttribute("aria-modal") || "",
      scrollable: ["auto", "scroll"].includes(getComputedStyle(list).overflowY),
    };
  });
  if (!fitnessScheduleFocus.focused || !fitnessScheduleFocus.bodyLocked || fitnessScheduleFocus.position !== "fixed"
    || !fitnessScheduleFocus.viewportFit || !fitnessScheduleFocus.taskHidden || !fitnessScheduleFocus.aiVisible
    || !fitnessScheduleFocus.closeVisible || fitnessScheduleFocus.closeLabel !== "닫기"
    || fitnessScheduleFocus.role !== "dialog" || fitnessScheduleFocus.modal !== "true" || !fitnessScheduleFocus.scrollable) {
    fail("fitness schedule expand button should open a full-screen coaching workspace", JSON.stringify(fitnessScheduleFocus));
  }
  await page.click("#view-fitness-log .fitness-log-schedule-panel .fitness-appointment-summary");
  await page.waitForTimeout(120);
  const fitnessScheduleEditorLayer = await page.evaluate(() => {
    const panel = document.querySelector("#view-fitness-log .fitness-log-schedule-panel");
    const editor = document.querySelector("#fitnessScheduleEditor");
    const backdrop = document.querySelector("#fitnessScheduleEditorBackdrop");
    const typeButton = editor?.querySelector("[data-fitness-schedule-type]");
    const editorRect = editor?.getBoundingClientRect();
    return {
      editorVisible: Boolean(editor && !editor.hidden && getComputedStyle(editor).visibility !== "hidden" && Number(getComputedStyle(editor).opacity) > 0),
      backdropVisible: Boolean(backdrop && !backdrop.hidden),
      editorAbovePanel: Number(getComputedStyle(editor).zIndex) > Number(getComputedStyle(panel).zIndex),
      backdropAbovePanel: Number(getComputedStyle(backdrop).zIndex) > Number(getComputedStyle(panel).zIndex),
      typeButtonVisible: Boolean(typeButton && getComputedStyle(typeButton).display !== "none" && typeButton.getBoundingClientRect().height > 0),
      insideViewport: Boolean(editorRect && editorRect.top >= 0 && editorRect.bottom <= innerHeight + 1),
    };
  });
  if (!fitnessScheduleEditorLayer.editorVisible || !fitnessScheduleEditorLayer.backdropVisible
    || !fitnessScheduleEditorLayer.editorAbovePanel || !fitnessScheduleEditorLayer.backdropAbovePanel
    || !fitnessScheduleEditorLayer.typeButtonVisible || !fitnessScheduleEditorLayer.insideViewport) {
    fail("fitness schedule type editor should stay visible above the full-screen schedule", JSON.stringify(fitnessScheduleEditorLayer));
  }
  await page.click("#fitnessScheduleEditorClose");
  await page.waitForTimeout(120);
  await page.click("#view-fitness-log .fitness-log-schedule-panel [data-mobile-focus-close]");
  await page.waitForTimeout(120);
  await page.fill("#fitnessTaskBoard .task-text-input", "박주홍 센터 운영 입력 저장 확인");
  await page.click(".fitness-appointment-row .fitness-appointment-summary");
  await page.waitForTimeout(120);
  await page.click('[data-fitness-schedule-type="유료PT"]');
  await page.fill("#fitnessScheduleEditorText", "김영수 수업");
  await page.click("#fitnessScheduleEditorDone");
  await page.waitForTimeout(350);
  const saveMetrics = await page.evaluate(() => window.eval(`JSON.stringify({
    disabled: document.querySelector("#fitnessTaskBoard .task-text-input")?.disabled ?? true,
    value: document.querySelector("#fitnessTaskBoard .task-text-input")?.value || "",
    selectedDateKey: state.selectedDateKey,
    savedTaskText: state.employeeLogs?.[state.selectedDateKey]?.["beyond-fitness-manager"]?.tasks?.[0]?.text || "",
    savedScheduleText: state.employeeLogs?.[state.selectedDateKey]?.["beyond-fitness-manager"]?.schedule?.[0]?.items?.[0]?.text || "",
    savedScheduleType: state.employeeLogs?.[state.selectedDateKey]?.["beyond-fitness-manager"]?.schedule?.[0]?.items?.[0]?.type || "",
    storageTaskText: JSON.parse(localStorage.getItem("beyond-worklog-state-v1") || "{}").employeeLogs?.[state.selectedDateKey]?.["beyond-fitness-manager"]?.tasks?.[0]?.text || "",
    storageScheduleText: JSON.parse(localStorage.getItem("beyond-worklog-state-v1") || "{}").employeeLogs?.[state.selectedDateKey]?.["beyond-fitness-manager"]?.schedule?.[0]?.items?.[0]?.text || ""
  })`));
  const saved = JSON.parse(saveMetrics);
  if (saved.disabled) fail("Park fitness manager input should remain enabled", saveMetrics);
  if (saved.value !== "박주홍 센터 운영 입력 저장 확인" || saved.savedTaskText !== saved.value || saved.storageTaskText !== saved.value) {
    fail("Park fitness manager task input should persist", saveMetrics);
  }
  if (saved.savedScheduleType !== "유료PT" || saved.savedScheduleText !== "김영수 수업" || saved.storageScheduleText !== "김영수 수업") {
    fail("Park fitness manager schedule editor should persist", saveMetrics);
  }
  await page.evaluate(() => window.eval("setFitnessLogPage(0); setFitnessCenterMonth('2026-07')"));
  await page.waitForTimeout(220);
  const centerMonth = await page.evaluate(() => ({
    title: document.querySelector("#fitnessCenterMonthTitle")?.textContent?.trim() || "",
    rows: document.querySelector("#fitnessCenterDailyBody")?.textContent?.replace(/\s+/g, " ").trim() || "",
    foot: document.querySelector("#fitnessCenterDailyFoot")?.textContent?.replace(/\s+/g, " ").trim() || "",
  }));
  if (!centerMonth.title.includes("2026.07") || !centerMonth.rows.includes("박주홍") || !centerMonth.rows.includes("홍현규")
    || !centerMonth.foot.includes("12") || !centerMonth.foot.includes("1")) {
    fail("fitness center month view must accumulate every employee into the monthly status and total", JSON.stringify(centerMonth));
  }
  if (errors.length) fail("Park fitness manager regression page errors", errors.join(" | "));
  await page.close();
}

async function checkFitnessTrainerCanEditOwnWorklog(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("beyond-worklog-state-v1", JSON.stringify({
      selectedDateKey: "2026-07-27",
      selectedEmployeeId: "beyond-fitness-manager",
      fitnessWritableEmployeeId: "beyond-fitness-manager",
      profile: {
        email: "gusrd1005@gmail.com",
        role: "직원",
        name: "가입직원",
        org: "미분류",
        workplace: "",
        approvalStatus: "approved",
        accessPreset: "employee",
        permissions: {},
      },
      employeeLogs: {},
    }));
    localStorage.setItem("beyond-worklog-global-view-mode", "ceo");
  });
  await page.goto(target, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    document.body.classList.add("physical-phone-device");
    document.body.dataset.layoutMode = "phone";
    document.body.dataset.viewMode = "ceo";
    window.eval(`
      authState.user = { id: "hong-hyeongyu-user", email: "gusrd1005@gmail.com" };
      normalizeState();
      switchView(getInitialLandingView());
    `);
  });
  await page.waitForTimeout(350);
  await page.fill("#fitnessTaskBoard .task-text-input", "홍현규 트레이너 업무 입력 저장 확인");
  await page.waitForTimeout(300);
  const metrics = await page.evaluate(() => window.eval(`JSON.stringify({
    activeView: document.body.dataset.activeView,
    selectedEmployeeId: state.selectedEmployeeId,
    fitnessWritableEmployeeId: state.fitnessWritableEmployeeId,
    canEdit: canEditCurrentWorklog(activeView),
    taskDisabled: document.querySelector("#fitnessTaskBoard .task-text-input")?.disabled ?? true,
    identity: document.querySelector("#fitnessIdentityBadge")?.textContent?.trim() || "",
    savedText: state.employeeLogs?.[state.selectedDateKey]?.["fitness-trainer-1"]?.tasks?.[0]?.text || "",
    storageText: JSON.parse(localStorage.getItem("beyond-worklog-state-v1") || "{}").employeeLogs?.[state.selectedDateKey]?.["fitness-trainer-1"]?.tasks?.[0]?.text || ""
  })`));
  const parsed = JSON.parse(metrics);
  if (parsed.activeView !== "fitness-log"
    || parsed.selectedEmployeeId !== "fitness-trainer-1"
    || parsed.fitnessWritableEmployeeId !== "fitness-trainer-1"
    || !parsed.canEdit
    || parsed.taskDisabled
    || !/홍현규|홍트/.test(parsed.identity)
    || parsed.savedText !== "홍현규 트레이너 업무 입력 저장 확인"
    || parsed.storageText !== parsed.savedText) {
    fail("Hong Hyeon-gyu should land on and save his own trainer worklog", metrics);
  }
  if (errors.length) fail("Hong Hyeon-gyu fitness worklog page errors", errors.join(" | "));
  await page.close();
}

async function checkApprovedEmployeeWorklogEditMatrix(browser) {
  const cases = [
    {
      label: "bangju finance assistant Isomi",
      userId: "isomi-future-user",
      email: "isomi@example.com",
      profile: {
        role: "재무 대리",
        name: "이소미",
        nickname: "이소미",
        org: "(주)방주",
        workplace: "본사",
        primaryWork: "회계 증빙 자금 정산",
      },
      expectedView: "bangju-log",
      expectedEmployeeId: "bangju-finance-assistant",
    },
    {
      label: "bangju finance manager",
      userId: "finance-manager-user",
      email: "finance.manager@example.com",
      profile: {
        role: "재무과장",
        name: "재무과장",
        nickname: "재무",
        org: "(주)방주",
        workplace: "본사",
        primaryWork: "자금 회계 보고",
      },
      expectedView: "bangju-log",
      expectedEmployeeId: "bangju-finance-manager",
    },
    {
      label: "construction finance profile",
      userId: "construction-finance-user",
      email: "construction.finance@example.com",
      profile: {
        role: "재무 대리",
        name: "김성민",
        nickname: "김성민",
        org: "(주)비제이종합건설",
        workplace: "동천체육관 현장",
        primaryWork: "건설현장 지출 정산 노무자료",
      },
      expectedView: "bangju-log",
      expectedEmployeeId: "profile-user",
    },
    {
      label: "beyond shared manager",
      userId: "beyond-shared-user",
      email: "shared.manager@example.com",
      profile: {
        role: "공유사업부 매니저",
        name: "공유사업부 매니저",
        nickname: "공유",
        org: "(주)비욘드컴퍼니",
        workplace: "공유사업부",
        primaryWork: "공유오피스 공유창고 고객관리",
      },
      expectedView: "beyond-log",
      expectedEmployeeId: "beyond-shared-manager",
    },
  ];

  for (const testCase of cases) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript((payload) => {
      localStorage.setItem("beyond-worklog-state-v1", JSON.stringify({
        selectedDateKey: "2026-07-27",
        selectedEmployeeId: "beyond-fitness-manager",
        fitnessWritableEmployeeId: "beyond-fitness-manager",
        profile: {
          email: payload.email,
          approvalStatus: "approved",
          accessPreset: "employee",
          permissions: {},
          ...payload.profile,
        },
        employeeLogs: {},
      }));
      localStorage.setItem("beyond-worklog-global-view-mode", "ceo");
    }, testCase);
    await page.goto(target, { waitUntil: "domcontentloaded" });
    await page.evaluate((payload) => {
      document.body.classList.add("physical-phone-device");
      document.body.dataset.layoutMode = "phone";
      document.body.dataset.viewMode = "ceo";
      window.eval(`
        authState.user = ${payload.userId ? JSON.stringify({ id: payload.userId, email: payload.email }) : "null"};
        state.profile = {
          ...state.profile,
          email: ${JSON.stringify(payload.email)},
          approvalStatus: "approved",
          accessPreset: "employee",
          permissions: {},
          ...${JSON.stringify(payload.profile)}
        };
        state.selectedDateKey = "2026-08-10";
        normalizeState();
        switchView(getInitialLandingView());
      `);
    }, testCase);
    await page.waitForTimeout(350);
    const marker = `${testCase.label} 입력 저장`;
    await page.fill("#worklogTaskBoard .task-text-input", marker);
    await page.waitForTimeout(300);
    const metrics = await page.evaluate((payload) => window.eval(`JSON.stringify({
      activeView: document.body.dataset.activeView,
      selectedEmployeeId: state.selectedEmployeeId,
      ownEditableEmployeeId: getOwnEditableEmployeeIdForView(activeView),
      canEdit: canEditCurrentWorklog(activeView),
      disabled: document.querySelector("#worklogTaskBoard .task-text-input")?.disabled ?? true,
      inputValue: document.querySelector("#worklogTaskBoard .task-text-input")?.value || "",
      selectedDateKey: state.selectedDateKey,
      savedText: state.employeeLogs?.[state.selectedDateKey]?.[${JSON.stringify(payload.expectedEmployeeId)}]?.tasks?.[0]?.text || "",
      profileSavedText: state.employeeLogs?.[state.selectedDateKey]?.["profile-user"]?.tasks?.[0]?.text || "",
      ownPageClass: document.querySelector("#view-today")?.classList.contains("is-own-page") || false,
      ownPageType: document.querySelector("#view-today")?.dataset.worklogPageType || "",
      ownPanelBackground: getComputedStyle(document.querySelector("#view-today .worklog-task-panel")).backgroundImage,
      storage: localStorage.getItem("beyond-worklog-state-v1") || "{}"
    })`), testCase);
    const parsed = JSON.parse(metrics);
    const storage = JSON.parse(parsed.storage || "{}");
    const storedText = storage.employeeLogs?.[parsed.selectedDateKey]?.[testCase.expectedEmployeeId]?.tasks?.[0]?.text
      || storage.employeeLogs?.[parsed.selectedDateKey]?.["profile-user"]?.tasks?.[0]?.text
      || "";
    if (parsed.activeView !== testCase.expectedView) fail("approved employee landed on wrong worklog view", `${testCase.label}: ${metrics}`);
    if (parsed.selectedEmployeeId !== testCase.expectedEmployeeId) fail("approved employee did not select own editable sheet", `${testCase.label}: ${metrics}`);
    if (parsed.ownEditableEmployeeId !== testCase.expectedEmployeeId || !parsed.canEdit || parsed.disabled) {
      fail("approved employee own worklog should be editable", `${testCase.label}: ${metrics}`);
    }
    if (!parsed.ownPageClass || parsed.ownPageType !== "own" || !parsed.ownPanelBackground.includes("gradient")) {
      fail("approved employee own worklog should use the distinct own-page background", `${testCase.label}: ${metrics}`);
    }
    const savedText = parsed.savedText || parsed.profileSavedText || "";
    if (parsed.inputValue !== marker || savedText !== marker || storedText !== marker) {
      fail("approved employee worklog input should persist", `${testCase.label}: ${JSON.stringify({ parsed, storedText })}`);
    }
    if (errors.length) fail("approved employee edit matrix page errors", `${testCase.label}: ${errors.join(" | ")}`);
    await page.close();
  }
}

async function checkPriorityCarryoverAndDateRules(browser) {
  const { page, errors } = await openPage(browser, { width: 390, height: 844 });
  await seedApprovedBangjuEmployee(page);
  const metrics = await page.evaluate(() => window.eval(`(() => {
    const employee = findEmployeeRecordById("bangju-finance-manager");
    const sourceDateKey = "2026-08-02";
    const activeDateKey = "2026-08-03";
    const sourceLog = createEmployeeLog(employee, state.profile, sourceDateKey);
    sourceLog.tasks = [
      { id: "open-task", priority: "A", text: "미처리 이월 업무", status: "미완료", done: false },
      { id: "progress-task", priority: "B", text: "진행중 이월 업무", status: "진행중", done: false },
      { id: "spaced-progress-task", priority: "B", text: "공백 표기 진행 중 업무", status: "진행 중", done: true },
      { id: "done-task", priority: "A", text: "완료 업무", status: "완료", done: true },
      { id: "cancel-task", priority: "B", text: "취소 업무", status: "취소", done: false },
      { id: "delegate-task", priority: "B", text: "위임 업무", status: "위임", done: false, delegate: "담당자" },
      { id: "postpone-task", priority: "C", text: "연기 업무", status: "연기", done: false, postponeDate: "2026-08-10" }
    ];
    const currentLog = createEmployeeLog(employee, state.profile, activeDateKey);
    const originalTodayKey = todayKey;
    todayKey = sourceDateKey;
    const futureBeforeArrival = isWorklogTaskDueForDate(sourceLog.tasks[0], sourceDateKey, activeDateKey);
    todayKey = activeDateKey;
    const nextDayArrived = isWorklogTaskDueForDate(sourceLog.tasks[0], sourceDateKey, activeDateKey);
    todayKey = "2026-08-09";
    const postponedBeforeDate = isWorklogTaskDueForDate(sourceLog.tasks[6], sourceDateKey, "2026-08-09");
    todayKey = "2026-08-10";
    const postponedDateArrived = hasWorklogCarryoverDateArrived("2026-08-10")
      && getWorklogTaskRolloverDate(sourceLog.tasks[6], sourceDateKey) === "2026-08-10";
    const postponedFutureDay = isWorklogTaskDueForDate(sourceLog.tasks[6], sourceDateKey, "2026-08-11");
    todayKey = "2026-08-11";
    const postponedNextDayArrived = isWorklogTaskDueForDate(sourceLog.tasks[6], sourceDateKey, "2026-08-11");
    todayKey = originalTodayKey;
    state.selectedDateKey = activeDateKey;
    state.selectedEmployeeId = "bangju-finance-manager";
    state.employeeLogs = {
      [sourceDateKey]: { "bangju-finance-manager": sourceLog },
      [activeDateKey]: { "bangju-finance-manager": currentLog }
    };
    const refs = getWorklogTaskRefs(currentLog);
    const carryovers = refs.filter((ref) => ref.isCarryover);
    const openRef = carryovers.find((ref) => ref.task.id === "open-task");
    const materialized = materializeWorklogCarryover(openRef, currentLog);
    cycleWorklogTaskStatus(materialized.task);
    const delegatedRow = renderWorklogTaskRow({
      task: sourceLog.tasks.find((task) => task.id === "delegate-task"),
      index: 5,
      log: sourceLog,
      sourceDateKey,
      isCarryover: false,
      isPostponedFromOtherDate: false
    }, sourceLog);
    document.body.appendChild(delegatedRow);
    const delegatedDecoration = getComputedStyle(delegatedRow.querySelector(".task-text-input")).textDecorationLine;
    const delegatedSelect = delegatedRow.querySelector(".priority-select");
    const delegatedOptionCounts = ["위임", "연기"].map((value) => delegatedSelect.querySelectorAll('option[value="' + value + '"]').length);
    const postponedPreviewTask = { ...sourceLog.tasks[6] };
    const postponedPreviewRow = renderWorklogTaskRow({
      task: postponedPreviewTask,
      index: 6,
      log: sourceLog,
      sourceDateKey,
      isCarryover: true,
      isPostponedFromOtherDate: true
    }, currentLog);
    document.body.appendChild(postponedPreviewRow);
    const postponedPreview = {
      hasPostponeStrike: postponedPreviewRow.classList.contains("status-postpone"),
      selectedValue: postponedPreviewRow.querySelector(".priority-select")?.value || ""
    };
    const postponedMaterialized = materializeWorklogCarryover({
      task: postponedPreviewTask,
      index: 6,
      log: sourceLog,
      sourceDateKey,
      isCarryover: true,
      isPostponedFromOtherDate: true
    }, currentLog).task;
    const priorityActionTask = { priority: "A", text: "메뉴 처리 검증", status: "미완료", done: false };
    updateWorklogTaskPriority(priorityActionTask, "위임");
    const delegatedFromMenu = { status: priorityActionTask.status, priority: priorityActionTask.priority };
    updateWorklogTaskPriority(priorityActionTask, "연기");
    const postponedFromMenu = { status: priorityActionTask.status, priority: priorityActionTask.priority };
    updateWorklogTaskPriority(priorityActionTask, "B");
    const restoredPriority = { status: priorityActionTask.status, priority: priorityActionTask.priority };
    const cycleOnlyTask = { priority: "A", text: "체크 순환 검증", status: "미완료", done: false };
    const cycleStatuses = [];
    for (let index = 0; index < 9; index += 1) {
      cycleWorklogTaskStatus(cycleOnlyTask);
      cycleStatuses.push(cycleOnlyTask.status);
    }
    const cycleGuideLabels = cycleStatuses.slice(0, 3).map((status) => {
      showTaskStatusGuide(taskStatusGuideLabels[status] || status);
      return document.getElementById("taskStatusGuide")?.textContent || "";
    });
    delegatedRow.remove();
    postponedPreviewRow.remove();
    return JSON.stringify({
      carryoverIds: carryovers.map((ref) => ref.task.id),
      sourceStatus: sourceLog.tasks[0].status,
      sourceDeletedFrom: sourceLog.tasks[0].carryoverDeletedFrom || "",
      targetStatus: materialized.task.status,
      targetSourceDate: materialized.task.carryoverSourceDate || "",
      delegatedClass: getWorklogTaskStatusClass(sourceLog.tasks[5]),
      delegatedDecoration,
      delegatedSelectValue: delegatedSelect.value,
      delegatedHasInput: Boolean(delegatedRow.querySelector(".delegate-input")),
      delegatedOptionCounts,
      delegatedFromMenu,
      postponedFromMenu,
      restoredPriority,
      cycleStatuses,
      cycleGuideLabels,
      futureBeforeArrival,
      nextDayArrived,
      postponedBeforeDate,
      postponedDateArrived,
      postponedFutureDay,
      postponedNextDayArrived,
      postponedPreview,
      postponedMaterializedStatus: postponedMaterialized.status,
      postponedMaterializedDate: postponedMaterialized.postponeDate,
      previousBeforeNoon: isWithinWorklogEditWindow("2026-08-02", new Date(2026, 7, 3, 11, 59)),
      previousAtNoon: isWithinWorklogEditWindow("2026-08-02", new Date(2026, 7, 3, 12, 0)),
      olderDate: isWithinWorklogEditWindow("2026-08-01", new Date(2026, 7, 3, 9, 0)),
      futureDate: isWithinWorklogEditWindow("2026-08-10", new Date(2026, 7, 3, 15, 0))
    });
  })()`));
  const parsed = JSON.parse(metrics);
  if (parsed.carryoverIds.join(",") !== "open-task,progress-task,spaced-progress-task") {
    fail("only unresolved priority tasks should carry into the next day", metrics);
  }
  if (parsed.futureBeforeArrival || !parsed.nextDayArrived || parsed.postponedBeforeDate
    || !parsed.postponedDateArrived || parsed.postponedFutureDay || !parsed.postponedNextDayArrived) {
    fail("priority work should roll one reached day at a time and postponed work should start only on its chosen date", metrics);
  }
  if (parsed.postponedPreview.hasPostponeStrike || parsed.postponedPreview.selectedValue === "연기"
    || parsed.postponedMaterializedStatus !== "미완료" || parsed.postponedMaterializedDate) {
    fail("postponed work should reopen as an unresolved event on its reached date", metrics);
  }
  if (parsed.sourceStatus !== "미완료" || parsed.sourceDeletedFrom !== "2026-08-03"
    || parsed.targetStatus !== "완료" || parsed.targetSourceDate !== "2026-08-02") {
    fail("resolving a carryover should preserve the source and materialize today's event", metrics);
  }
  if (parsed.delegatedClass !== "status-delegate" || !parsed.delegatedDecoration.includes("line-through")) {
    fail("delegated priority work should receive the red strike treatment", metrics);
  }
  if (parsed.delegatedSelectValue !== "위임"
    || !parsed.delegatedHasInput
    || parsed.delegatedOptionCounts.join(",") !== "1,1"
    || parsed.delegatedFromMenu.status !== "위임"
    || parsed.delegatedFromMenu.priority !== "A"
    || parsed.postponedFromMenu.status !== "연기"
    || parsed.postponedFromMenu.priority !== "A"
    || parsed.restoredPriority.status !== "미완료"
    || parsed.restoredPriority.priority !== "B"
    || parsed.cycleStatuses.some((status) => ["위임", "연기"].includes(status))
    || parsed.cycleStatuses.slice(0, 3).join(",") !== "완료,진행중,미완료"
    || parsed.cycleGuideLabels.join(",") !== "완료,진행중,해제") {
    fail("delegation and postponement should exist once in the priority menu and never in checkbox cycling", metrics);
  }
  if (!parsed.previousBeforeNoon || parsed.previousAtNoon || parsed.olderDate || !parsed.futureDate) {
    fail("worklog edit window should allow future dates and only the first 12 hours after a past workday", metrics);
  }
  const employeeFutureMatrix = await page.evaluate(() => window.eval(`(() => {
    const cases = [
      ["이소미", "재무 대리", "(주)방주", "본사", "회계 정산", "isomi@example.com", "bangju-finance-assistant", "bangju-log"],
      ["최희진", "재무과장", "(주)방주", "본사", "자금 회계", "finance.manager@example.com", "bangju-finance-manager", "bangju-log"],
      ["김성민", "실장", "(주)비욘드컴퍼니", "TBA studio", "시공 상담", "ksm@example.com", "beyond-company-leader", "beyond-log"],
      ["추소영", "공유사업부 매니저", "(주)비욘드컴퍼니", "공유사업부", "공유오피스", "choo@example.com", "beyond-shared-manager", "beyond-log"],
      ["박주홍", "센터장", "비욘드 피트니스", "비욘드 피트니스", "운영총괄", "pjhong0@naver.com", "beyond-fitness-manager", "fitness-log"],
      ["홍현규", "트레이너", "비욘드 피트니스", "비욘드 피트니스", "PT 회원관리", "gusrd1005@gmail.com", "fitness-trainer-1", "fitness-log"],
      ["신세민", "인포데스크", "비욘드 피트니스", "비욘드 피트니스", "주중 인포", "tpals2990@naver.com", "fitness-info-shinsemin", "fitness-log"],
      ["이다빈", "인포데스크", "비욘드 피트니스", "비욘드 피트니스", "토요일 인포", "idabin@example.com", "fitness-weekday-info-idabin", "fitness-log"],
      ["김영채", "인포데스크", "비욘드 피트니스", "비욘드 피트니스", "일요일 인포", "yckim1558@naver.com", "fitness-info-kimyoungchae", "fitness-log"]
    ];
    const results = cases.map(([name, role, org, workplace, primaryWork, email, expectedId, view], index) => {
      authState.user = { id: "future-user-" + index, email };
      state.profile = { ...defaultProfile, name, nickname: name, role, org, workplace, primaryWork, email, approvalStatus: "approved", accessPreset: "employee", permissions: {} };
      state.selectedDateKey = "2026-08-10";
      normalizeState();
      state.selectedEmployeeId = expectedId;
      if (view === "fitness-log") {
        state.fitnessWritableEmployeeId = expectedId;
        state.fitnessLogPage = getFitnessLogPages().findIndex((entry) => entry.id === expectedId);
      }
      return { name, expectedId, mappedId: getProfileMappedEmployeeId(), editable: canEditCurrentWorklog(view) };
    });
    authState.saveTimers?.forEach((timer) => clearTimeout(timer));
    authState.saveTimers = new Map();
    authState.user = { id: "isomi-future-save", email: "isomi@example.com" };
    state.profile = { ...defaultProfile, name: "이소미", nickname: "이소미", role: "재무 대리", org: "(주)방주", workplace: "본사", approvalStatus: "approved", accessPreset: "employee", permissions: {} };
    state.selectedEmployeeId = "bangju-finance-assistant";
    state.selectedDateKey = "2026-08-10";
    getEmployeeLogForDate("bangju-finance-assistant", "2026-08-10").tasks[0].text = "미래 업무 저장 검증";
    saveState({ fastSave: true });
    state.selectedDateKey = "2026-08-11";
    saveState({ fastSave: true });
    const queuedDates = [...authState.saveTimers.keys()].sort();
    authState.saveTimers.forEach((timer) => clearTimeout(timer));
    authState.saveTimers = new Map();
    return JSON.stringify({ results, queuedDates });
  })()`));
  const futureMatrix = JSON.parse(employeeFutureMatrix);
  const brokenFutureEmployees = futureMatrix.results.filter((item) => item.mappedId !== item.expectedId || !item.editable);
  if (brokenFutureEmployees.length) {
    fail("every mapped employee should be able to edit only their own future worklog", JSON.stringify(brokenFutureEmployees));
  }
  if (futureMatrix.queuedDates.join(",") !== "2026-08-10,2026-08-11") {
    fail("rapid date navigation must not cancel a pending future-date remote save", employeeFutureMatrix);
  }
  if (errors.length) fail("priority carryover/date-rule page errors", errors.join(" | "));
  await page.close();
}

async function checkStaffDirectoryListAndDetail(browser) {
  const { page, errors } = await openPage(browser, { width: 390, height: 844 });
  await page.evaluate(() => {
    window.eval(`
      authState.user = { id: "owner-user", email: "j3010@ymail.com" };
      authState.approvalRows = [
        {
          id: "hong-profile",
          email: "projch@naver.com",
          name: "홍길동",
          org: "(주)방주 / 비욘드 피트니스 지사",
          role: "인포데스크",
          workplace: "비욘드 피트니스",
          primary_work: "고객응대, 센터관리",
          work_hours: "16:00-20:00",
          employment_type: "직원",
          approval_status: "approved",
          updated_at: "2026-07-27T09:00:00.000Z"
        },
        {
          id: "isomi-profile",
          email: "isomi@example.com",
          name: "이소미",
          org: "(주)방주",
          role: "재무 대리",
          workplace: "본사",
          primary_work: "지출 정산 문서",
          work_hours: "08:00-18:00",
          employment_type: "직원",
          approval_status: "approved",
          updated_at: "2026-07-27T09:00:00.000Z"
        },
        {
          id: "beyond-kim-profile",
          email: "ksm@example.com",
          name: "김성민",
          org: "(주)비욘드컴퍼니",
          role: "실장",
          workplace: "TBA studio",
          primary_work: "TBA studio 운영 인월바스 시공",
          work_hours: "08:00-18:00",
          employment_type: "직원",
          approval_status: "approved",
          updated_at: "2026-07-27T09:00:00.000Z"
        },
        {
          id: "beyond-choo-profile",
          email: "choo@example.com",
          name: "추소영",
          org: "(주)비욘드컴퍼니",
          role: "공유사업부 매니저",
          workplace: "공유사업부",
          primary_work: "공유오피스 공유창고 운영관리",
          work_hours: "09:00-18:00",
          employment_type: "직원",
          approval_status: "approved",
          updated_at: "2026-07-27T09:00:00.000Z"
        }
      ];
      authState.approvalRowsLoaded = true;
      state.profile = {
        ...state.profile,
        email: "j3010@ymail.com",
        name: "정찬훈",
        nickname: "베니",
        role: "대표",
        org: "(주)방주",
        approvalStatus: "approved"
      };
      switchView("staff");
      renderStaffMaster();
    `);
  });
  await page.waitForTimeout(250);
  const metrics = await page.evaluate(() => {
    const rows = [...document.querySelectorAll(".staff-master-table tbody tr")].map((row) => row.textContent.replace(/\s+/g, " ").trim());
    return {
      activeView: document.body.dataset.activeView,
      rows,
      isomiCount: rows.filter((text) => text.includes("이소미")).length,
      hasHong: rows.some((text) => text.includes("홍길동") && text.includes("projch@naver.com")),
      hasKim: rows.some((text) => text.includes("김성민") && text.includes("(주)비욘드컴퍼니")),
      hasChoo: rows.some((text) => text.includes("추소영") && text.includes("(주)비욘드컴퍼니")),
      hasGenericBeyondLeader: rows.some((text) => text.includes("비욘드 실장") && !text.includes("김성민")),
      hasGenericSharedManager: rows.some((text) => text.includes("공유사업부 매니저") && !text.includes("추소영")),
      firstPanelTitle: document.querySelector(".staff-master-panel h3")?.textContent.trim() || "",
    };
  });
  if (metrics.activeView !== "staff") fail("staff directory active view mismatch", metrics.activeView);
  if (metrics.firstPanelTitle !== "전체 직원 명부") fail("staff directory should show master list first", metrics.firstPanelTitle);
  if (metrics.isomiCount !== 1) fail("staff directory should not duplicate Isomi", JSON.stringify(metrics.rows));
  if (!metrics.hasHong) fail("staff directory should include approved Hong profile", JSON.stringify(metrics.rows));
  if (!metrics.hasKim || !metrics.hasChoo) fail("staff directory should include approved Beyond Company employees", JSON.stringify(metrics.rows));
  if (metrics.hasGenericBeyondLeader || metrics.hasGenericSharedManager) fail("staff directory should replace generic Beyond slots with approved people", JSON.stringify(metrics.rows));

  await page.click(".staff-master-table tbody tr[data-staff-detail-id]");
  await page.waitForTimeout(150);
  const detail = await page.evaluate(() => ({
    visible: Boolean(document.querySelector("#staffDetailOverlay .staff-detail-card")),
    text: document.querySelector("#staffDetailOverlay")?.textContent || "",
    overflow: document.documentElement.scrollWidth - window.innerWidth,
  }));
  if (!detail.visible || !detail.text.includes("직원") || detail.overflow > 2) {
    fail("staff detail modal should open without horizontal overflow", JSON.stringify(detail));
  }
  await page.evaluate(() => window.closeStaffDetail?.());
  await page.click('tr[data-staff-detail-id="bangju-finance-manager"] button[data-staff-detail-id="bangju-finance-manager"]');
  await page.waitForTimeout(120);
  await page.fill('[data-staff-edit-field="name"]', "재무총괄");
  await page.fill('[data-staff-edit-field="role"]', "재무총괄");
  await page.click('[data-staff-profile-save="bangju-finance-manager"]');
  await page.waitForTimeout(180);
  const editMetrics = await page.evaluate(() => {
    const rows = [...document.querySelectorAll(".staff-master-table tbody tr")].map((row) => row.textContent.replace(/\s+/g, " ").trim());
    const override = JSON.parse(localStorage.getItem("beyond-worklog-state-v1") || "{}").employeeDirectoryOverrides || {};
    return {
      hasEditedName: rows.some((text) => text.includes("재무총괄")),
      statusText: document.querySelector("#staffDetailSaveStatus")?.textContent || "",
      overrideName: override["bangju-finance-manager"]?.name || "",
    };
  });
  if (!editMetrics.hasEditedName || editMetrics.overrideName !== "재무총괄") {
    fail("staff detail editor should save manager edits", JSON.stringify(editMetrics));
  }
  const fallbackMetrics = await page.evaluate(() => window.eval(`(async () => {
    const calls = [];
    const fakeClient = {
      from(table) {
        return {
          update(payload) {
            calls.push({ table, payload: { ...payload } });
            return {
              eq() {
                if (Object.prototype.hasOwnProperty.call(payload, "pending_profile_changes")) {
                  return Promise.resolve({
                    error: {
                      message: "Could not find the 'pending_profile_changes' column of 'profiles' in the schema cache",
                    },
                  });
                }
                if (Object.prototype.hasOwnProperty.call(payload, "assigned_mission")) {
                  return Promise.resolve({
                    error: {
                      message: "Could not find the 'assigned_mission' column of 'profiles' in the schema cache",
                    },
                  });
                }
                return Promise.resolve({ error: null });
              }
            };
          }
        };
      }
    };
    const result = await updateProfileRowWithSchemaFallback("profile-1", {
      name: "박주홍",
      pending_profile_changes: {},
      profile_change_requested_at: null,
      assigned_mission: "센터 운영 총괄",
      approved_at: "2026-07-30T00:00:00.000Z"
    }, fakeClient);
    return JSON.stringify({
      error: result.error?.message || "",
      removedColumns: result.removedColumns,
      callCount: calls.length,
      finalPayload: calls.at(-1)?.payload || {},
    });
  })()`));
  const parsedFallback = JSON.parse(fallbackMetrics);
  if (parsedFallback.error || parsedFallback.callCount !== 3) {
    fail("profile schema fallback should retry missing profile columns", fallbackMetrics);
  }
  if (
    !parsedFallback.removedColumns.includes("pending_profile_changes")
    || !parsedFallback.removedColumns.includes("assigned_mission")
    || Object.prototype.hasOwnProperty.call(parsedFallback.finalPayload, "pending_profile_changes")
    || Object.prototype.hasOwnProperty.call(parsedFallback.finalPayload, "assigned_mission")
    || parsedFallback.finalPayload.name !== "박주홍"
  ) {
    fail("profile schema fallback should preserve safe fields only", fallbackMetrics);
  }
  if (errors.length) fail("staff directory page errors", errors.join(" | "));
  await page.close();
}

async function checkCalendarAnnotations(browser) {
  const { page, errors } = await openPage(browser, { width: 390, height: 844 });
  await page.evaluate(() => {
    window.switchView?.("bangju-log");
    window.setSelectedDateKey?.("2026-07-23");
  });
  await page.waitForTimeout(250);
  await page.click("#selectedDateButton");
  await page.waitForTimeout(250);
  const metrics = await page.evaluate(() => {
    const gridText = document.querySelector("#calendarDayGrid")?.textContent || "";
    const holidayCount = document.querySelectorAll("#calendarDayGrid button.is-holiday").length;
    const lunarCount = document.querySelectorAll("#calendarDayGrid button.has-lunar-anchor").length;
    const selectedAria = document.querySelector("#calendarDayGrid button.is-selected")?.getAttribute("aria-label") || "";
    return {
      visible: !document.querySelector("#worklogCalendarPopover")?.hidden,
      gridText,
      holidayCount,
      lunarCount,
      selectedAria,
    };
  });
  if (!metrics.visible) fail("calendar popover did not open");
  if (!metrics.gridText.includes("제헌절")) fail("calendar should show Korean national days", metrics.gridText);
  if (!metrics.gridText.includes("음 6.10")) fail("calendar should show lunar anchor labels", metrics.gridText);
  if (metrics.holidayCount < 1) fail("calendar holiday classes missing", String(metrics.holidayCount));
  if (metrics.lunarCount < 3) fail("calendar lunar anchor classes missing", String(metrics.lunarCount));
  if (!metrics.selectedAria.includes("음 6.10")) fail("calendar aria label should include lunar info", metrics.selectedAria);
  if (errors.length) fail("calendar page errors", errors.join(" | "));
  await page.close();
}

async function checkExecutiveManagementPage(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("beyond-worklog-state-v1", JSON.stringify({
      selectedDateKey: "2026-07-22",
      profile: {
        email: "j3010@ymail.com",
        role: "대표",
        name: "정찬훈",
        nickname: "베니",
        approvalStatus: "approved",
      },
      employeeLogs: {},
    }));
  });
  await page.goto(target, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    document.body.classList.add("physical-phone-device");
    document.body.dataset.layoutMode = "phone";
    document.body.dataset.viewMode = "ceo";
    window.switchView?.("executive");
  });
  await page.waitForTimeout(350);
  const metrics = await page.evaluate(() => {
    const header = document.querySelector(".worklog-header");
    const hero = document.querySelector(".executive-hero");
    const title = document.querySelector(".executive-hero h2");
    const dateButton = document.querySelector("#executiveDateButton");
    const menuButton = document.querySelector("#executiveMenuButton");
    const menuRect = menuButton?.getBoundingClientRect();
    const firstClosed = document.querySelector('[data-executive-section="score"]');
    return {
      activeView: document.body.dataset.activeView,
      headerHeight: header?.getBoundingClientRect().height || 0,
      heroSticky: hero ? getComputedStyle(hero).position : "",
      titleText: title?.textContent?.trim() || "",
      titleColor: title ? getComputedStyle(title).color : "",
      todayText: dateButton?.textContent?.trim() || "",
      todayFits: dateButton ? dateButton.scrollWidth <= dateButton.clientWidth + 2 : false,
      kpiButtonCount: document.querySelectorAll("#executiveKpiGrid button[data-executive-jump]").length,
      menuVisible: Boolean(menuButton?.offsetWidth),
      menuLabel: menuButton?.textContent?.trim() || "",
      menuWidth: menuRect?.width || 0,
      menuHeight: menuRect?.height || 0,
      menuInViewport: Boolean(menuRect && menuRect.left >= 0 && menuRect.right <= window.innerWidth && menuRect.top >= 0),
      closedContentHidden: firstClosed ? getComputedStyle(firstClosed.querySelector(".executive-site-priorities")).display === "none" : false,
    };
  });
  if (metrics.activeView !== "executive") fail("executive active view mismatch", metrics.activeView);
  if (metrics.headerHeight > 1) fail("executive duplicate top header should be visually removed", `${metrics.headerHeight}px`);
  if (metrics.heroSticky !== "sticky") fail("executive hero should be sticky", metrics.heroSticky);
  if (metrics.titleText !== "대표 경영페이지") fail("executive title mismatch", metrics.titleText);
  if (metrics.titleColor !== "rgb(255, 247, 207)") fail("executive title color should stand out", metrics.titleColor);
  if (!/^\d{4}\.\d{2}\.\d{2}\([日月火水木金土]\)$/.test(metrics.todayText)) fail("executive date button should show compact date", metrics.todayText);
  if (!metrics.todayFits) fail("executive date button is clipped", metrics.todayText);
  if (metrics.kpiButtonCount !== 6) fail("executive KPI buttons should be six navigators", String(metrics.kpiButtonCount));
  if (!metrics.menuVisible) fail("executive menu button should be docked inside the active section");
  if (!metrics.menuInViewport) fail("executive menu button should stay in viewport", JSON.stringify(metrics));
  if (metrics.menuLabel !== "메뉴") fail("executive menu label should be consistent", metrics.menuLabel);
  if (metrics.menuWidth < 44 || metrics.menuWidth > 64 || metrics.menuHeight < 44 || metrics.menuHeight > 64) {
    fail("executive menu size should match section chrome", `${metrics.menuWidth}x${metrics.menuHeight}`);
  }
  if (!metrics.closedContentHidden) fail("executive detail sections should start summarized");
  await page.click("#executiveMenuButton");
  await page.waitForTimeout(120);
  const menuState = await page.evaluate(() => {
    const popover = document.querySelector("#mainMenuPopover");
    const firstButton = popover?.querySelector("button:not([hidden])");
    const rect = popover?.getBoundingClientRect();
    return {
      hidden: popover?.hidden ?? true,
      aria: document.querySelector("#settingsGearButton")?.getAttribute("aria-expanded"),
      hasVisibleItem: Boolean(firstButton?.offsetWidth),
      inViewport: rect ? rect.width > 0 && rect.height > 0 && rect.right <= window.innerWidth && rect.left >= 0 : false,
    };
  });
  if (menuState.hidden || menuState.aria !== "true" || !menuState.hasVisibleItem || !menuState.inViewport) {
    fail("executive menu button should open the main menu", JSON.stringify(menuState));
  }
  await page.keyboard.press("Escape");
  await page.click('[data-executive-jump="score"]');
  await page.waitForTimeout(150);
  const opened = await page.evaluate(() => document.querySelector('[data-executive-section="score"]')?.classList.contains("is-open"));
  if (!opened) fail("executive KPI button did not open target section");
  if (errors.length) fail("executive page errors", errors.join(" | "));
  await page.close();
}

async function checkAiMissionArchitect(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  await page.addInitScript(() => {
    localStorage.setItem("beyond-worklog-state-v1", JSON.stringify({
      selectedDateKey: "2026-07-22",
      selectedEmployeeId: "beyond-fitness-manager",
      profile: {
        email: "j3010@ymail.com",
        role: "대표",
        name: "정찬훈",
        nickname: "베니",
        approvalStatus: "approved",
      },
      employeeLogs: {},
    }));
  });
  await page.goto(target, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => window.switchView?.("ai"));
  await page.waitForTimeout(350);
  const metrics = await page.evaluate(() => ({
    activeView: document.body.dataset.activeView,
    missionTitle: document.querySelector(".ai-mission-command-card strong")?.textContent?.trim() || "",
    applyButtons: document.querySelectorAll("#view-ai [data-ai-mission-apply]").length,
  }));
  if (metrics.activeView !== "ai") fail("AI coaching view did not open", metrics.activeView);
  if (metrics.missionTitle !== "업무·프로젝트 제안") fail("AI mission architect title missing", metrics.missionTitle);
  if (metrics.applyButtons) fail("representative must not receive buttons that write into an employee worklog");
  const applied = await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem("beyond-worklog-state-v1") || "{}");
    const logs = stored.employeeLogs?.[stored.selectedDateKey] || {};
    return Object.values(logs).some((log) => (log.tasks || []).some((task) => String(task.text || "").includes("[AI미션]")));
  });
  if (applied) fail("representative AI coaching must not write into an employee worklog");
  if (errors.length) fail("AI mission page errors", errors.join(" | "));
  await page.close();
}

async function checkPremiumOperatingSystem(browser) {
  for (const viewport of [
    { label: "phone", width: 390, height: 844 },
    { label: "desktop", width: 1280, height: 900 },
  ]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem("beyond-worklog-state-v1", JSON.stringify({
        selectedDateKey: "2026-07-22",
        selectedEmployeeId: "beyond-fitness-manager",
        profile: {
          email: "j3010@ymail.com",
          role: "대표",
          name: "정찬훈",
          nickname: "베니",
          approvalStatus: "approved",
        },
        employeeLogs: {
          "2026-07-22": {
            "beyond-fitness-manager": {
              tasks: [
                { id: "t1", priority: "A", text: "재등록 후보 3명 연락", status: "완료", done: true },
                { id: "t2", priority: "B", text: "샤워실 청결 점검", status: "미완료", done: false },
              ],
              schedule: [
                { time: "08:00", text: "(P/T) 김영수", items: [{ type: "P/T", text: "김영수" }] },
                { time: "10:00", text: "(상담) 재등록 상담", items: [{ type: "상담", text: "재등록 상담" }] },
              ],
              clockIn: "06:00",
              clockOut: "",
              fitnessOps: { ptRegular: 1, consultation: 1, customerRenewal: 1 },
              report: "재등록 후보 확인 및 센터 청결 점검 진행",
            },
          },
        },
      }));
    });
    await page.goto(target, { waitUntil: "domcontentloaded" });
    await page.evaluate((label) => {
      document.body.classList.toggle("physical-phone-device", label === "phone");
      document.body.dataset.layoutMode = label === "phone" ? "phone" : "classic";
      document.body.dataset.viewMode = label === "phone" ? "ceo" : "classic";
      window.switchView?.("premium");
    }, viewport.label);
    await page.waitForTimeout(350);
    const metrics = await page.evaluate(() => {
      const hero = document.querySelector(".premium-operating-hero");
      const firstAgent = document.querySelector(".premium-agent-grid button");
      return {
        activeView: document.body.dataset.activeView,
        title: document.querySelector(".premium-operating-hero h2")?.textContent?.trim() || "",
        score: Number(document.querySelector("#premiumReadinessScore")?.textContent?.trim() || 0),
        proofCount: document.querySelectorAll(".premium-proof-grid article").length,
        agentCount: document.querySelectorAll(".premium-agent-grid button").length,
        roadmapCount: document.querySelectorAll(".premium-roadmap-card article").length,
        heroWidth: hero?.getBoundingClientRect().width || 0,
        firstAgentVisible: Boolean(firstAgent?.offsetWidth),
      };
    });
    if (metrics.activeView !== "premium") fail("premium OS did not open", `${viewport.label}: ${metrics.activeView}`);
    if (metrics.title !== "AI 운영총괄") fail("premium OS title missing", `${viewport.label}: ${metrics.title}`);
    if (metrics.score <= 0 || metrics.score > 100) fail("premium readiness score invalid", `${viewport.label}: ${metrics.score}`);
    if (metrics.proofCount !== 6) fail("premium proof grid should have six cards", `${viewport.label}: ${metrics.proofCount}`);
    if (metrics.agentCount !== 4) fail("premium agent grid should have four lanes", `${viewport.label}: ${metrics.agentCount}`);
    if (metrics.roadmapCount !== 5) fail("premium roadmap should have five steps", `${viewport.label}: ${metrics.roadmapCount}`);
    if (!metrics.firstAgentVisible || metrics.heroWidth <= 0) fail("premium OS is not visually rendered", `${viewport.label}: ${JSON.stringify(metrics)}`);
    await page.click(".premium-agent-grid button");
    await page.waitForTimeout(160);
    const jumpedView = await page.evaluate(() => document.body.dataset.activeView);
    if (!["control", "ai", "worklog", "attendance", "fitness-log", "bangju-log", "beyond-log"].includes(jumpedView)) {
      fail("premium agent lane did not navigate", `${viewport.label}: ${jumpedView}`);
    }
    if (errors.length) fail("premium OS page errors", `${viewport.label}: ${errors.join(" | ")}`);
    await page.close();
  }
}

async function checkSectionAiWorklogActions(browser) {
  const { page, errors } = await openPage(browser, { width: 390, height: 844 });
  await page.evaluate(() => {
    window.eval(`
      state.profile = {
        ...state.profile,
        email: "finance@example.com",
        role: "재무과장",
        name: "재무과장",
        nickname: "재무",
        org: "(주)방주",
        approvalStatus: "approved"
      };
      state.selectedDateKey = todayKey;
      state.selectedEmployeeId = "bangju-finance-manager";
      authState.user = { id: "qa-user", email: "finance@example.com" };
      normalizeState();
    `);
    document.body.classList.add("physical-phone-device");
    document.body.dataset.layoutMode = "phone";
    document.body.dataset.viewMode = "ceo";
    window.switchView?.("bangju-log");
  });
  await page.waitForTimeout(250);
  await page.click('.worklog-task-panel [data-mobile-focus-open="tasks"]');
  await page.waitForTimeout(120);
  await page.click('.worklog-task-panel [data-section-ai="tasks"]');
  await page.waitForTimeout(250);
  await page.click('.worklog-task-panel [data-mobile-focus-close]');
  await page.waitForTimeout(120);
  await page.click('.worklog-schedule-panel [data-mobile-focus-open="schedule"]');
  await page.waitForTimeout(120);
  await page.click('.worklog-schedule-panel [data-section-ai="schedule"]');
  await page.waitForTimeout(250);
  const metrics = await page.evaluate(() => {
    const log = window.eval(`state.employeeLogs?.[getActiveDateKey()]?.["bangju-finance-manager"]`);
    return {
      activeView: document.body.dataset.activeView,
      taskTexts: (log?.tasks || []).map((task) => task.text || ""),
      scheduleTexts: (log?.schedule || []).map((entry) => window.getScheduleEntryText ? window.getScheduleEntryText(entry) : entry.text || ""),
      toast: document.querySelector("#appToast")?.textContent?.trim() || "",
    };
  });
  if (metrics.activeView !== "bangju-log") fail("section AI worklog view mismatch", metrics.activeView);
  if (!metrics.taskTexts.some((text) => text.includes("[AI미션]"))) fail("section AI task button did not create an AI mission", metrics.taskTexts.join(" | "));
  if (!metrics.scheduleTexts.some((text) => text.includes("AI") || text.includes("핵심업무") || text.includes("리스크") || text.includes("출결"))) {
    fail("section AI schedule button did not create an execution slot", metrics.scheduleTexts.join(" | "));
  }
  if (errors.length) fail("section AI worklog errors", errors.join(" | "));
  await page.close();
}

async function checkSectionChromeReleasePolish(browser) {
  const { page, errors } = await openPage(browser, { width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("beyond-worklog-state-v1", JSON.stringify({
      selectedDateKey: "2026-07-24",
      selectedEmployeeId: "beyond-fitness-manager",
      profile: {
        email: "j3010@ymail.com",
        role: "대표",
        name: "정찬훈",
        nickname: "베니",
        approvalStatus: "approved",
      },
      employeeLogs: {},
    }));
    localStorage.setItem("beyond-worklog-global-view-mode", "ceo");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    document.body.classList.add("physical-phone-device");
    document.body.dataset.layoutMode = "phone";
    document.body.dataset.viewMode = "ceo";
  });

  const views = ["bangju-log", "beyond-log", "fitness-log", "attendance", "report", "settings", "auth", "staff", "ai"];
  for (const view of views) {
    await page.evaluate((targetView) => window.switchView?.(targetView), view);
    await page.waitForTimeout(220);
    const metrics = await page.evaluate(() => {
      const panel = document.querySelector(".worklog-view.is-active");
      const dock = panel?.querySelector(".section-menu-dock");
      const menuButton = dock?.querySelector("#settingsGearButton");
      const dockRect = dock?.getBoundingClientRect();
      const buttonRect = menuButton?.getBoundingClientRect();
      const activeViews = [...document.querySelectorAll(".worklog-view.is-active")].map((node) => node.id);
      return {
        activeView: document.body.dataset.activeView,
        panelId: panel?.id || "",
        activeViews,
        horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
        dockVisible: Boolean(dockRect && dockRect.width > 0 && dockRect.height > 0),
        menuVisible: Boolean(buttonRect && buttonRect.width > 0 && buttonRect.height > 0),
        menuInViewport: Boolean(buttonRect && buttonRect.left >= 0 && buttonRect.right <= window.innerWidth && buttonRect.top >= 0),
        menuLabel: menuButton?.textContent?.trim() || "",
        menuWidth: buttonRect?.width || 0,
        menuHeight: buttonRect?.height || 0,
      };
    });
    if (metrics.activeViews.length !== 1) fail("only one active section should be visible", `${view}: ${metrics.activeViews.join(",")}`);
    if (metrics.horizontalOverflow > 2) fail("section has horizontal overflow", `${view}: ${metrics.horizontalOverflow}px`);
    if (!metrics.dockVisible || !metrics.menuVisible || !metrics.menuInViewport) {
      fail("section menu dock is not release-ready", `${view}: ${JSON.stringify(metrics)}`);
    }
    if (metrics.menuLabel !== "메뉴") fail("section menu label should be consistent", `${view}: ${metrics.menuLabel}`);
    if (metrics.menuWidth < 44 || metrics.menuWidth > 64 || metrics.menuHeight < 44 || metrics.menuHeight > 64) {
      fail("section menu size should be consistent", `${view}: ${metrics.menuWidth}x${metrics.menuHeight}`);
    }
    await page.click(".worklog-view.is-active .section-menu-dock #settingsGearButton");
    await page.waitForTimeout(120);
    const menuState = await page.evaluate(() => {
      const popover = document.querySelector("#mainMenuPopover");
      const rect = popover?.getBoundingClientRect();
      return {
        hidden: popover?.hidden ?? true,
        hasItems: document.querySelectorAll("#mainMenuPopover button:not([hidden])").length,
        position: popover ? getComputedStyle(popover).position : "",
        inViewport: Boolean(rect && rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.right <= window.innerWidth && rect.bottom <= window.innerHeight),
      };
    });
    if (menuState.hidden || !menuState.hasItems || !menuState.inViewport) {
      fail("section menu popover is clipped or empty", `${view}: ${JSON.stringify(menuState)}`);
    }
    if (menuState.position !== "fixed") {
      fail("phone section menu popover should escape rounded section containers", `${view}: ${menuState.position}`);
    }
    await page.keyboard.press("Escape");
    await page.evaluate(() => window.closeMainMenuPopover?.());
  }
  await page.evaluate(() => window.switchView?.("worklog-overview"));
  await page.waitForTimeout(220);
  const overviewMenuMetrics = await page.evaluate(() => {
    const nav = document.querySelector("#overviewDateSwipeArea");
    const menuButton = nav?.querySelector("#settingsGearButton");
    const buttonRect = menuButton?.getBoundingClientRect();
    return {
      activeView: document.body.dataset.activeView,
      menuVisible: Boolean(buttonRect && buttonRect.width > 0 && buttonRect.height > 0),
      menuInViewport: Boolean(buttonRect && buttonRect.left >= 0 && buttonRect.right <= window.innerWidth && buttonRect.top >= 0),
      menuLabel: menuButton?.textContent?.trim() || "",
    };
  });
  if (overviewMenuMetrics.activeView !== "worklog-overview") fail("overview menu test active view mismatch", JSON.stringify(overviewMenuMetrics));
  if (!overviewMenuMetrics.menuVisible || !overviewMenuMetrics.menuInViewport || overviewMenuMetrics.menuLabel !== "메뉴") {
    fail("overview menu button should be visible in date nav", JSON.stringify(overviewMenuMetrics));
  }
  await page.click("#overviewDateSwipeArea #settingsGearButton");
  await page.waitForTimeout(120);
  const overviewMenuState = await page.evaluate(() => {
    const popover = document.querySelector("#mainMenuPopover");
    const rect = popover?.getBoundingClientRect();
    return {
      hidden: popover?.hidden ?? true,
      parent: popover?.parentElement?.id || popover?.parentElement?.className || "",
      hasItems: document.querySelectorAll("#mainMenuPopover button:not([hidden])").length,
      position: popover ? getComputedStyle(popover).position : "",
      inViewport: Boolean(rect && rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.right <= window.innerWidth && rect.bottom <= window.innerHeight),
    };
  });
  if (overviewMenuState.hidden || !overviewMenuState.hasItems || !overviewMenuState.inViewport || overviewMenuState.position !== "fixed") {
    fail("overview menu popover should open without clipping", JSON.stringify(overviewMenuState));
  }
  await page.keyboard.press("Escape");
  await page.evaluate(() => window.closeMainMenuPopover?.());
  if (errors.length) fail("section chrome polish errors", errors.join(" | "));
  await page.close();
}

async function checkReportArchiveVault(browser) {
  const { page, errors } = await openPage(browser, { width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("beyond-worklog-state-v1", JSON.stringify({
      selectedDateKey: "2026-07-24",
      selectedEmployeeId: "beyond-fitness-manager",
      profile: {
        email: "j3010@ymail.com",
        role: "대표",
        name: "정찬훈",
        nickname: "베니",
        approvalStatus: "approved",
      },
      employeeLogs: {
        "2026-07-24": {
          "beyond-fitness-manager": {
            employeeId: "beyond-fitness-manager",
            org: "(주)방주 / 비욘드 피트니스 지사",
            role: "센터장",
            clockIn: "06:00",
            clockOut: "17:00",
            tasks: [{ priority: "A", text: "센터 운영점검", status: "완료", done: true }],
            schedule: [{ time: "08:00", items: [{ type: "P/T", text: "김영수" }], status: "예정" }],
            scheduleUnit: "60",
            report: "센터 운영 정상",
            memo: "",
            fitnessOps: { ptRegular: "1", ptFree: "", ptOther: "", customerNew: "", customerRenewal: "", dayPass: "", consultation: "1", outbound: "", outsideSales: "", shiftNote: "", specialReport: "락커 점검 필요" },
          },
        },
      },
    }));
    localStorage.setItem("beyond-worklog-global-view-mode", "ceo");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    document.body.classList.add("physical-phone-device");
    document.body.dataset.layoutMode = "phone";
    document.body.dataset.viewMode = "ceo";
    window.switchView?.("report");
  });
  await page.waitForTimeout(300);
  await page.click('[data-section-shortcut="daily-report"]');
  await page.waitForTimeout(220);
  await page.fill("#reportArchiveDate", "2026-07-24");
  await page.selectOption("#reportArchiveSite", "fitness");
  await page.selectOption("#reportArchiveType", "fitness");
  await page.waitForTimeout(180);
  const metrics = await page.evaluate(() => {
    const card = document.querySelector(".report-archive-card");
    const preview = document.querySelector("#reportArchivePreview");
    const listItems = [...document.querySelectorAll("#reportArchiveList button")].map((button) => button.textContent.trim());
    const rect = card?.getBoundingClientRect();
    return {
      activeView: document.body.dataset.activeView,
      cardVisible: Boolean(rect && rect.width > 0 && rect.height > 0),
      horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
      listCount: listItems.length,
      listText: listItems.join(" | "),
      previewText: preview?.textContent || "",
      dateValue: document.querySelector("#reportArchiveDate")?.value || "",
      siteValue: document.querySelector("#reportArchiveSite")?.value || "",
      typeValue: document.querySelector("#reportArchiveType")?.value || "",
    };
  });
  if (metrics.activeView !== "report") fail("report archive active view mismatch", metrics.activeView);
  if (!metrics.cardVisible) fail("report archive card should be visible");
  if (metrics.horizontalOverflow > 2) fail("report archive has horizontal overflow", `${metrics.horizontalOverflow}px`);
  if (metrics.dateValue !== "2026-07-24" || metrics.siteValue !== "fitness" || metrics.typeValue !== "fitness") {
    fail("report archive filters did not settle", JSON.stringify(metrics));
  }
  if (metrics.listCount < 2 || !metrics.listText.includes("피트니스") || !metrics.previewText.includes("비욘드 피트니스")) {
    fail("report archive should expose fitness center and employee reports", JSON.stringify(metrics));
  }
  if (errors.length) fail("report archive errors", errors.join(" | "));
  await page.close();
}

async function checkFitnessCenterReportConfirmation(browser) {
  const { page, errors } = await openPage(browser, { width: 390, height: 844 });
  let aiCoachRequest = null;
  await page.route("**/api/fitness-coach", async (route) => {
    aiCoachRequest = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        model: "gpt-5.6-qa",
        generatedAt: "2026-07-24T12:00:00.000Z",
        coaching: {
          praise: "직원 운영기록을 빠짐없이 취합한 점이 좋습니다.",
          feedback: "상담 결과의 후속 담당자를 한 명씩 지정해주세요.",
          nextAction: "내일 첫 근무 전에 만료 예정 회원 후속조치를 확인하세요.",
          manualReminder: "센터장 매뉴얼의 마감 인수인계 기준을 확인해주세요.",
          evidence: ["직원 운영기록", "센터 보고 확정"],
        },
      }),
    });
  });
  await page.evaluate(() => {
    window.eval(`
      authState.user = { id: "fitness-manager-auth", email: "pjhong0@naver.com" };
      state.profile = {
        ...state.profile,
        authUserId: "fitness-manager-auth",
        email: "pjhong0@naver.com",
        role: "센터장",
        name: "박주홍",
        nickname: "센터장",
        org: "(주)비욘드컴퍼니",
        workplace: "비욘드 피트니스",
        primaryWork: "피트니스 운영총괄",
        approvalStatus: "approved",
        workHours: "06:00-24:00"
      };
      state.selectedDateKey = "2026-07-24";
      state.fitnessWritableEmployeeId = "beyond-fitness-manager";
      state.fitnessLogPage = 0;
      state.fitnessLogPageId = "fitness-center";
      authState.approvalRows = [{
        id: "remote-dabin",
        email: "dabin@example.com",
        name: "이다빈",
        nickname: "다빈",
        org: "(주)비욘드컴퍼니",
        role: "인포데스크",
        workplace: "비욘드 피트니스",
        primary_work: "고객응대, 센터관리",
        employment_type: "직원",
        work_hours: "16:00-20:00",
        approval_status: "approved"
      }];
      authState.approvalRowsLoaded = true;
      const log = getEmployeeLogForDate("beyond-fitness-manager", "2026-07-24");
      log.clockIn = "06:00";
      log.clockOut = "12:00";
      log.fitnessOps = { ...createFitnessOps(), ptRegular: "2", consultation: "1" };
      log.fitnessOpsManual = { ...createFitnessOpsManual(), ptRegular: true, consultation: true };
      const priorManagerLog = getEmployeeLogForDate("beyond-fitness-manager", "2026-07-23");
      priorManagerLog.fitnessOps = { ...createFitnessOps(), ptRegular: "3", ptFree: "1" };
      priorManagerLog.fitnessOpsManual = { ...createFitnessOpsManual(), ptRegular: true, ptFree: true };
      const dabinLog = getEmployeeLogForDate("fitness-weekday-info", "2026-07-24");
      dabinLog.clockIn = "16:00";
      dabinLog.clockOut = "20:00";
      dabinLog.fitnessOps = { ...createFitnessOps(), ptRegular: "1", ptFree: "1", consultation: "2", inbound: "1" };
      dabinLog.fitnessOps.specialReport = "마감 정리 완료";
      const kimLog = createEmployeeLog({
        id: "profile-user",
        name: "김영채",
        email: "yckim1558@naver.com",
        org: "(주)비욘드컴퍼니",
        workplace: "비욘드 피트니스",
        role: "인포데스크"
      }, {}, "2026-07-24");
      kimLog.tasks[0].text = "일요일 센터 청결 점검";
      kimLog.tasks[1].text = "회원 문의 회신";
      kimLog.tasks[2].text = "비품 재고 확인";
      kimLog.tasks[3].text = "마감 인수인계 작성";
      kimLog.tasks[4].text = "블로그 게시물 점검";
      kimLog.schedule[0].text = "출근보고, 종이컵 채우기, 여자탈의실 청소";
      kimLog.schedule[1].text = "세탁완료물 정리, 블로그 작성 및 업데이트";
      kimLog.schedule[2].text = "회원 문의 응대 기록";
      kimLog.schedule[3].text = "비품 창고 정리";
      kimLog.report = "금일 센터 운영 업무보고 원문";
      kimLog.record = "현장 실행기록 원문";
      kimLog.memo = "다음 근무자 인수인계 원문";
      kimLog.fitnessOps.specialReport = "피트니스 특이사항 원문";
      const shinLog = getEmployeeLogForDate("fitness-info-shinsemin", "2026-07-24");
      shinLog.tasks[0].text = "신세민 고객응대 우선업무";
      shinLog.schedule[0].items[0].text = "신세민 센터 오픈 점검";
      syncScheduleEntryText(shinLog.schedule[0]);
      shinLog.report = "신세민 업무보고 원문";
      shinLog.record = "신세민 실행기록 원문";
      shinLog.memo = "신세민 인수인계 원문";
      shinLog.fitnessOps.specialReport = "신세민 특이사항 원문";
      mergeVisibleStaffWorklogStates([{
        user_id: "kimyoungchae-auth",
        state: {
          profile: {
            name: "김영채",
            email: "yckim1558@naver.com",
            org: "(주)비욘드컴퍼니",
            workplace: "비욘드 피트니스",
            role: "인포데스크",
            approvalStatus: "approved"
          },
          selectedEmployeeId: "profile-user",
          employeeLogs: { "2026-07-24": { "profile-user": kimLog } }
        }
      }], "2026-07-24");
      saveState({ fastSave: true });
      document.body.classList.add("physical-phone-device");
      document.body.dataset.layoutMode = "phone";
      document.body.dataset.viewMode = "ceo";
      switchView("fitness-log");
    `);
  });
  await page.waitForTimeout(350);
  const before = await page.evaluate(() => ({
    activeView: document.body.dataset.activeView,
    pageTitle: document.querySelector("#fitnessLogPageTitle")?.textContent?.trim() || "",
    disabled: document.querySelector("[data-fitness-center-report-confirm]")?.disabled ?? true,
    text: document.querySelector("#fitnessCenterConfirmPanel")?.textContent?.trim() || "",
    centerRows: [...document.querySelectorAll("#fitnessCenterDailyBody tr")].map((row) => row.textContent.replace(/\s+/g, " ").trim()),
    pageTitles: getFitnessLogPages().map((page) => page.title),
    kimLog: (() => {
      const employee = getFitnessCenterEmployees().find((item) => item.name === "김영채");
      const log = getFitnessEmployeeLogForDate(employee, "2026-07-24");
      const model = buildFitnessReportModel({ employee, dateKey: "2026-07-24", isCenter: false });
      const html = renderFitnessReportTemplate(model);
      return {
        task: log?.tasks?.[0]?.text || "",
        schedule: (log?.schedule || []).map((entry) => entry.text || "").filter(Boolean),
        reportTaskCount: model.topTasks.filter(Boolean).length,
        reportSchedule: getFitnessReportScheduleRows(model.schedule).map((entry) => entry.text).filter(Boolean),
        reportIssues: model.issueRows.filter(Boolean),
        reportExportHeight: getFitnessReportExportHeight(model),
        reportHtml: html,
      };
    })(),
    shinLog: (() => {
      const employee = getFitnessCenterEmployees().find((item) => item.name === "신세민");
      const model = buildFitnessReportModel({ employee, dateKey: "2026-07-24", isCenter: false });
      return {
        candidateIds: getFitnessEmployeeLogCandidateIds(employee),
        reportHtml: renderFitnessReportTemplate(model),
      };
    })(),
    managerClassStats: (() => {
      const employee = getFitnessCenterEmployees().find((item) => item.id === "beyond-fitness-manager");
      const model = buildFitnessReportModel({ employee, dateKey: "2026-07-24", isCenter: false });
      return {
        stats: model.classStats,
        labels: model.kpis.map(([label]) => label),
        values: model.kpis.map(([, value]) => value),
        html: renderFitnessReportTemplate(model),
      };
    })(),
  }));
  if (before.activeView !== "fitness-log" || !before.pageTitle.includes("센터")) {
    fail("fitness center report confirmation should start on center page", JSON.stringify(before));
  }
  if (before.disabled) fail("fitness center manager should be able to confirm the center report", JSON.stringify(before));
  ["재무과장", "재무 대리", "공유사업부 매니저", "김성민", "피트니스 예비", "토요 인포", "일요 인포"].forEach((label) => {
    if (before.centerRows.some((row) => row.includes(label))) {
      fail("fitness center roster should only show assigned fitness staff", `${label} leaked into ${JSON.stringify(before.centerRows)}`);
    }
  });
  ["박주홍", "홍현규", "이다빈"].forEach((label) => {
    if (!before.centerRows.some((row) => row.includes(label))) {
      fail("fitness center roster should include active fitness staff", `${label} missing from ${JSON.stringify(before.centerRows)}`);
    }
  });
  const parkRows = before.centerRows.filter((row) => row.includes("박주홍"));
  if (parkRows.length !== 1) {
    fail("fitness center roster should show only one Park Ju-hong manager account", JSON.stringify(before.centerRows));
  }
  if (before.pageTitles.filter((title) => title === "이다빈").length !== 1) {
    fail("fitness roster should show Lee Da-bin only once", JSON.stringify(before.pageTitles));
  }
  if (before.kimLog.task !== "일요일 센터 청결 점검"
    || before.kimLog.schedule.length !== 4
    || !before.kimLog.schedule[0].includes("출근보고, 종이컵 채우기, 여자탈의실 청소")
    || !before.kimLog.schedule[1].includes("세탁완료물 정리, 블로그 작성 및 업데이트")) {
    fail("representative fitness view should load Kim Young-chae's profile-user worklog", JSON.stringify(before));
  }
  if (before.kimLog.reportTaskCount !== 5 || before.kimLog.reportSchedule.length !== 4 || before.kimLog.reportExportHeight <= 1754) {
    fail("personal fitness report should include every recorded task and schedule row", JSON.stringify(before.kimLog));
  }
  ["일요일 센터 청결 점검", "블로그 게시물 점검", "회원 문의 응대 기록", "비품 창고 정리", "금일 센터 운영 업무보고 원문", "현장 실행기록 원문", "다음 근무자 인수인계 원문", "피트니스 특이사항 원문"].forEach((label) => {
    if (!before.kimLog.reportHtml.includes(label)) {
      fail("personal fitness report should preserve all worklog source content", `${label} missing`);
    }
  });
  if (before.shinLog.candidateIds.some((id) => id === "fitness-weekday-info" || id === "fitness-weekday-info-idabin")) {
    fail("named fitness employees must not read another info employee's worklog", JSON.stringify(before.shinLog.candidateIds));
  }
  ["신세민 고객응대 우선업무", "신세민 센터 오픈 점검", "신세민 업무보고 원문", "신세민 실행기록 원문", "신세민 인수인계 원문", "신세민 특이사항 원문"].forEach((label) => {
    if (!before.shinLog.reportHtml.includes(label)) {
      fail("Shin Se-min's personal report should preserve every worklog source field", `${label} missing`);
    }
  });
  if (before.managerClassStats.stats?.paid?.today !== 2
    || before.managerClassStats.stats?.paid?.month !== 5
    || before.managerClassStats.stats?.free?.today !== 0
    || before.managerClassStats.stats?.free?.month !== 1
    || before.managerClassStats.labels[0] !== "유료PT"
    || before.managerClassStats.labels[1] !== "무료PT"
    || before.managerClassStats.values[0] !== "2/5"
    || before.managerClassStats.values[1] !== "0/1"
    || !before.managerClassStats.html.includes("2/5")
    || !before.managerClassStats.html.includes("0/1")) {
    fail("personal fitness report should separate paid/free PT as today/month totals", JSON.stringify(before.managerClassStats));
  }
  ["pjhong1", "pjhong9"].forEach((retiredEmailPrefix) => {
    if (before.centerRows.some((row) => row.includes(retiredEmailPrefix))) {
      fail("fitness center roster should hide retired Park manager accounts", `${retiredEmailPrefix} leaked into ${JSON.stringify(before.centerRows)}`);
    }
  });
  await page.click("[data-fitness-center-report-confirm]");
  await page.waitForTimeout(220);
  const confirmed = await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem("beyond-worklog-state-v1") || "{}");
    return {
      statusText: document.querySelector("#fitnessCenterConfirmPanel")?.textContent?.trim() || "",
      stored: stored.fitnessCenterReports?.["2026-07-24"] || null,
    };
  });
  if (confirmed.stored?.status !== "confirmed" || !confirmed.stored?.confirmedAt || !confirmed.statusText.includes("확정")) {
    fail("fitness center report confirmation was not persisted", JSON.stringify(confirmed));
  }
  await page.evaluate(() => {
    authState.session = { access_token: "qa-access-token" };
  });
  await page.click("#fitnessReportMenuButton");
  await page.waitForTimeout(450);
  const reportState = await page.evaluate(() => ({
    buttonHidden: document.querySelector("#fitnessReportConfirmButton")?.hidden ?? true,
    buttonText: document.querySelector("#fitnessReportConfirmButton")?.textContent?.trim() || "",
    previewText: document.querySelector("#fitnessReportPreview")?.textContent?.trim() || "",
    coachButtonAbsent: !document.querySelector("#fitnessReportCoachButton"),
    aiStatusText: document.querySelector("#fitnessReportAiStatus")?.textContent?.trim() || "",
  }));
  if (reportState.buttonHidden || reportState.buttonText !== "확정 취소" || !reportState.previewText.includes("확정")) {
    fail("fitness report preview should expose confirmation state", JSON.stringify(reportState));
  }
  if (!aiCoachRequest?.context?.manual?.guidelines?.length
    || !reportState.coachButtonAbsent
    || reportState.aiStatusText !== "AI 코칭 반영 완료"
    || !reportState.previewText.includes("AI 코칭 · ChatGPT")
    || !reportState.previewText.includes("직원 운영기록을 빠짐없이 취합한 점이 좋습니다.")
    || !reportState.previewText.includes("센터장 매뉴얼의 마감 인수인계 기준을 확인해주세요.")) {
    fail("fitness report should replace fallback guidance with authenticated ChatGPT coaching", JSON.stringify({ aiCoachRequest, reportState }));
  }
  ["명일 예정업무", "전체 직원 운영기록", "유료PT", "무료PT", "기타PT", "신규", "재등록", "상담", "아웃바운드", "인바운드", "특이사항", "오늘의 기록", "담당", "팀장", "센터장"].forEach((label) => {
    if (!reportState.previewText.includes(label)) {
      fail("fitness center report should preserve handwritten report fields", `${label} missing`);
    }
  });
  ["이다빈", "16:00", "20:00", "마감 정리 완료"].forEach((label) => {
    if (!reportState.previewText.includes(label)) {
      fail("fitness center report should include approved staff attendance records", `${label} missing`);
    }
  });
  ["출결현황 / PT수업", "계약현황 / 고객관리", "시간별 세부업무", "근태"].forEach((label) => {
    if (reportState.previewText.includes(label)) {
      fail("fitness center report should use the compact center operations sheet", `${label} should be removed`);
    }
  });
  if (errors.length) fail("fitness center confirmation page errors", errors.join(" | "));
  await page.close();
}

async function checkReportArchiveFitnessSubmission(browser) {
  const { page, errors } = await openPage(browser, { width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("beyond-worklog-state-v1", JSON.stringify({
      selectedDateKey: "2026-07-24",
      selectedEmployeeId: "beyond-fitness-manager",
      fitnessWritableEmployeeId: "beyond-fitness-manager",
      profile: {
        authUserId: "fitness-manager-auth",
        email: "pjhong0@naver.com",
        role: "센터장",
        name: "박주홍",
        nickname: "센터장",
        org: "(주)비욘드컴퍼니",
        workplace: "비욘드 피트니스",
        primaryWork: "피트니스 운영총괄",
        approvalStatus: "approved",
        workHours: "06:00-24:00",
      },
      employeeLogs: {
        "2026-07-24": {
          "beyond-fitness-manager": {
            employeeId: "beyond-fitness-manager",
            org: "(주)방주 / 비욘드 피트니스 지사",
            role: "센터장",
            clockIn: "06:00",
            clockOut: "17:00",
            tasks: [{ priority: "A", text: "센터 운영점검", status: "완료", done: true }],
            schedule: [{ time: "08:00", items: [{ type: "P/T", text: "김영수" }], status: "예정" }],
            scheduleUnit: "60",
            report: "센터 운영 정상",
            memo: "",
            fitnessOps: { ptRegular: "1", ptFree: "", ptOther: "", customerNew: "", customerRenewal: "", dayPass: "", consultation: "1", outbound: "", outsideSales: "", shiftNote: "", specialReport: "" },
          },
        },
      },
    }));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    window.eval(`
      authState.user = { id: "fitness-manager-auth", email: "pjhong0@naver.com" };
      document.body.classList.add("physical-phone-device");
      document.body.dataset.layoutMode = "phone";
      document.body.dataset.viewMode = "ceo";
      switchView("report");
    `);
  });
  await page.waitForTimeout(250);
  await page.click('[data-section-shortcut="daily-report"]');
  await page.waitForTimeout(220);
  await page.fill("#reportArchiveDate", "2026-07-24");
  await page.selectOption("#reportArchiveSite", "fitness");
  await page.selectOption("#reportArchiveType", "fitness");
  await page.click('[data-report-archive-id="employee:beyond-fitness-manager"]');
  await page.waitForTimeout(200);
  const before = await page.evaluate(() => ({
    hasPaper: Boolean(document.querySelector("#reportArchivePreview .fitness-report-page.is-personal-report")),
    hasSubmit: Boolean(document.querySelector("[data-report-submit-worklog]")),
    previewText: document.querySelector("#reportArchivePreview")?.textContent || "",
  }));
  if (!before.hasPaper || !before.hasSubmit || !before.previewText.includes("비욘드 피트니스 업무일지")) {
    fail("fitness archive employee report should render as a submittable report form", JSON.stringify(before));
  }
  await page.click("[data-report-submit-worklog]");
  await page.waitForTimeout(220);
  const after = await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem("beyond-worklog-state-v1") || "{}");
    return {
      submission: stored.worklogReportSubmissions?.["2026-07-24:beyond-fitness-manager"] || null,
      previewText: document.querySelector("#reportArchivePreview")?.textContent || "",
    };
  });
  if (after.submission?.status !== "submitted" || !after.submission?.submittedAt || !after.previewText.includes("제출 완료")) {
    fail("fitness archive employee report submission was not persisted", JSON.stringify(after));
  }
  if (errors.length) fail("fitness archive submission page errors", errors.join(" | "));
  await page.close();
}

async function checkRealDeviceRegressionLayouts(browser) {
  const cases = [
    { view: "attendance", label: "labor" },
    { view: "fitness-log", label: "fitness" },
    { view: "bangju-log", label: "general-worklog" },
  ];

  for (const item of cases) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem("beyond-worklog-state-v1", JSON.stringify({
        selectedDateKey: "2026-07-24",
        selectedEmployeeId: "bangju-finance-manager",
        fitnessWritableEmployeeId: "beyond-fitness-manager",
        profile: {
          email: "j3010@ymail.com",
          role: "대표",
          name: "정찬훈",
          nickname: "베니",
          approvalStatus: "approved",
        },
        employeeLogs: {},
      }));
      localStorage.setItem("beyond-worklog-global-view-mode", "ceo");
    });
    await page.goto(target, { waitUntil: "domcontentloaded" });
    await page.evaluate((targetView) => {
      document.body.classList.add("physical-phone-device");
      document.body.dataset.layoutMode = "phone";
      document.body.dataset.viewMode = "ceo";
      window.switchView?.(targetView);
    }, item.view);
    await page.waitForTimeout(350);

    const metrics = await page.evaluate(() => {
      const rect = (selector) => {
        const node = document.querySelector(selector);
        if (!node) return null;
        const box = node.getBoundingClientRect();
        return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
      };
      const overlaps = (a, b) => Boolean(a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top);
      const fitnessDate = document.querySelector("#fitnessWorklogDate");
      const worklogDate = document.querySelector("#worklogDayTitle");
      const taskPanel = document.querySelector("#view-today .worklog-task-panel");
      const schedulePanel = document.querySelector("#view-today .worklog-schedule-panel");
      const dock = rect(".worklog-view.is-active .section-menu-dock");
      const todayDate = rect("#view-today .worklog-today-title");
      const fitnessCoaching = rect("#view-fitness-log .fitness-coaching-row");
      const fitnessDateButton = rect("#fitnessDateButton");
      const fitnessPrev = rect("#fitnessPrevDateButton");
      const fitnessNext = rect("#fitnessNextDateButton");
      const pager = rect("#fitnessLogPager");
      const ops = rect("#view-fitness-log .fitness-ops-section");
      const fitnessTask = rect("#view-fitness-log .fitness-log-task-panel");
      const fitnessSchedule = rect("#view-fitness-log .fitness-log-schedule-panel");
      const hero = rect("#view-attendance .work-history-hero");
      const laborConsole = rect("#view-attendance .labor-ops-console");
      const futureAttendanceStatus = getAttendanceStatusForLog(
        { id: "qa-future-worker", workHours: "09:00-18:00" },
        {},
        getNextDateKey(todayKey),
        new Date(todayKey + "T10:00:00")
      );
      const laborEmployee = getOwnLaborEmployee();
      const laborArchive = buildLaborArchiveReport(laborEmployee, todayKey);
      const remoteSnapshot = buildRemoteSnapshot();
      return {
        activeView: document.body.dataset.activeView,
        horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
        fitnessDateFits: !fitnessDate || fitnessDate.scrollWidth <= fitnessDate.clientWidth + 2,
        worklogDateFits: !worklogDate || worklogDate.scrollWidth <= worklogDate.clientWidth + 2,
        pagerBeforeOps: !pager || !ops || pager.bottom <= ops.top + 1,
        fitnessOpsBeforePanels: !ops || !fitnessTask || !fitnessSchedule || (ops.bottom <= fitnessTask.top + 1 && fitnessTask.bottom <= fitnessSchedule.top + 1),
        heroBeforeLabor: !hero || !laborConsole || hero.bottom <= laborConsole.top + 2,
        laborPracticeCount: document.querySelectorAll("#view-attendance .labor-practice-card").length,
        laborCloseStepCount: document.querySelectorAll("#view-attendance .labor-close-step").length,
        laborIntegrationCount: document.querySelectorAll("#view-attendance [data-labor-route]").length,
        laborWorkspaceTabCount: document.querySelectorAll("#view-attendance [data-labor-workspace-tab]").length,
        laborWorkspaceSticky: getComputedStyle(document.querySelector("#laborWorkspaceNav") || document.body).position === "sticky",
        laborEmployeeSelector: Boolean(document.querySelector("#laborEmployeeSelect")),
        laborSinglePanel: Boolean(document.querySelector("#view-attendance .labor-ops-console"))
          && !document.querySelector("#view-attendance #laborRegister")
          && !document.querySelector("#view-attendance #payrollStatement"),
        laborHasLegalNote: Boolean(document.querySelector("#view-attendance .labor-legal-note")?.textContent.includes("공인노무사")),
        laborReportOption: Boolean(document.querySelector('#reportArchiveType option[value="labor"]')),
        controlHasLaborKpi: Boolean(document.querySelector("#controlKpiGrid")?.textContent.includes("노무 월 마감")),
        laborArchiveKind: laborArchive.kind,
        laborSnapshotProtectsPayroll: !Object.prototype.hasOwnProperty.call(remoteSnapshot, "laborPayroll") && typeof saveRemoteLaborPayrollDraft === "function",
        laborPayDayConnected: getPayrollPayDate({}, todayKey.slice(0, 7), { payDay: "15" }).endsWith("-15"),
        futureAttendanceStatus,
        dockOverlapsDate: overlaps(dock, todayDate),
        dockOverlapsFitnessCoaching: overlaps(dock, fitnessCoaching),
        fitnessDateNavClear: !fitnessDateButton || (!overlaps(fitnessDateButton, fitnessPrev) && !overlaps(fitnessDateButton, fitnessNext)),
        taskWidth: taskPanel?.getBoundingClientRect().width || 0,
        scheduleWidth: schedulePanel?.getBoundingClientRect().width || 0,
        taskHeaderHeight: rect("#view-today .worklog-task-panel h3")?.height || 0,
        scheduleHeaderHeight: rect("#view-today .worklog-schedule-panel h3")?.height || 0,
      };
    });

    if (metrics.activeView !== item.view) fail("real-device active view mismatch", `${item.label}: ${metrics.activeView}`);
    if (metrics.horizontalOverflow > 2) fail("real-device horizontal overflow", `${item.label}: ${metrics.horizontalOverflow}px`);
    if (!metrics.fitnessDateFits) fail("fitness date is clipped on phone", item.label);
    if (!metrics.worklogDateFits) fail("worklog date is clipped on phone", item.label);
    if (!metrics.pagerBeforeOps) fail("fitness pager overlaps the operations summary", JSON.stringify(metrics));
    if (!metrics.fitnessOpsBeforePanels) fail("fitness operations summary overlaps worklog panels", JSON.stringify(metrics));
    if (!metrics.heroBeforeLabor) fail("labor hero overlaps the operations console", JSON.stringify(metrics));
    if (item.view === "attendance" && (metrics.laborPracticeCount !== 10 || metrics.laborCloseStepCount !== 5 || !metrics.laborHasLegalNote)) {
      fail("labor operations desk should expose ten review domains, five close steps, and a legal review note", JSON.stringify(metrics));
    }
    if (item.view === "attendance" && (metrics.laborIntegrationCount !== 6 || !metrics.laborReportOption || !metrics.controlHasLaborKpi)) {
      fail("labor operations must stay connected to six app sources, report archive, and control tower", JSON.stringify(metrics));
    }
    if (item.view === "attendance" && (metrics.laborWorkspaceTabCount !== 4 || !metrics.laborWorkspaceSticky || !metrics.laborEmployeeSelector || !metrics.laborSinglePanel)) {
      fail("labor workspace must provide a sticky four-tab employee and month navigator with one compact panel", JSON.stringify(metrics));
    }
    if (item.view === "attendance" && (metrics.laborArchiveKind !== "labor" || !metrics.laborSnapshotProtectsPayroll || !metrics.laborPayDayConnected)) {
      fail("labor reports, protected payroll persistence, and employee pay dates must share one data flow", JSON.stringify(metrics));
    }
    if (item.view === "attendance" && metrics.futureAttendanceStatus !== "예정") {
      fail("future attendance rows must remain scheduled instead of becoming absence", JSON.stringify(metrics));
    }
    if (item.view === "attendance") {
      const workspaceFlows = await page.evaluate(() => {
        const previous = {
          tab: state.laborWorkspaceTab,
          site: state.laborSiteScope,
          dateKey: state.selectedDateKey,
        };
        const current = parseDateKey(`${todayKey.slice(0, 7)}-01`);
        current.setMonth(current.getMonth() - 1);
        const pastMonth = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`;
        state.selectedDateKey = `${pastMonth}-01`;
        state.laborWorkspaceTab = "register";
        renderAttendance();
        const archiveReady = document.querySelector("#laborMonthInput")?.value === pastMonth
          && Boolean(document.querySelector("#laborRegister"))
          && !document.querySelector(".labor-ops-console");
        state.laborWorkspaceTab = "sites";
        state.laborSiteScope = "all";
        renderAttendance();
        const siteSummaryCount = document.querySelectorAll(".labor-site-summary-grid [data-labor-site-scope]").length;
        const firstSite = getLaborSiteGroupsForScope()[0]?.id || "";
        state.laborSiteScope = firstSite;
        renderAttendance();
        const employeeCount = document.querySelectorAll("[data-labor-employee]").length;
        const selectedSiteLedgerCount = document.querySelectorAll(".site-labor-ledger").length;
        state.laborWorkspaceTab = previous.tab;
        state.laborSiteScope = previous.site;
        state.selectedDateKey = previous.dateKey;
        renderAttendance();
        return { archiveReady, siteSummaryCount, employeeCount, selectedSiteLedgerCount };
      });
      if (!workspaceFlows.archiveReady || workspaceFlows.siteSummaryCount < 1 || workspaceFlows.employeeCount < 1 || workspaceFlows.selectedSiteLedgerCount > 1) {
        fail("labor workspace monthly archive and site-to-employee drilldown must stay compact and navigable", JSON.stringify(workspaceFlows));
      }
    }
    if (metrics.dockOverlapsDate) fail("worklog menu dock overlaps the date band", JSON.stringify(metrics));
    if (metrics.dockOverlapsFitnessCoaching) fail("fitness menu overlaps the AI coaching band", JSON.stringify(metrics));
    if (!metrics.fitnessDateNavClear) fail("fitness date navigation controls overlap", JSON.stringify(metrics));
    if (metrics.taskWidth && metrics.scheduleWidth) {
      const ratio = metrics.taskWidth / Math.max(1, metrics.scheduleWidth);
      if (ratio < 0.9 || ratio > 1.1) fail("real-device worklog split is not 50:50", `${item.label}: ${ratio}`);
    }
    if (metrics.taskHeaderHeight > 54 || metrics.scheduleHeaderHeight > 54) {
      fail("real-device worklog panel header is too tall", `${item.label}: ${metrics.taskHeaderHeight}/${metrics.scheduleHeaderHeight}`);
    }
    if (errors.length) fail("real-device layout page errors", `${item.label}: ${errors.join(" | ")}`);
    await page.close();
  }
}

async function checkFitnessNewEmployeeRegistrationFlow(browser) {
  const viewports = [
    { width: 390, height: 844, label: "phone" },
    { width: 820, height: 1180, label: "tablet" },
    { width: 1280, height: 820, label: "desktop" },
  ];

  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    const errors = [];
    const dialogs = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("dialog", async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.accept();
    });
    await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2", async (route) => {
      await route.fulfill({
        contentType: "application/javascript",
        body: `
          window.supabase = {
            createClient() {
              return {
                rpc(name, payload) {
                  window.__lastRpc = { name, payload };
                  if (name === "check_registration_email") {
                    return Promise.resolve({ data: { exists: false, profileExists: false, authExists: false }, error: null });
                  }
                  if (name === "repair_profile_approval_queue") {
                    return Promise.resolve({ data: 0, error: null });
                  }
	                  return Promise.resolve({ data: null, error: { message: "unknown rpc " + name } });
                },
                auth: {
                  getSession: () => Promise.resolve({ data: { session: null } }),
                  onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
                  signUp(payload) {
                    window.__signupPayloads.push(payload);
                    return Promise.resolve({
                      data: {
                        user: {
                          id: "new-fitness-user",
                          email: payload.email,
                          raw_user_meta_data: payload.options?.data || {},
                        },
                        session: null,
                      },
                      error: null,
                    });
                  },
                  signInWithPassword: () => Promise.resolve({ data: { session: null }, error: null }),
                  resend: () => Promise.resolve({ data: {}, error: null }),
                  signOut: () => Promise.resolve({ error: null }),
                },
                from() {
                  return {
                    select() { return this; },
                    eq() { return this; },
                    in() { return this; },
                    order() { return this; },
                    limit() { return this; },
                    maybeSingle: () => Promise.resolve({ data: null, error: null }),
                    insert: () => Promise.resolve({ data: null, error: null }),
                    update() { return this; },
                    upsert: () => Promise.resolve({ data: null, error: null }),
                  };
                },
              };
            },
          };
        `,
      });
    });
    await page.addInitScript(() => {
      localStorage.clear();
      window.__signupPayloads = [];
    });
    await page.goto(target, { waitUntil: "domcontentloaded" });
    await page.evaluate((mode) => {
      document.body.classList.toggle("physical-phone-device", mode === "phone");
      document.body.dataset.layoutMode = mode === "phone" ? "phone" : "classic";
      document.body.dataset.viewMode = mode === "phone" ? "ceo" : "classic";
      window.switchView?.("auth");
    }, viewport.label);
    await page.waitForTimeout(250);

    await page.click("#signupButton");
    await page.waitForTimeout(120);
    const initiallyOpened = await page.evaluate(() => ({
      loginHidden: document.querySelector(".login-card")?.hidden,
      sheetVisible: !document.querySelector("#auth-panel-personal")?.hidden,
      emailCheckInLogin: Boolean(document.querySelector(".login-card #emailCheckButton")),
      confirmInLogin: Boolean(document.querySelector(".login-card #authPasswordConfirm")),
      emailCheckInSheet: Boolean(document.querySelector("#auth-panel-personal #emailCheckButton")),
      confirmInSheet: Boolean(document.querySelector("#auth-panel-personal #authPasswordConfirm")),
    }));
    if (!initiallyOpened.loginHidden || !initiallyOpened.sheetVisible) {
      fail("employee registration should open the sheet without login-only checks", `${viewport.label}: ${JSON.stringify(initiallyOpened)}`);
    }
    if (initiallyOpened.emailCheckInLogin || initiallyOpened.confirmInLogin || !initiallyOpened.emailCheckInSheet || !initiallyOpened.confirmInSheet) {
      fail("duplicate email and password confirmation controls should live inside the registration sheet", `${viewport.label}: ${JSON.stringify(initiallyOpened)}`);
    }

    await page.fill("#registrationEmail", "newfitness@example.com");
    await page.fill("#registrationPassword", "beyond3010");
    await page.fill("#authPasswordConfirm", "wrong3010");
    await page.click("#emailCheckButton");
    await page.waitForTimeout(160);
    const emailCheck = await page.evaluate(() => ({
      status: document.querySelector("#emailCheckStatus")?.dataset.status || "",
      text: document.querySelector("#emailCheckStatus")?.textContent?.trim() || "",
      rpc: window.__lastRpc,
    }));
    if (emailCheck.status !== "available" || !emailCheck.text.includes("사용 가능한")) {
      fail("email duplicate check should approve unused email", `${viewport.label}: ${JSON.stringify(emailCheck)}`);
    }
    if (emailCheck.rpc?.name !== "check_registration_email" || emailCheck.rpc?.payload?.email_to_check !== "newfitness@example.com") {
      fail("email duplicate check did not call the expected RPC", `${viewport.label}: ${JSON.stringify(emailCheck.rpc)}`);
    }

    await page.fill('[data-profile-field="name"]', "비욘드신입");
    await page.fill('[data-profile-field="nickname"]', "신입");
    await page.fill('[data-profile-field="phone"]', "01012345678");
    await page.selectOption('[data-registration-org-select]', "(주)비욘드컴퍼니");
    await page.waitForTimeout(80);
    const workplaceOptions = await page.evaluate(() => [...document.querySelectorAll('[data-registration-workplace-select] option')].map((option) => option.value));
    if (!workplaceOptions.includes("비욘드 피트니스") || !workplaceOptions.includes("TBA studio")) {
      fail("Beyond Company workplace options are incomplete", `${viewport.label}: ${workplaceOptions.join(",")}`);
    }
    await page.selectOption('[data-registration-workplace-select]', "비욘드 피트니스");
    await page.fill('[data-profile-field="workHours"]', "16:00-20:00");
    await page.fill('[data-profile-field="laborId"]', "900101");
    await page.fill('[data-profile-field="address"]', "울산 남구");
    await page.fill('[data-profile-work-hours-day="mon"]', "16:00-20:00");
    await page.fill('[data-profile-work-hours-day="tue"]', "16:00-20:00");

    await page.click("#saveProfileButton");
    await page.waitForTimeout(120);
    if (!dialogs.some((message) => message.includes("비밀번호 확인이 일치하지 않습니다"))) {
      fail("registration should block mismatched passwords", viewport.label);
    }

    await page.fill("#authPasswordConfirm", "beyond3010");
    const opened = await page.evaluate(() => ({
      authTabs: document.querySelectorAll(".auth-tabs[data-auth-registration]").length,
      roleField: Boolean(document.querySelector('[data-profile-field="role"]')),
      employmentField: Boolean(document.querySelector('[data-profile-field="employmentType"]')),
      primaryWorkField: Boolean(document.querySelector('[data-profile-field="primaryWork"]')),
      wageField: Boolean(document.querySelector('[data-profile-field="hourlyWage"], [data-profile-field="dailyWage"]')),
    }));
    if (opened.authTabs || opened.roleField || opened.employmentField || opened.primaryWorkField || opened.wageField) {
      fail("employee registration sheet still exposes approver-only fields", `${viewport.label}: ${JSON.stringify(opened)}`);
    }

    await page.click("#saveProfileButton");
    await page.waitForTimeout(200);

    const submitted = await page.evaluate(() => {
      const payload = window.__signupPayloads?.[0] || {};
      return {
        payload,
        sheetHidden: document.querySelector("#auth-panel-personal")?.hidden,
        loginHidden: document.querySelector(".login-card")?.hidden,
        savedState: JSON.parse(localStorage.getItem("beyond-worklog-state-v1") || "{}"),
      };
    });
    const metadata = submitted.payload.options?.data || {};
    if (submitted.payload.email !== "newfitness@example.com") fail("signup email mismatch", `${viewport.label}: ${submitted.payload.email}`);
    if (metadata.name !== "비욘드신입" || metadata.phone !== "010-1234-5678") {
      fail("signup metadata should contain normalized personal info", `${viewport.label}: ${JSON.stringify(metadata)}`);
    }
    if (metadata.org !== "(주)비욘드컴퍼니" || metadata.workplace !== "비욘드 피트니스" || metadata.workHours !== "16:00-20:00") {
      fail("signup metadata should contain fitness placement", `${viewport.label}: ${JSON.stringify(metadata)}`);
    }
    if (metadata.role !== "직원" || metadata.primaryWork !== "" || metadata.secondaryWork !== "" || metadata.employmentType !== "직원" || metadata.hourlyWage !== "" || metadata.dailyWage !== "") {
      fail("signup metadata should leave approver-only fields for approval", `${viewport.label}: ${JSON.stringify(metadata)}`);
    }
    if (metadata.weeklyWorkHours?.mon !== "16:00-20:00" || metadata.weeklyWorkHours?.tue !== "16:00-20:00") {
      fail("weekly work hours were not submitted", `${viewport.label}: ${JSON.stringify(metadata.weeklyWorkHours)}`);
    }
    if (!submitted.sheetHidden || submitted.loginHidden) {
      fail("successful registration should close the sheet and return to the account card", `${viewport.label}: ${JSON.stringify(submitted)}`);
    }
    if (errors.length) fail("fitness registration flow page errors", `${viewport.label}: ${errors.join(" | ")}`);
    await page.close();
  }
}

async function checkSiteWeatherAndGeneralDailyReport(browser) {
  const { page, errors } = await openPage(browser, { width: 390, height: 844 });
  await page.evaluate(() => {
    const employee = employees.find((item) => item.id === "bangju-finance-manager") || employees.find((item) => !/피트니스/i.test(`${item.org} ${item.workplace}`));
    state.profile = { ...state.profile, approvalStatus: "approved", accessPreset: "owner", role: "대표" };
    state.selectedEmployeeId = employee.id;
    state.selectedDateKey = todayKey;
    switchView("bangju-log");
    const selectedEmployee = getSelectedEmployee();
    const log = getEmployeeLogForDate(selectedEmployee.id, todayKey);
    log.clockIn = "08:00";
    log.clockOut = "18:00";
    log.tasks[0] = { priority: "A", text: "월 마감 자료 검토", status: "완료", done: true };
    log.tasks[1] = { priority: "B", text: "거래처 증빙 대조", status: "진행", done: false };
    log.schedule[0] = { time: "08:00", text: "재무 자료 취합", status: "완료" };
    log.schedule[1] = { time: "09:00", text: "세금계산서 원장 대조", status: "진행" };
    log.report = "월 마감 자료 검토와 증빙 취합을 완료했습니다.";
    log.record = "회계 원장 실행기록을 저장했습니다.";
    log.memo = "명일 거래처 확인이 필요합니다.";
    const siteKey = getSiteWeatherKeyForEmployee(selectedEmployee);
    state.siteWeatherAddresses[siteKey] = "울산광역시 남구";
    state.weatherCache[getWeatherCacheKey(siteKey, todayKey)] = {
      siteKey,
      dateKey: todayKey,
      condition: "맑음",
      temperature: 27,
      temperatureMin: 23,
      temperatureMax: 30,
      humidity: 61,
      fetchedAt: new Date().toISOString(),
    };
    renderEntries();
  });
  await page.click("#worklogReportMenuButton");
  await page.waitForTimeout(220);
  const metrics = await page.evaluate(() => {
    const sheet = document.querySelector("#worklogReportSheet");
    const preview = document.querySelector("#worklogReportPreview");
    const employee = getSelectedEmployee();
    const archive = buildEmployeeArchiveReport(employee, todayKey);
    const pastUrl = buildWeatherRequestUrl({ latitude: 35.5, longitude: 129.3 }, "2026-07-31");
    const futureUrl = buildWeatherRequestUrl({ latitude: 35.5, longitude: 129.3 }, "2026-08-31");
    const todayUrl = buildWeatherRequestUrl({ latitude: 35.5, longitude: 129.3 }, todayKey);
    const weatherExpression = formatWeatherSummary({ weatherCode: 2, temperatureMin: 21, temperatureMax: 29 }, { compact: true });
    const rainAdvice = buildWeatherAdvice({ weatherCode: 61, condition: "비", precipitation: 1 });
    const freshWeather = isWeatherRecordFresh({ fetchedAt: new Date().toISOString() });
    const staleWeather = isWeatherRecordFresh({ fetchedAt: new Date(Date.now() - weatherFreshnessMs - 1000).toISOString() });
    const snapshot = buildRemoteSnapshot();
    const retryKey = getWeatherCacheKey(getSiteWeatherKeyForEmployee(employee), todayKey);
    const savedWeather = state.weatherCache[retryKey];
    delete state.weatherCache[retryKey];
    markWeatherRequestFailure(retryKey, new Error("QA weather delay"));
    renderWeatherDateButton(document.querySelector("#todayJumpButton"), employee, todayKey);
    const weatherRetryState = {
      status: document.querySelector("#todayJumpButton")?.dataset.weatherStatus || "",
      text: document.querySelector("#todayJumpButton")?.textContent?.replace(/\s+/g, "").trim() || "",
      blocked: !canAutomaticallyRequestWeather(retryKey),
      helperReady: typeof fetchWeatherJson === "function",
    };
    clearWeatherRequestFailure(retryKey);
    state.weatherCache[retryKey] = savedWeather;
    renderWeatherDateButton(document.querySelector("#todayJumpButton"), employee, todayKey);
    return {
      sheetOpen: !sheet.hidden && sheet.classList.contains("is-open"),
      previewText: preview.textContent || "",
      previewOverflow: preview.scrollHeight - preview.clientHeight,
      archiveHasDesignedReport: archive.html.includes("worklog-daily-report-page"),
      pastUsesArchive: pastUrl.includes("archive-api.open-meteo.com") && pastUrl.includes("start_date=2026-07-31"),
      futureUsesForecast: pastUrl !== futureUrl && futureUrl.includes("api.open-meteo.com/v1/forecast") && futureUrl.includes("start_date=2026-08-31"),
      todayUsesBeyondWeatherRange: todayUrl.includes("daily=temperature_2m_max,temperature_2m_min") && todayUrl.includes("forecast_days=1"),
      weatherExpression,
      rainAdvice,
      freshWeather,
      staleWeather,
      weatherRetryState,
      todayWeatherButtonText: document.querySelector("#todayJumpButton")?.textContent?.replace(/\s+/g, "").trim() || "",
      todayWeatherButtonActive: document.querySelector("#todayJumpButton")?.classList.contains("is-weather-today") || false,
      todayWeatherButtonDisabled: document.querySelector("#todayJumpButton")?.disabled || false,
      todayWeatherButtonLayout: (() => {
        const button = document.querySelector("#todayJumpButton");
        const icon = button?.querySelector("i");
        const range = button?.querySelector("small");
        const iconRect = icon?.getBoundingClientRect();
        const rangeRect = range?.getBoundingClientRect();
        return {
          display: button ? getComputedStyle(button).display : "",
          icon: icon?.textContent?.trim() || "",
          range: range?.textContent?.trim() || "",
          iconSize: icon ? Number.parseFloat(getComputedStyle(icon).fontSize) : 0,
          singleLine: Boolean(iconRect && rangeRect && Math.abs((iconRect.top + iconRect.bottom) / 2 - (rangeRect.top + rangeRect.bottom) / 2) <= 3),
          width: button?.getBoundingClientRect().width || 0,
        };
      })(),
      standaloneWeatherRowsHidden: ["worklogWeatherRow", "fitnessWeatherRow"].every((id) => getComputedStyle(document.getElementById(id)).display === "none"),
      snapshotHasWeather: Boolean(snapshot.siteWeatherAddresses && snapshot.weatherCache),
      fitnessReportPreserved: Boolean(document.querySelector("#fitnessReportMenuButton") && document.querySelector("#fitnessReportSheet")),
      exportButtons: ["worklogReportImageButton", "worklogReportPdfButton", "worklogReportShareButton", "worklogReportPrintButton"]
        .every((id) => Boolean(document.getElementById(id))),
      reportPrintIsolated: typeof printReportCanvas === "function"
        && !String(printWorklogDailyReport).includes("window.print")
        && !String(printFitnessReport).includes("window.print"),
    };
  });
  const exportMetrics = await page.evaluate(async () => {
    const canvas = await renderWorklogReportCanvas();
    const jpeg = await canvasToBlob(canvas, "image/jpeg", 0.94);
    const pdf = createPdfBlobFromCanvas(canvas);
    return { width: canvas.width, height: canvas.height, jpegSize: jpeg.size, jpegType: jpeg.type, pdfSize: pdf.size, pdfType: pdf.type };
  });
  const dateWeatherMetrics = await page.evaluate(() => {
    const employee = getSelectedEmployee();
    const siteKey = getSiteWeatherKeyForEmployee(employee);
    state.selectedDateKey = "2026-07-31";
    state.weatherCache[getWeatherCacheKey(siteKey, state.selectedDateKey)] = {
      siteKey,
      dateKey: state.selectedDateKey,
      location: "울산 남구",
      condition: "비",
      weatherCode: 61,
      temperatureMin: 22,
      temperatureMax: 27,
      precipitation: 3,
      fetchedAt: new Date().toISOString(),
    };
    renderEntries();
    const past = {
      todayText: document.getElementById("todayJumpButton")?.textContent?.trim() || "",
      todayDisabled: document.getElementById("todayJumpButton")?.disabled || false,
      worklogHistorical: document.getElementById("worklogPulse")?.classList.contains("is-historical-weather") || false,
      worklogWeatherText: document.getElementById("worklogPulseText")?.textContent?.replace(/\s+/g, " ").trim() || "",
      fitnessHistorical: document.getElementById("fitnessCoachingTicker")?.classList.contains("is-historical-weather") || false,
    };
    state.selectedDateKey = "2026-08-31";
    renderEntries();
    const future = {
      todayText: document.getElementById("todayJumpButton")?.textContent?.trim() || "",
      todayDisabled: document.getElementById("todayJumpButton")?.disabled || false,
      worklogHistorical: document.getElementById("worklogPulse")?.classList.contains("is-historical-weather") || false,
      fitnessHistorical: document.getElementById("fitnessCoachingTicker")?.classList.contains("is-historical-weather") || false,
    };
    return { past, future };
  });
  ["업무 진행 현황", "시간대별 실행 내역", "이슈·리스크·지원 요청", "명일 계획·인수인계", "Bangju Action Brief", "맑음", "월 마감 자료 검토", "거래처 증빙 대조", "재무 자료 취합", "세금계산서 원장 대조", "회계 원장 실행기록을 저장했습니다.", "명일 거래처 확인이 필요합니다."].forEach((label) => {
    if (!metrics.previewText.includes(label)) fail("general daily report should include corporate and Bangju report sections", `${label} missing`);
  });
  if (!metrics.sheetOpen || metrics.previewOverflow < 0) fail("general daily report sheet should open and remain scrollable", JSON.stringify(metrics));
  if (!metrics.archiveHasDesignedReport || !metrics.pastUsesArchive || !metrics.futureUsesForecast || !metrics.snapshotHasWeather || !metrics.fitnessReportPreserved || !metrics.exportButtons || !metrics.reportPrintIsolated) {
    fail("site weather and general report data flow should remain connected without changing fitness report", JSON.stringify(metrics));
  }
  if (!metrics.todayUsesBeyondWeatherRange || metrics.weatherExpression !== "구름 조금 · 21°/29°" || !metrics.rainAdvice.includes("10~15분") || !metrics.freshWeather || metrics.staleWeather) {
    fail("weather should mirror Beyond Work range, advice, and two-hour refresh logic", JSON.stringify(metrics));
  }
  if (metrics.weatherRetryState.status !== "retry" || metrics.weatherRetryState.text !== "↻재시도"
    || !metrics.weatherRetryState.blocked || !metrics.weatherRetryState.helperReady) {
    fail("weather failures should render a retry state and pause repeated requests", JSON.stringify(metrics.weatherRetryState));
  }
  if (!metrics.todayWeatherButtonActive || !metrics.todayWeatherButtonDisabled || !metrics.todayWeatherButtonText.includes("☀️") || !metrics.todayWeatherButtonText.includes("23°/30°") || !metrics.standaloneWeatherRowsHidden) {
    fail("today date row should replace the Today button with compact weather", JSON.stringify(metrics));
  }
  if (metrics.todayWeatherButtonLayout.display !== "flex"
    || metrics.todayWeatherButtonLayout.icon !== "☀️"
    || metrics.todayWeatherButtonLayout.range !== "23°/30°"
    || metrics.todayWeatherButtonLayout.iconSize < 14
    || !metrics.todayWeatherButtonLayout.singleLine
    || metrics.todayWeatherButtonLayout.width > 96) {
    fail("today weather should use a compact one-line icon and low/high layout", JSON.stringify(metrics.todayWeatherButtonLayout));
  }
  if (dateWeatherMetrics.past.todayText !== "오늘" || dateWeatherMetrics.past.todayDisabled || !dateWeatherMetrics.past.worklogHistorical || !dateWeatherMetrics.past.fitnessHistorical || !dateWeatherMetrics.past.worklogWeatherText.includes("비 · 22°/27°")) {
    fail("past date should keep the Today return button and replace coaching with recorded weather", JSON.stringify(dateWeatherMetrics));
  }
  if (dateWeatherMetrics.future.todayText !== "오늘" || dateWeatherMetrics.future.todayDisabled || dateWeatherMetrics.future.worklogHistorical || dateWeatherMetrics.future.fitnessHistorical) {
    fail("future date should keep the Today return button and regular coaching", JSON.stringify(dateWeatherMetrics));
  }
  if (exportMetrics.width !== 1240 || exportMetrics.height < 1754 || exportMetrics.jpegSize < 10000 || exportMetrics.jpegType !== "image/jpeg" || exportMetrics.pdfSize < 10000 || exportMetrics.pdfType !== "application/pdf") {
    fail("general worklog report should export valid JPEG and PDF artifacts", JSON.stringify(exportMetrics));
  }
  if (errors.length) fail("site weather and general report page errors", errors.join(" | "));
  await page.close();
}

async function checkApprovalRepairRevealsPendingFitnessSignup(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2", async (route) => {
    await route.fulfill({
      contentType: "application/javascript",
      body: `
        (() => {
          const ownerRow = {
            id: "owner-user",
            email: "j3010@ymail.com",
            name: "정찬훈",
            nickname: "Benny",
            org: "(주)방주",
            workplace: "본사",
            role: "대표",
            primary_work: "기획/관리",
            work_hours: "08:00-18:00",
            employment_type: "관리자",
            approval_status: "approved",
            updated_at: "2026-07-30T00:00:00.000Z"
          };
          const hongTrainerRow = {
            id: "hong-trainer-user",
            email: "gusrd1005@gmail.com",
            name: "홍현규",
            nickname: "현규",
            org: "(주)비욘드컴퍼니",
            workplace: "비욘드 피트니스",
            role: "직원",
            primary_work: "",
            secondary_work: "",
            work_hours: "06:00-24:00",
            employment_type: "직원",
            approval_status: "pending",
            updated_at: "2026-07-30T00:02:00.000Z"
          };
          let repaired = false;
          window.__approvalRepairCalls = 0;
          window.supabase = {
            createClient() {
              return {
                rpc(name) {
                  if (name === "repair_profile_approval_queue") {
                    repaired = true;
                    window.__approvalRepairCalls += 1;
                    return Promise.resolve({ data: 1, error: null });
                  }
                  return Promise.resolve({ data: null, error: { message: "unknown rpc " + name } });
                },
                auth: {
                  getSession: () => Promise.resolve({ data: { session: null } }),
                  onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
                  signOut: () => Promise.resolve({ error: null }),
                },
                from(table) {
                  const chain = {
                    select() { return this; },
                    eq() { return this; },
                    in() { return this; },
                    order() {
                      if (table === "profiles") return Promise.resolve({ data: repaired ? [hongTrainerRow, ownerRow] : [ownerRow], error: null });
                      return Promise.resolve({ data: [], error: null });
                    },
                    update() { return this; },
                    maybeSingle: () => Promise.resolve({ data: null, error: null }),
                    insert: () => Promise.resolve({ data: null, error: null }),
                    upsert: () => Promise.resolve({ data: null, error: null }),
                  };
                  return chain;
                },
              };
            },
          };
        })();
      `,
    });
  });
  await page.addInitScript(() => localStorage.clear());
  await page.goto(target, { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => {
    await window.eval(`(async () => {
      authState.user = { id: "owner-user", email: "j3010@ymail.com" };
      authState.approvalRows = [];
      authState.approvalRowsLoaded = false;
      authState.approvalRepairTried = false;
      authState.selectedApprovalId = "";
      state.profile = {
        ...state.profile,
        email: "j3010@ymail.com",
        name: "정찬훈",
        nickname: "Benny",
        org: "(주)방주",
        workplace: "본사",
        role: "대표",
        primaryWork: "기획/관리",
        approvalStatus: "approved",
        accessPreset: "owner",
        permissions: {}
      };
      switchView("settings");
      switchSettingsTab("approval");
      await loadApprovalRequests({ repair: true, manual: true });
    })()`);
  });
  await page.waitForTimeout(200);
  const metrics = await page.evaluate(() => ({
    repairCalls: window.__approvalRepairCalls || 0,
    pendingCount: document.querySelector(".approval-queue-group[data-status='pending'] header span")?.textContent?.trim() || "",
    hasHong: document.querySelector("#approvalRequestList")?.textContent?.includes("홍현규") || false,
    hasFitness: document.querySelector("#approvalRequestList")?.textContent?.includes("비욘드 피트니스") || false,
    selectedTitle: document.querySelector(".approval-request-title")?.textContent?.replace(/\s+/g, " ").trim() || "",
    actionCount: document.querySelector("[data-status='action'] strong")?.textContent?.trim() || "",
  }));
  if (metrics.repairCalls < 1) fail("approval queue should run repair before fetching pending signups", JSON.stringify(metrics));
  if (!metrics.hasHong || !metrics.hasFitness || metrics.actionCount !== "1") {
    fail("approval queue should reveal pending fitness signup after repair", JSON.stringify(metrics));
  }
  if (!metrics.selectedTitle.includes("홍현규")) {
    fail("pending fitness signup should be selected for representative review", JSON.stringify(metrics));
  }
  if (errors.length) fail("approval repair queue page errors", errors.join(" | "));
  await page.close();
}

async function checkApprovalRepairMissingRpcFallsBack(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2", async (route) => {
    await route.fulfill({
      contentType: "application/javascript",
      body: `
        (() => {
          const ownerRow = {
            id: "owner-user",
            email: "j3010@ymail.com",
            name: "정찬훈",
            nickname: "Benny",
            org: "(주)방주",
            workplace: "본사",
            role: "대표",
            primary_work: "기획/관리",
            work_hours: "08:00-18:00",
            employment_type: "관리자",
            approval_status: "approved",
            updated_at: "2026-07-30T00:00:00.000Z"
          };
          const pendingRow = {
            id: "pending-user",
            email: "fallback@example.com",
            name: "대기직원",
            nickname: "대기",
            org: "(주)비욘드컴퍼니",
            workplace: "비욘드 피트니스",
            role: "직원",
            primary_work: "",
            secondary_work: "",
            work_hours: "16:00-20:00",
            employment_type: "직원",
            approval_status: "pending",
            updated_at: "2026-07-30T00:02:00.000Z"
          };
          window.__approvalRepairCalls = 0;
          window.supabase = {
            createClient() {
              return {
                rpc(name) {
                  if (name === "repair_profile_approval_queue") {
                    window.__approvalRepairCalls += 1;
                    return Promise.resolve({
                      data: null,
                      error: {
                        code: "PGRST202",
                        message: "Could not find the function public.repair_profile_approval_queue without parameters in the schema cache"
                      }
                    });
                  }
                  return Promise.resolve({ data: null, error: { message: "unknown rpc " + name } });
                },
                auth: {
                  getSession: () => Promise.resolve({ data: { session: null } }),
                  onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
                  signOut: () => Promise.resolve({ error: null }),
                },
                from(table) {
                  const chain = {
                    select() { return this; },
                    eq() { return this; },
                    in() { return this; },
                    order() {
                      if (table === "profiles") return Promise.resolve({ data: [pendingRow, ownerRow], error: null });
                      return Promise.resolve({ data: [], error: null });
                    },
                    update() { return this; },
                    maybeSingle: () => Promise.resolve({ data: null, error: null }),
                    insert: () => Promise.resolve({ data: null, error: null }),
                    upsert: () => Promise.resolve({ data: null, error: null }),
                  };
                  return chain;
                },
              };
            },
          };
        })();
      `,
    });
  });
  await page.addInitScript(() => localStorage.clear());
  await page.goto(target, { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => {
    await window.eval(`(async () => {
      authState.user = { id: "owner-user", email: "j3010@ymail.com" };
      authState.approvalRows = [];
      authState.approvalRowsLoaded = false;
      authState.approvalRepairTried = false;
      authState.approvalRepairUnavailable = false;
      authState.selectedApprovalId = "";
      state.profile = {
        ...state.profile,
        email: "j3010@ymail.com",
        name: "정찬훈",
        nickname: "Benny",
        org: "(주)방주",
        workplace: "본사",
        role: "대표",
        primaryWork: "기획/관리",
        approvalStatus: "approved",
        accessPreset: "owner",
        permissions: {}
      };
      switchView("settings");
      switchSettingsTab("approval");
      await loadApprovalRequests({ repair: true, manual: true });
    })()`);
  });
  await page.waitForTimeout(200);
  const metrics = await page.evaluate(() => ({
    repairCalls: window.__approvalRepairCalls || 0,
    hasFallbackEmployee: document.querySelector("#approvalRequestList")?.textContent?.includes("대기직원") || false,
    actionCount: document.querySelector("[data-status='action'] strong")?.textContent?.trim() || "",
    toast: document.querySelector("#appToast")?.textContent?.trim() || "",
  }));
  if (metrics.repairCalls < 1) fail("missing approval repair rpc should be attempted once", JSON.stringify(metrics));
  if (!metrics.hasFallbackEmployee || metrics.actionCount !== "1") {
    fail("missing approval repair rpc should fall back to visible approval rows", JSON.stringify(metrics));
  }
  if (/승인요청 동기화 실패|schema cache|repair_profile_approval_queue/i.test(metrics.toast)) {
    fail("missing approval repair rpc should not show a scary sync failure toast", JSON.stringify(metrics));
  }
  if (errors.length) fail("missing approval repair rpc fallback page errors", errors.join(" | "));
  await page.close();
}

async function checkDagymPreviousDayGuidanceFlow(browser) {
  const { page, errors } = await openPage(browser, { width: 390, height: 844 });
  await page.evaluate(() => {
    window.eval(`
      authState.user = { id: "owner-guidance-qa", email: "j3010@ymail.com" };
      state.profile = {
        ...state.profile,
        authUserId: "owner-guidance-qa",
        email: "j3010@ymail.com",
        name: "정찬훈",
        nickname: "Benny",
        org: "(주)방주",
        workplace: "본사",
        role: "대표",
        primaryWork: "기획/관리",
        approvalStatus: "approved",
        accessPreset: "owner",
        permissions: { controlTower: true, worklogAll: true }
      };
      state.selectedDateKey = "2026-08-05";
      state.fitnessLogPage = 0;
      state.fitnessLogPageId = "fitness-center";
      state.fitnessDailyGuidance = {};
      state.dagymDaily = {
        "2026-08-04": {
          ...createDagymDailyRecord("2026-08-04"),
          visits: "120",
          newMembers: "0",
          renewals: "1",
          expiring: "6",
          ptBookings: "8",
          noShows: "2",
          lockerExpiring: "3",
          sales: "450000",
          status: "closed",
          closedAt: "2026-08-04T21:00:00.000Z",
          updatedAt: "2026-08-04T21:00:00.000Z"
        }
      };
      normalizeState();
      switchView("fitness-log");
    `);
  });
  await page.waitForTimeout(250);
  const representative = await page.evaluate(() => {
    const panel = document.querySelector("#fitnessDailyGuidancePanel");
    return {
      hidden: panel?.hidden ?? true,
      source: document.querySelector("#fitnessDailyGuidanceSubtitle")?.textContent?.trim() || "",
      count: panel?.querySelectorAll(".fitness-guidance-item").length || 0,
      accepts: panel?.querySelectorAll("[data-accept-fitness-guidance]").length || 0,
      fits: !panel || panel.scrollWidth <= panel.clientWidth + 2,
      stored: JSON.parse(localStorage.getItem("beyond-worklog-state-v1") || "{}").fitnessDailyGuidance?.["2026-08-05"]?.length || 0,
    };
  });
  if (representative.hidden || representative.count < 4 || representative.stored !== representative.count) {
    fail("closed previous-day DaGym facts should generate today's guidance", JSON.stringify(representative));
  }
  if (!representative.source.includes("08.04") || representative.accepts || !representative.fits) {
    fail("representative guidance must show source, remain read-only, and fit phone width", JSON.stringify(representative));
  }

  await page.evaluate(() => {
    window.eval(`
      authState.user = { id: "trainer-guidance-qa", email: "gusrd1005@gmail.com" };
      state.profile = {
        ...state.profile,
        authUserId: "trainer-guidance-qa",
        email: "gusrd1005@gmail.com",
        name: "홍현규",
        nickname: "홍현규",
        org: "비욘드 피트니스",
        workplace: "비욘드 피트니스",
        role: "트레이너",
        primaryWork: "PT 회원관리",
        approvalStatus: "approved",
        accessPreset: "employee",
        permissions: {}
      };
      state.fitnessWritableEmployeeId = "fitness-trainer-1";
      state.selectedEmployeeId = "fitness-trainer-1";
      normalizeState();
      const trainerPage = getFitnessLogPages().findIndex((entry) => entry.id === "fitness-trainer-1");
      state.fitnessLogPage = trainerPage;
      renderAll();
    `);
  });
  await page.waitForTimeout(180);
  const acceptButton = page.locator("[data-accept-fitness-guidance]").first();
  if (await acceptButton.count() !== 1) fail("assigned trainer should see one-click guidance acceptance");
  await acceptButton.click();
  await page.waitForTimeout(150);
  const employee = await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem("beyond-worklog-state-v1") || "{}");
    const tasks = stored.employeeLogs?.["2026-08-05"]?.["fitness-trainer-1"]?.tasks || [];
    const guidance = stored.fitnessDailyGuidance?.["2026-08-05"] || [];
    return {
      linkedTask: tasks.find((task) => task.guidanceId) || null,
      accepted: guidance.find((item) => item.targetEmployeeId === "fitness-trainer-1")?.status || "",
      panelFits: document.querySelector("#fitnessDailyGuidancePanel")?.scrollWidth <= document.querySelector("#fitnessDailyGuidancePanel")?.clientWidth + 2,
    };
  });
  if (!employee.linkedTask?.text?.startsWith("[전일 다짐]") || employee.accepted !== "accepted" || !employee.panelFits) {
    fail("accepted guidance should become the employee's linked priority task", JSON.stringify(employee));
  }
  if (errors.length) fail("DaGym guidance page errors", errors.join(" | "));
  await page.close();
}

async function checkFitnessRosterHoursAndCompactTotals(browser) {
  const { page, errors } = await openPage(browser, { width: 390, height: 844 });
  await page.evaluate(() => {
    window.eval(`
      authState.user = { id: "fitness-hours-qa", email: "pjhong0@naver.com" };
      state.profile = {
        ...state.profile,
        authUserId: "fitness-hours-qa",
        email: "pjhong0@naver.com",
        name: "박주홍",
        nickname: "센터장",
        org: "(주)방주 / 비욘드 피트니스 지사",
        workplace: "비욘드 피트니스",
        role: "센터장",
        primaryWork: "운영총괄, PT 수업",
        workHours: "06:00-24:00",
        approvalStatus: "approved",
        accessPreset: "employee",
        permissions: {}
      };
      state.selectedDateKey = "2026-08-04";
      state.fitnessWritableEmployeeId = "beyond-fitness-manager";
      state.selectedEmployeeId = "beyond-fitness-manager";
      const manager = employees.find((item) => item.id === "beyond-fitness-manager");
      const kim = employees.find((item) => item.id === "fitness-info-kimyoungchae");
      const ida = employees.find((item) => item.id === "fitness-weekday-info-idabin");
      const priorManager = createEmployeeLog(manager, state.profile, "2026-08-03");
      priorManager.fitnessOps.ptRegular = "10";
      priorManager.fitnessOpsManual.ptRegular = true;
      const todayManager = createEmployeeLog(manager, state.profile, "2026-08-04");
      todayManager.employeeId = "fitness-trainer-1";
      todayManager.scheduleUnit = "30";
      todayManager.fitnessOps.ptRegular = "3";
      todayManager.fitnessOpsManual.ptRegular = true;
      const wrongKim = createEmployeeLog(manager, state.profile, "2026-08-04");
      wrongKim.employeeId = "beyond-fitness-manager";
      wrongKim.scheduleUnit = "30";
      const wrongIda = createEmployeeLog(manager, state.profile, "2026-08-04");
      wrongIda.employeeId = "beyond-fitness-manager";
      wrongIda.scheduleUnit = "30";
      state.employeeLogs = {
        "2026-08-03": { "beyond-fitness-manager": priorManager },
        "2026-08-04": {
          "beyond-fitness-manager": todayManager,
          "fitness-info-kimyoungchae": wrongKim,
          "fitness-weekday-info-idabin": wrongIda
        }
      };
      state.fitnessScheduleUnitDefaultApplied = true;
      normalizeState();
      const managerLog = getFitnessEmployeeLogForDate(manager, "2026-08-04");
      const kimLog = getFitnessEmployeeLogForDate(kim, "2026-08-04");
      const idaLog = getFitnessEmployeeLogForDate(ida, "2026-08-04");
      window.__fitnessRosterHoursQA = {
        manager: { id: managerLog.employeeId, unit: managerLog.scheduleUnit, times: managerLog.schedule.map((entry) => entry.time) },
        kim: { id: kimLog.employeeId, unit: kimLog.scheduleUnit, times: kimLog.schedule.map((entry) => entry.time) },
        ida: { id: idaLog.employeeId, unit: idaLog.scheduleUnit, times: idaLog.schedule.map((entry) => entry.time) }
      };
      state.fitnessLogPage = getFitnessLogPages().findIndex((entry) => entry.id === "beyond-fitness-manager");
      switchView("fitness-log");
    `);
  });
  await page.waitForTimeout(220);
  const metrics = await page.evaluate(() => ({
    schedules: window.__fitnessRosterHoursQA,
    summaryValues: [...document.querySelectorAll("#fitnessOpsSummaryButton .ops-summary-metric strong")].map((node) => node.textContent.trim()),
    monthlyPanelHidden: document.querySelector("#fitnessPersonalMonthSummary")?.hidden ?? false,
    summaryFits: document.querySelector("#fitnessOpsSummaryButton")?.scrollWidth <= document.querySelector("#fitnessOpsSummaryButton")?.clientWidth + 2,
  }));
  const expected = [
    ["manager", "beyond-fitness-manager", "06:00", "24:00", 19],
    ["kim", "fitness-info-kimyoungchae", "10:00", "18:00", 9],
    ["ida", "fitness-weekday-info-idabin", "16:00", "20:00", 5],
  ];
  expected.forEach(([key, id, first, last, count]) => {
    const item = metrics.schedules?.[key];
    if (item?.id !== id || item?.unit !== "60" || item?.times?.[0] !== first || item?.times?.at(-1) !== last || item?.times?.length !== count) {
      fail("fitness schedule should follow each employee's roster hours", `${key}: ${JSON.stringify(item)}`);
    }
  });
  if (metrics.summaryValues[0] !== "3/13" || !metrics.monthlyPanelHidden || !metrics.summaryFits) {
    fail("fitness totals should use compact today/month notation without another panel", JSON.stringify(metrics));
  }
  if (errors.length) fail("fitness roster hours page errors", errors.join(" | "));
  await page.close();
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(localChrome ? { executablePath: localChrome } : {}),
  });
  try {
    await checkTabletRepresentativeWorklogChrome(browser);
    await checkDesktopEmployeeWorklog(browser);
    await checkPhoneWorklog(browser);
    await checkExplicitWorklogExpandOutsidePhoneMode(browser);
    await checkOverviewCommandBoard(browser);
    await checkControlTower(browser);
    await checkExecutiveManagementPage(browser);
    await checkAiMissionArchitect(browser);
    await checkPremiumOperatingSystem(browser);
    await checkSectionAiWorklogActions(browser);
    await checkSectionChromeReleasePolish(browser);
    await checkReportArchiveVault(browser);
    await checkFitnessCenterReportConfirmation(browser);
    await checkReportArchiveFitnessSubmission(browser);
    await checkSiteWeatherAndGeneralDailyReport(browser);
    await checkRealDeviceRegressionLayouts(browser);
    await checkFitnessNewEmployeeRegistrationFlow(browser);
    await checkApprovalRepairRevealsPendingFitnessSignup(browser);
    await checkApprovalRepairMissingRpcFallsBack(browser);
    await checkDagymPreviousDayGuidanceFlow(browser);
    await checkFitnessRosterHoursAndCompactTotals(browser);
    await checkRepresentativeProfileSeparation(browser);
    await checkNonControlRoleTextDoesNotBecomeRepresentative(browser);
    await checkDelegatedPermissionMenus(browser);
    await checkKimSungminAccountIsEmployeeOnly(browser);
    await checkUnmappedEmployeeDoesNotInheritFitnessManager(browser);
    await checkUnclassifiedFitnessEmployeeCanEditOwnProfileWorklog(browser);
    await checkFitnessTrainerCanEditOwnWorklog(browser);
    await checkFitnessManagerCanEditOwnWorklog(browser);
    await checkApprovedEmployeeWorklogEditMatrix(browser);
    await checkPriorityCarryoverAndDateRules(browser);
    await checkStaffDirectoryListAndDetail(browser);
    await checkCalendarAnnotations(browser);
  } finally {
    await browser.close();
  }
  console.log("Visual smoke passed");
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

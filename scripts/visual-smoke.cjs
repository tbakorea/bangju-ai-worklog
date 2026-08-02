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

async function checkDesktopEmployeeWorklog(browser) {
  const { page, errors } = await openPage(browser, { width: 1440, height: 900 });
  await seedApprovedBangjuEmployee(page);
  await page.evaluate(() => {
    window.switchView?.("bangju-log");
    document.body.classList.remove("physical-phone-device");
    document.body.dataset.layoutMode = "classic";
    document.body.dataset.viewMode = "classic";
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
    return {
      activeView: document.body.dataset.activeView,
      shellWidth: shell?.getBoundingClientRect().width || 0,
      reportDisplay: getComputedStyle(reportView).display,
      todayDisplay: getComputedStyle(today).display,
      dateFont: parseFloat(getComputedStyle(dateTitle).fontSize),
      reportHeight: reportBox?.getBoundingClientRect().height || 0,
      memoHeight: memoBox?.getBoundingClientRect().height || 0,
      taskWidth: taskPanel?.getBoundingClientRect().width || 0,
      scheduleWidth: schedulePanel?.getBoundingClientRect().width || 0,
      scrollHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
    };
  });

  if (metrics.activeView !== "bangju-log") fail("desktop active view mismatch", metrics.activeView);
  if (metrics.reportDisplay !== "none") fail("inactive report view leaked under worklog", metrics.reportDisplay);
  if (metrics.todayDisplay !== "grid") fail("desktop worklog should use compact grid", metrics.todayDisplay);
  if (metrics.dateFont > 36) fail("desktop date font is too large", `${metrics.dateFont}px`);
  if (metrics.shellWidth > 1140) fail("desktop employee shell is too wide", `${metrics.shellWidth}px`);
  if (metrics.reportHeight > 100 || metrics.memoHeight > 100) fail("report/memo tail is too tall", `${metrics.reportHeight}/${metrics.memoHeight}`);
  const widthRatio = metrics.taskWidth / Math.max(1, metrics.scheduleWidth);
  if (widthRatio < 0.88 || widthRatio > 1.12) fail("task/schedule columns are not balanced", String(widthRatio));
  if (metrics.scrollHeight > metrics.viewportHeight * 1.9) fail("desktop worklog still has excessive vertical tail", `${metrics.scrollHeight}/${metrics.viewportHeight}`);

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
    };
  });
  if (metrics.reportDisplay !== "none") fail("phone inactive report view leaked", metrics.reportDisplay);
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
  const panelTapFocus = await page.evaluate(() => document.querySelector("#worklogMain")?.classList.contains("is-focus-tasks"));
  if (!panelTapFocus) fail("phone worklog task expand button should open focus mode");

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
  const taskRestored = await page.evaluate(() => !document.querySelector("#worklogMain")?.classList.contains("is-mobile-focus-active"));
  if (!taskRestored) fail("phone worklog task focus close button did not restore split mode");

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
    window.switchView?.("worklog-overview");
  });
  await page.waitForTimeout(350);

  const metrics = await page.evaluate(() => {
    const title = document.querySelector(".worklog-overview-hero h2");
    const dateTitle = document.querySelector("#overviewDateTitle");
    const header = document.querySelector(".worklog-header");
    const hero = document.querySelector(".worklog-overview-hero");
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
      headerHeroGap: headerRect && heroRect ? heroRect.top - headerRect.bottom : 0,
      heroHeight: heroRect?.height || 0,
      scopeCount: document.querySelectorAll("[data-overview-scope]").length,
      activeScope: document.querySelector("[data-overview-scope].is-active")?.dataset.overviewScope || "",
      allCommandCount: document.querySelectorAll(".overview-all-command").length,
      businessBoardCount: document.querySelectorAll(".overview-all-business-board").length,
      businessSnapshotCount: document.querySelectorAll(".overview-business-snapshot").length,
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
  if (metrics.headerHeroGap < 10) fail("overview header overlaps command board", `${metrics.headerHeroGap}px`);
  if (metrics.heroHeight > 190) fail("overview hero is too tall on phone mode", `${metrics.heroHeight}px`);
  if (metrics.scopeCount < 4 || metrics.activeScope !== "all") fail("overview scope selector is not initialized", JSON.stringify({ count: metrics.scopeCount, active: metrics.activeScope }));
  if (!metrics.allCommandCount) fail("overview all-scope command board is missing");
  if (!metrics.businessBoardCount || metrics.businessSnapshotCount < 3) fail("overview all-scope business snapshots are missing", JSON.stringify(metrics));
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
  }));
  if (fitnessFilter.activeScope !== "fitness") fail("overview fitness scope did not activate", fitnessFilter.activeScope);
  if (!/비욘드 피트니스/.test(fitnessFilter.siteText)) fail("overview fitness scope missing fitness label");
  if (!fitnessFilter.centerSheets) fail("overview fitness scope should start with center operations sheet", JSON.stringify(fitnessFilter));
  if (!fitnessFilter.rosterCards) fail("overview fitness center sheet should show fitness roster cards", JSON.stringify(fitnessFilter));
  if (!fitnessFilter.insightCount) fail("overview employee insight alerts are missing");
  if (!fitnessFilter.fitnessSummaryCount) fail("fitness overview should render fitness-specific summary");
  if (!fitnessFilter.directivePanelCount) fail("overview directive panels are missing");
  if (!fitnessFilter.fitnessSheets || fitnessFilter.nonFitnessSheets) fail("overview fitness scope should show only fitness sheets", JSON.stringify(fitnessFilter));
  if (/재무대리|재무과장|공유사업부|김성민/.test(fitnessFilter.siteText)) fail("overview fitness scope leaked non-fitness employees", fitnessFilter.siteText.slice(0, 500));
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
    window.switchView?.("control");
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
  const metrics = await page.evaluate(() => {
    const header = document.querySelector("#globalHeaderTitle")?.textContent?.trim() || "";
    const pager = document.querySelector("#fitnessLogPagerTitle")?.textContent?.trim() || "";
    const view = document.querySelector("#view-fitness-log");
    return {
      header,
      pager,
      identityBadge: document.querySelector("#fitnessIdentityBadge")?.textContent?.trim() || "",
      permission: view?.dataset.fitnessPermission || "",
      pageType: view?.dataset.fitnessPageType || "",
      selectedEmployeeId: window.state?.selectedEmployeeId || "",
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
    scheduleTimes: (state.employeeLogs?.[state.selectedDateKey]?.["profile-user"]?.schedule || []).map((entry) => entry.time)
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
        email: "pinong0@naver.com",
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
      authState.user = { id: "park-juhong-user", email: "pinong0@naver.com" };
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
    scheduleTimes: (state.employeeLogs?.[state.selectedDateKey]?.["beyond-fitness-manager"]?.schedule || []).map((entry) => entry.time)
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
  if (parsed.scheduleTimes[0] !== "06:00" || parsed.scheduleTimes.at(-1) !== "24:00" || parsed.scheduleTimes.includes("08:00") === false) {
    fail("Park fitness manager schedule should follow 06:00-24:00 profile work hours", metrics);
  }
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
  if (errors.length) fail("Park fitness manager regression page errors", errors.join(" | "));
  await page.close();
}

async function checkApprovedEmployeeWorklogEditMatrix(browser) {
  const cases = [
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
    {
      label: "approved local profile without remote session",
      userId: "",
      email: "offline.approved@example.com",
      profile: {
        role: "직원",
        name: "오프라인직원",
        nickname: "오프라인",
        org: "(주)방주",
        workplace: "본사",
        primaryWork: "기획 관리",
      },
      expectedView: "bangju-log",
      expectedEmployeeId: "profile-user",
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
    const savedText = parsed.savedText || parsed.profileSavedText || "";
    if (parsed.inputValue !== marker || savedText !== marker || storedText !== marker) {
      fail("approved employee worklog input should persist", `${testCase.label}: ${JSON.stringify({ parsed, storedText })}`);
    }
    if (errors.length) fail("approved employee edit matrix page errors", `${testCase.label}: ${errors.join(" | ")}`);
    await page.close();
  }
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
  if (!metrics.applyButtons) fail("AI mission apply buttons missing");
  await page.locator("#view-ai [data-ai-mission-apply]").first().click();
  await page.waitForTimeout(180);
  const applied = await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem("beyond-worklog-state-v1") || "{}");
    const logs = stored.employeeLogs?.[stored.selectedDateKey] || {};
    return Object.values(logs).some((log) => (log.tasks || []).some((task) => String(task.text || "").includes("[AI미션]")));
  });
  if (!applied) fail("AI mission was not applied to worklog tasks");
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
  await page.click('.worklog-task-panel [data-section-ai="tasks"]');
  await page.waitForTimeout(250);
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
  await page.evaluate(() => {
    window.eval(`
      authState.user = { id: "fitness-manager-auth", email: "pinong0@naver.com" };
      state.profile = {
        ...state.profile,
        authUserId: "fitness-manager-auth",
        email: "pinong0@naver.com",
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
      kimLog.schedule[0].text = "출근보고, 종이컵 채우기, 여자탈의실 청소";
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
    kimLogText: getScheduleEntryText(getFitnessEmployeeLogForDate(
      getFitnessCenterEmployees().find((employee) => employee.name === "김영채"),
      "2026-07-24"
    )?.schedule?.[0] || {}),
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
  if (!before.kimLogText.includes("출근보고")) {
    fail("representative fitness view should load Kim Young-chae's profile-user worklog", JSON.stringify(before));
  }
  ["pjhong0", "pjhong1", "pjhong9"].forEach((retiredEmailPrefix) => {
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
  await page.click("#fitnessReportMenuButton");
  await page.waitForTimeout(250);
  const reportState = await page.evaluate(() => ({
    buttonHidden: document.querySelector("#fitnessReportConfirmButton")?.hidden ?? true,
    buttonText: document.querySelector("#fitnessReportConfirmButton")?.textContent?.trim() || "",
    previewText: document.querySelector("#fitnessReportPreview")?.textContent?.trim() || "",
  }));
  if (reportState.buttonHidden || reportState.buttonText !== "확정 취소" || !reportState.previewText.includes("확정")) {
    fail("fitness report preview should expose confirmation state", JSON.stringify(reportState));
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
        email: "pinong0@naver.com",
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
      authState.user = { id: "fitness-manager-auth", email: "pinong0@naver.com" };
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
      return {
        activeView: document.body.dataset.activeView,
        horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
        fitnessDateFits: !fitnessDate || fitnessDate.scrollWidth <= fitnessDate.clientWidth + 2,
        worklogDateFits: !worklogDate || worklogDate.scrollWidth <= worklogDate.clientWidth + 2,
        pagerBeforeOps: !pager || !ops || pager.bottom <= ops.top + 1,
        fitnessOpsBeforePanels: !ops || !fitnessTask || !fitnessSchedule || (ops.bottom <= fitnessTask.top + 1 && fitnessTask.bottom <= fitnessSchedule.top + 1),
        heroBeforeLabor: !hero || !laborConsole || hero.bottom <= laborConsole.top + 2,
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

(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(localChrome ? { executablePath: localChrome } : {}),
  });
  try {
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
    await checkRealDeviceRegressionLayouts(browser);
    await checkFitnessNewEmployeeRegistrationFlow(browser);
    await checkApprovalRepairRevealsPendingFitnessSignup(browser);
    await checkApprovalRepairMissingRpcFallsBack(browser);
    await checkRepresentativeProfileSeparation(browser);
    await checkNonControlRoleTextDoesNotBecomeRepresentative(browser);
    await checkKimSungminAccountIsEmployeeOnly(browser);
    await checkUnmappedEmployeeDoesNotInheritFitnessManager(browser);
    await checkUnclassifiedFitnessEmployeeCanEditOwnProfileWorklog(browser);
    await checkFitnessManagerCanEditOwnWorklog(browser);
    await checkApprovedEmployeeWorklogEditMatrix(browser);
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

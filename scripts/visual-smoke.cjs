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

async function checkDesktopEmployeeWorklog(browser) {
  const { page, errors } = await openPage(browser, { width: 1440, height: 900 });
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

  if (errors.length) fail("desktop page errors", errors.join(" | "));
  await page.close();
}

async function checkPhoneWorklog(browser) {
  const { page, errors } = await openPage(browser, { width: 390, height: 844 });
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

  await page.click(".day-task-panel");
  await page.waitForTimeout(100);
  const panelTapFocus = await page.evaluate(() => document.querySelector("#worklogMain")?.classList.contains("is-focus-tasks"));
  if (panelTapFocus) fail("phone worklog should not auto-expand when tapping the task panel");

  await page.click('.day-task-panel [data-mobile-focus-open="tasks"]');
  await page.waitForTimeout(150);
  const buttonFocus = await page.evaluate(() => document.querySelector("#worklogMain")?.classList.contains("is-focus-tasks"));
  if (!buttonFocus) fail("phone worklog task expand button did not open focus mode");

  await page.click(".day-task-panel [data-mobile-focus-close]");
  await page.waitForTimeout(150);
  const taskRestored = await page.evaluate(() => !document.querySelector("#worklogMain")?.classList.contains("is-mobile-focus-active"));
  if (!taskRestored) fail("phone worklog task focus close button did not restore split mode");

  await page.click(".day-schedule-panel");
  await page.waitForTimeout(100);
  const scheduleTapFocus = await page.evaluate(() => document.querySelector("#worklogMain")?.classList.contains("is-focus-schedule"));
  if (scheduleTapFocus) fail("phone worklog should not auto-expand when tapping the schedule panel");

  await page.click('.day-schedule-panel [data-mobile-focus-open="schedule"]');
  await page.waitForTimeout(150);
  const scheduleButtonFocus = await page.evaluate(() => document.querySelector("#worklogMain")?.classList.contains("is-focus-schedule"));
  if (!scheduleButtonFocus) fail("phone worklog schedule expand button did not open focus mode");

  await page.click(".day-schedule-panel [data-mobile-focus-close]");
  await page.waitForTimeout(150);
  const restored = await page.evaluate(() => !document.querySelector("#worklogMain")?.classList.contains("is-mobile-focus-active"));
  if (!restored) fail("phone worklog schedule focus close button did not restore split mode");

  if (errors.length) fail("phone page errors", errors.join(" | "));
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
      insightCount: document.querySelectorAll(".overview-insight-panel").length,
      scopeCount: document.querySelectorAll("[data-overview-scope]").length,
      activeScope: document.querySelector("[data-overview-scope].is-active")?.dataset.overviewScope || "",
      siteHeaderCount: document.querySelectorAll(".overview-site-header").length,
      fitnessSummaryCount: document.querySelectorAll(".overview-fitness-summary").length,
      directivePanelCount: document.querySelectorAll(".overview-directive-panel").length,
      hiddenTaskChrome,
      sheetCount: document.querySelectorAll(".worklog-overview-employee-sheet").length,
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
  if (!metrics.insightCount) fail("overview employee insight alerts are missing");
  if (metrics.scopeCount < 4 || metrics.activeScope !== "all") fail("overview scope selector is not initialized", JSON.stringify({ count: metrics.scopeCount, active: metrics.activeScope }));
  if (!metrics.siteHeaderCount) fail("overview site headers are missing");
  if (!metrics.fitnessSummaryCount) fail("fitness overview should render fitness-specific summary");
  if (!metrics.directivePanelCount) fail("overview directive panels are missing");
  if (!metrics.hiddenTaskChrome) fail("overview task markers/priorities should be hidden");
  if (metrics.sheetCount < 3) fail("overview should render employee sheets", String(metrics.sheetCount));
  if (!metrics.hiddenReserveSheets) fail("overview should hide reserve/unassigned sheets");
  await page.click('[data-overview-scope="fitness"]');
  await page.waitForTimeout(150);
  const fitnessFilter = await page.evaluate(() => ({
    activeScope: document.querySelector("[data-overview-scope].is-active")?.dataset.overviewScope || "",
    siteText: document.querySelector("#worklogOverviewGrid")?.textContent || "",
    fitnessSheets: document.querySelectorAll(".worklog-overview-employee-sheet.is-fitness-sheet").length,
    nonFitnessSheets: document.querySelectorAll('.worklog-overview-employee-sheet:not(.is-fitness-sheet)').length,
  }));
  if (fitnessFilter.activeScope !== "fitness") fail("overview fitness scope did not activate", fitnessFilter.activeScope);
  if (!/비욘드 피트니스/.test(fitnessFilter.siteText)) fail("overview fitness scope missing fitness label");
  if (!fitnessFilter.fitnessSheets || fitnessFilter.nonFitnessSheets) fail("overview fitness scope should show only fitness sheets", JSON.stringify(fitnessFilter));
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
      permission: view?.dataset.fitnessPermission || "",
      pageType: view?.dataset.fitnessPageType || "",
      selectedEmployeeId: window.state?.selectedEmployeeId || "",
    };
  });
  if (/정찬훈|베니|benny/i.test(metrics.header + metrics.pager)) {
    fail("representative profile leaked into fitness manager sheet", `${metrics.header} / ${metrics.pager}`);
  }
  if (!/센터장|박주홍/.test(metrics.header + metrics.pager)) {
    fail("fitness manager identity missing after representative separation", `${metrics.header} / ${metrics.pager}`);
  }
  if (metrics.permission !== "readonly" || metrics.pageType !== "coworker") {
    fail("representative should only read the fitness manager sheet", `${metrics.permission}/${metrics.pageType}`);
  }
  if (errors.length) fail("representative separation page errors", errors.join(" | "));
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
      state.selectedEmployeeId = "bangju-finance-manager";
      authState.user = { id: "qa-user", email: "finance@example.com" };
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

  const views = ["attendance", "report", "settings", "auth", "staff", "ai"];
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
    await page.selectOption('[data-registration-org-select]', "(주)비욘드 컴퍼니");
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
    if (metadata.org !== "(주)비욘드 컴퍼니" || metadata.workplace !== "비욘드 피트니스" || metadata.workHours !== "16:00-20:00") {
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

(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(localChrome ? { executablePath: localChrome } : {}),
  });
  try {
    await checkDesktopEmployeeWorklog(browser);
    await checkPhoneWorklog(browser);
    await checkOverviewCommandBoard(browser);
    await checkControlTower(browser);
    await checkExecutiveManagementPage(browser);
    await checkAiMissionArchitect(browser);
    await checkPremiumOperatingSystem(browser);
    await checkSectionAiWorklogActions(browser);
    await checkSectionChromeReleasePolish(browser);
    await checkReportArchiveVault(browser);
    await checkRealDeviceRegressionLayouts(browser);
    await checkFitnessNewEmployeeRegistrationFlow(browser);
    await checkRepresentativeProfileSeparation(browser);
    await checkCalendarAnnotations(browser);
  } finally {
    await browser.close();
  }
  console.log("Visual smoke passed");
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

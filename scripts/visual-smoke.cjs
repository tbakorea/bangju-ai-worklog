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
    const hero = document.querySelector(".worklog-overview-hero");
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
      heroHeight: hero?.getBoundingClientRect().height || 0,
      insightCount: document.querySelectorAll(".overview-insight-panel").length,
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
  if (metrics.heroHeight > 132) fail("overview hero is too tall on phone mode", `${metrics.heroHeight}px`);
  if (!metrics.insightCount) fail("overview employee insight alerts are missing");
  if (!metrics.hiddenTaskChrome) fail("overview task markers/priorities should be hidden");
  if (metrics.sheetCount < 3) fail("overview should render employee sheets", String(metrics.sheetCount));
  if (!metrics.hiddenReserveSheets) fail("overview should hide reserve/unassigned sheets");
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
  if (metrics.heroHeight > 118) fail("control tower hero is too tall", `${metrics.heroHeight}px`);
  if (metrics.kpiCount !== 4) fail("control tower should focus on four KPIs", String(metrics.kpiCount));
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

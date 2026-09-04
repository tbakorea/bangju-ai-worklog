import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const gymId = process.env.DAGYM_GYM_ID || "2387f907-0810-49b9-9db2-7ceb7861e076";
const cdpUrl = process.env.DAGYM_CDP_URL || "http://127.0.0.1:9233";
const baseUrl = process.env.DAGYM_BASE_URL || "https://www.dagym-manager.com";
const uploadUrl = process.env.DAGYM_DAILY_SYNC_URL || "https://bangju-ai-worklog.vercel.app/api/dagym-browser-daily";
const syncSecret = process.env.DAGYM_BROWSER_SYNC_SECRET || "";
const accessToken = process.env.DAGYM_SYNC_ACCESS_TOKEN || "";
const targetDate = process.env.DAGYM_DATE || process.argv.find((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)) || previousKstDateKey();
const startedAt = new Date().toISOString();

function kstDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function previousKstDateKey() {
  const current = kstDateKey();
  const date = new Date(`${current}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function normalizeText(value = "") {
  return String(value || "").normalize("NFKC").replace(/\s+/g, " ").trim();
}

function expandUrl(value = "") {
  if (!value) return "";
  return value.replaceAll("{gymId}", encodeURIComponent(gymId)).replaceAll("{date}", encodeURIComponent(targetDate));
}

function getMonthStartDateKey(dateKey = targetDate) {
  return `${String(dateKey).slice(0, 7)}-01`;
}

function withCaptureRange(value = "", period = "daily") {
  if (!value) return "";
  const url = new URL(expandUrl(value), baseUrl);
  const startDate = period === "month-to-date" ? getMonthStartDateKey() : targetDate;
  if (!url.searchParams.has("gymId")) url.searchParams.set("gymId", gymId);
  if (!url.searchParams.has("date")) url.searchParams.set("date", targetDate);
  if (!url.searchParams.has("startDate")) url.searchParams.set("startDate", `${startDate}T00:00:00`);
  if (!url.searchParams.has("endDate")) url.searchParams.set("endDate", `${targetDate}T23:59:59`);
  return url.toString();
}

async function importPlaywright() {
  const candidates = [
    "playwright",
    process.env.PLAYWRIGHT_MODULE_PATH,
    "/Users/bangju/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs",
  ].filter(Boolean);
  let lastError;
  for (const candidate of candidates) {
    try { return await import(candidate); }
    catch (error) { lastError = error; }
  }
  throw new Error(`Playwright를 불러오지 못했습니다: ${lastError?.message || "module missing"}`);
}

async function waitForReady(page) {
  await page.waitForLoadState("domcontentloaded", { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1800);
  const bodyText = normalizeText(await page.locator("body").innerText({ timeout: 15000 }).catch(() => ""));
  if (/로그인|비밀번호/.test(bodyText) && !/회원|출석|매출|수업|비욘드\s*피트니스/.test(bodyText)) throw new Error("다짐 전용 브라우저 로그인이 필요합니다.");
  return bodyText;
}

async function applyDateFilter(page, period = "daily") {
  const inputs = page.locator('input[type="date"]');
  const count = await inputs.count().catch(() => 0);
  const startDate = period === "month-to-date" ? getMonthStartDateKey() : targetDate;
  for (let index = 0; index < Math.min(count, 3); index += 1) {
    const value = count > 1 && index === 0 ? startDate : targetDate;
    await inputs.nth(index).fill(value).catch(() => {});
  }
  if (count) {
    const button = page.getByRole("button", { name: /조회|검색|적용|확인/ }).first();
    if (await button.count().catch(() => 0)) await button.click().catch(() => {});
    await page.waitForTimeout(1400);
  }
}

async function discoverLinks(page) {
  const links = await page.locator("a[href]").evaluateAll((elements) => elements.map((element) => ({
    text: String(element.innerText || element.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim(),
    href: element.href,
  })).filter((item) => item.text && item.href));
  const find = (pattern) => links.find((item) => pattern.test(item.text))?.href || "";
  return {
    sales: find(/매출|결제|계약/),
    members: find(/회원\s*관리|회원\s*목록|전체\s*회원|회원/),
    attendance: find(/출석|입장|체크인/),
  };
}

async function extractDomainMetricHints(page, key) {
  if (key !== "sales") return {};
  const sales = await page.locator("body *").evaluateAll((elements) => {
    for (const element of elements) {
      const ownText = [...element.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent || "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (ownText !== "매출") continue;
      let container = element.parentElement;
      for (let depth = 0; depth < 3 && container; depth += 1, container = container.parentElement) {
        const text = String(container.textContent || "").replace(/\s+/g, " ").trim();
        const match = text.match(/^매출\s*([\d,]+)\s*원/);
        if (!match) continue;
        const value = Number(match[1].replace(/,/g, ""));
        if (Number.isFinite(value) && value >= 0) return value;
      }
    }
    return null;
  }).catch(() => null);
  return Number.isFinite(sales) ? { sales } : {};
}

function getDomainPeriod(key = "") {
  if (key === "sales") return "month-to-date";
  if (key === "members") return "point-in-time";
  return "daily";
}

async function captureDomain(page, key, url) {
  const period = getDomainPeriod(key);
  if (!url) return { ok: false, rows: 0, source: "", error: `${key} 화면을 찾지 못함`, text: "", period, capturedAt: "" };
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.goto(withCaptureRange(url, period), { waitUntil: "domcontentloaded", timeout: 60000 });
      await waitForReady(page);
      await applyDateFilter(page, period);
      const text = normalizeText(await page.locator("body").innerText());
      const rows = await page.locator("table tbody tr").count().catch(() => 0);
      const metricHints = await extractDomainMetricHints(page, key);
      return { ok: true, rows, source: new URL(page.url()).pathname.slice(0, 120), error: "", text, metricHints, period, capturedAt: new Date().toISOString() };
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(1200 * attempt);
    }
  }
  return { ok: false, rows: 0, source: "", error: String(lastError?.message || "화면 수집 실패").slice(0, 240), text: "", period, capturedAt: "" };
}

async function captureMembersViaMenu(page, attendanceUrl) {
  const period = getDomainPeriod("members");
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await page.goto(withCaptureRange(attendanceUrl, "daily"), { waitUntil: "domcontentloaded", timeout: 60000 });
      await waitForReady(page);
      const memberButtons = page.getByRole("button", { name: "회원", exact: true });
      const initialCount = await memberButtons.count();
      if (!initialCount) throw new Error("회원 메뉴 버튼을 찾지 못함");
      await memberButtons.first().click({ timeout: 15000 });
      await page.waitForTimeout(500);
      const expandedButtons = page.getByRole("button", { name: "회원", exact: true });
      const expandedCount = await expandedButtons.count();
      if (expandedCount < 2) throw new Error("회원 하위 메뉴를 찾지 못함");
      await expandedButtons.nth(expandedCount - 1).click({ timeout: 15000 });
      const text = await waitForReady(page);
      const rows = await page.locator("table tbody tr").count().catch(() => 0);
      return {
        ok: true,
        rows,
        source: new URL(page.url()).pathname.slice(0, 120),
        error: "",
        text,
        period,
        capturedAt: new Date().toISOString(),
      };
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(1200 * attempt);
    }
  }
  return {
    ok: false,
    rows: 0,
    source: "",
    error: String(lastError?.message || "회원 화면 수집 실패").slice(0, 240),
    text: "",
    period,
    capturedAt: "",
  };
}

function firstNumber(text, patterns = []) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const value = Number(String(match[1]).replace(/,/g, ""));
    if (Number.isFinite(value) && value >= 0) return value;
  }
  return null;
}

function collectMetrics(captures) {
  const attendance = captures.attendance?.text || "";
  const members = captures.members?.text || "";
  const sales = captures.sales?.text || "";
  const membership = `${members} ${sales}`;
  const metrics = {
    visits: firstNumber(attendance, [/(?:출석한\s*회원|출석|입장|방문)(?:\s*(?:회원|인원|수))?\s*[:：]?\s*([\d,]+)\s*(?:명|건)?/i]),
    newMembers: firstNumber(membership, [/(?:신규\s*(?:등록|회원)|신규)\s*[:：]?\s*([\d,]+)\s*(?:명|건)?/i]),
    renewals: firstNumber(membership, [/(?:재등록|갱신|연장)\s*[:：]?\s*([\d,]+)\s*(?:명|건)?/i]),
    expiring: firstNumber(members, [/(?:만료\s*예정|만료\s*회원|만료\s*대상)\s*[:：]?\s*([\d,]+)\s*(?:명|건)?/i]),
    ptBookings: firstNumber(attendance, [/(?:PT|피티)\s*(?:예약|수업)\s*[:：]?\s*([\d,]+)\s*(?:명|건|회)?/i]),
    noShows: firstNumber(attendance, [/(?:노쇼|미출석|예약\s*취소)\s*[:：]?\s*([\d,]+)\s*(?:명|건)?/i]),
    lockerExpiring: firstNumber(members, [/(?:락커|사물함)\s*만료\s*[:：]?\s*([\d,]+)\s*(?:명|건)?/i]),
    sales: captures.sales?.metricHints?.sales ?? firstNumber(sales, [/(?:총\s*)?(?:매출|결제)(?:액|금액)?\s*[:：]?\s*(?:₩|원)?\s*([\d,]+)\s*원?/i]),
  };
  return Object.fromEntries(Object.entries(metrics).filter(([, value]) => value !== null));
}

async function upload(payload) {
  if (!syncSecret && !accessToken) throw new Error("다짐 동기화 인증정보가 로컬 환경에 필요합니다.");
  const result = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(syncSecret ? { "X-Dagym-Sync-Secret": syncSecret } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000),
  });
  const text = await result.text();
  if (!result.ok) throw new Error(`앱 서버 업로드 실패 (${result.status}): ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : {};
}

async function main() {
  const { chromium } = await importPlaywright();
  const browser = await chromium.connectOverCDP(cdpUrl, { timeout: 20000 }).catch((error) => {
    throw new Error(`다짐 전용 Chrome 연결 점검에 실패했습니다 (${cdpUrl}). 개인 Chrome이 아니라 전용 수집 브라우저가 실행 중인지 확인해주세요. ${error?.message || ""}`.trim());
  });
  const context = browser.contexts()[0];
  if (!context) throw new Error("다짐 전용 브라우저 컨텍스트를 찾지 못했습니다.");
  const page = context.pages()[0] || await context.newPage();
  const attendanceStart = process.env.DAGYM_ATTENDANCE_URL || `${baseUrl}/dashboard/attendance?gymId={gymId}`;
  await page.goto(withCaptureRange(attendanceStart, "daily"), { waitUntil: "domcontentloaded", timeout: 60000 });
  await waitForReady(page);
  const discovered = await discoverLinks(page);
  const urls = {
    attendance: process.env.DAGYM_ATTENDANCE_URL || discovered.attendance || attendanceStart,
    sales: process.env.DAGYM_SALES_URL || discovered.sales || `${baseUrl}/sales/list?gymId={gymId}`,
    members: process.env.DAGYM_MEMBERS_URL || discovered.members || `${baseUrl}/member/list?gymId={gymId}`,
  };
  const captures = {};
  for (const key of ["attendance", "sales"]) captures[key] = await captureDomain(page, key, urls[key]);
  captures.members = urls.members
    ? await captureDomain(page, "members", urls.members)
    : await captureMembersViaMenu(page, attendanceStart);
  if (!captures.members.ok) captures.members = await captureMembersViaMenu(page, attendanceStart);
  const metrics = collectMetrics(captures);
  const domains = Object.fromEntries(Object.entries(captures).map(([key, capture]) => [key, {
    ok: capture.ok,
    rows: capture.rows,
    source: capture.source,
    error: capture.error,
    period: capture.period,
    capturedAt: capture.capturedAt,
  }]));
  domains.schedule = { ok: true, rows: 0, source: "dagym_pt_schedule_events", error: "", period: "month-schedule", capturedAt: new Date().toISOString() };
  const warnings = Object.entries(domains).filter(([, domain]) => !domain.ok).map(([key, domain]) => `${key}: ${domain.error}`);
  const safeDir = path.join(root, "work", "dagym-daily-sync");
  fs.mkdirSync(safeDir, { recursive: true });
  const auditPath = path.join(safeDir, "latest.json");
  fs.writeFileSync(auditPath, `${JSON.stringify({ dateKey: targetDate, startedAt, capturedAt: new Date().toISOString(), metrics, domains, warnings, uploaded: null }, null, 2)}\n`);
  const uploaded = await upload({ dateKey: targetDate, startedAt, metrics, domains, warnings });
  fs.writeFileSync(auditPath, `${JSON.stringify({ dateKey: targetDate, startedAt, capturedAt: new Date().toISOString(), metrics, domains, warnings, uploaded }, null, 2)}\n`);
  console.log(JSON.stringify({ ok: true, dateKey: targetDate, metrics, domains, uploaded }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});

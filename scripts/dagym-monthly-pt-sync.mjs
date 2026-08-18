import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const monthKey = process.env.DAGYM_MONTH || process.argv.find((value) => /^\d{4}-\d{2}$/.test(value)) || getKstMonthKey();
const gymId = process.env.DAGYM_GYM_ID || "2387f907-0810-49b9-9db2-7ceb7861e076";
const cdpUrl = process.env.DAGYM_CDP_URL || "http://127.0.0.1:9222";
const baseUrl = process.env.DAGYM_BASE_URL || "https://www.dagym-manager.com";
const uploadUrl = process.env.DAGYM_MONTHLY_SCHEDULE_URL || "https://bangju-ai-worklog.vercel.app/api/dagym-monthly-schedule";
const syncSecret = process.env.DAGYM_BROWSER_SYNC_SECRET || "";
const accessToken = process.env.DAGYM_SYNC_ACCESS_TOKEN || "";
// 다짐 화면은 요청한 limit보다 작은 10건 단위로 응답하는 경우가 있다.
// offset을 실제 화면 단위와 맞춰 누락 없이 전 페이지를 순회한다.
const pageSize = Math.max(1, Number(process.env.DAGYM_SCHEDULE_PAGE_SIZE || 10) || 10);
const maxPages = 80;
const dryRun = /^(1|true|yes)$/i.test(String(process.env.DAGYM_SYNC_DRY_RUN || ""));

function getKstMonthKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
  }).format(date);
}

function getMonthRange(key = monthKey) {
  const [year, month] = key.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return {
    startDate: `${key}-01T00:00:00`,
    endDate: `${key}-${String(lastDay).padStart(2, "0")}T23:59:59`,
  };
}

function dagymScheduleUrl(offset = 0) {
  const range = getMonthRange();
  const url = new URL("/schedule/list", baseUrl);
  url.searchParams.set("gymId", gymId);
  url.searchParams.set("startDate", range.startDate);
  url.searchParams.set("endDate", range.endDate);
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("limit", String(pageSize));
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
    try {
      return await import(candidate);
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Playwright를 불러오지 못했습니다: ${lastError?.message || "module missing"}`);
}

function normalizeText(value = "") {
  return String(value || "").normalize("NFKC").replace(/\s+/g, " ").trim();
}

function rowFingerprint(row = []) {
  return crypto.createHash("sha256").update(row.map(normalizeText).join("\u001f")).digest("hex");
}

function sourceKeyForEvent(parts = []) {
  return crypto.createHash("sha256").update([gymId, ...parts].map(normalizeText).join("\u001f")).digest("hex");
}

function parseKstDateTime(dateText = "", timeText = "") {
  const dateMatch = normalizeText(dateText).match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  const timeMatch = normalizeText(timeText).match(/(\d{1,2}):(\d{2})/);
  if (!dateMatch || !timeMatch) return "";
  const dateKey = `${dateMatch[1]}-${String(dateMatch[2]).padStart(2, "0")}-${String(dateMatch[3]).padStart(2, "0")}`;
  const time = `${String(timeMatch[1]).padStart(2, "0")}:${timeMatch[2]}:00`;
  return `${dateKey}T${time}+09:00`;
}

function normalizeStatus(value = "") {
  const source = normalizeText(value);
  if (/노쇼|결석|미출석/.test(source)) return "no-show";
  if (/취소/.test(source)) return "cancelled";
  if (/완료|출석완료|수업완료/.test(source)) return "completed";
  return "scheduled";
}

function normalizeSessionType(value = "") {
  const source = normalizeText(value);
  if (/무료|서비스|체험/.test(source)) return "free";
  if (/P\.?T|피티|개인수업|트레이닝/i.test(source)) return "paid";
  return "other";
}

function parseScheduleRow(row = []) {
  const cells = row.map(normalizeText);
  if (!cells.length || /수업\s*일시/.test(cells[0])) return null;
  const range = cells[0].match(/((?:\d{4})[.\-/]\d{1,2}[.\-/]\d{1,2}).*?(\d{1,2}:\d{2})\s*[~\-–]\s*(\d{1,2}:\d{2})/);
  if (!range) return null;
  const scheduledAt = parseKstDateTime(range[1], range[2]);
  const endedAt = parseKstDateTime(range[1], range[3]);
  if (!scheduledAt || !scheduledAt.startsWith(monthKey)) return null;
  const classType = cells[1] || "";
  const className = cells[2] || "PT";
  const trainerName = cells[3] || "";
  const memberName = cells[5] || "";
  const statusText = cells[6] || "";
  if (!trainerName) return null;
  const sessionType = normalizeSessionType(`${classType} ${className}`);
  const classLabel = sessionType === "free" ? "무료 PT 수업" : sessionType === "paid" ? "PT 수업" : normalizeText(className || "수업").slice(0, 80);
  return {
    sourceKey: sourceKeyForEvent([scheduledAt, endedAt, trainerName, memberName, classType, className]),
    trainerName,
    memberName,
    scheduledAt,
    endedAt,
    sessionType,
    status: normalizeStatus(statusText),
    classLabel,
  };
}

async function waitForReady(page) {
  await page.waitForLoadState("domcontentloaded", { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1800);
  const bodyText = normalizeText(await page.locator("body").innerText({ timeout: 15000 }).catch(() => ""));
  if (/로그인|비밀번호/.test(bodyText) && !/수업\s*일정|예약현황|비욘드\s*피트니스/.test(bodyText)) {
    throw new Error("다짐 전용 브라우저 로그인이 필요합니다.");
  }
  return bodyText;
}

async function capturePage(page, offset) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.goto(dagymScheduleUrl(offset), { waitUntil: "domcontentloaded", timeout: 60000 });
      const bodyText = await waitForReady(page);
      const rows = await page.locator("table tr").evaluateAll((elements) => elements.map((row) => (
        [...row.children].map((cell) => String(cell.innerText || "").replace(/\s+/g, " ").trim()).filter(Boolean)
      )).filter((row) => row.length));
      return { rows, bodyText, url: page.url() };
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(1500 * attempt);
    }
  }
  throw lastError;
}

async function captureMonth(page) {
  const uniqueRawRows = new Map();
  const events = new Map();
  let complete = false;
  let pagesRead = 0;
  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    const offset = pageIndex * pageSize;
    const pageResult = await capturePage(page, offset);
    pagesRead += 1;
    const dataRows = pageResult.rows.filter((row) => !/수업\s*일시/.test(normalizeText(row[0])));
    let newlySeen = 0;
    dataRows.forEach((row) => {
      const fingerprint = rowFingerprint(row);
      if (uniqueRawRows.has(fingerprint)) return;
      uniqueRawRows.set(fingerprint, row);
      newlySeen += 1;
      const event = parseScheduleRow(row);
      if (event) events.set(event.sourceKey, event);
    });
    const explicitlyEmpty = /일정이\s*없|조건에\s*맞는\s*일정이\s*없/.test(pageResult.bodyText);
    if (!dataRows.length || explicitlyEmpty || newlySeen === 0) {
      complete = true;
      break;
    }
  }
  return { events: [...events.values()].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)), pagesRead, complete };
}

async function uploadMonth(capture) {
  if (!syncSecret && !accessToken) throw new Error("다짐 동기화 인증정보가 로컬 환경에 필요합니다.");
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(syncSecret ? { "X-Dagym-Sync-Secret": syncSecret } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({
      centerKey: "beyond-fitness",
      monthKey,
      events: capture.events,
      complete: capture.complete,
      confirmEmpty: capture.complete && capture.events.length === 0,
    }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`앱 서버 업로드 실패 (${response.status}): ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : {};
}

async function main() {
  const { chromium } = await importPlaywright();
  const browser = await chromium.connectOverCDP(cdpUrl);
  const context = browser.contexts()[0];
  if (!context) throw new Error("다짐 전용 브라우저 컨텍스트를 찾지 못했습니다.");
  const page = context.pages()[0] || await context.newPage();
  const capture = await captureMonth(page);
  const safeDir = path.join(root, "work", "dagym-monthly-schedule");
  fs.mkdirSync(safeDir, { recursive: true });
  // 회원 이름은 암호화된 서버 컬럼에만 보관하고 로컬 감사 파일에서는 제거합니다.
  const safeEvents = capture.events.map(({ memberName, ...event }) => event);
  const trainerCounts = safeEvents.reduce((counts, event) => {
    const name = normalizeText(event.trainerName) || "미확인";
    counts[name] = (counts[name] || 0) + 1;
    return counts;
  }, {});
  const audit = {
    monthKey,
    capturedAt: new Date().toISOString(),
    pagesRead: capture.pagesRead,
    complete: capture.complete,
    eventCount: safeEvents.length,
    trainerCounts,
    firstScheduledAt: safeEvents[0]?.scheduledAt || "",
    lastScheduledAt: safeEvents.at(-1)?.scheduledAt || "",
    events: safeEvents,
  };
  // 서버 장애가 있어도 수집 성공 여부와 강사별 건수를 확인할 수 있어야 한다.
  fs.writeFileSync(path.join(safeDir, `${monthKey}.json`), `${JSON.stringify({
    ...audit,
  }, null, 2)}\n`);
  const uploaded = dryRun ? { skipped: true, reason: "dry-run" } : await uploadMonth(capture);
  console.log(JSON.stringify({
    ok: true,
    monthKey,
    pagesRead: capture.pagesRead,
    events: capture.events.length,
    trainerCounts,
    firstScheduledAt: audit.firstScheduledAt,
    lastScheduledAt: audit.lastScheduledAt,
    complete: capture.complete,
    uploaded,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});

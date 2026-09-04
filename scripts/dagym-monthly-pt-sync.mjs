import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = process.cwd();
const monthKey = process.env.DAGYM_MONTH || process.argv.find((value) => /^\d{4}-\d{2}$/.test(value)) || getKstMonthKey();
const gymId = process.env.DAGYM_GYM_ID || "2387f907-0810-49b9-9db2-7ceb7861e076";
const cdpUrl = process.env.DAGYM_CDP_URL || "http://127.0.0.1:9233";
const baseUrl = process.env.DAGYM_BASE_URL || "https://www.dagym-manager.com";
const uploadUrl = process.env.DAGYM_MONTHLY_SCHEDULE_URL || "https://bangju-ai-worklog.vercel.app/api/dagym-monthly-schedule";
const syncSecret = process.env.DAGYM_BROWSER_SYNC_SECRET || "";
const accessToken = process.env.DAGYM_SYNC_ACCESS_TOKEN || "";
const graphqlOperationName = "GetCalendarScheduleItems";
const pageSize = Math.max(50, Number(process.env.DAGYM_CALENDAR_PAGE_SIZE || 500) || 500);
const maxPages = 80;
const dryRun = /^(1|true|yes)$/i.test(String(process.env.DAGYM_SYNC_DRY_RUN || ""));

function getKstMonthKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
  }).format(date);
}

export function getKstMonthRangeIso(key = monthKey) {
  if (!/^\d{4}-\d{2}$/.test(key)) throw new Error("기준월 형식이 올바르지 않습니다.");
  const [year, month] = key.split("-").map(Number);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextKey = `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
  const start = new Date(`${key}-01T00:00:00+09:00`);
  const nextStart = new Date(`${nextKey}-01T00:00:00+09:00`);
  return {
    startDate: start.toISOString(),
    endDate: new Date(nextStart.getTime() - 1).toISOString(),
  };
}

function dagymCalendarUrl() {
  const url = new URL("/schedule/calendar", baseUrl);
  url.searchParams.set("gymId", gymId);
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

function sourceKeyForEvent(parts = []) {
  return crypto.createHash("sha256").update([gymId, ...parts].map(normalizeText).join("\u001f")).digest("hex");
}

function normalizeSessionType(value = "") {
  const source = normalizeText(value);
  if (/무료|서비스|체험/.test(source)) return "free";
  if (/P\.?T|피티|개인수업|트레이닝/i.test(source)) return "paid";
  return "other";
}

function isInKstMonth(value = "", key = monthKey) {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && getKstMonthKey(date) === key;
}

export function calendarItemToEvents(item = {}, targetMonthKey = monthKey) {
  const scheduledAt = String(item.startAt || "").trim();
  const endedAt = String(item.endAt || "").trim();
  if (!scheduledAt || !isInKstMonth(scheduledAt, targetMonthKey)) return [];
  if (endedAt && Number.isNaN(new Date(endedAt).getTime())) return [];

  const instructors = Array.isArray(item.instructors)
    ? item.instructors.filter((instructor) => normalizeText(instructor?.name))
    : [];
  if (!instructors.length) return [];

  const memberNames = [...new Set((Array.isArray(item.reservations) ? item.reservations : [])
    .map((reservation) => normalizeText(reservation?.reservedMember?.name))
    .filter(Boolean))];
  const members = memberNames.length ? memberNames : [""];
  const className = normalizeText(item.name || "PT") || "PT";
  const sessionType = normalizeSessionType(`${item.category || ""} ${className}`);
  const classLabel = sessionType === "free"
    ? "무료 PT 수업"
    : sessionType === "paid"
      ? "PT 수업"
      : className.slice(0, 80);

  return instructors.flatMap((instructor) => members.map((memberName, memberIndex) => ({
    sourceKey: sourceKeyForEvent([
      item.id || item.scheduleId || "",
      item.scheduleId || "",
      instructor.id || instructor.name,
      memberName || `미배정-${memberIndex}`,
      scheduledAt,
      endedAt,
    ]),
    trainerName: normalizeText(instructor.name),
    memberName,
    scheduledAt,
    endedAt,
    sessionType,
    status: "scheduled",
    classLabel,
  })));
}

async function waitForReady(page) {
  await page.waitForLoadState("domcontentloaded", { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const bodyText = normalizeText(await page.locator("body").innerText({ timeout: 15000 }).catch(() => ""));
  if (/로그인|비밀번호/.test(bodyText) && !/시간표|수업\s*일정|예약현황|비욘드\s*피트니스/.test(bodyText)) {
    throw new Error("다짐 전용 브라우저 로그인이 필요합니다.");
  }
  if (!/시간표/.test(bodyText)) throw new Error("다짐 시간표 화면을 불러오지 못했습니다.");
  return bodyText;
}

function isCalendarGraphqlRequest(request) {
  if (!request.url().includes("/api/graphql")) return false;
  try {
    return request.postDataJSON()?.operationName === graphqlOperationName;
  } catch {
    return false;
  }
}

function sanitizeReplayHeaders(headers = {}) {
  return Object.fromEntries(Object.entries(headers).filter(([key]) => (
    /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(key)
      && !["content-length", "cookie", "host"].includes(key.toLowerCase())
  )));
}

async function captureCalendarRequest(page) {
  const requestPromise = page.waitForRequest(isCalendarGraphqlRequest, { timeout: 30000 });
  await page.goto(dagymCalendarUrl(), { waitUntil: "domcontentloaded", timeout: 60000 });
  const request = await requestPromise;
  await waitForReady(page);
  return {
    url: request.url(),
    payload: request.postDataJSON(),
    headers: sanitizeReplayHeaders(await request.allHeaders()),
  };
}

async function fetchCalendarPage(context, template, range, offset) {
  const payload = {
    ...template.payload,
    operationName: graphqlOperationName,
    variables: {
      ...(template.payload?.variables || {}),
      startDate: range.startDate,
      endDate: range.endDate,
      limit: pageSize,
      offset,
    },
  };
  const response = await context.request.post(template.url, {
    headers: template.headers,
    data: payload,
    timeout: 60000,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok()) throw new Error(`다짐 시간표 조회 실패 (${response.status()}): ${JSON.stringify(json).slice(0, 500)}`);
  if (Array.isArray(json?.errors) && json.errors.length) {
    throw new Error(`다짐 시간표 조회 실패: ${json.errors.map((error) => error?.message || "GraphQL error").join(", ")}`);
  }
  const scheduleItems = json?.data?.scheduleItems;
  if (!scheduleItems || !Array.isArray(scheduleItems.data)) throw new Error("다짐 시간표 응답 형식을 확인할 수 없습니다.");
  return {
    rows: scheduleItems.data,
    count: Number.isFinite(Number(scheduleItems.count)) ? Number(scheduleItems.count) : null,
  };
}

async function captureMonth(context, page) {
  const template = await captureCalendarRequest(page);
  const range = getKstMonthRangeIso(monthKey);
  const rawItems = [];
  let offset = 0;
  let totalCount = null;
  let pagesRead = 0;
  let complete = false;

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    const result = await fetchCalendarPage(context, template, range, offset);
    pagesRead += 1;
    if (totalCount === null && result.count !== null) totalCount = result.count;
    rawItems.push(...result.rows);
    offset += result.rows.length;
    if (!result.rows.length || (totalCount !== null && offset >= totalCount) || result.rows.length < pageSize) {
      complete = totalCount === null || offset >= totalCount;
      break;
    }
  }

  const events = new Map();
  rawItems.forEach((item) => {
    calendarItemToEvents(item, monthKey).forEach((event) => events.set(event.sourceKey, event));
  });
  return {
    events: [...events.values()].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)),
    pagesRead,
    complete,
    sourceItemCount: rawItems.length,
    expectedItemCount: totalCount,
  };
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
  const browser = await chromium.connectOverCDP(cdpUrl, { timeout: 20000 }).catch((error) => {
    throw new Error(`다짐 전용 Chrome 연결 점검에 실패했습니다 (${cdpUrl}). 개인 Chrome이 아니라 전용 수집 브라우저가 실행 중인지 확인해주세요. ${error?.message || ""}`.trim());
  });
  const context = browser.contexts()[0];
  if (!context) throw new Error("다짐 전용 브라우저 컨텍스트를 찾지 못했습니다.");
  const page = await context.newPage();
  try {
    const capture = await captureMonth(context, page);
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
      source: "dagym-calendar-graphql",
      pagesRead: capture.pagesRead,
      complete: capture.complete,
      sourceItemCount: capture.sourceItemCount,
      expectedItemCount: capture.expectedItemCount,
      eventCount: safeEvents.length,
      trainerCounts,
      firstScheduledAt: safeEvents[0]?.scheduledAt || "",
      lastScheduledAt: safeEvents.at(-1)?.scheduledAt || "",
      events: safeEvents,
    };
    fs.writeFileSync(path.join(safeDir, `${monthKey}.json`), `${JSON.stringify(audit, null, 2)}\n`);
    const uploaded = dryRun ? { skipped: true, reason: "dry-run" } : await uploadMonth(capture);
    console.log(JSON.stringify({
      ok: true,
      monthKey,
      source: audit.source,
      pagesRead: capture.pagesRead,
      sourceItems: capture.sourceItemCount,
      expectedItems: capture.expectedItemCount,
      events: capture.events.length,
      trainerCounts,
      firstScheduledAt: audit.firstScheduledAt,
      lastScheduledAt: audit.lastScheduledAt,
      complete: capture.complete,
      uploaded,
    }, null, 2));
  } finally {
    await page.close().catch(() => {});
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isDirectRun) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error.stack || error.message || error);
      process.exit(1);
    });
}

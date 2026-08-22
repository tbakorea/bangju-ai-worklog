const SUPABASE_URL = process.env.SUPABASE_URL || "https://zllpfaijahyfppivkxzu.supabase.co";
const METRIC_KEYS = ["visits", "newMembers", "renewals", "expiring", "ptBookings", "noShows", "lockerExpiring", "sales"];

function getSeoulDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function previousDateKey(dateKey) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function numeric(value) {
  const number = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function hasDagymActivity(record = {}) {
  return METRIC_KEYS.some((key) => String(record?.[key] ?? "").trim() !== "" && numeric(record[key]) > 0)
    || Boolean(String(record?.importText || "").trim());
}

function hasUsableDagymRecord(record = {}) {
  return record?.snapshotAvailable === true
    || numeric(record?.fieldCount) > 0
    || hasDagymActivity(record);
}

function collectStoredSource(rows = [], sourceDateKey) {
  const latestByUser = new Map();
  rows.forEach((row) => {
    const previous = latestByUser.get(row.user_id);
    if (!previous || String(row.updated_at || "") > String(previous.updated_at || "")) latestByUser.set(row.user_id, row);
  });
  const candidates = [...latestByUser.values()].map((row) => ({
    row,
    record: row.state?.dagymDaily?.[sourceDateKey],
  })).filter(({ record }) => hasDagymActivity(record));
  candidates.sort((left, right) => {
    const leftCount = METRIC_KEYS.filter((key) => String(left.record?.[key] ?? "").trim() !== "").length;
    const rightCount = METRIC_KEYS.filter((key) => String(right.record?.[key] ?? "").trim() !== "").length;
    return rightCount - leftCount || String(right.record?.updatedAt || right.row.updated_at || "").localeCompare(String(left.record?.updatedAt || left.row.updated_at || ""));
  });
  const staff = { pt: 0, consultation: 0, renewal: 0, outbound: 0 };
  latestByUser.forEach((row) => {
    const profile = row.state?.profile || {};
    const workplace = `${profile.workplace || ""} ${profile.org || ""}`;
    if (!/피트니스|fitness/i.test(workplace)) return;
    const ops = row.state?.ownerWorklog?.fitnessOps || {};
    staff.pt += numeric(ops.ptRegular) + numeric(ops.ptFree) + numeric(ops.ptOther);
    staff.consultation += numeric(ops.consultation);
    staff.renewal += numeric(ops.customerRenewal);
    staff.outbound += numeric(ops.outbound) + numeric(ops.outsideSales);
  });
  return { record: candidates[0]?.record || null, staff };
}

async function loadDailySnapshot(sourceDate, headers) {
  const query = new URL(`${SUPABASE_URL}/rest/v1/dagym_daily_snapshots`);
  query.searchParams.set("select", "metrics,domains,quality,field_count,source,source_updated_at,updated_at");
  query.searchParams.set("center_key", "eq.beyond-fitness");
  query.searchParams.set("snapshot_date", `eq.${sourceDate}`);
  query.searchParams.set("limit", "1");
  const result = await fetch(query, { headers });
  if (!result.ok) {
    const message = await result.text();
    if (/dagym_daily_snapshots|schema cache|PGRST205|42P01/i.test(message)) return null;
    throw new Error(`다짐 일일 스냅샷 조회 실패 (${result.status})`);
  }
  const [row] = await result.json().catch(() => []);
  if (!row?.metrics || typeof row.metrics !== "object") return null;
  return {
    ...row.metrics,
    domains: row.domains && typeof row.domains === "object" ? row.domains : {},
    syncMode: "browser-daily",
    source: row.source || "dagym-browser-daily",
    quality: row.quality || "partial",
    fieldCount: numeric(row.field_count),
    snapshotAvailable: row.quality !== "missing" && numeric(row.field_count) > 0,
    updatedAt: row.source_updated_at || row.updated_at || null,
  };
}

function buildAnalysis(analysisDate, sourceDate, record, staff = {}) {
  const metrics = Object.fromEntries(METRIC_KEYS.map((key) => [key, numeric(record?.[key])]));
  const populated = METRIC_KEYS.filter((key) => String(record?.[key] ?? "").trim() !== "").length;
  const generatedAt = new Date().toISOString();
  if (!hasUsableDagymRecord(record)) {
    return {
      analysis_date: analysisDate,
      source_date: sourceDate,
      source: "nightly-cron",
      quality: "missing",
      metrics,
      ratios: {},
      signals: [{ type: "data-gap", severity: "warning", title: "전날 다짐자료 미확인", detail: `${sourceDate} 센터 운영자료가 없습니다.`, action: "센터 마감자료를 확인하고 다짐 자료를 동기화하세요.", targetRole: "센터장", dueTime: "09:30" }],
      coaching: { headline: "전날 다짐자료 미확인", todayAction: "출석·예약·매출자료를 먼저 확인하세요.", managementDirection: "데이터 입력률을 안정화한 뒤 운영 판단을 확정합니다." },
      generated_at: generatedAt,
      source_updated_at: null,
    };
  }
  const renewalGap = Math.max(0, metrics.expiring - metrics.renewals);
  const ptGap = Math.max(0, metrics.ptBookings - numeric(staff.pt));
  const recordedSalesActions = numeric(staff.consultation) + numeric(staff.renewal) + numeric(staff.outbound);
  const expectedSalesActions = metrics.visits ? Math.max(2, Math.round(metrics.visits * 0.03)) : 0;
  const salesActionGap = Math.max(0, expectedSalesActions - recordedSalesActions);
  const noShowRate = metrics.ptBookings ? Math.round((metrics.noShows / metrics.ptBookings) * 1000) / 10 : 0;
  const renewalCoverage = metrics.expiring ? Math.round((metrics.renewals / metrics.expiring) * 1000) / 10 : 0;
  const salesPeriod = String(record?.domains?.sales?.period || "");
  const attendancePeriod = String(record?.domains?.attendance?.period || "daily");
  const salesPerVisitComparable = salesPeriod === "daily" && attendancePeriod === "daily";
  const salesPerVisit = salesPerVisitComparable && metrics.visits ? Math.round(metrics.sales / metrics.visits) : null;
  const signals = [];
  if (renewalGap) signals.push({ type: "renewal-gap", severity: renewalCoverage < 50 ? "critical" : "warning", title: `만료대응 ${renewalGap}건 부족`, detail: `만료예정 ${metrics.expiring}건 중 재등록 ${metrics.renewals}건, 대응률 ${renewalCoverage}%입니다.`, action: "미처리 회원을 결과별로 분류하고 담당자를 배정하세요.", targetRole: "인포", dueTime: "11:00", value: renewalGap });
  if (metrics.noShows) signals.push({ type: "no-show", severity: noShowRate >= 10 ? "critical" : "warning", title: `노쇼·취소 ${metrics.noShows}건`, detail: `PT 예약 대비 노쇼·취소율 ${noShowRate}%입니다.`, action: "재예약 안내와 사유 기록을 완료하세요.", targetRole: "인포", dueTime: "10:30", value: metrics.noShows });
  if (ptGap) signals.push({ type: "pt-gap", severity: "warning", title: `PT 기록 차이 ${ptGap}건`, detail: `다짐 예약 ${metrics.ptBookings}건과 직원 수업기록 ${numeric(staff.pt)}건이 다릅니다.`, action: "완료·노쇼·일정변경 중 하나로 결과를 확정하세요.", targetRole: "트레이너", dueTime: "12:00", value: ptGap });
  if (salesActionGap) signals.push({ type: "sales-action", severity: "warning", title: `상담행동 ${salesActionGap}건 보강`, detail: `출석 ${metrics.visits}명 대비 상담·재등록·아웃바운드 ${recordedSalesActions}건입니다.`, action: "재등록 후보와 체험회원 후속조치를 오늘 일정에 배정하세요.", targetRole: "센터장", dueTime: "14:00", value: salesActionGap });
  if (metrics.lockerExpiring) signals.push({ type: "locker", severity: "observe", title: `락커 만료 ${metrics.lockerExpiring}건`, detail: "연장·정리 여부를 확인해야 합니다.", action: "안내 결과를 기록하세요.", targetRole: "인포", dueTime: "15:00", value: metrics.lockerExpiring });
  if (!signals.length) signals.push({ type: "stable", severity: "normal", title: "전날 운영흐름 안정", detail: "즉시 보완할 큰 지표 차이가 확인되지 않았습니다.", action: "수업·상담 결과 기록 기준을 유지하세요.", targetRole: "센터장", dueTime: "오늘", value: 0 });
  const top = signals.find((signal) => signal.severity === "critical") || signals.find((signal) => signal.severity === "warning") || signals[0];
  return {
    analysis_date: analysisDate,
    source_date: sourceDate,
    source: record?.syncMode === "direct" ? "dagym-direct" : "worklog-snapshot",
    quality: populated >= 6 ? "complete" : "partial",
    metrics,
    ratios: {
      noShowRate,
      renewalCoverage,
      salesPerVisit,
      salesPeriod,
      attendancePeriod,
      salesPerVisitComparable,
      recordedPt: numeric(staff.pt),
      recordedSalesActions,
    },
    signals: signals.slice(0, 8),
    coaching: {
      headline: top.title,
      todayAction: top.action,
      managementDirection: renewalGap ? "재등록 대응률과 결과기록을 우선 개선합니다." : salesActionGap ? "출석을 상담·재등록으로 전환하는 운영 루프를 강화합니다." : "수업·상담·매출의 연결 기록을 유지합니다.",
    },
    generated_at: generatedAt,
    source_updated_at: record?.updatedAt || record?.importedAt || null,
  };
}

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "GET") return response.status(405).json({ ok: false, error: "GET only" });
  const secret = String(process.env.CRON_SECRET || "");
  const authorization = String(request.headers.authorization || "");
  if (!secret || authorization !== `Bearer ${secret}`) return response.status(401).json({ ok: false, error: "예약 실행 인증이 필요합니다." });
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
  if (!serviceKey) return response.status(501).json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY 설정이 필요합니다." });
  const analysisDate = getSeoulDateKey();
  const sourceDate = previousDateKey(analysisDate);
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };
  let snapshotRecord;
  try {
    snapshotRecord = await loadDailySnapshot(sourceDate, headers);
  } catch (error) {
    return response.status(502).json({ ok: false, error: error.message || "다짐 일일 스냅샷 조회 실패" });
  }
  const query = new URL(`${SUPABASE_URL}/rest/v1/worklog_states`);
  query.searchParams.set("select", "user_id,state,updated_at");
  query.searchParams.set("log_date", `eq.${sourceDate}`);
  query.searchParams.set("order", "updated_at.desc");
  query.searchParams.set("limit", "200");
  const sourceResponse = await fetch(query, { headers });
  if (!sourceResponse.ok) return response.status(502).json({ ok: false, error: `전날 업무자료 조회 실패 (${sourceResponse.status})` });
  const rows = await sourceResponse.json().catch(() => []);
  const stored = collectStoredSource(Array.isArray(rows) ? rows : [], sourceDate);
  const record = hasUsableDagymRecord(snapshotRecord) ? snapshotRecord : stored.record;
  const analysis = buildAnalysis(analysisDate, sourceDate, record, stored.staff);
  if (hasUsableDagymRecord(snapshotRecord)) analysis.source = "dagym-browser-daily";
  analysis.updated_at = analysis.generated_at;
  const saveResponse = await fetch(`${SUPABASE_URL}/rest/v1/dagym_daily_analyses?on_conflict=analysis_date`, {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(analysis),
  });
  if (!saveResponse.ok) return response.status(502).json({ ok: false, error: `일일 분석 저장 실패 (${saveResponse.status})` });
  return response.status(200).json({ ok: true, analysisDate, sourceDate, quality: analysis.quality, signalCount: analysis.signals.length, generatedAt: analysis.generated_at });
};

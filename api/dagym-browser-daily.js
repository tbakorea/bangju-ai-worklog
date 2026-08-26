const crypto = require("crypto");

const SUPABASE_URL = String(process.env.SUPABASE_URL || "https://zllpfaijahyfppivkxzu.supabase.co").replace(/\/$/, "");
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpsbHBmYWlqYWh5ZnBwaXZreHp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzMzQxNTUsImV4cCI6MjA5ODkxMDE1NX0.C4omaj-e_9PM-iF3-5GUUVX47Wo06UsNTOYMlMMVcZU";

function isSafeHeaderSecret(value = "") {
  return /^[\x20-\x7E]+$/.test(String(value || "")) && !/[•●*]{3,}/.test(String(value || ""));
}

function isJwtLike(value = "") {
  return isSafeHeaderSecret(value) && /^eyJ[^.]*\.[^.]+\.[^.]+$/.test(String(value || ""));
}

const configuredServiceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const SERVICE_ROLE_KEY = isJwtLike(configuredServiceRoleKey) ? configuredServiceRoleKey : "";
const SYNC_SECRET = String(process.env.DAGYM_BROWSER_SYNC_SECRET || "");
const configuredAnonKey = String(process.env.SUPABASE_ANON_KEY || "").trim();
const SUPABASE_ANON_KEY = isJwtLike(configuredAnonKey) ? configuredAnonKey : DEFAULT_SUPABASE_ANON_KEY;
const CENTER_KEY = "beyond-fitness";
const METRIC_KEYS = ["visits", "newMembers", "renewals", "expiring", "ptBookings", "noShows", "lockerExpiring", "sales"];

function secureEqual(left = "", right = "") {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

async function verifySyncUser(request) {
  const authorization = String(request.headers.authorization || "");
  if (!authorization.startsWith("Bearer ")) return null;
  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: authorization } });
  if (!userResponse.ok) return null;
  const user = await userResponse.json().catch(() => null);
  if (!user?.id) return null;
  const profileBaseUrl = `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&limit=1&select=`;
  const selectCandidates = [
    "id,role,workplace,access_preset,permissions,approval_status",
    "id,role,workplace,approval_status",
    "id,role,workplace",
  ];
  let profile = null;
  for (const fields of selectCandidates) {
    const profileResponse = await fetch(`${profileBaseUrl}${fields}`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: authorization } });
    if (!profileResponse.ok) continue;
    [profile] = await profileResponse.json().catch(() => []);
    break;
  }
  if (!profile || profile.approval_status !== "approved") return null;
  const permissions = profile.permissions && typeof profile.permissions === "object" ? profile.permissions : {};
  const roleText = `${profile.role || ""} ${profile.workplace || ""}`;
  const canSync = /대표|센터장|관리자|owner|manager|admin/i.test(roleText)
    || ["owner", "executive_delegate", "operations_admin", "site_manager"].includes(String(profile.access_preset || ""))
    || Boolean(permissions.worklogAll || permissions.controlTower || permissions.siteControl);
  return canSync ? user : null;
}

async function authorizeSyncRequest(request) {
  const suppliedSecret = String(request.headers["x-dagym-sync-secret"] || "").trim();
  if (SYNC_SECRET && secureEqual(suppliedSecret, SYNC_SECRET)) return true;
  return Boolean(await verifySyncUser(request));
}

function isDateKey(value = "") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function nextDateKey(dateKey) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function numberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? Math.max(0, number) : null;
}

function normalizeMetrics(input = {}) {
  return Object.fromEntries(METRIC_KEYS.flatMap((key) => {
    const value = numberOrNull(input?.[key]);
    return value === null ? [] : [[key, value]];
  }));
}

function normalizeDomains(input = {}) {
  return Object.fromEntries(["sales", "members", "attendance", "schedule"].map((key) => {
    const source = input?.[key] && typeof input[key] === "object" ? input[key] : {};
    return [key, {
      ok: source.ok === true,
      rows: Math.max(0, Number(source.rows || 0)),
      source: String(source.source || "").slice(0, 120),
      error: String(source.error || "").slice(0, 240),
      period: ["daily", "month-to-date", "point-in-time", "month-schedule"].includes(String(source.period || "")) ? String(source.period) : "",
      capturedAt: String(source.capturedAt || "").slice(0, 40),
    }];
  }));
}

async function supabaseRequest(path, options = {}) {
  const result = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await result.text();
  if (!result.ok) throw new Error(`운영 DB 반영 오류 (${result.status}): ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : [];
}

async function enrichPtMetrics(dateKey, metrics) {
  const start = encodeURIComponent(`${dateKey}T00:00:00+09:00`);
  const end = encodeURIComponent(`${nextDateKey(dateKey)}T00:00:00+09:00`);
  const rows = await supabaseRequest(`/rest/v1/dagym_pt_schedule_events?center_key=eq.${CENTER_KEY}&active=eq.true&scheduled_at=gte.${start}&scheduled_at=lt.${end}&select=status&limit=2500`);
  if (metrics.ptBookings === undefined) metrics.ptBookings = rows.length;
  if (metrics.noShows === undefined) metrics.noShows = rows.filter((row) => row.status === "no-show").length;
  return { metrics, scheduleRows: rows.length };
}

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") return response.status(405).json({ ok: false, error: "POST only" });
  if (!SERVICE_ROLE_KEY) {
    const missing = [!SERVICE_ROLE_KEY && (configuredServiceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY(실제 키로 다시 저장 필요)" : "SUPABASE_SERVICE_ROLE_KEY")].filter(Boolean);
    return response.status(501).json({ ok: false, error: "다짐 자동수집 환경설정이 필요합니다.", missing });
  }
  let authorized = false;
  try {
    authorized = await authorizeSyncRequest(request);
  } catch (error) {
    return response.status(502).json({ ok: false, error: "동기화 권한 확인에 실패했습니다. 잠시 후 다시 시도해주세요." });
  }
  if (!authorized) return response.status(401).json({ ok: false, error: "동기화 인증에 실패했습니다." });

  const dateKey = String(request.body?.dateKey || "").trim();
  if (!isDateKey(dateKey)) return response.status(400).json({ ok: false, error: "수집 날짜가 올바르지 않습니다." });
  const collectedAt = new Date().toISOString();
  const syncId = crypto.randomUUID();
  const domains = normalizeDomains(request.body?.domains);
  const warnings = Array.isArray(request.body?.warnings) ? request.body.warnings.map((item) => String(item).slice(0, 240)).slice(0, 20) : [];

  try {
    const enriched = await enrichPtMetrics(dateKey, normalizeMetrics(request.body?.metrics));
    const metrics = enriched.metrics;
    domains.schedule = { ok: true, rows: enriched.scheduleRows, source: "dagym_pt_schedule_events", error: "", period: "month-schedule", capturedAt: collectedAt };
    const fieldCount = METRIC_KEYS.filter((key) => metrics[key] !== undefined).length;
    const successfulDomains = Object.values(domains).filter((domain) => domain.ok).length;
    const quality = fieldCount >= 6 && successfulDomains >= 3 ? "complete" : fieldCount > 0 ? "partial" : "missing";
    await supabaseRequest("/rest/v1/dagym_daily_snapshots?on_conflict=center_key,snapshot_date", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ center_key: CENTER_KEY, snapshot_date: dateKey, metrics, domains, quality, field_count: fieldCount, sync_id: syncId, source: "dagym-browser-daily", source_updated_at: collectedAt, updated_at: collectedAt }),
    });

    await supabaseRequest("/rest/v1/dagym_sync_runs", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ id: syncId, center_key: CENTER_KEY, target_date: dateKey, source: "browser-daily", status: quality === "missing" ? "failed" : quality === "partial" ? "partial" : "success", quality, metrics_count: fieldCount, domains, warnings, started_at: request.body?.startedAt || collectedAt, finished_at: new Date().toISOString() }),
    });

    return response.status(200).json({ ok: quality !== "missing", dateKey, quality, fieldCount, domains, analysisDeferred: true, syncedAt: collectedAt });
  } catch (error) {
    await supabaseRequest("/rest/v1/dagym_sync_runs", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ id: syncId, center_key: CENTER_KEY, target_date: dateKey, source: "browser-daily", status: "failed", quality: "missing", metrics_count: 0, domains, warnings: [...warnings, String(error.message || "수집 실패").slice(0, 240)], started_at: request.body?.startedAt || collectedAt, finished_at: new Date().toISOString() }),
    }).catch(() => {});
    return response.status(500).json({ ok: false, error: error.message || "다짐 일일자료 저장에 실패했습니다." });
  }
};

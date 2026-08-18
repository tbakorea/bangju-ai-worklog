const crypto = require("crypto");

const SUPABASE_URL = String(process.env.SUPABASE_URL || "https://zllpfaijahyfppivkxzu.supabase.co").replace(/\/$/, "");
const SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
const SYNC_SECRET = String(process.env.DAGYM_BROWSER_SYNC_SECRET || "");
const CONTACT_SECRET = String(process.env.MEMBER_CONTACT_ENCRYPTION_KEY || "");
const MAX_EVENTS = 2500;
const CENTER_KEY = "beyond-fitness";

const trainerEmployeeAliases = [
  { id: "beyond-fitness-manager", names: ["박주홍", "센터장박주홍"] },
  { id: "fitness-trainer-1", names: ["홍현규", "트레이너홍현규"] },
];

function secureEqual(left = "", right = "") {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

function encryptionKey() {
  if (!CONTACT_SECRET) throw new Error("MEMBER_CONTACT_ENCRYPTION_KEY 설정이 필요합니다.");
  return crypto.createHash("sha256").update(CONTACT_SECRET, "utf8").digest();
}

function encrypt(value = "") {
  if (!value) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  return `${iv.toString("base64")}.${cipher.getAuthTag().toString("base64")}.${encrypted.toString("base64")}`;
}

function decrypt(value = "") {
  if (!value) return "";
  const [iv, tag, encrypted] = String(value).split(".");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64")), decipher.final()]).toString("utf8");
}

function normalizeName(value = "") {
  return String(value || "").normalize("NFKC").replace(/\s+|선생님|강사님|트레이너님|코치님|센터장|트레이너|코치/g, "").trim().toLowerCase();
}

function resolveEmployeeId(trainerName = "") {
  const normalized = normalizeName(trainerName);
  return trainerEmployeeAliases.find((entry) => entry.names.some((name) => normalized === normalizeName(name)))?.id || "";
}

function getKstMonthKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
  }).format(date);
}

function isValidDateKey(value = "") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function normalizeEvent(event = {}, monthKey = "") {
  const sourceKey = String(event.sourceKey || "").trim();
  const trainerName = String(event.trainerName || "").trim();
  const scheduledAt = String(event.scheduledAt || "").trim();
  const endedAt = String(event.endedAt || "").trim();
  const sessionType = ["paid", "free", "other"].includes(event.sessionType) ? event.sessionType : "paid";
  const status = ["scheduled", "completed", "cancelled", "no-show", "postponed"].includes(event.status) ? event.status : "scheduled";
  if (!/^[a-f0-9]{64}$/i.test(sourceKey) || !trainerName || !scheduledAt || getKstMonthKey(scheduledAt) !== monthKey) return null;
  if (endedAt && Number.isNaN(new Date(endedAt).getTime())) return null;
  return {
    sourceKey,
    trainerName,
    memberName: String(event.memberName || "").replace(/\s+/g, " ").trim().slice(0, 80),
    trainerEmployeeId: resolveEmployeeId(trainerName),
    scheduledAt: new Date(scheduledAt).toISOString(),
    endedAt: endedAt ? new Date(endedAt).toISOString() : null,
    sessionType,
    status,
    classLabel: String(event.classLabel || "PT 수업").replace(/\s+/g, " ").trim().slice(0, 80) || "PT 수업",
  };
}

async function verifyUser(request) {
  const authorization = String(request.headers.authorization || "");
  if (!authorization.startsWith("Bearer ")) return null;
  const result = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: process.env.SUPABASE_ANON_KEY || "", Authorization: authorization } });
  if (!result.ok) return null;
  return result.json().catch(() => null);
}

async function loadProfileAccess(request, user) {
  const authorization = String(request.headers.authorization || "");
  const result = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,name,nickname,role,workplace,access_preset,permissions,approval_status&limit=1`, {
    headers: { apikey: process.env.SUPABASE_ANON_KEY || "", Authorization: authorization },
  });
  if (!result.ok) return null;
  const [profile] = await result.json().catch(() => []);
  if (!profile || profile.approval_status !== "approved") return null;
  const permissions = profile.permissions && typeof profile.permissions === "object" ? profile.permissions : {};
  const roleText = `${profile.role || ""} ${profile.workplace || ""}`;
  const canViewAll = /대표|센터장|관리자|owner|manager|admin/i.test(roleText)
    || ["owner", "executive_delegate", "operations_admin", "site_manager"].includes(String(profile.access_preset || ""))
    || Boolean(permissions.worklogAll || permissions.controlTower || permissions.siteControl);
  return { profile, canViewAll };
}

async function handleUserRequest(request, response) {
  const user = await verifyUser(request);
  const access = user ? await loadProfileAccess(request, user) : null;
  if (!user || !access) return response.status(401).json({ ok: false, error: "로그인이 필요합니다." });
  if (request.method === "GET") {
    const monthKey = String(request.query?.monthKey || "").trim();
    if (!/^\d{4}-\d{2}$/.test(monthKey)) return response.status(400).json({ ok: false, error: "기준월 형식이 올바르지 않습니다." });
    const fields = "id,month_key,trainer_name,trainer_employee_id,trainer_profile_id,member_name_ciphertext,scheduled_at,ended_at,session_type,status,status_source,postponed_to,class_label,active,source_updated_at,updated_at";
    const basePath = `/rest/v1/dagym_pt_schedule_events?center_key=eq.${CENTER_KEY}&month_key=eq.${monthKey}&active=eq.true&select=${fields}&order=scheduled_at.asc&limit=2500`;
    const ownNames = [access.profile.name, access.profile.nickname].map(normalizeName).filter(Boolean);
    let visibleRows;
    if (access.canViewAll) {
      visibleRows = await supabaseRequest(basePath);
    } else {
      const [mappedRows, unmappedRows] = await Promise.all([
        supabaseRequest(`${basePath}&trainer_profile_id=eq.${encodeURIComponent(user.id)}`),
        supabaseRequest(`${basePath}&trainer_profile_id=is.null`),
      ]);
      visibleRows = [...new Map([
        ...mappedRows,
        ...unmappedRows.filter((row) => ownNames.includes(normalizeName(row.trainer_name))),
      ].map((row) => [row.id, row])).values()];
    }
    return response.status(200).json({ ok: true, rows: visibleRows.map((row) => ({ ...row, member_name: decrypt(row.member_name_ciphertext), member_name_ciphertext: undefined })) });
  }
  if (request.method === "PATCH") {
    const id = String(request.body?.id || "").trim();
    const status = String(request.body?.status || "").trim();
    const postponedTo = String(request.body?.postponedTo || "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(id) || !["scheduled", "completed", "cancelled", "no-show", "postponed"].includes(status)) {
      return response.status(400).json({ ok: false, error: "수업 상태값이 올바르지 않습니다." });
    }
    if (postponedTo && !isValidDateKey(postponedTo)) return response.status(400).json({ ok: false, error: "연기 날짜가 올바르지 않습니다." });
    const [row] = await supabaseRequest(`/rest/v1/dagym_pt_schedule_events?id=eq.${encodeURIComponent(id)}&select=id,trainer_profile_id&limit=1`);
    if (!row || (!access.canViewAll && row.trainer_profile_id !== user.id)) return response.status(403).json({ ok: false, error: "이 수업을 변경할 권한이 없습니다." });
    await supabaseRequest(`/rest/v1/dagym_pt_schedule_events?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status, status_source: "worklog", postponed_to: status === "postponed" ? (postponedTo || null) : null, updated_at: new Date().toISOString() }),
    });
    return response.status(200).json({ ok: true, id, status, postponedTo: status === "postponed" ? postponedTo : "" });
  }
  return response.status(405).json({ ok: false, error: "지원하지 않는 요청입니다." });
}

async function supabaseRequest(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`운영 DB 반영 오류 (${response.status}): ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : [];
}

async function loadFitnessProfiles() {
  return supabaseRequest("/rest/v1/profiles?approval_status=eq.approved&select=id,name,nickname,email,role,workplace", {
    headers: { Accept: "application/json" },
  });
}

function resolveTrainerProfileId(event, profiles = []) {
  const target = normalizeName(event.trainerName);
  if (!target) return null;
  const exact = profiles.filter((profile) => (
    /피트니스|fitness/i.test(`${profile.workplace || ""} ${profile.role || ""}`)
    && [profile.name, profile.nickname].map(normalizeName).filter(Boolean).includes(target)
  ));
  return exact.length === 1 ? exact[0].id : null;
}

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (["GET", "PATCH"].includes(request.method)) {
    try { return await handleUserRequest(request, response); }
    catch (error) { return response.status(500).json({ ok: false, error: error.message || "수업일정 처리에 실패했습니다." }); }
  }
  if (request.method !== "POST") return response.status(405).json({ ok: false, error: "POST only" });
  if (!SERVICE_ROLE_KEY || !SYNC_SECRET || !CONTACT_SECRET) {
    return response.status(501).json({ ok: false, error: "다짐 월간 일정 동기화 환경설정이 필요합니다." });
  }
  const suppliedSecret = String(request.headers["x-dagym-sync-secret"] || request.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!secureEqual(suppliedSecret, SYNC_SECRET)) return response.status(401).json({ ok: false, error: "동기화 인증에 실패했습니다." });

  const monthKey = String(request.body?.monthKey || "").trim();
  const centerKey = String(request.body?.centerKey || CENTER_KEY).trim() || CENTER_KEY;
  const incoming = Array.isArray(request.body?.events) ? request.body.events : [];
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return response.status(400).json({ ok: false, error: "기준월 형식이 올바르지 않습니다." });
  if (incoming.length > MAX_EVENTS) return response.status(413).json({ ok: false, error: "월간 일정 건수가 허용 범위를 초과했습니다." });

  const normalized = incoming.map((event) => normalizeEvent(event, monthKey)).filter(Boolean);
  const uniqueEvents = [...new Map(normalized.map((event) => [event.sourceKey, event])).values()];
  if (incoming.length && !uniqueEvents.length) return response.status(422).json({ ok: false, error: "유효한 PT 일정을 찾지 못했습니다." });
  const confirmsEmpty = request.body?.confirmEmpty === true;
  const complete = request.body?.complete === true && (uniqueEvents.length > 0 || confirmsEmpty);
  const syncId = crypto.randomUUID();

  try {
    const profiles = await loadFitnessProfiles();
    const existingRows = uniqueEvents.length
      ? await supabaseRequest(`/rest/v1/dagym_pt_schedule_events?center_key=eq.${encodeURIComponent(centerKey)}&month_key=eq.${encodeURIComponent(monthKey)}&select=source_key,status,status_source,postponed_to&limit=2500`)
      : [];
    const existingBySource = new Map(existingRows.map((row) => [row.source_key, row]));
    const rows = uniqueEvents.map((event) => {
      const existing = existingBySource.get(event.sourceKey);
      const keepWorklogStatus = existing?.status_source === "worklog";
      return ({
      center_key: centerKey,
      month_key: monthKey,
      source_key: event.sourceKey,
      trainer_name: event.trainerName,
      trainer_employee_id: event.trainerEmployeeId,
      trainer_profile_id: resolveTrainerProfileId(event, profiles),
      member_name_ciphertext: encrypt(event.memberName),
      scheduled_at: event.scheduledAt,
      ended_at: event.endedAt,
      session_type: event.sessionType,
      status: keepWorklogStatus ? existing.status : event.status,
      status_source: keepWorklogStatus ? "worklog" : "dagym",
      postponed_to: keepWorklogStatus ? existing.postponed_to : null,
      class_label: event.classLabel,
      sync_id: syncId,
      active: true,
      source: "dagym-browser-monthly",
      source_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      });
    });
    for (let index = 0; index < rows.length; index += 250) {
      await supabaseRequest("/rest/v1/dagym_pt_schedule_events?on_conflict=center_key,source_key", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(rows.slice(index, index + 250)),
      });
    }
    if (complete) {
      await supabaseRequest(`/rest/v1/dagym_pt_schedule_events?center_key=eq.${encodeURIComponent(centerKey)}&month_key=eq.${encodeURIComponent(monthKey)}&sync_id=neq.${encodeURIComponent(syncId)}&active=eq.true`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ active: false, updated_at: new Date().toISOString() }),
      });
    }
    const unmappedTrainers = [...new Set(rows.filter((row) => !row.trainer_profile_id).map((row) => row.trainer_name))];
    return response.status(200).json({
      ok: true,
      monthKey,
      received: incoming.length,
      saved: rows.length,
      complete,
      unmappedTrainers,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    return response.status(500).json({ ok: false, error: error.message || "월간 PT 일정 저장에 실패했습니다." });
  }
};

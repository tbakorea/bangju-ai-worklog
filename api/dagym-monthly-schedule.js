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
// 초기 설정 화면에서 첫 글자 M이 빠진 이름으로 저장된 사례도 안전하게 복구한다.
const CONTACT_SECRET = String(process.env.MEMBER_CONTACT_ENCRYPTION_KEY || process.env.EMBER_CONTACT_ENCRYPTION_KEY || "");
const MAX_EVENTS = 2500;
const CENTER_KEY = "beyond-fitness";
const CLASS_STATUSES = ["scheduled", "completed", "cancelled", "no-show", "postponed"];
const SESSION_TYPES = ["paid", "free", "other"];

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

function getKstDateKey(value = "") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function normalizeWorklogLabel(value = "", maxLength = 80) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function isWorklogOverrideColumnError(error) {
  return /worklog_(member_name_ciphertext|scheduled_at|ended_at|session_type|class_label|note_ciphertext|trainer_request_employee_id|trainer_request_status|trainer_request_at|override_at)|column .*worklog|schema cache/i
    .test(String(error?.message || error || ""));
}

function serializeScheduleRow(row = {}) {
  const hasWorklogOverride = Boolean(
    row.worklog_override_at
    || row.worklog_scheduled_at
    || row.worklog_session_type
    || row.worklog_class_label
    || row.worklog_member_name_ciphertext
    || row.worklog_note_ciphertext
    || row.worklog_trainer_request_employee_id
    || row.worklog_trainer_request_status === "requested"
    || row.worklog_trainer_request_status === "approved"
    || row.worklog_trainer_request_status === "declined"
  );
  const sourceMemberName = decrypt(row.member_name_ciphertext);
  const worklogMemberName = decrypt(row.worklog_member_name_ciphertext);
  const worklogNote = decrypt(row.worklog_note_ciphertext);
  return {
    ...row,
    source_scheduled_at: row.scheduled_at,
    source_ended_at: row.ended_at,
    source_session_type: row.session_type,
    source_class_label: row.class_label,
    source_member_name: sourceMemberName,
    scheduled_at: row.worklog_scheduled_at || row.scheduled_at,
    ended_at: row.worklog_ended_at || row.ended_at,
    session_type: row.worklog_session_type || row.session_type,
    class_label: row.worklog_class_label || row.class_label,
    member_name: worklogMemberName || sourceMemberName,
    worklog_note: worklogNote,
    trainer_change_employee_id: row.worklog_trainer_request_employee_id || "",
    trainer_change_status: row.worklog_trainer_request_status || "none",
    trainer_change_requested_at: row.worklog_trainer_request_at || null,
    has_worklog_override: hasWorklogOverride,
    member_name_ciphertext: undefined,
    worklog_member_name_ciphertext: undefined,
    worklog_note_ciphertext: undefined,
  };
}

function normalizeEvent(event = {}, monthKey = "") {
  const sourceKey = String(event.sourceKey || "").trim();
  const trainerName = String(event.trainerName || "").trim();
  const scheduledAt = String(event.scheduledAt || "").trim();
  const endedAt = String(event.endedAt || "").trim();
  const sessionType = SESSION_TYPES.includes(event.sessionType) ? event.sessionType : "paid";
  const status = CLASS_STATUSES.includes(event.status) ? event.status : "scheduled";
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
  const result = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: authorization } });
  if (!result.ok) return null;
  return result.json().catch(() => null);
}

async function loadProfileAccess(request, user) {
  const authorization = String(request.headers.authorization || "");
  const profileBaseUrl = `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&limit=1&select=`;
  const selectCandidates = [
    "id,name,nickname,role,workplace,access_preset,permissions,approval_status",
    "id,name,nickname,role,workplace,approval_status",
    "id,name,role,workplace,approval_status",
  ];
  let profile = null;
  for (const fields of selectCandidates) {
    const result = await fetch(`${profileBaseUrl}${fields}`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: authorization },
    });
    if (!result.ok) continue;
    [profile] = await result.json().catch(() => []);
    break;
  }
  if (!profile || profile.approval_status !== "approved") return null;
  const permissions = profile.permissions && typeof profile.permissions === "object" ? profile.permissions : {};
  const roleText = `${profile.role || ""} ${profile.workplace || ""}`;
  const canViewAll = /대표|센터장|관리자|owner|manager|admin/i.test(roleText)
    || ["owner", "executive_delegate", "operations_admin", "site_manager"].includes(String(profile.access_preset || ""))
    || Boolean(permissions.worklogAll || permissions.controlTower || permissions.siteControl);
  return { profile, canViewAll };
}

async function authorizeSyncRequest(request) {
  const suppliedSecret = String(request.headers["x-dagym-sync-secret"] || "").trim();
  if (SYNC_SECRET && secureEqual(suppliedSecret, SYNC_SECRET)) return true;
  const user = await verifyUser(request);
  const access = user ? await loadProfileAccess(request, user) : null;
  return Boolean(user && access?.canViewAll);
}

async function handleUserRequest(request, response) {
  const user = await verifyUser(request);
  const access = user ? await loadProfileAccess(request, user) : null;
  if (!user || !access) return response.status(401).json({ ok: false, error: "로그인이 필요합니다." });
  if (request.method === "GET") {
    const monthKey = String(request.query?.monthKey || "").trim();
    if (!/^\d{4}-\d{2}$/.test(monthKey)) return response.status(400).json({ ok: false, error: "기준월 형식이 올바르지 않습니다." });
    const sourceFields = "id,month_key,trainer_name,trainer_employee_id,trainer_profile_id,member_name_ciphertext,scheduled_at,ended_at,session_type,status,status_source,postponed_to,class_label,active,source_updated_at,updated_at";
    const fields = `${sourceFields},worklog_member_name_ciphertext,worklog_scheduled_at,worklog_ended_at,worklog_session_type,worklog_class_label,worklog_note_ciphertext,worklog_trainer_request_employee_id,worklog_trainer_request_status,worklog_trainer_request_at,worklog_override_at`;
    const makeBasePath = (selectFields) => `/rest/v1/dagym_pt_schedule_events?center_key=eq.${CENTER_KEY}&month_key=eq.${monthKey}&active=eq.true&select=${selectFields}&order=scheduled_at.asc&limit=2500`;
    const basePath = makeBasePath(fields);
    const legacyBasePath = makeBasePath(sourceFields);
    const loadRows = async (filter = "") => {
      try {
        return await supabaseRequest(`${basePath}${filter}`);
      } catch (error) {
        if (!isWorklogOverrideColumnError(error)) throw error;
        return supabaseRequest(`${legacyBasePath}${filter}`);
      }
    };
    const ownNames = [access.profile.name, access.profile.nickname].map(normalizeName).filter(Boolean);
    let visibleRows;
    if (access.canViewAll) {
      visibleRows = await loadRows();
    } else {
      const [mappedRows, unmappedRows] = await Promise.all([
        loadRows(`&trainer_profile_id=eq.${encodeURIComponent(user.id)}`),
        loadRows("&trainer_profile_id=is.null"),
      ]);
      visibleRows = [...new Map([
        ...mappedRows,
        ...unmappedRows.filter((row) => ownNames.includes(normalizeName(row.trainer_name))),
      ].map((row) => [row.id, row])).values()];
    }
    return response.status(200).json({ ok: true, rows: visibleRows.map(serializeScheduleRow) });
  }
  if (request.method === "PATCH") {
    const id = String(request.body?.id || "").trim();
    const hasStatus = hasOwn(request.body, "status");
    const status = String(request.body?.status || "").trim();
    const postponedTo = String(request.body?.postponedTo || "").trim();
    const override = request.body?.override && typeof request.body.override === "object" ? request.body.override : null;
    const hasOverride = Boolean(override && (override.reset === true || ["scheduledAt", "sessionType", "classLabel", "memberName", "note", "trainerChangeEmployeeId", "trainerChangeStatus"].some((key) => hasOwn(override, key))));
    if (!/^[0-9a-f-]{36}$/i.test(id) || (!hasStatus && !hasOverride)) {
      return response.status(400).json({ ok: false, error: "변경할 수업 정보가 올바르지 않습니다." });
    }
    if (hasStatus && !CLASS_STATUSES.includes(status)) {
      return response.status(400).json({ ok: false, error: "수업 상태값이 올바르지 않습니다." });
    }
    if (postponedTo && !isValidDateKey(postponedTo)) return response.status(400).json({ ok: false, error: "연기 날짜가 올바르지 않습니다." });
    const sourceFields = "id,trainer_profile_id,member_name_ciphertext,scheduled_at,ended_at,session_type,status,status_source,postponed_to,class_label";
    const fields = `${sourceFields},worklog_member_name_ciphertext,worklog_scheduled_at,worklog_ended_at,worklog_session_type,worklog_class_label,worklog_note_ciphertext,worklog_trainer_request_employee_id,worklog_trainer_request_status,worklog_trainer_request_at,worklog_override_at`;
    let row;
    try {
      [row] = await supabaseRequest(`/rest/v1/dagym_pt_schedule_events?id=eq.${encodeURIComponent(id)}&select=${fields}&limit=1`);
    } catch (error) {
      if (!isWorklogOverrideColumnError(error)) throw error;
      if (hasOverride) return response.status(503).json({ ok: false, error: "수업 일정 수정 기능을 준비하고 있습니다. 잠시 후 다시 시도해주세요." });
      [row] = await supabaseRequest(`/rest/v1/dagym_pt_schedule_events?id=eq.${encodeURIComponent(id)}&select=${sourceFields}&limit=1`);
    }
    if (!row || (!access.canViewAll && row.trainer_profile_id !== user.id)) return response.status(403).json({ ok: false, error: "이 수업을 변경할 권한이 없습니다." });

    const updatedAt = new Date().toISOString();
    const update = { updated_at: updatedAt };
    if (hasStatus) {
      update.status = status;
      update.status_source = "worklog";
      update.postponed_to = status === "postponed" ? (postponedTo || null) : null;
    }
    if (hasOverride) {
      if (override.reset === true) {
        Object.assign(update, {
          worklog_member_name_ciphertext: "",
          worklog_scheduled_at: null,
          worklog_ended_at: null,
          worklog_session_type: null,
          worklog_class_label: null,
          worklog_note_ciphertext: "",
          worklog_trainer_request_employee_id: null,
          worklog_trainer_request_status: "none",
          worklog_trainer_request_at: null,
          worklog_override_at: null,
        });
      } else {
        if (hasOwn(override, "scheduledAt")) {
          const nextStart = new Date(String(override.scheduledAt || ""));
          const sourceStart = new Date(row.scheduled_at);
          if (Number.isNaN(nextStart.getTime()) || Number.isNaN(sourceStart.getTime()) || getKstDateKey(nextStart) !== getKstDateKey(sourceStart)) {
            return response.status(400).json({ ok: false, error: "수업 시간은 같은 날짜 안에서만 수정할 수 있습니다. 날짜 변경은 연기 기능을 사용해주세요." });
          }
          update.worklog_scheduled_at = nextStart.toISOString();
          const sourceEnd = new Date(row.ended_at || "");
          update.worklog_ended_at = Number.isNaN(sourceEnd.getTime())
            ? null
            : new Date(nextStart.getTime() + Math.max(0, sourceEnd.getTime() - sourceStart.getTime())).toISOString();
        }
        if (hasOwn(override, "sessionType")) {
          const sessionType = String(override.sessionType || "").trim();
          if (!SESSION_TYPES.includes(sessionType)) return response.status(400).json({ ok: false, error: "수업 구분이 올바르지 않습니다." });
          update.worklog_session_type = sessionType;
        }
        if (hasOwn(override, "classLabel")) update.worklog_class_label = normalizeWorklogLabel(override.classLabel) || null;
        if (hasOwn(override, "memberName")) update.worklog_member_name_ciphertext = encrypt(normalizeWorklogLabel(override.memberName));
        if (hasOwn(override, "note")) update.worklog_note_ciphertext = encrypt(normalizeWorklogLabel(override.note, 500));
        if (hasOwn(override, "trainerChangeEmployeeId")) {
          const nextEmployeeId = String(override.trainerChangeEmployeeId || "").trim();
          if (nextEmployeeId && !/^[A-Za-z0-9_-]{2,120}$/.test(nextEmployeeId)) {
            return response.status(400).json({ ok: false, error: "강사 변경 요청 대상이 올바르지 않습니다." });
          }
          update.worklog_trainer_request_employee_id = nextEmployeeId || null;
          update.worklog_trainer_request_status = nextEmployeeId ? "requested" : "none";
          update.worklog_trainer_request_at = nextEmployeeId ? updatedAt : null;
        }
        if (hasOwn(override, "trainerChangeStatus")) {
          const requestStatus = String(override.trainerChangeStatus || "").trim() || "none";
          if (!["none", "requested", "approved", "declined"].includes(requestStatus)) {
            return response.status(400).json({ ok: false, error: "강사 변경 요청 상태가 올바르지 않습니다." });
          }
          if (!access.canViewAll && !["none", "requested"].includes(requestStatus)) {
            return response.status(403).json({ ok: false, error: "강사 변경 요청의 승인·반려는 관리자만 할 수 있습니다." });
          }
          update.worklog_trainer_request_status = requestStatus;
          update.worklog_trainer_request_at = requestStatus === "requested" ? updatedAt : (row.worklog_trainer_request_at || null);
        }
        update.worklog_override_at = updatedAt;
      }
    }
    await supabaseRequest(`/rest/v1/dagym_pt_schedule_events?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(update),
    });
    return response.status(200).json({
      ok: true,
      id,
      status: hasStatus ? status : row.status,
      postponedTo: hasStatus && status === "postponed" ? postponedTo : (row.postponed_to || ""),
      event: serializeScheduleRow({ ...row, ...update }),
    });
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
  const selectCandidates = [
    "id,name,nickname,email,role,workplace",
    "id,name,email,role,workplace",
    "id,name,role,workplace",
  ];
  let lastError = null;
  for (const fields of selectCandidates) {
    try {
      return await supabaseRequest(`/rest/v1/profiles?approval_status=eq.approved&select=${fields}`, {
        headers: { Accept: "application/json" },
      });
    } catch (error) {
      lastError = error;
      if (!/column profiles\.[a-z_]+ does not exist/i.test(String(error?.message || ""))) throw error;
    }
  }
  throw lastError || new Error("승인된 직원 정보를 불러오지 못했습니다.");
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
  if (!SERVICE_ROLE_KEY || !CONTACT_SECRET) {
    const missing = [
      !SERVICE_ROLE_KEY && (configuredServiceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY(실제 키로 다시 저장 필요)" : "SUPABASE_SERVICE_ROLE_KEY"),
      !CONTACT_SECRET && "MEMBER_CONTACT_ENCRYPTION_KEY",
    ].filter(Boolean);
    return response.status(501).json({ ok: false, error: "다짐 월간 일정 동기화 환경설정이 필요합니다.", missing });
  }
  if (!(await authorizeSyncRequest(request))) return response.status(401).json({ ok: false, error: "동기화 인증에 실패했습니다." });

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

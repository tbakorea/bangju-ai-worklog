const crypto = require("crypto");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://zllpfaijahyfppivkxzu.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const CONTACT_SECRET = process.env.MEMBER_CONTACT_ENCRYPTION_KEY || "";
const DEFAULT_ORIGIN = "https://bangju-ai-worklog.vercel.app";

function allowedOrigin(request) {
  const origin = String(request.headers.origin || "");
  return origin === DEFAULT_ORIGIN || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ? origin : DEFAULT_ORIGIN;
}

async function verifyUser(request) {
  const authorization = String(request.headers.authorization || "");
  if (!authorization.startsWith("Bearer ")) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: authorization } });
  if (!response.ok) return null;
  return response.json().catch(() => null);
}

async function loadAccess(request, user) {
  const authorization = String(request.headers.authorization || "");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=name,email,role,primary_work,workplace,access_preset,permissions,approval_status`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: authorization },
  });
  if (!response.ok) return null;
  const [profile] = await response.json().catch(() => []);
  if (!profile || profile.approval_status !== "approved") return null;
  const permissions = profile.permissions && typeof profile.permissions === "object" ? profile.permissions : {};
  const identity = [user.id, user.email, profile.email, profile.name].map((value) => String(value || "").trim().toLowerCase()).filter(Boolean);
  const roleText = `${profile.role || ""} ${profile.primary_work || ""}`;
  const fitnessScope = /피트니스|fitness/i.test(String(profile.workplace || ""));
  const isManager = /대표|owner/i.test(roleText)
    || ["owner", "executive_delegate", "operations_admin"].includes(String(profile.access_preset || ""))
    || (fitnessScope && String(profile.access_preset || "") === "site_manager")
    || (fitnessScope && /센터장|관리자|manager|admin/i.test(roleText))
    || Boolean(permissions.controlTower || permissions.worklogAll || (fitnessScope && permissions.siteControl));
  const isTrainer = /트레이너|trainer|pt/i.test(roleText);
  const isInfo = /인포|프론트|데스크|info|front/i.test(roleText);
  return { profile, identity, isManager, isTrainer, isInfo };
}

function serviceHeaders(extra = {}) {
  return { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", ...extra };
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

function normalizePhone(value = "") {
  return String(value).replace(/[^0-9+]/g, "").slice(0, 20);
}

function maskPhone(value = "") {
  const digits = normalizePhone(value);
  if (digits.length < 7) return "연락처 등록";
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

function hashMember(centerKey, externalMemberId) {
  return crypto.createHmac("sha256", encryptionKey()).update(`${centerKey}:${externalMemberId}`).digest("hex");
}

function candidateLabel(expiry = "") {
  if (!expiry) return { priority: "normal", label: "만료일 확인 필요", days: null };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${expiry}T00:00:00`);
  const days = Math.round((target - today) / 86400000);
  if (days < 0) return { priority: "urgent", label: `만료 ${Math.abs(days)}일 경과`, days };
  if (days <= 7) return { priority: "urgent", label: `만료 D-${days}`, days };
  if (days <= 30) return { priority: "attention", label: `만료 D-${days}`, days };
  return { priority: "normal", label: `만료 D-${days}`, days };
}

async function rest(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...options, headers: serviceHeaders(options.headers) });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `회원관리 처리 오류 (${response.status})`);
  return text ? JSON.parse(text) : null;
}

async function audit(userId, memberId, action, purpose, metadata = {}) {
  await rest("member_contact_audit_logs", { method: "POST", body: JSON.stringify({ actor_id: userId, member_id: memberId || null, action, purpose, metadata }) });
}

function isAssignedTo(access, assignedEmployeeId = "") {
  const assignee = String(assignedEmployeeId || "").trim().toLowerCase();
  return Boolean(assignee && access.identity.some((value) => assignee === value || assignee.includes(value) || value.includes(assignee)));
}

async function listMembers(user, access) {
  const [members, consents, contracts, sessions] = await Promise.all([
    rest("fitness_members?select=id,center_key,name_ciphertext,phone_ciphertext,assigned_employee_id,status,updated_at&order=updated_at.desc&limit=500"),
    rest("member_consents?select=member_id,required_use_consent,marketing_consent,sms_consent,kakao_consent,app_push_consent,consent_source,consent_version,evidence_reference,consented_at,withdrawn_at"),
    rest("member_contracts?select=member_id,contract_type,expires_on,pt_remaining_count,status,updated_at&order=expires_on.desc.nullslast&limit=1500"),
    rest(`member_pt_sessions?scheduled_at=gte.${new Date(Date.now() - 86400000).toISOString()}&select=member_id,trainer_employee_id,scheduled_at,status,remaining_after&order=scheduled_at.asc&limit=500`),
  ]);
  const consentByMember = new Map(consents.map((row) => [row.member_id, row]));
  const contractByMember = new Map();
  contracts.forEach((row) => { if (!contractByMember.has(row.member_id)) contractByMember.set(row.member_id, row); });
  const sessionsByMember = new Map();
  sessions.forEach((row) => {
    if (!sessionsByMember.has(row.member_id)) sessionsByMember.set(row.member_id, []);
    sessionsByMember.get(row.member_id).push(row);
  });
  const visible = access.isManager ? members : members.filter((row) => isAssignedTo(access, row.assigned_employee_id));
  await audit(user.id, null, "list", "회원 후속관리 현황 확인", { count: visible.length, scope: access.isManager ? "all" : "assigned" });
  return visible.map((row) => {
    const consent = consentByMember.get(row.id) || {};
    const contract = contractByMember.get(row.id) || {};
    const phone = decrypt(row.phone_ciphertext);
    const candidate = candidateLabel(contract.expires_on);
    return {
      id: row.id,
      name: decrypt(row.name_ciphertext),
      maskedPhone: maskPhone(phone),
      membershipExpiresOn: contract.expires_on || null,
      ptRemainingCount: contract.pt_remaining_count ?? null,
      assignedEmployeeId: row.assigned_employee_id,
      requiredUseConsent: Boolean(consent.required_use_consent),
      marketingConsent: Boolean(consent.marketing_consent && !consent.withdrawn_at),
      channelConsents: { sms: Boolean(consent.sms_consent), kakao: Boolean(consent.kakao_consent), appPush: Boolean(consent.app_push_consent) },
      consentSource: consent.consent_source || "",
      consentVersion: consent.consent_version || "",
      consentedAt: consent.consented_at || null,
      status: row.status,
      candidate,
      ptSessions: access.isManager || access.isTrainer ? (sessionsByMember.get(row.id) || []) : [],
    };
  });
}

async function upsertMember(user, access, body) {
  if (!access.isManager) throw new Error("회원 기본정보와 동의는 센터장 또는 대표만 등록할 수 있습니다.");
  const centerKey = String(body.centerKey || "beyond-fitness").trim().slice(0, 80);
  const externalMemberId = String(body.externalMemberId || "").trim().slice(0, 120);
  const name = String(body.name || "").trim().slice(0, 80);
  const phone = normalizePhone(body.phone);
  const requiredUseConsent = Boolean(body.requiredUseConsent ?? body.serviceConsent);
  const marketingConsent = Boolean(body.marketingConsent);
  const smsConsent = Boolean(body.smsConsent);
  const kakaoConsent = Boolean(body.kakaoConsent);
  const appPushConsent = Boolean(body.appPushConsent);
  if (!externalMemberId || !name) throw new Error("회원번호와 회원 이름을 입력해주세요.");
  if (marketingConsent && !requiredUseConsent) throw new Error("필수정보 이용 동의와 광고성 정보 수신 동의를 분리해 확인해주세요.");
  if ((smsConsent || kakaoConsent) && !phone) throw new Error("문자·카카오 수신 동의에는 연락처가 필요합니다.");
  if ((smsConsent || kakaoConsent || appPushConsent) && !marketingConsent) throw new Error("채널 수신 동의에는 광고성 정보 수신 동의가 필요합니다.");
  const now = new Date().toISOString();
  const [member] = await rest("fitness_members?on_conflict=center_key,external_member_hash", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      center_key: centerKey,
      external_member_id_ciphertext: encrypt(externalMemberId),
      external_member_hash: hashMember(centerKey, externalMemberId),
      name_ciphertext: encrypt(name),
      phone_ciphertext: encrypt(phone),
      push_token_ciphertext: encrypt(String(body.pushToken || "").trim()),
      assigned_employee_id: String(body.assignedEmployeeId || "").trim().slice(0, 120),
      status: "active",
      created_by: user.id,
      updated_by: user.id,
      updated_at: now,
    }),
  });
  if (!member?.id) throw new Error("회원 기본정보를 저장하지 못했습니다.");
  await rest("member_consents?on_conflict=member_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      member_id: member.id,
      required_use_consent: requiredUseConsent,
      marketing_consent: marketingConsent,
      sms_consent: smsConsent,
      kakao_consent: kakaoConsent,
      app_push_consent: appPushConsent,
      consent_source: String(body.consentSource || "member-signup").trim().slice(0, 80),
      consent_version: String(body.consentVersion || "2026-08").trim().slice(0, 40),
      evidence_reference: String(body.evidenceReference || "").trim().slice(0, 300),
      consented_at: requiredUseConsent || marketingConsent ? (body.consentedAt || now) : null,
      withdrawn_at: null,
      withdrawal_reason: "",
      updated_by: user.id,
      updated_at: now,
    }),
  });
  const expiry = /^\d{4}-\d{2}-\d{2}$/.test(String(body.membershipExpiresOn || "")) ? body.membershipExpiresOn : null;
  if (expiry) {
    await rest("member_contracts?on_conflict=member_id,external_contract_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ member_id: member.id, external_contract_id: "current-membership", contract_type: "membership", expires_on: expiry, status: "active", source: "dagym", updated_at: now }),
    });
  }
  await audit(user.id, member.id, "upsert-consent", "회원가입 동의 등록", { requiredUseConsent, marketingConsent, smsConsent, kakaoConsent, appPushConsent, consentVersion: body.consentVersion || "2026-08" });
  return member.id;
}

async function revealContact(user, access, memberId, channel = "staff-task") {
  const [members, consents] = await Promise.all([
    rest(`fitness_members?id=eq.${encodeURIComponent(memberId)}&select=id,name_ciphertext,phone_ciphertext,assigned_employee_id,status&limit=1`),
    rest(`member_consents?member_id=eq.${encodeURIComponent(memberId)}&select=required_use_consent,marketing_consent,sms_consent,kakao_consent,app_push_consent,withdrawn_at&limit=1`),
  ]);
  const member = members[0];
  const consent = consents[0];
  if (!member || !consent) throw new Error("회원을 찾지 못했습니다.");
  if (!access.isManager && !isAssignedTo(access, member.assigned_employee_id)) throw new Error("배정받은 회원만 열람할 수 있습니다.");
  const channelAllowed = channel === "sms" ? consent.sms_consent : channel === "kakao" ? consent.kakao_consent : channel === "app-push" ? consent.app_push_consent : true;
  if (!consent.required_use_consent || !consent.marketing_consent || consent.withdrawn_at || !channelAllowed || member.status !== "active") throw new Error("해당 채널의 연락 동의가 유효하지 않습니다.");
  await audit(user.id, member.id, "reveal", "배정 회원 후속 연락", { channel });
  return { name: decrypt(member.name_ciphertext), phone: decrypt(member.phone_ciphertext) };
}

async function withdrawConsent(user, access, memberId) {
  if (!access.isManager) throw new Error("동의 철회 처리는 센터장 또는 대표만 할 수 있습니다.");
  const rows = await rest(`member_consents?member_id=eq.${encodeURIComponent(memberId)}&select=member_id&limit=1`);
  if (!rows[0]) throw new Error("회원을 찾지 못했습니다.");
  const now = new Date().toISOString();
  await rest(`member_consents?member_id=eq.${encodeURIComponent(memberId)}`, {
    method: "PATCH",
    body: JSON.stringify({ marketing_consent: false, sms_consent: false, kakao_consent: false, app_push_consent: false, withdrawn_at: now, withdrawal_reason: "회원 수신 거부", updated_by: user.id, updated_at: now }),
  });
  await audit(user.id, memberId, "withdraw", "광고성 정보 및 채널 수신동의 철회", {});
  return true;
}

async function queueFollowup(user, access, body) {
  const memberId = String(body.memberId || "");
  const [members, consents, contracts] = await Promise.all([
    rest(`fitness_members?id=eq.${encodeURIComponent(memberId)}&select=id,status,assigned_employee_id&limit=1`),
    rest(`member_consents?member_id=eq.${encodeURIComponent(memberId)}&select=required_use_consent,marketing_consent,withdrawn_at&limit=1`),
    rest(`member_contracts?member_id=eq.${encodeURIComponent(memberId)}&status=eq.active&select=expires_on&order=expires_on.desc.nullslast&limit=1`),
  ]);
  const member = members[0];
  const consent = consents[0];
  if (!member || !consent) throw new Error("회원을 찾지 못했습니다.");
  if (!access.isManager && !isAssignedTo(access, member.assigned_employee_id)) throw new Error("배정받은 회원만 후속관리할 수 있습니다.");
  if (!consent.required_use_consent || !consent.marketing_consent || consent.withdrawn_at || member.status !== "active") throw new Error("재가입 연락 동의가 유효하지 않습니다.");
  const candidate = candidateLabel(contracts[0]?.expires_on);
  const actionType = ["renewal", "consultation", "recontact", "retention", "pt-followup"].includes(String(body.actionType || "")) ? body.actionType : "renewal";
  if (actionType === "renewal" && (candidate.days === null || candidate.days > 30)) throw new Error("재가입 후속업무는 만료 30일 전부터 생성할 수 있습니다.");
  const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(String(body.dueDate || "")) ? body.dueDate : new Date().toISOString().slice(0, 10);
  const contactDueAt = `${dateKey}T09:00:00+09:00`;
  const existing = await rest(`member_followups?member_id=eq.${encodeURIComponent(member.id)}&action_type=eq.${encodeURIComponent(actionType)}&contact_due_at=gte.${encodeURIComponent(`${dateKey}T00:00:00+09:00`)}&contact_due_at=lt.${encodeURIComponent(`${dateKey}T23:59:59+09:00`)}&status=not.in.(cancelled,failed)&select=id,status,contact_due_at&limit=1`);
  if (existing[0]) return existing[0];
  const [queued] = await rest("member_followups", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      member_id: member.id,
      action_type: actionType,
      channel: "staff-task",
      reason: String(body.reason || candidate.label).slice(0, 300),
      priority: candidate.priority,
      contact_due_on: dateKey,
      contact_due_at: contactDueAt,
      assigned_employee_id: String(body.assignedEmployeeId || member.assigned_employee_id || "").slice(0, 120),
      status: "pending",
      created_by: user.id,
      updated_by: user.id,
    }),
  });
  await audit(user.id, member.id, "queue", "회원 후속업무 생성", { dateKey, actionType });
  return queued || { member_id: member.id, contact_due_at: contactDueAt, status: "pending" };
}

module.exports = async function handler(request, response) {
  response.setHeader("Access-Control-Allow-Origin", allowedOrigin(request));
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.setHeader("Cache-Control", "no-store");
  if (request.method === "OPTIONS") return response.status(204).end();
  if (!["GET", "POST"].includes(request.method)) return response.status(405).json({ ok: false, error: "GET/POST only" });
  if (!SUPABASE_ANON_KEY || !SERVICE_KEY || !CONTACT_SECRET) return response.status(501).json({ ok: false, error: "회원 연락 보안 환경설정이 필요합니다." });
  const user = await verifyUser(request).catch(() => null);
  if (!user?.id) return response.status(401).json({ ok: false, error: "로그인이 필요합니다." });
  const access = await loadAccess(request, user).catch(() => null);
  if (!access) return response.status(403).json({ ok: false, error: "승인된 직원만 회원관리를 사용할 수 있습니다." });
  try {
    if (request.method === "GET") return response.status(200).json({ ok: true, access: { canManage: access.isManager }, members: await listMembers(user, access) });
    const action = String(request.body?.action || "upsert");
    if (action === "upsert") return response.status(200).json({ ok: true, id: await upsertMember(user, access, request.body || {}) });
    if (action === "reveal") return response.status(200).json({ ok: true, contact: await revealContact(user, access, request.body?.memberId, request.body?.channel) });
    if (action === "queue") return response.status(200).json({ ok: true, followup: await queueFollowup(user, access, request.body || {}) });
    if (action === "withdraw") return response.status(200).json({ ok: true, withdrawn: await withdrawConsent(user, access, request.body?.memberId) });
    return response.status(400).json({ ok: false, error: "지원하지 않는 처리입니다." });
  } catch (error) {
    console.error("Member outreach API failed", error.message);
    return response.status(400).json({ ok: false, error: error.message || "회원 연락 정보를 처리하지 못했습니다." });
  }
};

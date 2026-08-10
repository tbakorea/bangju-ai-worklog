const SUPABASE_URL = process.env.SUPABASE_URL || "https://zllpfaijahyfppivkxzu.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpsbHBmYWlqYWh5ZnBwaXZreHp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzMzQxNTUsImV4cCI6MjA5ODkxMDE1NX0.C4omaj-e_9PM-iF3-5GUUVX47Wo06UsNTOYMlMMVcZU";
const DEFAULT_ORIGIN = "https://bangju-ai-worklog.vercel.app";
const MAX_RESPONSE_BYTES = 512000;
const METRIC_KEYS = ["visits", "newMembers", "renewals", "expiring", "ptBookings", "noShows", "lockerExpiring", "sales"];

const metricMatchers = {
  visits: /^(visits?|attendance|attendances|checkins?|entries|entrycount|출석|입장|방문|출석수|방문수)$/i,
  newMembers: /^(newmembers?|newregistrations?|newcustomers?|신규|신규등록|신규회원)$/i,
  renewals: /^(renewals?|reregistrations?|extensions?|재등록|연장|갱신)$/i,
  expiring: /^(expiring|expiringmembers?|expirationcount|만료예정|만료회원|만료대상)$/i,
  ptBookings: /^(ptbookings?|ptreservations?|classbookings?|수업예약|pt예약|피티예약)$/i,
  noShows: /^(noshows?|cancellations?|absences?|노쇼|취소|결석|예약취소)$/i,
  lockerExpiring: /^(lockerexpiring|lockerexpirations?|만료락커|락커만료)$/i,
  sales: /^(sales|revenue|paymentamount|payments|totalsales|매출|매출액|결제|결제금액)$/i,
};

function getAllowedOrigin(request) {
  const origin = String(request.headers.origin || "");
  if (origin === DEFAULT_ORIGIN || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return DEFAULT_ORIGIN;
}

async function verifySupabaseUser(request) {
  const authorization = String(request.headers.authorization || "");
  if (!authorization.startsWith("Bearer ")) return null;
  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: authorization },
  });
  if (!userResponse.ok) return null;
  return userResponse.json().catch(() => null);
}

async function verifyDagymManager(request, user) {
  const authorization = String(request.headers.authorization || "");
  const profileResponse = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role,workplace,access_preset,permissions,approval_status`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: authorization },
  });
  if (!profileResponse.ok) return false;
  const [profile] = await profileResponse.json().catch(() => []);
  if (!profile || profile.approval_status !== "approved") return false;
  const role = String(profile.role || "").toLowerCase();
  const workplace = String(profile.workplace || "").toLowerCase();
  const preset = String(profile.access_preset || "").toLowerCase();
  const permissions = profile.permissions && typeof profile.permissions === "object" ? profile.permissions : {};
  return /대표|ceo|owner/.test(role)
    || ["owner", "executive_delegate", "operations_admin"].includes(preset)
    || (preset === "site_manager" && /피트니스|fitness/.test(workplace))
    || Boolean(permissions.controlTower || permissions.worklogAll)
    || (/센터장|manager/.test(role) && /피트니스|fitness/.test(workplace));
}

function normalizeKey(value = "") {
  return String(value || "").replace(/[\s_./()\-[\]]+/g, "").trim().toLowerCase();
}

function normalizeNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? Math.max(0, value) : null;
  const cleaned = String(value ?? "").replace(/[^\d.-]/g, "");
  if (!cleaned || !/[\d]/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
}

function matchMetricKey(label = "") {
  const key = normalizeKey(label);
  return METRIC_KEYS.find((metric) => metricMatchers[metric].test(key)) || "";
}

function collectJsonMetrics(value, output = {}, depth = 0) {
  if (!value || depth > 5) return output;
  if (Array.isArray(value)) {
    value.forEach((item) => collectJsonMetrics(item, output, depth + 1));
    return output;
  }
  if (typeof value !== "object") return output;
  const label = value.label ?? value.name ?? value.title ?? value.metric ?? value.type;
  const metricFromLabel = matchMetricKey(label);
  if (metricFromLabel) {
    const candidate = value.value ?? value.count ?? value.total ?? value.amount;
    const number = normalizeNumber(candidate);
    if (number !== null) output[metricFromLabel] = number;
  }
  Object.entries(value).forEach(([key, item]) => {
    const metric = matchMetricKey(key);
    if (metric) {
      const candidate = typeof item === "object" && item !== null
        ? item.value ?? item.count ?? item.total ?? item.amount
        : item;
      const number = normalizeNumber(candidate);
      if (number !== null) output[metric] = number;
    }
    if (typeof item === "object" && item !== null) collectJsonMetrics(item, output, depth + 1);
  });
  return output;
}

function splitDelimitedLine(line = "", delimiter = ",") {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else cell += character;
  }
  cells.push(cell.trim());
  return cells;
}

function collectTextMetrics(text = "") {
  const lines = String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  const output = {};
  lines.forEach((line) => {
    const delimiter = line.includes("\t") ? "\t" : ",";
    const cells = splitDelimitedLine(line, delimiter);
    cells.forEach((cell, index) => {
      const metric = matchMetricKey(cell);
      if (!metric) return;
      const remainder = cells.slice(index + 1);
      const joinedNumber = remainder.length > 1 && remainder.every((part) => /^\s*[\d,.]+\s*$/.test(part))
        ? remainder.join("")
        : cells[index + 1];
      const number = normalizeNumber(joinedNumber);
      if (number !== null) output[metric] = number;
    });
  });
  return output;
}

function buildProviderUrl(dateKey) {
  const configured = String(process.env.DAGYM_SYNC_URL || "").trim();
  if (!configured) return null;
  const centerId = String(process.env.DAGYM_CENTER_ID || "").trim();
  const expanded = configured
    .replaceAll("{date}", encodeURIComponent(dateKey))
    .replaceAll("{centerId}", encodeURIComponent(centerId));
  const providerUrl = new URL(expanded);
  if (providerUrl.protocol !== "https:") throw new Error("DAGYM_SYNC_URL은 HTTPS 주소여야 합니다.");
  if (!configured.includes("{date}")) providerUrl.searchParams.set("date", dateKey);
  if (centerId && !configured.includes("{centerId}")) providerUrl.searchParams.set("centerId", centerId);
  return providerUrl;
}

module.exports = async function handler(request, response) {
  response.setHeader("Access-Control-Allow-Origin", getAllowedOrigin(request));
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.setHeader("Cache-Control", "no-store");

  if (request.method === "OPTIONS") return response.status(204).end();
  if (request.method !== "POST") return response.status(405).json({ ok: false, error: "POST only" });

  const user = await verifySupabaseUser(request).catch(() => null);
  if (!user?.id) return response.status(401).json({ ok: false, error: "로그인이 필요합니다." });
  const canManage = await verifyDagymManager(request, user).catch(() => false);
  if (!canManage) return response.status(403).json({ ok: false, error: "다짐 운영자료 동기화 권한이 없습니다." });

  const dateKey = String(request.body?.dateKey || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return response.status(400).json({ ok: false, error: "동기화 날짜 형식이 올바르지 않습니다." });
  }

  let providerUrl;
  try {
    providerUrl = buildProviderUrl(dateKey);
  } catch (error) {
    return response.status(500).json({ ok: false, error: error.message || "다짐 연동 주소 설정을 확인해주세요." });
  }
  if (!providerUrl || !process.env.DAGYM_SYNC_TOKEN) {
    return response.status(501).json({
      ok: false,
      code: "provider_setup_required",
      error: "다짐 공식 연동정보가 아직 등록되지 않았습니다.",
      next: "다짐에서 발급받은 연동 URL과 토큰을 배포 환경변수에 등록해주세요.",
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let providerResponse;
  try {
    providerResponse = await fetch(providerUrl, {
      headers: {
        Authorization: `Bearer ${process.env.DAGYM_SYNC_TOKEN}`,
        Accept: "application/json,text/csv,text/tab-separated-values,text/plain",
        ...(process.env.DAGYM_CENTER_ID ? { "X-Center-Id": process.env.DAGYM_CENTER_ID } : {}),
      },
      redirect: "error",
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timer);
    return response.status(502).json({ ok: false, error: error.name === "AbortError" ? "다짐 응답 시간이 초과되었습니다." : "다짐 서버에 연결하지 못했습니다." });
  }
  clearTimeout(timer);

  const contentLength = Number(providerResponse.headers.get("content-length") || 0);
  if (contentLength > MAX_RESPONSE_BYTES) return response.status(502).json({ ok: false, error: "다짐 응답 자료가 허용 크기를 초과했습니다." });
  const raw = await providerResponse.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_RESPONSE_BYTES) return response.status(502).json({ ok: false, error: "다짐 응답 자료가 허용 크기를 초과했습니다." });
  if (!providerResponse.ok) return response.status(502).json({ ok: false, error: `다짐 연동 응답 오류 (${providerResponse.status})` });

  const contentType = String(providerResponse.headers.get("content-type") || "");
  let metrics = {};
  if (/json/i.test(contentType) || /^[\s\n]*[\[{]/.test(raw)) {
    try {
      metrics = collectJsonMetrics(JSON.parse(raw));
    } catch {
      metrics = {};
    }
  }
  if (!Object.keys(metrics).length) metrics = collectTextMetrics(raw);
  if (!Object.keys(metrics).length) {
    return response.status(422).json({ ok: false, error: "다짐 응답에서 운영 지표를 찾지 못했습니다. 제공 형식을 확인해주세요." });
  }

  return response.status(200).json({
    ok: true,
    dateKey,
    provider: "dagym-manager",
    syncedAt: new Date().toISOString(),
    metrics: Object.fromEntries(Object.entries(metrics).filter(([key]) => METRIC_KEYS.includes(key))),
  });
};

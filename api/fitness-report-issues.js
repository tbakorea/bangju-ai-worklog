// Only fixed recipient accounts receive a privacy-safe projection; raw records never leave this API.
const URL_BASE = process.env.SUPABASE_URL || "https://zllpfaijahyfppivkxzu.supabase.co";
const RECIPIENTS = {
  "tbakorea@gmail.com": { name: "김성민", action: "센터장과 사실·조치 담당자·처리 일정을 확인하세요." },
  "thal1440@naver.com": { name: "이소미", action: "필요한 증빙과 처리 결과를 담당자에게 확인하세요." },
  "onse2@naver.com": { name: "김경희", action: "비용·정산 검토가 필요한지 확인하고 필요한 승인 절차를 안내하세요." },
};
const CATEGORIES = [
  ["safety", /안전|사고|부상|응급|화재|누전/, "안전 관련 기록 확인"],
  ["facility", /고장|누수|파손|수리|시설|기구|냉난방/, "시설 점검·조치 확인"],
  ["customer", /민원|불만|분쟁|항의|환불/, "고객응대 후속 확인"],
  ["finance", /정산|미수|결제|입금|지출|비용|환불/, "정산·증빙 확인"],
];
function projectIssues({ date, analysis, logs = [], action, sourceAvailable = true }) {
  const issues = new Map();
  const add = (key, title, basis) => issues.set(key, { key, title, basis, action });
  for (const row of logs) {
    const text = String(row.state?.ownerWorklog?.fitnessOps?.specialReport || "").trim();
    if (!text || /^(없음|특이사항\s*없음|이상\s*없음|없습니다)[.!\s]*$/.test(text)) continue;
    let matched = false;
    for (const [key, pattern, title] of CATEGORIES) if (pattern.test(text)) {
      matched = true; add(key, title, "선택일 직원 특이사항에 관련 표현이 있습니다. 사실·해결 여부 확인 전입니다.");
    }
    if (!matched) add("special", "센터 특이사항 확인", "선택일 직원 특이사항이 등록되어 있습니다. 담당자 확인이 필요합니다.");
  }
  const expectedSource = new Date(`${date}T00:00:00Z`); expectedSource.setUTCDate(expectedSource.getUTCDate() - 1);
  const validAnalysis = analysis?.analysis_date === date && analysis?.source_date === expectedSource.toISOString().slice(0, 10);
  if (validAnalysis) {
    if (analysis.quality !== "complete") add("data", "다짐 자료 확인 필요", "전날 자료가 미확인 또는 일부 누락 상태입니다. 누락을 0이나 실적 부진으로 판단하지 않습니다.");
    const allowed = { "no-show": "예약 결과·후속 안내 확인", "locker": "락커 만료 안내 확인" };
    for (const signal of analysis.signals || []) if (allowed[signal.type]) add(signal.type, allowed[signal.type], "전날 다짐 분석의 확인 신호입니다. 실제 처리 여부는 센터장 확인이 필요합니다.");
    // Gap/ratio signals can mix periods or missing values. Do not relay them as performance issues.
  }
  return { date, status: !sourceAvailable ? "partial" : validAnalysis ? "ready" : "partial", analysisSourceDate: validAnalysis ? analysis.source_date : null, issues: [...issues.values()] };
}
async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "method" });
  const authorization = String(req.headers.authorization || "");
  if (!/^Bearer \S+$/.test(authorization)) return res.status(401).json({ error: "로그인이 필요합니다." });
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return res.status(503).json({ error: "이슈 조회를 사용할 수 없습니다." });
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const read = async (path, customHeaders = headers) => {
    const response = await fetch(`${URL_BASE}${path}`, { headers: customHeaders, signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error("source unavailable");
    return response.json();
  };
  try {
    let user;
    try { user = await read("/auth/v1/user", { apikey: key, Authorization: authorization }); }
    catch { return res.status(401).json({ error: "로그인을 확인해주세요." }); }
    const recipient = RECIPIENTS[String(user.email || "").toLowerCase()];
    if (!recipient) return res.status(403).json({ error: "조회 권한이 없습니다." });
    const [profile] = await read(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=name,approval_status`);
    if (profile?.approval_status !== "approved" || profile.name !== recipient.name) return res.status(403).json({ error: "조회 권한이 없습니다." });
    const date = String(req.query?.date || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) return res.status(400).json({ error: "날짜를 확인해주세요." });
    const profiles = await read("/rest/v1/profiles?approval_status=eq.approved&select=id,org,workplace");
    const ids = profiles.filter(p => /피트니스|fitness/i.test(`${p.org || ""} ${p.workplace || ""}`)).map(p => p.id).filter(id => /^[0-9a-f-]{36}$/i.test(id));
    const results = await Promise.allSettled([
      read(`/rest/v1/dagym_daily_analyses?analysis_date=eq.${date}&select=analysis_date,source_date,quality,signals&limit=1`),
      ids.length ? read(`/rest/v1/worklog_states?log_date=eq.${date}&user_id=in.(${ids.join(",")})&select=user_id,state,updated_at&order=updated_at.desc&limit=1000`) : Promise.resolve([]),
    ]);
    // One latest daily row per owner avoids duplicate organization snapshots.
    const unique = new Map();
    for (const row of results[1].value || []) if (!unique.has(row.user_id)) unique.set(row.user_id, row);
    return res.status(200).json(projectIssues({ date, action: recipient.action, analysis: results[0].value?.[0], logs: [...unique.values()], sourceAvailable: ids.length > 0 && results.every(r => r.status === "fulfilled") }));
  } catch { return res.status(503).json({ error: "센터 이슈를 확인하지 못했습니다. 업무일지는 계속 저장할 수 있습니다." }); }
}
module.exports = handler;
module.exports.projectIssues = projectIssues;

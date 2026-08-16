const { createHash } = require("node:crypto");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://zllpfaijahyfppivkxzu.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpsbHBmYWlqYWh5ZnBwaXZreHp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzMzQxNTUsImV4cCI6MjA5ODkxMDE1NX0.C4omaj-e_9PM-iF3-5GUUVX47Wo06UsNTOYMlMMVcZU";
const DEFAULT_ORIGIN = "https://bangju-ai-worklog.vercel.app";
const MAX_PAYLOAD_BYTES = 24000;

const coachingSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    praise: { type: "string" },
    feedback: { type: "string" },
    nextAction: { type: "string" },
    manualReminder: { type: "string" },
    evidence: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 3,
    },
  },
  required: ["praise", "feedback", "nextAction", "manualReminder", "evidence"],
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
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: authorization,
    },
  });
  if (!userResponse.ok) return null;
  return userResponse.json().catch(() => null);
}

function extractResponseText(result = {}) {
  if (typeof result.output_text === "string" && result.output_text.trim()) return result.output_text;
  return (result.output || [])
    .filter((item) => item?.type === "message")
    .flatMap((item) => item.content || [])
    .filter((item) => item?.type === "output_text")
    .map((item) => item.text || "")
    .join("")
    .trim();
}

function normalizeCoachResult(value = {}) {
  const clamp = (text, max = 180) => String(text || "").replace(/\s+/g, " ").trim().slice(0, max);
  const result = {
    praise: clamp(value.praise),
    feedback: clamp(value.feedback),
    nextAction: clamp(value.nextAction),
    manualReminder: clamp(value.manualReminder),
    evidence: Array.isArray(value.evidence) ? value.evidence.map((item) => clamp(item, 120)).filter(Boolean).slice(0, 3) : [],
  };
  if (!result.praise || !result.feedback || !result.nextAction || !result.manualReminder || !result.evidence.length) return null;
  return result;
}

module.exports = async function handler(request, response) {
  response.setHeader("Access-Control-Allow-Origin", getAllowedOrigin(request));
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.setHeader("Cache-Control", "no-store");

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }
  if (request.method !== "POST") {
    response.status(405).json({ ok: false, error: "POST only" });
    return;
  }

  const user = await verifySupabaseUser(request).catch(() => null);
  if (!user?.id) {
    response.status(401).json({ ok: false, error: "로그인이 필요합니다." });
    return;
  }
  if (!process.env.OPENAI_API_KEY) {
    response.status(501).json({
      ok: false,
      error: "AI 코칭 서버 설정이 필요합니다.",
      next: "Vercel 환경 변수에 OPENAI_API_KEY를 등록해주세요.",
    });
    return;
  }

  const context = request.body?.context;
  const serialized = JSON.stringify(context || {});
  if (!context || serialized.length > MAX_PAYLOAD_BYTES || !/^\d{4}-\d{2}-\d{2}$/.test(String(context.dateKey || ""))) {
    response.status(400).json({ ok: false, error: "코칭 자료 형식이 올바르지 않습니다." });
    return;
  }

  const model = process.env.OPENAI_COACH_MODEL || "gpt-5.4-mini";
  const safetyIdentifier = createHash("sha256").update(`bangju-worklog:${user.id}`).digest("hex").slice(0, 32);
  const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      store: false,
      safety_identifier: safetyIdentifier,
      reasoning: { effort: "low" },
      instructions: [
        "당신은 방주그룹 각 사업장의 실무를 이해하는 한국어 업무 코치입니다.",
        "제공된 businessArea, 소속, 직급, 주업무, 업무일지, 수치와 직무 매뉴얼에 명시된 사실만 근거로 답하세요.",
        "재무는 금액·증빙·마감·지급위험, 공유사업은 공실·계약·미수·시설·고객응대, TBA·시공은 제품·현장·견적·납기·품질·안전, 피트니스는 수업·상담·계약·시설·회원경험을 우선 기준으로 삼으세요.",
        "성격, 역량, 인사등급을 단정하거나 직원 간 순위를 매기지 마세요.",
        "칭찬은 구체적 실행 근거를 포함하고, 피드백은 비난 없이 가장 중요한 보완점 하나만 제시하세요.",
        "다음 행동은 다음 근무에서 바로 실행 가능한 한 가지로 쓰세요.",
        "피트니스 센터 운영 취합에 다짐 지표와 전일 대비 변이가 있으면 출석·예약·노쇼·재등록·매출의 연결을 평가하고 개선 행동을 제시하세요.",
        "snsContent가 있으면 입력된 링크와 contentSummary만 근거로 검색성·고객효익·문의유도 문구를 검토하세요. 외부 링크 본문을 실제로 열람했다고 말하지 마세요.",
        "블로그 중심 홍보에는 같은 소재를 인스타그램 릴스·카드뉴스와 네이버 플레이스 소식으로 재가공하고, 채널별 문의·예약 반응을 기록하도록 구체적으로 코칭하세요.",
        "previousDayAnalysis가 있으면 전날 다짐 운영신호를 오늘 코칭의 최우선 근거로 사용하고, todayAction과 managementDirection이 실제 오늘 행동으로 이어지게 작성하세요.",
        "변동 원인은 제공된 기록으로 확인되는 사실과 확인이 필요한 원인 후보를 구분하며, 근거 없이 특정 직원의 과실로 단정하지 마세요.",
        "매뉴얼 상기는 제공된 매뉴얼 중 오늘 기록과 가장 관련된 기준 하나를 짧게 상기시키세요.",
        "자료가 부족하면 부족한 사실을 솔직히 밝히되 네 항목 모두 유용한 문장으로 완성하세요.",
        "각 문장은 공손하고 따뜻하며 90자 안팎의 간결한 한국어로 작성하세요.",
      ].join("\n"),
      input: [{ role: "user", content: `다음 JSON 업무자료를 코칭하세요.\n${serialized}` }],
      text: {
        format: {
          type: "json_schema",
          name: "bangju_worklog_coaching",
          strict: true,
          schema: coachingSchema,
        },
        verbosity: "low",
      },
      max_output_tokens: 700,
    }),
  });

  const openaiResult = await openaiResponse.json().catch(() => ({}));
  if (!openaiResponse.ok) {
    response.status(openaiResponse.status).json({
      ok: false,
      error: openaiResult?.error?.message || "AI 코칭을 생성하지 못했습니다.",
    });
    return;
  }

  const outputText = extractResponseText(openaiResult);
  let parsed = null;
  try {
    parsed = JSON.parse(outputText);
  } catch {
    parsed = null;
  }
  const coaching = normalizeCoachResult(parsed);
  if (!coaching) {
    response.status(502).json({ ok: false, error: "AI 코칭 결과를 해석하지 못했습니다." });
    return;
  }

  response.status(200).json({
    ok: true,
    coaching,
    model,
    generatedAt: new Date().toISOString(),
  });
};

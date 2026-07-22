function isValidBackupPayload(payload) {
  return Boolean(
    payload
      && payload.app === "Bangju AI Worklog"
      && /^\d{4}-\d{2}-\d{2}$/.test(String(payload.date || ""))
      && payload.metrics
      && payload.worklogStates?.employeeLogs,
  );
}

function buildBackupEmailText(payload) {
  const metrics = payload.metrics || {};
  return [
    `[Bangju AI Worklog 백업] ${payload.date}`,
    `생성: ${payload.createdAt || "-"}`,
    `수신: ${payload.recipientEmail || "-"}`,
    `주기: ${payload.cadence || "-"}`,
    "",
    `직원 로그: ${metrics.employees ?? 0}명`,
    `업무 완료: ${metrics.taskDone ?? 0}/${metrics.taskTotal ?? 0}`,
    `시간별 일정: ${metrics.scheduleTotal ?? 0}건`,
    `보고/메모 작성: ${metrics.reports ?? 0}명`,
    `출결 기록: ${metrics.attendanceRecords ?? 0}건`,
    `피트니스: 유료PT ${metrics.fitnessPaidPt ?? 0} · 무료PT ${metrics.fitnessFreePt ?? 0} · 상담 ${metrics.consultation ?? 0} · 계약 ${metrics.contract ?? 0}`,
    `운영 신호: ${metrics.riskSignals?.length ? metrics.riskSignals.join(", ") : "특이 위험 없음"}`,
    "",
    "이 메일은 Bangju AI Worklog 백업 자동화 엔드포인트에서 생성되었습니다.",
  ].join("\n");
}

module.exports = async function handler(request, response) {
  response.setHeader("Access-Control-Allow-Origin", process.env.BACKUP_ALLOWED_ORIGIN || "https://bangju-ai-worklog.vercel.app");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (request.method !== "POST") {
    response.status(405).json({ ok: false, error: "POST only" });
    return;
  }

  const payload = request.body;
  if (!isValidBackupPayload(payload)) {
    response.status(400).json({ ok: false, error: "Invalid backup payload" });
    return;
  }

  if (!process.env.RESEND_API_KEY) {
    response.status(501).json({
      ok: false,
      error: "RESEND_API_KEY is not configured",
      next: "Vercel Project Settings > Environment Variables에 RESEND_API_KEY와 BACKUP_FROM_EMAIL을 설정하면 메일 발송이 활성화됩니다.",
    });
    return;
  }

  const recipient = String(payload.recipientEmail || process.env.BACKUP_TO_EMAIL || "").trim();
  if (!recipient) {
    response.status(400).json({ ok: false, error: "Missing recipientEmail" });
    return;
  }

  const from = process.env.BACKUP_FROM_EMAIL || "Bangju AI Worklog <onboarding@resend.dev>";
  const subject = `[Bangju AI Worklog 백업] ${payload.date}`;
  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [recipient],
      subject,
      text: buildBackupEmailText(payload),
      attachments: [
        {
          filename: `bangju-worklog-backup-${payload.date}.json`,
          content: Buffer.from(JSON.stringify(payload, null, 2)).toString("base64"),
        },
      ],
    }),
  });

  const result = await resendResponse.json().catch(() => ({}));
  if (!resendResponse.ok) {
    response.status(resendResponse.status).json({ ok: false, error: result.message || "Email send failed", result });
    return;
  }

  response.status(200).json({ ok: true, provider: "resend", result });
};

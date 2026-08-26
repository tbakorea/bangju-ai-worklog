import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const requestedDate = String(process.argv[2] || "").trim();
const auditPath = path.join(root, "work", "dagym-daily-sync", "latest.json");
const uploadUrl = process.env.DAGYM_DAILY_SYNC_URL || "https://bangju-ai-worklog.vercel.app/api/dagym-browser-daily";
const syncSecret = process.env.DAGYM_BROWSER_SYNC_SECRET || "";
const accessToken = process.env.DAGYM_SYNC_ACCESS_TOKEN || "";

function isDateKey(value = "") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function loadPendingSnapshot() {
  if (!fs.existsSync(auditPath)) return null;
  try {
    const audit = JSON.parse(fs.readFileSync(auditPath, "utf8"));
    if (!isDateKey(audit?.dateKey)) return null;
    if (requestedDate && audit.dateKey !== requestedDate) return null;
    if (!audit.metrics || typeof audit.metrics !== "object" || !audit.domains || typeof audit.domains !== "object") return null;
    return audit;
  } catch {
    return null;
  }
}

async function upload(audit) {
  if (!syncSecret && !accessToken) throw new Error("다짐 동기화 인증정보가 로컬 환경에 필요합니다.");
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(syncSecret ? { "X-Dagym-Sync-Secret": syncSecret } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({
      dateKey: audit.dateKey,
      startedAt: audit.startedAt || audit.capturedAt || new Date().toISOString(),
      metrics: audit.metrics,
      domains: audit.domains,
      warnings: Array.isArray(audit.warnings) ? audit.warnings : [],
    }),
    signal: AbortSignal.timeout(20000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`앱 서버 업로드 실패 (${response.status}): ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : {};
}

async function main() {
  const audit = loadPendingSnapshot();
  if (!audit) {
    console.log(JSON.stringify({ ok: false, retryable: false, reason: "matching-pending-snapshot-not-found" }));
    process.exitCode = 2;
    return;
  }
  if (audit.uploaded?.ok) {
    console.log(JSON.stringify({ ok: true, retried: false, dateKey: audit.dateKey, reason: "already-uploaded" }));
    return;
  }
  const uploaded = await upload(audit);
  const updated = { ...audit, uploaded, uploadedAt: new Date().toISOString() };
  fs.writeFileSync(auditPath, `${JSON.stringify(updated, null, 2)}\n`);
  console.log(JSON.stringify({ ok: true, retried: true, dateKey: audit.dateKey, uploaded }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});

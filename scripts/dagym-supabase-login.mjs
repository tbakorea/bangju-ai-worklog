const supabaseUrl = String(process.env.SUPABASE_URL || "https://zllpfaijahyfppivkxzu.supabase.co").replace(/\/$/, "");
const anonKey = String(process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpsbHBmYWlqYWh5ZnBwaXZreHp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzMzQxNTUsImV4cCI6MjA5ODkxMDE1NX0.C4omaj-e_9PM-iF3-5GUUVX47Wo06UsNTOYMlMMVcZU");
const email = String(process.env.DAGYM_SYNC_EMAIL || "").trim();
const password = String(process.env.DAGYM_SYNC_PASSWORD || "");

if (!email || !password) throw new Error("대표 계정 동기화 인증정보가 필요합니다.");

const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: anonKey, "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
const text = await response.text();
if (!response.ok) throw new Error(`대표 계정 인증 실패 (${response.status}): ${text.slice(0, 180)}`);
const payload = text ? JSON.parse(text) : {};
if (!payload.access_token) throw new Error("대표 계정 인증 토큰을 받지 못했습니다.");
process.stdout.write(payload.access_token);

const test = require("node:test");
const assert = require("node:assert/strict");

process.env.SUPABASE_ANON_KEY = "••••••••";
process.env.SUPABASE_SERVICE_ROLE_KEY = "••••••••";
process.env.MEMBER_CONTACT_ENCRYPTION_KEY = "test-only-contact-key";

const handler = require("../api/dagym-monthly-schedule.js");

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

test("masked anon key falls back to the project public key", async () => {
  const calls = [];
  let profileRequestCount = 0;
  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (String(url).includes("/auth/v1/user")) {
      return { ok: true, json: async () => ({ id: "user-1" }) };
    }
    if (String(url).includes("/rest/v1/profiles")) {
      profileRequestCount += 1;
      if (profileRequestCount === 1) return { ok: false, status: 400 };
      return {
        ok: true,
        json: async () => ([{
          id: "user-1",
          name: "대표",
          nickname: "",
          role: "대표",
          workplace: "(주)방주",
          approval_status: "approved",
          permissions: {},
        }]),
      };
    }
    return { ok: true, text: async () => "[]" };
  };

  const response = responseRecorder();
  await handler({
    method: "GET",
    headers: { authorization: "Bearer user-token" },
    query: { monthKey: "2026-08" },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.match(calls[0].options.headers.apikey, /^eyJ/);
  assert.doesNotMatch(calls[0].options.headers.apikey, /•/);
  assert.equal(profileRequestCount, 2);
});

test("masked service role key returns a configuration error instead of crashing", async () => {
  const response = responseRecorder();
  await handler({ method: "POST", headers: {}, body: { monthKey: "2026-08", events: [] } }, response);

  assert.equal(response.statusCode, 501);
  assert.equal(response.body.ok, false);
  assert.ok(response.body.missing.some((name) => name.startsWith("SUPABASE_SERVICE_ROLE_KEY")));
});

test("worklog can store a PT timetable correction without replacing the DaGym source", async () => {
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes("/auth/v1/user")) return { ok: true, json: async () => ({ id: "user-1" }) };
    if (String(url).includes("/rest/v1/profiles")) {
      return {
        ok: true,
        json: async () => ([{
          id: "user-1",
          name: "박주홍",
          nickname: "",
          role: "센터장",
          workplace: "비욘드 피트니스",
          approval_status: "approved",
          permissions: {},
        }]),
      };
    }
    if (String(url).includes("/rest/v1/dagym_pt_schedule_events") && String(url).includes("select=id,trainer_profile_id")) {
      return {
        ok: true,
        text: async () => JSON.stringify([{
          id: "11111111-1111-4111-8111-111111111111",
          trainer_profile_id: "user-1",
          member_name_ciphertext: "",
          scheduled_at: "2026-08-20T00:00:00.000Z",
          ended_at: "2026-08-20T01:00:00.000Z",
          session_type: "paid",
          status: "scheduled",
          status_source: "dagym",
          postponed_to: null,
          class_label: "PT 수업",
          worklog_member_name_ciphertext: "",
          worklog_scheduled_at: null,
          worklog_ended_at: null,
          worklog_session_type: null,
          worklog_class_label: null,
          worklog_override_at: null,
        }]),
      };
    }
    return { ok: true, text: async () => "" };
  };

  const response = responseRecorder();
  await handler({
    method: "PATCH",
    headers: { authorization: "Bearer user-token" },
    body: {
      id: "11111111-1111-4111-8111-111111111111",
      override: {
        scheduledAt: "2026-08-20T01:30:00.000Z",
        sessionType: "free",
        classLabel: "체형교정 PT",
        memberName: "홍길동",
      },
    },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.event.scheduled_at, "2026-08-20T01:30:00.000Z");
  assert.equal(response.body.event.source_scheduled_at, "2026-08-20T00:00:00.000Z");
  assert.equal(response.body.event.session_type, "free");
  assert.equal(response.body.event.class_label, "체형교정 PT");
  assert.equal(response.body.event.member_name, "홍길동");
  const updateCall = calls.find((call) => call.options.method === "PATCH" && call.url.includes("/rest/v1/dagym_pt_schedule_events?id="));
  const update = JSON.parse(updateCall.options.body);
  assert.equal(update.worklog_scheduled_at, "2026-08-20T01:30:00.000Z");
  assert.equal(update.worklog_session_type, "free");
  assert.equal(update.scheduled_at, undefined);
  assert.equal(update.session_type, undefined);
});

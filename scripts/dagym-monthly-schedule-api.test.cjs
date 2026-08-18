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

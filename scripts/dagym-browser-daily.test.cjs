const test = require('node:test');
const assert = require('node:assert/strict');
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJtest.test.signature';
process.env.DAGYM_BROWSER_SYNC_SECRET = 'test-secret';
const handler = require('../api/dagym-browser-daily.js');
test('API refuses auth-page data before reading or replacing any snapshot', async () => {
  let requests = 0;
  global.fetch = async () => { requests++; throw new Error('unexpected DB request'); };
  const response = { code: 200, setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({method:'POST',headers:{'x-dagym-sync-secret':'test-secret'},body:{dateKey:'2026-10-27',metrics:{visits:0,sales:0},domains:{attendance:{ok:true,source:'/account/login'}}}},response);
  assert.equal(response.code,422);
  assert.equal(response.body.ok,false);
  assert.equal(requests,0);
});

const {redactCoachContext,redactText} = require('../api/_lib/coach-privacy.cjs');
test('coaching drops contact/auth keys recursively and redacts text on input and output', () => {
  const result = redactCoachContext({ dateKey:'2026-10-27',memberName:'민감이름',items:[{email:'a@example.com',phone:'01012345678',password:'secret',text:'김가나 회원 010-1234-5678 a@example.com 900101-1234567 Bearer token'}] });
  const serialized=JSON.stringify(result);
  for(const value of ['민감이름','김가나','010-1234-5678','a@example.com','900101-1234567','Bearer token','secret']) assert.equal(serialized.includes(value),false);
  assert.equal(result.dateKey,'2026-10-27');
  assert.equal(redactText('a@example.com').includes('a@example.com'),false);
});

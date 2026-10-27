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

test('verified daily upload excludes empty slots and does not invent zero no-shows', async () => {
  let saved;
  global.fetch = async (url, options = {}) => {
    if (String(url).includes('dagym_pt_schedule_events')) {
      assert.match(String(url), /member_name_ciphertext=neq\./);
      return {ok:true,text:async()=>JSON.stringify([{status:'scheduled'}])};
    }
    if (String(url).includes('dagym_daily_snapshots')) saved=JSON.parse(options.body);
    return {ok:true,text:async()=>'[]'};
  };
  const domains = Object.fromEntries([
    ['attendance','/dashboard/attendance','daily'],['sales','/sales/list','month-to-date'],['members','/member/list','point-in-time']
  ].map(([key,source,period])=>[key,{ok:true,authenticated:true,rangeVerified:true,source,period,capturedAt:'2026-10-28T00:00:00Z'}]));
  const response={code:200,setHeader(){},status(code){this.code=code;return this},json(body){this.body=body;return this}};
  await handler({method:'POST',headers:{'x-dagym-sync-secret':'test-secret'},body:{dateKey:'2026-10-27',metrics:{visits:91,sales:28871100},domains}},response);
  assert.equal(response.code,200);
  assert.equal(saved.metrics.ptBookings,1);
  assert.equal('noShows' in saved.metrics,false);
});

const {redactCoachContext,redactText} = require('../api/_lib/coach-privacy.cjs');
test('coaching drops contact/auth keys recursively and redacts text on input and output', () => {
  const result = redactCoachContext({ dateKey:'2026-10-27',memberName:'민감이름',items:[{email:'a@example.com',phone:'01012345678',password:'secret',text:'김가나 회원 010-1234-5678 a@example.com 900101-1234567 Bearer token'}] });
  const serialized=JSON.stringify(result);
  for(const value of ['민감이름','김가나','010-1234-5678','a@example.com','900101-1234567','Bearer token','secret']) assert.equal(serialized.includes(value),false);
  assert.equal(result.dateKey,'2026-10-27');
  assert.equal(redactText('a@example.com').includes('a@example.com'),false);
});

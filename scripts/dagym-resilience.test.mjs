import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureDagymSession, isTrustedDagymUrl } from './dagym-session.mjs';
import { atomicJson, verifySync, validateDailyReceipt, validateMonthlyReceipt } from './dagym-sync-health.mjs';
function fakePage({ loggedIn = false, external = false, succeeds = true, autofilled = false, challenge = false } = {}) {
  let currentUrl = '', attempts = 0;
  const page = {
    url: () => currentUrl,
    async goto() { currentUrl = external ? 'https://not-dagym.example/account/login' : `https://www.dagym-manager.com/${loggedIn ? 'dashboard/attendance' : 'account/login'}`; },
    async waitForFunction() {}, async waitForURL() {},
    locator(selector) {
      const password = selector === 'input[type="password"]';
      const body = selector === 'body';
      const captcha = selector.startsWith('iframe');
      return { async count() { return captcha ? Number(challenge) : password ? Number(!loggedIn) : 1; }, async innerText() { return loggedIn ? '비욘드 피트니스' : '로그인'; }, async inputValue() { return autofilled ? 'autofilled' : ''; }, async fill() {} };
    },
    getByRole() { return { async count() { return 1; }, async click() { attempts++; loggedIn = succeeds; } }; },
    attempts: () => attempts,
  };
  return page;
}
async function tempTest(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dagym-safe-test-'));
  try { await fn(root); } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
test('healthy session does not read passwords; hostile redirects never receive credentials', async () => tempTest(async root => {
  let reads = 0;
  const loadCredentials = async () => { reads++; return { identifier: 'fixture', password: 'fixture-secret' }; };
  const statePath = path.join(root, 'session.json');
  assert.equal((await ensureDagymSession(fakePage({ loggedIn: true }), { statePath, loadCredentials })).ok, true);
  assert.equal((await ensureDagymSession(fakePage({ external: true }), { statePath, loadCredentials })).ok, false);
  assert.equal(reads, 0);
  assert.equal(isTrustedDagymUrl('https://www.dagym-manager.com.evil.test/account/login'), false);
}));
test('saved login recovers once, contains no credentials in health, and failed auth pauses retries', async () => tempTest(async root => {
  let reads = 0;
  const loadCredentials = async () => { reads++; return { identifier: 'fixture-account', password: 'fixture-secret' }; };
  const statePath = path.join(root, 'session.json');
  const page = fakePage();
  assert.equal((await ensureDagymSession(page, { statePath, loadCredentials })).status, 'login_recovered');
  assert.equal(page.attempts(), 1);
  assert.equal(fs.readFileSync(statePath, 'utf8').includes('fixture'), false);
  const failed = fakePage({ succeeds: false });
  assert.equal((await ensureDagymSession(failed, { statePath, loadCredentials })).ok, false);
  const before = reads;
  assert.equal((await ensureDagymSession(failed, { statePath, loadCredentials })).status, 'login_retry_paused');
  assert.equal(reads, before);
  assert.equal(failed.attempts(), 1);
}));
test('autofill uses existing session only; CAPTCHA and absent keychain require direct login', async () => tempTest(async root => {
  const statePath = path.join(root, 'session.json');
  const noCredential = async () => null;
  assert.equal((await ensureDagymSession(fakePage({ autofilled: true }), { statePath, loadCredentials: noCredential })).ok, true);
  assert.equal((await ensureDagymSession(fakePage({ challenge: true }), { statePath, loadCredentials: noCredential })).status, 'interactive_login_required');
  assert.equal((await ensureDagymSession(fakePage(), { statePath, loadCredentials: noCredential })).status, 'saved_login_unavailable');
}));
test('completion requires matching daily and monthly server receipts, including previous-month PT', async () => tempTest(async root => {
  const dateKey = '2026-10-31', syncedAt = '2026-11-01T00:00:00Z';
  const domains = Object.fromEntries([
    ['attendance','/dashboard/attendance','daily'], ['sales','/sales/list','month-to-date'], ['members','/member/list','point-in-time']
  ].map(([key, source, period]) => [key, { ok:true, authenticated:true, rangeVerified:true, source, period, capturedAt:syncedAt }]));
  const daily = { dateKey, metrics:{ visits:0, sales:0 }, domains, uploaded:{ ok:true, dateKey, syncedAt, quality:'partial' } };
  const month = { monthKey:'2026-10', complete:true, eventCount:0, uploaded:{ ok:true, monthKey:'2026-10', complete:true, saved:0, syncedAt } };
  atomicJson(path.join(root, `work/dagym-daily-sync/${dateKey}.json`), daily);
  const monthPath = path.join(root, 'work/dagym-monthly-schedule/2026-10.json');
  atomicJson(monthPath, month);
  assert.equal(verifySync(dateKey, root).ok, true);
  assert.throws(() => validateDailyReceipt({ ...daily.uploaded, dateKey:'2026-11-01' }, dateKey));
  assert.throws(() => validateMonthlyReceipt({ ...month.uploaded, monthKey:'2026-11' }, '2026-10', 0));
  atomicJson(monthPath, { ...month, uploaded:{ ...month.uploaded, complete:false } });
  assert.throws(() => verifySync(dateKey, root));
}));

test('launcher saves daily data despite a PT failure and keeps the success marker unchanged', async () => tempTest(async root => {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const run = promisify(execFile);
  const scripts = path.join(root, 'scripts'), bin = path.join(root, 'bin'), state = path.join(root, 'work/dagym-sync');
  fs.mkdirSync(scripts); fs.mkdirSync(bin); fs.mkdirSync(state, { recursive:true });
  fs.copyFileSync(new URL('./dagym-monthly-pt-sync.sh', import.meta.url), path.join(scripts, 'dagym-monthly-pt-sync.sh'));
  fs.writeFileSync(path.join(state, 'last-successful-target-date'), '2026-10-27\n');
  fs.writeFileSync(path.join(state, 'dagym-browser.pid'), '12345\n');
  fs.writeFileSync(path.join(bin, 'curl'), '#!/bin/bash\nexit 0\n', { mode:0o700 });
  fs.writeFileSync(path.join(bin, 'ps'), `#!/bin/bash\nprintf '%s\\n' '--remote-debugging-port=9233 --user-data-dir=${root}/browser-profile'\n`, { mode:0o700 });
  const node = path.join(bin, 'node');
  fs.writeFileSync(node, `#!/bin/bash\nprintf '%s %s\\n' "$(basename "$1")" "$DAGYM_MONTH" >> '${root}/trace'\ncase "$1" in\n *dagym-upload-pending.mjs) exit 2;;\n *dagym-monthly-pt-sync.mjs) exit 1;;\n *) exit 0;;\nesac\n`, { mode:0o700 });
  await assert.rejects(run('/bin/bash', [path.join(scripts, 'dagym-monthly-pt-sync.sh')], { env: { ...process.env, PATH:`${bin}:${process.env.PATH}`, NODE_BIN:node, DAGYM_DATE:'2026-10-31', DAGYM_SYNC_FORCE:'1', DAGYM_SYNC_SKIP_JITTER:'1', DAGYM_BROWSER_SYNC_SECRET:'fixture', DAGYM_SYNC_ACCESS_TOKEN:'fixture' } }), error => error.code === 1);
  const trace = fs.readFileSync(path.join(root,'trace'),'utf8');
  assert.match(trace, /dagym-daily-sync.mjs 2026-10/);
  assert.match(trace, /dagym-monthly-pt-sync.mjs 2026-10/);
  assert.equal(fs.readFileSync(path.join(state, 'last-successful-target-date'),'utf8').trim(), '2026-10-27');
}));

test('dashboard with a rejected GetGym response is not a successful login', async () => tempTest(async root => {
  const page = fakePage();
  page.waitForSelector = async () => {};
  page.waitForResponse = async () => ({
    status: () => page.attempts() ? 200 : 403,
    json: async () => page.attempts() ? { data:{ gym:{ id:'2387f907-0810-49b9-9db2-7ceb7861e076' } } } : { errors:[{}] }
  });
  const result = await ensureDagymSession(page, { statePath:path.join(root,'session.json'), loadCredentials:async()=>({ identifier:'fixture', password:'fixture' }) });
  assert.equal(result.status, 'login_recovered');
  assert.equal(page.attempts(), 1);
  const wrongCentre = fakePage({loggedIn:true});
  wrongCentre.waitForResponse = async () => ({status:()=>200,json:async()=>({ data:{gym:{id:'another-centre'}} })});
  assert.equal((await ensureDagymSession(wrongCentre, { statePath:path.join(root,'other.json'), loadCredentials:async()=>{ throw new Error('must not read'); } })).status, 'centre_mismatch');
}));

test('pending uploader preserves a rejected receipt and writes a matching date atomically', async () => tempTest(async root => {
  const { createServer } = await import('node:http');
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const run = promisify(execFile);
  const dateKey = '2026-10-31', stamp='2026-11-01T00:00:00Z';
  const domains = Object.fromEntries([['attendance','/dashboard/attendance','daily'],['sales','/sales/list','month-to-date'],['members','/member/list','point-in-time']].map(([key,source,period])=>[key,{ok:true,authenticated:true,rangeVerified:true,source,period,capturedAt:stamp}]));
  const audit = {dateKey,metrics:{visits:0,sales:0},domains,uploaded:null};
  const file=path.join(root,`work/dagym-daily-sync/${dateKey}.json`);
  atomicJson(file,audit);
  let wrongDate=true;
  const server=createServer((req,res)=>{req.resume();res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true,dateKey:wrongDate?'2026-11-01':dateKey,syncedAt:stamp}));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const env={...process.env,DAGYM_BROWSER_SYNC_SECRET:'fixture',DAGYM_SYNC_ACCESS_TOKEN:'',DAGYM_DAILY_SYNC_URL:`http://127.0.0.1:${server.address().port}/`};
    const script=fileURLToPath(new URL('./dagym-upload-pending.mjs',import.meta.url));
    await assert.rejects(run(process.execPath,[script,dateKey],{cwd:root,env}));
    assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).uploaded,null);
    wrongDate=false;
    await run(process.execPath,[script,dateKey],{cwd:root,env});
    assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).uploaded.dateKey,dateKey);
    assert.equal(JSON.parse(fs.readFileSync(path.join(root,'work/dagym-daily-sync/latest.json'),'utf8')).dateKey,dateKey);
  } finally { await new Promise(resolve=>server.close(resolve)); }
}));

test('bounded keychain helper refuses unrelated services without printing data', async () => {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  await assert.rejects(promisify(execFile)(process.execPath, [fileURLToPath(new URL('./dagym-keychain-read.mjs', import.meta.url)), 'unrelated-service', 'fixture-account']), error => error.code === 2 && error.stdout === '' && error.stderr === '');
});

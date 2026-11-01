import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execute = promisify(execFile);
const trustedOrigin = 'https://www.dagym-manager.com';
const cooldownMs = 24 * 60 * 60 * 1000;
export function isTrustedDagymUrl(url) {
  try { return new URL(url).origin === trustedOrigin; } catch { return false; }
}
export async function readSavedDagymLogin() {
  if (process.env.DAGYM_LOGIN_ID && process.env.DAGYM_LOGIN_PASSWORD) {
    return { identifier: process.env.DAGYM_LOGIN_ID, password: process.env.DAGYM_LOGIN_PASSWORD };
  }
  // Read only this site's existing Internet Password entry; never create/copy a credential.
  if (process.platform !== 'darwin') return null;
  try {
    const metadata = await execute('/usr/bin/security', ['find-generic-password', '-s', 'com.bangju.dagym-manager'], { timeout: 5000 });
    const identifier = metadata.stdout.match(/"acct"<blob>="([^"]+)"/)?.[1];
    if (identifier) {
      const secret = await execute('/usr/bin/security', ['find-generic-password', '-s', 'com.bangju.dagym-manager', '-w'], { timeout: 15000 });
      const password = secret.stdout.replace(/\r?\n$/, '');
      if (password) return { identifier, password };
    }
  } catch { /* Fall back to an already existing site-specific Internet Password. */ }
  for (const host of ['www.dagym-manager.com', 'dagym-manager.com']) {
    try {
      const metadata = await execute('/usr/bin/security', ['find-internet-password', '-s', host], { timeout: 5000 });
      const identifier = metadata.stdout.match(/"acct"<blob>="([^"]+)"/)?.[1];
      if (!identifier) continue;
      const secret = await execute('/usr/bin/security', ['find-internet-password', '-s', host, '-a', identifier, '-w'], { timeout: 5000 });
      const password = secret.stdout.replace(/\r?\n$/, '');
      if (password) return { identifier, password };
    } catch { /* Missing/locked/permission denied: interactive login is required. */ }
  }
  return null;
}
function readHealth(statePath) {
  try { return JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch { return {}; }
}
function writeHealth(statePath, data) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(`${statePath}.tmp`, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(`${statePath}.tmp`, statePath);
}
export async function ensureDagymSession(page, options = {}) {
  const statePath = options.statePath || path.resolve('work/dagym-sync/session-health.json');
  const loadCredentials = options.loadCredentials || readSavedDagymLogin;
  let health = readHealth(statePath);
  let step = "open-centre";
  const report = (status, ok = false) => {
    health = { ...health, status, ok, ...(ok ? { lastLoginAttemptAt: null } : {}), checkedAt: new Date().toISOString() };
    writeHealth(statePath, health);
    return { ok, status };
  };
  const destination = `${trustedOrigin}/dashboard/attendance?gymId=${encodeURIComponent(options.gymId || process.env.DAGYM_GYM_ID || '2387f907-0810-49b9-9db2-7ceb7861e076')}`;
  const gymId = options.gymId || process.env.DAGYM_GYM_ID || '2387f907-0810-49b9-9db2-7ceb7861e076';
  let centreVerified = false;
  let centreMismatch = false;
  const visitCentre = async () => {
    const pending = page.waitForResponse ? page.waitForResponse(response => {
      try { return isTrustedDagymUrl(response.url()) && response.request().postDataJSON()?.operationName === 'GetGym'; } catch { return false; }
    }, { timeout: 15000 }).catch(() => null) : null;
    await page.goto(destination, { waitUntil: 'domcontentloaded', timeout: 45000 });
    if (pending) {
      const response = await pending;
      if (response?.status() === 200) {
        const payload = await response.json();
        const containsGym = value => value && typeof value === 'object' && (value.id === gymId || Object.values(value).some(item => typeof item === 'object' && containsGym(item)));
        centreVerified = !payload.errors?.length && Boolean(containsGym(payload.data));
        centreMismatch = Boolean(payload.data) && !centreVerified;
      } else centreVerified = false;
    } else {
      await page.waitForFunction(() => /비욘드\s*피트니스/.test(document.body?.innerText || '') || document.querySelector('input[type="password"]'), null, { timeout: 20000 });
      centreVerified = /비욘드\s*피트니스/.test(await page.locator('body').innerText());
    }
    return isTrustedDagymUrl(page.url()) && new URL(page.url()).pathname === '/dashboard/attendance'
      && !(await page.locator('input[type="password"]').count()) && centreVerified;
  };
  try {
    if (await visitCentre()) return report('authenticated', true);
    if (centreMismatch) return report('centre_mismatch');
    // Expired tokens can leave a dashboard skeleton on screen with 403 API responses.
    // Go through the normal login route instead of mistaking that skeleton for data.
    if (isTrustedDagymUrl(page.url())) {
      await page.goto(`${trustedOrigin}/account/login`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      if (page.waitForSelector) await page.waitForSelector('input[type="password"]', { timeout: 15000 });
    }
    if (!isTrustedDagymUrl(page.url()) || new URL(page.url()).pathname !== '/account/login') return report('interactive_login_required');
    if (await page.locator('iframe[src*="captcha"], [data-sitekey], input[autocomplete="one-time-code"]').count()) return report('interactive_login_required');
    step = "login-form";
    const password = page.locator('input[type="password"]');
    const identifier = page.locator('input[autocomplete="username"], input[type="email"], input[type="tel"], input[name="email"], input[name="phone"], input[type="text"]');
    const login = page.getByRole('button', { name: /^로그인$/ });
    if (await password.count() !== 1 || await identifier.count() !== 1 || await login.count() !== 1) return report('login_form_changed');
    if (Date.now() - Date.parse(health.lastLoginAttemptAt || '') < cooldownMs) return report('login_retry_paused');
    // Prefer the same dedicated browser's existing autofill without reading its secret.
    const autofilled = Boolean(await password.inputValue()) && Boolean(await identifier.inputValue());
    let credentials = null;
    if (!autofilled) {
      credentials = await loadCredentials();
      if (!credentials) return report('saved_login_unavailable');
      if (!isTrustedDagymUrl(page.url())) return report('interactive_login_required');
      await identifier.fill(credentials.identifier);
      if (!isTrustedDagymUrl(page.url())) return report("interactive_login_required");
      await password.fill(credentials.password);
      credentials = null;
    }
    health.lastLoginAttemptAt = new Date().toISOString();
    writeHealth(statePath, { ...health, status: 'login_attempted', ok: false });
    step = "submit-login";
    if (!isTrustedDagymUrl(page.url())) return report("interactive_login_required");
    await login.click();
    await page.waitForURL(url => url.origin === trustedOrigin && !url.pathname.startsWith('/account/'), { timeout: 20000 }).catch(() => {});
    return await visitCentre() ? report('login_recovered', true) : report('interactive_login_required');
  } catch (error) {
    health.stage = step;
    health.errorType = error?.name === "TimeoutError" ? "timeout" : "connection";
    // Never propagate browser/request dumps or keychain stderr into logs.
    return report('connection_or_session_check_failed');
  }
}
async function main() {
  let stage = 'connect';
  const statePath = path.resolve('work/dagym-sync/session-health.json');
  const deadline = setTimeout(() => {
    writeHealth(statePath, { ok: false, status: 'session_check_timeout', stage, checkedAt: new Date().toISOString() });
    console.error('다짐 세션 점검 제한시간 초과');
    process.exit(3);
  }, 120000);
  deadline.unref();
  try {
    const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || '/Users/bangju/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
    const browser = await chromium.connectOverCDP(process.env.DAGYM_CDP_URL || 'http://127.0.0.1:9233', { timeout: 15000 });
    stage = 'page';
    const page = await browser.contexts()[0].newPage();
    stage = 'login';
    const result = await ensureDagymSession(page);
    console.log(JSON.stringify(result));
    process.exitCode = result.ok ? 0 : 3;
    await page.close().catch(() => {});
    await browser.close();
  } catch {
    writeHealth(statePath, { ok: false, status: 'browser_connection_failed', stage, checkedAt: new Date().toISOString() });
    console.error('다짐 세션 확인 실패: 전용 브라우저 연결을 확인하세요.');
    process.exitCode = 3;
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(() => process.exit(process.exitCode || 0));
}

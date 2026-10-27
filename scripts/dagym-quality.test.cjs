const test = require('node:test');
const assert = require('node:assert/strict');
const { isAuthSource, validateDailySnapshot } = require('./dagym-quality.cjs');
const good = () => ({ metrics: { visits: 91, sales: 28871100 }, domains: Object.fromEntries([
  ['attendance', '/dashboard/attendance', 'daily'], ['sales', '/sales/list', 'month-to-date'], ['members', '/member/list', 'point-in-time']
].map(([key, source, period]) => [key, { ok: true, source, period, capturedAt: '2026-10-28T00:00:00Z' }])) });
test('auth pages cannot be stored as zero-valued source data', () => {
  for (const source of ['/account/login', '/account/sign-up', 'https://www.dagym-manager.com/account/login?next=/sales/list']) {
    assert.equal(isAuthSource(source), true);
    const data = good(); data.domains.sales.source = source; data.metrics.sales = 0;
    assert.throws(() => validateDailySnapshot(data));
  }
});
test('verified zero is distinct from missing data; periods and all core sources are required', () => {
  const data = good(); data.metrics.visits = 0; data.metrics.sales = 0;
  assert.equal(validateDailySnapshot(data), true);
  delete data.metrics.sales; assert.throws(() => validateDailySnapshot(data));
  const wrong = good(); wrong.domains.sales.period = 'daily'; assert.throws(() => validateDailySnapshot(wrong));
  const missing = good(); missing.domains.members.ok = false; assert.throws(() => validateDailySnapshot(missing));
});

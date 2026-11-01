import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import quality from './dagym-quality.cjs';
export function validateDailyReceipt(receipt, dateKey) {
  if (receipt?.ok !== true || receipt.dateKey !== dateKey || !Number.isFinite(Date.parse(receipt.syncedAt))) throw new Error('일일 자료의 서버 저장 날짜를 확인하지 못했습니다.');
}
export function validateMonthlyReceipt(receipt, monthKey, eventCount) {
  if (receipt?.ok !== true || receipt.monthKey !== monthKey || receipt.complete !== true || receipt.saved !== eventCount || !Number.isFinite(Date.parse(receipt.syncedAt))) throw new Error('PT 일정의 서버 저장 범위·건수를 확인하지 못했습니다.');
}
export function atomicJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.tmp`, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(`${file}.tmp`, file);
}
export function verifySync(dateKey, root = process.cwd()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey || '')) throw new Error('수집 날짜 형식이 올바르지 않습니다.');
  const work = path.join(root, 'work');
  const dailyFile = path.join(work, 'dagym-daily-sync', `${dateKey}.json`);
  const daily = JSON.parse(fs.readFileSync(dailyFile, 'utf8'));
  if (daily.dateKey !== dateKey) throw new Error('일일 수집 날짜가 일치하지 않습니다.');
  quality.validateDailySnapshot(daily);
  validateDailyReceipt(daily.uploaded, dateKey);
  const monthKey = dateKey.slice(0, 7);
  const monthly = JSON.parse(fs.readFileSync(path.join(work, 'dagym-monthly-schedule', `${monthKey}.json`), 'utf8'));
  if (monthly.monthKey !== monthKey || monthly.complete !== true) throw new Error('PT 월간 수집이 완료되지 않았습니다.');
  validateMonthlyReceipt(monthly.uploaded, monthKey, monthly.eventCount);
  return { ok: true, targetDate: dateKey, monthKey, checkedAt: new Date().toISOString(), dailySaved: true, ptSaved: true, quality: daily.uploaded.quality, sources: { attendance: true, sales: true, members: true } };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dateKey = process.argv[2];
  try {
    const result = verifySync(dateKey);
    atomicJson(path.resolve('work/dagym-sync/health.json'), result);
    console.log(JSON.stringify(result));
  } catch {
    atomicJson(path.resolve('work/dagym-sync/health.json'), { ok: false, targetDate: dateKey, checkedAt: new Date().toISOString(), status: 'receipt_verification_failed' });
    console.error('다짐 완료 검증 실패: 날짜별 일일자료와 PT 서버 저장 확인이 모두 필요합니다.');
    process.exitCode = 1;
  }
}

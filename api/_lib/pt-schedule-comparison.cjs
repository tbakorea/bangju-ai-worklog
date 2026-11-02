const EXCLUDED = new Set(['cancelled', 'no-show', 'postponed']);
function kstParts(value) {
  const timestamp = Date.parse(value || '');
  if (!Number.isFinite(timestamp)) return null;
  const date = new Date(timestamp + 9 * 3600000);
  return { date: date.toISOString().slice(0, 10), time: date.toISOString().slice(11, 16) };
}
function clock(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || '').trim());
  if (!match || +match[1] > 24 || +match[2] > 59 || (+match[1] === 24 && +match[2] !== 0)) return '';
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}
function localItems(log = {}) {
  const result = [], seen = new Set();
  for (const entry of log.schedule || []) {
    for (const item of Array.isArray(entry.items) && entry.items.length ? entry.items : [entry]) {
      if (!String(item.text || '').trim() && !item.sourceId) continue;
      if (!(item.source === 'dagym-monthly-pt' || ['유료PT', '무료PT'].includes(item.type) || /(?:^|\s)(?:pt|p\/t|피티|수업)(?:\s|$)/i.test(`${item.type || ''} ${item.text || ''}`))) continue;
      const id = String(item.sourceId || '');
      if (id && seen.has(id)) continue;
      if (id) seen.add(id);
      result.push({ id, time: clock(entry.time),
        type: item.dagymSessionType || (item.type === '무료PT' || /무료|체험|무상|서비스/.test(`${item.type || ''} ${item.text || ''}`) ? 'free' : item.type === '유료PT' ? 'paid' : 'unknown'),
        status: item.dagymStatus || item.status || 'scheduled' });
    }
  }
  return result;
}
function compare({ reportDate, sourceDate, events = [], log = null, now = new Date() }) {
  const output = { reportDate, sourceDate, status: 'unavailable', differences: [], exceptions: [], compared: 0,
    guidance: '수업 누락으로 단정하지 말고 예약 변경·취소·노쇼·대체강사 여부를 먼저 확인하세요. 확인 후 실제 수업시간과 변경 사유를 기록하세요. 지난 일지를 직접 수정할 수 없으면 센터장에게 보완을 요청하세요. 다음 수업부터 종료 직후 기록을 확인하면 실적 확인과 인수인계가 수월해집니다.' };
  if (sourceDate >= kstParts(now.toISOString()).date) return { ...output, reason: '전날 수업이 마감되기 전입니다.' };
  if (!log) return { ...output, reason: '전날 저장된 업무일지를 확인하지 못했습니다. 미작성·수업 누락으로 단정하지 않습니다.' };
  const dayRows = events.filter(row => row.active !== false && kstParts(row.scheduled_at)?.date === sourceDate);
  if (!dayRows.length) return { ...output, reason: '본인에게 연결된 전날 다짐 시간표를 확인하지 못했습니다. 수업 0건이나 일치로 판단하지 않습니다.' };
  const cutoff = Date.parse(`${sourceDate}T23:59:59+09:00`);
  if (dayRows.some(row => !(Date.parse(row.source_updated_at || '') >= cutoff))) return { ...output, reason: '전날 마감 이후 수집 여부가 확인되지 않아 대조를 보류합니다.' };
  const items = localItems(log), used = new Set();
  const rows = [...new Map(dayRows.map(row => [row.id || row.source_key, row])).values()];
  for (const row of rows) {
    const source = kstParts(row.scheduled_at);
    let index = items.findIndex((item, i) => !used.has(i) && item.id && [row.id, row.source_key].includes(item.id));
    if (EXCLUDED.has(row.status)) {
      if (index >= 0) used.add(index);
      output.exceptions.push({ time: source.time, kind: row.status === 'cancelled' ? '취소' : row.status === 'no-show' ? '노쇼' : '연기' });
      continue;
    }
    if (index < 0) index = items.findIndex((item, i) => !used.has(i) && !item.id && !EXCLUDED.has(item.status) && item.time === source.time && (item.type === row.session_type || item.type === 'unknown'));
    output.compared++;
    if (index < 0) {
      output.differences.push({ kind: 'missing', dagym: source.time, worklog: '대응 일정 미확인', session: row.session_type });
      continue;
    }
    used.add(index);
    const item = items[index];
    if (EXCLUDED.has(item.status)) {
      output.exceptions.push({ time: source.time, kind: '업무일지 취소·노쇼·연기 처리 확인' });
      continue;
    }
    if (item.time !== source.time || (item.type !== 'unknown' && item.type !== row.session_type)) {
      output.differences.push({ kind: 'changed', dagym: source.time, worklog: item.time || '시간 미기록', session: row.session_type, worklogSession: item.type,
        note: row.worklog_override_at ? '업무일지 수정 이력이 있습니다. 변경 사유와 원본 반영 여부를 확인하세요.' : '시간 또는 유료·무료 구분을 확인하세요.' });
    }
  }
  items.forEach((item, i) => {
    if (!used.has(i) && !EXCLUDED.has(item.status)) output.differences.push({ kind: 'unlinked', dagym: '연결 미확인', worklog: item.time || '시간 미기록', session: item.type,
      note: '다짐 누락으로 확정하지 않습니다. 강사 배정·직접 입력·수집 범위를 확인하세요.' });
  });
  output.status = output.differences.length ? 'review' : 'compared';
  output.reason = '확인된 시간표의 시작 시각·유료/무료 구분을 대조했습니다. 수업 완료·회원 일치·전체 수집 완전성을 판정한 결과가 아닙니다.';
  return output;
}
module.exports = { compare, localItems, kstParts };

const { compare } = require('./_lib/pt-schedule-comparison.cjs');
const BASE = process.env.SUPABASE_URL || 'https://zllpfaijahyfppivkxzu.supabase.co';
module.exports = async function(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'method' });
  const authorization = String(req.headers.authorization || '');
  if (!/^Bearer \S+$/.test(authorization)) return res.status(401).json({ error: '로그인이 필요합니다.' });
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return res.status(503).json({ error: '대조 자료를 확인할 수 없습니다.' });
  const read = async (path, auth = `Bearer ${key}`) => {
    const response = await fetch(`${BASE}${path}`, { headers: { apikey: key, Authorization: auth }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw Error('unavailable');
    return response.json();
  };
  try {
    let user;
    try { user = await read('/auth/v1/user', authorization); } catch { return res.status(401).json({ error: '로그인을 확인해주세요.' }); }
    // No client-supplied trainer, owner or profile can expand this scope.
    const [profile] = await read(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=approval_status,org,workplace,role,primary_work`);
    if (profile?.approval_status !== 'approved' || !/피트니스|fitness/i.test(`${profile.org || ''} ${profile.workplace || ''}`)
      || !/트레이너|센터장|강사|코치|pt|피티/i.test(`${profile.role || ''} ${profile.primary_work || ''}`)) return res.status(403).json({ error: '본인 트레이너 보고서에서 확인할 수 있습니다.' });
    const reportDate = String(req.query?.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate) || !Number.isFinite(Date.parse(reportDate)) || new Date(reportDate).toISOString().slice(0, 10) !== reportDate) return res.status(400).json({ error: '날짜를 확인해주세요.' });
    const date = new Date(`${reportDate}T00:00:00Z`); date.setUTCDate(date.getUTCDate() - 1);
    const sourceDate = date.toISOString().slice(0, 10);
    const from = `${sourceDate}T00:00:00+09:00`, until = `${reportDate}T00:00:00+09:00`;
    const fields = 'id,source_key,scheduled_at,session_type,status,active,source_updated_at,worklog_override_at';
    const [events, logs] = await Promise.all([
      read(`/rest/v1/dagym_pt_schedule_events?center_key=eq.beyond-fitness&trainer_profile_id=eq.${encodeURIComponent(user.id)}&active=eq.true&scheduled_at=gte.${encodeURIComponent(from)}&scheduled_at=lt.${encodeURIComponent(until)}&select=${fields}&order=scheduled_at.asc&limit=1000`),
      read(`/rest/v1/worklog_states?user_id=eq.${encodeURIComponent(user.id)}&log_date=eq.${sourceDate}&select=state,updated_at&order=updated_at.desc&limit=1`),
    ]);
    if (events.length >= 1000) return res.status(503).json({ error: '수업 조회 범위를 확인해야 합니다. 대조를 보류합니다.' });
    return res.status(200).json(compare({ reportDate, sourceDate, events, log: logs[0]?.state?.ownerWorklog || null }));
  } catch { return res.status(503).json({ error: '전날 수업 대조 자료를 확인하지 못했습니다. 업무일지는 계속 저장할 수 있습니다.' }); }
};

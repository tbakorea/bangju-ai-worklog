const {analyze,dateOK}=require('./_lib/fitness-revenue-analysis.cjs');
const BASE=process.env.SUPABASE_URL||'https://zllpfaijahyfppivkxzu.supabase.co';
function allowed(p){return p?.approval_status==='approved'&&(['(주)방주','(주)비욘드컴퍼니'].includes(p.org)||/피트니스|fitness/i.test(p.workplace||'')||/^(대표|ceo|owner)$/i.test(p.role||'')||p.access_preset==='owner');}
async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');if(req.method!=='GET')return res.status(405).json({error:'method'});
 const auth=String(req.headers.authorization||'');if(!/^Bearer \S+$/.test(auth))return res.status(401).json({error:'로그인이 필요합니다.'});
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!key)return res.status(503).json({error:'매출 분석 연결을 확인해주세요.'});
 const read=async(path,authorization=`Bearer ${key}`)=>{const r=await fetch(BASE+path,{headers:{apikey:key,Authorization:authorization},signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('source');return r.json();};
 try{
  let user;try{user=await read('/auth/v1/user',auth);}catch{return res.status(401).json({error:'로그인을 확인해주세요.'});}
  const[p]=await read(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=approval_status,org,workplace,role,access_preset`);
  if(!allowed(p))return res.status(403).json({error:'매출 피드백 조회 권한이 없습니다.'});
  const date=String(req.query?.date||'');const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  if(!dateOK(date)||date>today)return res.status(400).json({error:'날짜를 확인해주세요.'});
  const rows=await read(`/rest/v1/dagym_daily_snapshots?center_key=eq.beyond-fitness&snapshot_date=lt.${date}&select=snapshot_date,metrics,domains,quality&order=snapshot_date.desc&limit=400`);
  return res.status(200).json(analyze({date,rows}));
 }catch{return res.status(503).json({error:'매출 자료를 확인하지 못했습니다. 미확인을 0으로 판단하지 않습니다.'});}
}
module.exports=handler;module.exports.allowed=allowed;

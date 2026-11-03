const BASE=process.env.SUPABASE_URL||'https://zllpfaijahyfppivkxzu.supabase.co';
const number=value=>value===null||value===undefined||String(value).trim()===''?null:Number.isInteger(Number(value))&&Number(value)>=0?Number(value):null;
function project(row,date,sourceDate){
 const valid=row?.snapshot_date===sourceDate&&['complete','partial'].includes(row.quality);
 const attendance=row?.domains?.attendance||{},schedule=row?.domains?.schedule||{};
 const visits=valid&&attendance.ok===true&&attendance.authenticated===true&&attendance.rangeVerified===true&&attendance.period==='daily'?number(row.metrics?.visits):null;
 let bookings=valid?number(row.metrics?.ptBookings):null;
 if(bookings===0&&schedule.source==='dagym_pt_schedule_events'&&schedule.rows===0&&schedule.bookingMetricVerified!==true&&schedule.emptyVerified!==true)bookings=null;
 return {date,sourceDate,status:valid?row.quality:'missing',counts:{visits,ptBookings:bookings}};
}
async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');if(req.method!=='GET')return res.status(405).json({error:'method'});
 const authorization=String(req.headers.authorization||'');if(!/^Bearer \S+$/.test(authorization))return res.status(401).json({error:'로그인이 필요합니다.'});
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!key)return res.status(503).json({error:'운영 요약을 확인할 수 없습니다.'});
 const read=async(path,auth=`Bearer ${key}`)=>{const r=await fetch(BASE+path,{headers:{apikey:key,Authorization:auth},signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('source');return r.json();};
 try{
  let user;try{user=await read('/auth/v1/user',authorization);}catch{return res.status(401).json({error:'로그인을 확인해주세요.'});}
  const[p]=await read(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=approval_status,org,workplace,role,access_preset`);
  if(p?.approval_status!=='approved'||(!/피트니스|fitness/i.test(`${p.org||''} ${p.workplace||''}`)&&!/대표|ceo|owner/i.test(p.role||'')&&p.access_preset!=='owner'))return res.status(403).json({error:'운영 요약 조회 권한이 없습니다.'});
  const date=String(req.query?.date||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)return res.status(400).json({error:'날짜를 확인해주세요.'});
  const prior=new Date(date+'T00:00:00Z');prior.setUTCDate(prior.getUTCDate()-1);const sourceDate=prior.toISOString().slice(0,10);
  const[row]=await read(`/rest/v1/dagym_daily_snapshots?center_key=eq.beyond-fitness&snapshot_date=eq.${sourceDate}&select=snapshot_date,metrics,domains,quality&limit=1`);
  return res.status(200).json(project(row,date,sourceDate));
 }catch{return res.status(503).json({error:'전일 운영 요약을 확인하지 못했습니다. 본인 기록 피드백은 계속 사용할 수 있습니다.'});}
}
module.exports=handler;module.exports.project=project;

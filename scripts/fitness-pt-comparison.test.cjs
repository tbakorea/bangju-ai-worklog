const {test}=require('node:test');const assert=require('node:assert/strict');
const {compare}=require('../api/_lib/pt-schedule-comparison.cjs');
const handler=require('../api/fitness-pt-comparison.js');
const base={reportDate:'2026-11-02',sourceDate:'2026-11-01',now:new Date('2026-11-02T03:00:00+09:00')};
const event=(patch={})=>({id:'class-a',scheduled_at:'2026-11-01T16:00:00+09:00',session_type:'paid',status:'completed',active:true,source_updated_at:'2026-11-02T03:00:00+09:00',...patch});
const log=(time='16:00',patch={})=>({schedule:[{time,items:[{text:'PRIVATE 010-1111-2222 PT 수업',source:'dagym-monthly-pt',sourceId:'class-a',dagymSessionType:'paid',dagymStatus:'completed',...patch}]}]});
const run=(events,record)=>compare({...base,events,log:record});
test('same ID matches exact time, shift and free/paid mismatch have both times and types',()=>{
 assert.equal(run([event()],log()).status,'compared');
 const shifted=run([event({worklog_override_at:'2026-11-01T05:00:00Z'})],log('17:30',{dagymSessionType:'free'}));
 assert.equal(shifted.status,'review');assert.equal(shifted.differences[0].dagym,'16:00');assert.equal(shifted.differences[0].worklog,'17:30');assert.equal(shifted.differences[0].worklogSession,'free');
 assert.ok(!/PRIVATE|010-|class-a/.test(JSON.stringify(shifted)));
 assert.equal(run([event()],log('',{dagymScheduledAt:event().scheduled_at})).differences[0].worklog,'시간 미기록');
});
test('missing counterpart and unlinked manual class are review, not a claim of skipped work',()=>{
 assert.equal(run([event()],{schedule:[]}).differences[0].kind,'missing');
 const result=run([event()],{schedule:[{time:'19:00',items:[{text:'PT 수업',type:'유료PT'}]}]});
 assert.deepEqual(result.differences.map(x=>x.kind),['missing','unlinked']);
 assert.ok(result.guidance.includes('단정하지'));
});
test('manual schedule time multiset, duplicate source IDs, cancelled/no-show/postponed exceptions',()=>{
 assert.equal(run([event()],{schedule:[{time:'16:00',items:[{text:'직접 PT 수업',type:'유료PT'}]}]}).status,'compared');
 const duplicate=log();duplicate.schedule.push(...log().schedule);assert.equal(run([event(),event()],duplicate).differences.length,0);
 for(const status of ['cancelled','no-show','postponed']){const result=run([event({status})],{schedule:[]});assert.equal(result.differences.length,0);assert.equal(result.exceptions.length,1);}
 const localCancelled=run([event()],log('16:00',{dagymStatus:'cancelled'}));assert.equal(localCancelled.differences.length,0);assert.equal(localCancelled.exceptions.length,1);
});
test('missing, stale or unknown date data never becomes success or zero',()=>{
 assert.equal(run([],log()).status,'unavailable');assert.equal(run([event()],null).status,'unavailable');
 assert.equal(run([event({source_updated_at:'2026-11-01T12:00:00Z'})],log()).status,'unavailable');
 assert.equal(run([event({scheduled_at:'2026-10-31T16:00:00+09:00'})],log()).status,'unavailable');
 assert.equal(compare({...base,sourceDate:'2026-11-02',events:[event()],log:log()}).status,'unavailable');
});
test('KST dates cross months and midnight minutes remain exact',()=>{
 const result=compare({...base,reportDate:'2026-11-01',sourceDate:'2026-10-31',events:[event({scheduled_at:'2026-10-30T15:30:00Z'})],log:log('00:30')});
 assert.equal(result.status,'compared');
});
test('API isolates authenticated owner and rejects role, approval, forged owner and invalid dates',async()=>{
 const oldFetch=global.fetch,oldKey=process.env.SUPABASE_SERVICE_ROLE_KEY;process.env.SUPABASE_SERVICE_ROLE_KEY='fixture';
 let role='트레이너',approval='approved',calls=[];const own='11111111-1111-4111-8111-111111111111';
 global.fetch=async url=>{url=String(url);calls.push(url);let data=[];
  if(url.endsWith('/auth/v1/user'))data={id:own};
  else if(url.includes('/profiles?'))data=[{approval_status:approval,org:'비욘드 피트니스',role}];
  else if(url.includes('/dagym_pt_schedule_events?'))data=[event()];
  else if(url.includes('/worklog_states?'))data=[{state:{ownerWorklog:log()}}];
  return {ok:true,json:async()=>data};
 };
 const request=async(headers={authorization:'Bearer fixture'},date='2026-11-02')=>{const res={setHeader(){},status(n){this.code=n;return this;},json(value){this.body=value;return this;}};await handler({method:'GET',headers,query:{date,owner:'another-user',trainer_profile_id:'another-user'}},res);return res;};
 try{
  assert.equal((await request({})).code,401);
  role='인포';assert.equal((await request()).code,403);role='트레이너';approval='pending';assert.equal((await request()).code,403);
  approval='approved';assert.equal((await request(undefined,'2026-02-30')).code,400);
  calls=[];const result=await request();assert.equal(result.code,200);
  assert.ok(calls.find(x=>x.includes('/worklog_states?')).includes('user_id=eq.'+own));assert.ok(calls.find(x=>x.includes('/dagym_pt_schedule_events?')).includes('trainer_profile_id=eq.'+own));
  assert.ok(!JSON.stringify(result.body).includes('PRIVATE'));
 }finally{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=oldKey;}
});

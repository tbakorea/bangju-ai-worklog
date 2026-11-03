const test=require('node:test'),assert=require('node:assert/strict');
const handler=require('../api/fitness-operating-brief'),encourage=require('../lib/fitness-report-encouragement');
test('projection exposes only verified selected-day operational counts, preserves real zero and drops synthetic zero',()=>{
 const row={snapshot_date:'2026-11-02',quality:'partial',metrics:{visits:0,ptBookings:0,sales:987654321,memberName:'PRIVATE',phone:'010-1111-2222'},domains:{attendance:{ok:true,authenticated:true,rangeVerified:true,period:'daily'},schedule:{source:'dagym_pt_schedule_events',rows:0}}};
 const p=handler.project(row,'2026-11-03','2026-11-02');assert.equal(p.counts.visits,0);assert.equal(p.counts.ptBookings,null);assert.ok(!/987654321|PRIVATE|010-|sales|member/.test(JSON.stringify(p)));
 row.domains.schedule.bookingMetricVerified=true;assert.equal(handler.project(row,'2026-11-03','2026-11-02').counts.ptBookings,0);
 assert.equal(handler.project(row,'2026-11-03','2026-11-01').status,'missing');row.domains.attendance.rangeVerified=false;assert.equal(handler.project(row,'2026-11-03','2026-11-02').counts.visits,null);
});
test('encouragement uses self-reported evidence, offers a manageable role action and never invents improvement',()=>{
 const feedback=encourage.build({roleKey:'frontDesk',consultation:1,sns:1});assert.ok(feedback.message.includes('상담 1건을 기록'));assert.ok(feedback.action.includes('다음 안내'));
 const absent=encourage.build({roleKey:'__proto__',consultation:null,completed:-1,pt:Infinity});assert.equal(absent.value,'한 걸음부터');assert.ok(!/향상|달성|매출|완료했습니다/.test(absent.message));assert.ok(absent.action);
 const support=encourage.build({roleKey:'trainer',support:1,pt:10});assert.ok(support.message.includes('함께 해결'));assert.ok(!support.message.includes('완료'));
 const input={roleKey:'frontDesk',consultation:1,text:'PRIVATE 987654321원'};assert.ok(!JSON.stringify(encourage.build(input)).includes('PRIVATE'));assert.equal(input.consultation,1);
});
test('approved fitness staff can retrieve safe counts; unapproved and other organizations cannot, regardless of query role',async()=>{
 const oldFetch=global.fetch,oldKey=process.env.SUPABASE_SERVICE_ROLE_KEY;process.env.SUPABASE_SERVICE_ROLE_KEY='fixture';let approval='approved',org='비욘드 피트니스',calls=[];
 const own='11111111-1111-4111-8111-111111111111';global.fetch=async url=>{url=String(url);calls.push(url);let data=[];
 if(url.endsWith('/auth/v1/user'))data={id:own};else if(url.includes('/profiles?'))data=[{approval_status:approval,org,role:'인포',access_preset:'employee'}];
 else data=[{snapshot_date:'2026-11-02',quality:'partial',metrics:{visits:20,ptBookings:7,sales:987654321},domains:{attendance:{ok:true,authenticated:true,rangeVerified:true,period:'daily'}}}];
 return{ok:true,json:async()=>data};};
 const run=async(headers={authorization:'Bearer fixture'},date='2026-11-03')=>{const res={setHeader(){},status(n){this.code=n;return this;},json(value){this.body=value;return this;}};await handler({method:'GET',headers,query:{date,role:'owner',owner:'another-user',fields:'sales'}},res);return res;};
 try{assert.equal((await run({})).code,401);approval='pending';assert.equal((await run()).code,403);approval='approved';org='다른 회사';assert.equal((await run()).code,403);org='비욘드 피트니스';assert.equal((await run(undefined,'2026-02-30')).code,400);
 const result=await run();assert.equal(result.code,200);assert.equal(result.body.sourceDate,'2026-11-02');assert.equal(result.body.counts.visits,20);assert.ok(!JSON.stringify(result.body).includes('987654321'));assert.ok(calls.some(url=>url.includes('profiles?id=eq.'+own)));assert.ok(calls.some(url=>url.includes('snapshot_date=eq.2026-11-02')));
 }finally{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=oldKey;}
});

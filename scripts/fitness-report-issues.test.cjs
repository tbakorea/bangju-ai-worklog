const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/fitness-report-issues');
const {projectIssues} = handler;
const date='2026-11-02';
test('privacy-safe categories, deduplication, negative reports and source dates',()=>{
 const output=projectIssues({date,action:'증빙 확인',analysis:{analysis_date:date,source_date:'2026-11-01',quality:'partial',signals:[{type:'no-show',detail:'PRIVATE 010-1111-2222'},{type:'pt-gap',title:'직원 부진'}]},logs:[{state:{ownerWorklog:{fitnessOps:{specialReport:'회원 PRIVATE 010-1111-2222 환불 999999원, 기구 고장'}}}},{state:{ownerWorklog:{fitnessOps:{specialReport:'시설 고장'}}}}]});
 assert.equal(output.issues.filter(x=>x.key==='facility').length,1);
 assert.ok(output.issues.some(x=>x.key==='finance'));
 assert.ok(output.issues.some(x=>x.key==='data'));
 assert.ok(!/PRIVATE|010-|999999|직원 부진|pt-gap/.test(JSON.stringify(output)));
 assert.equal(projectIssues({date,analysis:{analysis_date:date,source_date:'2026-10-31',quality:'complete',signals:[{type:'no-show'}]},logs:[],action:''}).status,'partial');
 assert.equal(projectIssues({date,logs:[{state:{ownerWorklog:{fitnessOps:{specialReport:'특이사항 없음.'}}}}]}).issues.length,0);
});
test('authentication and fixed approved recipients; raw sources never returned',async()=>{
 const original=global.fetch, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 process.env.SUPABASE_SERVICE_ROLE_KEY='test-only';
 let email='other@example.invalid',approved='approved',calls=[];
 global.fetch=async url=>{
  calls.push(String(url));let body=[];
  if(String(url).endsWith('/auth/v1/user'))body={id:'11111111-1111-4111-8111-111111111111',email};
  else if(String(url).includes('select=name'))body=[{name:'김경희',approval_status:approved}];
  else if(String(url).includes('/profiles?approval'))body=[{id:'22222222-2222-4222-8222-222222222222',workplace:'비욘드 피트니스'}];
  else if(String(url).includes('/worklog_states'))body=[{user_id:'a',state:{ownerWorklog:{fitnessOps:{specialReport:'기구 고장 PRIVATE'}}}}];
  return {ok:true,json:async()=>body};
 };
 const run=async(headers={authorization:'Bearer test'},date='2026-11-02')=>{const res={setHeader(){},status(n){this.code=n;return this;},json(b){this.body=b;return this;}};await handler({method:'GET',headers,query:{date}},res);return res;};
 try{
  assert.equal((await run({})).code,401);
  assert.equal((await run()).code,403);assert.equal(calls.length,1);
  email='onse2@naver.com';approved='pending';assert.equal((await run()).code,403);
  approved='approved';assert.equal((await run(undefined,'2026-02-30')).code,400);
  const result=await run();assert.equal(result.code,200);assert.ok(result.body.issues.some(i=>i.key==='facility'));assert.ok(!JSON.stringify(result.body).includes('PRIVATE'));
 }finally{global.fetch=original;if(key===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=key;}
});

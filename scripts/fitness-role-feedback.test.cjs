const test = require("node:test");
const assert = require("node:assert/strict");
const coach = require("../lib/fitness-role-feedback.js");
const context = (extra = {}) => ({dateKey:"2026-11-02",employee:{role:"인포데스크"},taskSummary:{items:[{text:"만료 상담 확인",status:"완료"}]},...extra});
const previous = (extra = {}) => ({log_date:"2026-11-01",response_code:"execute",status:"in_progress",fitness_feedback:{version:1,roleKey:"frontDesk",stepKey:"inquiry-next"},...extra});

test("role plans use assigned duties and never default an unknown role to manager", () => {
  for (const [input,expected] of [["센터장","manager"],["트레이너","trainer"],["주말 인포","frontDesk"],["상담","sales"],["홍보","marketing"],["시설","facility"],["청소","cleaning"],["직원","general"]]) assert.equal(coach.role({role:input}),expected);
  assert.equal(coach.role({role:"직원",position:"센터장"}),"manager");
  assert.equal(coach.role({role:"직원",primaryWork:"청결 관리"}),"cleaning");
  assert.equal(coach.role({role:"인포",primaryWork:"PT 상담"}),"frontDesk");
  assert.equal(coach.role({role:"트레이너",primaryWork:"청소"}),"trainer");
});

test("elapsed dates, sales and task completion alone do not claim prior improvement", () => {
  const a=coach.build(context(),{status:"ready",rows:[]});
  const b=coach.build(context({dateKey:"2026-12-02",sales:50000000}),{status:"ready",rows:[]});
  assert.equal(a.stage,"start");assert.equal(a.stepKey,b.stepKey);
  assert.match(a.observation,/완료 표시 1건/);assert.doesNotMatch(a.encouragement,/성과를 달성|관리자 확인/);
  assert.doesNotMatch(JSON.stringify(a),/50000000/);
});

test("an unfinished action continues; support pauses escalation", () => {
  const ongoing=coach.build(context(),{status:"ready",rows:[previous()]});
  assert.equal(ongoing.stage,"continue");assert.equal(ongoing.stepKey,"inquiry-next");
  const support=coach.build(context(),{status:"ready",rows:[previous({response_code:"support",status:"support_needed"})]});
  assert.equal(support.stage,"support");assert.match(support.action,/지원/);assert.doesNotMatch(support.action,/매출|등록.*건/);
  const deferred=coach.build(context(),{status:"ready",rows:[previous({response_code:"defer",status:"deferred"})]});
  assert.equal(deferred.stage,"defer");assert.match(deferred.action,/보류 사유/);
  const recurring=coach.build(context(),{status:"ready",rows:[previous({status:"completed",followup_result:"recurring"})]});
  assert.equal(recurring.stage,"continue");assert.equal(recurring.stepKey,"inquiry-next");
});

test("completed plans move one step on the next day, not each save on the same day", () => {
  const done=previous({status:"completed"});
  const next=coach.build(context(),{status:"ready",rows:[done,done]});
  assert.equal(next.stage,"repeat");assert.equal(next.stepKey,"renewal-question");
  assert.match(next.encouragement,/완료로 남겼/);assert.doesNotMatch(next.encouragement,/관리자 확인/);
  const today={...done,log_date:"2026-11-02"};
  assert.equal(coach.build(context(),{status:"ready",rows:[]},today).stepKey,"inquiry-next");
});

test("future/other-role history is excluded; missing history is explicit", () => {
  const result=coach.build(context(),{status:"unavailable",rows:[previous({log_date:"2026-11-03",status:"completed"}),previous({fitness_feedback:{version:1,roleKey:"trainer",stepKey:"lesson-result"},status:"completed"})]});
  assert.equal(result.stage,"start");assert.equal(result.historyStatus,"unavailable");
  const verified=coach.build(context(),{status:"ready",rows:[previous({status:"completed",followup_result:"improved",reviewed_at:"2026-11-01T12:00:00Z"})]});
  assert.match(verified.encouragement,/관리자 확인/);
});

test("AI projection discards member/company/raw worklog content in browser and API", () => {
  const secret="PRIVATE_MEMBER_연락처_매출_급여_이자";
  const feedback=coach.build(context({reportNotes:[secret],taskSummary:{items:[{text:secret,status:"완료"}]}}),{status:"ready",rows:[]});
  const result=coach.aiContext({dateKey:"2026-11-02",roleFeedback:{...feedback,action:secret,purpose:secret},dagym:{sales:50000000},previousDayAnalysis:{managementDirection:secret},reportNotes:[secret],employee:{name:secret}});
  const text=JSON.stringify(result);assert.ok(!text.includes(secret));assert.ok(!text.includes("50000000"));
  assert.ok(!Object.hasOwn(result,"dagym"));assert.equal(result.employee.role,"인포");
  assert.deepEqual(coach.aiContext(result),result);
});

test("fitness API reprojects incoming progress context before sending to AI", async () => {
  const handler=require("../api/fitness-coach.js");
  const fetchBefore=global.fetch,keyBefore=process.env.OPENAI_API_KEY;
  const secret="PRIVATE_COMPANY_PAYROLL_50000000";let provider=null;
  process.env.OPENAI_API_KEY="test-key";
  global.fetch=async (url,options)=>{
    if(url.includes("/auth/v1/user"))return{ok:true,json:async()=>({id:"qa-user"})};
    provider=JSON.parse(options.body);
    return{ok:true,json:async()=>({output_text:JSON.stringify({praise:"회원 경험을 연결합니다.",feedback:"확인한 질문을 다음 안내와 연결해 보세요.",nextAction:"담당 상담 한 건을 확인하세요.",manualReminder:"실제 결과를 구분합니다.",evidence:["당일 업무기록"]})})};
  };
  let status,payload;
  const response={setHeader(){},status(s){status=s;return this;},json(v){payload=v;return this;}};
  try{
    const roleFeedback=coach.build(context(),{status:"ready",rows:[]});
    await handler({method:"POST",headers:{authorization:"Bearer qa"},body:{context:{coachingStyle:"fitness-progress-v2",dateKey:"2026-11-02",roleFeedback,dagym:{secret},manual:{text:secret}}}},response);
    assert.equal(status,200);assert.equal(payload.ok,true);assert.ok(!JSON.stringify(provider).includes(secret));
    assert.match(provider.instructions,/추가 과제나 수량 목표를 만들지/);
  }finally{global.fetch=fetchBefore;if(keyBefore===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=keyBefore;}
});

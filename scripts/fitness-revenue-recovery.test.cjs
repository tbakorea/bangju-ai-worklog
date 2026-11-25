const assert = require('node:assert/strict');
const {build}=require('../lib/fitness-revenue-recovery');
for(const dateKey of ['2026-10-30','2026-11-25','2026-11-31','2026-12-01','2027-11-26','bad']) assert.equal(build({dateKey,fitness:true}),null);
for(const org of ['(주)방주','(주)비욘드컴퍼니']) {
  const brief=build({dateKey:'2026-11-26',org});
  assert.match(brief.how,/집계 기준일/);assert.match(brief.result,/원인 가설과 근거/);
}
assert.equal(build({dateKey:'2026-11-26',org:'other'}),null);
for(const roleKey of ['frontDesk','trainer','sales','marketing','cleaning','facility','manager','general','__proto__']) {
 const brief=build({dateKey:'2026-11-30',fitness:true,roleKey});
 assert.match(brief.source,/연결 대기/);assert.match(brief.source,/미확인/);assert.ok(brief.how&&brief.example&&brief.result);
 if(['cleaning','facility'].includes(roleKey))assert.doesNotMatch(brief.how,/결제|재등록/);
}
assert.match(build({dateKey:'2026-11-26',fitness:true,isCenter:true}).how,/실제 결제/);
console.log('PASS: date expiry, organizations, role-specific coaching, source distinction');

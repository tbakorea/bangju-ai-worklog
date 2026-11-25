const test=require('node:test'),assert=require('node:assert/strict');
const {analyze}=require('../api/_lib/fitness-revenue-analysis.cjs');
const base=require('../api/_lib/fitness-revenue-baseline.cjs');
const {build}=require('../lib/fitness-revenue-recovery.js');
const handler=require('../api/fitness-revenue-feedback.js');
const row=(date='2026-11-25',sales=16337100)=>({snapshot_date:date,quality:'partial',metrics:{sales},domains:{sales:{ok:true,authenticated:true,rangeVerified:true,period:'month-to-date'}}});
test('verified comparison reconciles PT decrease and public offset',()=>{
 const a=analyze({date:'2026-11-26',rows:[row()]});
 assert.equal(a.history.length,28);assert.equal(a.previous.total,34726600);assert.equal(a.comparison.total,23841100);
 assert.equal(a.comparison.change,-7504000);assert.ok(Math.abs(a.comparison.changePct+31.475)<.001);
 assert.deepEqual(a.composition.changes,{public:1858000,pt:-9362000});
 assert.equal(a.composition.changes.public+a.composition.changes.pt,a.comparison.change);
 assert.ok(a.signals.some(s=>s.key==='pt'));assert.ok(a.signals.some(s=>s.key==='public-trend'));
 assert.match(build({dateKey:a.date,fitness:true,roleKey:'frontDesk',analysis:a}).how,/늘었습니다/);
 assert.match(build({dateKey:a.date,fitness:true,roleKey:'trainer',analysis:a}).title,/PT 상담/);
});
test('does not add cumulative snapshots or substitute unknown with zero',()=>{
 const a=analyze({date:'2026-11-26',rows:[row('2026-11-24',15300100),row()]});assert.equal(a.current.total,16337100);
 for(const value of [null,undefined,'16337100',NaN,-1]){const invalid=row();invalid.metrics.sales=value;assert.equal(analyze({date:a.date,rows:[invalid]}).status,'missing');}
 const zero=analyze({date:a.date,rows:[row('2026-11-25',0)]});assert.equal(zero.current.total,0);assert.equal(zero.composition,null);
 const unauth=row();unauth.domains.sales.authenticated=false;assert.equal(analyze({date:a.date,rows:[unauth]}).status,'missing');
});
test('stale, future, month rollover and mismatched composition remain explicit',()=>{
 const a=analyze({date:'2026-11-27',rows:[row(),row('2026-11-27',99999999)]});assert.equal(a.status,'stale');assert.equal(a.sourceDate,'2026-11-25');
 assert.equal(analyze({date:'2026-12-02',rows:[row()]}).status,'missing');
 assert.equal(analyze({date:'2026-12-01',rows:[row('2026-11-30')]}).targetDate,'2026-11-30');
 assert.equal(analyze({date:'2026-11-26',rows:[row('2026-11-25',16337101)]}).composition,null);
 assert.throws(()=>analyze({date:'2026-02-30'}));
 const data={...base,daily:{},periods:[]};assert.equal(analyze({date:'2026-11-26',rows:[row()],data}).comparison,null);
});
test('zero baseline has no misleading infinite rate; source snapshots retain reconciled split',()=>{
 const a=analyze({date:'2026-11-26',rows:[row(),row('2026-10-25',23841100)]});assert.equal(a.composition.changes.pt,-9362000);
 const b=analyze({date:'2026-11-26',rows:[row(),row('2026-10-25',0)]});assert.equal(b.comparison.changePct,null);
});
test('API rejects unauthenticated/unapproved/outside-scope; returns aggregate-only projection',async()=>{
 process.env.SUPABASE_SERVICE_ROLE_KEY='qa-key';
 const res=()=>({statusCode:200,setHeader(){},status(c){this.statusCode=c;return this},json(d){this.body=d;return this}});
 let r=res();await handler({method:'GET',headers:{},query:{}},r);assert.equal(r.statusCode,401);
 const old=global.fetch;let profile={approval_status:'pending',org:'(주)방주'};
 try {global.fetch=async url=>({ok:true,json:async()=>String(url).includes('/auth/')?{id:'test'}:String(url).includes('/profiles?')?[profile]:[row()]});
 r=res();await handler({method:'GET',headers:{authorization:'Bearer test'},query:{date:'2026-11-26'}},r);assert.equal(r.statusCode,403);
 profile={approval_status:'approved',org:'unrelated'};r=res();await handler({method:'GET',headers:{authorization:'Bearer test'},query:{date:'2026-11-26'}},r);assert.equal(r.statusCode,403);
 profile={approval_status:'approved',org:'(주)방주'};r=res();await handler({method:'GET',headers:{authorization:'Bearer test'},query:{date:'2026-11-26'}},r);assert.equal(r.statusCode,200);assert.equal(r.body.current.total,16337100);assert.doesNotMatch(JSON.stringify(r.body),/member|phone|saleId|sourceHashes/);
 }finally{global.fetch=old;}
});
test('daily composition is allowlisted and used only at its reconciled cutoff',()=>{
 const {projectProducts,normalizeComposition}=require('../scripts/dagym-sales-composition.cjs');
 const value=projectProducts([{name:'헬스권',price:9309100,count:50},{name:'개인 PT',price:7028000,count:17}],{paidPrice:16337100,refundPrice:0,totalCount:67},'2026-11-25',16337100);
 assert.equal(value.pt,7028000);assert.doesNotMatch(JSON.stringify(value),/헬스권|개인/);
 assert.equal(normalizeComposition({...value,total:1},'2026-11-25',16337100),null);
 assert.equal(normalizeComposition(value,'2026-11-26',16337100),null);
 const r=row('2026-11-26',16337100);r.metrics.salesComposition={...value,endDate:'2026-11-26'};
 const a=analyze({date:'2026-11-27',rows:[r]});assert.equal(a.composition.pt,7028000);
});

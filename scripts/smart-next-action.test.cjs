const test=require('node:test'),assert=require('node:assert/strict');
const {rank}=require('../lib/smart-next-action.js');
const base={allowed:true,date:'2026-11-02',today:'2026-11-02',time:'15:50'};
const task=(key,extra={})=>({key,text:'증빙 확인',status:'미완료',priority:'A',...extra});
test('only current authorized context gets suggestions',()=>{
 assert.deepEqual(rank({...base,allowed:false}),[]);assert.deepEqual(rank({...base,date:'2026-11-01'}),[]);assert.deepEqual(rank({...base,date:'2026-11-03'}),[]);assert.deepEqual(rank({...base,date:'2026-02-30',today:'2026-02-30'}),[]);
 assert.equal(rank({...base,off:true,tasks:[task('a')]}).at(0).kind,'off');
 assert.equal(rank({...base,ended:true,tasks:[task('a')]}).at(0).id,'closed');
});
test('close appointment before support, explicit overdue/deadline, importance; no inferred deadline',()=>{
 const tasks=[task('a'),task('b',{priority:'C',status:'지원필요'}),task('c',{priority:'C',dueDate:'2026-11-01'}),task('d',{dueDate:'2026-11-02'})];
 const rows=rank({...base,tasks,schedule:[{key:'slot',time:'16:00',text:'납품 일정'}]});
 assert.deepEqual(rows.slice(0,5).map(x=>x.kind==='schedule'?x.id:x.taskKey),['schedule:slot','b','c','d','a']);
 assert.ok(!rank({...base,tasks:[task('a')]}).at(0).reason.includes('기한'));
});
test('completed/cancelled/delegated/future-postponed records never become new work',()=>{
 const tasks=[task('a',{done:true}),task('b',{status:'완료'}),task('c',{status:'취소'}),task('d',{status:'위임'}),task('e',{status:'연기',postponeDate:'2026-11-03'})];
 assert.equal(rank({...base,tasks,recorded:true})[0].kind,'wrap');
 assert.equal(rank({...base,tasks:[task('a',{status:'연기',postponeDate:'2026-11-02'})]})[0].kind,'task');
});
test('time checks do not call an elapsed reservation missed work; cancelled/complete excluded',()=>{
 const schedule=[{key:'elapsed',time:'15:00',text:'PT 수업'},{key:'cancel',time:'16:00',text:'PT',status:'cancelled'},{key:'done',time:'16:00',text:'PT',status:'completed'},{key:'bad',time:'25:00',text:'PT'},{key:'next',time:'17:00',text:'후속 일정'}];
 const rows=rank({...base,schedule});assert.deepEqual(rows.map(x=>x.id),['schedule:next']);
});
test('fitness only surfaces verified review/linked-empty, never turns source failure into a gap',()=>{
 const ptComparison={status:'review',sourceDate:'2026-11-01',differences:[{dagym:'16:00',worklog:'17:00'}]};
 assert.equal(rank({...base,ptComparison})[0].id,'pt-review');
 assert.ok(rank({...base,ptComparison})[0].reason.includes('16:00'));
 assert.equal(rank({...base,reminder:{status:'empty-linked'}})[0].id,'pt-register');
 assert.equal(rank({...base,ptComparison:{status:'unavailable'},reminder:{status:'unavailable'}})[0].kind,'start');
});
test('deterministic suggestions do not mutate input or create quotas',()=>{
 const input={...base,tasks:[task('a',{text:'PRIVATE 010-1111-2222 <script>'}),task('a')]};const before=JSON.stringify(input);
 const rows=rank(input);assert.equal(JSON.stringify(input),before);assert.equal(rows.length,1);assert.equal(rows[0].title,input.tasks[0].text);
 assert.ok(!/명.*달성|매출.*달성|불성실|지각/.test(rows[0].reason));
});

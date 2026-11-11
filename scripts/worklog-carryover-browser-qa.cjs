const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const {chromium} = require('playwright');
const server = spawn('/Users/bangju/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3', ['-m','http.server','8791'], {cwd:require('node:path').resolve(__dirname,'..'),stdio:'ignore'});
const userId='11111111-1111-4111-8111-111111111111', employeeId='bangju-finance-manager';
const now=new Date();
const date=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
const shift=days=>{const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
const sourceDate=shift(-1),nextDate=shift(1);
const clone=x=>JSON.parse(JSON.stringify(x));
const rows=new Map(); let writes=[],reads=[];
const log=(key,tasks)=>({employeeId,dateKey:key,tasks,schedule:[],updatedAt:'2026-01-01T00:00:00.000Z'});
function reset(){
 rows.clear();writes=[];reads=[];
 rows.set(sourceDate,{user_id:userId,log_date:sourceDate,updated_at:'2026-01-01T00:00:00.000Z',state:{employeeLogs:{[sourceDate]:{[employeeId]:log(sourceDate,[{id:'origin',priority:'A',text:'누적 방지 검증 업무',status:'미완료',done:false}])}}}});
 rows.set(date,{user_id:userId,log_date:date,updated_at:'2026-01-02T00:00:00.000Z',state:{employeeLogs:{[date]:{[employeeId]:log(date,[{id:'today',priority:'B',text:'오늘 신규 업무',status:'미완료',done:false}])}}}});
}
async function pageFor(browser,viewport){
 const page=await browser.newPage({viewport});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*.supabase.co/**',r=>r.abort());
 await page.exposeFunction('__readWorklogRows',async filters=>{
  reads.push(filters);let data=[...rows.values()].filter(r=>r.user_id===filters.user&&r.log_date<=filters.date&&(!filters.since||r.updated_at>=filters.since));
  data.sort((a,b)=>b.updated_at.localeCompare(a.updated_at)||b.log_date.localeCompare(a.log_date));
  return {data:clone(data.slice(filters.offset,filters.end+1).map(r=>({log_date:r.log_date,updated_at:r.updated_at,employeeLogs:r.state.employeeLogs}))),error:null};
 });
 await page.exposeFunction('__writeWorklogRow',async payload=>{assert.equal(payload.user_id,userId);writes.push(payload.log_date);rows.set(payload.log_date,clone(payload));return{error:null};});
 await page.goto('http://127.0.0.1:8791/index.html',{waitUntil:'domcontentloaded'});
 await page.evaluate(({userId,employeeId,date})=>window.eval(`
  authState.user={id:${JSON.stringify(userId)},email:'carryover-qa@example.invalid'};
  authState.session=null;
  state.profile={...defaultProfile,authUserId:${JSON.stringify(userId)},email:'carryover-qa@example.invalid',name:'강정훈',role:'상무이사',org:'(주)방주',workplace:'본사',approvalStatus:'approved',accessPreset:'employee',permissions:{}};
  state.selectedEmployeeId=${JSON.stringify(employeeId)};state.selectedDateKey=${JSON.stringify(date)};todayKey=${JSON.stringify(date)};
  state.employeeLogs={};activeView='bangju-log';
  supabaseClient.from=table=>{
   const f={};const q={};q.select=()=>q;q.eq=(k,v)=>{if(k==='user_id')f.user=v;return q;};
   q.lte=(k,v)=>{if(k==='log_date')f.date=v;return q;};q.gte=(k,v)=>{if(k==='updated_at')f.since=v;return q;};q.order=()=>q;
   q.range=(offset,end)=>window.__readWorklogRows({...f,offset,end});
   q.upsert=payload=>{if(table!=='worklog_states')throw Error('Unexpected write');return window.__writeWorklogRow(payload);};
   return q;
  };
 `),{userId,employeeId,date});
 return{page,errors};
}
const run=(page,code)=>page.evaluate(code=>window.eval(code),code);
(async()=>{
 let browser;
 try{
  await new Promise(r=>setTimeout(r,700));browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  for(const viewport of [{width:390,height:844},{width:820,height:1180},{width:1440,height:1000}]){
   reset();const phone=await pageFor(browser,{width:390,height:844}),pc=await pageFor(browser,viewport);
   for(const {page}of[phone,pc])assert.equal(await run(page,`loadRemoteEmployeeCarryoverContext('${date}')`),true);
   for(const {page}of[phone,pc])await run(page,`switchView('bangju-log')`);
   const before=await run(pc.page,`(()=>{const employee=getSelectedEmployee(),log=state.employeeLogs['${date}']['${employeeId}'];const model=buildWorklogDailyReportModel({employee,dateKey:'${date}',log});return model.tasks.map(t=>({text:t.text,source:t.carryoverSourceDate}));})()`);
   assert.equal(before.length,2);assert(before.some(t=>t.text==='누적 방지 검증 업무'&&t.source===sourceDate));
   await run(phone.page,`(async()=>{
    const log=state.employeeLogs['${date}']['${employeeId}'];
    renderWorklogTaskBoard(log);
    const row=[...document.querySelectorAll('#worklogTaskBoard .worklog-task-row')].find(r=>r.querySelector('.task-text-input').value==='누적 방지 검증 업무');
    row.querySelector('.task-cycle').click();
    await flushPendingRemoteSaves();
   })()`);
   const completedRow=await run(phone.page,`(()=>{const row=[...document.querySelectorAll('#worklogTaskBoard .worklog-task-row')].find(r=>r.querySelector('.task-text-input').value==='누적 방지 검증 업무');return{visible:!!row&&row.getBoundingClientRect().height>0,completed:!!row?.classList.contains('status-complete'),marker:row?.querySelector('.task-cycle').textContent};})()`);
   assert.equal(completedRow.visible,true);assert.equal(completedRow.completed,true);assert(completedRow.marker);
   assert(writes.includes(sourceDate));assert(writes.includes(date));
   assert.equal(rows.get(sourceDate).state.employeeLogs[sourceDate][employeeId].tasks[0].carryoverDeletedFrom,date);
   // Also reproduce pre-fix data: the completion exists but the origin's stop marker was never saved.
   delete rows.get(sourceDate).state.employeeLogs[sourceDate][employeeId].tasks[0].carryoverDeletedFrom;
   assert.equal(await run(pc.page,`loadRemoteEmployeeCarryoverContext('${date}')`),true);
   const after=await run(pc.page,`(()=>{const log=state.employeeLogs['${date}']['${employeeId}'];const refs=getWorklogTaskRefs(log).filter(r=>isActiveTask(r.task));const model=buildWorklogDailyReportModel({employee:getSelectedEmployee(),dateKey:'${date}',log});return{refs:refs.map(r=>({text:r.task.text,done:r.task.done})),report:model.tasks,board:getVisibleWorklogTaskRefs(log).filter(r=>isActiveTask(r.task)).map(r=>r.task.text),fitnessBoard:getVisibleWorklogTaskRefs(log,{view:'fitness-log',compactEditable:true}).filter(r=>isActiveTask(r.task)).map(r=>r.task.text)};})()`);
   assert.equal(after.refs.length,2);assert.equal(after.refs.filter(r=>r.text==='누적 방지 검증 업무').length,1);assert(after.refs.find(r=>r.text==='누적 방지 검증 업무').done);
   assert(after.report.some(r=>r.text==='누적 방지 검증 업무'&&r.carryoverSourceDate===sourceDate&&r.status==='완료'));
   assert.deepEqual(after.board,['누적 방지 검증 업무','오늘 신규 업무']);assert.deepEqual(after.fitnessBoard,['누적 방지 검증 업무','오늘 신규 업무']);
   const boardLayout=await run(pc.page,`(()=>{renderWorklogTaskBoard(state.employeeLogs['${date}']['${employeeId}']);const row=[...document.querySelectorAll('#worklogTaskBoard .worklog-task-row')].find(r=>r.querySelector('.task-text-input').value==='누적 방지 검증 업무');return{completed:!!row?.classList.contains('status-complete'),visible:!!row&&row.getBoundingClientRect().height>0,fits:!!row&&row.scrollWidth<=row.clientWidth+2};})()`);
   for(const[k,v]of Object.entries(boardLayout))assert.equal(v,true,`${viewport.width}: completed board ${k}`);
   await pc.page.screenshot({path:`/tmp/bangju-completed-priority-${viewport.width}.png`});
   const paper=await run(pc.page,`(()=>{
    const employee=getSelectedEmployee(),log=state.employeeLogs['${date}']['${employeeId}'];
    const model=buildWorklogDailyReportModel({employee,dateKey:'${date}',log});
    const sheet=document.getElementById('worklogReportSheet');sheet.hidden=false;sheet.classList.add('is-open');
    document.getElementById('worklogReportBackdrop').hidden=false;
    document.getElementById('worklogReportPreview').innerHTML=renderWorklogDailyReportTemplate(model);fitWorklogReportPreview();
    const report=document.querySelector('#worklogReportPreview .worklog-daily-report-page');
    const rows=[...report.querySelectorAll('.worklog-report-progress-section tbody tr')];
    const statusFits=rows.every(row=>{const cell=row.lastElementChild,badge=cell.querySelector('.worklog-report-status');const c=cell.getBoundingClientRect(),b=badge.getBoundingClientRect();return b.left>=c.left-1&&b.right<=c.right+1;});
    return{bothRows:rows.length===2,carryoverVisible:report.textContent.includes('이월'),completed:rows.some(r=>r.textContent.includes('누적 방지 검증 업무')&&r.textContent.includes('완료')),noHorizontalClipping:sheet.scrollWidth<=sheet.clientWidth+2,statusFits};
   })()`);
   for(const[k,v]of Object.entries(paper))assert.equal(v,true,`${viewport.width}: report ${k}`);
   await pc.page.screenshot({path:`/tmp/bangju-carryover-report-${viewport.width}.png`});
   await run(pc.page,'closeWorklogReportSheet()');
   const tomorrow=await run(pc.page,`(()=>{const log={employeeId:'${employeeId}',tasks:[],schedule:[]};return getEmployeeWorklogTaskRefs(getSelectedEmployee(),'${nextDate}',log).filter(r=>isActiveTask(r.task)).map(r=>r.task.text);})()`);
   // Move the test clock forward to test arrived carryovers, not future-date previews.
   const arrived=await run(pc.page,`(()=>{todayKey='${nextDate}';const log={employeeId:'${employeeId}',tasks:[],schedule:[]};return getEmployeeWorklogTaskRefs(getSelectedEmployee(),'${nextDate}',log).filter(r=>isActiveTask(r.task)).map(r=>r.task.text);})()`);
   assert.deepEqual(tomorrow,[]);assert.deepEqual(arrived,['오늘 신규 업무']);
   const safeguards=await run(pc.page,`(()=>{
    const employee=getSelectedEmployee();const current={employeeId:'${employeeId}',tasks:[{id:'new-same-text',text:'누적 방지 검증 업무',priority:'A',status:'미완료'}],schedule:[]};
    const independent=getEmployeeWorklogTaskRefs(employee,'${nextDate}',current).filter(r=>r.task.text==='누적 방지 검증 업무').length===1;
    const historic=buildWorklogDailyReportModel({employee,dateKey:'${sourceDate}',log:state.employeeLogs['${sourceDate}']['${employeeId}']}).tasks.some(t=>t.text==='누적 방지 검증 업무'&&t.status!=='완료');
    const historicalCompletedVisible=getVisibleWorklogTaskRefs(state.employeeLogs['${date}']['${employeeId}']).some(r=>r.task.done&&r.task.text==='누적 방지 검증 업무');
    const originalStamp=state.employeeLogs['${date}']['${employeeId}'].updatedAt;writeStateToLocalStorage();
    const readDoesNotEdit=state.employeeLogs['${date}']['${employeeId}'].updatedAt===originalStamp;
    const local=state.employeeLogs['${date}']['${employeeId}'];local.updatedAt='2099-01-01T00:00:00.000Z';
    mergeOwnRemoteEmployeeLogs({'${date}':{'${employeeId}':{employeeId:'${employeeId}',tasks:[{text:'오래된 서버 내용'}],updatedAt:'2026-01-01T00:00:00.000Z'}}});
    const pendingEditKept=state.employeeLogs['${date}']['${employeeId}'].updatedAt==='2099-01-01T00:00:00.000Z';
    const alias=normalizeEmployeeLogRows;
    const a={tasks:[{text:'旧形式',priority:'A',status:'미완료'}],schedule:[]},b=structuredClone(a);
    alias(a,'${sourceDate}');alias(b,'${sourceDate}');const stableLegacyIds=a.tasks[0].id===b.tasks[0].id;
    const changed=state.employeeLogs['${date}']['${employeeId}'];changed.updatedAt='2026-01-01T00:00:00.000Z';
    mergeOwnRemoteEmployeeLogs({'${date}':{'${employeeId}':{employeeId:'${employeeId}',tasks:[],schedule:[],updatedAt:'2026-02-01T00:00:00.000Z'}}});
    const remoteClear=state.employeeLogs['${date}']['${employeeId}'].tasks.length===0;
    const snapshot=state.employeeLogs;
    const root={id:'legacy-real-id',priority:'A',text:'기존 형식 이월',status:'미완료'};
    const copy={id:'legacy-copy',priority:'A',text:'기존 형식 이월',status:'완료',done:true,carryoverForkFrom:'${sourceDate}:legacy-random-id'};
    const legacyCurrent={employeeId:'${employeeId}',tasks:[copy],schedule:[]};
    state.employeeLogs={'${sourceDate}':{'${employeeId}':{tasks:[root]}},'${date}':{'${employeeId}':legacyCurrent}};
    const legacyForkDeduped=getEmployeeWorklogTaskRefs(employee,'${date}',legacyCurrent).filter(r=>r.task.text==='기존 형식 이월').length===1;
    const legacyDoneStopped=getEmployeeWorklogTaskRefs(employee,'${nextDate}',{employeeId:'${employeeId}',tasks:[]}).filter(r=>r.task.text==='기존 형식 이월').length===0;
    root.status='완료';root.done=true;copy.status='미완료';copy.done=false;
    const terminalAncestorStopped=getEmployeeWorklogTaskRefs(employee,'${date}',legacyCurrent).filter(r=>r.task.text==='기존 형식 이월').length===0;
    state.employeeLogs=snapshot;
    return{independent,historic,historicalCompletedVisible,readDoesNotEdit,pendingEditKept,stableLegacyIds,remoteClear,legacyForkDeduped,legacyDoneStopped,terminalAncestorStopped};
   })()`);
   for(const[k,v]of Object.entries(safeguards))assert.equal(v,true,`${viewport.width}: ${k}`);
   const undo=await run(phone.page,`(async()=>{document.querySelector('#undoToast button').click();await flushPendingRemoteSaves();const log=state.employeeLogs['${date}']['${employeeId}'];return{visibleAgain:getVisibleWorklogTaskRefs(log).some(r=>r.task.text==='누적 방지 검증 업무'),pendingAgain:log.tasks.some(t=>t.text==='누적 방지 검증 업무'&&!t.done)};})()`);
   assert.equal(undo.visibleAgain,true);assert.equal(undo.pendingAgain,true);
   assert.deepEqual(phone.errors,[]);assert.deepEqual(pc.errors,[]);
   console.log(JSON.stringify({viewport:viewport.width,completionAcrossDevices:true,bothDatesSaved:true,completedOriginNotRevived:true,todayCompletedVisible:true,undoCompletion:true,reportIncludesCarryover:true,...safeguards}));
   const dailyMissions=await run(pc.page,`(()=>{
    const saved=state.employeeLogs,savedGuidance=state.fitnessDailyGuidance;
    todayKey='${date}';
    const employee=getSelectedEmployee(),id='${employeeId}';
    const mission={id:'daily-old',priority:'A',text:'[전일 다짐 미션] 상담행동 2건 보강',status:'미완료',guidanceId:'old-guidance',guidanceSourceDateKey:'${shift(-2)}'};
    const manual={id:'manual',priority:'B',text:'직접 입력한 후속 업무',status:'미완료'};
    const past={employeeId:id,tasks:[mission,manual]},current={employeeId:id,tasks:[{...mission,id:'fork',carryoverForkFrom:'${sourceDate}:daily-old'},
     {...mission,id:'new',guidanceId:'today-guidance',guidanceSourceDateKey:'${sourceDate}',guidanceDateKey:'${date}'},
     {id:'explicit',priority:'C',text:'[전일 다짐 미션] 직접 연기한 업무',postponedFrom:'postpone-1',status:'미완료'}]},future={employeeId:id,tasks:[{id:'future',priority:'A',text:'내일 예약 업무',status:'미완료'}]};
    state.employeeLogs={'${sourceDate}':{[id]:past},'${date}':{[id]:current},'${nextDate}':{[id]:future}};state.fitnessDailyGuidance={};
    const before=JSON.stringify(state.employeeLogs);
    const refs=getEmployeeWorklogTaskRefs(employee,'${date}',current);
    const todayRows=getFitnessReportTaskRows([{employee,log:current}],{dateKey:'${date}',limit:Infinity,minRows:0});
    const tomorrowRows=getFitnessReportTaskRows([{employee,log:future}],{dateKey:'${nextDate}',limit:Infinity,minRows:0});
    const history=getEmployeeWorklogTaskRefs(employee,'${sourceDate}',past);
    const result={expiredCopyHidden:!refs.some(r=>r.task.id==='fork'),currentMissionOnce:refs.filter(r=>r.task.guidanceId==='today-guidance').length===1,
     manualCarryoverKept:refs.some(r=>r.task.id==='manual'),explicitPostponeKept:refs.some(r=>r.task.id==='explicit'),
     reportClean:todayRows.filter(r=>r.includes('상담행동')).length===1,tomorrowIsolated:tomorrowRows.length===1&&tomorrowRows[0].includes('내일 예약 업무'),
     historyPreserved:history.some(r=>r.task.id==='daily-old'),readDoesNotDelete:before===JSON.stringify(state.employeeLogs)};
    current.schedule=[];
    const model=buildFitnessReportModel({employee,dateKey:'${date}',isCenter:false,log:current});
    result.modelClean=model.topTasks.filter(r=>r.includes('상담행동')).length===1;
    result.modelTomorrowCorrect=model.tomorrowTasks.some(r=>r.includes('내일 예약 업무'))&&!model.tomorrowTasks.some(r=>r.includes('상담행동'));
    document.querySelectorAll('[role=dialog], [id$=Backdrop]').forEach(el=>{el.hidden=true;el.classList.remove('is-open');});
    const sheet=document.getElementById('fitnessReportSheet');document.body.appendChild(sheet);document.body.appendChild(document.getElementById('fitnessReportBackdrop'));
    sheet.hidden=false;sheet.classList.add('is-open');
    document.getElementById('fitnessReportBackdrop').hidden=false;
    document.getElementById('fitnessReportPreview').innerHTML=renderFitnessReportTemplate(model);fitFitnessReportPreview();
    result.noHorizontalClipping=sheet.scrollWidth<=sheet.clientWidth+2;
    state.employeeLogs=saved;state.fitnessDailyGuidance=savedGuidance;return result;
   })()`);
   for(const[k,v]of Object.entries(dailyMissions))assert.equal(v,true,`daily missions ${viewport.width}: ${k}`);
   console.log(JSON.stringify({viewport:viewport.width,dailyMissions}));
   await pc.page.screenshot({path:`/tmp/bangju-fitness-missions-${viewport.width}.png`});
   await phone.page.close();await pc.page.close();
  }
  // A fresh device must hydrate more than one page of history and isolate owners/future dates.
  reset();for(let i=0;i<110;i++){
   const key=new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10);rows.set(key,{user_id:userId,log_date:key,updated_at:'2025-01-01T00:00:00.000Z',state:{employeeLogs:{[key]:{[employeeId]:log(key,[])}}}});
  }
  rows.set('2024-07-01',{user_id:userId,log_date:'2024-07-01',updated_at:'2024-07-01T00:00:00.000Z',state:{employeeLogs:{'2024-07-01':{[employeeId]:log('2024-07-01',[{id:'old-open',text:'오래된 미완료',status:'미완료'}]),'other':log('2024-07-01',[{id:'secret',text:'다른 직원 비공개'}])}}}});
  const cold=await pageFor(browser,{width:1440,height:1000});await run(cold.page,`loadRemoteEmployeeCarryoverContext('${date}')`);
  assert(reads.some(r=>r.offset===100));
  const isolation=await run(cold.page,`(()=>{const tasks=getWorklogTaskRefs(state.employeeLogs['${date}']['${employeeId}']).map(r=>r.task.text);return{oldIncluded:tasks.includes('오래된 미완료'),otherExcluded:!JSON.stringify(state.employeeLogs).includes('다른 직원 비공개')};})()`);
  assert.equal(isolation.oldIncluded,true);assert.equal(isolation.otherExcluded,true);
  console.log(JSON.stringify({paginatedHistory:true,...isolation}));await cold.page.close();
 }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});

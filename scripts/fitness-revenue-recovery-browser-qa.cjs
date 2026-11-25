const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {chromium}=require('playwright');
const {analyze}=require('../api/_lib/fitness-revenue-analysis.cjs');
const fixture=analyze({date:'2026-11-26',rows:[{snapshot_date:'2026-11-25',quality:'partial',metrics:{sales:16337100},domains:{sales:{ok:true,authenticated:true,rangeVerified:true,period:'month-to-date'}}}]});
require('node:fs').mkdirSync('/tmp/bangju-revenue-qa',{recursive:true});
const server=spawn('/usr/bin/python3',['-m','http.server','8796'],{cwd:require('node:path').resolve(__dirname,'..'),stdio:'ignore'});
(async()=>{let browser;try{
 await new Promise(r=>setTimeout(r,700));
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 for(const viewport of [{width:390,height:844},{width:820,height:1180},{width:1440,height:1000}]){
  const page=await browser.newPage({viewport});
  await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:8796/')?r.continue():r.abort());
  await page.route('**/api/fitness-revenue-feedback?*',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(fixture)}));
  await page.goto('http://127.0.0.1:8796/index.html',{waitUntil:'domcontentloaded'});
  const result=await page.evaluate(()=>window.eval(`(()=>{
    authState.user={id:'qa-finance-manager',email:'finance.manager@example.com'};
    state.profile={...state.profile,email:'finance.manager@example.com',org:'(주)방주',workplace:'본사',role:'재무과장',name:'재무과장',nickname:'재무',primaryWork:'자금 회계 보고',approvalStatus:'approved',accessPreset:'employee',permissions:{}};
    state.selectedEmployeeId='bangju-finance-manager';normalizeState();
    todayKey='2026-11-26';state.selectedDateKey=todayKey;activeView='bangju-log';
    // No network writes: exercise the UI handler with existing local task storage.
    const oldSave=saveState,oldRender=renderEntries;saveState=()=>{};renderEntries=()=>{};
    const log=getSelectedLog();log.tasks=[];
    renderRevenueRecovery('worklog',log);
    const panel=document.getElementById('worklogRevenueRecovery');
    const button=panel.querySelector('button');const editable=Boolean(button);
    button?.click();button?.click();
    const added=getSelectedLog().tasks.filter(t=>t.text.startsWith('[11월 피트니스 개선]')).length;
    renderRevenueRecovery('worklog',getSelectedLog());const duplicateDisabled=panel.querySelector('button')?.disabled;
    state.selectedEmployeeId='beyond-company-leader';activeView='beyond-log';
    renderRevenueRecovery('worklog',getSelectedLog());const coworkerReadonly=!panel.hidden&&!panel.querySelector('button');
    state.selectedDateKey='2026-12-01';renderRevenueRecovery('worklog',getSelectedLog());const expired=!panel.hidden&&panel.textContent.includes("연결 대기");
    state.selectedDateKey=todayKey;state.selectedEmployeeId='bangju-finance-manager';activeView='bangju-log';
    renderRevenueRecovery('worklog',getSelectedLog());
    document.querySelectorAll('.worklog-view').forEach(el=>el.classList.remove('is-active'));
    document.getElementById('view-today').classList.add('is-active');
    document.body.dataset.activeView='bangju-log';document.body.classList.remove('auth-gated');
    panel.querySelector('details').open=true;
    saveState=oldSave;renderEntries=oldRender;
    return {editable,added,duplicateDisabled,coworkerReadonly,expired};
  })()`));
  assert.deepEqual(result,{editable:true,added:1,duplicateDisabled:true,coworkerReadonly:true,expired:true});
  const fitness=await page.evaluate(()=>window.eval(`(()=>{
    authState.user={id:'fitness-manager-auth',email:'pjhong0@naver.com'};
    state.profile={...state.profile,authUserId:'fitness-manager-auth',email:'pjhong0@naver.com',role:'센터장',name:'박주홍',nickname:'센터장',org:'(주)비욘드컴퍼니',workplace:'비욘드 피트니스',primaryWork:'피트니스 운영총괄',approvalStatus:'approved',workHours:'06:00-24:00'};
    state.fitnessWritableEmployeeId='beyond-fitness-manager';state.selectedEmployeeId='beyond-fitness-manager';
    activeView='fitness-log';state.fitnessLogPageId='beyond-fitness-manager';
    state.fitnessLogPage=getFitnessLogPages().findIndex(p=>p.id==='beyond-fitness-manager');
    const log=getEmployeeLogForDate('beyond-fitness-manager',todayKey);log.tasks=[];
    const oldSave=saveState,oldRender=renderEntries;saveState=()=>{};renderEntries=()=>{};
    renderRevenueRecovery('fitness',log);
    const panel=document.getElementById('fitnessRevenueRecovery');const button=panel.querySelector('button');
    const editable=Boolean(button);button?.click();
    const added=getEmployeeLogForDate('beyond-fitness-manager',todayKey).tasks.filter(t=>t.text.startsWith('[11월 피트니스 개선]')).length;
    state.fitnessLogPageId='fitness-center';state.fitnessLogPage=0;renderRevenueRecovery('fitness',log);
    const centerReadonly=!panel.hidden&&!panel.querySelector('button');
    saveState=oldSave;renderEntries=oldRender;return {editable,added,centerReadonly};
  })()`));
  assert.deepEqual(fitness,{editable:true,added:1,centerReadonly:true});
  const loaded=await page.evaluate(()=>window.eval(`(async()=>{
    state.selectedDateKey='2026-11-26';authState.session={access_token:'qa-token'};
    await loadRevenueFeedback('2026-11-26',{force:true});
    renderRevenueRecovery('fitness',getSelectedLog());
    const data=getRevenueFeedback();const panel=document.getElementById('fitnessRevenueRecovery');
    return {total:data.current.total,hasDecrease:panel.textContent.includes('57.1%'),months:panel.querySelectorAll('tbody tr').length,report:getRevenueReportLines({employee:getSelectedEmployee(),dateKey:'2026-11-26'}).some(x=>x.includes('16,337,100'))};
  })()`));
  assert.deepEqual(loaded,{total:16337100,hasDecrease:true,months:28,report:true});
  // Make the component visible independently of onboarding overlays for layout measurements.
  const layout=await page.evaluate(()=>{const el=document.getElementById('fitnessRevenueRecovery');document.body.append(el);el.querySelectorAll('details').forEach(d=>d.open=true);el.style.width='calc(100% - 32px)';el.style.boxSizing='border-box';const rect=el.getBoundingClientRect();return {width:rect.width,overflow:el.scrollWidth>el.clientWidth+1};});
  assert.ok(layout.width>0);assert.equal(layout.overflow,false);
  await page.locator('#fitnessRevenueRecovery').screenshot({path:`/tmp/bangju-revenue-qa/${viewport.width}.png`});
  await page.close();console.log('PASS',viewport.width,result);
 }
}finally{await browser?.close();server.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});

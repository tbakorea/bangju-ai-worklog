const assert=require('node:assert/strict');const {spawn}=require('node:child_process');
const {chromium}=require('/Users/bangju/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const server=spawn('/usr/bin/python3',['-m','http.server','8787'],{stdio:'ignore'});
(async()=>{let browser;try{
 await new Promise(r=>setTimeout(r,700));browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 for(const width of [390,820,1440]){
  const page=await browser.newPage({viewport:{width,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*.supabase.co/**',r=>r.abort());await page.goto('http://127.0.0.1:8787/index.html');
  const result=await page.evaluate(()=>window.eval(`(async()=>{
   const id='11111111-1111-4111-8111-111111111111';authState.user={id,email:'trainer@example.invalid'};authState.session={access_token:'fixture'};
   state.profile={...defaultProfile,authUserId:id,name:'검증트레이너',email:'trainer@example.invalid',role:'트레이너',org:'비욘드 피트니스',workplace:'비욘드 피트니스',approvalStatus:'approved',permissions:{}};
   const employee={id:'profile-user',name:'검증트레이너',role:'트레이너',org:'비욘드 피트니스',workplace:'비욘드 피트니스',workHours:'16:00-24:00',weeklyWorkHours:Object.fromEntries([0,1,2,3,4,5,6].map(n=>[n,'16:00-24:00']))};
   const originalBuild=buildFitnessReportModel,originalToast=showAppToast,oldFetch=window.fetch;
   const make=(extra={})=>originalBuild({employee,dateKey:todayKey,isCenter:false,log:createEmployeeLog(employee,state.profile),...extra});
   let payload={date:todayKey,status:'empty-linked',message:'수업 예정이 있다면 다짐 시간표를 먼저 작성해주세요. 이미 등록했다면 강사 연결과 동기화를 확인하세요.'};let calls=0,toasts=0;
   buildFitnessReportModel=()=>make();showAppToast=()=>toasts++;
   window.fetch=async()=>{calls++;return{ok:true,json:async()=>payload};};
   const sheet=document.getElementById('fitnessReportSheet');sheet.hidden=false;sheet.classList.add('is-open');document.getElementById('fitnessCoachingFollowup').dataset.feedbackDirty='true';
   try{
    const pending=make().ptScheduleReminder.status==='pending';await loadPtScheduleReminder(make());let model=make();
    const shown=model.ptScheduleReminder.status==='empty-linked'&&renderFitnessReportTemplate(model).includes('다짐 시간표 작성 안내');
    const firstToast=toasts===1;await loadPtScheduleReminder(make(),{force:true});fitnessPtScheduleReminderNotified.clear();await loadPtScheduleReminder(make(),{force:true});const oncePerDay=toasts===1;
    const aiSafe=!JSON.stringify(model.aiContext).includes(payload.message);
    const preview=document.getElementById('fitnessReportPreview');preview.innerHTML=renderFitnessReportTemplate(model);fitFitnessReportPreview();
    const paper=preview.querySelector('article'),card=paper.querySelector('.fitness-paper-schedule-reminder');const inside=card.getBoundingClientRect().left>=paper.getBoundingClientRect().left-1&&card.getBoundingClientRect().right<=paper.getBoundingClientRect().right+1;
    const host=document.createElement('div');host.style.cssText='position:absolute;left:-10000px;width:1240px';host.innerHTML='<style>'+getFitnessReportExportCss(getFitnessReportExportHeight(model))+'</style>'+renderFitnessReportTemplate(model);document.body.append(host);const exported=host.querySelector('article');const exportBounds=exported.scrollHeight<=exported.clientHeight+2;host.remove();
    const off=make({log:{...createEmployeeLog(employee,state.profile),attendanceStatus:'휴무'}}).ptScheduleReminder===null;
    const leave=make({log:{...createEmployeeLog(employee,state.profile),attendanceStatus:'병가'}}).ptScheduleReminder===null;
    const resigned=make({employee:{...employee,worklogStatus:'resigned'}}).ptScheduleReminder===null;
    const excluded=make({employee:{...employee,worklogParticipationMode:'excluded'}}).ptScheduleReminder===null;
    const manager=make({employee:{...employee,role:'센터장'}}).ptScheduleReminder!==null;
    const staff=make({employee:{...employee,role:'인포',primaryWork:'PT 상담 안내'}}).ptScheduleReminder===null;
    const previous=parseDateKey(todayKey);previous.setDate(previous.getDate()-1);const past=make({dateKey:formatDateKey(previous)}).ptScheduleReminder===null;
    const center=make({isCenter:true}).ptScheduleReminder===null;
    const before=calls;await loadPtScheduleReminder(make({employee:{...employee,id:'peer',sourceProfileId:'22222222-2222-4222-8222-222222222222'}}));const peer=calls===before;
    const futureDate=getNextDateKey(todayKey);payload={...payload,date:futureDate};await loadPtScheduleReminder(make({dateKey:futureDate}),{force:true});const future=make({dateKey:futureDate}).ptScheduleReminder.status==='empty-linked'&&toasts===1;
    payload={date:todayKey,status:'present'};await loadPtScheduleReminder(make(),{force:true});const disappears=!renderFitnessReportTemplate(make()).includes('fitness-paper-schedule-reminder');
    let release;window.fetch=()=>new Promise(resolve=>{release=resolve;});const pendingRequest=loadPtScheduleReminder(make(),{force:true});authState.user={id:'33333333-3333-4333-8333-333333333333',email:'other@example.invalid'};release({ok:true,json:async()=>({date:todayKey,status:'empty-linked',message:'old account'})});await pendingRequest;const accountSafe=make().ptScheduleReminder.status==='pending'&&toasts===1;authState.user={id,email:'trainer@example.invalid'};
    window.fetch=async()=>{throw Error('offline');};await loadPtScheduleReminder(make(),{force:true});const failed=make().ptScheduleReminder.status==='unavailable'&&toasts===1;
    window.fetch=async()=>({ok:true,json:async()=>({date:'2000-01-01',status:'empty-linked'})});await loadPtScheduleReminder(make(),{force:true});const staleDate=make().ptScheduleReminder.status==='unavailable';
    return {pending,shown,firstToast,oncePerDay,aiSafe,inside,exportBounds,off,leave,resigned,excluded,manager,staff,past,center,peer,disappears,future,accountSafe,failed,staleDate};
   }finally{window.fetch=oldFetch;showAppToast=originalToast;buildFitnessReportModel=originalBuild;}
  })()`));
  for(const [key,value]of Object.entries(result))assert.equal(value,true,`${width}: ${key}`);assert.deepEqual(errors,[]);console.log(width,result);await page.close();
 }
}finally{await browser?.close();server.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});

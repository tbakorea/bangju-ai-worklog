const assert=require('node:assert/strict');const {spawn}=require('node:child_process');
const {chromium}=require('/Users/bangju/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const server=spawn('/usr/bin/python3',['-m','http.server','8786'],{stdio:'ignore'});
(async()=>{let browser;try{
 await new Promise(r=>setTimeout(r,700));browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 for(const width of [390,820,1440]){
  const page=await browser.newPage({viewport:{width,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*.supabase.co/**',r=>r.abort());await page.goto('http://127.0.0.1:8786/index.html');
  const result=await page.evaluate(()=>window.eval(`(async()=>{
   const id='11111111-1111-4111-8111-111111111111';authState.user={id,email:'trainer@example.invalid'};authState.session={access_token:'fixture'};
   state.profile={...defaultProfile,authUserId:id,email:'trainer@example.invalid',name:'검증트레이너',role:'트레이너',org:'비욘드 피트니스',workplace:'비욘드 피트니스',approvalStatus:'approved',permissions:{}};
   const employee={id:'profile-user',name:'검증트레이너',role:'트레이너',org:'비욘드 피트니스',workplace:'비욘드 피트니스'};
   const make=()=>buildFitnessReportModel({employee,dateKey:todayKey,isCenter:false,log:createEmployeeLog(employee,state.profile)});
   const previous=parseDateKey(todayKey);previous.setDate(previous.getDate()-1);const sourceDate=formatDateKey(previous);
   const payload={reportDate:todayKey,sourceDate,status:'review',compared:1,exceptions:[{time:'20:00',kind:'취소'}],reason:'시작 시각 대조',guidance:'예약 변경과 취소 사유를 먼저 확인하고 다음 기록부터 정확히 남겨주세요.',differences:[{kind:'changed',dagym:'16:00',worklog:'17:30',session:'paid',worklogSession:'free',note:'시간변경 사유 확인 <script>BAD</script>'}]};
   let calls=0;const oldFetch=window.fetch;window.fetch=async()=>{calls++;return{ok:true,json:async()=>payload};};
   try{
    await loadPtComparison(make());let model=make();
    const loaded=model.ptComparison.status==='review';const html=renderFitnessReportTemplate(model);
    const times=html.includes('16:00')&&html.includes('17:30')&&html.includes('무료PT');
    const safeHtml=html.includes('&lt;script&gt;')&&!html.includes('<script>BAD');
    const aiSafe=!JSON.stringify(model.aiContext).includes('시간변경 사유 확인');
    const centerHidden=buildFitnessReportModel({employee,isCenter:true,dateKey:todayKey}).ptComparison===null;
    const peer={...employee,id:'peer',sourceProfileId:'22222222-2222-4222-8222-222222222222'};const before=calls;await loadPtComparison({...model,employee:peer});const peerSafe=calls===before;
    const otherDay=getPtComparisonRecord({...model,dateKey:getNextDateKey(todayKey)}).status==='pending';
    const preview=document.getElementById('fitnessReportPreview'),sheet=document.getElementById('fitnessReportSheet');sheet.hidden=false;sheet.classList.add('is-open');preview.innerHTML=html;fitFitnessReportPreview();
    const paper=preview.querySelector('article'),section=paper.querySelector('.fitness-paper-pt-comparison');
    const inside=section.getBoundingClientRect().left>=paper.getBoundingClientRect().left-1&&section.getBoundingClientRect().right<=paper.getBoundingClientRect().right+1;
    const host=document.createElement('div');host.style.cssText='position:absolute;left:-10000px;width:1240px';
    const longModel={...model,ptComparison:{...payload,differences:Array.from({length:20},()=>payload.differences[0])}};
    host.innerHTML='<style>'+getFitnessReportExportCss(getFitnessReportExportHeight(longModel))+'</style>'+renderFitnessReportTemplate(longModel);document.body.append(host);
    const exportPaper=host.querySelector('article');const exportBounds=exportPaper.scrollHeight<=exportPaper.clientHeight+2;host.remove();
    let release;window.fetch=()=>new Promise(resolve=>{release=resolve;});const pending=loadPtComparison(model,{force:true});authState.user={id:'33333333-3333-4333-8333-333333333333',email:'other@example.invalid'};release({ok:true,json:async()=>payload});await pending;
    const switched=getPtComparisonRecord(model);const accountSafe=switched?.status==='pending'&&!switched.differences.length;
    authState.user={id,email:'trainer@example.invalid'};window.fetch=async()=>{throw Error('offline');};await loadPtComparison(model,{force:true});const failed=make().ptComparison.status==='unavailable';
    window.fetch=async()=>({ok:true,json:async()=>({...payload,sourceDate:'2000-01-01'})});await loadPtComparison(model,{force:true});const staleDate=make().ptComparison.status==='unavailable';
    return {loaded,times,safeHtml,aiSafe,centerHidden,peerSafe,otherDay,inside,exportBounds,accountSafe,failed,staleDate};
   }finally{window.fetch=oldFetch;}
  })()`));
  for(const [key,value]of Object.entries(result))assert.equal(value,true,`${width}: ${key}`);assert.deepEqual(errors,[]);console.log(width,result);await page.close();
 }
}finally{await browser?.close();server.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});

const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {chromium}=require('/Users/bangju/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const server=spawn('/usr/bin/python3',['-m','http.server','8785'],{stdio:'ignore'});
(async()=>{let browser;try{
 await new Promise(r=>setTimeout(r,700));
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 for(const width of [390,820,1440]){
  const page=await browser.newPage({viewport:{width,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*.supabase.co/**',r=>r.abort());
  await page.route('**/api/fitness-coach',r=>r.fulfill({status:503,body:'{}'}));
  await page.goto('http://127.0.0.1:8785/index.html');
  const result=await page.evaluate(()=>window.eval(`(async()=>{
   const id='11111111-1111-4111-8111-111111111111';
   authState.user={id,email:'onse2@naver.com'};authState.session={access_token:'fixture'};
   state.profile={...defaultProfile,authUserId:id,email:'onse2@naver.com',name:'김경희',org:'(주)방주',role:'차장',approvalStatus:'approved'};
   const employee={id:'profile-user',name:'김경희',org:'(주)방주',role:'차장'};
   const model=()=>buildWorklogDailyReportModel({employee,dateKey:todayKey,log:createEmployeeLog(employee,state.profile)});
   let calls=0;const oldFetch=window.fetch;
   window.fetch=async()=>{calls++;return {ok:true,json:async()=>({date:todayKey,status:'ready',analysisSourceDate:'2026-11-01',issues:[{title:'시설 점검·조치 확인',basis:'담당자 확인 전',action:'증빙 검토 <script>PRIVATE</script>'}]})};};
   try{
    await loadFitnessReportIssues(model());let loaded=model();
    const shown=loaded.fitnessIssues.issues.length===1;
    const aiSafe=!JSON.stringify(loaded.aiContext).includes('시설 점검·조치 확인');
    const text=buildWorklogDailyReportLines(loaded).join(' ');const textExport=text.includes('시설 점검·조치 확인');
    const html=renderWorklogDailyReportTemplate(loaded);const escaped=html.includes('&lt;script&gt;')&&!html.includes('<script>PRIVATE');
    const host=document.createElement('div');host.style.cssText='position:absolute;left:-10000px;width:1240px';host.innerHTML='<style>'+getWorklogReportExportCss(1754)+'</style>'+html;document.body.append(host);
    const paper=host.querySelector('article');const section=host.querySelector('.worklog-report-fitness-issues');
    const exportBounds=section.getBoundingClientRect().bottom<=paper.getBoundingClientRect().bottom;
    host.remove();
    const otherDate=getNextDateKey(todayKey);const dateSafe=getFitnessReportIssues(employee,otherDate).status==='pending';
    const prior=calls;await loadFitnessReportIssues({...loaded,employee:{id:'peer',sourceProfileId:'22222222-2222-4222-8222-222222222222'}});const peerSafe=calls===prior;
    authState.user={id:'33333333-3333-4333-8333-333333333333',email:'other@example.invalid'};
    const accountSafe=getFitnessReportIssues(employee,todayKey)===null;
    authState.user={id,email:'onse2@naver.com'};
    window.fetch=async()=>{throw Error('unavailable');};await loadFitnessReportIssues(loaded,{force:true});const failureExplicit=model().fitnessIssues.status==='unavailable';
    return {shown,aiSafe,textExport,escaped,exportBounds,dateSafe,peerSafe,accountSafe,failureExplicit};
   }finally{window.fetch=oldFetch;}
  })()`));
  for(const [key,value] of Object.entries(result))assert.equal(value,true,`${width}: ${key}`);
  assert.deepEqual(errors,[]);console.log(width,result);await page.close();
 }
}finally{await browser?.close();server.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});

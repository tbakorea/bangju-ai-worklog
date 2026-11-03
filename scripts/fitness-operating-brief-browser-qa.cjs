const assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const{chromium}=require('/Users/bangju/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const server=spawn('/usr/bin/python3',['-m','http.server','8790'],{stdio:'ignore'});
(async()=>{let browser;try{await new Promise(r=>setTimeout(r,700));browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
for(const width of [390,820,1440]){
 const page=await browser.newPage({viewport:{width,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*.supabase.co/**',r=>r.abort());await page.route('**/api/**',r=>r.fulfill({status:503,body:'{}'}));await page.goto('http://127.0.0.1:8790/index.html');
 const result=await page.evaluate(()=>window.eval(`(async()=>{
 const id='11111111-1111-4111-8111-111111111111';authState.user={id,email:'staff@example.invalid'};authState.session={access_token:'fixture'};
 state.profile={...defaultProfile,authUserId:id,email:'staff@example.invalid',name:'신세민',role:'직원',org:'비욘드 피트니스',workplace:'비욘드 피트니스',primaryWork:'고객응대',approvalStatus:'approved',accessPreset:'employee',permissions:{}};
 const employee={id:'profile-user',name:'신세민',role:'직원',org:'비욘드 피트니스',workplace:'비욘드 피트니스',primaryWork:'고객응대'};
 const log={...createEmployeeLog(employee,state.profile),tasks:[],schedule:[{time:'14:00',items:[{type:'시설/청결',text:'센터 청결 점검'}]}],fitnessOps:{...createFitnessOps(),consultation:1,snsPromotion:1}};
 const make=()=>buildFitnessReportModel({dateKey:todayKey,employee,isCenter:false,log});
 const sourceDate=getPreviousCalendarDateKey(todayKey);state.dagymDaily={};state.dagymDailyAnalyses={};
 let response={date:todayKey,sourceDate,status:'partial',counts:{visits:0,ptBookings:7},sales:987654321,memberName:'PRIVATE'};
 const oldFetch=window.fetch;window.fetch=async()=>({ok:true,json:async()=>response});
 try{
 await loadFitnessOperatingBrief(make());let model=make();let html=renderFitnessReportTemplate(model);
 const noPending=!html.includes('산출 대기');const counts=model.operatingBrief.kpis.some(x=>x.label==='전일 방문'&&x.value==='0명');
 const positive=model.operatingBrief.feedback.message.includes('상담 1건을 기록')&&model.operatingBrief.feedback.action.includes('다음 안내');
 const privateSafe=!/987654321|PRIVATE|매출/.test(JSON.stringify(model.operatingBrief.kpis))&&!JSON.stringify(fitnessOperatingBriefCache.get(id+':'+todayKey)).includes('sales');
 const preview=document.getElementById('fitnessReportPreview'),sheet=document.getElementById('fitnessReportSheet');sheet.hidden=false;sheet.classList.add('is-open');preview.innerHTML=html;fitFitnessReportPreview();
 const paper=preview.querySelector('article'),brief=paper.querySelector('[data-report-operating-brief]');const within=brief.getBoundingClientRect().left>=paper.getBoundingClientRect().left-1&&brief.getBoundingClientRect().right<=paper.getBoundingClientRect().right+1;
 const host=document.createElement('div');host.style.cssText='position:absolute;left:-10000px;width:1240px';host.innerHTML='<style>'+getFitnessReportExportCss(getFitnessReportExportHeight(model))+'</style>'+html;document.body.append(host);const exported=host.querySelector('article');const exportFits=exported.scrollHeight<=exported.clientHeight+2;host.remove();
 window.fetch=async()=>{throw Error('offline');};await loadFitnessOperatingBrief(make(),{force:true});const preserved=make().operatingBrief.kpis.some(x=>x.label==='전일 방문'&&x.value==='0명'&&x.meta.includes('이전 확인'));
 fitnessOperatingBriefCache.clear();await loadFitnessOperatingBrief(make(),{force:true});const failureHonest=make().operatingBrief.kpis.find(x=>x.label==='전일 방문').value==='—'&&make().operatingBrief.feedback.message.includes('상담 1건');
 window.fetch=async()=>({ok:true,json:async()=>({...response,sourceDate:'2000-01-01'})});await loadFitnessOperatingBrief(make(),{force:true});const staleDate=fitnessOperatingBriefCache.get(id+':'+todayKey).status==='unavailable';
 let release;window.fetch=()=>new Promise(resolve=>{release=resolve;});const pending=loadFitnessOperatingBrief(make(),{force:true});authState.user={id:'22222222-2222-4222-8222-222222222222',email:'other@example.invalid'};release({ok:true,json:async()=>response});await pending;const accountSafe=!fitnessOperatingBriefCache.has(authState.user.id+':'+todayKey);authState.user={id,email:'staff@example.invalid'};
 const spoofedSubject=buildFitnessReportOperatingBrief(todayKey,{...employee,role:'센터장'},false,log);const financialNotGranted=!spoofedSubject.kpis.some(x=>/매출/.test(x.label));
 state.dagymDaily={'2026-11-02':{...createDagymDailyRecord('2026-11-02'),quality:'partial',sales:20000,domains:{sales:{period:'month-to-date'}}}};
 let financial=buildFitnessYesterdayBrief('2026-11-03').kpis[0];const monthFallback=financial.label==='월누계 매출'&&financial.value==='2만원'&&!financial.value.includes('대기');
 state.dagymDaily['2026-11-01']={...createDagymDailyRecord('2026-11-01'),quality:'partial',sales:30000,domains:{sales:{period:'month-to-date'}}};financial=buildFitnessYesterdayBrief('2026-11-03').kpis[0];const signedAdjustment=financial.label==='전일 매출'&&financial.value==='-1만원';
 state.dagymDaily['2026-11-01'].domains.sales.period='daily';const periodsNotMixed=buildFitnessYesterdayBrief('2026-11-03').kpis[0].label==='월누계 매출';
 fitnessOperatingBriefCache.set(id+':'+todayKey,response);preview.innerHTML=renderFitnessReportTemplate(make());fitFitnessReportPreview();
 return{noPending,counts,positive,privateSafe,within,exportFits,preserved,failureHonest,staleDate,accountSafe,financialNotGranted,monthFallback,signedAdjustment,periodsNotMixed};
 }finally{window.fetch=oldFetch;}
})()`));for(const[k,v]of Object.entries(result))assert.equal(v,true,`${width}: ${k} ${JSON.stringify(result)}`);assert.deepEqual(errors,[]);console.log(width,result);await page.screenshot({path:`/tmp/bangju-operating-brief-${width}.png`});await page.close();}
}finally{await browser?.close();server.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});

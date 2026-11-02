const assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const{chromium}=require('/Users/bangju/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const server=spawn('/usr/bin/python3',['-m','http.server','8789'],{stdio:'ignore'});
(async()=>{let browser;try{await new Promise(r=>setTimeout(r,700));browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
for(const width of [390,820,1440]){
 const page=await browser.newPage({viewport:{width,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*.supabase.co/**',r=>r.abort());await page.route('**/api/**',r=>r.fulfill({status:503,body:'{}'}));await page.goto('http://127.0.0.1:8789/index.html');
 const result=await page.evaluate(()=>window.eval(`(async()=>{
 const id='11111111-1111-4111-8111-111111111111';authState.user={id,email:activeFitnessManagerEmail};authState.session=null;
 state.profile={...defaultProfile,authUserId:id,email:activeFitnessManagerEmail,name:'박주홍',role:'센터장',org:'비욘드 피트니스',workplace:'비욘드 피트니스',approvalStatus:'approved',accessPreset:'site_manager',permissions:{}};
 normalizeState();state.dagymDaily={};state.dagymDailyAnalyses={'2026-11-02':{sourceDateKey:'2026-11-01',quality:'missing',metrics:{visits:0,newMembers:0,sales:0}}};
 const row={snapshot_date:'2026-11-01',metrics:{visits:0,sales:10000,ptBookings:0},quality:'partial',field_count:3,source:'dagym-browser-daily',source_updated_at:'2026-11-01T18:09:00Z',domains:{sales:{period:'month-to-date',ok:true},schedule:{source:'dagym_pt_schedule_events',rows:0,ok:true}}};
 let response=null,queries=[];const original=supabaseClient.from;
 supabaseClient.from=table=>{const q={date:''};queries.push(table);q.select=()=>q;q.eq=(key,value)=>{if(key==='snapshot_date')q.date=value;return q;};q.maybeSingle=async()=>response||({data:q.date===row.snapshot_date?row:null,error:null});return q;};
 try{
 await loadFitnessReportDagymSources('2026-11-02');
 const loaded=hasDagymDailySource(state.dagymDaily['2026-11-01']);
 const summary=getFitnessReportDagymSummary('2026-11-02');
 const exactDate=summary.sourceDateKey==='2026-11-01';const zeroValid=summary.rows.find(x=>x.key==='visits').value===0&&formatFitnessDagymReportValue(summary.rows.find(x=>x.key==='visits'))==='0건';
 const unknownMissing=summary.rows.find(x=>x.key==='newMembers').value===null&&summary.rows.find(x=>x.key==='ptBookings').value===null&&formatFitnessDagymReportValue(summary.rows.find(x=>x.key==='newMembers'))==='—';
 const brief=buildFitnessYesterdayBrief('2026-11-02');const partialNotMissing=brief.quality==='partial'&&brief.kpis.some(x=>x.label==='전일 매출'&&x.value!=='산출 대기');
 const briefMissing=brief.kpis.find(x=>x.label==='방문·신규').value.includes('—')&&brief.kpis.find(x=>x.label==='PT 예약').meta.includes('—');
 state.dagymDaily['2026-10-29']={...createDagymDailyRecord('2026-10-29'),visits:10,status:'closed'};const noStaleFallback=getFitnessReportDagymSummary('2026-10-31').sourceDateKey==='';
 const saved=JSON.stringify(state.dagymDaily['2026-11-01']);dagymSnapshotLoads.clear();response={data:null,error:{message:'offline'}};await loadRemoteDagymSnapshot('2026-11-01');const errorPreserves=saved===JSON.stringify(state.dagymDaily['2026-11-01']);
 dagymSnapshotLoads.clear();response={data:{...row,snapshot_date:'2026-10-30'},error:null};await loadRemoteDagymSnapshot('2026-11-01');const wrongDateSafe=saved===JSON.stringify(state.dagymDaily['2026-11-01']);
 response=null;dagymSnapshotLoads.clear();const employee=employees.find(e=>e.id==='beyond-fitness-manager');const model=buildFitnessReportModel({employee,isCenter:true,dateKey:'2026-11-02'});const html=renderFitnessReportTemplate(model);const showsSource=html.includes('11.01')&&!html.includes('다짐 자료 미연결')&&html.includes('—');
 const host=document.createElement('div');host.style.cssText='position:absolute;left:-10000px;width:1240px';host.innerHTML='<style>'+getFitnessReportExportCss(getFitnessReportExportHeight(model))+'</style>'+html;document.body.append(host);const paper=host.querySelector('article');const exportFits=paper.scrollHeight<=paper.clientHeight+2;host.remove();
 const before=queries.length;authState.user=null;await loadRemoteDagymSnapshot('2026-11-01');const signedOutSafe=queries.length===before;
 return{loaded,exactDate,zeroValid,unknownMissing,partialNotMissing,briefMissing,noStaleFallback,errorPreserves,wrongDateSafe,showsSource,exportFits,signedOutSafe};
 }finally{supabaseClient.from=original;}
})()`));for(const[k,v]of Object.entries(result))assert.equal(v,true,`${width}: ${k} ${JSON.stringify(result)}`);assert.deepEqual(errors,[]);console.log(width,result);await page.close();}
}finally{await browser?.close();server.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});

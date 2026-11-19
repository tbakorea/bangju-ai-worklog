const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {chromium}=require('playwright');
const server=spawn('python3',['-m','http.server','8787'],{stdio:'ignore'});
(async()=>{let browser;try{
 await new Promise(r=>setTimeout(r,700));
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 for(const width of [390,820,1440]){
 const page=await browser.newPage({viewport:{width,height:1000}});
 await page.route('**/*.supabase.co/**',r=>r.abort());
 await page.goto('http://127.0.0.1:8787/index.html');
 const result=await page.evaluate(()=>window.eval(`(()=>{
  state.profile={...defaultProfile,name:'정대표',role:'대표',accessPreset:'owner'};
  authState.approvalRows=[];
  const stale=employees.filter(e=>['홍현규','김영채'].includes(e.name)).map(e=>({...e,worklogStatus:'active',worklogParticipationMode:'included'}));
  state.employeeLogs[todayKey]={};
  stale.forEach(e=>state.employeeLogs[todayKey][e.id]={name:e.name,org:e.org,role:e.role,tasks:[{text:'보존 기록'}],schedule:[]});
  const before=JSON.stringify(state.employeeLogs);
  const individuallyHidden=stale.every(e=>!isVisibleFitnessRosterEmployee(e));
  const names=[...getFitnessEmployees(),...getFitnessCenterEmployees()].map(e=>e.name);
  const hidden=stale.every(e=>!names.includes(e.name));
  const preserved=before===JSON.stringify(state.employeeLogs);
  const replacementSafe=!isDepartedFitnessStaffIdentity({id:'fitness-trainer-1',name:'신규트레이너',email:'new@example.invalid'});
  const idSafe=isDepartedFitnessStaffIdentity({sourceProfileId:'1ad6f241-3a7d-466d-a912-ad70b0654ae6',name:'오래된 별명'});
  return {individuallyHidden,hidden,preserved,replacementSafe,idSafe};
 })()`));
 for(const [key,value] of Object.entries(result))assert.equal(value,true,`${width}: ${key}`);
 console.log(width,result);await page.close();
 }
}finally{await browser?.close();server.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});

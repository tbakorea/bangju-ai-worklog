const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { chromium } = require("/Users/bangju/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const server=spawn("/usr/bin/python3",["-m","http.server","8784"],{cwd:require("node:path").resolve(__dirname,".."),stdio:"ignore"});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 let browser;
 try{
  await wait(700);
  browser=await chromium.launch({headless:true,executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});
  for(const viewport of [{width:390,height:844},{width:820,height:1180},{width:1440,height:1000}]){
   const page=await browser.newPage({viewport});const errors=[];page.on("pageerror",e=>errors.push(e.message));
   await page.route("**/*.supabase.co/**",r=>r.abort());
   await page.goto("http://127.0.0.1:8784/index.html",{waitUntil:"domcontentloaded"});await page.waitForFunction(()=>typeof window.FitnessRoleFeedback==="object");
   const result=await page.evaluate(async()=>window.eval(`(async()=>{
    const own="11111111-1111-4111-8111-111111111111",other="22222222-2222-4222-8222-222222222222";
    authState.user={id:own,email:"role-qa@example.invalid"};
    state.profile={...defaultProfile,authUserId:own,email:"role-qa@example.invalid",name:"검증인포",role:"인포데스크",primaryWork:"고객응대",org:"(주)비욘드컴퍼니",workplace:"비욘드 피트니스",approvalStatus:"approved",accessPreset:"employee",permissions:{}};
    const employee={id:"profile-user",sourceProfileId:own,name:"검증인포",role:"인포데스크",primaryWork:"고객응대",org:state.profile.org,workplace:state.profile.workplace};
    const log={...createEmployeeLog(employee,state.profile),tasks:[{text:"회원 문의 PRIVATE_SECRET_99990000원 010-0000-0000",status:"미완료"}],schedule:[]};
    const make=()=>buildFitnessReportModel({employee,dateKey:todayKey,isCenter:false,log});
    const feedbackEngine=window.FitnessRoleFeedback;window.FitnessRoleFeedback=undefined;
    const missingModuleSafe=make().aiContext===null;
    window.FitnessRoleFeedback=feedbackEngine;
    const yesterday=parseDateKey(todayKey);yesterday.setDate(yesterday.getDate()-1);
    let response={data:[{log_date:formatDateKey(yesterday),status:"support_needed",response_code:"support",fitness_feedback:{version:1,roleKey:"frontDesk",stepKey:"inquiry-next"}}],error:null};
    const calls=[];const oldFrom=supabaseClient.from;let savedPayload;
    supabaseClient.from=table=>{calls.push(["table",table]);const q={};for(const op of ["select","eq","gte","lt","order"])q[op]=(...args)=>{calls.push([op,...args]);return q;};q.limit=async n=>{calls.push(["limit",n]);return response;};q.upsert=value=>{savedPayload=value;return q;};q.single=async()=>({data:{id:"qa-feedback",...savedPayload},error:null});return q;};
    try{
     await loadFitnessFeedbackHistory(make());
     let model=make();const payload=JSON.stringify(model.aiContext);
     const support=model.operatingFeedback.stage==="support"&&model.operatingFeedback.action.includes("지원");
     const privateSafe=!payload.includes("PRIVATE_SECRET")&&!payload.includes("010-0000")&&!payload.includes("99990000");
     const ownQuery=calls.some(x=>x[0]==="eq"&&x[1]==="user_id"&&x[2]===own)&&calls.some(x=>x[0]==="lt"&&x[1]==="log_date"&&x[2]===todayKey);
     calls.length=0;
     await loadFitnessFeedbackHistory({...model,employee:{...employee,id:"coworker",sourceProfileId:other}},{force:true});
     const coworkerDenied=calls.length===0;
     state.profile.permissions={worklogAll:true};
     await loadFitnessFeedbackHistory({...model,employee:{...employee,id:"coworker",sourceProfileId:other}},{force:true});
     const delegatedQuery=calls.some(x=>x[0]==="eq"&&x[1]==="user_id"&&x[2]===other);
     state.profile.permissions={};
     response={data:null,error:{message:"fixture unavailable"}};
     await loadFitnessFeedbackHistory(make(),{force:true});model=make();
     const missingExplicit=model.operatingFeedback.historyStatus==="unavailable"&&getFitnessReportCoachingRows(model).some(x=>x[1].includes("확인 전"));
     let release;response=new Promise(resolve=>{release=resolve;});
     const pending=loadFitnessFeedbackHistory(make(),{force:true});
     authState.fitnessFeedbackHistory=new Map();release({data:[],error:null});await pending;
     const switchedCacheSafe=authState.fitnessFeedbackHistory.size===0;
     response={data:[{log_date:formatDateKey(yesterday),status:"completed",response_code:"execute",fitness_feedback:{version:1,roleKey:"frontDesk",stepKey:"inquiry-next"}}],error:null};
     authState.fitnessFeedbackHistory=new Map();
     await loadFitnessFeedbackHistory(make());model=make();
     const reloadProgress=model.operatingFeedback.stage==="repeat"&&model.operatingFeedback.stepKey==="renewal-question";
     const snapshot=buildCoachingFollowupSnapshot({model,coachingRows:getFitnessReportCoachingRows(model)});
     const snapshotSaved=snapshot.fitnessFeedback.stepKey==="renewal-question"&&snapshot.fitnessFeedback.version===1;
     const customSnapshot=buildCoachingFollowupSnapshot({model,coachingRows:getFitnessReportCoachingRows(model),nextAction:model.operatingFeedback.action,actionText:"담당자와 조정한 실행"});
     const customPreserved=customSnapshot.fitnessFeedback.stepKey==="custom";
     model.aiCoaching={feedback:"매출 99990000원과 회원 20명 등록을 달성하세요."};
     const aiQuotaBlocked=!getFitnessReportCoachingRows(model).some(x=>x[1].includes("99990000"));
     model.aiCoaching={feedback:"확인한 질문과 다음 안내 시점을 연결해 회원의 이용 경험을 살펴보세요. ".repeat(5)};
     const sheet=document.getElementById("fitnessReportSheet");sheet.hidden=false;sheet.classList.add("is-open");
     document.getElementById("fitnessReportPreview").innerHTML=renderFitnessReportTemplate(model);fitFitnessReportPreview();
     const paper=document.querySelector("#fitnessReportPreview .fitness-report-page");
     const text=paper.textContent;
     const rows=Array.from(paper.querySelectorAll(".fitness-paper-footer-grid > div:last-child p"));
     const reportRows=rows.length===4&&text.includes("역할별 운영 피드백")&&text.includes("작은 개선 이어가기");
     const fit=paper.scrollHeight<=paper.clientHeight+2;
     const host=document.getElementById("fitnessCoachingFollowup");host.innerHTML="<textarea>작성 중인 지원 설명</textarea>";host.dataset.feedbackDirty="true";
     refreshOpenFitnessReport(model);
     const draftPreserved=host.querySelector("textarea")?.value==="작성 중인 지원 설명";
     host.dataset.feedbackDirty="false";
     const exportHolder=document.createElement("div");exportHolder.style.cssText="position:absolute;left:-10000px;top:0;width:1240px";exportHolder.innerHTML="<style>"+getFitnessReportExportCss(getFitnessReportExportHeight(model))+"</style>"+renderFitnessReportTemplate(model);document.body.appendChild(exportHolder);
     const exportPaper=exportHolder.querySelector(".fitness-report-page");const last=exportPaper.querySelector(".fitness-paper-footer-grid");
     const exportFits=last.getBoundingClientRect().bottom<=exportPaper.getBoundingClientRect().bottom+2;
     const exportOverflow=last.getBoundingClientRect().bottom-exportPaper.getBoundingClientRect().bottom;
     exportHolder.remove();
     const center=buildFitnessReportModel({dateKey:todayKey,isCenter:true,employee:{...employee,role:"센터장"}});
     center.aiCoaching=model.aiCoaching;
     const centerHolder=document.createElement("div");centerHolder.style.cssText="position:absolute;left:-10000px;top:0;width:1240px";
     centerHolder.innerHTML="<style>"+getFitnessReportExportCss(getFitnessReportExportHeight(center))+"</style>"+renderFitnessReportTemplate(center);document.body.appendChild(centerHolder);
     const centerPaper=centerHolder.querySelector(".fitness-report-page"),centerFooter=centerPaper.querySelector(".fitness-paper-footer-grid");
     const centerExportFits=centerFooter.getBoundingClientRect().bottom<=centerPaper.getBoundingClientRect().bottom+2;
     const centerNoFinance=!JSON.stringify(center.aiContext).includes("dagym")&&!JSON.stringify(center.aiContext).includes("sales");
     centerHolder.remove();
     const ownContext=getCoachingFollowupContext("fitness",model),originalContext=getCoachingFollowupContext,originalRefresh=refreshOpenFitnessReport;
     getCoachingFollowupContext=()=>ownContext;refreshOpenFitnessReport=()=>{};
     try{
      host.innerHTML='<input type="radio" name="fitness-coaching-response" value="execute" checked><textarea data-coaching-followup-field="action">담당자와 조정한 실행</textarea><input data-coaching-followup-field="due" value="'+todayKey+'"><select data-coaching-followup-field="status"><option value="completed" selected>완료</option></select><textarea data-coaching-followup-field="resultNote">확인한 결과와 다음 안내를 정리했습니다.</textarea>';
      await saveCoachingFollowup("fitness");
     }finally{getCoachingFollowupContext=originalContext;refreshOpenFitnessReport=originalRefresh;}
     const saveTransport=savedPayload?.user_id===own&&savedPayload.report_scope==="fitness"&&savedPayload.status==="completed"&&savedPayload.coaching_snapshot.fitnessFeedback.stepKey==="custom"&&savedPayload.result_note.includes("확인한 결과");
     return{support,privateSafe,missingModuleSafe,ownQuery,coworkerDenied,delegatedQuery,missingExplicit,switchedCacheSafe,reloadProgress,snapshotSaved,customPreserved,draftPreserved,aiQuotaBlocked,reportRows,fit,exportFits,centerExportFits,centerNoFinance,saveTransport,exportOverflow};
    }finally{supabaseClient.from=oldFrom;}
   })()`));
   console.log(JSON.stringify({viewport:viewport.width,...result}));
   for(const [key,value]of Object.entries(result).filter(([key])=>key!=="exportOverflow"))assert.equal(value,true,`${viewport.width}: ${key}`);
   assert.deepEqual(errors,[]);
   await page.screenshot({path:`/tmp/bangju-role-feedback-${viewport.width}.png`,fullPage:false});await page.close();
  }
 }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});

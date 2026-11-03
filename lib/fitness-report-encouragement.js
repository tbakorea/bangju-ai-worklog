(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FitnessReportEncouragement=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const count=value=>typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(5000,Math.floor(value))):0;
 const actions={frontDesk:['후속 안내 연결','상담에서 남은 질문과 다음 안내 시점 한 가지를 남겨주세요.'],trainer:['수업 결과 연결','담당 수업의 실제 결과와 다음 운동 약속 한 가지를 확인해주세요.'],manager:['인수인계 연결','미해결 사항 한 가지의 담당자와 다음 확인 시점을 정해주세요.'],marketing:['홍보 반응 확인','기록한 게시물의 문의 방법과 실제 반응 한 가지를 확인해주세요.'],cleaning:['점검 결과 연결','담당 구역의 확인 결과와 다음 점검사항 한 가지를 남겨주세요.'],facility:['점검 결과 연결','확인한 시설 상태와 필요한 다음 조치 한 가지를 남겨주세요.'],general:['작은 실행 연결','실제로 한 일 한 건의 결과와 다음 확인사항을 한 줄로 남겨주세요.']};
 function build(input={}){
  const e=Object.fromEntries(['support','consultation','pt','completed','sns','schedule','tasks'].map(k=>[k,count(input[k])]));
  let value='한 걸음부터',message='오늘은 작은 기록부터 시작해보세요. 실제로 한 일 한 건과 다음 확인사항 한 줄이면 충분합니다.';
  if(e.support){value=`지원 요청 ${e.support}건`;message=`도움이 필요한 내용을 ${e.support}건 남겼습니다. 함께 해결할 지점을 드러낸 좋은 기록입니다.`;}
  else if(e.consultation){value=`상담 ${e.consultation}건 기록`;message=`오늘 상담 ${e.consultation}건을 기록했습니다. 다음 안내를 이어갈 근거를 남기셨습니다.`;}
  else if(e.pt){value=`PT ${e.pt}건 기록`;message=`오늘 PT ${e.pt}건을 기록했습니다. 실제 완료·변경 결과까지 확인하면 더 믿을 수 있는 기록이 됩니다.`;}
  else if(e.completed){value=`완료 표시 ${e.completed}건`;message=`완료 표시 ${e.completed}건이 있습니다. 마무리한 내용과 결과를 한 줄로 연결해보세요.`;}
  else if(e.sns){value=`홍보 ${e.sns}건 기록`;message=`홍보 ${e.sns}건을 기록했습니다. 게시 링크와 반응을 살피며 다음 내용에 이어가보세요.`;}
  else if(e.schedule){value=`시간표 ${e.schedule}칸`;message=`오늘 시간표 ${e.schedule}칸을 정리했습니다. 실제로 한 일과 다음 확인사항을 이어서 남겨보세요.`;}
  else if(e.tasks){value=`우선업무 ${e.tasks}건`;message=`오늘 우선업무 ${e.tasks}건을 정했습니다. 한 가지씩 진행 상황을 남기면 다음 실행이 더 분명해집니다.`;}
  const action=Object.hasOwn(actions,input.roleKey)?actions[input.roleKey]:actions.general;
  return{value,message,actionLabel:action[0],action:action[1],evidence:e};
 }
 return{build};
});

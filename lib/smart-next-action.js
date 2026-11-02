(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SmartNextAction=api;})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
  const dateKey=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''))&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
  function minutes(value){const m=/^(\d{1,2}):([0-5]\d)$/.exec(String(value||''));return m&&+m[1]<24?+m[1]*60 + +m[2]:null;}
  function rank(context={}){
    if(!context.allowed||!dateKey(context.date)||context.date!==context.today)return [];
    if(context.off)return [{id:'off',kind:'off',title:'오늘의 근무 상태를 확인하세요',reason:'휴무·휴가로 설정된 날입니다. 예정된 근무가 있다면 근무 설정부터 확인하세요.',target:'schedule',score:0}];
    if(context.ended)return [{id:'closed',kind:'wrap',title:'오늘 결과와 다음 근무 인수인계를 확인하세요',reason:'퇴근 시간이 기록되어 있습니다. 미완료 업무의 실제 상태와 다음 근무 계획을 보고서에서 확인하세요.',target:'report',score:0}];
    const rows=[],seen=new Set();
    for(const task of context.tasks||[]){
      const text=clean(task.text),status=clean(task.status),postpone=task.postponeDate;
      if(!text||task.done||['완료','취소','위임'].includes(status)||(status==='연기'&&(!dateKey(postpone)||postpone>context.date)))continue;
      const id='task:'+task.key;if(seen.has(id))continue;seen.add(id);
      const blocked=['지원필요','지원 필요','보류'].includes(status);
      const due=dateKey(task.dueDate)?task.dueDate:'';
      const overdue=due&&due<context.date;
      const priority=task.priority==='A'?750:task.priority==='B'?650:task.priority==='C'?550:500;
      rows.push({id,kind:blocked?'support':'task',title:blocked?`지원 요청을 정리하세요 · ${text}`:text,
        reason:blocked?'지원 필요·보류로 표시한 업무입니다. 막힌 점과 필요한 지원을 담당자와 확인하세요.':overdue?`기한 ${due}인 미완료 업무입니다. 실제 진행 상황과 기한을 먼저 확인하세요.`:due===context.date?'오늘 기한으로 기록된 업무입니다. 완료 조건을 확인하고 시작하세요.':`현재 일지에서 ${['A','B','C'].includes(task.priority)?task.priority+' 중요도':'중요도 미지정'}로 기록된 미완료 업무입니다.`,
        target:'task',taskKey:task.key,score:blocked?900:overdue?850:due===context.date?820:priority});
    }
    const now=minutes(context.time);
    for(const item of context.schedule||[]){
      const start=minutes(item.time),text=clean(item.text);
      if(now===null||start===null||start<now||!text||item.done||['완료','취소','위임','completed','cancelled','no-show','postponed'].includes(item.status))continue;
      const wait=start-now;
      rows.push({id:'schedule:'+item.key,kind:'schedule',title:`${item.time} · ${text}`,reason:wait<=15?`${wait}분 이내에 시작하도록 기록된 일정입니다. 장소·준비물과 일정 변경 여부를 확인하세요.`:'오늘 남아 있는 일정 중 시작 시각이 가까운 순서입니다.',target:'schedule',time:item.time,score:wait<=15?1000-wait:400-wait/1440});
    }
    const comparison=context.ptComparison;
    if(comparison?.status==='review'&&comparison.differences?.length){
      const first=comparison.differences[0];
      rows.push({id:'pt-review',kind:'check',title:'전날 PT 시간 차이를 확인하세요',reason:`${comparison.sourceDate} · 다짐 ${clean(first.dagym)} ↔ 업무일지 ${clean(first.worklog)}. 변경·취소·대체강사 여부를 먼저 확인하세요.`,target:'report',score:700});
    }
    if(context.reminder?.status==='empty-linked')rows.push({id:'pt-register',kind:'check',title:'다짐 시간표 등록·연결을 확인하세요',reason:'동기화 자료에서 본인 일정이 확인되지 않습니다. 수업 예정이 있다면 등록하고, 이미 작성했다면 강사 연결을 확인하세요.',target:'report',score:680});
    if(!rows.length)rows.push(context.recorded?{id:'wrap',kind:'wrap',title:'오늘의 결과와 인수인계를 확인하세요',reason:'현재 기록에서 먼저 제안할 미완료 업무나 남은 일정이 없습니다. 실제 진행 상황을 보고서와 함께 확인하세요.',target:'report',score:100}:{id:'start',kind:'start',title:'오늘 먼저 할 업무 한 가지를 정하세요',reason:'현재 일지에 실행할 업무나 남은 일정이 없습니다. 완료 조건이 분명한 업무부터 적어보세요.',target:'tasks',score:100});
    return rows.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
  }
  return {rank,minutes};
});

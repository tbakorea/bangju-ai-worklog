(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FitnessRevenueRecovery=api;})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  // Owner-reported November focus; never inferred from missing or stale sales data.
  const start='2026-11-26', end='2026-11-30';
  const steps={
    frontDesk:['상담 후 다음 약속 한 건 연결','최근 상담 중 후속 안내를 원하는 한 분의 고민을 확인하고, 가능한 방문 시간 두 가지를 제안해보세요.','“가장 고민되는 점이 무엇인가요? 원하시면 편한 시간에 안내해드릴게요.”','응답 여부 / 남은 질문 / 동의한 다음 안내일'],
    sales:['상담의 망설임 한 가지 해결','가격·시간·운동 경험 중 망설이는 이유를 먼저 듣고, 승인된 상품 안에서 맞는 선택지를 안내하세요. 할인이나 결제를 서두르지 않습니다.','“결정 전에 더 확인하고 싶은 점이 있을까요?”','상담 단계 / 망설인 이유 / 다음 약속'],
    trainer:['회원의 변화와 다음 운동 연결','담당 회원 한 분에게 실제 관찰한 변화 한 가지를 짚고 다음 운동 목표를 함께 정하세요. 재등록 안내는 회원 의사를 확인한 뒤 담당자에게 연결하세요.','“오늘은 지난번보다 동작이 안정적이었어요. 다음에는 어떤 목표를 함께 해볼까요?”','관찰한 변화 / 회원 목표 / 다음 수업·상담 약속'],
    marketing:['문의로 이어지는 홍보 한 건 개선','기존 게시물 한 건에 대상 고객·센터 이용 장점·문의 방법이 명확한지 확인하세요. 문의 유입 경로를 기록해 다음 게시물과 비교합니다.','“처음 운동을 시작할 때 궁금한 점을 편하게 문의해주세요.”','게시물 / 문의 경로 / 실제 문의·방문 여부'],
    cleaning:['다시 오고 싶은 이용 환경 만들기','탈의실·샤워실·수건 동선 중 한 곳의 불편을 확인하고 가능한 조치를 마무리하세요. 남은 문제는 담당자에게 인계합니다.','깨끗하고 편안한 이용 경험도 회원이 다시 찾는 이유가 됩니다.','점검 구역 / 조치 결과 / 추가 지원'],
    facility:['이용 불편 한 건 해소','기구와 동선의 불편 한 건을 확인하세요. 안전 문제가 있으면 사용을 중지하고 담당자에게 즉시 알리며, 수리는 권한과 지침 안에서 진행합니다.','회원이 안심하고 운동할 수 있도록 돕는 일도 중요한 기여입니다.','확인한 불편 / 안전 조치 / 담당자·재확인일'],
    manager:['매출 흐름과 팀 지원 함께 점검','당월 목표·실제 결제·환불·집계 기준일을 확인하고 문의→방문→상담→등록 중 막힌 단계를 찾으세요. 팀과 개선 한 가지, 담당자, 확인일을 정합니다.','“어디에서 어려움이 있었나요? 필요한 자료나 지원을 함께 준비하겠습니다.”','확인된 지표·기준일 / 막힌 단계 / 지원 담당·확인일'],
    general:['회원 경험 개선 한 가지 연결','본인 업무에서 회원이 겪는 불편 한 가지를 확인하고 해결 가능한 부분이나 필요한 지원을 남겨주세요.','작은 개선과 정확한 인계가 팀의 다음 실행을 돕습니다.','확인한 점 / 실행 결과 / 필요한 지원'],
    company:['피트니스 매출 개선 지원 점검','센터 담당자에게 당월 목표·실제 결제·환불·집계 기준일을 확인하세요. 문의·방문·등록·재등록 흐름에서 어려운 단계를 듣고 홍보·운영 지원 한 가지의 담당자와 확인일을 정합니다.','“현장에서 가장 필요한 지원은 무엇인가요? 함께 해결할 한 가지부터 정해봅시다.”','자료 확인 여부 / 원인 가설과 근거 / 지원 담당·확인일']
  };
  function build({dateKey='',fitness=false,org='',roleKey='general',isCenter=false,analysis=null}={}){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)||dateKey<start)return null;
    if(!analysis&&dateKey>end)return null;
    if(!fitness&&!['(주)방주','(주)비욘드컴퍼니'].includes(org))return null;
    const key=!fitness?'company':isCenter?'manager':Object.hasOwn(steps,roleKey)?roleKey:'general';
    let [title,how,example,result]=steps[key];
    const verified=analysis?.date===dateKey&&['ready','stale'].includes(analysis.status)&&analysis.current;
    const keys=new Set(verified?analysis.signals.map(s=>s.key):[]);
    if(keys.has('pt')&&['trainer','manager','company'].includes(key)){
      title=key==='trainer'?'PT 상담과 다음 운동 약속 연결':key==='manager'?'PT 감소 구간과 팀 지원 확인':'PT 상담 흐름 개선 지원';
      how=key==='trainer'?'담당 회원 중 안내를 원하는 한 분에게 운동 변화와 남은 고민을 확인하세요. 다음 수업·상담 시점을 함께 정하고, 보류 이유와 필요한 지원을 기록합니다.': 'PT 문의·체험·상담·재등록 단계별 실제 건수와 보류 이유를 센터 담당자와 확인하세요. 인력 변동·상담 일정·상품 안내 중 막힌 지점을 확인한 후 지원 담당자와 재확인일을 정합니다. 매출 감소만으로 직원 개인의 성과를 판단하지 않습니다.';
    }
    if(verified&&analysis.composition?.changes?.public>0&&key==='frontDesk'){title='일반매출의 좋은 흐름 이어가기';how='일반·부대매출은 전월 같은 기간보다 늘었습니다. 상담에서 도움이 됐던 안내 한 가지를 팀에 공유하고, 후속 안내를 원하는 회원 한 분과 다음 방문 시간을 정해보세요. PT 문의는 담당자에게 연결합니다.';}
    const month=verified?analysis.sourceDate.slice(0,7):dateKey.slice(0,7);
    return {title,how,example,result,source:verified?`다짐 매출 분석 · ${analysis.sourceDate} 기준${analysis.status==='stale'?' · 수집 지연':''}`:'다짐 매출 분석 연결 대기 · 미확인을 부진으로 판단하지 않습니다.',message:'회원의 경험과 팀의 매출 흐름을 함께 살펴봅시다. 오늘 가능한 한 가지부터 시도해보세요. 성과뿐 아니라 시도한 내용과 필요한 지원도 소중한 기록입니다.',taskText:`[${+month.slice(5)}월 피트니스 개선] ${title}`,end};
  }
  return {build};
});

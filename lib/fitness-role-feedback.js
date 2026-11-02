(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FitnessRoleFeedback = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";
  // Operational priorities only. Do not put financial ledgers, member records or
  // compensation terms here: this file is also served to ordinary employees.
  const profiles = {
    manager: { label: "센터장", purpose: "퍼블릭 재등록과 회원 정착을 팀의 실행으로 연결합니다.", steps: [
      ["renewal-owner", "renewal", "만료 상담 후보 한 건의 담당자와 다음 확인일을 정해 인계하세요.", "후보 여부·담당·확인일이 연결됐는지 확인합니다. 미확정 상담은 계약으로 세지 않습니다."],
      ["team-support", "handoff", "팀의 미해결 요청 한 건을 골라 필요한 지원과 확인 담당자를 정하세요.", "접수와 처리 완료를 구분하고 다음 근무자가 확인할 조치를 남깁니다."],
      ["source-check", "lesson", "예약·수업·상담 기록 중 확인이 필요한 한 건을 담당자 설명과 대조하세요.", "확인 전 차이는 누락·과실로 단정하지 않고 정정 또는 추가 확인으로 구분합니다."],
    ] },
    frontDesk: { label: "인포", purpose: "일관된 응대와 이용 불편 해소로 퍼블릭 회원의 운동 지속을 돕습니다.", steps: [
      ["inquiry-next", "inquiry", "다음 문의 한 건의 이용 목적과 방문 가능 시간을 확인하고 다음 안내를 정하세요.", "상담·방문 예약·등록을 구분하고 다음 담당자와 안내 시점을 확인합니다."],
      ["renewal-question", "renewal", "담당 가능한 만료 상담 한 건에서 이용 불편이나 남은 질문 한 가지를 확인하세요.", "센터 기준·연락 동의·실제 만료 여부를 먼저 확인하고 미결정은 보류로 남깁니다."],
      ["opening-check", "facility", "담당 구역 한 곳의 불편 요소를 점검하고 미해결 조치를 인계하세요.", "청결·수건·통로 중 확인한 항목과 다음 조치를 구분해 남깁니다."],
    ] },
    trainer: { label: "트레이너", purpose: "수업 이행과 다음 운동 계획을 연결해 회원의 지속 이용을 돕습니다.", steps: [
      ["lesson-result", "lesson", "담당 수업 한 건의 실제 결과와 다음 운동 약속을 확인하세요.", "예약·출석·취소·노쇼와 유료·무료 수업을 구분합니다. 민감한 상담 내용은 공용 일지에 적지 않습니다."],
      ["member-question", "renewal", "예정된 상담 한 건에서 회원이 느낀 변화와 남은 질문 한 가지를 확인하세요.", "확인한 이용 경험과 다음 상담 시점을 남기고 재등록을 재촉하지 않습니다."],
      ["lesson-handoff", "handoff", "다음 수업 전에 공간·준비물·예약 겹침 중 한 가지를 점검하세요.", "확인한 준비 상태와 인수인계가 필요한 조치를 구분합니다."],
    ] },
    sales: { label: "상담·등록", purpose: "회원의 필요에 맞는 안내와 후속 상담으로 유료 등록의 기반을 만듭니다.", steps: [
      ["consult-question", "inquiry", "상담 한 건에서 결정하지 못한 질문과 다음 안내 시점을 정하세요.", "신규·재등록, 상담·보류·계약을 구분하고 확정된 조건만 안내합니다."],
      ["renewal-experience", "renewal", "만료 상담 한 건에서 이용 경험과 불편을 먼저 확인하세요.", "실제 상담 대상과 연락 가능 여부를 확인하고 회원 의사를 존중합니다."],
      ["channel-result", "promotion", "담당 상담 한 건의 유입 경로와 실제 결과를 연결해 확인하세요.", "중복 문의를 새 회원으로 세지 않고 방문·유료 등록 여부를 구분합니다."],
    ] },
    marketing: { label: "홍보", purpose: "게시량보다 지역 회원의 문의·방문으로 이어지는 정보를 만듭니다.", steps: [
      ["content-action", "promotion", "다음 게시물 한 건의 대상·회원 효익·문의 방법을 분명히 하세요.", "사진 사용 동의와 공개 가능 정보를 확인하고 확인되지 않은 효과를 약속하지 않습니다."],
      ["inquiry-source", "inquiry", "담당 콘텐츠 한 건에서 확인된 문의 반응과 경로를 구분하세요.", "조회·문의·방문·등록을 각각 구분하고 확인되지 않은 반응은 미확인으로 남깁니다."],
      ["content-reuse", "promotion", "반응을 확인한 소재 한 건을 다른 채널의 형식에 맞게 다듬어 보세요.", "내용·운영시간·문의 방법이 현재 안내 기준과 맞는지 확인합니다."],
    ] },
    facility: { label: "시설", purpose: "시설 불편의 재발을 줄여 회원이 안전하게 운동을 이어가도록 돕습니다.", steps: [
      ["facility-report", "facility", "미해결 시설 한 건의 위치·증상·현재 조치를 확인해 담당자에게 전달하세요.", "수리 접수와 실제 완료를 구분하며 임의 수리 없이 담당자 확인을 받습니다."],
      ["facility-followup", "handoff", "이전에 전달한 시설 한 건의 처리 결과와 다음 확인 시점을 점검하세요.", "재사용은 담당자 확인 후 진행하고 남은 불편을 인계합니다."],
      ["facility-prevent", "facility", "담당 구역 한 곳에서 반복되는 불편의 예방 점검 항목을 정하세요.", "제조사·센터 지침을 따르고 회원 동선과 작업 동선이 겹치지 않는지 확인합니다."],
    ] },
    cleaning: { label: "청결", purpose: "청결과 준비 상태를 일정하게 유지해 회원의 이용 경험을 개선합니다.", steps: [
      ["zone-check", "facility", "담당 구역 한 곳의 물기·방치 물품·수건 상태를 확인하세요.", "확인한 구역과 남은 조치를 구분하고 세정제·세탁은 제품과 센터 지침을 따릅니다."],
      ["towel-flow", "facility", "사용 수건과 깨끗한 수건의 이동 동선 한 곳을 확인하세요.", "혼입·부족 여부와 다음 보충 담당자를 확인합니다. 재고를 임의로 추정하지 않습니다."],
      ["clean-handoff", "handoff", "다음 담당자가 먼저 확인할 청결 항목 한 가지를 인계하세요.", "작업 완료와 시설 이상 확인을 별도로 남깁니다."],
    ] },
    general: { label: "담당 업무", purpose: "맡은 업무의 완료 기준과 다음 조치를 작게 연결합니다.", steps: [
      ["own-step", "handoff", "담당 가능한 업무 한 건의 완료 기준과 필요한 지원을 확인하세요.", "본인의 업무 범위 안에서 확인한 결과와 다음 담당자를 구분해 남깁니다."],
    ] },
  };
  const topicMatchers = { renewal: /재등록|재가입|만료|연장/, inquiry: /상담|문의|응대|방문/, lesson: /PT|피티|수업|예약/i, promotion: /홍보|마케팅|블로그|SNS|인스타/i, facility: /청결|청소|시설|기구|수건|세탁|정리|물기/, handoff: /인계|마감|오픈|미해결|지원/ };
  function role(employee = {}, isCenter = false) {
    if (isCenter) return "manager";
    // An info employee mentioning PT consultation must not become a trainer.
    // Explicit assigned role/position wins over incidental duty keywords.
    for (const s of [`${employee.role || ""} ${employee.position || ""}`, String(employee.primaryWork || "")]) {
      if (/센터장|운영총괄|실장/.test(s)) return "manager";
      if (/인포|고객응대|프런트|프론트/.test(s)) return "frontDesk";
      if (/트레이너|\bPT\b|피티|수업/i.test(s)) return "trainer";
      if (/청결|청소/.test(s)) return "cleaning";
      if (/마케팅|홍보/.test(s)) return "marketing";
      if (/시설/.test(s)) return "facility";
      if (/상담|계약|영업/.test(s)) return "sales";
    }
    return "general";
  }
  const count = value => typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(5000, Math.floor(value))) : 0;
  function evidence(context = {}) {
    const tasks = (context.taskSummary?.items || []).filter(x => String(x.text || "").trim());
    const schedule = (context.scheduleSummary?.items || []).filter(x => String(x.text || "").trim());
    const text = [...tasks, ...schedule].map(x => x.text || "").concat(context.reportNotes || []).join(" ");
    return { tasks: tasks.length, completed: tasks.filter(x => x.status === "완료" || x.done === true).length, schedule: schedule.length, topics: Object.entries(topicMatchers).filter(([,re]) => re.test(text)).map(([key]) => key) };
  }
  function build(context = {}, history = {}, current = null) {
    const roleKey = role(context.employee, context.isCenter), profile = profiles[roleKey], ev = evidence(context);
    const date = String(context.dateKey || "");
    const matchesRole = x => {
      const m = x?.fitness_feedback || x?.coaching_snapshot?.fitnessFeedback;
      return !m || m.roleKey === roleKey;
    };
    const rows = [...new Map((history.rows || []).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x.log_date || "") && x.log_date < date && matchesRole(x)).map(x => [x.log_date,x])).values()].sort((a,b) => b.log_date.localeCompare(a.log_date));
    const isCurrent = Boolean(current && current.response_code !== "pending" && matchesRole(current));
    const active = isCurrent ? current : rows[0];
    const meta = active?.fitness_feedback || active?.coaching_snapshot?.fitnessFeedback;
    const previousStep = meta?.version === 1 && meta.roleKey === roleKey ? profile.steps.findIndex(x => x[0] === meta.stepKey) : -1;
    const blocked = active?.status === "support_needed" || active?.response_code === "support" || active?.followup_result === "blocked";
    const recurring = active?.followup_result === "recurring";
    const deferred = active?.status === "deferred" || active?.response_code === "defer";
    const complete = active?.status === "completed" && !blocked && !recurring;
    const working = active && !complete && ["execute","already","explain","defer"].includes(active.response_code);
    const index = previousStep >= 0 ? (complete && !isCurrent ? (previousStep + 1) % profile.steps.length : previousStep) : Math.max(0,profile.steps.findIndex(x => ev.topics.includes(x[1])));
    const step = profile.steps[index];
    const verified = Boolean(complete && active.followup_result === "improved" && active.reviewed_at);
    const stage = blocked ? "support" : deferred ? "defer" : working || recurring ? "continue" : complete ? "repeat" : "start";
    const stageLabel = { support:"지원 연결",defer:"다음 시점 조정",continue:"실행 이어가기",repeat:"작은 개선 이어가기",start:"작게 시작" }[stage];
    const observation = ev.tasks || ev.schedule ? `당일 업무 ${ev.tasks}건 중 완료 표시 ${ev.completed}건, 일정 ${ev.schedule}건을 기준으로 제안합니다.` : "당일 실행 근거는 아직 확인되지 않았습니다. 아래는 역할에 맞춘 제안입니다.";
    const encouragement = blocked ? "지원 요청은 다음 조치를 정하는 근거입니다. 부담을 늘리지 않고 막힌 부분부터 함께 풀어갑니다." : deferred ? "보류 사유를 먼저 확인하고 가능한 다음 시점을 본인이 정하세요." : recurring ? "이전 점검에서 같은 문제가 남아 있었습니다. 원인을 단정하지 않고 기존 실행의 한 부분부터 조정해 보세요." : verified ? "이전 개선이 관리자 확인까지 연결됐습니다. 효과가 있었던 방법을 다음 작은 실행에 이어가세요." : complete ? "이전 실행을 완료로 남겼습니다. 실제 효과를 확인하며 다음 작은 실행을 선택하세요." : working ? "새 과제를 늘리기보다 이미 정한 실행을 가능한 범위에서 마무리해 보세요." : "한 번에 한 가지를 선택해 보세요. 완료 여부와 어려움을 남기면 다음 피드백에 연결됩니다.";
    const action = blocked ? "기존 실행에서 막힌 점 한 가지와 필요한 지원·확인 담당자를 정하세요." : deferred ? "기존 실행의 보류 사유와 다시 확인할 시점 한 가지를 정하세요." : working && previousStep < 0 ? "기존에 정한 개선 행동 한 건의 진행 상황과 다음 확인 시점을 정하세요." : step[2];
    const check = blocked ? "지원 담당·다음 확인일·보류 이유를 남깁니다. 지원 요청을 미실적이나 과실로 판단하지 않습니다." : deferred ? "업무 상황과 다음 확인일을 남기고 필요한 경우 지원을 요청합니다." : step[3];
    return { version:1,roleKey,roleLabel:profile.label,stage,stageLabel,stepKey:step[0],purpose:profile.purpose,observation,encouragement,action,check,evidence:ev,historyStatus:history.status || "unavailable" };
  }
  // Same projection runs in the browser and API. Only enums, counts and our own
  // reviewed plan text cross the AI boundary, never arbitrary worklog/CRM text.
  function aiContext(context = {}) {
    const f = context.roleFeedback || {}, key = Object.hasOwn(profiles,f.roleKey) ? f.roleKey : "general", profile = profiles[key];
    const step = profile.steps.find(x => x[0] === f.stepKey) || profile.steps[0];
    const stages = ["start","continue","repeat","support","defer"], stage = stages.includes(f.stage) ? f.stage : "start";
    const ev = f.evidence || context.evidence || {}, topics = Array.isArray(ev.topics) ? ev.topics.filter(x => Object.hasOwn(topicMatchers,x)) : [];
    return { coachingStyle:"fitness-progress-v2", dateKey:String(context.dateKey || "").slice(0,10), employee:{role:profile.label}, roleFeedback:{roleKey:key,stage,stepKey:step[0],purpose:profile.purpose,action:stage === "support" ? "막힌 점 한 가지와 필요한 지원·확인 담당자를 정합니다." : stage === "defer" ? "보류 사유와 다시 확인할 시점을 정합니다." : step[2],check:step[3]}, taskSummary:{total:count(ev.tasks),completed:Math.min(count(ev.completed),count(ev.tasks)),items:topics.map(topic => ({text:`당일 ${topic} 관련 업무기록`,status:"기록 근거"}))},scheduleSummary:{total:count(ev.schedule)},reportNotes:topics.length ? [] : ["역할에 맞는 제안이며 당일 세부 실행 근거는 확인 전"],evidence:{tasks:count(ev.tasks),completed:Math.min(count(ev.completed),count(ev.tasks)),schedule:count(ev.schedule),topics} };
  }
  return { role, evidence, build, aiContext };
});

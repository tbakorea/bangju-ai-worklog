const storageKey = "beyond-worklog-state-v1";
const layoutModeStorageKey = "beyond-worklog-layout-mode";
const globalViewModeStorageKey = "beyond-worklog-global-view-mode";
const localAuthSignedOutKey = "beyond-worklog-auth-signed-out";
const fitnessAiCoachingStorageKey = "beyond-fitness-ai-coaching-v1";
const productionAppUrl = "https://bangju-ai-worklog.vercel.app/";
const supabaseConfig = {
  url: "https://zllpfaijahyfppivkxzu.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpsbHBmYWlqYWh5ZnBwaXZreHp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzMzQxNTUsImV4cCI6MjA5ODkxMDE1NX0.C4omaj-e_9PM-iF3-5GUUVX47Wo06UsNTOYMlMMVcZU",
};
const supabaseClient = window.supabase?.createClient(supabaseConfig.url, supabaseConfig.anonKey) || null;
let todayKey = formatDateKey(new Date());
const worklogViewAliases = {
  worklog: "worklog",
  today: "bangju-log",
  "bangju-log": "today",
  "beyond-log": "today",
};
const attendanceEnabledViews = new Set(["worklog", "fitness-log", "bangju-log", "beyond-log", "today"]);
const controlTowerEmails = new Set(["j3010@ymail.com"]);
const activeFitnessManagerEmail = "pjhong0@naver.com";
const retiredFitnessManagerEmails = new Set(["pjhong1@naver.com", "pjhong9@naver.com"]);
let activeView = "fitness-log";
let attendancePromptLastAt = 0;
let todayPageMode = "daily";
const bangjuOrganization = [
  {
    name: "(주)방주",
    category: "부동산 개발 · 시행 법인",
    staff: 2,
    units: [
      { name: "비욘드 피트니스 지사", category: "피트니스센터", staff: 5, roles: ["센터장 1", "트레이너 1", "인포데스크 3"] },
      { name: "워크베이스", category: "공유오피스", staff: 1, roles: ["매니저 1"] },
      { name: "워크박스", category: "공유창고", staff: 0, roles: ["워크베이스 겸임"] },
      { name: "홍보관", category: "분양 · 임대", staff: 2, roles: ["분양/임대 2"] },
    ],
  },
  {
    name: "(주)비제이종합건설",
    category: "종합건설",
    staff: 1,
    units: [
      { name: "동천체육관현장", category: "공사 현장", staff: 5, roles: ["소장 1", "공사부장 1", "공무이사 1", "안전부장 1", "반장 1"] },
      { name: "옥동 헤이븐빌 현장", category: "공사 현장", staff: 1, roles: ["소장 1"] },
    ],
  },
  {
    name: "(주)더헤이븐빌",
    category: "옥동 헤이븐빌 시행법인",
    staff: 0,
    units: [{ name: "방주 관리", category: "시행 관리", staff: 0, roles: ["방주에서 관리"] }],
  },
  {
    name: "(주)비욘드컴퍼니",
    category: "총괄관리",
    staff: 1,
    units: [
      { name: "tba studio", category: "쇼룸 운영 · 벽매립욕실 시스템 · 인테리어 견적", staff: 0, roles: ["쇼룸 운영"] },
      { name: "인월시스템 욕실 개발·시공", category: "욕실 개발 및 시공", staff: 0, roles: ["개발", "시공", "수주"] },
      { name: "자체공사 인테리어 시행", category: "인테리어 시행", staff: 0, roles: ["자체공사"] },
      { name: "인월시스템 유니트", category: "수입 · 디자인", staff: 0, roles: ["수입", "디자인"] },
    ],
  },
];
const organizationOptions = bangjuOrganization.flatMap((company) => [company.name, ...company.units.map((unit) => `${company.name} / ${unit.name}`)]);
const priorityOptions = [
  ["A", "A"],
  ["B", "B"],
  ["C", "C"],
  ["?", "?"],
];
const taskPriorityOptions = ["?", "A", "B", "C", "위임", "연기", "취소"];
const scheduleTypeOptions = ["업무", "유료PT", "무료PT", "고객/상담", "영업/홍보", "시설/청결", "행정/정산", "오픈/마감", "휴게"];
const taskStatusCycle = ["미완료", "완료", "진행중"];
const taskStatusGuideLabels = {
  "완료": "완료",
  "진행중": "진행중",
  "위임": "위임",
  "연기": "연기",
  "미완료": "해제",
};
const permissionKeys = [
  ["executiveRoom", "대표 의사결정"],
  ["controlTower", "전사업장 현황"],
  ["siteControl", "소속 사업장"],
  ["worklogAll", "전직원 업무일지"],
  ["worklogSite", "소속 업무일지"],
  ["laborAll", "전직원 노무"],
  ["laborSite", "소속 노무"],
  ["staffApproval", "가입승인"],
  ["staffManage", "직원/권한관리"],
];
const permissionPresets = {
  owner: {
    label: "대표",
    caption: "의사결정실·전사업장·노무·직원승인 전체",
    permissions: {
      executiveRoom: true,
      controlTower: true,
      siteControl: true,
      worklogAll: true,
      worklogSite: true,
      laborAll: true,
      laborSite: true,
      staffApproval: true,
      staffManage: true,
    },
  },
  executive_delegate: {
    label: "대표 대리",
    caption: "대표가 위임한 의사결정/전사업장 열람",
    permissions: {
      executiveRoom: true,
      controlTower: true,
      siteControl: true,
      worklogAll: true,
      worklogSite: true,
      laborAll: false,
      laborSite: true,
      staffApproval: true,
      staffManage: true,
    },
  },
  operations_admin: {
    label: "운영 관리자",
    caption: "전사업장 현황과 직원 실행상태 관리",
    permissions: {
      executiveRoom: false,
      controlTower: true,
      siteControl: true,
      worklogAll: true,
      worklogSite: true,
      laborAll: false,
      laborSite: true,
      staffApproval: true,
      staffManage: true,
    },
  },
  site_manager: {
    label: "사업장 관리자",
    caption: "소속 사업장과 소속 직원 중심",
    permissions: {
      executiveRoom: false,
      controlTower: false,
      siteControl: true,
      worklogAll: false,
      worklogSite: true,
      laborAll: false,
      laborSite: true,
      staffApproval: true,
      staffManage: false,
    },
  },
  employee: {
    label: "일반직원",
    caption: "본인 업무일지·본인 노무",
    permissions: {
      executiveRoom: false,
      controlTower: false,
      siteControl: false,
      worklogAll: false,
      worklogSite: false,
      laborAll: false,
      laborSite: false,
      staffApproval: false,
      staffManage: false,
    },
  },
  freelance: {
    label: "프리랜서",
    caption: "본인 업무일지·수업/정산 자료",
    permissions: {
      executiveRoom: false,
      controlTower: false,
      siteControl: false,
      worklogAll: false,
      worklogSite: false,
      laborAll: false,
      laborSite: false,
      staffApproval: false,
      staffManage: false,
    },
  },
  readonly: {
    label: "열람전용",
    caption: "지정된 자료만 열람",
    permissions: {
      executiveRoom: false,
      controlTower: false,
      siteControl: false,
      worklogAll: false,
      worklogSite: false,
      laborAll: false,
      laborSite: false,
      staffApproval: false,
      staffManage: false,
    },
  },
};
const defaultScheduleTimes = ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00"];
const hanjaWeekdays = ["日", "月", "火", "水", "木", "金", "土"];
const lunarDateFormatter = new Intl.DateTimeFormat("ko-u-ca-chinese", { month: "numeric", day: "numeric" });
const koreanHolidayCache = new Map();
const attendanceActions = ["출근", "퇴근", "조퇴", "외출"];
let attendancePopoverAction = "출근";
const organizationPlacementOptions = {
  "(주)방주": {
    workplaces: ["재무", "기타"],
    rolesByWorkplace: {
      "재무": ["부장", "과장", "대리"],
      "기타": ["이사"],
    },
  },
  "(주)비제이종합건설": {
    workplaces: ["동천체육관 현장", "옥동 더헤이븐빌 신축현장", "기타"],
    rolesByWorkplace: {
      "동천체육관 현장": ["소장", "이사", "부장", "과장", "반장"],
      "옥동 더헤이븐빌 신축현장": ["소장", "이사", "부장", "과장", "반장"],
      "기타": [],
    },
  },
  "(주)비욘드컴퍼니": {
    workplaces: ["비욘드 피트니스", "공유사업부 : 워크베이스", "공유사업부 : 워크박스", "TBA studio", "기타"],
    rolesByWorkplace: {
      "비욘드 피트니스": ["센터장", "트레이너", "인포"],
      "공유사업부 : 워크베이스": ["매니저"],
      "공유사업부 : 워크박스": ["매니저"],
      "TBA studio": ["실장"],
      "기타": ["이사", "부장", "과장", "본부장", "팀장"],
    },
  },
  "기타": {
    workplaces: ["기타"],
    rolesByWorkplace: {
      "기타": ["대표", "이사", "부장", "과장", "대리", "직원", "기타"],
    },
  },
};
const registrationWorkplaceOptions = Object.fromEntries(
  Object.entries(organizationPlacementOptions).map(([org, config]) => [org, config.workplaces])
);
const weeklyWorkDayOptions = [
  ["sun", "日"],
  ["mon", "月"],
  ["tue", "火"],
  ["wed", "水"],
  ["thu", "木"],
  ["fri", "金"],
  ["sat", "土"],
];
const siteWeatherAddressTargets = [
  { key: "비욘드 피트니스", label: "비욘드 피트니스", hint: "예: 울산광역시 남구 옥동 ..." },
  { key: "(주)방주 · 재무", label: "(주)방주 · 재무", hint: "본사 또는 재무팀 근무지 주소" },
  { key: "(주)비욘드컴퍼니 · 공유사업부", label: "(주)비욘드컴퍼니 · 공유사업부", hint: "워크베이스/워크박스 운영 주소" },
  { key: "(주)비욘드컴퍼니 · TBA studio", label: "(주)비욘드컴퍼니 · TBA studio", hint: "TBA studio 또는 쇼룸 주소" },
  { key: "(주)비제이종합건설 · 동천체육관 현장", label: "(주)비제이종합건설 · 동천체육관 현장", hint: "동천체육관 현장 주소" },
  { key: "(주)비제이종합건설 · 옥동 더헤이븐빌 신축현장", label: "(주)비제이종합건설 · 옥동 더헤이븐빌 신축현장", hint: "옥동 더헤이븐빌 신축현장 주소" },
  { key: "기타", label: "기타 사업장/현장", hint: "기타 사업장 주소" },
];
const defaultProfile = {
  org: "(주)방주",
  role: "직원",
  name: "내 프로필",
  nickname: "",
  phone: "",
  email: "",
  primaryWork: "",
  secondaryWork: "",
  workplace: "",
  employmentType: "직원",
  laborId: "",
  address: "",
  dailyWage: "",
  hourlyWage: "",
  joinDate: "",
  payDay: "",
  workHours: "08:00-18:00",
  weeklyWorkHours: {},
  manualSettings: {
    roleKey: "manager",
    employeeId: "beyond-fitness-manager",
    customByRole: {},
    missionsByEmployee: {},
  },
  extra: "",
  strengths: "",
  weaknesses: "",
  developmentGoals: "",
  approvalStatus: "draft",
  approvalNote: "",
  approvedBy: "",
  approvedAt: "",
  pendingProfileChanges: {},
  profileChangeRequestedAt: "",
  authUserId: "",
  accessPreset: "employee",
  permissions: {},
  assignedMission: "",
  assignedMissionVisible: true,
  assignedMissionUpdatedAt: "",
  assignedMissionUpdatedBy: "",
};

const profilePlacementOverrides = {
  "gusrd1005@gmail.com": {
    org: "(주)방주 / 비욘드 피트니스 지사",
    workplace: "비욘드 피트니스",
    role: "트레이너",
    name: "홍현규",
    nickname: "홍트",
    primaryWork: "PT 수업",
    secondaryWork: "회원관리, 센터 운영 지원",
    employmentType: "프리랜서",
    workHours: "06:00-24:00",
    accessPreset: "freelance",
    permissions: {},
    mappedEmployeeId: "fitness-trainer-1",
  },
  [activeFitnessManagerEmail]: {
    org: "(주)방주 / 비욘드 피트니스 지사",
    workplace: "비욘드 피트니스",
    role: "센터장",
    name: "박주홍",
    nickname: "박주홍",
    primaryWork: "비욘드 피트니스 운영총괄, PT 수업",
    secondaryWork: "센터 운영관리",
    employmentType: "직원",
    workHours: "06:00-24:00",
    accessPreset: "site_manager",
    permissions: {},
    mappedEmployeeId: "beyond-fitness-manager",
  },
  "projch@naver.com": {
    org: "(주)방주 / 비욘드 피트니스 지사",
    workplace: "비욘드 피트니스",
    role: "인포데스크",
    name: "홍길동",
    nickname: "홍길동",
    primaryWork: "고객응대, 센터관리",
    secondaryWork: "운영 지원",
    employmentType: "직원",
    workHours: "16:00-20:00",
    accessPreset: "employee",
    permissions: {},
    mappedEmployeeId: "fitness-weekday-info",
  },
  "tbakorea@gmail.com": {
    org: "(주)비욘드컴퍼니",
    workplace: "TBA studio",
    role: "실장",
    name: "김성민",
    nickname: "김성민",
    primaryWork: "TBA studio 운영, 인월바스 시스템 시공, 인테리어 시행",
    secondaryWork: "제품·시공·현장 운영 지원",
    employmentType: "직원",
    workHours: "08:00-18:00",
    accessPreset: "employee",
    permissions: {},
    mappedEmployeeId: "beyond-company-leader",
  },
};

function normalizeEmailValue(value = "") {
  return String(value || "").trim().toLowerCase();
}

function isActiveFitnessManagerEmail(email = "") {
  return normalizeEmailValue(email) === activeFitnessManagerEmail;
}

function isRetiredFitnessManagerEmail(email = "") {
  return retiredFitnessManagerEmails.has(normalizeEmailValue(email));
}

function isRetiredFitnessManagerIdentity(employee = {}) {
  const email = normalizeEmailValue(employee.email || "");
  if (isRetiredFitnessManagerEmail(email)) return true;
  const source = [
    employee.id,
    employee.mappedEmployeeId,
    employee.profileEmployeeId,
    employee.sourceProfileId,
    employee.name,
    employee.nickname,
    employee.email,
  ].filter(Boolean).join(" ").toLowerCase();
  return [...retiredFitnessManagerEmails]
    .map((item) => item.split("@")[0])
    .some((alias) => alias && source.includes(alias));
}

function getProfilePlacementOverride(email = "") {
  const key = normalizeEmailValue(email || state?.profile?.email || authState.user?.email || "");
  return key ? profilePlacementOverrides[key] : null;
}

function applyProfilePlacementOverride(profile = {}) {
  const email = normalizeEmailValue(profile.email || authState.user?.email || "");
  if (isRetiredFitnessManagerEmail(email)) return profile;
  const override = getProfilePlacementOverride(email);
  if (!override) return profile;
  const hasStaleOwnerResidue = normalizePermissionPresetKey(profile.accessPreset || "employee") === "owner"
    && !controlTowerEmails.has(email);
  return {
    ...profile,
    ...override,
    email: profile.email || email,
    approvalStatus: profile.approvalStatus || "approved",
    permissions: hasStaleOwnerResidue
      ? { ...(override.permissions || {}) }
      : { ...(profile.permissions || {}), ...(override.permissions || {}) },
  };
}

function normalizeProfilePlacementForAuth() {
  if (!state?.profile) return;
  const email = String(authState.user?.email || state.profile.email || "").trim().toLowerCase();
  const override = getProfilePlacementOverride(email);
  if (!override) return;
  state.profile = applyProfilePlacementOverride({
    ...state.profile,
    email,
    authUserId: authState.user?.id || state.profile.authUserId || "",
  });
  const mappedId = getProfileMappedEmployeeId(state.profile);
  if (mappedId) {
    if (fitnessEmployeeIds.includes(mappedId)) state.fitnessWritableEmployeeId = mappedId;
    if (!isRepresentativeProfile()) state.selectedEmployeeId = mappedId;
  }
}

const profileApprovalFieldMeta = [
  ["org", "소속", "org", "text"],
  ["workplace", "근무지", "workplace", "text"],
  ["role", "직급", "role", "text"],
  ["name", "이름", "name", "text"],
  ["phone", "전화", "phone", "phone"],
  ["email", "이메일", "email", "text"],
  ["primaryWork", "주업무", "primary_work", "text"],
  ["secondaryWork", "부업무", "secondary_work", "text"],
  ["employmentType", "고용형태", "employment_type", "text"],
  ["workHours", "기본 근무시간", "work_hours", "text"],
  ["weeklyWorkHours", "요일별 근무시간", "weekly_work_hours", "json"],
  ["laborId", "주민번호/식별번호", "labor_id", "text"],
  ["address", "주소", "address", "text"],
  ["dailyWage", "일당", "daily_wage", "number"],
  ["hourlyWage", "시급", "hourly_wage", "number"],
  ["joinDate", "입사일", "join_date", "date"],
  ["payDay", "임금지급일", "pay_day", "text"],
];
const profileApprovalFieldKeys = new Set(profileApprovalFieldMeta.map(([key]) => key));
const profileImmediateWorkTimeKeys = new Set(["workHours", "weeklyWorkHours"]);
const profileApprovalFieldByKey = Object.fromEntries(profileApprovalFieldMeta.map((meta) => [meta[0], meta]));
const fitnessManualTemplates = {
  manager: {
    title: "센터장 운영총괄 매뉴얼",
    text: [
      "1. 매일 오픈 전 센터 컨디션, 매출 목표, 예약 현황, 직원 배치를 확인한다.",
      "2. 전 직원 출결, 시간별 일정, PT/상담/계약/시설 이슈를 업무일지로 취합한다.",
      "3. 당일 핵심 지표는 PT 진행, 신규 상담, 재등록, 이탈 위험, 클레임, 시설 문제로 구분한다.",
      "4. 직원별 업무 공백이 생기면 즉시 센터관리, 고객응대, 홍보, 상담 후속으로 재배치한다.",
      "5. 마감 전 현금/결제/계약/상담 결과와 미처리 이슈를 다음 근무자에게 인수인계한다.",
      "6. 매주 직원 역량, 고객 경험, 청결 상태, 장비 상태, 매출 전환율을 리뷰하고 개선 과제를 부여한다.",
    ].join("\n"),
  },
  frontDesk: {
    title: "인포데스크 고객응대 매뉴얼",
    text: [
      "1. 첫 인사는 3초 안에 밝게 하고, 회원 이름을 확인해 개인화된 응대를 한다.",
      "2. 방문 목적을 신규상담, PT예약, 회원권, 민원, 시설문의로 분류하고 업무일지에 남긴다.",
      "3. 상담 후보는 연락처, 관심목표, 예산, 운동경험, 방문경로, 후속 연락일을 기록한다.",
      "4. 전화/카톡/방문 문의는 10분 안에 1차 응답하고 미해결 건은 센터장에게 즉시 공유한다.",
      "5. 피크타임에는 체크인 흐름, 락커/수건/결제 대기, 상담 대기자를 우선 관리한다.",
      "6. 마감 전 일일권, 신규, 재등록, 상담, 아웃바운드, 특이사항을 정리한다.",
    ].join("\n"),
  },
  trainer: {
    title: "트레이너 PT 운영 매뉴얼",
    text: [
      "1. 수업 전 회원 목표, 통증, 컨디션, 지난 수업 기록을 확인한다.",
      "2. 세션은 안전 체크, 워밍업, 본운동, 피드백, 다음 과제 순서로 진행한다.",
      "3. 수업 후 운동내용, 강도, 반응, 다음 예약, 재등록 가능성을 업무일지에 기록한다.",
      "4. 신규/휴면/이탈위험 회원은 운동 목표와 장애요인을 파악해 센터장과 공유한다.",
      "5. PT 전환 후보는 무료 점검, 체형/목표 상담, 체험 수업 제안 흐름으로 관리한다.",
      "6. 장비 사용 중 위험요소나 파손을 발견하면 즉시 사용 중지 표시 후 시설관리 항목에 기록한다.",
    ].join("\n"),
  },
  sales: {
    title: "상담·계약 전환 매뉴얼",
    text: [
      "1. 상담은 목표, 문제, 기간, 예산, 결정권자, 시작 가능일을 확인하는 순서로 진행한다.",
      "2. 상품 설명보다 회원의 목표 달성 경로와 실패 방지 계획을 먼저 제시한다.",
      "3. 가격 제시는 옵션 2~3개로 단순화하고, 추천안의 이유를 명확히 말한다.",
      "4. 미계약자는 당일 감사 메시지, 24시간 내 추가 안내, 3일 내 재방문 제안으로 추적한다.",
      "5. 계약 완료 후 결제, 약관, 예약, OT, 담당자 배정을 한 번에 마무리한다.",
      "6. 상담 결과는 신규, 재등록, 보류, 실패 사유로 분류해 운영기록에 반영한다.",
    ].join("\n"),
  },
  marketing: {
    title: "홍보·마케팅 실행 매뉴얼",
    text: [
      "1. 매일 센터의 실제 변화, 회원 성과, 청결, 수업 현장 중 게시 가능한 소재를 수집한다.",
      "2. 콘텐츠는 시설 신뢰, 트레이너 전문성, 회원 후기, 이벤트, 지역 키워드로 분류한다.",
      "3. 신규 문의 유입경로를 블로그, 인스타, 지도, 소개, 현수막, 기타로 기록한다.",
      "4. 행사/이벤트는 목표, 대상, 기간, 혜택, 마감일, 후속 상담 루트를 먼저 정한다.",
      "5. 댓글/DM/전화 문의는 응답 속도를 관리하고 상담 예약으로 연결한다.",
      "6. 주간 리뷰에서 어떤 콘텐츠가 상담과 계약으로 이어졌는지 확인한다.",
    ].join("\n"),
  },
  facility: {
    title: "시설·장비관리 매뉴얼",
    text: [
      "1. 오픈 전 조명, 냉난방, 음악, 환기, 수압, 락커, 샤워실, 키오스크 상태를 확인한다.",
      "2. 장비는 안전핀, 케이블, 패드, 볼트, 러닝벨트, 소음, 흔들림을 우선 점검한다.",
      "3. 위험 장비는 즉시 사용 중지 표시를 하고 수리 요청, 사진, 담당자, 완료기한을 기록한다.",
      "4. 피크타임 전 바닥, 동선, 수건, 소모품, 정수기, 탈의실 상태를 재점검한다.",
      "5. 시설 이슈는 회원 불편도와 안전위험도를 기준으로 즉시/당일/주간 조치로 나눈다.",
      "6. 반복 고장은 교체주기와 비용을 기록해 월간 시설계획에 반영한다.",
    ].join("\n"),
  },
  cleaning: {
    title: "청결·위생관리 매뉴얼",
    text: [
      "1. 청소는 눈에 보이는 정리, 접촉면 소독, 냄새 관리, 바닥 안전 순서로 수행한다.",
      "2. 화장실, 샤워실, 탈의실, 손잡이, 운동기구 접촉면은 시간대별 체크리스트로 관리한다.",
      "3. 세제와 소독제는 용도와 희석 기준을 구분하고, 표면 손상이나 미끄럼을 방지한다.",
      "4. 수건, 휴지, 비누, 소독티슈, 쓰레기통은 부족해지기 전에 보충한다.",
      "5. 청결 문제를 발견하면 사진, 위치, 조치내용, 재발방지 포인트를 기록한다.",
      "6. 신규 직원은 숙련자와 동행해 청소 순서와 기준을 현장에서 배운다.",
    ].join("\n"),
  },
  bangjuFinance: {
    title: "방주 재무·자금관리 매뉴얼",
    text: [
      "1. 매일 오전 계좌 잔액, 카드매출, 입금 예정, 지출 예정, 대출 이자 일정을 확인한다.",
      "2. 자금 업무는 입금확인, 지급요청, 증빙수취, 계정분류, 대표 보고 순서로 처리한다.",
      "3. 세금계산서, 카드영수증, 계약서, 견적서는 사업장·거래처·프로젝트 단위로 연결해 보관한다.",
      "4. 미수금과 미지급금은 금액, 사유, 담당자, 예정일, 후속 조치를 업무일지에 남긴다.",
      "5. 고정비, 대출이자, 임대료, 인건비는 월간 현금흐름표와 비교해 위험 신호를 표시한다.",
      "6. 대표 보고는 오늘의 자금 변동, 이번 주 지급위험, 세무/계약 확인사항, 요청 의사결정으로 요약한다.",
    ].join("\n"),
  },
  beyondTba: {
    title: "TBA 스튜디오·인월바스 시스템 매뉴얼",
    text: [
      "1. TBA 업무는 제품기획, 욕실 시스템 설계, 시공 검토, 쇼룸, 특허/IP, 견적 흐름으로 구분한다.",
      "2. 인월바스 시스템 시공은 현장 실측, 배관/방수/마감 조건, 제품 스펙, 납기, 하자위험을 먼저 확인한다.",
      "3. 인테리어 시행 건은 발주처 요구, 예산, 일정, 협력업체, 자재선정, 변경사항을 프로젝트 단위로 기록한다.",
      "4. 쇼룸/전시장 업무는 방문객 목적, 관심 제품, 견적 가능성, 후속 연락일을 고객관리로 남긴다.",
      "5. 제품 개선 아이디어와 하자 사례는 사진, 원인, 개선안, 담당자, 반영 여부로 관리한다.",
      "6. 매주 TBA 핵심 이슈는 제품개발, 시공품질, 견적/매출, IP, 쇼룸 운영, 협력업체 리스크로 보고한다.",
    ].join("\n"),
  },
  beyondShared: {
    title: "비욘드 공유사업부 운영관리 매뉴얼",
    text: [
      "1. 공유오피스와 공유창고는 공실, 계약, 결제, 우편, 시설, 민원, 청결 상태를 매일 확인한다.",
      "2. 신규 문의는 이용 목적, 기간, 필요 공간, 사업자등록 여부, 예산, 입주 가능일을 확인한다.",
      "3. 입주기업 관리는 계약만료일, 보증금/월이용료, 우편/회의실 사용, 민원, 추가 니즈를 기준으로 추적한다.",
      "4. 공실은 호실별 상태, 사진, 가격, 홍보채널, 문의수, 전환율을 기록하고 원인을 분석한다.",
      "5. 공유창고는 입출고 동선, 보안, 습도/냄새, 장기 미사용, 연체 여부를 점검한다.",
      "6. 주간 보고는 공실 감소, 계약 갱신, 신규 문의, 시설 이슈, 미수금, 홍보 필요사항 중심으로 정리한다.",
    ].join("\n"),
  },
  beyondInterior: {
    title: "인테리어 시행·시공관리 매뉴얼",
    text: [
      "1. 현장 업무는 실측, 견적, 계약, 발주, 공정, 품질, 안전, 정산, 하자관리로 나누어 관리한다.",
      "2. 착수 전 도면, 공사범위, 자재 스펙, 납기, 협력업체, 민원 가능성을 체크한다.",
      "3. 공정표는 철거, 설비, 방수, 목공, 전기, 타일, 도장, 가구, 마감 순서와 책임자를 명확히 한다.",
      "4. 변경사항은 구두로 넘기지 말고 변경 사유, 비용, 일정 영향, 승인자를 기록한다.",
      "5. 품질 점검은 누수, 수평/수직, 마감, 안전, 청소, 사용설명, 고객 확인 순서로 진행한다.",
      "6. 마감 후 정산, 잔금, 하자보증, 사진 아카이브, 다음 현장 개선점을 보고한다.",
    ].join("\n"),
  },
};
const employees = [
  { id: "bangju-finance-manager", name: "재무과장", org: "(주)방주", role: "재무과장", primaryWork: "자금, 회계, 보고" },
  { id: "bangju-finance-assistant", name: "이소미", org: "(주)방주", role: "재무 대리", primaryWork: "지출, 정산, 문서" },
  { id: "construction-finance-assistant", name: "비제이 재무 예비", org: "(주)비제이종합건설", role: "예비", primaryWork: "건설현장 지출, 정산, 노무자료" },
  { id: "bangju-spare-1", name: "방주 예비", org: "(주)방주", role: "예비", primaryWork: "공통 지원" },
  { id: "beyond-fitness-manager", name: "박주홍", nickname: "센터장", org: "(주)방주 / 비욘드 피트니스 지사", role: "센터장", workHours: "06:00-24:00", primaryWork: "운영총괄, PT 수업" },
  { id: "fitness-trainer-1", name: "홍현규", nickname: "홍트", email: "gusrd1005@gmail.com", org: "(주)방주 / 비욘드 피트니스 지사", role: "트레이너", workHours: "06:00-24:00", primaryWork: "PT 수업", employmentType: "프리랜서" },
  { id: "fitness-weekday-info", name: "주중 인포", nickname: "주중인포", org: "(주)방주 / 비욘드 피트니스 지사", role: "인포데스크", workHours: "16:00-20:00", primaryWork: "고객응대, 센터관리" },
  { id: "fitness-weekday-info-idabin", name: "이다빈", nickname: "이다빈", org: "(주)방주 / 비욘드 피트니스 지사", role: "인포데스크", workHours: "16:00-20:00", primaryWork: "고객응대, 센터관리" },
  { id: "fitness-info-kimyoungchae", name: "김영채", nickname: "김영채", email: "yckim1558@naver.com", org: "(주)방주 / 비욘드 피트니스 지사", role: "인포데스크", workHours: "10:00-18:00", primaryWork: "고객응대, 센터관리" },
  { id: "fitness-info-shinsemin", name: "신세민", nickname: "신세민", email: "tpals2990@naver.com", org: "(주)방주 / 비욘드 피트니스 지사", role: "인포데스크", workHours: "10:00-18:00", primaryWork: "고객응대, 센터관리" },
  { id: "fitness-saturday-info", name: "토요 인포", nickname: "토요인포", org: "(주)방주 / 비욘드 피트니스 지사", role: "토요 인포", workHours: "10:00-18:00", primaryWork: "토요일 고객응대, 센터관리" },
  { id: "fitness-sunday-info", name: "일요 인포", nickname: "일요인포", org: "(주)방주 / 비욘드 피트니스 지사", role: "일요 인포", workHours: "10:00-18:00", primaryWork: "일요일 고객응대, 센터관리" },
  { id: "fitness-spare-1", name: "피트니스 예비", nickname: "예비", org: "(주)방주 / 비욘드 피트니스 지사", role: "예비", workHours: "10:00-18:00", primaryWork: "운영 지원" },
  { id: "beyond-company-leader", name: "김성민", org: "(주)비욘드컴퍼니", role: "실장", primaryWork: "TBA studio 운영, 인월바스 시스템 시공, 인테리어 시행" },
  { id: "beyond-shared-manager", name: "공유사업부 매니저", org: "(주)비욘드컴퍼니 / 공유사업부", role: "공유사업부 매니저", primaryWork: "공유오피스, 공유창고, 고객관리" },
  { id: "beyond-spare-1", name: "비욘드 예비", org: "(주)비욘드컴퍼니", role: "예비", primaryWork: "공통 지원" },
];
const fitnessEmployeeIds = ["beyond-fitness-manager", "fitness-trainer-1", "fitness-weekday-info", "fitness-weekday-info-idabin", "fitness-info-kimyoungchae", "fitness-info-shinsemin", "fitness-saturday-info", "fitness-sunday-info", "fitness-spare-1"];
const fitnessPlaceholderEmployeeIds = new Set(["fitness-weekday-info", "fitness-saturday-info", "fitness-sunday-info", "fitness-spare-1"]);
const bangjuWorklogEmployeeIds = ["bangju-finance-manager", "bangju-finance-assistant", "construction-finance-assistant", "bangju-spare-1"];
const beyondWorklogEmployeeIds = ["beyond-company-leader", "beyond-shared-manager", "beyond-spare-1"];

function isAssignedWorklogEmployee(employee) {
  if (!employee) return false;
  const source = `${employee.id || ""} ${employee.name || ""} ${employee.nickname || ""} ${employee.role || ""}`.toLowerCase();
  return !/spare|예비|미배정|unassigned/.test(source);
}

function isRepresentativeWorklogEmployee(employee = {}) {
  const email = normalizeEmailValue(employee.email || "");
  const role = String(employee.role || "").trim().toLowerCase();
  return controlTowerEmails.has(email) || /대표|ceo|owner/.test(role);
}

function getAssignedWorklogEmployeeIds(employeeIds = []) {
  return employeeIds.filter((employeeId) => isAssignedWorklogEmployee(employees.find((employee) => employee.id === employeeId)));
}

function createFitnessOps() {
  return {
    ptRegular: "",
    ptFree: "",
    ptOther: "",
    customerNew: "",
    customerRenewal: "",
    dayPass: "",
    consultation: "",
    inbound: "",
    outbound: "",
    outsideSales: "",
    shiftNote: "",
    specialReport: "",
  };
}

function createFitnessOpsManual() {
  return Object.fromEntries(Object.keys(createFitnessOps()).map((key) => [key, false]));
}

function createFitnessGoals() {
  return {
    monthlyRevenueTarget: "20000000",
    memberTarget: "260",
    ptTarget: "180",
    consultationTarget: "80",
  };
}

function createDagymOps() {
  return {
    visits: "",
    newMembers: "",
    renewals: "",
    expiring: "",
    ptBookings: "",
    noShows: "",
    lockerExpiring: "",
    sales: "",
    importText: "",
  };
}

function createDagymDailyRecord(dateKey = todayKey) {
  return {
    ...createDagymOps(),
    dateKey,
    status: "draft",
    updatedAt: "",
    updatedBy: "",
    closedAt: "",
  };
}

function hasDagymDailyActivity(record = {}) {
  return Object.keys(createDagymOps()).some((key) => key !== "importText" && numberValue(record?.[key]) > 0)
    || Boolean(String(record?.importText || "").trim());
}

function getDagymOpsForDate(dateKey = getActiveDateKey(), { create = true } = {}) {
  state.dagymDaily ||= {};
  if (!state.dagymDaily[dateKey] && create) state.dagymDaily[dateKey] = createDagymDailyRecord(dateKey);
  return state.dagymDaily[dateKey] || createDagymDailyRecord(dateKey);
}

function touchDagymDailyRecord(record = getDagymOpsForDate()) {
  record.updatedAt = new Date().toISOString();
  record.updatedBy = getEmployeeOwnLabel(getProfileEmployee()) || state.profile?.name || "담당자";
  if (record.status === "closed") {
    record.status = "draft";
    record.closedAt = "";
  }
  state.dagymOps = record;
  return record;
}

const beyondAssets = [
  {
    building: "루클라쎄 1차",
    district: "옥동",
    floors: [
      { floor: "1F", rooms: ["113호"], site: "WorkBase 옥동점", brand: "WorkBase", status: "운영", operator: "(주)방주" },
      { floor: "2F", rooms: ["202호", "203호", "204호", "205호", "206호"], site: "WorkBase 옥동점", brand: "WorkBase", status: "운영", operator: "(주)방주" },
    ],
  },
  {
    building: "루클라쎄 2차",
    district: "옥동",
    floors: [
      { floor: "1F", rooms: ["1~4호", "8호"], site: "Beyond Fitness", brand: "Beyond Fitness", status: "운영", operator: "(주)비욘드컴퍼니" },
      { floor: "1F", rooms: ["Lounge"], site: "Lounge of Beyond", brand: "Lounge of Beyond", status: "무인운영", operator: "(주)비욘드컴퍼니" },
      { floor: "1F", rooms: ["WorkBox"], site: "WorkBox", brand: "WorkBox", status: "운영", operator: "(주)비욘드컴퍼니" },
      { floor: "2F", rooms: ["204호", "205호", "206호"], site: "TBA 쇼룸 / AI 교육장", brand: "TBA", status: "준비", operator: "TBA스튜디오" },
      { floor: "2F", rooms: ["209호", "210호", "211호", "212호"], site: "브랜드 쇼룸 / 행사장", brand: "Off:Line", status: "보류", operator: "(주)비욘드컴퍼니" },
    ],
  },
  {
    building: "더헤이븐",
    district: "옥동",
    floors: [
      { floor: "1F", rooms: ["GS25"], site: "편의점", brand: "GS25", status: "운영종료", operator: "(주)방주" },
      { floor: "2F", rooms: ["전체"], site: "WorkBase 옥동2", brand: "WorkBase", status: "운영", operator: "(주)방주" },
      { floor: "3F", rooms: ["전체"], site: "공유오피스", brand: "WorkBase", status: "운영", operator: "(주)방주" },
      { floor: "4F", rooms: ["전체"], site: "주거", brand: "더헤이븐", status: "임대", operator: "(주)더헤이븐빌" },
      { floor: "5F", rooms: ["전체"], site: "주거", brand: "더헤이븐", status: "임대", operator: "(주)더헤이븐빌" },
    ],
  },
  {
    building: "어반플러스",
    district: "동천",
    floors: [
      { floor: "사업장", rooms: ["동천체육관점"], site: "WorkBase 동천체육관점", brand: "WorkBase", status: "운영", operator: "(주)방주" },
    ],
  },
];
const beyondModules = [
  ["직원관리", "직원 기본정보, 미션, 목표, 교육, 역량학습", "운영"],
  ["노무", "월별 노무명세, 출퇴근, 유료수업 정산", "운영"],
  ["업무일지", "우선업무, 시간별 일정, 보고, AI 요약", "운영"],
  ["통합관제 사업장 신호", "청결, 시설, 공실, 회원, 방문객, 운영점수를 통합관제에서 추적", "설계"],
  ["마케팅관리", "SNS, 광고, 블로그, 리뷰, 이벤트 감지", "설계"],
  ["매출·매입관리", "POS, 카드매출, 매입, 원가, 영업이익", "설계"],
  ["재무관리", "현금흐름, 세금, 미수금, 대출, 위험 분석", "설계"],
  ["시설관리", "점검, 유지보수, 고장접수, 예측정비", "설계"],
  ["건설현장관리", "공정, 품질, 안전, 원가, 도면, 하자", "설계"],
  ["CRM", "회원, 입주기업, 거래처, 민원, 계약 갱신", "설계"],
  ["문서관리", "계약서, 도면, 사진, 회의록, AI 검색", "설계"],
  ["AI 코칭", "직원, 사업장, 대표 코칭과 실행 추적", "운영"],
];
const benchmarkSystems = [
  ["Asana · ClickUp", "업무, 담당자, 목표, AI 제안을 하나의 그래프로 연결해 오늘 할 일과 조직 목표를 같은 화면에서 추적"],
  ["monday.com", "대시보드와 자동화를 업무 흐름에 붙여 미작성, 지연, 승인 필요 같은 상태 변화를 즉시 행동으로 전환"],
  ["BambooHR · Rippling", "직원 원장, 온보딩, 권한, 근무·급여 기준을 분리해 가입승인 이후에도 데이터 품질을 유지"],
  ["SafetyCulture · Procore", "현장 점검, 이슈, 시정조치, 증빙 사진을 반복 체크리스트와 책임자 기반으로 관리"],
  ["Microsoft Viva · Lattice", "OKR, 역량, 피드백, 성장 기록을 업무 데이터와 연결해 개인별 코칭을 누적"],
  ["Yardi · Industry ERP", "부동산·시설·임대·매출 데이터를 사업장 단위로 묶어 운영 점수와 투자 판단으로 연결"],
];
const operatingRisks = [
  ["공간", "루클라쎄 2차 209~212호 보류 공간의 활용 시나리오 필요", "중"],
  ["매출", "Beyond Fitness 월매출 2천만원 기준 회원 유지율과 PT 전환율 추적 필요", "상"],
  ["시설", "공유오피스/피트니스/무인카페 시설 점검 주기 통합 필요", "중"],
  ["문서", "계약서, 도면, 사진이 사업장 단위로 연결되어야 AI 검색 가능", "상"],
];

const authState = {
  session: null,
  user: null,
  remoteReady: Boolean(supabaseClient),
  applyingRemote: false,
  saveTimer: null,
  saveTimers: new Map(),
  pendingApprovalCount: 0,
  pendingPasswordResetCount: 0,
  approvalRows: [],
  approvalRowsLoaded: false,
  visibleWorklogsLoading: false,
  visibleWorklogsTimer: null,
  approvalRepairTried: false,
  approvalRepairUnavailable: false,
  passwordResetRows: [],
  selectedApprovalId: "",
  approvalTimer: null,
  passwordRecoveryMode: false,
  signupEmailCheck: {
    email: "",
    status: "idle",
    message: "직원등록 전 이메일 중복확인을 해주세요.",
  },
};
var state = loadState();
let dateSlideTimer = 0;
let verticalDateSwipeTimer = 0;
let verticalDateSwipeAnimating = false;
let liveClockTimer = 0;
let calendarViewDate = parseDateKey(todayKey);
let calendarPickerMode = "worklog";
let calendarPostponeTask = null;
let calendarTriggerButtonId = "selectedDateButton";
let mobileDayFocusMode = "split";
let fitnessMobileFocusMode = "split";
let mobileFocusGateSuppressClick = false;
let fitnessScheduleEditorState = null;
let activeFitnessReportAiKey = "";
let fitnessReportAiRequestId = 0;
const fitnessReportAiAttempted = new Set();
const dailyEditingState = {
  focused: false,
  composing: false,
};
const weatherRequestInFlight = new Set();
const weatherBatchAttempted = new Set();
const weatherRequestFailures = new Map();
const weatherRetryTimers = new Map();
const siteWeatherAddressTimers = new Map();
const weatherFreshnessMs = 2 * 60 * 60 * 1000;
const weatherRetryBaseMs = 30 * 1000;

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey)) || createState();
    saved.selectedDateKey = todayKey;
    return saved;
  } catch {
    return createState();
  }
}

function resetStartupDateToToday() {
  todayKey = formatDateKey(new Date());
  state.selectedDateKey = todayKey;
  calendarViewDate = parseDateKey(todayKey);
  state.fitnessCenterMonth = todayKey.slice(0, 7);
  state.fitnessCenterMonthSourceDateKey = todayKey;
}

function restoreTodayAfterAppResume() {
  const liveTodayKey = formatDateKey(new Date());
  const needsReset = todayKey !== liveTodayKey || state.selectedDateKey !== liveTodayKey;
  if (!needsReset) return;
  resetStartupDateToToday();
  normalizeState();
  localStorage.setItem(storageKey, JSON.stringify(state));
  renderAll();
  if (authState.user) loadRemoteWorklogForActiveDate();
}

function refreshCurrentTimeIndicators() {
  const now = new Date();
  const liveTodayKey = formatDateKey(now);
  if (todayKey !== liveTodayKey) {
    restoreTodayAfterAppResume();
    return;
  }
  const isToday = getActiveDateKey() === liveTodayKey;
  const label = `현재 ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  document.querySelectorAll(".schedule-current-clock").forEach((clock) => {
    clock.hidden = !isToday;
    clock.textContent = label;
    clock.dateTime = now.toISOString();
  });
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  document.querySelectorAll("[data-schedule-time]").forEach((row) => {
    const scheduleUnit = row.closest("#fitnessAppointmentList")
      ? (getSelectedLog()?.scheduleUnit === "60" ? 60 : 30)
      : (getSelectedLog()?.scheduleUnit === "60" ? 60 : 30);
    const start = timeToMinutes(row.dataset.scheduleTime);
    row.classList.toggle("is-current", Boolean(isToday && Number.isFinite(start) && currentMinutes >= start && currentMinutes < start + scheduleUnit));
  });
}

function startLiveClock() {
  clearInterval(liveClockTimer);
  refreshCurrentTimeIndicators();
  liveClockTimer = window.setInterval(refreshCurrentTimeIndicators, 30 * 1000);
}

function createState() {
  const profileEmployee = {
    id: "profile-user",
    name: defaultProfile.name,
    org: defaultProfile.org,
    role: defaultProfile.role,
  };
  return {
    selectedEmployeeId: "beyond-fitness-manager",
    selectedDateKey: todayKey,
    profile: { ...defaultProfile },
    employeeLogs: {
      [todayKey]: { "beyond-fitness-manager": createEmployeeLog(employees.find((employee) => employee.id === "beyond-fitness-manager") || profileEmployee, defaultProfile) },
    },
    attendance: {
      [todayKey]: [
        { employeeId: "beyond-fitness-manager", org: "비욘드 피트니스 지사", role: "센터장", name: "박주홍", status: "정상", note: "" },
        { employeeId: "bangju-finance-manager", org: "(주)방주", role: "재무과장", name: "재무과장", status: "정상", note: "" },
        { employeeId: "beyond-company-leader", org: "(주)비욘드컴퍼니", role: "실장", name: "비욘드 실장", status: "정상", note: "" },
      ],
    },
    fitnessGoals: createFitnessGoals(),
    dagymOps: createDagymOps(),
    dagymDaily: {},
    fitnessDailyGuidance: {},
    fitnessCenterReports: {},
    worklogReportSubmissions: {},
    fitnessLogPage: 1,
    fitnessLogPageId: "beyond-fitness-manager",
    fitnessCenterMonth: todayKey.slice(0, 7),
    fitnessCenterMonthSourceDateKey: todayKey,
    fitnessWritableEmployeeId: "beyond-fitness-manager",
    staffMasterTab: "staff-list",
    staffMasterSite: "all",
    employeePermissions: {},
    employeeDirectoryOverrides: {},
    companyCommonWeeks: {},
    laborPayroll: {},
    laborWorkspaceTab: "overview",
    laborSiteScope: "all",
    communications: [],
    reportTone: "executive",
    reportArchive: {
      dateKey: todayKey,
      site: "all",
      type: "all",
      selectedId: "",
    },
    backupSettings: {
      recipientEmail: "j3010@ymail.com",
      cadence: "daily",
      lastPreparedAt: "",
    },
    siteWeatherAddresses: {},
    weatherCache: {},
    weatherLocationCache: {},
    worklogCorrectionRequests: [],
    worklogCorrectionGrants: {},
    worklogCorrectionAudit: [],
  };
}

function createEmployeeLog(employee = employees[0], profile = defaultProfile, dateKey = todayKey) {
  const mappedProfileId = getProfileMappedEmployeeId(profile || {});
  const profileHours = getProfileWorkHoursForDate(profile || defaultProfile, dateKey) || profile?.workHours || defaultProfile.workHours;
  const employeeHours = getOverviewScheduledWorkHours(employee, dateKey, {});
  const workHours = employee.id === "profile-user" || mappedProfileId === employee.id
    ? profileHours
    : employeeHours || employee.workHours || defaultProfile.workHours;
  return {
    employeeId: employee.id,
    org: employee.org,
    role: employee.role,
    clockIn: "",
    clockOut: "",
    attendanceBreaks: [],
    workHoursOverride: "",
    manualScheduleSlots: [],
    tasks: Array.from({ length: 14 }, () => ({ priority: "?", text: "", status: "예정", done: false })),
    schedule: getScheduleTimes(workHours).map((time) => ({ time, text: "", status: "예정" })),
    scheduleUnit: "60",
    report: "",
    memo: "",
    record: "",
    fitnessOps: createFitnessOps(),
    fitnessOpsManual: createFitnessOpsManual(),
  };
}

function normalizeState() {
  state.profile = { ...defaultProfile, ...(state.profile || {}) };
  state.profile = applyProfilePlacementOverride(state.profile);
  normalizeProfilePlacementForAuth();
  state.profile.nickname ||= "";
  state.profile.weeklyWorkHours = { ...(state.profile.weeklyWorkHours || {}) };
  state.profile.permissions = { ...(state.profile.permissions || {}) };
  state.profile.accessPreset ||= getRecommendedPermissionPresetForProfile(state.profile);
  const mappedProfileEmployeeId = getMappedProfileEmployeeId();
  state.selectedEmployeeId ||= mappedProfileEmployeeId || "profile-user";
  state.employeePermissions = normalizeEmployeePermissionState(state.employeePermissions || {});
  state.employeeDirectoryOverrides = { ...(state.employeeDirectoryOverrides || {}) };
  state.companyCommonWeeks = { ...(state.companyCommonWeeks || {}) };
  state.laborPayroll = { ...(state.laborPayroll || {}) };
  state.laborWorkspaceTab = ["overview", "register", "sites", "payroll"].includes(state.laborWorkspaceTab)
    ? state.laborWorkspaceTab
    : "overview";
  state.laborSiteScope ||= "all";
  state.siteWeatherAddresses = { ...(state.siteWeatherAddresses || {}) };
  state.weatherCache = { ...(state.weatherCache || {}) };
  state.weatherLocationCache = { ...(state.weatherLocationCache || {}) };
  state.communications = Array.isArray(state.communications) ? state.communications.slice(-300) : [];
  state.profile.manualSettings = {
    ...defaultProfile.manualSettings,
    ...(state.profile.manualSettings || {}),
    customByRole: { ...(state.profile.manualSettings?.customByRole || {}) },
    missionsByEmployee: { ...(state.profile.manualSettings?.missionsByEmployee || {}) },
  };
  syncFitnessWritableEmployeeFromProfile();
  if (isRepresentativeProfile() && state.selectedEmployeeId === "beyond-fitness-manager") {
    state.selectedEmployeeId = "profile-user";
  }
  if (state.profile.workHours === "12:00-19:00") state.profile.workHours = defaultProfile.workHours;
  const retiredFitnessIds = {
    "fitness-trainer-2": "fitness-weekday-info",
    "fitness-front-1": "fitness-saturday-info",
    "fitness-front-2": "fitness-sunday-info",
  };
  if (retiredFitnessIds[state.selectedEmployeeId]) state.selectedEmployeeId = retiredFitnessIds[state.selectedEmployeeId];
  if (
    !isRepresentativeProfile()
    && state.selectedEmployeeId === "beyond-fitness-manager"
    && !isEmployeeLinkedToProfile("beyond-fitness-manager")
  ) {
    state.selectedEmployeeId = getMappedProfileEmployeeId() || "profile-user";
  }
  state.selectedDateKey ||= todayKey;
  state.fitnessLogPage = Number.isFinite(Number(state.fitnessLogPage)) ? Number(state.fitnessLogPage) : 1;
  state.fitnessLogPageId = String(state.fitnessLogPageId || "");
  state.staffMasterTab = ["staff-list", "approval", "permission", "manual", "growth"].includes(state.staffMasterTab)
    ? state.staffMasterTab
    : "staff-list";
  state.staffMasterSite ||= "all";
  if (!/^\d{4}-\d{2}$/.test(String(state.fitnessCenterMonth || ""))) {
    state.fitnessCenterMonth = getActiveDateKey().slice(0, 7);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(state.fitnessCenterMonthSourceDateKey || ""))) {
    state.fitnessCenterMonthSourceDateKey = getActiveDateKey();
  }
  const mappedFitnessEmployeeId = getMappedProfileEmployeeId();
  const isMappedFitnessEmployee = mappedFitnessEmployeeId && fitnessEmployeeIds.includes(mappedFitnessEmployeeId);
  state.fitnessWritableEmployeeId ||= isMappedFitnessEmployee ? mappedFitnessEmployeeId : "beyond-fitness-manager";
  if (!isRepresentativeProfile() && isMappedFitnessEmployee) state.fitnessWritableEmployeeId = mappedFitnessEmployeeId;
  state.fitnessGoals = { ...createFitnessGoals(), ...(state.fitnessGoals || {}) };
  state.dagymDaily = { ...(state.dagymDaily || {}) };
  const legacyDagymOps = { ...createDagymOps(), ...(state.dagymOps || {}) };
  if (!state.dagymDaily[getActiveDateKey()] && hasDagymDailyActivity(legacyDagymOps)) {
    state.dagymDaily[getActiveDateKey()] = {
      ...createDagymDailyRecord(getActiveDateKey()),
      ...legacyDagymOps,
      updatedAt: new Date().toISOString(),
    };
  }
  Object.entries(state.dagymDaily).forEach(([dateKey, record]) => {
    state.dagymDaily[dateKey] = {
      ...createDagymDailyRecord(dateKey),
      ...(record || {}),
      dateKey,
    };
  });
  state.dagymOps = getDagymOpsForDate(getActiveDateKey());
  state.fitnessDailyGuidance = { ...(state.fitnessDailyGuidance || {}) };
  Object.entries(state.fitnessDailyGuidance).forEach(([dateKey, items]) => {
    state.fitnessDailyGuidance[dateKey] = Array.isArray(items) ? items.slice(-40) : [];
  });
  state.fitnessCenterReports = { ...(state.fitnessCenterReports || {}) };
  state.worklogReportSubmissions = { ...(state.worklogReportSubmissions || {}) };
  state.backupSettings = {
    recipientEmail: "j3010@ymail.com",
    cadence: "daily",
    lastPreparedAt: "",
    ...(state.backupSettings || {}),
  };
  state.worklogCorrectionRequests = Array.isArray(state.worklogCorrectionRequests)
    ? state.worklogCorrectionRequests
    : [];
  state.worklogCorrectionGrants = { ...(state.worklogCorrectionGrants || {}) };
  state.worklogCorrectionAudit = Array.isArray(state.worklogCorrectionAudit)
    ? state.worklogCorrectionAudit.slice(-240)
    : [];
  state.reportArchive = {
    dateKey: todayKey,
    site: "all",
    type: "all",
    selectedId: "",
    ...(state.reportArchive || {}),
  };
  state.employeeLogs ||= {};
  if (isRepresentativeProfile()) {
    const representativeIds = new Set(["profile-user"]);
    getStaffDirectoryEmployees()
      .filter(isRepresentativeWorklogEmployee)
      .forEach((employee) => getEmployeeWorklogAliases(employee).forEach((id) => representativeIds.add(id)));
    Object.values(state.employeeLogs).forEach((logsByEmployee) => {
      representativeIds.forEach((employeeId) => delete logsByEmployee?.[employeeId]);
    });
  }
  migrateEmployeeLogIdentityAliases();
  state.employeeLogs[getActiveDateKey()] ||= {};
  getEmployeeOptions().filter((employee) => !isRepresentativeWorklogEmployee(employee)).forEach((employee) => {
    const employeeId = getEmployeeWorklogId(employee);
    state.employeeLogs[getActiveDateKey()][employeeId] ||= createEmployeeLog({ ...employee, id: employeeId }, state.profile, getActiveDateKey());
    const log = state.employeeLogs[getActiveDateKey()][employeeId];
    log.employeeId = employeeId;
    log.org ||= employee.org;
    log.role ||= employee.role;
    log.clockIn ||= "";
    log.clockOut ||= "";
    log.attendanceBreaks = Array.isArray(log.attendanceBreaks) ? log.attendanceBreaks : [];
    log.attendanceStatus ||= "";
    log.attendanceStep ||= log.attendanceStatus === "조퇴" ? "early" : log.clockOut ? "out" : log.clockIn ? "in" : "ready";
    log.tasks ||= createEmployeeLog(employee, state.profile, getActiveDateKey()).tasks;
    log.schedule ||= createEmployeeLog(employee, state.profile, getActiveDateKey()).schedule;
    if (isFitnessEmployeeRecord(employee) && !log.scheduleUnitExplicit) {
      log.scheduleUnit = "60";
    }
    normalizeEmployeeLogRows(log, getActiveDateKey());
    log.report ||= log.record || "";
    log.memo ||= "";
    log.record ||= "";
    log.fitnessOps = { ...createFitnessOps(), ...(log.fitnessOps || {}) };
    log.fitnessOpsManual = { ...createFitnessOpsManual(), ...(log.fitnessOpsManual || {}) };
    syncFitnessOpsFromSchedule(log);
  });
  if (state.entries?.[todayKey]?.length && getActiveDateKey() === todayKey && !state.employeeLogs[todayKey][employees[0].id].schedule.some((item) => getScheduleEntryText(item))) {
    state.employeeLogs[todayKey][employees[0].id].schedule = state.entries[todayKey].map((entry) => ({
      time: entry.time || "",
      text: entry.text || "",
      status: entry.status || "예정",
    }));
  }
  state.attendance ||= {};
  state.attendance[getActiveDateKey()] ||= [];
  state.fitnessScheduleUnitDefaultApplied = true;
}

function normalizeEmployeeLogRows(log, dateKey = getActiveDateKey()) {
  log.tasks ||= [];
  log.schedule ||= [];
  log.workHoursOverride = normalizeWorkHoursText(log.workHoursOverride || "");
  log.manualScheduleSlots = Array.isArray(log.manualScheduleSlots)
    ? Array.from(new Set(log.manualScheduleSlots.map(normalizeScheduleTimeInput).filter(Boolean))).sort((a, b) => timeToMinutes(a) - timeToMinutes(b))
    : [];
  log.tasks.forEach((task, index) => {
    task.id ||= `task-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`;
    const isBlankDefaultTask = !String(task.text || "").trim()
      && !task.done
      && !task.delegate
      && !task.postponeDate
      && !task.scheduledSlot
      && !task.scheduledText;
    if (isBlankDefaultTask) {
      task.priority = "?";
      task.status = "예정";
      task.done = false;
    } else {
      task.priority ||= "?";
      task.status ||= "예정";
    }
    normalizeWorklogTaskState(task);
    task.text ||= "";
    task.delegate ||= "";
    task.postponeDate ||= "";
  });
  while (log.tasks.length < 14) {
    log.tasks.push({ id: `task-${Date.now()}-${log.tasks.length}`, priority: "?", text: "", status: "예정", done: false });
  }
  log.scheduleUnit = log.scheduleUnit === "60" ? "60" : "30";
  const scheduleByTime = new Map(log.schedule.map((item) => [item.time, item]));
  const scheduleTimes = getWorklogScheduleSlots(log, dateKey);
  log.schedule = scheduleTimes.map((time) => {
    const item = scheduleByTime.get(time) || { time, text: "", status: "예정", items: [createScheduleItem()] };
    item.time = time;
    normalizeScheduleEntryItems(item);
    item.status ||= "예정";
    item.mergeDown ||= false;
    return item;
  });
}

function saveState(options = {}) {
  recordActiveCorrectionAudits();
  normalizeProfilePlacementForAuth();
  markOwnedWorklogUpdated();
  localStorage.setItem(storageKey, JSON.stringify(state));
  scheduleRemoteSave(options.fastSave ? 500 : 700);
}

function markOwnedWorklogUpdated(dateKey = getActiveDateKey()) {
  if (!authState.user || isRepresentativeProfile() || !isWorklogEditView()) return;
  const employeeId = getProfileMappedEmployeeId() || "profile-user";
  const log = state.employeeLogs?.[dateKey]?.[employeeId] || state.employeeLogs?.[dateKey]?.["profile-user"];
  if (log && hasSubmittableWorklogContent(log)) log.updatedAt = new Date().toISOString();
}

function normalizeWorklogTaskStatus(status = "예정") {
  const source = String(status || "예정").trim();
  const compact = source.replace(/\s+/g, "");
  if (["진행", "진행중", "처리중"].includes(compact)) return "진행중";
  if (["완료", "취소", "위임", "연기", "미완료", "예정"].includes(compact)) return compact;
  return source || "예정";
}

function normalizeWorklogTaskState(task = {}) {
  const legacyAction = ["취소", "위임", "연기"].includes(task.priority) ? task.priority : "";
  const status = normalizeWorklogTaskStatus(legacyAction && !["취소", "위임", "연기"].includes(task.status) ? legacyAction : task.status);
  if (status === "진행중") {
    task.status = "진행중";
    task.done = false;
  } else if (status === "완료" || task.done === true) {
    task.status = "완료";
    task.done = true;
  } else {
    task.status = status;
    task.done = false;
  }
  if (legacyAction) task.priority = "?";
  return task;
}

function isWorklogTaskCarryoverEligible(task = {}) {
  const status = normalizeWorklogTaskStatus(task.status || "미완료");
  const isInProgress = status === "진행중";
  return Boolean(
    String(task.text || "").trim()
    && (isInProgress || !task.done)
    && !["완료", "취소", "위임", "연기"].includes(status)
  );
}

function hasWorklogCarryoverDateArrived(activeDateKey = getActiveDateKey()) {
  return Boolean(activeDateKey && activeDateKey <= todayKey);
}

function getWorklogTaskRolloverDate(task = {}, sourceDateKey = "") {
  const status = normalizeWorklogTaskStatus(task.status || "미완료");
  const postponeDate = String(task.postponeDate || "").trim();
  if (status === "연기" && postponeDate > sourceDateKey) return postponeDate;
  return sourceDateKey;
}

function isWorklogTaskDueForDate(task = {}, sourceDateKey = "", activeDateKey = getActiveDateKey()) {
  if (!hasWorklogCarryoverDateArrived(activeDateKey)) return false;
  const rolloverDate = getWorklogTaskRolloverDate(task, sourceDateKey);
  if (!rolloverDate || rolloverDate >= activeDateKey) return false;
  const status = normalizeWorklogTaskStatus(task.status || "미완료");
  if (status === "연기") return Boolean(task.postponeDate && task.postponeDate < activeDateKey);
  return isWorklogTaskCarryoverEligible(task);
}

function getSelectedEmployee() {
  return getProfileEmployeeForMappedSlot(state.selectedEmployeeId)
    || findEmployeeRecordById(state.selectedEmployeeId)
    || getProfileEmployee();
}

function getEmployeeOptions() {
  return getStaffDirectoryEmployees();
}

function getEmployeeIdentityKeys(employee = {}) {
  const email = normalizeEmailValue(employee.email || "");
  const id = String(employee.id || "").trim();
  const mappedId = String(employee.mappedEmployeeId || "").trim();
  const person = `person:${employee.org || ""}|${employee.workplace || ""}|${employee.role || ""}|${employee.name || ""}`.toLowerCase();
  return [
    email ? `email:${email}` : "",
    id ? `id:${id}` : "",
    mappedId ? `id:${mappedId}` : "",
    person,
  ].filter(Boolean);
}

function getEmployeeWorklogId(employee = {}) {
  return String(employee.mappedEmployeeId || employee.id || "").trim();
}

function getEmployeeWorklogAliases(employee = {}) {
  const sourceProfileId = String(employee.sourceProfileId || "").trim();
  return [...new Set([
    getEmployeeWorklogId(employee),
    employee.id,
    employee.mappedEmployeeId,
    employee.profileEmployeeId,
    sourceProfileId,
    sourceProfileId ? `profile-${sourceProfileId}` : "",
  ].filter(Boolean).map(String))];
}

function migrateEmployeeLogIdentityAliases() {
  const profileEmployee = getProfileEmployee();
  const directory = [...employees, ...getStaffDirectoryEmployees(), profileEmployee];
  const seen = new Set();
  const identities = directory.filter((employee) => {
    const canonicalId = getEmployeeWorklogId(employee);
    const key = `${canonicalId}|${getEmployeeWorklogAliases(employee).join("|")}`;
    if (!canonicalId || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((employee) => {
    const aliases = getEmployeeWorklogAliases(employee);
    if (employee === profileEmployee && profileEmployee.mappedEmployeeId) aliases.push("profile-user");
    return { canonicalId: getEmployeeWorklogId(employee), aliases: [...new Set(aliases)] };
  });

  Object.values(state.employeeLogs || {}).forEach((logsByEmployee) => {
    identities.forEach(({ canonicalId, aliases }) => {
      const current = logsByEmployee?.[canonicalId];
      const source = aliases.map((id) => logsByEmployee?.[id]).filter(Boolean).find(hasSubmittableWorklogContent);
      if (!source || (current && hasSubmittableWorklogContent(current))) return;
      logsByEmployee[canonicalId] = {
        ...cloneWorklogLogForAudit(source),
        employeeId: canonicalId,
      };
    });
  });
}

function getProfileEmployee() {
  const profile = applyProfilePlacementOverride({ ...defaultProfile, ...(state?.profile || {}) });
  return {
    id: "profile-user",
    name: profile.name || "내 프로필",
    nickname: profile.nickname || "",
    org: profile.org || "(주)방주",
    role: profile.role || "직원",
    primaryWork: profile.primaryWork || "",
    secondaryWork: profile.secondaryWork || "",
    workplace: profile.workplace || "",
    email: profile.email || authState.user?.email || "",
    phone: profile.phone || "",
    employmentType: profile.employmentType || "직원",
    laborId: profile.laborId || "",
    address: profile.address || "",
    hourlyWage: profile.hourlyWage || "",
    dailyWage: profile.dailyWage || "",
    joinDate: profile.joinDate || "",
    payDay: profile.payDay || "",
    workHours: profile.workHours || defaultProfile.workHours,
    mappedEmployeeId: getProfileMappedEmployeeId(profile),
    assignedMission: profile.assignedMission || "",
    assignedMissionVisible: profile.assignedMissionVisible !== false,
    assignedMissionUpdatedAt: profile.assignedMissionUpdatedAt || "",
    assignedMissionUpdatedBy: profile.assignedMissionUpdatedBy || "",
  };
}

function getProfileEmployeeForMappedSlot(employeeId = "") {
  const id = String(employeeId || "").trim();
  if (!id) return null;
  const profileEmployee = getProfileEmployee();
  if (profileEmployee.mappedEmployeeId !== id) return null;
  return {
    ...profileEmployee,
    id,
    profileEmployeeId: "profile-user",
    mappedEmployeeId: id,
  };
}

function getMappedProfileEmployeeId() {
  return getProfileMappedEmployeeId(applyProfilePlacementOverride(state?.profile || {}));
}

function isEmployeeLinkedToProfile(employeeId) {
  if (!employeeId) return false;
  return employeeId === "profile-user" || getMappedProfileEmployeeId() === employeeId;
}

function getEmployeeWorkHours(employeeId = state?.selectedEmployeeId, profile = state?.profile, dateKey = getActiveDateKey()) {
  const override = getEmployeeWorkHoursOverride(employeeId, dateKey);
  if (override) return override;
  const profileHours = getProfileWorkHoursForDate(profile, dateKey);
  if (employeeId === "profile-user" || isEmployeeLinkedToProfile(employeeId)) {
    return profileHours || profile?.workHours || state?.profile?.workHours || defaultProfile.workHours;
  }
  const employee = findEmployeeRecordById(employeeId);
  return employee ? getOverviewScheduledWorkHours(employee, dateKey, {}) : defaultProfile.workHours;
}

function getEmployeeWorkHoursOverride(employeeId = state?.selectedEmployeeId, dateKey = getActiveDateKey()) {
  const id = String(employeeId || "").trim();
  const override = String(state?.employeeLogs?.[dateKey]?.[id]?.workHoursOverride || "").trim();
  return normalizeWorkHoursText(override);
}

function getProfileWorkHoursForDate(profile = state?.profile, dateKey = getActiveDateKey()) {
  const dayKey = getWorkdayKey(dateKey);
  const weeklyHours = profile?.weeklyWorkHours || {};
  return String(weeklyHours[dayKey] || "").trim() || String(profile?.workHours || "").trim();
}

function getWorkdayKey(dateKey = getActiveDateKey()) {
  const date = parseDateKey(dateKey);
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][date.getDay()] || "mon";
}

function getSiteWeatherKeyForEmployee(employee = getSelectedEmployee()) {
  const source = `${employee?.org || ""} ${employee?.workplace || ""} ${employee?.primaryWork || ""} ${employee?.role || ""}`.toLowerCase();
  if (/피트니스|fitness/.test(source)) return "비욘드 피트니스";
  if (/tba|스튜디오|studio/.test(source)) return "(주)비욘드컴퍼니 · TBA studio";
  if (/워크베이스|워크박스|공유/.test(source)) return "(주)비욘드컴퍼니 · 공유사업부";
  if (/동천/.test(source)) return "(주)비제이종합건설 · 동천체육관 현장";
  if (/헤이븐|옥동/.test(source) && /건설|현장|비제이/.test(source)) return "(주)비제이종합건설 · 옥동 더헤이븐빌 신축현장";
  if (/방주|재무/.test(source)) return "(주)방주 · 재무";
  return "기타";
}

function getSiteWeatherAddress(siteKey = "") {
  return String(state.siteWeatherAddresses?.[siteKey] || "").trim();
}

function mergeSiteWeatherAddressesFromSnapshots(rows = []) {
  state.siteWeatherAddresses = { ...(state.siteWeatherAddresses || {}) };
  const knownKeys = new Set(Object.keys(state.siteWeatherAddresses));
  let recovered = 0;
  rows.forEach((row) => {
    const addresses = row?.state?.siteWeatherAddresses || {};
    Object.entries(addresses).forEach(([siteKey, address]) => {
      const value = String(address || "").trim();
      if (!value || knownKeys.has(siteKey)) return;
      state.siteWeatherAddresses[siteKey] = value;
      knownKeys.add(siteKey);
      recovered += 1;
    });
  });
  return recovered;
}

function getWeatherCacheKey(siteKey = "", dateKey = getActiveDateKey()) {
  return `${dateKey}::${siteKey || "기타"}`;
}

function canAutomaticallyRequestWeather(requestKey = "") {
  const failure = weatherRequestFailures.get(requestKey);
  return !failure || Date.now() >= Number(failure.retryAt || 0);
}

function clearWeatherRequestFailure(requestKey = "") {
  weatherRequestFailures.delete(requestKey);
  const timer = weatherRetryTimers.get(requestKey);
  if (timer) window.clearTimeout(timer);
  weatherRetryTimers.delete(requestKey);
}

function markWeatherRequestFailure(requestKey = "", error) {
  const previous = weatherRequestFailures.get(requestKey);
  const attempts = Math.min(6, Number(previous?.attempts || 0) + 1);
  const retryDelay = Math.min(10 * 60 * 1000, weatherRetryBaseMs * (2 ** (attempts - 1)));
  const failure = {
    attempts,
    message: String(error?.message || "날씨 정보를 불러오지 못했습니다."),
    retryAt: Date.now() + retryDelay,
  };
  weatherRequestFailures.set(requestKey, failure);
  const previousTimer = weatherRetryTimers.get(requestKey);
  if (previousTimer) window.clearTimeout(previousTimer);
  weatherRetryTimers.set(requestKey, window.setTimeout(() => {
    weatherRetryTimers.delete(requestKey);
    weatherBatchAttempted.delete(requestKey);
    renderWeatherWidgets();
  }, retryDelay + 50));
  return failure;
}

function getWeatherRecordForSite(siteKey = "", dateKey = getActiveDateKey()) {
  return state.weatherCache?.[getWeatherCacheKey(siteKey, dateKey)] || null;
}

function getWeatherRecordForEmployee(employee = getSelectedEmployee(), dateKey = getActiveDateKey()) {
  const siteKey = getSiteWeatherKeyForEmployee(employee);
  return getWeatherRecordForSite(siteKey, dateKey);
}

function getWeatherConditionLabel(code) {
  const value = Number(code);
  if ([0].includes(value)) return "맑음";
  if ([1, 2].includes(value)) return "구름 조금";
  if ([3].includes(value)) return "흐림";
  if ([45, 48].includes(value)) return "안개";
  if ([51, 53, 55, 56, 57].includes(value)) return "이슬비";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(value)) return "비";
  if ([71, 73, 75, 77, 85, 86].includes(value)) return "눈";
  if ([95, 96, 99].includes(value)) return "뇌우";
  return "날씨";
}

function formatWeatherSummary(record, { compact = false } = {}) {
  if (!record) return compact ? "날씨 미기록" : "사업장 주소 입력 후 날씨를 갱신하세요.";
  const temperatureText = Number.isFinite(Number(record.temperatureMin)) && Number.isFinite(Number(record.temperatureMax))
    ? `${Math.round(Number(record.temperatureMin))}°/${Math.round(Number(record.temperatureMax))}°`
    : Number.isFinite(Number(record.temperature)) ? `${Math.round(Number(record.temperature))}°` : "";
  const parts = [
    record.condition || getWeatherConditionLabel(record.weatherCode),
    temperatureText,
    Number.isFinite(Number(record.humidity)) ? `습도 ${Math.round(Number(record.humidity))}%` : "",
    Number.isFinite(Number(record.precipitation)) && Number(record.precipitation) > 0 ? `강수 ${record.precipitation}mm` : "",
  ].filter(Boolean);
  const body = parts.join(" · ") || "날씨 기록";
  return compact ? body : `${record.siteKey || "사업장"} · ${body}`;
}

function formatWeatherTemperatureRange(record = {}) {
  const temperatureMin = Number(record.temperatureMin);
  const temperatureMax = Number(record.temperatureMax);
  if (Number.isFinite(temperatureMin) && Number.isFinite(temperatureMax)) {
    return `${Math.round(temperatureMin)}°/${Math.round(temperatureMax)}°`;
  }
  const temperature = Number(record.temperature);
  return Number.isFinite(temperature) ? `${Math.round(temperature)}°` : "--°/--°";
}

function isWeatherRecordFresh(record, maxAgeMs = weatherFreshnessMs) {
  if (!record?.fetchedAt) return false;
  const fetchedAt = Date.parse(record.fetchedAt);
  return Number.isFinite(fetchedAt) && Date.now() - fetchedAt < maxAgeMs;
}

function needsWeatherRefresh(record, dateKey = getActiveDateKey()) {
  if (!record) return true;
  return dateKey === todayKey && !isWeatherRecordFresh(record);
}

function buildWeatherAdvice(record = {}) {
  const temperature = Number(record.temperature);
  const wind = Number(record.wind);
  const precipitation = Number(record.precipitation);
  const condition = record.condition || getWeatherConditionLabel(record.weatherCode);
  if (/비|뇌우/.test(condition) || precipitation > 0) return "외부 일정은 이동 시간을 10~15분 더 확보하고 준비물을 먼저 확인하세요.";
  if (/눈/.test(condition)) return "결빙과 지연 가능성을 반영해 외부 업무 사이에 안전 여유를 두세요.";
  if (/안개/.test(condition)) return "오전 이동과 현장 방문은 평소보다 여유 있게 잡으세요.";
  if (Number.isFinite(wind) && wind >= 9) return "강풍 가능성이 있어 외부 업무 전 안전과 이동 여유를 확인하세요.";
  if (Number.isFinite(temperature) && temperature >= 30) return "집중 업무는 이른 시간에 배치하고 수분 보충 시간을 남기세요.";
  if (Number.isFinite(temperature) && temperature <= 0) return "외부 이동 준비 시간을 확보하고 실내 집중 업무를 먼저 배치하세요.";
  return "날씨 리스크가 낮습니다. 중요한 업무를 시간별 일정에 먼저 고정하세요.";
}

function getWeatherAccessibleTitle(record = {}, siteKey = "") {
  if (!record) return `${siteKey || "사업장"} 날씨 미기록`;
  return `${siteKey || record.siteKey || "사업장"} ${formatWeatherSummary(record, { compact: true })}. ${record.advice || buildWeatherAdvice(record)}`;
}

function getActiveWeatherEmployee(scope = activeView) {
  if (scope === "fitness-log") {
    const page = getCurrentFitnessLogPage?.();
    if (page?.type === "employee") return page.employee || getSelectedEmployee();
    return employees.find((item) => item.id === state.fitnessWritableEmployeeId) || getSelectedEmployee();
  }
  return getSelectedEmployee();
}

function renderWeatherWidgets() {
  renderWeatherWidget("worklog", getSelectedEmployee());
  renderWeatherWidget("fitness", getActiveWeatherEmployee("fitness-log"));
  ensureWeatherRecordsForConfiguredSites(getActiveDateKey());
  renderRepresentativeSiteWeatherBoards();
  renderWeatherDateButtons();
  renderHistoricalWeatherBanners();
}

function renderWeatherDateButton(button, employee, dateKey = getActiveDateKey()) {
  if (!button) return;
  const isToday = dateKey === todayKey;
  button.hidden = false;
  button.disabled = isToday;
  button.classList.toggle("is-current-date", isToday);
  button.classList.toggle("is-weather-today", isToday);
  button.setAttribute("aria-disabled", String(isToday));
  if (!isToday) {
    button.textContent = "오늘";
    button.title = "오늘 날짜로 이동";
    button.setAttribute("aria-label", "오늘 날짜로 이동");
    return;
  }
  const siteKey = getSiteWeatherKeyForEmployee(employee);
  const address = getSiteWeatherAddress(siteKey);
  const record = getWeatherRecordForSite(siteKey, dateKey);
  const requestKey = getWeatherCacheKey(siteKey, dateKey);
  const loading = Boolean(address && weatherRequestInFlight.has(requestKey));
  const failed = Boolean(address && !record && weatherRequestFailures.has(requestKey));
  const icon = loading && !record ? "…" : failed ? "↻" : getWeatherConditionIcon(record || {});
  const range = record ? formatWeatherTemperatureRange(record) : loading ? "확인중" : failed ? "재시도" : "--°/--°";
  button.dataset.weatherStatus = record ? "ready" : loading ? "loading" : failed ? "retry" : address ? "pending" : "missing";
  button.innerHTML = `<i aria-hidden="true">${escapeHtml(icon)}</i><small>${escapeHtml(range)}</small>`;
  const failureMessage = weatherRequestFailures.get(requestKey)?.message;
  const title = failureMessage ? `${siteKey} 날씨 조회 지연 · 자동 재시도 중` : address ? getWeatherAccessibleTitle(record, siteKey) : `${siteKey} 주소 입력 필요`;
  button.title = title;
  button.setAttribute("aria-label", title);
}

function renderWeatherDateButtons(dateKey = getActiveDateKey()) {
  renderWeatherDateButton(document.getElementById("todayJumpButton"), getSelectedEmployee(), dateKey);
  renderWeatherDateButton(document.getElementById("fitnessTodayButton"), getActiveWeatherEmployee("fitness-log"), dateKey);
}

function getHistoricalWeatherBannerMarkup(record, siteKey = "") {
  const icon = getWeatherConditionIcon(record || {});
  const summary = record
    ? `${record.condition || getWeatherConditionLabel(record.weatherCode)} · ${formatWeatherTemperatureRange(record)}`
    : "날씨 확인 중";
  const location = record?.location || siteKey || "사업장";
  return `<i aria-hidden="true">${escapeHtml(icon)}</i><b>${escapeHtml(summary)}</b><small>${escapeHtml(location)}</small>`;
}

function renderHistoricalWeatherBanners(dateKey = getActiveDateKey()) {
  if (dateKey >= todayKey) return;
  const worklogEmployee = getSelectedEmployee();
  const worklogSiteKey = getSiteWeatherKeyForEmployee(worklogEmployee);
  const worklogRecord = getWeatherRecordForSite(worklogSiteKey, dateKey);
  const pulse = document.getElementById("worklogPulse");
  const pulseText = document.getElementById("worklogPulseText");
  if (pulse && pulseText) {
    pulse.classList.add("is-historical-weather");
    pulse.disabled = true;
    pulseText.innerHTML = getHistoricalWeatherBannerMarkup(worklogRecord, worklogSiteKey);
    pulse.setAttribute("aria-label", getWeatherAccessibleTitle(worklogRecord, worklogSiteKey));
  }

  const fitnessEmployee = getActiveWeatherEmployee("fitness-log");
  const fitnessSiteKey = getSiteWeatherKeyForEmployee(fitnessEmployee);
  const fitnessRecord = getWeatherRecordForSite(fitnessSiteKey, dateKey);
  const ticker = document.getElementById("fitnessCoachingTicker");
  const tickerLabel = ticker?.querySelector("b");
  const tickerText = document.getElementById("fitnessCoachingTickerText");
  if (ticker && tickerLabel && tickerText) {
    ticker.classList.add("is-historical-weather");
    ticker.disabled = true;
    tickerLabel.textContent = "기록 날씨";
    tickerText.innerHTML = getHistoricalWeatherBannerMarkup(fitnessRecord, fitnessSiteKey);
    tickerText.dataset.tickerText = "";
    ticker.setAttribute("aria-label", getWeatherAccessibleTitle(fitnessRecord, fitnessSiteKey));
  }
}

function getWeatherConditionIcon(record = {}) {
  const code = Number(record.weatherCode);
  if ([0].includes(code)) return "☀️";
  if ([1, 2].includes(code)) return "⛅";
  if ([3].includes(code)) return "☁️";
  if ([45, 48].includes(code)) return "🌫️";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "🌧️";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "❄️";
  if ([95, 96, 99].includes(code)) return "⛈️";
  const condition = String(record.condition || "");
  if (/맑/.test(condition)) return "☀️";
  if (/구름|대체로 맑/.test(condition)) return "⛅";
  if (/흐림|흐린/.test(condition)) return "☁️";
  if (/안개/.test(condition)) return "🌫️";
  if (/비|이슬비|소나기/.test(condition)) return "🌧️";
  if (/눈/.test(condition)) return "❄️";
  if (/뇌우|번개/.test(condition)) return "⛈️";
  return condition ? "◇" : "–";
}

function getSiteWeatherBoardRows(dateKey = getActiveDateKey()) {
  return siteWeatherAddressTargets.map((target) => {
    const address = getSiteWeatherAddress(target.key);
    const record = getWeatherRecordForSite(target.key, dateKey);
    const requestKey = getWeatherCacheKey(target.key, dateKey);
    return {
      ...target,
      address,
      record,
      loading: Boolean(address && weatherRequestInFlight.has(requestKey)),
      failure: weatherRequestFailures.get(requestKey) || null,
    };
  });
}

function renderSiteWeatherBoard(boardId, dateKey = getActiveDateKey()) {
  const board = document.getElementById(boardId);
  if (!board) return;
  const allowed = canAccessWorklogOverview() || canAccessControlTower() || isRepresentativeProfile();
  board.hidden = !allowed;
  if (!allowed) return;
  const rows = getSiteWeatherBoardRows(dateKey);
  const recordedCount = rows.filter((row) => row.record).length;
  const configuredCount = rows.filter((row) => row.address).length;
  const isOverviewBoard = boardId === "overviewSiteWeatherBoard";
  const visibleRows = isOverviewBoard ? rows.filter((row) => row.address || row.record) : rows;
  board.classList.toggle("is-compact-overview", isOverviewBoard);
  if (isOverviewBoard && !visibleRows.length) {
    board.hidden = true;
    board.innerHTML = "";
    return;
  }
  board.innerHTML = `
    <header>
      <div>
        <span>Site Weather · ${escapeHtml(formatShortDate(dateKey))}</span>
        <h3>사업장별 날씨</h3>
        <p>앱설정의 사업장 주소에서 자동 기록합니다.</p>
      </div>
      <div>
        <em>${recordedCount}/${configuredCount || 0} 기록</em>
        <button type="button" data-site-weather-refresh-all ${configuredCount ? "" : "disabled"}>전체 새로고침</button>
      </div>
    </header>
    <div class="site-weather-board-grid">
      ${visibleRows.map((row) => `
        <article class="${row.record ? "has-weather" : row.failure ? "is-error" : row.address ? "is-pending" : "is-missing"}" title="${escapeAttr(row.failure ? `${row.key} 날씨 조회 지연 · 자동 재시도 중` : getWeatherAccessibleTitle(row.record, row.key))}">
          <div>
            <span>${escapeHtml(row.label)}</span>
            <i aria-hidden="true">${escapeHtml(getWeatherConditionIcon(row.record || {}))}</i>
          </div>
          <strong>${escapeHtml(row.loading ? "날씨 확인 중" : row.failure && !row.record ? "잠시 후 자동 재시도" : formatWeatherSummary(row.record, { compact: true }))}</strong>
          <p title="${escapeAttr(row.address || "주소 미입력")}">${escapeHtml(row.record ? (row.record.advice || buildWeatherAdvice(row.record)) : row.address || "앱설정에서 주소를 입력해주세요.")}</p>
          <button type="button" data-site-weather-refresh="${escapeAttr(row.key)}" ${row.address && !row.loading ? "" : "disabled"}>${row.record ? "새로고침" : row.address ? "불러오기" : "주소 필요"}</button>
        </article>
      `).join("")}
    </div>
  `;
  board.querySelector("[data-site-weather-refresh-all]")?.addEventListener("click", () => {
    rows.filter((row) => row.address).forEach((row) => {
      const requestKey = getWeatherCacheKey(row.key, dateKey);
      weatherBatchAttempted.delete(requestKey);
      clearWeatherRequestFailure(requestKey);
      requestWeatherForSite(row.key, row.address, dateKey, { silent: true, scope: "" });
    });
    renderRepresentativeSiteWeatherBoards();
  });
  board.querySelectorAll("[data-site-weather-refresh]").forEach((button) => {
    button.addEventListener("click", () => {
      const siteKey = button.dataset.siteWeatherRefresh || "";
      const address = getSiteWeatherAddress(siteKey);
      const requestKey = getWeatherCacheKey(siteKey, dateKey);
      weatherBatchAttempted.delete(requestKey);
      clearWeatherRequestFailure(requestKey);
      requestWeatherForSite(siteKey, address, dateKey, { silent: false, scope: "" });
      renderRepresentativeSiteWeatherBoards();
    });
  });
}

function renderRepresentativeSiteWeatherBoards(dateKey = getActiveDateKey()) {
  renderSiteWeatherBoard("overviewSiteWeatherBoard", dateKey);
  renderSiteWeatherBoard("controlSiteWeatherBoard", dateKey);
}

function renderWeatherWidget(scope, employee) {
  const prefix = scope === "fitness" ? "fitness" : "worklog";
  const row = document.getElementById(`${prefix}WeatherRow`);
  const text = document.getElementById(`${prefix}WeatherText`);
  const button = document.getElementById(`${prefix}WeatherRefreshButton`);
  if (!row || !text || !button) return;
  const siteKey = getSiteWeatherKeyForEmployee(employee);
  const address = getSiteWeatherAddress(siteKey);
  const dateKey = getActiveDateKey();
  const record = getWeatherRecordForSite(siteKey, dateKey);
  const requestKey = getWeatherCacheKey(siteKey, dateKey);
  const loading = address && weatherRequestInFlight.has(requestKey);
  const failure = weatherRequestFailures.get(requestKey);
  row.dataset.siteKey = siteKey;
  row.dataset.hasAddress = address ? "true" : "false";
  row.classList.toggle("is-missing", !address);
  row.classList.toggle("is-loading", loading);
  const title = failure && !record ? `${siteKey} 날씨 조회 지연 · 자동 재시도 중` : address ? getWeatherAccessibleTitle(record, siteKey) : `${siteKey} 주소 입력 필요`;
  text.innerHTML = address
    ? `<i aria-hidden="true">${escapeHtml(loading ? "…" : failure && !record ? "↻" : getWeatherConditionIcon(record || {}))}</i><b>${escapeHtml(loading && !record ? "날씨 확인 중" : failure && !record ? "잠시 후 자동 재시도" : formatWeatherSummary(record, { compact: true }))}</b><small>${escapeHtml(siteKey)}</small>`
    : `<i aria-hidden="true">–</i><b>주소 필요</b><small>${escapeHtml(siteKey)}</small>`;
  row.title = title;
  row.setAttribute("aria-label", title);
  button.disabled = !address;
  button.textContent = "↻";
  button.title = record ? "날씨 새로고침" : "날씨 불러오기";
  button.setAttribute("aria-label", button.title);
  if (address && needsWeatherRefresh(record, dateKey) && !loading && canAutomaticallyRequestWeather(requestKey)) {
    weatherBatchAttempted.add(requestKey);
    requestWeatherForSite(siteKey, address, getActiveDateKey(), { silent: true, scope });
  }
}

function getConfiguredWeatherSites() {
  return siteWeatherAddressTargets
    .map(({ key }) => ({ siteKey: key, address: getSiteWeatherAddress(key) }))
    .filter(({ address }) => address);
}

function ensureWeatherRecordsForConfiguredSites(dateKey = getActiveDateKey()) {
  getConfiguredWeatherSites().forEach(({ siteKey, address }) => {
    const requestKey = getWeatherCacheKey(siteKey, dateKey);
    if (!needsWeatherRefresh(getWeatherRecordForSite(siteKey, dateKey), dateKey) || weatherRequestInFlight.has(requestKey) || weatherBatchAttempted.has(requestKey) || !canAutomaticallyRequestWeather(requestKey)) return;
    weatherBatchAttempted.add(requestKey);
    requestWeatherForSite(siteKey, address, dateKey, { silent: true, scope: "" });
  });
}

function buildWeatherRequestUrl(place, dateKey = getActiveDateKey()) {
  const latitude = encodeURIComponent(place.latitude);
  const longitude = encodeURIComponent(place.longitude);
  if (dateKey === todayKey) {
    return `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=Asia%2FSeoul`;
  }
  const baseUrl = dateKey < todayKey
    ? "https://archive-api.open-meteo.com/v1/archive"
    : "https://api.open-meteo.com/v1/forecast";
  return `${baseUrl}?latitude=${latitude}&longitude=${longitude}&start_date=${encodeURIComponent(dateKey)}&end_date=${encodeURIComponent(dateKey)}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&timezone=Asia%2FSeoul`;
}

async function fetchWeatherJson(url, timeoutMs = 6500) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`날씨 서비스 응답 오류 (${response.status})`);
    return await response.json();
  } finally {
    window.clearTimeout(timeout);
  }
}

async function requestWeatherForSite(siteKey, address, dateKey = getActiveDateKey(), { silent = false, scope = "worklog" } = {}) {
  const trimmedAddress = String(address || "").trim();
  if (!trimmedAddress) {
    if (!silent) alert("앱설정에서 사업장/현장 주소를 먼저 입력해주세요.");
    return null;
  }
  const requestKey = getWeatherCacheKey(siteKey, dateKey);
  if (weatherRequestInFlight.has(requestKey)) return state.weatherCache?.[requestKey] || null;
  weatherRequestInFlight.add(requestKey);
  try {
    let place = state.weatherLocationCache?.[siteKey]?.address === trimmedAddress
      ? state.weatherLocationCache[siteKey]
      : null;
    if (!place) {
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmedAddress)}&count=1&language=ko&format=json`;
      let geo = {};
      try {
        geo = await fetchWeatherJson(geoUrl);
      } catch (_error) {
        geo = {};
      }
      place = geo?.results?.[0]
      ? {
          latitude: geo.results[0].latitude,
          longitude: geo.results[0].longitude,
          name: geo.results[0].name,
          admin1: geo.results[0].admin1,
        }
      : null;
      if (!place) {
        const fallbackGeoUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=ko&q=${encodeURIComponent(trimmedAddress)}`;
        let fallbackGeo = [];
        try {
          fallbackGeo = await fetchWeatherJson(fallbackGeoUrl);
        } catch (_error) {
          fallbackGeo = [];
        }
        const fallbackPlace = Array.isArray(fallbackGeo) ? fallbackGeo[0] : null;
        if (fallbackPlace) {
          place = {
            latitude: Number(fallbackPlace.lat),
            longitude: Number(fallbackPlace.lon),
            name: String(fallbackPlace.display_name || "").split(",")[0],
            admin1: String(fallbackPlace.display_name || "").split(",").slice(1, 3).join(" ").trim(),
          };
        }
      }
      if (place) {
        state.weatherLocationCache = {
          ...(state.weatherLocationCache || {}),
          [siteKey]: { ...place, address: trimmedAddress },
        };
      }
    }
    if (!place) throw new Error("주소 좌표를 찾지 못했습니다.");
    const weatherUrl = buildWeatherRequestUrl(place, dateKey);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    let weatherResponse;
    try {
      weatherResponse = await fetch(weatherUrl, { signal: controller.signal });
    } finally {
      window.clearTimeout(timeout);
    }
    if (!weatherResponse.ok) throw new Error("날씨 정보를 불러오지 못했습니다.");
    const weather = await weatherResponse.json();
    if (getSiteWeatherAddress(siteKey) !== trimmedAddress) {
      weatherBatchAttempted.delete(requestKey);
      window.setTimeout(() => renderWeatherWidgets(), 0);
      return null;
    }
    const current = weather?.current || {};
    const daily = weather?.daily || {};
    const weatherCode = current.weather_code ?? daily.weather_code?.[0];
    const temperatureMax = daily.temperature_2m_max?.[0];
    const temperatureMin = daily.temperature_2m_min?.[0];
    const temperature = current.temperature_2m ?? (
      Number.isFinite(Number(temperatureMax)) && Number.isFinite(Number(temperatureMin))
        ? (Number(temperatureMax) + Number(temperatureMin)) / 2
        : temperatureMax ?? temperatureMin
    );
    const record = {
      siteKey,
      address: trimmedAddress,
      location: [place.name, place.admin1].filter(Boolean).join(" "),
      dateKey,
      fetchedAt: new Date().toISOString(),
      temperature,
      temperatureMax,
      temperatureMin,
      humidity: current.relative_humidity_2m,
      precipitation: current.precipitation ?? daily.precipitation_sum?.[0],
      wind: current.wind_speed_10m ?? daily.wind_speed_10m_max?.[0],
      weatherCode,
      condition: getWeatherConditionLabel(weatherCode),
    };
    record.advice = buildWeatherAdvice(record);
    state.weatherCache = { ...(state.weatherCache || {}), [requestKey]: record };
    clearWeatherRequestFailure(requestKey);
    weatherBatchAttempted.delete(requestKey);
    saveState({ fastSave: true });
    renderWeatherWidgets();
    if (document.getElementById("fitnessReportSheet")?.classList.contains("is-open")) {
      document.getElementById("fitnessReportPreview").innerHTML = renderFitnessReportTemplate(buildFitnessReportModel());
      fitFitnessReportPreview();
    }
    if (document.getElementById("worklogReportSheet")?.classList.contains("is-open")) renderOpenWorklogReport();
    return record;
  } catch (error) {
    weatherBatchAttempted.delete(requestKey);
    markWeatherRequestFailure(requestKey, error);
    if (!silent) alert(error.message || "날씨 정보를 불러오지 못했습니다.");
    return null;
  } finally {
    weatherRequestInFlight.delete(requestKey);
    renderWeatherWidgets();
  }
}

function refreshWeatherForScope(scope = activeView) {
  const employee = getActiveWeatherEmployee(scope);
  const siteKey = getSiteWeatherKeyForEmployee(employee);
  const requestKey = getWeatherCacheKey(siteKey, getActiveDateKey());
  weatherBatchAttempted.delete(requestKey);
  clearWeatherRequestFailure(requestKey);
  return requestWeatherForSite(siteKey, getSiteWeatherAddress(siteKey), getActiveDateKey(), { scope });
}

function getFitnessEmployees() {
  const profile = state.profile || {};
  const merged = new Map();
  const add = (employee, priority = 0) => {
    if (!isVisibleFitnessRosterEmployee(employee)) return;
    const normalized = normalizeFitnessEmployeeForWorklog(employee);
    const emailKey = normalizeEmailValue(normalized.email || "");
    if (isRetiredFitnessManagerIdentity(normalized)) return;
    const rosterSlot = getFitnessRosterSlotId(normalized);
    const key = getFitnessEmployeeRosterMergeKey(normalized, emailKey, rosterSlot);
    const current = merged.get(key);
    if (!current || current.priority <= priority) merged.set(key, { employee: normalized, priority });
  };

  fitnessEmployeeIds
    .map((id) => employees.find((employee) => employee.id === id))
    .forEach((employee) => add(employee, 10));

  getStaffDirectoryEmployees()
    .filter(isFitnessEmployeeRecord)
    .forEach((employee) => add(employee, 30));

  const profileEmployee = getProfileEmployee();
  const profileSource = `${profile.org || ""} ${profile.workplace || ""} ${profile.primaryWork || ""} ${profile.role || ""}`.toLowerCase();
  if (!isRepresentativeProfile() && /피트니스|fitness/.test(profileSource)) add(profileEmployee, 40);

  collectFitnessLogEmployees().forEach((employee) => add(employee, 20));

  return [...merged.values()]
    .map((entry) => entry.employee)
    .sort((a, b) => getFitnessEmployeeSortKey(a).localeCompare(getFitnessEmployeeSortKey(b), "ko"));
}

function getFitnessEmployeeRosterMergeKey(employee = {}, emailKey = "", rosterSlot = "") {
  if (isFitnessManagerRosterIdentity(employee) || getFitnessCenterComparableName(employee) === "박주홍") {
    return "slot:beyond-fitness-manager";
  }
  if (rosterSlot) return `slot:${rosterSlot}`;
  if (emailKey) return `email:${emailKey}`;
  if (employee.id) return `id:${employee.id}`;
  return `${employee.role || ""}:${employee.name || ""}`;
}

function getFitnessCenterEmployees() {
  const bestByPerson = new Map();
  getFitnessEmployees()
    .filter(isConfirmedFitnessCenterEmployee)
    .forEach((employee) => {
      const key = getFitnessCenterEmployeeKey(employee);
      const current = bestByPerson.get(key);
      if (!current || getFitnessCenterEmployeeScore(current) <= getFitnessCenterEmployeeScore(employee)) {
        bestByPerson.set(key, employee);
      }
    });

  return [...bestByPerson.values()]
    .sort((a, b) => getFitnessEmployeeSortKey(a).localeCompare(getFitnessEmployeeSortKey(b), "ko"));
}

function isConfirmedFitnessCenterEmployee(employee = {}) {
  if (!isVisibleFitnessRosterEmployee(employee)) return false;
  if (isClearlyNonFitnessEmployeeRecord(employee)) return false;

  const slotId = getFitnessRosterSlotId(employee);
  const email = normalizeEmailValue(employee.email || "");
  const name = String(employee.name || employee.nickname || "").trim();
  const role = String(employee.role || "").trim();
  const personName = getFitnessCenterComparableName(employee);
  const hasAssignedIdentity = isAssignedFitnessRosterIdentity(employee);

  if (!hasAssignedIdentity && !isUsableRosterEmail(email)) return false;
  if (isRetiredFitnessManagerEmail(email)) return false;
  if (isRetiredFitnessManagerIdentity(employee)) return false;
  if (personName === "박주홍" && email && !isActiveFitnessManagerEmail(email)) return false;
  if (!hasAssignedIdentity && !hasRealFitnessCenterIdentity(employee)) return false;

  const sourceRecord = getFitnessEmployeeDirectorySource(employee);
  if (sourceRecord && isClearlyNonFitnessEmployeeRecord(sourceRecord)) return false;

  const hasEvidence = hasFitnessRosterEvidence(employee);
  const isStaticPlaceholder = Boolean(slotId && fitnessPlaceholderEmployeeIds.has(slotId) && !hasEvidence);
  const genericLabel = normalizeFitnessRosterGenericLabel(name, role);

  if (!name || /이름\s*미입력|미배정|unassigned/i.test(name)) return false;
  if (isStaticPlaceholder) return false;
  if (genericLabel && !hasEvidence) return false;

  const source = `${employee.id || ""} ${employee.mappedEmployeeId || ""} ${employee.org || ""} ${employee.workplace || ""} ${employee.primaryWork || ""} ${employee.secondaryWork || ""} ${role}`.toLowerCase();
  return /피트니스|fitness/.test(source) || Boolean(slotId);
}

function isUsableRosterEmail(value = "") {
  const email = normalizeEmailValue(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isAssignedFitnessRosterIdentity(employee = {}) {
  const slotId = getFitnessRosterSlotId(employee);
  if (!slotId || fitnessPlaceholderEmployeeIds.has(slotId)) return false;
  const role = String(employee.role || "").trim();
  const displayName = getFitnessCenterComparableName(employee) || String(employee.name || employee.nickname || "").trim();
  if (!displayName || /이름\s*미입력|미배정|unassigned/i.test(displayName)) return false;
  if (normalizeFitnessRosterGenericLabel(displayName, role)) return false;
  return true;
}

function hasRealFitnessCenterIdentity(employee = {}) {
  const email = normalizeEmailValue(employee.email || "");
  const role = String(employee.role || "").trim();
  const displayName = getFitnessCenterComparableName(employee) || String(employee.name || employee.nickname || "").trim();
  if (!isUsableRosterEmail(email) && !isAssignedFitnessRosterIdentity(employee)) return false;
  if (!displayName || /이름\s*미입력|미배정|unassigned/i.test(displayName)) return false;
  if (normalizeFitnessRosterGenericLabel(displayName, role)) return false;
  if (isRetiredFitnessManagerIdentity(employee)) return false;
  if (displayName === "박주홍" && email && !isActiveFitnessManagerEmail(email)) return false;
  return true;
}

function getFitnessEmployeeDirectorySource(employee = {}) {
  const email = normalizeEmailValue(employee.email || "");
  const ids = new Set([employee.id, employee.mappedEmployeeId, employee.profileEmployeeId, employee.sourceProfileId].filter(Boolean).map(String));
  return getStaffDirectoryEmployees().find((item) => {
    const itemEmail = normalizeEmailValue(item.email || "");
    if (email && itemEmail === email) return true;
    return [item.id, item.mappedEmployeeId, item.profileEmployeeId, item.sourceProfileId].filter(Boolean).some((id) => ids.has(String(id)));
  }) || null;
}

function hasFitnessRosterEvidence(employee = {}) {
  return Boolean(
    normalizeEmailValue(employee.email || "")
    || employee.isRemoteProfile
    || employee.profileEmployeeId
    || employee.sourceProfileId
    || hasFitnessEmployeeAnyLog(employee)
  );
}

function hasFitnessEmployeeAnyLog(employee = {}) {
  const ids = new Set([employee.id, employee.mappedEmployeeId, employee.profileEmployeeId, getFitnessRosterSlotId(employee)].filter(Boolean).map(String));
  if (!ids.size) return false;
  return Object.values(state.employeeLogs || {}).some((logsByEmployee) => (
    [...ids].some((id) => hasFitnessEmployeeLogContent(logsByEmployee?.[id]))
  ));
}

function normalizeFitnessRosterGenericLabel(name = "", role = "") {
  const text = String(name || "").replace(/\s+/g, "").trim();
  const roleText = String(role || "").replace(/\s+/g, "").trim();
  if (!text) return false;
  if (text === roleText) return true;
  return /^(직원|센터장|트레이너|인포|인포데스크|주중인포|토요인포|일요인포|프리랜서|피트니스예비)$/.test(text);
}

function getFitnessCenterEmployeeKey(employee = {}) {
  if (isFitnessManagerRosterIdentity(employee)) return "person:센터장|박주홍";
  const email = normalizeEmailValue(employee.email || "");
  if (email) return `email:${email}`;
  const name = getFitnessCenterComparableName(employee);
  const role = getFitnessCenterComparableRole(employee.role || "");
  if (name) return `person:${role}|${name}`;
  return `id:${employee.id || employee.mappedEmployeeId || ""}`;
}

function getFitnessCenterEmployeeScore(employee = {}) {
  let score = 0;
  const email = normalizeEmailValue(employee.email || "");
  if (email) score += 100;
  if (isActiveFitnessManagerEmail(email)) score += 250;
  if (employee.isRemoteProfile || employee.sourceProfileId || employee.profileEmployeeId) score += 50;
  if (hasFitnessEmployeeAnyLog(employee)) score += 30;
  if (fitnessEmployeeIds.includes(employee.id)) score += 5;
  return score;
}

function isFitnessManagerRosterIdentity(employee = {}) {
  const email = normalizeEmailValue(employee.email || "");
  if (isActiveFitnessManagerEmail(email) || isRetiredFitnessManagerEmail(email)) return true;
  if (employee.id === "beyond-fitness-manager" || employee.mappedEmployeeId === "beyond-fitness-manager") return true;
  const personName = getFitnessCenterComparableName(employee);
  const source = `${employee.role || ""} ${employee.nickname || ""} ${employee.primaryWork || ""} ${employee.workplace || ""} ${employee.org || ""}`.toLowerCase();
  return personName === "박주홍" && /센터장|운영총괄|manager|피트니스|fitness/.test(source);
}

function getFitnessCenterComparableRole(role = "") {
  return String(role || "")
    .replace(/\s+/g, "")
    .replace(/인포데스크|주중인포|토요인포|일요인포/g, "인포")
    .replace(/프리랜서트레이너/g, "트레이너")
    .trim();
}

function getFitnessCenterComparableName(employee = {}) {
  const role = String(employee.role || "").trim();
  const roleCompact = getFitnessCenterComparableRole(role);
  const raw = String(employee.name || employee.nickname || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!raw) return "";

  const rolePattern = role ? new RegExp(`^${escapeRegExp(role)}\\s*`) : null;
  const compactRolePattern = roleCompact ? new RegExp(`^${escapeRegExp(roleCompact)}\\s*`) : null;
  const cleaned = raw
    .replace(rolePattern || /^$/, "")
    .replace(compactRolePattern || /^$/, "")
    .replace(/^[a-z0-9._%+-]+@?[a-z0-9.-]*\s*/i, "")
    .trim();
  const koreanNames = cleaned.match(/[가-힣]{2,5}/g) || [];
  const personName = koreanNames.find((item) => !normalizeFitnessRosterGenericLabel(item, role));
  if (personName) return personName;
  return cleaned.replace(/\s+/g, "");
}

function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isFitnessEmployeeRecord(employee = {}) {
  const source = `${employee.id || ""} ${employee.org || ""} ${employee.workplace || ""} ${employee.primaryWork || ""} ${employee.secondaryWork || ""} ${employee.role || ""}`.toLowerCase();
  return fitnessEmployeeIds.includes(employee.id)
    || fitnessEmployeeIds.includes(employee.mappedEmployeeId)
    || /피트니스|fitness/.test(source);
}

function isClearlyNonFitnessEmployeeRecord(employee = {}) {
  const source = `${employee.id || ""} ${employee.org || ""} ${employee.workplace || ""} ${employee.primaryWork || ""} ${employee.secondaryWork || ""} ${employee.role || ""}`.toLowerCase();
  return /재무|공유사업부|공유오피스|공유창고|워크베이스|워크박스|tba|studio|비제이|종합건설|건설/.test(source)
    && !/피트니스|fitness/.test(source);
}

function getFitnessRosterSlotId(employee = {}) {
  const mappedId = String(employee.mappedEmployeeId || "").trim();
  const id = String(employee.id || "").trim();
  if (fitnessEmployeeIds.includes(mappedId)) return mappedId;
  if (fitnessEmployeeIds.includes(id)) return id;
  return "";
}

function isVisibleFitnessRosterEmployee(employee = {}) {
  if (!isAssignedWorklogEmployee(employee) || !isFitnessEmployeeRecord(employee)) return false;
  if (!getFitnessRosterSlotId(employee) && isClearlyNonFitnessEmployeeRecord(employee)) return false;
  const id = String(employee.id || "").trim();
  const slotId = getFitnessRosterSlotId(employee);
  const email = normalizeEmailValue(employee.email || "");
  const name = String(employee.name || employee.nickname || "").trim();
  const source = `${id} ${slotId} ${name} ${employee.role || ""} ${employee.org || ""} ${employee.workplace || ""}`.toLowerCase();
  if (isRetiredFitnessManagerIdentity(employee)) return false;
  if (!name || /이름\s*미입력|미배정|unassigned/.test(source)) return false;
  if (/예비|spare/.test(source)) return false;
  if (!email && !slotId && normalizeFitnessRosterGenericLabel(name, employee.role || "")) return false;
  const isStaticSeed = Boolean(id && employees.some((item) => item.id === id));
  const isUnclaimedPlaceholder = isStaticSeed && fitnessPlaceholderEmployeeIds.has(slotId || id) && !email && !employee.isRemoteProfile;
  return !isUnclaimedPlaceholder;
}

function normalizeFitnessEmployeeForWorklog(employee = {}) {
  if (!employee) return employee;
  const mappedId = fitnessEmployeeIds.includes(employee.mappedEmployeeId) ? employee.mappedEmployeeId : "";
  const directId = fitnessEmployeeIds.includes(employee.id) ? employee.id : "";
  const canonicalId = mappedId || directId;
  if (!canonicalId) {
    return {
      ...employee,
      workplace: employee.workplace || "비욘드 피트니스",
      workHours: employee.workHours || defaultProfile.workHours,
    };
  }
  const base = employees.find((item) => item.id === canonicalId) || {};
  const sourceId = String(employee.id || "").trim();
  const email = normalizeEmailValue(employee.email || "");
  const shouldKeepSourceId = Boolean(
    email
    && sourceId
    && sourceId !== "profile-user"
    && sourceId !== canonicalId
    && !fitnessEmployeeIds.includes(sourceId)
  );
  return {
    ...base,
    ...employee,
    id: shouldKeepSourceId ? sourceId : canonicalId,
    profileEmployeeId: shouldKeepSourceId
      ? sourceId
      : employee.id && employee.id !== canonicalId
        ? employee.id
        : employee.profileEmployeeId || "",
    mappedEmployeeId: employee.mappedEmployeeId || canonicalId,
    name: employee.name || base.name,
    nickname: employee.nickname || base.nickname || "",
    org: employee.org || base.org,
    role: employee.role || base.role,
    primaryWork: employee.primaryWork || base.primaryWork || "",
    workplace: employee.workplace || base.workplace || "비욘드 피트니스",
    workHours: employee.workHours || base.workHours || defaultProfile.workHours,
  };
}

function collectFitnessLogEmployees() {
  const seen = new Map();
  Object.values(state.employeeLogs || {}).forEach((logsByEmployee) => {
    Object.entries(logsByEmployee || {}).forEach(([employeeId, log]) => {
      const base = employees.find((item) => item.id === employeeId) || {};
      const sourceEmployee = {
        ...base,
        id: employeeId,
        org: log?.org || base.org || "",
        role: log?.role || base.role || "",
        name: log?.employeeName || base.name || "",
        workplace: log?.workplace || base.workplace || "",
        primaryWork: log?.primaryWork || base.primaryWork || "",
        workHours: base.workHours || defaultProfile.workHours,
      };
      if (!isVisibleFitnessRosterEmployee(sourceEmployee)) return;
      const employee = normalizeFitnessEmployeeForWorklog(sourceEmployee);
      const key = normalizeEmailValue(employee.email || "") || employee.id;
      seen.set(key, employee);
    });
  });
  return [...seen.values()];
}

function getFitnessEmployeeSortKey(employee = {}) {
  const directOrder = fitnessEmployeeIds.indexOf(employee.id);
  const mappedOrder = fitnessEmployeeIds.indexOf(employee.mappedEmployeeId);
  const order = directOrder >= 0 ? directOrder : mappedOrder;
  const slot = order >= 0 ? String(order).padStart(2, "0") : "99";
  return `${slot}|${employee.role || ""}|${employee.name || ""}|${employee.email || ""}`;
}

function getEmployeeAdminLabel(employee = getSelectedEmployee()) {
  if (String(employee.role || "").trim() && String(employee.role || "").trim() === String(employee.name || "").trim()) {
    return String(employee.role || "직원").trim();
  }
  return `${employee.role || "직원"} ${employee.name || ""}`.trim();
}

function getWorklogCompanyLabel(employee = getSelectedEmployee()) {
  const source = `${employee?.org || ""} ${employee?.workplace || ""} ${state.profile?.org || ""} ${state.profile?.workplace || ""}`;
  if (/비욘드\s*피트니스|피트니스|fitness/i.test(source)) return "비욘드 피트니스";
  if (/비제이|종합건설|건설|bj/i.test(source)) return "(주)비제이종합건설";
  if (/비욘드\s*컴퍼니|beyond\s*company/i.test(source)) return "(주)비욘드컴퍼니";
  if (/방주|bangju/i.test(source)) return "(주)방주";
  return employee?.org || state.profile?.org || "(주)방주";
}

function getWorklogPersonLabel(employee = getSelectedEmployee()) {
  const isProfile = employee?.id === "profile-user" || isEmployeeLinkedToProfile(employee?.id);
  const nickname = String(isProfile ? (state.profile?.nickname || employee?.nickname || "") : (employee?.nickname || "")).trim();
  const name = String(isProfile ? (state.profile?.name || employee?.name || "") : (employee?.name || "")).trim();
  const role = String(isProfile ? (state.profile?.role || employee?.role || "") : (employee?.role || "")).trim();
  const person = nickname || name || "직원";
  if (!role || role === person || role === name) return person;
  return `${person} · ${role}`;
}

function getWorklogIdentityText(employee = getSelectedEmployee()) {
  return `${getWorklogCompanyLabel(employee)} · ${getWorklogPersonLabel(employee)}`;
}

function getDailyGreetingSeed(dateKey = getActiveDateKey(), employee = getSelectedEmployee()) {
  const source = `${dateKey}|${employee?.id || ""}|${employee?.org || ""}|${employee?.role || ""}|${state.profile?.email || ""}`;
  return Array.from(source).reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function pickDailyGreeting(items = [], dateKey = getActiveDateKey(), employee = getSelectedEmployee()) {
  if (!items.length) return "";
  return items[getDailyGreetingSeed(dateKey, employee) % items.length];
}

function getPersonalizedWelcomeMessage(employee = getSelectedEmployee(), log = getEmployeeLogForDate(employee?.id || state.selectedEmployeeId)) {
  const person = getEmployeeOwnLabel(employee);
  const role = String(employee?.role || state.profile?.role || "직원").trim();
  const company = getWorklogCompanyLabel(employee);
  const work = String(employee?.primaryWork || state.profile?.primaryWork || "").trim();
  const mission = getAssignedMissionForEmployee(employee);
  const missionText = mission?.visible && mission.text ? mission.text : "";
  const tasks = getWorklogTaskRefs(log || createEmployeeLog(employee)).map((ref) => ref.task).filter(isActiveTask);
  const pending = tasks.filter((task) => !task.done && !["완료", "취소"].includes(task.status)).length;
  const nextEntry = getNextScheduleEntry(log || createEmployeeLog(employee));
  const base = [
    `${person}님, 오늘도 ${company}의 흐름을 만드는 중요한 하루입니다.`,
    `${person}님, ${role}의 기준이 오늘 현장의 신뢰를 만듭니다.`,
    `${person}님, 작은 기록 하나가 팀 전체의 실행력을 높입니다.`,
    `${person}님, 오늘 업무일지가 내일의 더 좋은 판단을 만듭니다.`,
  ];
  const roleHints = [];
  if (/피트니스|인포|센터장|트레이너|pt|fitness/i.test(`${company} ${role} ${work}`)) {
    roleHints.push("회원 응대와 센터 컨디션을 먼저 살피면 매출과 재등록 기회가 선명해집니다.");
  }
  if (/재무|회계|자금|정산/i.test(`${role} ${work}`)) {
    roleHints.push("숫자와 증빙을 한 번 더 맞추면 대표의 판단 속도가 빨라집니다.");
  }
  if (/공유|워크베이스|워크박스|오피스|창고/i.test(`${company} ${work}`)) {
    roleHints.push("공간 상태, 입주 고객, 공실 신호를 짧게 남기면 운영 품질이 올라갑니다.");
  }
  if (/tba|studio|시공|인테리어|욕실|바스/i.test(`${company} ${work}`)) {
    roleHints.push("시공·상담·제품 이슈를 사진처럼 구체적으로 남기면 프로젝트 품질이 단단해집니다.");
  }
  if (missionText) roleHints.push(`대표 미션: ${missionText}`);
  if (nextEntry) roleHints.push(`다음 일정 ${nextEntry.time} 전에 준비 포인트를 한 줄로 남겨주세요.`);
  else if (pending) roleHints.push(`미완료 ${pending}건 중 가장 중요한 1건부터 처리해봅시다.`);
  else roleHints.push("오늘 우선업무 1건과 시간표 1칸만 먼저 채워도 하루의 방향이 잡힙니다.");
  return `${pickDailyGreeting(base, getActiveDateKey(), employee)} ${pickDailyGreeting(roleHints, getActiveDateKey(), employee)}`;
}

function getEmployeeOwnLabel(employee = getSelectedEmployee()) {
  if (employee.id === state.fitnessWritableEmployeeId && isEmployeeLinkedToProfile(employee.id)) {
    return state.profile?.nickname || employee.nickname || employee.name || "내 업무일지";
  }
  if (employee.id === "profile-user") return state.profile?.nickname || employee.nickname || employee.name || "내 업무일지";
  return employee.nickname || employee.name || getEmployeeAdminLabel(employee);
}

function getFitnessOwnIdentity(employee = employees.find((item) => item.id === state.fitnessWritableEmployeeId) || getSelectedEmployee()) {
  if (isRepresentativeProfile()) {
    return { role: "대표", label: "직원 열람", pageTitle: "직원 업무일지" };
  }
  const label = getEmployeeOwnLabel(employee);
  const role = employee.role || "직원";
  return { role, label, pageTitle: "업무일지(본인용)" };
}

function syncFitnessWritableEmployeeFromProfile() {
  const profile = state.profile || {};
  if (isRepresentativeProfile()) return;
  const email = normalizeEmailValue(profile.email || authState.user?.email || "");
  if (isRetiredFitnessManagerEmail(email)) return;
  const source = `${profile.org || ""} ${profile.workplace || ""} ${profile.primaryWork || ""} ${profile.role || ""} ${profile.name || ""} ${profile.nickname || ""}`.toLowerCase();
  if (!/피트니스|fitness/.test(source)) return;
  let id = fitnessEmployeeIds.includes(getProfileMappedEmployeeId(profile)) ? getProfileMappedEmployeeId(profile) : "profile-user";
  const role = source;
  if (isActiveFitnessManagerEmail(email) || /박주홍|센터장|운영총괄|manager/.test(role)) id = "beyond-fitness-manager";
  else if (/홍현규|트레이너|trainer|pt|피티/.test(role)) id = "fitness-trainer-1";
  else if (/이다빈/.test(role)) id = "fitness-weekday-info-idabin";
  else if (/김영채|yckim1558/.test(role)) id = "fitness-info-kimyoungchae";
  else if (/신세민|tpals2990/.test(role)) id = "fitness-info-shinsemin";
  else if (/토요|토요일/.test(role)) id = "fitness-saturday-info";
  else if (/일요|일요일/.test(role)) id = "fitness-sunday-info";
  else if (/인포|데스크|front|프론트|주중/.test(role)) id = "fitness-weekday-info";
  state.fitnessWritableEmployeeId = id;
  state.selectedEmployeeId = id;
  state.fitnessLogPage = 1;
  state.fitnessLogPageId = id;
}

function getFitnessPageDisplayLabel(page = getCurrentFitnessLogPage()) {
  if (page?.type === "center") return "센터 운영현황";
  if (page?.type === "employee" && isOwnFitnessEmployeeId(page.id)) return getEmployeeOwnLabel(page.employee);
  return getEmployeeAdminLabel(page?.employee || {});
}

function getFitnessPagerTitle() {
  const current = getCurrentFitnessLogPage();
  if (current?.type === "center") return "센터운영현황";
  if (isOwnFitnessEmployeeId(current?.id)) return getFitnessOwnIdentity(current.employee).pageTitle;
  return getEmployeeAdminLabel(current?.employee || {});
}

function getFitnessLogPages() {
  const fitnessEmployees = getFitnessCenterEmployees();
  const writableEmployee = fitnessEmployees.find((employee) => (
    employee.id === state.fitnessWritableEmployeeId
    || employee.mappedEmployeeId === state.fitnessWritableEmployeeId
  )) || fitnessEmployees[0];
  const writableKeys = new Set(getEmployeeIdentityKeys(writableEmployee || {}));
  const coworkerEmployees = fitnessEmployees.filter((employee) => !getEmployeeIdentityKeys(employee).some((key) => writableKeys.has(key)));
  return [{ type: "center", id: "fitness-center", title: "센터 운영현황" }, ...[writableEmployee, ...coworkerEmployees].filter(Boolean).map((employee) => ({
    type: "employee",
    id: getEmployeeWorklogId(employee),
    title: employee.name,
    employee,
  }))];
}

function clampFitnessLogPage(index) {
  const pages = getFitnessLogPages();
  const selectedEmployeePageIndex = index === undefined && state.fitnessLogPageId !== "fitness-center"
    ? pages.findIndex((page) => page.type === "employee" && page.id === state.selectedEmployeeId)
    : -1;
  const pageIdIndex = selectedEmployeePageIndex >= 0
    ? selectedEmployeePageIndex
    : index === undefined && state.fitnessLogPageId
      ? pages.findIndex((page) => page.id === state.fitnessLogPageId)
      : -1;
  const requestedIndex = pageIdIndex >= 0 ? pageIdIndex : Number(index ?? state.fitnessLogPage) || 0;
  return Math.max(0, Math.min(pages.length - 1, requestedIndex));
}

function getCurrentFitnessLogPage() {
  const pages = getFitnessLogPages();
  const pageIndex = clampFitnessLogPage();
  const page = pages[pageIndex] || pages[1];
  if (page) {
    state.fitnessLogPage = pageIndex;
    state.fitnessLogPageId = page.id;
  }
  return page;
}

function getFitnessIdentityEmployee() {
  const page = getCurrentFitnessLogPage();
  if (page?.type === "employee" && page.employee) return page.employee;
  return employees.find((item) => item.id === state.fitnessWritableEmployeeId) || getSelectedEmployee();
}

function isCurrentFitnessLogEditable() {
  const page = getCurrentFitnessLogPage();
  return page?.type === "employee" && isOwnFitnessEmployeeId(page.id);
}

function isOwnFitnessEmployeeId(employeeId) {
  return Boolean(employeeId && employeeId === state.fitnessWritableEmployeeId && isEmployeeLinkedToProfile(employeeId));
}

function getFitnessCenterReportRecord(dateKey = getActiveDateKey()) {
  state.fitnessCenterReports ||= {};
  return state.fitnessCenterReports[dateKey] || null;
}

function isFitnessCenterManagerEmployee(employee = {}) {
  const source = `${employee.id || ""} ${employee.role || ""} ${employee.name || ""} ${employee.primaryWork || ""}`.toLowerCase();
  return employee.id === "beyond-fitness-manager" || /센터장|운영총괄|manager/.test(source);
}

function hasFitnessWorkedOnDate(employeeId = "", dateKey = getActiveDateKey()) {
  if (!employeeId || !fitnessEmployeeIds.includes(employeeId)) return false;
  const log = getEmployeeLogForDate(employeeId, dateKey);
  const ops = { ...createFitnessOps(), ...(log.fitnessOps || {}) };
  const hasAttendance = Boolean(
    log.clockIn
    || log.clockOut
    || log.attendanceStatus
    || (log.attendanceBreaks || []).some((record) => record.start || record.end)
  );
  const hasWorkRecord = Boolean(
    String(log.report || log.memo || log.record || "").trim()
    || getWorklogTaskRefs(log).some(({ task }) => isActiveTask(task))
    || (log.schedule || []).some((entry) => String(getScheduleEntryText(entry) || "").trim())
    || Object.entries(ops).some(([key, value]) => !["shiftNote", "specialReport"].includes(key) && numberValue(value))
    || String(ops.shiftNote || ops.specialReport || "").trim()
  );
  return hasAttendance || hasWorkRecord;
}

function getCurrentFitnessActorEmployee() {
  const mappedId = getProfileMappedEmployeeId();
  const mappedEmployee = getFitnessEmployees().find((employee) => employee.id === mappedId || employee.mappedEmployeeId === mappedId);
  if (mappedEmployee) return mappedEmployee;
  const writableEmployee = getFitnessEmployees().find((employee) => employee.id === state.fitnessWritableEmployeeId);
  if (writableEmployee && (isOwnFitnessEmployeeId(writableEmployee.id) || writableEmployee.id === mappedId || writableEmployee.mappedEmployeeId === mappedId)) return writableEmployee;
  return null;
}

function canConfirmFitnessCenterReport(dateKey = getActiveDateKey()) {
  if (!authState.user || isExplicitlySignedOut()) return false;
  const actor = getCurrentFitnessActorEmployee();
  if (!actor) return false;
  return isFitnessCenterManagerEmployee(actor) || hasFitnessWorkedOnDate(actor.id, dateKey);
}

function formatFitnessCenterConfirmationTime(value = "") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function getFitnessCenterReportStatusText(dateKey = getActiveDateKey()) {
  const record = getFitnessCenterReportRecord(dateKey);
  if (!record?.confirmedAt) return "미확정";
  const time = formatFitnessCenterConfirmationTime(record.confirmedAt);
  return `확정 · ${record.confirmedBy || "근무자"}${time ? ` · ${time}` : ""}`;
}

function toggleFitnessCenterReportConfirmation(dateKey = getActiveDateKey()) {
  const actor = getCurrentFitnessActorEmployee();
  const existing = getFitnessCenterReportRecord(dateKey);
  if (!canConfirmFitnessCenterReport(dateKey) || !actor) {
    showAppToast("센터장 또는 해당일 근무 직원만 센터 업무보고서를 확정할 수 있습니다");
    return;
  }
  state.fitnessCenterReports ||= {};
  if (existing?.confirmedAt) {
    const isSameConfirmer = existing.confirmedById === actor.id;
    if (!isSameConfirmer && !isFitnessCenterManagerEmployee(actor)) {
      showAppToast("확정자 또는 센터장만 확정을 취소할 수 있습니다");
      return;
    }
    state.fitnessCenterReports[dateKey] = {
      ...existing,
      status: "reopened",
      reopenedBy: getEmployeeAdminLabel(actor),
      reopenedById: actor.id,
      reopenedAt: new Date().toISOString(),
      confirmedAt: "",
    };
    showAppToast("센터 업무보고서 확정을 취소했습니다");
  } else {
    state.fitnessCenterReports[dateKey] = {
      status: "confirmed",
      dateKey,
      confirmedBy: getEmployeeAdminLabel(actor),
      confirmedById: actor.id,
      confirmedAt: new Date().toISOString(),
      scope: "beyond-fitness-center",
    };
    showAppToast("센터 업무보고서를 확정했습니다");
  }
  saveState();
  if (dateKey === getActiveDateKey()) renderFitnessCenterDaily();
  updateFitnessReportConfirmButton(buildFitnessReportModel());
  const preview = document.getElementById("fitnessReportPreview");
  if (preview && !document.getElementById("fitnessReportSheet")?.hidden) {
    preview.innerHTML = renderFitnessReportTemplate(buildFitnessReportModel());
    fitFitnessReportPreview();
  }
}

function getProfileMappedEmployeeId(profile = state.profile || {}) {
  const profileEmail = normalizeEmailValue(profile.email || "");
  const email = profileEmail || normalizeEmailValue(authState.user?.email || "");
  if (isRetiredFitnessManagerEmail(email)) return "";
  const source = `${profile.org || ""} ${profile.workplace || ""} ${profile.role || ""} ${profile.name || ""} ${profile.nickname || ""} ${profile.primaryWork || ""}`.toLowerCase();
  const overrideMappedEmployeeId = getProfilePlacementOverride(email)?.mappedEmployeeId;
  if (overrideMappedEmployeeId) return overrideMappedEmployeeId;
  if (controlTowerEmails.has(email) || /대표|owner|ceo/.test(source)) return "";
  if (/이소미/.test(source) || (!/비제이|종합건설|건설|bj|construction/.test(source) && /재무\s*대리|finance\s*assistant/.test(source))) return "bangju-finance-assistant";
  if (/재무\s*과장|finance\s*manager/.test(source)) return "bangju-finance-manager";
  if (isActiveFitnessManagerEmail(email) || (!email && (/박주홍/.test(source) || /센터장|피트니스.*총괄|fitness.*manager/.test(source)))) return "beyond-fitness-manager";
  if (/홍현규|트레이너|trainer|pt|피티/.test(source)) return "fitness-trainer-1";
  if (/이다빈/.test(source)) return "fitness-weekday-info-idabin";
  if (/김영채|yckim1558/.test(source)) return "fitness-info-kimyoungchae";
  if (/신세민|tpals2990/.test(source)) return "fitness-info-shinsemin";
  if (/토요|토요일/.test(source)) return "fitness-saturday-info";
  if (/일요|일요일/.test(source)) return "fitness-sunday-info";
  if (/인포|데스크|front|프론트|주중/.test(source)) return "fitness-weekday-info";
  if (/피트니스|fitness/.test(source)) return "";
  if (/비욘드/.test(source) && /공유|워크베이스|워크박스|창고|오피스|shared|workbase|workbox/.test(source)) return "beyond-shared-manager";
  if (/비욘드/.test(source) && /실장|tba|티비에이|인월|욕실|바스|bath/.test(source)) return "beyond-company-leader";
  return "";
}

function isWorklogEditView(view = activeView) {
  return ["fitness-log", "bangju-log", "beyond-log", "today"].includes(view);
}

function getCurrentWorklogEmployeeId(view = activeView) {
  if (view === "fitness-log") {
    const page = getCurrentFitnessLogPage();
    return page?.type === "employee" ? page.id : "";
  }
  if (["bangju-log", "beyond-log", "today"].includes(view)) return state.selectedEmployeeId || "profile-user";
  return "";
}

function getOwnEditableEmployeeIdForView(view = activeView) {
  if (view === "fitness-log") return state.fitnessWritableEmployeeId;
  if (["bangju-log", "beyond-log", "today"].includes(view)) {
    if (!authState.user) return "profile-user";
    return getProfileMappedEmployeeId() || "profile-user";
  }
  return "";
}

function canEditEmployeeSlot(employeeId = "") {
  if (!employeeId) return false;
  if (isExplicitlySignedOut()) return false;
  if (!authState.user) return false;
  if (isRepresentativeProfile()) return false;
  const ownEmployeeId = getProfileMappedEmployeeId() || "profile-user";
  return employeeId === ownEmployeeId;
}

function canApproveWorklogCorrections() {
  return isRepresentativeProfile() || hasProfilePermission("worklogAll") || hasProfilePermission("staffManage") || hasApprovalAuthority();
}

function getPreviousDateKey(dateKey = todayKey) {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() - 1);
  return formatDateKey(date);
}

function isWithinWorklogEditWindow(dateKey = getActiveDateKey(), now = new Date()) {
  if (!dateKey) return false;
  const currentKey = formatDateKey(now);
  if (dateKey >= currentKey) return true;
  if (dateKey === getPreviousDateKey(currentKey)) {
    const limit = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
    return now < limit;
  }
  return false;
}

function getWorklogCorrectionKey(employeeId = "", dateKey = getActiveDateKey()) {
  return `${dateKey}::${employeeId || "unknown"}`;
}

function getWorklogCorrectionGrant(employeeId = "", dateKey = getActiveDateKey()) {
  return state.worklogCorrectionGrants?.[getWorklogCorrectionKey(employeeId, dateKey)] || null;
}

function isWorklogCorrectionGrantActive(employeeId = "", dateKey = getActiveDateKey()) {
  const grant = getWorklogCorrectionGrant(employeeId, dateKey);
  return Boolean(grant?.status === "active" && grant.expiresAt && new Date(grant.expiresAt).getTime() > Date.now());
}

function canEditWorklogDate(employeeId = "", dateKey = getActiveDateKey()) {
  if (!employeeId) return false;
  if (isWithinWorklogEditWindow(dateKey)) return true;
  if (isWorklogCorrectionGrantActive(employeeId, dateKey)) return true;
  return false;
}

function canEditCurrentWorklog(view = activeView) {
  if (!isWorklogEditView(view)) return false;
  if (isRepresentativeProfile()) return false;
  const currentEmployeeId = getCurrentWorklogEmployeeId(view);
  if (!canEditWorklogDate(currentEmployeeId, getActiveDateKey())) return false;
  if (view === "fitness-log") {
    return isCurrentFitnessLogEditable() && canEditEmployeeSlot(currentEmployeeId);
  }
  const ownEmployeeId = getOwnEditableEmployeeIdForView(view);
  return Boolean(currentEmployeeId && ownEmployeeId && currentEmployeeId === ownEmployeeId && canEditEmployeeSlot(currentEmployeeId));
}

function guardWorklogEdit(view = activeView) {
  if (canEditCurrentWorklog(view)) return true;
  const employeeId = getCurrentWorklogEmployeeId(view);
  const lock = getWorklogEditLockInfo(employeeId);
  showAppToast(lock.lockedByDate ? "수정 가능 시간이 지나 정정 요청이 필요합니다" : "열람 전용 업무일지입니다");
  if (view === "fitness-log") applyFitnessLogPermissionState();
  else applyCurrentWorklogPermissionState(view);
  return false;
}

function setFitnessLogPage(index) {
  const pageIndex = clampFitnessLogPage(index);
  const page = getFitnessLogPages()[pageIndex];
  state.fitnessLogPage = pageIndex;
  state.fitnessLogPageId = page?.id || "fitness-center";
  if (page?.type === "employee") state.selectedEmployeeId = page.id;
  saveState({ fastSave: true });
  renderAll();
  showFitnessPageToast(page);
}

function moveFitnessLogPage(delta) {
  animateFitnessPageTurn(delta);
  setFitnessLogPage(clampFitnessLogPage(state.fitnessLogPage) + delta);
}

function moveFitnessLogPrevPage() {
  const pages = getFitnessLogPages();
  const pageIndex = clampFitnessLogPage(state.fitnessLogPage);
  const page = pages[pageIndex];
  if (page?.type === "employee" && page.id !== state.fitnessWritableEmployeeId) {
    animateFitnessPageTurn(-1);
    setFitnessLogPage(1);
    return;
  }
  moveFitnessLogPage(-1);
}

function moveFitnessLogNextPage() {
  moveFitnessLogPage(1);
}

function animateFitnessPageTurn(delta) {
  const view = document.getElementById("view-fitness-log");
  if (!view) return;
  view.classList.remove("is-turn-next", "is-turn-prev");
  void view.offsetWidth;
  view.classList.add(delta > 0 ? "is-turn-next" : "is-turn-prev");
  window.setTimeout(() => view.classList.remove("is-turn-next", "is-turn-prev"), 260);
}

function showFitnessPageToast(page = getCurrentFitnessLogPage()) {
  const view = document.getElementById("view-fitness-log");
  if (!view) return;
  let toast = document.getElementById("fitnessPageToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "fitnessPageToast";
    toast.className = "fitness-page-toast";
    view.appendChild(toast);
  }
  toast.textContent = page?.type === "center"
    ? "센터 운영현황"
    : isOwnFitnessEmployeeId(page?.id)
      ? "내 업무일지 · 입력 가능"
      : `${getFitnessPageDisplayLabel(page)} · 열람 전용`;
  toast.classList.remove("is-visible");
  void toast.offsetWidth;
  toast.classList.add("is-visible");
  window.setTimeout(() => toast.classList.remove("is-visible"), 1200);
}

function showAppToast(message = "") {
  const shell = document.querySelector(".worklog-shell");
  if (!shell || !message) return;
  let toast = document.getElementById("appToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "appToast";
    toast.className = "app-toast";
    shell.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.remove("is-visible");
  void toast.offsetWidth;
  toast.classList.add("is-visible");
  window.setTimeout(() => toast.classList.remove("is-visible"), 1400);
}

let undoToastTimer = null;

function showUndoToast(message = "", onUndo = null) {
  const shell = document.querySelector(".worklog-shell") || document.body;
  if (!shell || !message) return;
  let toast = document.getElementById("undoToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "undoToast";
    toast.className = "undo-toast";
    shell.appendChild(toast);
  }
  toast.innerHTML = `
    <span>${escapeHtml(message)}</span>
    <button type="button">되돌리기</button>
  `;
  const button = toast.querySelector("button");
  button.onclick = () => {
    if (typeof onUndo === "function") onUndo();
    toast.classList.remove("is-visible");
  };
  window.clearTimeout(undoToastTimer);
  toast.classList.remove("is-visible");
  void toast.offsetWidth;
  toast.classList.add("is-visible");
  undoToastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 6000);
}

function restoreObjectSnapshot(target, snapshot) {
  if (!target || !snapshot) return;
  Object.keys(target).forEach((key) => delete target[key]);
  Object.assign(target, cloneWorklogLogForAudit(snapshot));
}

function hasAttendanceRecord(log = getSelectedLog()) {
  return Boolean(
    String(log?.clockIn || "").trim()
    || String(log?.clockOut || "").trim()
    || String(log?.attendanceStatus || "").trim()
    || (Array.isArray(log?.attendanceBreaks) && log.attendanceBreaks.some((item) => item?.start || item?.end))
  );
}

function promptAttendanceBeforeWorklogInput(log = getSelectedLog(), value = "") {
  if (!String(value || "").trim()) return;
  if (hasAttendanceRecord(log)) return;
  const now = Date.now();
  if (now - attendancePromptLastAt < 5200) return;
  attendancePromptLastAt = now;
  showAppToast("출결을 기록하세요");
}

function getScheduleTimes(workHoursValue) {
  const workHours = normalizeWorkHoursText(workHoursValue || state?.profile?.workHours || defaultProfile.workHours);
  if (isOffWorkHours(workHours)) return [];
  const match = workHours.match(/(\d{1,2}):(\d{2})\s*[-~]\s*(\d{1,2}):(\d{2})/);
  if (!match) return defaultScheduleTimes;
  const start = Number(match[1]) * 60 + Number(match[2]);
  const end = Number(match[3]) * 60 + Number(match[4]);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return defaultScheduleTimes;
  const times = [];
  for (let minute = start; minute <= end; minute += 30) {
    const hour = Math.floor(minute / 60);
    const min = minute % 60;
    times.push(`${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
  }
  return times;
}

function isOffWorkHours(value = "") {
  return /휴무|off|closed|none|없음/i.test(String(value || ""));
}

function normalizeWorkHoursText(value = "") {
  const source = String(value || "").trim();
  if (!source) return "";
  if (isOffWorkHours(source)) return "휴무";
  const match = source.match(/(\d{1,2})\s*[:시]\s*([0-5]\d)?\s*[-~–—]\s*(\d{1,2})\s*[:시]\s*([0-5]\d)?/);
  if (!match) return source;
  const startHour = Number(match[1]);
  const startMinute = Number(match[2] || "00");
  const endHour = Number(match[3]);
  const endMinute = Number(match[4] || "00");
  if (startHour < 0 || startHour > 24 || endHour < 0 || endHour > 24) return source;
  return `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}-${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
}

function normalizeScheduleTimeInput(value = "") {
  const source = String(value || "").trim();
  const match = source.match(/^(\d{1,2})(?::|시\s*)?([0-5]\d)?$/);
  if (!match) return "";
  const hour = Number(match[1]);
  const minute = Number(match[2] || "00");
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return "";
  if (hour < 0 || hour > 24 || minute < 0 || minute > 59) return "";
  if (hour === 24 && minute !== 0) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function getActiveDateKey() {
  return state.selectedDateKey || todayKey;
}

function getSelectedLog() {
  const employee = getSelectedEmployee();
  const key = getActiveDateKey();
  return getEmployeeLogForDate(employee.id, key);
}

function getEmployeeLogForDate(employeeId, key = getActiveDateKey()) {
  const employee = findEmployeeRecordById(employeeId) || getSelectedEmployee();
  const canonicalId = getEmployeeWorklogId(employee) || String(employeeId || "").trim();
  state.employeeLogs ||= {};
  state.employeeLogs[key] ||= {};
  if (!state.employeeLogs[key][canonicalId]) {
    const legacyLog = getEmployeeWorklogAliases(employee)
      .map((id) => state.employeeLogs[key][id])
      .find(hasSubmittableWorklogContent);
    state.employeeLogs[key][canonicalId] = legacyLog
      ? { ...cloneWorklogLogForAudit(legacyLog), employeeId: canonicalId }
      : createEmployeeLog({ ...employee, id: canonicalId }, state.profile, key);
  }
  state.employeeLogs[key][canonicalId].attendanceBreaks = Array.isArray(state.employeeLogs[key][canonicalId].attendanceBreaks)
    ? state.employeeLogs[key][canonicalId].attendanceBreaks
    : [];
  normalizeEmployeeLogRows(state.employeeLogs[key][canonicalId], key);
  return state.employeeLogs[key][canonicalId];
}

function findEmployeeRecordById(employeeId) {
  const id = String(employeeId || "").trim();
  if (!id) return null;
  return getEmployeeOptions().find((item) => item.id === id)
    || employees.find((item) => item.id === id)
    || getStaffDirectoryEmployees().find((item) => item.id === id || item.mappedEmployeeId === id)
    || null;
}

function getWorklogEditLockInfo(employeeId = getCurrentWorklogEmployeeId(), dateKey = getActiveDateKey()) {
  if (!employeeId) {
    return { locked: true, lockedByDate: false, label: "열람 전용", detail: "선택된 직원 업무일지가 없습니다." };
  }
  if (canEditEmployeeSlot(employeeId) && isWithinWorklogEditWindow(dateKey)) {
    return { locked: false, label: "수정 가능", detail: "미래 일정은 언제든 기록할 수 있고, 지난 업무일지는 다음날 정오까지 수정할 수 있습니다." };
  }
  const grant = getWorklogCorrectionGrant(employeeId, dateKey);
  if (isWorklogCorrectionGrantActive(employeeId, dateKey)) {
    return {
      locked: false,
      label: "정정 승인",
      detail: `승인된 정정 가능 시간입니다. ${formatCorrectionTime(grant.expiresAt)}까지 수정할 수 있습니다.`,
      grant,
    };
  }
  if (canEditEmployeeSlot(employeeId) && !isWithinWorklogEditWindow(dateKey)) {
    return {
      locked: true,
      lockedByDate: true,
      label: "자동 잠금",
      detail: "지난 업무일지는 다음날 정오 이후 잠기며 정정 승인이 필요합니다.",
      grant,
    };
  }
  return { locked: true, lockedByDate: false, label: "열람 전용", detail: "본인 업무일지만 수정할 수 있습니다." };
}

function formatCorrectionTime(value = "") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function getPendingCorrectionRequest(employeeId = getCurrentWorklogEmployeeId(), dateKey = getActiveDateKey()) {
  return (state.worklogCorrectionRequests || []).find((request) => (
    request.employeeId === employeeId
    && request.dateKey === dateKey
    && request.status === "pending"
  )) || null;
}

function requestWorklogCorrection(viewName = activeView) {
  const employeeId = getCurrentWorklogEmployeeId(viewName);
  const dateKey = getActiveDateKey();
  if (!employeeId || !canEditEmployeeSlot(employeeId)) {
    showAppToast("본인 업무일지만 정정 요청할 수 있습니다");
    return;
  }
  if (isWithinWorklogEditWindow(dateKey)) {
    showAppToast("현재 날짜는 바로 수정할 수 있습니다");
    return;
  }
  const existing = getPendingCorrectionRequest(employeeId, dateKey);
  if (existing) {
    showAppToast("이미 정정 요청이 접수되어 있습니다");
    return;
  }
  const reason = prompt("정정 사유를 입력해주세요.");
  if (!String(reason || "").trim()) return;
  const employee = getEmployeeOptions().find((item) => item.id === employeeId) || getProfileEmployee();
  state.worklogCorrectionRequests ||= [];
  state.worklogCorrectionRequests.unshift({
    id: `correction-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    employeeId,
    employeeLabel: getEmployeeAdminLabel(employee),
    dateKey,
    reason: String(reason).trim(),
    status: "pending",
    requestedBy: authState.user?.email || state.profile?.email || "",
    requestedAt: new Date().toISOString(),
  });
  saveState();
  renderAll();
  showAppToast("정정 요청을 보냈습니다");
}

function approveWorklogCorrection(requestId = "") {
  if (!canApproveWorklogCorrections()) {
    showAppToast("정정 승인 권한이 없습니다");
    return;
  }
  const request = (state.worklogCorrectionRequests || []).find((item) => item.id === requestId);
  if (!request || request.status !== "pending") return;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const key = getWorklogCorrectionKey(request.employeeId, request.dateKey);
  request.status = "approved";
  request.approvedBy = authState.user?.email || state.profile?.email || "";
  request.approvedAt = now.toISOString();
  request.expiresAt = expiresAt.toISOString();
  state.worklogCorrectionGrants ||= {};
  state.worklogCorrectionGrants[key] = {
    requestId: request.id,
    employeeId: request.employeeId,
    dateKey: request.dateKey,
    reason: request.reason,
    status: "active",
    approvedBy: request.approvedBy,
    approvedAt: request.approvedAt,
    expiresAt: request.expiresAt,
    baseline: cloneWorklogLogForAudit(getEmployeeLogForDate(request.employeeId, request.dateKey)),
    lastSnapshot: "",
  };
  saveState();
  renderAll();
  showAppToast("2시간 정정 권한을 승인했습니다");
}

function cloneWorklogLogForAudit(log) {
  return JSON.parse(JSON.stringify(log || {}));
}

function recordActiveCorrectionAudits() {
  if (!state?.worklogCorrectionGrants || !state.employeeLogs) return;
  const now = new Date();
  Object.entries(state.worklogCorrectionGrants).forEach(([key, grant]) => {
    if (!grant || grant.status !== "active") return;
    if (!grant.expiresAt || new Date(grant.expiresAt).getTime() <= now.getTime()) {
      grant.status = "expired";
      grant.expiredAt ||= now.toISOString();
      return;
    }
    const log = state.employeeLogs?.[grant.dateKey]?.[grant.employeeId];
    if (!log) return;
    const before = JSON.stringify(grant.baseline || {});
    const after = JSON.stringify(log || {});
    if (before === after || grant.lastSnapshot === after) return;
    state.worklogCorrectionAudit ||= [];
    state.worklogCorrectionAudit.push({
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      employeeId: grant.employeeId,
      dateKey: grant.dateKey,
      reason: grant.reason || "",
      before: grant.baseline || {},
      after: cloneWorklogLogForAudit(log),
      changedBy: authState.user?.email || state.profile?.email || "",
      approvedBy: grant.approvedBy || "",
      changedAt: now.toISOString(),
    });
    grant.baseline = cloneWorklogLogForAudit(log);
    grant.lastSnapshot = after;
  });
  state.worklogCorrectionAudit = (state.worklogCorrectionAudit || []).slice(-240);
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getLunarDateInfo(date) {
  const parts = lunarDateFormatter.formatToParts(date);
  const month = Number(parts.find((part) => part.type === "month")?.value || 0);
  const day = Number(parts.find((part) => part.type === "day")?.value || 0);
  return { month, day };
}

function getLunarDateInfoForKey(dateKey) {
  return getLunarDateInfo(parseDateKey(dateKey));
}

function getLunarAnchorLabel(dateKey) {
  const lunar = getLunarDateInfoForKey(dateKey);
  if (![1, 10, 20, 30].includes(lunar.day)) return "";
  return `음 ${lunar.month}.${lunar.day}`;
}

function getBaseKoreanHolidayLabels(dateKey) {
  const date = parseDateKey(dateKey);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const labels = [];
  const add = (label) => {
    if (!labels.includes(label)) labels.push(label);
  };
  if (month === 1 && day === 1) add("신정");
  if (month === 3 && day === 1) add("삼일절");
  if (month === 5 && day === 5) add("어린이날");
  if (month === 6 && day === 6) add("현충일");
  if (month === 7 && day === 17) add("제헌절");
  if (month === 8 && day === 15) add("광복절");
  if (month === 10 && day === 3) add("개천절");
  if (month === 10 && day === 9) add("한글날");
  if (month === 12 && day === 25) add("성탄절");

  const lunar = getLunarDateInfo(date);
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  const nextLunar = getLunarDateInfo(next);
  if (nextLunar.month === 1 && nextLunar.day === 1) add("설연휴");
  if (lunar.month === 1 && lunar.day === 1) add("설날");
  if (lunar.month === 1 && lunar.day === 2) add("설연휴");
  if (lunar.month === 4 && lunar.day === 8) add("부처님오신날");
  if (lunar.month === 8 && lunar.day === 14) add("추석연휴");
  if (lunar.month === 8 && lunar.day === 15) add("추석");
  if (lunar.month === 8 && lunar.day === 16) add("추석연휴");
  return labels;
}

function getKoreanHolidayMap(year) {
  if (koreanHolidayCache.has(year)) return koreanHolidayCache.get(year);
  const map = new Map();
  const add = (dateKey, label) => {
    const labels = map.get(dateKey) || [];
    if (!labels.includes(label)) labels.push(label);
    map.set(dateKey, labels);
  };
  const baseHolidayKeys = [];
  const date = new Date(year, 0, 1);
  while (date.getFullYear() === year) {
    const dateKey = formatDateKey(date);
    const labels = getBaseKoreanHolidayLabels(dateKey);
    labels.forEach((label) => add(dateKey, label));
    if (labels.some((label) => label !== "제헌절")) baseHolidayKeys.push(dateKey);
    date.setDate(date.getDate() + 1);
  }
  baseHolidayKeys.forEach((dateKey) => {
    const holiday = parseDateKey(dateKey);
    const day = holiday.getDay();
    if (![0, 6].includes(day)) return;
    const substitute = new Date(holiday);
    do {
      substitute.setDate(substitute.getDate() + 1);
    } while ([0, 6].includes(substitute.getDay()) || (map.get(formatDateKey(substitute)) || []).length);
    if (substitute.getFullYear() === year) add(formatDateKey(substitute), "대체공휴일");
  });
  koreanHolidayCache.set(year, map);
  return map;
}

function getCalendarDayMeta(dateKey) {
  const date = parseDateKey(dateKey);
  const holidayLabels = getKoreanHolidayMap(date.getFullYear()).get(dateKey) || [];
  const lunarLabel = getLunarAnchorLabel(dateKey);
  return {
    holidayLabels,
    lunarLabel,
    isHoliday: holidayLabels.length > 0,
    isWeekend: [0, 6].includes(date.getDay()),
  };
}

function setSelectedDateKey(dateKey) {
  state.selectedDateKey = dateKey;
  normalizeState();
  saveState();
  renderAll();
  loadRemoteWorklogForActiveDate();
  closeWorklogCalendar();
}

function moveSelectedDate(offsetDays, animate = true) {
  const date = parseDateKey(getActiveDateKey());
  date.setDate(date.getDate() + offsetDays);
  const nextDateKey = formatDateKey(date);
  if (animate) {
    animateDateTitle(offsetDays, nextDateKey);
    return;
  }
  setSelectedDateKey(nextDateKey);
}

function animateDateTitle(delta, nextDateKey) {
  const titleButtons = ["selectedDateButton", "fitnessDateButton", "overviewDateButton", "executiveDateButton", "controlTowerDateButton"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  if (!titleButtons.length) {
    setSelectedDateKey(nextDateKey);
    return;
  }

  clearTimeout(dateSlideTimer);
  titleButtons.forEach((button) => {
    button.classList.remove("slide-out-next", "slide-out-prev", "slide-in-next", "slide-in-prev");
    void button.offsetWidth;
    button.classList.add(delta > 0 ? "slide-out-next" : "slide-out-prev");
  });

  dateSlideTimer = window.setTimeout(() => {
    setSelectedDateKey(nextDateKey);
    const nextTitleButtons = ["selectedDateButton", "fitnessDateButton", "overviewDateButton", "executiveDateButton", "controlTowerDateButton"]
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    nextTitleButtons.forEach((button) => {
      button.classList.remove("slide-out-next", "slide-out-prev", "slide-in-next", "slide-in-prev");
      void button.offsetWidth;
      button.classList.add(delta > 0 ? "slide-in-next" : "slide-in-prev");
    });
    window.setTimeout(() => {
      nextTitleButtons.forEach((button) => button.classList.remove("slide-in-next", "slide-in-prev"));
    }, 220);
  }, 150);
}

function getActiveDateSwipePanel() {
  if (activeView === "fitness-log") return document.getElementById("view-fitness-log");
  if (["bangju-log", "beyond-log", "today"].includes(activeView)) return document.getElementById("view-today");
  return null;
}

function isDateVerticalSwipeTargetBlocked(target) {
  return Boolean(target?.closest?.([
    "button",
    "input",
    "textarea",
    "select",
    "label",
    "[contenteditable='true']",
    ".worklog-calendar-popover",
    ".fitness-schedule-editor",
    ".fitness-coaching-sheet",
    ".attendance-popover",
    ".main-menu-popover",
    ".report-sheet",
  ].join(",")));
}

function canElementScrollVertically(element, direction) {
  if (!element) return false;
  const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
  if (maxScrollTop <= 6) return false;
  if (direction > 0) return element.scrollTop < maxScrollTop - 6;
  return element.scrollTop > 6;
}

function canScrollVerticallyFromTarget(target, root, direction) {
  let node = target;
  while (node && node !== document.body && node !== document.documentElement) {
    if (root && node instanceof Element && !root.contains(node)) break;
    if (node instanceof Element && canElementScrollVertically(node, direction)) return true;
    node = node.parentElement;
  }
  const scroller = document.scrollingElement || document.documentElement;
  return canElementScrollVertically(scroller, direction);
}

function animateSelectedDateVertically(offsetDays) {
  if (verticalDateSwipeAnimating) return;
  const panel = getActiveDateSwipePanel();
  if (!panel) return moveSelectedDate(offsetDays);
  const date = parseDateKey(getActiveDateKey());
  date.setDate(date.getDate() + offsetDays);
  const nextDateKey = formatDateKey(date);
  verticalDateSwipeAnimating = true;
  clearTimeout(verticalDateSwipeTimer);
  panel.classList.remove("date-sheet-out-next", "date-sheet-out-prev", "date-sheet-in-next", "date-sheet-in-prev");
  void panel.offsetWidth;
  panel.classList.add(offsetDays > 0 ? "date-sheet-out-next" : "date-sheet-out-prev");
  verticalDateSwipeTimer = window.setTimeout(() => {
    setSelectedDateKey(nextDateKey);
    const nextPanel = getActiveDateSwipePanel();
    nextPanel?.classList.add(offsetDays > 0 ? "date-sheet-in-next" : "date-sheet-in-prev");
    window.setTimeout(() => {
      nextPanel?.classList.remove("date-sheet-out-next", "date-sheet-out-prev", "date-sheet-in-next", "date-sheet-in-prev");
      verticalDateSwipeAnimating = false;
    }, 240);
  }, 150);
}

function setupVerticalDateSwipe(panel) {
  if (!panel) return;
  let startX = 0;
  let startY = 0;
  let startTarget = null;
  let blocked = false;
  panel.addEventListener("pointerdown", (event) => {
    if (!isWorklogEditView(activeView)) {
      blocked = true;
      return;
    }
    startTarget = event.target;
    startX = event.clientX;
    startY = event.clientY;
    blocked = verticalDateSwipeAnimating || isEditingDailyField() || isDateVerticalSwipeTargetBlocked(event.target);
  });
  panel.addEventListener("pointerup", (event) => {
    if (blocked || !startTarget || isEditingDailyField()) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (Math.abs(dy) < 96 || Math.abs(dy) < Math.abs(dx) * 1.35) return;
    const offsetDays = dy < 0 ? 1 : -1;
    const scrollDirection = dy < 0 ? 1 : -1;
    if (canScrollVerticallyFromTarget(startTarget, panel, scrollDirection)) return;
    animateSelectedDateVertically(offsetDays);
  });
}

function formatKoreanDate(key) {
  const date = parseDateKey(key);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}(${hanjaWeekdays[date.getDay()]})`;
}

function formatFormalKoreanDate(key) {
  const date = parseDateKey(key);
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${hanjaWeekdays[date.getDay()]})`;
}

function formatCompactDate(key) {
  return formatKoreanDate(key).replaceAll(" ", "");
}

function formatShortDate(key) {
  if (!key) return "미정";
  const date = parseDateKey(key);
  return `${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function getWeekStartDate(dateKey = getActiveDateKey()) {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() - date.getDay());
  return date;
}

function getActiveWeekKey(dateKey = getActiveDateKey()) {
  return formatDateKey(getWeekStartDate(dateKey));
}

function formatCommonWeekRange(weekKey = getActiveWeekKey()) {
  const start = parseDateKey(weekKey);
  const end = parseDateKey(weekKey);
  end.setDate(start.getDate() + 6);
  return `${formatShortDate(formatDateKey(start))} ~ ${formatShortDate(formatDateKey(end))}`;
}

function currentTimeValue() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function roundTimeToFiveMinutes(value = currentTimeValue()) {
  const minutes = timeToMinutes(value);
  if (!Number.isFinite(minutes)) return "08:00";
  return minutesToTime(Math.min(24 * 60, Math.round(minutes / 5) * 5));
}

function getFiveMinuteTimeOptions() {
  return Array.from({ length: (24 * 60) / 5 + 1 }, (_, index) => minutesToTime(index * 5));
}

function setupAttendancePopover() {
  const primary = document.getElementById("attendancePrimaryTimeSelect");
  const secondary = document.getElementById("attendanceSecondaryTimeSelect");
  if (!primary || primary.options.length) return;
  const options = getFiveMinuteTimeOptions().map((time) => `<option value="${time}">${time}</option>`).join("");
  primary.innerHTML = options;
  if (secondary) secondary.innerHTML = options;
}

function renderResponsiveMode() {
  const viewportWidth = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
  const viewportHeight = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
  const isLandscapeFlow = viewportWidth >= 600 && viewportWidth > viewportHeight * 1.08;
  const isNarrow = viewportWidth <= 760 && !isLandscapeFlow;
  const isPhoneWidth = viewportWidth <= 640 && !isLandscapeFlow;
  const mode = isNarrow ? "narrow" : "expanded";
  const viewMode = getGlobalViewMode();
  const layoutMode = isLandscapeFlow ? "wide" : (isPhoneWidth || viewMode === "ceo" ? "phone" : "wide");
  localStorage.setItem(layoutModeStorageKey, layoutMode);
  document.body.dataset.deviceMode = mode;
  document.body.dataset.layoutMode = layoutMode;
  document.body.dataset.responsiveFlow = isLandscapeFlow ? "landscape" : "portrait";
  document.body.dataset.viewportDensity = viewportHeight <= 720 && isLandscapeFlow ? "high" : "regular";
  document.body.classList.toggle("smartphone-device", layoutMode === "phone" || isPhoneWidth);
  document.body.classList.toggle("physical-phone-device", isPhoneWidth);
  applyGlobalViewMode();
  const layoutToggle = document.querySelector(".layout-mode-toggle");
  if (layoutToggle) layoutToggle.hidden = isPhoneWidth;
  document.querySelectorAll("[data-layout-mode-choice]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.layoutModeChoice === layoutMode);
  });
  applyMobileDayFocusMode();
  applyFitnessMobileFocusMode();
}

function isPhysicalPhoneLayout() {
  const viewportWidth = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
  const viewportHeight = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
  return viewportWidth <= 640 && !(viewportWidth >= 600 && viewportWidth > viewportHeight * 1.08);
}

function getGlobalViewMode() {
  if (isPhysicalPhoneLayout()) return "ceo";
  return localStorage.getItem(globalViewModeStorageKey) === "classic" ? "classic" : "ceo";
}

function applyGlobalViewMode() {
  const mode = getGlobalViewMode();
  const isPhone = isPhysicalPhoneLayout();
  document.body.dataset.viewMode = mode;
  const button = document.getElementById("globalViewModeButton");
  const label = document.getElementById("globalViewModeLabel");
  if (button) {
    button.hidden = isPhone;
    button.classList.toggle("is-classic", mode === "classic");
    button.setAttribute("aria-pressed", String(mode === "ceo"));
    button.title = `${mode === "ceo" ? "클래식" : "CEO"} 모드로 전환`;
  }
  if (label) label.textContent = mode === "ceo" ? "클래식" : "CEO";
}

function toggleGlobalViewMode() {
  if (isPhysicalPhoneLayout()) return;
  const nextMode = getGlobalViewMode() === "ceo" ? "classic" : "ceo";
  localStorage.setItem(globalViewModeStorageKey, nextMode);
  localStorage.setItem(layoutModeStorageKey, nextMode === "ceo" ? "phone" : "wide");
  resetMobileDayFocusToSplit({ blur: true });
  renderResponsiveMode();
}

function getAssetRows() {
  return beyondAssets.flatMap((asset) => asset.floors.map((floor) => ({ ...floor, building: asset.building, district: asset.district })));
}

function calculateOperatingScore() {
  const rows = getAssetRows();
  const active = rows.filter((row) => ["운영", "무인운영", "임대"].includes(row.status)).length;
  const pending = rows.filter((row) => ["준비", "보류"].includes(row.status)).length;
  const closed = rows.filter((row) => row.status === "운영종료").length;
  return Math.max(0, Math.min(100, Math.round((active / rows.length) * 78 + (pending ? 8 : 14) - closed * 3)));
}

function renderOsDashboard() {
  const rows = getAssetRows();
  const brands = new Set(rows.map((row) => row.brand)).size;
  const rooms = rows.reduce((sum, row) => sum + row.rooms.length, 0);
  const score = calculateOperatingScore();
  document.getElementById("osKpiGrid").innerHTML = [
    ["운영점수", `${score}점`],
    ["법인", `${bangjuOrganization.length}개`],
    ["건물", `${beyondAssets.length}개`],
    ["호실/공간", `${rooms}개`],
    ["사업장", `${rows.length}개`],
    ["브랜드", `${brands}개`],
  ].map(([label, value]) => `<article><span>${label}</span><strong>${value}</strong></article>`).join("");

  document.getElementById("assetMap").innerHTML = beyondAssets.map((asset) => `
    <section class="asset-building">
      <header>
        <strong>${escapeHtml(asset.building)}</strong>
        <span>${escapeHtml(asset.district)}</span>
      </header>
      ${asset.floors.map((floor) => `
        <div class="asset-room">
          <b>${escapeHtml(floor.floor)} · ${escapeHtml(floor.rooms.join(", "))}</b>
          <span>${escapeHtml(floor.site)} / ${escapeHtml(floor.brand)}</span>
          <em data-status="${escapeAttr(floor.status)}">${escapeHtml(floor.status)}</em>
        </div>
      `).join("")}
    </section>
  `).join("");

  document.getElementById("riskList").innerHTML = operatingRisks.map(([category, text, level]) => `
    <article class="risk-item">
      <span>${escapeHtml(category)}</span>
      <strong>${escapeHtml(text)}</strong>
      <em data-level="${escapeAttr(level)}">${escapeHtml(level)}</em>
    </article>
  `).join("");

  document.getElementById("moduleGrid").innerHTML = beyondModules.map(([name, description, status]) => `
    <article>
      <span>${escapeHtml(status)}</span>
      <strong>${escapeHtml(name)}</strong>
      <p>${escapeHtml(description)}</p>
    </article>
  `).join("");

  document.getElementById("benchmarkList").innerHTML = benchmarkSystems.map(([name, insight]) => `
    <article>
      <strong>${escapeHtml(name)}</strong>
      <p>${escapeHtml(insight)}</p>
    </article>
  `).join("");
}

function canAccessControlTower() {
  if (isExplicitlySignedOut()) return false;
  return isRepresentativeProfile() || hasProfilePermission("controlTower") || hasProfilePermission("siteControl");
}

function canAccessAllWorklogs() {
  if (isExplicitlySignedOut()) return false;
  return isRepresentativeProfile() || hasProfilePermission("worklogAll") || hasProfilePermission("controlTower");
}

function canAccessWorklogOverview() {
  if (isExplicitlySignedOut()) return false;
  return canAccessAllWorklogs() || hasProfilePermission("worklogSite") || hasProfilePermission("siteControl");
}

function canAccessAllLabor() {
  if (isExplicitlySignedOut()) return false;
  return isRepresentativeProfile() || hasProfilePermission("laborAll") || hasProfilePermission("controlTower");
}

function canAccessSiteLabor() {
  if (isExplicitlySignedOut()) return false;
  return canAccessAllLabor() || hasProfilePermission("laborSite") || isProfileApproved();
}

function canAccessLaborPayrollLedgers() {
  if (isExplicitlySignedOut()) return false;
  return canAccessAllLabor() || hasProfilePermission("laborSite") || hasProfilePermission("staffManage");
}

function canOpenLaborSection() {
  if (isExplicitlySignedOut()) return false;
  return canAccessAllLabor() || hasProfilePermission("laborSite");
}

function canAccessStaffSection() {
  if (isExplicitlySignedOut()) return false;
  return isRepresentativeProfile() || hasProfilePermission("staffManage");
}

function canAccessPremiumOperations() {
  if (isExplicitlySignedOut()) return false;
  return isRepresentativeProfile() || hasProfilePermission("controlTower") || hasProfilePermission("siteControl");
}

function canAccessManualCoachingAdmin() {
  if (isExplicitlySignedOut()) return false;
  return isRepresentativeProfile() || hasProfilePermission("staffManage") || hasProfilePermission("controlTower");
}

function getWorklogSiteGroups() {
  return [
    { id: "fitness", title: "비욘드 피트니스", view: "fitness-log", employeeIds: fitnessEmployeeIds },
    { id: "bangju", title: "(주)방주", view: "bangju-log", employeeIds: bangjuWorklogEmployeeIds },
    { id: "beyond", title: "(주)비욘드컴퍼니", view: "beyond-log", employeeIds: beyondWorklogEmployeeIds },
  ];
}

function getWorklogOverviewGroups() {
  return [
    { id: "bangju", label: "방주", title: "(주)방주", view: "bangju-log", employeeIds: getAssignedWorklogEmployeeIds(bangjuWorklogEmployeeIds) },
    { id: "beyond", label: "비욘드 컴퍼니", title: "(주)비욘드컴퍼니", view: "beyond-log", employeeIds: getAssignedWorklogEmployeeIds(beyondWorklogEmployeeIds) },
    { id: "fitness", label: "피트니스", title: "비욘드 피트니스", view: "fitness-log", employeeIds: getFitnessOverviewEmployeeIds() },
  ];
}

function getFitnessOverviewEmployeeIds() {
  const seen = new Set();
  return getFitnessCenterEmployees()
    .map(getEmployeeWorklogId)
    .filter((employeeId) => {
      if (!employeeId || seen.has(employeeId)) return false;
      seen.add(employeeId);
      return true;
    });
}

function getOverviewGroupEmployeeEntries(group) {
  const source = group.id === "fitness"
    ? getFitnessCenterEmployees()
    : getStaffDirectoryEmployees().filter((employee) => getStaffSiteGroupForEmployee(employee)?.id === group.id);
  const seen = new Set();
  return source
    .filter(isAssignedWorklogEmployee)
    .filter((employee) => !isRepresentativeWorklogEmployee(employee))
    .map((employee) => ({ employeeId: getEmployeeWorklogId(employee), employee }))
    .filter(({ employeeId }) => {
      if (!employeeId || seen.has(employeeId)) return false;
      seen.add(employeeId);
      return true;
    })
    .sort((a, b) => (
      (group.id === "fitness" ? getOverviewFitnessEmployeeRank(a.employee) : getOverviewRoleRank(a.employee))
      - (group.id === "fitness" ? getOverviewFitnessEmployeeRank(b.employee) : getOverviewRoleRank(b.employee))
      || getEmployeeAdminLabel(a.employee).localeCompare(getEmployeeAdminLabel(b.employee), "ko")
    ));
}

function getOverviewFitnessEmployeeRank(employee = {}) {
  const source = `${employee.id || ""} ${employee.mappedEmployeeId || ""} ${employee.name || ""} ${employee.nickname || ""} ${employee.email || ""} ${employee.role || ""}`.toLowerCase();
  if (/beyond-fitness-manager|박주홍|센터장/.test(source)) return 10;
  if (/fitness-trainer-1|홍현규/.test(source)) return 20;
  if (/fitness-info-shinsemin|신세민|tpals2990/.test(source)) return 30;
  if (/fitness-weekday-info-idabin|이다빈/.test(source)) return 40;
  if (/fitness-info-kimyoungchae|김영채|yckim1558/.test(source)) return 50;
  if (/트레이너|trainer/.test(source)) return 25;
  if (/주중/.test(source)) return 35;
  if (/토요|토요일/.test(source)) return 45;
  if (/일요|일요일/.test(source)) return 55;
  return 90;
}

function getOverviewRoleRank(employee = {}) {
  const role = `${employee.role || ""} ${employee.position || ""} ${employee.primaryWork || ""}`.toLowerCase();
  const ranks = [
    [/대표|회장|사장|ceo|owner/, 10],
    [/부사장|전무|상무|임원|이사/, 20],
    [/본부장|총괄/, 30],
    [/실장|센터장|소장/, 40],
    [/부장/, 50],
    [/차장/, 60],
    [/과장/, 70],
    [/팀장|매니저|manager/, 80],
    [/대리/, 90],
    [/주임|반장/, 100],
    [/트레이너|trainer/, 110],
    [/인포|데스크|front/, 120],
  ];
  return ranks.find(([pattern]) => pattern.test(role))?.[1] || 200;
}

function getOverviewScheduledWorkHours(employee = {}, dateKey = getActiveDateKey(), dayLog = {}) {
  const override = normalizeWorkHoursText(dayLog?.workHoursOverride || "");
  if (override) return override;
  const weeklyHours = employee.weeklyWorkHours || employee.weekly_work_hours || {};
  const dayKey = getWorkdayKey(dateKey);
  if (Object.keys(weeklyHours).length && !Object.prototype.hasOwnProperty.call(weeklyHours, dayKey)) return "휴무";
  return normalizeWorkHoursText(weeklyHours[dayKey] || employee.workHours || defaultProfile.workHours);
}

function hasOverviewWorklogRecord(dayLog = {}) {
  const ops = { ...createFitnessOps(), ...(dayLog.fitnessOps || {}) };
  return Boolean(
    String(dayLog.report || dayLog.memo || dayLog.record || "").trim()
    || (dayLog.tasks || []).some(isActiveTask)
    || (dayLog.schedule || []).some((entry) => String(getScheduleEntryText(entry) || "").trim())
    || Object.entries(ops).some(([key, value]) => !["shiftNote", "specialReport"].includes(key) && numberValue(value))
    || String(ops.shiftNote || ops.specialReport || "").trim()
  );
}

function getOverviewWorkStatus(employee = {}, dayLog = {}, dateKey = getActiveDateKey(), now = new Date()) {
  const hours = getOverviewScheduledWorkHours(employee, dateKey, dayLog);
  const attendance = String(dayLog.attendanceStatus || "");
  const today = formatDateKey(now);
  const hasAttendanceRecord = Boolean(
    dayLog.clockIn
    || dayLog.clockOut
    || attendance
    || (dayLog.attendanceBreaks || []).some((record) => record?.start || record?.end)
  );
  const hasWorklogRecord = hasOverviewWorklogRecord(dayLog);
  if (isOffWorkHours(hours) || /비번|휴무/.test(attendance)) return { key: "off", label: "비번", detail: "휴무" };
  if (/결근|결석/.test(attendance)) return { key: "absent", label: "결근", detail: hours || "근무시간 미정" };
  if (dateKey < today) {
    if (hasAttendanceRecord || hasWorklogRecord) {
      const recordLabel = hasWorklogRecord ? "업무일지 작성" : "출결 기록";
      return { key: "worked", label: "근무함", detail: `${hours || "근무시간 미정"} · ${recordLabel}` };
    }
    return { key: "unrecorded", label: "미기록", detail: `${hours || "근무시간 미정"} · 근무기록 없음` };
  }
  if (/외출/.test(attendance) && dayLog.clockIn && !dayLog.clockOut) {
    return { key: "away", label: "외출중", detail: hours || "근무시간 미정" };
  }
  if (dayLog.clockOut || /퇴근|조퇴/.test(attendance)) return { key: "done", label: /조퇴/.test(attendance) ? "조퇴" : "근무종료", detail: hours || "근무시간 미정" };
  if (dayLog.clockIn || /출근/.test(attendance)) {
    return { key: "working", label: "근무중", detail: hours || "근무시간 미정" };
  }
  if (dateKey > today) return { key: "scheduled", label: "근무예정", detail: hours || "근무시간 미정" };
  const match = String(hours || "").match(/(\d{2}):(\d{2})\s*[-~]\s*(\d{2}):(\d{2})/);
  if (match) {
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = Number(match[1]) * 60 + Number(match[2]);
    const endMinutes = Number(match[3]) * 60 + Number(match[4]);
    if (currentMinutes < startMinutes) return { key: "scheduled", label: "근무예정", detail: hours };
    if (currentMinutes <= endMinutes) {
      return hasWorklogRecord
        ? { key: "working", label: "근무중", detail: `${hours} · 업무일지 작성 중` }
        : { key: "unconfirmed", label: "근무시간", detail: `${hours} · 출결 미기록` };
    }
    if (hasWorklogRecord) return { key: "unconfirmed", label: "퇴근 미기록", detail: `${hours} · 업무일지 작성` };
    return { key: "unconfirmed", label: "출결 미기록", detail: hours };
  }
  return hasWorklogRecord
    ? { key: "working", label: "근무중", detail: "업무일지 작성 중" }
    : { key: "scheduled", label: "근무일", detail: hours || "근무시간 미정" };
}

function renderOverviewWorkStatus(status = {}) {
  return `
    <div class="overview-work-status" data-shift-status="${escapeAttr(status.key || "scheduled")}">
      <b>${escapeHtml(status.label || "근무일")}</b>
      <span>${escapeHtml(status.detail || "근무시간 미정")}</span>
    </div>
  `;
}

function getOverviewCommonCompanyKey(group = {}) {
  return { bangju: "bangju", beyond: "beyond-company", fitness: "beyond-fitness" }[group.id] || "bangju";
}

function getOverviewCommonItems(group = {}, dateKey = getActiveDateKey()) {
  const companyKey = getOverviewCommonCompanyKey(group);
  const week = state.companyCommonWeeks?.[companyKey]?.[getActiveWeekKey(dateKey)] || {};
  const sectionItems = ["departmentMonthly", "departmentWeekly"]
    .flatMap((sectionId) => week.sections?.[sectionId] || []);
  const dailyItems = week.days?.[dateKey] || [];
  const seen = new Set();
  return [...sectionItems, ...dailyItems]
    .filter((item) => item?.text?.trim() && (!item.dateKey || item.dateKey === dateKey))
    .filter((item) => {
      const key = item.id || `${item.text}|${item.owner || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => Number(Boolean(a.done)) - Number(Boolean(b.done)) || String(a.text).localeCompare(String(b.text), "ko"));
}

function renderOverviewCommonSheet({ group, dateKey, dateLabel }) {
  const items = getOverviewCommonItems(group, dateKey);
  const done = items.filter((item) => item.done).length;
  return `
    <article class="worklog-overview-employee-sheet overview-common-sheet ${group.id === "fitness" ? "is-fitness-sheet" : ""}" data-overview-site="${escapeAttr(group.id)}">
      <header class="overview-sheet-head overview-common-head">
        <div>
          <span>${escapeHtml(dateLabel)} · 맨 왼쪽 고정</span>
          <h3>공통항목</h3>
          <p>${escapeHtml(group.title)} · 완료 ${done}/${items.length}</p>
        </div>
        <button type="button" data-overview-common="${escapeAttr(group.id)}" data-overview-view="${escapeAttr(group.view)}">열기</button>
      </header>
      <section class="overview-common-summary">
        <strong>사업장 공통 실행일정</strong>
        <span>직원 개인 업무일지보다 먼저 확인합니다.</span>
      </section>
      <ul class="overview-common-list">
        ${items.length ? items.slice(0, 12).map((item) => `
          <li class="${item.done ? "is-done" : ""}">
            <b>${item.done ? "완료" : item.eventStatus || "예정"}</b>
            <span>${escapeHtml(item.text)}</span>
            <em>${escapeHtml(item.owner || "담당 미정")}</em>
          </li>
        `).join("") : `<li class="is-empty"><span>등록된 공통항목이 없습니다.</span></li>`}
      </ul>
    </article>
  `;
}

function getActiveWorklogOverviewScope() {
  const scope = state.worklogOverviewScope || "all";
  const normalized = ["all", "bangju", "beyond", "fitness"].includes(scope) ? scope : "all";
  if (canAccessAllWorklogs()) return normalized;
  return getStaffSiteGroupForEmployee(getProfileEmployee())?.id || "bangju";
}

function getFilteredWorklogOverviewGroups() {
  const scope = getActiveWorklogOverviewScope();
  const groups = getWorklogOverviewGroups();
  return scope === "all" ? groups : groups.filter((group) => group.id === scope);
}

function updateWorklogOverviewModebar() {
  const scope = getActiveWorklogOverviewScope();
  document.querySelectorAll("[data-overview-scope]").forEach((button) => {
    const allowed = canAccessAllWorklogs() || button.dataset.overviewScope === scope;
    button.hidden = !allowed;
    button.disabled = !allowed;
    button.classList.toggle("is-active", button.dataset.overviewScope === scope);
    button.setAttribute("aria-pressed", String(button.dataset.overviewScope === scope));
  });
}

function getOverviewSiteSummary(group, dateKey) {
  const entries = getOverviewGroupEmployeeEntries(group);
  const employeeCount = entries.length;
  const logs = entries.map(({ employeeId }) => state.employeeLogs?.[dateKey]?.[employeeId]).filter(Boolean);
  const worklogCount = logs.filter(hasOverviewWorklogRecord).length;
  const attendanceSignals = logs.filter((log) => /결석|지각|조퇴|미기록/.test(formatAttendanceSummary(log) || log.attendanceStatus || "")).length;
  if (group.id === "fitness") {
    const paidPt = logs.reduce((sum, log) => {
      const ops = { ...createFitnessOps(), ...(log.fitnessOps || {}) };
      return sum + numberValue(ops.ptRegular) + numberValue(ops.ptOther);
    }, 0);
    return `직원 ${employeeCount}명 · 일지 ${worklogCount}건 · 유료PT ${paidPt}건`;
  }
  return `직원 ${employeeCount}명 · 일지 ${worklogCount}건 · 확인 ${attendanceSignals}건`;
}

function getOverviewFitnessOps(log) {
  syncFitnessOpsFromSchedule(log);
  const ops = { ...createFitnessOps(), ...(log.fitnessOps || {}) };
  const paidPt = numberValue(ops.ptRegular) + numberValue(ops.ptOther);
  const freePt = numberValue(ops.ptFree);
  const contract = numberValue(ops.customerNew) + numberValue(ops.customerRenewal) + numberValue(ops.dayPass);
  const marketing = numberValue(ops.outbound) + numberValue(ops.outsideSales);
  return { ops, paidPt, freePt, contract, marketing };
}

function buildOverviewDirectiveSuggestion(employee, log, context = {}) {
  const reportText = context.reportText ?? getOverviewReportText(log);
  const scheduleCount = context.scheduleCount ?? (log.schedule || []).filter((item) => getScheduleEntryText(item)).length;
  const tasks = context.tasks || (log.tasks || []).filter(isActiveTask);
  const attendance = context.attendance ?? formatAttendanceSummary(log) ?? "";
  if (/결석|지각|조퇴|미기록/.test(attendance)) return "출결 기록을 먼저 확인하고, 사유와 복귀/보완 계획을 업무보고에 남겨주세요.";
  if (!reportText) return "오늘 업무보고에 완료사항, 이슈, 지원요청을 3줄로 정리해 주세요.";
  if (!tasks.length) return "오늘 핵심 업무 1건을 우선업무에 올리고 완료 조건을 함께 적어주세요.";
  if (!scheduleCount) return "시간별 일정에 실제 실행 시간을 2칸 이상 배치해 주세요.";
  if (fitnessEmployeeIds.includes(employee.id)) return "오늘 상담, 유료PT, 무료PT, 시설관리 기록을 업무요약에 반영해 주세요.";
  return `${employee.role || "담당자"} 기준으로 오늘 가장 중요한 후속조치 1건을 정해서 마감 시간을 붙여주세요.`;
}

function renderOverviewDirectivePanel(employee, log, employeeId, context = {}) {
  if (!canAccessWorklogOverview()) return "";
  const directives = Array.isArray(log.directives) ? log.directives.slice(-3) : [];
  const suggestion = buildOverviewDirectiveSuggestion(employee, log, context);
  return `
    <section class="overview-directive-panel" aria-label="대표 업무지시">
      <header>
        <span>대표 업무지시</span>
        <button type="button" data-overview-directive-suggest="${escapeAttr(employeeId)}">AI 제안</button>
      </header>
      <div class="overview-directive-list">
        ${directives.length ? directives.map((item) => `
          <article data-directive-status="${escapeAttr(item.status || "지시")}">
            <b>${escapeHtml(item.status || "지시")}</b>
            <p>${escapeHtml(item.text || "")}</p>
          </article>
        `).join("") : `<p class="overview-directive-empty">${escapeHtml(suggestion)}</p>`}
      </div>
      <div class="overview-directive-compose">
        <input type="text" data-overview-directive-input="${escapeAttr(employeeId)}" placeholder="직접 업무지시 입력" />
        <button type="button" data-overview-directive-add="${escapeAttr(employeeId)}">지시</button>
      </div>
    </section>
  `;
}

function getOverviewActiveTasks(log) {
  const active = (log.tasks || []).filter((task) => String(task.text || "").trim());
  return (active.length ? active : log.tasks || []).slice(0, active.length ? 8 : 3);
}

function getOverviewScheduleRows(log) {
  const filled = (log.schedule || []).filter((item) => getScheduleEntryText(item));
  const base = filled.length ? filled : log.schedule || [];
  if (!filled.length) return base.slice(0, 3);
  if (fitnessEmployeeIds.includes(log?.employeeId)) return base;
  return base.slice(0, 12);
}

function getOverviewReportText(log) {
  return String(log.report || log.memo || log.record || "").trim();
}

function formatPhoneNumber(value = "") {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("02")) {
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    if (digits.length <= 9) return `${digits.slice(0, 2)}-${digits.slice(2, digits.length - 4)}-${digits.slice(-4)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
}

function isPhoneField(field) {
  const fieldName = field?.dataset?.profileField || field?.dataset?.settingsProfileField || field?.dataset?.approvalField || "";
  return fieldName === "phone" || field?.type === "tel";
}

function buildEmployeeInsightAlerts(employee, log, context = {}) {
  if (!canAccessWorklogOverview()) return [];
  const tasks = context.tasks || (log.tasks || []).filter(isActiveTask);
  const scheduleRows = log.schedule || [];
  const scheduleCount = context.scheduleCount ?? scheduleRows.filter((item) => getScheduleEntryText(item)).length;
  const reportText = context.reportText ?? getOverviewReportText(log);
  const attendance = context.attendance ?? formatAttendanceSummary(log) ?? "";
  const taskText = tasks.map((task) => task.text || "").join(" ");
  const scheduleText = scheduleRows.map((item) => getScheduleEntryText(item)).join(" ");
  const combined = `${reportText} ${taskText} ${scheduleText}`;
  const doneCount = tasks.filter((task) => task.done || task.status === "완료").length;
  const postponedCount = tasks.filter((task) => ["연기", "위임", "보류"].includes(task.status)).length;
  const alerts = [];
  const add = (tone, title, body) => {
    if (!alerts.some((item) => item.title === title)) alerts.push({ tone, title, body });
  };

  if (/결석|지각|조퇴|퇴근 미기록|출결 미기록|미기록/.test(attendance)) {
    add("warn", "근태 확인", "출결 기록 또는 근무 흐름을 대표 확인 대상으로 올립니다.");
  }
  if (!reportText && tasks.length === 0 && scheduleCount === 0) {
    add("warn", "업무일지 공백", "오늘 업무보고, 주요업무, 시간표가 비어 있어 작성 독려가 필요합니다.");
  }
  if (/실수|누락|클레임|민원|불만|사고|고장|지연|미납|미수|위험/.test(combined)) {
    add("warn", "주의 신호", "고객, 시설, 금전 또는 처리 지연 관련 단어가 감지되었습니다.");
  }
  if (doneCount > 0 || /완료|해결|개선|계약|상담|PT|피티|재등록|청소|점검|정리/.test(combined)) {
    add("praise", "진전 포착", "완료, 상담, 계약, 현장 개선 등 칭찬 가능한 실행 흔적이 있습니다.");
  }
  if (postponedCount > 0) {
    add("coach", "재배치 필요", "연기, 위임, 보류 업무는 후속 담당자와 마감일을 다시 확인하세요.");
  }
  if (/건강|병원|휴가|가족|면담|컨디션|개인|변화/.test(combined)) {
    add("care", "개인 변화", "신변 또는 컨디션 관련 표현이 있어 배려와 면담 여부를 확인합니다.");
  }
  if (tasks.length >= 2 && scheduleCount >= 3 && reportText) {
    add("steady", "매뉴얼 안정", "우선업무, 시간표, 보고가 함께 기록되어 운영 루틴이 안정적입니다.");
  }
  if (!alerts.length) {
    add("coach", "성장 코칭", `${employee.position || employee.role || "직원"} 역할 기준으로 오늘 핵심 업무 1건을 먼저 명확히 잡으세요.`);
  }
  return alerts.slice(0, 3);
}

function renderOverviewInsightPanel(employee, log, context = {}) {
  const alerts = buildEmployeeInsightAlerts(employee, log, context);
  if (!alerts.length) return "";
  const urgentCount = alerts.filter((item) => item.tone === "warn").length;
  const label = urgentCount ? `확인 ${urgentCount}` : "정상 추적";
  return `
    <section class="overview-insight-panel" aria-label="대표 열람 직원 특이사항">
      <header>
        <span>AI 직원 신호</span>
        <strong>${escapeHtml(label)}</strong>
      </header>
      <div>
        ${alerts.map((item) => `
          <article data-tone="${escapeAttr(item.tone)}">
            <b>${escapeHtml(item.title)}</b>
            <p>${escapeHtml(item.body)}</p>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function getRepresentativeAnalysisRoleTrack(employee = {}) {
  const source = `${employee.org || ""} ${employee.workplace || ""} ${employee.role || ""} ${employee.position || ""} ${employee.primaryWork || ""}`;
  if (/대표|총괄|CEO|owner/i.test(source)) return "executive";
  if (/재무|자금|회계|세무/.test(source)) return "finance";
  if (/센터장|피트니스|트레이너|인포|PT|상담|계약/i.test(source)) return "fitness";
  if (/TBA|욕실|바스|인테리어|시공|현장|공사/i.test(source)) return "project";
  if (/공유|오피스|창고|WorkBase|WorkBox/i.test(source)) return "shared";
  return "operator";
}

function getExistingEmployeeLogForAnalysis(employee = {}, dateKey = getActiveDateKey()) {
  const logs = state.employeeLogs?.[dateKey] || {};
  const ids = new Set([
    employee.id,
    employee.mappedEmployeeId,
    getEmployeeWorklogId(employee),
    ...getEmployeeWorklogAliases(employee),
    ...(getRepresentativeAnalysisRoleTrack(employee) === "fitness" ? getFitnessEmployeeLogCandidateIds(employee) : []),
  ].filter(Boolean));
  const candidates = [...ids].map((id) => logs[id]).filter(Boolean);
  return candidates.find(hasSubmittableWorklogContent) || candidates[0] || null;
}

function getRepresentativeAnalysisDateKeys(endDateKey = getActiveDateKey(), days = 30) {
  const safeEndKey = endDateKey > todayKey ? todayKey : endDateKey;
  const end = parseDateKey(safeEndKey);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(end);
    date.setDate(end.getDate() - (days - index - 1));
    return formatDateKey(date);
  });
}

function buildRepresentativeEmployeeAnalysis(employee = {}, endDateKey = getActiveDateKey()) {
  const dateKeys = getRepresentativeAnalysisDateKeys(endDateKey, 30);
  const track = getRepresentativeAnalysisRoleTrack(employee);
  const trackProfile = getGrowthTrackProfile(track);
  const rows = dateKeys.map((dateKey) => {
    const log = getExistingEmployeeLogForAnalysis(employee, dateKey) || {};
    const hours = getOverviewScheduledWorkHours(employee, dateKey, log);
    const off = isOffWorkHours(hours) || /비번|휴무/.test(String(log.attendanceStatus || ""));
    const isPast = dateKey < todayKey;
    const attendanceRecorded = hasAttendanceRecord(log);
    const attendanceStatus = attendanceRecorded ? getAttendanceStatusForLog(employee, log, dateKey, parseDateKey(dateKey)) : "미기록";
    const tasks = (log.tasks || []).filter((task) => String(task.text || "").trim());
    const completed = tasks.filter((task) => task.done || task.status === "완료").length;
    const schedule = (log.schedule || []).filter((entry) => String(getScheduleEntryText(entry) || "").trim());
    const reportText = String(log.report || log.memo || log.record || "").trim();
    const worklogRecorded = hasOverviewWorklogRecord(log);
    const combined = `${tasks.map((task) => task.text).join(" ")} ${schedule.map(getScheduleEntryText).join(" ")} ${reportText}`;
    const ops = { ...createFitnessOps(), ...(log.fitnessOps || {}) };
    const fitnessActions = ["ptRegular", "ptFree", "ptOther", "consultation", "customerNew", "customerRenewal", "outbound", "outsideSales"]
      .reduce((sum, key) => sum + numberValue(ops[key]), 0);
    const rolePattern = {
      finance: /자금|회계|세무|증빙|급여|마감|정산|계약/,
      fitness: /PT|피티|상담|회원|재등록|청소|시설|센터/,
      project: /현장|공정|품질|원가|도면|시공|공사|안전/,
      shared: /입주|공실|임대|계약|고객|공간|청결|민원/,
      executive: /판단|위임|지시|검토|승인|전략|매출/,
      operator: /완료|점검|정리|보고|개선|고객/,
    }[track];
    return {
      dateKey,
      off,
      isPast,
      attendanceRecorded,
      attendanceStatus,
      attendanceMissing: !off && isPast && !attendanceRecorded,
      late: /지각/.test(attendanceStatus),
      early: /조퇴/.test(attendanceStatus),
      absent: /결근|결석/.test(String(log.attendanceStatus || "")),
      worklogRecorded,
      tasks: tasks.length,
      completed,
      scheduleRecorded: schedule.length > 0,
      reportRecorded: Boolean(reportText),
      reportLength: reportText.length,
      learningEvidence: /개선|학습|연습|훈련|피드백|매뉴얼|배운|보완/.test(combined),
      roleEvidence: fitnessActions > 0 || rolePattern.test(combined),
    };
  });
  const eligibleRows = rows.filter((row) => !row.off && (row.isPast || row.attendanceRecorded || row.worklogRecorded));
  const scheduledDays = eligibleRows.length;
  const attendanceDays = eligibleRows.filter((row) => row.attendanceRecorded).length;
  const normalDays = eligibleRows.filter((row) => row.attendanceRecorded && !row.late && !row.early && !row.absent).length;
  const missingAttendanceDays = eligibleRows.filter((row) => row.attendanceMissing).length;
  const lateDays = eligibleRows.filter((row) => row.late).length;
  const earlyDays = eligibleRows.filter((row) => row.early).length;
  const absentDays = eligibleRows.filter((row) => row.absent).length;
  const worklogDays = eligibleRows.filter((row) => row.worklogRecorded).length;
  const reportDays = eligibleRows.filter((row) => row.reportRecorded).length;
  const scheduleDays = eligibleRows.filter((row) => row.scheduleRecorded).length;
  const taskTotal = eligibleRows.reduce((sum, row) => sum + row.tasks, 0);
  const completedTotal = eligibleRows.reduce((sum, row) => sum + row.completed, 0);
  const learningDays = eligibleRows.filter((row) => row.learningEvidence).length;
  const roleEvidenceDays = eligibleRows.filter((row) => row.roleEvidence).length;
  const evidenceDays = eligibleRows.filter((row) => row.attendanceRecorded || row.worklogRecorded).length;
  const ratio = (value, total) => total ? value / total : 0;
  const attendanceRate = ratio(attendanceDays, scheduledDays);
  const punctualityRate = ratio(normalDays, attendanceDays);
  const worklogRate = ratio(worklogDays, scheduledDays);
  const completionRate = ratio(completedTotal, taskTotal);
  const scheduleRate = ratio(scheduleDays, scheduledDays);
  const reportRate = ratio(reportDays, Math.max(1, worklogDays));
  const learningRate = ratio(learningDays, Math.max(1, worklogDays));
  const roleRate = ratio(roleEvidenceDays, Math.max(1, worklogDays));
  const evidenceFactor = Math.min(1, evidenceDays / 8);
  const rawScores = [
    completionRate * 55 + worklogRate * 25 + reportRate * 20,
    scheduleRate * 50 + punctualityRate * 30 + completionRate * 20,
    reportRate * 50 + worklogRate * 30 + learningRate * 20,
    roleRate * 50 + completionRate * 30 + worklogRate * 20,
    learningRate * 50 + reportRate * 25 + completionRate * 25,
  ];
  const competencyScores = trackProfile.competencies.map((name, index) => ({
    name,
    score: clampScore((rawScores[index] || 0) * evidenceFactor),
  }));
  const overallScore = scheduledDays ? clampScore(competencyScores.reduce((sum, item) => sum + item.score, 0) / competencyScores.length) : 0;
  const sortedCompetencies = [...competencyScores].sort((a, b) => b.score - a.score);
  const strongest = sortedCompetencies[0];
  const summarizeExecutionWindow = (windowRows) => {
    const activeRows = windowRows.filter((row) => !row.off && (row.isPast || row.attendanceRecorded || row.worklogRecorded));
    const evidenceRows = activeRows.filter((row) => row.attendanceRecorded || row.worklogRecorded);
    const windowTasks = activeRows.reduce((sum, row) => sum + row.tasks, 0);
    const windowCompleted = activeRows.reduce((sum, row) => sum + row.completed, 0);
    const windowWorklogRate = ratio(activeRows.filter((row) => row.worklogRecorded).length, activeRows.length);
    const windowCompletionRate = ratio(windowCompleted, windowTasks);
    const windowScheduleRate = ratio(activeRows.filter((row) => row.scheduleRecorded).length, activeRows.length);
    return {
      evidenceDays: evidenceRows.length,
      score: clampScore((windowWorklogRate * 0.45 + windowCompletionRate * 0.4 + windowScheduleRate * 0.15) * 100),
    };
  };
  const recentExecution = summarizeExecutionWindow(rows.slice(-7));
  const previousExecution = summarizeExecutionWindow(rows.slice(-14, -7));
  const executionTrendAvailable = recentExecution.evidenceDays >= 2 && previousExecution.evidenceDays >= 2;
  const executionTrendDelta = executionTrendAvailable ? recentExecution.score - previousExecution.score : 0;
  const attention = [];
  if (missingAttendanceDays) attention.push(`근태 미기록 ${missingAttendanceDays}일을 확인하세요.`);
  if (lateDays || earlyDays || absentDays) attention.push(`지각 ${lateDays}일 · 조퇴 ${earlyDays}일 · 결근확정 ${absentDays}일입니다.`);
  if (scheduledDays >= 3 && worklogRate < 0.7) attention.push(`업무일지 작성률 ${Math.round(worklogRate * 100)}%로 기록 보완이 필요합니다.`);
  if (taskTotal && completionRate < 0.6) attention.push(`우선업무 완료율 ${Math.round(completionRate * 100)}%로 미완료 원인을 확인하세요.`);
  if (worklogDays >= 3 && reportRate < 0.5) attention.push("업무보고·회고 기록을 보강하면 역량 분석 정확도가 높아집니다.");
  if (!attention.length) attention.push("최근 기록에서 즉시 확인할 근태·실행 위험 신호가 없습니다.");
  const periodStart = dateKeys[0]?.slice(5).replace("-", ".") || "";
  const periodEnd = dateKeys.at(-1)?.slice(5).replace("-", ".") || "";
  return {
    employee,
    trackProfile,
    periodLabel: `${periodStart}–${periodEnd}`,
    scheduledDays,
    evidenceDays,
    attendanceDays,
    normalDays,
    missingAttendanceDays,
    lateDays,
    earlyDays,
    absentDays,
    worklogDays,
    reportDays,
    taskTotal,
    completedTotal,
    attendanceRate,
    punctualityRate,
    worklogRate,
    completionRate,
    competencyScores,
    overallScore,
    strongest,
    recentExecutionScore: recentExecution.score,
    previousExecutionScore: previousExecution.score,
    executionTrendAvailable,
    executionTrendDelta,
    attention: attention.slice(0, 2),
    confidenceLabel: evidenceDays >= 8 ? "분석 가능" : evidenceDays >= 3 ? "추세 확인" : "자료 축적 중",
  };
}

function renderRepresentativeEmployeeAnalysis(viewName = activeView) {
  const fitnessView = viewName === "fitness-log";
  const panel = document.getElementById(fitnessView ? "fitnessRepresentativeEmployeeAnalysis" : "representativeEmployeeAnalysis");
  if (!panel) return;
  const fitnessPage = fitnessView ? getCurrentFitnessLogPage() : null;
  const employee = fitnessView ? fitnessPage?.employee : getSelectedEmployee();
  const visible = Boolean(canAccessWorklogOverview() && employee && (!fitnessView || fitnessPage?.type === "employee"));
  panel.hidden = !visible;
  if (!visible) {
    panel.innerHTML = "";
    return;
  }
  const model = buildRepresentativeEmployeeAnalysis(employee, getActiveDateKey());
  const percent = (value) => `${Math.round(value * 100)}%`;
  panel.innerHTML = `
    <header class="representative-analysis-head">
      <div>
        <span>Employee Performance Lens</span>
        <strong>근태·역량 분석</strong>
        <small>${escapeHtml(model.periodLabel)} · 최근 30일 업무기록 기준</small>
      </div>
      <b data-confidence="${escapeAttr(model.confidenceLabel)}">${escapeHtml(model.confidenceLabel)}</b>
    </header>
    <div class="representative-analysis-kpis" aria-label="직원 근태 및 실행 지표">
      <article><span>근태 기록</span><strong>${model.attendanceDays}/${model.scheduledDays}</strong><em>미기록 ${model.missingAttendanceDays}일</em></article>
      <article><span>정시 기록</span><strong>${model.attendanceDays ? percent(model.punctualityRate) : "–"}</strong><em>지각 ${model.lateDays} · 조퇴 ${model.earlyDays}</em></article>
      <article><span>업무일지</span><strong>${model.worklogDays}/${model.scheduledDays}</strong><em>작성률 ${percent(model.worklogRate)}</em></article>
      <article><span>업무 실행</span><strong>${model.completedTotal}/${model.taskTotal}</strong><em>완료율 ${model.taskTotal ? percent(model.completionRate) : "–"}</em></article>
    </div>
    <div class="representative-analysis-body">
      <section class="representative-competency-panel">
        <header><strong>${escapeHtml(model.trackProfile.title)}</strong><em>종합 ${model.overallScore}</em></header>
        <div>
          ${model.competencyScores.map((item) => `
            <label>
              <span>${escapeHtml(item.name)}</span>
              <i><b style="--analysis-score:${item.score}%"></b></i>
              <em>${item.score}</em>
            </label>
          `).join("")}
        </div>
      </section>
      <section class="representative-analysis-guidance">
        <article data-tone="strength">
          <span>관찰된 강점</span>
          <strong>${escapeHtml(model.strongest?.name || "자료 축적 중")}</strong>
          <p>${model.evidenceDays >= 3 ? `현재 기록에서 가장 안정적인 역량 신호는 ${escapeHtml(model.strongest?.name || "업무 실행")}입니다.` : "업무일지가 3일 이상 쌓이면 역할별 강점 흐름을 표시합니다."}</p>
        </article>
        <article data-tone="attention">
          <span>대표 확인 포인트</span>
          ${model.attention.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}
        </article>
      </section>
    </div>
    <footer>업무일지와 출결 기록을 바탕으로 한 운영 참고자료입니다. ‘미기록’은 결근 판정이 아니며 실제 근태 확인 후 판단하세요.</footer>
  `;
}

function detectRepresentativeEmployeeSignals(model = {}, dateKey = getActiveDateKey()) {
  const employee = model.employee || {};
  const dayLog = model.dayLog || getExistingEmployeeLogForAnalysis(employee, dateKey) || {};
  const analysis = buildRepresentativeEmployeeAnalysis(employee, dateKey);
  const taskText = (dayLog.tasks || []).map((task) => task.text || "").join(" ");
  const scheduleText = (dayLog.schedule || []).map((entry) => getScheduleEntryText(entry)).join(" ");
  const reportText = String(dayLog.report || dayLog.memo || dayLog.record || "");
  const combined = `${taskText} ${scheduleText} ${reportText}`;
  const signals = [];
  const add = (level, category, title, evidence, action) => {
    const key = `${level}:${category}`;
    if (!signals.some((item) => item.key === key)) signals.push({ key, level, category, title, evidence, action });
  };

  if (/결근|결석/.test(String(dayLog.attendanceStatus || ""))) {
    add("critical", "근태", "확정 근태 신호", `${formatShortDate(dateKey)} 업무일지에 결근 또는 결석 상태가 기록되었습니다.`, "사유와 복귀 계획을 확인하고 노무 기록과 대조하세요.");
  }
  if (/사고|부상|안전사고|화재|누전|파손|분실|도난/.test(combined)) {
    add("critical", "안전·운영", "즉시 확인할 운영 위험", "당일 업무기록에서 사고·안전·시설 손상 관련 표현이 감지되었습니다.", "현장 사실관계를 확인하고 책임자·조치기한을 지정하세요.");
  }
  if (/민원|클레임|환불|분쟁|미수|미납|과오납/.test(combined)) {
    add("warning", "고객·금전", "고객 또는 금전 처리 신호", "민원·환불·미수 등 후속 확인이 필요한 표현이 기록되었습니다.", "처리 담당자와 완료 기준을 지정하고 다음 보고에서 결과를 확인하세요.");
  }
  if (analysis.missingAttendanceDays >= 3) {
    add("warning", "근태", "근태 기록 반복 누락", `최근 30일 근무 예정일 중 근태 미기록이 ${analysis.missingAttendanceDays}일입니다.`, "실제 근무 여부를 확인한 뒤 누락된 출결만 정정하도록 요청하세요.");
  }
  if (analysis.lateDays + analysis.earlyDays >= 2) {
    add("warning", "근태", "지각·조퇴 반복 신호", `최근 30일 지각 ${analysis.lateDays}일, 조퇴 ${analysis.earlyDays}일이 기록되었습니다.`, "근무시간과 사유를 확인하고 반복 원인에 대한 면담 여부를 판단하세요.");
  }
  if (analysis.scheduledDays >= 5 && analysis.worklogRate < 0.5) {
    add("warning", "기록 습관", "업무일지 작성 저하", `최근 30일 업무일지 작성률이 ${Math.round(analysis.worklogRate * 100)}%입니다.`, "업무 수행 여부와 기록 누락을 구분해 확인하고 최소 기록 기준을 안내하세요.");
  }
  if (analysis.taskTotal >= 4 && analysis.completionRate < 0.5) {
    add("warning", "업무 실행", "우선업무 완료율 저하", `등록 업무 ${analysis.taskTotal}건 중 ${analysis.completedTotal}건이 완료 처리되었습니다.`, "미완료 원인을 업무량·우선순위·지원 필요로 나눠 확인하세요.");
  }
  if (analysis.executionTrendAvailable && analysis.executionTrendDelta <= -25) {
    add("warning", "업무 흐름", "최근 실행 흐름 급감", `최근 7일 실행지수가 직전 7일보다 ${Math.abs(analysis.executionTrendDelta)}점 낮아졌습니다.`, "일시적 업무변화인지 장애요인인지 확인하고 필요한 지원을 배치하세요.");
  }
  if (analysis.evidenceDays >= 5 && analysis.reportDays / Math.max(1, analysis.worklogDays) < 0.4) {
    add("watch", "보고 역량", "보고·회고 근거 부족", `업무일지 작성 ${analysis.worklogDays}일 중 보고·메모 기록은 ${analysis.reportDays}일입니다.`, "완료사항·문제·다음 행동을 한 줄씩 기록하도록 코칭하세요.");
  }
  if (analysis.evidenceDays >= 5 && analysis.overallScore < 35) {
    add("watch", "역량 근거", "역량 판단 근거 부족", `역할별 역량지수가 ${analysis.overallScore}점이며 기록 근거가 고르지 않습니다.`, "능력 저하로 단정하지 말고 실제 성과와 업무 난이도를 함께 확인하세요.");
  }
  if (!signals.length && analysis.evidenceDays < 3) {
    add("watch", "데이터", "분석 자료 축적 중", `최근 30일 확인 가능한 업무·근태 기록이 ${analysis.evidenceDays}일입니다.`, "최소 3일 이상 기록 후 추세를 판단하세요.");
  }
  return signals.map((signal) => ({
    ...signal,
    employee,
    employeeId: model.employeeId || getEmployeeWorklogId(employee) || employee.id,
    view: model.group?.view || getStaffSiteGroupForEmployee(employee)?.view || "bangju-log",
    analysis,
  }));
}

function buildRepresentativeSignalReport(groups = getWorklogOverviewGroups(), dateKey = getActiveDateKey()) {
  const reports = groups.flatMap((group) => getOverviewGroupEmployeeEntries(group).flatMap(({ employeeId, employee }) => {
    const model = getOverviewEmployeeSummaryModel(group, employeeId, employee, dateKey);
    return detectRepresentativeEmployeeSignals(model, dateKey);
  }));
  const levelOrder = { critical: 0, warning: 1, watch: 2 };
  reports.sort((a, b) => (levelOrder[a.level] ?? 9) - (levelOrder[b.level] ?? 9)
    || getOverviewRoleRank(a.employee) - getOverviewRoleRank(b.employee)
    || String(a.employee.name || "").localeCompare(String(b.employee.name || ""), "ko"));
  const employeeLevels = new Map();
  reports.forEach((item) => {
    const current = employeeLevels.get(item.employeeId);
    if (!current || (levelOrder[item.level] ?? 9) < (levelOrder[current] ?? 9)) employeeLevels.set(item.employeeId, item.level);
  });
  const counts = { critical: 0, warning: 0, watch: 0 };
  employeeLevels.forEach((level) => { counts[level] += 1; });
  return { reports, counts, employeeLevels };
}

function renderRepresentativeSignalReportBoard(groups, dateKey) {
  const report = buildRepresentativeSignalReport(groups, dateKey);
  const visibleReports = report.reports.slice(0, 8);
  const totalEmployees = groups.reduce((sum, group) => sum + getOverviewGroupEmployeeEntries(group).length, 0);
  const signaledEmployees = report.employeeLevels.size;
  const normalEmployees = Math.max(0, totalEmployees - signaledEmployees);
  const levelLabel = { critical: "긴급", warning: "주의", watch: "관찰" };
  return `
    <section class="representative-signal-report" aria-label="직원 이상신호 자동 보고">
      <header>
        <div>
          <span>Employee Signal Report</span>
          <strong>직원 이상신호 자동 보고</strong>
          <p>근태·업무일지·완료율·최근 실행변화를 함께 감지해 대표 확인 순서로 정리합니다.</p>
        </div>
        <em>${escapeHtml(formatShortDate(dateKey))} 기준</em>
      </header>
      <div class="representative-signal-summary" aria-label="이상신호 요약">
        <article data-level="critical"><span>긴급</span><strong>${report.counts.critical}</strong><em>즉시 확인</em></article>
        <article data-level="warning"><span>주의</span><strong>${report.counts.warning}</strong><em>원인 확인</em></article>
        <article data-level="watch"><span>관찰</span><strong>${report.counts.watch}</strong><em>추세 확인</em></article>
        <article data-level="normal"><span>정상</span><strong>${normalEmployees}</strong><em>특이신호 없음</em></article>
      </div>
      <div class="representative-signal-list">
        ${visibleReports.length ? visibleReports.map((item) => `
          <article data-level="${escapeAttr(item.level)}">
            <div class="representative-signal-person">
              <span>${escapeHtml(levelLabel[item.level] || "관찰")} · ${escapeHtml(item.category)}</span>
              <strong>${escapeHtml(getEmployeeAdminLabel(item.employee))}</strong>
              <em>${escapeHtml(item.employee.workplace || item.employee.org || "사업장 미지정")}</em>
            </div>
            <div class="representative-signal-copy">
              <strong>${escapeHtml(item.title)}</strong>
              <p>${escapeHtml(item.evidence)}</p>
              <small>${escapeHtml(item.action)}</small>
            </div>
            <button type="button" data-overview-employee="${escapeAttr(item.employeeId)}" data-overview-view="${escapeAttr(item.view)}">업무일지 열기</button>
          </article>
        `).join("") : `
          <div class="representative-signal-empty">
            <strong>확인할 이상신호가 없습니다.</strong>
            <span>근태와 업무 실행 기록이 정상 범위입니다.</span>
          </div>
        `}
      </div>
      <footer>자동 보고는 인사평가나 징계 판정이 아닙니다. 기록 누락·업무 난이도·실제 상황을 직원과 확인한 뒤 판단하세요.</footer>
    </section>
  `;
}

function renderOverviewTaskMini(task) {
  return `
    <li class="overview-task-mini ${task.done || task.status === "완료" ? "is-done" : ""}">
      <p>${escapeHtml(task.text || "업무 내용")}</p>
    </li>
  `;
}

function renderOverviewScheduleMini(item) {
  const text = getScheduleEntryText(item);
  return `
    <li class="overview-schedule-mini ${text ? "is-filled" : ""}">
      <time>${escapeHtml(item.time || "")}</time>
      <p>${escapeHtml(text || "일정")}</p>
    </li>
  `;
}

function renderOverviewFitnessOpenButton(employeeId, view, label = "열기") {
  return `
    <button type="button" class="overview-fitness-open-button" data-overview-employee="${escapeAttr(employeeId)}" data-overview-view="${escapeAttr(view)}" aria-label="${escapeAttr(label)}">
      <span>+</span>
    </button>
  `;
}

function renderOverviewFitnessSummary(log) {
  const { ops, paidPt, freePt, contract, marketing } = getOverviewFitnessOps(log);
  const memoState = ops.shiftNote || ops.specialReport ? "메모 있음" : "메모 없음";
  return `
    <section class="overview-fitness-summary" aria-label="업무요약">
      <header>
        <span>업무요약</span>
        <strong>${escapeHtml(memoState)}</strong>
      </header>
      <div>
        <span><b>유료PT</b><strong>${paidPt}</strong></span>
        <span><b>무료PT</b><strong>${freePt}</strong></span>
        <span><b>상담</b><strong>${numberValue(ops.consultation)}</strong></span>
        <span><b>계약</b><strong>${contract}</strong></span>
        <span><b>홍보</b><strong>${marketing}</strong></span>
      </div>
    </section>
  `;
}

function renderOverviewFitnessCenterSheet({ group, dateKey, dateLabel }) {
  const entries = getOverviewGroupEmployeeEntries(group);
  const rows = entries.map(({ employeeId, employee }, index) => {
    const log = getEmployeeLogForDate(employeeId, dateKey);
    const { ops, paidPt, freePt, contract, marketing } = getOverviewFitnessOps(log);
    return {
      index,
      employee,
      attendance: formatAttendanceSummary(log) || log.attendanceStatus || "출결 미기록",
      clock: `${log.clockIn || "--"} ~ ${log.clockOut || "--"}`,
      paidPt,
      freePt,
      consultation: numberValue(ops.consultation),
      contract,
      marketing,
      note: ops.specialReport || ops.shiftNote || getOverviewReportText(log) || "기록 대기",
    };
  });
  const presentCount = rows.filter((row) => !/결석|미기록/.test(row.attendance)).length;
  const reportReadyCount = rows.filter((row) => row.note && row.note !== "기록 대기").length;
  const signalCount = rows.filter((row) => /결석|미기록|기록 대기|확인/.test(`${row.attendance} ${row.note}`)).length;
  const totals = rows.reduce((sum, row) => ({
    paidPt: sum.paidPt + row.paidPt,
    freePt: sum.freePt + row.freePt,
    consultation: sum.consultation + row.consultation,
    contract: sum.contract + row.contract,
    marketing: sum.marketing + row.marketing,
  }), { paidPt: 0, freePt: 0, consultation: 0, contract: 0, marketing: 0 });
  return `
    <article class="worklog-overview-employee-sheet overview-fitness-center-sheet overview-fitness-ops-compact is-fitness-sheet" data-overview-site="${escapeAttr(group.id)}">
      <header class="overview-sheet-head overview-fitness-ops-head">
        <div>
          <span>${escapeHtml(dateLabel)} · 센터운영현황</span>
          <h3>비욘드 피트니스 운영일지</h3>
          <p>출결 · 수업 · 상담 · 특이사항 취합</p>
        </div>
        <button type="button" data-overview-fitness-center>열기</button>
      </header>
      <section class="overview-center-kpis overview-center-kpis-primary" aria-label="피트니스 센터 운영 합계">
        <span><b>출결</b><strong>${presentCount}/${rows.length}</strong><em>기록 직원</em></span>
        <span><b>유료PT</b><strong>${totals.paidPt}</strong><em>무료 ${totals.freePt}</em></span>
        <span><b>고객</b><strong>${totals.consultation}</strong><em>상담</em></span>
        <span><b>계약</b><strong>${totals.contract}</strong><em>전환</em></span>
        <span><b>신호</b><strong>${signalCount}</strong><em>확인 필요</em></span>
      </section>
      <section class="overview-fitness-roster overview-fitness-roster-compact" aria-label="피트니스 직원 운영 취합">
        <header>
          <span>전직원 운영 취합</span>
          <strong>보고 ${reportReadyCount}/${rows.length}</strong>
        </header>
        <div>
          ${rows.map((row) => `
            <article>
              <div>
                <b>${escapeHtml(getEmployeeAdminLabel(row.employee))}</b>
                <em>${escapeHtml(row.attendance)} · ${escapeHtml(row.clock)}</em>
              </div>
              <p><span>유료 ${row.paidPt}</span><span>무료 ${row.freePt}</span><span>상담 ${row.consultation}</span><span>계약 ${row.contract}</span></p>
              <small>${escapeHtml(row.note)}</small>
            </article>
          `).join("")}
        </div>
      </section>
    </article>
  `;
}

function renderOverviewFitnessEmployeeSheet({ group, employee, employeeId, index, dayLog, context }) {
  const activeTasks = getOverviewActiveTasks(dayLog);
  const scheduleRows = getOverviewScheduleRows(dayLog);
  const visibleTasks = activeTasks.length
    ? activeTasks
    : Array.from({ length: 3 }, () => ({ priority: "?", text: "업무 내용", status: "예정" }));
  const visibleSchedule = scheduleRows.length ? scheduleRows : getWorklogScheduleSlots(dayLog).map((time) => ({ time, text: "일정" }));
  const fitnessSummary = renderOverviewFitnessSummary(dayLog);
  const insightPanel = renderOverviewInsightPanel(employee, dayLog, context);
  const directivePanel = renderOverviewDirectivePanel(employee, dayLog, employeeId, context);
  return `
    <article class="worklog-overview-employee-sheet projected-worklog-sheet is-fitness-sheet is-fitness-projection is-fitness-native-projection" data-overview-site="${escapeAttr(group.id)}">
      <header class="overview-sheet-head overview-fitness-native-head">
        <div>
          <span>${escapeHtml(employee.role || "직원")} · 직급순 ${index + 1}</span>
          <h3>${escapeHtml(getEmployeeAdminLabel(employee))}</h3>
          ${renderOverviewWorkStatus(context.workStatus)}
          <p>${escapeHtml(context.attendance)}</p>
        </div>
        <button type="button" data-overview-employee="${escapeAttr(employeeId)}" data-overview-view="${escapeAttr(group.view)}">열기</button>
      </header>
      ${fitnessSummary}
      ${insightPanel}
      ${directivePanel}
      <section class="overview-fitness-native-panel overview-fitness-task-native">
        <header>
          <div>
            <i aria-hidden="true"></i>
            <h4>오늘의 우선업무</h4>
            <em>${context.done}/${context.tasks.length || 0}</em>
          </div>
          ${renderOverviewFitnessOpenButton(employeeId, group.view, "오늘의 우선업무 열기")}
          <button type="button" class="overview-native-ai" aria-label="AI 코칭" disabled>AI</button>
        </header>
          <ul>
            ${visibleTasks.slice(0, 8).map(renderOverviewTaskMini).join("")}
          </ul>
      </section>
      <section class="overview-fitness-native-panel overview-fitness-schedule-native">
        <header>
          <div>
            <i aria-hidden="true"></i>
            <h4>시간별일정</h4>
            <em>${context.scheduleCount}</em>
          </div>
          ${renderOverviewFitnessOpenButton(employeeId, group.view, "시간별일정 열기")}
          <span class="overview-native-unit">1시간</span>
          <button type="button" class="overview-native-ai" aria-label="AI 코칭" disabled>AI</button>
        </header>
          <ul>
            ${visibleSchedule.slice(0, 14).map(renderOverviewScheduleMini).join("")}
          </ul>
      </section>
      <section class="overview-report-panel overview-fitness-report-panel">
        <span>업무보고</span>
        <p>${escapeHtml(context.reportText || "오늘 보고 내용이 아직 없습니다.")}</p>
      </section>
    </article>
  `;
}

function renderOverviewEmployeeSheet({ group, employee, employeeId, index, dayLog, context }) {
  const isFitness = group.id === "fitness";
  if (isFitness) {
    return renderOverviewFitnessEmployeeSheet({ group, employee, employeeId, index, dayLog, context });
  }
  const activeTasks = getOverviewActiveTasks(dayLog);
  const scheduleRows = getOverviewScheduleRows(dayLog);
  const insightPanel = renderOverviewInsightPanel(employee, dayLog, context);
  const directivePanel = renderOverviewDirectivePanel(employee, dayLog, employeeId, context);
  return `
    <article class="worklog-overview-employee-sheet projected-worklog-sheet" data-overview-site="${escapeAttr(group.id)}">
      <header class="overview-sheet-head">
        <div>
          <span>${escapeHtml(employee.role || "직원")} · 직급순 ${index + 1}</span>
          <h3>${escapeHtml(getEmployeeAdminLabel(employee))}</h3>
          ${renderOverviewWorkStatus(context.workStatus)}
          <p>${escapeHtml(context.attendance)}</p>
        </div>
        <button type="button" data-overview-employee="${escapeAttr(employeeId)}" data-overview-view="${escapeAttr(group.view)}">열기</button>
      </header>
      ${insightPanel}
      ${directivePanel}
      <section class="overview-report-panel">
        <span>업무보고</span>
        <p>${escapeHtml(context.reportText || "오늘 보고 내용이 아직 없습니다.")}</p>
      </section>
      <div class="overview-sheet-body">
        <section class="projected-task-panel">
          <h4>주요업무 <em>${context.done}/${context.tasks.length || 0}</em></h4>
          <ul>
            ${(activeTasks.length ? activeTasks : [{ priority: "?", text: "업무 내용", status: "예정" }]).map(renderOverviewTaskMini).join("")}
          </ul>
        </section>
        <section class="projected-schedule-panel">
          <h4>시간별 일정 <em>${context.scheduleCount}</em></h4>
          <ul>
            ${scheduleRows.map(renderOverviewScheduleMini).join("")}
          </ul>
        </section>
      </div>
    </article>
  `;
}

function getOverviewEmployeeSummaryModel(group, employeeId, employee, dateKey) {
  const dayLog = getEmployeeLogForDate(employeeId, dateKey);
  const tasks = (dayLog.tasks || []).filter(isActiveTask);
  const done = tasks.filter((task) => task.done || task.status === "완료").length;
  const scheduleCount = (dayLog.schedule || []).filter((item) => getScheduleEntryText(item)).length;
  const attendance = formatAttendanceSummary(dayLog) || dayLog.attendanceStatus || "출결 미기록";
  const workStatus = getOverviewWorkStatus(employee, dayLog, dateKey);
  const reportText = getOverviewReportText(dayLog);
  const ops = { ...createFitnessOps(), ...(dayLog.fitnessOps || {}) };
  const paidPt = numberValue(ops.ptRegular) + numberValue(ops.ptOther);
  const hasWorklogRecord = hasOverviewWorklogRecord(dayLog);
  const signalCount = [
    /결석|지각|조퇴|미기록/.test(attendance),
    !reportText,
    tasks.length === 0,
    scheduleCount === 0,
  ].filter(Boolean).length;
  return {
    group,
    employee,
    employeeId,
    dayLog,
    tasks,
    done,
    scheduleCount,
    attendance,
    workStatus,
    reportText,
    hasWorklogRecord,
    paidPt,
    signalCount,
  };
}

function getOverviewSignalTone(model) {
  if (model.signalCount >= 2) return "risk";
  if (model.signalCount === 1) return "watch";
  return "good";
}

function getOverviewSignalLabel(model) {
  const tone = getOverviewSignalTone(model);
  if (tone === "risk") return "확인";
  if (tone === "watch") return "점검";
  return "정상";
}

function renderOverviewBusinessSnapshot({ group, dateKey, dateLabel }) {
  const models = getOverviewGroupEmployeeEntries(group).map(({ employeeId, employee }) => getOverviewEmployeeSummaryModel(group, employeeId, employee, dateKey));
  const employeeCount = models.length;
  const worklogCount = models.filter((model) => model.hasWorklogRecord).length;
  const riskCount = models.filter((model) => getOverviewSignalTone(model) === "risk").length;
  const done = models.reduce((sum, model) => sum + model.done, 0);
  const taskTotal = models.reduce((sum, model) => sum + model.tasks.length, 0);
  const scheduleCount = models.reduce((sum, model) => sum + model.scheduleCount, 0);
  const paidPt = models.reduce((sum, model) => sum + model.paidPt, 0);
  const metricLabel = group.id === "fitness" ? "유료PT" : "일정";
  const metricValue = group.id === "fitness" ? `${paidPt}건` : `${scheduleCount}건`;
  const rows = models.map((model, index) => `
    <li class="overview-person-row is-${escapeAttr(getOverviewSignalTone(model))}">
      <span>${String(index + 1).padStart(2, "0")}</span>
      <strong>${escapeHtml(getEmployeeAdminLabel(model.employee))}</strong>
      <em>${escapeHtml(model.hasWorklogRecord ? "작성" : "미작성")}</em>
      <em class="overview-person-shift" data-shift-status="${escapeAttr(model.workStatus.key)}" title="${escapeAttr(model.workStatus.detail)}">${escapeHtml(model.workStatus.label)}</em>
      <button type="button" data-overview-employee="${escapeAttr(model.employeeId)}" data-overview-view="${escapeAttr(group.view)}">열기</button>
    </li>
  `).join("");
  return `
    <article class="overview-business-snapshot ${riskCount ? "is-risk" : "is-calm"}" data-overview-site="${escapeAttr(group.id)}">
      <header class="overview-business-header">
        <div>
          <span>${escapeHtml(dateLabel)} · ${escapeHtml(group.label)}</span>
          <h3>${escapeHtml(group.title)}</h3>
          <p>${escapeHtml(getOverviewSiteSummary(group, dateKey))}</p>
        </div>
        <button type="button" class="overview-business-action" data-overview-filter-scope="${escapeAttr(group.id)}">사업장 보기</button>
      </header>
      <div class="overview-business-metrics">
        <span><b>${employeeCount}</b><small>직원</small></span>
        <span><b>${worklogCount}/${employeeCount}</b><small>일지</small></span>
        <span><b>${taskTotal ? `${done}/${taskTotal}` : "0/0"}</b><small>업무</small></span>
        <span><b>${metricValue}</b><small>${metricLabel}</small></span>
      </div>
      <div class="overview-signal-line">
        <strong>${riskCount ? `대표 확인 ${riskCount}명` : "운영 신호 정상"}</strong>
        <span>${riskCount ? "미작성, 출결, 일정 공백을 먼저 확인하세요." : "직원 업무 흐름이 안정적으로 기록되고 있습니다."}</span>
      </div>
      <ul class="overview-person-list">
        ${rows || `<li class="overview-person-empty">등록된 직원이 없습니다.</li>`}
      </ul>
    </article>
  `;
}

function renderOverviewAllScopeBoard(groups, dateKey, dateLabel) {
  const models = groups.flatMap((group) => getOverviewGroupEmployeeEntries(group).map(({ employeeId, employee }) => getOverviewEmployeeSummaryModel(group, employeeId, employee, dateKey)));
  const totalEmployees = models.length;
  const worklogCount = models.filter((model) => model.hasWorklogRecord).length;
  const riskCount = models.filter((model) => getOverviewSignalTone(model) === "risk").length;
  const taskTotal = models.reduce((sum, model) => sum + model.tasks.length, 0);
  const doneTotal = models.reduce((sum, model) => sum + model.done, 0);
  const scheduleTotal = models.reduce((sum, model) => sum + model.scheduleCount, 0);
  const paidPt = models.reduce((sum, model) => sum + model.paidPt, 0);
  const improvements = [
    "미작성 직원 먼저 확인",
    "출결 미기록 즉시 보완",
    "시간표 공백 업무지시",
    "피트니스 PT 실적 추적",
    "대표 개입사항만 선별",
    "사업장별 담당자 확인",
    "공통일정 이월 점검",
    "업무일지 품질 확인",
    "노무자료 누락 방지",
    "내일 우선업무 예약",
  ];
  return `
    <section class="overview-all-command">
      <div>
        <span>Executive Worklog Radar</span>
        <h3>전사업장 오늘 현황</h3>
        <p>${escapeHtml(dateLabel)} 기준 · 사업장별 직원 업무일지와 실행 신호를 한눈에 봅니다.</p>
      </div>
      <button type="button" data-view="executive">대표경영</button>
    </section>
    <section class="overview-all-kpis" aria-label="전사업장 핵심지표">
      <article><span>전체 직원</span><strong>${totalEmployees}명</strong><em>승인·배정 기준</em></article>
      <article><span>업무일지</span><strong>${worklogCount}/${totalEmployees}</strong><em>오늘 작성</em></article>
      <article class="${riskCount ? "is-alert" : ""}"><span>확인 신호</span><strong>${riskCount}명</strong><em>출결·공백·미작성</em></article>
      <article><span>주요업무</span><strong>${doneTotal}/${taskTotal || 0}</strong><em>완료/전체</em></article>
      <article><span>시간일정</span><strong>${scheduleTotal}건</strong><em>배치된 일정</em></article>
      <article><span>피트니스</span><strong>${paidPt}건</strong><em>유료PT</em></article>
    </section>
    ${renderRepresentativeSignalReportBoard(groups, dateKey)}
    <section class="overview-improvement-strip" aria-label="오늘 개선 10">
      <strong>오늘 개선 10</strong>
      <div>${improvements.map((item, index) => `<span>${String(index + 1).padStart(2, "0")} ${escapeHtml(item)}</span>`).join("")}</div>
    </section>
    <section class="overview-all-business-board">
      ${groups.map((group) => renderOverviewBusinessSnapshot({ group, dateKey, dateLabel })).join("")}
    </section>
  `;
}

function setupWorklogOverviewInteractions(grid, dateKey) {
  grid.querySelectorAll("[data-overview-filter-scope]").forEach((button) => {
    button.addEventListener("click", () => {
      state.worklogOverviewScope = button.dataset.overviewFilterScope || "all";
      saveState({ fastSave: true });
      renderWorklogOverview();
      updateWorklogOverviewModebar();
    });
  });
  grid.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.view) switchView(button.dataset.view);
    });
  });
  grid.querySelectorAll("[data-overview-fitness-center]").forEach((button) => {
    button.addEventListener("click", () => {
      state.fitnessLogPage = 0;
      state.fitnessLogPageId = "fitness-center";
      saveState({ fastSave: true });
      switchView("fitness-log");
    });
  });
  grid.querySelectorAll("[data-overview-common]").forEach((button) => {
    button.addEventListener("click", () => {
      const group = getWorklogOverviewGroups().find((item) => item.id === button.dataset.overviewCommon);
      const firstEmployeeId = getOverviewGroupEmployeeEntries(group || {})[0]?.employeeId;
      if (firstEmployeeId) state.selectedEmployeeId = firstEmployeeId;
      state.selectedDateKey = dateKey;
      todayPageMode = "common";
      saveState({ fastSave: true });
      switchView(button.dataset.overviewView || group?.view || "bangju-log");
      setTodayPageMode("common");
    });
  });
  grid.querySelectorAll("[data-overview-employee]").forEach((button) => {
    button.addEventListener("click", () => {
      const requestedEmployeeId = button.dataset.overviewEmployee;
      const targetView = button.dataset.overviewView || "bangju-log";
      const employee = findEmployeeRecordById(requestedEmployeeId);
      const employeeId = getEmployeeWorklogId(employee || { id: requestedEmployeeId }) || requestedEmployeeId;
      state.selectedDateKey = dateKey;
      state.selectedEmployeeId = employeeId;
      if (targetView === "fitness-log") {
        const targetPageIndex = getFitnessLogPages().findIndex((page) => page.type === "employee" && page.id === employeeId);
        if (targetPageIndex >= 0) {
          state.fitnessLogPage = targetPageIndex;
          state.fitnessLogPageId = employeeId;
        }
      }
      saveState({ fastSave: true });
      switchView(targetView);
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  });
  grid.querySelectorAll("[data-overview-directive-add]").forEach((button) => {
    button.addEventListener("click", () => {
      const employeeId = button.dataset.overviewDirectiveAdd;
      const input = button.closest(".overview-directive-panel")?.querySelector("[data-overview-directive-input]");
      const text = String(input?.value || "").trim();
      if (!text) return;
      const log = getEmployeeLogForDate(employeeId, dateKey);
      log.directives = Array.isArray(log.directives) ? log.directives : [];
      log.directives.push({ id: `directive-${Date.now()}`, text, status: "지시", by: state.profile?.nickname || state.profile?.name || "대표", createdAt: new Date().toISOString() });
      saveState();
      renderWorklogOverview();
    });
  });
  grid.querySelectorAll("[data-overview-directive-suggest]").forEach((button) => {
    button.addEventListener("click", () => {
      const employeeId = button.dataset.overviewDirectiveSuggest;
      const employee = findEmployeeRecordById(employeeId);
      if (!employee) return;
      const log = getEmployeeLogForDate(employeeId, dateKey);
      const context = getOverviewEmployeeSummaryModel({ id: "" }, employeeId, employee, dateKey);
      log.directives = Array.isArray(log.directives) ? log.directives : [];
      log.directives.push({ id: `directive-${Date.now()}`, text: buildOverviewDirectiveSuggestion(employee, log, context), status: "AI 제안", by: "AI 업무지시 에이전트", createdAt: new Date().toISOString() });
      saveState();
      renderWorklogOverview();
    });
  });
}

function renderWorklogOverview() {
  const grid = document.getElementById("worklogOverviewGrid");
  if (!grid) return;
  updateWorklogOverviewModebar();
  if (!canAccessWorklogOverview()) {
    grid.innerHTML = `
      <article class="worklog-overview-denied">
        <strong>접근 권한이 필요합니다.</strong>
        <p>대표 또는 대표가 지정한 직원만 전 사업장 업무일지를 열람할 수 있습니다.</p>
      </article>
    `;
    return;
  }
  renderSiteWeatherBoard("overviewSiteWeatherBoard", getActiveDateKey());
  if (authState.user && hasApprovalAuthority() && !authState.approvalRowsLoaded && !authState.approvalRowsLoading) {
    authState.approvalRowsLoading = true;
    refreshStaffApprovalRows()
      .catch(() => {})
      .finally(() => {
        authState.approvalRowsLoading = false;
        if (activeView === "worklog-overview") renderWorklogOverview();
      });
  }
  const dateKey = getActiveDateKey();
  const dateLabel = formatShortDate(dateKey);
  const activeScope = getActiveWorklogOverviewScope();
  const allGroups = getWorklogOverviewGroups();
  const groups = getFilteredWorklogOverviewGroups();
  grid.classList.toggle("is-single-site", activeScope !== "all");
  grid.classList.toggle("is-overview-all", activeScope === "all");
  grid.classList.toggle("is-fitness-scope", activeScope === "fitness");
  if (activeScope === "all") {
    grid.innerHTML = renderOverviewAllScopeBoard(allGroups, dateKey, dateLabel);
    setupWorklogOverviewInteractions(grid, dateKey);
    return;
  }
  grid.innerHTML = groups.map((group) => {
    const commonCard = group.id === "fitness" ? "" : renderOverviewCommonSheet({ group, dateKey, dateLabel });
    const centerCard = group.id === "fitness" ? renderOverviewFitnessCenterSheet({ group, dateKey, dateLabel }) : "";
    const employeeCards = getOverviewGroupEmployeeEntries(group).map(({ employeeId, employee }, index) => {
      const context = getOverviewEmployeeSummaryModel(group, employeeId, employee, dateKey);
      return renderOverviewEmployeeSheet({ group, employee, employeeId, index, dayLog: context.dayLog, context });
    }).join("");
    return `
      <section class="worklog-overview-site ${activeScope === group.id ? "is-active-site" : ""}" data-overview-site="${escapeAttr(group.id)}">
        <header class="overview-site-header">
          <span>${escapeHtml(dateLabel)} · ${escapeHtml(group.label)}</span>
          <h3>${escapeHtml(group.title)}</h3>
          <p>${escapeHtml(getOverviewSiteSummary(group, dateKey))}</p>
        </header>
        <div class="overview-site-carousel">${commonCard}${centerCard}${employeeCards}</div>
      </section>
    `;
  }).join("");
  setupWorklogOverviewInteractions(grid, dateKey);
}

function renderControlTower() {
  const accessCard = document.getElementById("controlAccessCard");
  const body = document.getElementById("controlTowerBody");
  const accessLabel = document.getElementById("controlTowerAccessLabel");
  if (!body) return;
  const allowed = canAccessControlTower();
  if (accessCard) accessCard.hidden = allowed;
  body.hidden = !allowed;
  if (accessLabel) accessLabel.textContent = allowed ? "전 사업장 운영 현황 · 모니터링 중" : "대표·지정 관리자 전용";
  if (!allowed) return;
  renderSiteWeatherBoard("controlSiteWeatherBoard", getActiveDateKey());

  const assetRows = getAssetRows();
  const staffRows = getControlStaffRows();
  const siteRows = getControlSiteRows(assetRows, staffRows);
  const activeSites = assetRows.filter((row) => ["운영", "무인운영", "임대"].includes(row.status)).length;
  const presentCount = staffRows.filter((row) => row.attendanceStatus !== "미기록" && !row.attendanceStatus.includes("결석")).length;
  const issueCount = staffRows.filter((row) => row.aiSignal !== "정상").length;
  const taskTotal = staffRows.reduce((sum, row) => sum + row.taskCount, 0);
  const completedTotal = staffRows.reduce((sum, row) => sum + row.completedCount, 0);
  const fitnessOps = getFitnessOpsSummary();
  const laborControl = getLaborControlSummary();
  const operatingScore = calculateOperatingScore();
  const completionRate = taskTotal ? Math.round((completedTotal / taskTotal) * 100) : 0;
  const salesActions = fitnessOps.consultation + fitnessOps.outbound + fitnessOps.outsideSales;
  const topSignals = getControlBriefingItems({ staffRows, siteRows, fitnessOps, issueCount, taskTotal, completedTotal }).slice(0, 3);
  const focusStaff = staffRows
    .filter((row) => row.aiSignal !== "정상" || row.taskCount === 0 || row.completedCount < row.taskCount)
    .slice(0, 6);
  const kpis = [
    ["운영 사업장", `${activeSites}`, `전체 ${assetRows.length} 공간/호실`],
    ["직원 출결", `${presentCount}/${staffRows.length}`, issueCount ? `신호 ${issueCount}` : "정상 추적"],
    ["업무 기록", `${completedTotal}/${taskTotal || 0}`, taskTotal ? `${completionRate}% 완료` : "입력 대기"],
    ["피트니스 행동", `${salesActions}`, `유료PT ${fitnessOps.ptRegular + fitnessOps.ptOther}`],
    ["노무 월 마감", `${laborControl.ready}/${laborControl.total}`, laborControl.issues ? `보완 ${laborControl.issues}건` : "원장 연결"],
    ["운영 점수", `${operatingScore}점`, issueCount ? `관제 신호 ${issueCount}건` : operatingScore < 75 ? "보강 필요" : "추적 중"],
  ];
  document.getElementById("controlKpiGrid").innerHTML = kpis.map(([label, value, meta]) => `
    <article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><em>${escapeHtml(meta)}</em></article>
  `).join("");

  document.getElementById("controlBriefingList").innerHTML = topSignals.map(([title, text, level], index) => `
    <article data-level="${escapeAttr(level)}">
      <em>${String(index + 1).padStart(2, "0")}</em>
      <div><b>${escapeHtml(title)}</b><span>${escapeHtml(text)}</span></div>
    </article>
  `).join("");

  document.getElementById("controlSiteGrid").innerHTML = siteRows.slice(0, 6).map((site) => {
    const tone = site.issueCount ? "warn" : site.status === "준비" || site.status === "보류" ? "hold" : "ok";
    return `
    <article>
      <div><span>${escapeHtml(site.brand)}</span><em data-tone="${escapeAttr(tone)}">${escapeHtml(site.status)}</em></div>
      <strong>${escapeHtml(site.site)}</strong>
      <p>${escapeHtml(site.location)} · 직원 ${site.staffCount} · 신호 ${site.issueCount}</p>
    </article>
  `;
  }).join("");

  document.getElementById("controlStaffBody").innerHTML = (focusStaff.length ? focusStaff : staffRows.slice(0, 6)).map((row) => `
    <tr>
      <td>${escapeHtml(row.org)}</td>
      <td>${escapeHtml(row.role)}</td>
      <td>${escapeHtml(row.name)}</td>
      <td>${escapeHtml(row.employmentType)}</td>
      <td>${escapeHtml(row.workHours)}</td>
      <td>${escapeHtml(row.attendanceStatus)}</td>
      <td>${escapeHtml(`${row.completedCount}/${row.taskCount}`)}</td>
      <td><span data-signal="${escapeAttr(row.aiSignal)}">${escapeHtml(row.aiSignal)}</span></td>
    </tr>
  `).join("");

  document.getElementById("controlOpsGrid").innerHTML = [
    ["전사업장 업무일지", "사업장별·직원별 업무보고와 실행 현황을 그대로 투사합니다.", "현황", "worklog-overview"],
    ["직원 원장", "소속, 직함, 권한, 가입승인, 온보딩 상태를 관리합니다.", "명부", "staff"],
    ["노무 현황", "월별 근무시간, 프리랜서 유료수업, 노무비 대장을 확인합니다.", "노무", "attendance"],
    ["성장지원", "역할별 기준과 직원 성장 데이터를 확인합니다.", "성장", "ai"],
  ].map(([title, text, tag, view]) => `
    <button type="button" data-control-jump="${escapeAttr(view)}">
      <b>${escapeHtml(title)}</b><span>${escapeHtml(text)}</span><em>${escapeHtml(tag)}</em>
    </button>
  `).join("");
  document.querySelectorAll("[data-control-jump]").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.controlJump || "worklog-overview"));
  });
}

function renderExecutiveManagement() {
  const accessCard = document.getElementById("executiveAccessCard");
  const body = document.getElementById("executiveBody");
  const accessLabel = document.getElementById("executiveAccessLabel");
  if (!body) return;
  const allowed = isRepresentativeProfile();
  if (accessCard) accessCard.hidden = allowed;
  body.hidden = !allowed;
  if (accessLabel) accessLabel.textContent = allowed ? "대표 접근 중 · 오늘의 판단 · 지시 · 위임" : "대표 전용 · 의사결정과 개입사항";
  if (!allowed) return;

  const assetRows = getAssetRows();
  const staffRows = getControlStaffRows();
  const siteRows = getControlSiteRows(assetRows, staffRows);
  const fitnessOps = getFitnessOpsSummary();
  const laborControl = getLaborControlSummary();
  const taskTotal = staffRows.reduce((sum, row) => sum + row.taskCount, 0);
  const completedTotal = staffRows.reduce((sum, row) => sum + row.completedCount, 0);
  const issueRows = staffRows.filter((row) => row.aiSignal !== "정상");
  const absentRows = staffRows.filter((row) => row.aiSignal === "결석확인");
  const salesActions = fitnessOps.consultation + fitnessOps.outbound + fitnessOps.outsideSales;
  const operatingScore = calculateOperatingScore();
  const missionQueue = getMissionProposalQueue(4);
  const pendingDecisionCount = [
    taskTotal && completedTotal < taskTotal,
    issueRows.length > 0,
    salesActions === 0,
    siteRows.some((site) => site.status === "보류" || site.status === "준비"),
    missionQueue.length > 0,
  ].filter(Boolean).length;

  const kpis = [
    ["오늘 판단", `${pendingDecisionCount}건`, pendingDecisionCount ? "처리 필요" : "대기 없음", "intervention", "오늘 대표가 직접 판단하거나 위임할 항목으로 이동합니다."],
    ["대표 지시", `${Math.max(0, taskTotal - completedTotal)}건`, "미완료·후속", "tasks", "미완료 업무와 대표 지시 대기 항목으로 이동합니다."],
    ["핵심 인력", `${issueRows.length}명`, absentRows.length ? `결석 ${absentRows.length}` : "성장/주의", "people", "근태, 태도, 역량 변화 신호로 이동합니다."],
    ["전략 사업장", `${siteRows.filter((site) => site.issueCount || site.status === "보류" || site.status === "준비").length}곳`, `${operatingScore}점`, "score", "사업장 전략 우선순위로 이동합니다."],
    ["수익 행동", `${salesActions}건`, "영업·고객", "customer", "상담, 영업, 자금·수익 신호로 이동합니다."],
    ["주간 액션", `${fitnessOps.ptRegular + fitnessOps.ptOther}건`, "PT·운영", "pt", "이번 주 대표 경영 액션 보드로 이동합니다."],
  ];
  document.getElementById("executiveKpiGrid").innerHTML = kpis.map(([label, value, meta, target, title]) => `
    <button type="button" data-executive-jump="${escapeAttr(target)}" title="${escapeAttr(title)}">
      <span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><em>${escapeHtml(meta)}</em>
    </button>
  `).join("");

  const agenda = buildExecutiveAgenda({ staffRows, siteRows, fitnessOps, taskTotal, completedTotal, salesActions, operatingScore });
  const warnAgendaCount = agenda.filter((item) => item.level === "warn").length;
  setText("executiveAgendaSummary", warnAgendaCount ? `주의 ${warnAgendaCount}` : "정상");
  setText("executiveSiteSummary", `${siteRows.length}개 · 이슈 ${siteRows.reduce((sum, site) => sum + site.issueCount, 0)}`);
  setText("executiveFinanceSummary", salesActions ? `고객행동 ${salesActions}` : "영업공백");
  setText("executivePeopleSummary", issueRows.length ? `신호 ${issueRows.length}` : "정상");
  setText("executiveOrdersSummary", `업무 ${Math.max(0, taskTotal - completedTotal)} · 미션 ${missionQueue.length}`);
  setText("executiveActionSummary", `PT ${fitnessOps.ptRegular + fitnessOps.ptOther} · 주간`);
  setExecutiveSectionAlert("intervention", warnAgendaCount > 0);
  setExecutiveSectionAlert("score", operatingScore < 75 || siteRows.some((site) => site.status === "보류" || site.status === "준비"));
  setExecutiveSectionAlert("customer", salesActions === 0);
  setExecutiveSectionAlert("people", issueRows.length > 0);
  setExecutiveSectionAlert("tasks", Math.max(0, taskTotal - completedTotal) > 0);
  setExecutiveSectionAlert("pt", fitnessOps.ptFree > fitnessOps.ptRegular + fitnessOps.ptOther);
  document.getElementById("executiveAgendaList").innerHTML = agenda.map((item, index) => `
    <article data-level="${escapeAttr(item.level)}">
      <b>${String(index + 1).padStart(2, "0")}</b>
      <div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.text)}</span></div>
    </article>
  `).join("");

  document.getElementById("executiveSitePriorities").innerHTML = siteRows.slice(0, 8).map((site) => {
    const priority = site.issueCount ? "개입" : site.status === "보류" || site.status === "준비" ? "전략검토" : "유지";
    return `
      <article data-priority="${escapeAttr(priority)}">
        <div><span>${escapeHtml(site.brand)}</span><strong>${escapeHtml(site.site)}</strong></div>
        <p>${escapeHtml(site.location)}</p>
        <em>${escapeHtml(priority)} · 직원 ${site.staffCount} · 이슈 ${site.issueCount}</em>
      </article>
    `;
  }).join("");

  document.getElementById("executiveFinanceSignals").innerHTML = [
    ["자금", "재무 업무일지에서 자금·입금·지출 태그를 매일 확인하고, 지급위험은 대표 결재로 올립니다.", "확인"],
    ["매출", salesActions ? `피트니스 고객행동 ${salesActions}건이 기록됐습니다. 계약 후속업무를 추적하세요.` : "상담·아웃바운드·재등록 기록이 비어 있습니다. 오늘 영업 행동을 지정하세요.", salesActions ? "추적" : "개입"],
    ["노무", laborControl.total ? `월 마감 준비 ${laborControl.ready}/${laborControl.total}명 · 보완 ${laborControl.issues}건입니다. 직원 원장, 업무일지, 출결, PT와 지급대장을 함께 확인하세요.` : "노무 대상 직원 원장을 먼저 확인하세요.", laborControl.issues ? "확인" : "월마감"],
    ["수익", "사업장별 매출·원가·고정비 입력이 쌓이면 영업이익과 운영점수를 자동 산정합니다.", "구축"],
  ].map(([title, text, tag]) => `<article><b>${escapeHtml(title)}</b><span>${escapeHtml(text)}</span><em>${escapeHtml(tag)}</em></article>`).join("");

  document.getElementById("executivePeopleSignals").innerHTML = staffRows.slice(0, 8).map((row) => `
    <article data-signal="${escapeAttr(row.aiSignal)}">
      <strong>${escapeHtml(row.role)} ${escapeHtml(row.name)}</strong>
      <span>${escapeHtml(row.org)}</span>
      <p>출결 ${escapeHtml(row.attendanceStatus)} · 업무 ${escapeHtml(`${row.completedCount}/${row.taskCount}`)} · ${escapeHtml(row.aiSignal)}</p>
    </article>
  `).join("");

  document.getElementById("executiveOrdersList").innerHTML = [
    ["승인", `${authState.pendingApprovalCount || 0}건`, "가입승인과 권한 부여를 처리합니다."],
    ["업무", `${Math.max(0, taskTotal - completedTotal)}건`, "미완료 업무의 담당자와 마감시간을 정합니다."],
    ["AI미션", `${missionQueue.length}건`, "직원별 업무·프로젝트 제안을 검토해 업무일지에 반영합니다."],
    ["시설", `${siteRows.reduce((sum, site) => sum + site.issueCount, 0)}건`, "반복 시설·민원 이슈는 사업장 티켓으로 전환합니다."],
    ["보고", "1건", "오늘 마감 전 대표 일일보고서를 생성합니다."],
  ].map(([title, count, text]) => `<article><b>${escapeHtml(title)}</b><strong>${escapeHtml(count)}</strong><span>${escapeHtml(text)}</span></article>`).join("") + renderMissionProposalCards(missionQueue, { compact: true, showEmployee: true, allowApply: true });

  document.getElementById("executiveActionBoard").innerHTML = [
    ["月", "현금흐름·미수금·지급예정 확인"],
    ["화", "직원별 업무완료율·노무기록 점검"],
    ["수", "피트니스 매출·상담·재등록 후보 확인"],
    ["목", "공유오피스/창고 공실·계약 갱신 확인"],
    ["금", "주간 성과 리뷰·다음 주 우선순위 확정"],
    ["토", "현장/센터 운영 품질·고객경험 점검"],
    ["日", "대표 회고·AI 코칭 반영·주간 지시 작성"],
  ].map(([day, text]) => `<article><strong>${escapeHtml(day)}</strong><span>${escapeHtml(text)}</span></article>`).join("");
  setupExecutiveInteractions();
}

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = value;
}

function setExecutiveSectionAlert(sectionId, isAlert) {
  const section = document.querySelector(`[data-executive-section="${CSS.escape(sectionId)}"]`);
  if (section) section.dataset.alert = isAlert ? "true" : "false";
}

function openExecutiveSection(sectionId = "intervention") {
  document.querySelectorAll("[data-executive-section]").forEach((section) => {
    section.classList.toggle("is-open", section.dataset.executiveSection === sectionId);
  });
  const target = document.querySelector(`[data-executive-section="${CSS.escape(sectionId)}"]`);
  target?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function setupExecutiveInteractions() {
  document.querySelectorAll("[data-executive-jump]").forEach((button) => {
    button.onclick = () => openExecutiveSection(button.dataset.executiveJump || "intervention");
  });
  document.querySelectorAll("[data-executive-toggle]").forEach((header) => {
    header.onclick = () => {
      const sectionId = header.dataset.executiveToggle || "intervention";
      const section = document.querySelector(`[data-executive-section="${CSS.escape(sectionId)}"]`);
      if (section?.classList.contains("is-open")) section.classList.remove("is-open");
      else openExecutiveSection(sectionId);
    };
  });
}

function buildExecutiveAgenda({ staffRows, siteRows, fitnessOps, taskTotal, completedTotal, salesActions, operatingScore }) {
  const agenda = [];
  if (operatingScore < 75) {
    agenda.push({ title: "운영점수 보강", text: `운영점수 ${operatingScore}점입니다. 업무입력, 출결, 사업장 상태 데이터를 먼저 채우세요.`, level: "warn" });
  } else {
    agenda.push({ title: "운영 리듬 유지", text: `운영점수 ${operatingScore}점입니다. 오늘은 매출 행동과 직원 미완료만 확인하면 됩니다.`, level: "ok" });
  }
  const incomplete = Math.max(0, taskTotal - completedTotal);
  agenda.push({
    title: "미완료 업무 추적",
    text: incomplete ? `전 직원 미완료 업무 ${incomplete}건입니다. 오늘 종료 전 담당자별 마감 여부를 확인하세요.` : "오늘 등록된 업무는 모두 안정적으로 처리되고 있습니다.",
    level: incomplete ? "warn" : "ok",
  });
  const problemStaff = staffRows.filter((row) => row.aiSignal !== "정상");
  agenda.push({
    title: "직원 신호 확인",
    text: problemStaff.length ? `${problemStaff.slice(0, 3).map((row) => `${row.role} ${row.name}`).join(", ")} 업무/출결 신호를 확인하세요.` : "직원별 출결과 업무 신호는 정상 범위입니다.",
    level: problemStaff.length ? "warn" : "ok",
  });
  agenda.push({
    title: "매출 행동 지정",
    text: salesActions ? `상담·영업 행동 ${salesActions}건입니다. 계약/재등록 후속업무가 업무일지에 이어지는지 확인하세요.` : "오늘 고객 접점 행동이 비어 있습니다. 상담, 아웃바운드, 재등록 후보 연락을 지정하세요.",
    level: salesActions ? "ok" : "warn",
  });
  const holdSites = siteRows.filter((site) => site.status === "보류" || site.status === "준비");
  agenda.push({
    title: "사업장 전략 선택",
    text: holdSites.length ? `${holdSites.length}개 준비/보류 사업장의 다음 액션과 책임자를 지정하세요.` : "운영 사업장 중심으로 품질과 수익률을 추적하세요.",
    level: holdSites.length ? "warn" : "ok",
  });
  if (fitnessOps.specialReports.length) {
    agenda.push({ title: "특이사항 보고", text: `피트니스 특이사항 ${fitnessOps.specialReports.length}건이 있습니다. 민원/시설/안전 여부를 확인하세요.`, level: "warn" });
  }
  return agenda.slice(0, 6);
}

function getControlStaffRows() {
  return getEmployeeOptions().map((employee) => {
    const log = getEmployeeLogForDate(employee.id);
    const tasks = log.tasks || [];
    const taskCount = tasks.filter((task) => String(task.text || "").trim()).length;
    const completedCount = tasks.filter((task) => task.done || task.status === "완료").length;
    const attendanceStatus = getAttendanceStatusForLog(employee, log);
    const issue = tasks.some((task) => ["지원필요", "보류", "연기"].includes(task.status));
    const aiSignal = attendanceStatus.includes("결석") ? "결석확인" : issue ? "업무점검" : taskCount && completedCount < taskCount ? "진행중" : "정상";
    return {
      id: employee.id,
      org: employee.org || state.profile?.org || "(주)방주",
      role: employee.role || "직원",
      name: employee.id === "profile-user" ? state.profile?.name || employee.name : employee.name,
      employmentType: employee.employmentType || (employee.id === "profile-user" ? state.profile?.employmentType : "") || "직원",
      workHours: getEmployeeWorkHours(employee.id, state.profile, getActiveDateKey()) || "미설정",
      attendanceStatus,
      taskCount,
      completedCount,
      aiSignal,
    };
  });
}

function getLaborControlSummary() {
  const month = getActiveDateKey().slice(0, 7);
  const rows = getVisibleLaborEmployees().map((employee) => {
    const labor = buildMonthlyLaborSummary(getLaborEmployeeLogId(employee), employee, month);
    const profile = getLaborProfileForEmployee(employee);
    const elapsedScheduled = labor.dayRows.filter((row) => row.dateKey <= todayKey && row.scheduled > 0);
    const incomplete = elapsedScheduled.filter((row) => (row.clockIn && !row.clockOut) || (!row.clockIn && row.status !== "휴무" && row.status !== "예정"));
    const profileReady = Boolean(
      String(profile.employmentType || "").trim()
      && String(profile.workplace || "").trim()
      && String(profile.workHours || "").trim()
      && (numberValue(profile.hourlyWage) || numberValue(profile.dailyWage))
    );
    const ready = Boolean(labor.recordedDays && !incomplete.length && profileReady);
    return { ready, issues: incomplete.length + (profileReady ? 0 : 1) + (labor.recordedDays ? 0 : 1) };
  });
  return {
    total: rows.length,
    ready: rows.filter((row) => row.ready).length,
    issues: rows.reduce((sum, row) => sum + row.issues, 0),
  };
}

function getControlSiteRows(assetRows, staffRows) {
  return assetRows.map((row) => {
    const staffForSite = staffRows.filter((staff) => staff.org.includes(row.site) || staff.org.includes(row.brand) || row.site.includes(staff.org.split(" / ").at(-1) || ""));
    return {
      site: row.site,
      brand: row.brand,
      status: row.status,
      location: `${row.building} ${row.floor} · ${row.rooms.join(", ")}`,
      staffCount: staffForSite.length,
      issueCount: staffForSite.filter((staff) => staff.aiSignal !== "정상").length,
    };
  });
}

function buildPremiumQualityChecks({
  staffRows = [],
  issueRows = [],
  missingLogs = [],
  laborSignals = 0,
  taskTotal = 0,
  completedTotal = 0,
  salesActions = 0,
  missionQueue = [],
} = {}) {
  const selectedEmployee = getSelectedEmployee();
  const profile = state.profile || {};
  const pendingApprovals = (authState.pendingApprovalCount || 0) + (authState.pendingPasswordResetCount || 0);
  const assignedStaff = getEmployeeOptions().filter(isAssignedWorklogEmployee);
  const requiredFields = [
    ["소속", profile.org],
    ["근무지", profile.workplace],
    ["직책/직급", profile.role],
    ["근무시간", profile.workHours],
  ];
  const missingProfileFields = requiredFields.filter(([, value]) => !String(value || "").trim()).map(([label]) => label);
  const selectedLog = getSelectedLog();
  const selectedReport = String(selectedLog.report || selectedLog.memo || selectedLog.record || "").trim();
  const backupRecipient = String(state.backupSettings?.recipientEmail || "").trim();
  const completionRate = taskTotal ? Math.round((completedTotal / Math.max(1, taskTotal)) * 100) : 0;
  const checks = [
    {
      id: "account",
      title: "계정·승인",
      metric: authState.user && !isExplicitlySignedOut() ? getApprovalStatusLabel() : "로그인 필요",
      status: authState.user && !isExplicitlySignedOut() && isProfileApproved() ? "good" : "action",
      detail: authState.user && !isExplicitlySignedOut() ? "원격 계정과 직원 승인 상태를 확인했습니다." : "앱 사용 전 로그인 또는 직원등록이 필요합니다.",
      view: authState.user && !isExplicitlySignedOut() ? "settings" : "auth",
    },
    {
      id: "approval",
      title: "승인 요청",
      metric: `${pendingApprovals}건`,
      status: pendingApprovals > 0 ? "action" : "good",
      detail: pendingApprovals > 0 ? "직원등록, 정보변경, 비밀번호 재설정 요청을 먼저 처리하세요." : "대표 확인이 필요한 승인 대기 항목이 없습니다.",
      view: hasApprovalAuthority() ? "settings" : "staff",
    },
    {
      id: "profile",
      title: "직원 원장",
      metric: missingProfileFields.length ? `${missingProfileFields.length}개 보완` : `${assignedStaff.length}명`,
      status: missingProfileFields.length ? "warn" : "good",
      detail: missingProfileFields.length ? `${missingProfileFields.join(", ")} 정보가 비어 있어 업무일지·노무 연결이 약해집니다.` : "소속, 근무지, 직책, 근무시간이 업무일지 기준값으로 연결됩니다.",
      view: hasApprovalAuthority() ? "staff" : "settings",
    },
    {
      id: "worklog",
      title: "업무일지 입력",
      metric: taskTotal ? `${completionRate}%` : "입력 대기",
      status: missingLogs.length > Math.max(1, Math.floor(staffRows.length * 0.25)) ? "action" : taskTotal ? "good" : "warn",
      detail: taskTotal ? `오늘 업무 ${taskTotal}건 중 ${completedTotal}건이 완료 처리되었습니다.` : "오늘 우선업무와 시간별일정 입력을 유도해야 합니다.",
      view: hasProfilePermission("worklogAll") || hasApprovalAuthority() ? "control" : "worklog",
    },
    {
      id: "labor",
      title: "출결·노무",
      metric: `${laborSignals}건`,
      status: laborSignals > 0 ? "action" : "good",
      detail: laborSignals > 0 ? "출결 미기록 또는 결석 신호가 있어 월마감 전에 보완해야 합니다." : "오늘 출결 신호는 안정적입니다.",
      view: "attendance",
    },
    {
      id: "revenue",
      title: "수익 행동",
      metric: `${salesActions}건`,
      status: salesActions > 0 ? "good" : "warn",
      detail: salesActions > 0 ? "상담, 계약, 재등록, 홍보 행동이 업무데이터로 잡혔습니다." : "피트니스·고객 접점 행동이 비어 있으면 매출 코칭이 약해집니다.",
      view: "worklog",
    },
    {
      id: "report",
      title: "보고 품질",
      metric: selectedReport ? `${Math.min(100, selectedReport.length)}자` : "미작성",
      status: selectedReport.length >= 40 ? "good" : selectedReport ? "warn" : "action",
      detail: selectedReport.length >= 40 ? `${selectedEmployee.nickname || selectedEmployee.name} 업무보고가 코칭에 쓸 만큼 기록되어 있습니다.` : "완료사항, 이슈, 지원요청, 내일 액션을 3줄 이상 남기도록 유도하세요.",
      view: "report",
    },
    {
      id: "mission",
      title: "AI 미션",
      metric: `${missionQueue.length}건`,
      status: missionQueue.length ? "good" : "warn",
      detail: missionQueue.length ? "직원별 업무·직책·매뉴얼 기반의 다음 행동 후보가 준비되어 있습니다." : "업무와 미션 데이터가 쌓이면 직원별 코칭 정확도가 올라갑니다.",
      view: "ai",
    },
    {
      id: "backup",
      title: "보고·백업",
      metric: backupRecipient || "수신 메일 없음",
      status: backupRecipient ? "good" : "warn",
      detail: backupRecipient ? "대표 백업 수신처가 설정되어 보고서 패키지화가 가능합니다." : "대표 백업 수신처를 지정하면 일일보고와 노무자료 보존성이 높아집니다.",
      view: "report",
    },
  ];
  const score = Math.round(checks.reduce((sum, check) => {
    if (check.status === "good") return sum + 100;
    if (check.status === "warn") return sum + 62;
    return sum + 28;
  }, 0) / Math.max(1, checks.length));
  return {
    checks,
    score,
    urgentCount: checks.filter((check) => check.status === "action").length,
    warnCount: checks.filter((check) => check.status === "warn").length,
  };
}

function getBenchmarkOperatingLayers({
  staffRows = [],
  issueRows = [],
  missingLogs = [],
  laborSignals = 0,
  taskTotal = 0,
  completedTotal = 0,
  salesActions = 0,
  missionQueue = [],
  fitnessOps = {},
} = {}) {
  const assignedStaff = getEmployeeOptions().filter(isAssignedWorklogEmployee);
  const approvedStaff = assignedStaff.filter((employee) => employee.id !== "profile-user" || isProfileApproved());
  const profile = state.profile || {};
  const profileReady = Boolean(profile.org && profile.role && profile.workplace && profile.workHours);
  const backupReady = Boolean(String(state.backupSettings?.recipientEmail || "").trim());
  const fitnessActionCount = Number(fitnessOps.ptRegular || 0) + Number(fitnessOps.ptFree || 0) + Number(fitnessOps.consultation || 0) + Number(fitnessOps.customerRenewal || 0);
  const completionRate = taskTotal ? Math.round((completedTotal / Math.max(1, taskTotal)) * 100) : 0;
  return [
    {
      title: "직원 원장·권한",
      benchmark: "BambooHR · Rippling",
      metric: `${approvedStaff.length}/${assignedStaff.length || 0}명`,
      status: approvedStaff.length && profileReady ? "ready" : "attention",
      view: hasApprovalAuthority() ? "staff" : "settings",
      text: "가입승인, 소속, 직책, 근무시간, 권한을 직원 원장으로 통합해 디바이스마다 다른 직원 정보가 생기지 않게 합니다.",
      action: profileReady ? "직원 원장 유지" : "직원 기본정보 확정",
    },
    {
      title: "목표·업무 연결",
      benchmark: "Asana · Microsoft Viva",
      metric: taskTotal ? `${completionRate}%` : "입력 대기",
      status: taskTotal && completionRate >= 60 ? "ready" : "build",
      view: "worklog",
      text: "오늘 업무가 월 목표, PT·상담·계약, 대표 지시와 연결되어 업무일지가 실행관리판으로 작동합니다.",
      action: taskTotal ? "미완료 업무 추적" : "오늘 우선업무 입력",
    },
    {
      title: "자동화·승인",
      benchmark: "monday.com · ClickUp",
      metric: `${(authState.pendingApprovalCount || 0) + (authState.pendingPasswordResetCount || 0)}건`,
      status: (authState.pendingApprovalCount || 0) + (authState.pendingPasswordResetCount || 0) ? "attention" : "ready",
      view: hasApprovalAuthority() ? "settings" : "worklog",
      text: "직원등록, 정보변경, 비밀번호 재설정, 업무 확정 상태를 알림과 승인 큐로 묶습니다.",
      action: hasApprovalAuthority() ? "승인 큐 확인" : "내 요청 상태 확인",
    },
    {
      title: "현장 점검·시정",
      benchmark: "SafetyCulture · Procore",
      metric: `${issueRows.length}건`,
      status: issueRows.length ? "attention" : "ready",
      view: "control",
      text: "근태 신호, 미작성 업무, 시설·청결·고객 이슈를 대표 관제에서 바로 시정조치로 전환합니다.",
      action: issueRows.length ? "관제 신호 처리" : "정상 신호 유지",
    },
    {
      title: "수익 행동·고객",
      benchmark: "CRM · Fitness Ops",
      metric: `${salesActions + fitnessActionCount}건`,
      status: salesActions + fitnessActionCount ? "ready" : "build",
      view: "worklog",
      text: "유료PT, 무료PT, 상담, 재등록, 홍보 행동을 업무일지와 운영보고서에 동시에 반영합니다.",
      action: salesActions + fitnessActionCount ? "후속업무 연결" : "고객 행동 기록",
    },
    {
      title: "노무·보고 증빙",
      benchmark: "Rippling · Payroll Ops",
      metric: backupReady ? "보존 준비" : `${laborSignals}건 확인`,
      status: backupReady && laborSignals === 0 ? "ready" : "attention",
      view: canOpenLaborSection() ? "attendance" : "report",
      text: "출결, 근무시간, 수업 집계, 보고서 백업을 월마감과 노무 제출자료로 이어지게 합니다.",
      action: backupReady ? "월마감 검증" : "백업·노무 기준 보완",
    },
  ];
}

function renderBenchmarkOperatingLayerCards(layers = [], { compact = false } = {}) {
  return layers.map((layer, index) => `
    <button type="button" class="benchmark-layer-card is-${escapeAttr(layer.status)} ${compact ? "is-compact" : ""}" data-benchmark-jump="${escapeAttr(layer.view)}">
      <em>${String(index + 1).padStart(2, "0")}</em>
      <div>
        <span>${escapeHtml(layer.benchmark)}</span>
        <strong>${escapeHtml(layer.title)}</strong>
        <p>${escapeHtml(layer.text)}</p>
      </div>
      <b>${escapeHtml(layer.metric)}</b>
      <small>${escapeHtml(layer.action)}</small>
    </button>
  `).join("");
}

function getControlBriefingItems({ staffRows, siteRows, fitnessOps, issueCount, taskTotal, completedTotal }) {
  const incomplete = Math.max(0, taskTotal - completedTotal);
  const salesActions = fitnessOps.consultation + fitnessOps.outbound + fitnessOps.outsideSales;
  const idleSites = siteRows.filter((site) => site.status === "보류" || site.status === "준비").length;
  return [
    ["오늘 TOP 신호", issueCount ? `직원/업무 확인 신호 ${issueCount}건입니다. 결석, 연기, 미완료 업무를 먼저 확인하세요.` : "직원/업무 위험 신호는 안정적입니다.", issueCount ? "warn" : "ok"],
    ["업무 실행", taskTotal ? `전체 업무 ${taskTotal}건 중 ${completedTotal}건 완료, 미완료 ${incomplete}건입니다.` : "오늘 업무 입력이 아직 부족합니다. 각 직원의 우선업무 입력을 유도하세요.", incomplete ? "warn" : "ok"],
    ["매출/고객", salesActions ? `상담·영업 행동 ${salesActions}건, 유료 PT ${fitnessOps.ptRegular + fitnessOps.ptOther}건이 기록됐습니다.` : "상담·영업 기록이 비어 있습니다. 피트니스와 고객접점 사업장부터 입력을 요청하세요.", salesActions ? "ok" : "warn"],
    ["사업장 운영", idleSites ? `준비/보류 사업장 ${idleSites}곳은 실행계획과 담당자를 지정해야 합니다.` : "운영 사업장 상태는 정상 범위입니다.", idleSites ? "warn" : "ok"],
  ];
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getGrowthRoleTrack(employee = getSelectedEmployee()) {
  const text = `${employee.org || ""} ${employee.role || ""} ${employee.primaryWork || ""} ${state.profile?.role || ""}`;
  if (/대표|총괄|CEO|owner/i.test(text)) return "executive";
  if (/재무|자금|회계|세무/.test(text)) return "finance";
  if (/센터장|피트니스|트레이너|인포|PT|상담|계약/.test(text)) return "fitness";
  if (/TBA|욕실|바스|인테리어|시공|현장|공사/i.test(text)) return "project";
  if (/공유|오피스|창고|WorkBase|WorkBox/i.test(text)) return "shared";
  return "operator";
}

function getGrowthTrackProfile(track) {
  const profiles = {
    executive: {
      title: "대표 성장 트랙",
      focus: "판단력 · 위임 · 숫자 기반 경영",
      competencies: ["전략 판단", "위임/피드백", "숫자 감각", "문제발견", "조직 코칭"],
    },
    finance: {
      title: "재무 성장 트랙",
      focus: "정확성 · 일정준수 · 리스크 선제관리",
      competencies: ["정확성", "마감관리", "자금흐름", "증빙관리", "리스크 보고"],
    },
    fitness: {
      title: "피트니스 성장 트랙",
      focus: "고객경험 · 영업전환 · 센터 운영",
      competencies: ["고객응대", "PT/상담 전환", "운영루틴", "시설/청결", "보고/인수인계"],
    },
    project: {
      title: "프로젝트 성장 트랙",
      focus: "현장관리 · 품질 · 일정/원가",
      competencies: ["공정관리", "품질관리", "원가감각", "현장소통", "기록/증빙"],
    },
    shared: {
      title: "공유사업 성장 트랙",
      focus: "입주고객 · 공간상태 · 계약갱신",
      competencies: ["고객관리", "공간운영", "계약관리", "매출기록", "클레임 대응"],
    },
    operator: {
      title: "운영자 성장 트랙",
      focus: "업무완결 · 시간관리 · 보고 습관",
      competencies: ["우선순위", "시간관리", "완료율", "소통", "개선습관"],
    },
  };
  return profiles[track] || profiles.operator;
}

function buildPersonalGrowthModel(employee = getSelectedEmployee(), log = getSelectedLog()) {
  const tasks = (log.tasks || []).filter((task) => String(task.text || "").trim());
  const completedTasks = tasks.filter((task) => task.done || task.status === "완료");
  const scheduleEntries = (log.schedule || []).filter((entry) => getScheduleEntryText(entry));
  const attendanceRecorded = Boolean(log.clockIn || log.clockOut || (log.attendanceBreaks || []).length);
  const reportText = String(log.report || log.memo || "").trim();
  const ops = { ...createFitnessOps(), ...(log.fitnessOps || {}) };
  const salesSignals = numberValue(ops.consultation) + numberValue(ops.customerNew) + numberValue(ops.customerRenewal) + numberValue(ops.outbound) + numberValue(ops.outsideSales);
  const track = getGrowthRoleTrack(employee);
  const trackProfile = getGrowthTrackProfile(track);
  const completionRate = tasks.length ? completedTasks.length / tasks.length : 0;
  const scheduleDensity = Math.min(1, scheduleEntries.length / 5);
  const reportQuality = Math.min(1, reportText.length / 80);
  const attendanceQuality = attendanceRecorded ? 1 : 0;
  const learningEvidence = Math.min(1, (reportQuality + (tasks.some((task) => /개선|학습|연습|훈련|피드백|매뉴얼/.test(task.text)) ? 1 : 0)) / 2);
  const score = clampScore(18 + completionRate * 26 + scheduleDensity * 18 + reportQuality * 16 + attendanceQuality * 12 + learningEvidence * 10);
  const competencyScores = trackProfile.competencies.map((name, index) => {
    const base = [
      completionRate * 72 + tasks.length * 4,
      scheduleDensity * 78 + scheduleEntries.length * 2,
      reportQuality * 80 + (salesSignals ? 12 : 0),
      attendanceQuality * 70 + (scheduleEntries.length ? 10 : 0),
      learningEvidence * 76 + completedTasks.length * 3,
    ][index] || 45;
    return { name, score: clampScore(base + 12) };
  });
  const missions = [];
  if (tasks.length < 3) missions.push("오늘 우선업무를 3개 이상 적고 A/B/?로 구분하세요.");
  if (scheduleEntries.length < 3) missions.push("시간별 일정에 실제 실행 시간을 3칸 이상 배치하세요.");
  if (completionRate < 0.6) missions.push("미완료 업무 1개를 골라 완료 조건과 다음 행동을 적으세요.");
  if (!attendanceRecorded) missions.push("출결 또는 근무 시작/종료 시간을 먼저 기록하세요.");
  if (reportText.length < 40) missions.push("업무보고에 배운 점 1개와 내일 개선점 1개를 남기세요.");
  if (track === "executive") missions.push("오늘 대표가 직접 개입할 일 1개와 위임할 일 1개를 분리하세요.");
  if (track === "fitness" && !salesSignals) missions.push("상담, 재등록, 무료/유료 PT 중 하나를 숫자로 기록하세요.");
  if (track === "finance") missions.push("오늘 자금/증빙/마감 리스크를 한 줄로 점검하세요.");
  if (track === "project") missions.push("현장 품질, 일정, 원가 중 하나를 사진/메모 기준으로 남기세요.");
  if (track === "shared") missions.push("입주고객, 공실, 청결, 계약갱신 중 하나를 운영 기록으로 남기세요.");
  return {
    employee,
    track,
    trackProfile,
    score,
    tasks,
    completedTasks,
    scheduleEntries,
    reportQuality,
    attendanceRecorded,
    competencyScores,
    missions: [...new Set(missions)].slice(0, 5),
    streakLabel: `${tasks.length ? "업무 입력" : "업무 미입력"} · ${scheduleEntries.length ? "시간기록" : "시간 미기록"} · ${reportText ? "회고 있음" : "회고 없음"}`,
  };
}

function getEmployeeMissionBase(employee = getSelectedEmployee(), log = getEmployeeLogForDate(employee.id)) {
  const growth = buildPersonalGrowthModel(employee, log);
  const manual = getManualTemplateForEmployee(employee);
  const assignedMission = getAssignedMissionForEmployee(employee);
  const customMission = canRevealAssignedMission(employee, assignedMission) ? assignedMission.text : "";
  const tasks = (log.tasks || []).filter((task) => String(task.text || "").trim());
  const entries = (log.schedule || []).filter((entry) => getScheduleEntryText(entry));
  const reportText = String(log.report || log.memo || "").trim();
  const attendance = getAttendanceStatusForLog(employee, log);
  return { employee, log, growth, manual, assignedMission, customMission, tasks, entries, reportText, attendance };
}

function createMissionProposal(base, seed) {
  const employee = base.employee;
  const roleLabel = `${employee.role || "직원"} ${employee.nickname || employee.name || ""}`.trim();
  const idSource = `${employee.id}:${seed.type}:${seed.title}:${getActiveDateKey()}`;
  return {
    id: `mission-${idSource.replace(/[^a-z0-9가-힣]+/gi, "-").toLowerCase()}`,
    employeeId: employee.id,
    employeeLabel: roleLabel,
    type: seed.type || "업무",
    priority: seed.priority || "A",
    title: seed.title,
    text: seed.text,
    tip: seed.tip,
    reason: seed.reason,
    impact: seed.impact || "오늘 실행",
    taskText: seed.taskText || seed.title,
  };
}

function getMissionProposalsForEmployee(employee = getSelectedEmployee(), log = getEmployeeLogForDate(employee.id)) {
  const base = getEmployeeMissionBase(employee, log);
  const { growth, tasks, entries, reportText, attendance, customMission } = base;
  const track = growth.track;
  const proposals = [];
  const add = (seed) => proposals.push(createMissionProposal(base, seed));

  if (customMission) {
    add({
      type: "지정미션",
      priority: "A",
      title: customMission.split(/\n|\.|,/).find(Boolean)?.trim() || "대표 지정 미션 점검",
      text: "대표가 부여한 미션을 오늘 실행 가능한 업무로 쪼개어 기록합니다.",
      tip: "대표 지정 미션은 업무일지에 완료조건을 붙여야 실행 추적이 됩니다.",
      reason: "대표 지정 미션",
      impact: "대표 의도 반영",
      taskText: customMission.split(/\n/).find(Boolean)?.trim() || "대표 지정 미션 실행",
    });
  }
  if (tasks.length < 3) {
    add({
      type: "업무설계",
      priority: "A",
      title: "오늘 우선업무 3개를 먼저 확정",
      text: "현재 우선업무 입력이 부족합니다. 역할 기준으로 가장 중요한 3가지를 먼저 업무화합니다.",
      tip: "A는 오늘 반드시 끝낼 일, B는 진행할 일, ?는 대기/확인 업무로 나누세요.",
      reason: "업무일지 공백",
      impact: "실행 선명도",
      taskText: "오늘 우선업무 3개 확정 및 완료조건 작성",
    });
  }
  if (entries.length < 3) {
    add({
      type: "시간관리",
      priority: "A",
      title: "핵심업무를 시간표에 배치",
      text: "업무는 있는데 실행 시간이 비어 있으면 추적이 약합니다. 최소 3개 시간대에 실제 실행 업무를 배치합니다.",
      tip: "시간표에는 결과가 아니라 행동을 적어야 합니다. 예: 재등록 후보 5명 연락.",
      reason: "시간별 일정 부족",
      impact: "시간통제",
      taskText: "핵심업무 3건을 시간별 일정에 배치",
    });
  }
  if (/미기록|결석|지각|조퇴|퇴근/.test(attendance)) {
    add({
      type: "운영기본",
      priority: "A",
      title: "출결·근무흐름 먼저 정리",
      text: "출결 기록은 업무 신뢰도와 노무 자료의 출발점입니다. 오늘 근무 시작/종료 또는 예외 사유를 정리합니다.",
      tip: "외출, 조퇴, 프리랜서 수업도 나중에 노무/정산으로 연결됩니다.",
      reason: attendance,
      impact: "노무 정확도",
      taskText: "오늘 출결과 근무 특이사항 정리",
    });
  }
  if (reportText.length < 40) {
    add({
      type: "보고역량",
      priority: "B",
      title: "업무보고에 배운 점과 다음 행동 추가",
      text: "짧은 보고는 업무의 맥락이 사라집니다. 오늘 결과, 문제, 다음 행동을 한 줄씩 남깁니다.",
      tip: "보고는 대표가 개입할지, 위임할지, 기다릴지를 결정하는 재료입니다.",
      reason: "보고 품질 보강",
      impact: "소통 개선",
      taskText: "업무보고에 결과·문제·다음 행동 1줄씩 작성",
    });
  }

  if (track === "fitness") {
    const ops = { ...createFitnessOps(), ...(log.fitnessOps || {}) };
    const salesCount = numberValue(ops.consultation) + numberValue(ops.customerNew) + numberValue(ops.customerRenewal) + numberValue(ops.outbound) + numberValue(ops.outsideSales);
    if (!salesCount) {
      add({
        type: "매출행동",
        priority: "A",
        title: "재등록·상담 후보 3명 추적",
        text: "피트니스 업무는 고객 접점이 매출로 연결되어야 합니다. 만료예정, 무료PT, 상담 후보를 3명 이상 분류합니다.",
        tip: "무료수업은 유료전환 가능성과 다음 연락일을 같이 남기세요.",
        reason: "고객행동 기록 부족",
        impact: "매출전환",
        taskText: "재등록·상담 후보 3명 확인 및 후속 연락",
      });
    }
  } else if (track === "finance") {
    add({
      type: "리스크",
      priority: "A",
      title: "오늘 자금·증빙 리스크 점검",
      text: "지급, 입금, 세금, 증빙 누락은 대표 의사결정에 직접 영향을 줍니다. 오늘 리스크 1개를 명확히 보고합니다.",
      tip: "금액, 기한, 상대방, 필요한 결정을 같이 적으면 대표 판단이 빨라집니다.",
      reason: "재무 직무 기준",
      impact: "자금 안정",
      taskText: "오늘 자금·증빙·마감 리스크 1건 보고",
    });
  } else if (track === "project") {
    add({
      type: "프로젝트",
      priority: "A",
      title: "현장 품질·일정·원가 중 1개 점검",
      text: "TBA/시공 업무는 현장 기록이 누락되면 하자와 정산 리스크가 커집니다. 사진 또는 메모 기준으로 1개를 점검합니다.",
      tip: "변경사항은 비용, 일정 영향, 승인자를 함께 남기세요.",
      reason: "프로젝트 직무 기준",
      impact: "하자 예방",
      taskText: "현장 품질·일정·원가 체크 및 증빙 기록",
    });
  } else if (track === "shared") {
    add({
      type: "운영개선",
      priority: "A",
      title: "공실·입주고객·시설 신호 1개 개선",
      text: "공유사업은 작은 불편이 계약갱신과 공실률에 연결됩니다. 고객/공간/계약 중 하나를 개선 업무로 만듭니다.",
      tip: "공실은 홍보채널, 가격, 사진, 문의수 중 하나라도 매일 업데이트하면 원인 분석이 됩니다.",
      reason: "공유사업 직무 기준",
      impact: "고객경험",
      taskText: "공실·입주고객·시설 신호 1개 개선 실행",
    });
  } else if (track === "executive") {
    add({
      type: "경영판단",
      priority: "A",
      title: "대표 개입 1건·위임 1건 분리",
      text: "대표 업무는 모든 일을 직접 처리하는 것이 아니라 개입할 일과 맡길 일을 분리하는 데서 성과가 납니다.",
      tip: "오늘 대표가 직접 결정할 일, 직원에게 맡길 일, 기다릴 일을 3분류하세요.",
      reason: "대표 성장 트랙",
      impact: "위임력",
      taskText: "오늘 대표 개입 1건과 위임 1건 결정",
    });
  }

  return proposals
    .filter((proposal, index, list) => list.findIndex((item) => item.title === proposal.title) === index)
    .slice(0, 4);
}

function getMissionProposalQueue(limit = 8) {
  const sourceEmployees = getEmployeeOptions()
    .filter(isAssignedWorklogEmployee)
    .filter((employee) => !isRepresentativeWorklogEmployee(employee))
    .filter((employee) => !employee.id.includes("profile-user"));
  return sourceEmployees
    .flatMap((employee) => getMissionProposalsForEmployee(employee, getEmployeeLogForDate(employee.id)).slice(0, 2))
    .sort((a, b) => getPrioritySortValue(a.priority) - getPrioritySortValue(b.priority))
    .slice(0, limit);
}

function canApplyMissionToEmployee(employeeId = "") {
  if (!employeeId) return false;
  return canEditEmployeeSlot(employeeId);
}

function applyMissionProposal(proposalId) {
  const queue = [...getMissionProposalQueue(24), ...getMissionProposalsForEmployee(getSelectedEmployee(), getSelectedLog())];
  const proposal = queue.find((item) => item.id === proposalId);
  if (!proposal) return;
  const employee = getEmployeeOptions().find((item) => item.id === proposal.employeeId) || getSelectedEmployee();
  if (!canApplyMissionToEmployee(proposal.employeeId)) {
    alert("본인 업무 또는 권한이 있는 직원의 업무에만 반영할 수 있습니다.");
    return;
  }
  const log = getEmployeeLogForDate(employee.id, getActiveDateKey());
  const task = (log.tasks || []).find((item) => !String(item.text || "").trim()) || createWorklogTask(proposal.priority);
  if (!log.tasks.includes(task)) log.tasks.push(task);
  task.priority = proposal.priority || "A";
  task.text = `[AI미션] ${proposal.taskText || proposal.title}`;
  task.status = "미완료";
  task.done = false;
  task.aiProposalId = proposal.id;
  task.aiProposalType = proposal.type;
  saveState();
  renderAll();
  alert(`${getEmployeeAdminLabel(employee)} 업무일지에 AI 미션을 반영했습니다.`);
}

function getAiWorklogContextForCurrentView() {
  if (activeView === "fitness-log") {
    const page = getCurrentFitnessLogPage();
    if (page?.type !== "employee") return null;
    return {
      employee: page.employee || getEmployeeOptions().find((item) => item.id === page.id) || getSelectedEmployee(),
      log: getFitnessEmployeeLogForDate(page.employee || { id: page.id }, getActiveDateKey())
        || getEmployeeLogForDate(page.id, getActiveDateKey()),
      isFitness: true,
      canEdit: isCurrentFitnessLogEditable() && canEditCurrentWorklog("fitness-log"),
    };
  }
  const employee = getSelectedEmployee();
  return {
    employee,
    log: getSelectedLog(),
    isFitness: false,
    canEdit: canEditCurrentWorklog(activeView),
  };
}

function getActionableMissionProposal(employee, log, target = "task") {
  const proposals = getMissionProposalsForEmployee(employee, log);
  const usedText = [
    ...(log.tasks || []).map((task) => String(task.text || "")),
    ...(log.schedule || []).map((entry) => getScheduleEntryText(entry)),
  ].join(" ");
  const preferred = proposals.find((proposal) => {
    const text = proposal.taskText || proposal.title || "";
    if (!text || usedText.includes(text)) return false;
    if (target === "schedule") return /시간|일정|배치|출결|상담|점검|후속|확인|기록/.test(`${proposal.type} ${proposal.title} ${proposal.text}`);
    return true;
  });
  return preferred || proposals.find((proposal) => !usedText.includes(proposal.taskText || proposal.title || "")) || proposals[0] || null;
}

function findOrCreateAiTaskSlot(log, priority = "A") {
  log.tasks ||= [];
  const empty = log.tasks.find((task) => !String(task.text || "").trim());
  if (empty) return empty;
  const task = createWorklogTask(priority);
  log.tasks.push(task);
  return task;
}

function findAiScheduleSlot(log) {
  normalizeWorklogSchedule(log);
  const now = new Date();
  const currentMinutes = getActiveDateKey() === todayKey ? now.getHours() * 60 + now.getMinutes() : 0;
  return (log.schedule || []).find((entry) => !getScheduleEntryText(entry) && timeToMinutes(entry.time) >= currentMinutes)
    || (log.schedule || []).find((entry) => !getScheduleEntryText(entry))
    || ensureWorklogAppointmentSlot(log, minutesToTime(Math.max(8 * 60, Math.ceil(currentMinutes / 60) * 60)));
}

function applyAiProposalToTask(context, proposal) {
  const task = findOrCreateAiTaskSlot(context.log, proposal.priority || "A");
  task.priority = proposal.priority || "A";
  task.text = `[AI미션] ${proposal.taskText || proposal.title}`;
  task.status = "미완료";
  task.done = false;
  task.aiProposalId = proposal.id;
  task.aiProposalType = proposal.type;
  syncWorklogTaskTimeHintToSchedule(task, context.log);
}

function applyAiProposalToSchedule(context, proposal) {
  const entry = findAiScheduleSlot(context.log);
  normalizeScheduleEntryItems(entry);
  const text = proposal.taskText || proposal.title || "AI 추천 업무 실행";
  if (entry.items.length === 1 && !String(entry.items[0].text || "").trim()) entry.items.splice(0, 1);
  entry.items.push(createScheduleItem(text, context.isFitness ? inferScheduleType(text) : "업무"));
  syncScheduleEntryText(entry);
  normalizeWorklogSchedule(context.log);
}

function refreshAfterAiWorklogAction(context, message) {
  saveState();
  if (context.isFitness) {
    renderFitnessWorklog(context.log);
    renderFitnessDashboard();
    renderTodayContext();
    renderReport();
  } else {
    normalizeEmployeeLogRows(context.log);
    renderWorklogToday(context.log);
    renderSharedWorklogPanels(context.log);
    renderEmployeeDetailFields();
    renderClockPanel();
    renderEmployeeTitle();
    renderDateNav();
    renderTodayContext();
    renderReport();
    applyMobileDayFocusMode();
    applyCurrentWorklogPermissionState();
  }
  showAppToast(message);
}

function runSectionAiAction(target = "task") {
  const context = getAiWorklogContextForCurrentView();
  if (!context) {
    showAppToast("직원 업무일지에서 사용할 수 있습니다");
    return;
  }
  if (!context.canEdit) {
    showAppToast("열람 전용 업무일지는 AI가 수정하지 않습니다");
    return;
  }
  const proposal = getActionableMissionProposal(context.employee, context.log, target);
  if (!proposal) {
    showAppToast("업무 데이터가 쌓이면 더 정밀하게 제안합니다");
    return;
  }
  if (target === "schedule") {
    applyAiProposalToSchedule(context, proposal);
    refreshAfterAiWorklogAction(context, "AI가 시간별 일정에 실행 업무를 배치했습니다");
    return;
  }
  applyAiProposalToTask(context, proposal);
  refreshAfterAiWorklogAction(context, "AI 미션을 오늘의 업무에 반영했습니다");
}

function renderMissionProposalCards(proposals, options = {}) {
  const { compact = false, showEmployee = false, allowApply = true } = options;
  return `
    <div class="${compact ? "mission-proposal-list is-compact" : "mission-proposal-list"}">
      ${proposals.map((proposal) => `
        <article class="mission-proposal-card" data-type="${escapeAttr(proposal.type)}">
          <header>
            <span>${escapeHtml(proposal.type)}</span>
            <em>${escapeHtml(proposal.priority)}</em>
          </header>
          <strong>${escapeHtml(proposal.title)}</strong>
          ${showEmployee ? `<small>${escapeHtml(proposal.employeeLabel)}</small>` : ""}
          <p>${escapeHtml(proposal.text)}</p>
          <b>${escapeHtml(proposal.reason)} · ${escapeHtml(proposal.impact)}</b>
          <footer>
            <span>${escapeHtml(proposal.tip)}</span>
            ${allowApply && canApplyMissionToEmployee(proposal.employeeId) ? `<button type="button" data-ai-mission-apply="${escapeAttr(proposal.id)}">업무에 반영</button>` : ""}
          </footer>
        </article>
      `).join("") || `
        <article class="mission-proposal-card">
          <strong>제안 대기</strong>
          <p>업무일지, 시간표, 보고, 직원설정 데이터가 쌓이면 더 정밀한 미션을 제안합니다.</p>
        </article>
      `}
    </div>
  `;
}

function renderAiCoach() {
  const node = document.getElementById("aiCoachGrid");
  if (!node) return;
  const isAdminMode = canAccessManualCoachingAdmin();
  setText("aiSectionEyebrow", isAdminMode ? "Manual & Coaching" : "Personal Helper");
  setText("aiSectionTitle", isAdminMode ? "매뉴얼·코칭" : "나의 성장");
  setText(
    "aiSectionSubtitle",
    isAdminMode
      ? "직원 역할별 매뉴얼, 업무 코칭, 자기개발 미션을 한 곳에서 봅니다."
      : "내 업무 기록을 바탕으로 오늘 더 편하게 일하는 방법과 성장 포인트를 정리합니다."
  );
  const manualShortcut = document.getElementById("manualEditShortcut");
  if (manualShortcut) manualShortcut.hidden = !isAdminMode;
  const commandStrip = document.querySelector("#view-ai .section-command-strip");
  if (commandStrip) commandStrip.hidden = !isAdminMode;
  const score = calculateOperatingScore();
  const log = getSelectedLog();
  const tasks = (log.tasks || []).filter((task) => task.text.trim());
  const growth = buildPersonalGrowthModel(getSelectedEmployee(), log);
  const personalProposals = getMissionProposalsForEmployee(getSelectedEmployee(), log);
  const queue = canAccessWorklogOverview() ? getMissionProposalQueue(6) : [];
  const coachingStaffRows = isAdminMode ? getControlStaffRows() : [];
  const coachingFitnessOps = isAdminMode ? getFitnessOpsSummary() : {};
  const benchmarkLayers = isAdminMode ? getBenchmarkOperatingLayers({
    staffRows: coachingStaffRows,
    issueRows: coachingStaffRows.filter((row) => row.aiSignal !== "정상"),
    missingLogs: coachingStaffRows.filter((row) => row.taskCount === 0),
    laborSignals: coachingStaffRows.filter((row) => row.attendanceStatus === "미기록" || row.attendanceStatus.includes("결석")).length,
    taskTotal: coachingStaffRows.reduce((sum, row) => sum + row.taskCount, 0),
    completedTotal: coachingStaffRows.reduce((sum, row) => sum + row.completedCount, 0),
    salesActions: Number(coachingFitnessOps.consultation || 0) + Number(coachingFitnessOps.outbound || 0) + Number(coachingFitnessOps.outsideSales || 0) + Number(coachingFitnessOps.customerNew || 0) + Number(coachingFitnessOps.customerRenewal || 0),
    missionQueue: queue,
    fitnessOps: coachingFitnessOps,
  }) : [];
  const strengths = String(state.profile?.strengths || "").trim();
  const weaknesses = String(state.profile?.weaknesses || "").trim();
  const developmentGoals = String(state.profile?.developmentGoals || "").trim();
  const coaching = isAdminMode
    ? [
      ["대표 AI 코치", `오늘 점검 우선순위는 운영점수 ${score}점 기준으로 매출, 공간 활용, 문서 연결입니다.`],
      ["사업장 AI 코치", "Beyond Fitness는 회원 240명, 월매출 2천만원을 기준 KPI로 두고 PT 전환율과 이탈률을 먼저 추적해야 합니다."],
      ["직원 AI 코치", tasks.length ? `오늘 우선업무 ${tasks.length}건을 기준으로 완료율과 지연 사유를 기록합니다.` : "개인 업무일지의 우선업무와 시간별 일정을 먼저 기록해야 코칭 품질이 올라갑니다."],
      ["데이터 설계 코치", "모든 사진, 도면, 계약서, 업무일지, 매출 데이터는 반드시 사업장 ID와 호실 ID에 연결해야 합니다."],
    ]
    : [
      ["오늘을 편하게 시작하기", tasks.length ? `오늘 적어둔 업무 ${tasks.length}건 중 먼저 끝낼 일 1개만 골라 시작하세요.` : "오늘 해야 할 일을 3개만 적으면 하루 흐름이 훨씬 가벼워집니다."],
      ["내 기록이 주는 도움", "기록은 감시가 아니라 내 업무를 잊지 않게 도와주는 개인 메모입니다. 많이 쓸수록 다음 업무 준비가 쉬워집니다."],
      ["나의 강점 발견", "완료한 일, 자주 맡는 일, 반복해서 잘 처리하는 일을 모아 내 강점과 익숙한 업무 패턴을 보여줍니다."],
    ];
  node.innerHTML = `
    <article class="growth-command-card">
      <div>
        <p>Personal Growth Engine</p>
        <strong>${escapeHtml(growth.trackProfile.title)}</strong>
        <span>${escapeHtml(growth.trackProfile.focus)}</span>
      </div>
      <b>${growth.score}</b>
    </article>
    <article class="growth-mission-card">
      <header>
        <strong>오늘의 성장 미션</strong>
        <span>${escapeHtml(growth.streakLabel)}</span>
      </header>
      <ol>
        ${growth.missions.map((mission) => `<li>${escapeHtml(mission)}</li>`).join("") || "<li>오늘 기록이 안정적입니다. 완료 업무의 성공 이유를 한 줄로 남기세요.</li>"}
      </ol>
    </article>
    <article class="growth-competency-card">
      <header>
        <strong>역량 스냅샷</strong>
        <span>업무일지 기반</span>
      </header>
      <div>
        ${growth.competencyScores.map((item) => `
          <section>
            <label><span>${escapeHtml(item.name)}</span><b>${item.score}</b></label>
            <em style="--growth-score:${item.score}%"></em>
          </section>
        `).join("")}
      </div>
    </article>
    <article class="growth-coaching-card">
      <strong>가시적 성장 기준</strong>
      <p>점수는 업무 입력량이 아니라 완료율, 시간배치, 회고 품질, 출결 기록, 역할별 핵심 행동을 함께 반영합니다. 매일 3분만 기록해도 주간 성장 변화가 보이도록 설계했습니다.</p>
    </article>
    ${isAdminMode ? `
      <article class="growth-benchmark-card">
        <header>
          <span>Global Benchmark</span>
          <strong>상위 앱 기준으로 본 다음 보강점</strong>
        </header>
        <div>
          ${renderBenchmarkOperatingLayerCards(benchmarkLayers.slice(0, 4), { compact: true })}
        </div>
      </article>
    ` : ""}
    ${!isAdminMode ? `
      <article class="growth-coaching-card">
        <strong>나에게 맞는 기록 방식</strong>
        <p>${escapeHtml([
          strengths ? `잘 맞는 일: ${strengths}` : "잘 맞는 일은 설정에 한 줄만 적어두면 다음 업무 제안이 더 편해집니다.",
          weaknesses ? `도움이 필요한 부분: ${weaknesses}` : "어려운 업무도 부담 없이 적어두면 반복되는 막힘을 줄이는 도움말을 받을 수 있습니다.",
          developmentGoals ? `이번 달 목표: ${developmentGoals}` : "이번 달에 좋아지고 싶은 습관을 적으면 업무일지가 개인 성장 노트처럼 작동합니다.",
        ].join(" "))}</p>
      </article>
    ` : ""}
    <article class="ai-mission-command-card">
      <header>
        <div>
          <span>${isAdminMode ? "AI Mission Architect" : "Work Helper"}</span>
          <strong>${isAdminMode ? "업무·프로젝트 제안" : "오늘 업무 도움"}</strong>
        </div>
        <em>${personalProposals.length}건</em>
      </header>
      <p>${isAdminMode ? "직원 프로필, 직무 매뉴얼, 오늘 업무일지, 시간표, 출결, 사업장 목표를 근거로 지금 맡기기 좋은 일을 제안합니다." : "내 업무일지와 시간표를 바탕으로 오늘 놓치기 쉬운 일과 더 편하게 처리할 방법을 제안합니다."}</p>
      ${renderMissionProposalCards(personalProposals, { allowApply: true })}
    </article>
    ${queue.length ? `
      <article class="ai-mission-command-card is-portfolio">
        <header>
          <div>
            <span>CEO Approval Queue</span>
            <strong>직원별 추천 미션</strong>
          </div>
          <em>${queue.length}건</em>
        </header>
        ${renderMissionProposalCards(queue, { compact: true, showEmployee: true, allowApply: true })}
      </article>
    ` : ""}
    ${coaching.map(([title, body]) => `
      <article>
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(body)}</p>
      </article>
    `).join("")}
  `;
  node.querySelectorAll("[data-benchmark-jump]").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.benchmarkJump || "premium"));
  });
}

function buildPremiumOperatingModel() {
  const assetRows = getAssetRows();
  const staffRows = getControlStaffRows();
  const siteRows = getControlSiteRows(assetRows, staffRows);
  const fitnessOps = getFitnessOpsSummary();
  const missionQueue = getMissionProposalQueue(8);
  const operatingScore = calculateOperatingScore();
  const taskTotal = staffRows.reduce((sum, row) => sum + row.taskCount, 0);
  const completedTotal = staffRows.reduce((sum, row) => sum + row.completedCount, 0);
  const issueRows = staffRows.filter((row) => row.aiSignal !== "정상");
  const missingLogs = staffRows.filter((row) => row.taskCount === 0);
  const salesActions = fitnessOps.consultation + fitnessOps.outbound + fitnessOps.outsideSales + fitnessOps.customerNew + fitnessOps.customerRenewal;
  const laborSignals = staffRows.filter((row) => row.attendanceStatus === "미기록" || row.attendanceStatus.includes("결석")).length;
  const dataCaptureScore = taskTotal ? clampScore((completedTotal / Math.max(1, taskTotal)) * 70 + Math.min(30, taskTotal * 3)) : 18;
  const peopleScore = clampScore(100 - issueRows.length * 10 - missingLogs.length * 4);
  const revenueScore = clampScore(salesActions ? 55 + Math.min(40, salesActions * 8) : 28);
  const laborScore = clampScore(100 - laborSignals * 12);
  const automationScore = clampScore((authState.remoteReady ? 22 : 8) + (authState.user ? 22 : 8) + 16 + (missionQueue.length ? 18 : 8) + (state.backupSettings ? 14 : 8));
  const readinessScore = clampScore((operatingScore * 0.22) + (dataCaptureScore * 0.2) + (peopleScore * 0.18) + (revenueScore * 0.16) + (laborScore * 0.12) + (automationScore * 0.12));
  const quality = buildPremiumQualityChecks({ staffRows, issueRows, missingLogs, laborSignals, taskTotal, completedTotal, salesActions, missionQueue });
  const benchmarkLayers = getBenchmarkOperatingLayers({ staffRows, issueRows, missingLogs, laborSignals, taskTotal, completedTotal, salesActions, missionQueue, fitnessOps });
  const growthModels = getEmployeeOptions()
    .filter(isAssignedWorklogEmployee)
    .slice(0, 8)
    .map((employee) => buildPersonalGrowthModel(employee, getEmployeeLogForDate(employee.id)));
  const weakestGrowth = [...growthModels].sort((a, b) => a.score - b.score).slice(0, 3);
  const proofItems = [
    ["직원 원장", `${staffRows.length}명`, "소속·직함·권한·승인 데이터를 한 원장으로 사용"],
    ["업무 실행", `${completedTotal}/${taskTotal || 0}`, "업무일지와 시간표가 성과·보고·코칭의 원천"],
    ["노무 연결", `${laborSignals}건 확인`, "출결, 근무시간, 유료/무료 PT를 월마감 자료로 연결"],
    ["AI 미션", `${missionQueue.length}건`, "역할·매뉴얼·오늘 기록 기반으로 실행업무 제안"],
    ["운영 점수", `${operatingScore}점`, "사업장, 직원, 매출 행동의 최소 운영 신호"],
    ["백업 패키지", state.backupSettings?.recipientEmail || "대표 메일 준비", "보고서·노무·직원 현황을 하나의 운영기록으로 보존"],
  ];
  const agentLanes = [
    {
      title: "대표 의사결정 에이전트",
      metric: `${issueRows.length + Math.max(0, taskTotal - completedTotal)}건`,
      text: issueRows.length ? `${issueRows.slice(0, 3).map((row) => `${row.role} ${row.name}`).join(", ")} 신호를 먼저 확인합니다.` : "오늘 직원 위험 신호는 안정적입니다.",
      action: "통합관제에서 근태·미완료·사업장 신호를 확인",
      view: "control",
    },
    {
      title: "직원 성장 에이전트",
      metric: `${weakestGrowth[0]?.score || 0}점`,
      text: weakestGrowth.length ? `${weakestGrowth.map((item) => item.employee.nickname || item.employee.name).join(", ")}에게 오늘 성장 미션을 제안합니다.` : "업무 데이터가 쌓이면 개인별 성장 미션이 정교해집니다.",
      action: "성장 지원에서 개인별 미션을 업무에 반영",
      view: "ai",
    },
    {
      title: "수익 행동 에이전트",
      metric: `${salesActions}건`,
      text: salesActions ? "고객행동이 기록되었습니다. 후속업무와 계약 전환을 연결하세요." : "상담, 아웃바운드, 재등록 후보 기록이 비어 있습니다.",
      action: "피트니스/업무일지에 상담·계약·재등록 행동 지정",
      view: "worklog",
    },
    {
      title: "노무·보고 에이전트",
      metric: `${laborSignals}건`,
      text: laborSignals ? "출결 미기록 또는 결석 신호가 노무 확정 전 확인 대상입니다." : "노무 신호는 현재 안정적입니다.",
      action: "노무와 보고·커뮤니티에서 월마감 자료 검증",
      view: "attendance",
    },
  ];
  const roadmap = [
    ["1단계", "데이터 신뢰도", "직원 원장, 승인, 권한, 출결, 업무일지 입력률을 90% 이상으로 올립니다.", dataCaptureScore],
    ["2단계", "수익 KPI 연결", "PT, 상담, 재등록, 계약, 홍보 행동이 일일 업무와 월 목표로 자동 집계됩니다.", revenueScore],
    ["3단계", "AI 매뉴얼 코칭", "직함별 매뉴얼과 오늘 업무를 비교하여 부족한 실행을 자동 제안합니다.", automationScore],
    ["4단계", "대표 개입 최소화", "위험 신호, 칭찬 신호, 위임 후보를 매일 10분 보고서로 압축합니다.", peopleScore],
    ["5단계", "월 500만원 패키지", "운영진단, 노무자료, 직원성장, 매출행동, 백업을 월간 컨설팅 산출물로 제공합니다.", readinessScore],
  ];
  return { readinessScore, proofItems, agentLanes, roadmap, missionQueue, growthModels, weakestGrowth, quality, benchmarkLayers };
}

function renderPremiumOperatingSystem() {
  const node = document.getElementById("premiumOperatingGrid");
  if (!node) return;
  const model = buildPremiumOperatingModel();
  const personalGrowth = buildPersonalGrowthModel(getSelectedEmployee(), getSelectedLog());
  const personalMissions = getMissionProposalsForEmployee(getSelectedEmployee(), getSelectedLog());
  setText("premiumReadinessScore", `${model.readinessScore}`);
  node.innerHTML = `
    <section class="premium-score-card">
      <div>
        <span>Premium Readiness</span>
        <strong>${model.readinessScore}점</strong>
        <p>월 500만원급 운영 OS는 화면의 화려함보다 데이터 신뢰도, 반복 가능한 매뉴얼, AI가 제안한 업무가 실제 실행되는 구조에서 완성됩니다.</p>
      </div>
      <ol>
        <li>업무일지 → 실행 데이터</li>
        <li>출결·노무 → 월마감 데이터</li>
        <li>직원원장 → 권한·성장 데이터</li>
        <li>AI미션 → 다음 행동 데이터</li>
      </ol>
    </section>
    <section class="premium-proof-grid">
      ${model.proofItems.map(([title, value, text]) => `
        <article>
          <span>${escapeHtml(title)}</span>
          <strong>${escapeHtml(value)}</strong>
          <p>${escapeHtml(text)}</p>
        </article>
      `).join("")}
    </section>
    <section class="premium-agent-grid" id="premium-growth">
      ${model.agentLanes.map((lane, index) => `
        <button type="button" data-premium-jump="${escapeAttr(lane.view)}">
          <em>${String(index + 1).padStart(2, "0")}</em>
          <strong>${escapeHtml(lane.title)}</strong>
          <b>${escapeHtml(lane.metric)}</b>
          <span>${escapeHtml(lane.text)}</span>
          <small>${escapeHtml(lane.action)}</small>
        </button>
      `).join("")}
    </section>
    <section class="premium-benchmark-card" id="premium-benchmark">
      <header>
        <div>
          <span>Global Benchmark Overlay</span>
          <strong>상위 운영앱 대비 설계 기준</strong>
          <p>상위 기업용 앱들의 강점을 방주그룹 현장 운영 방식에 맞게 재조합했습니다. 각 항목은 바로 실행 섹션으로 연결됩니다.</p>
        </div>
        <b>${model.benchmarkLayers.filter((layer) => layer.status === "ready").length}/${model.benchmarkLayers.length}</b>
      </header>
      <div class="premium-benchmark-grid">
        ${renderBenchmarkOperatingLayerCards(model.benchmarkLayers)}
      </div>
    </section>
    <section class="premium-quality-console" id="premium-quality">
      <header>
        <div>
          <span>System Quality Console</span>
          <strong>앱 품질 자동 점검</strong>
          <p>로그인, 승인, 직원원장, 업무일지, 노무, 보고·백업 상태를 오늘 기준으로 진단합니다.</p>
        </div>
        <b>${model.quality.score}점</b>
      </header>
      <div class="premium-quality-summary">
        <span>처리 필요 ${model.quality.urgentCount}건</span>
        <span>보완 권장 ${model.quality.warnCount}건</span>
        <span>점검 ${model.quality.checks.length}개</span>
      </div>
      <div class="premium-quality-grid">
        ${model.quality.checks.map((check, index) => `
          <button type="button" class="premium-quality-check is-${escapeAttr(check.status)}" data-premium-jump="${escapeAttr(check.view)}">
            <em>${String(index + 1).padStart(2, "0")}</em>
            <div>
              <strong>${escapeHtml(check.title)}</strong>
              <p>${escapeHtml(check.detail)}</p>
            </div>
            <b>${escapeHtml(check.metric)}</b>
          </button>
        `).join("")}
      </div>
    </section>
    <section class="premium-operator-layout">
      <article class="premium-personal-card">
        <header>
          <span>Personal Growth OS</span>
          <strong>${escapeHtml(personalGrowth.trackProfile.title)}</strong>
          <em>${personalGrowth.score}점</em>
        </header>
        <p>${escapeHtml(personalGrowth.trackProfile.focus)}</p>
        <div>
          ${personalGrowth.competencyScores.map((item) => `
            <section>
              <label><span>${escapeHtml(item.name)}</span><b>${item.score}</b></label>
              <i style="--growth-score:${item.score}%"></i>
            </section>
          `).join("")}
        </div>
      </article>
      <article class="premium-mission-card">
        <header>
          <span>AI Mission Queue</span>
          <strong>오늘 제안 업무</strong>
        </header>
        ${renderMissionProposalCards(personalMissions.length ? personalMissions : model.missionQueue.slice(0, 4), { compact: true, showEmployee: !personalMissions.length, allowApply: true })}
      </article>
    </section>
    <section class="premium-roadmap-card" id="premium-roadmap">
      <header>
        <span>500만원 패키지 골격</span>
        <strong>운영 컨설팅 산출물 로드맵</strong>
      </header>
      <div>
        ${model.roadmap.map(([step, title, text, score]) => `
          <article>
            <em>${escapeHtml(step)}</em>
            <div>
              <strong>${escapeHtml(title)}</strong>
              <p>${escapeHtml(text)}</p>
            </div>
            <b>${score}</b>
          </article>
        `).join("")}
      </div>
    </section>
  `;
  node.querySelectorAll("[data-premium-jump]").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.premiumJump || "control"));
  });
  node.querySelectorAll("[data-benchmark-jump]").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.benchmarkJump || "premium"));
  });
}

function renderDateNav() {
  const selectedDateButton = document.getElementById("selectedDateButton");
  const dayTitle = document.getElementById("worklogDayTitle");
  const todayJumpButton = document.getElementById("todayJumpButton");
  const overviewDateButton = document.getElementById("overviewDateButton");
  const overviewDateTitle = document.getElementById("overviewDateTitle");
  const overviewDateYear = document.getElementById("overviewDateYear");
  const overviewDateDay = document.getElementById("overviewDateDay");
  const overviewTodayButton = document.getElementById("worklogOverviewTodayButton");
  const executiveDateButton = document.getElementById("executiveDateButton");
  const executiveTodayButton = document.getElementById("executiveTodayButton");
  const executiveNextButton = document.getElementById("executiveNextDateButton");
  const controlDateButton = document.getElementById("controlTowerDateButton");
  const controlTodayButton = document.getElementById("controlTowerTodayButton");
  const controlNextButton = document.getElementById("controlTowerNextDateButton");
  const activeDateKey = getActiveDateKey();
  const isToday = activeDateKey === todayKey;
  calendarViewDate = parseDateKey(activeDateKey);
  if (dayTitle) dayTitle.textContent = formatKoreanDate(activeDateKey);
  if (overviewDateTitle) {
    const activeDate = parseDateKey(activeDateKey);
    if (overviewDateYear && overviewDateDay) {
      overviewDateYear.textContent = String(activeDate.getFullYear());
      overviewDateDay.textContent = `.${String(activeDate.getMonth() + 1).padStart(2, "0")}.${String(activeDate.getDate()).padStart(2, "0")}(${hanjaWeekdays[activeDate.getDay()]})`;
    } else {
      overviewDateTitle.textContent = formatKoreanDate(activeDateKey);
    }
  }
  if (executiveDateButton) {
    executiveDateButton.textContent = formatKoreanDate(activeDateKey);
    executiveDateButton.setAttribute("aria-label", `${formatFormalKoreanDate(activeDateKey)} 대표 경영페이지 기준일 선택`);
  }
  if (controlDateButton) {
    controlDateButton.textContent = formatKoreanDate(activeDateKey);
    controlDateButton.setAttribute("aria-label", `${formatFormalKoreanDate(activeDateKey)} 통합관제 기준일 선택`);
  }
  selectedDateButton?.setAttribute("aria-label", `${formatKoreanDate(activeDateKey)} 업무일지 날짜 선택`);
  overviewDateButton?.setAttribute("aria-label", `${formatKoreanDate(activeDateKey)} 전체 업무일지 날짜 선택`);
  renderWeatherDateButton(todayJumpButton, getSelectedEmployee(), activeDateKey);
  if (overviewTodayButton) {
    const isToday = activeDateKey === todayKey;
    overviewTodayButton.disabled = isToday;
    overviewTodayButton.classList.toggle("is-current-date", isToday);
    overviewTodayButton.setAttribute("aria-disabled", String(isToday));
  }
  [
    [executiveTodayButton, executiveNextButton],
    [controlTodayButton, controlNextButton],
  ].forEach(([todayButton, nextButton]) => {
    if (todayButton) {
      todayButton.hidden = isToday;
      todayButton.disabled = isToday;
      todayButton.setAttribute("aria-disabled", String(isToday));
    }
    if (nextButton) {
      nextButton.disabled = isToday;
      nextButton.setAttribute("aria-disabled", String(isToday));
    }
  });
  renderWorklogCalendar();
}

function openWorklogCalendar() {
  calendarPickerMode = "worklog";
  calendarTriggerButtonId = "selectedDateButton";
  calendarPostponeTask = null;
  openCalendarSheet(parseDateKey(getActiveDateKey()));
}

function openOverviewCalendar() {
  calendarPickerMode = "worklog";
  calendarTriggerButtonId = "overviewDateButton";
  calendarPostponeTask = null;
  openCalendarSheet(parseDateKey(getActiveDateKey()));
}

function openDashboardCalendar(mode) {
  calendarPickerMode = mode === "executive" ? "executive" : "control";
  calendarTriggerButtonId = mode === "executive" ? "executiveDateButton" : "controlTowerDateButton";
  calendarPostponeTask = null;
  openCalendarSheet(parseDateKey(getActiveDateKey()));
}

function openFitnessCalendar() {
  calendarPickerMode = "fitness";
  calendarTriggerButtonId = "fitnessDateButton";
  calendarPostponeTask = null;
  openCalendarSheet(parseDateKey(getActiveDateKey()));
}

function openPostponeCalendar(task) {
  calendarPickerMode = "postpone";
  calendarTriggerButtonId = "selectedDateButton";
  calendarPostponeTask = task;
  openCalendarSheet(parseDateKey(task.postponeDate || getActiveDateKey()));
}

function openCalendarSheet(viewDate) {
  const popover = document.getElementById("worklogCalendarPopover");
  const backdrop = document.getElementById("worklogCalendarBackdrop");
  const selectedDateButton = document.getElementById(calendarTriggerButtonId);
  calendarViewDate = viewDate;
  popover.hidden = false;
  backdrop.hidden = false;
  selectedDateButton?.setAttribute("aria-expanded", "true");
  renderWorklogCalendar();
  requestAnimationFrame(() => {
    popover.classList.add("is-open");
    backdrop.classList.add("is-open");
  });
}

function closeWorklogCalendar() {
  const popover = document.getElementById("worklogCalendarPopover");
  const backdrop = document.getElementById("worklogCalendarBackdrop");
  const selectedDateButton = document.getElementById(calendarTriggerButtonId);
  if (!popover || popover.hidden) return;
  popover.classList.remove("is-open");
  backdrop?.classList.remove("is-open");
  selectedDateButton?.setAttribute("aria-expanded", "false");
  document.getElementById("calendarYearGrid").hidden = true;
  document.getElementById("calendarYearControl").classList.remove("is-wheel-open");
  window.setTimeout(() => {
    popover.hidden = true;
    if (backdrop) backdrop.hidden = true;
    calendarPickerMode = "worklog";
    calendarPostponeTask = null;
  }, 170);
}

function toggleWorklogCalendar() {
  const popover = document.getElementById("worklogCalendarPopover");
  if (popover.hidden) openWorklogCalendar();
  else closeWorklogCalendar();
}

function toggleOverviewCalendar() {
  const popover = document.getElementById("worklogCalendarPopover");
  if (popover.hidden) openOverviewCalendar();
  else closeWorklogCalendar();
}

function renderWorklogCalendar() {
  const popover = document.getElementById("worklogCalendarPopover");
  if (!popover || popover.hidden) return;
  const monthTitle = document.getElementById("calendarMonthTitle");
  const selectedLabel = document.getElementById("calendarSelectedLabel");
  const dayGrid = document.getElementById("calendarDayGrid");
  const monthGrid = document.getElementById("calendarMonthGrid");
  const yearGrid = document.getElementById("calendarYearGrid");
  const todayButton = document.getElementById("calendarTodaySheetButton");
  const year = calendarViewDate.getFullYear();
  const month = calendarViewDate.getMonth();
  const selectedDateKey = calendarPickerMode === "postpone" ? calendarPostponeTask?.postponeDate : getActiveDateKey();
  const isDashboardCalendar = ["executive", "control"].includes(calendarPickerMode);
  monthTitle.textContent = `${year}년`;
  selectedLabel.textContent = calendarPickerMode === "postpone"
    ? `연기일 ${selectedDateKey ? formatKoreanDate(selectedDateKey) : "미정"}`
    : calendarPickerMode === "fitness"
      ? `피트니스 업무일지 ${formatKoreanDate(getActiveDateKey())}`
      : calendarPickerMode === "executive"
        ? `대표 경영페이지 ${formatFormalKoreanDate(getActiveDateKey())}`
        : calendarPickerMode === "control"
          ? `통합관제 ${formatFormalKoreanDate(getActiveDateKey())}`
          : formatKoreanDate(getActiveDateKey());
  todayButton.textContent = calendarPickerMode === "postpone" ? "오늘로 지정" : "오늘로 이동";
  dayGrid.innerHTML = "";
  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  for (let i = 0; i < firstDay; i += 1) {
    dayGrid.appendChild(document.createElement("span"));
  }
  for (let date = 1; date <= lastDate; date += 1) {
    const key = formatDateKey(new Date(year, month, date));
    const meta = getCalendarDayMeta(key);
    const subLabels = [...meta.holidayLabels.slice(0, 1), meta.lunarLabel].filter(Boolean);
    const button = document.createElement("button");
    button.type = "button";
    if (isDashboardCalendar && key > todayKey) button.disabled = true;
    button.innerHTML = `
      <strong>${String(date)}</strong>
      ${subLabels.length ? `<small>${subLabels.map(escapeHtml).join(" · ")}</small>` : ""}
    `;
    button.className = [
      key === selectedDateKey ? "is-selected" : "",
      key === todayKey ? "is-today" : "",
      meta.isHoliday ? "is-holiday" : "",
      meta.isWeekend ? "is-weekend" : "",
      meta.lunarLabel ? "has-lunar-anchor" : "",
    ].filter(Boolean).join(" ");
    button.setAttribute("aria-label", [
      formatKoreanDate(key),
      ...meta.holidayLabels,
      meta.lunarLabel,
    ].filter(Boolean).join(" "));
    button.onclick = () => selectCalendarDate(key);
    dayGrid.appendChild(button);
  }
  monthGrid.innerHTML = Array.from({ length: 12 }, (_, index) => `
    <button type="button" class="${index === month ? "is-selected" : ""}" data-calendar-month="${index}">${index + 1}월</button>
  `).join("");
  yearGrid.innerHTML = Array.from({ length: 21 }, (_, index) => {
    const value = year - 10 + index;
    return `<button type="button" role="option" aria-selected="${value === year}" class="${value === year ? "is-selected" : ""}" data-calendar-year="${value}">${value}</button>`;
  }).join("");
  monthGrid.querySelectorAll("[data-calendar-month]").forEach((button) => {
    button.onclick = () => {
      calendarViewDate = new Date(year, Number(button.dataset.calendarMonth), 1);
      renderWorklogCalendar();
    };
  });
  yearGrid.querySelectorAll("[data-calendar-year]").forEach((button) => {
    button.onclick = () => {
      calendarViewDate = new Date(Number(button.dataset.calendarYear), month, 1);
      yearGrid.hidden = true;
      document.getElementById("calendarYearControl").classList.remove("is-wheel-open");
      renderWorklogCalendar();
    };
  });
  if (!yearGrid.hidden) {
    yearGrid.querySelector(".is-selected")?.scrollIntoView({ block: "center" });
  }
}

function selectCalendarDate(dateKey) {
  if (calendarPickerMode === "postpone" && calendarPostponeTask) {
    calendarPostponeTask.postponeDate = dateKey;
    saveState();
    closeWorklogCalendar();
    renderEntries();
    return;
  }
  if (["executive", "control"].includes(calendarPickerMode) && dateKey > todayKey) return;
  setSelectedDateKey(dateKey);
}

function shiftCalendarYear(delta) {
  calendarViewDate = new Date(calendarViewDate.getFullYear() + delta, calendarViewDate.getMonth(), 1);
  renderWorklogCalendar();
}

function renderEmployeeTitle() {
  const employee = getSelectedEmployee();
  const title = getGeneralWorklogTitle(activeView);
  document.getElementById("todayTitle").textContent = `${employee.org} ${title}. ${getEmployeeAdminLabel(employee)}`;
}

function renderWorklogIdentityBadges() {
  const generalBadge = document.getElementById("worklogIdentityBadge");
  if (generalBadge) {
    generalBadge.textContent = getWorklogIdentityText(getSelectedEmployee());
  }
  const fitnessBadge = document.getElementById("fitnessIdentityBadge");
  if (fitnessBadge) {
    fitnessBadge.textContent = getWorklogIdentityText(getFitnessIdentityEmployee());
  }
}

function renderGlobalEmployeeIdentity() {
  const employee = activeView === "fitness-log"
    ? employees.find((item) => item.id === state.fitnessWritableEmployeeId) || getSelectedEmployee()
    : getSelectedEmployee();
  const fitnessIdentity = getFitnessOwnIdentity(employee);
  const personLabel = activeView === "fitness-log"
    ? (fitnessIdentity.label === fitnessIdentity.role ? fitnessIdentity.role : `${fitnessIdentity.role} ${fitnessIdentity.label}`)
    : getEmployeeAdminLabel(employee);
  const identity = document.getElementById("globalEmployeeIdentity");
  if (identity) identity.textContent = "";
  const title = document.getElementById("globalHeaderTitle");
  if (title) title.textContent = getGlobalHeaderTitle(activeView, personLabel);
  renderWorklogIdentityBadges();
  renderGlobalAttendanceSummary(employee);
  updateGlobalAttendanceVisibility();
}

function getGeneralWorklogTitle(view = activeView) {
  if (view === "beyond-log") return "비욘드 업무일지";
  const employee = getSelectedEmployee();
  const source = `${employee?.org || ""} ${state.profile?.org || ""} ${state.profile?.workplace || ""}`;
  if (/비제이|종합건설|건설/.test(source)) return "비제이종건 업무일지";
  return "방주 업무일지";
}

function getRecommendedPermissionPresetForProfile(profile = {}) {
  const email = String(authState.user?.email || profile.email || "").trim().toLowerCase();
  const roleText = `${profile.role || ""} ${profile.primaryWork || ""} ${profile.nickname || ""}`;
  if (controlTowerEmails.has(email)) return "owner";
  const overridePreset = getProfilePlacementOverride(email)?.accessPreset;
  if (overridePreset) return normalizePermissionPresetKey(overridePreset);
  if (/임원|총괄/i.test(roleText)) return "executive_delegate";
  if (/실장|관리자|센터장|manager/i.test(roleText)) return "site_manager";
  if (/프리랜서|트레이너/i.test(`${roleText} ${profile.employmentType || ""}`)) return "freelance";
  return "employee";
}

function normalizePermissionPresetKey(value = "employee") {
  return permissionPresets[value] ? value : "employee";
}

function getPermissionPresetOptions(selected = "employee") {
  const value = normalizePermissionPresetKey(selected);
  return Object.entries(permissionPresets)
    .map(([key, preset]) => `<option value="${escapeAttr(key)}" ${key === value ? "selected" : ""}>${escapeHtml(preset.label)}</option>`)
    .join("");
}

function buildPermissionSet(presetKey = "employee", overrides = {}) {
  const preset = permissionPresets[normalizePermissionPresetKey(presetKey)] || permissionPresets.employee;
  const permissions = { ...preset.permissions };
  permissionKeys.forEach(([key]) => {
    if (typeof overrides[key] === "boolean") permissions[key] = overrides[key];
  });
  return { presetKey: normalizePermissionPresetKey(presetKey), label: preset.label, caption: preset.caption, permissions };
}

function getProfilePermissionSet(profile = state.profile || {}) {
  const email = String(authState.user?.email || profile.email || "").trim().toLowerCase();
  if (controlTowerEmails.has(email)) return buildPermissionSet("owner");

  const overridePreset = getProfilePlacementOverride(email)?.accessPreset;
  let presetKey = normalizePermissionPresetKey(overridePreset || profile.accessPreset || getRecommendedPermissionPresetForProfile(profile));
  let permissions = { ...(profile.permissions || {}) };
  if (overridePreset) presetKey = "employee";
  if (presetKey === "owner") {
    presetKey = "employee";
    permissions = {};
  }

  if (presetKey !== "executive_delegate") {
    permissions.executiveRoom = false;
  }
  return buildPermissionSet(presetKey, permissions);
}

function hasProfilePermission(key, profile = state.profile || {}) {
  if (isExplicitlySignedOut()) return false;
  return Boolean(getProfilePermissionSet(profile).permissions[key]);
}

function normalizeEmployeePermissionState(source = {}) {
  return Object.fromEntries(Object.entries(source || {}).map(([employeeId, value]) => {
    const presetKey = normalizePermissionPresetKey(value?.preset || value?.accessPreset || "employee");
    const permissions = {};
    permissionKeys.forEach(([key]) => {
      if (typeof value?.permissions?.[key] === "boolean") permissions[key] = value.permissions[key];
      if (typeof value?.[key] === "boolean") permissions[key] = value[key];
    });
    return [employeeId, { preset: presetKey, permissions }];
  }));
}

function isRepresentativeProfile() {
  if (isExplicitlySignedOut()) return false;
  const profile = state.profile || {};
  const email = String(authState.user?.email || profile.email || "").trim().toLowerCase();
  if (controlTowerEmails.has(email)) return true;
  if (authState.user && (profile.approvalStatus || "pending") !== "approved") return false;
  const set = getProfilePermissionSet(profile);
  return set.presetKey === "executive_delegate" && set.permissions.executiveRoom === true;
}

function hasApprovalAuthority(profile = state.profile || {}) {
  if (isExplicitlySignedOut()) return false;
  const email = String(authState.user?.email || profile.email || "").trim().toLowerCase();
  if (controlTowerEmails.has(email)) return true;
  if (authState.user && (profile.approvalStatus || "pending") !== "approved") return false;
  return hasProfilePermission("staffApproval", profile) || hasProfilePermission("staffManage", profile);
}

function canShowApprovalMenu() {
  if (isExplicitlySignedOut()) return false;
  const email = String(authState.user?.email || state.profile?.email || "").trim().toLowerCase();
  return controlTowerEmails.has(email) || isRepresentativeProfile() || hasProfilePermission("staffApproval");
}

function isProfileApproved() {
  if (isExplicitlySignedOut()) return false;
  if (!authState.user) return true;
  if (hasApprovalAuthority()) return true;
  const status = state.profile?.approvalStatus || "approved";
  return status === "approved";
}

function getApprovalStatusLabel(status = state.profile?.approvalStatus) {
  status = normalizeApprovalStatus(status || "pending");
  if (status === "approved") return "승인 완료";
  if (status === "rejected") return "반려";
  if (status === "pending") return "승인 대기";
  return "작성 중";
}

function setOwnApprovalPending() {
  state.profile.approvalStatus = hasApprovalAuthority() ? "approved" : "pending";
  state.profile.approvalNote ||= "";
  if (state.profile.approvalStatus === "approved") {
    state.profile.approvedBy = authState.user?.id || "self";
    state.profile.approvedAt = new Date().toISOString();
  }
}

function getUserWorklogView() {
  if (canAccessWorklogOverview()) return "worklog-overview";
  const profile = state.profile || {};
  const source = `${profile.org || ""} ${profile.workplace || ""} ${profile.primaryWork || ""} ${profile.role || ""}`.toLowerCase();
  if (/피트니스|fitness|센터장|트레이너|인포/.test(source)) return "fitness-log";
  if (/비욘드|beyond|공유|워크베이스|workbase|workbox/.test(source)) return "beyond-log";
  return "bangju-log";
}

function getInitialLandingView() {
  return getUserWorklogView();
}

function getWorklogEmployeeIdsForView(view) {
  const includeOwnProfile = !isRepresentativeProfile() && (!authState.user || !getProfileMappedEmployeeId());
  const withOwnProfile = (ids) => (includeOwnProfile ? ["profile-user", ...ids] : ids);
  if (view === "fitness-log") return withOwnProfile(getAssignedWorklogEmployeeIds(fitnessEmployeeIds));
  if (view === "beyond-log") return withOwnProfile(getAssignedWorklogEmployeeIds(beyondWorklogEmployeeIds));
  if (view === "bangju-log" || view === "today") return withOwnProfile(getAssignedWorklogEmployeeIds(bangjuWorklogEmployeeIds));
  return [];
}

function getWorklogGroupIdForView(view = activeView, employee = getSelectedEmployee()) {
  if (view === "fitness-log") return "fitness";
  if (view === "beyond-log") return "beyond";
  if (["bangju-log", "today"].includes(view)) return "bangju";
  return getStaffSiteGroupForEmployee(employee)?.id || "";
}

function getCoworkerEmployeesForWorklog(selectedEmployee = getSelectedEmployee(), view = activeView) {
  const groupId = getWorklogGroupIdForView(view, selectedEmployee);
  const preferredIds = getWorklogEmployeeIdsForView(view);
  const preferredOrder = new Map(preferredIds.map((employeeId, index) => [employeeId, index]));
  const selectedKeys = new Set(getEmployeeIdentityKeys(selectedEmployee));
  const byEmployeeId = new Map();
  getEmployeeOptions()
    .filter(isAssignedWorklogEmployee)
    .filter((employee) => !isRepresentativeWorklogEmployee(employee))
    .filter((employee) => !getEmployeeIdentityKeys(employee).some((key) => selectedKeys.has(key)))
    .filter((employee) => !groupId || getStaffSiteGroupForEmployee(employee)?.id === groupId)
    .forEach((employee) => {
      const employeeId = getEmployeeWorklogId(employee);
      if (!employeeId || byEmployeeId.has(employeeId)) return;
      byEmployeeId.set(employeeId, employee);
    });
  return [...byEmployeeId.values()].sort((a, b) => {
    const aId = getEmployeeWorklogId(a);
    const bId = getEmployeeWorklogId(b);
    const aOrder = preferredOrder.has(aId) ? preferredOrder.get(aId) : 999;
    const bOrder = preferredOrder.has(bId) ? preferredOrder.get(bId) : 999;
    return aOrder - bOrder || getEmployeeAdminLabel(a).localeCompare(getEmployeeAdminLabel(b), "ko");
  });
}

function ensureSelectedEmployeeForWorklogView(view) {
  const ids = getWorklogEmployeeIdsForView(view);
  const ownEmployeeId = getOwnEditableEmployeeIdForView(view);
  if (!ids.length) return;
  if (!isRepresentativeProfile() && !canAccessWorklogOverview()) {
    const fallbackOwnEmployeeId = ids.includes(ownEmployeeId) ? ownEmployeeId : ids.includes("profile-user") ? "profile-user" : ids[0];
    state.selectedEmployeeId = fallbackOwnEmployeeId;
    return;
  }
  if (ids.includes(state.selectedEmployeeId)) return;
  if (!isRepresentativeProfile() && ids.includes(ownEmployeeId)) state.selectedEmployeeId = ownEmployeeId;
  else state.selectedEmployeeId = ids[0];
}

function getGlobalHeaderTitle(view = activeView, personLabel = "") {
  if (view === "worklog" || view === "worklog-overview") return "업무일지";
  if (view === "fitness-log") return `beyond fitness · ${personLabel}`;
  if (view === "executive") return "대표 경영페이지";
  if (view === "control") return "Beyond Control Tower";
  if (view === "beyond-log") return `비욘드 업무일지 · ${personLabel}`;
  if (view === "bangju-log" || view === "today") return `${getGeneralWorklogTitle(view)} · ${personLabel}`;
  if (view === "fitness") return "비욘드 피트니스 OS";
  if (view === "attendance") return "노무";
  if (view === "staff") return "직원";
  if (view === "organization") return "조직";
  if (view === "premium") return "AI 운영총괄";
  if (view === "ai") return canAccessManualCoachingAdmin() ? "매뉴얼·코칭" : "나의 성장";
  if (view === "report") return "보고서";
  if (view === "projects") return "프로젝트";
  if (view === "settings") return "설정";
  return "Beyond OS";
}

function getAttendanceEmployeeForView(view = activeView) {
  const employeeId = view === "fitness-log"
    ? state.fitnessWritableEmployeeId
    : getCurrentWorklogEmployeeId(view);
  return getEmployeeOptions().find((item) => item.id === employeeId)
    || employees.find((item) => item.id === employeeId)
    || getProfileEmployee();
}

function updateGlobalAttendanceVisibility(view = activeView) {
  const showEditor = attendanceEnabledViews.has(view) && canEditCurrentWorklog(view);
  const summary = document.getElementById("globalAttendanceSummary");
  const button = document.getElementById("globalAttendanceButton");
  if (summary) summary.hidden = !showEditor;
  if (button) {
    button.hidden = !showEditor;
    button.disabled = !showEditor;
    button.setAttribute("aria-disabled", String(!showEditor));
  }
  if (!showEditor) closeAttendancePopover();
}

function renderGlobalAttendanceSummary(employee = getAttendanceEmployeeForView()) {
  const node = document.getElementById("globalAttendanceSummary");
  const button = document.getElementById("globalAttendanceButton");
  if (!node && !button) return;
  const log = getEmployeeLogForDate(employee.id);
  const summary = formatAttendanceSummary(log);
  if (node) node.textContent = summary || "출결 미기록";
  if (button) {
    const hasRecord = Boolean(log.clockIn || log.clockOut || log.attendanceBreaks?.length);
    button.classList.toggle("is-recorded", hasRecord);
    button.title = summary ? `출결현황: ${summary}` : "출결현황 기록";
  }
}

function formatAttendanceSummary(log = getSelectedLog()) {
  const parts = [];
  if (log.clockIn) parts.push(`(출근) ${log.clockIn}`);
  if (log.clockOut) parts.push(`(퇴근) ${log.clockOut}`);
  (log.attendanceBreaks || []).forEach((item) => {
    if (item.start || item.end) parts.push(`(${item.type || "외출"}) ${item.start || "--:--"}~${item.end || "--:--"}`);
  });
  if (log.attendanceStatus === "조퇴" && log.clockOut) {
    const outIndex = parts.findIndex((part) => part.startsWith("(퇴근)"));
    if (outIndex >= 0) parts[outIndex] = `(조퇴) ${log.clockOut}`;
  }
  return parts.join(", ");
}

function renderProfileForm() {
  if (isExplicitlySignedOut() && !isAuthRegistrationVisible()) {
    clearSignupProfileFields();
    renderSettingsForm();
    return;
  }
  document.querySelectorAll("[data-profile-field]").forEach((field) => {
    const value = state.profile?.[field.dataset.profileField] || "";
    field.value = isPhoneField(field) ? formatPhoneNumber(value) : value;
  });
  updateRegistrationWorkplaceOptions({ preserve: true });
  renderProfileWeeklyWorkHoursFields();
  renderSignupSheetStatus();
  renderSettingsForm();
}

function clearSignupProfileFields() {
  document.querySelectorAll("[data-profile-field]").forEach((field) => {
    field.value = "";
  });
  updateRegistrationWorkplaceOptions({ preserve: false });
  document.querySelectorAll("[data-profile-work-hours-check]").forEach((field) => {
    field.checked = false;
    field.closest("label")?.classList.remove("is-workday");
  });
  document.querySelectorAll("[data-profile-work-hours-day]").forEach((field) => {
    field.value = "";
  });
  const status = document.getElementById("signupApprovalStatus");
  if (status) {
    status.textContent = "작성 전";
    status.dataset.status = "draft";
  }
}

function renderProfileWeeklyWorkHoursFields() {
  syncWeeklyWorkHoursControls({
    weeklyWorkHours: state.profile?.weeklyWorkHours,
    defaultHours: state.profile?.workHours || defaultProfile.workHours,
    checkSelector: "[data-profile-work-hours-check]",
    inputSelector: "[data-profile-work-hours-day]",
    checkDatasetKey: "profileWorkHoursCheck",
    inputDatasetKey: "profileWorkHoursDay",
  });
}

function syncWeeklyWorkHoursControls({ weeklyWorkHours = {}, defaultHours = "", checkSelector, inputSelector, checkDatasetKey, inputDatasetKey, root = document } = {}) {
  const normalized = weeklyWorkHours && typeof weeklyWorkHours === "object" ? weeklyWorkHours : {};
  root.querySelectorAll(checkSelector).forEach((checkbox) => {
    const key = checkbox.dataset[checkDatasetKey];
    checkbox.checked = Object.prototype.hasOwnProperty.call(normalized, key);
  });
  root.querySelectorAll(inputSelector).forEach((field) => {
    const key = field.dataset[inputDatasetKey];
    const hasDay = Object.prototype.hasOwnProperty.call(normalized, key);
    field.value = hasDay ? (normalized[key] || defaultHours || "") : "";
    field.closest("label")?.classList.toggle("is-workday", hasDay);
  });
}

function collectWeeklyWorkHoursFromControls({ checkSelector, inputSelector, checkDatasetKey, inputDatasetKey, defaultHours = "", root = document } = {}) {
  const values = {};
  root.querySelectorAll(inputSelector).forEach((field) => {
    const key = field.dataset[inputDatasetKey];
    const selectorKey = escapeSelectorAttr(key);
    const checkbox = root.querySelector(`${checkSelector}[data-${kebabCase(checkDatasetKey)}="${selectorKey}"]`);
    const value = field.value.trim();
    if (checkbox?.checked || value) {
      values[key] = value || defaultHours || defaultProfile.workHours;
    }
  });
  return values;
}

function toggleWeeklyWorkHourControl(target) {
  const profileInput = target.closest?.("[data-profile-work-hours-day]");
  const settingsInput = target.closest?.("[data-settings-work-hours-day]");
  const staffInput = target.closest?.("[data-staff-weekly-work-hours-day]");
  const input = profileInput || settingsInput || staffInput;
  if (input && input.value.trim()) {
    const day = input.dataset.profileWorkHoursDay || input.dataset.settingsWorkHoursDay || input.dataset.staffWeeklyWorkHoursDay;
    const root = input.closest("#staffDetailOverlay") || document;
    const selectorDay = escapeSelectorAttr(day);
    const checkSelector = profileInput
      ? `[data-profile-work-hours-check="${selectorDay}"]`
      : settingsInput
        ? `[data-settings-work-hours-check="${selectorDay}"]`
        : `[data-staff-weekly-work-hours-check="${selectorDay}"]`;
    const checkbox = root.querySelector(checkSelector);
    if (checkbox) checkbox.checked = true;
    input.closest("label")?.classList.add("is-workday");
  }
  const checkbox = target.closest?.("[data-profile-work-hours-check], [data-settings-work-hours-check], [data-staff-weekly-work-hours-check]");
  if (checkbox) checkbox.closest("label")?.classList.toggle("is-workday", checkbox.checked);
}

function kebabCase(value = "") {
  return String(value).replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function escapeSelectorAttr(value = "") {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function normalizePlacementOrg(value = "") {
  const compact = String(value || "").replace(/\s+/g, "");
  if (compact.includes("비제이종합건설")) return "(주)비제이종합건설";
  if (compact.includes("비욘드컴퍼니")) return "(주)비욘드컴퍼니";
  if (compact.includes("방주")) return "(주)방주";
  return String(value || "");
}

function getPlacementOrgOptions() {
  return Object.keys(organizationPlacementOptions);
}

function getPlacementWorkplaceOptions(org = "") {
  return organizationPlacementOptions[normalizePlacementOrg(org)]?.workplaces || [];
}

function getPlacementRoleOptions(org = "", workplace = "") {
  return organizationPlacementOptions[normalizePlacementOrg(org)]?.rolesByWorkplace?.[workplace] || [];
}

function fillPlacementSelect(select, options, placeholder, currentValue = "") {
  if (!select) return;
  const uniqueOptions = [...new Set(options.filter(Boolean))];
  const isOrgSelect = Object.prototype.hasOwnProperty.call(select.dataset, "registrationOrgSelect")
    || select.dataset.settingsProfileField === "org"
    || select.dataset.approvalPlacement === "org";
  const normalizedCurrent = isOrgSelect
    ? normalizePlacementOrg(currentValue)
    : String(currentValue || "");
  const renderOptions = [...uniqueOptions];
  if (normalizedCurrent && !renderOptions.includes(normalizedCurrent)) renderOptions.push(normalizedCurrent);
  select.innerHTML = [
    `<option value="">${escapeHtml(placeholder)}</option>`,
    ...renderOptions.map((item) => `<option value="${escapeAttr(item)}">${escapeHtml(item)}</option>`),
  ].join("");
  select.value = normalizedCurrent && renderOptions.includes(normalizedCurrent) ? normalizedCurrent : "";
}

function renderPlacementSelectField(name, label, options, placeholder, currentValue = "", extraAttrs = "") {
  const uniqueOptions = [...new Set(options.filter(Boolean))];
  const normalizedCurrent = name === "org" ? normalizePlacementOrg(currentValue) : String(currentValue || "");
  const renderOptions = [...uniqueOptions];
  if (normalizedCurrent && !renderOptions.includes(normalizedCurrent)) renderOptions.push(normalizedCurrent);
  const optionsHtml = [
    `<option value="">${escapeHtml(placeholder)}</option>`,
    ...renderOptions.map((item) => `<option value="${escapeAttr(item)}" ${item === normalizedCurrent ? "selected" : ""}>${escapeHtml(item)}</option>`),
  ].join("");
  return `
    <label>${escapeHtml(label)}
      <select data-approval-field="${escapeAttr(name)}" data-approval-placement="${escapeAttr(name)}" ${extraAttrs}>
        ${optionsHtml}
      </select>
    </label>
  `;
}

function updateRegistrationWorkplaceOptions({ preserve = true } = {}) {
  const orgSelect = document.querySelector("[data-registration-org-select]");
  const workplaceSelect = document.querySelector("[data-registration-workplace-select]");
  if (!orgSelect || !workplaceSelect) return;
  const orgCurrent = preserve ? orgSelect.value || state.profile?.org || "" : orgSelect.value || "";
  fillPlacementSelect(orgSelect, getPlacementOrgOptions(), "소속 선택", orgCurrent);
  const selectedOrg = normalizePlacementOrg(orgSelect.value || "");
  const current = preserve ? workplaceSelect.value : "";
  const options = registrationWorkplaceOptions[selectedOrg] || [];
  fillPlacementSelect(workplaceSelect, options, "근무지 선택", current || (preserve ? state.profile?.workplace : ""));
  if (current && options.includes(current)) {
    workplaceSelect.value = current;
  } else if (preserve && state.profile?.workplace && options.includes(state.profile.workplace)) {
    workplaceSelect.value = state.profile.workplace;
  } else {
    workplaceSelect.value = "";
  }
}

function updateSettingsPlacementOptions({ preserve = true, resetWorkplace = false, resetRole = false } = {}) {
  const orgSelect = document.querySelector('[data-settings-profile-field="org"]');
  const workplaceSelect = document.querySelector('[data-settings-profile-field="workplace"]');
  const roleSelect = document.querySelector('[data-settings-profile-field="role"]');
  if (!orgSelect || !workplaceSelect || !roleSelect) return;
  const orgCurrent = preserve ? orgSelect.value || state.profile?.org || "" : "";
  fillPlacementSelect(orgSelect, getPlacementOrgOptions(), "소속 선택", orgCurrent);
  const org = normalizePlacementOrg(orgSelect.value);
  const workplaceCurrent = resetWorkplace ? "" : workplaceSelect.value || state.profile?.workplace || "";
  fillPlacementSelect(workplaceSelect, getPlacementWorkplaceOptions(org), "사업장/부서 선택", workplaceCurrent);
  const roleCurrent = resetRole ? "" : roleSelect.value || state.profile?.role || "";
  fillPlacementSelect(roleSelect, getPlacementRoleOptions(org, workplaceSelect.value), "직급 선택", roleCurrent);
}

function updateApprovalPlacementOptions(card, { resetWorkplace = false, resetRole = false } = {}) {
  if (!card) return;
  const orgSelect = card.querySelector('[data-approval-placement="org"]');
  const workplaceSelect = card.querySelector('[data-approval-placement="workplace"]');
  const roleSelect = card.querySelector('[data-approval-placement="role"]');
  if (!orgSelect || !workplaceSelect || !roleSelect) return;
  fillPlacementSelect(orgSelect, getPlacementOrgOptions(), "소속 선택", orgSelect.value);
  const org = normalizePlacementOrg(orgSelect.value);
  const workplaceCurrent = resetWorkplace ? "" : workplaceSelect.value;
  fillPlacementSelect(workplaceSelect, getPlacementWorkplaceOptions(org), "사업장/부서 선택", workplaceCurrent);
  const roleCurrent = resetRole ? "" : roleSelect.value;
  fillPlacementSelect(roleSelect, getPlacementRoleOptions(org, workplaceSelect.value), "직급 선택", roleCurrent);
}

function renderSignupSheetStatus() {
  const node = document.getElementById("signupApprovalStatus");
  if (!node) return;
  const status = state.profile?.approvalStatus || "draft";
  node.textContent = getApprovalStatusLabel(status);
  node.dataset.status = status;
}

function renderSettingsForm() {
  document.querySelectorAll("[data-settings-profile-field]").forEach((field) => {
    const value = state.profile?.[field.dataset.settingsProfileField] || "";
    field.value = isPhoneField(field) ? formatPhoneNumber(value) : value;
  });
  updateSettingsPlacementOptions({ preserve: true });
  syncWeeklyWorkHoursControls({
    weeklyWorkHours: state.profile?.weeklyWorkHours,
    defaultHours: state.profile?.workHours || defaultProfile.workHours,
    checkSelector: "[data-settings-work-hours-check]",
    inputSelector: "[data-settings-work-hours-day]",
    checkDatasetKey: "settingsWorkHoursCheck",
    inputDatasetKey: "settingsWorkHoursDay",
  });
  renderManualSettings();
  renderApprovalAccess();
  renderSiteAddressSettings();
  renderSettingsProfileChangeNotice();
  updateSettingsProfileSaveButton();
}

function renderSiteAddressSettings() {
  const list = document.getElementById("siteAddressList");
  if (!list) return;
  const addresses = state.siteWeatherAddresses || {};
  list.innerHTML = siteWeatherAddressTargets.map((target) => `
    <label class="site-address-row">
      <span>
        <b>${escapeHtml(target.label)}</b>
        <small>${escapeHtml(target.hint)}</small>
      </span>
      <input data-site-weather-address="${escapeAttr(target.key)}" type="text" value="${escapeAttr(addresses[target.key] || "")}" placeholder="사업장/현장 주소 입력" />
    </label>
  `).join("");
}

function normalizePendingProfileChangeRequest(raw) {
  if (!raw) return { fields: {}, requestedAt: "", status: "" };
  const source = typeof raw === "string" ? parseJsonSafely(raw, {}) : raw;
  const fields = source?.fields && typeof source.fields === "object" ? source.fields : source || {};
  return {
    fields: Object.fromEntries(Object.entries(fields).filter(([key]) => profileApprovalFieldKeys.has(key))),
    requestedAt: source?.requestedAt || source?.requested_at || "",
    status: source?.status || "",
  };
}

function parseJsonSafely(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
}

function hasPendingProfileChanges(raw = state.profile?.pendingProfileChanges) {
  return Object.keys(normalizePendingProfileChangeRequest(raw).fields).length > 0;
}

function isCurrentUserProfileRow(row = {}) {
  const currentId = String(authState.user?.id || "");
  const currentEmail = String(authState.user?.email || state.profile?.email || "").trim().toLowerCase();
  const rowId = String(row.id || "");
  const rowEmail = String(row.email || "").trim().toLowerCase();
  return Boolean((currentId && rowId === currentId) || (currentEmail && rowEmail === currentEmail));
}

function getVisibleApprovalRows(rows = []) {
  return (rows || []).filter((row) => !isCurrentUserProfileRow(row));
}

function normalizeApprovalStatus(status = "pending") {
  return ["pending", "approved", "rejected"].includes(status) ? status : "pending";
}

function isApprovalActionItem(row = {}) {
  return (
    normalizeApprovalStatus(row.approval_status || "pending") === "pending"
    || hasPendingProfileChanges(row.pending_profile_changes)
  );
}

function countApprovalActionItems(rows = []) {
  return getVisibleApprovalRows(rows).filter(isApprovalActionItem).length;
}

function getApprovalQueueCollections(rows = []) {
  const visibleRows = getVisibleApprovalRows(rows);
  const isPendingSignup = (row) => normalizeApprovalStatus(row.approval_status || "pending") === "pending";
  const isChangeRequest = (row) => hasPendingProfileChanges(row.pending_profile_changes);
  const updatedTime = (row) => new Date(row.profile_change_requested_at || row.updated_at || row.created_at || 0).getTime() || 0;
  const byLatest = (a, b) => updatedTime(b) - updatedTime(a);
  const pendingSignups = visibleRows.filter(isPendingSignup).sort(byLatest);
  const changeRequests = visibleRows
    .filter((row) => !isPendingSignup(row) && isChangeRequest(row))
    .sort(byLatest);
  const actionRows = [...pendingSignups, ...changeRequests];
  const approvedRows = visibleRows
    .filter((row) => normalizeApprovalStatus(row.approval_status || "pending") === "approved" && !isChangeRequest(row))
    .sort(byLatest);
  const rejectedRows = visibleRows
    .filter((row) => normalizeApprovalStatus(row.approval_status || "pending") === "rejected")
    .sort(byLatest);
  return {
    visibleRows,
    actionRows,
    pendingSignups,
    changeRequests,
    approvedRows,
    rejectedRows,
  };
}

function updateSettingsProfileSaveButton() {
  const button = document.getElementById("saveSettingsProfileButton");
  if (!button) return;
  const requiresApproval = Boolean(authState.user && isProfileApproved() && !hasApprovalAuthority());
  const hasPending = hasPendingProfileChanges();
  button.textContent = requiresApproval ? (hasPending ? "승인요청 수정" : "변경 승인요청") : "저장하고 적용";
  button.dataset.mode = requiresApproval ? "request" : "apply";
}

function renderSettingsProfileChangeNotice() {
  const note = document.getElementById("settingsProfilePendingNote");
  if (!note) return;
  const pending = normalizePendingProfileChangeRequest(state.profile?.pendingProfileChanges);
  const labels = Object.keys(pending.fields).map((key) => profileApprovalFieldByKey[key]?.[1] || key);
  note.hidden = !labels.length;
  note.textContent = labels.length
    ? `대표 확인 대기 중: ${labels.join(", ")}. 승인 전까지 기존 확정 정보가 업무일지와 노무에 적용됩니다.`
    : "";
}

function collectSettingsProfileDraft() {
  const draft = { ...state.profile };
  document.querySelectorAll("[data-settings-profile-field]").forEach((field) => {
    const key = field.dataset.settingsProfileField;
    const value = field.value.trim();
    draft[key] = key === "org" ? normalizePlacementOrg(value) : isPhoneField(field) ? formatPhoneNumber(value) : value;
    if (isPhoneField(field)) field.value = draft[key];
  });
  draft.weeklyWorkHours = collectWeeklyWorkHoursFromControls({
    checkSelector: "[data-settings-work-hours-check]",
    inputSelector: "[data-settings-work-hours-day]",
    checkDatasetKey: "settingsWorkHoursCheck",
    inputDatasetKey: "settingsWorkHoursDay",
    defaultHours: draft.workHours || defaultProfile.workHours,
  });
  return draft;
}

function normalizeProfileApprovalValue(key, value) {
  if (key === "org") return normalizePlacementOrg(value);
  if (key === "phone") return formatPhoneNumber(value || "");
  if (key === "weeklyWorkHours") return JSON.stringify(value || {});
  return String(value ?? "");
}

function collectProfileChangeRequest(draft = {}) {
  return profileApprovalFieldMeta.reduce((changes, [key]) => {
    if (profileImmediateWorkTimeKeys.has(key)) return changes;
    const before = normalizeProfileApprovalValue(key, state.profile?.[key]);
    const after = normalizeProfileApprovalValue(key, draft[key]);
    if (before !== after) changes[key] = draft[key];
    return changes;
  }, {});
}

function applyImmediateSettingsProfileFields(draft = {}) {
  ["nickname", "extra", "strengths", "weaknesses", "developmentGoals", "workHours", "weeklyWorkHours"].forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(draft, key)) state.profile[key] = draft[key] || "";
  });
}

function formatPendingProfileValue(key, value) {
  if (key === "weeklyWorkHours") {
    const order = [["sun", "日"], ["mon", "月"], ["tue", "火"], ["wed", "水"], ["thu", "木"], ["fri", "金"], ["sat", "土"]];
    return order
      .map(([day, label]) => value?.[day] ? `${label} ${value[day]}` : "")
      .filter(Boolean)
      .join(" · ") || "요일별 설정 없음";
  }
  if (key === "phone") return formatPhoneNumber(value || "");
  return String(value ?? "") || "-";
}

function getManualSettings() {
  state.profile = { ...defaultProfile, ...(state.profile || {}) };
  state.profile.manualSettings = {
    ...defaultProfile.manualSettings,
    ...(state.profile.manualSettings || {}),
    customByRole: { ...(state.profile.manualSettings?.customByRole || {}) },
    missionsByEmployee: { ...(state.profile.manualSettings?.missionsByEmployee || {}) },
  };
  return state.profile.manualSettings;
}

function normalizeAssignedMissionRecord(value, visible = true) {
  if (!value) return { text: "", visible: visible !== false, updatedAt: "", updatedBy: "", source: "" };
  if (typeof value === "string") {
    return { text: value.trim(), visible: visible !== false, updatedAt: "", updatedBy: "", source: "local" };
  }
  return {
    text: String(value.text || value.assignedMission || value.mission || "").trim(),
    visible: value.visible !== false && value.assignedMissionVisible !== false,
    updatedAt: value.updatedAt || value.assignedMissionUpdatedAt || "",
    updatedBy: value.updatedBy || value.assignedMissionUpdatedBy || "",
    source: value.source || "local",
  };
}

function getEmployeeSourceProfileRow(employee = {}) {
  const email = String(employee.email || "").trim().toLowerCase();
  return (authState.approvalRows || []).find((row) => {
    if (employee.sourceProfileId && row.id === employee.sourceProfileId) return true;
    if (email && String(row.email || "").trim().toLowerCase() === email) return true;
    return false;
  }) || null;
}

function canRevealAssignedMission(employee = {}, record = {}) {
  if (!String(record.text || "").trim()) return false;
  if (record.visible !== false) return true;
  if (isRepresentativeProfile() || hasApprovalAuthority()) return true;
  if (hasProfilePermission("staffManage") || hasProfilePermission("staffApproval")) return true;
  const ownId = getSelectedEmployee()?.id || getMappedProfileEmployeeId();
  return employee.id && employee.id !== ownId && canEditStaffProfile(employee);
}

function getAssignedMissionForEmployee(employee = {}) {
  const row = getEmployeeSourceProfileRow(employee);
  if (row) {
    return normalizeAssignedMissionRecord({
      text: row.assigned_mission || "",
      visible: row.assigned_mission_visible !== false,
      updatedAt: row.assigned_mission_updated_at || "",
      updatedBy: row.assigned_mission_updated_by || "",
      source: "profile",
    });
  }
  const override = state.employeeDirectoryOverrides?.[employee.id];
  if (override?.assignedMission || override?.assignedMissionVisible === false) {
    return normalizeAssignedMissionRecord({
      text: override.assignedMission || "",
      visible: override.assignedMissionVisible !== false,
      updatedAt: override.assignedMissionUpdatedAt || "",
      updatedBy: override.assignedMissionUpdatedBy || "",
      source: "override",
    });
  }
  if (employee.assignedMission || employee.assignedMissionVisible === false) {
    return normalizeAssignedMissionRecord({
      text: employee.assignedMission || "",
      visible: employee.assignedMissionVisible !== false,
      updatedAt: employee.assignedMissionUpdatedAt || "",
      updatedBy: employee.assignedMissionUpdatedBy || "",
      source: "employee",
    });
  }
  const localMission = state.profile?.manualSettings?.missionsByEmployee?.[employee.id];
  return normalizeAssignedMissionRecord(localMission);
}

function renderManualSettings() {
  const settings = getManualSettings();
  const roleSelect = document.getElementById("manualRoleSelect");
  const employeeSelect = document.getElementById("manualEmployeeSelect");
  const manualEditor = document.getElementById("manualEditor");
  const missionEditor = document.getElementById("manualMissionEditor");
  if (!roleSelect || !employeeSelect || !manualEditor || !missionEditor) return;
  const roleKeys = Object.keys(fitnessManualTemplates);
  if (!roleKeys.includes(settings.roleKey)) settings.roleKey = getManualRoleKeyForProfile();
  roleSelect.value = settings.roleKey || "manager";
  employeeSelect.innerHTML = employees
    .map((employee) => `<option value="${escapeAttr(employee.id)}">${escapeHtml(getEmployeeAdminLabel(employee))}</option>`)
    .join("");
  const employeeIds = employees.map((employee) => employee.id);
  if (!employeeIds.includes(settings.employeeId)) settings.employeeId = getDefaultManualEmployeeId();
  employeeSelect.value = settings.employeeId || getDefaultManualEmployeeId();
  const template = fitnessManualTemplates[roleSelect.value] || fitnessManualTemplates.manager;
  manualEditor.value = settings.customByRole?.[roleSelect.value] || template.text;
  missionEditor.value = settings.missionsByEmployee?.[employeeSelect.value] || "";
}

function getManualRoleKeyForProfile() {
  const source = `${state.profile?.org || ""} ${state.profile?.workplace || ""} ${state.profile?.role || ""} ${state.profile?.primaryWork || ""}`;
  if (/방주|재무|자금|회계|세무/.test(source)) return "bangjuFinance";
  if (/TBA|티비에이|인월|욕실|바스|bath|showroom|쇼룸/i.test(source)) return "beyondTba";
  if (/공유|워크베이스|워크박스|창고|오피스|workbase|workbox/i.test(source)) return "beyondShared";
  if (/인테리어|시공|공사|현장/.test(source)) return "beyondInterior";
  if (/인포|고객응대/.test(source)) return "frontDesk";
  if (/트레이너|PT|수업/.test(source)) return "trainer";
  if (/홍보|마케팅/.test(source)) return "marketing";
  if (/시설/.test(source)) return "facility";
  if (/청결|청소/.test(source)) return "cleaning";
  return "manager";
}

function getDefaultManualEmployeeId() {
  const view = getUserWorklogView();
  const ids = getWorklogEmployeeIdsForView(view);
  return ids[0] || state.fitnessWritableEmployeeId || employees[0]?.id || "beyond-fitness-manager";
}

function saveManualSettingsFromForm() {
  const settings = getManualSettings();
  const roleKey = document.getElementById("manualRoleSelect")?.value || "manager";
  const employeeId = document.getElementById("manualEmployeeSelect")?.value || state.fitnessWritableEmployeeId;
  const manualText = document.getElementById("manualEditor")?.value.trim() || "";
  const missionText = document.getElementById("manualMissionEditor")?.value.trim() || "";
  settings.roleKey = roleKey;
  settings.employeeId = employeeId;
  if (manualText) settings.customByRole[roleKey] = manualText;
  else delete settings.customByRole[roleKey];
  if (missionText) settings.missionsByEmployee[employeeId] = missionText;
  else delete settings.missionsByEmployee[employeeId];
}

function loadDefaultManualForSelectedRole() {
  const roleKey = document.getElementById("manualRoleSelect")?.value || "manager";
  const editor = document.getElementById("manualEditor");
  if (!editor) return;
  editor.value = (fitnessManualTemplates[roleKey] || fitnessManualTemplates.manager).text;
  saveManualSettingsFromForm();
}

function renderApprovalAccess() {
  const tab = document.getElementById("approvalSettingsTab");
  const panel = document.getElementById("settings-panel-approval");
  const allowed = canShowApprovalMenu();
  if (tab) tab.hidden = !allowed;
  if (panel) panel.classList.toggle("is-disabled", !allowed);
  if (!allowed) {
    const list = document.getElementById("approvalRequestList");
    const resetList = document.getElementById("passwordResetRequestList");
    if (list) list.innerHTML = `<p class="empty-note">대표 또는 승인 권한자만 직원등록 신청을 확인할 수 있습니다.</p>`;
    if (resetList) resetList.innerHTML = `<p class="empty-note">대표 또는 승인 권한자만 비밀번호 재설정 요청을 확인할 수 있습니다.</p>`;
    return;
  }
  loadApprovalRequests({ repair: !authState.approvalRowsLoaded });
  loadPasswordResetRequests();
}

function renderApprovalNotification() {
  const menuAllowed = canShowApprovalMenu();
  const alertAllowed = Boolean(authState.user && menuAllowed);
  const count = alertAllowed ? (authState.pendingApprovalCount || 0) + (authState.pendingPasswordResetCount || 0) : 0;
  const alertButton = document.getElementById("approvalAlertButton");
  const alertCount = document.getElementById("approvalAlertCount");
  const menuBadge = document.getElementById("menuApprovalBadge");
  const menuApproval = document.querySelector("[data-menu-action='approval']");
  if (alertButton) alertButton.hidden = !alertAllowed || count <= 0;
  if (alertCount) alertCount.textContent = String(count);
  if (menuBadge) {
    menuBadge.hidden = !menuAllowed || count <= 0;
    menuBadge.textContent = String(count);
  }
  if (menuApproval) {
    menuApproval.hidden = !menuAllowed;
    menuApproval.classList.toggle("has-pending", count > 0);
  }
}

async function refreshApprovalNotification() {
  if (!supabaseClient || !authState.user || !canShowApprovalMenu()) {
    authState.pendingApprovalCount = 0;
    authState.pendingPasswordResetCount = 0;
    renderApprovalNotification();
    return;
  }
  await runApprovalQueueRepair({ manual: false });
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, approval_status, pending_profile_changes");
  if (!error) authState.pendingApprovalCount = countApprovalActionItems(data || []);
  const { count: resetCount, error: resetError } = await supabaseClient
    .from("password_reset_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (!resetError) authState.pendingPasswordResetCount = Math.max(0, Number(resetCount || 0));
  renderApprovalNotification();
}

function startApprovalNotificationPolling() {
  clearInterval(authState.approvalTimer);
  if (!authState.user || !canShowApprovalMenu()) {
    authState.approvalTimer = null;
    refreshApprovalNotification();
    return;
  }
  refreshApprovalNotification();
  authState.approvalTimer = setInterval(refreshApprovalNotification, 60000);
}

function openApprovalManagement() {
  if (!canShowApprovalMenu()) {
    showAppToast("승인요청 메뉴 권한이 없습니다");
    return;
  }
  switchView("settings");
  renderApprovalAccess();
  switchSettingsTab("approval");
  setTimeout(() => {
    if (activeView !== "settings" || !canShowApprovalMenu()) return;
    authState.approvalRepairTried = false;
    loadApprovalRequests({ repair: true });
    loadPasswordResetRequests();
  }, 0);
}

async function repairApprovalQueue({ silent = true } = {}) {
  if (!supabaseClient || !authState.user || !hasApprovalAuthority()) return false;
  try {
    const { data, error } = await supabaseClient.rpc("repair_profile_approval_queue");
    if (error) {
      if (isMissingApprovalRepairRpcError(error)) {
        markApprovalRepairRpcUnavailable(error);
        return false;
      }
      if (!silent) showAppToast(`승인요청 동기화 실패: ${error.message}`);
      return false;
    }
    authState.approvalRepairUnavailable = false;
    if (!silent) {
      const count = Number(data || 0);
      showAppToast(count > 0 ? `승인요청 ${count}건을 동기화했습니다` : "승인요청 목록을 확인했습니다");
    }
    return true;
  } catch (error) {
    if (isMissingApprovalRepairRpcError(error)) {
      markApprovalRepairRpcUnavailable(error);
      return false;
    }
    if (!silent) showAppToast(`승인요청 동기화 실패: ${error.message}`);
    return false;
  }
}

async function runApprovalQueueRepair(options = {}) {
  if (!supabaseClient || !authState.user || !hasApprovalAuthority()) return false;
  if (authState.approvalRepairUnavailable && !options.manual) return false;
  const shouldRun = Boolean(options.force || options.manual || !authState.approvalRepairTried);
  if (!shouldRun) return false;
  authState.approvalRepairTried = true;
  return repairApprovalQueue({ silent: !options.manual });
}

function isMissingApprovalRepairRpcError(error) {
  const message = [error?.message, error?.details, error?.hint].filter(Boolean).join(" ");
  return /repair_profile_approval_queue/i.test(message)
    && /(schema cache|could not find the function|function .* does not exist|pgrst202)/i.test(message);
}

function markApprovalRepairRpcUnavailable(error) {
  authState.approvalRepairUnavailable = true;
  console.warn("Approval repair RPC is not available; falling back to direct profile query.", error);
}

async function fetchApprovalProfileRows() {
  return supabaseClient
    .from("profiles")
    .select("*")
    .order("updated_at", { ascending: false });
}

function getMissingSchemaColumnFromError(error) {
  const message = [error?.message, error?.details, error?.hint].filter(Boolean).join(" ");
  const match = String(message).match(/Could not find the ['"]([^'"]+)['"] column/i);
  return match?.[1] || "";
}

async function updateProfileRowWithSchemaFallback(id, payload = {}, client = supabaseClient) {
  let nextPayload = { ...payload };
  let lastError = null;
  const removedColumns = [];
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { error } = await client.from("profiles").update(nextPayload).eq("id", id);
    if (!error) return { error: null, payload: nextPayload, removedColumns };
    lastError = error;
    const missingColumn = getMissingSchemaColumnFromError(error);
    if (!missingColumn || !Object.prototype.hasOwnProperty.call(nextPayload, missingColumn)) {
      return { error, payload: nextPayload, removedColumns };
    }
    delete nextPayload[missingColumn];
    removedColumns.push(missingColumn);
  }
  return { error: lastError, payload: nextPayload, removedColumns };
}

async function upsertProfileRowWithSchemaFallback(payload = {}, client = supabaseClient) {
  let nextPayload = { ...payload };
  let lastError = null;
  const removedColumns = [];
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { error } = await client.from("profiles").upsert(nextPayload);
    if (!error) return { error: null, payload: nextPayload, removedColumns };
    lastError = error;
    const missingColumn = getMissingSchemaColumnFromError(error);
    if (!missingColumn || !Object.prototype.hasOwnProperty.call(nextPayload, missingColumn)) {
      return { error, payload: nextPayload, removedColumns };
    }
    delete nextPayload[missingColumn];
    removedColumns.push(missingColumn);
  }
  return { error: lastError, payload: nextPayload, removedColumns };
}

async function loadApprovalRequests(options = {}) {
  const list = document.getElementById("approvalRequestList");
  if (!list) return;
  if (!supabaseClient || !authState.user) {
    list.innerHTML = `<p class="empty-note">로그인 후 직원등록 신청을 확인할 수 있습니다.</p>`;
    return;
  }
  list.innerHTML = `<p class="empty-note">직원등록 신청을 불러오는 중입니다...</p>`;
  const repairedBeforeFetch = options.repair === true || options.manual
    ? await runApprovalQueueRepair({ force: true, manual: options.manual })
    : false;
  let { data, error } = await fetchApprovalProfileRows();
  if (error) {
    list.innerHTML = `<p class="empty-note">직원등록 신청을 불러오지 못했습니다. 승인 데이터 구조를 적용했는지 확인해주세요.<br>${escapeHtml(error.message)}</p>`;
    return;
  }
  let rows = getVisibleApprovalRows(data || []);
  let collections = getApprovalQueueCollections(rows);
  if ((!rows.length || !collections.actionRows.length) && options.repair !== false && !repairedBeforeFetch && !authState.approvalRepairTried) {
    const repaired = await runApprovalQueueRepair({ manual: options.manual });
    if (repaired) {
      ({ data, error } = await fetchApprovalProfileRows());
      if (error) {
        list.innerHTML = `<p class="empty-note">직원등록 신청 동기화 후 목록을 다시 불러오지 못했습니다.<br>${escapeHtml(error.message)}</p>`;
        return;
      }
      rows = getVisibleApprovalRows(data || []);
      collections = getApprovalQueueCollections(rows);
    }
  }
  authState.approvalRows = rows;
  authState.approvalRowsLoaded = true;
  authState.pendingApprovalCount = countApprovalActionItems(rows);
  normalizeState();
  renderApprovalNotification();
  if (activeView === "staff") renderStaffMaster();
  if (!rows.length) {
    list.innerHTML = `
      <div class="approval-empty-state">
        <strong>직원등록 신청 없음</strong>
        <p>대기, 승인완료, 반려 목록이 비어 있습니다. 새 신청이 들어오면 이곳에 상태별로 정리됩니다.</p>
      </div>
    `;
    return;
  }
  if (!rows.some((row) => row.id === authState.selectedApprovalId)) {
    authState.selectedApprovalId = collections.actionRows[0]?.id || rows[0].id;
  }
  renderApprovalQueue();
}

async function refreshStaffApprovalRows() {
  if (!supabaseClient || !authState.user || !hasApprovalAuthority()) return;
  await runApprovalQueueRepair({ manual: false });
  const { data, error } = await fetchApprovalProfileRows();
  if (error) return;
  authState.approvalRows = getVisibleApprovalRows(data || []);
  authState.approvalRowsLoaded = true;
  authState.pendingApprovalCount = countApprovalActionItems(authState.approvalRows);
  normalizeState();
  renderApprovalNotification();
  if (activeView === "staff") renderStaffMaster();
}

function getApprovalStatusTone(status = "pending") {
  status = normalizeApprovalStatus(status);
  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  return "pending";
}

function renderApprovalQueue() {
  const list = document.getElementById("approvalRequestList");
  if (!list) return;
  const rows = authState.approvalRows || [];
  const collections = getApprovalQueueCollections(rows);
  const selected = rows.find((row) => row.id === authState.selectedApprovalId) || collections.actionRows[0] || rows[0];
  const groups = [
    ["pending", "신규승인", "직원등록 신청", collections.pendingSignups],
    ["change", "변경요청", "직원정보 변경", collections.changeRequests],
    ["approved", "사용가능", "승인 완료", collections.approvedRows],
    ["rejected", "반려", "보완 요청", collections.rejectedRows],
  ];
  list.innerHTML = `
    <div class="approval-queue-layout">
      <aside class="approval-queue-sidebar" aria-label="승인요청 상태별 목록">
        <div class="approval-queue-summary">
          <article data-status="action">
            <span>처리필요</span>
            <strong>${escapeHtml(String(collections.actionRows.length))}</strong>
            <em>등록/변경요청</em>
          </article>
          <article data-status="pending">
            <span>신규승인</span>
            <strong>${escapeHtml(String(collections.pendingSignups.length))}</strong>
            <em>직원등록 신청</em>
          </article>
          <article data-status="change">
            <span>변경요청</span>
            <strong>${escapeHtml(String(collections.changeRequests.length))}</strong>
            <em>정보 수정 확인</em>
          </article>
          <article data-status="approved">
            <span>사용가능</span>
            <strong>${escapeHtml(String(collections.approvedRows.length))}</strong>
            <em>승인 완료</em>
          </article>
          <article data-status="rejected">
            <span>반려</span>
            <strong>${escapeHtml(String(collections.rejectedRows.length))}</strong>
            <em>보완 요청</em>
          </article>
        </div>
        ${groups.map(([status, label, caption, items]) => renderApprovalQueueGroup(status, label, caption, items, selected?.id)).join("")}
      </aside>
      <div class="approval-detail-panel">
        ${selected ? renderApprovalRequestCard(selected) : `<p class="empty-note">선택된 직원등록 신청이 없습니다.</p>`}
      </div>
    </div>
  `;
}

function renderApprovalQueueGroup(status, label, caption, items, selectedId) {
  return `
    <section class="approval-queue-group" data-status="${escapeAttr(status)}">
      <header>
        <strong>${escapeHtml(label)}</strong>
        <span>${escapeHtml(String(items.length))}명 · ${escapeHtml(caption)}</span>
      </header>
      <div>
        ${items.length ? items.map((row) => renderApprovalQueueButton(row, selectedId)).join("") : `<p>해당 직원 없음</p>`}
      </div>
    </section>
  `;
}

function renderApprovalQueueButton(row, selectedId) {
  const status = normalizeApprovalStatus(row.approval_status || "pending");
  const meta = [row.role, row.org, row.workplace].filter(Boolean).join(" · ") || "소속/직함 확인 필요";
  const hasChangeRequest = hasPendingProfileChanges(row.pending_profile_changes);
  const changeBadge = hasChangeRequest ? " · 변경 승인 필요" : "";
  return `
    <button type="button" data-approval-select="${escapeAttr(row.id)}" class="${row.id === selectedId ? "is-selected" : ""}">
      <span>${escapeHtml(row.name || row.nickname || "이름 미입력")}</span>
      <small>${escapeHtml(row.email || "이메일 없음")}</small>
      <em>${escapeHtml(`${meta}${changeBadge}`)}</em>
      <b data-status="${escapeAttr(hasChangeRequest ? "change" : status)}">${escapeHtml(hasChangeRequest ? "변경요청" : getApprovalStatusLabel(status))}</b>
    </button>
  `;
}

function getApprovalAccessPreset(row = {}) {
  const note = String(row.approval_note || "");
  const noteMatch = note.match(/\[권한:([a-z_]+)\]/);
  if (noteMatch?.[1] && permissionPresets[noteMatch[1]]) return noteMatch[1];
  return getRecommendedPermissionPresetForProfile({
    email: row.email,
    org: row.org,
    role: row.role,
    primaryWork: row.primary_work,
    employmentType: row.employment_type,
  });
}

function mergeApprovalAccessNote(note = "", presetKey = "employee") {
  const preset = permissionPresets[normalizePermissionPresetKey(presetKey)] || permissionPresets.employee;
  const cleaned = String(note || "").replace(/\s*\[권한:[a-z_]+\]\s*[^|\n]*(\s*\|\s*)?/g, "").trim();
  const accessLine = `[권한:${normalizePermissionPresetKey(presetKey)}] ${preset.label} - ${preset.caption}`;
  return cleaned ? `${accessLine}\n${cleaned}` : accessLine;
}

function renderPendingProfileChangeBox(row = {}) {
  const pending = normalizePendingProfileChangeRequest(row.pending_profile_changes);
  const entries = Object.entries(pending.fields);
  if (!entries.length) return "";
  return `
    <section class="approval-change-request">
      <header>
        <div>
          <strong>직원정보 변경요청</strong>
          <span>${escapeHtml(pending.requestedAt ? new Date(pending.requestedAt).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" }) : "요청 시간 확인 필요")}</span>
        </div>
        <em>대표 확인 필요</em>
      </header>
      <p class="approval-change-guide">왼쪽은 현재 확정 정보, 오른쪽은 직원이 요청한 변경값입니다. 승인 전까지 앱에는 현재 확정 정보가 유지됩니다.</p>
      <div class="approval-change-grid">
        ${entries.map(([key, nextValue]) => {
          const label = profileApprovalFieldByKey[key]?.[1] || key;
          const currentRemoteKey = profileApprovalFieldByKey[key]?.[2] || key;
          const currentValue = row[currentRemoteKey];
          return `
            <article>
              <b>${escapeHtml(label)}</b>
              <div>
                <span>
                  <small>기존</small>
                  <em>${escapeHtml(formatPendingProfileValue(key, currentValue))}</em>
                </span>
                <strong>
                  <small>요청</small>
                  <em>${escapeHtml(formatPendingProfileValue(key, nextValue))}</em>
                </strong>
              </div>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderApprovalRequestCard(row) {
  const status = normalizeApprovalStatus(row.approval_status || "pending");
  const hasChangeRequest = hasPendingProfileChanges(row.pending_profile_changes);
  const displayStatus = hasChangeRequest ? "change" : status;
  const approvalOrg = normalizePlacementOrg(row.org || "");
  const approvalWorkplace = row.workplace || "";
  const field = (name, label, value = "", type = "text") => `
    <label>${escapeHtml(label)}
      <input type="${type}" data-approval-id="${escapeAttr(row.id)}" data-approval-field="${escapeAttr(name)}" value="${escapeAttr(name === "phone" ? formatPhoneNumber(value) : value || "")}" />
    </label>
  `;
  const statusTone = hasChangeRequest ? "pending" : getApprovalStatusTone(status);
  const approvedLabel = row.approved_at ? new Date(row.approved_at).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" }) : "";
  return `
    <article class="approval-request-card" data-approval-card="${escapeAttr(row.id)}" data-status="${escapeAttr(statusTone)}">
      <div class="approval-request-title">
        <div>
          <strong>${escapeHtml(row.name || "이름 미입력")}</strong>
          <span>${escapeHtml(row.email || "이메일 없음")} · ${escapeHtml(row.org || "소속 미입력")} · ${escapeHtml(row.role || "직급 미입력")}</span>
        </div>
        <em data-status="${escapeAttr(displayStatus)}">${escapeHtml(hasChangeRequest ? "변경요청" : getApprovalStatusLabel(status))}</em>
      </div>
      <div class="approval-decision-banner" data-status="${escapeAttr(displayStatus)}">
        <strong>${escapeHtml(hasChangeRequest ? "직원정보 변경 승인 필요" : status === "pending" ? "직원등록 승인 전 확인" : status === "approved" ? "승인 완료" : "반려 처리됨")}</strong>
        <p>${escapeHtml(hasChangeRequest
          ? "아래 변경 전/후 값을 확인한 뒤 변경 승인 또는 반려를 선택하세요. 승인 전까지 기존 확정 정보가 유지됩니다."
          : status === "pending"
            ? "소속, 직함, 근무지, 고용형태, 노무 기준을 확인한 뒤 승인하세요."
            : status === "approved"
              ? `이 직원은 앱 사용이 가능합니다.${approvedLabel ? ` 승인일: ${approvedLabel}` : ""}`
              : "보완 후 다시 승인할 수 있습니다. 반려 사유를 승인 메모에 남겨주세요.")}</p>
      </div>
      ${renderPendingProfileChangeBox(row)}
      <div class="approval-edit-grid">
        ${hasChangeRequest ? `<div class="approval-edit-grid-note">아래 항목은 현재 확정 정보입니다. 직접 보정이 필요하면 수정 후 저장하거나, 위 변경요청을 승인/반려하세요.</div>` : ""}
        ${renderPlacementSelectField("org", "소속", getPlacementOrgOptions(), "소속 선택", approvalOrg)}
        ${renderPlacementSelectField("workplace", "근무지", getPlacementWorkplaceOptions(approvalOrg), "사업장/부서 선택", approvalWorkplace)}
        ${renderPlacementSelectField("role", "직급", getPlacementRoleOptions(approvalOrg, approvalWorkplace), "직급 선택", row.role)}
        ${field("name", "이름", row.name)}
        ${field("phone", "전화", row.phone)}
        ${field("email", "이메일", row.email, "email")}
        ${field("primary_work", "주업무", row.primary_work)}
        ${field("secondary_work", "부업무", row.secondary_work)}
        ${field("work_hours", "근무시간", row.work_hours)}
        ${field("employment_type", "고용형태", row.employment_type || "직원")}
        <label>승인 권한
          <select data-approval-id="${escapeAttr(row.id)}" data-approval-access-preset>
            ${getPermissionPresetOptions(getApprovalAccessPreset(row))}
          </select>
        </label>
        ${field("labor_id", "주민번호/식별번호", row.labor_id)}
        ${field("address", "주소", row.address)}
        ${field("hourly_wage", "시급", row.hourly_wage || "", "number")}
        ${field("daily_wage", "일당", row.daily_wage || "", "number")}
      </div>
      <label class="approval-note-label">승인 메모
        <textarea rows="2" data-approval-id="${escapeAttr(row.id)}" data-approval-field="approval_note">${escapeHtml(row.approval_note || "")}</textarea>
      </label>
      <div class="approval-request-actions">
        ${hasChangeRequest ? `
          <button type="button" data-approval-action="applyProfileChange" data-approval-id="${escapeAttr(row.id)}">변경 승인</button>
          <button type="button" data-approval-action="rejectProfileChange" data-approval-id="${escapeAttr(row.id)}">변경 반려</button>
        ` : ""}
        <button type="button" data-approval-action="save" data-approval-id="${escapeAttr(row.id)}">수정 저장</button>
        ${status !== "approved" ? `<button type="button" data-approval-action="approve" data-approval-id="${escapeAttr(row.id)}">승인</button>` : ""}
        ${status !== "rejected" ? `<button type="button" data-approval-action="reject" data-approval-id="${escapeAttr(row.id)}">반려</button>` : ""}
      </div>
    </article>
  `;
}

function collectApprovalCardPayload(id) {
  const card = Array.from(document.querySelectorAll("[data-approval-card]")).find((node) => node.dataset.approvalCard === id);
  if (!card) return null;
  const payload = { updated_at: new Date().toISOString() };
  card.querySelectorAll("[data-approval-field]").forEach((field) => {
    const name = field.dataset.approvalField;
    const value = field.value.trim();
    if (["hourly_wage", "daily_wage"].includes(name)) {
      const numeric = value.replaceAll(",", "");
      payload[name] = numeric ? Number(numeric) : null;
      return;
    }
    payload[name] = isPhoneField(field) ? formatPhoneNumber(value) : value;
    if (isPhoneField(field)) field.value = payload[name];
  });
  const accessSelect = card.querySelector("[data-approval-access-preset]");
  if (accessSelect) {
    payload.approval_note = mergeApprovalAccessNote(payload.approval_note || "", accessSelect.value);
  }
  return payload;
}

function pendingProfileChangesToRemotePayload(raw = {}) {
  const pending = normalizePendingProfileChangeRequest(raw);
  const numericOrNull = (value) => {
    const normalized = String(value ?? "").replaceAll(",", "").trim();
    if (!normalized) return null;
    const number = Number(normalized);
    return Number.isFinite(number) ? number : null;
  };
  return Object.entries(pending.fields).reduce((payload, [key, value]) => {
    const [, , remoteKey, type] = profileApprovalFieldByKey[key] || [];
    if (!remoteKey) return payload;
    if (type === "number") payload[remoteKey] = numericOrNull(value);
    else if (type === "phone") payload[remoteKey] = formatPhoneNumber(value || "");
    else if (type === "json") payload[remoteKey] = value && typeof value === "object" ? value : {};
    else payload[remoteKey] = key === "org" ? normalizePlacementOrg(value) : String(value ?? "");
    return payload;
  }, {});
}

async function updateApprovalRequest(id, action) {
  if (!supabaseClient || !authState.user) return;
  const row = (authState.approvalRows || []).find((item) => String(item.id) === String(id));
  if (action === "applyProfileChange" || action === "rejectProfileChange") {
    if (!row) return;
    const payload = {
      updated_at: new Date().toISOString(),
      pending_profile_changes: {},
      profile_change_requested_at: null,
    };
    if (action === "applyProfileChange") {
      Object.assign(payload, pendingProfileChangesToRemotePayload(row.pending_profile_changes));
      payload.approval_note = `${String(row.approval_note || "").trim()}${row.approval_note ? "\n" : ""}[직원정보 변경요청 승인] ${new Date().toLocaleString("ko-KR")}`.trim();
    } else {
      payload.approval_note = `${String(row.approval_note || "").trim()}${row.approval_note ? "\n" : ""}[직원정보 변경요청 반려] ${new Date().toLocaleString("ko-KR")}`.trim();
    }
    const { error } = await updateProfileRowWithSchemaFallback(id, payload);
    if (error) {
      alert(`직원정보 변경요청 처리 실패: ${error.message}`);
      return;
    }
    const nextRow = {
      ...row,
      ...payload,
      approval_status: row.approval_status || "approved",
    };
    authState.approvalRows = (authState.approvalRows || []).map((item) => (
      String(item.id) === String(id) ? nextRow : item
    ));
    applyApprovedProfileRowLocally(nextRow, `profile-${id}`);
    saveState({ fastSave: true });
    authState.selectedApprovalId = id;
    await loadApprovalRequests();
    await refreshApprovalNotification();
    if (activeView === "settings") renderSettings();
    if (activeView === "staff") renderStaffMaster();
    showAppToast(action === "applyProfileChange" ? "직원정보 변경요청을 적용했습니다" : "직원정보 변경요청을 반려했습니다");
    return;
  }
  const payload = collectApprovalCardPayload(id);
  if (!payload) return;
  if (action === "approve") {
    payload.approval_status = "approved";
    payload.approved_by = authState.user.id;
    payload.approved_at = new Date().toISOString();
  }
  if (action === "reject") {
    payload.approval_status = "rejected";
    payload.approved_by = authState.user.id;
    payload.approved_at = new Date().toISOString();
  }
  const { error } = await updateProfileRowWithSchemaFallback(id, payload);
  if (error) {
    alert(`승인요청 처리 실패: ${error.message}`);
    return;
  }
  const nextRow = { ...row, ...payload };
  authState.approvalRows = (authState.approvalRows || []).map((item) => (
    String(item.id) === String(id) ? nextRow : item
  ));
  if (action === "approve" || action === "save") {
    applyApprovedProfileRowLocally(nextRow, `profile-${id}`);
    saveState({ fastSave: true });
  }
  authState.selectedApprovalId = id;
  await loadApprovalRequests();
  await refreshApprovalNotification();
  if (activeView === "settings") renderSettings();
  if (activeView === "staff") renderStaffMaster();
  if (action === "approve") showAppToast("직원등록을 승인했습니다");
  else if (action === "reject") showAppToast("직원등록을 반려했습니다");
  else showAppToast("승인요청 정보를 저장했습니다");
}

function setPasswordRecoveryMode(active, message = "") {
  authState.passwordRecoveryMode = Boolean(active);
  const updateCard = document.getElementById("passwordUpdateCard");
  const loginCard = document.querySelector(".login-card:not(.password-update-card)");
  if (updateCard) updateCard.hidden = !authState.passwordRecoveryMode;
  if (loginCard) loginCard.hidden = authState.passwordRecoveryMode || isAuthRegistrationVisible();
  if (authState.passwordRecoveryMode) {
    setAuthRegistrationVisible(false, { clear: false });
    document.getElementById("resetNewPassword")?.focus();
  }
  if (message) renderAuthStatus(message);
}

async function requestPasswordResetApproval() {
  const emailInput = document.getElementById("authEmail");
  const email = String(emailInput?.value || "").trim().toLowerCase();
  if (!email) {
    renderAuthStatus("비밀번호를 재설정할 직원 이메일을 입력해주세요.");
    emailInput?.focus();
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    renderAuthStatus("이메일 형식을 확인해주세요.");
    emailInput?.focus();
    return;
  }
  if (!supabaseClient) {
    renderAuthStatus("원격 저장 연결 후 비밀번호 재설정 메일을 보낼 수 있습니다.");
    return;
  }
  renderAuthStatus("비밀번호 재설정 메일을 보내는 중입니다...");
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: getAuthRedirectUrl(),
  });
  if (error) {
    renderAuthStatus(`비밀번호 재설정 메일 발송 실패: ${error.message}`);
    return;
  }
  renderAuthStatus(`${email} 주소로 비밀번호 재설정 메일을 보냈습니다. 메일의 링크를 열어 새 비밀번호를 설정해주세요.`);
}

async function completePasswordReset() {
  if (!supabaseClient) {
    renderAuthStatus("원격 저장 연결 후 비밀번호를 변경할 수 있습니다.");
    return;
  }
  const passwordInput = document.getElementById("resetNewPassword");
  const confirmInput = document.getElementById("resetNewPasswordConfirm");
  const password = passwordInput?.value || "";
  const confirm = confirmInput?.value || "";
  if (password.length < 6) {
    renderAuthStatus("새 비밀번호는 6자 이상이어야 합니다.");
    passwordInput?.focus();
    return;
  }
  if (password !== confirm) {
    renderAuthStatus("새 비밀번호 확인이 일치하지 않습니다.");
    confirmInput?.focus();
    return;
  }
  renderAuthStatus("새 비밀번호를 저장하는 중입니다...");
  const { error } = await supabaseClient.auth.updateUser({ password });
  if (error) {
    renderAuthStatus(`비밀번호 변경 실패: ${error.message}`);
    return;
  }
  if (passwordInput) passwordInput.value = "";
  if (confirmInput) confirmInput.value = "";
  setPasswordRecoveryMode(false, "비밀번호가 변경되었습니다. 새 비밀번호로 로그인할 수 있습니다.");
  showAppToast("비밀번호가 변경되었습니다");
}

function cancelPasswordReset() {
  const passwordInput = document.getElementById("resetNewPassword");
  const confirmInput = document.getElementById("resetNewPasswordConfirm");
  if (passwordInput) passwordInput.value = "";
  if (confirmInput) confirmInput.value = "";
  setPasswordRecoveryMode(false, "비밀번호 재설정을 취소했습니다.");
}

async function loadPasswordResetRequests() {
  const list = document.getElementById("passwordResetRequestList");
  if (!list) return;
  if (!supabaseClient || !authState.user || !hasApprovalAuthority()) {
    list.innerHTML = `<p class="empty-note">대표 또는 승인 권한자만 비밀번호 재설정 요청을 확인할 수 있습니다.</p>`;
    return;
  }
  list.innerHTML = `<p class="empty-note">비밀번호 재설정 요청을 불러오는 중입니다...</p>`;
  const { data, error } = await supabaseClient
    .from("password_reset_requests")
    .select("*")
    .in("status", ["pending", "approved", "rejected", "sent"])
    .order("updated_at", { ascending: false })
    .limit(30);
  if (error) {
    list.innerHTML = `<p class="empty-note">비밀번호 재설정 요청을 불러오지 못했습니다. 최신 SQL 구조를 적용했는지 확인해주세요.<br>${escapeHtml(error.message)}</p>`;
    return;
  }
  authState.passwordResetRows = data || [];
  authState.pendingPasswordResetCount = authState.passwordResetRows.filter((row) => (row.status || "pending") === "pending").length;
  renderPasswordResetRequests();
  renderApprovalNotification();
}

function getPasswordResetStatusLabel(status = "pending") {
  if (status === "approved") return "승인완료";
  if (status === "rejected") return "반려";
  if (status === "sent") return "메일발송";
  return "승인대기";
}

function renderPasswordResetRequests() {
  const list = document.getElementById("passwordResetRequestList");
  if (!list) return;
  const rows = authState.passwordResetRows || [];
  if (!rows.length) {
    list.innerHTML = `
      <div class="approval-empty-state">
        <strong>비밀번호 재설정 요청 없음</strong>
        <p>직원이 로그인 화면에서 비밀번호 재설정을 요청하면 이곳에 표시됩니다.</p>
      </div>
    `;
    return;
  }
  list.innerHTML = `
    <div class="password-reset-cards">
      ${rows.map((row) => renderPasswordResetRequestCard(row)).join("")}
    </div>
  `;
}

function renderPasswordResetRequestCard(row) {
  const status = row.status || "pending";
  const created = row.created_at ? new Date(row.created_at).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" }) : "";
  return `
    <article class="password-reset-card" data-password-reset-card="${escapeAttr(row.id)}" data-status="${escapeAttr(status)}">
      <div>
        <strong>${escapeHtml(row.requester_name || row.email || "직원")}</strong>
        <span>${escapeHtml(row.email || "이메일 없음")}</span>
        <small>${escapeHtml(created ? `요청일 ${created}` : "요청일 미기록")}</small>
      </div>
      <em data-status="${escapeAttr(status)}">${escapeHtml(getPasswordResetStatusLabel(status))}</em>
      <label>처리 메모
        <textarea rows="2" data-password-reset-note>${escapeHtml(row.note || "")}</textarea>
      </label>
      <div class="password-reset-actions">
        ${status !== "approved" && status !== "sent" ? `<button type="button" data-password-reset-action="approve" data-password-reset-id="${escapeAttr(row.id)}">승인</button>` : ""}
        ${status !== "rejected" ? `<button type="button" data-password-reset-action="reject" data-password-reset-id="${escapeAttr(row.id)}">반려</button>` : ""}
        ${status === "approved" || status === "sent" ? `<button type="button" data-password-reset-action="send" data-password-reset-id="${escapeAttr(row.id)}">재설정 메일 발송</button>` : ""}
      </div>
    </article>
  `;
}

function collectPasswordResetPayload(id) {
  const card = Array.from(document.querySelectorAll("[data-password-reset-card]")).find((node) => node.dataset.passwordResetCard === id);
  return {
    note: card?.querySelector("[data-password-reset-note]")?.value.trim() || "",
    updated_at: new Date().toISOString(),
  };
}

async function updatePasswordResetRequest(id, action) {
  if (!supabaseClient || !authState.user || !hasApprovalAuthority()) return;
  const row = (authState.passwordResetRows || []).find((item) => item.id === id);
  if (!row) return;
  const payload = collectPasswordResetPayload(id);
  if (action === "approve") {
    payload.status = "approved";
    payload.approved_by = authState.user.id;
    payload.approved_at = new Date().toISOString();
  }
  if (action === "reject") {
    payload.status = "rejected";
    payload.approved_by = authState.user.id;
    payload.approved_at = new Date().toISOString();
  }
  if (action === "send") {
    const { error: mailError } = await supabaseClient.auth.resetPasswordForEmail(row.email, {
      redirectTo: getAuthRedirectUrl(),
    });
    if (mailError) {
      alert(`재설정 메일 발송 실패: ${mailError.message}`);
      return;
    }
    payload.status = "sent";
    payload.processed_at = new Date().toISOString();
    payload.note = payload.note || "대표 승인 후 비밀번호 재설정 메일을 발송했습니다.";
  }
  const { error } = await supabaseClient.from("password_reset_requests").update(payload).eq("id", id);
  if (error) {
    alert(`비밀번호 재설정 처리 실패: ${error.message}`);
    return;
  }
  await loadPasswordResetRequests();
  await refreshApprovalNotification();
}

function applyProfileFields(selector, datasetKey) {
  state.profile = { ...defaultProfile, ...(state.profile || {}) };
  document.querySelectorAll(selector).forEach((field) => {
    const key = field.dataset[datasetKey];
    const value = field.value.trim();
    state.profile[key] = key === "org" ? normalizePlacementOrg(value) : isPhoneField(field) ? formatPhoneNumber(value) : value;
    if (isPhoneField(field)) field.value = state.profile[field.dataset[datasetKey]];
  });
}

function applyProfileWeeklyWorkHoursFields() {
  state.profile.weeklyWorkHours = collectWeeklyWorkHoursFromControls({
    checkSelector: "[data-profile-work-hours-check]",
    inputSelector: "[data-profile-work-hours-day]",
    checkDatasetKey: "profileWorkHoursCheck",
    inputDatasetKey: "profileWorkHoursDay",
    defaultHours: state.profile?.workHours || defaultProfile.workHours,
  });
}

function getSignupSheetField(selector) {
  return document.querySelector(`#auth-panel-personal ${selector}`);
}

function getRequiredSignupFields() {
  return [
    { label: "등록 이메일", element: document.getElementById("registrationEmail"), getValue: () => document.getElementById("registrationEmail")?.value.trim() || "" },
    { label: "등록 비밀번호", element: document.getElementById("registrationPassword"), getValue: () => document.getElementById("registrationPassword")?.value || "" },
    { label: "이름", element: getSignupSheetField('[data-profile-field="name"]'), getValue: () => getSignupSheetField('[data-profile-field="name"]')?.value.trim() || "" },
    { label: "전화", element: getSignupSheetField('[data-profile-field="phone"]'), getValue: () => getSignupSheetField('[data-profile-field="phone"]')?.value.trim() || "" },
    { label: "소속", element: getSignupSheetField('[data-profile-field="org"]'), getValue: () => getSignupSheetField('[data-profile-field="org"]')?.value.trim() || "" },
    { label: "근무지", element: getSignupSheetField('[data-profile-field="workplace"]'), getValue: () => getSignupSheetField('[data-profile-field="workplace"]')?.value.trim() || "" },
    { label: "기본 근무시간", element: getSignupSheetField('[data-profile-field="workHours"]'), getValue: () => getSignupSheetField('[data-profile-field="workHours"]')?.value.trim() || "" },
  ];
}

function validateSignupRequiredFields() {
  for (const field of getRequiredSignupFields()) {
    const value = field.getValue();
    if (!value) {
      const message = `${field.label} 누락입니다.`;
      renderAuthStatus(message);
      alert(message);
      field.element?.focus();
      return false;
    }
  }
  const password = document.getElementById("registrationPassword")?.value || "";
  const passwordConfirm = document.getElementById("authPasswordConfirm")?.value || "";
  if (password.length < 6) {
    const message = "비밀번호는 6자 이상이어야 합니다.";
    renderAuthStatus(message);
    alert(message);
    document.getElementById("registrationPassword")?.focus();
    return false;
  }
  if (password !== passwordConfirm) {
    const message = "비밀번호 확인이 일치하지 않습니다.";
    renderAuthStatus(message);
    alert(message);
    document.getElementById("authPasswordConfirm")?.focus();
    return false;
  }
  if (!isSignupEmailConfirmedAvailable()) {
    const message = "이메일 중복확인을 먼저 완료해주세요.";
    renderAuthStatus(message);
    alert(message);
    document.getElementById("registrationEmail")?.focus();
    return false;
  }
  return true;
}

function showSignupSubmittedMessage() {
  alert("직원등록 신청이 완료되었습니다. 승인이 되면 정상적으로 앱 사용이 가능합니다.");
}

function closeSignupAfterSubmit() {
  setAuthRegistrationVisible(false, { clear: false });
  switchAuthTab("personal");
}

async function completeEmployeeRegistration() {
  if (!isAuthRegistrationVisible()) {
    openEmployeeRegistrationForm({ clear: isExplicitlySignedOut() || !authState.user, prefill: true });
    return;
  }
  if (!validateSignupRequiredFields()) return;
  await signUpWithSupabase({ closeOnSuccess: true });
}

function saveProfileFromForm() {
  if (isAuthRegistrationVisible()) {
    completeEmployeeRegistration();
    return;
  }
  applyProfileFields("[data-profile-field]", "profileField");
  applyProfileWeeklyWorkHoursFields();
  saveProfileChanges();
}

function saveSettingsProfileFromForm() {
  const draft = collectSettingsProfileDraft();
  const changes = collectProfileChangeRequest(draft);
  const requiresApproval = authState.user && isProfileApproved() && !hasApprovalAuthority();
  if (requiresApproval && Object.keys(changes).length) {
    applyImmediateSettingsProfileFields(draft);
    const requestedAt = new Date().toISOString();
    state.profile.pendingProfileChanges = {
      status: "pending",
      requestedAt,
      requestedBy: authState.user?.id || "",
      fields: changes,
    };
    state.profile.profileChangeRequestedAt = requestedAt;
    saveManualSettingsFromForm();
    saveProfileChanges({ stayInSettings: true, includePendingProfileChangeFields: true });
    showAppToast("직원정보 변경 승인요청을 보냈습니다. 대표 승인요청 알림에 표시됩니다.");
    return;
  }
  state.profile = { ...state.profile, ...draft };
  if (!requiresApproval) {
    state.profile.pendingProfileChanges = {};
    state.profile.profileChangeRequestedAt = "";
  }
  saveManualSettingsFromForm();
  saveProfileChanges();
}

function saveProfileChanges({ stayInSettings = false, includePendingProfileChangeFields = false } = {}) {
  if (authState.user && (!state.profile.approvalStatus || state.profile.approvalStatus === "draft")) state.profile.approvalStatus = "pending";
  const nextWorklogView = getUserWorklogView();
  if (nextWorklogView === "fitness-log") {
    syncFitnessWritableEmployeeFromProfile();
  } else {
    state.selectedEmployeeId = getProfileMappedEmployeeId() || "profile-user";
  }
  normalizeState();
  normalizeEmployeeLogRows(getSelectedLog());
  normalizeEmployeeLogRows(getEmployeeLogForDate(state.fitnessWritableEmployeeId));
  saveState();
  saveRemoteProfile({ includePendingProfileChangeFields });
  renderAll();
  if (authState.user && !isProfileApproved()) {
    switchView("auth");
    renderAuthStatus("직원등록 정보가 저장되었습니다. 대표 승인 후 업무일지를 사용할 수 있습니다.");
    return;
  }
  switchView(stayInSettings ? "settings" : nextWorklogView);
}

function renderAuthStatus(message) {
  const status = document.getElementById("authStatus");
  const email = authState.user?.email || "";
  const readyText = authState.remoteReady ? "직원 계정 연결 준비됨" : "원격 저장 준비 중";
  status.textContent = message || (email ? `${email} 로그인됨 · 원격 저장 켜짐` : `${readyText} · 로그인하면 원격 저장됩니다.`);
  renderMainMenuAuthButton();
}

function clearAuthFormCredentials() {
  const emailInput = document.getElementById("authEmail");
  const passwordInput = document.getElementById("authPassword");
  const registrationEmailInput = document.getElementById("registrationEmail");
  const registrationPasswordInput = document.getElementById("registrationPassword");
  const passwordConfirmInput = document.getElementById("authPasswordConfirm");
  const resetPasswordInput = document.getElementById("resetNewPassword");
  const resetPasswordConfirmInput = document.getElementById("resetNewPasswordConfirm");
  if (emailInput) emailInput.value = "";
  if (passwordInput) passwordInput.value = "";
  if (registrationEmailInput) registrationEmailInput.value = "";
  if (registrationPasswordInput) registrationPasswordInput.value = "";
  if (passwordConfirmInput) passwordConfirmInput.value = "";
  if (resetPasswordInput) resetPasswordInput.value = "";
  if (resetPasswordConfirmInput) resetPasswordConfirmInput.value = "";
  resetSignupEmailCheck();
}

function isAuthRegistrationVisible() {
  const panel = document.querySelector("[data-auth-registration]");
  return Boolean(panel && !panel.hidden);
}

function setAuthRegistrationVisible(visible, { clear = false } = {}) {
  document.querySelectorAll("[data-auth-registration]").forEach((node) => {
    node.hidden = !visible;
  });
  document.querySelectorAll(".login-card:not(.password-update-card)").forEach((node) => {
    node.hidden = visible || authState.passwordRecoveryMode;
  });
  const passwordUpdateCard = document.getElementById("passwordUpdateCard");
  if (passwordUpdateCard) passwordUpdateCard.hidden = !authState.passwordRecoveryMode;
  if (!visible) {
    switchAuthTab("personal");
    return;
  }
  switchAuthTab("personal");
  if (clear) clearSignupProfileFields();
}

function openEmployeeRegistrationForm({ clear = false, prefill = false } = {}) {
  if (prefill) {
    const loginEmail = document.getElementById("authEmail")?.value || "";
    const loginPassword = document.getElementById("authPassword")?.value || "";
    const registrationEmail = document.getElementById("registrationEmail");
    const registrationPassword = document.getElementById("registrationPassword");
    if (registrationEmail && !registrationEmail.value) registrationEmail.value = loginEmail;
    if (registrationPassword && !registrationPassword.value) registrationPassword.value = loginPassword;
  }
  setAuthRegistrationVisible(true, { clear });
  renderAuthStatus("직원등록 시트를 작성한 뒤 다시 직원등록을 누르면 신청됩니다.");
  updateRegistrationWorkplaceOptions({ preserve: true });
  document.getElementById("registrationEmail")?.focus();
}

function getNormalizedAuthEmail() {
  const source = isAuthRegistrationVisible() ? "registrationEmail" : "authEmail";
  return String(document.getElementById(source)?.value || "").trim().toLowerCase();
}

function isValidEmail(value = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function resetSignupEmailCheck(message = "직원등록 전 이메일 중복확인을 해주세요.") {
  authState.signupEmailCheck = {
    email: "",
    status: "idle",
    message,
  };
  renderSignupEmailCheckStatus();
}

function renderSignupEmailCheckStatus() {
  const node = document.getElementById("emailCheckStatus");
  const button = document.getElementById("emailCheckButton");
  if (!node) return;
  const check = authState.signupEmailCheck || {};
  node.textContent = check.message || "";
  node.dataset.status = check.status || "idle";
  if (button) {
    button.disabled = check.status === "checking";
    button.textContent = check.status === "checking" ? "확인 중" : "중복확인";
  }
}

function isSignupEmailConfirmedAvailable() {
  const email = getNormalizedAuthEmail();
  const check = authState.signupEmailCheck || {};
  return Boolean(email && check.email === email && check.status === "available");
}

async function checkSignupEmailDuplicate() {
  const email = getNormalizedAuthEmail();
  if (!email) {
    const message = "이메일 누락입니다.";
    resetSignupEmailCheck(message);
    renderAuthStatus(message);
    alert(message);
    document.getElementById(isAuthRegistrationVisible() ? "registrationEmail" : "authEmail")?.focus();
    return false;
  }
  if (!isValidEmail(email)) {
    const message = "이메일 형식을 확인해주세요.";
    resetSignupEmailCheck(message);
    renderAuthStatus(message);
    alert(message);
    document.getElementById(isAuthRegistrationVisible() ? "registrationEmail" : "authEmail")?.focus();
    return false;
  }
  if (!supabaseClient) {
    const message = "원격 저장 연결 후 이메일 중복확인이 가능합니다.";
    authState.signupEmailCheck = { email, status: "unknown", message };
    renderSignupEmailCheckStatus();
    renderAuthStatus(message);
    alert(message);
    return false;
  }
  authState.signupEmailCheck = { email, status: "checking", message: "이메일을 확인하고 있습니다..." };
  renderSignupEmailCheckStatus();
  const { data, error } = await supabaseClient.rpc("check_registration_email", { email_to_check: email });
  if (error) {
    const message = "이메일 중복확인 기능을 준비해야 합니다. Supabase SQL을 최신으로 적용해주세요.";
    authState.signupEmailCheck = { email, status: "unknown", message };
    renderSignupEmailCheckStatus();
    renderAuthStatus(message);
    alert(`${message}\n${error.message}`);
    return false;
  }
  const exists = Boolean(data?.exists);
  if (exists) {
    const message = "이미 등록된 이메일입니다. 로그인 또는 비밀번호 재설정을 이용해주세요.";
    authState.signupEmailCheck = { email, status: "duplicate", message };
    renderSignupEmailCheckStatus();
    renderAuthStatus(message);
    alert(message);
    return false;
  }
  const message = "사용 가능한 이메일입니다.";
  authState.signupEmailCheck = { email, status: "available", message };
  renderSignupEmailCheckStatus();
  renderAuthStatus(message);
  return true;
}

function validateRegistrationAccountGate() {
  const email = getNormalizedAuthEmail();
  const password = document.getElementById("registrationPassword")?.value || "";
  const passwordConfirm = document.getElementById("authPasswordConfirm")?.value || "";
  if (!email) {
    renderAuthStatus("이메일 누락입니다.");
    alert("이메일 누락입니다.");
    document.getElementById("registrationEmail")?.focus();
    return false;
  }
  if (!isValidEmail(email)) {
    renderAuthStatus("이메일 형식을 확인해주세요.");
    alert("이메일 형식을 확인해주세요.");
    document.getElementById("registrationEmail")?.focus();
    return false;
  }
  if (password.length < 6) {
    renderAuthStatus("비밀번호는 6자 이상이어야 합니다.");
    alert("비밀번호는 6자 이상이어야 합니다.");
    document.getElementById("registrationPassword")?.focus();
    return false;
  }
  if (password !== passwordConfirm) {
    renderAuthStatus("비밀번호 확인이 일치하지 않습니다.");
    alert("비밀번호 확인이 일치하지 않습니다.");
    document.getElementById("authPasswordConfirm")?.focus();
    return false;
  }
  if (!isSignupEmailConfirmedAvailable()) {
    renderAuthStatus("이메일 중복확인을 먼저 완료해주세요.");
    alert("이메일 중복확인을 먼저 완료해주세요.");
    document.getElementById("emailCheckButton")?.focus();
    return false;
  }
  return true;
}

function isKnownLoggedInProfile() {
  if (authState.user) return true;
  if (isExplicitlySignedOut()) return false;
  const email = String(state.profile?.email || "").trim().toLowerCase();
  const status = state.profile?.approvalStatus || "";
  return Boolean(email && status === "approved");
}

function isExplicitlySignedOut() {
  return localStorage.getItem(localAuthSignedOutKey) === "1" && !authState.user;
}

function renderMainMenuAuthButton() {
  const button = document.querySelector('[data-menu-view="auth"]');
  const email = authState.user?.email || state.profile?.email || "";
  const isLoggedIn = isKnownLoggedInProfile();
  if (button) {
    button.textContent = isLoggedIn ? "로그아웃" : "로그인/직원등록";
    button.dataset.menuAction = isLoggedIn ? "logout" : "login";
    button.setAttribute("aria-label", isLoggedIn ? `${email || "현재 계정"} 로그아웃` : "로그인과 직원등록 페이지 열기");
  }
  renderMainMenuVisibility();
}

function renderMainMenuVisibility() {
  const worklogButton = document.querySelector('#mainMenuPopover [data-menu-view="worklog"]');
  const laborButton = document.querySelector('#mainMenuPopover [data-menu-view="attendance"]');
  if (worklogButton) {
    worklogButton.textContent = canAccessAllWorklogs()
      ? "전직원 업무일지"
      : canAccessWorklogOverview() ? "소속 업무일지" : "업무일지";
  }
  if (laborButton) {
    laborButton.textContent = canAccessAllLabor()
      ? "전직원 노무"
      : hasProfilePermission("laborSite") ? "소속 노무" : "노무";
  }
  const viewAccess = {
    executive: () => isRepresentativeProfile() || hasProfilePermission("executiveRoom"),
    control: () => canAccessControlTower(),
    worklog: () => isKnownLoggedInProfile(),
    staff: () => canAccessStaffSection(),
    attendance: () => canOpenLaborSection(),
    premium: () => canAccessPremiumOperations(),
    ai: () => isKnownLoggedInProfile(),
    report: () => isKnownLoggedInProfile(),
    settings: () => isKnownLoggedInProfile(),
    auth: () => true,
  };
  document.querySelectorAll("#mainMenuPopover [data-menu-view]").forEach((item) => {
    const view = item.dataset.menuView;
    if (isExplicitlySignedOut()) {
      item.hidden = view !== "auth";
      return;
    }
    item.hidden = !(viewAccess[view]?.() ?? false);
  });
  document.querySelectorAll(".worklog-tabs [data-view]").forEach((item) => {
    const view = item.dataset.view;
    if (viewAccess[view]) item.hidden = !viewAccess[view]();
  });
  document.querySelectorAll("#mainMenuWheelSelect option").forEach((item) => {
    const allowed = viewAccess[item.value]?.() ?? false;
    item.hidden = !allowed;
    item.disabled = !allowed;
    if (item.value === "worklog") item.textContent = worklogButton?.textContent || "업무일지";
    if (item.value === "attendance") item.textContent = laborButton?.textContent || "노무";
  });
  document.querySelectorAll("#mainMenuPopover [data-menu-action]").forEach((item) => {
    if (isExplicitlySignedOut() && !item.dataset.menuView) item.hidden = true;
  });
  renderApprovalNotification();
}

function clearAuthRuntimeState() {
  authState.session = null;
  authState.user = null;
  clearTimeout(authState.saveTimer);
  authState.saveTimer = null;
  clearInterval(authState.approvalTimer);
  authState.approvalTimer = null;
  authState.pendingApprovalCount = 0;
  authState.pendingPasswordResetCount = 0;
  authState.approvalRows = [];
  authState.approvalRowsLoaded = false;
  authState.passwordResetRows = [];
  authState.selectedApprovalId = "";
  authState.approvalRepairTried = false;
  authState.passwordRecoveryMode = false;
  authState.applyingRemote = false;
  authState.visibleWorklogsLoading = false;
  authState.saveTimers?.forEach((timer) => clearTimeout(timer));
  authState.saveTimers = new Map();
  clearInterval(authState.visibleWorklogsTimer);
  authState.visibleWorklogsTimer = null;
}

function isSameAuthProfile(user = authState.user, profile = state.profile || {}) {
  if (!user) return false;
  const userId = String(user.id || "");
  const userEmail = String(user.email || "").trim().toLowerCase();
  const profileUserId = String(profile.authUserId || "");
  const profileEmail = String(profile.email || "").trim().toLowerCase();
  return Boolean((userId && profileUserId === userId) || (userEmail && profileEmail === userEmail));
}

function resetProfileForAuthUser(user = authState.user) {
  const email = String(user?.email || "").trim().toLowerCase();
  state.profile = {
    ...defaultProfile,
    email,
    authUserId: user?.id || "",
    accessPreset: controlTowerEmails.has(email) ? "owner" : "employee",
    permissions: {},
  };
  state.selectedEmployeeId = getProfileMappedEmployeeId(state.profile) || "profile-user";
  if (!controlTowerEmails.has(email)) state.fitnessWritableEmployeeId = getProfileMappedEmployeeId(state.profile) || "";
}

function hasUnsafeRepresentativeResidue(user = authState.user, profile = state.profile || {}) {
  const email = String(user?.email || profile.email || "").trim().toLowerCase();
  if (!email || controlTowerEmails.has(email)) return false;
  const presetKey = normalizePermissionPresetKey(profile.accessPreset || "employee");
  return presetKey === "owner";
}

function enforceAuthProfileBoundary(user = authState.user) {
  if (!user) return;
  const email = String(user.email || state.profile?.email || "").trim().toLowerCase();
  const overridePreset = getProfilePlacementOverride(email)?.accessPreset;
  state.profile.email = email;
  state.profile.authUserId = user.id || state.profile.authUserId || "";
  if (controlTowerEmails.has(email)) {
    state.profile.accessPreset = "owner";
    state.profile.permissions = {};
    return;
  }
  let presetKey = normalizePermissionPresetKey(overridePreset || state.profile.accessPreset || getRecommendedPermissionPresetForProfile(state.profile));
  if (presetKey === "owner") presetKey = "employee";
  state.profile.accessPreset = presetKey;
  if (presetKey !== "executive_delegate") {
    state.profile.permissions = { ...(state.profile.permissions || {}), executiveRoom: false };
  } else {
    state.profile.permissions = { ...(state.profile.permissions || {}) };
  }
}

function getAuthCredentials({ registration = false } = {}) {
  const useRegistrationFields = registration || isAuthRegistrationVisible();
  const email = document.getElementById(useRegistrationFields ? "registrationEmail" : "authEmail")?.value.trim() || "";
  const password = document.getElementById(useRegistrationFields ? "registrationPassword" : "authPassword")?.value || "";
  if (!email || !password) {
    renderAuthStatus("이메일과 비밀번호를 입력해주세요.");
    return null;
  }
  return { email, password };
}

function getAuthRedirectUrl() {
  return productionAppUrl;
}

function collectSignupMetadata(credentials = {}) {
  applyProfileFields("#auth-panel-personal [data-profile-field]", "profileField");
  applyProfileWeeklyWorkHoursFields();
  const profile = { ...defaultProfile, ...(state.profile || {}) };
  profile.email = credentials.email || profile.email || "";
  profile.role = defaultProfile.role;
  profile.primaryWork = "";
  profile.secondaryWork = "";
  profile.employmentType = defaultProfile.employmentType;
  profile.dailyWage = "";
  profile.hourlyWage = "";
  state.profile = profile;
  saveState();
  return {
    org: profile.org || defaultProfile.org,
    role: defaultProfile.role,
    name: profile.name || "",
    nickname: profile.nickname || "",
    phone: profile.phone || "",
    email: profile.email || "",
    primaryWork: "",
    secondaryWork: "",
    workplace: profile.workplace || "",
    employmentType: defaultProfile.employmentType,
    laborId: profile.laborId || "",
    address: profile.address || "",
    dailyWage: "",
    hourlyWage: "",
    workHours: profile.workHours || defaultProfile.workHours,
    weeklyWorkHours: profile.weeklyWorkHours || {},
    extra: profile.extra || "",
    strengths: profile.strengths || "",
    weaknesses: profile.weaknesses || "",
    developmentGoals: profile.developmentGoals || "",
  };
}

function getSignupErrorMessage(error = {}) {
  const raw = String(error.message || error.error_description || error || "").trim();
  const lower = raw.toLowerCase();
  if (!raw) return "직원등록 처리 중 오류가 발생했습니다.";
  if (lower.includes("already") || lower.includes("registered") || lower.includes("exists")) {
    return "이미 등록된 이메일입니다. 기존 직원이면 로그인하시고, 비밀번호를 잊은 경우 비밀번호 재설정을 사용해주세요.";
  }
  if (lower.includes("email") && (lower.includes("confirm") || lower.includes("verified"))) {
    return "이메일 확인이 필요합니다. 메일함에서 확인 링크를 먼저 눌러주세요.";
  }
  if (lower.includes("password")) return `비밀번호를 확인해주세요. ${raw}`;
  return `직원등록 실패: ${raw}`;
}

function setSignupBusy(isBusy) {
  const button = document.getElementById("saveProfileButton");
  const signupButton = document.getElementById("signupButton");
  if (button) {
    button.disabled = isBusy;
    button.textContent = isBusy ? "신청 처리 중" : "신청 완료";
  }
  if (signupButton) signupButton.disabled = isBusy;
}

async function signUpWithSupabase(options = {}) {
  if (!isAuthRegistrationVisible()) {
    openEmployeeRegistrationForm({ clear: isExplicitlySignedOut() || !authState.user, prefill: true });
    return;
  }
  if (!validateSignupRequiredFields()) return;
  const credentials = getAuthCredentials({ registration: true });
  if (!credentials) return;
  if (!supabaseClient) {
    const message = "직원등록 서버 연결이 아직 준비되지 않았습니다. 잠시 후 다시 눌러주세요.";
    renderAuthStatus(message);
    alert(message);
    return;
  }
  renderAuthStatus("직원등록 처리 중입니다...");
  setSignupBusy(true);
  try {
    const signupMetadata = collectSignupMetadata(credentials);
    const { data, error } = await supabaseClient.auth.signUp({
      email: credentials.email,
      password: credentials.password,
      options: {
        emailRedirectTo: getAuthRedirectUrl(),
        data: signupMetadata,
      },
    });
    if (error) {
      const message = getSignupErrorMessage(error);
      renderAuthStatus(message);
      alert(message);
      return;
    }
    if (data.user) {
      state.profile.email = credentials.email;
      saveState();
      renderProfileForm();
      if (data.session) {
        await applySession(data.session);
        setOwnApprovalPending();
        await saveRemoteProfile();
        renderAuthStatus("직원등록 신청이 접수되었습니다. 대표 또는 권한자의 승인 후 사용할 수 있습니다.");
        if (options.closeOnSuccess) {
          showSignupSubmittedMessage();
          closeSignupAfterSubmit();
        }
        return;
      }
      renderAuthStatus("직원 계정이 생성되었습니다. 직원등록 정보는 대표 승인 목록에 접수됩니다. 이메일 확인과 대표 승인 후 사용할 수 있습니다.");
      if (options.closeOnSuccess) {
        showSignupSubmittedMessage();
        closeSignupAfterSubmit();
      }
      return;
    }
    renderAuthStatus("직원등록 신청이 접수되었습니다. 대표 또는 권한자의 승인 후 사용할 수 있습니다.");
    if (options.closeOnSuccess) {
      showSignupSubmittedMessage();
      closeSignupAfterSubmit();
    }
  } catch (error) {
    const message = getSignupErrorMessage(error);
    renderAuthStatus(message);
    alert(message);
  } finally {
    setSignupBusy(false);
  }
}

async function signInWithSupabase() {
  const credentials = getAuthCredentials();
  if (!credentials || !supabaseClient) return;
  renderAuthStatus("로그인 중입니다...");
  const { data, error } = await supabaseClient.auth.signInWithPassword(credentials);
  if (error) {
    if (/email not confirmed/i.test(error.message || "")) {
      await resendSignupConfirmation(credentials.email);
      renderAuthStatus("로그인 실패: 이메일 확인이 필요합니다. 확인 메일을 다시 보냈습니다. 메일 확인 후 다시 로그인해주세요.");
      return;
    }
    renderAuthStatus(`로그인 실패: ${error.message}`);
    return;
  }
  await applySession(data.session);
}

async function resendSignupConfirmation(email) {
  if (!supabaseClient || !email) return;
  try {
    await supabaseClient.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: getAuthRedirectUrl() },
    });
  } catch (_error) {
    // 로그인 흐름을 막지 않기 위해 재전송 실패는 상태 문구로만 안내합니다.
  }
}

async function signOutWithSupabase() {
  try {
    if (supabaseClient) await supabaseClient.auth.signOut();
  } finally {
    clearAuthRuntimeState();
    localStorage.setItem(localAuthSignedOutKey, "1");
  }
  renderApprovalNotification();
  clearAuthFormCredentials();
  setAuthRegistrationVisible(false, { clear: true });
  renderAuthStatus("로그아웃되었습니다. 업무 입력 내용은 이 기기에 계속 보관됩니다.");
  renderAll();
  switchView("auth");
  renderProfileForm();
  clearAuthFormCredentials();
  setAuthRegistrationVisible(false, { clear: true });
}

async function applySession(session) {
  authState.session = session;
  authState.user = session?.user || null;
  if (!authState.user) {
    clearAuthRuntimeState();
    clearAuthFormCredentials();
    setAuthRegistrationVisible(false, { clear: false });
    renderApprovalNotification();
    renderAuthStatus("로그인 또는 직원등록을 진행해주세요.");
    renderAll();
    switchView("auth");
    return;
  }
  localStorage.removeItem(localAuthSignedOutKey);
  document.getElementById("authEmail").value = authState.user.email || "";
  if (!isSameAuthProfile(authState.user) || hasUnsafeRepresentativeResidue(authState.user)) resetProfileForAuthUser(authState.user);
  state.profile.authUserId = authState.user.id || state.profile.authUserId || "";
  state.profile.email = authState.user.email || state.profile.email || "";
  await loadRemoteProfile();
  enforceAuthProfileBoundary();
  if (hasApprovalAuthority()) {
    state.profile.approvalStatus = "approved";
    state.profile.approvedBy ||= authState.user.id;
    state.profile.approvedAt ||= new Date().toISOString();
  }
  if (!state.profile.approvalStatus || state.profile.approvalStatus === "draft") state.profile.approvalStatus = "pending";
  if (!isProfileApproved()) {
    await saveRemoteProfile();
    saveState();
    renderAll();
    switchView("auth");
    renderAuthStatus(`현재 상태: ${getApprovalStatusLabel()}. 대표 승인 후 업무일지를 사용할 수 있습니다.`);
    return;
  }
  resetStartupDateToToday();
  await loadRemoteWorklogForActiveDate();
  await saveRemoteProfile();
  scheduleRemoteSave(0);
  startApprovalNotificationPolling();
  startVisibleWorklogPolling();
  renderAll();
  renderAuthStatus();
  switchView(getInitialLandingView());
}

function scheduleRemoteSave(delay = 700, dateKey = getActiveDateKey()) {
  if (!authState.user || authState.applyingRemote) return;
  const key = dateKey || getActiveDateKey();
  authState.saveTimers ||= new Map();
  clearTimeout(authState.saveTimers.get(key));
  const timer = setTimeout(() => {
    authState.saveTimers.delete(key);
    saveRemoteSnapshot(key);
  }, delay);
  authState.saveTimers.set(key, timer);
  authState.saveTimer = timer;
}

async function flushPendingRemoteSaves() {
  if (!authState.user || !authState.saveTimers?.size) return;
  const dateKeys = [...authState.saveTimers.keys()];
  dateKeys.forEach((dateKey) => {
    clearTimeout(authState.saveTimers.get(dateKey));
    authState.saveTimers.delete(dateKey);
  });
  await Promise.allSettled(dateKeys.map((dateKey) => saveRemoteSnapshot(dateKey)));
}

function buildRemoteSnapshot(dateKey = getActiveDateKey()) {
  const key = dateKey || getActiveDateKey();
  const snapshotProfile = applyProfilePlacementOverride(state.profile || {});
  const hasPersonalWorklog = !isRepresentativeProfile();
  const ownerEmployeeId = hasPersonalWorklog ? getProfileMappedEmployeeId(snapshotProfile) || "profile-user" : "";
  const ownerWorklog = hasPersonalWorklog
    ? state.employeeLogs?.[key]?.[ownerEmployeeId] || state.employeeLogs?.[key]?.["profile-user"] || null
    : null;
  return {
    backupSettings: state.backupSettings,
    selectedEmployeeId: state.selectedEmployeeId,
    selectedDateKey: key,
    profile: snapshotProfile,
    ownerEmployeeId,
    ownerWorklog: ownerWorklog ? cloneWorklogLogForAudit(ownerWorklog) : null,
    employeeLogs: { [key]: ownerWorklog ? { [ownerEmployeeId]: cloneWorklogLogForAudit(ownerWorklog) } : {} },
    attendance: { [key]: state.attendance?.[key] || [] },
    companyCommonWeeks: state.companyCommonWeeks || {},
    dagymDaily: state.dagymDaily || {},
    fitnessDailyGuidance: state.fitnessDailyGuidance || {},
    fitnessCenterReports: state.fitnessCenterReports || {},
    worklogReportSubmissions: state.worklogReportSubmissions || {},
    reportTone: state.reportTone,
    siteWeatherAddresses: state.siteWeatherAddresses || {},
    weatherCache: state.weatherCache || {},
    weatherLocationCache: state.weatherLocationCache || {},
  };
}

async function saveRemoteSnapshot(dateKey = getActiveDateKey()) {
  if (!supabaseClient || !authState.user) return;
  const key = dateKey || getActiveDateKey();
  const { error } = await supabaseClient.from("worklog_states").upsert({
    user_id: authState.user.id,
    log_date: key,
    organization: state.profile?.org || "(주)방주",
    state: buildRemoteSnapshot(key),
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,organization,log_date" });
  if (error) {
    renderAuthStatus(`원격 저장 대기: ${error.message}`);
    return;
  }
  renderAuthStatus();
}

async function loadRemoteWorklogForActiveDate() {
  if (!supabaseClient || !authState.user) return;
  const key = getActiveDateKey();
  const { data, error } = await supabaseClient
    .from("worklog_states")
    .select("state")
    .eq("user_id", authState.user.id)
    .eq("log_date", key)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    renderAuthStatus(`원격 불러오기 대기: ${error.message}`);
    return;
  }
  authState.applyingRemote = true;
  if (data?.state) {
    state.backupSettings = { ...(state.backupSettings || {}), ...(data.state.backupSettings || {}) };
    state.selectedEmployeeId = data.state.selectedEmployeeId || state.selectedEmployeeId;
    state.profile = { ...state.profile, ...(data.state.profile || {}) };
    state.profile = applyProfilePlacementOverride(state.profile);
    normalizeProfilePlacementForAuth();
    enforceAuthProfileBoundary();
    mergeOwnRemoteEmployeeLogs(data.state.employeeLogs || {});
    state.attendance = { ...(state.attendance || {}), ...(data.state.attendance || {}) };
    state.companyCommonWeeks = { ...(state.companyCommonWeeks || {}), ...(data.state.companyCommonWeeks || {}) };
    mergeSharedFitnessOperations(data.state);
    state.fitnessCenterReports = { ...(state.fitnessCenterReports || {}), ...(data.state.fitnessCenterReports || {}) };
    state.worklogReportSubmissions = { ...(state.worklogReportSubmissions || {}), ...(data.state.worklogReportSubmissions || {}) };
    state.reportTone = data.state.reportTone || state.reportTone;
    state.siteWeatherAddresses = { ...(state.siteWeatherAddresses || {}), ...(data.state.siteWeatherAddresses || {}) };
    state.weatherCache = { ...(state.weatherCache || {}), ...(data.state.weatherCache || {}) };
    state.weatherLocationCache = { ...(state.weatherLocationCache || {}), ...(data.state.weatherLocationCache || {}) };
  }
  await loadLatestRemoteSiteWeatherSettings();
  await loadRemoteLaborPayrollDrafts();
  if (canAccessAllWorklogs()) await loadVisibleStaffWorklogsForDate(key);
  else await loadCoworkerWorklogsForDate(key);
  normalizeState();
  localStorage.setItem(storageKey, JSON.stringify(state));
  authState.applyingRemote = false;
  renderAll();
  renderAuthStatus();
}

function mergeOwnRemoteEmployeeLogs(remoteEmployeeLogs = {}) {
  state.employeeLogs ||= {};
  const ownEmployeeId = getProfileMappedEmployeeId() || "profile-user";
  Object.entries(remoteEmployeeLogs).forEach(([dateKey, remoteLogs]) => {
    state.employeeLogs[dateKey] ||= {};
    Object.entries(remoteLogs || {}).forEach(([remoteEmployeeId, remoteLog]) => {
      const isOwnAlias = [ownEmployeeId, "profile-user", authState.user?.id, `profile-${authState.user?.id || ""}`]
        .filter(Boolean)
        .includes(remoteEmployeeId);
      const targetEmployeeId = isOwnAlias ? ownEmployeeId : remoteEmployeeId;
      const localLog = state.employeeLogs[dateKey][targetEmployeeId]
        || (isOwnAlias ? state.employeeLogs[dateKey]["profile-user"] : null);
      const localUpdatedAt = String(localLog?.updatedAt || "");
      const remoteUpdatedAt = String(remoteLog?.updatedAt || "");
      const keepLocal = Boolean(
        localLog
        && hasSubmittableWorklogContent(localLog)
        && (!hasSubmittableWorklogContent(remoteLog) || (localUpdatedAt && localUpdatedAt > remoteUpdatedAt))
      );
      if (keepLocal) return;
      state.employeeLogs[dateKey][targetEmployeeId] = {
        ...cloneWorklogLogForAudit(remoteLog),
        employeeId: targetEmployeeId,
      };
    });
  });
}

async function loadLatestRemoteSiteWeatherSettings() {
  if (!supabaseClient || !authState.user) return;
  const { data, error } = await supabaseClient
    .from("worklog_states")
    .select("state,updated_at")
    .eq("user_id", authState.user.id)
    .order("updated_at", { ascending: false })
    .limit(30);
  if (error || !Array.isArray(data)) return;
  mergeSiteWeatherAddressesFromSnapshots(data);
}

async function loadVisibleStaffWorklogsForDate(dateKey = getActiveDateKey()) {
  await ensureWorklogDirectoryRows();
  let { data, error } = await supabaseClient.rpc("get_visible_worklog_states", { target_date: dateKey });
  if (error && /function|schema cache|get_visible_worklog_states|PGRST202/i.test(String(error.message || ""))) {
    ({ data, error } = await supabaseClient
      .from("worklog_states")
      .select("user_id,state,updated_at")
      .eq("log_date", dateKey)
      .neq("user_id", authState.user.id)
      .order("updated_at", { ascending: false }));
  }
  if (error) {
    renderAuthStatus(`직원 업무일지 불러오기 대기: ${error.message}`);
    return;
  }
  mergeVisibleStaffWorklogStates(data || [], dateKey);
}

async function loadCoworkerWorklogsForDate(dateKey = getActiveDateKey()) {
  if (!supabaseClient || !authState.user || !isProfileApproved()) return;
  const { data, error } = await supabaseClient.rpc("get_coworker_worklog_states", { target_date: dateKey });
  if (error) {
    renderAuthStatus(`동료 업무일지 불러오기 대기: ${error.message}`);
    return;
  }
  mergeVisibleStaffWorklogStates(data || [], dateKey);
}

async function ensureWorklogDirectoryRows() {
  if (authState.approvalRowsLoaded || !supabaseClient || !authState.user || !canAccessWorklogOverview()) return;
  const { data, error } = await fetchApprovalProfileRows();
  if (error) return;
  authState.approvalRows = getVisibleApprovalRows(data || []);
  authState.approvalRowsLoaded = true;
  authState.pendingApprovalCount = countApprovalActionItems(authState.approvalRows);
  renderApprovalNotification();
}

function resolveRemoteWorklogEmployee(row = {}) {
  const remoteState = row?.state || {};
  const profile = remoteState.profile || {};
  const approvalRow = (authState.approvalRows || []).find((item) => String(item.id || "") === String(row.user_id || ""));
  const approvalEmployee = approvalRow ? approvalRowToStaffEmployee(approvalRow) : null;
  const email = normalizeEmailValue(profile.email || approvalRow?.email || "");
  const mappedId = approvalEmployee?.mappedEmployeeId || getProfileMappedEmployeeId(profile);
  return approvalEmployee
    || getStaffDirectoryEmployees().find((item) => (
      String(item.sourceProfileId || "") === String(row.user_id || "")
      || (mappedId && (item.id === mappedId || item.mappedEmployeeId === mappedId))
      || (email && normalizeEmailValue(item.email || "") === email)
    ))
    || employees.find((item) => item.id === mappedId)
    || null;
}

async function refreshVisibleStaffWorklogsForActiveDate() {
  if (!supabaseClient || !authState.user || !canAccessAllWorklogs() || authState.visibleWorklogsLoading) return;
  authState.visibleWorklogsLoading = true;
  try {
    const dateKey = getActiveDateKey();
    await loadVisibleStaffWorklogsForDate(dateKey);
    if (dateKey !== getActiveDateKey()) return;
    normalizeState();
    localStorage.setItem(storageKey, JSON.stringify(state));
    renderWorklogOverview();
  } finally {
    authState.visibleWorklogsLoading = false;
  }
}

function startVisibleWorklogPolling() {
  clearInterval(authState.visibleWorklogsTimer);
  authState.visibleWorklogsTimer = null;
  if (!authState.user || !canAccessAllWorklogs()) return;
  authState.visibleWorklogsTimer = setInterval(() => {
    if (document.visibilityState !== "visible" || activeView !== "worklog-overview") return;
    refreshVisibleStaffWorklogsForActiveDate();
  }, 15000);
}

async function refreshCoworkerWorklogsForActiveDate() {
  if (!supabaseClient || !authState.user || canAccessAllWorklogs() || !isProfileApproved() || authState.visibleWorklogsLoading) return;
  authState.visibleWorklogsLoading = true;
  try {
    const dateKey = getActiveDateKey();
    await loadCoworkerWorklogsForDate(dateKey);
    if (dateKey !== getActiveDateKey()) return;
    normalizeState();
    localStorage.setItem(storageKey, JSON.stringify(state));
    renderEntries();
  } finally {
    authState.visibleWorklogsLoading = false;
  }
}

function mergeVisibleStaffWorklogStates(rows = [], dateKey = getActiveDateKey()) {
  state.employeeLogs ||= {};
  state.employeeLogs[dateKey] ||= {};
  const candidatesByEmployee = new Map();
  [...rows].forEach((row) => {
    const remoteState = row?.state || {};
    mergeSharedFitnessOperations(remoteState);
    const profile = remoteState.profile || {};
    const mappedId = getProfileMappedEmployeeId(profile);
    const employee = resolveRemoteWorklogEmployee(row);
    if (!employee || !isAssignedWorklogEmployee(employee) || isRepresentativeWorklogEmployee(employee)) return;
    const employeeId = getEmployeeWorklogId(employee);
    if (!employeeId) return;

    const logs = remoteState.employeeLogs?.[dateKey] || {};
    const candidateIds = [...new Set([
      employeeId,
      employee.id,
      employee.mappedEmployeeId,
      mappedId,
      employee.sourceProfileId,
      employee.profileEmployeeId,
      remoteState.ownerEmployeeId,
      remoteState.selectedEmployeeId,
      row?.user_id,
      row?.user_id ? `profile-${row.user_id}` : "",
      "profile-user",
    ].filter(Boolean))];
    const candidateLogs = candidateIds.map((id) => logs[id]).filter(Boolean);
    const employeeLog = hasSubmittableWorklogContent(remoteState.ownerWorklog)
      ? remoteState.ownerWorklog
      : candidateLogs.find(hasSubmittableWorklogContent);
    if (!employeeLog) return;
    const directOwner = remoteState.ownerEmployeeId === employeeId;
    const candidate = { row, employeeId, employeeLog, directOwner };
    candidatesByEmployee.set(employeeId, [...(candidatesByEmployee.get(employeeId) || []), candidate]);
  });
  candidatesByEmployee.forEach((candidates, employeeId) => {
    const selected = candidates.sort((a, b) => (
      Number(b.directOwner) - Number(a.directOwner)
      || String(b.row?.updated_at || "").localeCompare(String(a.row?.updated_at || ""))
    ))[0];
    state.employeeLogs[dateKey][employeeId] = {
      ...cloneWorklogLogForAudit(selected.employeeLog),
      employeeId,
    };
  });
}

function mergeSharedFitnessOperations(remoteState = {}) {
  state.dagymDaily ||= {};
  Object.entries(remoteState.dagymDaily || {}).forEach(([dateKey, remoteRecord]) => {
    const localRecord = state.dagymDaily[dateKey];
    const remoteUpdatedAt = String(remoteRecord?.updatedAt || "");
    const localUpdatedAt = String(localRecord?.updatedAt || "");
    if (!localRecord || remoteUpdatedAt >= localUpdatedAt) {
      state.dagymDaily[dateKey] = {
        ...createDagymDailyRecord(dateKey),
        ...(remoteRecord || {}),
        dateKey,
      };
    }
  });
  state.fitnessDailyGuidance ||= {};
  Object.entries(remoteState.fitnessDailyGuidance || {}).forEach(([dateKey, remoteItems]) => {
    if (!Array.isArray(remoteItems)) return;
    const mergedById = new Map((state.fitnessDailyGuidance[dateKey] || []).map((item) => [item.id, item]));
    remoteItems.forEach((remoteItem) => {
      if (!remoteItem?.id) return;
      const localItem = mergedById.get(remoteItem.id);
      if (!localItem || String(remoteItem.updatedAt || remoteItem.generatedAt || "") >= String(localItem.updatedAt || localItem.generatedAt || "")) {
        mergedById.set(remoteItem.id, remoteItem);
      }
    });
    state.fitnessDailyGuidance[dateKey] = [...mergedById.values()].slice(-40);
  });
}

function profileToRemoteRow(options = {}) {
  const includeApprovalFields = options.includeApprovalFields !== false;
  const includePendingProfileChangeFields = includeApprovalFields || options.includePendingProfileChangeFields === true;
  const profile = applyProfilePlacementOverride(state.profile || {});
  const row = {
    id: authState.user.id,
    org: profile.org,
    role: profile.role,
    name: profile.name,
    phone: formatPhoneNumber(profile.phone),
    email: profile.email || authState.user.email || "",
    primary_work: profile.primaryWork,
    secondary_work: profile.secondaryWork,
    workplace: profile.workplace,
    employment_type: profile.employmentType,
    labor_id: profile.laborId,
    address: profile.address,
    daily_wage: profile.dailyWage || null,
    hourly_wage: profile.hourlyWage || null,
    join_date: profile.joinDate || null,
    pay_day: profile.payDay || "",
    work_hours: profile.workHours,
    weekly_work_hours: profile.weeklyWorkHours || {},
    extra: profile.extra,
    strengths: profile.strengths,
    weaknesses: profile.weaknesses,
    development_goals: profile.developmentGoals,
    updated_at: new Date().toISOString(),
  };
  if (includeApprovalFields) {
    row.approval_status = profile.approvalStatus || "pending";
    row.approval_note = profile.approvalNote || "";
    row.approved_by = profile.approvedBy || null;
    row.approved_at = profile.approvedAt || null;
  }
  if (includePendingProfileChangeFields) {
    row.pending_profile_changes = profile.pendingProfileChanges || {};
    row.profile_change_requested_at = profile.profileChangeRequestedAt || null;
  }
  return row;
}

function remoteRowToProfile(row) {
  return applyProfilePlacementOverride({
    org: row.org,
    role: row.role,
    name: row.name,
    phone: formatPhoneNumber(row.phone),
    email: row.email,
    primaryWork: row.primary_work,
    secondaryWork: row.secondary_work,
    workplace: row.workplace,
    employmentType: row.employment_type || defaultProfile.employmentType,
    laborId: row.labor_id || "",
    address: row.address || "",
    dailyWage: row.daily_wage || "",
    hourlyWage: row.hourly_wage || "",
    joinDate: row.join_date || "",
    payDay: row.pay_day || "",
    workHours: row.work_hours,
    weeklyWorkHours: row.weekly_work_hours || {},
    extra: row.extra,
    strengths: row.strengths,
    weaknesses: row.weaknesses,
    developmentGoals: row.development_goals,
    approvalStatus: row.approval_status || "approved",
    approvalNote: row.approval_note || "",
    approvedBy: row.approved_by || "",
    approvedAt: row.approved_at || "",
    pendingProfileChanges: row.pending_profile_changes || {},
    profileChangeRequestedAt: row.profile_change_requested_at || "",
    assignedMission: row.assigned_mission || "",
    assignedMissionVisible: row.assigned_mission_visible !== false,
    assignedMissionUpdatedAt: row.assigned_mission_updated_at || "",
    assignedMissionUpdatedBy: row.assigned_mission_updated_by || "",
    accessPreset: row.access_preset || "employee",
    permissions: { ...(row.permissions || {}) },
  });
}

async function saveRemoteProfile(options = {}) {
  if (!supabaseClient || !authState.user) return;
  const includeApprovalFields = hasApprovalAuthority() || !isProfileApproved();
  const row = profileToRemoteRow({
    includeApprovalFields,
    includePendingProfileChangeFields: options.includePendingProfileChangeFields,
  });
  const { error, removedColumns } = await upsertProfileRowWithSchemaFallback(row);
  if (error) {
    renderAuthStatus(`프로필 원격 저장 대기: ${error.message}`);
    return;
  }
  if (removedColumns.length) {
    renderAuthStatus("프로필은 저장되었습니다. 일부 신규 노무항목은 최신 SQL 적용 후 원격 반영됩니다.");
  }
}

async function loadRemoteProfile() {
  if (!supabaseClient || !authState.user) return;
  const sameUser = isSameAuthProfile(authState.user);
  const localProfile = sameUser ? { ...(state.profile || {}) } : {};
  const { data, error } = await supabaseClient.from("profiles").select("*").eq("id", authState.user.id).maybeSingle();
  if (error) {
    renderAuthStatus(`프로필 불러오기 대기: ${error.message}`);
    return;
  }
  if (!data) return;
  const email = String(authState.user.email || data.email || "").trim().toLowerCase();
  const localOnly = sameUser
    ? {
      nickname: localProfile.nickname || "",
      manualSettings: localProfile.manualSettings,
      accessPreset: localProfile.accessPreset,
      permissions: { ...(localProfile.permissions || {}) },
    }
    : {};
  state.profile = {
    ...defaultProfile,
    ...localOnly,
    ...remoteRowToProfile(data),
    email,
    authUserId: authState.user.id || "",
  };
  if (controlTowerEmails.has(email)) {
    state.profile.accessPreset = "owner";
    state.profile.permissions = {};
  } else if (normalizePermissionPresetKey(state.profile.accessPreset) === "owner") {
    state.profile.accessPreset = getRecommendedPermissionPresetForProfile(state.profile);
    if (state.profile.accessPreset === "owner") state.profile.accessPreset = "employee";
    state.profile.permissions = {};
  }
  normalizeProfilePlacementForAuth();
  enforceAuthProfileBoundary();
  if (state.profile.workHours === "12:00-19:00") state.profile.workHours = defaultProfile.workHours;
  localStorage.setItem(storageKey, JSON.stringify(state));
  renderProfileForm();
}

async function initializeAuth() {
  if (!supabaseClient) {
    renderAuthStatus("원격 저장 모듈을 불러오지 못했습니다. 이 기기 저장으로 동작합니다.");
    return;
  }
  const { data } = await supabaseClient.auth.getSession();
  await applySession(data.session);
  supabaseClient.auth.onAuthStateChange((event, session) => {
    applySession(session);
    if (event === "PASSWORD_RECOVERY") {
      switchView("auth");
      setPasswordRecoveryMode(true, "새 비밀번호를 입력해 재설정을 완료해주세요.");
    }
  });
}

function switchAuthTab(tab) {
  document.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.authTab === tab);
  });
  document.querySelectorAll(".auth-panel").forEach((panel) => {
    panel.classList.toggle("is-active", panel.id === `auth-panel-${tab}`);
  });
}

function switchSettingsTab(tab = "employee") {
  document.querySelectorAll("[data-settings-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.settingsTab === tab);
  });
  document.querySelectorAll(".settings-panel").forEach((panel) => {
    panel.classList.toggle("is-active", panel.id === `settings-panel-${tab}`);
  });
}

function isMobilePhoneFocusLayout() {
  return getGlobalViewMode() === "ceo" || document.body.classList.contains("smartphone-device");
}

function isEditingDailyField() {
  return dailyEditingState.focused || dailyEditingState.composing;
}

function isEditableDayControl(target) {
  return Boolean(target?.closest?.(`
    .day-task-panel input,
    .day-task-panel textarea,
    .day-task-panel select,
    .day-schedule-panel input,
    .day-schedule-panel textarea,
    .day-schedule-panel select,
    .fitness-log-task-panel input,
    .fitness-log-task-panel textarea,
    .fitness-log-task-panel select,
    .fitness-log-schedule-panel input,
    .fitness-log-schedule-panel textarea,
    .fitness-log-schedule-panel select
  `));
}

function setupMobileDayFocus() {
  setupMobileFocusOpenButtons();
  setupMobileFocusCloseButtons();
  applyMobileDayFocusMode();
  applyFitnessMobileFocusMode();
}

function setupMobileFocusOpenButtons() {
  document.querySelectorAll("[data-mobile-focus-open]").forEach((button) => {
    button.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (button.closest("#view-fitness-log")) {
        setFitnessMobileFocusMode(button.dataset.mobileFocusOpen || "split");
        return;
      }
      setMobileDayFocusMode(button.dataset.mobileFocusOpen || "split");
    };
  });
}

function setupSplitEditGate(node, mode, setMode = setMobileDayFocusMode, getMode = () => mobileDayFocusMode) {
  if (!node) return;
  node.addEventListener("pointerdown", (event) => {
    if (!isMobilePhoneFocusLayout() || getMode() !== "split") return;
    const shouldFocus = shouldOpenMobileDayPanelFocus(event.target, node);
    if (!shouldFocus) return;
    event.preventDefault();
    event.stopPropagation();
    mobileFocusGateSuppressClick = true;
    window.setTimeout(() => {
      mobileFocusGateSuppressClick = false;
    }, 260);
    setMode(mode);
  }, true);
  node.addEventListener("click", (event) => {
    if (!mobileFocusGateSuppressClick) return;
    if (!isMobilePhoneFocusLayout()) return;
    if (!node.contains(event.target)) return;
    if (event.target.closest("[data-mobile-focus-close]")) return;
    event.preventDefault();
    event.stopPropagation();
  }, true);
}

function shouldOpenMobileDayPanelFocus(target, panel) {
  if (!target || !panel?.contains?.(target)) return false;
  if (target.closest("[data-mobile-focus-close]")) return false;
  if (target.closest("[data-mobile-focus-open]")) return true;
  if (target.closest(".ai-section-button, .schedule-unit-button")) return false;
  if (target.closest("input, textarea, select, button")) return true;
  return Boolean(target.closest(".task-row, .appointment-row, .task-board, .appointment-list, h3"));
}

function setupMobileFocusCloseButtons() {
  document.querySelectorAll("[data-mobile-focus-close]").forEach((button) => {
    button.onclick = (event) => {
      event.stopPropagation();
      if (button.closest("#view-fitness-log")) resetFitnessMobileFocusToSplit({ blur: true });
      else resetMobileDayFocusToSplit({ blur: true });
    };
  });
  document.addEventListener("compositionstart", (event) => {
    if (isEditableDayControl(event.target)) dailyEditingState.composing = true;
  });
  document.addEventListener("compositionend", () => {
    dailyEditingState.composing = false;
  });
  document.addEventListener("focusin", (event) => {
    if (isEditableDayControl(event.target)) dailyEditingState.focused = true;
  });
  document.addEventListener("focusout", (event) => {
    if (isEditableDayControl(event.target)) {
      window.setTimeout(() => {
        dailyEditingState.focused = Boolean(document.activeElement && isEditableDayControl(document.activeElement));
      }, 0);
    }
  });
  window.addEventListener("resize", () => {
    applyGlobalViewMode();
    applyMobileDayFocusMode();
    applyFitnessMobileFocusMode();
  });
}

function setMobileDayFocusMode(mode) {
  mobileDayFocusMode = mode || "split";
  if (mobileDayFocusMode === "tasks" || mobileDayFocusMode === "schedule") {
    todayPageMode = "daily";
    applyTodayPageMode();
  }
  applyMobileDayFocusMode();
}

function applyMobileDayFocusMode() {
  const main = document.getElementById("worklogMain");
  const mode = mobileDayFocusMode;
  if (!main) return;
  main.classList.toggle("is-focus-tasks", mode === "tasks");
  main.classList.toggle("is-focus-schedule", mode === "schedule");
  main.classList.toggle("is-mobile-focus-active", mode !== "split");
  main.classList.toggle("day-swipe", true);
}

function resetMobileDayFocusToSplit({ blur = true } = {}) {
  const main = document.getElementById("worklogMain");
  if (blur && document.activeElement && isEditableDayControl(document.activeElement)) {
    document.activeElement.blur();
  }
  mobileDayFocusMode = "split";
  if (main) {
    main.classList.add("is-focus-restoring");
    window.setTimeout(() => main.classList.remove("is-focus-restoring"), 230);
  }
  applyMobileDayFocusMode();
}

function setMobileWorklogFocus(panel) {
  setMobileDayFocusMode(panel || "split");
}

function setFitnessMobileFocusMode(mode) {
  fitnessMobileFocusMode = mode || "split";
  applyFitnessMobileFocusMode();
  if (fitnessMobileFocusMode !== "split") {
    window.setTimeout(() => {
      document.querySelector("#view-fitness-log.is-mobile-focus-active [data-mobile-focus-close]")?.focus();
    }, 0);
  }
}

function applyFitnessMobileFocusMode() {
  const view = document.getElementById("view-fitness-log");
  const mode = fitnessMobileFocusMode;
  if (!view) return;
  view.classList.toggle("is-focus-tasks", mode === "tasks");
  view.classList.toggle("is-focus-schedule", mode === "schedule");
  view.classList.toggle("is-mobile-focus-active", mode !== "split");
  document.body.classList.toggle("is-fitness-focus-open", mode !== "split" && activeView === "fitness-log");
  view.querySelectorAll(".fitness-log-task-panel, .fitness-log-schedule-panel").forEach((panel) => {
    const panelMode = panel.classList.contains("fitness-log-task-panel") ? "tasks" : "schedule";
    const isActivePanel = mode === panelMode;
    if (isActivePanel) {
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-modal", "true");
    } else {
      panel.removeAttribute("role");
      panel.removeAttribute("aria-modal");
    }
  });
}

function resetFitnessMobileFocusToSplit({ blur = true } = {}) {
  const view = document.getElementById("view-fitness-log");
  if (blur && document.activeElement && isEditableDayControl(document.activeElement)) {
    document.activeElement.blur();
  }
  fitnessMobileFocusMode = "split";
  if (view) {
    view.classList.add("is-focus-restoring");
    window.setTimeout(() => view.classList.remove("is-focus-restoring"), 230);
  }
  applyFitnessMobileFocusMode();
}

function renderEmployeeSelect() {
  const select = document.getElementById("employeeSelect");
  select.innerHTML = getEmployeeOptions().map((employee) => `
    <option value="${escapeAttr(employee.id)}" ${employee.id === state.selectedEmployeeId ? "selected" : ""}>
      ${escapeHtml(getEmployeeAdminLabel(employee))}
    </option>
  `).join("");
}

function renderEntries() {
  const log = getSelectedLog();
  normalizeEmployeeLogRows(log);
  renderWorklogToday(log);
  renderSharedWorklogPanels(log);
  renderFitnessWorklog(log);
  renderEmployeeDetailFields();
  renderClockPanel();
  renderEmployeeTitle();
  renderWorklogIdentityBadges();
  renderWeatherWidgets();
  renderDateNav();
  renderTodayContext();
  renderRepresentativeEmployeeAnalysis(activeView);
  renderReport();
  refreshCurrentTimeIndicators();
  applyMobileDayFocusMode();
  applyCurrentWorklogPermissionState();
}

function renderWorklogToday(log = getSelectedLog()) {
  renderWorklogSummary(log);
  renderWorklogTaskBoard(log);
  renderWorklogAppointments(log);
}

function renderFitnessWorklog(log = getSelectedLog()) {
  const page = getCurrentFitnessLogPage();
  const isCenter = page?.type === "center";
  if (page?.type === "employee") {
    if (page.id !== state.selectedEmployeeId && activeView === "fitness-log") state.selectedEmployeeId = page.id;
    log = getFitnessEmployeeLogForDate(page.employee || { id: page.id }, getActiveDateKey())
      || getEmployeeLogForDate(page.id, getActiveDateKey());
  }
  syncFitnessOpsFromSchedule(log);
  const title = document.getElementById("fitnessWorklogDate");
  if (title) title.textContent = formatCompactDate(getActiveDateKey());
  const input = document.getElementById("fitnessDateInput");
  if (input) input.value = getActiveDateKey();
  const todayButton = document.getElementById("fitnessTodayButton");
  renderWeatherDateButton(todayButton, getActiveWeatherEmployee("fitness-log"), getActiveDateKey());
  const unitButton = document.getElementById("fitnessScheduleUnitButton");
  if (unitButton) unitButton.textContent = log.scheduleUnit === "60" ? "1시간" : "30분";
  updateWorklogScheduleControlLabels(log, "fitness");
  renderFitnessLogPager();
  renderFitnessDesktopCoworkers(page);
  const hasGuidance = Boolean((state.fitnessDailyGuidance?.[getActiveDateKey()] || []).length);
  if (isCenter && canManageDagymOperations() && !hasGuidance && getPreviousDagymOperatingDate()) {
    generateTodayFitnessGuidance({ silent: true });
  }
  renderFitnessCenterDaily();
  renderFitnessCoaching();
  renderWorklogIdentityBadges();
  renderWeatherWidgets();
  renderWorklogEditLockBanner("fitness");
  document.getElementById("fitnessCenterDailyPanel").hidden = !isCenter;
  renderFitnessPersonalMonthSummary(page, isCenter);
  renderFitnessDailyGuidance(page, isCenter);
  document.querySelector(".fitness-log-task-panel")?.toggleAttribute("hidden", isCenter);
  document.querySelector(".fitness-log-schedule-panel")?.toggleAttribute("hidden", isCenter);
  document.querySelector(".fitness-ops-section")?.toggleAttribute("hidden", isCenter);
  renderRepresentativeEmployeeAnalysis("fitness-log");
  applyFitnessLogPermissionState();
  if (isCenter) return;
  renderFitnessTaskBoard(log);
  renderFitnessAppointments(log);
  renderFitnessOperations(log);
  applyFitnessLogPermissionState();
}

function renderFitnessLogPager() {
  const pages = getFitnessLogPages();
  const pageIndex = clampFitnessLogPage();
  const page = pages[pageIndex];
  const title = document.getElementById("fitnessLogPageTitle");
  const hint = document.getElementById("fitnessLogPageHint");
  const prev = document.getElementById("fitnessLogPrevPageButton");
  const next = document.getElementById("fitnessLogNextPageButton");
  if (title) title.textContent = getFitnessPagerTitle();
  if (hint) hint.textContent = "";
  if (prev) {
    prev.textContent = getFitnessPagerSideLabel("prev", pageIndex, pages);
    prev.disabled = pageIndex === 0;
  }
  if (next) {
    next.textContent = getFitnessPagerSideLabel("next", pageIndex, pages);
    next.disabled = pageIndex === pages.length - 1;
  }
}

function renderFitnessDesktopCoworkers(currentPage = getCurrentFitnessLogPage()) {
  const board = document.getElementById("fitnessDesktopCoworkerBoard");
  if (!board) return;
  const pages = getFitnessLogPages();
  const dateKey = getActiveDateKey();
  const rows = currentPage?.type === "employee"
    ? pages
      .map((page, pageIndex) => ({ page, pageIndex }))
      .filter(({ page }) => page.type === "employee" && page.id !== currentPage.id)
      .slice(0, 8)
      .map(({ page, pageIndex }) => {
        const employee = page.employee;
        const log = getFitnessEmployeeLogForDate(employee, dateKey) || getEmployeeLogForDate(page.id, dateKey);
        const tasks = getWorklogTaskRefs(log).map((ref) => ref.task).filter(isActiveTask);
        const schedule = (log.schedule || []).filter((entry) => getScheduleEntryText(entry));
        const completed = tasks.filter((task) => task.done || task.status === "완료").length;
        const worked = Boolean(log.clockIn || log.clockOut || tasks.length || schedule.length);
        return { employee, pageIndex, tasks: tasks.slice(0, 3), schedule: schedule.slice(0, 2), completed, worked };
      })
    : [];
  board.hidden = !rows.length;
  if (!rows.length) {
    board.innerHTML = "";
    return;
  }
  board.innerHTML = `
    <header>
      <div>
        <span>COWORKER WORKLOG</span>
        <strong>동료 업무일지</strong>
      </div>
      <em>${rows.length}명</em>
    </header>
    <div class="fitness-desktop-coworker-list">
      ${rows.map((row) => `
        <article class="fitness-desktop-coworker-card ${row.worked ? "has-worklog" : "is-empty"}">
          <header>
            <div>
              <b>${escapeHtml(getEmployeeAdminLabel(row.employee))}</b>
              <small>${escapeHtml(row.worked ? `${row.completed}/${row.tasks.length} 완료` : "기록 대기")}</small>
            </div>
            <button type="button" data-fitness-desktop-open="${row.pageIndex}">열기</button>
          </header>
          ${row.tasks.length
            ? `<ul>${row.tasks.map((task) => `<li class="${task.done || task.status === "완료" ? "is-done" : ""}">${escapeHtml(task.text || "업무")}</li>`).join("")}</ul>`
            : `<p>등록된 우선업무가 없습니다.</p>`}
          ${row.schedule.length
            ? `<div class="fitness-desktop-coworker-schedule">${row.schedule.map((entry) => `<span><b>${escapeHtml(entry.time || "--:--")}</b>${escapeHtml(getScheduleEntryText(entry))}</span>`).join("")}</div>`
            : ""}
        </article>
      `).join("")}
    </div>
  `;
  board.querySelectorAll("[data-fitness-desktop-open]").forEach((button) => {
    button.addEventListener("click", () => setFitnessLogPage(Number(button.dataset.fitnessDesktopOpen)));
  });
}

function getFitnessPagerSideLabel(direction, pageIndex, pages = getFitnessLogPages()) {
  const page = pages[pageIndex];
  if (direction === "prev") {
    if (page?.type === "center") return "센터운영";
    if (isOwnFitnessEmployeeId(page?.id)) return "센터운영";
    return getFitnessOwnIdentity().pageTitle;
  }
  if (page?.type === "center") return "업무일지";
  if (isOwnFitnessEmployeeId(page?.id)) return "동료업무";
  const nextPage = pages[pageIndex + 1];
  return nextPage?.employee ? getEmployeeAdminLabel(nextPage.employee) : "동료업무";
}

function applyFitnessLogPermissionState() {
  const view = document.getElementById("view-fitness-log");
  if (!view) return;
  const page = getCurrentFitnessLogPage();
  const readOnly = !canEditCurrentWorklog("fitness-log");
  const isCenter = page?.type === "center";
  const isCoworker = page?.type === "employee" && !isOwnFitnessEmployeeId(page.id);
  view.classList.toggle("is-readonly", readOnly);
  view.classList.toggle("is-center-page", isCenter);
  view.classList.toggle("is-own-page", isCurrentFitnessLogEditable());
  view.classList.toggle("is-coworker-page", isCoworker);
  view.dataset.fitnessPermission = readOnly ? "readonly" : "editable";
  view.dataset.fitnessPageType = isCenter ? "center" : isCoworker ? "coworker" : "own";
  const hint = document.getElementById("fitnessLogPageHint");
  if (hint) {
    hint.textContent = "";
  }
  view.querySelectorAll(`
    .fitness-log-task-panel input,
    .fitness-log-task-panel select,
    .fitness-log-task-panel textarea,
    .fitness-log-task-panel button,
    .fitness-log-schedule-panel input,
    .fitness-log-schedule-panel select,
    .fitness-log-schedule-panel textarea,
    .fitness-log-schedule-panel button,
    .fitness-ops-section input,
    .fitness-ops-section textarea
  `).forEach((control) => {
    if (control.matches("[data-mobile-focus-open], [data-mobile-focus-close]")) {
      control.disabled = false;
      control.setAttribute("aria-disabled", "false");
      return;
    }
    control.disabled = readOnly;
  });
}

function applyCurrentWorklogPermissionState(viewName = activeView) {
  updateGlobalAttendanceVisibility(viewName);
  updateWorklogOverviewExitButton(viewName);
  const generalView = document.getElementById("view-today");
  const isGeneralWorklog = ["bangju-log", "beyond-log", "today"].includes(viewName);
  if (generalView) {
    const readOnly = isGeneralWorklog && !canEditCurrentWorklog(viewName);
    const currentEmployeeId = getCurrentWorklogEmployeeId(viewName);
    const ownEmployeeId = getOwnEditableEmployeeIdForView(viewName);
    const isOwnPage = Boolean(isGeneralWorklog && !isRepresentativeProfile() && currentEmployeeId && currentEmployeeId === ownEmployeeId);
    generalView.classList.toggle("is-readonly", readOnly);
    generalView.classList.toggle("is-own-page", isOwnPage);
    generalView.dataset.worklogPermission = readOnly ? "readonly" : "editable";
    generalView.dataset.worklogPageType = isOwnPage ? "own" : "coworker";
    generalView.querySelectorAll(`
      #worklogTaskBoard .task-cycle,
      #worklogTaskBoard .delegate-input,
      #worklogTaskBoard .postpone-date-button,
      #worklogTaskBoard .priority-select,
      #worklogTaskBoard .task-text-input,
      #worklogTaskBoard .task-delete,
      #worklogTaskBoard .worklog-add-row,
      #worklogAppointmentList .schedule-text-input,
      #worklogAppointmentList .schedule-item-delete,
      #worklogAppointmentList .appointment-merge-button,
      #scheduleUnitButton,
      #worklogHoursButton,
      #worklogAddTimeButton,
      #employeeReport,
      #employeeMemo
    `).forEach((control) => {
      control.disabled = readOnly;
      control.setAttribute("aria-disabled", String(readOnly));
    });
  }
  if (viewName === "fitness-log") applyFitnessLogPermissionState();
}

function updateWorklogOverviewExitButton(viewName = activeView) {
  const button = document.getElementById("returnToWorklogOverviewButton");
  const fitnessButton = document.getElementById("returnToFitnessWorklogOverviewButton");
  const isEmployeeWorklog = ["bangju-log", "beyond-log", "today"].includes(viewName);
  if (button) button.hidden = !(isEmployeeWorklog && canAccessWorklogOverview());
  if (fitnessButton) {
    const isFitnessEmployeeWorklog = viewName === "fitness-log" && getCurrentFitnessLogPage()?.type === "employee";
    fitnessButton.hidden = !(isFitnessEmployeeWorklog && canAccessWorklogOverview());
  }
}

function renderFitnessCenterDaily() {
  const panel = document.getElementById("fitnessCenterDailyPanel");
  if (!panel) return;
  syncFitnessCenterMonthToActiveDate();
  renderDagymOpsFields();
  renderFitnessCenterMonthNav();
  const centerMonth = getFitnessCenterMonth();
  const employeesForCenter = getFitnessCenterEmployees();
  const rows = employeesForCenter.map((employee, index) => {
    const aggregate = buildFitnessCenterEmployeeMonthRow(employee, centerMonth);
    return { ...aggregate, index };
  });
  const total = rows.reduce((summary, row) => {
    summary.ptPaid += row.paidPtTotal;
    summary.ptFree += row.freePtTotal;
    summary.ptOther += numberValue(row.ops.ptOther);
    summary.pt += row.ptTotal;
    summary.new += numberValue(row.ops.customerNew);
    summary.renewal += numberValue(row.ops.customerRenewal);
    summary.dayPass += numberValue(row.ops.dayPass);
    summary.consultation += numberValue(row.ops.consultation);
    summary.inbound += numberValue(row.ops.inbound);
    summary.outbound += numberValue(row.ops.outbound);
    summary.outsideSales += numberValue(row.ops.outsideSales);
    summary.workMinutes += row.workMinutes;
    summary.recordedDays += row.recordedDays;
    return summary;
  }, { pt: 0, ptPaid: 0, ptFree: 0, ptOther: 0, new: 0, renewal: 0, dayPass: 0, consultation: 0, inbound: 0, outbound: 0, outsideSales: 0, workMinutes: 0, recordedDays: 0 });

  const summaryGrid = document.getElementById("fitnessCenterSummaryGrid");
  if (summaryGrid) {
    summaryGrid.innerHTML = [
      ["기준월", formatCenterMonthLabel(centerMonth)],
      ["기록일", `${total.recordedDays}일`],
      ["총 근무", formatWorkDuration(total.workMinutes)],
      ["유료 PT", `${total.ptPaid}건`],
      ["무료 PT", `${total.ptFree}건`],
      ["기타 PT", `${total.ptOther}건`],
      ["신규", `${total.new}건`],
      ["재등록", `${total.renewal}건`],
      ["일일권", `${total.dayPass}건`],
      ["상담", `${total.consultation}건`],
      ["아웃바운드", `${total.outbound}건`],
      ["인바운드", `${total.inbound}건`],
      ["외부영업", `${total.outsideSales}건`],
    ].map(([label, value]) => `<article><span>${label}</span><strong>${value}</strong></article>`).join("");
  }

  const body = document.getElementById("fitnessCenterDailyBody");
  if (body) {
    body.innerHTML = rows.map((row) => `
      <tr>
        <td>${row.index + 1}</td>
        <td>${escapeHtml(row.employee.role)}</td>
        <td>${escapeHtml(getEmployeeAdminLabel(row.employee))}</td>
        <td>${escapeHtml(row.firstClockIn || "-")}</td>
        <td>${escapeHtml(row.lastClockOut || "-")}</td>
        <td>${row.workMinutes ? formatWorkDuration(row.workMinutes) : "-"}</td>
        <td>${escapeHtml(row.breakSummary || "-")}</td>
        <td>${row.paidPtTotal || ""}</td>
        <td>${row.freePtTotal || ""}</td>
        <td>${escapeHtml(row.ops.ptOther || "")}</td>
        <td>${escapeHtml(row.ops.customerNew || "")}</td>
        <td>${escapeHtml(row.ops.customerRenewal || "")}</td>
        <td>${escapeHtml(row.ops.dayPass || "")}</td>
        <td>${escapeHtml(row.ops.consultation || "")}</td>
        <td>${escapeHtml(row.ops.inbound || "")}</td>
        <td>${escapeHtml(row.ops.outbound || "")}</td>
        <td>${escapeHtml(row.ops.outsideSales || "")}</td>
        <td>${escapeHtml(row.ops.specialReport || row.ops.shiftNote || "")}</td>
      </tr>
    `).join("");
  }

  const foot = document.getElementById("fitnessCenterDailyFoot");
  if (foot) {
    foot.innerHTML = `
      <tr>
        <td colspan="7">합계</td>
        <td>${total.ptPaid}</td>
        <td>${total.ptFree}</td>
        <td>${total.ptOther}</td>
        <td>${total.new}</td>
        <td>${total.renewal}</td>
        <td>${total.dayPass}</td>
        <td>${total.consultation}</td>
        <td>${total.inbound}</td>
        <td>${total.outbound}</td>
        <td>${total.outsideSales}</td>
        <td></td>
      </tr>
    `;
  }

  const record = document.getElementById("fitnessCenterTodayRecord");
  if (record) {
    const notes = rows.flatMap((row) => row.notes);
    record.textContent = notes.length ? notes.slice(0, 12).join(" / ") : "선택 월에 등록된 특이사항이 없습니다.";
  }
  renderFitnessCenterConfirmPanel();
  renderFitnessCenterCoaching(total, rows);
  renderFitnessDailyGuidance(getCurrentFitnessLogPage(), true);
}

function renderFitnessCenterConfirmPanel() {
  const panel = document.getElementById("fitnessCenterConfirmPanel");
  if (!panel) return;
  const dateKey = getActiveDateKey();
  const record = getFitnessCenterReportRecord(dateKey);
  const confirmed = Boolean(record?.confirmedAt);
  const canConfirm = canConfirmFitnessCenterReport(dateKey);
  panel.classList.toggle("is-confirmed", confirmed);
  panel.innerHTML = `
    <div>
      <b>${confirmed ? "센터 업무보고서 확정" : "센터 업무보고서 미확정"}</b>
      <span>${escapeHtml(confirmed ? getFitnessCenterReportStatusText(dateKey) : "센터장 또는 해당일 근무자가 최종 확인합니다.")}</span>
    </div>
    <button type="button" data-fitness-center-report-confirm ${canConfirm ? "" : "disabled"}>
      ${confirmed ? "확정 취소" : "확정"}
    </button>
  `;
}

function getFitnessCenterMonth() {
  if (!/^\d{4}-\d{2}$/.test(String(state.fitnessCenterMonth || ""))) {
    state.fitnessCenterMonth = getActiveDateKey().slice(0, 7);
  }
  return state.fitnessCenterMonth;
}

function syncFitnessCenterMonthToActiveDate() {
  const activeDateKey = getActiveDateKey();
  const activeMonth = activeDateKey.slice(0, 7);
  if (state.fitnessCenterMonthSourceDateKey !== activeDateKey) {
    state.fitnessCenterMonth = activeMonth;
    state.fitnessCenterMonthSourceDateKey = activeDateKey;
  }
}

function setFitnessCenterMonth(month) {
  if (!/^\d{4}-\d{2}$/.test(String(month || ""))) return;
  state.fitnessCenterMonth = month;
  state.fitnessCenterMonthSourceDateKey = getActiveDateKey();
  saveState();
  renderFitnessCenterDaily();
}

function shiftFitnessCenterMonth(delta) {
  const [year, month] = getFitnessCenterMonth().split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  setFitnessCenterMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
}

function formatCenterMonthLabel(month = getFitnessCenterMonth()) {
  const [year, monthNumber] = String(month).split("-");
  return `${year}.${monthNumber}`;
}

function renderFitnessCenterMonthNav() {
  const month = getFitnessCenterMonth();
  const title = document.getElementById("fitnessCenterMonthTitle");
  const input = document.getElementById("fitnessCenterMonthInput");
  if (title) title.textContent = `${formatCenterMonthLabel(month)} 센터 운영현황`;
  if (input) input.value = month;
}

function buildFitnessCenterEmployeeMonthRow(employee, monthPrefix) {
  const ops = createFitnessOps();
  let paidPtTotal = 0;
  let freePtTotal = 0;
  let ptTotal = 0;
  let workMinutes = 0;
  let recordedDays = 0;
  let firstClockIn = "";
  let lastClockOut = "";
  let breakCount = 0;
  let lateCount = 0;
  let earlyCount = 0;
  let absenceCount = 0;
  const notes = [];
  getMonthDateKeys(monthPrefix).forEach((dateKey) => {
    const log = getFitnessEmployeeLogForDate(employee, dateKey);
    if (!log) return;
    syncFitnessOpsFromSchedule(log);
    if (dateKey === getActiveDateKey()) syncAttendanceRecordFromLog(employee, log);
    const dayOps = { ...createFitnessOps(), ...(log.fitnessOps || {}) };
    Object.keys(ops).forEach((key) => {
      if (["shiftNote", "specialReport"].includes(key)) return;
      ops[key] = String(numberValue(ops[key]) + numberValue(dayOps[key]) || "");
    });
    const paid = numberValue(dayOps.ptRegular);
    const free = numberValue(dayOps.ptFree);
    paidPtTotal += paid;
    freePtTotal += free;
    ptTotal += paid + free + numberValue(dayOps.ptOther);
    const minutes = getWorkMinutes(log.clockIn, log.clockOut);
    if (minutes || log.clockIn || log.clockOut || log.attendanceStatus || paid || free || numberValue(dayOps.ptOther)) recordedDays += 1;
    workMinutes += minutes;
    if (log.clockIn && (!firstClockIn || log.clockIn < firstClockIn)) firstClockIn = log.clockIn;
    if (log.clockOut && (!lastClockOut || log.clockOut > lastClockOut)) lastClockOut = log.clockOut;
    const status = getAttendanceStatusForLog(employee, log);
    if (status.includes("지각")) lateCount += 1;
    if (status.includes("조퇴")) earlyCount += 1;
    if (status.includes("결근")) absenceCount += 1;
    breakCount += (log.attendanceBreaks || []).filter((item) => item.start || item.end).length;
    [dayOps.shiftNote, dayOps.specialReport].filter(Boolean).forEach((note) => {
      notes.push(`${dateKey.slice(5)} ${getEmployeeAdminLabel(employee)}: ${note}`);
    });
  });
  const statusParts = [];
  if (lateCount) statusParts.push(`지각 ${lateCount}`);
  if (earlyCount) statusParts.push(`조퇴 ${earlyCount}`);
  if (absenceCount) statusParts.push(`결근 ${absenceCount}`);
  const attendanceStatus = statusParts.join(" · ") || (recordedDays ? "기록" : "미기록");
  return {
    employee,
    ops,
    paidPtTotal,
    freePtTotal,
    ptTotal,
    workMinutes,
    recordedDays,
    firstClockIn,
    lastClockOut,
    attendanceStatus,
    breakSummary: breakCount ? `${breakCount}건` : "-",
    notes,
  };
}

function renderFitnessPersonalMonthSummary(page = getCurrentFitnessLogPage(), isCenter = page?.type === "center") {
  const panel = document.getElementById("fitnessPersonalMonthSummary");
  if (!panel) return;
  panel.hidden = true;
}

function getFitnessEmployeeLogForDate(employee = {}, dateKey = getActiveDateKey()) {
  const logsByEmployee = state.employeeLogs?.[dateKey] || {};
  const ids = getFitnessEmployeeLogCandidateIds(employee);
  const candidateLogs = ids.map((id) => logsByEmployee[id]).filter(Boolean);
  const filledCandidate = candidateLogs.find(hasFitnessEmployeeLogContent);
  if (filledCandidate) return alignFitnessEmployeeLogToRoster(filledCandidate, employee, dateKey);
  if (candidateLogs[0]) return alignFitnessEmployeeLogToRoster(candidateLogs[0], employee, dateKey);
  const email = normalizeEmailValue(employee.email || "");
  if (email) {
    const emailMatchedLogs = Object.entries(logsByEmployee).filter(([employeeId]) => {
      const staff = getStaffDirectoryEmployees().find((item) => item.id === employeeId || item.mappedEmployeeId === employeeId);
      return normalizeEmailValue(staff?.email || "") === email;
    }).map(([, log]) => log);
    const filledEmailLog = emailMatchedLogs.find(hasFitnessEmployeeLogContent);
    if (filledEmailLog) return alignFitnessEmployeeLogToRoster(filledEmailLog, employee, dateKey);
    if (emailMatchedLogs[0]) return alignFitnessEmployeeLogToRoster(emailMatchedLogs[0], employee, dateKey);
  }
  return null;
}

function alignFitnessEmployeeLogToRoster(log, employee = {}, dateKey = getActiveDateKey()) {
  if (!log) return null;
  const employeeId = getEmployeeWorklogId(employee);
  if (employeeId) log.employeeId = employeeId;
  if (!log.scheduleUnitExplicit) log.scheduleUnit = "60";
  normalizeEmployeeLogRows(log, dateKey);
  return log;
}

function hasFitnessEmployeeLogContent(log = {}) {
  if (!log) return false;
  const ops = { ...createFitnessOps(), ...(log.fitnessOps || {}) };
  return Boolean(
    String(log.clockIn || log.clockOut || log.attendanceStatus || "").trim()
    || (Array.isArray(log.attendanceBreaks) && log.attendanceBreaks.some((record) => record?.start || record?.end))
    || String(log.report || log.memo || log.record || "").trim()
    || getWorklogTaskRefs(log).some(({ task }) => isActiveTask(task))
    || (Array.isArray(log.schedule) && log.schedule.some((entry) => String(getScheduleEntryText(entry) || "").trim()))
    || Object.values(ops).some((value) => String(value || "").trim())
  );
}

function getFitnessEmployeeLogCandidateIds(employee = {}) {
  const ids = [employee.id, employee.mappedEmployeeId, getFitnessRosterSlotId(employee)].filter(Boolean);
  const source = `${employee.id || ""} ${employee.mappedEmployeeId || ""} ${employee.email || ""} ${employee.name || ""} ${employee.nickname || ""} ${employee.role || ""} ${employee.primaryWork || ""}`.toLowerCase();
  if (/fitness-info-shinsemin|신세민|tpals2990/.test(source)) ids.push("fitness-info-shinsemin");
  else if (/fitness-info-kimyoungchae|김영채|yckim1558/.test(source)) ids.push("fitness-info-kimyoungchae");
  else if (/fitness-weekday-info-idabin|이다빈/.test(source)) ids.push("fitness-weekday-info-idabin", "fitness-weekday-info");
  else if (/fitness-saturday-info|토요|토요일/.test(source)) ids.push("fitness-saturday-info");
  else if (/fitness-sunday-info|일요|일요일/.test(source)) ids.push("fitness-sunday-info");
  else if (/fitness-weekday-info|주중/.test(source)) ids.push("fitness-weekday-info");
  else if (isFitnessManagerRosterIdentity(employee) || /박주홍|센터장|운영총괄|manager/.test(source)) ids.push("beyond-fitness-manager");
  else if (/홍현규|트레이너|trainer|pt|피티/.test(source)) ids.push("fitness-trainer-1");
  return [...new Set(ids)];
}

function renderDagymOpsFields() {
  const record = getDagymOpsForDate(getActiveDateKey());
  state.dagymOps = record;
  document.querySelectorAll("[data-dagym-field]").forEach((field) => {
    field.value = record[field.dataset.dagymField] || "";
    field.disabled = !canManageDagymOperations();
  });
  const importText = document.getElementById("dagymImportText");
  if (importText) {
    importText.value = record.importText || "";
    importText.disabled = !canManageDagymOperations();
  }
  const status = document.getElementById("dagymDailyStatus");
  if (status) {
    status.textContent = record.status === "closed"
      ? `${formatShortDate(record.dateKey)} 마감 확정`
      : `${formatShortDate(record.dateKey)} 입력 중`;
  }
  const closeButton = document.getElementById("dagymCloseButton");
  if (closeButton) {
    closeButton.disabled = !canManageDagymOperations() || !hasDagymDailyActivity(record);
    closeButton.textContent = record.status === "closed" ? "마감 해제" : "마감 확정";
  }
  const importButton = document.getElementById("dagymImportButton");
  const clearButton = document.getElementById("dagymClearButton");
  if (importButton) importButton.disabled = !canManageDagymOperations();
  if (clearButton) clearButton.disabled = !canManageDagymOperations();
}

function canManageDagymOperations() {
  const profileEmployee = getProfileEmployee();
  return Boolean(
    isRepresentativeProfile()
    || hasProfilePermission("controlTower")
    || hasProfilePermission("worklogAll")
    || isFitnessManagerRosterIdentity(profileEmployee)
  );
}

function getPreviousDagymOperatingDate(dateKey = getActiveDateKey()) {
  return Object.keys(state.dagymDaily || {})
    .filter((key) => key < dateKey && state.dagymDaily[key]?.status === "closed" && hasDagymDailyActivity(state.dagymDaily[key]))
    .sort()
    .pop() || "";
}

function getFitnessDayOpsTotal(dateKey) {
  return getFitnessCenterEmployees().reduce((total, employee) => {
    const log = getFitnessEmployeeLogForDate(employee, dateKey);
    if (!log) return total;
    syncFitnessOpsFromSchedule(log);
    const ops = { ...createFitnessOps(), ...(log.fitnessOps || {}) };
    total.pt += numberValue(ops.ptRegular) + numberValue(ops.ptFree) + numberValue(ops.ptOther);
    total.consultation += numberValue(ops.consultation);
    total.renewal += numberValue(ops.customerRenewal);
    total.outbound += numberValue(ops.outbound) + numberValue(ops.outsideSales);
    return total;
  }, { pt: 0, consultation: 0, renewal: 0, outbound: 0 });
}

function getFitnessGuidanceRoster(dateKey = getActiveDateKey()) {
  const scheduled = getFitnessCenterEmployees().filter((employee) => {
    const log = getFitnessEmployeeLogForDate(employee, dateKey) || {};
    return !isOffWorkHours(getOverviewScheduledWorkHours(employee, dateKey, log));
  });
  const pick = (pattern) => scheduled.find((employee) => pattern.test(`${employee.role || ""} ${employee.name || ""} ${employee.nickname || ""}`));
  const manager = pick(/센터장|박주홍|운영총괄/) || scheduled[0];
  const trainer = pick(/트레이너|홍현규/) || manager;
  const info = pick(/인포|데스크|신세민|이다빈|김영채/) || manager;
  return { scheduled, manager, trainer, info };
}

function createFitnessGuidanceRule({ dateKey, sourceDateKey, type, target, title, detail, dueTime, sourceValue }) {
  const targetEmployeeId = getEmployeeWorklogId(target || {}) || "beyond-fitness-manager";
  const id = `dagym-guidance:${dateKey}:${sourceDateKey}:${type}:${targetEmployeeId}`;
  const now = new Date().toISOString();
  return {
    id,
    dateKey,
    sourceDateKey,
    source: "dagym-previous-operating-day",
    type,
    title,
    detail,
    dueTime,
    sourceValue: Number(sourceValue || 0),
    targetEmployeeId,
    targetName: getEmployeeAdminLabel(target || {}) || "센터장",
    status: "generated",
    generatedAt: now,
    updatedAt: now,
    acceptedAt: "",
    completedAt: "",
  };
}

function buildTodayFitnessGuidance(dateKey = getActiveDateKey()) {
  const sourceDateKey = getPreviousDagymOperatingDate(dateKey);
  if (!sourceDateKey) return { sourceDateKey: "", items: [] };
  const dagym = getDagymOpsForDate(sourceDateKey, { create: false });
  const staff = getFitnessDayOpsTotal(sourceDateKey);
  const roster = getFitnessGuidanceRoster(dateKey);
  const items = [];
  const add = (rule) => items.push(createFitnessGuidanceRule({ dateKey, sourceDateKey, ...rule }));
  const noShows = numberValue(dagym.noShows);
  const expiringGap = Math.max(0, numberValue(dagym.expiring) - numberValue(dagym.renewals));
  const ptGap = Math.max(0, numberValue(dagym.ptBookings) - staff.pt);
  const lockerExpiring = numberValue(dagym.lockerExpiring);
  const expectedSalesActions = numberValue(dagym.visits) ? Math.max(2, Math.round(numberValue(dagym.visits) * 0.03)) : 0;
  const salesActionGap = Math.max(0, expectedSalesActions - staff.consultation - staff.renewal - staff.outbound);
  if (noShows) add({ type: "no-show", target: roster.info, title: `노쇼·취소 ${noShows}건 재예약 확인`, detail: "미회복 회원에게 연락하고 재예약·보류·연락불가 결과를 남깁니다.", dueTime: "10:30", sourceValue: noShows });
  if (expiringGap) add({ type: "expiry", target: roster.info, title: `만료 예정 미처리 ${expiringGap}건 상담`, detail: "만료 예정 대상의 안내 여부를 확인하고 재등록 상담 결과를 기록합니다.", dueTime: "11:00", sourceValue: expiringGap });
  if (ptGap) add({ type: "pt-gap", target: roster.trainer, title: `PT 예약·완료 차이 ${ptGap}건 확인`, detail: "수업 완료, 노쇼, 일정 변경 중 하나로 대조 결과를 확정합니다.", dueTime: "12:00", sourceValue: ptGap });
  if (lockerExpiring) add({ type: "locker", target: roster.info, title: `락커 만료 ${lockerExpiring}건 안내`, detail: "만료 안내와 연장·정리 여부를 확인합니다.", dueTime: "15:00", sourceValue: lockerExpiring });
  if (salesActionGap) add({ type: "sales-action", target: roster.manager, title: `출석 대비 상담행동 ${salesActionGap}건 보강`, detail: "오늘 근무자에게 재등록·체험·휴면회원 후속조치를 배정합니다.", dueTime: "14:00", sourceValue: salesActionGap });
  if (numberValue(dagym.sales) && !staff.renewal && !numberValue(dagym.newMembers)) {
    add({ type: "sales-review", target: roster.manager, title: "전일 매출 발생 원인 확인", detail: "결제와 연결된 상담·PT·재등록 행동을 센터 보고에 남깁니다.", dueTime: "17:00", sourceValue: dagym.sales });
  }
  return { sourceDateKey, items };
}

function generateTodayFitnessGuidance({ silent = false } = {}) {
  if (!canManageDagymOperations()) {
    if (!silent) showAppToast("센터장 또는 대표만 오늘 지침을 생성할 수 있습니다");
    return false;
  }
  const dateKey = getActiveDateKey();
  const { sourceDateKey, items } = buildTodayFitnessGuidance(dateKey);
  if (!sourceDateKey) {
    if (!silent) showAppToast("직전 영업일의 다짐 마감자료가 없습니다");
    return false;
  }
  const existingById = new Map((state.fitnessDailyGuidance?.[dateKey] || []).map((item) => [item.id, item]));
  state.fitnessDailyGuidance ||= {};
  state.fitnessDailyGuidance[dateKey] = items.map((item) => {
    const existing = existingById.get(item.id);
    return existing ? { ...item, ...existing, detail: item.detail, title: item.title, sourceValue: item.sourceValue } : item;
  });
  saveState();
  renderFitnessDailyGuidance();
  if (!silent) showAppToast(items.length ? `전일 자료로 오늘 지침 ${items.length}건을 만들었습니다` : "전일 미처리 신호가 없습니다");
  return true;
}

function getFitnessGuidanceStatusLabel(status = "generated") {
  return { generated: "배정", accepted: "수락", completed: "완료", delegated: "위임", postponed: "연기", cancelled: "취소" }[status] || "배정";
}

function renderFitnessDailyGuidance(page = getCurrentFitnessLogPage(), isCenter = page?.type === "center") {
  const panel = document.getElementById("fitnessDailyGuidancePanel");
  const list = document.getElementById("fitnessDailyGuidanceList");
  if (!panel || !list) return;
  const dateKey = getActiveDateKey();
  const allItems = state.fitnessDailyGuidance?.[dateKey] || [];
  const pageEmployeeId = page?.type === "employee" ? page.id : "";
  const items = isCenter ? allItems : allItems.filter((item) => item.targetEmployeeId === pageEmployeeId);
  panel.hidden = !isCenter && !items.length;
  panel.classList.toggle("is-center-guidance", Boolean(isCenter));
  const source = items[0]?.sourceDateKey || getPreviousDagymOperatingDate(dateKey);
  const title = document.getElementById("fitnessDailyGuidanceTitle");
  const subtitle = document.getElementById("fitnessDailyGuidanceSubtitle");
  if (title) title.textContent = isCenter ? "오늘 실행지침" : "나에게 배정된 오늘 지침";
  if (subtitle) subtitle.textContent = source ? `${formatShortDate(source)} 다짐 마감자료 기준` : "직전 영업일 마감자료 대기";
  const generateButton = document.getElementById("fitnessGuidanceGenerateButton");
  if (generateButton) {
    generateButton.hidden = !isCenter;
    generateButton.disabled = !canManageDagymOperations();
  }
  list.innerHTML = items.length ? items.map((item) => {
    const ownId = getProfileMappedEmployeeId() || "profile-user";
    const canAccept = !isRepresentativeProfile() && page?.type === "employee" && page.id === ownId && item.targetEmployeeId === ownId && item.status === "generated";
    return `
      <article class="fitness-guidance-item status-${escapeAttr(item.status)}">
        <div class="fitness-guidance-meta">
          <span>${escapeHtml(item.dueTime || "오늘")}</span>
          <b>${escapeHtml(item.targetName || "담당자")}</b>
          <em>${escapeHtml(getFitnessGuidanceStatusLabel(item.status))}</em>
        </div>
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.detail)}</p>
        ${canAccept ? `<button type="button" data-accept-fitness-guidance="${escapeAttr(item.id)}">우선업무로 수락</button>` : ""}
      </article>
    `;
  }).join("") : `<p class="fitness-guidance-empty">${source ? "전일 자료에서 추가 조치가 필요한 신호가 없습니다." : "전일 다짐 마감자료를 입력하면 오늘 지침을 만들 수 있습니다."}</p>`;
}

function acceptFitnessDailyGuidance(guidanceId) {
  const dateKey = getActiveDateKey();
  const item = (state.fitnessDailyGuidance?.[dateKey] || []).find((entry) => entry.id === guidanceId);
  const ownId = getProfileMappedEmployeeId() || "profile-user";
  if (!item || isRepresentativeProfile() || item.targetEmployeeId !== ownId || !canEditEmployeeSlot(ownId)) {
    showAppToast("본인에게 배정된 지침만 수락할 수 있습니다");
    return;
  }
  const log = getEmployeeLogForDate(ownId, dateKey);
  const existing = (log.tasks || []).find((task) => task.guidanceId === item.id);
  if (!existing) {
    const task = (log.tasks || []).find((candidate) => !isActiveTask(candidate)) || createWorklogTask("A");
    if (!log.tasks.includes(task)) log.tasks.push(task);
    Object.assign(task, {
      priority: "A",
      text: `[전일 다짐] ${item.title}`,
      status: "미완료",
      done: false,
      guidanceId: item.id,
      guidanceSourceDateKey: item.sourceDateKey,
      scheduledSlot: item.dueTime || "",
    });
  }
  const now = new Date().toISOString();
  item.status = "accepted";
  item.acceptedAt ||= now;
  item.updatedAt = now;
  saveState();
  renderEntries();
  showAppToast("오늘의 우선업무에 추가했습니다");
}

function syncFitnessGuidanceFromTask(task = {}) {
  if (!task.guidanceId) return;
  Object.values(state.fitnessDailyGuidance || {}).forEach((items) => {
    const item = (items || []).find((entry) => entry.id === task.guidanceId);
    if (!item) return;
    const now = new Date().toISOString();
    if (task.done || task.status === "완료") {
      item.status = "completed";
      item.completedAt = now;
    } else if (task.status === "취소") item.status = "cancelled";
    else if (task.status === "위임") item.status = "delegated";
    else if (task.status === "연기") item.status = "postponed";
    else item.status = "accepted";
    item.updatedAt = now;
  });
}

function resetFitnessGuidanceFromTask(task = {}) {
  if (!task.guidanceId) return;
  Object.values(state.fitnessDailyGuidance || {}).forEach((items) => {
    const item = (items || []).find((entry) => entry.id === task.guidanceId);
    if (!item) return;
    item.status = "generated";
    item.acceptedAt = "";
    item.completedAt = "";
    item.updatedAt = new Date().toISOString();
  });
}

function renderFitnessCenterCoaching(total, rows) {
  const node = document.getElementById("fitnessCenterCoachingList");
  if (!node) return;
  const dagym = getDagymOpsForDate(getActiveDateKey());
  const visits = numberValue(dagym.visits);
  const ptBookings = numberValue(dagym.ptBookings);
  const noShows = numberValue(dagym.noShows);
  const expiring = numberValue(dagym.expiring);
  const renewals = numberValue(dagym.renewals);
  const lockerExpiring = numberValue(dagym.lockerExpiring);
  const sales = numberValue(dagym.sales);
  const staffPt = total.pt;
  const staffSalesActions = total.new + total.renewal + total.consultation + total.outbound;
  const notes = rows.flatMap((row) => [row.ops.shiftNote, row.ops.specialReport].filter(Boolean));
  const messages = [];

  if (visits && staffSalesActions < Math.max(2, Math.round(visits * 0.03))) {
    messages.push(["영업", `오늘 출석 ${visits}명 대비 상담/영업 기록 ${staffSalesActions}건입니다. 프론트와 트레이너가 재등록 후보, 체험권, 만료 예정자를 우선 확인해야 합니다.`]);
  } else {
    messages.push(["영업", `직원 영업행동 ${staffSalesActions}건이 기록되었습니다. 상담 결과를 등록/보류/재연락으로 분류하면 다음 코칭 정확도가 올라갑니다.`]);
  }
  if (ptBookings && staffPt < ptBookings) {
    messages.push(["PT", `다짐 PT 예약 ${ptBookings}건 대비 직원 PT 기록 ${staffPt}건입니다. 누락 수업 기록이나 노쇼 여부를 확인하세요.`]);
  } else if (staffPt) {
    messages.push(["PT", `직원 PT 기록 ${staffPt}건이 집계되었습니다. 수업 후 피드백과 다음 예약 여부를 남기면 재등록 관리에 연결됩니다.`]);
  }
  if (expiring > renewals) {
    messages.push(["재등록", `만료 예정 ${expiring}명, 재등록 ${renewals}건입니다. 만료 14일 이내 회원을 우선 콜백 대상으로 배정하세요.`]);
  }
  if (noShows) {
    messages.push(["예약", `노쇼/취소 ${noShows}건이 있습니다. 당일 재예약 안내와 사유 기록이 필요합니다.`]);
  }
  if (lockerExpiring) {
    messages.push(["락커", `락커 만료 ${lockerExpiring}건이 있습니다. 만료 전 자동메시지 발송 여부와 현장 안내를 확인하세요.`]);
  }
  if (sales) {
    messages.push(["매출", `다짐 결제/매출 ${sales.toLocaleString()}원이 입력되었습니다. 직원 행동 기록과 매출 발생 원인을 같이 남겨야 반복 가능한 영업 패턴이 보입니다.`]);
  }
  if (notes.length) {
    messages.push(["운영", `특이사항 ${notes.length}건이 있습니다. 시설/고객/안전 이슈는 담당자와 처리기한을 지정하세요.`]);
  }
  node.innerHTML = messages.slice(0, 6).map(([title, text]) => `<article><b>${escapeHtml(title)}</b><span>${escapeHtml(text)}</span></article>`).join("");
}

function getFitnessCoachingMessages(context = {}) {
  const page = context.page || getCurrentFitnessLogPage();
  const log = context.log || (page?.type === "employee" ? getSelectedLog() : getEmployeeLogForDate(state.fitnessWritableEmployeeId));
  const ops = { ...createFitnessOps(), ...(log.fitnessOps || {}) };
  const dateKey = context.dateKey || getActiveDateKey();
  const dagym = context.dagym || getDagymOpsForDate(dateKey);
  const employee = context.employee || page?.employee || employees.find((item) => item.id === state.fitnessWritableEmployeeId) || getSelectedEmployee();
  const tasks = getWorklogTaskRefs(log).map((ref) => ref.task).filter(isActiveTask);
  const pending = tasks.filter((task) => !task.done && !["완료", "취소"].includes(task.status));
  const nextEntry = context.log
    ? (log.schedule || []).find((entry) => getScheduleEntryText(entry)) || null
    : getNextScheduleEntry(log);
  const ptTotal = ["ptRegular", "ptFree", "ptOther"].reduce((sum, key) => sum + numberValue(ops[key]), 0);
  const salesAction = ["customerNew", "customerRenewal", "consultation", "outbound", "outsideSales"].reduce((sum, key) => sum + numberValue(ops[key]), 0);
  const visits = numberValue(dagym.visits);
  const expiring = numberValue(dagym.expiring);
  const messages = [
    ["오늘 환영", getPersonalizedWelcomeMessage(employee, log)],
    ["우선업무", pending.length ? `${getEmployeeOwnLabel(employee)}님은 미완료 ${pending.length}건을 먼저 정리하고, 가장 매출과 회원경험에 가까운 업무 1건을 상단에 두세요.` : "우선업무 흐름이 안정적입니다. 다음 일정 전까지 완료 기록을 남기면 코칭 정확도가 올라갑니다."],
    ["시간관리", nextEntry ? `다음 일정은 ${nextEntry.time} ${getScheduleEntryText(nextEntry)}입니다. 시작 전 준비물과 고객 응대 포인트를 5분 전에 확인하세요.` : "다음 일정이 비어 있습니다. 센터관리, 상담 후보 확인, 시설 점검 중 하나를 시간표에 배치하세요."],
    ["센터운영", visits ? `오늘 출석 ${visits}명 기준으로 상담/재등록 행동 ${salesAction}건입니다. 출석 대비 3% 이상을 상담 기록으로 남기는 것을 권장합니다.` : "다짐 출석/매출 자료를 입력하면 운영 코칭이 더 구체화됩니다."],
    ["영업", expiring ? `만료 예정 ${expiring}명을 우선 확인하세요. PT ${ptTotal}건 이후 재등록 가능 회원에게 당일 안내를 연결하세요.` : "만료 예정자가 없거나 미입력 상태입니다. 상담, 아웃바운드, 재등록 후보를 기록해 매출 루프를 만드세요."],
  ];
  return messages;
}

function renderFitnessCoaching() {
  const messages = getFitnessCoachingMessages();
  const tickerButton = document.getElementById("fitnessCoachingTicker");
  const ticker = document.getElementById("fitnessCoachingTickerText");
  if (ticker) {
    const tickerText = messages.map(([title, text]) => `${title}: ${text}`).join("   ·   ");
    ticker.textContent = tickerText;
    ticker.dataset.tickerText = tickerText;
  }
  if (tickerButton) {
    tickerButton.classList.remove("is-historical-weather");
    tickerButton.disabled = false;
    tickerButton.querySelector("b").textContent = "AI 코칭";
    tickerButton.setAttribute("aria-label", "AI 코칭 자세히 보기");
  }
  const detail = document.getElementById("fitnessCoachingDetailList");
  if (detail) {
    detail.innerHTML = messages.map(([title, text]) => `<article><b>${escapeHtml(title)}</b><p>${escapeHtml(text)}</p></article>`).join("");
  }
}

let fitnessCoachingCloseTimer = null;
let fitnessCoachingReturnFocus = null;

function openFitnessCoachingSheet() {
  renderFitnessCoaching();
  const backdrop = document.getElementById("fitnessCoachingBackdrop");
  const sheet = document.getElementById("fitnessCoachingSheet");
  if (!backdrop || !sheet) return;
  if (fitnessCoachingCloseTimer) window.clearTimeout(fitnessCoachingCloseTimer);
  fitnessCoachingCloseTimer = null;
  fitnessCoachingReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  document.body.classList.add("is-fitness-coaching-open");
  backdrop.hidden = false;
  sheet.hidden = false;
  requestAnimationFrame(() => {
    sheet.classList.add("is-open");
    document.getElementById("fitnessCoachingCloseButton")?.focus();
  });
}

function closeFitnessCoachingSheet() {
  const backdrop = document.getElementById("fitnessCoachingBackdrop");
  const sheet = document.getElementById("fitnessCoachingSheet");
  sheet?.classList.remove("is-open");
  if (fitnessCoachingCloseTimer) window.clearTimeout(fitnessCoachingCloseTimer);
  fitnessCoachingCloseTimer = window.setTimeout(() => {
    if (backdrop) backdrop.hidden = true;
    if (sheet) sheet.hidden = true;
    document.body.classList.remove("is-fitness-coaching-open");
    fitnessCoachingReturnFocus?.focus?.();
    fitnessCoachingReturnFocus = null;
    fitnessCoachingCloseTimer = null;
  }, 160);
}

function importDagymText() {
  if (!canManageDagymOperations()) return;
  const text = document.getElementById("dagymImportText")?.value || "";
  const record = getDagymOpsForDate(getActiveDateKey());
  record.importText = text;
  const rules = [
    ["visits", /(?:출석|입장|방문)\D{0,12}(\d[\d,]*)/i],
    ["newMembers", /(?:신규|신규\s*등록)\D{0,12}(\d[\d,]*)/i],
    ["renewals", /(?:재등록|연장|갱신)\D{0,12}(\d[\d,]*)/i],
    ["expiring", /(?:만료\s*예정|만료예정|만료)\D{0,12}(\d[\d,]*)/i],
    ["ptBookings", /(?:PT\s*예약|피티\s*예약|수업\s*예약|예약)\D{0,12}(\d[\d,]*)/i],
    ["noShows", /(?:노쇼|취소|결석)\D{0,12}(\d[\d,]*)/i],
    ["lockerExpiring", /(?:락커\s*만료|락커)\D{0,12}(\d[\d,]*)/i],
    ["sales", /(?:매출|결제|판매)\D{0,12}(\d[\d,]*)/i],
  ];
  rules.forEach(([key, pattern]) => {
    const match = text.match(pattern);
    if (match) record[key] = match[1].replaceAll(",", "");
  });
  touchDagymDailyRecord(record);
  saveState({ fastSave: true });
  renderFitnessCenterDaily();
}

function clearDagymOps() {
  if (!canManageDagymOperations()) return;
  state.dagymDaily[getActiveDateKey()] = {
    ...createDagymDailyRecord(getActiveDateKey()),
    updatedAt: new Date().toISOString(),
    updatedBy: getEmployeeOwnLabel(getProfileEmployee()),
  };
  state.dagymOps = state.dagymDaily[getActiveDateKey()];
  saveState();
  renderFitnessCenterDaily();
}

function toggleDagymDailyClose() {
  if (!canManageDagymOperations()) return;
  const record = getDagymOpsForDate(getActiveDateKey());
  if (!hasDagymDailyActivity(record)) {
    showAppToast("마감할 다짐 자료가 없습니다");
    return;
  }
  const closing = record.status !== "closed";
  const now = new Date().toISOString();
  record.status = closing ? "closed" : "draft";
  record.closedAt = closing ? now : "";
  record.updatedAt = now;
  record.updatedBy = getEmployeeOwnLabel(getProfileEmployee()) || state.profile?.name || "담당자";
  state.dagymOps = record;
  saveState();
  renderFitnessCenterDaily();
  showAppToast(closing ? "다짐 일일자료를 마감 확정했습니다" : "다짐 마감을 해제했습니다");
}

function getWorkMinutes(start = "", end = "") {
  if (!start || !end) return 0;
  const minutes = timeToMinutes(end) - timeToMinutes(start);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
}

function formatWorkDuration(minutes = 0) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins ? `${hours}시간 ${mins}분` : `${hours}시간`;
}

function renderWorklogSummary(log) {
  const tasks = getWorklogTaskRefs(log).map((ref) => ref.task).filter((task) => isActiveTask(task));
  const completed = tasks.filter((task) => task.done || task.status === "완료").length;
  const pending = tasks.filter((task) => !task.done && !["완료", "취소"].includes(task.status)).length;
  const nextEntry = getNextScheduleEntry(log);
  document.getElementById("worklogDayTitle").textContent = formatKoreanDate(getActiveDateKey());
  document.getElementById("worklogCompletion").textContent = `${completed}/${tasks.length}`;
  const pulseText = document.getElementById("worklogPulseText");
  const pulse = document.getElementById("worklogPulse");
  if (pulseText) {
    const nextScheduleText = nextEntry
      ? String(getScheduleEntryText(nextEntry) || "일정 확인").replace(/\s+/g, " ").trim()
      : "";
    const compactNextSchedule = nextScheduleText.length > 22
      ? `${nextScheduleText.slice(0, 22).trim()}…`
      : nextScheduleText;
    pulseText.textContent = nextEntry
      ? `다음 ${nextEntry.time} · ${compactNextSchedule}`
      : pending
        ? `미완료 ${pending}건 · 우선업무를 마무리하세요`
        : "오늘 업무 완료 · 보고서를 정리하세요";
  }
  if (pulse) {
    pulse.classList.remove("is-historical-weather");
    pulse.dataset.pulseTone = pending ? "attention" : "clear";
    pulse.disabled = false;
    pulse.setAttribute("aria-label", `AI 코칭 열기 · ${pulseText?.textContent || "오늘 업무 확인"}`);
  }
  const unitButton = document.getElementById("scheduleUnitButton");
  if (unitButton) unitButton.textContent = log.scheduleUnit === "60" ? "1시간" : "30분";
  updateWorklogScheduleControlLabels(log, "worklog");
  renderWorklogEditLockBanner("worklog");
  applyTodayPageMode();
}

function updateWorklogScheduleControlLabels(log = getSelectedLog(), scope = "worklog") {
  const hoursButton = document.getElementById(scope === "fitness" ? "fitnessHoursButton" : "worklogHoursButton");
  const addButton = document.getElementById(scope === "fitness" ? "fitnessAddTimeButton" : "worklogAddTimeButton");
  if (hoursButton) {
    const effectiveHours = getEmployeeWorkHours(log?.employeeId, state?.profile, getActiveDateKey());
    hoursButton.textContent = isOffWorkHours(effectiveHours) ? "휴무근무" : "시간";
    hoursButton.title = log?.workHoursOverride
      ? `이 날짜 근무시간: ${log.workHoursOverride}`
      : `기본 근무시간: ${effectiveHours || defaultProfile.workHours}`;
  }
  if (addButton) {
    addButton.textContent = "+시간";
    addButton.title = "시간별일정에 시간대를 직접 추가";
  }
}

function promptWorklogDayWorkHours(scope = "worklog") {
  const view = scope === "fitness" ? "fitness-log" : activeView;
  if (!guardWorklogEdit(view)) return;
  const log = scope === "fitness" ? getSelectedLog() : getSelectedLog();
  const current = log.workHoursOverride || getEmployeeWorkHours(log.employeeId, state.profile, getActiveDateKey()) || defaultProfile.workHours;
  const input = prompt("이 날짜의 실제 근무시간을 입력하세요.\n예: 08:00-20:00 / 06:00-24:00 / 휴무", current);
  if (input === null) return;
  const normalized = normalizeWorkHoursText(input);
  if (!normalized) {
    log.workHoursOverride = "";
  } else if (!isOffWorkHours(normalized) && !/^([01]\d|2[0-4]):[0-5]\d[-~]([01]\d|2[0-4]):[0-5]\d$/.test(normalized)) {
    showAppToast("근무시간은 08:00-18:00 형식으로 입력해주세요");
    return;
  } else {
    const [start, end] = normalized.split(/[-~]/);
    if (!isOffWorkHours(normalized) && timeToMinutes(end) <= timeToMinutes(start)) {
      showAppToast("종료시간은 시작시간보다 늦어야 합니다");
      return;
    }
    log.workHoursOverride = normalized;
  }
  normalizeEmployeeLogRows(log);
  saveState();
  renderEntries();
  showAppToast(log.workHoursOverride ? `이 날짜 근무시간 ${log.workHoursOverride} 적용` : "이 날짜 근무시간 변경을 해제했습니다");
}

function promptAddWorklogScheduleSlot(scope = "worklog") {
  const view = scope === "fitness" ? "fitness-log" : activeView;
  if (!guardWorklogEdit(view)) return;
  const log = getSelectedLog();
  const input = prompt("추가할 시간을 입력하세요.\n예: 20:30 / 23:00 / 24:00", "");
  if (input === null) return;
  const slot = normalizeScheduleTimeInput(input);
  if (!slot) {
    showAppToast("시간은 20:30 형식으로 입력해주세요");
    return;
  }
  log.manualScheduleSlots = Array.isArray(log.manualScheduleSlots) ? log.manualScheduleSlots : [];
  if (!log.manualScheduleSlots.includes(slot)) log.manualScheduleSlots.push(slot);
  ensureWorklogAppointmentSlot(log, slot);
  normalizeEmployeeLogRows(log);
  saveState();
  renderEntries();
  showAppToast(`${slot} 시간대를 추가했습니다`);
}

function renderWorklogEditLockBanner(scope = "worklog") {
  const viewName = scope === "fitness" ? "fitness-log" : activeView;
  const banner = document.getElementById(scope === "fitness" ? "fitnessEditLockBanner" : "worklogEditLockBanner");
  if (!banner) return;
  if (scope === "worklog" && !["today", "bangju-log", "beyond-log"].includes(viewName)) {
    banner.hidden = true;
    banner.innerHTML = "";
    return;
  }
  const employeeId = getCurrentWorklogEmployeeId(viewName);
  const isEmployeePage = Boolean(employeeId);
  const lock = getWorklogEditLockInfo(employeeId, getActiveDateKey());
  const pending = isEmployeePage ? getPendingCorrectionRequest(employeeId, getActiveDateKey()) : null;
  const showPendingApproval = Boolean(pending && canApproveWorklogCorrections());
  const showOwnRequest = Boolean(isEmployeePage && lock.lockedByDate && canEditEmployeeSlot(employeeId) && !pending);
  const showGrant = Boolean(lock.grant && !lock.locked);
  if (!isEmployeePage || (!lock.locked && !showGrant && !showPendingApproval)) {
    banner.hidden = true;
    banner.innerHTML = "";
    return;
  }
  banner.hidden = false;
  banner.classList.toggle("is-locked", lock.locked);
  banner.classList.toggle("is-approved", showGrant);
  const employee = getEmployeeOptions().find((item) => item.id === employeeId) || getProfileEmployee();
  const action = showPendingApproval
    ? `<button type="button" data-correction-approve="${escapeAttr(pending.id)}">정정 승인</button>`
    : showOwnRequest
      ? `<button type="button" data-correction-request="${escapeAttr(scope)}">정정 요청</button>`
      : pending
        ? `<span class="worklog-lock-pill">승인 대기</span>`
        : "";
  banner.innerHTML = `
    <div>
      <strong>${escapeHtml(lock.label)}</strong>
      <span>${escapeHtml(formatShortDate(getActiveDateKey()))} · ${escapeHtml(getEmployeeAdminLabel(employee))} · ${escapeHtml(lock.detail)}</span>
    </div>
    ${action}
  `;
  banner.querySelector("[data-correction-request]")?.addEventListener("click", () => requestWorklogCorrection(viewName));
  banner.querySelector("[data-correction-approve]")?.addEventListener("click", (event) => {
    approveWorklogCorrection(event.currentTarget.dataset.correctionApprove || "");
  });
}

function setTodayPageMode(mode) {
  todayPageMode = ["common", "daily", "coworker"].includes(mode) ? mode : "daily";
  resetMobileDayFocusToSplit({ blur: true });
  applyTodayPageMode();
}

function moveTodayPage(delta) {
  const modes = ["common", "daily", "coworker"];
  const index = modes.indexOf(todayPageMode);
  setTodayPageMode(modes[Math.max(0, Math.min(modes.length - 1, index + delta))]);
}

function applyTodayPageMode() {
  const main = document.getElementById("worklogMain");
  if (!main) return;
  main.dataset.todayPage = todayPageMode;
  document.querySelectorAll("[data-worklog-panel]").forEach((button) => {
    const mode = button.dataset.worklogPanel === "weekly" ? "common" : "coworker";
    button.classList.toggle("is-active", todayPageMode === mode);
  });
}

function renderSharedWorklogPanels(log = getSelectedLog()) {
  const common = document.getElementById("commonScheduleBoard");
  const coworkers = document.getElementById("coworkerWorklogBoard");
  if (!common || !coworkers) return;
  const dateKey = getActiveDateKey();
  const selectedEmployee = getSelectedEmployee();
  const commonWeekKey = getActiveWeekKey(dateKey);
  const weekRange = getWeekDateKeys(dateKey);
  const companyKey = getCompanyCommonKey(selectedEmployee);
  const companyLabel = getCompanyCommonLabel(companyKey);
  const commonWeekResult = ensureCompanyCommonWeek(companyKey, commonWeekKey);
  const week = commonWeekResult.week;
  let commonChanged = commonWeekResult.changed;
  const commonProgress = getCommonWeekProgress(week);
  const canEditCommon = canEditCompanyCommonSchedule(selectedEmployee);
  const commonGuidance = getCompanyCommonGuidance(companyKey);
  common.innerHTML = `
    <section class="common-week-header">
      <div>
        <span>Shared Execution Calendar</span>
        <strong>${escapeHtml(companyLabel)} 실행일정 · 업무 이벤트</strong>
        <small>${escapeHtml(formatCommonWeekRange(commonWeekKey))} · 완료 ${commonProgress.done}/${commonProgress.total} · 확인 ${commonProgress.pending}</small>
      </div>
      <button type="button" id="commonWeekTodayButton" aria-label="개인 업무일지로 돌아가기">업무일지</button>
    </section>
    <section class="common-week-guidance" aria-label="주간 공통업무 운영 기준">
      ${commonGuidance.map((item) => `
        <article>
          <b>${escapeHtml(item.title)}</b>
          <span>${escapeHtml(item.text)}</span>
        </article>
      `).join("")}
    </section>
    <section class="company-common-board ${canEditCommon ? "is-editable" : "is-readonly"}" aria-label="회사 공통 실행일정">
      ${renderCompanyCommonBoardSections(week, companyKey, selectedEmployee, canEditCommon)}
    </section>
    <section class="common-week-brief">
      <b>운영 규칙</b>
      <div>
        <p>이 페이지는 개인 업무기록이 아니라 같은 소속이 함께 확인하는 월간·주간 실행 일정입니다.</p>
        <p>목록에는 핵심만 보이고, 항목을 누르면 날짜, 반복, 확정상태, 담당자, 세부내용을 수정할 수 있습니다.</p>
      </div>
    </section>
  `;
  common.querySelector("#commonWeekTodayButton")?.addEventListener("click", () => setTodayPageMode("daily"));
  common.querySelectorAll(".company-common-event-check").forEach((control) => {
    control.addEventListener("click", (event) => event.stopPropagation());
  });
  common.querySelectorAll("[data-common-add-section]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!guardCompanyCommonEdit(selectedEmployee)) return;
      const sectionId = button.dataset.commonAddSection;
      week.sections ||= {};
      week.sections[sectionId] ||= [];
      const item = createCommonScheduleItem("", {
        sectionId,
        dateKey,
        owner: getDefaultCommonOwner(sectionId, selectedEmployee),
      });
      week.sections[sectionId].push(item);
      saveState();
      renderSharedWorklogPanels();
      requestAnimationFrame(() => {
        document.querySelector(`[data-common-field="text"][data-common-id="${CSS.escape(item.id)}"]`)?.focus();
      });
    });
  });
  common.querySelectorAll("[data-common-board-check]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      if (!guardCompanyCommonEdit(selectedEmployee)) return;
      const item = findCommonScheduleItem(week, checkbox.dataset.commonBoardCheck);
      if (!item) return;
      item.done = checkbox.checked;
      item.completedAt = item.done ? new Date().toISOString() : "";
      saveState({ fastSave: true });
      renderSharedWorklogPanels();
    });
  });
  common.querySelectorAll("[data-common-field]").forEach((field) => {
    const update = () => {
      if (!guardCompanyCommonEdit(selectedEmployee)) return;
      const item = findCommonScheduleItem(week, field.dataset.commonId);
      if (!item) return;
      item[field.dataset.commonField] = field.value;
      saveState({ fastSave: true });
    };
    field.addEventListener("input", update);
    field.addEventListener("change", update);
    field.addEventListener("blur", () => renderSharedWorklogPanels());
  });
  common.querySelectorAll("[data-common-board-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!guardCompanyCommonEdit(selectedEmployee)) return;
      const beforeWeek = cloneWorklogLogForAudit(week);
      Object.keys(week.sections || {}).forEach((sectionId) => {
        week.sections[sectionId] = (week.sections[sectionId] || []).filter((item) => item.id !== button.dataset.commonBoardDelete);
      });
      saveState();
      renderSharedWorklogPanels();
      showUndoToast("공통일정을 삭제했습니다", () => {
        restoreObjectSnapshot(week, beforeWeek);
        saveState();
        renderSharedWorklogPanels();
      });
    });
  });
  if (commonChanged) saveState({ fastSave: true });

  const coworkerRows = getCoworkerEmployeesForWorklog(selectedEmployee, activeView)
    .slice(0, 8)
    .map((employee) => {
      const dayLog = getEmployeeLogForDate(employee.id, dateKey);
      const tasks = (dayLog.tasks || []).filter(isActiveTask).slice(0, 3);
      const completed = tasks.filter((task) => task.done || task.status === "완료").length;
      return { employee, tasks, completed };
    });
  coworkers.innerHTML = coworkerRows.length
    ? coworkerRows.map((row) => `
      <article class="coworker-worklog-item">
        <header>
          <b>${escapeHtml(getEmployeeAdminLabel(row.employee))}</b>
          <span>${row.completed}/${row.tasks.length}</span>
          <button type="button" data-coworker-worklog-open="${escapeAttr(getEmployeeWorklogId(row.employee))}">업무일지 열기</button>
        </header>
        ${renderSharedTaskList(row.tasks.map((task) => ({ text: task.text || task.status || "업무" })), "공유된 업무가 없습니다.")}
      </article>
    `).join("")
    : `<p class="shared-empty">같은 사업장 동료 업무일지가 아직 없습니다.</p>`;
  coworkers.querySelectorAll("[data-coworker-worklog-open]").forEach((button) => {
    button.addEventListener("click", () => {
      const employeeId = button.dataset.coworkerWorklogOpen || "";
      if (!getWorklogEmployeeIdsForView(activeView).includes(employeeId)) return;
      state.selectedEmployeeId = employeeId;
      saveState({ fastSave: true });
      setTodayPageMode("daily");
      renderEntries();
      renderGlobalEmployeeIdentity();
    });
  });
}

function renderSharedTaskList(items, emptyText) {
  if (!items.length) return `<p class="shared-empty">${escapeHtml(emptyText)}</p>`;
  return `<ul>${items.map((item) => `<li>${item.dateKey ? `<span>${escapeHtml(formatShortDate(item.dateKey))}</span>` : ""}${escapeHtml(item.text || "")}</li>`).join("")}</ul>`;
}

const commonScheduleSections = [
  {
    id: "departmentMonthly",
    eyebrow: "Department Month",
    title: "부서 월간 핵심일정",
    description: "사업부가 함께 확인해야 할 월간 마감, 계약, 행사, 외부 일정을 기록합니다.",
  },
  {
    id: "departmentWeekly",
    eyebrow: "Department Week",
    title: "부서 주간 실행업무",
    description: "이번 주 공동으로 처리해야 할 운영·보고·확인 업무를 관리합니다.",
  },
  {
    id: "personalMonthly",
    eyebrow: "Personal Month",
    title: "개인 월간 중점업무",
    description: "개인별 월간 목표, 담당 프로젝트, 반복 확인 업무를 남깁니다.",
  },
  {
    id: "personalWeekly",
    eyebrow: "Personal Week",
    title: "개인 주간 실행이벤트",
    description: "개인에게 배정된 이번 주 주요 이벤트와 실행 일정을 추적합니다.",
  },
];

function renderCompanyCommonBoardSections(week, companyKey, employee, editable) {
  const ownerOptions = getCompanyCommonOwnerOptions(companyKey, employee);
  return commonScheduleSections.map((section) => {
    const items = (week.sections?.[section.id] || []).filter((item) => editable || item.text?.trim() || item.done);
    const done = items.filter((item) => item.done).length;
    return `
      <article class="company-common-section" data-common-section="${escapeAttr(section.id)}">
        <header>
          <div>
            <span>${escapeHtml(section.eyebrow)}</span>
            <strong>${escapeHtml(section.title)}</strong>
            <small>${escapeHtml(section.description)}</small>
          </div>
          <b>${done}/${items.length}</b>
        </header>
        <div class="company-common-event-list">
          ${items.length
            ? items.map((item) => renderCompanyCommonEvent(section, item, ownerOptions, editable)).join("")
            : `<p class="company-common-empty">아직 기록된 일정이 없습니다.</p>`}
        </div>
        ${editable ? `<button type="button" class="company-common-add" data-common-add-section="${escapeAttr(section.id)}">일정 추가</button>` : ""}
      </article>
    `;
  }).join("");
}

function renderCompanyCommonEvent(section, item, ownerOptions, editable) {
  const dateLabel = item.dateKey ? formatShortDate(item.dateKey) : "날짜";
  const status = item.eventStatus || "예정";
  const repeat = item.repeat || "none";
  const owner = item.owner || "담당 미정";
  const summaryText = item.text?.trim() || `${section.title} 입력`;
  const detailText = item.detail || "";
  return `
    <details class="company-common-event ${item.done ? "is-done" : ""}" ${item.expanded ? "open" : ""}>
      <summary>
        <label class="company-common-event-check">
          <input type="checkbox" data-common-board-check="${escapeAttr(item.id)}" ${item.done ? "checked" : ""} ${editable ? "" : "disabled"} />
          <span></span>
        </label>
        <span class="company-common-event-date">${escapeHtml(dateLabel)}</span>
        <strong>${escapeHtml(summaryText)}</strong>
        <em>${escapeHtml(owner)}</em>
        <b>${escapeHtml(status)}</b>
      </summary>
      <div class="company-common-event-detail">
        <label>
          <span>내용</span>
          <input type="text" data-common-id="${escapeAttr(item.id)}" data-common-field="text" value="${escapeAttr(item.text || "")}" placeholder="${escapeAttr(section.title)}" ${editable ? "" : "disabled"} />
        </label>
        <label>
          <span>날짜</span>
          <input type="date" data-common-id="${escapeAttr(item.id)}" data-common-field="dateKey" value="${escapeAttr(item.dateKey || "")}" ${editable ? "" : "disabled"} />
        </label>
        <label>
          <span>상태</span>
          <select data-common-id="${escapeAttr(item.id)}" data-common-field="eventStatus" ${editable ? "" : "disabled"}>
            ${["예정", "확정", "보류"].map((value) => `<option value="${value}" ${status === value ? "selected" : ""}>${value}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>반복</span>
          <select data-common-id="${escapeAttr(item.id)}" data-common-field="repeat" ${editable ? "" : "disabled"}>
            ${[
              ["none", "반복 없음"],
              ["monthly", "매월 반복"],
              ["weekly", "매주 반복"],
            ].map(([value, label]) => `<option value="${value}" ${repeat === value ? "selected" : ""}>${label}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>담당</span>
          <select data-common-id="${escapeAttr(item.id)}" data-common-field="owner" ${editable ? "" : "disabled"}>
            ${ownerOptions.map((value) => `<option value="${escapeAttr(value)}" ${owner === value ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}
          </select>
        </label>
        <label class="is-wide">
          <span>세부내용</span>
          <textarea data-common-id="${escapeAttr(item.id)}" data-common-field="detail" rows="2" placeholder="일정 배경, 준비물, 보고 대상, 후속조치" ${editable ? "" : "disabled"}>${escapeHtml(detailText)}</textarea>
        </label>
        ${editable ? `<button type="button" data-common-board-delete="${escapeAttr(item.id)}">삭제</button>` : ""}
      </div>
    </details>
  `;
}

function getCompanyCommonOwnerOptions(companyKey = getCompanyCommonKey(), employee = getSelectedEmployee()) {
  const names = getEmployeeOptions()
    .filter((item) => isAssignedWorklogEmployee(item) || item.id === "profile-user")
    .filter((item) => getCompanyCommonKey(item) === companyKey)
    .map((item) => getEmployeeOwnLabel(item) || item.name || item.role)
    .filter(Boolean);
  const fallback = getEmployeeOwnLabel(employee) || employee?.name || "";
  return [...new Set(["담당 미정", fallback, ...names, "대표", "업체"].filter(Boolean))];
}

function getDefaultCommonOwner(sectionId, employee = getSelectedEmployee()) {
  if (/personal/i.test(sectionId)) return getEmployeeOwnLabel(employee) || employee?.name || "담당 미정";
  return "담당 미정";
}

function findCommonScheduleItem(week, itemId) {
  return Object.values(week?.sections || {}).flat().find((item) => item.id === itemId)
    || Object.values(week?.days || {}).flat().find((item) => item.id === itemId);
}

function getWeekDateKeys(dateKey) {
  const date = parseDateKey(dateKey);
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return formatDateKey(day);
  });
}

function formatWeekdayShort(dateKey) {
  const date = parseDateKey(dateKey);
  return `${date.getMonth() + 1}/${date.getDate()} ${hanjaWeekdays[date.getDay()]}`;
}

function getCompanyCommonKey(employee = getSelectedEmployee()) {
  const source = `${employee?.org || ""} ${employee?.workplace || ""}`.trim();
  if (/피트니스|fitness/i.test(source)) return "beyond-fitness";
  if (/비욘드\s*컴퍼니|비욘드컴퍼니|beyond company/i.test(source)) return "beyond-company";
  if (/비제이|종합건설|건설|bj/i.test(source)) return "bj-construction";
  if (/방주|bangju/i.test(source)) return "bangju";
  return source || "bangju";
}

function getCompanyCommonLabel(companyKey = getCompanyCommonKey()) {
  return {
    bangju: "(주)방주",
    "beyond-company": "(주)비욘드컴퍼니",
    "beyond-fitness": "비욘드 피트니스",
    "bj-construction": "(주)비제이종합건설",
  }[companyKey] || companyKey || "(주)방주";
}

function getCompanyCommonGuidance(companyKey = getCompanyCommonKey()) {
  const guides = {
    bangju: [
      { title: "재무 마감", text: "입출금, 세금, 대출, 임대료, 미수금 등 날짜가 있는 공통 확인사항을 둡니다." },
      { title: "계약/자산", text: "계약만료, 등기, 임대, 공실, 자산관리 이슈를 요일별로 배치합니다." },
      { title: "대표 보고", text: "대표 확인이 필요한 숫자와 리스크는 주간 공통업무로 남깁니다." },
    ],
    "beyond-company": [
      { title: "공유사업", text: "입주, 문의, 공실, 우편, 회의실, 창고 운영 이슈를 함께 추적합니다." },
      { title: "TBA/프로젝트", text: "시공, 발주, 쇼룸, 특허, 콘텐츠 등 부서 공통 일정을 배치합니다." },
      { title: "고객 후속", text: "상담 후속, 견적, 재방문, 클레임 처리를 놓치지 않게 둡니다." },
    ],
    "bj-construction": [
      { title: "공정/안전", text: "현장 공정, 안전점검, 품질 확인, 자재 입고 일정을 한 주 단위로 정리합니다." },
      { title: "협력업체", text: "하도급, 인력, 장비, 검측 요청 등 외부 일정은 요일별로 배치합니다." },
      { title: "문서/사진", text: "일보, 사진, 도면, 공문, 검측자료 제출 상태를 함께 확인합니다." },
    ],
  };
  return guides[companyKey] || [
    { title: "공통 목표", text: "이번 주 같은 소속이 반드시 확인해야 할 업무를 요일별로 배치합니다." },
    { title: "실행 확인", text: "완료 여부만 체크해 주간 진행률과 이월 항목을 명확히 남깁니다." },
    { title: "다음 주 연결", text: "미완료 항목은 다음 주 같은 요일로 자동 이월됩니다." },
  ];
}

function createCommonScheduleItem(text = "", source = null) {
  const id = crypto.randomUUID?.() || `common-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    text,
    done: false,
    dateKey: source?.dateKey || "",
    owner: source?.owner || "",
    eventStatus: source?.eventStatus || "예정",
    repeat: source?.repeat || "none",
    detail: source?.detail || "",
    sectionId: source?.sectionId || "",
    createdAt: new Date().toISOString(),
    carryFrom: source?.carryFrom || source?.id || "",
    sourceWeekKey: source?.sourceWeekKey || "",
  };
}

function getPreviousWeekKey(weekKey = getActiveWeekKey()) {
  const date = parseDateKey(weekKey);
  date.setDate(date.getDate() - 7);
  return formatDateKey(date);
}

function ensureCompanyCommonWeek(companyKey = getCompanyCommonKey(), weekKey = getActiveWeekKey()) {
  state.companyCommonWeeks ||= {};
  state.companyCommonWeeks[companyKey] ||= {};
  const weeks = state.companyCommonWeeks[companyKey];
  weeks[weekKey] ||= { weekKey, days: {} };
  const week = weeks[weekKey];
  week.days ||= {};
  week.sections ||= {};
  commonScheduleSections.forEach((section) => {
    week.sections[section.id] = Array.isArray(week.sections[section.id]) ? week.sections[section.id] : [];
  });
  getWeekDateKeys(weekKey).forEach((dateKey) => {
    week.days[dateKey] = Array.isArray(week.days[dateKey]) ? week.days[dateKey] : [];
  });

  let changed = false;
  const legacyItems = Object.values(week.days || {}).flat().filter((item) => item.text?.trim() || item.done);
  if (legacyItems.length && !week.migratedCommonBoardV1) {
    const target = week.sections.departmentWeekly;
    legacyItems.forEach((item) => {
      if (target.some((current) => current.carryFrom === item.id || current.id === item.id)) return;
      target.push(createCommonScheduleItem(item.text, {
        ...item,
        sectionId: "departmentWeekly",
        dateKey: item.dateKey || Object.keys(week.days || {}).find((key) => (week.days[key] || []).some((row) => row.id === item.id)) || "",
        owner: item.owner || "담당 미정",
        carryFrom: item.carryFrom || item.id,
      }));
    });
    week.migratedCommonBoardV1 = true;
    changed = true;
  }
  const previousWeek = weeks[getPreviousWeekKey(weekKey)];
  if (previousWeek?.days) {
    getWeekDateKeys(weekKey).forEach((dateKey, index) => {
      const previousDateKey = getWeekDateKeys(previousWeek.weekKey || getPreviousWeekKey(weekKey))[index];
      const previousItems = previousWeek.days?.[previousDateKey] || [];
      const currentItems = week.days[dateKey] || [];
      previousItems
        .filter((item) => item.text?.trim() && !item.done)
        .forEach((item) => {
          const carryKey = item.carryFrom || item.id;
          const exists = currentItems.some((current) => (current.carryFrom || current.id) === carryKey);
          if (exists) return;
          currentItems.push(createCommonScheduleItem(item.text, {
            ...item,
            carryFrom: carryKey,
            sourceWeekKey: previousWeek.weekKey || getPreviousWeekKey(weekKey),
          }));
          changed = true;
        });
      week.days[dateKey] = currentItems;
    });
  }
  if (previousWeek?.sections) {
    ["departmentWeekly", "personalWeekly"].forEach((sectionId) => {
      const currentItems = week.sections[sectionId] || [];
      (previousWeek.sections[sectionId] || [])
        .filter((item) => item.text?.trim() && !item.done)
        .forEach((item) => {
          const carryKey = item.carryFrom || item.id;
          const exists = currentItems.some((current) => (current.carryFrom || current.id) === carryKey);
          if (exists) return;
          currentItems.push(createCommonScheduleItem(item.text, {
            ...item,
            sectionId,
            carryFrom: carryKey,
            sourceWeekKey: previousWeek.weekKey || getPreviousWeekKey(weekKey),
          }));
          changed = true;
        });
      week.sections[sectionId] = currentItems;
    });
  }
  return { week, changed };
}

function canEditCompanyCommonSchedule(employee = getSelectedEmployee()) {
  if (isExplicitlySignedOut()) return false;
  if (isRepresentativeProfile() || hasProfilePermission("worklogAll") || hasProfilePermission("worklogSite")) return true;
  const ownEmployeeId = getProfileMappedEmployeeId() || "profile-user";
  const ownEmployee = getEmployeeOptions().find((item) => item.id === ownEmployeeId) || getProfileEmployee();
  return getCompanyCommonKey(employee) === getCompanyCommonKey(ownEmployee);
}

function guardCompanyCommonEdit(employee = getSelectedEmployee()) {
  if (canEditCompanyCommonSchedule(employee)) return true;
  showAppToast("소속회사 공통일정만 수정할 수 있습니다");
  return false;
}

function getCommonWeekProgress(week) {
  const boardItems = Object.values(week?.sections || {}).flat();
  const legacyItems = Object.values(week?.days || {}).flat();
  const items = [...boardItems, ...legacyItems].filter((item) => item.text?.trim());
  const done = items.filter((item) => item.done).length;
  return { total: items.length, done, pending: Math.max(0, items.length - done) };
}

function renderCompanyCommonWeekDay(dateKey, items = [], editable = false) {
  const visibleItems = editable ? items : items.filter((item) => item.text?.trim() || item.done);
  const countItems = items.filter((item) => item.text?.trim() || item.done);
  const body = visibleItems.length
    ? visibleItems.map((item) => `
      <div class="company-common-row ${item.done ? "is-done" : ""} ${item.carryFrom ? "is-carried" : ""}" data-common-item="${escapeAttr(item.id)}">
        <label>
          <input type="checkbox" data-common-check="${escapeAttr(item.id)}" ${item.done ? "checked" : ""} ${editable ? "" : "disabled"} />
          <span></span>
        </label>
        <input type="text" data-common-text="${escapeAttr(item.id)}" value="${escapeAttr(item.text || "")}" placeholder="공통업무" ${editable ? "" : "disabled"} />
        ${item.carryFrom ? `<em>이월</em>` : ""}
        ${editable ? `<button type="button" data-common-delete="${escapeAttr(item.id)}" aria-label="공통업무 삭제">×</button>` : ""}
      </div>
    `).join("")
    : `<p class="company-common-empty">공통업무 없음</p>`;
  return `
    <article class="company-common-day">
      <header>
        <b>${escapeHtml(formatWeekdayShort(dateKey))}</b>
        <span>${countItems.filter((item) => item.done).length}/${countItems.length}</span>
      </header>
      <div class="company-common-list">${body}</div>
      ${editable ? `<button type="button" class="company-common-add" data-common-add="${escapeAttr(dateKey)}">공통업무 추가</button>` : ""}
    </article>
  `;
}

function renderWorklogTaskBoard(log) {
  const board = document.getElementById("worklogTaskBoard");
  board.innerHTML = "";
  const list = document.createElement("section");
  list.className = "worklog-task-list";
  getVisibleWorklogTaskRefs(log, { view: activeView }).forEach((ref) => {
    list.appendChild(renderWorklogTaskRow(ref, log));
  });
  const add = document.createElement("button");
  add.type = "button";
  add.className = "worklog-add-row";
  add.textContent = "업무 추가";
  add.onclick = () => {
    if (!guardWorklogEdit()) return;
    log.tasks.push(createWorklogTask("A"));
    saveState();
    renderEntries();
  };
  list.appendChild(add);
  board.appendChild(list);
}

function renderFitnessTaskBoard(log) {
  const board = document.getElementById("fitnessTaskBoard");
  if (!board) return;
  board.innerHTML = "";
  const list = document.createElement("section");
  list.className = "worklog-task-list fitness-task-list";
  const visibleRefs = getVisibleWorklogTaskRefs(log, { view: "fitness-log", compactEditable: true });
  visibleRefs.forEach((ref) => {
    list.appendChild(renderWorklogTaskRow(ref, log, { view: "fitness-log" }));
  });
  board.appendChild(list);
}

function ensureFitnessTaskRowsVisible(log) {
  const board = document.getElementById("fitnessTaskBoard");
  const list = board?.querySelector(".fitness-task-list");
  if (!list) return;
  const refs = getWorklogTaskRefs(log);
  if (canAccessWorklogOverview() && !canEditCurrentWorklog("fitness-log")) return;
  const currentCount = list.querySelectorAll(".worklog-task-row").length;
  const activeCount = refs.filter((ref) => isActiveTask(ref.task)).length;
  const targetCount = Math.min(refs.length, Math.max(3, activeCount + 1));
  if (targetCount <= currentCount) return;
  refs.slice(currentCount, targetCount).forEach((ref) => {
    list.appendChild(renderWorklogTaskRow(ref, log, { view: "fitness-log" }));
  });
}

function getVisibleWorklogTaskRefs(log, { view = activeView, compactEditable = false } = {}) {
  const refs = getWorklogTaskRefs(log);
  const activeRefs = refs.filter((ref) => isActiveTask(ref.task));
  if (!canEditCurrentWorklog(view)) {
    const blankRefs = refs.filter((ref) => !isActiveTask(ref.task)).slice(0, Math.max(0, 3 - activeRefs.length));
    const visible = new Set([...activeRefs, ...blankRefs]);
    return refs.filter((ref) => visible.has(ref));
  }
  if (!compactEditable) return refs;
  const visibleCount = Math.min(refs.length, Math.max(3, activeRefs.length + 1));
  return refs.slice(0, visibleCount);
}

function createWorklogTask(priority = "?") {
  return {
    id: crypto.randomUUID?.() || `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    priority,
    text: "",
    status: "미완료",
    done: false,
    delegate: "",
    postponeDate: "",
  };
}

function getWorklogTaskRefs(log) {
  const activeDateKey = getActiveDateKey();
  const employeeId = String(log?.employeeId || getEmployeeWorklogId(getSelectedEmployee()) || "").trim();
  const refs = (log.tasks || []).map((task, index) => ({
    task,
    index,
    log,
    sourceDateKey: activeDateKey,
    isCarryover: false,
    isPostponedFromOtherDate: false,
  }));
  Object.entries(state.employeeLogs || {})
    .filter(([dateKey]) => dateKey < activeDateKey)
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .forEach(([dateKey, logsByEmployee]) => {
      const sourceLog = logsByEmployee?.[employeeId];
      (sourceLog?.tasks || []).forEach((task, index) => {
        task.id ||= `task-${dateKey}-${index}`;
        const deletedFrom = String(task.carryoverDeletedFrom || "");
        const rolloverDate = getWorklogTaskRolloverDate(task, dateKey);
        const isPostponedHere = task.status === "연기"
          && task.postponeDate === activeDateKey
          && hasWorklogCarryoverDateArrived(activeDateKey);
        const isOpenCarryover = Boolean(
          isWorklogTaskDueForDate(task, dateKey, activeDateKey)
          && (!deletedFrom || deletedFrom > activeDateKey)
        );
        if (isOpenCarryover || isPostponedHere) {
          refs.push({
            task,
            index,
            log: sourceLog,
            sourceDateKey: dateKey,
            isCarryover: isOpenCarryover,
            isPostponedFromOtherDate: task.status === "연기" && rolloverDate <= activeDateKey,
          });
        }
      });
    });
  return refs
    .sort((a, b) => {
      const activeA = isActiveTask(a.task);
      const activeB = isActiveTask(b.task);
      const orderA = getPrioritySortValue(a.task.priority);
      const orderB = getPrioritySortValue(b.task.priority);
      return Number(activeB) - Number(activeA) || orderA - orderB || a.index - b.index;
    });
}

function getWorklogCarryoverForkKey(ref = {}) {
  return `${ref.sourceDateKey || "unknown"}:${ref.task?.id || ref.index || "task"}`;
}

function materializeWorklogCarryover(ref, currentLog) {
  if (!ref?.isCarryover && !ref?.isPostponedFromOtherDate) return ref;
  const forkKey = getWorklogCarryoverForkKey(ref);
  let targetIndex = (currentLog.tasks || []).findIndex((task) => task.carryoverForkFrom === forkKey);
  if (targetIndex < 0) {
    const targetTask = {
      ...cloneWorklogLogForAudit(ref.task),
      id: crypto.randomUUID?.() || `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      done: false,
      carryoverDeletedFrom: "",
      carryoverForkFrom: forkKey,
      carryoverSourceDate: ref.sourceDateKey,
    };
    if (ref.isPostponedFromOtherDate) {
      targetTask.status = "미완료";
      targetTask.done = false;
      targetTask.postponeDate = "";
    }
    const blankIndex = (currentLog.tasks || []).findIndex((task) => !isActiveTask(task));
    if (blankIndex >= 0) {
      currentLog.tasks[blankIndex] = targetTask;
      targetIndex = blankIndex;
    } else {
      currentLog.tasks.push(targetTask);
      targetIndex = currentLog.tasks.length - 1;
    }
  }
  ref.task.carryoverDeletedFrom = getActiveDateKey();
  return {
    task: currentLog.tasks[targetIndex],
    index: targetIndex,
    log: currentLog,
    sourceDateKey: getActiveDateKey(),
    isCarryover: false,
    isPostponedFromOtherDate: false,
  };
}

function isActiveTask(task) {
  return Boolean(task.text?.trim() || task.done || !["예정", "미완료"].includes(task.status || "미완료"));
}

function getPrioritySortValue(priority = "?") {
  return { A: 1, B: 2, C: 3, "?": 4, 연기: 5, 취소: 6 }[priority] || 7;
}

function renderWorklogTaskRow(ref, currentLog, options = {}) {
  const { task, index, log, isCarryover, isPostponedFromOtherDate, sourceDateKey } = ref;
  const viewName = options.view || activeView;
  const displayTask = isPostponedFromOtherDate
    ? { ...task, status: "미완료", done: false, postponeDate: "" }
    : task;
  const row = document.createElement("div");
  const marker = getWorklogTaskMarker(displayTask);
  const statusClass = getWorklogTaskStatusClass(displayTask);
  row.className = `worklog-task-row task-row priority-${String(displayTask.priority || "?").toLowerCase()} marker-${marker} ${statusClass} ${displayTask.done ? "done" : ""} ${isCarryover ? "is-carryover" : ""} ${isPostponedFromOtherDate ? "is-postponed-in" : ""}`;
  row.innerHTML = `
    <button class="task-cycle" type="button" aria-label="상태 변경: 완료, 진행중, 해제 순환">${getWorklogTaskMarkerLabel(displayTask)}</button>
    <div class="task-status-cell">${renderTaskMetaControl(displayTask)}</div>
    <div class="task-text-cell">
      <input class="task-text-input" type="text" value="${escapeAttr(displayTask.text)}" placeholder="업무 내용" aria-label="주요업무" />
      ${renderTaskActionControl(displayTask)}
      ${renderWorklogTaskTags(getWorklogTaskTags(displayTask))}
      ${(isCarryover || isPostponedFromOtherDate) ? `<span class="task-origin-tag">${escapeHtml(formatShortDate(sourceDateKey))} 이월</span>` : ""}
    </div>
    <button class="task-delete" type="button" aria-label="업무 삭제">×</button>
  `;
  row.querySelector(".task-cycle").onclick = () => {
    if (!guardWorklogEdit(viewName)) return;
    const editableRef = materializeWorklogCarryover(ref, currentLog);
    cycleWorklogTaskStatus(editableRef.task);
    syncFitnessGuidanceFromTask(editableRef.task);
    syncWorklogTaskTimeHintToSchedule(editableRef.task, editableRef.log);
    saveState();
    renderEntries();
    showTaskStatusGuide(taskStatusGuideLabels[editableRef.task.status] || editableRef.task.status || "미완료");
  };
  bindTaskMetaControl(row, ref, currentLog, viewName);
  row.querySelector(".task-text-input").oninput = (event) => {
    if (!guardWorklogEdit(viewName)) return;
    const editableRef = materializeWorklogCarryover(ref, currentLog);
    editableRef.task.text = event.target.value;
    promptAttendanceBeforeWorklogInput(editableRef.log, editableRef.task.text);
    syncWorklogTaskTimeHintToSchedule(editableRef.task, editableRef.log);
    saveState({ fastSave: true });
    updateTaskRowTags(row, editableRef.task);
    renderWorklogSummary(currentLog);
    renderWorklogAppointments(currentLog);
    renderFitnessAppointments(currentLog);
    if (row.closest("#fitnessTaskBoard")) ensureFitnessTaskRowsVisible(currentLog);
    renderTodayContext();
    renderReport();
  };
  row.querySelector(".task-delete").onclick = () => {
    if (!guardWorklogEdit(viewName)) return;
    if (isCarryover || isPostponedFromOtherDate) {
      task.carryoverDeletedFrom = getActiveDateKey();
      saveState();
      renderEntries();
      return;
    }
    const beforeLog = cloneWorklogLogForAudit(log);
    const removedTask = { ...task };
    removeLinkedSchedule(task, log);
    log.tasks.splice(index, 1);
    resetFitnessGuidanceFromTask(removedTask);
    saveState();
    renderEntries();
    showUndoToast("업무 행을 삭제했습니다", () => {
      restoreObjectSnapshot(log, beforeLog);
      syncFitnessGuidanceFromTask(removedTask);
      saveState();
      renderEntries();
    });
  };
  return row;
}

function getWorklogTaskStatusClass(task) {
  if (task.done || task.status === "완료") return "status-complete";
  if (task.status === "위임") return "status-delegate";
  if (task.status === "연기") return "status-postpone";
  if (task.status === "취소") return "status-cancel";
  return "";
}

function renderTaskMetaControl(task) {
  const selectedValue = getPriorityValue(task);
  const actionClass = ["위임", "연기", "취소"].includes(selectedValue) ? " is-action" : "";
  return `
    <select class="priority-select${actionClass}" aria-label="중요도 및 처리">
      ${taskPriorityOptions.map((value) => `<option value="${escapeAttr(value)}" ${selectedValue === value ? "selected" : ""}>${value}</option>`).join("")}
    </select>
  `;
}

function renderTaskActionControl(task) {
  if (task.status === "위임") {
    return `<input class="delegate-input task-action-control" type="text" value="${escapeAttr(task.delegate || "")}" placeholder="위임자" aria-label="위임받은 사람" />`;
  }
  if (task.status === "연기") {
    const label = task.postponeDate ? formatShortDate(task.postponeDate) : "날짜";
    return `<button class="postpone-date-button task-action-control" type="button" aria-label="연기 날짜 선택">${escapeHtml(label)}</button>`;
  }
  return "";
}

function bindTaskMetaControl(row, ref, currentLog, viewName = activeView) {
  const task = ref.task;
  const delegateInput = row.querySelector(".delegate-input");
  if (delegateInput) {
    delegateInput.oninput = () => {
      if (!guardWorklogEdit(viewName)) return;
      const editableRef = materializeWorklogCarryover(ref, currentLog);
      editableRef.task.delegate = delegateInput.value;
      saveState({ fastSave: true });
    };
  }
  const postponeButton = row.querySelector(".postpone-date-button");
  if (postponeButton) {
    postponeButton.onclick = (event) => {
      event.stopPropagation();
      if (!guardWorklogEdit(viewName)) return;
      const editableRef = materializeWorklogCarryover(ref, currentLog);
      saveState({ fastSave: true });
      openPostponeCalendar(editableRef.task);
    };
  }
  const prioritySelect = row.querySelector(".priority-select");
  if (prioritySelect) {
    prioritySelect.onchange = (event) => {
      if (!guardWorklogEdit(viewName)) return;
      const editableRef = materializeWorklogCarryover(ref, currentLog);
      updateWorklogTaskPriority(editableRef.task, event.target.value);
      syncFitnessGuidanceFromTask(editableRef.task);
      syncWorklogTaskTimeHintToSchedule(editableRef.task, editableRef.log);
      saveState();
      renderEntries();
      showTaskStatusGuide(taskStatusGuideLabels[editableRef.task.status] || event.target.value);
    };
  }
}

function getPriorityValue(task) {
  if (["취소", "위임", "연기"].includes(task.status)) return task.status;
  return task.priority || "?";
}

function updateWorklogTaskPriority(task, value) {
  if (["취소", "위임", "연기"].includes(value)) {
    task.status = value;
    task.done = false;
    if (!["?", "A", "B", "C"].includes(task.priority)) task.priority = "?";
    if (value !== "위임") task.delegate = "";
    if (value !== "연기") task.postponeDate = "";
    return;
  }
  task.priority = value;
  if (["취소", "위임", "연기"].includes(task.status)) task.status = "미완료";
  task.delegate = "";
  task.postponeDate = "";
}

function getWorklogTaskMarker(task) {
  if (task.status === "완료" || task.done) return "check";
  if (task.status === "진행중" || task.status === "진행") return "dot";
  if (task.status === "위임") return "delegate";
  if (task.status === "연기") return "postpone";
  if (task.status === "취소") return "cancel";
  return "blank";
}

function getWorklogTaskMarkerLabel(task) {
  const marker = getWorklogTaskMarker(task);
  return { check: "v", dot: "·", delegate: "↗", postpone: "→", cancel: "×", blank: "" }[marker] || "";
}

function cycleWorklogTaskStatus(task) {
  normalizeWorklogTaskState(task);
  const current = task.done ? "완료" : task.status === "예정" ? "미완료" : task.status || "미완료";
  const next = taskStatusCycle[(taskStatusCycle.indexOf(current) + 1) % taskStatusCycle.length] || "미완료";
  task.status = next;
  task.done = next === "완료";
  if (next !== "위임") task.delegate = "";
  if (next !== "연기") task.postponeDate = "";
}

function showTaskStatusGuide(label) {
  let toast = document.getElementById("taskStatusGuide");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "taskStatusGuide";
    toast.className = "task-status-guide";
    document.body.appendChild(toast);
  }
  toast.textContent = label;
  toast.classList.remove("is-visible");
  void toast.offsetWidth;
  toast.classList.add("is-visible");
  window.setTimeout(() => toast.classList.remove("is-visible"), 900);
}

function getWorklogTaskTags(task) {
  const text = task.text || "";
  const tags = [];
  const add = (tag) => {
    if (!tags.includes(tag)) tags.push(tag);
  };
  if (task.financeItemId || /자금|입금|지출|카드|이자|정산|대금|money/i.test(text)) add("Money");
  if (task.projectTaskId || /프로젝트|현장|계약|공사|분양|임대|쇼룸|회원|시설/.test(text)) add("프로젝트");
  if (/목표|핵심|성장|개선|성과|매출|전환율/.test(text)) add("목표");
  if (/운동|건강|수면|회복|투약|검진|스트레칭|피트니스|pt/i.test(text)) add("건강");
  return tags.slice(0, 3);
}

function renderWorklogTaskTags(tags) {
  if (!tags.length) return "";
  return `<span class="task-link-tags">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</span>`;
}

function updateTaskRowTags(row, task) {
  const cell = row.querySelector(".task-text-cell");
  row.querySelector(".task-link-tags")?.remove();
  const tags = getWorklogTaskTags(task);
  if (!tags.length) return;
  const node = document.createElement("span");
  node.className = "task-link-tags";
  node.innerHTML = tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
  cell.appendChild(node);
}

function inferScheduleType(text = "") {
  if (/무료|체험|서비스|무상/.test(text) && /pt|p\/t|피티|수업|운동지도/i.test(text)) return "무료PT";
  if (/유료|정규|결제|pt|p\/t|피티|수업|운동지도/i.test(text)) return "유료PT";
  if (/센터관리|센타관리|기구|시설|냉난방|조명|청소|세탁|쓰레기|샤워실|탈의실|정리|위생/.test(text)) return "시설/청결";
  if (/상담|회원|고객|문의|재등록|민원/.test(text)) return "고객/상담";
  if (/영업|홍보|마케팅|아웃바운드|전화|콜|체험권|매출|결제/.test(text)) return "영업/홍보";
  if (/정산|보고|업무일지|서류|행정|인수인계/.test(text)) return "행정/정산";
  if (/오픈|마감/.test(text)) return "오픈/마감";
  if (/식사|휴식|대기/.test(text)) return "휴게";
  return "업무";
}

function normalizeScheduleType(type = "업무", text = "") {
  if (scheduleTypeOptions.includes(type)) return type;
  const aliases = {
    PT: "유료PT",
    "P/T": "유료PT",
    pt: "유료PT",
    피티: "유료PT",
    유료피티: "유료PT",
    유료PT: "유료PT",
    "유료P/T": "유료PT",
    무료피티: "무료PT",
    무료PT: "무료PT",
    "무료P/T": "무료PT",
    고객관리: "고객/상담",
    영업: "영업/홍보",
    홍보: "영업/홍보",
    마케팅: "영업/홍보",
    센터관리: "시설/청결",
    청결: "시설/청결",
    시설점검: "시설/청결",
    행정: "행정/정산",
    정산: "행정/정산",
    인수인계: "행정/정산",
    오픈마감: "오픈/마감",
  };
  return aliases[type] || inferScheduleType(text);
}

function normalizeScheduleEntryItems(entry) {
  entry.items = Array.isArray(entry.items) ? entry.items : null;
  if (!entry.items) {
    const text = String(entry.text || "").trim();
    entry.items = text ? [{ type: inferScheduleType(text), text }] : [{ type: "업무", text: "" }];
  }
  if (!entry.items.length) entry.items.push({ type: "업무", text: "" });
  entry.items.forEach((item) => {
    item.type = normalizeScheduleType(item.type, item.text);
    item.text ||= "";
  });
  syncScheduleEntryText(entry);
  return entry.items;
}

function getScheduleEntryText(entry) {
  const items = normalizeScheduleEntryItems(entry);
  const text = items
    .filter((item) => String(item.text || "").trim())
    .map((item) => formatScheduleItemWithType(item))
    .join(" / ");
  return formatScheduleTextSmartly(text);
}

function syncScheduleEntryText(entry) {
  const items = Array.isArray(entry.items) ? entry.items : [];
  const text = items
    .filter((item) => String(item.text || "").trim())
    .map((item) => formatScheduleItemWithType(item))
    .join(" / ");
  entry.text = formatScheduleTextSmartly(text);
}

function createScheduleItem(text = "", type = "") {
  return { type: type || inferScheduleType(text), text };
}

function formatScheduleTypeLabel(type = "업무") {
  const normalized = normalizeScheduleType(type);
  if (normalized === "무료PT") return "무료PT";
  if (normalized === "유료PT") return "유료PT";
  return normalized;
}

function formatScheduleItemInline(item) {
  const text = String(item?.text || "").trim();
  if (!text) return "";
  return formatScheduleTextSmartly(formatScheduleItemWithType(item));
}

function formatScheduleItemWithType(item) {
  const text = String(item?.text || "").trim();
  if (!text) return "";
  if (/^\([^)]+\)/.test(text)) return text;
  return `(${formatScheduleTypeLabel(item?.type || "업무")}) ${text}`;
}

function formatScheduleTextSmartly(value = "") {
  const sections = String(value || "")
    .split(/\s*\/\s*(?=\([^)]+\))/)
    .map((section) => section.trim())
    .filter(Boolean)
    .map((section) => {
      const match = section.match(/^\(([^)]+)\)\s*(.*)$/);
      const label = match?.[1]?.trim() || "";
      const text = String(match?.[2] ?? section)
        .trim()
        .replace(/(거울|유리|창문|매트)\s*닦기/g, "$1 닦기")
        .replace(/\s+/g, " ");
      return { label, text };
    });
  const grouped = [];
  sections.forEach((section) => {
    const previous = grouped.at(-1);
    if (previous && previous.label === section.label && section.label) previous.texts.push(section.text);
    else grouped.push({ label: section.label, texts: [section.text] });
  });
  return grouped
    .map(({ label, texts }) => `${label ? `(${label}) ` : ""}${texts.filter(Boolean).join(", ")}`.trim())
    .filter(Boolean)
    .join(" / ");
}

function renderScheduleTypeOptions(selected = "업무") {
  const normalizedSelected = normalizeScheduleType(selected);
  return scheduleTypeOptions.map((value) => `<option value="${escapeAttr(value)}" ${value === normalizedSelected ? "selected" : ""}>${escapeHtml(formatScheduleTypeLabel(value))}</option>`).join("");
}

function renderWorklogAppointments(log) {
  normalizeWorklogSchedule(log, getActiveDateKey());
  const list = document.getElementById("worklogAppointmentList");
  list.innerHTML = "";
  (log.schedule || []).forEach((entry, index) => {
    if (index > 0 && log.schedule[index - 1]?.mergeDown) return;
    list.appendChild(renderAppointmentRow(entry, log, "worklog"));
  });
}

function renderFitnessAppointments(log) {
  normalizeWorklogSchedule(log, getActiveDateKey());
  const list = document.getElementById("fitnessAppointmentList");
  if (!list) return;
  list.innerHTML = "";
  (log.schedule || []).forEach((entry, index) => {
    if (index > 0 && log.schedule[index - 1]?.mergeDown) return;
    list.appendChild(renderFitnessAppointmentRow(entry, log));
  });
}

function renderFitnessAppointmentRow(entry, log) {
  const items = normalizeScheduleEntryItems(entry);
  const filledItems = items.filter((item) => String(item.text || "").trim());
  const value = getScheduleEntryText(entry);
  const row = document.createElement("div");
  row.dataset.scheduleTime = entry.time;
  row.className = `appointment-row multi-appointment-row fitness-appointment-row ${value.trim() ? "is-filled" : ""} ${isCurrentScheduleSlot(entry, log) ? "is-current" : ""}`;
  row.innerHTML = `
    <span class="appointment-time">${escapeHtml(entry.time)}</span>
    <button class="fitness-appointment-summary" type="button" aria-label="${escapeAttr(entry.time)} 일정 편집">
      ${filledItems.length ? `<span>${escapeHtml(value)}</span>` : `<span class="empty">업무 추가</span>`}
    </button>
    <button class="appointment-merge-button" type="button" aria-label="${escapeAttr(entry.time)} 일정 추가">+</button>
  `;
  row.querySelector(".fitness-appointment-summary").onclick = () => openFitnessScheduleEditor(entry, log);
  row.querySelector(".appointment-merge-button").onclick = () => openFitnessScheduleEditor(entry, log);
  return row;
}

function renderAppointmentRow(entry, log, scope = "worklog") {
  const items = normalizeScheduleEntryItems(entry);
  const row = document.createElement("div");
  row.dataset.scheduleTime = entry.time;
  const value = getScheduleEntryText(entry);
  row.className = `appointment-row multi-appointment-row plain-appointment-row ${value.trim() ? "is-filled" : ""} ${isCurrentScheduleSlot(entry, log) ? "is-current" : ""}`;
  row.innerHTML = `
    <span class="appointment-time">${escapeHtml(entry.time)}</span>
    <div class="appointment-items">
      ${items.map((item, itemIndex) => `
        <div class="appointment-item" data-schedule-item-index="${itemIndex}">
          <input class="schedule-text-input" type="text" value="${escapeAttr(item.text)}" placeholder="일정" aria-label="${escapeAttr(entry.time)} 일정" />
          <button class="schedule-item-delete" type="button" aria-label="일정 삭제">×</button>
        </div>
      `).join("")}
    </div>
    <button class="appointment-merge-button" type="button" aria-label="${escapeAttr(entry.time)} 일정 추가">+</button>
  `;
  row.querySelectorAll(".appointment-item").forEach((itemRow) => {
    const itemIndex = Number(itemRow.dataset.scheduleItemIndex);
    const item = items[itemIndex];
    const text = itemRow.querySelector(".schedule-text-input");
    const remove = itemRow.querySelector(".schedule-item-delete");
    text.oninput = () => {
      if (!guardWorklogEdit()) return;
      item.text = text.value;
      promptAttendanceBeforeWorklogInput(log, item.text);
      if (item.type === "업무") item.type = inferScheduleType(text.value);
      syncScheduleEntryText(entry);
      saveState({ fastSave: true });
      renderWorklogSummary(log);
      renderReport();
      if (scope === "worklog") renderFitnessAppointments(log);
      else renderWorklogAppointments(log);
    };
    remove.onclick = () => {
      if (!guardWorklogEdit()) return;
      const beforeLog = cloneWorklogLogForAudit(log);
      items.splice(itemIndex, 1);
      if (!items.length) items.push(createScheduleItem());
      syncScheduleEntryText(entry);
      saveState();
      renderWorklogAppointments(log);
      renderFitnessAppointments(log);
      renderReport();
      showUndoToast("시간별 일정을 삭제했습니다", () => {
        restoreObjectSnapshot(log, beforeLog);
        saveState();
        renderWorklogAppointments(log);
        renderFitnessAppointments(log);
        renderReport();
      });
    };
  });
  row.querySelector(".appointment-merge-button").onclick = () => {
    if (!guardWorklogEdit()) return;
    items.push(createScheduleItem());
    syncScheduleEntryText(entry);
    saveState();
    renderWorklogAppointments(log);
    renderFitnessAppointments(log);
  };
  return row;
}

function getOrCreateFitnessScheduleEditor() {
  let backdrop = document.getElementById("fitnessScheduleEditorBackdrop");
  let editor = document.getElementById("fitnessScheduleEditor");
  if (backdrop && editor) return { backdrop, editor };

  backdrop = document.createElement("div");
  backdrop.id = "fitnessScheduleEditorBackdrop";
  backdrop.className = "fitness-schedule-editor-backdrop";
  backdrop.hidden = true;

  editor = document.createElement("section");
  editor.id = "fitnessScheduleEditor";
  editor.className = "fitness-schedule-editor";
  editor.hidden = true;
  editor.setAttribute("role", "dialog");
  editor.setAttribute("aria-modal", "true");
  editor.setAttribute("aria-label", "피트니스 시간별 일정 입력");
  editor.innerHTML = `
    <header class="fitness-schedule-editor-header">
      <div>
        <strong id="fitnessScheduleEditorTime">--:--</strong>
        <span>시간별 일정</span>
      </div>
      <button type="button" id="fitnessScheduleEditorClose" aria-label="닫기">×</button>
    </header>
    <div class="fitness-schedule-existing" id="fitnessScheduleExisting"></div>
    <div class="fitness-schedule-type-grid" id="fitnessScheduleTypeGrid" aria-label="업무종류 선택"></div>
    <label class="fitness-schedule-input-wrap">
      <span id="fitnessScheduleSelectedLabel">업무종류 선택</span>
      <input id="fitnessScheduleEditorText" type="text" placeholder="구체적인 업무 내용" autocomplete="off" />
    </label>
    <footer class="fitness-schedule-editor-actions">
      <button type="button" id="fitnessScheduleEditorAdd">입력</button>
      <button type="button" id="fitnessScheduleEditorDone">확인</button>
    </footer>
  `;

  document.body.append(backdrop, editor);
  backdrop.onclick = closeFitnessScheduleEditor;
  editor.querySelector("#fitnessScheduleEditorClose").onclick = closeFitnessScheduleEditor;
  editor.querySelector("#fitnessScheduleEditorAdd").onclick = () => addFitnessScheduleEditorItem({ close: false });
  editor.querySelector("#fitnessScheduleEditorDone").onclick = () => addFitnessScheduleEditorItem({ close: true });
  editor.querySelector("#fitnessScheduleEditorText").onkeydown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addFitnessScheduleEditorItem({ close: false });
    }
    if (event.key === "Escape") closeFitnessScheduleEditor();
  };
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && fitnessScheduleEditorState) closeFitnessScheduleEditor();
  });
  return { backdrop, editor };
}

function openFitnessScheduleEditor(entry, log) {
  if (!canEditCurrentWorklog("fitness-log")) {
    guardWorklogEdit("fitness-log");
    return;
  }
  normalizeScheduleEntryItems(entry);
  fitnessScheduleEditorState = {
    entry,
    log,
    selectedType: "",
  };
  const { backdrop, editor } = getOrCreateFitnessScheduleEditor();
  renderFitnessScheduleEditor();
  backdrop.hidden = false;
  editor.hidden = false;
  requestAnimationFrame(() => editor.classList.add("is-open"));
}

function renderFitnessScheduleEditor() {
  if (!fitnessScheduleEditorState) return;
  const { editor } = getOrCreateFitnessScheduleEditor();
  const { entry, selectedType } = fitnessScheduleEditorState;
  const items = normalizeScheduleEntryItems(entry);
  const existing = editor.querySelector("#fitnessScheduleExisting");
  const typeGrid = editor.querySelector("#fitnessScheduleTypeGrid");
  const label = editor.querySelector("#fitnessScheduleSelectedLabel");
  const time = editor.querySelector("#fitnessScheduleEditorTime");
  const input = editor.querySelector("#fitnessScheduleEditorText");

  time.textContent = entry.time || "--:--";
  const filledItems = items
    .map((item, itemIndex) => ({ item, itemIndex }))
    .filter(({ item }) => String(item.text || "").trim());
  existing.innerHTML = filledItems.length
    ? filledItems.map(({ item, itemIndex }) => `
      <button class="fitness-schedule-chip" type="button" data-remove-schedule-item="${itemIndex}" aria-label="일정 삭제">
        <span>${escapeHtml(formatScheduleItemInline(item))}</span>
        <b>×</b>
      </button>
    `).join("")
    : `<p>이 시간대에 등록된 업무가 없습니다.</p>`;

  existing.querySelectorAll("[data-remove-schedule-item]").forEach((button) => {
    button.onclick = () => {
      const editorLog = fitnessScheduleEditorState.log;
      const beforeLog = cloneWorklogLogForAudit(editorLog);
      const index = Number(button.dataset.removeScheduleItem);
      items.splice(index, 1);
      if (!items.length) items.push(createScheduleItem());
      syncScheduleEntryText(entry);
      saveState();
      rerenderScheduleAfterFitnessEdit(editorLog);
      renderFitnessScheduleEditor();
      showUndoToast("시간별 일정을 삭제했습니다", () => {
        restoreObjectSnapshot(editorLog, beforeLog);
        saveState();
        rerenderScheduleAfterFitnessEdit(editorLog);
        if (fitnessScheduleEditorState?.log === editorLog) renderFitnessScheduleEditor();
      });
    };
  });

  typeGrid.innerHTML = scheduleTypeOptions.map((type) => `
    <button class="${type === selectedType ? "is-selected" : ""}" type="button" data-fitness-schedule-type="${escapeAttr(type)}">
      ${escapeHtml(formatScheduleTypeLabel(type))}
    </button>
  `).join("");
  typeGrid.querySelectorAll("[data-fitness-schedule-type]").forEach((button) => {
    button.onclick = () => {
      fitnessScheduleEditorState.selectedType = button.dataset.fitnessScheduleType || "업무";
      renderFitnessScheduleEditor();
      editor.querySelector("#fitnessScheduleEditorText").focus();
    };
  });
  label.textContent = selectedType ? `(${formatScheduleTypeLabel(selectedType)})` : "업무종류 선택";
  input.disabled = !selectedType;
  input.placeholder = selectedType ? "구체적인 업무 내용" : "먼저 업무종류를 선택하세요";
}

function addFitnessScheduleEditorItem({ close = false } = {}) {
  if (!canEditCurrentWorklog("fitness-log")) {
    guardWorklogEdit("fitness-log");
    return;
  }
  if (!fitnessScheduleEditorState) return;
  const { editor } = getOrCreateFitnessScheduleEditor();
  const { entry, log } = fitnessScheduleEditorState;
  const input = editor.querySelector("#fitnessScheduleEditorText");
  const selectedType = fitnessScheduleEditorState.selectedType || "업무";
  const text = String(input.value || "").trim();

  if (text) {
    promptAttendanceBeforeWorklogInput(log, text);
    const items = normalizeScheduleEntryItems(entry);
    if (items.length === 1 && !String(items[0].text || "").trim()) items.splice(0, 1);
    items.push(createScheduleItem(text, selectedType));
    syncScheduleEntryText(entry);
    saveState({ fastSave: true });
    rerenderScheduleAfterFitnessEdit(log);
  }

  input.value = "";
  fitnessScheduleEditorState.selectedType = "";
  if (close) {
    closeFitnessScheduleEditor();
    return;
  }
  renderFitnessScheduleEditor();
}

function closeFitnessScheduleEditor() {
  const backdrop = document.getElementById("fitnessScheduleEditorBackdrop");
  const editor = document.getElementById("fitnessScheduleEditor");
  if (editor) {
    editor.classList.remove("is-open");
    editor.querySelector("#fitnessScheduleEditorText")?.blur();
  }
  if (backdrop) backdrop.hidden = true;
  if (editor) editor.hidden = true;
  fitnessScheduleEditorState = null;
}

function rerenderScheduleAfterFitnessEdit(log) {
  syncFitnessOpsFromSchedule(log);
  saveState({ fastSave: true });
  renderWorklogSummary(log);
  renderWorklogAppointments(log);
  renderFitnessAppointments(log);
  renderFitnessOperations(log);
  renderFitnessDashboard();
  renderTodayContext();
  renderReport();
}

function updateEntry(index, field, value) {
  getSelectedLog().schedule[index][field] = value;
  saveState();
  renderTodayContext();
  renderReport();
}

function addEntry() {
  const emptySlot = getSelectedLog().schedule.find((entry) => !getScheduleEntryText(entry));
  if (emptySlot) {
    saveState();
    renderEntries();
  }
}

function addTask(priority, shouldRender = true) {
  const task = createWorklogTask(priority);
  getSelectedLog().tasks.push(task);
  saveState();
  if (shouldRender) renderEntries();
  return task;
}

function updateTask(index, field, value) {
  const task = getSelectedLog().tasks[index];
  task[field] = value;
  if (field === "done") task.status = value ? "완료" : "진행";
  syncWorklogTaskTimeHintToSchedule(task, getSelectedLog());
  saveState();
  renderTodayContext();
  renderReport();
  if (["done", "priority"].includes(field)) renderEntries();
}

function clearTask(index) {
  const task = getSelectedLog().tasks[index];
  removeLinkedSchedule(task, getSelectedLog());
  task.text = "";
  task.status = "예정";
  task.done = false;
  if (index > 1) task.priority = "?";
  saveState();
  renderEntries();
  renderTodayContext();
  renderReport();
}

function extractWorklogTaskTimeHint(text = "") {
  const source = String(text || "");
  const match = source.match(/(오전|오후)\s*(\d{1,2})(?::([0-5]\d)|시\s*([0-5]\d)?)?|(?:^|[^\d])(\d{1,2}):([0-5]\d)|(?:^|[^\d])(\d{1,2})시\s*([0-5]\d)?/);
  if (!match) return null;
  const meridiem = match[1] || "";
  let hour = Number(match[2] || match[5] || match[7]);
  const minute = Number(match[3] || match[4] || match[6] || match[8] || "00");
  if (meridiem === "오후" && hour < 12) hour += 12;
  if (meridiem === "오전" && hour === 12) hour = 0;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  const slot = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const scheduleText = source.replace(match[0], " ").replace(/\s{2,}/g, " ").trim();
  return { slot, text: scheduleText };
}

function syncWorklogTaskTimeHintToSchedule(task, log) {
  log.autoTaskScheduleLinks ||= {};
  const linkId = `task:${task.id || task.text}`;
  const existing = log.autoTaskScheduleLinks[linkId];
  if (["취소", "연기", "위임"].includes(task.status) || ["취소", "연기"].includes(task.priority)) {
    removeLinkedSchedule(task, log);
    return;
  }
  const hint = extractWorklogTaskTimeHint(task.text);
  if (!hint || !hint.text) return;
  if (existing && existing.slot !== hint.slot) {
    const previous = findScheduleEntry(log, existing.slot);
    if (previous) {
      normalizeScheduleEntryItems(previous);
      previous.items = previous.items.filter((item) => item.text !== existing.text);
      if (!previous.items.length) previous.items.push(createScheduleItem());
      syncScheduleEntryText(previous);
    }
  }
  const entry = ensureWorklogAppointmentSlot(log, hint.slot);
  normalizeScheduleEntryItems(entry);
  if (existing?.slot === hint.slot && getScheduleEntryText(entry).includes(existing.text)) {
    const linkedItem = entry.items.find((item) => item.text === existing.text);
    if (linkedItem) {
      linkedItem.text = hint.text;
      linkedItem.type = inferScheduleType(hint.text);
    }
    syncScheduleEntryText(entry);
    log.autoTaskScheduleLinks[linkId] = { type: "task", slot: hint.slot, text: hint.text };
    normalizeWorklogSchedule(log);
    return;
  }
  const current = getScheduleEntryText(entry);
  if (!current) {
    entry.items = [createScheduleItem(hint.text)];
  } else if (!current.includes(hint.text)) {
    entry.items.push(createScheduleItem(hint.text));
  }
  syncScheduleEntryText(entry);
  log.autoTaskScheduleLinks[linkId] = { type: "task", slot: hint.slot, text: hint.text };
  normalizeWorklogSchedule(log);
}

function removeLinkedSchedule(task, log) {
  log.autoTaskScheduleLinks ||= {};
  const linkId = `task:${task.id || task.text}`;
  const existing = log.autoTaskScheduleLinks[linkId];
  if (!existing) return;
  const entry = findScheduleEntry(log, existing.slot);
  if (entry) {
    normalizeScheduleEntryItems(entry);
    entry.items = entry.items.filter((item) => item.text !== existing.text);
    if (!entry.items.length) entry.items.push(createScheduleItem());
    syncScheduleEntryText(entry);
  }
  delete log.autoTaskScheduleLinks[linkId];
}

function ensureWorklogAppointmentSlot(log, slot) {
  log.schedule ||= [];
  let entry = findScheduleEntry(log, slot);
  if (!entry) {
    entry = { time: slot, text: "", status: "예정", mergeDown: false, items: [createScheduleItem()] };
    log.schedule.push(entry);
  }
  normalizeWorklogSchedule(log);
  return findScheduleEntry(log, slot);
}

function findScheduleEntry(log, slot) {
  return (log.schedule || []).find((entry) => entry.time === slot);
}

function normalizeWorklogSchedule(log, dateKey = getActiveDateKey()) {
  const byTime = new Map((log.schedule || []).map((entry) => [entry.time, entry]));
  log.manualScheduleSlots = Array.isArray(log.manualScheduleSlots)
    ? Array.from(new Set(log.manualScheduleSlots.map(normalizeScheduleTimeInput).filter(Boolean))).sort((a, b) => timeToMinutes(a) - timeToMinutes(b))
    : [];
  log.schedule = getWorklogScheduleSlots(log, dateKey).map((time) => {
    const entry = byTime.get(time) || { time, text: "", status: "예정", mergeDown: false, items: [createScheduleItem()] };
    entry.time = time;
    normalizeScheduleEntryItems(entry);
    entry.status ||= "예정";
    entry.mergeDown ||= false;
    return entry;
  });
}

function getWorklogScheduleSlots(log, dateKey = getActiveDateKey()) {
  const unit = log?.scheduleUnit === "60" ? 60 : 30;
  const workHours = getEmployeeWorkHours(log?.employeeId, state?.profile, dateKey);
  const baseTimes = getScheduleTimes(workHours);
  const manualTimes = (Array.isArray(log?.manualScheduleSlots) ? log.manualScheduleSlots : [])
    .map(normalizeScheduleTimeInput)
    .filter(Boolean);
  const scheduleTimes = (log?.schedule || [])
    .filter((entry) => getScheduleEntryText(entry))
    .map((entry) => entry.time)
    .filter(Boolean);
  const taskTimes = (log?.tasks || []).map((task) => extractWorklogTaskTimeHint(task.text)?.slot).filter(Boolean);
  const baseSlots = [];
  let start = Infinity;
  let end = -Infinity;
  baseTimes.forEach((time) => {
    const minutes = timeToMinutes(time);
    if (!Number.isFinite(minutes)) return;
    start = Math.min(start, Math.floor(minutes / unit) * unit);
    end = Math.max(end, Math.floor(minutes / unit) * unit);
  });
  if (Number.isFinite(start) && Number.isFinite(end)) {
    for (let minute = start; minute <= end; minute += unit) {
      baseSlots.push(minutesToTime(minute));
    }
  }
  const supplementalTimes = [...manualTimes, ...scheduleTimes, ...taskTimes];
  const fallbackTimes = !baseSlots.length && !supplementalTimes.length && !isOffWorkHours(workHours)
    ? getScheduleTimes(defaultProfile.workHours)
    : [];
  return [...new Set([...baseSlots, ...supplementalTimes, ...fallbackTimes])]
    .filter(Boolean)
    .sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
}

function timeToMinutes(value) {
  const [hour, minute] = String(value || "00:00").split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return NaN;
  return hour * 60 + minute;
}

function minutesToTime(minutes) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function isCurrentScheduleSlot(entry, log) {
  if (getActiveDateKey() !== todayKey) return false;
  const unit = log.scheduleUnit === "60" ? 60 : 30;
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  const start = timeToMinutes(entry.time);
  return current >= start && current < start + unit;
}

function getNextScheduleEntry(log) {
  const now = new Date();
  const current = getActiveDateKey() === todayKey ? now.getHours() * 60 + now.getMinutes() : 0;
  return (log.schedule || [])
    .filter((entry) => getScheduleEntryText(entry) && timeToMinutes(entry.time) >= current)
    .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time))[0];
}

function renderEmployeeDetailFields() {
  const log = getSelectedLog();
  document.getElementById("employeeReport").value = log.report || "";
  document.getElementById("employeeMemo").value = log.memo || "";
  renderFitnessOperations(log);
}

function renderFitnessOperations(log = getSelectedLog()) {
  syncFitnessOpsFromSchedule(log);
  log.fitnessOps = { ...createFitnessOps(), ...(log.fitnessOps || {}) };
  document.querySelectorAll("[data-fitness-field]").forEach((field) => {
    field.value = log.fitnessOps[field.dataset.fitnessField] || "";
  });
  renderFitnessOpsSummaryButton(log);
}

function renderFitnessOpsSummaryButton(log = getSelectedLog()) {
  const button = document.getElementById("fitnessOpsSummaryButton");
  if (!button) return;
  const ops = { ...createFitnessOps(), ...(log.fitnessOps || {}) };
  const paidPtTotal = numberValue(ops.ptRegular) + numberValue(ops.ptOther);
  const freePtTotal = numberValue(ops.ptFree);
  const contractTotal = ["customerNew", "customerRenewal", "dayPass"].reduce((sum, key) => sum + numberValue(ops[key]), 0);
  const marketingTotal = ["outbound", "outsideSales"].reduce((sum, key) => sum + numberValue(ops[key]), 0);
  const page = getCurrentFitnessLogPage();
  const employee = page?.type === "employee" ? page.employee : findEmployeeRecordById(log.employeeId);
  const aggregate = employee ? buildFitnessCenterEmployeeMonthRow(employee, getActiveDateKey().slice(0, 7)) : null;
  const monthOps = { ...createFitnessOps(), ...(aggregate?.ops || {}) };
  const monthlyPaidPtTotal = numberValue(aggregate?.paidPtTotal) + numberValue(monthOps.ptOther);
  const monthlyFreePtTotal = numberValue(aggregate?.freePtTotal);
  const monthlyConsultationTotal = numberValue(monthOps.consultation);
  const monthlyContractTotal = ["customerNew", "customerRenewal", "dayPass"].reduce((sum, key) => sum + numberValue(monthOps[key]), 0);
  const memoState = ops.shiftNote || ops.specialReport ? "메모 있음" : "메모 없음";
  button.classList.toggle("has-memo", Boolean(ops.shiftNote || ops.specialReport));
  button.innerHTML = `
    <span class="ops-summary-title">업무요약</span>
    <span class="ops-summary-metric"><b>유료PT</b><strong>${paidPtTotal}/${monthlyPaidPtTotal}</strong></span>
    <span class="ops-summary-metric"><b>무료PT</b><strong>${freePtTotal}/${monthlyFreePtTotal}</strong></span>
    <span class="ops-summary-metric"><b>상담</b><strong>${numberValue(ops.consultation)}/${monthlyConsultationTotal}</strong></span>
    <span class="ops-summary-metric"><b>계약</b><strong>${contractTotal}/${monthlyContractTotal}</strong></span>
  `;
  button.setAttribute("aria-label", `업무요약. 오늘/월 누계 기준. 유료 PT ${paidPtTotal}/${monthlyPaidPtTotal}건, 무료 PT ${freePtTotal}/${monthlyFreePtTotal}건, 상담 ${numberValue(ops.consultation)}/${monthlyConsultationTotal}건, 계약 ${contractTotal}/${monthlyContractTotal}건, 홍보 마케팅 오늘 ${marketingTotal}건, ${memoState}`);
}

function syncFitnessOpsFromSchedule(log = getSelectedLog()) {
  if (!log) return;
  log.fitnessOps = { ...createFitnessOps(), ...(log.fitnessOps || {}) };
  log.fitnessOpsManual = { ...createFitnessOpsManual(), ...(log.fitnessOpsManual || {}) };
  const autoOps = collectFitnessOpsFromSchedule(log);
  Object.entries(autoOps).forEach(([key, value]) => {
    if (log.fitnessOpsManual[key]) return;
    log.fitnessOps[key] = value ? String(value) : "";
  });
}

function collectFitnessOpsFromSchedule(log = getSelectedLog()) {
  const totals = {
    ptRegular: 0,
    ptFree: 0,
    ptOther: 0,
    customerNew: 0,
    customerRenewal: 0,
    dayPass: 0,
    consultation: 0,
    inbound: 0,
    outbound: 0,
    outsideSales: 0,
  };
  (log.schedule || []).forEach((entry) => {
    normalizeScheduleEntryItems(entry).forEach((item) => {
      const text = String(item.text || "").trim();
      if (!text) return;
      applyFitnessOpsItemCount(totals, item.type || inferScheduleType(text), text);
    });
  });
  return totals;
}

function applyFitnessOpsItemCount(totals, type = "업무", text = "") {
  const normalizedType = normalizeScheduleType(type, text);
  const source = `${normalizedType} ${text}`;
  const count = countFitnessScheduleUnits(text);
  if (normalizedType === "무료PT" || normalizedType === "유료PT" || /pt|p\/t|피티|수업|운동지도/i.test(source)) {
    if (normalizedType === "무료PT" || /무료|체험|서비스|무상/.test(source)) totals.ptFree += count;
    else if (/기타|보강|대체/.test(source)) totals.ptOther += count;
    else totals.ptRegular += count;
  }
  if (/신규|신입|첫등록|등록상담/.test(source)) totals.customerNew += count;
  if (/재등록|재가입|연장|갱신/.test(source)) totals.customerRenewal += count;
  if (/일일권|1일권|데이패스|day\s*pass/i.test(source)) totals.dayPass += count;
  if (normalizedType === "고객/상담" || /상담|문의|회원관리|고객관리|인바운드/.test(source)) {
    if (/인바운드|문의|방문|walk[-\s]?in/i.test(source)) totals.inbound += count;
    if (/상담|등록상담/.test(source)) totals.consultation += count;
  }
  if (normalizedType === "영업/홍보" || /아웃바운드|전화|콜|문자|디엠|dm|영업/i.test(source)) {
    if (/외부영업|방문영업|외근|현장영업/.test(source)) totals.outsideSales += count;
    else totals.outbound += count;
  }
  if (/외부영업|방문영업|외근|현장영업/.test(source) && normalizedType !== "영업/홍보") totals.outsideSales += count;
}

function countFitnessScheduleUnits(text = "") {
  const cleaned = String(text || "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(상담|청소|점검|마감|오픈|관리|전화|문자|콜|수업|pt|p\/t)\b/gi, " ")
    .trim();
  const parts = cleaned
    .split(/[,，、/·&+]|(?:\s+및\s+)|(?:\s+그리고\s+)/)
    .map((part) => part.trim())
    .filter(Boolean);
  return Math.max(1, parts.length || 1);
}

function formatFitnessOpsReport(fitnessOps = createFitnessOps()) {
  const ops = { ...createFitnessOps(), ...(fitnessOps || {}) };
  const ptTotal = ["ptRegular", "ptFree", "ptOther"].reduce((sum, key) => sum + Number(ops[key] || 0), 0);
  const contractTotal = ["customerNew", "customerRenewal", "dayPass"].reduce((sum, key) => sum + Number(ops[key] || 0), 0);
  const marketingTotal = ["outbound", "outsideSales"].reduce((sum, key) => sum + Number(ops[key] || 0), 0);
  return [
    `수업현황: 정규 ${ops.ptRegular || 0}, 체험/무료 ${ops.ptFree || 0}, 보강/기타 ${ops.ptOther || 0}, 합계 ${ptTotal}`,
    `상담/계약: 상담 ${ops.consultation || 0}, 신규 ${ops.customerNew || 0}, 재등록 ${ops.customerRenewal || 0}, 일일권 ${ops.dayPass || 0}, 합계 ${contractTotal}`,
    `고객유입: 인바운드 ${ops.inbound || 0}, 아웃바운드 ${ops.outbound || 0}, 외부영업 ${ops.outsideSales || 0}, 합계 ${marketingTotal + Number(ops.inbound || 0)}`,
    `업무 메모: ${ops.shiftNote || "-"}`,
    `특이사항 보고: ${ops.specialReport || "-"}`,
  ];
}

function renderClockPanel() {
  const log = getSelectedLog();
  const clockIn = document.getElementById("clockInTime");
  const clockOut = document.getElementById("clockOutTime");
  if (clockIn) clockIn.value = log.clockIn || "";
  if (clockOut) clockOut.value = log.clockOut || "";
  const button = document.getElementById("attendanceCycleButton");
  if (button) button.textContent = getNextAttendanceAction(log);
  renderGlobalAttendanceSummary();
}

function openAttendancePopover(action = attendancePopoverAction) {
  if (!canEditCurrentWorklog()) {
    closeAttendancePopover();
    showAppToast("열람 전용 업무일지입니다");
    return;
  }
  setupAttendancePopover();
  closeMainMenuPopover();
  attendancePopoverAction = attendanceActions.includes(action) ? action : "출근";
  const popover = document.getElementById("attendancePopover");
  const button = document.getElementById("globalAttendanceButton");
  if (!popover) return;
  popover.hidden = false;
  button?.setAttribute("aria-expanded", "true");
  renderAttendancePopover();
}

function closeAttendancePopover() {
  const popover = document.getElementById("attendancePopover");
  const button = document.getElementById("globalAttendanceButton");
  if (!popover || popover.hidden) return;
  popover.hidden = true;
  button?.setAttribute("aria-expanded", "false");
}

function renderAttendancePopover() {
  if (!canEditCurrentWorklog()) return;
  const employee = getAttendanceEmployeeForView();
  const log = getEmployeeLogForDate(employee.id);
  const title = document.getElementById("attendancePopoverTitle");
  const primaryLabel = document.getElementById("attendancePrimaryTimeLabel");
  const primary = document.getElementById("attendancePrimaryTimeSelect");
  const secondary = document.getElementById("attendanceSecondaryTimeSelect");
  const secondaryField = document.getElementById("attendanceSecondaryTimeField");
  document.querySelectorAll("[data-attendance-action]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.attendanceAction === attendancePopoverAction);
  });
  if (title) title.textContent = `${attendancePopoverAction} 시간`;
  if (primaryLabel) primaryLabel.textContent = attendancePopoverAction === "외출" ? "외출" : "시간";
  const now = roundTimeToFiveMinutes();
  if (primary) {
    const saved = attendancePopoverAction === "출근" ? log.clockIn : attendancePopoverAction === "퇴근" || attendancePopoverAction === "조퇴" ? log.clockOut : log.attendanceBreaks?.at(-1)?.start;
    primary.value = saved || now;
  }
  if (secondaryField) secondaryField.hidden = attendancePopoverAction !== "외출";
  if (secondary) secondary.value = log.attendanceBreaks?.at(-1)?.end || now;
}

function applyAttendancePopoverSelection() {
  if (!canEditCurrentWorklog()) {
    closeAttendancePopover();
    showAppToast("열람 전용 업무일지입니다");
    return;
  }
  const employee = getAttendanceEmployeeForView();
  const log = getEmployeeLogForDate(employee.id);
  const primary = document.getElementById("attendancePrimaryTimeSelect")?.value || roundTimeToFiveMinutes();
  const secondary = document.getElementById("attendanceSecondaryTimeSelect")?.value || "";
  if (attendancePopoverAction === "출근") {
    log.clockIn = primary;
    log.attendanceStatus = "출근";
    log.attendanceStep = "in";
  } else if (attendancePopoverAction === "퇴근") {
    log.clockOut = primary;
    log.attendanceStatus = "퇴근";
    log.attendanceStep = "out";
  } else if (attendancePopoverAction === "조퇴") {
    log.clockOut = primary;
    log.attendanceStatus = "조퇴";
    log.attendanceStep = "early";
  } else {
    log.attendanceBreaks ||= [];
    log.attendanceBreaks.push({ type: "외출", start: primary, end: secondary });
    log.attendanceStatus = "외출";
  }
  syncAttendanceRecordFromLog(employee, log);
  saveState();
  renderAll();
  closeAttendancePopover();
  showAppToast(`${attendancePopoverAction} ${primary} 기록`);
}

function getNextAttendanceAction(log = getSelectedLog()) {
  if (!log.clockIn || log.attendanceStep === "ready") return "출근";
  if (!log.clockOut || log.attendanceStep === "in") return "퇴근";
  if (log.attendanceStep === "out") return "조퇴";
  return "출근";
}

function applyAttendanceCycle() {
  if (!canEditCurrentWorklog()) {
    showAppToast("열람 전용 업무일지입니다");
    return;
  }
  const log = getSelectedLog();
  const action = getNextAttendanceAction(log);
  const now = currentTimeValue();
  if (action === "출근") {
    log.clockIn = now;
    log.clockOut = "";
    log.attendanceStatus = "출근";
    log.attendanceStep = "in";
  } else if (action === "퇴근") {
    log.clockOut = now;
    log.attendanceStatus = "퇴근";
    log.attendanceStep = "out";
  } else {
    log.clockOut = now;
    log.attendanceStatus = "조퇴";
    log.attendanceStep = "early";
  }
  syncAttendanceRecordFromLog(getSelectedEmployee(), log);
  saveState();
  renderClockPanel();
  renderTodayContext();
  renderReport();
}

function getAttendanceStatusForLog(employee, log = getEmployeeLogForDate(employee.id), dateKey = getActiveDateKey(), now = new Date()) {
  if (log.attendanceStatus === "조퇴") return "조퇴";
  if (log.clockIn) {
    const [start] = String(employee.workHours || getEmployeeWorkHours(employee.id)).split("-");
    const startMinutes = timeToMinutes(start);
    const inMinutes = timeToMinutes(log.clockIn);
    const isLate = Number.isFinite(startMinutes) && Number.isFinite(inMinutes) && inMinutes > startMinutes + 5;
    if (isLate && log.attendanceStatus === "외출") return "지각·외출";
    if (isLate) return "지각";
    if (log.attendanceStatus === "외출") return "외출";
    return "정상";
  }
  const today = formatDateKey(now);
  const todayMinutes = now.getHours() * 60 + now.getMinutes();
  const [start] = String(employee.workHours || getEmployeeWorkHours(employee.id)).split("-");
  const startMinutes = timeToMinutes(start);
  if (dateKey > today) return "예정";
  if (dateKey < today || (dateKey === today && Number.isFinite(startMinutes) && todayMinutes > startMinutes + 30)) return "결석";
  return "미기록";
}

function syncAttendanceRecordFromLog(employee = getSelectedEmployee(), log = getEmployeeLogForDate(employee.id)) {
  state.attendance ||= {};
  state.attendance[getActiveDateKey()] ||= [];
  const status = getAttendanceStatusForLog(employee, log);
  const note = formatAttendanceSummary(log);
  const rows = state.attendance[getActiveDateKey()];
  const index = rows.findIndex((item) => item.employeeId === employee.id);
  const row = {
    employeeId: employee.id,
    org: employee.org?.split(" / ").at(-1) || employee.org || "",
    role: employee.role || "",
    name: employee.name || getEmployeeOwnLabel(employee),
    status,
    note,
  };
  if (index >= 0) rows[index] = { ...rows[index], ...row };
  else rows.push(row);
}

function renderTodayContext() {
  const node = document.getElementById("todayContext");
  const employee = getSelectedEmployee();
  const log = getSelectedLog();
  const entries = log.schedule || [];
  const tasks = log.tasks || [];
  const attendance = state.attendance?.[getActiveDateKey()] || [];
  const completed = tasks.filter((task) => task.done || task.status === "완료").length;
  const support = [...tasks, ...entries].filter((entry) => entry.status === "지원필요" || entry.status === "보류").length;
  const status = log.attendanceStatus || attendance.find((item) => item.employeeId === employee.id)?.status || "미기록";
  node.innerHTML = [
    ["직원", employee.name],
    ["소속", employee.org.split(" / ").at(-1)],
    ["출근", log.clockIn || "미기록"],
    ["퇴근", log.clockOut || "미기록"],
    ["우선업무", `${tasks.filter((task) => task.text.trim()).length}건`],
    ["완료", `${completed}건`],
    ["이슈", `${support}건`],
    ["근태", status],
  ].map(([label, value]) => `<span><b>${label}</b><strong>${value}</strong></span>`).join("");
}

function renderAttendance() {
  const list = document.getElementById("attendanceList");
  const addButton = document.getElementById("addAttendanceButton");
  if (addButton) addButton.hidden = true;
  preserveSectionDockBeforeRender("attendance");
  if (authState.user && hasApprovalAuthority() && canAccessSiteLabor() && !authState.approvalRowsLoaded && !authState.approvalRowsLoading) {
    authState.approvalRowsLoading = true;
    refreshStaffApprovalRows()
      .catch(() => {})
      .finally(() => {
        authState.approvalRowsLoading = false;
        if (activeView === "attendance") renderAttendance();
      });
  }
  renderWorkHistorySummary();
  if (!list) return;
  const employeeId = getOwnLaborEmployeeId();
  const employee = getOwnLaborEmployee();
  const labor = buildMonthlyLaborSummary(employeeId, employee);
  const ledger = buildLaborCostLedger(labor, employee);
  const payroll = buildPayrollStatement(labor, employee, ledger);
  const groups = getLaborSiteGroupsForScope();
  list.innerHTML = state.laborWorkspaceTab === "sites" && canAccessSiteLabor()
    ? renderLaborSiteScopePanel(groups)
    : "";
  dockGlobalHeaderActions("attendance");
  document.getElementById("copyAllSiteLaborLedgersButton")?.addEventListener("click", () => {
    if (state.laborSiteScope === "all") copyAllSiteLaborLedgers();
    else copySiteLaborCostLedger(buildSiteLaborCostLedger(state.laborSiteScope));
  });
  list.querySelectorAll("[data-labor-jump]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = document.getElementById(button.dataset.laborJump);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      else showAppToast("해당 항목은 노무 권한자 화면에서 확인할 수 있습니다.");
    });
  });
  list.querySelectorAll("[data-labor-payroll-field]").forEach((field) => {
    field.addEventListener("change", () => {
      updateLaborPayrollField(employeeId, labor.month, field.dataset.laborPayrollField, field.value);
    });
  });
  list.querySelectorAll("[data-copy-site-labor-ledger]").forEach((button) => {
    button.addEventListener("click", () => {
      const ledger = buildSiteLaborCostLedger(button.dataset.copySiteLaborLedger);
      copySiteLaborCostLedger(ledger);
    });
  });
  list.querySelectorAll("[data-labor-employee]").forEach((button) => {
    button.addEventListener("click", () => {
      const employeeId = button.dataset.laborEmployee;
      if (!canViewLaborEmployee(employeeId)) {
        showAppToast("열람 권한이 없는 직원의 노무기록입니다.");
        return;
      }
      state.selectedEmployeeId = employeeId;
      state.laborWorkspaceTab = "register";
      saveState({ fastSave: true });
      renderAttendance();
    });
  });
  list.querySelectorAll("[data-labor-site-scope]").forEach((button) => {
    button.addEventListener("click", () => {
      state.laborSiteScope = button.dataset.laborSiteScope || "all";
      saveState({ fastSave: true });
      renderAttendance();
    });
  });
  document.getElementById("openLaborReportFromAgentButton")?.addEventListener("click", () => openLaborReportSheet(labor, payroll, ledger));
}

function preserveSectionDockBeforeRender(panelView = worklogViewAliases[activeView] || activeView) {
  const panel = getActiveViewPanel(panelView);
  const dock = panel?.querySelector(".section-menu-dock");
  if (!panel || !dock || dock.parentElement === panel) return;
  panel.prepend(dock);
}

function getLaborSiteConsoleRows() {
  return getLaborSiteGroupsForScope().map((group) => {
    const groupEmployees = getLaborEmployeesForGroup(group);
    const summaries = groupEmployees
      .map((employee) => buildMonthlyLaborSummary(getLaborEmployeeLogId(employee), employee))
      .filter(Boolean);
    const recordedEmployees = summaries.filter((item) => item.recordedDays > 0).length;
    const actualMinutes = summaries.reduce((sum, item) => sum + item.actualMinutes, 0);
    const issues = summaries.reduce((sum, item) => sum + item.lateCount + item.earlyCount + item.absenceCount, 0);
    const paidPt = summaries.reduce((sum, item) => sum + item.settlementPtCount, 0);
    return {
      ...group,
      employeeCount: groupEmployees.length,
      recordedEmployees,
      actualMinutes,
      issues,
      paidPt,
    };
  });
}

function getLaborAgentSignals(labor, payroll) {
  const missingChecks = payroll.checks.filter(([, ok]) => !ok).map(([label]) => label);
  const signals = [];
  if (!labor.recordedDays) {
    signals.push(["근무기록 공백", "이번 달 근무기록이 부족합니다. 출근·퇴근 기록부터 채워야 노무자료가 성립합니다.", "주의"]);
  }
  if (labor.lateCount || labor.earlyCount || labor.absenceCount) {
    signals.push(["근태관리", `지각 ${labor.lateCount}건 · 조퇴 ${labor.earlyCount}건 · 결근 ${labor.absenceCount}건을 확인하세요.`, "확인"]);
  }
  if (missingChecks.length) {
    signals.push(["급여명세 보완", `${missingChecks.slice(0, 3).join(", ")} 항목을 보완하면 명세서 완성도가 올라갑니다.`, "보완"]);
  }
  if (labor.freePtCount) {
    signals.push(["프리랜서 정산", `무료 PT ${labor.freePtCount}건은 정산 집계에서 제외되도록 구분되어 있습니다.`, "정상"]);
  }
  if (!signals.length) {
    signals.push(["노무 흐름 정상", "근무기록과 급여명세 초안의 핵심 항목이 안정적으로 연결되어 있습니다.", "정상"]);
  }
  return signals;
}

function buildLaborPracticeReview(labor, employee, payroll) {
  const profile = getLaborProfileForEmployee(employee);
  const wageReady = Boolean(numberValue(profile.hourlyWage) || numberValue(profile.dailyWage));
  const contractReady = Boolean(
    String(profile.employmentType || "").trim()
    && String(profile.workHours || "").trim()
    && String(profile.workplace || "").trim()
    && wageReady
  );
  const today = todayKey;
  const elapsedRows = labor.dayRows.filter((row) => row.dateKey <= today);
  const scheduledRows = elapsedRows.filter((row) => row.scheduled > 0);
  const incompleteRows = scheduledRows.filter((row) => (row.clockIn && !row.clockOut) || (!row.clockIn && row.status !== "휴무" && row.status !== "예정"));
  const breakReady = elapsedRows.every((row) => row.worked < 4 * 60 || Boolean(row.breakSummary));
  const payrollReady = payroll.checks.filter(([, ok]) => ok).length;
  const insuranceReady = [
    payroll.draft.nationalPension,
    payroll.draft.healthInsurance,
    payroll.draft.employmentInsurance,
  ].some((value) => String(value || "").trim()) || /프리랜서/.test(String(profile.employmentType || ""));
  const evidenceReady = scheduledRows.length > 0 && incompleteRows.length === 0;
  const freelancerSeparated = Number.isFinite(labor.settlementPtCount) && Number.isFinite(labor.freePtCount);
  const items = [
    ["01", "근로계약", contractReady, "고용형태·근무지·소정근로시간·임금단가를 서면 원장과 대조합니다.", "staff-list"],
    ["02", "근태 원장", evidenceReady, incompleteRows.length ? `누락·미완료 ${incompleteRows.length}일을 보완합니다.` : "출퇴근 시각과 일자별 근무기록이 연결되어 있습니다.", "laborRegister"],
    ["03", "휴게·연장", breakReady && (labor.overtimeMinutes ? wageReady : true), !breakReady ? "4시간 이상 근무일의 휴게기록을 확인합니다." : "휴게와 연장·야간·휴일 시간을 수당 산식과 대조합니다.", "laborRegister"],
    ["04", "휴일·휴가", true, `휴가 ${labor.leaveDays}일 · 휴일/주말근로 ${formatMinutesAsHours(labor.holidayMinutes)}를 취업규칙과 대조합니다.`, "laborRegister", "manual"],
    ["05", "임금명세", payrollReady === payroll.checks.length, `필수 점검 ${payrollReady}/${payroll.checks.length} · 지급·공제·계산방법을 확인합니다.`, "payrollStatement"],
    ["06", "퇴직급여", Boolean(profile.joinDate), profile.joinDate ? `입사일 ${profile.joinDate} 기준으로 계속근로기간을 별도 검토합니다.` : "입사일과 계속근로기간을 등록하고 퇴직급여 적용 여부를 확인합니다.", "staff-list", "manual"],
    ["07", "사회보험", insuranceReady, insuranceReady ? "사회보험 공제 입력 여부가 확인됩니다." : "가입대상과 보수월액을 확인한 뒤 공제액을 입력합니다.", "payrollStatement", "manual"],
    ["08", "프리랜서·PT", freelancerSeparated, `유료 PT ${labor.settlementPtCount}건 · 무료 PT ${labor.freePtCount}건을 분리 집계합니다.`, "companyLaborLedgers"],
    ["09", "증빙·보존", evidenceReady, evidenceReady ? "근태·업무일지·임금 계산기초의 월별 보관 준비가 완료되었습니다." : "누락 근태를 보완한 뒤 월별 증빙 묶음을 보관합니다.", "laborRegister"],
    ["10", "개인정보", true, "식별정보는 화면에서 마스킹하고 노무 권한자에게만 열람을 허용합니다.", "companyLaborLedgers", "manual"],
  ].map(([number, title, ready, description, target, tone]) => ({
    number,
    title,
    status: tone || (ready ? "ready" : "check"),
    label: tone === "manual" ? "전문확인" : ready ? "준비" : "보완",
    description,
    target,
  }));
  const readyCount = items.filter((item) => item.status !== "check").length;
  const exceptions = [];
  if (incompleteRows.length) exceptions.push(["근태 누락", `${incompleteRows.slice(0, 4).map((row) => Number(row.dateKey.slice(8)) + "일").join(", ")} 출퇴근 기록 확인`, "laborRegister"]);
  payroll.checks.filter(([, ok]) => !ok).slice(0, 3).forEach(([label]) => exceptions.push(["명세 보완", label, "payrollStatement"]));
  if (labor.overtimeMinutes && !wageReady) exceptions.push(["수당 산식", "연장근로가 있으나 임금단가가 없습니다.", "payrollStatement"]);
  if (!breakReady) exceptions.push(["휴게 확인", "4시간 이상 근무일의 휴게기록이 비어 있습니다.", "laborRegister"]);
  if (!profile.joinDate) exceptions.push(["인사 원장", "입사일이 없어 퇴직급여 검토 기준일을 계산할 수 없습니다.", "staff-list"]);
  if (!exceptions.length) exceptions.push(["월 마감", "자동 점검상 즉시 보완할 항목이 없습니다. 최종 교부 전 전문가 확인이 필요합니다.", "payrollStatement"]);
  return { items, readyCount, exceptions, incompleteRows, payrollReady };
}

function buildLaborIntegrationModel(labor, employee, payroll) {
  const employeeId = getLaborEmployeeLogId(employee);
  const profile = getLaborProfileForEmployee(employee);
  const elapsedRows = labor.dayRows.filter((row) => row.dateKey <= todayKey);
  const workedRows = elapsedRows.filter((row) => row.clockIn || row.clockOut || row.worked);
  const completeAttendanceRows = workedRows.filter((row) => row.clockIn && row.clockOut);
  const monthLogs = getMonthDateKeys(labor.month)
    .map((dateKey) => ({ dateKey, log: state.employeeLogs?.[dateKey]?.[employeeId] }))
    .filter(({ log }) => Boolean(log));
  const worklogDays = monthLogs.filter(({ log }) => hasSubmittableWorklogContent(log)).length;
  const submittedDays = monthLogs.filter(({ dateKey }) => Boolean(getWorklogReportSubmission(employeeId, dateKey)?.submittedAt)).length;
  const contractFields = [profile.employmentType, profile.workplace, profile.workHours, profile.joinDate];
  const contractReady = contractFields.filter((value) => String(value || "").trim()).length;
  const payrollReady = payroll.checks.filter(([, ok]) => ok).length;
  const isFitness = getReportArchiveSiteId(employee) === "fitness";
  return {
    employeeId,
    sources: [
      {
        key: "staff",
        label: "직원 원장",
        value: `${contractReady}/${contractFields.length}`,
        detail: "고용형태·근무지·근무시간·입사일",
        status: contractReady === contractFields.length ? "ready" : "check",
        route: "staff",
      },
      {
        key: "worklog",
        label: "업무일지",
        value: `${worklogDays}일`,
        detail: submittedDays ? `제출 ${submittedDays}일 · 월 증빙 연결` : "작성 내용이 월 증빙으로 연결됩니다.",
        status: worklogDays ? "ready" : "check",
        route: "worklog",
      },
      {
        key: "attendance",
        label: "출퇴근·휴게",
        value: `${completeAttendanceRows.length}/${workedRows.length || 0}`,
        detail: "출퇴근과 휴게기록이 근로시간 원장으로 합산됩니다.",
        status: workedRows.length && completeAttendanceRows.length === workedRows.length ? "ready" : "check",
        route: "attendance",
      },
      {
        key: "fitness",
        label: isFitness ? "피트니스 PT" : "성과 기록",
        value: isFitness ? `${labor.settlementPtCount}/${labor.freePtCount}` : `${labor.recordedDays}일`,
        detail: isFitness ? "유료 PT만 정산하고 무료 PT는 분리합니다." : "근무일과 업무 증빙을 함께 대조합니다.",
        status: isFitness ? "ready" : "manual",
        route: isFitness ? "fitness" : "worklog",
      },
      {
        key: "payroll",
        label: "급여·공제",
        value: `${payrollReady}/${payroll.checks.length}`,
        detail: "근태·임금단가·수당·공제를 급여명세 초안에 반영합니다.",
        status: payrollReady === payroll.checks.length ? "ready" : "check",
        route: "payroll",
      },
      {
        key: "report",
        label: "보고·보관",
        value: `${submittedDays}건`,
        detail: "업무 증빙과 노무 월 보고서를 날짜별 보관함에서 확인합니다.",
        status: submittedDays || labor.recordedDays ? "ready" : "check",
        route: "report",
      },
    ],
  };
}

function renderLaborIntegrationRail(model, labor) {
  return `
    <section class="labor-integration-rail" aria-label="앱 기능 연결 현황">
      <header>
        <div><span>Connected Operations</span><h3>원장부터 보고까지 한 흐름</h3></div>
        <p>각 섹션의 원본 기록을 다시 입력하지 않고 ${escapeHtml(labor.monthLabel)} 노무자료로 연결합니다.</p>
      </header>
      <div>
        ${model.sources.map((source, index) => `
          <button type="button" class="is-${escapeAttr(source.status)}" data-labor-route="${escapeAttr(source.route)}" data-labor-employee-id="${escapeAttr(model.employeeId)}" data-labor-month="${escapeAttr(labor.month)}">
            <i>${String(index + 1).padStart(2, "0")}</i>
            <span><b>${escapeHtml(source.label)}</b><em>${escapeHtml(source.detail)}</em></span>
            <strong>${escapeHtml(source.value)}</strong>
          </button>
        `).join("")}
      </div>
    </section>
  `;
}

function renderLaborOperationsConsole(labor, employee, payroll) {
  const siteRows = getLaborSiteConsoleRows();
  const siteRecorded = siteRows.reduce((sum, row) => sum + row.recordedEmployees, 0);
  const siteEmployees = siteRows.reduce((sum, row) => sum + row.employeeCount, 0);
  const totalIssues = siteRows.reduce((sum, row) => sum + row.issues, 0);
  const readyCount = payroll.checks.filter(([, ok]) => ok).length;
  const agentSignals = getLaborAgentSignals(labor, payroll);
  const practice = buildLaborPracticeReview(labor, employee, payroll);
  const integration = buildLaborIntegrationModel(labor, employee, payroll);
  const readiness = Math.round((practice.readyCount / practice.items.length) * 100);
  const cards = [
    ["사업장별 근무기록", `${siteRecorded}/${siteEmployees}명`, "사업장별 출역·근무시간 원장", "companyLaborLedgers"],
    ["근태관리", totalIssues ? `${totalIssues}건 확인` : "정상", "지각·조퇴·결근·외출 추적", "laborRegister"],
    ["급여명세현황", `${readyCount}/${payroll.checks.length}`, "지급·공제·계산방법 준비도", "payrollStatement"],
    ["월차·연차관리", `${labor.leaveDays}일`, "휴가·월차·연차 사용 기록", "laborRegister"],
    ["각 직원 근무기록", `${labor.recordedDays}일`, `${getEmployeeAdminLabel(employee)} 월별 기록`, "laborRegister"],
  ];
  return `
    <section class="labor-ops-console" id="laborOperationsConsole">
      <header class="labor-command-head">
        <div>
          <span>Labor Operations Desk</span>
          <h3>${escapeHtml(labor.monthLabel)} 노무 월 마감 관제</h3>
          <p>근태 → 수당 → 임금명세 → 증빙보관 순서로 확인하는 실무 점검 화면입니다.</p>
        </div>
        <div class="labor-readiness-ring" style="--labor-readiness:${escapeAttr(String(readiness))}" aria-label="노무 준비도 ${escapeAttr(String(readiness))}점">
          <strong>${escapeHtml(String(readiness))}</strong><span>준비도</span>
        </div>
      </header>
      <div class="labor-ops-grid">
        ${cards.map(([label, value, description, target]) => `
          <button type="button" data-labor-jump="${escapeAttr(target)}">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
            <em>${escapeHtml(description)}</em>
          </button>
        `).join("")}
      </div>
      ${renderLaborIntegrationRail(integration, labor)}
      <div class="labor-close-flow" aria-label="노무 월 마감 순서">
        ${[
          ["01", "근태 마감", practice.items.find((item) => item.title === "근태 원장")?.status === "ready", "출퇴근·휴게 누락 확인"],
          ["02", "예외 검토", practice.exceptions.length === 1 && practice.exceptions[0][0] === "월 마감", "지각·조퇴·휴가·수정이력"],
          ["03", "수당 계산", Boolean(numberValue(getLaborProfileForEmployee(employee).hourlyWage) || numberValue(getLaborProfileForEmployee(employee).dailyWage)), "연장·야간·휴일 산식"],
          ["04", "명세 완성", readyCount === payroll.checks.length, "지급·공제·계산방법"],
          ["05", "교부·보관", false, "확정본 교부 및 증빙 보관"],
        ].map(([number, title, done, description]) => `
          <span class="labor-close-step ${done ? "is-done" : "is-next"}">
            <b>${escapeHtml(number)}</b><strong>${escapeHtml(title)}</strong><em>${escapeHtml(description)}</em>
          </span>
        `).join("")}
      </div>
      <div class="labor-practice-grid" aria-label="노무 10대 실무 점검">
        ${practice.items.map((item) => `
          <button type="button" class="labor-practice-card is-${escapeAttr(item.status)}" data-labor-jump="${escapeAttr(item.target)}">
            <span>${escapeHtml(item.number)}</span>
            <b>${escapeHtml(item.title)}</b>
            <strong>${escapeHtml(item.label)}</strong>
            <em>${escapeHtml(item.description)}</em>
          </button>
        `).join("")}
      </div>
      <article class="labor-exception-panel">
        <header><div><span>Exception Queue</span><h3>보완 대기 ${escapeHtml(String(practice.exceptions.length))}건</h3></div><b>자동점검</b></header>
        <div>
          ${practice.exceptions.slice(0, 6).map(([title, text, target]) => `
            <button type="button" data-labor-jump="${escapeAttr(target)}"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span><em>확인 →</em></button>
          `).join("")}
        </div>
      </article>
      <article class="labor-agent-panel">
        <header>
          <div>
            <span>Labor Agent</span>
            <h3>AI 노무 에이전트</h3>
          </div>
          <button type="button" id="openLaborReportFromAgentButton">출력</button>
        </header>
        <div class="labor-agent-list">
          ${agentSignals.map(([title, text, badge]) => `
            <span>
              <b>${escapeHtml(title)}</b>
              <em>${escapeHtml(text)}</em>
              <strong>${escapeHtml(badge)}</strong>
            </span>
          `).join("")}
        </div>
      </article>
      ${canAccessSiteLabor() ? `
        <div class="labor-site-strip">
          ${siteRows.map((row) => `
            <span>
              <b>${escapeHtml(row.title)}</b>
              <strong>${escapeHtml(`${row.recordedEmployees}/${row.employeeCount}`)}</strong>
              <em>${escapeHtml(`${formatMinutesAsHours(row.actualMinutes)} · 유료PT ${row.paidPt}`)}</em>
            </span>
          `).join("")}
        </div>
      ` : ""}
      <p class="labor-legal-note">이 화면은 근로계약·근로시간·휴게·휴일·임금명세·퇴직·사회보험·프리랜서·증빙·개인정보를 빠뜨리지 않기 위한 실무 점검 도구입니다. 사업장 규모와 고용형태에 따라 적용 기준이 달라질 수 있으므로 지급·신고·징계·퇴직 처리는 공인노무사 또는 관계기관 확인 후 확정하세요.</p>
    </section>
  `;
}

function getLaborPayrollKey(employeeId, month) {
  return `${employeeId || "profile-user"}:${month || getActiveDateKey().slice(0, 7)}`;
}

function getLaborPayrollDraft(employeeId, month) {
  state.laborPayroll ||= {};
  const key = getLaborPayrollKey(employeeId, month);
  state.laborPayroll[key] ||= {
    payDate: "",
    mealAllowance: "",
    bonus: "",
    extraAllowance: "",
    incomeTax: "",
    localIncomeTax: "",
    nationalPension: "",
    healthInsurance: "",
    longTermCare: "",
    employmentInsurance: "",
    otherDeduction: "",
    memo: "",
  };
  return state.laborPayroll[key];
}

function updateLaborPayrollField(employeeId, month, field, value) {
  const draft = getLaborPayrollDraft(employeeId, month);
  draft[field] = value;
  saveState();
  saveRemoteLaborPayrollDraft(employeeId, month, draft);
  renderAttendance();
}

function isMissingLaborPayrollTableError(error) {
  const message = [error?.message, error?.details, error?.hint].filter(Boolean).join(" ");
  return /labor_payroll_drafts|schema cache|relation .* does not exist|pgrst205/i.test(message);
}

async function saveRemoteLaborPayrollDraft(employeeId, month, draft) {
  if (!supabaseClient || !authState.user || authState.applyingRemote) return;
  const { error } = await supabaseClient.from("labor_payroll_drafts").upsert({
    user_id: authState.user.id,
    employee_id: employeeId,
    month_key: month,
    organization: state.profile?.org || "(주)방주",
    draft: { ...draft },
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,employee_id,month_key" });
  if (error && !isMissingLaborPayrollTableError(error)) {
    showAppToast("급여 초안의 원격 저장을 완료하지 못했습니다.");
  }
}

async function loadRemoteLaborPayrollDrafts() {
  if (!supabaseClient || !authState.user) return;
  const { data, error } = await supabaseClient
    .from("labor_payroll_drafts")
    .select("employee_id,month_key,draft")
    .eq("user_id", authState.user.id)
    .order("updated_at", { ascending: false });
  if (error) {
    if (!isMissingLaborPayrollTableError(error)) console.warn("Labor payroll drafts could not be loaded.", error);
    return;
  }
  state.laborPayroll ||= {};
  (data || []).forEach((row) => {
    const key = getLaborPayrollKey(row.employee_id, row.month_key);
    state.laborPayroll[key] = { ...getLaborPayrollDraft(row.employee_id, row.month_key), ...(row.draft || {}) };
  });
}

function getPayrollPayDate(draft, month, profile = state.profile || {}) {
  if (draft.payDate) return draft.payDate;
  const profilePayDay = String(profile.payDay || "").trim();
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  if (/^\d{1,2}$/.test(profilePayDay)) {
    const day = Math.min(Number(profilePayDay), lastDay);
    return `${month}-${String(day).padStart(2, "0")}`;
  }
  return `${month}-${String(lastDay).padStart(2, "0")}`;
}

function buildPayrollStatement(labor, employee, ledger) {
  const profile = getLaborProfileForEmployee(employee);
  const laborEmployeeId = getLaborEmployeeLogId(employee);
  const draft = getLaborPayrollDraft(laborEmployeeId, labor.month);
  const hourlyWage = numberValue(profile.hourlyWage);
  const dailyWage = numberValue(profile.dailyWage);
  const regularCapMinutes = labor.scheduledMinutes || Math.max(0, labor.actualMinutes - labor.overtimeMinutes);
  const regularMinutes = hourlyWage ? Math.min(labor.actualMinutes, regularCapMinutes) : labor.actualMinutes;
  const basePay = dailyWage
    ? dailyWage * labor.recordedDays
    : hourlyWage
      ? Math.round((regularMinutes / 60) * hourlyWage)
      : ledger.totalPay || 0;
  const overtimePay = hourlyWage ? Math.round((labor.overtimeMinutes / 60) * hourlyWage * 1.5) : 0;
  const nightPay = hourlyWage ? Math.round((labor.nightMinutes / 60) * hourlyWage * 0.5) : 0;
  const holidayPay = hourlyWage ? Math.round((labor.holidayMinutes / 60) * hourlyWage * 1.5) : 0;
  const allowances = {
    mealAllowance: numberValue(draft.mealAllowance),
    bonus: numberValue(draft.bonus),
    extraAllowance: numberValue(draft.extraAllowance),
  };
  const deductions = {
    incomeTax: numberValue(draft.incomeTax),
    localIncomeTax: numberValue(draft.localIncomeTax),
    nationalPension: numberValue(draft.nationalPension),
    healthInsurance: numberValue(draft.healthInsurance),
    longTermCare: numberValue(draft.longTermCare),
    employmentInsurance: numberValue(draft.employmentInsurance),
    otherDeduction: numberValue(draft.otherDeduction),
  };
  const wageItems = [
    ["기본급", basePay, dailyWage ? `${labor.recordedDays}일 x ${formatCurrency(dailyWage)}` : hourlyWage ? `${formatMinutesAsHours(regularMinutes)} x ${formatCurrency(hourlyWage)}` : "단가 입력 필요"],
    ["연장근로수당", overtimePay, `${formatMinutesAsHours(labor.overtimeMinutes)} x 시급 x 1.5 추정`],
    ["야간근로수당", nightPay, `${formatMinutesAsHours(labor.nightMinutes)} x 시급 x 0.5 추정`],
    ["휴일/주말수당", holidayPay, `${formatMinutesAsHours(labor.holidayMinutes)} x 시급 x 1.5 추정`],
    ["식대/복리후생", allowances.mealAllowance, "수기 입력"],
    ["상여/성과", allowances.bonus, "수기 입력"],
    ["기타수당", allowances.extraAllowance, "수기 입력"],
  ];
  const deductionItems = [
    ["소득세", deductions.incomeTax],
    ["지방소득세", deductions.localIncomeTax],
    ["국민연금", deductions.nationalPension],
    ["건강보험", deductions.healthInsurance],
    ["장기요양", deductions.longTermCare],
    ["고용보험", deductions.employmentInsurance],
    ["기타공제", deductions.otherDeduction],
  ];
  const grossPay = wageItems.reduce((sum, [, amount]) => sum + amount, 0);
  const deductionTotal = deductionItems.reduce((sum, [, amount]) => sum + amount, 0);
  const netPay = Math.max(0, grossPay - deductionTotal);
  const checks = [
    ["근로자 특정정보", Boolean(employee.name || profile.name) && Boolean(profile.laborId || employee.id)],
    ["임금지급일", Boolean(getPayrollPayDate(draft, labor.month, profile))],
    ["단가 기준", Boolean(dailyWage || hourlyWage)],
    ["출근일수/근로시간", labor.recordedDays > 0 || labor.actualMinutes > 0],
    ["연장·야간·휴일 시간", labor.overtimeMinutes || labor.nightMinutes || labor.holidayMinutes ? Boolean(hourlyWage) : true],
    ["공제내역", deductionTotal > 0 || draft.memo.includes("공제 없음")],
  ];
  return {
    employeeId: laborEmployeeId,
    month: labor.month,
    monthLabel: labor.monthLabel,
    payDate: getPayrollPayDate(draft, labor.month, profile),
    workerName: employee.name || profile.name || "이름 미입력",
    workerId: profile.laborId || employee.id || "사원번호 미입력",
    org: profile.org || employee.org || "소속 미입력",
    workplace: profile.workplace || ledger.site || "사업장 미입력",
    role: profile.role || employee.role || "직함 미입력",
    employmentType: profile.employmentType || employee.employmentType || "직원",
    draft,
    wageItems,
    deductionItems,
    grossPay,
    deductionTotal,
    netPay,
    checks,
    labor,
  };
}

function renderPayrollMoneyInput(statement, field, label) {
  const value = statement.draft[field] || "";
  return `
    <label>${escapeHtml(label)}
      <input type="number" min="0" inputmode="numeric" data-labor-payroll-field="${escapeAttr(field)}" value="${escapeAttr(value)}" placeholder="0" />
    </label>
  `;
}

function renderPayrollStatement(statement) {
  const readyCount = statement.checks.filter(([, ok]) => ok).length;
  return `
    <section class="payroll-statement-card" id="payrollStatement">
      <header>
        <div>
          <span>Payroll Statement Draft</span>
          <h3>${escapeHtml(statement.monthLabel)} 급여명세서 초안</h3>
          <p>${escapeHtml("급여 지급 전 노무사 검토용 초안입니다. 공제액과 수당은 실제 기준으로 확인 후 확정하세요.")}</p>
        </div>
        <button type="button" id="copyPayrollStatementButton">명세서 복사</button>
      </header>
      <div class="payroll-readiness">
        <strong>제출 준비도 ${escapeHtml(String(readyCount))}/${escapeHtml(String(statement.checks.length))}</strong>
        ${statement.checks.map(([label, ok]) => `<span class="${ok ? "is-ok" : "is-needed"}">${escapeHtml(label)}</span>`).join("")}
      </div>
      <div class="payroll-identity-grid">
        ${[
          ["직원", statement.workerName],
          ["식별", maskLaborId(statement.workerId)],
          ["소속", statement.org],
          ["근무지", statement.workplace],
          ["직함", statement.role],
          ["고용형태", statement.employmentType],
          ["지급일", statement.payDate],
          ["지급총액", formatCurrency(statement.grossPay) || "계산 대기"],
          ["공제총액", formatCurrency(statement.deductionTotal) || "0원"],
          ["차인지급액", formatCurrency(statement.netPay) || "계산 대기"],
        ].map(([label, value]) => `<span><b>${escapeHtml(label)}</b><strong>${escapeHtml(value)}</strong></span>`).join("")}
      </div>
      <div class="payroll-tables">
        <article>
          <h4>지급 항목 및 계산방법</h4>
          ${statement.wageItems.map(([label, amount, formula]) => `
            <div><span>${escapeHtml(label)}</span><strong>${escapeHtml(formatCurrency(amount) || "0원")}</strong><em>${escapeHtml(formula)}</em></div>
          `).join("")}
        </article>
        <article>
          <h4>공제 항목</h4>
          ${statement.deductionItems.map(([label, amount]) => `
            <div><span>${escapeHtml(label)}</span><strong>${escapeHtml(formatCurrency(amount) || "0원")}</strong><em>수기/외부 계산값</em></div>
          `).join("")}
        </article>
      </div>
      <div class="payroll-adjust-grid">
        <label>임금지급일
          <input type="date" data-labor-payroll-field="payDate" value="${escapeAttr(statement.draft.payDate || statement.payDate)}" />
        </label>
        ${renderPayrollMoneyInput(statement, "mealAllowance", "식대/복리후생")}
        ${renderPayrollMoneyInput(statement, "bonus", "상여/성과")}
        ${renderPayrollMoneyInput(statement, "extraAllowance", "기타수당")}
        ${renderPayrollMoneyInput(statement, "incomeTax", "소득세")}
        ${renderPayrollMoneyInput(statement, "localIncomeTax", "지방소득세")}
        ${renderPayrollMoneyInput(statement, "nationalPension", "국민연금")}
        ${renderPayrollMoneyInput(statement, "healthInsurance", "건강보험")}
        ${renderPayrollMoneyInput(statement, "longTermCare", "장기요양")}
        ${renderPayrollMoneyInput(statement, "employmentInsurance", "고용보험")}
        ${renderPayrollMoneyInput(statement, "otherDeduction", "기타공제")}
        <label class="payroll-memo-field">노무 메모
          <textarea rows="2" data-labor-payroll-field="memo" placeholder="예: 공제 없음, 프리랜서 정산, 노무사 확인 필요">${escapeHtml(statement.draft.memo || "")}</textarea>
        </label>
      </div>
    </section>
  `;
}

async function copyPayrollStatement(statement) {
  const text = [
    `[${statement.monthLabel} 급여명세서 초안]`,
    `직원: ${statement.workerName}`,
    `식별: ${maskLaborId(statement.workerId)}`,
    `소속/근무지: ${statement.org} / ${statement.workplace}`,
    `직함/고용형태: ${statement.role} / ${statement.employmentType}`,
    `임금지급일: ${statement.payDate}`,
    `근로일수: ${statement.labor.recordedDays}일`,
    `총 근로시간: ${formatMinutesAsHours(statement.labor.actualMinutes)}`,
    `연장/야간/휴일: ${formatMinutesAsHours(statement.labor.overtimeMinutes)} / ${formatMinutesAsHours(statement.labor.nightMinutes)} / ${formatMinutesAsHours(statement.labor.holidayMinutes)}`,
    "",
    "지급항목\t금액\t계산방법",
    ...statement.wageItems.map(([label, amount, formula]) => `${label}\t${formatCurrency(amount) || "0원"}\t${formula}`),
    `지급총액\t${formatCurrency(statement.grossPay) || "0원"}`,
    "",
    "공제항목\t금액",
    ...statement.deductionItems.map(([label, amount]) => `${label}\t${formatCurrency(amount) || "0원"}`),
    `공제총액\t${formatCurrency(statement.deductionTotal) || "0원"}`,
    `차인지급액\t${formatCurrency(statement.netPay) || "0원"}`,
    "",
    `메모: ${statement.draft.memo || "-"}`,
  ].join("\n");
  await navigator.clipboard?.writeText(text);
  showAppToast("급여명세서 초안을 복사했습니다.");
}

function getLaborEmployeeLogId(employee = {}) {
  if (!employee) return "profile-user";
  if (employee.id === "profile-user") return "profile-user";
  if (employee.mappedEmployeeId) return employee.mappedEmployeeId;
  return employee.id || "profile-user";
}

function getLaborSiteGroupsForScope() {
  const allGroups = getWorklogSiteGroups();
  if (canAccessAllLabor()) return allGroups;
  const ownGroup = getStaffSiteGroupForEmployee(getProfileEmployee());
  return ownGroup ? [ownGroup] : [];
}

function getLaborEmployeesForGroup(group) {
  if (!group) return [];
  const rows = getStaffDirectoryEmployees()
    .filter((employee) => getStaffSiteGroupForEmployee(employee)?.id === group.id);
  if (rows.length) return rows;
  return getAssignedWorklogEmployeeIds(group.employeeIds)
    .map((employeeId) => employees.find((employee) => employee.id === employeeId))
    .filter(Boolean);
}

function getVisibleLaborEmployees() {
  const groups = getLaborSiteGroupsForScope();
  const seen = new Set();
  return groups.flatMap((group) => getLaborEmployeesForGroup(group))
    .filter((employee) => {
      const key = employee.email ? `email:${String(employee.email).toLowerCase()}` : employee.id;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function canViewLaborEmployee(employeeId = "") {
  if (!employeeId) return false;
  if (canAccessAllLabor()) return true;
  return getVisibleLaborEmployees().some((employee) => getLaborEmployeeLogId(employee) === employeeId || employee.id === employeeId);
}

function getLaborRealtimeSnapshot(selectedEmployee = getOwnLaborEmployee(), now = new Date()) {
  const rows = getVisibleLaborEmployees().map((employee) => {
    const employeeId = getLaborEmployeeLogId(employee);
    const log = state.employeeLogs?.[todayKey]?.[employeeId] || createEmployeeLog({ ...employee, id: employeeId }, state.profile, todayKey);
    const workHours = getEmployeeWorkHours(employeeId, getLaborProfileForEmployee(employee), todayKey);
    const status = getWorkHoursDurationMinutes(workHours)
      ? getAttendanceStatusForLog({ ...employee, workHours }, log, todayKey, now)
      : "휴무";
    return { employee, employeeId, log, status };
  });
  const selectedId = getLaborEmployeeLogId(selectedEmployee);
  const selected = rows.find((row) => row.employeeId === selectedId) || rows[0];
  return {
    rows,
    selected,
    working: rows.filter((row) => row.log.clockIn && !row.log.clockOut).length,
    finished: rows.filter((row) => Boolean(row.log.clockOut)).length,
    issues: rows.filter((row) => /결석|지각|조퇴/.test(row.status)).length,
    missing: rows.filter((row) => row.status === "미기록").length,
  };
}

function renderLaborWorkspaceNav(labor, employee) {
  const tab = state.laborWorkspaceTab;
  const realtime = getLaborRealtimeSnapshot(employee);
  const currentMonth = todayKey.slice(0, 7);
  const isCurrentMonth = labor.month === currentMonth;
  const selectedStatus = realtime.selected?.status || "미기록";
  const employeeId = getLaborEmployeeLogId(employee);
  const employeeOptions = getVisibleLaborEmployees();
  const tabs = [
    ["overview", "실시간 현황", "오늘"],
    ["register", "월별 원장", labor.month.replace("-", ".")],
    ["sites", "사업장·직원", `${getLaborSiteGroupsForScope().length}곳`],
    ["payroll", "급여·출력", "초안"],
  ];
  return `
    <section class="labor-workspace-nav" id="laborWorkspaceNav">
      <div class="labor-live-line">
        <div><i aria-hidden="true"></i><span>LIVE</span><strong>${escapeHtml(formatFormalKoreanDate(todayKey))}</strong><em>${escapeHtml(getEmployeeAdminLabel(employee))} · ${escapeHtml(selectedStatus)}</em></div>
        <div class="labor-live-kpis">
          <span><b>${realtime.working}</b>근무중</span>
          <span><b>${realtime.finished}</b>퇴근</span>
          <span class="${realtime.issues ? "is-alert" : ""}"><b>${realtime.issues}</b>확인</span>
          <span><b>${realtime.missing}</b>미기록</span>
        </div>
      </div>
      <div class="labor-workspace-controls">
        <label>직원
          <select id="laborEmployeeSelect" aria-label="노무 직원 선택">
            ${employeeOptions.map((item) => {
              const id = getLaborEmployeeLogId(item);
              return `<option value="${escapeAttr(id)}" ${id === employeeId ? "selected" : ""}>${escapeHtml(getEmployeeAdminLabel(item))}</option>`;
            }).join("")}
          </select>
        </label>
        <div class="labor-month-stepper">
          <button type="button" id="laborPrevMonthButton" aria-label="이전 월">‹</button>
          <button type="button" id="laborMonthPickerButton" aria-label="${escapeAttr(formatLaborMonthHeading(labor.month))} 월 선택">${escapeHtml(formatLaborMonthHeading(labor.month))}</button>
          <button type="button" id="laborNextMonthButton" aria-label="다음 월" ${isCurrentMonth ? "disabled" : ""}>›</button>
          <button type="button" id="laborTodayButton" ${isCurrentMonth ? "hidden" : ""}>현재 월</button>
          <input type="month" id="laborMonthInput" value="${escapeAttr(labor.month)}" max="${escapeAttr(currentMonth)}" aria-label="노무 기준 월 선택" />
        </div>
      </div>
      <nav class="labor-workspace-tabs" aria-label="노무 화면 메뉴">
        ${tabs.map(([key, label, meta]) => `<button type="button" class="${tab === key ? "is-active" : ""}" data-labor-workspace-tab="${escapeAttr(key)}"><span>${escapeHtml(label)}</span><em>${escapeHtml(meta)}</em></button>`).join("")}
      </nav>
    </section>
  `;
}

function shiftLaborMonth(offset) {
  const [year, month] = getActiveDateKey().slice(0, 7).split("-").map(Number);
  const next = new Date(year, month - 1 + offset, 1);
  const nextMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
  if (nextMonth > todayKey.slice(0, 7)) return;
  setSelectedDateKey(`${nextMonth}-01`);
}

function renderLaborSiteScopePanel(groups = getLaborSiteGroupsForScope()) {
  const validScopes = new Set(["all", ...groups.map((group) => group.id)]);
  if (!validScopes.has(state.laborSiteScope)) state.laborSiteScope = "all";
  const selectedGroups = state.laborSiteScope === "all"
    ? groups
    : groups.filter((group) => group.id === state.laborSiteScope);
  const summaries = getLaborSiteConsoleRows().filter((row) => selectedGroups.some((group) => group.id === row.id));
  return `
    <section class="labor-site-workspace">
      <nav class="labor-site-scope-nav" aria-label="사업장 선택">
        <button type="button" class="${state.laborSiteScope === "all" ? "is-active" : ""}" data-labor-site-scope="all">전 사업장</button>
        ${groups.map((group) => `<button type="button" class="${state.laborSiteScope === group.id ? "is-active" : ""}" data-labor-site-scope="${escapeAttr(group.id)}">${escapeHtml(group.title)}</button>`).join("")}
      </nav>
      ${state.laborSiteScope === "all" ? `
        <div class="labor-site-summary-grid">
          ${summaries.map((row) => `
            <button type="button" data-labor-site-scope="${escapeAttr(row.id)}">
              <span>${escapeHtml(row.title)}</span>
              <strong>${escapeHtml(`${row.recordedEmployees}/${row.employeeCount}명`)}</strong>
              <em>${escapeHtml(`${formatMinutesAsHours(row.actualMinutes)} · 확인 ${row.issues} · 유료PT ${row.paidPt}`)}</em>
            </button>
          `).join("")}
        </div>
        <p class="labor-site-summary-note">사업장을 선택하면 직원별 월 현황과 해당 사업장의 지급대장을 한 화면에서 확인합니다.</p>
      ` : `
        ${renderLeaderLaborOverviewMarkup(selectedGroups)}
        ${canAccessLaborPayrollLedgers() ? renderCompanyLaborLedgersMarkup(selectedGroups) : ""}
      `}
    </section>
  `;
}

function renderLeaderLaborOverviewMarkup(groups = getLaborSiteGroupsForScope()) {
  const month = getActiveDateKey().slice(0, 7);
  const heading = canAccessAllLabor() ? "전 사업장 노무현황" : "소속 사업장 노무현황";
  const scopeText = canAccessAllLabor() ? "대표/권한자 전 사업장 열람" : "소속 사업장 직원 현황";
  return `
    <section class="labor-leader-overview">
      <header>
        <span>Company Labor Control</span>
        <h3>${escapeHtml(month.replace("-", "."))} ${escapeHtml(heading)}</h3>
        <p>${escapeHtml(scopeText)} · 직원을 누르면 해당 직원의 월별 근무기록으로 전환됩니다.</p>
      </header>
      <div class="labor-leader-grid">
        ${groups.map((group) => `
          <article>
            <strong>${escapeHtml(group.title)}</strong>
            ${getLaborEmployeesForGroup(group).map((employee) => {
              if (!employee) return "";
              const employeeId = getLaborEmployeeLogId(employee);
              const labor = buildMonthlyLaborSummary(employeeId, employee);
              const active = getOwnLaborEmployeeId() === employeeId;
              return `
                <button type="button" class="${active ? "is-active" : ""}" data-labor-employee="${escapeAttr(employeeId)}">
                  <b>${escapeHtml(getEmployeeAdminLabel(employee))}</b>
                  <span>${escapeHtml(labor.recordedDays)}일 · ${escapeHtml(formatMinutesAsHours(labor.actualMinutes))} · 지각/조퇴/결근 ${escapeHtml(String(labor.lateCount + labor.earlyCount + labor.absenceCount))}</span>
                </button>
              `;
            }).join("")}
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderCompanyLaborLedgersMarkup(groups = getLaborSiteGroupsForScope()) {
  const ledgers = groups.map((group) => buildSiteLaborCostLedger(group.id));
  const monthLabel = getActiveDateKey().slice(0, 7).replace("-", ".");
  return `
    <section class="company-labor-ledgers" id="companyLaborLedgers">
      <header>
        <div>
          <span>Labor Payment Registers</span>
          <h3>${escapeHtml(monthLabel)} 사업장별 노무비 지급대장</h3>
          <p>노무신고용으로 일반적으로 사용하는 월간 출역·임금 지급대장 형식입니다.</p>
        </div>
        <button type="button" id="copyAllSiteLaborLedgersButton">${groups.length === 1 ? "사업장 대장 복사" : "전체 대장 복사"}</button>
      </header>
      ${ledgers.map(renderSiteLaborCostLedger).join("")}
    </section>
  `;
}

function buildSiteLaborCostLedger(groupId) {
  const group = getLaborSiteGroupsForScope().find((item) => item.id === groupId) || getLaborSiteGroupsForScope()[0];
  const monthLabel = getActiveDateKey().slice(0, 7).replace("-", ".");
  const dayNumbers = Array.from({ length: 31 }, (_, index) => index + 1);
  const rows = getLaborEmployeesForGroup(group)
    .map((employee) => {
      if (!employee) return null;
      const labor = buildMonthlyLaborSummary(getLaborEmployeeLogId(employee), employee);
      return buildLaborLedgerEmployeeRow(labor, employee, dayNumbers);
    })
    .filter(Boolean);
  const totals = rows.reduce((sum, row) => ({
    workDays: sum.workDays + row.workDays,
    actualMinutes: sum.actualMinutes + row.actualMinutes,
    totalPay: sum.totalPay + row.totalPay,
    paidPt: sum.paidPt + row.paidPt,
  }), { workDays: 0, actualMinutes: 0, totalPay: 0, paidPt: 0 });
  return {
    id: group.id,
    title: `${monthLabel} ${group.title} 노무비 지급대장`,
    site: group.title,
    monthLabel,
    dayNumbers,
    rows,
    totals,
  };
}

function buildLaborLedgerEmployeeRow(labor, employee, dayNumbers) {
  const profile = getLaborProfileForEmployee(employee);
  const rowByDay = new Map(labor.dayRows.map((row) => [Number(row.dateKey.slice(8)), row]));
  const dayCells = dayNumbers.map((day) => {
    const row = rowByDay.get(day);
    const worked = Boolean(row?.worked);
    return {
      day,
      worked,
      label: worked ? formatLaborDayCell(row.worked) : "",
      minutes: row?.worked || 0,
    };
  });
  const workDays = dayCells.filter((cell) => cell.worked).length;
  const actualMinutes = dayCells.reduce((sum, cell) => sum + cell.minutes, 0);
  const dailyWage = numberValue(profile.dailyWage);
  const hourlyWage = numberValue(profile.hourlyWage);
  let totalPay = 0;
  let wageLabel = "단가 미입력";
  if (dailyWage) {
    totalPay = dailyWage * workDays;
    wageLabel = `${formatCurrency(dailyWage)} / 일`;
  } else if (hourlyWage) {
    totalPay = Math.round((actualMinutes / 60) * hourlyWage);
    wageLabel = `${formatCurrency(hourlyWage)} / 시간`;
  }
  return {
    employeeId: employee.id,
    employmentType: profile.employmentType || employee.employmentType || "직원",
    name: employee.name || profile.name || "이름 미입력",
    laborId: maskLaborId(profile.laborId || ""),
    address: profile.address || "주소 미입력",
    dayCells,
    workDays,
    actualMinutes,
    paidPt: labor.settlementPtCount || 0,
    wageLabel,
    totalPay,
    totalPayLabel: totalPay ? formatCurrency(totalPay) : "계산 대기",
    confirmLabel: "",
  };
}

function getLaborProfileForEmployee(employee) {
  if (!employee) return { ...defaultProfile };
  if (employee.id === "profile-user" || isEmployeeLinkedToProfile(employee.id)) {
    return { ...defaultProfile, ...(state.profile || {}) };
  }
  return {
    ...defaultProfile,
    org: employee.org || "",
    role: employee.role || "",
    name: employee.name || "",
    phone: employee.phone || "",
    email: employee.email || "",
    workplace: employee.workplace || "",
    laborId: employee.laborId || "",
    address: employee.address || "",
    joinDate: employee.joinDate || employee.join_date || "",
    payDay: employee.payDay || employee.pay_day || "",
    hourlyWage: employee.hourlyWage || "",
    dailyWage: employee.dailyWage || "",
    employmentType: employee.employmentType || "직원",
    workHours: employee.workHours || defaultProfile.workHours,
  };
}

function openLaborIntegrationRoute(route, employeeId, month) {
  const employee = getVisibleLaborEmployees().find((item) => getLaborEmployeeLogId(item) === employeeId || item.id === employeeId)
    || getEmployeeOptions().find((item) => getLaborEmployeeLogId(item) === employeeId || item.id === employeeId)
    || getOwnLaborEmployee();
  if (!canViewLaborEmployee(employeeId)) {
    showAppToast("열람 권한이 없는 직원의 노무기록입니다.");
    return;
  }
  state.selectedEmployeeId = employeeId;
  if (route === "attendance" || route === "payroll") {
    if (route === "payroll" && !canAccessLaborPayrollLedgers()) {
      showAppToast("급여·공제 항목은 노무 권한자만 확인할 수 있습니다.");
      return;
    }
    state.laborWorkspaceTab = route === "payroll" ? "payroll" : "register";
    saveState({ fastSave: true });
    renderAttendance();
    return;
  }
  if (route === "report") {
    const employeeSiteId = getReportArchiveSiteId(employee);
    const archiveSiteId = getReportArchiveSiteOptions().some((site) => site.id === employeeSiteId) ? employeeSiteId : "all";
    state.reportArchive = {
      ...getReportArchiveSettings(),
      dateKey: `${month || getActiveDateKey().slice(0, 7)}-01`,
      site: archiveSiteId,
      type: "labor",
      selectedId: `labor:${employeeId}`,
    };
    saveState({ fastSave: true });
    switchView("report");
    renderReportArchive();
    return;
  }
  if (route === "staff") {
    state.staffMasterTab = "staff-list";
    saveState({ fastSave: true });
    switchView("staff");
    window.setTimeout(() => {
      const row = getEmployeeMasterRows().find((item) => item.id === employeeId || item.mappedEmployeeId === employeeId);
      if (row) openStaffDetail(row.id);
    }, 0);
    return;
  }
  if (route === "fitness") {
    switchView("fitness-log");
    return;
  }
  switchView(canAccessWorklogOverview() ? "worklog-overview" : getUserWorklogView());
}

function renderSiteLaborCostLedger(ledger) {
  return `
    <article class="site-labor-ledger">
      <div class="site-labor-ledger-title">
        <div>
          <strong>${escapeHtml(ledger.site)}</strong>
          <span>${escapeHtml(ledger.rows.length)}명 · 출역 ${escapeHtml(String(ledger.totals.workDays))}일 · ${escapeHtml(formatMinutesAsHours(ledger.totals.actualMinutes))}</span>
        </div>
        <button type="button" data-copy-site-labor-ledger="${escapeAttr(ledger.id)}">대장 복사</button>
      </div>
      <div class="labor-cost-ledger-wrap">
        <table class="labor-cost-ledger-table site-labor-ledger-table" aria-label="${escapeAttr(ledger.site)} 노무비 지급대장">
          <thead>
            <tr>
              <th>구분</th>
              <th>성명</th>
              <th>주민등록번호</th>
              <th>주소</th>
              ${ledger.dayNumbers.map((day) => `<th>${day}</th>`).join("")}
              <th>출역일수</th>
              <th>임금</th>
              <th>총금액</th>
              <th>확인</th>
            </tr>
          </thead>
          <tbody>
            ${ledger.rows.map((row) => `
              <tr>
                <td>${escapeHtml(row.employmentType)}</td>
                <td>${escapeHtml(row.name)}</td>
                <td>${escapeHtml(row.laborId)}</td>
                <td>${escapeHtml(row.address)}</td>
                ${row.dayCells.map((cell) => `<td class="${cell.worked ? "is-worked" : ""}">${escapeHtml(cell.label)}</td>`).join("")}
                <td>${escapeHtml(String(row.workDays))}</td>
                <td>${escapeHtml(row.wageLabel)}</td>
                <td>${escapeHtml(row.totalPayLabel)}</td>
                <td>${escapeHtml(row.confirmLabel)}</td>
              </tr>
            `).join("")}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="4">합계</td>
              ${ledger.dayNumbers.map(() => "<td></td>").join("")}
              <td>${escapeHtml(String(ledger.totals.workDays))}</td>
              <td></td>
              <td>${escapeHtml(ledger.totals.totalPay ? formatCurrency(ledger.totals.totalPay) : "계산 대기")}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </article>
  `;
}

function renderWorkHistorySummary() {
  const node = document.getElementById("workHistorySummary");
  if (!node) return;
  const employeeId = getOwnLaborEmployeeId();
  const employee = getOwnLaborEmployee();
  const log = getEmployeeLogForDate(employeeId);
  const labor = buildMonthlyLaborSummary(employeeId, employee);
  const ledger = buildLaborCostLedger(labor, employee);
  const payroll = buildPayrollStatement(labor, employee, ledger);
  const workspaceTab = state.laborWorkspaceTab;
  node.innerHTML = `
    <article class="work-history-hero">
      <div class="work-history-hero-copy">
        <span class="work-history-eyebrow">${escapeHtml(getEmployeeAdminLabel(employee))}</span>
        <b class="work-history-title">노무</b>
        <em class="work-history-worktime">${escapeHtml(workspaceTab === "overview" ? (formatAttendanceSummary(log) || "실시간 출결 확인 중") : "과거 월별 기록")}</em>
        <strong>${escapeHtml(workspaceTab === "overview" ? formatFormalKoreanDate(todayKey) : formatLaborMonthHeading(labor.month))}</strong>
        <div class="work-history-hero-meta">
          <b>월별 정산 준비</b>
          <em>${escapeHtml(`${labor.recordedDays}일 기록 · 실근무 ${formatMinutesAsHours(labor.actualMinutes)}`)}</em>
        </div>
      </div>
    </article>
    ${renderLaborWorkspaceNav(labor, employee)}
    <div class="labor-workspace-panel" data-labor-active-panel="${escapeAttr(workspaceTab)}">
      ${workspaceTab === "overview" ? renderLaborOperationsConsole(labor, employee, payroll) : ""}
      ${workspaceTab === "register" ? renderLaborMonthlyRegister(labor, employee) : ""}
      ${workspaceTab === "payroll" && canAccessLaborPayrollLedgers() ? `
        ${renderPayrollStatement(payroll)}
        <section class="labor-report-launch-card">
          <header>
            <div>
              <span>Payroll Report</span>
              <h3>출력</h3>
              <p>급여명세서, 급여대장, 프리랜서 신고, PT수업 집계를 A4 보고서로 확인합니다.</p>
            </div>
            <button type="button" id="openLaborReportButton">출력</button>
          </header>
        </section>
      ` : ""}
    </div>
  `;
  document.getElementById("laborMonthPickerButton")?.addEventListener("click", () => {
    const input = document.getElementById("laborMonthInput");
    if (input?.showPicker) input.showPicker();
    else input?.click();
  });
  document.getElementById("laborMonthInput")?.addEventListener("change", (event) => {
    if (!event.target.value) return;
    state.laborWorkspaceTab = "register";
    setSelectedDateKey(`${event.target.value}-01`);
  });
  document.getElementById("laborPrevMonthButton")?.addEventListener("click", () => {
    state.laborWorkspaceTab = "register";
    shiftLaborMonth(-1);
  });
  document.getElementById("laborNextMonthButton")?.addEventListener("click", () => {
    state.laborWorkspaceTab = "register";
    shiftLaborMonth(1);
  });
  document.getElementById("laborTodayButton")?.addEventListener("click", () => {
    state.laborWorkspaceTab = "overview";
    setSelectedDateKey(todayKey);
  });
  document.getElementById("laborEmployeeSelect")?.addEventListener("change", (event) => {
    if (!canViewLaborEmployee(event.target.value)) return;
    state.selectedEmployeeId = event.target.value;
    saveState({ fastSave: true });
    renderAttendance();
  });
  node.querySelectorAll("[data-labor-workspace-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextTab = button.dataset.laborWorkspaceTab || "overview";
      state.laborWorkspaceTab = nextTab;
      if (nextTab === "overview" && getActiveDateKey() !== todayKey) {
        setSelectedDateKey(todayKey);
        return;
      }
      saveState({ fastSave: true });
      renderAttendance();
    });
  });
  node.querySelectorAll("[data-labor-jump]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = document.getElementById(button.dataset.laborJump);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      else showAppToast("해당 항목은 노무 권한자 화면에서 확인할 수 있습니다.");
    });
  });
  node.querySelectorAll("[data-labor-route]").forEach((button) => {
    button.addEventListener("click", () => {
      openLaborIntegrationRoute(
        button.dataset.laborRoute || "attendance",
        button.dataset.laborEmployeeId || employeeId,
        button.dataset.laborMonth || labor.month,
      );
    });
  });
  node.querySelectorAll("[data-labor-payroll-field]").forEach((field) => {
    field.addEventListener("change", () => {
      updateLaborPayrollField(employeeId, labor.month, field.dataset.laborPayrollField, field.value);
    });
  });
  document.getElementById("copyPayrollStatementButton")?.addEventListener("click", () => copyPayrollStatement(payroll));
  document.getElementById("openLaborReportButton")?.addEventListener("click", () => openLaborReportSheet(labor, payroll, ledger));
}

function formatLaborMonthHeading(monthKey = getActiveDateKey().slice(0, 7)) {
  const [year, month] = String(monthKey).split("-").map(Number);
  return `${year}년 ${month}월 근무현황`;
}

function renderLaborMonthlyRegister(labor, employee) {
  return `
    <section class="labor-register-card labor-register-card-primary" id="laborRegister">
      <header>
        <div>
          <span>Work Time Register</span>
          <h3>월별 근무시간 현황</h3>
          <p>${escapeHtml(getEmployeeAdminLabel(employee))} 기준 · 출결시간, 외출/복귀, 휴무, 실근무를 일자별로 기록합니다.</p>
        </div>
      </header>
      <div class="labor-register-table" role="table" aria-label="월별 근무시간 현황">
        <div class="labor-register-head" role="row">
          <span>일자</span>
          <span>요일</span>
          <span>소정</span>
          <span>출근</span>
          <span>퇴근</span>
          <span>외출</span>
          <span>실근무</span>
          <span>상태</span>
          <span>유료/무료 PT</span>
        </div>
        ${labor.dayRows.map(renderLaborDayRow).join("")}
      </div>
    </section>
  `;
}

function formatMinutesAsHours(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (!hours) return `${mins}분`;
  return mins ? `${hours}시간 ${mins}분` : `${hours}시간`;
}

function buildMonthlyLaborSummary(employeeId, employee, monthPrefix = getActiveDateKey().slice(0, 7)) {
  employeeId = getEmployeeWorklogId(employee) || employeeId;
  const monthLabel = monthPrefix.replace("-", ".");
  const logs = [];
  const dayRows = [];
  let scheduledMinutes = 0;
  let actualMinutes = 0;
  let overtimeMinutes = 0;
  let nightMinutes = 0;
  let holidayMinutes = 0;
  let paidPtCount = 0;
  let freePtCount = 0;
  let otherPtCount = 0;
  let breakCount = 0;
  let lateCount = 0;
  let earlyCount = 0;
  let absenceCount = 0;
  let leaveDays = 0;
  getMonthDateKeys(monthPrefix).forEach((dateKey) => {
    const logsByEmployee = state.employeeLogs?.[dateKey] || {};
    if (!dateKey.startsWith(monthPrefix)) return;
    const dayLog = logsByEmployee?.[employeeId];
    const scheduled = getWorkHoursDurationMinutes(getEmployeeWorkHours(employeeId, state.profile, dateKey));
    scheduledMinutes += scheduled;
    let worked = 0;
    let ops = createFitnessOps();
    let status = scheduled ? "미기록" : "휴무";
    if (dayLog) {
      syncFitnessOpsFromSchedule(dayLog);
      ops = { ...createFitnessOps(), ...(dayLog.fitnessOps || {}) };
      paidPtCount += numberValue(ops.ptRegular);
      freePtCount += numberValue(ops.ptFree);
      otherPtCount += numberValue(ops.ptOther);
      status = getAttendanceStatusForLog(employee, dayLog, dateKey);
    }
    if (dayLog?.clockIn && dayLog?.clockOut) {
      const range = getTimeRangeMinutes(dayLog.clockIn, dayLog.clockOut);
      worked = range.duration;
      actualMinutes += worked;
      overtimeMinutes += Math.max(0, worked - Math.min(scheduled || 8 * 60, 8 * 60));
      nightMinutes += getNightWorkMinutes(range.start, range.end);
      if ([0, 6].includes(parseDateKey(dateKey).getDay())) holidayMinutes += worked;
    }
    breakCount += (dayLog?.attendanceBreaks || []).filter((item) => item.start || item.end).length;
    if (status.includes("지각")) lateCount += 1;
    if (status.includes("조퇴")) earlyCount += 1;
    if (status.includes("결근")) absenceCount += 1;
    if (/휴가|연차|월차/.test(status)) leaveDays += 1;
    const breakSummary = (dayLog?.attendanceBreaks || [])
      .filter((item) => item.start || item.end)
      .map((item) => `${item.start || "--:--"}~${item.end || "--:--"}`)
      .join(" / ");
    const row = {
      dateKey,
      weekday: hanjaWeekdays[parseDateKey(dateKey).getDay()],
      scheduled,
      clockIn: dayLog?.clockIn || "",
      clockOut: dayLog?.clockOut || "",
      breakSummary,
      worked,
      status,
      paidPt: numberValue(ops.ptRegular) + numberValue(ops.ptOther),
      freePt: numberValue(ops.ptFree),
    };
    dayRows.push(row);
    if (worked || dayLog?.clockIn || dayLog?.clockOut || dayLog?.attendanceStatus) {
      logs.push({ dateKey, clockIn: dayLog.clockIn || "", clockOut: dayLog.clockOut || "", status, worked });
    }
  });
  const laborProfile = getLaborProfileForEmployee(employee);
  const employmentType = String(laborProfile.employmentType || employee.employmentType || "직원");
  const settlementPtCount = paidPtCount + otherPtCount;
  const cards = [
    ["직원", getEmployeeAdminLabel(employee)],
    ["고용형태", employmentType],
    ["근무월", monthLabel],
    ["기록일", `${logs.length}일`],
    ["소정근무", formatMinutesAsHours(scheduledMinutes)],
    ["실근무", formatMinutesAsHours(actualMinutes)],
    ["연장추정", formatMinutesAsHours(overtimeMinutes)],
    ["야간추정", formatMinutesAsHours(nightMinutes)],
    ["휴일/주말", formatMinutesAsHours(holidayMinutes)],
    ["유료 PT", `${settlementPtCount}건`],
    ["무료 PT", `${freePtCount}건`],
    ["지각", `${lateCount}건`],
    ["조퇴", `${earlyCount}건`],
    ["결근", `${absenceCount}건`],
    ["월차/연차", `${leaveDays}일`],
    ["외출", `${breakCount}건`],
  ];
  return { employee, monthLabel, month: monthPrefix, cards, logs, dayRows, scheduledMinutes, actualMinutes, overtimeMinutes, nightMinutes, holidayMinutes, paidPtCount, freePtCount, otherPtCount, settlementPtCount, lateCount, earlyCount, absenceCount, leaveDays, breakCount, recordedDays: logs.length };
}

function getOwnLaborEmployeeId() {
  if (state.selectedEmployeeId && canViewLaborEmployee(state.selectedEmployeeId)) return state.selectedEmployeeId;
  const profileEmployee = getProfileEmployee();
  const profileEmployeeId = getLaborEmployeeLogId(profileEmployee);
  if (profileEmployeeId && canViewLaborEmployee(profileEmployeeId)) return profileEmployeeId;
  const visibleEmployee = getVisibleLaborEmployees()[0];
  if (visibleEmployee) return getLaborEmployeeLogId(visibleEmployee);
  return state.fitnessWritableEmployeeId || state.selectedEmployeeId || "profile-user";
}

function getOwnLaborEmployee() {
  const employeeId = getOwnLaborEmployeeId();
  return getVisibleLaborEmployees().find((item) => getLaborEmployeeLogId(item) === employeeId || item.id === employeeId)
    || getEmployeeOptions().find((item) => item.id === employeeId)
    || getProfileEmployee();
}

function getMonthDateKeys(monthPrefix) {
  const [year, month] = monthPrefix.split("-").map(Number);
  const days = new Date(year, month, 0).getDate();
  return Array.from({ length: days }, (_, index) => `${monthPrefix}-${String(index + 1).padStart(2, "0")}`);
}

function renderLaborDayRow(row) {
  const isWeekend = row.weekday === "土" || row.weekday === "日";
  return `
    <div class="labor-register-row ${isWeekend ? "is-weekend" : ""}" role="row">
      <span>${escapeHtml(row.dateKey.slice(8))}</span>
      <span>${escapeHtml(row.weekday)}</span>
      <span>${escapeHtml(row.scheduled ? formatMinutesAsHours(row.scheduled) : "-")}</span>
      <span>${escapeHtml(row.clockIn || "-")}</span>
      <span>${escapeHtml(row.clockOut || "-")}</span>
      <span>${escapeHtml(row.breakSummary || "-")}</span>
      <strong>${escapeHtml(row.worked ? formatMinutesAsHours(row.worked) : "-")}</strong>
      <span>${escapeHtml(row.status)}</span>
      <span>${escapeHtml(`${row.paidPt}/${row.freePt}`)}</span>
    </div>
  `;
}

function getLaborReportFileBase(labor) {
  const employee = labor?.employee || getOwnLaborEmployee();
  const name = (employee?.name || "직원").replace(/[^\w가-힣-]+/g, "-");
  const mode = laborReportModes.find(([value]) => value === currentLaborReportMode)?.[1] || "노무";
  const modeSlug = mode.replace(/[^\w가-힣-]+/g, "-");
  return `bangju-labor-${labor?.month || getActiveDateKey().slice(0, 7)}-${name}-${modeSlug}`;
}

function getLaborReportCanvasSize(mode = currentLaborReportMode) {
  return mode === "payroll"
    ? { width: 1240, height: 1754, orientation: "portrait" }
    : { width: 1754, height: 1240, orientation: "landscape" };
}

function getLaborReportExportCss() {
  return `
    * { box-sizing: border-box; }
    body { margin: 0; background: #fffefa; color: #17221d; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .labor-paper {
      width: 1754px;
      height: 1240px;
      overflow: hidden;
      background: #fffefa;
      padding: 52px;
      color: #17221d;
    }
    .labor-paper-portrait {
      width: 1240px;
      height: 1754px;
      padding: 54px 66px;
    }
    .labor-paper-landscape {
      width: 1754px;
      height: 1240px;
    }
    .labor-paper-title {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 430px;
      border: 3px solid #0f3b2e;
    }
    .labor-paper-title strong {
      display: grid;
      align-items: center;
      min-height: 118px;
      background: #0f3b2e;
      color: #fffefa;
      padding: 22px 28px;
      font-size: 42px;
      font-weight: 950;
      letter-spacing: 0;
    }
    .labor-paper-title div {
      display: grid;
      grid-template-columns: 128px minmax(0, 1fr);
      border-left: 3px solid #0f3b2e;
    }
    .labor-paper-title span,
    .labor-paper-title b {
      display: grid;
      align-items: center;
      min-height: 39px;
      border-bottom: 2px solid rgba(15, 59, 46, 0.38);
      padding: 8px 12px;
      font-size: 22px;
      line-height: 1.1;
    }
    .labor-paper-title span {
      background: #eef4e9;
      font-weight: 900;
      text-align: center;
    }
    .labor-paper-title b {
      font-weight: 950;
    }
    .labor-paper-summary {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 10px;
      margin-top: 18px;
    }
    .labor-paper-summary span {
      display: grid;
      gap: 4px;
      min-height: 76px;
      border: 2px solid rgba(15, 59, 46, 0.24);
      background: #f6f7f1;
      padding: 12px;
    }
    .labor-paper-summary b { color: #65746d; font-size: 17px; font-weight: 900; }
    .labor-paper-summary strong { color: #0f3b2e; font-size: 27px; font-weight: 950; }
    .labor-paper-grid {
      display: grid;
      grid-template-columns: 0.72fr 1.28fr;
      gap: 18px;
      margin-top: 18px;
      min-height: 0;
    }
    .labor-paper-section {
      border: 3px solid #0f3b2e;
      background: #fffefa;
    }
    .labor-paper-section h3 {
      margin: 0;
      border-bottom: 2px solid rgba(15, 59, 46, 0.3);
      background: #eef4e9;
      padding: 12px 16px;
      font-size: 24px;
      font-weight: 950;
    }
    .labor-paper-section table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 16px;
    }
    .labor-paper-section th,
    .labor-paper-section td {
      height: 34px;
      border-right: 1px solid rgba(15, 59, 46, 0.26);
      border-bottom: 1px solid rgba(15, 59, 46, 0.26);
      padding: 6px 7px;
      text-align: center;
      vertical-align: middle;
    }
    .labor-paper-section th {
      background: #f3f6ef;
      font-weight: 950;
    }
    .labor-paper-pay td:nth-child(1),
    .labor-paper-pay th:nth-child(1) { text-align: left; }
    .labor-paper-register th,
    .labor-paper-register td {
      height: 25px;
      padding: 3px;
      font-size: 13px;
    }
    .labor-paper-ledger {
      grid-column: 1 / -1;
      margin-top: 18px;
    }
    .labor-paper-ledger table { font-size: 12px; }
    .labor-paper-ledger th,
    .labor-paper-ledger td {
      height: 24px;
      padding: 2px 3px;
    }
    .labor-paper-ledger th:nth-child(1),
    .labor-paper-ledger td:nth-child(1) { width: 62px; }
    .labor-paper-ledger th:nth-child(2),
    .labor-paper-ledger td:nth-child(2) { width: 70px; }
    .labor-paper-ledger th:nth-child(3),
    .labor-paper-ledger td:nth-child(3) { width: 96px; }
    .labor-paper-ledger th:nth-child(4),
    .labor-paper-ledger td:nth-child(4) { width: 132px; text-align: left; }
    .labor-paper-ledger th:nth-last-child(-n + 4),
    .labor-paper-ledger td:nth-last-child(-n + 4) { width: 66px; }
    .labor-paper-simple-title {
      display: grid;
      grid-template-columns: 220px minmax(0, 1fr) 260px;
      align-items: center;
      min-height: 72px;
      border: 3px solid #17221d;
      text-align: center;
    }
    .labor-paper-simple-title span,
    .labor-paper-simple-title b {
      display: grid;
      align-items: center;
      height: 100%;
      background: #eef4e9;
      color: #17221d;
      padding: 10px;
      font-size: 20px;
      font-weight: 900;
    }
    .labor-paper-simple-title strong {
      color: #17221d;
      font-size: 34px;
      font-weight: 950;
    }
    .labor-paper-wide-table {
      margin-top: 18px;
    }
    .labor-paper-wide-table table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 12px;
    }
    .labor-paper-wide-table th,
    .labor-paper-wide-table td {
      height: 28px;
      border: 1px solid rgba(23, 34, 29, 0.55);
      padding: 3px;
      text-align: center;
      vertical-align: middle;
    }
    .labor-paper-wide-table th {
      background: #eaf2e6;
      font-weight: 950;
    }
    .labor-paper-ledger-mode .labor-paper-wide-table table {
      font-size: 11px;
    }
    .labor-paper-signline {
      margin-top: 30px;
      color: #17221d;
      font-size: 18px;
      font-weight: 850;
      text-align: center;
    }
    .labor-paper-note {
      margin-top: 10px;
      color: #5e6b65;
      font-size: 14px;
      font-weight: 760;
    }
    .payroll-form-title {
      margin: 0 0 18px;
      border-bottom: 3px solid #17221d;
      padding-bottom: 14px;
      color: #17221d;
      font-size: 38px;
      font-weight: 950;
      text-align: center;
    }
    .payroll-form-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 14px;
    }
    .payroll-form-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      color: #17221d;
      font-size: 15px;
    }
    .payroll-form-table th,
    .payroll-form-table td {
      height: 32px;
      border: 1px dotted rgba(23, 34, 29, 0.76);
      padding: 5px 7px;
      vertical-align: middle;
    }
    .payroll-form-table th {
      background: #eaf2e6;
      font-weight: 950;
      text-align: center;
    }
    .payroll-form-table td:nth-child(2),
    .payroll-form-table td:nth-child(4) {
      text-align: right;
      font-weight: 850;
    }
    .payroll-form-wide {
      grid-column: 1 / -1;
    }
    .payroll-form-message {
      margin-top: 28px;
      border-top: 2px solid #17221d;
      padding-top: 22px;
      color: #17221d;
      font-size: 20px;
      font-weight: 780;
      line-height: 1.7;
      text-align: center;
    }
  `;
}

function renderLaborPayrollReportTemplate(labor, payroll, ledger) {
  const payRows = payroll.wageItems.slice(0, 9);
  const deductionRows = payroll.deductionItems.slice(0, 8);
  const workRows = [
    ["기본 근로시간", formatMinutesAsHours(labor.scheduledMinutes)],
    ["고정연장 근로시간", formatMinutesAsHours(Math.min(labor.overtimeMinutes, 40 * 60))],
    ["고정법정휴일 근로시간", formatMinutesAsHours(labor.holidayMinutes)],
    ["연장 근로시간", formatMinutesAsHours(labor.overtimeMinutes)],
    ["휴일 근로시간", formatMinutesAsHours(labor.holidayMinutes)],
  ];
  const formulaRows = [
    ["연장근로수당", "연장근로시간 × 통상시급 × 1.5"],
    ["휴일근로수당", "휴일근로시간 × 통상시급 × 1.5"],
    ["국민연금", "기준소득월액 × 4.5%"],
    ["건강보험", "과세대상임금 × 3.545%"],
    ["장기요양보험", "건강보험료 × 장기요양요율"],
    ["고용보험", "과세대상임금 × 0.9%"],
    ["근로소득세", "간이세액표 또는 프리랜서 원천징수 기준"],
  ];
  return `
    <article class="labor-paper labor-paper-portrait labor-paper-payroll-mode">
      <h1 class="payroll-form-title">${escapeHtml(String(labor.month).replace("-", "년 "))}월 급여명세서</h1>
      <div class="payroll-form-grid">
        <table class="payroll-form-table payroll-form-wide">
          <tbody>
            <tr>
              <th>인적사항</th><td>${escapeHtml(payroll.workerName)}</td>
              <th>생년/식별</th><td>${escapeHtml(maskLaborId(payroll.workerId))}</td>
              <th>급여지급일</th><td>${escapeHtml(payroll.payDate)}</td>
            </tr>
            <tr>
              <th>소속</th><td>${escapeHtml(payroll.org)}</td>
              <th>근무지</th><td>${escapeHtml(payroll.workplace)}</td>
              <th>입사일</th><td>${escapeHtml(getLaborProfileForEmployee(labor.employee).joinDate || "-")}</td>
            </tr>
          </tbody>
        </table>
        <table class="payroll-form-table">
          <thead><tr><th colspan="2">지급내역</th></tr><tr><th>지급항목</th><th>지급금액(원)</th></tr></thead>
          <tbody>
            ${payRows.map(([label, amount]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(formatCurrency(amount) || "-")}</td></tr>`).join("")}
            <tr><th>지급합계</th><td>${escapeHtml(formatCurrency(payroll.grossPay) || "-")}</td></tr>
          </tbody>
        </table>
        <table class="payroll-form-table">
          <thead><tr><th colspan="2">공제내역</th></tr><tr><th>공제항목</th><th>공제금액(원)</th></tr></thead>
          <tbody>
            ${deductionRows.map(([label, amount]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(formatCurrency(amount) || "-")}</td></tr>`).join("")}
            <tr><th>공제합계</th><td>${escapeHtml(formatCurrency(payroll.deductionTotal) || "-")}</td></tr>
            <tr><th>실수령액</th><td>${escapeHtml(formatCurrency(payroll.netPay) || "-")}</td></tr>
          </tbody>
        </table>
        <table class="payroll-form-table payroll-form-wide">
          <thead><tr><th colspan="5">근로시간</th></tr></thead>
          <tbody>
            <tr>${workRows.map(([label]) => `<th>${escapeHtml(label)}</th>`).join("")}</tr>
            <tr>${workRows.map(([, value]) => `<td>${escapeHtml(value)}</td>`).join("")}</tr>
          </tbody>
        </table>
        <table class="payroll-form-table payroll-form-wide">
          <thead><tr><th>구분</th><th>항목별 계산방법</th></tr></thead>
          <tbody>
            ${formulaRows.map(([label, formula]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(formula)}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>
      <div class="payroll-form-message">
        <div>${escapeHtml(formatFormalKoreanDate(getActiveDateKey()))}</div>
        <p>방주 가족 여러분 금월 수고 많으셨습니다.</p>
        <strong>주식회사 방주</strong>
      </div>
    </article>
  `;
}

const laborReportModes = [
  ["payroll", "① 급여명세서"],
  ["ledger", "② 노무비 지급대장"],
  ["freelancer", "③ 프리랜서 신고"],
  ["pt", "④ PT수업 집계"],
];

let currentLaborReportMode = "payroll";

function renderLaborReportTemplate(labor, payroll, ledger) {
  if (currentLaborReportMode === "ledger") return renderLaborWageLedgerReportTemplate(labor, payroll, ledger);
  if (currentLaborReportMode === "freelancer") return renderLaborFreelancerReportTemplate(labor, payroll, ledger);
  if (currentLaborReportMode === "pt") return renderLaborPtClassReportTemplate(labor, payroll, ledger);
  return renderLaborPayrollReportTemplate(labor, payroll, ledger);
}

function getLaborEmployeeSiteGroup(employeeId) {
  return getWorklogSiteGroups().find((group) => group.employeeIds.includes(employeeId)) || getWorklogSiteGroups()[0];
}

function getCurrentLaborSiteLedger(labor) {
  const group = getLaborEmployeeSiteGroup(labor?.employee?.id);
  return buildSiteLaborCostLedger(group?.id);
}

function renderLaborWageLedgerReportTemplate(labor) {
  const siteLedger = getCurrentLaborSiteLedger(labor);
  const days = siteLedger.dayNumbers;
  const laborEmployees = getVisibleLaborEmployees();
  const rowModels = siteLedger.rows.map((row) => {
    const employee = laborEmployees.find((item) => getLaborEmployeeLogId(item) === row.employeeId || item.id === row.employeeId)
      || employees.find((item) => item.id === row.employeeId)
      || { id: row.employeeId, name: row.name, employmentType: row.employmentType };
    const summary = buildMonthlyLaborSummary(getLaborEmployeeLogId(employee), employee);
    const statement = buildPayrollStatement(summary, employee, row);
    return { row, employee, statement };
  });
  const totals = rowModels.reduce((sum, item) => ({
    grossPay: sum.grossPay + (item.statement.grossPay || item.row.totalPay || 0),
    deductionTotal: sum.deductionTotal + (item.statement.deductionTotal || 0),
    netPay: sum.netPay + (item.statement.netPay || item.row.totalPay || 0),
  }), { grossPay: 0, deductionTotal: 0, netPay: 0 });
  return `
    <article class="labor-paper labor-paper-landscape labor-paper-ledger-mode">
      <header class="labor-paper-simple-title">
        <span>총인원 ${escapeHtml(String(rowModels.length))}</span>
        <strong>${escapeHtml(siteLedger.monthLabel)} 노무비 지급대장</strong>
        <b>${escapeHtml(siteLedger.site)}</b>
      </header>
      <section class="labor-paper-section labor-paper-wide-table">
        <table>
          <thead>
            <tr>
              <th rowspan="2">순번</th><th rowspan="2">성명</th><th rowspan="2">직책</th><th rowspan="2">주민/식별</th>
              <th colspan="${days.length}">작업/근무 일수 표시</th>
              <th rowspan="2">출력일수</th><th rowspan="2">총시간</th><th rowspan="2">지급총액</th>
              <th rowspan="2">공제액</th><th rowspan="2">실지급액</th><th rowspan="2">확인</th>
            </tr>
            <tr>
              ${days.map((day) => `<th>${day}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${rowModels.map(({ row, employee, statement }, index) => {
              const profile = getLaborProfileForEmployee(employee);
              const gross = statement.grossPay || row.totalPay || 0;
              const deductionTotal = statement.deductionTotal || 0;
              const netPay = statement.netPay || Math.max(0, gross - deductionTotal);
              return `
                <tr>
                  <td>${index + 1}</td>
                  <td>${escapeHtml(row.name)}</td>
                  <td>${escapeHtml(employee.role || row.employmentType)}</td>
                  <td>${escapeHtml(maskLaborId(profile.laborId || ""))}</td>
                  ${row.dayCells.map((cell) => `<td>${escapeHtml(cell.label || "")}</td>`).join("")}
                  <td>${escapeHtml(String(row.workDays || 0))}</td>
                  <td>${escapeHtml(formatMinutesAsHours(row.actualMinutes))}</td>
                  <td>${escapeHtml(gross ? formatCurrency(gross) : "계산 대기")}</td>
                  <td>${escapeHtml(deductionTotal ? formatCurrency(deductionTotal) : "-")}</td>
                  <td>${escapeHtml(netPay ? formatCurrency(netPay) : "계산 대기")}</td>
                  <td></td>
                </tr>
              `;
            }).join("")}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="${4 + days.length}">합계</td>
              <td>${escapeHtml(String(siteLedger.totals.workDays || 0))}</td>
              <td>${escapeHtml(formatMinutesAsHours(siteLedger.totals.actualMinutes))}</td>
              <td>${escapeHtml(totals.grossPay ? formatCurrency(totals.grossPay) : "계산 대기")}</td>
              <td>${escapeHtml(totals.deductionTotal ? formatCurrency(totals.deductionTotal) : "-")}</td>
              <td>${escapeHtml(totals.netPay ? formatCurrency(totals.netPay) : "계산 대기")}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </section>
      <p class="labor-paper-note">출결기록, 시급·일당, 공제항목 확정 후 노무사 제출용 급여대장으로 사용하세요.</p>
    </article>
  `;
}

function renderLaborFreelancerReportTemplate(labor) {
  const siteLedger = getCurrentLaborSiteLedger(labor);
  const days = siteLedger.dayNumbers;
  const freelancerRows = siteLedger.rows.filter((row) => /프리랜서|트레이너|자유/i.test(row.employmentType) || /트레이너/.test(row.name));
  const rows = freelancerRows.length ? freelancerRows : siteLedger.rows;
  return `
    <article class="labor-paper labor-paper-landscape labor-paper-freelancer-mode">
      <header class="labor-paper-simple-title">
        <span>[별지 제14호의2서식]</span>
        <strong>프리랜서(자유소득자) 국세청 등록 (${escapeHtml(labor.monthLabel)}분)</strong>
        <b>자료마감일 매월 5일</b>
      </header>
      <section class="labor-paper-section labor-paper-wide-table">
        <table>
          <thead>
            <tr>
              <th>사업장관리번호</th><th>사업장명</th><th>대표자명</th><th>성명</th><th>주민등록번호</th><th>계약직종</th>
              ${days.map((day) => `<th>${day}</th>`).join("")}
              <th>월급총액</th><th>세율공제</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                <td>199-86-02068-0</td>
                <td>${escapeHtml(siteLedger.site)}</td>
                <td>정찬훈</td>
                <td>${escapeHtml(row.name)}</td>
                <td>${escapeHtml(row.laborId)}</td>
                <td>${escapeHtml(row.employmentType)}</td>
                ${row.dayCells.map((cell) => `<td>${cell.worked ? "1" : ""}</td>`).join("")}
                <td>${escapeHtml(row.totalPay ? formatCurrency(row.totalPay) : "계산 대기")}</td>
                <td>${escapeHtml(row.totalPay ? formatCurrency(Math.round(row.totalPay * 0.033)) : "-")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </section>
      <div class="labor-paper-signline">작성일 ${escapeHtml(formatFormalKoreanDate(getActiveDateKey()))} · 작성인(대표자) __________________</div>
    </article>
  `;
}

function renderLaborPtClassReportTemplate(labor) {
  const fitnessGroup = getWorklogSiteGroups().find((group) => /피트니스/.test(group.title)) || getLaborEmployeeSiteGroup(labor?.employee?.id);
  const rows = (fitnessGroup?.employeeIds || [])
    .map((employeeId) => {
      const employee = employees.find((item) => item.id === employeeId);
      if (!employee) return null;
      const summary = buildMonthlyLaborSummary(employeeId, employee);
      return { employee, summary };
    })
    .filter(Boolean);
  const days = Array.from({ length: 31 }, (_, index) => index + 1);
  return `
    <article class="labor-paper labor-paper-landscape labor-paper-pt-mode">
      <header class="labor-paper-simple-title">
        <span>피트니스 전용</span>
        <strong>비욘드 피트니스 (${escapeHtml(String(Number(labor.month.slice(5))))}월) PT수업</strong>
        <b>무료수업 제외 정산</b>
      </header>
      <section class="labor-paper-section labor-paper-wide-table labor-paper-pt-table">
        <table>
          <thead>
            <tr><th>순번</th><th>이름</th>${days.map((day) => `<th>${day}</th>`).join("")}<th>유료합계</th><th>무료</th></tr>
          </thead>
          <tbody>
            ${rows.map(({ employee, summary }, index) => {
              const rowByDay = new Map(summary.dayRows.map((row) => [Number(row.dateKey.slice(8)), row]));
              return `
                <tr>
                  <td>${index + 1}</td>
                  <td>${escapeHtml(getEmployeeAdminLabel(employee))}</td>
                  ${days.map((day) => {
                    const row = rowByDay.get(day);
                    return `<td>${escapeHtml(row?.paidPt ? String(row.paidPt) : "")}</td>`;
                  }).join("")}
                  <td>${escapeHtml(String(summary.settlementPtCount))}</td>
                  <td>${escapeHtml(String(summary.freePtCount))}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </section>
      <p class="labor-paper-note">업무일지 시간별 일정의 유료PT/무료PT 구분을 기준으로 집계합니다. 무료PT는 정산 합계에서 제외됩니다.</p>
    </article>
  `;
}

function ensureLaborReportSheet() {
  let sheet = document.getElementById("laborReportSheet");
  if (sheet) return sheet;
  document.body.insertAdjacentHTML("beforeend", `
    <div class="labor-report-backdrop" id="laborReportBackdrop" hidden></div>
    <section class="labor-report-sheet" id="laborReportSheet" hidden role="dialog" aria-modal="true" aria-labelledby="laborReportTitle">
      <header>
        <div>
          <span>Payroll & Labor Ledger</span>
          <h2 id="laborReportTitle">노무 출력</h2>
        </div>
        <button type="button" id="laborReportCloseButton" aria-label="급여명세서 닫기">×</button>
      </header>
      <div class="labor-report-mode-tabs" id="laborReportModeTabs" aria-label="노무 출력 양식 선택">
        ${laborReportModes.map(([mode, label]) => `
          <button type="button" data-labor-report-mode="${escapeAttr(mode)}">${escapeHtml(label)}</button>
        `).join("")}
      </div>
      <div class="labor-report-preview" id="laborReportPreview"></div>
      <footer>
        <button type="button" id="laborReportExcelButton">엑셀</button>
        <button type="button" id="laborReportImageButton">JPEG</button>
        <button type="button" id="laborReportPdfButton">PDF</button>
        <button type="button" id="laborReportShareButton">보내기</button>
        <button type="button" id="laborReportPrintButton">출력</button>
      </footer>
    </section>
  `);
  sheet = document.getElementById("laborReportSheet");
  document.getElementById("laborReportBackdrop")?.addEventListener("click", closeLaborReportSheet);
  document.getElementById("laborReportCloseButton")?.addEventListener("click", closeLaborReportSheet);
  document.getElementById("laborReportPrintButton")?.addEventListener("click", printLaborReport);
  document.getElementById("laborReportExcelButton")?.addEventListener("click", () => {
    saveLaborReportExcel().catch(() => alert("엑셀 파일을 만들지 못했습니다. 잠시 후 다시 시도해주세요."));
  });
  document.getElementById("laborReportImageButton")?.addEventListener("click", () => {
    saveLaborReportImage().catch(() => alert("이미지 파일을 만들지 못했습니다. 출력 메뉴에서 PDF 저장을 이용해주세요."));
  });
  document.getElementById("laborReportPdfButton")?.addEventListener("click", () => {
    saveLaborReportPdf().catch(() => alert("PDF 파일을 만들지 못했습니다. 출력 메뉴에서 브라우저 저장을 이용해주세요."));
  });
  document.getElementById("laborReportShareButton")?.addEventListener("click", () => {
    shareLaborReport().catch(() => alert("보내기 기능을 사용할 수 없어 사진저장 또는 출력 메뉴를 이용해주세요."));
  });
  sheet.querySelectorAll("[data-labor-report-mode]").forEach((button) => {
    button.addEventListener("click", () => setLaborReportMode(button.dataset.laborReportMode));
  });
  return sheet;
}

let currentLaborReportModel = null;

function setLaborReportMode(mode = "payroll") {
  currentLaborReportMode = laborReportModes.some(([value]) => value === mode) ? mode : "payroll";
  document.body.classList.toggle("is-labor-report-portrait", currentLaborReportMode === "payroll");
  document.body.classList.toggle("is-labor-report-landscape", currentLaborReportMode !== "payroll");
  const preview = document.getElementById("laborReportPreview");
  const title = laborReportModes.find(([value]) => value === currentLaborReportMode)?.[1] || "노무 출력";
  const titleNode = document.getElementById("laborReportTitle");
  if (titleNode) titleNode.textContent = title;
  document.querySelectorAll("[data-labor-report-mode]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.laborReportMode === currentLaborReportMode);
  });
  if (preview && currentLaborReportModel) {
    preview.innerHTML = renderLaborReportTemplate(
      currentLaborReportModel.labor,
      currentLaborReportModel.payroll,
      currentLaborReportModel.ledger,
    );
  }
}

function openLaborReportSheet(labor, payroll, ledger) {
  currentLaborReportModel = { labor, payroll, ledger };
  const sheet = ensureLaborReportSheet();
  const backdrop = document.getElementById("laborReportBackdrop");
  setLaborReportMode(currentLaborReportMode || "payroll");
  if (backdrop) backdrop.hidden = false;
  sheet.hidden = false;
  document.body.classList.add("is-labor-report-open");
}

function closeLaborReportSheet() {
  document.getElementById("laborReportBackdrop")?.setAttribute("hidden", "");
  document.getElementById("laborReportSheet")?.setAttribute("hidden", "");
  document.body.classList.remove("is-labor-report-open", "is-printing-labor-report");
}

async function renderLaborReportCanvas() {
  if (!currentLaborReportModel) throw new Error("급여명세서 모델이 없습니다.");
  const { width, height } = getLaborReportCanvasSize();
  const html = `
    <div xmlns="http://www.w3.org/1999/xhtml">
      <style>${getLaborReportExportCss()}</style>
      ${renderLaborReportTemplate(currentLaborReportModel.labor, currentLaborReportModel.payroll, currentLaborReportModel.ledger)}
    </div>
  `;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <foreignObject width="${width}" height="${height}">${html}</foreignObject>
    </svg>
  `;
  if (document.fonts?.ready) await document.fonts.ready;
  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fffefa";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function createLaborPdfBlobFromCanvas(canvas) {
  const encoder = new TextEncoder();
  const jpegBytes = dataUrlToUint8Array(canvas.toDataURL("image/jpeg", 0.92));
  const isPortrait = canvas.height > canvas.width;
  const pageWidth = isPortrait ? 595.28 : 841.89;
  const pageHeight = isPortrait ? 841.89 : 595.28;
  const content = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im0 Do\nQ`;
  const objects = [
    encoder.encode("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"),
    encoder.encode("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"),
    encoder.encode(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>\nendobj\n`),
    encoder.encode(`4 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`),
    concatUint8Arrays([
      encoder.encode(`5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`),
      jpegBytes,
      encoder.encode("\nendstream\nendobj\n"),
    ]),
  ];
  const chunks = [encoder.encode("%PDF-1.4\n%\n")];
  const offsets = [0];
  let length = chunks[0].length;
  objects.forEach((object) => {
    offsets.push(length);
    chunks.push(object);
    length += object.length;
  });
  const xrefStart = length;
  const xref = [
    "xref",
    `0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `),
    "trailer",
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    "startxref",
    String(xrefStart),
    "%%EOF",
  ].join("\n");
  chunks.push(encoder.encode(xref));
  return new Blob(chunks, { type: "application/pdf" });
}

async function saveLaborReportImage() {
  const canvas = await renderLaborReportCanvas();
  const blob = await canvasToBlob(canvas, "image/jpeg", 0.94);
  downloadBlob(blob, `${getLaborReportFileBase(currentLaborReportModel?.labor)}.jpg`);
}

async function saveLaborReportPdf() {
  const canvas = await renderLaborReportCanvas();
  const blob = createLaborPdfBlobFromCanvas(canvas);
  downloadBlob(blob, `${getLaborReportFileBase(currentLaborReportModel?.labor)}.pdf`);
}

async function shareLaborReport() {
  const canvas = await renderLaborReportCanvas();
  const jpegBlob = await canvasToBlob(canvas, "image/jpeg", 0.94);
  const pdfBlob = createLaborPdfBlobFromCanvas(canvas);
  const base = getLaborReportFileBase(currentLaborReportModel?.labor);
  const jpegFile = new File([jpegBlob], `${base}.jpg`, { type: "image/jpeg" });
  const pdfFile = new File([pdfBlob], `${base}.pdf`, { type: "application/pdf" });
  if (navigator.canShare?.({ files: [jpegFile, pdfFile] }) && navigator.share) {
    await navigator.share({
      title: "Bangju Labor Report",
      text: "방주 AI Worklog 노무 출력물입니다.",
      files: [jpegFile, pdfFile],
    });
    return;
  }
  if (navigator.canShare?.({ files: [jpegFile] }) && navigator.share) {
    await navigator.share({
      title: "Bangju Labor Report",
      text: "방주 AI Worklog 노무 출력물 이미지입니다.",
      files: [jpegFile],
    });
    return;
  }
  await saveLaborReportPdf();
}

async function saveLaborReportExcel() {
  if (!currentLaborReportModel) throw new Error("노무 출력 모델이 없습니다.");
  const { labor, payroll } = currentLaborReportModel;
  const workbook = buildLaborReportWorkbookBlob(labor, payroll);
  downloadBlob(workbook, `${getLaborReportFileBase(labor)}.xlsx`);
}

function buildLaborReportWorkbookBlob(labor, payroll) {
  const siteLedger = getCurrentLaborSiteLedger(labor);
  return buildXlsxWorkbookBlob([
    { name: "급여명세서", rows: buildPayrollSheetRows(labor, payroll), widths: [18, 18, 18, 18, 18, 18, 18] },
    { name: "노무비지급대장", rows: buildWageLedgerSheetRows(siteLedger), widths: [7, 14, 14, 14, ...Array(31).fill(4), 8, 9, 12, 10, 12, 8] },
    { name: "프리랜서신고", rows: buildFreelancerSheetRows(siteLedger, labor), widths: Array(39).fill(9) },
    { name: "PT수업집계", rows: buildPtClassSheetRows(labor), widths: Array(35).fill(8) },
  ]);
}

function buildPayrollSheetRows(labor, payroll) {
  const rows = [
    [{ v: `${String(labor.month).replace("-", "년 ")}월 급여명세서` }],
    [],
    ["인적사항", "성명", payroll.workerName, "급여지급일", payroll.payDate, "입사일", getLaborProfileForEmployee(labor.employee).joinDate || ""],
    ["", "생년/식별", maskLaborId(payroll.workerId), "소속", payroll.org, "근무지", payroll.workplace],
    [],
    ["지급내역", "", "", "공제내역"],
    ["지급항목", "지급금액(원)", "", "공제항목", "공제금액(원)"],
  ];
  const wageStart = rows.length + 1;
  const maxRows = Math.max(payroll.wageItems.length, payroll.deductionItems.length, 9);
  for (let index = 0; index < maxRows; index += 1) {
    const wage = payroll.wageItems[index] || ["", ""];
    const deduction = payroll.deductionItems[index] || ["", ""];
    rows.push([wage[0], numberValue(wage[1]) || "", "", deduction[0], numberValue(deduction[1]) || ""]);
  }
  const wageEnd = rows.length;
  rows.push(["지급합계", { f: `SUM(B${wageStart}:B${wageEnd})`, v: payroll.grossPay || 0 }, "", "공제합계", { f: `SUM(E${wageStart}:E${wageEnd})`, v: payroll.deductionTotal || 0 }]);
  rows.push(["", "", "", "실수령액", { f: `B${rows.length}-E${rows.length}`, v: payroll.netPay || 0 }]);
  rows.push([]);
  rows.push(["근로시간", "기본 근로시간", "고정연장 근로시간", "고정법정휴일 근로시간", "연장 근로시간", "휴일 근로시간"]);
  rows.push([
    "",
    labor.scheduledMinutes ? Math.round((labor.scheduledMinutes / 60) * 100) / 100 : 0,
    labor.overtimeMinutes ? Math.round((Math.min(labor.overtimeMinutes, 40 * 60) / 60) * 100) / 100 : 0,
    labor.holidayMinutes ? Math.round((labor.holidayMinutes / 60) * 100) / 100 : 0,
    labor.overtimeMinutes ? Math.round((labor.overtimeMinutes / 60) * 100) / 100 : 0,
    labor.holidayMinutes ? Math.round((labor.holidayMinutes / 60) * 100) / 100 : 0,
  ]);
  rows.push([]);
  rows.push(["항목별 계산방법"]);
  [
    ["연장근로수당", "연장근로시간 × 통상시급 × 1.5"],
    ["휴일근로수당", "휴일근로시간 × 통상시급 × 1.5"],
    ["국민연금", "기준소득월액 × 4.5%"],
    ["건강보험", "과세대상임금 × 3.545%"],
    ["장기요양보험", "건강보험료 × 장기요양요율"],
    ["고용보험", "과세대상임금 × 0.9%"],
    ["근로소득세", "간이세액표 또는 프리랜서 원천징수 기준"],
  ].forEach((row) => rows.push(row));
  rows.push([]);
  rows.push([formatFormalKoreanDate(getActiveDateKey())]);
  rows.push(["방주 가족 여러분 금월 수고 많으셨습니다."]);
  rows.push(["주식회사 방주"]);
  return rows;
}

function buildWageLedgerSheetRows(siteLedger) {
  const days = siteLedger.dayNumbers;
  const laborEmployees = getVisibleLaborEmployees();
  const rows = [
    [`${siteLedger.monthLabel} 노무비 지급대장`],
    ["사업장", siteLedger.site, "총인원", siteLedger.rows.length],
    [],
    ["순번", "성명", "직책", "주민/식별", ...days, "출력일수", "총시간", "지급총액", "공제액", "실지급액", "확인"],
  ];
  const start = rows.length + 1;
  siteLedger.rows.forEach((row, index) => {
    const employee = laborEmployees.find((item) => getLaborEmployeeLogId(item) === row.employeeId || item.id === row.employeeId)
      || employees.find((item) => item.id === row.employeeId)
      || { id: row.employeeId, name: row.name, employmentType: row.employmentType };
    const summary = buildMonthlyLaborSummary(getLaborEmployeeLogId(employee), employee);
    const statement = buildPayrollStatement(summary, employee, row);
    const gross = statement.grossPay || row.totalPay || 0;
    const deductions = statement.deductionTotal || 0;
    const netPay = statement.netPay || Math.max(0, gross - deductions);
    const rowNumber = rows.length + 1;
    rows.push([
      index + 1,
      row.name,
      employee.role || row.employmentType || "",
      row.laborId || "",
      ...row.dayCells.map((cell) => cell.label || ""),
      row.workDays || 0,
      Math.round((row.actualMinutes / 60) * 100) / 100,
      gross || "",
      deductions || "",
      { f: `${cellRef(rowNumber, 4 + days.length + 3)}-${cellRef(rowNumber, 4 + days.length + 4)}`, v: netPay || 0 },
      "",
    ]);
  });
  const end = rows.length;
  const workDaysColumn = 4 + days.length + 1;
  const hoursColumn = workDaysColumn + 1;
  const grossColumn = hoursColumn + 1;
  const deductionColumn = grossColumn + 1;
  const netColumn = deductionColumn + 1;
  rows.push([
    "합계",
    "",
    "",
    "",
    ...days.map(() => ""),
    { f: `SUM(${cellRef(start, workDaysColumn)}:${cellRef(end, workDaysColumn)})`, v: siteLedger.totals.workDays || 0 },
    { f: `SUM(${cellRef(start, hoursColumn)}:${cellRef(end, hoursColumn)})`, v: Math.round((siteLedger.totals.actualMinutes / 60) * 100) / 100 },
    { f: `SUM(${cellRef(start, grossColumn)}:${cellRef(end, grossColumn)})`, v: siteLedger.totals.totalPay || 0 },
    { f: `SUM(${cellRef(start, deductionColumn)}:${cellRef(end, deductionColumn)})`, v: 0 },
    { f: `SUM(${cellRef(start, netColumn)}:${cellRef(end, netColumn)})`, v: siteLedger.totals.totalPay || 0 },
    "",
  ]);
  return rows;
}

function buildFreelancerSheetRows(siteLedger, labor) {
  const days = siteLedger.dayNumbers;
  const rows = [
    [`프리랜서(자유소득자) 국세청 등록 (${labor.monthLabel}분)`],
    ["사업장관리번호", "199-86-02068-0", "대표자명", "정찬훈"],
    [],
    ["성명", "주민등록번호", "계약직종", ...days, "월급총액", "세율공제(3.3%)"],
  ];
  const sourceRows = siteLedger.rows.filter((row) => /프리랜서|트레이너|자유/i.test(row.employmentType) || /트레이너/.test(row.name));
  const rowsToUse = sourceRows.length ? sourceRows : siteLedger.rows;
  rowsToUse.forEach((row) => {
    const rowNumber = rows.length + 1;
    rows.push([
      row.name,
      row.laborId,
      row.employmentType,
      ...row.dayCells.map((cell) => (cell.worked ? 1 : "")),
      row.totalPay || "",
      { f: `ROUND(${cellRef(rowNumber, 35)}*3.3%,0)`, v: row.totalPay ? Math.round(row.totalPay * 0.033) : 0 },
    ]);
  });
  return rows;
}

function buildPtClassSheetRows(labor) {
  const fitnessGroup = getWorklogSiteGroups().find((group) => /피트니스/.test(group.title)) || getLaborEmployeeSiteGroup(labor?.employee?.id);
  const days = Array.from({ length: 31 }, (_, index) => index + 1);
  const rows = [
    [`비욘드 피트니스 (${String(Number(labor.month.slice(5)))}월) PT수업`],
    ["순번", "이름", ...days, "유료합계", "무료"],
  ];
  (fitnessGroup?.employeeIds || []).forEach((employeeId, index) => {
    const employee = employees.find((item) => item.id === employeeId);
    if (!employee) return;
    const summary = buildMonthlyLaborSummary(employeeId, employee);
    const rowByDay = new Map(summary.dayRows.map((row) => [Number(row.dateKey.slice(8)), row]));
    const rowNumber = rows.length + 1;
    rows.push([
      index + 1,
      getEmployeeAdminLabel(employee),
      ...days.map((day) => rowByDay.get(day)?.paidPt || ""),
      { f: `SUM(C${rowNumber}:AG${rowNumber})`, v: summary.settlementPtCount || 0 },
      summary.freePtCount || 0,
    ]);
  });
  return rows;
}

function buildXlsxWorkbookBlob(sheets) {
  const workbookRels = sheets.map((_, index) => `
    <Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("");
  const sheetNodes = sheets.map((sheet, index) => `
    <sheet name="${escapeXml(normalizeSheetName(sheet.name))}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("");
  const worksheetFiles = sheets.map((sheet, index) => ({
    path: `xl/worksheets/sheet${index + 1}.xml`,
    data: buildWorksheetXml(sheet.rows, sheet.widths),
  }));
  return createZipBlob([
    {
      path: "[Content_Types].xml",
      data: `<?xml version="1.0" encoding="UTF-8"?>
        <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
          <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
          <Default Extension="xml" ContentType="application/xml"/>
          <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
          <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
          ${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}
        </Types>`,
    },
    {
      path: "_rels/.rels",
      data: `<?xml version="1.0" encoding="UTF-8"?>
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
        </Relationships>`,
    },
    {
      path: "xl/workbook.xml",
      data: `<?xml version="1.0" encoding="UTF-8"?>
        <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
          <sheets>${sheetNodes}</sheets>
        </workbook>`,
    },
    {
      path: "xl/_rels/workbook.xml.rels",
      data: `<?xml version="1.0" encoding="UTF-8"?>
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${workbookRels}
          <Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
        </Relationships>`,
    },
    {
      path: "xl/styles.xml",
      data: `<?xml version="1.0" encoding="UTF-8"?>
        <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
          <fonts count="2"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="12"/><name val="Arial"/></font></fonts>
          <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
          <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
          <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
          <cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/></cellXfs>
          <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
        </styleSheet>`,
    },
    ...worksheetFiles,
  ]);
}

function buildWorksheetXml(rows, widths = []) {
  const cols = widths.length
    ? `<cols>${widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("")}</cols>`
    : "";
  const rowXml = rows.map((row, rowIndex) => `
    <row r="${rowIndex + 1}">
      ${(row || []).map((cell, columnIndex) => createXlsxCell(cell, rowIndex + 1, columnIndex + 1)).join("")}
    </row>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
    <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
      ${cols}
      <sheetData>${rowXml}</sheetData>
    </worksheet>`;
}

function createXlsxCell(cell, rowIndex, columnIndex) {
  if (cell === undefined || cell === null || cell === "") return "";
  const ref = cellRef(rowIndex, columnIndex);
  const value = typeof cell === "object" && !Array.isArray(cell) ? cell.v : cell;
  const formula = typeof cell === "object" && !Array.isArray(cell) ? cell.f : "";
  if (formula) return `<c r="${ref}"><f>${escapeXml(formula)}</f><v>${escapeXml(String(value ?? 0))}</v></c>`;
  if (typeof value === "number" && Number.isFinite(value)) return `<c r="${ref}"><v>${value}</v></c>`;
  return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(String(value))}</t></is></c>`;
}

function cellRef(rowIndex, columnIndex) {
  return `${columnName(columnIndex)}${rowIndex}`;
}

function columnName(index) {
  let column = "";
  let value = index;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    value = Math.floor((value - 1) / 26);
  }
  return column;
}

function normalizeSheetName(name = "Sheet") {
  return String(name).replace(/[\\/?*:[\]]/g, " ").slice(0, 31) || "Sheet";
}

function escapeXml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function createZipBlob(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { dosTime, dosDate } = getDosDateTime(new Date());
  files.forEach((file) => {
    const nameBytes = encoder.encode(file.path);
    const dataBytes = encoder.encode(String(file.data).replace(/>\s+</g, "><").trim());
    const crc = crc32(dataBytes);
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(10, dosTime, true);
    localView.setUint16(12, dosDate, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, dataBytes.length, true);
    localView.setUint32(22, dataBytes.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localHeader.set(nameBytes, 30);
    localParts.push(localHeader, dataBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(12, dosTime, true);
    centralView.setUint16(14, dosDate, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, dataBytes.length, true);
    centralView.setUint32(24, dataBytes.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);
    offset += localHeader.length + dataBytes.length;
  });
  const centralOffset = offset;
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, centralOffset, true);
  return new Blob([...localParts, ...centralParts, end], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function getDosDateTime(date) {
  return {
    dosTime: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    dosDate: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc ^= bytes[index];
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function printLaborReport() {
  document.body.classList.add("is-printing-labor-report");
  window.print();
  window.setTimeout(() => document.body.classList.remove("is-printing-labor-report"), 300);
}

function buildLaborCostLedger(labor, employee) {
  const profile = getLaborProfileForEmployee(employee);
  const site = profile.workplace || employee.org?.split(" / ").at(-1) || employee.org || "사업장 미지정";
  const employmentType = String(profile.employmentType || employee.employmentType || "직원");
  const dailyWage = numberValue(profile.dailyWage);
  const hourlyWage = numberValue(profile.hourlyWage);
  const dayNumbers = Array.from({ length: 31 }, (_, index) => index + 1);
  const rowByDay = new Map(labor.dayRows.map((row) => [Number(row.dateKey.slice(8)), row]));
  const dayCells = dayNumbers.map((day) => {
    const row = rowByDay.get(day);
    const worked = Boolean(row?.worked);
    return {
      day,
      worked,
      label: worked ? formatLaborDayCell(row.worked) : "",
      minutes: row?.worked || 0,
    };
  });
  const workDays = dayCells.filter((cell) => cell.worked).length;
  const actualMinutes = dayCells.reduce((sum, cell) => sum + cell.minutes, 0);
  let totalPay = 0;
  let wageLabel = "단가 미입력";
  if (dailyWage) {
    totalPay = dailyWage * workDays;
    wageLabel = `${formatCurrency(dailyWage)} / 일`;
  } else if (hourlyWage) {
    totalPay = Math.round((actualMinutes / 60) * hourlyWage);
    wageLabel = `${formatCurrency(hourlyWage)} / 시간`;
  }
  return {
    title: `${labor.monthLabel} 노무비 지급 대장`,
    monthLabel: labor.monthLabel,
    site,
    employeeLabel: getEmployeeAdminLabel(employee),
    employmentType,
    name: employee.name || profile.name || "이름 미입력",
    laborId: maskLaborId(profile.laborId || ""),
    address: profile.address || "주소 미입력",
    dayNumbers,
    dayCells,
    workDays,
    actualMinutes,
    wageLabel,
    totalPay,
    totalPayLabel: totalPay ? formatCurrency(totalPay) : "계산 대기",
    confirmLabel: "",
  };
}

function formatLaborDayCell(minutes) {
  if (!minutes) return "";
  const hours = minutes / 60;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

function formatCurrency(value = 0) {
  const amount = Number(value) || 0;
  return amount ? `${Math.round(amount).toLocaleString()}원` : "";
}

function maskLaborId(value = "") {
  const source = String(value || "").trim();
  if (!source) return "식별번호 미입력";
  if (source.length <= 6) return source;
  return `${source.slice(0, 6)}-${"*".repeat(Math.max(4, source.length - 7))}`;
}

async function copyLaborCostLedger(ledger) {
  const text = [
    `[${ledger.title}]`,
    `사업장: ${ledger.site}`,
    `직원: ${ledger.employeeLabel}`,
    `구분: ${ledger.employmentType}`,
    `출역일수: ${ledger.workDays}일`,
    `총근무: ${formatMinutesAsHours(ledger.actualMinutes)}`,
    `임금: ${ledger.wageLabel}`,
    `총금액: ${ledger.totalPayLabel}`,
    "",
    ["구분", "성명", "주민등록번호", "주소", ...ledger.dayNumbers, "출역일수", "임금", "총금액", "확인"].join("\t"),
    [
      ledger.employmentType,
      ledger.name,
      ledger.laborId,
      ledger.address,
      ...ledger.dayCells.map((cell) => cell.label),
      `${ledger.workDays}일`,
      ledger.wageLabel,
      ledger.totalPayLabel,
      ledger.confirmLabel,
    ].join("\t"),
  ].join("\n");
  await navigator.clipboard?.writeText(text);
  showAppToast("노무비 지급 대장을 복사했습니다.");
}

function formatSiteLaborCostLedgerText(ledger) {
  return [
    `[${ledger.title}]`,
    `사업장: ${ledger.site}`,
    `대상월: ${ledger.monthLabel}`,
    `인원: ${ledger.rows.length}명`,
    `총출역: ${ledger.totals.workDays}일`,
    `총근무: ${formatMinutesAsHours(ledger.totals.actualMinutes)}`,
    `총금액: ${ledger.totals.totalPay ? formatCurrency(ledger.totals.totalPay) : "계산 대기"}`,
    "",
    ["구분", "성명", "주민등록번호", "주소", ...ledger.dayNumbers, "출역일수", "임금", "총금액", "확인"].join("\t"),
    ...ledger.rows.map((row) => [
      row.employmentType,
      row.name,
      row.laborId,
      row.address,
      ...row.dayCells.map((cell) => cell.label),
      `${row.workDays}일`,
      row.wageLabel,
      row.totalPayLabel,
      row.confirmLabel,
    ].join("\t")),
    ["합계", "", "", "", ...ledger.dayNumbers.map(() => ""), `${ledger.totals.workDays}일`, "", ledger.totals.totalPay ? formatCurrency(ledger.totals.totalPay) : "계산 대기", ""].join("\t"),
  ].join("\n");
}

async function copySiteLaborCostLedger(ledger) {
  await navigator.clipboard?.writeText(formatSiteLaborCostLedgerText(ledger));
  showAppToast(`${ledger.site} 노무비 지급대장을 복사했습니다.`);
}

async function copyAllSiteLaborLedgers() {
  const text = getLaborSiteGroupsForScope()
    .map((group) => formatSiteLaborCostLedgerText(buildSiteLaborCostLedger(group.id)))
    .join("\n\n");
  await navigator.clipboard?.writeText(text);
  showAppToast("전체 사업장 노무비 지급대장을 복사했습니다.");
}

function buildLaborMonthArchives(employeeId, employee) {
  employeeId = getEmployeeWorklogId(employee) || employeeId;
  const months = new Set([getActiveDateKey().slice(0, 7)]);
  Object.entries(state.employeeLogs || {}).forEach(([dateKey, logsByEmployee]) => {
    const log = logsByEmployee?.[employeeId];
    if (log && (log.clockIn || log.clockOut || log.attendanceStatus || getLoggedPtCount(log))) {
      months.add(dateKey.slice(0, 7));
    }
  });
  const activeMonth = getActiveDateKey().slice(0, 7);
  return [...months]
    .sort((a, b) => b.localeCompare(a))
    .map((month) => {
      const labor = buildMonthlyLaborSummary(employeeId, employee, month);
      return {
        month,
        monthLabel: month.replace("-", "."),
        recordedDays: labor.recordedDays,
        actualMinutes: labor.actualMinutes,
        settlementPtCount: labor.settlementPtCount,
        isActive: month === activeMonth,
      };
    });
}

function getLoggedPtCount(log = {}) {
  const ops = { ...createFitnessOps(), ...(log.fitnessOps || {}) };
  return numberValue(ops.ptRegular) + numberValue(ops.ptOther) + numberValue(ops.ptFree);
}

function getWorkHoursDurationMinutes(workHours = "") {
  if (/휴무|off|closed|none|없음/i.test(String(workHours))) return 0;
  const match = String(workHours || "").match(/(\d{1,2}):(\d{2})\s*[-~]\s*(\d{1,2}):(\d{2})/);
  if (!match) return 0;
  const range = getTimeRangeMinutes(`${match[1].padStart(2, "0")}:${match[2]}`, `${match[3].padStart(2, "0")}:${match[4]}`);
  return range.duration;
}

function getTimeRangeMinutes(startTime, endTime) {
  const start = timeToMinutes(startTime);
  let end = timeToMinutes(endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return { start: 0, end: 0, duration: 0 };
  if (end < start) end += 24 * 60;
  return { start, end, duration: Math.max(0, end - start) };
}

function getNightWorkMinutes(start, end) {
  let total = 0;
  const windows = [[22 * 60, 30 * 60], [46 * 60, 54 * 60]];
  windows.forEach(([nightStart, nightEnd]) => {
    total += Math.max(0, Math.min(end, nightEnd) - Math.max(start, nightStart));
  });
  return total;
}

async function copyMonthlyLaborSummary(labor) {
  const text = [
    `[${labor.monthLabel} 노무자료 초안]`,
    `직원: ${getEmployeeAdminLabel(labor.employee)}`,
    `유료 PT 정산: ${labor.settlementPtCount}건`,
    `무료 PT 제외: ${labor.freePtCount}건`,
    ...labor.cards.slice(2).map(([label, value]) => `${label}: ${value}`),
    "",
    "일자\t요일\t소정근무\t출근\t퇴근\t외출\t실근무\t상태\t유료PT\t무료PT",
    ...labor.dayRows.map((row) => `${row.dateKey}\t${row.weekday}\t${row.scheduled ? formatMinutesAsHours(row.scheduled) : "-"}\t${row.clockIn || "-"}\t${row.clockOut || "-"}\t${row.breakSummary || "-"}\t${row.worked ? formatMinutesAsHours(row.worked) : "-"}\t${row.status}\t${row.paidPt}\t${row.freePt}`),
  ].join("\n");
  await navigator.clipboard?.writeText(text);
  showAppToast("월 노무자료 초안을 복사했습니다.");
}

function updateAttendance(index, field, value) {
  state.attendance[getActiveDateKey()][index][field] = value;
  saveState();
  renderTodayContext();
  renderReport();
}

function addAttendance() {
  state.attendance ||= {};
  state.attendance[getActiveDateKey()] ||= [];
  state.attendance[getActiveDateKey()].push({ org: "(주)방주", role: "", name: "", status: "정상", note: "" });
  saveState();
  renderAttendance();
  renderTodayContext();
}

function getEmployeeMasterRows() {
  const siteLookup = new Map(getWorklogSiteGroups().flatMap((group) => group.employeeIds.map((id) => [id, group])));
  const todayLogs = state.employeeLogs?.[getActiveDateKey()] || {};
  return getStaffDirectoryEmployees().map((employee) => {
    const employeeId = getEmployeeWorklogId(employee);
    const group = siteLookup.get(employeeId) || getStaffSiteGroupForEmployee(employee);
    const labor = buildMonthlyLaborSummary(employeeId, employee);
    const log = todayLogs[employeeId] || createEmployeeLog({ ...employee, id: employeeId }, state.profile, getActiveDateKey());
    const tasks = (log.tasks || []).filter((task) => task.text?.trim());
    const completed = tasks.filter((task) => task.done || task.status === "완료").length;
    const access = getEmployeePermissionProfile(employee, group);
    const onboarding = getEmployeeOnboardingState(employee, labor, log);
    return {
      ...employee,
      site: group?.title || employee.org || "미지정",
      employeeCode: employee.id,
      access,
      onboarding,
      labor,
      tasks,
      completed,
    };
  });
}

function getStaffDirectoryEmployees() {
  const merged = new Map();
  const add = (employee, priority = 0) => {
    if (!isAssignedWorklogEmployee(employee)) return;
    employee = applyStaffDirectoryOverride(employee);
    const email = String(employee.email || "").trim().toLowerCase();
    const id = String(employee.id || "").trim();
    const identity = email
      ? `email:${email}`
      : id
        ? `id:${id}`
        : `person:${employee.org || ""}|${employee.role || ""}|${employee.name || ""}`.toLowerCase();
    const staticId = id && employees.some((item) => item.id === id) ? `id:${id}` : "";
    const personKey = `person:${employee.org || ""}|${employee.role || ""}|${employee.name || ""}`.toLowerCase();
    const keys = employee.isRemoteProfile ? [identity, personKey] : [identity, staticId].filter(Boolean);
    const existingKey = keys.find((key) => merged.has(key));
    if (existingKey) {
      const current = merged.get(existingKey);
      if ((current.priority || 0) <= priority) {
        merged.set(existingKey, { ...current, employee: { ...current.employee, ...employee }, priority });
      }
      return;
    }
    merged.set(identity, { employee, priority });
  };

  const approvedProfileEmployees = (authState.approvalRows || [])
    .filter((row) => (row.approval_status || "pending") === "approved")
    .map((row) => approvalRowToStaffEmployee(row));
  const occupiedStaticIds = new Set(approvedProfileEmployees.map((employee) => employee.mappedEmployeeId).filter(Boolean));
  approvedProfileEmployees.forEach((employee) => add(employee, 30));
  employees
    .filter(isAssignedWorklogEmployee)
    .filter((employee) => !fitnessPlaceholderEmployeeIds.has(employee.id))
    .filter((employee) => !occupiedStaticIds.has(employee.id))
    .forEach((employee) => add(employee, 10));
  const profileEmployee = getProfileEmployee();
  if ((state.profile?.approvalStatus || "approved") === "approved" && String(profileEmployee.name || "").trim()) {
    add(profileEmployee, 20);
  }

  return [...merged.values()]
    .map((entry) => entry.employee)
    .sort((a, b) => getStaffSortKey(a).localeCompare(getStaffSortKey(b), "ko"));
}

function applyStaffDirectoryOverride(employee = {}) {
  const id = String(employee.id || "").trim();
  const override = id ? state.employeeDirectoryOverrides?.[id] : null;
  if (!override) return employee;
  return {
    ...employee,
    ...override,
    id: employee.id,
    mappedEmployeeId: employee.mappedEmployeeId,
    sourceProfileId: employee.sourceProfileId,
    isRemoteProfile: employee.isRemoteProfile,
  };
}

function approvalRowToStaffEmployee(row = {}) {
  const profile = remoteRowToProfile(row);
  const mappedId = getProfileMappedEmployeeId(profile);
  const base = mappedId ? employees.find((employee) => employee.id === mappedId) : null;
  return {
    ...(base || {}),
    id: `profile-${row.id || row.email || row.name || Date.now()}`,
    mappedEmployeeId: mappedId || "",
    sourceProfileId: row.id || "",
    isRemoteProfile: true,
    name: profile.name || row.email || "이름 미입력",
    nickname: row.nickname || profile.nickname || "",
    org: profile.org || base?.org || "(주)방주",
    role: profile.role || base?.role || "직원",
    primaryWork: profile.primaryWork || base?.primaryWork || "",
    secondaryWork: profile.secondaryWork || "",
    workplace: profile.workplace || "",
    email: profile.email || row.email || "",
    phone: profile.phone || "",
    employmentType: profile.employmentType || base?.employmentType || "직원",
    laborId: profile.laborId || "",
    address: profile.address || "",
    hourlyWage: profile.hourlyWage || "",
    dailyWage: profile.dailyWage || "",
    joinDate: profile.joinDate || "",
    payDay: profile.payDay || "",
    workHours: profile.workHours || base?.workHours || defaultProfile.workHours,
    weeklyWorkHours: profile.weeklyWorkHours || base?.weeklyWorkHours || {},
    approvalStatus: profile.approvalStatus || row.approval_status || "approved",
    assignedMission: row.assigned_mission || profile.assignedMission || "",
    assignedMissionVisible: row.assigned_mission_visible !== false,
    assignedMissionUpdatedAt: row.assigned_mission_updated_at || "",
    assignedMissionUpdatedBy: row.assigned_mission_updated_by || "",
    accessPreset: profile.accessPreset || row.access_preset || "employee",
    permissions: { ...(profile.permissions || row.permissions || {}) },
  };
}

function getStaffSiteGroupForEmployee(employee = {}) {
  const text = `${employee.org || ""} ${employee.workplace || ""} ${employee.primaryWork || ""}`;
  if (/피트니스|fitness/i.test(text)) return getWorklogSiteGroups().find((group) => group.id === "fitness");
  if (/비욘드\s*컴퍼니|공유|TBA|티비에이|워크베이스|워크박스|beyond/i.test(text)) return getWorklogSiteGroups().find((group) => group.id === "beyond");
  return getWorklogSiteGroups().find((group) => group.id === "bangju");
}

function getStaffSortKey(employee = {}) {
  const group = getStaffSiteGroupForEmployee(employee);
  const siteOrder = { bangju: "1", beyond: "2", fitness: "3" }[group?.id] || "9";
  return `${siteOrder}|${employee.org || ""}|${employee.role || ""}|${employee.name || ""}|${employee.email || ""}`;
}

function getEmployeePermissionProfile(employee, group) {
  const inferredPreset = getRecommendedPermissionPresetForEmployee(employee, group);
  const remoteOverride = employee.accessPreset || Object.keys(employee.permissions || {}).length
    ? { preset: employee.accessPreset, permissions: employee.permissions }
    : {};
  const override = state.employeePermissions?.[employee.id] || remoteOverride;
  const presetKey = normalizePermissionPresetKey(override.preset || inferredPreset);
  const set = buildPermissionSet(presetKey, override.permissions || {});
  const worklog = set.permissions.worklogAll ? "전사 열람" : set.permissions.worklogSite ? "소속 열람" : "본인 수정";
  const labor = set.permissions.laborAll ? "전사 열람" : set.permissions.laborSite ? "소속 열람" : "본인 열람";
  const approval = set.permissions.staffApproval ? "가능" : "불가";
  return { role: set.label, caption: set.caption, presetKey: set.presetKey, permissions: set.permissions, worklog, labor, approval };
}

function getRecommendedPermissionPresetForEmployee(employee, group) {
  const roleText = `${employee.role || ""} ${employee.primaryWork || ""}`;
  if (/대표/.test(roleText)) return "owner";
  if (/총괄|실장/.test(roleText)) return "operations_admin";
  if (/센터장|manager|관리자/i.test(roleText)) return "site_manager";
  if (/트레이너|프리랜서/.test(roleText) || employee.employmentType === "프리랜서") return "freelance";
  if (/예비/.test(roleText)) return "readonly";
  return "employee";
}

function setEmployeePermissionPreset(employeeId, preset) {
  state.employeePermissions ||= {};
  const current = state.employeePermissions[employeeId] || {};
  state.employeePermissions[employeeId] = {
    preset: normalizePermissionPresetKey(preset),
    permissions: { ...(current.permissions || {}) },
  };
  saveState();
  renderStaffMaster();
}

function toggleEmployeePermission(employeeId, key, checked) {
  state.employeePermissions ||= {};
  const current = state.employeePermissions[employeeId] || { preset: getRecommendedPermissionPresetForEmployee(employees.find((employee) => employee.id === employeeId) || {}, null), permissions: {} };
  state.employeePermissions[employeeId] = {
    preset: normalizePermissionPresetKey(current.preset || "employee"),
    permissions: { ...(current.permissions || {}), [key]: Boolean(checked) },
  };
  saveState();
  renderStaffMaster();
}

function resetEmployeePermission(employeeId) {
  if (!state.employeePermissions) return;
  delete state.employeePermissions[employeeId];
  saveState();
  renderStaffMaster();
}

let staffPermissionDraft = null;

function getEmployeeOnboardingState(employee, labor, log) {
  const checks = [
    ["기본설정", Boolean(employee.name && employee.org && employee.role)],
    ["근무시간", Boolean(employee.workHours || defaultProfile.workHours)],
    ["업무매뉴얼", Boolean(getManualTemplateForEmployee(employee))],
    ["첫 업무일지", Boolean((log.tasks || []).some((task) => task.text?.trim()) || (log.schedule || []).some((item) => getScheduleEntryText(item)))],
    ["노무기준", Boolean(employee.employmentType || labor.recordedDays)],
  ];
  const done = checks.filter(([, ok]) => ok).length;
  return { checks, done, total: checks.length };
}

function renderStaffPermissionRow(row) {
  const hasOverride = Boolean(state.employeePermissions?.[row.id]);
  return `
    <article class="staff-permission-row" data-staff-permission-row="${escapeAttr(row.id)}">
      <div class="staff-permission-identity">
        <span>${escapeHtml(row.site)}</span>
        <strong>${escapeHtml(row.role || "직원")} ${escapeHtml(row.name || "")}</strong>
        <em>${escapeHtml(row.access.caption || "")}</em>
      </div>
      <label class="staff-permission-preset">권한 프리셋
        <select data-staff-permission-preset="${escapeAttr(row.id)}">
          ${getPermissionPresetOptions(row.access.presetKey)}
        </select>
      </label>
      <div class="staff-permission-toggles">
        ${permissionKeys.map(([key, label]) => `
          <label>
            <input type="checkbox" data-staff-permission-toggle="${escapeAttr(row.id)}" data-permission-key="${escapeAttr(key)}" ${row.access.permissions[key] ? "checked" : ""} />
            <span>${escapeHtml(label)}</span>
          </label>
        `).join("")}
      </div>
      <button type="button" class="staff-permission-reset" data-staff-permission-reset="${escapeAttr(row.id)}" ${hasOverride ? "" : "disabled"}>기본값</button>
    </article>
  `;
}

function renderStaffPermissionListItem(row) {
  const hasOverride = Boolean(state.employeePermissions?.[row.id]);
  const enabledCount = permissionKeys.filter(([key]) => row.access.permissions[key]).length;
  const criticalSummary = [
    row.access.permissions.staffManage ? "직원관리" : "",
    row.access.permissions.staffApproval ? "승인" : "",
    row.access.permissions.worklogAll ? "전사일지" : row.access.permissions.worklogSite ? "소속일지" : "본인일지",
    row.access.permissions.laborAll ? "전사노무" : row.access.permissions.laborSite ? "소속노무" : "본인노무",
  ].filter(Boolean).join(" · ");
  return `
    <button type="button" class="staff-permission-list-item" data-staff-permission-open="${escapeAttr(row.id)}">
      <span class="staff-permission-person">
        <em>${escapeHtml(row.site || row.org || "직원")}</em>
        <strong>${escapeHtml(`${row.role || "직원"} ${row.name || ""}`.trim())}</strong>
        <small>${escapeHtml(row.email || row.employeeCode || "")}</small>
      </span>
      <span class="staff-permission-status">
        <b>${escapeHtml(row.access.role)}</b>
        <small>${escapeHtml(`${enabledCount}/${permissionKeys.length}개 권한 · ${criticalSummary}`)}</small>
      </span>
      ${hasOverride ? `<span class="staff-permission-badge">조정됨</span>` : `<span class="staff-permission-badge is-default">기본</span>`}
    </button>
  `;
}

function createStaffPermissionDraft(employeeId) {
  const row = getEmployeeMasterRows().find((item) => item.id === employeeId);
  if (!row) return null;
  const recommended = getRecommendedPermissionPresetForEmployee(row);
  const override = state.employeePermissions?.[employeeId] || {};
  const preset = normalizePermissionPresetKey(override.preset || recommended);
  const set = buildPermissionSet(preset, override.permissions || {});
  return {
    employeeId,
    preset,
    recommended,
    permissions: { ...set.permissions },
  };
}

function normalizeStaffPermissionOverride(employeeId, draft = staffPermissionDraft) {
  const row = getEmployeeMasterRows().find((item) => item.id === employeeId);
  if (!row || !draft) return null;
  const preset = normalizePermissionPresetKey(draft.preset || "employee");
  const recommended = getRecommendedPermissionPresetForEmployee(row);
  const base = buildPermissionSet(preset, {}).permissions;
  const permissionDelta = {};
  permissionKeys.forEach(([key]) => {
    const value = Boolean(draft.permissions?.[key]);
    if (value !== Boolean(base[key])) permissionDelta[key] = value;
  });
  const hasCustom = preset !== recommended || Object.keys(permissionDelta).length > 0;
  return {
    hasCustom,
    override: {
      preset,
      permissions: permissionDelta,
    },
  };
}

function renderStaffPermissionModal(row) {
  const draft = staffPermissionDraft || createStaffPermissionDraft(row.id);
  const preset = normalizePermissionPresetKey(draft?.preset || row.access.presetKey);
  const enabledCount = permissionKeys.filter(([key]) => draft?.permissions?.[key]).length;
  return `
    <div class="staff-permission-modal-backdrop" data-staff-permission-modal-close>
      <article class="staff-permission-modal-card" role="dialog" aria-modal="true" aria-label="직원 권한 편집">
        <button type="button" class="staff-detail-close" data-staff-permission-modal-close aria-label="닫기">×</button>
        <header>
          <span>Permission Control</span>
          <h3>${escapeHtml(`${row.role || "직원"} ${row.name || ""}`.trim())}</h3>
          <p>${escapeHtml(`${row.site || row.org || "소속 확인"} · ${row.email || row.employeeCode || ""}`)}</p>
        </header>
        <section class="staff-permission-modal-summary">
          <article><span>현재 프리셋</span><strong>${escapeHtml(permissionPresets[preset]?.label || "직원")}</strong></article>
          <article><span>활성 권한</span><strong>${escapeHtml(`${enabledCount}/${permissionKeys.length}`)}</strong></article>
          <article><span>권한 기준</span><strong>${escapeHtml(preset === draft?.recommended ? "역할 기본" : "대표 조정")}</strong></article>
        </section>
        <label class="staff-permission-modal-preset">권한 프리셋
          <select data-staff-permission-modal-preset>
            ${getPermissionPresetOptions(preset)}
          </select>
        </label>
        <div class="staff-permission-modal-note">
          <strong>권한 변경은 하단의 “권한 확정”을 눌러야 반영됩니다.</strong>
          <p>일반 직원은 본인 업무일지와 본인 자료 중심으로 사용하고, 대표 또는 위임자는 필요한 범위만 열람/승인 권한을 부여합니다.</p>
        </div>
        <div class="staff-permission-toggles staff-permission-modal-toggles">
          ${permissionKeys.map(([key, label]) => `
            <label>
              <input type="checkbox" data-staff-permission-modal-toggle="${escapeAttr(key)}" ${draft?.permissions?.[key] ? "checked" : ""} />
              <span>${escapeHtml(label)}</span>
            </label>
          `).join("")}
        </div>
        <footer class="staff-permission-modal-footer">
          <button type="button" class="staff-permission-reset" data-staff-permission-modal-reset>기본값</button>
          <div>
            <button type="button" class="staff-permission-cancel" data-staff-permission-modal-close>취소</button>
            <button type="button" class="staff-permission-confirm" data-staff-permission-save>권한 확정</button>
          </div>
        </footer>
      </article>
    </div>
  `;
}

function refreshStaffPermissionModal() {
  if (!staffPermissionDraft) return;
  const overlay = document.getElementById("staffPermissionOverlay");
  const row = getEmployeeMasterRows().find((item) => item.id === staffPermissionDraft.employeeId);
  if (!overlay || !row) return;
  overlay.innerHTML = renderStaffPermissionModal(row);
}

function openStaffPermissionModal(employeeId) {
  const row = getEmployeeMasterRows().find((item) => item.id === employeeId);
  if (!row) return;
  staffPermissionDraft = createStaffPermissionDraft(employeeId);
  document.getElementById("staffPermissionOverlay")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "staffPermissionOverlay";
  overlay.innerHTML = renderStaffPermissionModal(row);
  document.body.appendChild(overlay);
}

function closeStaffPermissionModal() {
  staffPermissionDraft = null;
  document.getElementById("staffPermissionOverlay")?.remove();
}

async function persistEmployeePermissionOverride(employeeId, normalized) {
  if (!supabaseClient || !authState.user || !canAccessStaffSection()) return { saved: false, localOnly: true };
  const row = getEmployeeMasterRows().find((item) => item.id === employeeId);
  const sourceProfileId = row?.sourceProfileId || getEmployeeSourceProfileRow(row || {})?.id || "";
  if (!sourceProfileId) return { saved: false, localOnly: true };
  const preset = normalized?.hasCustom
    ? normalized.override.preset
    : getRecommendedPermissionPresetForEmployee(row || {});
  const permissions = normalized?.hasCustom ? normalized.override.permissions : {};
  const result = await updateProfileRowWithSchemaFallback(sourceProfileId, {
    access_preset: preset,
    permissions,
    updated_at: new Date().toISOString(),
  });
  const approvalRow = (authState.approvalRows || []).find((item) => String(item.id || "") === String(sourceProfileId));
  if (!result.error && approvalRow) {
    approvalRow.access_preset = preset;
    approvalRow.permissions = permissions;
  }
  return { saved: !result.error && !result.removedColumns.length, localOnly: Boolean(result.error || result.removedColumns.length) };
}

async function saveStaffPermissionDraft() {
  if (!staffPermissionDraft) return;
  const employeeId = staffPermissionDraft.employeeId;
  const normalized = normalizeStaffPermissionOverride(employeeId, staffPermissionDraft);
  if (!normalized) return;
  state.employeePermissions ||= {};
  if (normalized.hasCustom) {
    state.employeePermissions[employeeId] = normalized.override;
  } else {
    delete state.employeePermissions[employeeId];
  }
  saveState();
  const remote = await persistEmployeePermissionOverride(employeeId, normalized);
  closeStaffPermissionModal();
  renderStaffMaster();
  showAppToast(remote.saved ? "위임 권한과 메뉴 구성을 적용했습니다" : "이 기기에 권한을 저장했습니다. 최신 데이터베이스 설정 적용 후 원격 동기화됩니다");
}

function getManualTemplateForEmployee(employee) {
  const role = `${employee.org || ""} ${employee.role || ""} ${employee.primaryWork || ""}`;
  if (/방주|재무|자금|회계|세무/.test(role)) return fitnessManualTemplates.bangjuFinance;
  if (/TBA|티비에이|인월|욕실|바스|bath|쇼룸/i.test(role)) return fitnessManualTemplates.beyondTba;
  if (/공유|워크베이스|워크박스|창고|오피스|workbase|workbox/i.test(role)) return fitnessManualTemplates.beyondShared;
  if (/인테리어|시공|공사|현장/.test(role)) return fitnessManualTemplates.beyondInterior;
  if (/센터장|총괄|실장/.test(role)) return fitnessManualTemplates.manager;
  if (/인포|고객응대/.test(role)) return fitnessManualTemplates.frontDesk;
  if (/트레이너|PT|수업/.test(role)) return fitnessManualTemplates.trainer;
  if (/상담|계약|영업/.test(role)) return fitnessManualTemplates.sales;
  if (/홍보|마케팅/.test(role)) return fitnessManualTemplates.marketing;
  if (/시설/.test(role)) return fitnessManualTemplates.facility;
  if (/청결|청소/.test(role)) return fitnessManualTemplates.cleaning;
  return fitnessManualTemplates.manager;
}

const staffMasterTabs = [
  ["staff-list", "직원명부", "소속·직함·권한 원장"],
  ["approval", "승인요청", "직원등록·정보변경 검토"],
  ["permission", "권한관리", "메뉴·사업장 접근 통제"],
  ["manual", "역할 매뉴얼", "직함별 업무 기준"],
  ["growth", "성장기록", "역량·온보딩 추적"],
];

function getVisibleStaffMasterTabs() {
  return staffMasterTabs.filter(([key]) => key !== "approval" || canShowApprovalMenu());
}

function normalizeStaffMasterTab(value) {
  return getVisibleStaffMasterTabs().some(([key]) => key === value) ? value : "staff-list";
}

function getStaffMasterTabMeta(value = state.staffMasterTab) {
  return staffMasterTabs.find(([key]) => key === normalizeStaffMasterTab(value)) || staffMasterTabs[0];
}

function getStaffMasterSiteKey(row = {}) {
  const text = `${row.site || ""} ${row.org || ""} ${row.workplace || ""} ${row.primaryWork || ""} ${row.role || ""}`;
  if (/피트니스|fitness/i.test(text)) return "fitness";
  if (/비제이|종합건설|건설|현장/i.test(text)) return "bj";
  if (/비욘드\s*컴퍼니|공유|TBA|티비에이|워크베이스|워크박스|beyond/i.test(text)) return "beyond";
  if (/방주/.test(text)) return "bangju";
  return "other";
}

function getStaffMasterSiteLabel(key) {
  return {
    all: "전체",
    bangju: "(주)방주",
    beyond: "(주)비욘드컴퍼니",
    fitness: "비욘드 피트니스",
    bj: "(주)비제이종합건설",
    other: "기타",
  }[key] || "기타";
}

function getStaffMasterSites(rows = []) {
  const counts = rows.reduce((acc, row) => {
    const key = getStaffMasterSiteKey(row);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, { all: rows.length });
  return ["all", "bangju", "beyond", "fitness", "bj", "other"]
    .filter((key) => key === "all" || counts[key])
    .map((key) => ({ key, label: getStaffMasterSiteLabel(key), count: counts[key] || 0 }));
}

function getFilteredStaffRows(rows = []) {
  if (!state.staffMasterSite || state.staffMasterSite === "all") return rows;
  return rows.filter((row) => getStaffMasterSiteKey(row) === state.staffMasterSite);
}

function renderStaffSiteFilters(rows = []) {
  const sites = getStaffMasterSites(rows);
  return `
    <nav class="staff-site-filter" aria-label="사업장별 직원 보기">
      ${sites.map((site) => `
        <button type="button" class="${site.key === state.staffMasterSite ? "is-active" : ""}" data-staff-site-filter="${escapeAttr(site.key)}">
          <span>${escapeHtml(site.label)}</span>
          <small>${escapeHtml(`${site.count}명`)}</small>
        </button>
      `).join("")}
    </nav>
  `;
}

function renderStaffSectionTabbar() {
  return `
    <nav class="section-command-strip staff-section-tabbar" aria-label="직원 섹션 보기">
      ${getVisibleStaffMasterTabs().map(([key, label, caption], index) => `
        <button type="button" class="${key === state.staffMasterTab ? "is-active" : ""}" data-staff-tab="${escapeAttr(key)}">
          <span>${String(index + 1).padStart(2, "0")}</span>
          <strong>${escapeHtml(label)}</strong>
          <small>${escapeHtml(caption)}</small>
        </button>
      `).join("")}
    </nav>
  `;
}

function renderStaffMasterStats(rows = []) {
  const stats = [
    ["직원", `${rows.length}명`],
    ["권한관리", `${rows.filter((row) => row.access.permissions.staffManage || row.access.permissions.staffApproval).length}명`],
    ["온보딩 완료", `${rows.filter((row) => row.onboarding.done === row.onboarding.total).length}명`],
    ["오늘 작성", `${rows.filter((row) => row.tasks.length).length}명`],
    ["노무 기록", `${rows.filter((row) => row.labor.recordedDays).length}명`],
    ["유료 PT", `${rows.reduce((sum, row) => sum + Number(row.labor.settlementPtCount || 0), 0)}건`],
  ];
  return `
    <section class="staff-master-summary">
      ${stats.map(([label, value]) => `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`).join("")}
    </section>
  `;
}

function renderStaffMasterTable(rows = []) {
  return `
    <section class="staff-master-panel">
      <header>
        <div>
          <span>Master Data</span>
          <h3>전체 직원 명부</h3>
        </div>
        <p class="staff-master-hint">목록에서 직원을 선택하면 세부 정보와 권한, 온보딩 상태를 한 명씩 확인합니다.</p>
      </header>
      ${rows.length ? `
        <div class="staff-master-table-wrap">
          <table class="staff-master-table">
            <thead>
              <tr><th>직원</th><th>소속/사업장</th><th>직무</th><th>권한</th><th>근무시간</th><th>오늘 업무</th><th>온보딩</th><th>상세</th></tr>
            </thead>
            <tbody>
              ${rows.map((row) => `
                <tr data-staff-detail-id="${escapeAttr(row.id)}" tabindex="0">
                  <td><b>${escapeHtml(row.name || "")}</b><span>${escapeHtml(row.email || row.employeeCode)}</span></td>
                  <td><b>${escapeHtml(row.site)}</b><span>${escapeHtml(row.org || "")}</span></td>
                  <td><b>${escapeHtml(row.role || "직원")}</b><span>${escapeHtml(row.primaryWork || row.employmentType || "직무 확인")}</span></td>
                  <td><b>${escapeHtml(row.access.role)}</b><span>${escapeHtml(row.access.worklog)} · ${escapeHtml(row.access.labor)}</span></td>
                  <td>${escapeHtml(row.workHours || defaultProfile.workHours)}</td>
                  <td>${escapeHtml(`${row.completed}/${row.tasks.length || 0}`)}</td>
                  <td>${escapeHtml(`${row.onboarding.done}/${row.onboarding.total}`)}</td>
                  <td><button type="button" class="staff-detail-open" data-staff-detail-id="${escapeAttr(row.id)}">열기</button></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : `<div class="staff-empty-panel">선택한 사업장에 표시할 직원이 없습니다.</div>`}
    </section>
  `;
}

function renderStaffApprovalFocus(rows = []) {
  const approvals = Array.isArray(authState.approvalRows) ? authState.approvalRows : [];
  const pending = approvals.filter((row) => (row.approval_status || "pending") === "pending").length;
  const approved = approvals.filter((row) => (row.approval_status || "") === "approved").length;
  const rejected = approvals.filter((row) => (row.approval_status || "") === "rejected").length;
  const changes = rows.filter((row) => row.approvalStatus === "change_requested" || row.pendingProfileChanges || row.hasPendingProfileChange).length;
  const stats = [
    ["신규 승인", `${pending}명`, "직원등록 신청"],
    ["변경 요청", `${changes}건`, "직원정보 변경"],
    ["사용 가능", `${approved}명`, "승인 완료"],
    ["반려", `${rejected}건`, "보완 요청"],
  ];
  return `
    <section class="staff-master-panel">
      <header>
        <div>
          <span>Approval Queue</span>
          <h3>직원 승인요청</h3>
        </div>
      </header>
      <div class="staff-approval-focus-grid">
        ${stats.map(([label, value, caption]) => `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(caption)}</small></article>`).join("")}
      </div>
      <div class="staff-approval-action">
        <div>
          <strong>승인은 별도 검토 화면에서 한 명씩 처리합니다.</strong>
          <p>직원등록, 정보변경, 대표 직권수정 내역을 비교하고 승인/반려 사유를 남깁니다.</p>
        </div>
        <button type="button" data-staff-open-approval>승인요청 열기</button>
      </div>
    </section>
  `;
}

function renderStaffPermissionFocus(rows = []) {
  return `
    <section class="staff-master-panel">
      <header>
        <div>
          <span>Permission Matrix</span>
          <h3>권한 체계</h3>
        </div>
        <p class="staff-master-hint">권한은 직원을 클릭해 팝업에서 조정하고, 권한 확정 버튼으로 저장합니다.</p>
      </header>
      <div class="staff-permission-matrix">
        <div class="staff-permission-guide">
          <strong>최소 권한 원칙</strong>
          <p>일반 직원은 본인 업무와 본인 노무만, 관리자에게는 필요한 사업장 범위만 부여합니다.</p>
        </div>
        <div class="staff-permission-list">
          ${rows.length ? rows.map((row) => renderStaffPermissionListItem(row)).join("") : `<div class="staff-empty-panel">선택한 사업장에 표시할 직원이 없습니다.</div>`}
        </div>
      </div>
    </section>
  `;
}

function renderStaffManualFocus(rows = []) {
  const groups = rows.reduce((acc, row) => {
    const manual = getManualTemplateForEmployee(row);
    const title = manual?.title || "역할 매뉴얼";
    acc[title] ||= { title, rows: [], manual };
    acc[title].rows.push(row);
    return acc;
  }, {});
  const items = Object.values(groups);
  return `
    <section class="staff-master-panel">
      <header>
        <div>
          <span>Role Manual</span>
          <h3>역할 매뉴얼</h3>
        </div>
        <button type="button" class="staff-panel-action" data-section-shortcut="manual">매뉴얼 편집</button>
      </header>
      <div class="staff-manual-focus-grid">
        ${items.length ? items.map((item) => `
          <article>
            <span>${escapeHtml(`${item.rows.length}명 적용`)}</span>
            <strong>${escapeHtml(item.title)}</strong>
            <p>${escapeHtml(item.rows.map((row) => row.name || row.email || "직원").slice(0, 4).join(" · "))}${item.rows.length > 4 ? " 외" : ""}</p>
          </article>
        `).join("") : `<div class="staff-empty-panel">선택한 사업장에 연결된 매뉴얼이 없습니다.</div>`}
      </div>
    </section>
  `;
}

function renderStaffGrowthFocus(rows = []) {
  return `
    <section class="staff-master-panel">
      <header>
        <div>
          <span>Growth Records</span>
          <h3>성장기록</h3>
        </div>
      </header>
      <div class="staff-growth-compact">
        ${rows.length ? rows.map((row) => {
          const manual = getManualTemplateForEmployee(row);
          return `
            <article>
              <span>${escapeHtml(row.site || row.org || "직원")}</span>
              <strong>${escapeHtml(`${row.role || "직원"} ${row.name || ""}`.trim())}</strong>
              <p>${escapeHtml(manual?.title || "역할 매뉴얼")} · 업무 ${escapeHtml(`${row.completed}/${row.tasks.length || 0}`)} · 노무 ${escapeHtml(String(row.labor.recordedDays))}일</p>
              <div class="staff-growth-checks">
                ${row.onboarding.checks.map(([label, ok]) => `<em class="${ok ? "is-done" : ""}">${escapeHtml(label)}</em>`).join("")}
              </div>
            </article>
          `;
        }).join("") : `<div class="staff-empty-panel">선택한 사업장에 표시할 성장기록이 없습니다.</div>`}
      </div>
    </section>
  `;
}

function renderStaffMasterActivePanel(rows = []) {
  const tab = normalizeStaffMasterTab(state.staffMasterTab);
  if (tab === "approval") return renderStaffApprovalFocus(rows);
  if (tab === "permission") return renderStaffPermissionFocus(rows);
  if (tab === "manual") return renderStaffManualFocus(rows);
  if (tab === "growth") return renderStaffGrowthFocus(rows);
  return renderStaffMasterTable(rows);
}

function renderStaffMaster() {
  const grid = document.getElementById("staffMasterGrid");
  const approvalButton = document.getElementById("staffOpenApprovalButton");
  if (!grid) return;
  const canManage = canAccessStaffSection();
  if (approvalButton) approvalButton.hidden = !canShowApprovalMenu();
  if (!canManage) {
    const employee = getProfileEmployee();
    grid.innerHTML = `
      <article class="staff-access-card">
        <strong>${escapeHtml(getEmployeeAdminLabel(employee))}</strong>
        <p>직원 마스터는 대표와 지정 관리자 전용입니다. 일반 직원은 본인 설정, 업무일지, 노무 자료를 사용할 수 있습니다.</p>
      </article>
    `;
    return;
  }
  const rows = getEmployeeMasterRows();
  state.staffMasterTab = normalizeStaffMasterTab(state.staffMasterTab);
  state.staffMasterSite ||= "all";
  if (!getStaffMasterSites(rows).some((site) => site.key === state.staffMasterSite)) state.staffMasterSite = "all";
  const filteredRows = getFilteredStaffRows(rows);
  const [, tabLabel, tabCaption] = getStaffMasterTabMeta();
  grid.innerHTML = `
    ${renderStaffSiteFilters(rows)}
    ${renderStaffSectionTabbar()}
    <section class="staff-context-card">
      <div>
        <span>${escapeHtml(getStaffMasterSiteLabel(state.staffMasterSite))}</span>
        <strong>${escapeHtml(tabLabel)}</strong>
        <p>${escapeHtml(tabCaption)} · ${escapeHtml(`${filteredRows.length}명 표시`)}</p>
      </div>
      <em>직원 원장</em>
    </section>
    ${renderStaffMasterStats(filteredRows)}
    ${renderStaffMasterActivePanel(filteredRows)}
  `;
}

function canEditStaffProfile(row = {}) {
  if (isExplicitlySignedOut()) return false;
  if (isRepresentativeProfile()) return true;
  if (hasProfilePermission("staffManage") || hasProfilePermission("staffApproval")) return true;
  return hasApprovalAuthority();
}

function staffDetailEditField(row, key, label, type = "text") {
  const value = key === "phone" ? formatPhoneNumber(row[key] || "") : row[key] || "";
  return `
    <label>${escapeHtml(label)}
      <input type="${type}" data-staff-edit-field="${escapeAttr(key)}" value="${escapeAttr(value)}" />
    </label>
  `;
}

function staffDetailWeeklyWorkHoursEditor(row = {}) {
  const weeklyWorkHours = row.weeklyWorkHours || row.weekly_work_hours || {};
  const defaultHours = row.workHours || row.work_hours || defaultProfile.workHours;
  return `
    <section class="staff-detail-weekly-hours">
      <div>
        <strong>근무요일 / 요일별 시간</strong>
        <span>체크한 요일만 근무일로 확정됩니다. 시간은 비워두면 기본 근무시간을 사용합니다.</span>
      </div>
      <div class="staff-detail-weekly-grid">
        ${weeklyWorkDayOptions.map(([key, label]) => {
          const checked = Object.prototype.hasOwnProperty.call(weeklyWorkHours || {}, key);
          const value = checked ? (weeklyWorkHours[key] || defaultHours || "") : "";
          return `
            <label class="${checked ? "is-workday" : ""}">
              <input data-staff-weekly-work-hours-check="${escapeAttr(key)}" type="checkbox" ${checked ? "checked" : ""} />
              <span>${escapeHtml(label)}</span>
              <input data-staff-weekly-work-hours-day="${escapeAttr(key)}" type="text" value="${escapeAttr(value)}" placeholder="${key === "sun" ? "휴무" : "09:00-18:00"}" />
            </label>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function staffDetailMissionEditor(row = {}) {
  const mission = getAssignedMissionForEmployee(row);
  return `
    <section class="staff-detail-section staff-detail-mission">
      <div class="staff-detail-edit-title">
        <strong>대표 지정 미션</strong>
        <span>대표가 직접 부여한 미션은 이 직원의 AI 코칭과 오늘 업무 제안의 우선 신호가 됩니다.</span>
      </div>
      <label>미션 내용
        <textarea data-staff-edit-field="assignedMission" rows="4" placeholder="예: 이번 달 재등록 후보 20명 관리 체계를 만들고, 매일 상담 후속 업무를 업무일지에 남깁니다.">${escapeHtml(mission.text || "")}</textarea>
      </label>
      <label class="staff-mission-visibility">
        <input type="checkbox" data-staff-edit-field="assignedMissionVisible" ${mission.visible !== false ? "checked" : ""} />
        <span>직원에게 보이기</span>
      </label>
      <p>숨김 상태에서는 대표와 권한자만 내용을 볼 수 있고, 직원 화면에는 직접 문구를 노출하지 않습니다.</p>
    </section>
  `;
}

function collectStaffDetailEditFields() {
  const card = document.querySelector("#staffDetailOverlay .staff-detail-card");
  const fields = {};
  card?.querySelectorAll("[data-staff-edit-field]").forEach((field) => {
    const key = field.dataset.staffEditField;
    if (field.type === "checkbox") {
      fields[key] = field.checked;
      return;
    }
    const value = String(field.value || "").trim();
    fields[key] = key === "phone" ? formatPhoneNumber(value) : value;
    if (key === "phone") field.value = fields[key];
  });
  fields.weeklyWorkHours = collectWeeklyWorkHoursFromControls({
    checkSelector: "[data-staff-weekly-work-hours-check]",
    inputSelector: "[data-staff-weekly-work-hours-day]",
    checkDatasetKey: "staffWeeklyWorkHoursCheck",
    inputDatasetKey: "staffWeeklyWorkHoursDay",
    defaultHours: fields.workHours || defaultProfile.workHours,
    root: card || document,
  });
  return fields;
}

function staffEditFieldsToRemotePayload(fields = {}, row = {}) {
  const hasField = (key) => Object.prototype.hasOwnProperty.call(fields, key);
  const numericOrNull = (value) => {
    const normalized = String(value || "").replaceAll(",", "").trim();
    if (!normalized) return null;
    const number = Number(normalized);
    return Number.isFinite(number) ? number : null;
  };
  const payload = {
    updated_at: new Date().toISOString(),
  };
  const map = {
    org: "org",
    role: "role",
    name: "name",
    phone: "phone",
    email: "email",
    workplace: "workplace",
    primaryWork: "primary_work",
    secondaryWork: "secondary_work",
    workHours: "work_hours",
    employmentType: "employment_type",
    joinDate: "join_date",
    payDay: "pay_day",
  };
  Object.entries(map).forEach(([localKey, remoteKey]) => {
    if (hasField(localKey)) payload[remoteKey] = fields[localKey] || "";
  });
  if (hasField("weeklyWorkHours")) payload.weekly_work_hours = fields.weeklyWorkHours || {};
  if (hasField("hourlyWage")) payload.hourly_wage = numericOrNull(fields.hourlyWage);
  if (hasField("dailyWage")) payload.daily_wage = numericOrNull(fields.dailyWage);
  if (hasField("assignedMission")) {
    payload.assigned_mission = fields.assignedMission || "";
    payload.assigned_mission_visible = fields.assignedMissionVisible !== false;
    const currentMission = getAssignedMissionForEmployee(row);
    if (
      String(currentMission.text || "") !== String(fields.assignedMission || "")
      || currentMission.visible !== payload.assigned_mission_visible
    ) {
      payload.assigned_mission_updated_by = authState.user?.id || null;
      payload.assigned_mission_updated_at = new Date().toISOString();
    }
  }
  return payload;
}

function mergeStaffFieldsIntoApprovalRow(row = {}, fields = {}) {
  return {
    ...row,
    org: fields.org ?? row.org,
    role: fields.role ?? row.role,
    name: fields.name ?? row.name,
    phone: fields.phone ?? row.phone,
    email: fields.email ?? row.email,
    workplace: fields.workplace ?? row.workplace,
    primary_work: fields.primaryWork ?? row.primary_work,
    secondary_work: fields.secondaryWork ?? row.secondary_work,
    work_hours: fields.workHours ?? row.work_hours,
    weekly_work_hours: fields.weeklyWorkHours ?? row.weekly_work_hours,
    employment_type: fields.employmentType ?? row.employment_type,
    join_date: fields.joinDate === "" ? null : (fields.joinDate ?? row.join_date),
    pay_day: fields.payDay ?? row.pay_day,
    hourly_wage: fields.hourlyWage === "" ? null : (fields.hourlyWage ?? row.hourly_wage),
    daily_wage: fields.dailyWage === "" ? null : (fields.dailyWage ?? row.daily_wage),
    assigned_mission: fields.assignedMission ?? row.assigned_mission,
    assigned_mission_visible: fields.assignedMissionVisible ?? row.assigned_mission_visible,
    assigned_mission_updated_by: fields.assignedMission !== undefined ? (authState.user?.id || row.assigned_mission_updated_by) : row.assigned_mission_updated_by,
    assigned_mission_updated_at: fields.assignedMission !== undefined ? new Date().toISOString() : row.assigned_mission_updated_at,
    updated_at: new Date().toISOString(),
  };
}

function getApprovalRowOverrideIds(row = {}, fallbackEmployeeId = "") {
  const profile = remoteRowToProfile(row);
  const mappedId = getProfileMappedEmployeeId(profile);
  return [...new Set([
    fallbackEmployeeId,
    row.mappedEmployeeId,
    mappedId,
    row.id ? `profile-${row.id}` : "",
  ].filter(Boolean))];
}

function profileRowToEmployeeOverride(row = {}) {
  const profile = remoteRowToProfile(row);
  return {
    name: profile.name || row.name || "",
    nickname: profile.nickname || row.nickname || "",
    org: profile.org || "",
    role: profile.role || "직원",
    phone: profile.phone || "",
    email: profile.email || row.email || "",
    workplace: profile.workplace || "",
    primaryWork: profile.primaryWork || "",
    secondaryWork: profile.secondaryWork || "",
    workHours: profile.workHours || defaultProfile.workHours,
    weeklyWorkHours: profile.weeklyWorkHours || row.weekly_work_hours || {},
    employmentType: profile.employmentType || "직원",
    joinDate: profile.joinDate || "",
    payDay: profile.payDay || "",
    laborId: profile.laborId || "",
    address: profile.address || "",
    hourlyWage: profile.hourlyWage || "",
    dailyWage: profile.dailyWage || "",
    assignedMission: profile.assignedMission || "",
    assignedMissionVisible: profile.assignedMissionVisible !== false,
    assignedMissionUpdatedAt: profile.assignedMissionUpdatedAt || "",
    assignedMissionUpdatedBy: profile.assignedMissionUpdatedBy || "",
  };
}

function applyApprovedProfileRowLocally(row = {}, fallbackEmployeeId = "") {
  if (!row) return "";
  const override = profileRowToEmployeeOverride(row);
  const ids = getApprovalRowOverrideIds(row, fallbackEmployeeId);
  state.employeeDirectoryOverrides ||= {};
  ids.forEach((id) => {
    state.employeeDirectoryOverrides[id] = {
      ...(state.employeeDirectoryOverrides[id] || {}),
      ...override,
    };
  });

  const rowEmail = String(row.email || "").trim().toLowerCase();
  const userEmail = String(authState.user?.email || "").trim().toLowerCase();
  const isCurrentUser = Boolean((row.id && row.id === authState.user?.id) || (rowEmail && rowEmail === userEmail));
  if (isCurrentUser) {
    const profile = remoteRowToProfile(row);
    state.profile = {
      ...state.profile,
      ...profile,
      pendingProfileChanges: {},
      profileChangeRequestedAt: "",
    };
    const mappedId = getProfileMappedEmployeeId(state.profile);
    if (mappedId && !isRepresentativeProfile()) {
      state.selectedEmployeeId = mappedId;
      if (fitnessEmployeeIds.includes(mappedId)) state.fitnessWritableEmployeeId = mappedId;
    }
  }
  return getProfileMappedEmployeeId(remoteRowToProfile(row));
}

function setStaffDetailSaveStatus(message, tone = "idle") {
  const node = document.querySelector("#staffDetailSaveStatus");
  if (!node) return;
  node.dataset.tone = tone;
  node.textContent = message;
}

async function saveStaffProfileEdits(employeeId) {
  const row = getEmployeeMasterRows().find((item) => item.id === employeeId);
  if (!row || !canEditStaffProfile(row)) return;
  const fields = collectStaffDetailEditFields();
  if (!String(fields.name || "").trim()) {
    setStaffDetailSaveStatus("이름은 비울 수 없습니다.", "error");
    return;
  }
  if (!String(fields.org || "").trim()) {
    setStaffDetailSaveStatus("소속은 비울 수 없습니다.", "error");
    return;
  }
  setStaffDetailSaveStatus("저장 중...", "saving");
  if (row.sourceProfileId && supabaseClient && authState.user) {
    const sourceRow = (authState.approvalRows || []).find((item) => item.id === row.sourceProfileId) || {};
    const payload = {
      ...staffEditFieldsToRemotePayload(fields, row),
      approval_status: "approved",
      pending_profile_changes: {},
      profile_change_requested_at: null,
      approved_by: authState.user.id,
      approved_at: new Date().toISOString(),
    };
    const { error, payload: savedPayload, removedColumns } = await updateProfileRowWithSchemaFallback(row.sourceProfileId, payload);
    if (error) {
      setStaffDetailSaveStatus(`원격 저장 실패: ${error.message}`, "error");
      return;
    }
    if (removedColumns.length) {
      setStaffDetailSaveStatus("직원정보는 저장되었습니다. 일부 신규 관리항목은 최신 Supabase SQL 적용 후 원격 반영됩니다.", "done");
    }
    const mergedRow = {
      ...mergeStaffFieldsIntoApprovalRow(sourceRow, fields),
      ...savedPayload,
      id: row.sourceProfileId,
      email: fields.email || sourceRow.email || row.email,
      approval_status: "approved",
      pending_profile_changes: {},
      profile_change_requested_at: null,
    };
    authState.approvalRows = (authState.approvalRows || []).map((item) => (
      item.id === row.sourceProfileId ? mergedRow : item
    ));
    applyApprovedProfileRowLocally(mergedRow, employeeId);
    if (row.sourceProfileId === authState.user.id) {
      state.profile = {
        ...state.profile,
        ...fields,
        pendingProfileChanges: {},
        profileChangeRequestedAt: "",
      };
    }
  }
  state.employeeDirectoryOverrides ||= {};
  const localOverride = {
    ...fields,
    assignedMission: fields.assignedMission || "",
    assignedMissionVisible: fields.assignedMissionVisible !== false,
    assignedMissionUpdatedAt: fields.assignedMission !== undefined ? new Date().toISOString() : state.employeeDirectoryOverrides[employeeId]?.assignedMissionUpdatedAt,
    assignedMissionUpdatedBy: fields.assignedMission !== undefined ? (authState.user?.id || "") : state.employeeDirectoryOverrides[employeeId]?.assignedMissionUpdatedBy,
  };
  const mappedAfterEdit = getProfileMappedEmployeeId({ ...row, ...fields });
  [...new Set([employeeId, row.mappedEmployeeId, mappedAfterEdit].filter(Boolean))].forEach((id) => {
    state.employeeDirectoryOverrides[id] = {
      ...(state.employeeDirectoryOverrides[id] || {}),
      ...localOverride,
    };
  });
  saveState({ fastSave: true });
  renderStaffMaster();
  const nextEmployeeId = getEmployeeMasterRows().find((item) => item.sourceProfileId === row.sourceProfileId)?.id || mappedAfterEdit || employeeId;
  openStaffDetail(nextEmployeeId);
  setStaffDetailSaveStatus("저장되었습니다.", "done");
}

function renderStaffDetailModal(row) {
  const manual = getManualTemplateForEmployee(row);
  const permissionLabels = permissionKeys
    .filter(([key]) => row.access.permissions[key])
    .map(([, label]) => label);
  const canEdit = canEditStaffProfile(row);
  return `
    <div class="staff-detail-backdrop" data-staff-detail-close>
      <article class="staff-detail-card" role="dialog" aria-modal="true" aria-label="직원 상세">
        <button type="button" class="staff-detail-close" data-staff-detail-close aria-label="닫기">×</button>
        <header>
          <span>${escapeHtml(row.site || row.org || "직원")}</span>
          <h3>${escapeHtml(row.role || "직원")} ${escapeHtml(row.name || "")}</h3>
          <p>${escapeHtml(row.email || row.employeeCode || "")}</p>
        </header>
        <div class="staff-detail-kpis">
          <article><span>오늘 업무</span><strong>${escapeHtml(`${row.completed}/${row.tasks.length || 0}`)}</strong></article>
          <article><span>온보딩</span><strong>${escapeHtml(`${row.onboarding.done}/${row.onboarding.total}`)}</strong></article>
          <article><span>노무 기록</span><strong>${escapeHtml(`${row.labor.recordedDays || 0}일`)}</strong></article>
          <article><span>유료 PT</span><strong>${escapeHtml(`${row.labor.settlementPtCount || 0}건`)}</strong></article>
        </div>
        <div class="staff-detail-connected-actions">
          <button type="button" data-staff-open-worklog="${escapeAttr(row.mappedEmployeeId || row.id)}">업무일지 열기</button>
          ${canOpenLaborSection() ? `<button type="button" data-staff-open-labor="${escapeAttr(row.mappedEmployeeId || row.id)}">노무 월 원장</button>` : ""}
        </div>
        <dl class="staff-detail-list">
          <div><dt>소속</dt><dd>${escapeHtml(row.org || "-")}</dd></div>
          <div><dt>근무지</dt><dd>${escapeHtml(row.workplace || row.site || "-")}</dd></div>
          <div><dt>고용형태</dt><dd>${escapeHtml(row.employmentType || "직원")}</dd></div>
          <div><dt>근무시간</dt><dd>${escapeHtml(row.workHours || defaultProfile.workHours)}</dd></div>
          <div><dt>주업무</dt><dd>${escapeHtml(row.primaryWork || "-")}</dd></div>
          <div><dt>부업무</dt><dd>${escapeHtml(row.secondaryWork || "-")}</dd></div>
          <div><dt>전화</dt><dd>${escapeHtml(formatPhoneNumber(row.phone || "") || "-")}</dd></div>
          <div><dt>권한</dt><dd>${escapeHtml(permissionLabels.join(" · ") || row.access.caption || "본인 업무 중심")}</dd></div>
        </dl>
        <section class="staff-detail-section">
          <strong>역할 매뉴얼</strong>
          <p>${escapeHtml(manual?.title || "역할 매뉴얼")} · ${escapeHtml(manual?.summary || "직무 기준을 확인합니다.")}</p>
        </section>
        ${canEdit ? staffDetailMissionEditor(row) : `
          <section class="staff-detail-section">
            <strong>대표 지정 미션</strong>
            <p>${escapeHtml(getAssignedMissionForEmployee(row).visible === false ? "비공개 미션입니다." : (getAssignedMissionForEmployee(row).text || "아직 부여된 미션이 없습니다."))}</p>
          </section>
        `}
        <section class="staff-detail-section staff-detail-edit">
          <div class="staff-detail-edit-title">
            <strong>${canEdit ? "직원 정보 수정" : "직원 정보 검토"}</strong>
            <span>${escapeHtml(canEdit ? "대표 또는 권한자가 소속, 직무, 근무/노무 기준을 조정합니다." : "이 직원의 정보는 읽기 전용입니다.")}</span>
          </div>
          ${canEdit ? `
            <div class="staff-detail-edit-grid">
              ${staffDetailEditField(row, "org", "소속")}
              ${staffDetailEditField(row, "workplace", "근무지")}
              ${staffDetailEditField(row, "role", "직함")}
              ${staffDetailEditField(row, "name", "이름")}
              ${staffDetailEditField(row, "phone", "전화")}
              ${staffDetailEditField(row, "email", "이메일", "email")}
              ${staffDetailEditField(row, "employmentType", "고용형태")}
              ${staffDetailEditField(row, "joinDate", "입사일", "date")}
              ${staffDetailEditField(row, "payDay", "임금지급일(일)")}
              ${staffDetailEditField(row, "workHours", "근무시간")}
              ${staffDetailWeeklyWorkHoursEditor(row)}
              ${staffDetailEditField(row, "primaryWork", "주업무")}
              ${staffDetailEditField(row, "secondaryWork", "부업무")}
              ${staffDetailEditField(row, "hourlyWage", "시급", "number")}
              ${staffDetailEditField(row, "dailyWage", "일당", "number")}
            </div>
            <div class="staff-detail-edit-actions">
              <button type="button" data-staff-profile-save="${escapeAttr(row.id)}">수정 저장</button>
              <span id="staffDetailSaveStatus" aria-live="polite"></span>
            </div>
          ` : `
            <p>권한이 없는 직원은 타 직원 정보를 수정할 수 없습니다. 직원 원장 수정은 대표 또는 대표가 직원관리/가입승인 권한을 부여한 직원만 가능합니다.</p>
          `}
        </section>
        <section class="staff-detail-section">
          <strong>온보딩 체크</strong>
          <div class="staff-detail-chips">
            ${row.onboarding.checks.map(([label, ok]) => `<em class="${ok ? "is-done" : ""}">${escapeHtml(label)}</em>`).join("")}
          </div>
        </section>
      </article>
    </div>
  `;
}

function openStaffDetail(employeeId) {
  const row = getEmployeeMasterRows().find((item) => item.id === employeeId);
  if (!row) return;
  document.getElementById("staffDetailOverlay")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "staffDetailOverlay";
  overlay.innerHTML = renderStaffDetailModal(row);
  document.body.appendChild(overlay);
  overlay.querySelector(".staff-detail-card")?.focus?.();
}

function closeStaffDetail() {
  document.getElementById("staffDetailOverlay")?.remove();
}

function numberValue(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function getFitnessOpsSummary() {
  const logs = Object.values(state.employeeLogs?.[getActiveDateKey()] || {});
  return logs.reduce((summary, log) => {
    syncFitnessOpsFromSchedule(log);
    const ops = { ...createFitnessOps(), ...(log.fitnessOps || {}) };
    summary.ptRegular += numberValue(ops.ptRegular);
    summary.ptFree += numberValue(ops.ptFree);
    summary.ptOther += numberValue(ops.ptOther);
    summary.customerNew += numberValue(ops.customerNew);
    summary.customerRenewal += numberValue(ops.customerRenewal);
    summary.dayPass += numberValue(ops.dayPass);
    summary.consultation += numberValue(ops.consultation);
    summary.outbound += numberValue(ops.outbound);
    summary.outsideSales += numberValue(ops.outsideSales);
    if (ops.specialReport) summary.specialReports.push(ops.specialReport);
    if (ops.shiftNote) summary.shiftNotes.push(ops.shiftNote);
    return summary;
  }, {
    ptRegular: 0,
    ptFree: 0,
    ptOther: 0,
    customerNew: 0,
    customerRenewal: 0,
    dayPass: 0,
    consultation: 0,
    outbound: 0,
    outsideSales: 0,
    specialReports: [],
    shiftNotes: [],
  });
}

function renderFitnessDashboard() {
  const summary = getFitnessOpsSummary();
  const goals = { ...createFitnessGoals(), ...(state.fitnessGoals || {}) };
  const ptTotal = summary.ptRegular + summary.ptFree + summary.ptOther;
  const customerActions = summary.customerNew + summary.customerRenewal + summary.dayPass + summary.consultation + summary.outbound + summary.outsideSales;
  const consultationTarget = Math.max(1, numberValue(goals.consultationTarget));
  const ptTarget = Math.max(1, numberValue(goals.ptTarget));
  const memberTarget = Math.max(1, numberValue(goals.memberTarget));
  const membersCurrent = 240 + summary.customerNew + summary.customerRenewal;
  const consultationRate = Math.min(100, Math.round((summary.consultation / consultationTarget) * 100));
  const ptRate = Math.min(100, Math.round((ptTotal / ptTarget) * 100));
  const memberRate = Math.min(100, Math.round((membersCurrent / memberTarget) * 100));

  document.querySelectorAll("[data-fitness-goal]").forEach((field) => {
    field.value = goals[field.dataset.fitnessGoal] || "";
  });

  document.getElementById("fitnessKpiGrid").innerHTML = [
    ["회원", `${membersCurrent}/${goals.memberTarget || 0}`, `${memberRate}%`],
    ["PT", `${ptTotal}/${goals.ptTarget || 0}`, `${ptRate}%`],
    ["상담", `${summary.consultation}/${goals.consultationTarget || 0}`, `${consultationRate}%`],
    ["영업행동", `${customerActions}건`, "오늘"],
    ["특이사항", `${summary.specialReports.length}건`, summary.specialReports.length ? "확인" : "정상"],
    ["월매출 목표", `${Math.round(numberValue(goals.monthlyRevenueTarget) / 10000).toLocaleString()}만`, "목표"],
  ].map(([label, value, meta]) => `<article><span>${label}</span><strong>${value}</strong><em>${meta}</em></article>`).join("");

  const coaching = [
    ["영업", summary.consultation < consultationTarget / 30 ? "오늘 상담 기록이 낮습니다. 신규 문의, 체험권, 기존 회원 재등록 대상자를 우선 콜백하세요." : "상담 활동이 기록되고 있습니다. 상담 결과를 등록/보류/재연락으로 분류하세요."],
    ["운영", summary.shiftNotes.length ? "운영 메모가 있습니다. 마감 전 시설/청결/소모품 조치 여부를 확인하세요." : "오픈·센터관리·마감 체크가 비어 있습니다. 시간별일정에 운영 루틴을 배치하세요."],
    ["관리", summary.specialReports.length ? "특이사항 보고가 있습니다. 고객 민원, 시설, 안전 이슈는 담당자와 처리기한을 지정하세요." : "특이사항이 없더라도 시설·고객·매출 이상 여부를 한 줄로 남기면 인수인계 품질이 올라갑니다."],
    ["수익", ptTotal < ptTarget / 30 ? "PT 수행/상담 기록이 목표 대비 낮습니다. 무료 PT 후 정규 전환 스크립트를 적용하세요." : "PT 활동이 목표 흐름에 있습니다. 전환율과 객단가를 같이 기록하세요."],
  ];
  document.getElementById("fitnessCoachList").innerHTML = coaching.map(([title, text]) => `<article><b>${title}</b><span>${text}</span></article>`).join("");

  document.getElementById("fitnessManualList").innerHTML = [
    ["오픈", "조명·냉난방·음악·샤워실·안전 상태를 확인하고 06:00 전후 첫 회원 응대 준비"],
    ["영업", "신규 문의는 당일 연락, 상담 후 다음 행동을 시간별일정에 예약, 재등록 후보는 만료 14일 전부터 관리"],
    ["PT", "무료 PT → 니즈진단 → 목표제안 → 결제안내 → 다음 수업 예약 순서로 기록"],
    ["마감", "정산, 탈의실/샤워실, 소모품, 기구 정리, 미해결 이슈 인수인계"],
  ].map(([title, text]) => `<article><b>${title}</b><span>${text}</span></article>`).join("");

  document.getElementById("fitnessAgentList").innerHTML = [
    ["매출", "상담·PT·재등록 숫자가 목표선 아래면 영업 코칭을 우선 표시"],
    ["운영", "운영 메모와 특이사항이 비어 있으면 마감 전 체크리스트 입력 유도"],
    ["직원", "업무 완료율, 시간별일정 공백, 반복 미완료를 기준으로 개인 코칭 생성"],
    ["대표 보고", "하루 종료 시 KPI, 이슈, 다음 조치를 보고서 초안에 자동 정리"],
  ].map(([title, text]) => `<article><b>${title}</b><span>${text}</span></article>`).join("");
}

function renderOrganization() {
  const node = document.getElementById("organizationTree");
  const companyHtml = bangjuOrganization.map((company) => `
    <article class="organization-company">
      <header>
        <strong>${escapeHtml(company.name)}</strong>
        <span>${escapeHtml(company.category)} · ${company.staff}명</span>
      </header>
      <div>
        ${company.units.map((unit) => `
          <section>
            <b>${escapeHtml(unit.name)}</b>
            <small>${escapeHtml(unit.category)} · ${unit.staff ? `${unit.staff}명` : "겸임/관리"}</small>
            <em>${unit.roles.map(escapeHtml).join(" · ")}</em>
          </section>
        `).join("")}
      </div>
    </article>
  `).join("");
  const assetHtml = `
    <article class="organization-company">
      <header>
        <strong>건물 → 층 → 호실 → 사업장 → 브랜드 → 법인</strong>
        <span>Beyond OS 기본 계층</span>
      </header>
      <div>
        ${getAssetRows().map((row) => `
          <section>
            <b>${escapeHtml(row.building)} / ${escapeHtml(row.floor)} / ${escapeHtml(row.rooms.join(", "))}</b>
            <small>${escapeHtml(row.site)} · ${escapeHtml(row.brand)}</small>
            <em>${escapeHtml(row.operator)} · ${escapeHtml(row.status)}</em>
          </section>
        `).join("")}
      </div>
    </article>
  `;
  node.innerHTML = assetHtml + companyHtml;
}

function getCommunicationTargetOptions() {
  const options = [
    ["all", "전 사업장"],
    ["site:bangju", "(주)방주"],
    ["site:beyond", "(주)비욘드컴퍼니"],
    ["site:fitness", "비욘드 피트니스"],
    ["site:construction", "(주)비제이종합건설"],
  ];
  getEmployeeOptions()
    .filter(isAssignedWorklogEmployee)
    .forEach((employee) => options.push([`employee:${employee.id}`, getEmployeeAdminLabel(employee)]));
  return options;
}

function getCommunicationTargetLabel(value = "all") {
  return getCommunicationTargetOptions().find(([id]) => id === value)?.[1] || "전 사업장";
}

function getCommunicationAudienceIds(target = "all") {
  const assigned = getEmployeeOptions().filter(isAssignedWorklogEmployee);
  if (target === "all") return assigned.map((employee) => employee.id);
  if (target.startsWith("employee:")) return [target.replace("employee:", "")];
  if (target.startsWith("site:")) {
    const siteId = target.replace("site:", "");
    return assigned.filter((employee) => getReportArchiveSiteId(employee) === siteId).map((employee) => employee.id);
  }
  return [];
}

function getCurrentCommunicationActor() {
  const employee = getSelectedEmployee();
  const profileName = state.profile?.nickname || state.profile?.name || authState.user?.email || "";
  if (isRepresentativeProfile()) return `대표 ${profileName || "정찬훈"}`;
  return getEmployeeAdminLabel(employee);
}

function canCreateCommunication() {
  return Boolean(authState.user && (isRepresentativeProfile() || canAccessWorklogOverview() || isProfileApproved()));
}

function canManageCommunication(item = {}) {
  return isRepresentativeProfile()
    || canAccessWorklogOverview()
    || item.createdByEmail === (authState.user?.email || "")
    || item.createdBy === getCurrentCommunicationActor();
}

function isCommunicationVisible(item = {}) {
  if (isRepresentativeProfile() || canAccessWorklogOverview()) return true;
  const ownId = getMappedProfileEmployeeId() || state.selectedEmployeeId || "profile-user";
  return item.target === "all"
    || getCommunicationAudienceIds(item.target).includes(ownId)
    || item.createdByEmail === (authState.user?.email || "");
}

function getCommunicationStatus(item = {}) {
  if (isCommunicationDone(item)) return "완료";
  if (item.dueDate && item.dueDate < todayKey) return "지연";
  if (item.priority === "긴급") return "긴급";
  return "진행";
}

function isCommunicationDone(item = {}) {
  if (item.done) return true;
  const audienceIds = getCommunicationAudienceIds(item.target);
  if (!audienceIds.length) return false;
  return audienceIds.every((id) => item.confirmations?.[id]);
}

function renderCommunicationHub() {
  const type = document.getElementById("communicationType");
  const target = document.getElementById("communicationTarget");
  const title = document.getElementById("communicationTitle");
  const body = document.getElementById("communicationBody");
  const dueDate = document.getElementById("communicationDueDate");
  const priority = document.getElementById("communicationPriority");
  const openList = document.getElementById("communicationOpenList");
  const doneList = document.getElementById("communicationDoneList");
  const count = document.getElementById("communicationOpenCount");
  if (!type || !target || !title || !body || !dueDate || !priority || !openList || !doneList) return;

  const previousTarget = target.value || "all";
  target.innerHTML = getCommunicationTargetOptions()
    .map(([value, label]) => `<option value="${escapeAttr(value)}" ${previousTarget === value ? "selected" : ""}>${escapeHtml(label)}</option>`)
    .join("");
  dueDate.value ||= getActiveDateKey();

  const items = (state.communications || []).filter(isCommunicationVisible)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const openItems = items.filter((item) => !isCommunicationDone(item));
  const doneItems = items.filter(isCommunicationDone).slice(0, 8);
  if (count) count.textContent = `${openItems.length}건`;
  openList.innerHTML = openItems.length ? openItems.map(renderCommunicationItem).join("") : `<p class="communication-empty">진행 중인 전달사항이 없습니다.</p>`;
  doneList.innerHTML = doneItems.length ? doneItems.map(renderCommunicationItem).join("") : `<p class="communication-empty">확인 완료된 전달사항이 없습니다.</p>`;

  const canCreate = canCreateCommunication();
  [type, target, title, body, dueDate, priority].forEach((field) => {
    field.disabled = !canCreate;
  });
  const addButton = document.getElementById("addCommunicationButton");
  if (addButton) addButton.disabled = !canCreate;
}

function renderCommunicationItem(item = {}) {
  const status = getCommunicationStatus(item);
  const checkedCount = Object.values(item.confirmations || {}).filter(Boolean).length;
  const audienceCount = getCommunicationAudienceIds(item.target).length || 1;
  const ownId = getMappedProfileEmployeeId() || state.selectedEmployeeId || authState.user?.email || "profile-user";
  const isCheckedByMe = Boolean(item.done || item.confirmations?.[ownId]);
  return `
    <article class="communication-item is-${escapeAttr(status)}" data-communication-id="${escapeAttr(item.id)}">
      <header>
        <span>${escapeHtml(item.type || "공지")} · ${escapeHtml(getCommunicationTargetLabel(item.target))}</span>
        <b>${escapeHtml(status)}</b>
      </header>
      <strong>${escapeHtml(item.title || "제목 없음")}</strong>
      <p>${escapeHtml(item.body || "내용 없음")}</p>
      <footer>
        <span>${escapeHtml(item.createdBy || "작성자 미상")}</span>
        <em>${escapeHtml(item.dueDate ? `마감 ${formatKoreanDate(item.dueDate)}` : "마감 없음")}</em>
        <em>확인 ${checkedCount}/${audienceCount}</em>
        <button type="button" data-communication-toggle="${escapeAttr(item.id)}">${isCheckedByMe ? "확인 취소" : "확인 완료"}</button>
        ${canManageCommunication(item) ? `<button type="button" data-communication-delete="${escapeAttr(item.id)}">보관 삭제</button>` : ""}
      </footer>
    </article>
  `;
}

function addCommunication() {
  const type = document.getElementById("communicationType")?.value || "공지";
  const target = document.getElementById("communicationTarget")?.value || "all";
  const title = document.getElementById("communicationTitle")?.value.trim() || "";
  const body = document.getElementById("communicationBody")?.value.trim() || "";
  const dueDate = document.getElementById("communicationDueDate")?.value || "";
  const priority = document.getElementById("communicationPriority")?.value || "보통";
  if (!canCreateCommunication()) {
    showAppToast("로그인 후 보고·전달을 등록할 수 있습니다");
    return;
  }
  if (!title) {
    alert("제목 누락입니다.");
    return;
  }
  if (!body) {
    alert("내용 누락입니다.");
    return;
  }
  state.communications ||= [];
  state.communications.unshift({
    id: `comm-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    target,
    title,
    body,
    dueDate,
    priority,
    done: false,
    confirmations: {},
    createdBy: getCurrentCommunicationActor(),
    createdByEmail: authState.user?.email || "",
    createdAt: new Date().toISOString(),
  });
  ["communicationTitle", "communicationBody"].forEach((id) => {
    const field = document.getElementById(id);
    if (field) field.value = "";
  });
  saveState();
  renderCommunicationHub();
  showAppToast("전달사항을 등록했습니다");
}

function toggleCommunicationDone(id = "") {
  const item = (state.communications || []).find((entry) => entry.id === id);
  if (!item || !isCommunicationVisible(item)) return;
  item.confirmations ||= {};
  const ownId = getMappedProfileEmployeeId() || state.selectedEmployeeId || authState.user?.email || "profile-user";
  item.confirmations[ownId] = !item.confirmations[ownId];
  item.done = false;
  item.done = isCommunicationDone(item);
  item.updatedAt = new Date().toISOString();
  saveState();
  renderCommunicationHub();
}

function deleteCommunication(id = "") {
  const item = (state.communications || []).find((entry) => entry.id === id);
  if (!item || !canManageCommunication(item)) return;
  if (!confirm("이 전달사항을 삭제할까요?")) return;
  state.communications = (state.communications || []).filter((entry) => entry.id !== id);
  saveState();
  renderCommunicationHub();
}

function renderReport() {
  const employee = getSelectedEmployee();
  const log = getSelectedLog();
  const tasks = (log.tasks || []).filter((task) => task.text.trim());
  const entries = (log.schedule || []).filter((entry) => getScheduleEntryText(entry));
  const attendance = state.attendance?.[getActiveDateKey()] || [];
  const employeeAttendance = attendance.find((item) => item.employeeId === employee.id);
  const completed = tasks.filter((task) => task.done || task.status === "완료");
  const blocked = [...tasks, ...entries].filter((entry) => entry.status === "보류" || entry.status === "지원필요");
  document.getElementById("reportDraft").value = [
    `Bangju AI 직원 업무일지 (${getActiveDateKey()})`,
    `직원: ${employee.name} / ${employee.org} / ${employee.role}`,
    `출퇴근: ${log.clockIn || "미기록"} ~ ${log.clockOut || "미기록"}`,
    `근태: ${employeeAttendance?.status || "미기록"}${employeeAttendance?.note ? ` · ${employeeAttendance.note}` : ""}`,
    "",
    `1. 오늘의 우선업무: ${tasks.length}건`,
    ...priorityOptions.flatMap(([priority]) => tasks.filter((task) => task.priority === priority).map((task) => `- ${priority} ${task.text} (${task.status}${task.done ? ", 완료" : ""})`)),
    "",
    `2. 시간별 업무흐름: ${entries.length}건`,
    ...entries.map((entry) => `- ${entry.time || "--:--"} ${getScheduleEntryText(entry)} (${entry.status})`),
    "",
    "3. 업무요약",
    ...formatFitnessOpsReport(log.fitnessOps),
    "",
    `4. 완료 업무: ${completed.length}건`,
    ...completed.map((task) => `- ${task.priority} ${task.text}`),
    "",
    `5. 이슈/지원 필요: ${blocked.length}건`,
    ...blocked.map((entry) => `- ${entry.text || getScheduleEntryText(entry)} (${entry.status})`),
    "",
    "6. 업무보고",
    log.report || "-",
    "",
    "7. 메모",
    log.memo || "-",
  ].join("\n");
  renderCommunicationHub();
  renderReportArchive();
  renderBackupCenter();
  renderInnovationLab();
  refreshOpenReportDetail();
}

let reportDetailRestoreStack = [];
let activeReportDetail = "";

function getReportDetailConfig(action = "daily-report") {
  const configs = {
    "daily-report": {
      eyebrow: "Daily Report",
      title: "일일보고",
      description: "사업장 운영보고와 개인 업무보고를 날짜별로 확인하고 제출합니다.",
      selectors: [".report-archive-card", ".report-draft-card"],
    },
    communication: {
      eyebrow: "Communication Board",
      title: "공지·업무전달",
      description: "개인, 사업장, 전 사업장에 전달할 공지와 지시를 등록하고 확인합니다.",
      selectors: [".communication-hub-card"],
    },
    backup: {
      eyebrow: "Backup Center",
      title: "보관·백업",
      description: "업무일지, 노무, 직원 현황을 하나의 운영기록으로 묶어 보관합니다.",
      selectors: [".backup-center-card"],
    },
    innovation: {
      eyebrow: "AI Operating Lab",
      title: "AI 제안",
      description: "보고 품질, 실행력, 운영 자동화를 높이는 다음 개선 후보를 검토합니다.",
      selectors: [".innovation-lab-card"],
    },
  };
  return configs[action] || configs["daily-report"];
}

function restoreReportDetailNodes() {
  reportDetailRestoreStack.forEach(({ node, placeholder }) => {
    if (placeholder?.parentNode) placeholder.parentNode.insertBefore(node, placeholder);
    placeholder?.remove();
  });
  reportDetailRestoreStack = [];
}

function openReportDetail(action = "daily-report") {
  const sheet = document.getElementById("reportDetailSheet");
  const body = document.getElementById("reportDetailBody");
  const backdrop = document.getElementById("reportDetailBackdrop");
  if (!sheet || !body || !backdrop) return;

  restoreReportDetailNodes();
  const config = getReportDetailConfig(action);
  activeReportDetail = action;
  document.getElementById("reportDetailEyebrow").textContent = config.eyebrow;
  document.getElementById("reportDetailTitle").textContent = config.title;
  document.getElementById("reportDetailDescription").textContent = config.description;
  body.innerHTML = "";

  config.selectors.forEach((selector) => {
    const node = document.querySelector(selector);
    if (!node) return;
    const placeholder = document.createComment(`report-detail-placeholder:${selector}`);
    node.parentNode?.insertBefore(placeholder, node);
    reportDetailRestoreStack.push({ node, placeholder });
    body.appendChild(node);
  });

  document.getElementById("view-report")?.classList.add("is-detail-open");
  document.body.classList.add("is-section-detail-open");
  sheet.hidden = false;
  backdrop.hidden = false;
  window.setTimeout(() => {
    sheet.classList.add("is-open");
    backdrop.classList.add("is-open");
    sheet.focus?.();
  }, 0);
}

function closeReportDetail() {
  const sheet = document.getElementById("reportDetailSheet");
  const backdrop = document.getElementById("reportDetailBackdrop");
  if (!sheet || !backdrop) return;
  sheet.classList.remove("is-open");
  backdrop.classList.remove("is-open");
  window.setTimeout(() => {
    restoreReportDetailNodes();
    sheet.hidden = true;
    backdrop.hidden = true;
    document.getElementById("view-report")?.classList.remove("is-detail-open");
    document.body.classList.remove("is-section-detail-open");
    activeReportDetail = "";
  }, 180);
}

function refreshOpenReportDetail() {
  if (!activeReportDetail) return;
  const current = activeReportDetail;
  window.setTimeout(() => openReportDetail(current), 0);
}

function getReportArchiveSettings() {
  state.reportArchive = {
    dateKey: todayKey,
    site: "fitness",
    type: "fitness",
    selectedId: "",
    ...(state.reportArchive || {}),
  };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(state.reportArchive.dateKey || ""))) {
    state.reportArchive.dateKey = getActiveDateKey();
  }
  return state.reportArchive;
}

function setDailyReportArchiveDefaults() {
  const settings = getReportArchiveSettings();
  settings.dateKey = getActiveDateKey();
  settings.selectedId = "";
  if (isRepresentativeProfile()) {
    settings.site = "fitness";
    settings.type = "fitness";
    return settings;
  }
  const employee = getProfileMappedEmployeeId()
    ? getEmployeeOptions().find((item) => item.id === getProfileMappedEmployeeId()) || getProfileEmployee()
    : getSelectedEmployee();
  const siteId = getReportArchiveSiteId(employee);
  settings.site = siteId === "fitness" ? "fitness" : siteId || "all";
  settings.type = siteId === "fitness" ? "fitness" : "employee";
  return settings;
}

function getReportArchiveSiteOptions() {
  return [
    { id: "all", label: "전 사업장", reportTitle: "전 사업장 운영보고" },
    { id: "bangju", label: "(주)방주", reportTitle: "(주)방주 운영보고" },
    { id: "beyond", label: "(주)비욘드컴퍼니", reportTitle: "(주)비욘드컴퍼니 운영보고" },
    { id: "fitness", label: "비욘드 피트니스", reportTitle: "비욘드 피트니스 센터운영 보고서" },
    { id: "construction", label: "(주)비제이종합건설", reportTitle: "비제이종합건설 현장보고" },
  ];
}

function getReportArchiveSiteId(employee = {}) {
  const source = `${employee.org || ""} ${employee.workplace || ""} ${employee.primaryWork || ""}`;
  if (/피트니스|fitness/i.test(source)) return "fitness";
  if (/비제이|종합건설|건설/i.test(source)) return "construction";
  if (/비욘드컴퍼니|공유사업부|TBA|studio|스튜디오/i.test(source)) return "beyond";
  if (/방주/i.test(source)) return "bangju";
  return "other";
}

function getReportArchiveEmployees(siteId = "all") {
  const roster = employees.filter(isAssignedWorklogEmployee);
  const profileEmployee = getProfileEmployee();
  const shouldIncludeProfile = !isRepresentativeProfile()
    && !getMappedProfileEmployeeId()
    && isAssignedWorklogEmployee(profileEmployee)
    && String(profileEmployee.name || "").trim();
  const list = shouldIncludeProfile ? [profileEmployee, ...roster] : roster;
  return list
    .filter((employee) => !isRepresentativeWorklogEmployee(employee))
    .filter((employee) => siteId === "all" || getReportArchiveSiteId(employee) === siteId);
}

function getReportArchiveEmployeeLog(employee, dateKey) {
  const employeeId = getEmployeeWorklogId(employee);
  const logsByEmployee = state.employeeLogs?.[dateKey] || {};
  const aliases = getEmployeeWorklogAliases(employee);
  const candidates = aliases.map((id) => logsByEmployee[id]).filter(Boolean);
  const fitnessLog = getReportArchiveSiteId(employee) === "fitness"
    ? getFitnessEmployeeLogForDate(employee, dateKey)
    : null;
  const stored = fitnessLog
    || candidates.find(hasSubmittableWorklogContent)
    || candidates[0]
    || logsByEmployee[employeeId]
    || null;
  const log = stored
    ? cloneWorklogLogForAudit(stored)
    : createEmployeeLog({ ...employee, id: employeeId }, state.profile, dateKey);
  log.employeeId ||= employeeId;
  normalizeEmployeeLogRows(log, dateKey);
  log.tasks = Array.isArray(log.tasks) ? log.tasks : [];
  log.schedule = Array.isArray(log.schedule) ? log.schedule : [];
  log.fitnessOps = { ...createFitnessOps(), ...(log.fitnessOps || {}) };
  return log;
}

function getReportArchiveTaskText(task = {}) {
  return String(task.text || "").trim();
}

function getReportArchiveTasks(log) {
  return (log.tasks || []).filter((task) => getReportArchiveTaskText(task));
}

function getReportArchiveScheduleEntries(log) {
  return (log.schedule || []).filter((entry) => getScheduleEntryText(entry));
}

function getReportArchiveFitnessSummary(logs = []) {
  return logs.reduce((summary, log) => {
    const ops = { ...createFitnessOps(), ...(log.fitnessOps || {}) };
    summary.paidPt += numberValue(ops.ptRegular) + numberValue(ops.ptOther);
    summary.freePt += numberValue(ops.ptFree);
    summary.consultation += numberValue(ops.consultation);
    summary.contract += numberValue(ops.customerNew) + numberValue(ops.customerRenewal) + numberValue(ops.dayPass);
    summary.marketing += numberValue(ops.outbound) + numberValue(ops.outsideSales);
    if (String(ops.specialReport || "").trim()) summary.specialReports.push(ops.specialReport.trim());
    return summary;
  }, { paidPt: 0, freePt: 0, consultation: 0, contract: 0, marketing: 0, specialReports: [] });
}

function getWorklogReportSubmissionKey(employeeId = "", dateKey = getActiveDateKey()) {
  return `${dateKey}:${employeeId || "unknown"}`;
}

function getWorklogReportSubmission(employeeId = "", dateKey = getActiveDateKey()) {
  state.worklogReportSubmissions ||= {};
  return state.worklogReportSubmissions[getWorklogReportSubmissionKey(employeeId, dateKey)] || null;
}

function hasSubmittableWorklogContent(log = {}) {
  const ops = { ...createFitnessOps(), ...(log.fitnessOps || {}) };
  const taskHasContent = Array.isArray(log.tasks)
    ? log.tasks.some((task) => isActiveTask(task) || String(task?.text || "").trim())
    : getWorklogTaskRefs(log).some(({ task }) => isActiveTask(task));
  return Boolean(
    log.clockIn
    || log.clockOut
    || String(log.report || log.record || log.memo || "").trim()
    || taskHasContent
    || (log.schedule || []).some((entry) => String(getScheduleEntryText(entry) || "").trim())
    || Object.values(ops).some((value) => String(value || "").trim())
  );
}

function canSubmitWorklogReport(employeeId = "") {
  return canEditEmployeeSlot(employeeId);
}

function submitWorklogReport(employeeId = "", dateKey = getActiveDateKey()) {
  const employee = getProfileEmployeeForMappedSlot(employeeId)
    || findEmployeeRecordById(employeeId)
    || getEmployeeOptions().find((item) => item.id === employeeId)
    || getProfileEmployee();
  const log = getReportArchiveEmployeeLog(employee, dateKey);
  if (!canSubmitWorklogReport(employeeId)) {
    showAppToast("본인 업무일지만 제출할 수 있습니다");
    return;
  }
  if (!hasSubmittableWorklogContent(log)) {
    showAppToast("업무기록을 먼저 작성한 뒤 제출하세요");
    return;
  }
  state.worklogReportSubmissions ||= {};
  state.worklogReportSubmissions[getWorklogReportSubmissionKey(employeeId, dateKey)] = {
    status: "submitted",
    dateKey,
    employeeId,
    submittedBy: getEmployeeAdminLabel(employee),
    submittedById: employeeId,
    submittedAt: new Date().toISOString(),
  };
  saveState();
  renderReportArchive();
  showAppToast("오늘 업무일지를 제출했습니다");
}

function formatWorklogSubmissionStatus(employeeId = "", dateKey = getActiveDateKey()) {
  const record = getWorklogReportSubmission(employeeId, dateKey);
  if (!record?.submittedAt) return "미제출";
  const time = formatFitnessCenterConfirmationTime(record.submittedAt);
  return `제출 완료${time ? ` · ${time}` : ""}`;
}

function buildEmployeeArchiveReport(employee, dateKey) {
  const log = getReportArchiveEmployeeLog(employee, dateKey);
  const tasks = getReportArchiveTasks(log);
  const entries = getReportArchiveScheduleEntries(log);
  const completed = tasks.filter((task) => task.done || task.status === "완료");
  const reportText = [...new Set([log.report, log.record].map((text) => String(text || "").trim()).filter(Boolean))].join("\n");
  const isFitness = getReportArchiveSiteId(employee) === "fitness";
  const fitnessLines = isFitness ? formatFitnessOpsReport(log.fitnessOps) : [];
  const title = isFitness ? `${getEmployeeAdminLabel(employee)} 직원 업무일지 보고서` : `${getEmployeeAdminLabel(employee)} 개인 업무보고서`;
  const submitted = getWorklogReportSubmission(employee.id, dateKey);
  const html = isFitness
    ? renderFitnessReportTemplate(buildFitnessReportModel({ employee, dateKey, isCenter: false, log }))
    : renderWorklogDailyReportTemplate(buildWorklogDailyReportModel({ employee, dateKey, log }));
  return {
    id: `employee:${employee.id}`,
    kind: "employee",
    employeeId: employee.id,
    siteId: getReportArchiveSiteId(employee),
    title,
    eyebrow: `${formatKoreanDate(dateKey)} · ${employee.org || "소속 미정"}`,
    meta: `${employee.role || "직원"} · ${employee.name || ""}`,
    countLabel: `${tasks.length}/${entries.length}`,
    empty: !tasks.length && !entries.length && !reportText,
    submitted,
    canSubmit: canSubmitWorklogReport(employee.id),
    html,
    kindLabel: isFitness ? "직원 업무일지" : "개인 업무보고",
    text: [
      `< ${title} >`,
      `기준일: ${formatFormalKoreanDate(dateKey)}`,
      `담당: ${getEmployeeAdminLabel(employee)}`,
      `소속: ${employee.org || "-"}`,
      `출퇴근: ${log.clockIn || "미기록"} ~ ${log.clockOut || "미기록"}`,
      "",
      `1. 업무보고`,
      reportText || "오늘 보고 내용이 아직 없습니다.",
      "",
      `2. 주요업무 (${completed.length}/${tasks.length})`,
      ...(tasks.length ? tasks.map((task) => `- ${task.priority || "?"} ${task.text} (${task.status || "예정"}${task.done ? ", 완료" : ""})`) : ["- 입력 대기"]),
      "",
      `3. 시간별 일정 (${entries.length}건)`,
      ...(entries.length ? entries.map((entry) => `- ${entry.time || "--:--"} ${getScheduleEntryText(entry)}`) : ["- 입력 대기"]),
      ...(isFitness ? ["", "4. 피트니스 업무요약", ...fitnessLines] : []),
      "",
      "5. 메모",
      log.memo || "-",
    ].join("\n"),
  };
}

function buildSiteArchiveReport(site, dateKey) {
  const employeesForSite = getReportArchiveEmployees(site.id);
  const logs = employeesForSite.map((employee) => getReportArchiveEmployeeLog(employee, dateKey));
  const taskTotal = logs.reduce((sum, log) => sum + getReportArchiveTasks(log).length, 0);
  const scheduleTotal = logs.reduce((sum, log) => sum + getReportArchiveScheduleEntries(log).length, 0);
  const reports = logs.filter((log) => String(log.report || log.record || log.memo || "").trim()).length;
  const attendance = state.attendance?.[dateKey] || [];
  const attendanceCount = employeesForSite.filter((employee) => attendance.some((row) => row.employeeId === employee.id)).length;
  const fitness = site.id === "fitness" ? getReportArchiveFitnessSummary(logs) : null;
  const title = site.reportTitle;
  const reportLines = employeesForSite.map((employee, index) => {
    const employeeReport = buildEmployeeArchiveReport(employee, dateKey);
    return `${index + 1}. ${getEmployeeAdminLabel(employee)} · 업무 ${employeeReport.countLabel} · ${employeeReport.empty ? "보고 대기" : "기록 있음"}`;
  });
  return {
    id: `site:${site.id}`,
    kind: "site",
    siteId: site.id,
    title,
    eyebrow: `${formatKoreanDate(dateKey)} · ${site.label}`,
    meta: `${employeesForSite.length}명 · 보고 ${reports}건`,
    countLabel: `${taskTotal}/${scheduleTotal}`,
    empty: !employeesForSite.length,
    html: site.id === "fitness" ? renderFitnessReportTemplate(buildFitnessReportModel({ dateKey, isCenter: true })) : "",
    kindLabel: site.id === "fitness" ? "센터 운영현황" : "사업장 보고",
    text: [
      `< ${title} >`,
      `기준일: ${formatFormalKoreanDate(dateKey)}`,
      `사업장: ${site.label}`,
      `직원: ${employeesForSite.length}명`,
      "",
      "1. 운영 집계",
      `- 업무보고 작성: ${reports}건`,
      `- 출결 기록: ${attendanceCount}/${employeesForSite.length}명`,
      `- 주요업무: ${taskTotal}건`,
      `- 시간별 일정: ${scheduleTotal}건`,
      ...(fitness ? [
        `- 유료 PT: ${fitness.paidPt}건`,
        `- 무료 PT: ${fitness.freePt}건`,
        `- 상담/계약: ${fitness.consultation + fitness.contract}건`,
      ] : []),
      "",
      "2. 직원별 보고 상태",
      ...(reportLines.length ? reportLines : ["- 배정된 직원이 없습니다."]),
      "",
      "3. 운영 신호",
      reports < employeesForSite.length ? "- 미작성 업무보고가 있어 확인이 필요합니다." : "- 업무보고가 정상적으로 취합되었습니다.",
      attendanceCount < employeesForSite.length ? "- 출결 기록 공백이 있습니다." : "- 출결 기록이 확인되었습니다.",
      ...(fitness?.specialReports?.length ? ["", "4. 피트니스 특이사항", ...fitness.specialReports.map((item) => `- ${item}`)] : []),
    ].join("\n"),
  };
}

function buildLaborArchiveReport(employee, dateKey) {
  const employeeId = getLaborEmployeeLogId(employee);
  const month = String(dateKey || getActiveDateKey()).slice(0, 7);
  const labor = buildMonthlyLaborSummary(employeeId, employee, month);
  const ledger = buildLaborCostLedger(labor, employee);
  const payroll = buildPayrollStatement(labor, employee, ledger);
  const practice = buildLaborPracticeReview(labor, employee, payroll);
  const payrollReady = payroll.checks.filter(([, ok]) => ok).length;
  const issueCount = labor.lateCount + labor.earlyCount + labor.absenceCount;
  return {
    id: `labor:${employeeId}`,
    kind: "labor",
    employeeId,
    siteId: getReportArchiveSiteId(employee),
    title: `${getEmployeeAdminLabel(employee)} 노무 월 보고`,
    eyebrow: `${labor.monthLabel} · ${employee.org || "소속 미정"}`,
    meta: `${labor.recordedDays}일 · ${formatMinutesAsHours(labor.actualMinutes)} · 확인 ${practice.exceptions.length}건`,
    countLabel: `${labor.recordedDays}/${payrollReady}`,
    empty: !labor.recordedDays && !labor.actualMinutes,
    kindLabel: "노무 월 보고",
    text: [
      `< ${getEmployeeAdminLabel(employee)} ${labor.monthLabel} 노무 월 보고 >`,
      `소속/근무지: ${payroll.org} / ${payroll.workplace}`,
      `고용형태: ${payroll.employmentType}`,
      `근무일/실근무: ${labor.recordedDays}일 / ${formatMinutesAsHours(labor.actualMinutes)}`,
      `연장/야간/휴일: ${formatMinutesAsHours(labor.overtimeMinutes)} / ${formatMinutesAsHours(labor.nightMinutes)} / ${formatMinutesAsHours(labor.holidayMinutes)}`,
      `지각/조퇴/결근: ${labor.lateCount}/${labor.earlyCount}/${labor.absenceCount}`,
      `유료 PT/무료 PT: ${labor.settlementPtCount}/${labor.freePtCount}`,
      `급여명세 준비: ${payrollReady}/${payroll.checks.length}`,
      `지급총액/차인지급액: ${formatCurrency(payroll.grossPay) || "계산 대기"} / ${formatCurrency(payroll.netPay) || "계산 대기"}`,
      "",
      "보완 대기",
      ...practice.exceptions.map(([title, text]) => `- ${title}: ${text}`),
      "",
      issueCount ? `근태 예외 ${issueCount}건을 원장과 대조해야 합니다.` : "자동 점검상 근태 예외가 없습니다.",
      "지급·신고·징계·퇴직 처리는 공인노무사 또는 관계기관 확인 후 확정합니다.",
    ].join("\n"),
  };
}

function buildReportArchiveItems(settings = getReportArchiveSettings()) {
  const sites = getReportArchiveSiteOptions().filter((site) => settings.site === "all" ? site.id !== "all" : site.id === settings.site);
  const items = [];
  if (settings.type === "labor") {
    if (!canOpenLaborSection()) return items;
    getVisibleLaborEmployees()
      .filter((employee) => settings.site === "all" || getReportArchiveSiteId(employee) === settings.site)
      .forEach((employee) => items.push(buildLaborArchiveReport(employee, settings.dateKey)));
    return items;
  }
  if (settings.type === "all" || settings.type === "site" || settings.type === "fitness") {
    sites
      .filter((site) => settings.type !== "fitness" || site.id === "fitness")
      .forEach((site) => items.push(buildSiteArchiveReport(site, settings.dateKey)));
  }
  if (settings.type === "all" || settings.type === "employee" || settings.type === "fitness") {
    const employeesForArchive = getReportArchiveEmployees(settings.type === "fitness" ? "fitness" : settings.site);
    employeesForArchive.forEach((employee) => items.push(buildEmployeeArchiveReport(employee, settings.dateKey)));
  }
  return items;
}

function renderReportArchive() {
  const dateInput = document.getElementById("reportArchiveDate");
  const siteSelect = document.getElementById("reportArchiveSite");
  const typeSelect = document.getElementById("reportArchiveType");
  const listNode = document.getElementById("reportArchiveList");
  const previewNode = document.getElementById("reportArchivePreview");
  if (!dateInput || !siteSelect || !typeSelect || !listNode || !previewNode) return;

  const settings = getReportArchiveSettings();
  const laborOption = typeSelect.querySelector('option[value="labor"]');
  if (laborOption) {
    laborOption.hidden = !canOpenLaborSection();
    laborOption.disabled = !canOpenLaborSection();
  }
  if (settings.type === "labor" && !canOpenLaborSection()) {
    settings.type = "employee";
    settings.selectedId = "";
  }
  dateInput.value = settings.dateKey;
  const siteOptions = getReportArchiveSiteOptions();
  siteSelect.innerHTML = siteOptions.map((site) => `<option value="${site.id}" ${site.id === settings.site ? "selected" : ""}>${escapeHtml(site.label)}</option>`).join("");
  typeSelect.value = settings.type;

  const items = buildReportArchiveItems(settings);
  if (!items.some((item) => item.id === settings.selectedId)) {
    settings.selectedId = items[0]?.id || "";
  }
  const selected = items.find((item) => item.id === settings.selectedId);
  document.getElementById("reportArchiveCount").textContent = `${items.length}건`;
  listNode.innerHTML = items.length
    ? items.map((item) => `
      <button type="button" class="${item.id === settings.selectedId ? "is-active" : ""}" data-report-archive-id="${escapeHtml(item.id)}">
        <span><i>${escapeHtml(item.kindLabel || (item.kind === "site" ? "사업장 보고" : "직원 보고"))}</i>${escapeHtml(item.eyebrow)}</span>
        <strong>${escapeHtml(item.title)}</strong>
        <em>${escapeHtml(item.meta)} · ${item.kind === "labor" ? "근무일/명세준비" : "업무/일정"} ${escapeHtml(item.countLabel)}</em>
      </button>
    `).join("")
    : `<div class="report-archive-empty">해당 조건의 보고서가 없습니다.</div>`;
  if (!selected) {
    previewNode.textContent = "보고서를 선택하면 미리보기가 표시됩니다.";
    return;
  }
  const submissionStatus = selected.kind === "employee"
    ? formatWorklogSubmissionStatus(selected.employeeId, settings.dateKey)
    : "";
  const canSubmit = selected.kind === "employee" && selected.canSubmit && !selected.submitted?.submittedAt;
  const canConfirmCenter = selected.kind === "site" && selected.siteId === "fitness" && canConfirmFitnessCenterReport(settings.dateKey);
  const centerRecord = selected.kind === "site" && selected.siteId === "fitness" ? getFitnessCenterReportRecord(settings.dateKey) : null;
  const statusLabel = selected.kind === "site" && selected.siteId === "fitness"
    ? getFitnessCenterReportStatusText(settings.dateKey)
    : submissionStatus;
  previewNode.innerHTML = `
    <div class="report-archive-preview-actions">
      <div>
        <span>${escapeHtml(selected.kindLabel || (selected.kind === "site" ? "사업장 보고" : "직원 보고"))} · ${escapeHtml(selected.eyebrow)}</span>
        <strong>${escapeHtml(selected.title)}</strong>
        ${statusLabel ? `<em>${escapeHtml(statusLabel)}</em>` : ""}
      </div>
      ${canSubmit ? `<button type="button" data-report-submit-worklog="${escapeHtml(selected.employeeId)}">업무일지 제출</button>` : ""}
      ${selected.submitted?.submittedAt ? `<b>제출 완료</b>` : ""}
      ${canConfirmCenter ? `<button type="button" data-report-confirm-center>${centerRecord?.confirmedAt ? "확정 취소" : "센터 보고 확정"}</button>` : ""}
      ${selected.kind === "labor" ? `<button type="button" data-report-open-labor="${escapeAttr(selected.employeeId)}">노무 원장 열기</button>` : ""}
    </div>
    <div class="report-archive-paper-wrap">
      ${selected.html || `<pre>${escapeHtml(selected.text || "")}</pre>`}
    </div>
  `;
}

function getBackupSettings() {
  state.backupSettings ||= {};
  return {
    recipientEmail: state.backupSettings.recipientEmail || "j3010@ymail.com",
    cadence: state.backupSettings.cadence || "daily",
    lastPreparedAt: state.backupSettings.lastPreparedAt || "",
  };
}

function collectBackupMetrics() {
  const logs = state.employeeLogs?.[getActiveDateKey()] || {};
  const attendance = state.attendance?.[getActiveDateKey()] || [];
  const metrics = {
    employees: Object.keys(logs).length,
    taskTotal: 0,
    taskDone: 0,
    scheduleTotal: 0,
    reports: 0,
    attendanceRecords: attendance.length,
    fitnessPaidPt: 0,
    fitnessFreePt: 0,
    consultation: 0,
    contract: 0,
    riskSignals: [],
  };

  Object.values(logs).forEach((log) => {
    const tasks = (log.tasks || []).filter((task) => String(task.text || "").trim());
    const schedules = (log.schedule || []).filter((entry) => getScheduleEntryText(entry));
    metrics.taskTotal += tasks.length;
    metrics.taskDone += tasks.filter((task) => task.done || task.status === "완료").length;
    metrics.scheduleTotal += schedules.length;
    if (String(log.report || log.memo || "").trim()) metrics.reports += 1;
    metrics.fitnessPaidPt += Number(log.fitnessOps?.paidPt || 0);
    metrics.fitnessFreePt += Number(log.fitnessOps?.freePt || 0);
    metrics.consultation += Number(log.fitnessOps?.consultation || 0);
    metrics.contract += Number(log.fitnessOps?.newMember || 0) + Number(log.fitnessOps?.renewal || 0);
  });

  if (!metrics.reports) metrics.riskSignals.push("업무보고 미작성");
  if (metrics.taskTotal && metrics.taskDone / metrics.taskTotal < 0.5) metrics.riskSignals.push("완료율 50% 미만");
  if (!metrics.attendanceRecords) metrics.riskSignals.push("출결 기록 부족");
  if (metrics.fitnessFreePt > metrics.fitnessPaidPt && metrics.fitnessFreePt > 0) metrics.riskSignals.push("무료 PT 비중 확인");

  return metrics;
}

function buildBackupPayload(options = {}) {
  const createdAt = new Date().toISOString();
  const dateKey = getActiveDateKey();
  const metrics = collectBackupMetrics();
  const employeeLogs = state.employeeLogs?.[dateKey] || {};
  const employeesSnapshot = getEmployeeOptions().map((employee) => {
    const log = employeeLogs[employee.id];
    return {
      id: employee.id,
      org: employee.org,
      role: employee.role,
      name: employee.name,
      editableByCurrentUser: canEditEmployeeSlot(employee.id),
      clockIn: log?.clockIn || "",
      clockOut: log?.clockOut || "",
      taskTotal: (log?.tasks || []).filter((task) => String(task.text || "").trim()).length,
      scheduleTotal: (log?.schedule || []).filter((entry) => getScheduleEntryText(entry)).length,
      report: log?.report || "",
      memo: log?.memo || "",
      fitnessOps: log?.fitnessOps || null,
    };
  });

  if (options.markPrepared) {
    state.backupSettings = { ...getBackupSettings(), lastPreparedAt: createdAt };
  }
  return {
    app: "Bangju AI Worklog",
    version: 1,
    createdAt,
    date: dateKey,
    recipientEmail: getBackupSettings().recipientEmail,
    cadence: getBackupSettings().cadence,
    activeView,
    profile: {
      email: state.profile?.email || authState.user?.email || "",
      org: state.profile?.org || "",
      role: state.profile?.role || "",
      name: state.profile?.name || "",
      nickname: state.profile?.nickname || "",
    },
    metrics,
    employees: employeesSnapshot,
    attendance: state.attendance?.[dateKey] || [],
    worklogStates: {
      selectedEmployeeId: state.selectedEmployeeId,
      fitnessWritableEmployeeId: state.fitnessWritableEmployeeId,
      employeeLogs,
    },
    integrity: {
      algorithm: "SHA-256",
      note: "hash field is calculated in the browser preview and download flow",
    },
    automationPlan: {
      recommended: "서버 자동실행 또는 Vercel Cron + Email API",
      reason: "정적 웹앱은 앱이 닫힌 상태에서 주기적 메일 발송을 실행할 수 없습니다.",
      endpointContract: {
        method: "POST",
        path: "/api/backup-mail",
        body: "buildBackupPayload() JSON",
      },
    },
  };
}

function buildBackupSummaryText(payload = buildBackupPayload()) {
  const metrics = payload.metrics;
  return [
    `[Bangju AI Worklog 백업] ${formatKoreanDate(payload.date)}`,
    `생성: ${new Date(payload.createdAt).toLocaleString("ko-KR")}`,
    `수신: ${payload.recipientEmail}`,
    `주기: ${payload.cadence === "daily" ? "매일" : payload.cadence === "weekly" ? "매주" : "매월"}`,
    "",
    `직원 로그: ${metrics.employees}명`,
    `업무: ${metrics.taskDone}/${metrics.taskTotal} 완료`,
    `시간별 일정: ${metrics.scheduleTotal}건`,
    `보고/메모 작성: ${metrics.reports}명`,
    `출결 기록: ${metrics.attendanceRecords}건`,
    `피트니스: 유료PT ${metrics.fitnessPaidPt} · 무료PT ${metrics.fitnessFreePt} · 상담 ${metrics.consultation} · 계약 ${metrics.contract}`,
    `백업 검증: SHA-256 지문으로 파일 변경 여부 확인`,
    "",
    `운영 신호: ${metrics.riskSignals.length ? metrics.riskSignals.join(", ") : "특이 위험 없음"}`,
    "",
    "자동 메일 발송은 서버 스케줄러 연결 후 이 백업 패키지 기준으로 실행합니다.",
  ].join("\n");
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function hashBackupPayload(payload) {
  const source = stableStringify({ ...payload, createdAt: "", integrity: { algorithm: "SHA-256" } });
  if (window.crypto?.subtle) {
    const buffer = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
    return Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash << 5) - hash + source.charCodeAt(index);
    hash |= 0;
  }
  return `local-${Math.abs(hash).toString(16).padStart(8, "0")}`;
}

function getBackupCoverageLabel(metrics) {
  const pieces = [
    `${metrics.employees}명`,
    `업무 ${metrics.taskTotal}`,
    `일정 ${metrics.scheduleTotal}`,
    `출결 ${metrics.attendanceRecords}`,
  ];
  return pieces.join(" · ");
}

function renderBackupAutomationLane(payload) {
  const node = document.getElementById("backupAutomationLane");
  if (!node) return;
  const steps = [
    ["01", "패키지", "업무·출결·노무 데이터 묶음"],
    ["02", "검증", "SHA-256 무결성 지문"],
    ["03", "보관", "JSON 백업 파일 또는 원격 저장"],
    ["04", "발송", "Cron/Edge Function 연결 대기"],
  ];
  node.innerHTML = steps.map(([number, title, text], index) => `
    <section class="${index < 3 ? "is-ready" : ""}">
      <b>${number}</b>
      <strong>${title}</strong>
      <span>${text}</span>
    </section>
  `).join("");
  const automationState = document.getElementById("backupAutomationState");
  if (automationState) automationState.textContent = payload.automationPlan?.endpointContract ? "연결 준비" : "준비";
}

async function renderBackupCenter() {
  const emailInput = document.getElementById("backupRecipientEmail");
  const cadenceSelect = document.getElementById("backupCadence");
  const preview = document.getElementById("backupPreview");
  const status = document.getElementById("backupStatus");
  if (!emailInput || !cadenceSelect || !preview) return;

  const settings = getBackupSettings();
  if (document.activeElement !== emailInput) emailInput.value = settings.recipientEmail;
  if (cadenceSelect.value !== settings.cadence) cadenceSelect.value = settings.cadence;
  const payload = buildBackupPayload();
  const summary = buildBackupSummaryText(payload);
  preview.textContent = summary;
  const jsonSize = new TextEncoder().encode(JSON.stringify(payload)).length;
  const hash = await hashBackupPayload(payload);
  const hashNode = document.getElementById("backupIntegrityHash");
  const sizeNode = document.getElementById("backupPayloadSize");
  const coverageNode = document.getElementById("backupCoverage");
  if (hashNode) hashNode.textContent = hash.slice(0, 12);
  if (sizeNode) sizeNode.textContent = formatBytes(jsonSize);
  if (coverageNode) coverageNode.textContent = getBackupCoverageLabel(payload.metrics);
  renderBackupAutomationLane(payload);
  if (status) {
    const label = settings.cadence === "daily" ? "매일" : settings.cadence === "weekly" ? "매주" : "매월";
    status.textContent = `${label} 백업 패키지 준비`;
  }
}

async function copyBackupSummary() {
  const payload = buildBackupPayload({ markPrepared: true });
  const text = buildBackupSummaryText(payload);
  saveState({ fastSave: true });
  try {
    await navigator.clipboard?.writeText(text);
    alert("백업 요약을 복사했습니다.");
  } catch {
    alert(text);
  }
}

function downloadBackupJson() {
  const payload = buildBackupPayload({ markPrepared: true });
  hashBackupPayload(payload).then((hash) => {
    payload.integrity.hash = hash;
  }).finally(() => {
    saveState({ fastSave: true });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bangju-worklog-backup-${payload.date}.json`;
    link.click();
    URL.revokeObjectURL(url);
  });
}

function validateBackupPayload(payload) {
  const failures = [];
  if (!payload || typeof payload !== "object") failures.push("파일 형식이 JSON 백업이 아닙니다.");
  if (payload?.app !== "Bangju AI Worklog") failures.push("Bangju AI Worklog 백업 파일이 아닙니다.");
  if (!payload?.date || !/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) failures.push("백업 날짜가 올바르지 않습니다.");
  if (!payload?.worklogStates?.employeeLogs) failures.push("업무일지 데이터가 없습니다.");
  if (!payload?.metrics) failures.push("백업 요약 지표가 없습니다.");
  return {
    ok: failures.length === 0,
    failures,
  };
}

async function readBackupFile(file) {
  const text = await file.text();
  const payload = JSON.parse(text);
  const validation = validateBackupPayload(payload);
  const hash = await hashBackupPayload(payload);
  return { payload, validation, hash };
}

function openBackupFilePicker(mode = "validate") {
  const input = document.getElementById("backupRestoreFile");
  if (!input) return;
  input.dataset.mode = mode;
  input.value = "";
  input.click();
}

async function handleBackupRestoreFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const { payload, validation, hash } = await readBackupFile(file);
    const summary = [
      validation.ok ? "백업 파일 검증 완료" : "백업 파일 검증 실패",
      `날짜: ${payload.date || "-"}`,
      `생성: ${payload.createdAt ? new Date(payload.createdAt).toLocaleString("ko-KR") : "-"}`,
      `직원 로그: ${payload.metrics?.employees ?? "-"}명`,
      `업무/일정: ${payload.metrics?.taskTotal ?? "-"} / ${payload.metrics?.scheduleTotal ?? "-"}`,
      `무결성: ${hash.slice(0, 16)}`,
      ...(validation.failures.length ? ["", ...validation.failures.map((item) => `- ${item}`)] : []),
    ].join("\n");
    if (event.target.dataset.mode === "restore" && validation.ok) {
      alert(`${summary}\n\n복구 적용은 아직 자동 병합하지 않습니다. 대표 확인 후 안전 복구 단계에서 적용하도록 설계했습니다.`);
      return;
    }
    alert(summary);
  } catch (error) {
    alert(`백업 파일을 읽지 못했습니다: ${error.message}`);
  }
}

function openBackupEmailDraft() {
  const payload = buildBackupPayload({ markPrepared: true });
  const recipient = String(payload.recipientEmail || "j3010@ymail.com").replace(/[^\w.@+-]/g, "");
  const subject = encodeURIComponent(`[Bangju AI Worklog 백업] ${formatKoreanDate(payload.date)}`);
  const rawBody = `${buildBackupSummaryText(payload)}\n\n※ 전체 JSON 백업은 '백업 파일 저장'으로 내려받아 이 메일에 첨부하면 됩니다.`;
  const body = encodeURIComponent(rawBody.slice(0, 3600));
  saveState({ fastSave: true });
  window.location.href = `mailto:${recipient}?subject=${subject}&body=${body}`;
}

function getInnovationItems() {
  return [
    ["공지 확인 추적", "전 사업장·특정 사업장·개인별 전달사항의 확인 여부와 지연 상태를 한곳에서 봅니다."],
    ["업무지시 에이전트", "대표 지시가 업무일지의 우선업무와 시간별일정으로 이어지도록 다음 행동을 제안합니다."],
    ["인수인계 보드", "오픈·마감·외출·휴무처럼 놓치기 쉬운 교대 정보를 다음 근무자에게 자동 요약합니다."],
    ["운영 신호 레이더", "미작성, 지각, 무료수업 과다, 민원 반복을 자동 감지해 대표 개입 우선순위를 만듭니다."],
    ["목표-업무 자동 연결", "PT, 상담, 재등록, 시설 개선 목표가 오늘 업무와 자동으로 연결되어 성과로 누적됩니다."],
    ["역할별 매뉴얼 코치", "센터장, 재무, 공유사업, TBA, 인포, 트레이너별 매뉴얼을 상황에 맞게 꺼내 줍니다."],
    ["직원 성장 로그", "업무 패턴, 완료율, 커뮤니케이션, 책임감 변화를 월별 성장 리포트로 정리합니다."],
    ["자료 보관 패키지", "보고서, 공지, 노무, 업무지시를 날짜와 사업장 기준으로 묶어 대표 메일 보관용으로 정리합니다."],
  ];
}

function renderInnovationLab() {
  const node = document.getElementById("innovationList");
  if (!node) return;
  node.innerHTML = getInnovationItems().map(([title, text], index) => `
    <section>
      <b>${String(index + 1).padStart(2, "0")}</b>
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(text)}</span>
    </section>
  `).join("");
}

function buildFitnessReportLines() {
  const model = buildFitnessReportModel();
  return [
    model.title,
    `작성일: ${model.dateLabel}`,
    `작성자: ${model.writer}`,
    `출퇴근: ${model.clock}`,
    `날씨: ${model.weatherText}${model.weatherAddress ? ` (${model.weatherAddress})` : ""}`,
    ...(model.isCenter ? [`확정: ${model.confirmation?.confirmedAt ? getFitnessCenterReportStatusText(model.dateKey) : "미확정"}`] : []),
    "",
    "[금일 주요업무]",
    ...model.topTasks.map((task) => `- ${task}`),
    "",
    "[시간별 세부업무]",
    ...model.schedule.map((entry) => `- ${formatReportTime(entry.time)} ${entry.text || ""}`),
    "",
    "[운영 KPI]",
    ...model.kpis.map(([label, value]) => `- ${label}: ${value}`),
    "",
    "[특이사항 및 인수인계]",
    ...model.issueRows.map((row) => `- ${row}`),
    "",
    "[AI 보완 코칭]",
    ...getFitnessReportCoachingRows(model).map(([title, text]) => `- ${title}: ${text}`),
  ];
}

function getNextDateKey(dateKey) {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + 1);
  return formatDateKey(date);
}

function formatReportClock(value = "") {
  return String(value || "").trim() || "-";
}

function getReportClockMinutes(clockIn = "", clockOut = "") {
  const start = timeToMinutes(clockIn);
  const endRaw = timeToMinutes(clockOut);
  if (!Number.isFinite(start) || !Number.isFinite(endRaw)) return 0;
  const end = endRaw < start ? endRaw + 24 * 60 : endRaw;
  return Math.max(0, end - start);
}

function formatReportWorkDuration(minutes = 0) {
  if (!minutes) return "";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!rest) return String(hours);
  return `${hours}시간 ${rest}분`;
}

function getFitnessReportLogEntries(dateKey, isCenter, employee) {
  if (isCenter) {
    return getFitnessCenterEmployees().map((item) => ({
      employee: item,
      log: getReportArchiveEmployeeLog(item, dateKey),
    }));
  }
  return [{
    employee,
    log: getReportArchiveEmployeeLog(employee, dateKey),
  }];
}

function summarizeFitnessReportRows(logEntries = []) {
  const rows = logEntries.map(({ employee, log }, index) => {
    const ops = { ...createFitnessOps(), ...(log.fitnessOps || {}) };
    const ptRegular = numberValue(ops.ptRegular);
    const ptFree = numberValue(ops.ptFree);
    const ptOther = numberValue(ops.ptOther);
    const customerNew = numberValue(ops.customerNew);
    const customerRenewal = numberValue(ops.customerRenewal);
    const dayPass = numberValue(ops.dayPass);
    const consultation = numberValue(ops.consultation);
    const inbound = numberValue(ops.inbound);
    const outbound = numberValue(ops.outbound);
    const outsideSales = numberValue(ops.outsideSales);
    const breakSummary = (log.attendanceBreaks || [])
      .map((record) => `${record.start || "--:--"}~${record.end || "--:--"}`)
      .join(" / ");
    const workMinutes = getReportClockMinutes(log.clockIn, log.clockOut);
    return {
      no: index + 1,
      role: employee.role || "직원",
      name: employee.name || getEmployeeOwnLabel(employee),
      clockIn: formatReportClock(log.clockIn),
      clockOut: formatReportClock(log.clockOut),
      workDuration: formatReportWorkDuration(workMinutes),
      attendanceNote: breakSummary || "",
      attendanceStatus: getAttendanceStatusForLog(employee, log),
      ptRegular,
      ptFree,
      ptOther,
      ptTotal: ptRegular + ptFree + ptOther,
      customerNew,
      customerRenewal,
      dayPass,
      contractOther: 0,
      contractTotal: customerNew + customerRenewal + dayPass,
      inbound,
      outbound,
      outsideSales,
      consultation,
      customerOther: 0,
      customerTotal: inbound + outbound + outsideSales + consultation,
      recordText: [ops.specialReport, ops.shiftNote, log.report, log.memo].filter(Boolean).join(" / "),
    };
  });
  const totals = rows.reduce((sum, row) => {
    ["ptRegular", "ptFree", "ptOther", "ptTotal", "customerNew", "customerRenewal", "dayPass", "contractOther", "contractTotal", "inbound", "outbound", "outsideSales", "consultation", "customerOther", "customerTotal"].forEach((key) => {
      sum[key] = (sum[key] || 0) + numberValue(row[key]);
    });
    return sum;
  }, {});
  return { rows, totals };
}

function getFitnessReportTaskRows(logEntries = [], { limit = 3, minRows = 3 } = {}) {
  const tasks = logEntries.flatMap(({ log }) => getWorklogTaskRefs(log).map((ref) => ref.task).filter(isActiveTask));
  const selected = Number.isFinite(limit) ? tasks.slice(0, limit) : tasks;
  const rows = selected.map((task) => `${task.priority || "?"} ${task.text || ""}${task.done || task.status === "완료" ? " (완료)" : ""}`.trim());
  while (rows.length < minRows) rows.push("");
  return rows;
}

function getFitnessReportDirectRecordRows(logEntries = []) {
  const seen = new Set();
  return logEntries
    .flatMap(({ employee, log }) => {
      const ops = { ...createFitnessOps(), ...(log.fitnessOps || {}) };
      return [ops.specialReport, ops.shiftNote, log.report, log.record, log.memo]
        .map((text) => String(text || "").trim())
        .filter(Boolean)
        .map((text) => `${employee.name || getEmployeeOwnLabel(employee)}: ${text}`);
    })
    .filter((row) => {
      const key = row.replace(/\s+/g, " ").trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function padFitnessReportRecordRows(rows = [], count = 3) {
  return rows
    .slice(0, count)
    .concat(Array(3).fill(""))
    .slice(0, count);
}

function getFitnessCenterGeneratedRecordRows(logEntries = [], context = {}) {
  const { totals = {}, weatherText = "" } = context;
  const rows = [];
  const add = (text) => {
    const value = String(text || "").trim();
    if (value && !rows.includes(value)) rows.push(value);
  };
  const paidPt = numberValue(totals.ptRegular);
  const freePt = numberValue(totals.ptFree);
  const consult = numberValue(totals.consultation);
  const renewal = numberValue(totals.customerRenewal);
  const newMembers = numberValue(totals.customerNew);
  const outbound = numberValue(totals.outbound);
  const inbound = numberValue(totals.inbound);
  const attendanceReady = logEntries.filter(({ log }) => log?.clockIn || log?.clockOut).length;
  const missingAttendance = logEntries.filter(({ log }) => !log?.clockIn && !log?.clockOut).length;

  if (paidPt || freePt || consult || renewal || newMembers || outbound || inbound) {
    add(`운영 집계: 유료PT ${paidPt}건, 무료PT ${freePt}건, 상담 ${consult}건, 신규 ${newMembers}건, 재등록 ${renewal}건, 아웃바운드 ${outbound}건, 인바운드 ${inbound}건.`);
  }
  if (attendanceReady || missingAttendance) {
    add(`출결 확인: ${attendanceReady}명 기록, ${missingAttendance}명 미기록입니다. 마감 전 출퇴근 기록을 확인하세요.`);
  }

  const scheduleHighlights = logEntries.flatMap(({ employee, log }) => (log.schedule || [])
    .filter((entry) => getScheduleEntryText(entry))
    .slice(0, 2)
    .map((entry) => `${employee.name || getEmployeeOwnLabel(employee)} ${entry.time || ""} ${getScheduleEntryText(entry)}`.trim()));
  if (scheduleHighlights.length) add(`핵심 실행: ${scheduleHighlights.slice(0, 3).join(" / ")}`);
  if (weatherText && !/미기록|주소 입력 필요/.test(weatherText)) {
    add(`환경 기록: ${weatherText}. 현장 컨디션과 고객 응대 특이사항을 함께 확인하세요.`);
  }
  if (!rows.length) add("직원 업무보고와 운영기록을 입력하면 오늘의 기록이 자동으로 정리됩니다.");
  return rows;
}

function getFitnessReportRecordRows(logEntries = [], context = {}) {
  const directRows = getFitnessReportDirectRecordRows(logEntries);
  if (!context.isCenter) return padFitnessReportRecordRows(directRows, Math.max(3, directRows.length));
  return padFitnessReportRecordRows([
    ...directRows,
    ...getFitnessCenterGeneratedRecordRows(logEntries, context),
  ]);
}

function getWorklogReportTaskStatus(task = {}) {
  if (task.done || task.status === "완료") return "완료";
  return task.status || "예정";
}

function buildWorklogDailyReportModel(options = {}) {
  const employee = options.employee || getSelectedEmployee();
  const dateKey = options.dateKey || getActiveDateKey();
  const log = options.log || getReportArchiveEmployeeLog(employee, dateKey);
  const tasks = getReportArchiveTasks(log);
  const schedule = getReportArchiveScheduleEntries(log);
  const completed = tasks.filter((task) => task.done || task.status === "완료");
  const pending = tasks.filter((task) => !task.done && !["완료", "취소", "위임"].includes(task.status));
  const issueTasks = tasks.filter((task) => ["지원필요", "보류", "연기"].includes(task.status));
  const tomorrowLog = getReportArchiveEmployeeLog(employee, getNextDateKey(dateKey));
  const tomorrowTasks = getReportArchiveTasks(tomorrowLog);
  const tomorrowSchedule = getReportArchiveScheduleEntries(tomorrowLog);
  const siteKey = getSiteWeatherKeyForEmployee(employee);
  const weather = getWeatherRecordForSite(siteKey, dateKey);
  const reportText = [...new Set([log.report, log.record].map((text) => String(text || "").trim()).filter(Boolean))].join("\n");
  const memoText = String(log.memo || "").trim();
  const completionRate = tasks.length ? Math.round((completed.length / tasks.length) * 100) : 0;
  const nextActions = [
    ...pending.map((task) => task.text),
    ...tomorrowTasks.map((task) => task.text),
    ...tomorrowSchedule.map((entry) => `${entry.time || ""} ${getScheduleEntryText(entry)}`.trim()),
  ].filter(Boolean).slice(0, 5);
  return {
    title: `< ${employee.org || "Bangju Group"} 일일 업무보고서 >`,
    dateKey,
    dateLabel: formatKoreanDate(dateKey),
    employee,
    writer: employee.name || getEmployeeOwnLabel(employee),
    role: employee.role || "직원",
    workplace: employee.workplace || siteKey,
    siteKey,
    address: getSiteWeatherAddress(siteKey),
    weather,
    weatherText: formatWeatherSummary(weather, { compact: true }),
    clock: `${log.clockIn || "미기록"} ~ ${log.clockOut || "미기록"}`,
    tasks: tasks.map((task) => ({ priority: task.priority || "?", text: task.text, status: getWorklogReportTaskStatus(task) })),
    schedule: schedule.map((entry) => ({ time: entry.time || "--:--", text: getScheduleEntryText(entry), type: inferScheduleType(getScheduleEntryText(entry)) })),
    reportText,
    memoText,
    issueRows: [
      ...issueTasks.map((task) => `${task.text} · ${getWorklogReportTaskStatus(task)}`),
      ...(memoText ? [memoText] : []),
      ...(!issueTasks.length && !memoText ? ["기록된 이슈 또는 지원 요청이 없습니다."] : []),
    ].slice(0, 5),
    tomorrowRows: nextActions.length ? nextActions : ["명일 계획을 입력해주세요."],
    completedCount: completed.length,
    taskCount: tasks.length,
    completionRate,
    evidenceCount: schedule.length + (reportText ? 1 : 0),
  };
}

function renderWorklogDailyReportTemplate(model = buildWorklogDailyReportModel()) {
  const taskRows = model.tasks.length ? model.tasks : [{ priority: "-", text: "입력된 우선업무가 없습니다.", status: "대기" }];
  const scheduleRows = model.schedule.length ? model.schedule : [{ time: "--:--", text: "입력된 시간별 일정이 없습니다.", type: "대기" }];
  return `
    <article class="worklog-daily-report-page">
      <header class="worklog-report-paper-header">
        <div>
          <small>Bangju Operating Report · Daily Execution Record</small>
          <h2>${escapeHtml(model.title)}</h2>
          <p>${escapeHtml(model.workplace)} · ${escapeHtml(model.address || "사업장 주소 입력 필요")}</p>
        </div>
        <table aria-label="결재선"><thead><tr><th>작성</th><th>검토</th><th>승인</th></tr></thead><tbody><tr><td>${escapeHtml(model.writer)}</td><td></td><td></td></tr></tbody></table>
      </header>
      <dl class="worklog-report-meta">
        <dt>작성일</dt><dd>${escapeHtml(model.dateLabel)}</dd>
        <dt>작성자</dt><dd>${escapeHtml(model.writer)}</dd>
        <dt>소속/직급</dt><dd>${escapeHtml(`${model.employee.org || "-"} / ${model.role}`)}</dd>
        <dt>출퇴근</dt><dd>${escapeHtml(model.clock)}</dd>
        <dt>사업장 날씨</dt><dd>${escapeHtml(model.weatherText)}</dd>
      </dl>
      <section class="worklog-report-executive">
        <div><span>업무 완료</span><strong>${model.completedCount}/${model.taskCount}</strong></div>
        <div><span>완료율</span><strong>${model.completionRate}%</strong></div>
        <div><span>실행 근거</span><strong>${model.evidenceCount}건</strong></div>
        <p><b>금일 핵심 성과</b>${escapeHtml(model.reportText || model.tasks.find((task) => task.status === "완료")?.text || "업무보고 내용을 입력해주세요.")}</p>
      </section>
      <section class="worklog-report-table-section">
        <h3>1. 업무 진행 현황</h3>
        <table><thead><tr><th>우선</th><th>업무내용</th><th>상태</th></tr></thead><tbody>${taskRows.map((task) => `<tr><td>${escapeHtml(task.priority)}</td><td>${escapeHtml(task.text)}</td><td>${escapeHtml(task.status)}</td></tr>`).join("")}</tbody></table>
      </section>
      <section class="worklog-report-table-section">
        <h3>2. 시간대별 실행 내역</h3>
        <table><thead><tr><th>시간</th><th>세부업무</th><th>분류</th></tr></thead><tbody>${scheduleRows.map((entry) => `<tr><td>${escapeHtml(entry.time)}</td><td>${escapeHtml(entry.text)}</td><td>${escapeHtml(entry.type)}</td></tr>`).join("")}</tbody></table>
      </section>
      <section class="worklog-report-bottom-grid">
        <div><h3>3. 이슈·리스크·지원 요청</h3>${model.issueRows.map((row) => `<p>• ${escapeHtml(row)}</p>`).join("")}</div>
        <div><h3>4. 명일 계획·인수인계</h3>${model.tomorrowRows.map((row) => `<p>• ${escapeHtml(row)}</p>`).join("")}</div>
      </section>
      <footer class="worklog-report-action-brief">
        <b>Bangju Action Brief</b>
        <span>업무일지 원문과 시간대별 기록을 근거로 자동 정리했습니다. 미완료 업무는 다음 실행계획에서 재확인합니다.</span>
      </footer>
    </article>
  `;
}

function renderOpenWorklogReport() {
  const preview = document.getElementById("worklogReportPreview");
  if (!preview) return;
  preview.innerHTML = renderWorklogDailyReportTemplate(buildWorklogDailyReportModel());
  fitWorklogReportPreview();
}

function openWorklogReportSheet() {
  const backdrop = document.getElementById("worklogReportBackdrop");
  const sheet = document.getElementById("worklogReportSheet");
  const subtitle = document.getElementById("worklogReportSubtitle");
  if (!backdrop || !sheet) return;
  if (subtitle) subtitle.textContent = `${formatKoreanDate(getActiveDateKey())} · ${getEmployeeAdminLabel(getSelectedEmployee())}`;
  renderOpenWorklogReport();
  backdrop.hidden = false;
  sheet.hidden = false;
  requestAnimationFrame(() => {
    sheet.classList.add("is-open");
    fitWorklogReportPreview();
  });
}

function fitWorklogReportPreview() {
  const preview = document.getElementById("worklogReportPreview");
  const page = preview?.querySelector(".worklog-daily-report-page");
  if (!preview || !page) return;
  preview.style.removeProperty("--worklog-report-scale");
  preview.style.removeProperty("height");
  if (!window.matchMedia("(max-width: 760px)").matches) return;
  const pageWidth = 760;
  const scale = Math.min(1, Math.max(0.4, (preview.clientWidth - 2) / pageWidth));
  preview.style.setProperty("--worklog-report-scale", String(scale));
  preview.style.height = `${Math.ceil(page.offsetHeight * scale) + 4}px`;
}

function closeWorklogReportSheet() {
  const backdrop = document.getElementById("worklogReportBackdrop");
  const sheet = document.getElementById("worklogReportSheet");
  sheet?.classList.remove("is-open");
  window.setTimeout(() => {
    if (backdrop) backdrop.hidden = true;
    if (sheet) sheet.hidden = true;
  }, 160);
}

function buildWorklogDailyReportLines(model = buildWorklogDailyReportModel()) {
  return [
    model.title,
    `작성일: ${model.dateLabel}`,
    `작성자: ${model.writer} / ${model.role}`,
    `사업장: ${model.workplace}`,
    `날씨: ${model.weatherText}${model.address ? ` (${model.address})` : ""}`,
    `출퇴근: ${model.clock}`,
    "", "[금일 핵심 성과]", model.reportText || "업무보고 내용 없음",
    "", "[업무 진행 현황]", ...model.tasks.map((task) => `- ${task.priority} ${task.text} (${task.status})`),
    "", "[시간대별 실행 내역]", ...model.schedule.map((entry) => `- ${entry.time} ${entry.text} (${entry.type})`),
    "", "[이슈·리스크·지원 요청]", ...model.issueRows.map((row) => `- ${row}`),
    "", "[명일 계획·인수인계]", ...model.tomorrowRows.map((row) => `- ${row}`),
  ];
}

function getWorklogReportFileBase(model = buildWorklogDailyReportModel()) {
  const person = String(model.writer || "직원").replace(/[^0-9A-Za-z가-힣_-]+/g, "-");
  return `Bangju-업무보고서-${model.dateKey}-${person}`;
}

function getWorklogReportExportHeight(model = buildWorklogDailyReportModel()) {
  const taskOverflow = Math.max(0, model.tasks.length - 8) * 34;
  const scheduleOverflow = Math.max(0, model.schedule.length - 12) * 30;
  return Math.max(1754, 1754 + taskOverflow + scheduleOverflow);
}

function getWorklogReportExportCss(height = 1754) {
  return `
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif; color: #17211d; }
    .worklog-daily-report-page { width: 1240px; min-height: ${height}px; padding: 54px; background: #fffefa; border: 2px solid #1d513f; }
    .worklog-report-paper-header { display: grid; grid-template-columns: 1fr 330px; gap: 30px; align-items: end; padding-bottom: 26px; border-bottom: 5px solid #174c3a; }
    .worklog-report-paper-header small { color: #527064; font-size: 17px; font-weight: 800; letter-spacing: .08em; }
    .worklog-report-paper-header h2 { margin: 8px 0; color: #123d2f; font-size: 38px; line-height: 1.15; }
    .worklog-report-paper-header p { margin: 0; color: #64736c; font-size: 17px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #9cad9f; padding: 9px 10px; font-size: 16px; line-height: 1.35; vertical-align: middle; overflow-wrap: anywhere; }
    th { background: #e9f0e9; color: #214b3c; font-weight: 900; }
    .worklog-report-paper-header table th, .worklog-report-paper-header table td { text-align: center; height: 46px; }
    .worklog-report-meta { display: grid; grid-template-columns: 120px 1fr 120px 1fr; margin: 24px 0 18px; border: 1px solid #9cad9f; }
    .worklog-report-meta dt, .worklog-report-meta dd { margin: 0; padding: 11px 13px; border-bottom: 1px solid #c2cec5; font-size: 16px; }
    .worklog-report-meta dt { background: #eef3ea; color: #315848; font-weight: 900; }
    .worklog-report-meta dd { font-weight: 750; }
    .worklog-report-executive { display: grid; grid-template-columns: 170px 170px 170px 1fr; gap: 10px; margin-bottom: 22px; }
    .worklog-report-executive > div, .worklog-report-executive > p { margin: 0; padding: 15px; border: 1px solid #afc0b4; background: #f2f6ed; }
    .worklog-report-executive span, .worklog-report-executive b { display: block; color: #466356; font-size: 14px; }
    .worklog-report-executive strong { display: block; margin-top: 4px; color: #123d2f; font-size: 28px; }
    .worklog-report-executive p { font-size: 16px; line-height: 1.5; }
    .worklog-report-executive p b { margin-bottom: 5px; }
    section h3 { margin: 20px 0 8px; color: #173f32; font-size: 20px; }
    .worklog-report-table-section table th:first-child, .worklog-report-table-section table td:first-child { width: 110px; text-align: center; }
    .worklog-report-table-section table th:last-child, .worklog-report-table-section table td:last-child { width: 150px; text-align: center; }
    .worklog-report-bottom-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 12px; }
    .worklog-report-bottom-grid > div { min-height: 150px; padding: 14px 18px; border: 1px solid #afc0b4; background: #fafbf6; }
    .worklog-report-bottom-grid h3 { margin-top: 0; }
    .worklog-report-bottom-grid p { margin: 7px 0; font-size: 15px; line-height: 1.45; }
    .worklog-report-action-brief { display: flex; gap: 18px; margin-top: 20px; padding: 15px 18px; background: #174c3a; color: white; font-size: 14px; line-height: 1.45; }
    .worklog-report-action-brief b { flex: 0 0 auto; color: #dcebdc; }
  `;
}

async function renderWorklogReportCanvas() {
  const width = 1240;
  const model = buildWorklogDailyReportModel();
  const height = getWorklogReportExportHeight(model);
  const html = `<div xmlns="http://www.w3.org/1999/xhtml"><style>${getWorklogReportExportCss(height)}</style>${renderWorklogDailyReportTemplate(model)}</div>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="${width}" height="${height}">${html}</foreignObject></svg>`;
  if (document.fonts?.ready) await document.fonts.ready;
  const image = new Image();
  image.decoding = "async";
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
  });
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.fillStyle = "#fffefa";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0);
  return canvas;
}

async function saveWorklogReportImage() {
  const model = buildWorklogDailyReportModel();
  const blob = await canvasToBlob(await renderWorklogReportCanvas(), "image/png");
  downloadBlob(blob, `${getWorklogReportFileBase(model)}.png`);
}

async function saveWorklogReportPdf() {
  const model = buildWorklogDailyReportModel();
  const pdf = createPdfBlobFromCanvas(await renderWorklogReportCanvas());
  downloadBlob(pdf, `${getWorklogReportFileBase(model)}.pdf`);
}

async function shareWorklogDailyReport() {
  const model = buildWorklogDailyReportModel();
  const canvas = await renderWorklogReportCanvas();
  const pngBlob = await canvasToBlob(canvas, "image/png");
  const pdfBlob = createPdfBlobFromCanvas(canvas);
  const base = getWorklogReportFileBase(model);
  const files = [
    new File([pngBlob], `${base}.png`, { type: "image/png" }),
    new File([pdfBlob], `${base}.pdf`, { type: "application/pdf" }),
  ];
  if (navigator.canShare?.({ files }) && navigator.share) {
    await navigator.share({ title: model.title, text: `${model.dateLabel} ${model.writer} 업무보고서`, files });
    return;
  }
  const text = buildWorklogDailyReportLines(model).join("\n");
  if (navigator.share) {
    await navigator.share({ title: model.title, text });
    return;
  }
  await navigator.clipboard?.writeText(text);
  showAppToast("보내기 대신 보고서 내용을 복사했습니다");
}

async function copyWorklogDailyReport() {
  const text = buildWorklogDailyReportLines().join("\n");
  try {
    await navigator.clipboard?.writeText(text);
    showAppToast("업무보고서를 복사했습니다");
  } catch {
    alert(text);
  }
}

function openWorklogReportArchive() {
  const employee = getSelectedEmployee();
  state.reportArchive = {
    ...(state.reportArchive || {}),
    dateKey: getActiveDateKey(),
    site: getReportArchiveSiteId(employee),
    type: "employee",
    selectedId: `employee:${employee.id}`,
  };
  closeWorklogReportSheet();
  saveState({ fastSave: true });
  switchView("report");
}

function printWorklogDailyReport() {
  document.body.classList.add("is-printing-worklog-report");
  window.print();
  window.setTimeout(() => document.body.classList.remove("is-printing-worklog-report"), 500);
}

function getFitnessReportIssueTitle(model = {}) {
  return model.isCenter ? "오늘의 기록" : "특이사항 / 인수인계";
}

function getFitnessReportSourceNote(model = {}) {
  return model.isCenter
    ? "직원 업무보고, 운영기록, 시간표, 출결을 취합합니다."
    : "개인 업무보고와 메모를 우선 반영합니다.";
}

function getFitnessReportIssueRowsHtml(model = {}) {
  const sourceRows = model.issueRows || [];
  const rows = padFitnessReportRecordRows(sourceRows, Math.max(3, sourceRows.length));
  return `
    <h3>${escapeHtml(getFitnessReportIssueTitle(model))}</h3>
    <small>${escapeHtml(getFitnessReportSourceNote(model))}</small>
    ${rows.map((row, index) => `<p><b>${index + 1}</b><span>${escapeHtml(row || "")}</span></p>`).join("")}
  `;
}

function getFitnessReportClassStats(employee = {}, dateKey = getActiveDateKey(), isCenter = false, dailyTotals = {}) {
  const monthPrefix = String(dateKey || getActiveDateKey()).slice(0, 7);
  const roster = isCenter ? getFitnessCenterEmployees() : [employee];
  const monthly = roster
    .filter(isAssignedWorklogEmployee)
    .reduce((summary, item) => {
      const row = buildFitnessCenterEmployeeMonthRow(item, monthPrefix);
      summary.paid += numberValue(row.paidPtTotal) + numberValue(row.ops?.ptOther);
      summary.free += numberValue(row.freePtTotal);
      return summary;
    }, { paid: 0, free: 0 });
  return {
    paid: {
      today: numberValue(dailyTotals.ptRegular) + numberValue(dailyTotals.ptOther),
      month: monthly.paid,
    },
    free: {
      today: numberValue(dailyTotals.ptFree),
      month: monthly.free,
    },
  };
}

function sanitizeFitnessCoachText(value = "") {
  return String(value || "")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[이메일 제거]")
    .replace(/(?:\+?82[-\s]?)?0?1[016789][-\s]?\d{3,4}[-\s]?\d{4}/g, "[연락처 제거]")
    .replace(/([가-힣]{2,4})(?=\s*(회원|고객|님))/g, "해당 ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 900);
}

function getFitnessAiCoachingCache() {
  try {
    const parsed = JSON.parse(localStorage.getItem(fitnessAiCoachingStorageKey) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function setFitnessAiCoachingCache(key, entry) {
  const cache = getFitnessAiCoachingCache();
  cache[key] = entry;
  const trimmed = Object.fromEntries(Object.entries(cache)
    .sort((left, right) => String(right[1]?.generatedAt || "").localeCompare(String(left[1]?.generatedAt || "")))
    .slice(0, 40));
  localStorage.setItem(fitnessAiCoachingStorageKey, JSON.stringify(trimmed));
}

function getFitnessReportAiFingerprint(context = {}) {
  const source = stableStringify(context);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function buildFitnessReportAiContext({ dateKey, isCenter, employee, sourceLog, logEntries, totals, classStats, manual }) {
  const taskRefs = logEntries.flatMap(({ log }) => getWorklogTaskRefs(log));
  const tasks = taskRefs.map(({ task }) => ({
    text: sanitizeFitnessCoachText(task.text),
    status: task.done || task.status === "완료" ? "완료" : task.status || "미완료",
  })).filter((task) => task.text).slice(0, 18);
  const scheduleTypes = {};
  logEntries.forEach(({ log }) => (log.schedule || []).forEach((entry) => {
    const text = getScheduleEntryText(entry);
    if (!text) return;
    const type = inferScheduleType(text) || "업무";
    scheduleTypes[type] = (scheduleTypes[type] || 0) + 1;
  }));
  const assignedMission = getAssignedMissionForEmployee(employee);
  return {
    dateKey,
    reportType: isCenter ? "센터 운영 취합" : "개인 업무보고",
    employee: isCenter ? { name: "센터 전체", role: "운영 취합" } : {
      name: sanitizeFitnessCoachText(employee.name || getEmployeeOwnLabel(employee)),
      role: sanitizeFitnessCoachText(employee.role || "직원"),
    },
    attendance: isCenter ? "센터 취합" : `${sourceLog.clockIn || "미기록"} ~ ${sourceLog.clockOut || "미기록"}`,
    taskSummary: {
      total: tasks.length,
      completed: tasks.filter((task) => task.status === "완료").length,
      items: tasks,
    },
    scheduleSummary: {
      total: Object.values(scheduleTypes).reduce((sum, count) => sum + count, 0),
      types: scheduleTypes,
    },
    performance: {
      paidPtToday: classStats.paid.today,
      paidPtMonth: classStats.paid.month,
      freePtToday: classStats.free.today,
      freePtMonth: classStats.free.month,
      consultation: numberValue(totals.consultation),
      contract: numberValue(totals.contractTotal),
      promotion: numberValue(totals.outbound),
      marketing: numberValue(totals.outsideSales),
    },
    reportNotes: getFitnessReportRecordRows(logEntries, { isCenter, totals })
      .map(sanitizeFitnessCoachText)
      .filter(Boolean)
      .slice(0, 8),
    assignedMission: assignedMission?.visible ? sanitizeFitnessCoachText(assignedMission.text) : "",
    manual: {
      title: manual.title,
      guidelines: String(manual.text || "").split("\n").map(sanitizeFitnessCoachText).filter(Boolean).slice(0, 8),
    },
  };
}

function getFitnessReportManualTemplate(employee = {}) {
  const source = `${employee.role || ""} ${employee.primaryWork || ""} ${employee.workplace || ""}`;
  if (/센터장|총괄|실장/.test(source)) return { key: "manager", template: fitnessManualTemplates.manager };
  if (/인포|고객응대/.test(source)) return { key: "frontDesk", template: fitnessManualTemplates.frontDesk };
  if (/트레이너|PT|수업/i.test(source)) return { key: "trainer", template: fitnessManualTemplates.trainer };
  if (/상담|계약|영업/.test(source)) return { key: "sales", template: fitnessManualTemplates.sales };
  if (/홍보|마케팅/.test(source)) return { key: "marketing", template: fitnessManualTemplates.marketing };
  if (/시설/.test(source)) return { key: "facility", template: fitnessManualTemplates.facility };
  if (/청결|청소/.test(source)) return { key: "cleaning", template: fitnessManualTemplates.cleaning };
  return { key: "manager", template: fitnessManualTemplates.manager };
}

function getFitnessReportCoachingRows(model = {}) {
  if (model.aiCoaching) {
    return [
      ["칭찬", model.aiCoaching.praise],
      ["피드백", model.aiCoaching.feedback],
      ["다음 행동", model.aiCoaching.nextAction],
      ["매뉴얼", model.aiCoaching.manualReminder],
    ];
  }
  const completed = model.aiContext?.taskSummary?.completed || 0;
  const scheduleTotal = model.aiContext?.scheduleSummary?.total || 0;
  const praise = completed
    ? `우선업무 ${completed}건을 완료하며 오늘의 실행을 기록한 점이 좋습니다.`
    : scheduleTotal
      ? `시간별 일정 ${scheduleTotal}건을 기록해 업무 흐름을 남긴 점이 좋습니다.`
      : "업무보고서를 열어 오늘의 실행을 점검한 태도가 좋습니다.";
  const fallback = model.coaching || [];
  const manualLine = model.aiContext?.manual?.guidelines?.[0] || "직급별 매뉴얼의 핵심 기준을 다음 근무 전에 확인해주세요.";
  return [
    ["칭찬", praise],
    ["피드백", fallback.find(([title]) => title === "우선업무")?.[1] || "업무 결과와 후속 조치를 한 줄 더 남겨주세요."],
    ["다음 행동", fallback.find(([title]) => title === "시간관리")?.[1] || "다음 근무의 첫 실행업무를 미리 정해주세요."],
    ["매뉴얼", manualLine],
  ];
}

function buildFitnessReportModel(options = {}) {
  const page = getCurrentFitnessLogPage();
  const dateKey = options.dateKey || getActiveDateKey();
  const isCenter = options.isCenter ?? page?.type === "center";
  const employee = options.employee
    || page?.employee
    || employees.find((item) => item.id === state.fitnessWritableEmployeeId)
    || getSelectedEmployee();
  const logEntries = getFitnessReportLogEntries(dateKey, isCenter, employee);
  if (!isCenter && options.log) logEntries[0].log = options.log;
  const sourceLog = options.log || logEntries[0]?.log || getReportArchiveEmployeeLog(employee, dateKey);
  const nextLogEntries = getFitnessReportLogEntries(getNextDateKey(dateKey), isCenter, employee);
  const entries = logEntries.flatMap(({ log }) => (log.schedule || []).filter((entry) => entry.time && (isCenter ? getScheduleEntryText(entry) : true)));
  const { rows: staffRows, totals } = summarizeFitnessReportRows(logEntries);
  const classStats = getFitnessReportClassStats(employee, dateKey, isCenter, totals);
  const title = isCenter ? "< 비욘드 피트니스 운영일지 >" : "< 비욘드 피트니스 업무일지 >";
  const confirmation = isCenter ? getFitnessCenterReportRecord(dateKey) : null;
  const weatherEmployee = isCenter
    ? employees.find((item) => item.id === "beyond-fitness-manager") || employee
    : employee;
  const weatherSiteKey = getSiteWeatherKeyForEmployee(weatherEmployee);
  const weather = getWeatherRecordForSite(weatherSiteKey, dateKey);
  const weatherText = formatWeatherSummary(weather, { compact: true });
  const { key: manualRoleKey, template: manualTemplate } = getFitnessReportManualTemplate(employee);
  const manual = {
    ...manualTemplate,
    text: getManualSettings().customByRole?.[manualRoleKey] || manualTemplate.text,
  };
  const aiContext = buildFitnessReportAiContext({ dateKey, isCenter, employee, sourceLog, logEntries, totals, classStats, manual });
  const aiKey = `${dateKey}:${isCenter ? "center" : employee.id}:${getFitnessReportAiFingerprint(aiContext)}`;
  const aiCacheEntry = getFitnessAiCoachingCache()[aiKey] || null;
  const model = {
    title,
    dateKey,
    isCenter,
    confirmation,
    canConfirmCenterReport: isCenter && canConfirmFitnessCenterReport(dateKey),
    dateLabel: formatKoreanDate(dateKey),
    writer: isCenter ? "센터 전체" : employee.name || getEmployeeOwnLabel(employee),
    role: isCenter ? "운영 취합" : employee.role || "직원",
    ownerLabel: isCenter ? "담당 : 센터 운영 취합" : `담당 : ${employee.role || "직원"} ${employee.name || getEmployeeOwnLabel(employee)}`,
    clock: isCenter ? "센터 취합" : `${sourceLog.clockIn || "-"} ~ ${sourceLog.clockOut || "-"}`,
    weather,
    weatherText,
    weatherAddress: getSiteWeatherAddress(weatherSiteKey),
    weatherSiteKey,
    staffRows,
    totals,
    classStats,
    approvalColumns: ["담당", "팀장", "센터장"],
    topTasks: getFitnessReportTaskRows(logEntries, { limit: isCenter ? 3 : Infinity, minRows: 3 }),
    tomorrowTasks: getFitnessReportTaskRows(nextLogEntries, { limit: isCenter ? 3 : Infinity, minRows: 3 }),
    schedule: entries.map((entry) => ({
      time: entry.time,
      text: getScheduleEntryText(entry),
    })),
    kpis: [
      ["유료PT", `${classStats.paid.today}/${classStats.paid.month}`],
      ["무료PT", `${classStats.free.today}/${classStats.free.month}`],
      ["상담", `${numberValue(totals.consultation)}건`],
      ["계약", `${numberValue(totals.contractTotal)}건`],
      ["홍보", `${numberValue(totals.outbound)}건`],
      ["마케팅", `${numberValue(totals.outsideSales)}건`],
    ],
    issueRows: getFitnessReportRecordRows(logEntries, { isCenter, totals, weatherText }),
    coaching: getFitnessCoachingMessages({ page, employee, log: sourceLog, dateKey }),
    aiContext,
    aiKey,
    aiCoaching: aiCacheEntry?.coaching || null,
    aiCoachModel: aiCacheEntry?.model || "",
    aiCoachGeneratedAt: aiCacheEntry?.generatedAt || "",
  };
  return model;
}

function formatReportTime(value = "") {
  const minutes = timeToMinutes(value);
  if (!Number.isFinite(minutes)) return value || "--:--";
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  if (hour === 0 && minute === 0) return "자정 00:00";
  const label = hour < 12 ? "오전" : "오후";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${label} ${String(displayHour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function renderFitnessReportTemplate(model = buildFitnessReportModel()) {
  const scheduleRows = getFitnessReportScheduleRows(model.schedule);
  const taskRows = model.topTasks.map((task, index) => `<p><b>${index + 1}</b><span>${escapeHtml(task || "")}</span></p>`).join("");
  const tomorrowRows = model.tomorrowTasks.map((task, index) => `<p><b>${index + 1}</b><span>${escapeHtml(task || "")}</span></p>`).join("");
  const approvalCells = model.approvalColumns.map((label) => `<th>${escapeHtml(label)}</th>`).join("");
  const approvalBlanks = model.approvalColumns.map((label) => `<td>${label === "센터장" && model.confirmation?.confirmedAt ? "확정" : ""}</td>`).join("");
  const centerOpsRows = model.staffRows.map((row) => `
    <tr>
      <td>${escapeHtml(row.no)}</td>
      <td>${escapeHtml(row.role)}</td>
      <td>${escapeHtml(row.name)}</td>
      <td>${escapeHtml(row.clockIn)}</td>
      <td>${escapeHtml(row.clockOut)}</td>
      <td>${escapeHtml(row.workDuration)}</td>
      <td>${escapeHtml(row.ptRegular || "")}</td>
      <td>${escapeHtml(row.ptFree || "")}</td>
      <td>${escapeHtml(row.ptOther || "")}</td>
      <td>${escapeHtml(row.customerNew || "")}</td>
      <td>${escapeHtml(row.customerRenewal || "")}</td>
      <td>${escapeHtml(row.consultation || "")}</td>
      <td>${escapeHtml(row.outbound || "")}</td>
      <td>${escapeHtml(row.inbound || "")}</td>
      <td>${escapeHtml(row.recordText || row.attendanceNote || row.attendanceStatus || "")}</td>
    </tr>
  `).join("");
  return `
    <article class="fitness-report-page ${model.isCenter ? "is-center-report" : "is-personal-report"}">
      <header class="fitness-paper-top">
        <div>
          <strong>${escapeHtml(model.title)}</strong>
          <span>${escapeHtml(model.ownerLabel)}</span>
        </div>
        <dl>
          <dt>작성일</dt><dd>${escapeHtml(model.dateLabel)}</dd>
          <dt>작성자</dt><dd>${escapeHtml(model.writer)}</dd>
          <dt>구분</dt><dd>${escapeHtml(model.role)}</dd>
          <dt>출퇴근</dt><dd>${escapeHtml(model.clock)}</dd>
          <dt>날씨</dt><dd>${escapeHtml(model.weatherText)}</dd>
          ${model.isCenter ? `<dt>확정</dt><dd>${escapeHtml(model.confirmation?.confirmedAt ? getFitnessCenterReportStatusText(model.dateKey) : "미확정")}</dd>` : ""}
        </dl>
      </header>

      ${model.isCenter ? `
        <section class="fitness-paper-approval">
          <div>
            <b>${escapeHtml(model.dateLabel)}</b>
            <span>날씨 ${escapeHtml(model.weatherText)}</span>
            <em>${escapeHtml(model.weatherAddress || `${model.weatherSiteKey} 주소 입력 필요`)}</em>
          </div>
          <table>
            <thead><tr>${approvalCells}</tr></thead>
            <tbody><tr>${approvalBlanks}</tr></tbody>
          </table>
        </section>
      ` : ""}

      <section class="fitness-paper-summary">
        <div class="fitness-paper-tasks">
          <h3>금일 주요업무</h3>
          ${taskRows}
        </div>
        <div class="fitness-paper-tasks">
          <h3>명일 예정업무</h3>
          ${tomorrowRows}
        </div>
      </section>

      ${model.isCenter ? `
        <section class="fitness-paper-wide-table fitness-paper-center-ops-table">
          <h3>전체 직원 운영기록</h3>
          <table>
            <thead><tr><th>No.</th><th>구분</th><th>성명</th><th>출근</th><th>퇴근</th><th>근무시간</th><th>유료PT</th><th>무료PT</th><th>기타PT</th><th>신규</th><th>재등록</th><th>상담</th><th>아웃바운드</th><th>인바운드</th><th>특이사항</th></tr></thead>
            <tbody>${centerOpsRows}</tbody>
            <tfoot><tr><td colspan="6">합계</td><td>${numberValue(model.totals.ptRegular) || ""}</td><td>${numberValue(model.totals.ptFree) || ""}</td><td>${numberValue(model.totals.ptOther) || ""}</td><td>${numberValue(model.totals.customerNew) || ""}</td><td>${numberValue(model.totals.customerRenewal) || ""}</td><td>${numberValue(model.totals.consultation) || ""}</td><td>${numberValue(model.totals.outbound) || ""}</td><td>${numberValue(model.totals.inbound) || ""}</td><td></td></tr></tfoot>
          </table>
        </section>
      ` : ""}

      ${!model.isCenter ? `
        <section class="fitness-paper-summary">
          <div class="fitness-paper-kpi">
            ${model.kpis.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}
          </div>
        </section>
      ` : ""}

      ${!model.isCenter ? `<section class="fitness-paper-schedule">
        <h3>시간별 세부업무</h3>
        <table>
          <thead><tr><th>업무시간</th><th>세부업무내용</th><th>분류</th></tr></thead>
          <tbody>
            ${scheduleRows.map((entry) => `<tr><td>${escapeHtml(entry.time)}</td><td>${escapeHtml(entry.text || "")}</td><td>${escapeHtml(inferScheduleType(entry.text || ""))}</td></tr>`).join("")}
          </tbody>
        </table>
      </section>` : ""}

      <section class="fitness-paper-footer-grid">
        <div>
          ${getFitnessReportIssueRowsHtml(model)}
        </div>
        <div>
          <h3>AI 코칭 · ${model.aiCoaching ? "ChatGPT" : "기본 코칭"}</h3>
          ${getFitnessReportCoachingRows(model).map(([title, text]) => `<p><b>${escapeHtml(title)}</b><span>${escapeHtml(text)}</span></p>`).join("")}
        </div>
      </section>
    </article>
  `;
}

function getFitnessReportScheduleRows(schedule = []) {
  const baseTimes = ["06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00", "00:00"];
  const filled = new Map((schedule || []).filter((entry) => entry.time).map((entry) => [entry.time, entry.text || ""]));
  const rows = baseTimes.map((time) => ({ time: formatReportTime(time), text: filled.get(time) || "" }));
  const extraFilled = (schedule || []).filter((entry) => entry.text && !baseTimes.includes(entry.time));
  extraFilled.slice(0, 3).forEach((entry, index) => {
    const target = rows[rows.length - 3 + index];
    if (target && !target.text) target.text = `${formatReportTime(entry.time)} ${entry.text}`;
  });
  return rows;
}

function setFitnessReportCoachButtonState(stateName = "ready") {
  const button = document.getElementById("fitnessReportCoachButton");
  if (!button) return;
  const labels = {
    ready: "ChatGPT 코칭",
    cached: "AI 코칭 새로고침",
    loading: "AI 코칭 생성 중…",
    unavailable: "AI 코칭 연결 필요",
  };
  button.textContent = labels[stateName] || labels.ready;
  button.disabled = stateName === "loading";
  button.dataset.aiState = stateName;
}

function refreshOpenFitnessReport(model = buildFitnessReportModel()) {
  const preview = document.getElementById("fitnessReportPreview");
  if (!preview || !document.getElementById("fitnessReportSheet")?.classList.contains("is-open")) return;
  preview.innerHTML = renderFitnessReportTemplate(model);
  updateFitnessReportConfirmButton(model);
  fitFitnessReportPreview();
}

async function requestFitnessReportAiCoaching(model = buildFitnessReportModel(), { force = false, silent = false } = {}) {
  if (!model?.aiKey || !model?.aiContext) return null;
  activeFitnessReportAiKey = model.aiKey;
  if (model.aiCoaching && !force) {
    setFitnessReportCoachButtonState("cached");
    return model.aiCoaching;
  }
  if (!force && fitnessReportAiAttempted.has(model.aiKey)) return null;
  const accessToken = authState.session?.access_token;
  if (!accessToken) {
    setFitnessReportCoachButtonState("unavailable");
    if (!silent) showAppToast("로그인 후 실제 AI 코칭을 사용할 수 있습니다");
    return null;
  }

  fitnessReportAiAttempted.add(model.aiKey);
  const requestId = ++fitnessReportAiRequestId;
  setFitnessReportCoachButtonState("loading");
  try {
    const coachResponse = await fetch("/api/fitness-coach", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ context: model.aiContext }),
    });
    const result = await coachResponse.json().catch(() => ({}));
    if (!coachResponse.ok || !result.coaching) throw new Error(result.error || "AI 코칭을 생성하지 못했습니다.");
    setFitnessAiCoachingCache(model.aiKey, {
      coaching: result.coaching,
      model: result.model || "OpenAI",
      generatedAt: result.generatedAt || new Date().toISOString(),
    });
    if (requestId === fitnessReportAiRequestId && activeFitnessReportAiKey === model.aiKey) {
      refreshOpenFitnessReport(buildFitnessReportModel());
      setFitnessReportCoachButtonState("cached");
    }
    return result.coaching;
  } catch (error) {
    if (requestId === fitnessReportAiRequestId) setFitnessReportCoachButtonState("unavailable");
    if (!silent) showAppToast(error.message || "기본 코칭으로 보고서를 유지합니다");
    return null;
  }
}

function openFitnessReportSheet() {
  const backdrop = document.getElementById("fitnessReportBackdrop");
  const sheet = document.getElementById("fitnessReportSheet");
  const preview = document.getElementById("fitnessReportPreview");
  const subtitle = document.getElementById("fitnessReportSubtitle");
  if (!backdrop || !sheet || !preview) return;
  const model = buildFitnessReportModel();
  activeFitnessReportAiKey = model.aiKey;
  if (subtitle) subtitle.textContent = `${formatKoreanDate(getActiveDateKey())} 보고서`;
  preview.innerHTML = renderFitnessReportTemplate(model);
  updateFitnessReportConfirmButton(model);
  setFitnessReportCoachButtonState(model.aiCoaching ? "cached" : "ready");
  backdrop.hidden = false;
  sheet.hidden = false;
  requestAnimationFrame(() => {
    sheet.classList.add("is-open");
    fitFitnessReportPreview();
    requestFitnessReportAiCoaching(model, { silent: true });
  });
}

function updateFitnessReportConfirmButton(model = buildFitnessReportModel()) {
  const button = document.getElementById("fitnessReportConfirmButton");
  if (!button) return;
  button.hidden = !model.isCenter;
  if (!model.isCenter) return;
  const confirmed = Boolean(model.confirmation?.confirmedAt);
  button.textContent = confirmed ? "확정 취소" : "센터 보고 확정";
  button.disabled = !model.canConfirmCenterReport;
  button.title = model.canConfirmCenterReport ? "" : "센터장 또는 해당일 근무 직원만 확정할 수 있습니다";
}

function fitFitnessReportPreview() {
  const preview = document.getElementById("fitnessReportPreview");
  const page = preview?.querySelector(".fitness-report-page");
  if (!preview || !page) return;
  preview.style.removeProperty("--fitness-report-scale");
  preview.style.removeProperty("height");
  if (!window.matchMedia("(max-width: 760px)").matches) return;
  const pageWidth = 720;
  const scale = Math.min(1, Math.max(0.42, (preview.clientWidth - 2) / pageWidth));
  preview.style.setProperty("--fitness-report-scale", String(scale));
  preview.style.height = `${Math.ceil(page.offsetHeight * scale) + 4}px`;
}

function closeFitnessReportSheet() {
  const backdrop = document.getElementById("fitnessReportBackdrop");
  const sheet = document.getElementById("fitnessReportSheet");
  sheet?.classList.remove("is-open");
  activeFitnessReportAiKey = "";
  window.setTimeout(() => {
    if (backdrop) backdrop.hidden = true;
    if (sheet) sheet.hidden = true;
  }, 160);
}

function printFitnessReport() {
  document.body.classList.add("is-printing-fitness-report");
  window.print();
  window.setTimeout(() => document.body.classList.remove("is-printing-fitness-report"), 500);
}

function getFitnessReportFileBase() {
  return `beyond-fitness-report-${getActiveDateKey()}`;
}

function getFitnessReportExportHeight(model = buildFitnessReportModel()) {
  if (model.isCenter) return 1754;
  const taskOverflow = Math.max(0, Math.max(model.topTasks?.length || 0, model.tomorrowTasks?.length || 0) - 3) * 50;
  const issueOverflow = Math.max(0, (model.issueRows?.length || 0) - 3) * 50;
  return 1754 + taskOverflow + issueOverflow;
}

function getFitnessReportExportCss(reportHeight = 1754) {
  return `
    * { box-sizing: border-box; }
    body { margin: 0; }
    :root {
      --ink: #111411;
      --fitness-green: #0f4637;
      --nordic-sheet: #fffefa;
      --hairline: rgba(18, 59, 45, 0.13);
    }
    .fitness-report-page {
      width: 1240px !important;
      height: ${reportHeight}px !important;
      min-height: ${reportHeight}px !important;
      aspect-ratio: auto !important;
      margin: 0 !important;
      border: 0 !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      background: #fffefa !important;
      color: #111411 !important;
      overflow: hidden !important;
      padding: 48px !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .fitness-report-page.is-center-report {
      display: flex !important;
      flex-direction: column !important;
      gap: 12px !important;
      padding: 44px !important;
    }
    .fitness-paper-top {
      display: grid;
      grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
      gap: 16px;
      border-bottom: 4px solid rgba(18, 59, 45, 0.92);
      padding-bottom: 16px;
    }
    .fitness-paper-top > div {
      display: grid;
      align-content: center;
      min-height: 118px;
      border-radius: 18px;
      background: linear-gradient(135deg, #0a3529, #176047);
      color: #fff7d5;
      -webkit-text-fill-color: #fff7d5;
      padding: 22px 26px;
    }
    .fitness-paper-top > div * {
      color: #fff7d5 !important;
      -webkit-text-fill-color: #fff7d5 !important;
      opacity: 1 !important;
      mix-blend-mode: normal !important;
    }
    .fitness-paper-top strong {
      color: #fff7d5;
      -webkit-text-fill-color: #fff7d5;
      font-size: 42px;
      line-height: 1.06;
      font-weight: 950;
      letter-spacing: 0;
    }
    .fitness-paper-top span {
      margin-top: 10px;
      color: #ffffff;
      -webkit-text-fill-color: #ffffff;
      font-size: 22px;
      line-height: 1.25;
      font-weight: 900;
    }
    .fitness-paper-top dl {
      display: grid;
      grid-template-columns: 110px minmax(0, 1fr);
      margin: 0;
      border: 2px solid rgba(18, 59, 45, 0.28);
      border-radius: 14px;
      overflow: hidden;
    }
    .fitness-paper-top dt,
    .fitness-paper-top dd {
      min-height: 48px;
      border-bottom: 2px solid rgba(18, 59, 45, 0.18);
      margin: 0;
      padding: 10px 12px;
      font-size: 20px;
      line-height: 1.15;
    }
    .fitness-paper-top dt {
      display: grid;
      place-items: center;
      background: rgba(237, 244, 224, 0.95);
      border-right: 2px solid rgba(18, 59, 45, 0.18);
      font-weight: 950;
    }
    .fitness-paper-top dd { font-weight: 900; }
    .fitness-paper-top dt:nth-last-child(2),
    .fitness-paper-top dd:last-child { border-bottom: 0; }
    .fitness-paper-summary {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
      margin-top: 16px;
    }
    .fitness-report-page.is-center-report .fitness-paper-summary,
    .fitness-report-page.is-center-report .fitness-paper-wide-table,
    .fitness-report-page.is-center-report .fitness-paper-footer-grid,
    .fitness-report-page.is-center-report .fitness-paper-approval {
      margin-top: 0 !important;
    }
    .fitness-paper-tasks,
    .fitness-paper-kpi,
    .fitness-paper-approval,
    .fitness-paper-center-ops-table,
    .fitness-paper-attendance-table,
    .fitness-paper-contract-table,
    .fitness-paper-schedule,
    .fitness-paper-footer-grid > div {
      border: 2px solid rgba(18, 59, 45, 0.22);
      border-radius: 14px;
      overflow: hidden;
      background: rgba(255, 254, 250, 0.95);
    }
    .fitness-paper-tasks h3,
    .fitness-paper-center-ops-table h3,
    .fitness-paper-attendance-table h3,
    .fitness-paper-contract-table h3,
    .fitness-paper-schedule h3,
    .fitness-paper-footer-grid h3 {
      margin: 0;
      background: rgba(237, 244, 224, 0.86);
      color: #111411;
      padding: 12px 14px;
      font-size: 22px;
      font-weight: 950;
    }
    .fitness-paper-footer-grid small {
      display: block;
      min-height: 34px;
      padding: 8px 12px 6px;
      border-top: 2px solid rgba(18, 59, 45, 0.1);
      color: rgba(17, 20, 17, 0.62);
      font-size: 16px;
      font-weight: 820;
      line-height: 1.25;
    }
    .fitness-paper-tasks p,
    .fitness-paper-footer-grid p {
      display: grid;
      grid-template-columns: 50px minmax(0, 1fr);
      min-height: 48px;
      margin: 0;
      border-top: 2px solid rgba(18, 59, 45, 0.12);
    }
    .fitness-paper-footer-grid > div:last-child p {
      grid-template-columns: 118px minmax(0, 1fr);
      min-height: 36px;
    }
    .fitness-paper-footer-grid > div:last-child p span {
      padding-top: 7px;
      padding-bottom: 7px;
      font-size: 18px;
    }
    .fitness-paper-tasks p b,
    .fitness-paper-footer-grid p b {
      display: grid;
      place-items: center;
      border-right: 2px solid rgba(18, 59, 45, 0.12);
      font-size: 19px;
      font-weight: 950;
    }
    .fitness-paper-tasks p span,
    .fitness-paper-footer-grid p span {
      padding: 10px 12px;
      font-size: 20px;
      line-height: 1.25;
      font-weight: 830;
    }
    .fitness-paper-approval {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(320px, 0.7fr);
      gap: 16px;
      align-items: stretch;
      margin-top: 16px;
      border: 0;
      background: transparent;
    }
    .fitness-paper-approval > div {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 146px;
      align-items: center;
      border: 2px solid rgba(18, 59, 45, 0.2);
      border-radius: 14px;
      overflow: hidden;
    }
    .fitness-paper-approval b,
    .fitness-paper-approval span {
      min-height: 62px;
      padding: 16px;
      font-size: 20px;
      font-weight: 950;
    }
    .fitness-paper-approval span {
      display: grid;
      place-items: center;
      border-left: 2px solid rgba(18, 59, 45, 0.16);
      background: rgba(250, 250, 245, 0.95);
    }
    .fitness-paper-approval table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    .fitness-paper-approval th,
    .fitness-paper-approval td {
      border: 2px solid rgba(18, 59, 45, 0.2);
      padding: 10px;
      text-align: center;
      font-size: 18px;
      font-weight: 950;
    }
    .fitness-paper-summary .fitness-paper-kpi {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .fitness-paper-summary .fitness-paper-kpi div {
      min-height: 82px;
      border-right: 2px solid rgba(18, 59, 45, 0.12);
      border-bottom: 2px solid rgba(18, 59, 45, 0.12);
      padding: 14px;
    }
    .fitness-paper-summary .fitness-paper-kpi span {
      display: block;
      color: rgba(17, 20, 17, 0.68);
      font-size: 18px;
      font-weight: 900;
    }
    .fitness-paper-summary .fitness-paper-kpi strong {
      display: block;
      margin-top: 4px;
      color: #111411;
      font-size: 28px;
      font-weight: 950;
    }
    .fitness-paper-attendance-table,
    .fitness-paper-center-ops-table,
    .fitness-paper-contract-table,
    .fitness-paper-schedule,
    .fitness-paper-footer-grid { margin-top: 16px; }
    .fitness-paper-center-ops-table table,
    .fitness-paper-attendance-table table,
    .fitness-paper-contract-table table,
    .fitness-paper-schedule table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    .fitness-paper-center-ops-table th,
    .fitness-paper-center-ops-table td,
    .fitness-paper-attendance-table th,
    .fitness-paper-attendance-table td,
    .fitness-paper-contract-table th,
    .fitness-paper-contract-table td,
    .fitness-paper-schedule th,
    .fitness-paper-schedule td {
      border-top: 2px solid rgba(18, 59, 45, 0.13);
      border-right: 2px solid rgba(18, 59, 45, 0.13);
      padding: 7px 8px;
      font-size: 17px;
      line-height: 1.12;
    }
    .fitness-paper-center-ops-table th,
    .fitness-paper-attendance-table th,
    .fitness-paper-contract-table th,
    .fitness-paper-schedule th {
      background: rgba(250, 250, 245, 0.95);
      font-weight: 950;
    }
    .fitness-paper-center-ops-table tfoot td,
    .fitness-paper-attendance-table tfoot td,
    .fitness-paper-contract-table tfoot td {
      background: rgba(237, 244, 224, 0.62);
      font-weight: 950;
    }
    .fitness-paper-center-ops-table th,
    .fitness-paper-center-ops-table td {
      padding: 5px 5px;
      font-size: 14px;
      line-height: 1.08;
      text-align: center;
      word-break: keep-all;
    }
    .fitness-paper-center-ops-table th:nth-child(1),
    .fitness-paper-center-ops-table td:nth-child(1) { width: 44px; }
    .fitness-paper-center-ops-table th:nth-child(2),
    .fitness-paper-center-ops-table td:nth-child(2) { width: 76px; }
    .fitness-paper-center-ops-table th:nth-child(3),
    .fitness-paper-center-ops-table td:nth-child(3) { width: 92px; }
    .fitness-paper-center-ops-table th:nth-child(4),
    .fitness-paper-center-ops-table td:nth-child(4),
    .fitness-paper-center-ops-table th:nth-child(5),
    .fitness-paper-center-ops-table td:nth-child(5) { width: 72px; }
    .fitness-paper-center-ops-table th:nth-child(6),
    .fitness-paper-center-ops-table td:nth-child(6) { width: 86px; }
    .fitness-paper-center-ops-table th:nth-child(n + 7):nth-child(-n + 14),
    .fitness-paper-center-ops-table td:nth-child(n + 7):nth-child(-n + 14) { width: 58px; }
    .fitness-paper-center-ops-table th:nth-child(15),
    .fitness-paper-center-ops-table td:nth-child(15) {
      width: auto;
      min-width: 154px;
      text-align: left;
      white-space: normal;
    }
    .fitness-report-page.is-center-report .fitness-paper-center-ops-table {
      flex: 0 0 auto;
    }
    .fitness-report-page.is-center-report .fitness-paper-center-ops-table th,
    .fitness-report-page.is-center-report .fitness-paper-center-ops-table td {
      height: 30px;
      padding: 6px 5px;
      font-size: 14px;
    }
    .fitness-paper-schedule th:nth-child(1),
    .fitness-paper-schedule td:nth-child(1) {
      width: 166px;
      text-align: center;
      font-weight: 900;
    }
    .fitness-paper-schedule th:nth-child(3),
    .fitness-paper-schedule td:nth-child(3) {
      width: 118px;
      text-align: center;
    }
    .fitness-paper-schedule td {
      height: 31px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .fitness-paper-footer-grid {
      display: grid;
      grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
      gap: 16px;
    }
    .fitness-report-page.is-center-report .fitness-paper-footer-grid {
      flex: 1 1 auto;
      min-height: 150px;
    }
    .fitness-report-page.is-center-report .fitness-paper-footer-grid > div {
      display: grid;
      grid-template-rows: auto repeat(4, minmax(34px, 1fr));
    }
  `;
}

async function renderFitnessReportCanvas() {
  const width = 1240;
  const model = buildFitnessReportModel();
  const height = getFitnessReportExportHeight(model);
  const html = `
    <div xmlns="http://www.w3.org/1999/xhtml">
      <style>${getFitnessReportExportCss(height)}</style>
      ${renderFitnessReportTemplate(model)}
    </div>
  `;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <foreignObject width="${width}" height="${height}">${html}</foreignObject>
    </svg>
  `;
  if (document.fonts?.ready) await document.fonts.ready;
  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fffefa";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(canvas, type = "image/png", quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("보고서 이미지 생성에 실패했습니다."));
    }, type, quality);
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

function concatUint8Arrays(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  parts.forEach((part) => {
    merged.set(part, offset);
    offset += part.length;
  });
  return merged;
}

function dataUrlToUint8Array(dataUrl) {
  const base64 = String(dataUrl).split(",")[1] || "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function createPdfBlobFromCanvas(canvas) {
  const encoder = new TextEncoder();
  const jpegBytes = dataUrlToUint8Array(canvas.toDataURL("image/jpeg", 0.92));
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const content = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im0 Do\nQ`;
  const objects = [
    encoder.encode("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"),
    encoder.encode("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"),
    encoder.encode(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>\nendobj\n`),
    encoder.encode(`4 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`),
    concatUint8Arrays([
      encoder.encode(`5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`),
      jpegBytes,
      encoder.encode("\nendstream\nendobj\n"),
    ]),
  ];
  const chunks = [encoder.encode("%PDF-1.4\n%\n")];
  const offsets = [0];
  let length = chunks[0].length;
  objects.forEach((object) => {
    offsets.push(length);
    chunks.push(object);
    length += object.length;
  });
  const xrefStart = length;
  const xref = [
    "xref",
    `0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `),
    "trailer",
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    "startxref",
    String(xrefStart),
    "%%EOF",
  ].join("\n");
  chunks.push(encoder.encode(xref));
  return new Blob(chunks, { type: "application/pdf" });
}

async function saveFitnessReportImage() {
  const canvas = await renderFitnessReportCanvas();
  const blob = await canvasToBlob(canvas, "image/png");
  downloadBlob(blob, `${getFitnessReportFileBase()}.png`);
}

async function shareFitnessReport() {
  const canvas = await renderFitnessReportCanvas();
  const pngBlob = await canvasToBlob(canvas, "image/png");
  const pdfBlob = createPdfBlobFromCanvas(canvas);
  const base = getFitnessReportFileBase();
  const pngFile = new File([pngBlob], `${base}.png`, { type: "image/png" });
  const pdfFile = new File([pdfBlob], `${base}.pdf`, { type: "application/pdf" });
  if (navigator.canShare?.({ files: [pngFile, pdfFile] }) && navigator.share) {
    await navigator.share({
      title: "Beyond Fitness Report",
      text: "비욘드 피트니스 업무보고서 PNG/PDF 파일입니다.",
      files: [pngFile, pdfFile],
    });
    return;
  }
  if (navigator.canShare?.({ files: [pngFile] }) && navigator.share) {
    await navigator.share({
      title: "Beyond Fitness Report",
      text: "비욘드 피트니스 업무보고서 이미지입니다.",
      files: [pngFile],
    });
    return;
  }
  const text = buildFitnessReportLines().join("\n");
  if (navigator.share) {
    await navigator.share({ title: "Beyond Fitness Report", text });
    return;
  }
  await navigator.clipboard?.writeText(text);
  alert("보고서 내용을 클립보드에 복사했습니다.");
}

function switchView(view) {
  if (!state) {
    window.setTimeout(() => switchView(view), 0);
    return;
  }
  const requestedView = view;
  if (view === "management") view = "control";
  if (isExplicitlySignedOut() && view !== "auth") {
    view = "auth";
    renderAuthStatus("로그아웃되었습니다. 다시 사용하려면 로그인 또는 직원등록을 진행해주세요.");
  }
  if (!["auth", "settings"].includes(view) && authState.user && !isProfileApproved()) {
    view = "auth";
    renderAuthStatus(`현재 상태: ${getApprovalStatusLabel()}. 승인 후 업무일지를 사용할 수 있습니다.`);
  }
  if (view === "attendance" && !canOpenLaborSection()) {
    view = getUserWorklogView();
  }
  if (view === "staff" && !canAccessStaffSection()) view = getUserWorklogView();
  if (view === "control" && !canAccessControlTower()) view = getUserWorklogView();
  if (view === "executive" && !(isRepresentativeProfile() || hasProfilePermission("executiveRoom"))) view = getUserWorklogView();
  if (view === "premium" && !canAccessPremiumOperations()) view = getUserWorklogView();
  if (view === "worklog") view = getUserWorklogView();
  view = view === "today" ? "bangju-log" : view;
  if (view !== "fitness-log" && fitnessMobileFocusMode !== "split") resetFitnessMobileFocusToSplit({ blur: true });
  ensureSelectedEmployeeForWorklogView(view);
  activeView = view;
  document.body.dataset.activeView = view;
  renderResponsiveMode();
  closeMainMenuPopover();
  document.querySelectorAll(".worklog-tabs button").forEach((button) => {
    const isWorklogActive = button.dataset.view === "worklog" && ["fitness-log", "bangju-log", "beyond-log", "worklog-overview"].includes(view);
    button.classList.toggle("is-active", button.dataset.view === view || isWorklogActive);
  });
  const panelView = worklogViewAliases[view] || view;
  document.querySelectorAll(".worklog-view").forEach((panel) => panel.classList.toggle("is-active", panel.id === `view-${panelView}`));
  dockGlobalHeaderActions(panelView);
  const menuSelect = document.getElementById("mainMenuWheelSelect");
  if (menuSelect) {
    const menuValue = ["fitness-log", "bangju-log", "beyond-log", "worklog-overview"].includes(view) || requestedView === "worklog" ? "worklog" : view;
    if (menuSelect.value !== menuValue) menuSelect.value = menuValue;
  }
  renderEmployeeTitle();
  renderDateNav();
  renderGlobalEmployeeIdentity();
  renderOsDashboard();
  renderExecutiveManagement();
  renderControlTower();
  renderWorklogOverview();
  renderAiCoach();
  renderPremiumOperatingSystem();
  renderFitnessDashboard();
  renderEntries();
  renderStaffMaster();
  if (view === "staff" && canAccessStaffSection() && !authState.approvalRowsLoaded) refreshStaffApprovalRows();
  renderAttendance();
  renderOrganization();
  updateGlobalAttendanceVisibility(view);
  dockGlobalHeaderActions(panelView);
  applyCurrentWorklogPermissionState(view);
  if (view === "fitness-log") window.setTimeout(() => showFitnessPageToast(), 80);
  if (view === "fitness-log" && authState.session) refreshCoworkerWorklogsForActiveDate();
  if (view === "worklog-overview") {
    if (canAccessAllWorklogs()) refreshVisibleStaffWorklogsForActiveDate();
    else refreshCoworkerWorklogsForActiveDate();
  }
}

function getActiveViewPanel(panelView = worklogViewAliases[activeView] || activeView) {
  return document.getElementById(`view-${panelView}`) || document.querySelector(".worklog-view.is-active");
}

function dockGlobalHeaderActions(panelView = worklogViewAliases[activeView] || activeView) {
  const panel = getActiveViewPanel(panelView);
  const menuButton = document.getElementById("settingsGearButton");
  const menuPopover = document.getElementById("mainMenuPopover");
  if (!panel || !menuButton || !menuPopover) return;

  if (panelView === "executive" || panelView === "control") {
    const actions = panelView === "executive"
      ? document.querySelector(".executive-hero-actions")
      : document.querySelector(".control-tower-hero-actions");
    if (actions && menuPopover.parentElement !== actions) actions.appendChild(menuPopover);
    return;
  }

  if (panelView === "worklog-overview") {
    const overviewDateNav = document.getElementById("overviewDateSwipeArea");
    if (overviewDateNav) {
      overviewDateNav.appendChild(menuButton);
      overviewDateNav.appendChild(menuPopover);
    }
    return;
  }

  const target = panelView === "attendance" ? panel.querySelector(".work-history-hero") || panel : panel;
  let dock = target.querySelector(":scope > .section-menu-dock") || panel.querySelector(":scope > .section-menu-dock");
  if (!dock) {
    dock = document.createElement("div");
    dock.className = "section-menu-dock";
    dock.setAttribute("aria-label", "현재 섹션 메뉴");
  }
  if (dock.parentElement !== target) {
    target.prepend(dock);
  }

  const modeButton = document.getElementById("globalViewModeButton");
  const attendanceButton = document.getElementById("globalAttendanceButton");
  const attendancePopover = document.getElementById("attendancePopover");
  const approvalButton = document.getElementById("approvalAlertButton");

  if (approvalButton && !approvalButton.hidden) dock.appendChild(approvalButton);
  if (modeButton && !modeButton.hidden) dock.appendChild(modeButton);
  if (attendanceButton && !attendanceButton.hidden) dock.appendChild(attendanceButton);
  dock.appendChild(menuButton);
  dock.appendChild(menuPopover);
  if (attendancePopover) dock.appendChild(attendancePopover);
}

function dockMainMenuPopoverToTrigger(trigger = null) {
  const popover = document.getElementById("mainMenuPopover");
  if (!popover || !trigger) return;

  const host = trigger.closest(
    ".section-menu-dock, .executive-hero-actions, .control-tower-hero-actions, .overview-date-nav"
  );
  if (host && popover.parentElement !== host) host.appendChild(popover);
}

function toggleMainMenuPopover(trigger = null) {
  const popover = document.getElementById("mainMenuPopover");
  const button = document.getElementById("settingsGearButton");
  const executiveButton = document.getElementById("executiveMenuButton");
  const controlButton = document.getElementById("controlTowerMenuButton");
  if (!popover) return;
  dockMainMenuPopoverToTrigger(trigger);
  const willOpen = popover.hidden;
  if (willOpen) renderMainMenuAuthButton();
  popover.hidden = !willOpen;
  button?.setAttribute("aria-expanded", String(willOpen));
  executiveButton?.setAttribute("aria-expanded", String(willOpen));
  controlButton?.setAttribute("aria-expanded", String(willOpen));
  if (willOpen) closeAttendancePopover();
  if (willOpen) popover.querySelector("button:not([hidden])")?.focus();
}

function closeMainMenuPopover() {
  const popover = document.getElementById("mainMenuPopover");
  const button = document.getElementById("settingsGearButton");
  const executiveButton = document.getElementById("executiveMenuButton");
  const controlButton = document.getElementById("controlTowerMenuButton");
  if (!popover || popover.hidden) return;
  popover.hidden = true;
  button?.setAttribute("aria-expanded", "false");
  executiveButton?.setAttribute("aria-expanded", "false");
  controlButton?.setAttribute("aria-expanded", "false");
}

function renderAll() {
  renderGlobalEmployeeIdentity();
  renderMainMenuAuthButton();
  renderDateNav();
  renderOsDashboard();
  renderExecutiveManagement();
  renderControlTower();
  renderWorklogOverview();
  renderAiCoach();
  renderPremiumOperatingSystem();
  renderFitnessDashboard();
  renderStaffMaster();
  renderEmployeeSelect();
  renderProfileForm();
  renderEntries();
  renderAttendance();
  renderOrganization();
  renderReport();
  applyCurrentWorklogPermissionState();
  dockGlobalHeaderActions();
}

function escapeAttr(value = "") {
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

function escapeHtml(value = "") {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

document.querySelectorAll(".worklog-tabs button").forEach((button) => {
  button.onclick = () => switchView(button.dataset.view);
});
document.getElementById("mainMenuWheelSelect")?.addEventListener("change", (event) => {
  switchView(event.target.value);
});
document.addEventListener("input", (event) => {
  const field = event.target;
  toggleWeeklyWorkHourControl(field);
  if (!(field instanceof HTMLInputElement) || !isPhoneField(field)) return;
  const nextValue = formatPhoneNumber(field.value);
  if (field.value === nextValue) return;
  field.value = nextValue;
});
document.getElementById("globalAttendanceButton")?.addEventListener("click", (event) => {
  event.stopPropagation();
  if (!canEditCurrentWorklog()) {
    closeAttendancePopover();
    return;
  }
  const popover = document.getElementById("attendancePopover");
  if (popover && !popover.hidden) closeAttendancePopover();
  else openAttendancePopover();
});
document.getElementById("attendancePopover")?.addEventListener("click", (event) => event.stopPropagation());
document.querySelectorAll("[data-attendance-action]").forEach((button) => {
  button.addEventListener("click", () => {
    if (!canEditCurrentWorklog()) return;
    attendancePopoverAction = button.dataset.attendanceAction || "출근";
    renderAttendancePopover();
  });
});
document.getElementById("attendanceApplyButton")?.addEventListener("click", applyAttendancePopoverSelection);
document.querySelectorAll("[data-layout-mode-choice]").forEach((button) => {
  button.onclick = () => {
    const nextLayoutMode = button.dataset.layoutModeChoice || "wide";
    localStorage.setItem(layoutModeStorageKey, nextLayoutMode);
    localStorage.setItem(globalViewModeStorageKey, nextLayoutMode === "phone" ? "ceo" : "classic");
    renderResponsiveMode();
  };
});
document.getElementById("globalViewModeButton")?.addEventListener("click", toggleGlobalViewMode);
document.getElementById("fitnessLogPrevPageButton")?.addEventListener("click", moveFitnessLogPrevPage);
document.getElementById("fitnessLogNextPageButton")?.addEventListener("click", moveFitnessLogNextPage);
document.getElementById("overviewPrevDateButton")?.addEventListener("click", () => moveSelectedDate(-1));
document.getElementById("overviewNextDateButton")?.addEventListener("click", () => moveSelectedDate(1));
document.getElementById("overviewDateButton")?.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleOverviewCalendar();
});
document.getElementById("worklogOverviewTodayButton")?.addEventListener("click", () => setSelectedDateKey(todayKey));
document.querySelectorAll("[data-overview-scope]").forEach((button) => {
  button.addEventListener("click", () => {
    state.worklogOverviewScope = button.dataset.overviewScope || "all";
    saveState({ fastSave: true });
    renderWorklogOverview();
  });
});
document.querySelector('[data-worklog-panel="weekly"]')?.addEventListener("click", () => setTodayPageMode("common"));
document.querySelector('[data-worklog-panel="memo"]')?.addEventListener("click", () => setTodayPageMode("coworker"));
document.getElementById("worklogPulse")?.addEventListener("click", () => switchView("ai"));
{
  const pager = document.getElementById("view-fitness-log");
  let startX = 0;
  let startY = 0;
  let blocked = false;
  pager?.addEventListener("pointerdown", (event) => {
    startX = event.clientX;
    startY = event.clientY;
    blocked = Boolean(event.target.closest("button, input, textarea, select, .fitness-schedule-editor, .fitness-ops-section.is-open"));
  });
  pager?.addEventListener("pointerup", (event) => {
    if (blocked) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (Math.abs(dx) < 52 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    moveFitnessLogPage(dx < 0 ? 1 : -1);
  });
}
{
  const pager = document.getElementById("worklogMain");
  let startX = 0;
  let startY = 0;
  let blocked = false;
  pager?.addEventListener("pointerdown", (event) => {
    startX = event.clientX;
    startY = event.clientY;
    blocked = Boolean(event.target.closest("button, input, textarea, select"));
  });
  pager?.addEventListener("pointerup", (event) => {
    if (blocked || isEditingDailyField()) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
    moveTodayPage(dx < 0 ? 1 : -1);
  });
}
setupVerticalDateSwipe(document.getElementById("view-today"));
setupVerticalDateSwipe(document.getElementById("view-fitness-log"));

document.getElementById("settingsGearButton").onclick = (event) => {
  event.stopPropagation();
  toggleMainMenuPopover(event.currentTarget);
};
document.getElementById("approvalAlertButton")?.addEventListener("click", openApprovalManagement);
document.querySelectorAll("[data-menu-view]").forEach((button) => {
  button.onclick = async () => {
    const view = button.dataset.menuView;
    if (view === "auth" && isKnownLoggedInProfile()) {
      closeMainMenuPopover();
      await signOutWithSupabase();
      return;
    }
    if (view === "auth" || view === "settings") renderProfileForm();
    if (view === "settings") switchSettingsTab("employee");
    switchView(view);
  };
});
document.querySelector("[data-menu-action='approval']")?.addEventListener("click", () => {
  closeMainMenuPopover();
  openApprovalManagement();
});
document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-ai-mission-apply]");
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  applyMissionProposal(button.dataset.aiMissionApply || "");
});
document.querySelectorAll("[data-section-shortcut]").forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.dataset.sectionShortcut;
    if (action === "manual") {
      switchView("settings");
      switchSettingsTab("manual");
      return;
    }
    const staffTabActions = new Set(staffMasterTabs.map(([key]) => key));
    if (button.closest("#view-staff") && staffTabActions.has(action)) {
      state.staffMasterTab = normalizeStaffMasterTab(action);
      saveState({ fastSave: true });
      switchView("staff");
      renderStaffMaster();
      document.getElementById("staffMasterGrid")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (action === "approval") {
      openApprovalManagement();
      return;
    }
    if (action === "permission" || action === "staff-list") {
      switchView("staff");
      const panel = document.querySelector(action === "permission" ? ".staff-permission-matrix" : ".staff-master-table-wrap");
      panel?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (action === "report" || action === "daily-report" || action === "communication" || action === "backup" || action === "innovation") {
      switchView("report");
      if (action === "daily-report") {
        setDailyReportArchiveDefaults();
        saveState({ fastSave: true });
        renderReportArchive();
      }
      openReportDetail(action === "report" ? "daily-report" : action);
      return;
    }
    if (action === "labor") {
      switchView("attendance");
      return;
    }
    if (action?.startsWith("premium-")) {
      switchView("premium");
      if (action === "premium-labor") window.setTimeout(() => switchView("attendance"), 120);
      else if (action === "premium-revenue") window.setTimeout(() => switchView("worklog"), 120);
      else document.getElementById(action)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (action === "coaching" || action === "growth") {
      switchView("ai");
    }
  });
});
document.getElementById("staffMasterGrid")?.addEventListener("change", (event) => {
  const presetSelect = event.target.closest("[data-staff-permission-preset]");
  if (presetSelect) {
    setEmployeePermissionPreset(presetSelect.dataset.staffPermissionPreset, presetSelect.value);
    return;
  }
  const toggle = event.target.closest("[data-staff-permission-toggle]");
  if (toggle) {
    toggleEmployeePermission(toggle.dataset.staffPermissionToggle, toggle.dataset.permissionKey, toggle.checked);
  }
});
document.getElementById("staffMasterGrid")?.addEventListener("click", (event) => {
  const siteButton = event.target.closest("[data-staff-site-filter]");
  if (siteButton) {
    state.staffMasterSite = siteButton.dataset.staffSiteFilter || "all";
    saveState({ fastSave: true });
    renderStaffMaster();
    return;
  }
  const tabButton = event.target.closest("[data-staff-tab]");
  if (tabButton) {
    state.staffMasterTab = normalizeStaffMasterTab(tabButton.dataset.staffTab);
    saveState({ fastSave: true });
    renderStaffMaster();
    return;
  }
  const approvalFocusButton = event.target.closest("[data-staff-open-approval]");
  if (approvalFocusButton) {
    openApprovalManagement();
    return;
  }
  const permissionButton = event.target.closest("[data-staff-permission-open]");
  if (permissionButton) {
    openStaffPermissionModal(permissionButton.dataset.staffPermissionOpen);
    return;
  }
  const detailButton = event.target.closest("[data-staff-detail-id]");
  if (detailButton) {
    openStaffDetail(detailButton.dataset.staffDetailId);
    return;
  }
  const resetButton = event.target.closest("[data-staff-permission-reset]");
  if (!resetButton) return;
  resetEmployeePermission(resetButton.dataset.staffPermissionReset);
});
document.getElementById("staffMasterGrid")?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const row = event.target.closest("[data-staff-detail-id]");
  if (!row) return;
  event.preventDefault();
  openStaffDetail(row.dataset.staffDetailId);
});
document.addEventListener("click", (event) => {
  const laborButton = event.target.closest("[data-staff-open-labor]");
  if (laborButton) {
    event.preventDefault();
    const employeeId = laborButton.dataset.staffOpenLabor || "";
    if (!canViewLaborEmployee(employeeId)) {
      showAppToast("열람 권한이 없는 직원의 노무기록입니다.");
      return;
    }
    closeStaffDetail();
    state.selectedEmployeeId = employeeId;
    state.laborWorkspaceTab = "overview";
    saveState({ fastSave: true });
    switchView("attendance");
    return;
  }
  const worklogButton = event.target.closest("[data-staff-open-worklog]");
  if (worklogButton) {
    event.preventDefault();
    const employeeId = worklogButton.dataset.staffOpenWorklog || "";
    closeStaffDetail();
    state.selectedEmployeeId = employeeId;
    saveState({ fastSave: true });
    switchView(canAccessWorklogOverview() ? "worklog-overview" : getUserWorklogView());
    return;
  }
  const saveButton = event.target.closest("[data-staff-profile-save]");
  if (saveButton) {
    event.preventDefault();
    event.stopPropagation();
    saveStaffProfileEdits(saveButton.dataset.staffProfileSave);
    return;
  }
  const closeTarget = event.target.closest("[data-staff-detail-close]");
  if (!closeTarget) return;
  if (closeTarget.classList.contains("staff-detail-backdrop") && event.target !== closeTarget) return;
  closeStaffDetail();
});
document.addEventListener("change", (event) => {
  toggleWeeklyWorkHourControl(event.target);
  const presetSelect = event.target.closest("[data-staff-permission-modal-preset]");
  if (presetSelect && staffPermissionDraft) {
    const preset = normalizePermissionPresetKey(presetSelect.value);
    staffPermissionDraft.preset = preset;
    staffPermissionDraft.permissions = { ...buildPermissionSet(preset, {}).permissions };
    refreshStaffPermissionModal();
    return;
  }
  const toggle = event.target.closest("[data-staff-permission-modal-toggle]");
  if (toggle && staffPermissionDraft) {
    staffPermissionDraft.permissions ||= {};
    staffPermissionDraft.permissions[toggle.dataset.staffPermissionModalToggle] = Boolean(toggle.checked);
    refreshStaffPermissionModal();
  }
});
document.addEventListener("click", (event) => {
  const saveButton = event.target.closest("[data-staff-permission-save]");
  if (saveButton) {
    event.preventDefault();
    event.stopPropagation();
    saveStaffPermissionDraft();
    return;
  }
  const resetButton = event.target.closest("[data-staff-permission-modal-reset]");
  if (resetButton && staffPermissionDraft) {
    event.preventDefault();
    event.stopPropagation();
    const row = getEmployeeMasterRows().find((item) => item.id === staffPermissionDraft.employeeId);
    const preset = getRecommendedPermissionPresetForEmployee(row || {});
    staffPermissionDraft.preset = preset;
    staffPermissionDraft.permissions = { ...buildPermissionSet(preset, {}).permissions };
    refreshStaffPermissionModal();
    return;
  }
  const closeTarget = event.target.closest("[data-staff-permission-modal-close]");
  if (!closeTarget) return;
  if (closeTarget.classList.contains("staff-permission-modal-backdrop") && event.target !== closeTarget) return;
  closeStaffPermissionModal();
});
document.getElementById("mainMenuPopover")?.addEventListener("click", (event) => event.stopPropagation());
document.addEventListener("click", () => {
  closeMainMenuPopover();
  closeAttendancePopover();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMainMenuPopover();
  if (event.key === "Escape") closeStaffDetail();
  if (event.key === "Escape") closeStaffPermissionModal();
});
document.getElementById("closeAuthButton").onclick = () => switchView("worklog");
document.querySelectorAll("[data-auth-tab]").forEach((button) => {
  button.onclick = () => switchAuthTab(button.dataset.authTab);
});
document.querySelectorAll("[data-settings-tab]").forEach((button) => {
  button.onclick = () => {
    switchSettingsTab(button.dataset.settingsTab);
    if (button.dataset.settingsTab === "approval") renderApprovalAccess();
  };
});
document.getElementById("closeSettingsButton")?.addEventListener("click", () => switchView("worklog"));
document.getElementById("saveProfileButton").onclick = saveProfileFromForm;
document.getElementById("saveSettingsProfileButton")?.addEventListener("click", saveSettingsProfileFromForm);
document.getElementById("refreshApprovalRequestsButton")?.addEventListener("click", () => {
  authState.approvalRepairTried = false;
  loadApprovalRequests({ repair: true, manual: true });
});
document.getElementById("refreshPasswordResetRequestsButton")?.addEventListener("click", loadPasswordResetRequests);
document.getElementById("staffOpenApprovalButton")?.addEventListener("click", () => {
  openApprovalManagement();
});
document.getElementById("approvalRequestList")?.addEventListener("click", (event) => {
  const selectButton = event.target.closest("[data-approval-select]");
  if (selectButton) {
    authState.selectedApprovalId = selectButton.dataset.approvalSelect;
    renderApprovalQueue();
    return;
  }
  const button = event.target.closest("[data-approval-action]");
  if (!button) return;
  updateApprovalRequest(button.dataset.approvalId, button.dataset.approvalAction);
});
document.getElementById("approvalRequestList")?.addEventListener("change", (event) => {
  const select = event.target.closest("[data-approval-placement]");
  if (!select) return;
  const card = select.closest("[data-approval-card]");
  if (!card) return;
  if (select.dataset.approvalPlacement === "org") {
    updateApprovalPlacementOptions(card, { resetWorkplace: true, resetRole: true });
  } else if (select.dataset.approvalPlacement === "workplace") {
    updateApprovalPlacementOptions(card, { resetRole: true });
  }
});
document.getElementById("passwordResetRequestList")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-password-reset-action]");
  if (!button) return;
  updatePasswordResetRequest(button.dataset.passwordResetId, button.dataset.passwordResetAction);
});
document.getElementById("manualRoleSelect")?.addEventListener("change", () => {
  getManualSettings().roleKey = document.getElementById("manualRoleSelect")?.value || "manager";
  renderManualSettings();
});
document.getElementById("manualEmployeeSelect")?.addEventListener("change", () => {
  getManualSettings().employeeId = document.getElementById("manualEmployeeSelect")?.value || state.fitnessWritableEmployeeId;
  renderManualSettings();
});
document.getElementById("manualEditor")?.addEventListener("input", () => {
  saveManualSettingsFromForm();
  saveState({ fastSave: true });
});
document.getElementById("manualMissionEditor")?.addEventListener("input", () => {
  saveManualSettingsFromForm();
  saveState({ fastSave: true });
});
document.getElementById("loadDefaultManualButton")?.addEventListener("click", loadDefaultManualForSelectedRole);
document.getElementById("loginButton").onclick = signInWithSupabase;
document.getElementById("signupButton").onclick = signUpWithSupabase;
document.getElementById("passwordResetButton").onclick = requestPasswordResetApproval;
document.getElementById("completePasswordResetButton")?.addEventListener("click", completePasswordReset);
document.getElementById("cancelPasswordResetButton")?.addEventListener("click", cancelPasswordReset);
document.getElementById("emailCheckButton")?.addEventListener("click", checkSignupEmailDuplicate);
document.getElementById("authEmail")?.addEventListener("input", () => {
  resetSignupEmailCheck();
});
document.getElementById("registrationEmail")?.addEventListener("input", () => {
  resetSignupEmailCheck();
});
document.getElementById("logoutButton")?.addEventListener("click", signOutWithSupabase);
document.querySelector("[data-registration-org-select]")?.addEventListener("change", () => {
  updateRegistrationWorkplaceOptions({ preserve: false });
});
document.querySelector('[data-settings-profile-field="org"]')?.addEventListener("change", () => {
  updateSettingsPlacementOptions({ preserve: true, resetWorkplace: true, resetRole: true });
});
document.querySelector('[data-settings-profile-field="workplace"]')?.addEventListener("change", () => {
  updateSettingsPlacementOptions({ preserve: true, resetRole: true });
});
document.getElementById("siteAddressList")?.addEventListener("input", (event) => {
  const input = event.target.closest("[data-site-weather-address]");
  if (!input) return;
  const key = input.dataset.siteWeatherAddress || "";
  state.siteWeatherAddresses ||= {};
  const nextAddress = input.value.trim();
  if (state.siteWeatherAddresses[key] === nextAddress) return;
  state.siteWeatherAddresses[key] = nextAddress;
  const cacheSuffix = `::${key}`;
  Object.keys(state.weatherCache || {}).forEach((cacheKey) => {
    if (cacheKey.endsWith(cacheSuffix)) delete state.weatherCache[cacheKey];
  });
  delete state.weatherLocationCache?.[key];
  Array.from(weatherBatchAttempted).forEach((requestKey) => {
    if (requestKey.endsWith(cacheSuffix)) weatherBatchAttempted.delete(requestKey);
  });
  Array.from(weatherRequestFailures.keys()).forEach((requestKey) => {
    if (requestKey.endsWith(cacheSuffix)) clearWeatherRequestFailure(requestKey);
  });
  saveState({ fastSave: true });
  window.clearTimeout(siteWeatherAddressTimers.get(key));
  siteWeatherAddressTimers.set(key, window.setTimeout(() => {
    siteWeatherAddressTimers.delete(key);
    renderWeatherWidgets();
  }, 700));
});
document.getElementById("worklogWeatherRefreshButton")?.addEventListener("click", () => {
  refreshWeatherForScope("worklog");
});
document.getElementById("fitnessWeatherRefreshButton")?.addEventListener("click", () => {
  refreshWeatherForScope("fitness-log");
});
document.getElementById("employeeSelect").onchange = (event) => {
  state.selectedEmployeeId = event.target.value;
  const fitnessIndex = getFitnessLogPages().findIndex((page) => page.id === event.target.value);
  if (fitnessIndex >= 0) state.fitnessLogPage = fitnessIndex;
  saveState();
  renderEntries();
  renderGlobalEmployeeIdentity();
};
document.getElementById("prevDateButton").onclick = () => moveSelectedDate(-1);
document.getElementById("selectedDateButton").onclick = (event) => {
  event.stopPropagation();
  toggleWorklogCalendar();
};
document.getElementById("nextDateButton").onclick = () => moveSelectedDate(1);
document.getElementById("todayJumpButton").onclick = () => setSelectedDateKey(todayKey);
document.getElementById("returnToWorklogOverviewButton")?.addEventListener("click", () => {
  resetMobileDayFocusToSplit({ blur: true });
  switchView("worklog-overview");
});
document.getElementById("returnToFitnessWorklogOverviewButton")?.addEventListener("click", () => {
  switchView("worklog-overview");
});
document.getElementById("calendarPrevYear").onclick = () => shiftCalendarYear(-1);
document.getElementById("calendarNextYear").onclick = () => shiftCalendarYear(1);
document.getElementById("calendarMonthTitle").onclick = () => {
  const yearGrid = document.getElementById("calendarYearGrid");
  const yearControl = document.getElementById("calendarYearControl");
  yearGrid.hidden = !yearGrid.hidden;
  yearControl.classList.toggle("is-wheel-open", !yearGrid.hidden);
  if (!yearGrid.hidden) {
    window.setTimeout(() => yearGrid.querySelector(".is-selected")?.scrollIntoView({ block: "center" }), 0);
  }
};
document.getElementById("calendarMonthTitle").addEventListener("wheel", (event) => {
  event.preventDefault();
  shiftCalendarYear(event.deltaY > 0 ? 1 : -1);
}, { passive: false });
document.getElementById("calendarCloseButton").onclick = closeWorklogCalendar;
document.getElementById("worklogCalendarBackdrop").onclick = closeWorklogCalendar;
document.getElementById("calendarTodaySheetButton").onclick = () => selectCalendarDate(todayKey);
document.getElementById("worklogCalendarPopover").onclick = (event) => event.stopPropagation();
document.addEventListener("click", closeWorklogCalendar);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeWorklogCalendar();
});
{
  const swipeArea = document.getElementById("worklogDateSwipeArea");
  let startX = 0;
  let startY = 0;
  let swipeBlocked = false;
  swipeArea.addEventListener("pointerdown", (event) => {
    swipeBlocked = isEditableDayControl(event.target) || Boolean(event.target.closest("button, select, textarea, input"));
    startX = event.clientX;
    startY = event.clientY;
  });
  swipeArea.addEventListener("pointerup", (event) => {
    if (swipeBlocked || isEditingDailyField()) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    moveSelectedDate(dx < 0 ? 1 : -1);
  });
}
document.getElementById("scheduleUnitButton").onclick = () => {
  if (!guardWorklogEdit()) return;
  const log = getSelectedLog();
  log.scheduleUnit = log.scheduleUnit === "60" ? "30" : "60";
  normalizeEmployeeLogRows(log);
  saveState();
  renderEntries();
};
document.getElementById("worklogHoursButton")?.addEventListener("click", () => promptWorklogDayWorkHours("worklog"));
document.getElementById("worklogAddTimeButton")?.addEventListener("click", () => promptAddWorklogScheduleSlot("worklog"));
document.getElementById("fitnessScheduleUnitButton")?.addEventListener("click", () => {
  if (!guardWorklogEdit("fitness-log")) return;
  const log = getSelectedLog();
  log.scheduleUnit = log.scheduleUnit === "60" ? "30" : "60";
  log.scheduleUnitExplicit = true;
  normalizeEmployeeLogRows(log);
  saveState();
  renderEntries();
});
document.getElementById("fitnessHoursButton")?.addEventListener("click", () => promptWorklogDayWorkHours("fitness"));
document.getElementById("fitnessAddTimeButton")?.addEventListener("click", () => promptAddWorklogScheduleSlot("fitness"));
document.getElementById("fitnessPrevDateButton")?.addEventListener("click", () => moveSelectedDate(-1));
document.getElementById("fitnessNextDateButton")?.addEventListener("click", () => moveSelectedDate(1));
document.getElementById("fitnessTodayButton")?.addEventListener("click", () => setSelectedDateKey(todayKey));
document.getElementById("fitnessDateButton")?.addEventListener("click", (event) => {
  event.stopPropagation();
  openFitnessCalendar();
});
document.getElementById("fitnessDateInput")?.addEventListener("change", (event) => {
  if (event.target.value) setSelectedDateKey(event.target.value);
});
document.getElementById("fitnessCenterPrevMonthButton")?.addEventListener("click", () => shiftFitnessCenterMonth(-1));
document.getElementById("fitnessCenterNextMonthButton")?.addEventListener("click", () => shiftFitnessCenterMonth(1));
document.getElementById("fitnessCenterMonthButton")?.addEventListener("click", () => {
  const input = document.getElementById("fitnessCenterMonthInput");
  if (input?.showPicker) input.showPicker();
  else input?.click();
});
document.getElementById("fitnessCenterMonthInput")?.addEventListener("change", (event) => {
  if (event.target.value) setFitnessCenterMonth(event.target.value);
});
{
  const fitnessDateNav = document.querySelector(".fitness-date-nav");
  let startX = 0;
  let startY = 0;
  let blocked = false;
  fitnessDateNav?.addEventListener("pointerdown", (event) => {
    startX = event.clientX;
    startY = event.clientY;
    blocked = Boolean(event.target.closest("#fitnessPrevDateButton, #fitnessNextDateButton, #fitnessTodayButton"));
  });
  fitnessDateNav?.addEventListener("pointerup", (event) => {
    if (blocked) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (Math.abs(dx) < 38 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
    moveSelectedDate(dx < 0 ? 1 : -1);
  });
}
{
  const overviewDateNav = document.getElementById("overviewDateSwipeArea");
  let startX = 0;
  let startY = 0;
  let blocked = false;
  overviewDateNav?.addEventListener("pointerdown", (event) => {
    startX = event.clientX;
    startY = event.clientY;
    blocked = Boolean(event.target.closest("#overviewPrevDateButton, #overviewNextDateButton, #worklogOverviewTodayButton"));
  });
  overviewDateNav?.addEventListener("pointerup", (event) => {
    if (blocked) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (Math.abs(dx) < 38 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
    moveSelectedDate(dx < 0 ? 1 : -1);
  });
}
document.getElementById("fitnessOpsSummaryButton")?.addEventListener("click", () => {
  document.querySelector(".fitness-ops-section")?.classList.add("is-open");
});
document.getElementById("fitnessOpsCloseButton")?.addEventListener("click", () => {
  document.querySelector(".fitness-ops-section")?.classList.remove("is-open");
});
document.getElementById("fitnessCoachingTicker")?.addEventListener("click", openFitnessCoachingSheet);
document.getElementById("fitnessCoachingCloseButton")?.addEventListener("click", closeFitnessCoachingSheet);
document.getElementById("fitnessCoachingBackdrop")?.addEventListener("click", closeFitnessCoachingSheet);
document.getElementById("fitnessCoachingAiButton")?.addEventListener("click", () => {
  switchView("fitness");
  closeFitnessCoachingSheet();
});
document.getElementById("fitnessReportMenuButton")?.addEventListener("click", openFitnessReportSheet);
document.getElementById("fitnessReportCloseButton")?.addEventListener("click", closeFitnessReportSheet);
document.getElementById("fitnessReportBackdrop")?.addEventListener("click", closeFitnessReportSheet);
document.getElementById("fitnessReportPrintButton")?.addEventListener("click", printFitnessReport);
document.getElementById("fitnessReportConfirmButton")?.addEventListener("click", toggleFitnessCenterReportConfirmation);
document.getElementById("fitnessReportCoachButton")?.addEventListener("click", () => {
  const model = buildFitnessReportModel();
  fitnessReportAiAttempted.delete(model.aiKey);
  requestFitnessReportAiCoaching(model, { force: true, silent: false });
});
document.getElementById("fitnessReportImageButton")?.addEventListener("click", () => {
  saveFitnessReportImage().catch(() => alert("이미지 파일을 만들지 못했습니다. 출력 메뉴에서 PDF 저장을 이용해주세요."));
});
document.getElementById("fitnessReportShareButton")?.addEventListener("click", () => {
  shareFitnessReport().catch(() => alert("공유 기능을 사용할 수 없어 보고서 미리보기를 확인해주세요."));
});
document.getElementById("worklogReportMenuButton")?.addEventListener("click", openWorklogReportSheet);
document.getElementById("worklogReportCloseButton")?.addEventListener("click", closeWorklogReportSheet);
document.getElementById("worklogReportBackdrop")?.addEventListener("click", closeWorklogReportSheet);
document.getElementById("worklogReportImageButton")?.addEventListener("click", () => {
  saveWorklogReportImage().catch(() => alert("보고서 사진을 만들지 못했습니다. 출력 메뉴를 이용해주세요."));
});
document.getElementById("worklogReportPdfButton")?.addEventListener("click", () => {
  saveWorklogReportPdf().catch(() => alert("PDF 파일을 만들지 못했습니다. 출력 메뉴에서 PDF 저장을 이용해주세요."));
});
document.getElementById("worklogReportShareButton")?.addEventListener("click", () => {
  shareWorklogDailyReport().catch(() => alert("보내기 기능을 사용할 수 없어 보고서 미리보기를 유지합니다."));
});
document.getElementById("worklogReportArchiveButton")?.addEventListener("click", openWorklogReportArchive);
document.getElementById("worklogReportPrintButton")?.addEventListener("click", printWorklogDailyReport);
document.getElementById("fitnessCenterConfirmPanel")?.addEventListener("click", (event) => {
  if (event.target.closest("[data-fitness-center-report-confirm]")) toggleFitnessCenterReportConfirmation();
});
document.querySelectorAll("[data-section-ai]").forEach((button) => {
  button.onclick = () => {
    const section = button.dataset.sectionAi || "";
    if (section.startsWith("fitness-")) {
      const subtitle = document.getElementById("fitnessCoachingSheetSub");
      if (subtitle) subtitle.textContent = section.includes("schedule") ? "시간별일정 실행 코칭" : "오늘의 우선업무 실행 코칭";
      openFitnessCoachingSheet();
      return;
    }
    if (section.includes("schedule")) runSectionAiAction("schedule");
    else runSectionAiAction("task");
  };
});
document.querySelectorAll("[data-os-action]").forEach((button) => {
  button.onclick = () => switchView("ai");
});
setupMobileDayFocus();
document.getElementById("addAttendanceButton")?.addEventListener("click", addAttendance);
document.getElementById("attendanceCycleButton")?.addEventListener("click", applyAttendanceCycle);
document.getElementById("clockInTime")?.addEventListener("input", (event) => {
  if (!guardWorklogEdit()) return;
  const log = getSelectedLog();
  log.clockIn = event.target.value;
  log.attendanceStep = event.target.value ? "in" : "ready";
  log.attendanceStatus = event.target.value ? "출근" : "";
  syncAttendanceRecordFromLog(getSelectedEmployee(), log);
  saveState();
  renderClockPanel();
  renderTodayContext();
  renderReport();
});
document.getElementById("clockOutTime")?.addEventListener("input", (event) => {
  if (!guardWorklogEdit()) return;
  const log = getSelectedLog();
  log.clockOut = event.target.value;
  log.attendanceStep = event.target.value ? "out" : "in";
  log.attendanceStatus = event.target.value ? "퇴근" : "출근";
  syncAttendanceRecordFromLog(getSelectedEmployee(), log);
  saveState();
  renderClockPanel();
  renderTodayContext();
  renderReport();
});
document.getElementById("employeeReport").oninput = (event) => {
  if (!guardWorklogEdit()) return;
  const log = getSelectedLog();
  log.report = event.target.value;
  promptAttendanceBeforeWorklogInput(log, event.target.value);
  saveState();
  renderReport();
};
document.getElementById("employeeMemo").oninput = (event) => {
  if (!guardWorklogEdit()) return;
  const log = getSelectedLog();
  log.memo = event.target.value;
  promptAttendanceBeforeWorklogInput(log, event.target.value);
  saveState();
  renderReport();
};
document.querySelectorAll("[data-fitness-field]").forEach((field) => {
  field.oninput = (event) => {
    if (!canEditCurrentWorklog("fitness-log")) {
      guardWorklogEdit("fitness-log");
      return;
    }
    const log = getSelectedLog();
    log.fitnessOps = { ...createFitnessOps(), ...(log.fitnessOps || {}) };
    log.fitnessOpsManual = { ...createFitnessOpsManual(), ...(log.fitnessOpsManual || {}) };
    log.fitnessOpsManual[event.target.dataset.fitnessField] = true;
    log.fitnessOps[event.target.dataset.fitnessField] = event.target.value;
    promptAttendanceBeforeWorklogInput(log, event.target.value);
    saveState({ fastSave: true });
    renderFitnessOpsSummaryButton(log);
    renderReport();
    renderFitnessDashboard();
  };
});
document.querySelectorAll("[data-dagym-field]").forEach((field) => {
  field.oninput = (event) => {
    if (!canManageDagymOperations()) return;
    const record = getDagymOpsForDate(getActiveDateKey());
    record[event.target.dataset.dagymField] = event.target.value;
    touchDagymDailyRecord(record);
    saveState({ fastSave: true });
    renderFitnessCenterDaily();
  };
});
document.getElementById("dagymImportText")?.addEventListener("input", (event) => {
  if (!canManageDagymOperations()) return;
  const record = getDagymOpsForDate(getActiveDateKey());
  record.importText = event.target.value;
  touchDagymDailyRecord(record);
  saveState({ fastSave: true });
});
document.getElementById("dagymImportButton")?.addEventListener("click", importDagymText);
document.getElementById("dagymClearButton")?.addEventListener("click", clearDagymOps);
document.getElementById("dagymCloseButton")?.addEventListener("click", toggleDagymDailyClose);
document.getElementById("fitnessGuidanceGenerateButton")?.addEventListener("click", () => generateTodayFitnessGuidance());
document.getElementById("fitnessDailyGuidancePanel")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-accept-fitness-guidance]");
  if (button) acceptFitnessDailyGuidance(button.dataset.acceptFitnessGuidance);
});
document.querySelectorAll("[data-fitness-goal]").forEach((field) => {
  field.oninput = (event) => {
    state.fitnessGoals = { ...createFitnessGoals(), ...(state.fitnessGoals || {}) };
    state.fitnessGoals[event.target.dataset.fitnessGoal] = event.target.value;
    saveState({ fastSave: true });
    renderFitnessDashboard();
  };
});
document.getElementById("fitnessCoachButton")?.addEventListener("click", () => {
  switchView("fitness");
  alert("피트니스 OS는 업무일지의 PT, 고객관리, 특이사항, 시간별일정을 기준으로 영업·운영·관리 코칭을 생성합니다.");
});
function moveDashboardDate(view, offsetDays) {
  const date = parseDateKey(getActiveDateKey());
  date.setDate(date.getDate() + offsetDays);
  const nextDateKey = formatDateKey(date);
  if (nextDateKey > todayKey) return;
  moveSelectedDate(offsetDays, true);
  window.setTimeout(() => switchView(view), 180);
}

document.getElementById("controlTowerPrevDateButton")?.addEventListener("click", (event) => {
  event.stopPropagation();
  moveDashboardDate("control", -1);
});
document.getElementById("controlTowerNextDateButton")?.addEventListener("click", (event) => {
  event.stopPropagation();
  moveDashboardDate("control", 1);
});
document.getElementById("controlTowerDateButton")?.addEventListener("click", (event) => {
  event.stopPropagation();
  openDashboardCalendar("control");
});
document.getElementById("controlTowerTodayButton")?.addEventListener("click", (event) => {
  event.stopPropagation();
  setSelectedDateKey(todayKey);
  switchView("control");
});
document.getElementById("executivePrevDateButton")?.addEventListener("click", (event) => {
  event.stopPropagation();
  moveDashboardDate("executive", -1);
});
document.getElementById("executiveNextDateButton")?.addEventListener("click", (event) => {
  event.stopPropagation();
  moveDashboardDate("executive", 1);
});
document.getElementById("executiveDateButton")?.addEventListener("click", (event) => {
  event.stopPropagation();
  openDashboardCalendar("executive");
});
document.getElementById("executiveTodayButton")?.addEventListener("click", (event) => {
  event.stopPropagation();
  setSelectedDateKey(todayKey);
  switchView("executive");
});
document.getElementById("executiveMenuButton")?.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleMainMenuPopover(event.currentTarget);
});
document.getElementById("controlTowerMenuButton")?.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleMainMenuPopover(event.currentTarget);
});
document.getElementById("reportArchiveDate")?.addEventListener("change", (event) => {
  const settings = getReportArchiveSettings();
  settings.dateKey = event.target.value || todayKey;
  settings.selectedId = "";
  saveState({ fastSave: true });
  renderReportArchive();
});
document.getElementById("reportArchiveSite")?.addEventListener("change", (event) => {
  const settings = getReportArchiveSettings();
  settings.site = event.target.value || "all";
  settings.selectedId = "";
  saveState();
  renderReportArchive();
});
document.getElementById("reportArchiveType")?.addEventListener("change", (event) => {
  const settings = getReportArchiveSettings();
  settings.type = event.target.value || "all";
  settings.selectedId = "";
  saveState();
  renderReportArchive();
});
document.getElementById("addCommunicationButton")?.addEventListener("click", addCommunication);
document.getElementById("communicationHub")?.addEventListener("click", (event) => {
  const toggle = event.target.closest("[data-communication-toggle]");
  if (toggle) {
    toggleCommunicationDone(toggle.dataset.communicationToggle || "");
    return;
  }
  const remove = event.target.closest("[data-communication-delete]");
  if (remove) deleteCommunication(remove.dataset.communicationDelete || "");
});
document.getElementById("reportArchiveList")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-report-archive-id]");
  if (!button) return;
  getReportArchiveSettings().selectedId = button.dataset.reportArchiveId || "";
  saveState({ fastSave: true });
  renderReportArchive();
});
document.getElementById("reportArchivePreview")?.addEventListener("click", (event) => {
  const laborButton = event.target.closest("[data-report-open-labor]");
  if (laborButton) {
    const employeeId = laborButton.dataset.reportOpenLabor || "";
    if (!canViewLaborEmployee(employeeId)) {
      showAppToast("열람 권한이 없는 직원의 노무기록입니다.");
      return;
    }
    state.selectedEmployeeId = employeeId;
    const month = getReportArchiveSettings().dateKey.slice(0, 7);
    state.selectedDateKey = `${month}-01`;
    state.laborWorkspaceTab = "register";
    saveState({ fastSave: true });
    switchView("attendance");
    return;
  }
  const submitButton = event.target.closest("[data-report-submit-worklog]");
  if (submitButton) {
    submitWorklogReport(submitButton.dataset.reportSubmitWorklog || "", getReportArchiveSettings().dateKey);
    return;
  }
  const centerButton = event.target.closest("[data-report-confirm-center]");
  if (centerButton) {
    toggleFitnessCenterReportConfirmation(getReportArchiveSettings().dateKey);
    renderReportArchive();
  }
});
document.getElementById("reportDetailCloseButton")?.addEventListener("click", closeReportDetail);
document.getElementById("reportDetailBackdrop")?.addEventListener("click", closeReportDetail);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && activeReportDetail) closeReportDetail();
});
document.getElementById("reportTone").onchange = (event) => {
  state.reportTone = event.target.value;
  saveState();
};
document.getElementById("backupRecipientEmail")?.addEventListener("input", (event) => {
  state.backupSettings = { ...getBackupSettings(), recipientEmail: event.target.value.trim() || "j3010@ymail.com" };
  saveState({ fastSave: true });
  renderBackupCenter();
});
document.getElementById("backupCadence")?.addEventListener("change", (event) => {
  state.backupSettings = { ...getBackupSettings(), cadence: event.target.value };
  saveState();
  renderBackupCenter();
});
document.getElementById("copyBackupSummaryButton")?.addEventListener("click", copyBackupSummary);
document.getElementById("downloadBackupButton")?.addEventListener("click", downloadBackupJson);
document.getElementById("emailBackupButton")?.addEventListener("click", openBackupEmailDraft);
document.getElementById("validateBackupButton")?.addEventListener("click", () => openBackupFilePicker("validate"));
document.getElementById("restoreBackupButton")?.addEventListener("click", () => openBackupFilePicker("restore"));
document.getElementById("backupRestoreFile")?.addEventListener("change", handleBackupRestoreFile);
document.getElementById("worklogAiButton")?.addEventListener("click", () => {
  alert("Bangju AI는 업무일지, 근태, 경영 이슈를 모아 일일 보고·리스크 감지·다음 행동 추천으로 연결합니다.");
});
window.addEventListener("resize", () => {
  renderResponsiveMode();
  fitFitnessReportPreview();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    flushPendingRemoteSaves();
    return;
  }
  restoreTodayAfterAppResume();
  if (activeView === "worklog-overview" && canAccessAllWorklogs()) refreshVisibleStaffWorklogsForActiveDate();
});
window.addEventListener("pageshow", (event) => {
  restoreTodayAfterAppResume();
  refreshCurrentTimeIndicators();
});
window.addEventListener("focus", () => {
  restoreTodayAfterAppResume();
  refreshCurrentTimeIndicators();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && fitnessMobileFocusMode !== "split") resetFitnessMobileFocusToSplit({ blur: true });
});
window.addEventListener("pagehide", () => {
  flushPendingRemoteSaves();
});

renderResponsiveMode();
normalizeState();
resetStartupDateToToday();
document.getElementById("reportTone").value = state.reportTone;
renderBackupCenter();
renderInnovationLab();
clearAuthFormCredentials();
setAuthRegistrationVisible(false, { clear: false });
renderAuthStatus("로그인 또는 직원등록을 진행해주세요.");
renderAll();
startLiveClock();
switchView("auth");
initializeAuth();

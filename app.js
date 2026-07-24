const storageKey = "beyond-worklog-state-v1";
const layoutModeStorageKey = "beyond-worklog-layout-mode";
const globalViewModeStorageKey = "beyond-worklog-global-view-mode";
const productionAppUrl = "https://bangju-ai-worklog.vercel.app/";
const supabaseConfig = {
  url: "https://zllpfaijahyfppivkxzu.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpsbHBmYWlqYWh5ZnBwaXZreHp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzMzQxNTUsImV4cCI6MjA5ODkxMDE1NX0.C4omaj-e_9PM-iF3-5GUUVX47Wo06UsNTOYMlMMVcZU",
};
const supabaseClient = window.supabase?.createClient(supabaseConfig.url, supabaseConfig.anonKey) || null;
const todayKey = formatDateKey(new Date());
const worklogViewAliases = {
  worklog: "worklog",
  today: "bangju-log",
  "bangju-log": "today",
  "beyond-log": "today",
};
const attendanceEnabledViews = new Set(["worklog", "fitness-log", "bangju-log", "beyond-log", "today"]);
const controlTowerEmails = new Set(["j3010@ymail.com", "tbakorea@gmail.com"]);
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
const taskPriorityOptions = ["?", "A", "B", "C", "취소", "연기"];
const scheduleTypeOptions = ["업무", "PT", "무료PT", "고객/상담", "영업/홍보", "시설/청결", "행정/정산", "오픈/마감", "휴게"];
const taskStatusCycle = ["미완료", "완료", "진행중", "위임", "연기"];
const taskStatusGuideLabels = {
  "완료": "완료",
  "진행중": "진행중",
  "위임": "위임",
  "연기": "연기",
  "미완료": "미완료",
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
  accessPreset: "employee",
  permissions: {},
};
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
  { id: "bangju-spare-1", name: "방주 예비", org: "(주)방주", role: "예비", primaryWork: "공통 지원" },
  { id: "beyond-fitness-manager", name: "박주홍", nickname: "센터장", org: "(주)방주 / 비욘드 피트니스 지사", role: "센터장", workHours: "06:00-24:00", primaryWork: "운영총괄, PT 수업" },
  { id: "fitness-trainer-1", name: "홍현규", nickname: "홍트", org: "(주)방주 / 비욘드 피트니스 지사", role: "트레이너", workHours: "06:00-24:00", primaryWork: "PT 수업", employmentType: "프리랜서" },
  { id: "fitness-weekday-info", name: "주중 인포", nickname: "주중인포", org: "(주)방주 / 비욘드 피트니스 지사", role: "인포데스크", workHours: "16:00-20:00", primaryWork: "고객응대, 센터관리" },
  { id: "fitness-saturday-info", name: "토요 인포", nickname: "토요인포", org: "(주)방주 / 비욘드 피트니스 지사", role: "토요 인포", workHours: "10:00-18:00", primaryWork: "토요일 고객응대, 센터관리" },
  { id: "fitness-sunday-info", name: "일요 인포", nickname: "일요인포", org: "(주)방주 / 비욘드 피트니스 지사", role: "일요 인포", workHours: "10:00-18:00", primaryWork: "일요일 고객응대, 센터관리" },
  { id: "fitness-spare-1", name: "피트니스 예비", nickname: "예비", org: "(주)방주 / 비욘드 피트니스 지사", role: "예비", workHours: "10:00-18:00", primaryWork: "운영 지원" },
  { id: "beyond-company-leader", name: "비욘드 실장", org: "(주)비욘드컴퍼니", role: "실장", primaryWork: "비욘드컴퍼니 운영총괄" },
  { id: "beyond-shared-manager", name: "공유사업부 매니저", org: "(주)비욘드컴퍼니 / 공유사업부", role: "공유사업부 매니저", primaryWork: "공유오피스, 공유창고, 고객관리" },
  { id: "beyond-spare-1", name: "비욘드 예비", org: "(주)비욘드컴퍼니", role: "예비", primaryWork: "공통 지원" },
];
const fitnessEmployeeIds = ["beyond-fitness-manager", "fitness-trainer-1", "fitness-weekday-info", "fitness-saturday-info", "fitness-sunday-info", "fitness-spare-1"];
const bangjuWorklogEmployeeIds = ["bangju-finance-manager", "bangju-finance-assistant", "bangju-spare-1"];
const beyondWorklogEmployeeIds = ["beyond-company-leader", "beyond-shared-manager", "beyond-spare-1"];

function isAssignedWorklogEmployee(employee) {
  if (!employee) return false;
  const source = `${employee.id || ""} ${employee.name || ""} ${employee.nickname || ""} ${employee.role || ""}`.toLowerCase();
  return !/spare|예비|미배정|unassigned/.test(source);
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
  ["사업장 운영관리", "청결, 시설, 공실, 회원, 방문객, 운영점수", "설계"],
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
  ["Microsoft Dynamics 365", "CRM·ERP·Finance·Field Service·Project Operations를 분리 앱으로 제공하고 AI/Agent를 각 업무 흐름에 붙이는 구조"],
  ["Procore", "건설 프로젝트 전 생애주기, 품질·안전·재무·문서·협업을 하나의 플랫폼과 500+ 통합으로 연결"],
  ["Odoo", "업무 앱을 모듈식으로 쌓는 ERP 방식. CRM, 회계, POS, 프로젝트, 재고 등으로 확장"],
  ["Yardi", "부동산 운영에서 자산, 임대, 회계, CRM을 통합하는 산업 특화 플랫폼 접근"],
];
const operatingRisks = [
  ["공간", "루클라쎄 2차 209~212호 보류 공간의 활용 시나리오 필요", "중"],
  ["매출", "Beyond Fitness 월매출 2천만원 기준 회원 유지율과 PT 전환율 추적 필요", "상"],
  ["시설", "공유오피스/피트니스/무인카페 시설 점검 주기 통합 필요", "중"],
  ["문서", "계약서, 도면, 사진이 사업장 단위로 연결되어야 AI 검색 가능", "상"],
];

const state = loadState();
const authState = {
  session: null,
  user: null,
  remoteReady: Boolean(supabaseClient),
  applyingRemote: false,
  saveTimer: null,
  pendingApprovalCount: 0,
  approvalRows: [],
  selectedApprovalId: "",
  approvalTimer: null,
};
let dateSlideTimer = 0;
let calendarViewDate = parseDateKey(todayKey);
let calendarPickerMode = "worklog";
let calendarPostponeTask = null;
let calendarTriggerButtonId = "selectedDateButton";
let mobileDayFocusMode = "split";
let fitnessScheduleEditorState = null;
const dailyEditingState = {
  focused: false,
  composing: false,
};

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || createState();
  } catch {
    return createState();
  }
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
    fitnessLogPage: 1,
    fitnessCenterMonth: todayKey.slice(0, 7),
    fitnessWritableEmployeeId: "beyond-fitness-manager",
    employeePermissions: {},
    laborPayroll: {},
    reportTone: "executive",
    backupSettings: {
      recipientEmail: "j3010@ymail.com",
      cadence: "daily",
      lastPreparedAt: "",
    },
  };
}

function createEmployeeLog(employee = employees[0], profile = defaultProfile) {
  const workHours = employee.workHours || getEmployeeWorkHours(employee.id, profile);
  return {
    employeeId: employee.id,
    org: employee.org,
    role: employee.role,
    clockIn: "",
    clockOut: "",
    attendanceBreaks: [],
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
  state.selectedEmployeeId ||= "beyond-fitness-manager";
  state.profile = { ...defaultProfile, ...(state.profile || {}) };
  state.profile.nickname ||= "";
  state.profile.weeklyWorkHours = { ...(state.profile.weeklyWorkHours || {}) };
  state.profile.permissions = { ...(state.profile.permissions || {}) };
  state.profile.accessPreset ||= getRecommendedPermissionPresetForProfile(state.profile);
  state.employeePermissions = normalizeEmployeePermissionState(state.employeePermissions || {});
  state.laborPayroll = { ...(state.laborPayroll || {}) };
  state.profile.manualSettings = {
    ...defaultProfile.manualSettings,
    ...(state.profile.manualSettings || {}),
    customByRole: { ...(state.profile.manualSettings?.customByRole || {}) },
    missionsByEmployee: { ...(state.profile.manualSettings?.missionsByEmployee || {}) },
  };
  syncFitnessWritableEmployeeFromProfile();
  if (isRepresentativeProfile() && (!getMappedProfileEmployeeId() || state.selectedEmployeeId === "beyond-fitness-manager")) {
    state.selectedEmployeeId = "profile-user";
  }
  if (state.profile.workHours === "12:00-19:00") state.profile.workHours = defaultProfile.workHours;
  const retiredFitnessIds = {
    "fitness-trainer-2": "fitness-weekday-info",
    "fitness-front-1": "fitness-saturday-info",
    "fitness-front-2": "fitness-sunday-info",
  };
  if (retiredFitnessIds[state.selectedEmployeeId]) state.selectedEmployeeId = retiredFitnessIds[state.selectedEmployeeId];
  if (state.selectedEmployeeId === "profile-user" && state.profile.name === defaultProfile.name) {
    state.selectedEmployeeId = "beyond-fitness-manager";
  }
  state.selectedDateKey ||= todayKey;
  state.fitnessLogPage = Number.isFinite(Number(state.fitnessLogPage)) ? Number(state.fitnessLogPage) : 1;
  if (!/^\d{4}-\d{2}$/.test(String(state.fitnessCenterMonth || ""))) {
    state.fitnessCenterMonth = getActiveDateKey().slice(0, 7);
  }
  state.fitnessWritableEmployeeId ||= "beyond-fitness-manager";
  state.fitnessGoals = { ...createFitnessGoals(), ...(state.fitnessGoals || {}) };
  state.dagymOps = { ...createDagymOps(), ...(state.dagymOps || {}) };
  state.backupSettings = {
    recipientEmail: "j3010@ymail.com",
    cadence: "daily",
    lastPreparedAt: "",
    ...(state.backupSettings || {}),
  };
  const shouldApplyFitnessHourDefault = !state.fitnessScheduleUnitDefaultApplied;
  state.employeeLogs ||= {};
  state.employeeLogs[getActiveDateKey()] ||= {};
  getEmployeeOptions().forEach((employee) => {
    state.employeeLogs[getActiveDateKey()][employee.id] ||= createEmployeeLog(employee);
    const log = state.employeeLogs[getActiveDateKey()][employee.id];
    log.employeeId ||= employee.id;
    log.org ||= employee.org;
    log.role ||= employee.role;
    log.clockIn ||= "";
    log.clockOut ||= "";
    log.attendanceBreaks = Array.isArray(log.attendanceBreaks) ? log.attendanceBreaks : [];
    log.attendanceStatus ||= "";
    log.attendanceStep ||= log.attendanceStatus === "조퇴" ? "early" : log.clockOut ? "out" : log.clockIn ? "in" : "ready";
    log.tasks ||= createEmployeeLog(employee).tasks;
    log.schedule ||= createEmployeeLog(employee).schedule;
    if (shouldApplyFitnessHourDefault && fitnessEmployeeIds.includes(employee.id)) {
      log.scheduleUnit = "60";
    }
    normalizeEmployeeLogRows(log);
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

function normalizeEmployeeLogRows(log) {
  log.tasks ||= [];
  log.schedule ||= [];
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
    task.status ||= "예정";
    task.done ||= false;
    task.text ||= "";
    task.delegate ||= "";
    task.postponeDate ||= "";
  });
  while (log.tasks.length < 14) {
    log.tasks.push({ id: `task-${Date.now()}-${log.tasks.length}`, priority: "?", text: "", status: "예정", done: false });
  }
  log.scheduleUnit = log.scheduleUnit === "60" ? "60" : "30";
  const scheduleByTime = new Map(log.schedule.map((item) => [item.time, item]));
  const scheduleTimes = getWorklogScheduleSlots(log);
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
  localStorage.setItem(storageKey, JSON.stringify(state));
  scheduleRemoteSave(options.fastSave ? 500 : 700);
}

function getSelectedEmployee() {
  return getEmployeeOptions().find((employee) => employee.id === state.selectedEmployeeId) || getProfileEmployee();
}

function getEmployeeOptions() {
  return [getProfileEmployee(), ...employees];
}

function getProfileEmployee() {
  const profile = { ...defaultProfile, ...(state?.profile || {}) };
  return {
    id: "profile-user",
    name: profile.name || "내 프로필",
    nickname: profile.nickname || "",
    org: profile.org || "(주)방주",
    role: profile.role || "직원",
    primaryWork: profile.primaryWork || "",
    employmentType: profile.employmentType || "직원",
    workHours: profile.workHours || defaultProfile.workHours,
  };
}

function getMappedProfileEmployeeId() {
  return getProfileMappedEmployeeId(state?.profile || {});
}

function isEmployeeLinkedToProfile(employeeId) {
  if (!employeeId) return false;
  return employeeId === "profile-user" || getMappedProfileEmployeeId() === employeeId;
}

function getEmployeeWorkHours(employeeId = state?.selectedEmployeeId, profile = state?.profile, dateKey = getActiveDateKey()) {
  const profileHours = getProfileWorkHoursForDate(profile, dateKey);
  if (employeeId === "profile-user" || isEmployeeLinkedToProfile(employeeId)) {
    return profileHours || profile?.workHours || state?.profile?.workHours || defaultProfile.workHours;
  }
  const employee = employees.find((item) => item.id === employeeId);
  return employee?.workHours || defaultProfile.workHours;
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

function getFitnessEmployees() {
  return fitnessEmployeeIds
    .map((id) => employees.find((employee) => employee.id === id))
    .filter(isAssignedWorklogEmployee);
}

function getEmployeeAdminLabel(employee = getSelectedEmployee()) {
  if (String(employee.role || "").trim() && String(employee.role || "").trim() === String(employee.name || "").trim()) {
    return String(employee.role || "직원").trim();
  }
  return `${employee.role || "직원"} ${employee.name || ""}`.trim();
}

function getEmployeeOwnLabel(employee = getSelectedEmployee()) {
  if (employee.id === state.fitnessWritableEmployeeId && isEmployeeLinkedToProfile(employee.id)) {
    return state.profile?.nickname || employee.nickname || employee.name || "내 업무일지";
  }
  if (employee.id === "profile-user") return state.profile?.nickname || employee.nickname || employee.name || "내 업무일지";
  return employee.nickname || employee.name || getEmployeeAdminLabel(employee);
}

function isBennyExecutiveProfile() {
  const email = String(authState.user?.email || state.profile?.email || "").trim().toLowerCase();
  const nickname = String(state.profile?.nickname || "").trim().toLowerCase();
  return email === "j3010@ymail.com" || nickname === "베니" || nickname === "benny";
}

function getFitnessOwnIdentity(employee = employees.find((item) => item.id === state.fitnessWritableEmployeeId) || getSelectedEmployee()) {
  if (employee?.id === "profile-user" && isBennyExecutiveProfile()) {
    return { role: "대표", label: "베니", pageTitle: "benny 업무일지" };
  }
  const label = getEmployeeOwnLabel(employee);
  const role = employee.role || "직원";
  return { role, label, pageTitle: "업무일지(본인용)" };
}

function syncFitnessWritableEmployeeFromProfile() {
  const profile = state.profile || {};
  if (isRepresentativeProfile()) return;
  const source = `${profile.org || ""} ${profile.workplace || ""} ${profile.primaryWork || ""}`.toLowerCase();
  if (!/피트니스|fitness|beyond/.test(source)) return;
  const role = `${profile.role || ""} ${profile.primaryWork || ""} ${profile.nickname || ""}`;
  let id = "beyond-fitness-manager";
  if (/홍현규|트레이너|trainer|pt|피티/.test(role)) id = "fitness-trainer-1";
  else if (/토요|토요일/.test(role)) id = "fitness-saturday-info";
  else if (/일요|일요일/.test(role)) id = "fitness-sunday-info";
  else if (/인포|데스크|front|프론트|주중/.test(role)) id = "fitness-weekday-info";
  else if (/박주홍|센터장|총괄|manager/.test(role)) id = "beyond-fitness-manager";
  state.fitnessWritableEmployeeId = id;
  state.selectedEmployeeId = id;
  state.fitnessLogPage = 1;
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
  const fitnessEmployees = getFitnessEmployees();
  const writableEmployee = fitnessEmployees.find((employee) => employee.id === state.fitnessWritableEmployeeId) || fitnessEmployees[0];
  const coworkerEmployees = fitnessEmployees.filter((employee) => employee.id !== writableEmployee?.id);
  return [{ type: "center", id: "fitness-center", title: "센터 운영현황" }, ...[writableEmployee, ...coworkerEmployees].filter(Boolean).map((employee) => ({
    type: "employee",
    id: employee.id,
    title: employee.name,
    employee,
  }))];
}

function clampFitnessLogPage(index = state.fitnessLogPage) {
  const pages = getFitnessLogPages();
  return Math.max(0, Math.min(pages.length - 1, Number(index) || 0));
}

function getCurrentFitnessLogPage() {
  return getFitnessLogPages()[clampFitnessLogPage()] || getFitnessLogPages()[1];
}

function isCurrentFitnessLogEditable() {
  const page = getCurrentFitnessLogPage();
  return page?.type === "employee" && isOwnFitnessEmployeeId(page.id);
}

function isOwnFitnessEmployeeId(employeeId) {
  return Boolean(employeeId && employeeId === state.fitnessWritableEmployeeId && isEmployeeLinkedToProfile(employeeId));
}

function getProfileMappedEmployeeId(profile = state.profile || {}) {
  const email = String(authState.user?.email || profile.email || "").trim().toLowerCase();
  const source = `${profile.org || ""} ${profile.workplace || ""} ${profile.role || ""} ${profile.name || ""} ${profile.nickname || ""} ${profile.primaryWork || ""}`.toLowerCase();
  if (controlTowerEmails.has(email) || /대표|owner|ceo/.test(source)) return "";
  if (/이소미/.test(source) || /재무\s*대리|finance\s*assistant/.test(source)) return "bangju-finance-assistant";
  if (/재무\s*과장|finance\s*manager/.test(source)) return "bangju-finance-manager";
  if (/박주홍/.test(source) || /센터장|피트니스.*총괄|fitness.*manager/.test(source)) return "beyond-fitness-manager";
  if (/홍현규|트레이너|trainer|pt|피티/.test(source)) return "fitness-trainer-1";
  if (/토요|토요일/.test(source)) return "fitness-saturday-info";
  if (/일요|일요일/.test(source)) return "fitness-sunday-info";
  if (/인포|데스크|front|프론트|주중/.test(source)) return "fitness-weekday-info";
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
  if (["bangju-log", "beyond-log", "today"].includes(view)) return getProfileMappedEmployeeId() || "profile-user";
  return "";
}

function canEditEmployeeSlot(employeeId = "") {
  if (!employeeId) return false;
  if (employeeId === "profile-user") return true;
  if (!authState.user) return false;
  if (isRepresentativeProfile()) return false;
  return getProfileMappedEmployeeId() === employeeId;
}

function canEditCurrentWorklog(view = activeView) {
  if (!isWorklogEditView(view)) return false;
  if (isRepresentativeProfile()) return false;
  if (view === "fitness-log") {
    const currentEmployeeId = getCurrentWorklogEmployeeId(view);
    return isCurrentFitnessLogEditable() && canEditEmployeeSlot(currentEmployeeId);
  }
  const currentEmployeeId = getCurrentWorklogEmployeeId(view);
  const ownEmployeeId = getOwnEditableEmployeeIdForView(view);
  return Boolean(currentEmployeeId && ownEmployeeId && currentEmployeeId === ownEmployeeId && canEditEmployeeSlot(currentEmployeeId));
}

function guardWorklogEdit() {
  if (canEditCurrentWorklog()) return true;
  showAppToast("열람 전용 업무일지입니다");
  applyCurrentWorklogPermissionState();
  return false;
}

function setFitnessLogPage(index) {
  const pageIndex = clampFitnessLogPage(index);
  const page = getFitnessLogPages()[pageIndex];
  state.fitnessLogPage = pageIndex;
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
  const workHours = workHoursValue || state?.profile?.workHours || defaultProfile.workHours;
  if (/휴무|off|closed|none|없음/i.test(String(workHours))) return [];
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

function getActiveDateKey() {
  return state.selectedDateKey || todayKey;
}

function getSelectedLog() {
  const employee = getSelectedEmployee();
  const key = getActiveDateKey();
  return getEmployeeLogForDate(employee.id, key);
}

function getEmployeeLogForDate(employeeId, key = getActiveDateKey()) {
  const employee = getEmployeeOptions().find((item) => item.id === employeeId) || employees.find((item) => item.id === employeeId) || getSelectedEmployee();
  state.employeeLogs ||= {};
  state.employeeLogs[key] ||= {};
  state.employeeLogs[key][employee.id] ||= createEmployeeLog(employee);
  state.employeeLogs[key][employee.id].attendanceBreaks = Array.isArray(state.employeeLogs[key][employee.id].attendanceBreaks)
    ? state.employeeLogs[key][employee.id].attendanceBreaks
    : [];
  return state.employeeLogs[key][employee.id];
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
  const titleButtons = ["selectedDateButton", "fitnessDateButton", "overviewDateButton"]
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
    const nextTitleButtons = ["selectedDateButton", "fitnessDateButton", "overviewDateButton"]
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
  const isNarrow = window.matchMedia("(max-width: 760px)").matches;
  const isPhoneWidth = window.matchMedia("(max-width: 640px)").matches;
  const mode = isNarrow ? "narrow" : "expanded";
  const viewMode = getGlobalViewMode();
  const layoutMode = isPhoneWidth || viewMode === "ceo" ? "phone" : "wide";
  localStorage.setItem(layoutModeStorageKey, layoutMode);
  document.body.dataset.deviceMode = mode;
  document.body.dataset.layoutMode = layoutMode;
  document.body.classList.toggle("smartphone-device", layoutMode === "phone" || isPhoneWidth);
  document.body.classList.toggle("physical-phone-device", isPhoneWidth);
  applyGlobalViewMode();
  const layoutToggle = document.querySelector(".layout-mode-toggle");
  if (layoutToggle) layoutToggle.hidden = isPhoneWidth;
  document.querySelectorAll("[data-layout-mode-choice]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.layoutModeChoice === layoutMode);
  });
  applyMobileDayFocusMode();
}

function isPhysicalPhoneLayout() {
  return window.matchMedia("(max-width: 640px)").matches;
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
  }
  if (label) label.textContent = mode === "ceo" ? "CEO" : "클래식";
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
  return hasProfilePermission("controlTower") || hasProfilePermission("siteControl") || hasApprovalAuthority();
}

function canAccessWorklogOverview() {
  return hasProfilePermission("worklogAll") || isRepresentativeProfile() || canAccessControlTower();
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
    { id: "fitness", label: "피트니스", title: "비욘드 피트니스", view: "fitness-log", employeeIds: getAssignedWorklogEmployeeIds(fitnessEmployeeIds) },
  ];
}

function getOverviewActiveTasks(log) {
  const active = (log.tasks || []).filter((task) => String(task.text || "").trim());
  return (active.length ? active : log.tasks || []).slice(0, 8);
}

function getOverviewScheduleRows(log) {
  const filled = (log.schedule || []).filter((item) => getScheduleEntryText(item));
  const base = filled.length ? filled : log.schedule || [];
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

function renderWorklogOverview() {
  const grid = document.getElementById("worklogOverviewGrid");
  if (!grid) return;
  if (!canAccessWorklogOverview()) {
    grid.innerHTML = `
      <article class="worklog-overview-denied">
        <strong>접근 권한이 필요합니다.</strong>
        <p>대표 또는 대표가 지정한 직원만 전 사업장 업무일지를 열람할 수 있습니다.</p>
      </article>
    `;
    return;
  }
  const dateKey = getActiveDateKey();
  const dateLabel = formatShortDate(dateKey);
  grid.innerHTML = getWorklogOverviewGroups().map((group) => {
    const employeeCards = group.employeeIds.map((employeeId, index) => {
      const employee = employees.find((item) => item.id === employeeId);
      if (!employee) return "";
      const dayLog = state.employeeLogs?.[dateKey]?.[employeeId] || createEmployeeLog(employee);
      const tasks = (dayLog.tasks || []).filter(isActiveTask);
      const done = tasks.filter((task) => task.done || task.status === "완료").length;
      const scheduleCount = (dayLog.schedule || []).filter((item) => getScheduleEntryText(item)).length;
      const attendance = formatAttendanceSummary(dayLog) || dayLog.attendanceStatus || "출결 미기록";
      const reportText = getOverviewReportText(dayLog);
      const activeTasks = getOverviewActiveTasks(dayLog);
      const scheduleRows = getOverviewScheduleRows(dayLog);
      const insightPanel = renderOverviewInsightPanel(employee, dayLog, { tasks, scheduleCount, reportText, attendance });
      return `
        <article class="worklog-overview-employee-sheet projected-worklog-sheet" data-overview-site="${escapeAttr(group.id)}">
          <header class="overview-sheet-head">
            <div>
              <span>${escapeHtml(group.label)} ${index + 1}</span>
              <h3>${escapeHtml(getEmployeeAdminLabel(employee))}</h3>
              <p>${escapeHtml(attendance)}</p>
            </div>
            <button type="button" data-overview-employee="${escapeAttr(employeeId)}" data-overview-view="${escapeAttr(group.view)}">열기</button>
          </header>
          ${insightPanel}
          <section class="overview-report-panel">
            <span>업무보고</span>
            <p>${escapeHtml(reportText || "오늘 보고 내용이 아직 없습니다.")}</p>
          </section>
          <div class="overview-sheet-body">
            <section class="projected-task-panel">
              <h4>주요업무 <em>${done}/${tasks.length || 0}</em></h4>
              <ul>
                ${(activeTasks.length ? activeTasks : [{ priority: "?", text: "업무 내용", status: "예정" }]).map(renderOverviewTaskMini).join("")}
              </ul>
            </section>
            <section class="projected-schedule-panel">
              <h4>시간별 일정 <em>${scheduleCount}</em></h4>
              <ul>
                ${scheduleRows.map(renderOverviewScheduleMini).join("")}
              </ul>
            </section>
          </div>
        </article>
      `;
    }).join("");
    return `
      <section class="worklog-overview-site" data-overview-site="${escapeAttr(group.id)}">
        <header>
          <span>${escapeHtml(dateLabel)}</span>
          <h3>${escapeHtml(group.title)}</h3>
        </header>
        <div>${employeeCards}</div>
      </section>
    `;
  }).join("");
  grid.querySelectorAll("[data-overview-employee]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedEmployeeId = button.dataset.overviewEmployee;
      saveState({ fastSave: true });
      switchView(button.dataset.overviewView || "bangju-log");
    });
  });
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

  const assetRows = getAssetRows();
  const staffRows = getControlStaffRows();
  const siteRows = getControlSiteRows(assetRows, staffRows);
  const activeSites = assetRows.filter((row) => ["운영", "무인운영", "임대"].includes(row.status)).length;
  const presentCount = staffRows.filter((row) => row.attendanceStatus !== "미기록" && !row.attendanceStatus.includes("결석")).length;
  const issueCount = staffRows.filter((row) => row.aiSignal !== "정상").length;
  const taskTotal = staffRows.reduce((sum, row) => sum + row.taskCount, 0);
  const completedTotal = staffRows.reduce((sum, row) => sum + row.completedCount, 0);
  const fitnessOps = getFitnessOpsSummary();
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
    ["매뉴얼·코칭", "역할별 매뉴얼과 직원 성장 코칭 데이터를 확인합니다.", "학습", "ai"],
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
  const todayButton = document.getElementById("executiveTodayButton");
  if (!body) return;
  if (todayButton) {
    todayButton.textContent = formatFormalKoreanDate(getActiveDateKey());
    todayButton.setAttribute("aria-label", `${formatFormalKoreanDate(getActiveDateKey())} 기준, 오늘로 이동`);
  }
  const allowed = isRepresentativeProfile();
  if (accessCard) accessCard.hidden = allowed;
  body.hidden = !allowed;
  if (accessLabel) accessLabel.textContent = allowed ? "대표 접근 중 · 오늘의 판단 · 지시 · 위임" : "대표 전용 · 의사결정과 개입사항";
  if (!allowed) return;

  const assetRows = getAssetRows();
  const staffRows = getControlStaffRows();
  const siteRows = getControlSiteRows(assetRows, staffRows);
  const fitnessOps = getFitnessOpsSummary();
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
    ["노무", "근무이력은 월별 노무비 지급대장과 연결됩니다. 결석·조퇴·프리랜서 P/T 정산을 확인하세요.", "월마감"],
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
  const customMission = state.profile?.manualSettings?.missionsByEmployee?.[employee.id] || "";
  const tasks = (log.tasks || []).filter((task) => String(task.text || "").trim());
  const entries = (log.schedule || []).filter((entry) => getScheduleEntryText(entry));
  const reportText = String(log.report || log.memo || "").trim();
  const attendance = getAttendanceStatusForLog(employee, log);
  return { employee, log, growth, manual, customMission, tasks, entries, reportText, attendance };
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
      text: "직원설정에 입력된 지정 미션을 오늘 실행 가능한 업무로 쪼개어 기록합니다.",
      tip: "지정 미션은 업무일지에 완료조건을 붙여야 실행 추적이 됩니다.",
      reason: "직원별 미션 데이터",
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
    .filter((employee) => !employee.id.includes("profile-user"));
  return sourceEmployees
    .flatMap((employee) => getMissionProposalsForEmployee(employee, getEmployeeLogForDate(employee.id)).slice(0, 2))
    .sort((a, b) => getPrioritySortValue(a.priority) - getPrioritySortValue(b.priority))
    .slice(0, limit);
}

function canApplyMissionToEmployee(employeeId = "") {
  if (!employeeId) return false;
  return canAccessWorklogOverview() || canEditEmployeeSlot(employeeId);
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
            ${allowApply ? `<button type="button" data-ai-mission-apply="${escapeAttr(proposal.id)}">업무에 반영</button>` : ""}
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
  const score = calculateOperatingScore();
  const log = getSelectedLog();
  const tasks = (log.tasks || []).filter((task) => task.text.trim());
  const growth = buildPersonalGrowthModel(getSelectedEmployee(), log);
  const personalProposals = getMissionProposalsForEmployee(getSelectedEmployee(), log);
  const queue = canAccessWorklogOverview() ? getMissionProposalQueue(6) : [];
  const coaching = [
    ["대표 AI 코치", `오늘 점검 우선순위는 운영점수 ${score}점 기준으로 매출, 공간 활용, 문서 연결입니다.`],
    ["사업장 AI 코치", "Beyond Fitness는 회원 240명, 월매출 2천만원을 기준 KPI로 두고 PT 전환율과 이탈률을 먼저 추적해야 합니다."],
    ["직원 AI 코치", tasks.length ? `오늘 우선업무 ${tasks.length}건을 기준으로 완료율과 지연 사유를 기록합니다.` : "개인 업무일지의 우선업무와 시간별 일정을 먼저 기록해야 코칭 품질이 올라갑니다."],
    ["데이터 설계 코치", "모든 사진, 도면, 계약서, 업무일지, 매출 데이터는 반드시 사업장 ID와 호실 ID에 연결해야 합니다."],
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
    <article class="ai-mission-command-card">
      <header>
        <div>
          <span>AI Mission Architect</span>
          <strong>업무·프로젝트 제안</strong>
        </div>
        <em>${personalProposals.length}건</em>
      </header>
      <p>직원 프로필, 직무 매뉴얼, 오늘 업무일지, 시간표, 출결, 사업장 목표를 근거로 지금 맡기기 좋은 일을 제안합니다.</p>
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
}

function renderDateNav() {
  const selectedDateButton = document.getElementById("selectedDateButton");
  const dayTitle = document.getElementById("worklogDayTitle");
  const todayJumpButton = document.getElementById("todayJumpButton");
  const overviewDateButton = document.getElementById("overviewDateButton");
  const overviewDateTitle = document.getElementById("overviewDateTitle");
  const overviewTodayButton = document.getElementById("worklogOverviewTodayButton");
  const activeDateKey = getActiveDateKey();
  calendarViewDate = parseDateKey(activeDateKey);
  if (dayTitle) dayTitle.textContent = formatKoreanDate(activeDateKey);
  if (overviewDateTitle) overviewDateTitle.textContent = formatKoreanDate(activeDateKey);
  selectedDateButton?.setAttribute("aria-label", `${formatKoreanDate(activeDateKey)} 업무일지 날짜 선택`);
  overviewDateButton?.setAttribute("aria-label", `${formatKoreanDate(activeDateKey)} 전체 업무일지 날짜 선택`);
  if (todayJumpButton) {
    const isToday = activeDateKey === todayKey;
    todayJumpButton.hidden = false;
    todayJumpButton.disabled = isToday;
    todayJumpButton.classList.toggle("is-current-date", isToday);
    todayJumpButton.setAttribute("aria-disabled", String(isToday));
  }
  if (overviewTodayButton) {
    const isToday = activeDateKey === todayKey;
    overviewTodayButton.disabled = isToday;
    overviewTodayButton.classList.toggle("is-current-date", isToday);
    overviewTodayButton.setAttribute("aria-disabled", String(isToday));
  }
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
  selectedDateButton.setAttribute("aria-expanded", "true");
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
  monthTitle.textContent = `${year}년`;
  selectedLabel.textContent = calendarPickerMode === "postpone"
    ? `연기일 ${selectedDateKey ? formatKoreanDate(selectedDateKey) : "미정"}`
    : calendarPickerMode === "fitness"
      ? `피트니스 업무일지 ${formatKoreanDate(getActiveDateKey())}`
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
  renderGlobalAttendanceSummary(employee);
  updateGlobalAttendanceVisibility();
}

function getGeneralWorklogTitle(view = activeView) {
  if (view === "beyond-log") return "비욘드 업무일지";
  return "방주 업무일지";
}

function getRecommendedPermissionPresetForProfile(profile = {}) {
  const email = String(authState.user?.email || profile.email || "").trim().toLowerCase();
  const roleText = `${profile.role || ""} ${profile.primaryWork || ""} ${profile.nickname || ""}`;
  if (controlTowerEmails.has(email) || /대표|owner|ceo|회장/i.test(roleText)) return "owner";
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
  const recommended = getRecommendedPermissionPresetForProfile(profile);
  const presetKey = normalizePermissionPresetKey(profile.accessPreset || recommended);
  const set = buildPermissionSet(presetKey, profile.permissions || {});
  if (recommended === "owner") {
    return buildPermissionSet("owner", set.permissions);
  }
  return set;
}

function hasProfilePermission(key, profile = state.profile || {}) {
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
  const profile = state.profile || {};
  const email = String(authState.user?.email || profile.email || "").trim().toLowerCase();
  const roleText = `${profile.role || ""} ${profile.primaryWork || ""} ${profile.nickname || ""}`;
  if (hasProfilePermission("executiveRoom", profile)) return true;
  if (controlTowerEmails.has(email)) return true;
  if (authState.user && (profile.approvalStatus || "pending") !== "approved") return false;
  return /대표|owner|ceo|회장|임원|총괄/i.test(roleText);
}

function hasApprovalAuthority(profile = state.profile || {}) {
  const email = String(authState.user?.email || profile.email || "").trim().toLowerCase();
  const roleText = `${profile.role || ""} ${profile.primaryWork || ""} ${profile.nickname || ""}`;
  if (hasProfilePermission("staffApproval", profile) || hasProfilePermission("staffManage", profile)) return true;
  if (controlTowerEmails.has(email)) return true;
  if (authState.user && (profile.approvalStatus || "pending") !== "approved") return false;
  return /대표|관리자|센터장|총괄|임원|admin|owner|manager/i.test(roleText);
}

function canShowApprovalMenu() {
  const email = String(authState.user?.email || state.profile?.email || "").trim().toLowerCase();
  return controlTowerEmails.has(email) || hasApprovalAuthority();
}

function isProfileApproved() {
  if (!authState.user) return true;
  if (hasApprovalAuthority()) return true;
  const status = state.profile?.approvalStatus || "approved";
  return status === "approved";
}

function getApprovalStatusLabel(status = state.profile?.approvalStatus) {
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
  if (isRepresentativeProfile()) return "executive";
  return getUserWorklogView();
}

function getWorklogEmployeeIdsForView(view) {
  if (view === "fitness-log") return getAssignedWorklogEmployeeIds(fitnessEmployeeIds);
  if (view === "beyond-log") return getAssignedWorklogEmployeeIds(beyondWorklogEmployeeIds);
  if (view === "bangju-log" || view === "today") return getAssignedWorklogEmployeeIds(bangjuWorklogEmployeeIds);
  return [];
}

function ensureSelectedEmployeeForWorklogView(view) {
  const ids = getWorklogEmployeeIdsForView(view);
  if (!ids.length || ids.includes(state.selectedEmployeeId)) return;
  const ownEmployeeId = getOwnEditableEmployeeIdForView(view);
  if (!isRepresentativeProfile() && ids.includes(ownEmployeeId)) {
    state.selectedEmployeeId = ownEmployeeId;
    return;
  }
  state.selectedEmployeeId = ids[0];
}

function getGlobalHeaderTitle(view = activeView, personLabel = "") {
  if (view === "worklog" || view === "worklog-overview") return "업무일지";
  if (view === "fitness-log") return `beyond fitness · ${personLabel}`;
  if (view === "executive") return "대표 경영페이지";
  if (view === "control") return "Beyond Control Tower";
  if (view === "beyond-log") return `비욘드 업무일지 · ${personLabel}`;
  if (view === "bangju-log" || view === "today") return `방주 업무일지 · ${personLabel}`;
  if (view === "fitness") return "비욘드 피트니스 OS";
  if (view === "attendance") return "노무";
  if (view === "management") return "사업장 운영관리";
  if (view === "staff") return "직원";
  if (view === "organization") return "조직";
  if (view === "ai") return "매뉴얼·코칭";
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
  document.querySelectorAll("[data-profile-field]").forEach((field) => {
    const value = state.profile?.[field.dataset.profileField] || "";
    field.value = isPhoneField(field) ? formatPhoneNumber(value) : value;
  });
  renderSignupSheetStatus();
  renderSettingsForm();
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
  document.querySelectorAll("[data-settings-work-hours-day]").forEach((field) => {
    field.value = state.profile?.weeklyWorkHours?.[field.dataset.settingsWorkHoursDay] || "";
  });
  renderManualSettings();
  renderApprovalAccess();
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
    if (list) list.innerHTML = `<p class="empty-note">대표 또는 승인 권한자만 가입신청을 확인할 수 있습니다.</p>`;
    return;
  }
  loadApprovalRequests();
}

function renderApprovalNotification() {
  const menuAllowed = canShowApprovalMenu();
  const alertAllowed = Boolean(authState.user && hasApprovalAuthority());
  const count = alertAllowed ? authState.pendingApprovalCount || 0 : 0;
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
  if (!supabaseClient || !authState.user || !hasApprovalAuthority()) {
    authState.pendingApprovalCount = 0;
    renderApprovalNotification();
    return;
  }
  const { count, error } = await supabaseClient
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("approval_status", "pending");
  if (!error) authState.pendingApprovalCount = Math.max(0, Number(count || 0));
  renderApprovalNotification();
}

function startApprovalNotificationPolling() {
  clearInterval(authState.approvalTimer);
  if (!authState.user || !hasApprovalAuthority()) {
    authState.approvalTimer = null;
    refreshApprovalNotification();
    return;
  }
  refreshApprovalNotification();
  authState.approvalTimer = setInterval(refreshApprovalNotification, 60000);
}

function openApprovalManagement() {
  switchView("settings");
  switchSettingsTab("approval");
  renderApprovalAccess();
}

async function loadApprovalRequests() {
  const list = document.getElementById("approvalRequestList");
  if (!list) return;
  if (!supabaseClient || !authState.user) {
    list.innerHTML = `<p class="empty-note">Supabase 로그인 후 가입신청을 확인할 수 있습니다.</p>`;
    return;
  }
  list.innerHTML = `<p class="empty-note">가입신청을 불러오는 중입니다...</p>`;
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .in("approval_status", ["pending", "approved", "rejected"])
    .order("updated_at", { ascending: false });
  if (error) {
    list.innerHTML = `<p class="empty-note">가입신청을 불러오지 못했습니다. Supabase 승인 정책을 적용했는지 확인해주세요.<br>${escapeHtml(error.message)}</p>`;
    return;
  }
  const rows = (data || []).filter((row) => row.id !== authState.user.id);
  authState.approvalRows = rows;
  authState.pendingApprovalCount = rows.filter((row) => (row.approval_status || "pending") === "pending").length;
  renderApprovalNotification();
  if (!rows.length) {
    list.innerHTML = `
      <div class="approval-empty-state">
        <strong>가입신청 없음</strong>
        <p>대기, 승인완료, 반려 목록이 비어 있습니다. 새 신청이 들어오면 이곳에 상태별로 정리됩니다.</p>
      </div>
    `;
    return;
  }
  if (!rows.some((row) => row.id === authState.selectedApprovalId)) {
    authState.selectedApprovalId = rows.find((row) => (row.approval_status || "pending") === "pending")?.id || rows[0].id;
  }
  renderApprovalQueue();
}

function getApprovalStatusTone(status = "pending") {
  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  return "pending";
}

function renderApprovalQueue() {
  const list = document.getElementById("approvalRequestList");
  if (!list) return;
  const rows = authState.approvalRows || [];
  const selected = rows.find((row) => row.id === authState.selectedApprovalId) || rows[0];
  const groups = [
    ["pending", "승인대기", "대표 확인 필요"],
    ["approved", "승인완료", "사용 가능"],
    ["rejected", "반려", "보완 요청"],
  ];
  list.innerHTML = `
    <div class="approval-queue-layout">
      <aside class="approval-queue-sidebar" aria-label="가입승인 상태별 목록">
        <div class="approval-queue-summary">
          ${groups.map(([status, label, caption]) => {
            const count = rows.filter((row) => (row.approval_status || "pending") === status).length;
            return `
              <article data-status="${escapeAttr(status)}">
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(String(count))}</strong>
                <em>${escapeHtml(caption)}</em>
              </article>
            `;
          }).join("")}
        </div>
        ${groups.map(([status, label]) => renderApprovalQueueGroup(status, label, rows, selected?.id)).join("")}
      </aside>
      <div class="approval-detail-panel">
        ${selected ? renderApprovalRequestCard(selected) : `<p class="empty-note">선택된 가입신청이 없습니다.</p>`}
      </div>
    </div>
  `;
}

function renderApprovalQueueGroup(status, label, rows, selectedId) {
  const items = rows.filter((row) => (row.approval_status || "pending") === status);
  return `
    <section class="approval-queue-group" data-status="${escapeAttr(status)}">
      <header>
        <strong>${escapeHtml(label)}</strong>
        <span>${escapeHtml(String(items.length))}명</span>
      </header>
      <div>
        ${items.length ? items.map((row) => renderApprovalQueueButton(row, selectedId)).join("") : `<p>해당 직원 없음</p>`}
      </div>
    </section>
  `;
}

function renderApprovalQueueButton(row, selectedId) {
  const status = row.approval_status || "pending";
  const meta = [row.role, row.org, row.workplace].filter(Boolean).join(" · ") || "소속/직함 확인 필요";
  return `
    <button type="button" data-approval-select="${escapeAttr(row.id)}" class="${row.id === selectedId ? "is-selected" : ""}">
      <span>${escapeHtml(row.name || row.nickname || "이름 미입력")}</span>
      <small>${escapeHtml(row.email || "이메일 없음")}</small>
      <em>${escapeHtml(meta)}</em>
      <b data-status="${escapeAttr(status)}">${escapeHtml(getApprovalStatusLabel(status))}</b>
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

function renderApprovalRequestCard(row) {
  const status = row.approval_status || "pending";
  const field = (name, label, value = "", type = "text") => `
    <label>${escapeHtml(label)}
      <input type="${type}" data-approval-id="${escapeAttr(row.id)}" data-approval-field="${escapeAttr(name)}" value="${escapeAttr(name === "phone" ? formatPhoneNumber(value) : value || "")}" />
    </label>
  `;
  const statusTone = getApprovalStatusTone(status);
  const approvedLabel = row.approved_at ? new Date(row.approved_at).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" }) : "";
  return `
    <article class="approval-request-card" data-approval-card="${escapeAttr(row.id)}" data-status="${escapeAttr(statusTone)}">
      <div class="approval-request-title">
        <div>
          <strong>${escapeHtml(row.name || "이름 미입력")}</strong>
          <span>${escapeHtml(row.email || "이메일 없음")} · ${escapeHtml(row.org || "소속 미입력")} · ${escapeHtml(row.role || "직급 미입력")}</span>
        </div>
        <em data-status="${escapeAttr(status)}">${escapeHtml(getApprovalStatusLabel(status))}</em>
      </div>
      <div class="approval-decision-banner" data-status="${escapeAttr(status)}">
        <strong>${escapeHtml(status === "pending" ? "승인 전 확인" : status === "approved" ? "승인 완료" : "반려 처리됨")}</strong>
        <p>${escapeHtml(status === "pending"
          ? "소속, 직함, 근무지, 고용형태, 노무 기준을 확인한 뒤 승인하세요."
          : status === "approved"
            ? `이 직원은 앱 사용이 가능합니다.${approvedLabel ? ` 승인일: ${approvedLabel}` : ""}`
            : "보완 후 다시 승인할 수 있습니다. 반려 사유를 승인 메모에 남겨주세요.")}</p>
      </div>
      <div class="approval-edit-grid">
        ${field("org", "소속", row.org)}
        ${field("role", "직급", row.role)}
        ${field("name", "이름", row.name)}
        ${field("phone", "전화", row.phone)}
        ${field("email", "이메일", row.email, "email")}
        ${field("workplace", "근무지", row.workplace)}
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

async function updateApprovalRequest(id, action) {
  if (!supabaseClient || !authState.user) return;
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
  const { error } = await supabaseClient.from("profiles").update(payload).eq("id", id);
  if (error) {
    alert(`가입승인 처리 실패: ${error.message}`);
    return;
  }
  authState.selectedApprovalId = id;
  await loadApprovalRequests();
  await refreshApprovalNotification();
}

function applyProfileFields(selector, datasetKey) {
  state.profile = { ...defaultProfile, ...(state.profile || {}) };
  document.querySelectorAll(selector).forEach((field) => {
    const value = field.value.trim();
    state.profile[field.dataset[datasetKey]] = isPhoneField(field) ? formatPhoneNumber(value) : value;
    if (isPhoneField(field)) field.value = state.profile[field.dataset[datasetKey]];
  });
}

function saveProfileFromForm() {
  applyProfileFields("[data-profile-field]", "profileField");
  saveProfileChanges();
}

function saveSettingsProfileFromForm() {
  applyProfileFields("[data-settings-profile-field]", "settingsProfileField");
  state.profile.weeklyWorkHours = { ...(state.profile.weeklyWorkHours || {}) };
  document.querySelectorAll("[data-settings-work-hours-day]").forEach((field) => {
    const key = field.dataset.settingsWorkHoursDay;
    const value = field.value.trim();
    if (value) state.profile.weeklyWorkHours[key] = value;
    else delete state.profile.weeklyWorkHours[key];
  });
  saveManualSettingsFromForm();
  saveProfileChanges();
}

function saveProfileChanges({ stayInSettings = false } = {}) {
  if (authState.user && (!state.profile.approvalStatus || state.profile.approvalStatus === "draft")) state.profile.approvalStatus = "pending";
  const profileSource = `${state.profile.org || ""} ${state.profile.workplace || ""} ${state.profile.primaryWork || ""}`;
  if (/피트니스|fitness|beyond/i.test(profileSource)) {
    syncFitnessWritableEmployeeFromProfile();
  } else {
    state.selectedEmployeeId = "profile-user";
  }
  normalizeState();
  normalizeEmployeeLogRows(getSelectedLog());
  normalizeEmployeeLogRows(getEmployeeLogForDate(state.fitnessWritableEmployeeId));
  saveState();
  saveRemoteProfile();
  renderAll();
  if (authState.user && !isProfileApproved()) {
    switchView("auth");
    renderAuthStatus("가입신청 정보가 저장되었습니다. 대표 승인 후 업무일지를 사용할 수 있습니다.");
    return;
  }
  switchView(stayInSettings ? "settings" : state.selectedEmployeeId === "profile-user" ? "today" : "fitness-log");
}

function renderAuthStatus(message) {
  const status = document.getElementById("authStatus");
  const email = authState.user?.email || "";
  const readyText = authState.remoteReady ? "Supabase 연결 준비됨" : "Supabase 스크립트 로딩 필요";
  status.textContent = message || (email ? `${email} 로그인됨 · 원격 저장 켜짐` : `${readyText} · 로그인하면 원격 저장됩니다.`);
  document.getElementById("logoutButton").disabled = !authState.user;
  renderMainMenuAuthButton();
}

function isKnownLoggedInProfile() {
  return Boolean(authState.user);
}

function renderMainMenuAuthButton() {
  const button = document.querySelector('[data-menu-view="auth"]');
  const email = authState.user?.email || "";
  const isLoggedIn = isKnownLoggedInProfile();
  if (button) {
    button.textContent = isLoggedIn ? "로그아웃" : "로그인";
    button.dataset.menuAction = isLoggedIn ? "logout" : "login";
    button.setAttribute("aria-label", isLoggedIn ? `${email || "현재 계정"} 로그아웃` : "로그인 페이지 열기");
  }
  renderMainMenuVisibility();
}

function renderMainMenuVisibility() {
  const generalMenuViews = new Set(["management", "worklog", "attendance", "ai", "report", "settings", "auth"]);
  const showFullMenu = canAccessWorklogOverview();
  document.querySelectorAll("#mainMenuPopover [data-menu-view]").forEach((item) => {
    const view = item.dataset.menuView;
    item.hidden = !showFullMenu && !generalMenuViews.has(view);
  });
  renderApprovalNotification();
}

function clearAuthRuntimeState() {
  authState.session = null;
  authState.user = null;
  authState.pendingApprovalCount = 0;
  authState.approvalRows = [];
  authState.selectedApprovalId = "";
  authState.applyingRemote = false;
  clearTimeout(authState.saveTimer);
  authState.saveTimer = null;
  clearInterval(authState.approvalTimer);
  authState.approvalTimer = null;
}

function getAuthCredentials() {
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
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
  applyProfileFields("[data-profile-field]", "profileField");
  const profile = { ...defaultProfile, ...(state.profile || {}) };
  profile.email = credentials.email || profile.email || "";
  state.profile = profile;
  saveState();
  return {
    org: profile.org || defaultProfile.org,
    role: profile.role || defaultProfile.role,
    name: profile.name || "",
    nickname: profile.nickname || "",
    phone: profile.phone || "",
    email: profile.email || "",
    primaryWork: profile.primaryWork || "",
    secondaryWork: profile.secondaryWork || "",
    workplace: profile.workplace || "",
    employmentType: profile.employmentType || defaultProfile.employmentType,
    laborId: profile.laborId || "",
    address: profile.address || "",
    dailyWage: profile.dailyWage || "",
    hourlyWage: profile.hourlyWage || "",
    workHours: profile.workHours || defaultProfile.workHours,
    extra: profile.extra || "",
    strengths: profile.strengths || "",
    weaknesses: profile.weaknesses || "",
    developmentGoals: profile.developmentGoals || "",
  };
}

async function signUpWithSupabase() {
  const credentials = getAuthCredentials();
  if (!credentials || !supabaseClient) return;
  renderAuthStatus("가입 처리 중입니다...");
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
    renderAuthStatus(`가입 실패: ${error.message}`);
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
      renderAuthStatus("가입신청이 접수되었습니다. 대표 또는 권한자의 승인 후 사용할 수 있습니다.");
      return;
    }
    renderAuthStatus("가입 계정이 생성되었습니다. 이메일 확인 후 로그인하면 가입신청 정보가 대표 승인 목록에 저장됩니다.");
    return;
  }
  renderAuthStatus("가입신청이 접수되었습니다. 대표 또는 권한자의 승인 후 사용할 수 있습니다.");
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
  }
  renderApprovalNotification();
  renderAuthStatus("로그아웃되었습니다. 입력 내용은 이 기기에 계속 보관됩니다.");
  renderAll();
  if (activeView === "auth") renderProfileForm();
}

async function applySession(session) {
  authState.session = session;
  authState.user = session?.user || null;
  if (!authState.user) {
    clearAuthRuntimeState();
    renderApprovalNotification();
    renderAuthStatus();
    renderAll();
    return;
  }
  document.getElementById("authEmail").value = authState.user.email || "";
  state.profile.email = authState.user.email || state.profile.email || "";
  await loadRemoteProfile();
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
  await loadRemoteWorklogForActiveDate();
  await saveRemoteProfile();
  scheduleRemoteSave(0);
  startApprovalNotificationPolling();
  renderAll();
  renderAuthStatus();
  switchView(getInitialLandingView());
}

function scheduleRemoteSave(delay = 700) {
  if (!authState.user || authState.applyingRemote) return;
  clearTimeout(authState.saveTimer);
  authState.saveTimer = setTimeout(() => {
    saveRemoteSnapshot();
  }, delay);
}

function buildRemoteSnapshot() {
  const key = getActiveDateKey();
  return {
    selectedEmployeeId: state.selectedEmployeeId,
    selectedDateKey: key,
    profile: state.profile,
    employeeLogs: { [key]: state.employeeLogs?.[key] || {} },
    attendance: { [key]: state.attendance?.[key] || [] },
    reportTone: state.reportTone,
    backupSettings: state.backupSettings,
  };
}

async function saveRemoteSnapshot() {
  if (!supabaseClient || !authState.user) return;
  const key = getActiveDateKey();
  const { error } = await supabaseClient.from("worklog_states").upsert({
    user_id: authState.user.id,
    log_date: key,
    organization: state.profile?.org || "(주)방주",
    state: buildRemoteSnapshot(),
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
  if (!data?.state) return;
  authState.applyingRemote = true;
  state.selectedEmployeeId = data.state.selectedEmployeeId || state.selectedEmployeeId;
  state.profile = { ...state.profile, ...(data.state.profile || {}) };
  state.employeeLogs = { ...(state.employeeLogs || {}), ...(data.state.employeeLogs || {}) };
  state.attendance = { ...(state.attendance || {}), ...(data.state.attendance || {}) };
  state.reportTone = data.state.reportTone || state.reportTone;
  state.backupSettings = { ...(state.backupSettings || {}), ...(data.state.backupSettings || {}) };
  normalizeState();
  localStorage.setItem(storageKey, JSON.stringify(state));
  authState.applyingRemote = false;
  renderAll();
  renderAuthStatus();
}

function profileToRemoteRow() {
  return {
    id: authState.user.id,
    org: state.profile.org,
    role: state.profile.role,
    name: state.profile.name,
    phone: formatPhoneNumber(state.profile.phone),
    email: state.profile.email || authState.user.email || "",
    primary_work: state.profile.primaryWork,
    secondary_work: state.profile.secondaryWork,
    workplace: state.profile.workplace,
    employment_type: state.profile.employmentType,
    labor_id: state.profile.laborId,
    address: state.profile.address,
    daily_wage: state.profile.dailyWage || null,
    hourly_wage: state.profile.hourlyWage || null,
    work_hours: state.profile.workHours,
    weekly_work_hours: state.profile.weeklyWorkHours || {},
    extra: state.profile.extra,
    strengths: state.profile.strengths,
    weaknesses: state.profile.weaknesses,
    development_goals: state.profile.developmentGoals,
    approval_status: state.profile.approvalStatus || "pending",
    approval_note: state.profile.approvalNote || "",
    approved_by: state.profile.approvedBy || null,
    approved_at: state.profile.approvedAt || null,
    updated_at: new Date().toISOString(),
  };
}

function remoteRowToProfile(row) {
  return {
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
  };
}

async function saveRemoteProfile() {
  if (!supabaseClient || !authState.user) return;
  const { error } = await supabaseClient.from("profiles").upsert(profileToRemoteRow());
  if (error) renderAuthStatus(`프로필 원격 저장 대기: ${error.message}`);
}

async function loadRemoteProfile() {
  if (!supabaseClient || !authState.user) return;
  const { data, error } = await supabaseClient.from("profiles").select("*").eq("id", authState.user.id).maybeSingle();
  if (error) {
    renderAuthStatus(`프로필 불러오기 대기: ${error.message}`);
    return;
  }
  if (!data) return;
  state.profile = { ...defaultProfile, ...state.profile, ...remoteRowToProfile(data) };
  if (state.profile.workHours === "12:00-19:00") state.profile.workHours = defaultProfile.workHours;
  localStorage.setItem(storageKey, JSON.stringify(state));
  renderProfileForm();
}

async function initializeAuth() {
  if (!supabaseClient) {
    renderAuthStatus("Supabase 스크립트를 불러오지 못했습니다. 로컬 저장으로 동작합니다.");
    return;
  }
  const { data } = await supabaseClient.auth.getSession();
  await applySession(data.session);
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    applySession(session);
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
  return Boolean(target?.closest?.(".day-task-panel input, .day-task-panel textarea, .day-task-panel select, .day-schedule-panel input, .day-schedule-panel textarea, .day-schedule-panel select"));
}

function setupMobileDayFocus() {
  setupMobileFocusOpenButtons();
  setupMobileFocusCloseButtons();
  applyMobileDayFocusMode();
}

function setupMobileFocusOpenButtons() {
  document.querySelectorAll("[data-mobile-focus-open]").forEach((button) => {
    button.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      setMobileDayFocusMode(button.dataset.mobileFocusOpen || "split");
    };
  });
}

function setupSplitEditGate(node, mode) {
  node.addEventListener("pointerdown", (event) => {
    if (!isMobilePhoneFocusLayout() || mobileDayFocusMode !== "split") return;
    const shouldFocus = Boolean(event.target.closest("[data-mobile-focus-open]"));
    if (!shouldFocus) return;
    event.preventDefault();
    setMobileDayFocusMode(mode);
  }, true);
  node.addEventListener("click", (event) => {
    if (!isMobilePhoneFocusLayout() || mobileDayFocusMode !== "split") return;
    const shouldFocus = Boolean(event.target.closest("[data-mobile-focus-open]"));
    if (!shouldFocus) return;
    event.preventDefault();
    event.stopPropagation();
  }, true);
}

function setupMobileFocusCloseButtons() {
  document.querySelectorAll("[data-mobile-focus-close]").forEach((button) => {
    button.onclick = (event) => {
      event.stopPropagation();
      resetMobileDayFocusToSplit({ blur: true });
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
    if (!isMobilePhoneFocusLayout()) resetMobileDayFocusToSplit({ blur: false });
    else applyMobileDayFocusMode();
  });
}

function setMobileDayFocusMode(mode) {
  mobileDayFocusMode = isMobilePhoneFocusLayout() ? mode : "split";
  applyMobileDayFocusMode();
}

function applyMobileDayFocusMode() {
  const main = document.getElementById("worklogMain");
  const mode = isMobilePhoneFocusLayout() ? mobileDayFocusMode : "split";
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
  renderDateNav();
  renderTodayContext();
  renderReport();
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
  if (page?.type === "employee" && page.id !== state.selectedEmployeeId) {
    state.selectedEmployeeId = page.id;
    log = getSelectedLog();
  }
  syncFitnessOpsFromSchedule(log);
  const title = document.getElementById("fitnessWorklogDate");
  if (title) title.textContent = formatCompactDate(getActiveDateKey());
  const input = document.getElementById("fitnessDateInput");
  if (input) input.value = getActiveDateKey();
  const todayButton = document.getElementById("fitnessTodayButton");
  if (todayButton) {
    const isToday = getActiveDateKey() === todayKey;
    todayButton.hidden = false;
    todayButton.disabled = isToday;
    todayButton.classList.toggle("is-current-date", isToday);
    todayButton.setAttribute("aria-disabled", String(isToday));
  }
  const unitButton = document.getElementById("fitnessScheduleUnitButton");
  if (unitButton) unitButton.textContent = log.scheduleUnit === "60" ? "1시간" : "30분";
  renderFitnessLogPager();
  renderFitnessCenterDaily();
  renderFitnessCoaching();
  const isCenter = page?.type === "center";
  document.getElementById("fitnessCenterDailyPanel").hidden = !isCenter;
  document.querySelector(".fitness-log-task-panel")?.toggleAttribute("hidden", isCenter);
  document.querySelector(".fitness-log-schedule-panel")?.toggleAttribute("hidden", isCenter);
  document.querySelector(".fitness-ops-section")?.toggleAttribute("hidden", isCenter);
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
  const readOnly = !isCurrentFitnessLogEditable();
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
  const generalView = document.getElementById("view-today");
  const isGeneralWorklog = ["bangju-log", "beyond-log", "today"].includes(viewName);
  if (generalView) {
    const readOnly = isGeneralWorklog && !canEditCurrentWorklog(viewName);
    generalView.classList.toggle("is-readonly", readOnly);
    generalView.dataset.worklogPermission = readOnly ? "readonly" : "editable";
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
      #employeeReport,
      #employeeMemo
    `).forEach((control) => {
      control.disabled = readOnly;
      control.setAttribute("aria-disabled", String(readOnly));
    });
  }
  if (viewName === "fitness-log") applyFitnessLogPermissionState();
}

function renderFitnessCenterDaily() {
  const panel = document.getElementById("fitnessCenterDailyPanel");
  if (!panel) return;
  renderDagymOpsFields();
  renderFitnessCenterMonthNav();
  const centerMonth = getFitnessCenterMonth();
  const employeesForCenter = getFitnessEmployees();
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
    summary.consultation += numberValue(row.ops.consultation);
    summary.outbound += numberValue(row.ops.outbound);
    summary.workMinutes += row.workMinutes;
    summary.recordedDays += row.recordedDays;
    return summary;
  }, { pt: 0, ptPaid: 0, ptFree: 0, ptOther: 0, new: 0, renewal: 0, consultation: 0, outbound: 0, workMinutes: 0, recordedDays: 0 });

  const summaryGrid = document.getElementById("fitnessCenterSummaryGrid");
  if (summaryGrid) {
    summaryGrid.innerHTML = [
      ["기준월", formatCenterMonthLabel(centerMonth)],
      ["기록일", `${total.recordedDays}일`],
      ["총 근무", formatWorkDuration(total.workMinutes)],
      ["유료 PT", `${total.ptPaid}건`],
      ["무료 PT", `${total.ptFree}건`],
      ["신규", `${total.new}건`],
      ["재등록", `${total.renewal}건`],
      ["상담", `${total.consultation}건`],
      ["아웃바운드", `${total.outbound}건`],
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
        <td>${escapeHtml(row.attendanceStatus)}</td>
        <td>${escapeHtml(row.breakSummary || "-")}</td>
        <td>${row.paidPtTotal || ""}</td>
        <td>${row.freePtTotal || ""}</td>
        <td>${escapeHtml(row.ops.ptOther || "")}</td>
        <td>${escapeHtml(row.ops.customerNew || "")}</td>
        <td>${escapeHtml(row.ops.customerRenewal || "")}</td>
        <td>${escapeHtml(row.ops.consultation || "")}</td>
        <td>${escapeHtml(row.ops.outbound || "")}</td>
        <td>${escapeHtml(row.ops.specialReport || row.ops.shiftNote || "")}</td>
      </tr>
    `).join("");
  }

  const foot = document.getElementById("fitnessCenterDailyFoot");
  if (foot) {
    foot.innerHTML = `
      <tr>
        <td colspan="8">합계</td>
        <td>${total.ptPaid}</td>
        <td>${total.ptFree}</td>
        <td>${total.ptOther}</td>
        <td>${total.new}</td>
        <td>${total.renewal}</td>
        <td>${total.consultation}</td>
        <td>${total.outbound}</td>
        <td></td>
      </tr>
    `;
  }

  const record = document.getElementById("fitnessCenterTodayRecord");
  if (record) {
    const notes = rows.flatMap((row) => row.notes);
    record.textContent = notes.length ? notes.slice(0, 12).join(" / ") : "선택 월에 등록된 특이사항이 없습니다.";
  }
  renderFitnessCenterCoaching(total, rows);
}

function getFitnessCenterMonth() {
  if (!/^\d{4}-\d{2}$/.test(String(state.fitnessCenterMonth || ""))) {
    state.fitnessCenterMonth = getActiveDateKey().slice(0, 7);
  }
  return state.fitnessCenterMonth;
}

function setFitnessCenterMonth(month) {
  if (!/^\d{4}-\d{2}$/.test(String(month || ""))) return;
  state.fitnessCenterMonth = month;
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
    const log = state.employeeLogs?.[dateKey]?.[employee.id];
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
    ptTotal += paid + free;
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

function renderDagymOpsFields() {
  state.dagymOps = { ...createDagymOps(), ...(state.dagymOps || {}) };
  document.querySelectorAll("[data-dagym-field]").forEach((field) => {
    field.value = state.dagymOps[field.dataset.dagymField] || "";
  });
  const importText = document.getElementById("dagymImportText");
  if (importText) importText.value = state.dagymOps.importText || "";
}

function renderFitnessCenterCoaching(total, rows) {
  const node = document.getElementById("fitnessCenterCoachingList");
  if (!node) return;
  const dagym = { ...createDagymOps(), ...(state.dagymOps || {}) };
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

function getFitnessCoachingMessages() {
  const page = getCurrentFitnessLogPage();
  const log = page?.type === "employee" ? getSelectedLog() : getEmployeeLogForDate(state.fitnessWritableEmployeeId);
  const ops = { ...createFitnessOps(), ...(log.fitnessOps || {}) };
  const dagym = { ...createDagymOps(), ...(state.dagymOps || {}) };
  const employee = page?.employee || employees.find((item) => item.id === state.fitnessWritableEmployeeId) || getSelectedEmployee();
  const tasks = getWorklogTaskRefs(log).map((ref) => ref.task).filter(isActiveTask);
  const pending = tasks.filter((task) => !task.done && !["완료", "취소"].includes(task.status));
  const nextEntry = getNextScheduleEntry(log);
  const ptTotal = ["ptRegular", "ptFree", "ptOther"].reduce((sum, key) => sum + numberValue(ops[key]), 0);
  const salesAction = ["customerNew", "customerRenewal", "consultation", "outbound", "outsideSales"].reduce((sum, key) => sum + numberValue(ops[key]), 0);
  const visits = numberValue(dagym.visits);
  const expiring = numberValue(dagym.expiring);
  const messages = [
    ["우선업무", pending.length ? `${getEmployeeOwnLabel(employee)}님은 미완료 ${pending.length}건을 먼저 정리하고, 가장 매출과 회원경험에 가까운 업무 1건을 상단에 두세요.` : "우선업무 흐름이 안정적입니다. 다음 일정 전까지 완료 기록을 남기면 코칭 정확도가 올라갑니다."],
    ["시간관리", nextEntry ? `다음 일정은 ${nextEntry.time} ${getScheduleEntryText(nextEntry)}입니다. 시작 전 준비물과 고객 응대 포인트를 5분 전에 확인하세요.` : "다음 일정이 비어 있습니다. 센터관리, 상담 후보 확인, 시설 점검 중 하나를 시간표에 배치하세요."],
    ["센터운영", visits ? `오늘 출석 ${visits}명 기준으로 상담/재등록 행동 ${salesAction}건입니다. 출석 대비 3% 이상을 상담 기록으로 남기는 것을 권장합니다.` : "다짐 출석/매출 자료를 입력하면 운영 코칭이 더 구체화됩니다."],
    ["영업", expiring ? `만료 예정 ${expiring}명을 우선 확인하세요. PT ${ptTotal}건 이후 재등록 가능 회원에게 당일 안내를 연결하세요.` : "만료 예정자가 없거나 미입력 상태입니다. 상담, 아웃바운드, 재등록 후보를 기록해 매출 루프를 만드세요."],
  ];
  return messages;
}

function renderFitnessCoaching() {
  const messages = getFitnessCoachingMessages();
  const ticker = document.getElementById("fitnessCoachingTickerText");
  if (ticker) {
    const tickerText = messages.map(([title, text]) => `${title}: ${text}`).join("   ·   ");
    ticker.textContent = tickerText;
    ticker.dataset.tickerText = tickerText;
  }
  const detail = document.getElementById("fitnessCoachingDetailList");
  if (detail) {
    detail.innerHTML = messages.map(([title, text]) => `<article><b>${escapeHtml(title)}</b><p>${escapeHtml(text)}</p></article>`).join("");
  }
}

function openFitnessCoachingSheet() {
  renderFitnessCoaching();
  const backdrop = document.getElementById("fitnessCoachingBackdrop");
  const sheet = document.getElementById("fitnessCoachingSheet");
  if (!backdrop || !sheet) return;
  backdrop.hidden = false;
  sheet.hidden = false;
  requestAnimationFrame(() => sheet.classList.add("is-open"));
}

function closeFitnessCoachingSheet() {
  const backdrop = document.getElementById("fitnessCoachingBackdrop");
  const sheet = document.getElementById("fitnessCoachingSheet");
  sheet?.classList.remove("is-open");
  window.setTimeout(() => {
    if (backdrop) backdrop.hidden = true;
    if (sheet) sheet.hidden = true;
  }, 160);
}

function importDagymText() {
  const text = document.getElementById("dagymImportText")?.value || "";
  state.dagymOps = { ...createDagymOps(), ...(state.dagymOps || {}), importText: text };
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
    if (match) state.dagymOps[key] = match[1].replaceAll(",", "");
  });
  saveState({ fastSave: true });
  renderFitnessCenterDaily();
}

function clearDagymOps() {
  state.dagymOps = createDagymOps();
  saveState();
  renderFitnessCenterDaily();
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
  if (pulseText) {
    pulseText.textContent = `AI 코칭 · 오늘 실행 ${completed}/${tasks.length} · 다음 일정 ${nextEntry ? `${nextEntry.time} ${getScheduleEntryText(nextEntry)}` : "없음"} · 미완료 ${pending} · AI 운영 신호 ${pending ? "추적" : "정상"} · 공통일정과 동료업무를 함께 확인하세요`;
  }
  const unitButton = document.getElementById("scheduleUnitButton");
  if (unitButton) unitButton.textContent = log.scheduleUnit === "60" ? "1시간" : "30분";
  applyTodayPageMode();
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
  const weekStart = parseDateKey(commonWeekKey);
  const weekEnd = parseDateKey(commonWeekKey);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weeklyReview = weekRange.map((key) => {
    const dayLog = state.employeeLogs?.[key]?.[selectedEmployee.id];
    const tasks = (dayLog?.tasks || []).filter(isActiveTask).slice(0, 4);
    const scheduleCount = (dayLog?.schedule || []).filter((item) => getScheduleEntryText(item)).length;
    const done = tasks.filter((task) => task.done || task.status === "완료").length;
    return { key, tasks, scheduleCount, done };
  });
  common.innerHTML = `
    <section class="common-week-header">
      <div>
        <span>Beyond Work Weekly</span>
        <strong>주간 계획 (${escapeHtml(formatCommonWeekRange(commonWeekKey))})</strong>
      </div>
      <button type="button" id="commonWeekTodayButton">오늘 업무일지</button>
    </section>
    <section class="common-week-days" aria-label="주간 업무 요약">
      ${weeklyReview.map((day) => `
        <button type="button" class="common-week-day ${day.key === dateKey ? "is-selected" : ""}" data-common-week-date="${escapeAttr(day.key)}">
          <strong>${escapeHtml(formatKoreanDate(day.key).replace(/^\d{4}\./, ""))}</strong>
          <span>${day.done}/${day.tasks.length || 0} 완료 · 일정 ${day.scheduleCount}</span>
          <small>${day.tasks.length ? day.tasks.map((task) => `${escapeHtml(task.priority || "?")}. ${escapeHtml(task.text || "")}`).join("<br>") : "일간 페이지에 업무를 입력하세요."}</small>
        </button>
      `).join("")}
    </section>
    <section class="common-week-brief">
      <b>주간 운영 메모</b>
      <div>
        <p>이 페이지는 Beyond Work의 주간섹션처럼 日~土 업무 흐름을 한 화면에서 확인하는 용도입니다.</p>
        <p>각 요일을 누르면 해당 날짜의 방주/비욘드 업무일지로 이동합니다.</p>
      </div>
    </section>
  `;
  common.querySelector("#commonWeekTodayButton")?.addEventListener("click", () => setTodayPageMode("daily"));
  common.querySelectorAll("[data-common-week-date]").forEach((button) => {
    button.addEventListener("click", () => {
      setSelectedDateKey(button.dataset.commonWeekDate);
      setTodayPageMode("daily");
    });
  });

  const siteKey = selectedEmployee.org?.split(" / ").at(-1) || selectedEmployee.org || "";
  const coworkerRows = getEmployeeOptions()
    .filter((employee) => employee.id !== selectedEmployee.id)
    .filter((employee) => !siteKey || employee.org?.includes(siteKey) || selectedEmployee.org?.includes(employee.org?.split(" / ").at(-1) || ""))
    .slice(0, 8)
    .map((employee) => {
      const dayLog = state.employeeLogs?.[dateKey]?.[employee.id] || createEmployeeLog(employee);
      const tasks = (dayLog.tasks || []).filter(isActiveTask).slice(0, 3);
      const completed = tasks.filter((task) => task.done || task.status === "완료").length;
      return { employee, tasks, completed };
    });
  coworkers.innerHTML = coworkerRows.length
    ? coworkerRows.map((row) => `
      <article class="coworker-worklog-item">
        <header><b>${escapeHtml(getEmployeeAdminLabel(row.employee))}</b><span>${row.completed}/${row.tasks.length}</span></header>
        ${renderSharedTaskList(row.tasks.map((task) => ({ text: task.text || task.status || "업무" })), "공유된 업무가 없습니다.")}
      </article>
    `).join("")
    : `<p class="shared-empty">같은 사업장 동료 업무일지가 아직 없습니다.</p>`;
}

function renderSharedTaskList(items, emptyText) {
  if (!items.length) return `<p class="shared-empty">${escapeHtml(emptyText)}</p>`;
  return `<ul>${items.map((item) => `<li>${item.dateKey ? `<span>${escapeHtml(formatShortDate(item.dateKey))}</span>` : ""}${escapeHtml(item.text || "")}</li>`).join("")}</ul>`;
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

function renderWorklogTaskBoard(log) {
  const board = document.getElementById("worklogTaskBoard");
  board.innerHTML = "";
  const list = document.createElement("section");
  list.className = "worklog-task-list";
  getWorklogTaskRefs(log).forEach((ref) => {
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
  const refs = getWorklogTaskRefs(log);
  const activeCount = refs.filter((ref) => isActiveTask(ref.task)).length;
  const visibleCount = Math.min(refs.length, Math.max(3, activeCount + 1));
  const visibleRefs = refs.slice(0, visibleCount);
  visibleRefs.forEach((ref) => {
    list.appendChild(renderWorklogTaskRow(ref, log));
  });
  board.appendChild(list);
}

function ensureFitnessTaskRowsVisible(log) {
  const board = document.getElementById("fitnessTaskBoard");
  const list = board?.querySelector(".fitness-task-list");
  if (!list) return;
  const refs = getWorklogTaskRefs(log);
  const currentCount = list.querySelectorAll(".worklog-task-row").length;
  const activeCount = refs.filter((ref) => isActiveTask(ref.task)).length;
  const targetCount = Math.min(refs.length, Math.max(3, activeCount + 1));
  if (targetCount <= currentCount) return;
  refs.slice(currentCount, targetCount).forEach((ref) => {
    list.appendChild(renderWorklogTaskRow(ref, log));
  });
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
  const refs = (log.tasks || []).map((task, index) => ({ task, index, log, sourceDateKey: getActiveDateKey(), isPostponedFromOtherDate: false }));
  Object.entries(state.employeeLogs || {}).forEach(([dateKey, logsByEmployee]) => {
    if (dateKey === getActiveDateKey()) return;
    const sourceLog = logsByEmployee?.[getSelectedEmployee().id];
    (sourceLog?.tasks || []).forEach((task, index) => {
      if (task.status === "연기" && task.postponeDate === getActiveDateKey()) {
        refs.push({ task, index, log: sourceLog, sourceDateKey: dateKey, isPostponedFromOtherDate: true });
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

function isActiveTask(task) {
  return Boolean(task.text?.trim() || task.done || !["예정", "미완료"].includes(task.status || "미완료"));
}

function getPrioritySortValue(priority = "?") {
  return { A: 1, B: 2, C: 3, "?": 4, 연기: 5, 취소: 6 }[priority] || 7;
}

function renderWorklogTaskRow(ref, currentLog) {
  const { task, index, log, isPostponedFromOtherDate, sourceDateKey } = ref;
  const row = document.createElement("div");
  const marker = getWorklogTaskMarker(task);
  row.className = `worklog-task-row task-row priority-${String(task.priority || "?").toLowerCase()} marker-${marker} ${task.done ? "done" : ""} ${isPostponedFromOtherDate ? "is-postponed-in" : ""}`;
  row.innerHTML = `
    <button class="task-cycle" type="button" aria-label="상태 변경">${getWorklogTaskMarkerLabel(task)}</button>
    <div class="task-status-cell">${renderTaskMetaControl(task)}</div>
    <div class="task-text-cell">
      <input class="task-text-input" type="text" value="${escapeAttr(task.text)}" placeholder="업무 내용" aria-label="주요업무" />
      ${renderWorklogTaskTags(getWorklogTaskTags(task))}
      ${isPostponedFromOtherDate ? `<span class="task-origin-tag">${escapeHtml(formatShortDate(sourceDateKey))} 이월</span>` : ""}
    </div>
    <button class="task-delete" type="button" aria-label="업무 삭제">×</button>
  `;
  row.querySelector(".task-cycle").onclick = () => {
    if (!guardWorklogEdit()) return;
    cycleWorklogTaskStatus(task);
    syncWorklogTaskTimeHintToSchedule(task, log);
    saveState();
    renderEntries();
    showTaskStatusGuide(taskStatusGuideLabels[task.status] || task.status || "미완료");
  };
  bindTaskMetaControl(row, task, log);
  row.querySelector(".task-text-input").oninput = (event) => {
    if (!guardWorklogEdit()) return;
    task.text = event.target.value;
    promptAttendanceBeforeWorklogInput(log, task.text);
    syncWorklogTaskTimeHintToSchedule(task, log);
    saveState({ fastSave: true });
    updateTaskRowTags(row, task);
    renderWorklogSummary(currentLog);
    renderWorklogAppointments(currentLog);
    renderFitnessAppointments(currentLog);
    if (row.closest("#fitnessTaskBoard")) ensureFitnessTaskRowsVisible(log);
    renderTodayContext();
    renderReport();
  };
  row.querySelector(".task-delete").onclick = () => {
    if (!guardWorklogEdit()) return;
    removeLinkedSchedule(task, log);
    log.tasks.splice(index, 1);
    saveState();
    renderEntries();
  };
  return row;
}

function renderTaskMetaControl(task) {
  if (task.status === "위임") {
    return `<input class="delegate-input" type="text" value="${escapeAttr(task.delegate || "")}" placeholder="위임자" aria-label="위임받은 사람" />`;
  }
  if (task.status === "연기") {
    const label = task.postponeDate ? formatShortDate(task.postponeDate) : "미정";
    return `<button class="postpone-date-button" type="button" aria-label="연기 날짜 선택">${escapeHtml(label)}</button>`;
  }
  return `
    <select class="priority-select" aria-label="중요도">
      ${taskPriorityOptions.map((value) => `<option value="${escapeAttr(value)}" ${getPriorityValue(task) === value ? "selected" : ""}>${value}</option>`).join("")}
    </select>
  `;
}

function bindTaskMetaControl(row, task, log) {
  const delegateInput = row.querySelector(".delegate-input");
  if (delegateInput) {
    delegateInput.oninput = () => {
      if (!guardWorklogEdit()) return;
      task.delegate = delegateInput.value;
      saveState({ fastSave: true });
    };
    return;
  }
  const postponeButton = row.querySelector(".postpone-date-button");
  if (postponeButton) {
    postponeButton.onclick = (event) => {
      event.stopPropagation();
      if (!guardWorklogEdit()) return;
      openPostponeCalendar(task);
    };
    return;
  }
  const prioritySelect = row.querySelector(".priority-select");
  if (prioritySelect) {
    prioritySelect.onchange = (event) => {
      if (!guardWorklogEdit()) return;
      updateWorklogTaskPriority(task, event.target.value);
      syncWorklogTaskTimeHintToSchedule(task, log);
      saveState();
      renderEntries();
    };
  }
}

function getPriorityValue(task) {
  if (["취소", "연기"].includes(task.status)) return task.status;
  return task.priority || "?";
}

function updateWorklogTaskPriority(task, value) {
  if (["취소", "연기"].includes(value)) {
    task.status = value;
    task.done = false;
    task.priority = value;
    return;
  }
  task.priority = value;
  if (["취소", "연기"].includes(task.status)) task.status = "미완료";
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
  const current = task.done ? "완료" : ["예정", "진행"].includes(task.status) ? "미완료" : task.status || "미완료";
  const next = taskStatusCycle[(taskStatusCycle.indexOf(current) + 1) % taskStatusCycle.length] || "미완료";
  task.status = next;
  task.done = next === "완료";
  if (next !== "위임") task.delegate ||= "";
  if (next !== "연기") task.postponeDate ||= "";
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
  if (/pt|피티|수업|운동지도/i.test(text)) return "PT";
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
  return items
    .filter((item) => String(item.text || "").trim())
    .map((item) => `(${formatScheduleTypeLabel(item.type || "업무")}) ${item.text.trim()}`)
    .join(" / ");
}

function syncScheduleEntryText(entry) {
  const items = Array.isArray(entry.items) ? entry.items : [];
  entry.text = items
    .filter((item) => String(item.text || "").trim())
    .map((item) => `(${formatScheduleTypeLabel(item.type || "업무")}) ${item.text.trim()}`)
    .join(" / ");
}

function createScheduleItem(text = "", type = "") {
  return { type: type || inferScheduleType(text), text };
}

function formatScheduleTypeLabel(type = "업무") {
  const normalized = normalizeScheduleType(type);
  if (normalized === "무료PT") return "무료P/T";
  if (normalized === "PT") return "P/T";
  return normalized;
}

function formatScheduleItemInline(item) {
  const text = String(item?.text || "").trim();
  if (!text) return "";
  return `(${formatScheduleTypeLabel(item.type || "업무")})${text}`;
}

function renderScheduleTypeOptions(selected = "업무") {
  const normalizedSelected = normalizeScheduleType(selected);
  return scheduleTypeOptions.map((value) => `<option value="${escapeAttr(value)}" ${value === normalizedSelected ? "selected" : ""}>${escapeHtml(formatScheduleTypeLabel(value))}</option>`).join("");
}

function renderWorklogAppointments(log) {
  normalizeWorklogSchedule(log);
  const list = document.getElementById("worklogAppointmentList");
  list.innerHTML = "";
  (log.schedule || []).forEach((entry, index) => {
    if (index > 0 && log.schedule[index - 1]?.mergeDown) return;
    list.appendChild(renderAppointmentRow(entry, log, "worklog"));
  });
}

function renderFitnessAppointments(log) {
  normalizeWorklogSchedule(log);
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
  row.className = `appointment-row multi-appointment-row fitness-appointment-row ${value.trim() ? "is-filled" : ""} ${isCurrentScheduleSlot(entry, log) ? "is-current" : ""}`;
  row.innerHTML = `
    <span class="appointment-time">${escapeHtml(entry.time)}</span>
    <button class="fitness-appointment-summary" type="button" aria-label="${escapeAttr(entry.time)} 일정 편집">
      ${filledItems.length ? filledItems.map((item) => `<span>${escapeHtml(formatScheduleItemInline(item))}</span>`).join("") : `<span class="empty">업무 추가</span>`}
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
      items.splice(itemIndex, 1);
      if (!items.length) items.push(createScheduleItem());
      syncScheduleEntryText(entry);
      saveState();
      renderWorklogAppointments(log);
      renderFitnessAppointments(log);
      renderReport();
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
  if (!isCurrentFitnessLogEditable()) return;
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
      const index = Number(button.dataset.removeScheduleItem);
      items.splice(index, 1);
      if (!items.length) items.push(createScheduleItem());
      syncScheduleEntryText(entry);
      saveState();
      rerenderScheduleAfterFitnessEdit(fitnessScheduleEditorState.log);
      renderFitnessScheduleEditor();
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
  if (!isCurrentFitnessLogEditable()) return;
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

function normalizeWorklogSchedule(log) {
  const byTime = new Map((log.schedule || []).map((entry) => [entry.time, entry]));
  log.schedule = getWorklogScheduleSlots(log).map((time) => {
    const entry = byTime.get(time) || { time, text: "", status: "예정", mergeDown: false, items: [createScheduleItem()] };
    entry.time = time;
    normalizeScheduleEntryItems(entry);
    entry.status ||= "예정";
    entry.mergeDown ||= false;
    return entry;
  });
}

function getWorklogScheduleSlots(log) {
  const unit = log?.scheduleUnit === "60" ? 60 : 30;
  const baseTimes = getScheduleTimes(getEmployeeWorkHours(log?.employeeId));
  const scheduleTimes = (log?.schedule || [])
    .filter((entry) => getScheduleEntryText(entry))
    .map((entry) => entry.time)
    .filter(Boolean);
  const taskTimes = (log?.tasks || []).map((task) => extractWorklogTaskTimeHint(task.text)?.slot).filter(Boolean);
  const allTimes = [...baseTimes, ...scheduleTimes, ...taskTimes];
  if (!allTimes.length) return [];
  let start = 8 * 60;
  let end = 18 * 60;
  allTimes.forEach((time) => {
    const minutes = timeToMinutes(time);
    if (!Number.isFinite(minutes)) return;
    start = Math.min(start, Math.floor(minutes / unit) * unit);
    end = Math.max(end, Math.floor(minutes / unit) * unit + unit);
  });
  const slots = [];
  for (let minute = start; minute <= end; minute += unit) {
    slots.push(minutesToTime(minute));
  }
  return slots;
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
  const memoState = ops.shiftNote || ops.specialReport ? "메모 있음" : "메모 없음";
  button.innerHTML = `
    <span class="ops-summary-title">업무요약</span>
    <span class="ops-summary-metric"><b>유료PT</b><strong>${paidPtTotal}</strong></span>
    <span class="ops-summary-metric"><b>무료PT</b><strong>${freePtTotal}</strong></span>
    <span class="ops-summary-metric"><b>상담</b><strong>${numberValue(ops.consultation)}</strong></span>
    <span class="ops-summary-metric"><b>계약</b><strong>${contractTotal}</strong></span>
    <span class="ops-summary-note">${memoState}</span>
  `;
  button.setAttribute("aria-label", `업무요약. 유료 PT ${paidPtTotal}건, 무료 PT ${freePtTotal}건, 상담 ${numberValue(ops.consultation)}건, 계약 ${contractTotal}건, 홍보 마케팅 ${marketingTotal}건, ${memoState}`);
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
  if (normalizedType === "무료PT" || normalizedType === "PT" || /pt|p\/t|피티|수업|운동지도/i.test(source)) {
    if (normalizedType === "무료PT" || /무료|체험|서비스|무상/.test(source)) totals.ptFree += count;
    else if (/기타|보강|대체/.test(source)) totals.ptOther += count;
    else totals.ptRegular += count;
  }
  if (/신규|신입|첫등록|등록상담/.test(source)) totals.customerNew += count;
  if (/재등록|재가입|연장|갱신/.test(source)) totals.customerRenewal += count;
  if (/일일권|1일권|데이패스|day\s*pass/i.test(source)) totals.dayPass += count;
  if (normalizedType === "고객/상담" || /상담|문의|회원관리|고객관리|인바운드/.test(source)) {
    if (/상담|문의|인바운드|등록상담/.test(source)) totals.consultation += count;
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
    `홍보/마케팅: 홍보 ${ops.outbound || 0}, 마케팅 ${ops.outsideSales || 0}, 합계 ${marketingTotal}`,
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

function getAttendanceStatusForLog(employee, log = getEmployeeLogForDate(employee.id)) {
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
  const todayMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const activeDate = getActiveDateKey();
  const [start] = String(employee.workHours || getEmployeeWorkHours(employee.id)).split("-");
  const startMinutes = timeToMinutes(start);
  if (activeDate < todayKey || (activeDate === todayKey && Number.isFinite(startMinutes) && todayMinutes > startMinutes + 30)) return "결석";
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
  renderWorkHistorySummary();
  if (!list) return;
  const employeeId = getOwnLaborEmployeeId();
  const employee = getOwnLaborEmployee();
  const labor = buildMonthlyLaborSummary(employeeId, employee);
  const ledger = buildLaborCostLedger(labor, employee);
  const payroll = buildPayrollStatement(labor, employee, ledger);
  const leaderLaborOverview = canAccessWorklogOverview() ? renderLeaderLaborOverviewMarkup() : "";
  const companyLaborLedgers = canAccessWorklogOverview() ? renderCompanyLaborLedgersMarkup() : "";
  list.innerHTML = `
    ${leaderLaborOverview}
    ${renderPayrollStatement(payroll)}
    ${companyLaborLedgers}
    <section class="labor-cost-ledger-card" id="laborCostLedger">
      <header>
        <div>
          <span>Labor Cost Ledger</span>
          <h3>${escapeHtml(ledger.title)}</h3>
          <p>${escapeHtml(ledger.site)} · ${escapeHtml(ledger.employeeLabel)}</p>
        </div>
        <button type="button" id="copyLaborCostLedgerButton">대장 복사</button>
      </header>
      <div class="labor-cost-ledger-meta">
        <span><b>사업장</b><strong>${escapeHtml(ledger.site)}</strong></span>
        <span><b>대상월</b><strong>${escapeHtml(ledger.monthLabel)}</strong></span>
        <span><b>출역일수</b><strong>${escapeHtml(String(ledger.workDays))}일</strong></span>
        <span><b>총근무</b><strong>${escapeHtml(formatMinutesAsHours(ledger.actualMinutes))}</strong></span>
        <span><b>임금단가</b><strong>${escapeHtml(ledger.wageLabel)}</strong></span>
        <span><b>총금액</b><strong>${escapeHtml(ledger.totalPayLabel)}</strong></span>
      </div>
      <div class="labor-cost-ledger-wrap">
        <table class="labor-cost-ledger-table" aria-label="노무비 지급 대장">
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
            <tr>
              <td>${escapeHtml(ledger.employmentType)}</td>
              <td>${escapeHtml(ledger.name)}</td>
              <td>${escapeHtml(ledger.laborId)}</td>
              <td>${escapeHtml(ledger.address)}</td>
              ${ledger.dayCells.map((cell) => `<td class="${cell.worked ? "is-worked" : ""}">${escapeHtml(cell.label)}</td>`).join("")}
              <td>${escapeHtml(String(ledger.workDays))}</td>
              <td>${escapeHtml(ledger.wageLabel)}</td>
              <td>${escapeHtml(ledger.totalPayLabel)}</td>
              <td>${escapeHtml(ledger.confirmLabel)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
    <section class="labor-register-card" id="laborRegister">
      <header>
        <div>
          <span>Personal Labor Register</span>
          <h3>${escapeHtml(labor.monthLabel)} 근무시간 현황</h3>
          <p>${escapeHtml(getEmployeeAdminLabel(employee))} 본인 자료만 표시됩니다.</p>
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
  dockGlobalHeaderActions("attendance");
  document.getElementById("copyAllSiteLaborLedgersButton")?.addEventListener("click", copyAllSiteLaborLedgers);
  document.getElementById("copyPayrollStatementButton")?.addEventListener("click", () => copyPayrollStatement(payroll));
  list.querySelectorAll("[data-labor-jump]").forEach((button) => {
    button.addEventListener("click", () => {
      document.getElementById(button.dataset.laborJump)?.scrollIntoView({ behavior: "smooth", block: "start" });
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
  document.getElementById("copyLaborCostLedgerButton")?.addEventListener("click", () => copyLaborCostLedger(ledger));
  list.querySelectorAll("[data-labor-employee]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedEmployeeId = button.dataset.laborEmployee;
      saveState({ fastSave: true });
      renderAttendance();
    });
  });
}

function preserveSectionDockBeforeRender(panelView = worklogViewAliases[activeView] || activeView) {
  const panel = getActiveViewPanel(panelView);
  const dock = panel?.querySelector(".section-menu-dock");
  if (!panel || !dock || dock.parentElement === panel) return;
  panel.prepend(dock);
}

function getLaborSiteConsoleRows() {
  return getWorklogSiteGroups().map((group) => {
    const employeeIds = getAssignedWorklogEmployeeIds(group.employeeIds);
    const summaries = employeeIds
      .map((employeeId) => {
        const employee = employees.find((item) => item.id === employeeId);
        return employee ? buildMonthlyLaborSummary(employeeId, employee) : null;
      })
      .filter(Boolean);
    const recordedEmployees = summaries.filter((item) => item.recordedDays > 0).length;
    const actualMinutes = summaries.reduce((sum, item) => sum + item.actualMinutes, 0);
    const issues = summaries.reduce((sum, item) => sum + item.lateCount + item.earlyCount + item.absenceCount, 0);
    const paidPt = summaries.reduce((sum, item) => sum + item.settlementPtCount, 0);
    return {
      ...group,
      employeeCount: employeeIds.length,
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

function renderLaborOperationsConsole(labor, employee, payroll) {
  const siteRows = getLaborSiteConsoleRows();
  const siteRecorded = siteRows.reduce((sum, row) => sum + row.recordedEmployees, 0);
  const siteEmployees = siteRows.reduce((sum, row) => sum + row.employeeCount, 0);
  const totalIssues = siteRows.reduce((sum, row) => sum + row.issues, 0);
  const readyCount = payroll.checks.filter(([, ok]) => ok).length;
  const agentSignals = getLaborAgentSignals(labor, payroll);
  const cards = [
    ["사업장별 근무기록", `${siteRecorded}/${siteEmployees}명`, "사업장별 출역·근무시간 원장", "companyLaborLedgers"],
    ["근태관리", totalIssues ? `${totalIssues}건 확인` : "정상", "지각·조퇴·결근·외출 추적", "laborRegister"],
    ["급여명세현황", `${readyCount}/${payroll.checks.length}`, "지급·공제·계산방법 준비도", "payrollStatement"],
    ["각 직원 근무기록", `${labor.recordedDays}일`, `${getEmployeeAdminLabel(employee)} 월별 기록`, "laborRegister"],
  ];
  return `
    <section class="labor-ops-console">
      <div class="labor-ops-grid">
        ${cards.map(([label, value, description, target]) => `
          <button type="button" data-labor-jump="${escapeAttr(target)}">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
            <em>${escapeHtml(description)}</em>
          </button>
        `).join("")}
      </div>
      <article class="labor-agent-panel">
        <header>
          <div>
            <span>Labor Agent</span>
            <h3>AI 노무 에이전트</h3>
          </div>
          <button type="button" data-labor-jump="payrollStatement">명세 보완</button>
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
      ${canAccessWorklogOverview() ? `
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
  renderAttendance();
}

function getPayrollPayDate(draft, month) {
  if (draft.payDate) return draft.payDate;
  const profilePayDay = String(state.profile?.payDay || "").trim();
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
  const draft = getLaborPayrollDraft(employee.id || "profile-user", labor.month);
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
    ["임금지급일", Boolean(getPayrollPayDate(draft, labor.month))],
    ["단가 기준", Boolean(dailyWage || hourlyWage)],
    ["출근일수/근로시간", labor.recordedDays > 0 || labor.actualMinutes > 0],
    ["연장·야간·휴일 시간", labor.overtimeMinutes || labor.nightMinutes || labor.holidayMinutes ? Boolean(hourlyWage) : true],
    ["공제내역", deductionTotal > 0 || draft.memo.includes("공제 없음")],
  ];
  return {
    employeeId: employee.id || "profile-user",
    month: labor.month,
    monthLabel: labor.monthLabel,
    payDate: getPayrollPayDate(draft, labor.month),
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

function renderLeaderLaborOverviewMarkup() {
  const month = getActiveDateKey().slice(0, 7);
  const groups = getWorklogSiteGroups();
  return `
    <section class="labor-leader-overview">
      <header>
        <span>Company Labor Control</span>
        <h3>${escapeHtml(month.replace("-", "."))} 전 사업장 노무현황</h3>
      </header>
      <div class="labor-leader-grid">
        ${groups.map((group) => `
          <article>
            <strong>${escapeHtml(group.title)}</strong>
            ${group.employeeIds.map((employeeId) => {
              const employee = employees.find((item) => item.id === employeeId);
              if (!employee) return "";
              const labor = buildMonthlyLaborSummary(employeeId, employee);
              return `
                <button type="button" data-labor-employee="${escapeAttr(employeeId)}">
                  <b>${escapeHtml(getEmployeeAdminLabel(employee))}</b>
                  <span>${escapeHtml(labor.recordedDays)}일 · ${escapeHtml(formatMinutesAsHours(labor.actualMinutes))} · 유료PT ${escapeHtml(String(labor.settlementPtCount))}</span>
                </button>
              `;
            }).join("")}
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderCompanyLaborLedgersMarkup() {
  const ledgers = getWorklogSiteGroups().map((group) => buildSiteLaborCostLedger(group.id));
  const monthLabel = getActiveDateKey().slice(0, 7).replace("-", ".");
  return `
    <section class="company-labor-ledgers" id="companyLaborLedgers">
      <header>
        <div>
          <span>Labor Payment Registers</span>
          <h3>${escapeHtml(monthLabel)} 사업장별 노무비 지급대장</h3>
          <p>노무신고용으로 일반적으로 사용하는 월간 출역·임금 지급대장 형식입니다.</p>
        </div>
        <button type="button" id="copyAllSiteLaborLedgersButton">전체 대장 복사</button>
      </header>
      ${ledgers.map(renderSiteLaborCostLedger).join("")}
    </section>
  `;
}

function buildSiteLaborCostLedger(groupId) {
  const group = getWorklogSiteGroups().find((item) => item.id === groupId) || getWorklogSiteGroups()[0];
  const monthLabel = getActiveDateKey().slice(0, 7).replace("-", ".");
  const dayNumbers = Array.from({ length: 31 }, (_, index) => index + 1);
  const rows = group.employeeIds
    .map((employeeId) => {
      const employee = employees.find((item) => item.id === employeeId);
      if (!employee) return null;
      const labor = buildMonthlyLaborSummary(employeeId, employee);
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
    employmentType: employee.employmentType || "직원",
    workHours: employee.workHours || defaultProfile.workHours,
  };
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
  const monthPrefix = getActiveDateKey().slice(0, 7);
  let recordedDays = 0;
  let earlyOrLate = 0;
  let totalMinutes = 0;
  Object.entries(state.employeeLogs || {}).forEach(([dateKey, logsByEmployee]) => {
    if (!dateKey.startsWith(monthPrefix)) return;
    const dayLog = logsByEmployee?.[employeeId];
    if (!dayLog || (!dayLog.clockIn && !dayLog.clockOut && !dayLog.attendanceStatus)) return;
    recordedDays += 1;
    if (["지각", "조퇴", "결근"].includes(getAttendanceStatusForLog(employee, dayLog))) earlyOrLate += 1;
    if (dayLog.clockIn && dayLog.clockOut) {
      const minutes = timeToMinutes(dayLog.clockOut) - timeToMinutes(dayLog.clockIn);
      if (Number.isFinite(minutes) && minutes > 0) totalMinutes += minutes;
    }
  });
  const breakSummary = (log.attendanceBreaks || [])
    .map((item) => `${item.type || "외출"} ${item.start || "--:--"}~${item.end || "--:--"}`)
    .join(" · ");
  const labor = buildMonthlyLaborSummary(employeeId, employee);
  const ledger = buildLaborCostLedger(labor, employee);
  const payroll = buildPayrollStatement(labor, employee, ledger);
  const archives = buildLaborMonthArchives(employeeId, employee);
  const cards = [
    ["오늘 상태", getAttendanceStatusForLog(employee, log)],
    ["출근", log.clockIn || "미기록"],
    ["퇴근/조퇴", log.clockOut || "미기록"],
    ["이번 달 기록", `${recordedDays}일`],
    ["누적 근무", totalMinutes ? formatMinutesAsHours(totalMinutes) : "집계 전"],
    ["확인 필요", earlyOrLate ? `${earlyOrLate}건` : "없음"],
  ];
  node.innerHTML = `
    <article class="work-history-hero">
      <div>
        <span>${escapeHtml(getEmployeeAdminLabel(employee))}</span>
        <strong>${escapeHtml(formatKoreanDate(getActiveDateKey()))} 노무</strong>
        <p>${escapeHtml(formatAttendanceSummary(log) || "아직 출결 시간이 기록되지 않았습니다.")}</p>
      </div>
    </article>
    ${renderLaborOperationsConsole(labor, employee, payroll)}
    <div class="work-history-card-grid">
      ${cards.map(([label, value]) => `<span><b>${escapeHtml(label)}</b><strong>${escapeHtml(value)}</strong></span>`).join("")}
    </div>
    <p class="work-history-note">${escapeHtml(breakSummary || "외출/복귀 기록이 있으면 이곳에 요약됩니다.")}</p>
    <section class="labor-month-card">
      <header>
        <div>
          <span>Labor Submission Draft</span>
          <h3>${escapeHtml(labor.monthLabel)} 노무신고 제출용 초안</h3>
        </div>
        <button type="button" id="copyLaborMonthButton">복사</button>
      </header>
      <div class="labor-month-grid">
        ${labor.cards.map(([label, value]) => `<span><b>${escapeHtml(label)}</b><strong>${escapeHtml(value)}</strong></span>`).join("")}
      </div>
      <p>${escapeHtml("임금대장·노무신고 전 검토용 자료입니다. 급여 산정, 4대보험, 세무 신고 전에는 최신 법령과 노무사 확인을 권장합니다.")}</p>
    </section>
    <section class="labor-archive-card">
      <header>
        <span>Monthly Archive</span>
        <h3>기록 시작 이후 월별 보관</h3>
      </header>
      <div class="labor-archive-list">
        ${archives.map((item) => `
          <button type="button" data-labor-month="${escapeAttr(item.month)}">
            <b>${escapeHtml(item.monthLabel)}</b>
            <span>${escapeHtml(item.recordedDays)}일 · ${escapeHtml(formatMinutesAsHours(item.actualMinutes))} · PT ${escapeHtml(String(item.settlementPtCount))}건</span>
          </button>
        `).join("") || "<p>아직 보관된 월별 기록이 없습니다.</p>"}
      </div>
    </section>
  `;
  document.getElementById("copyLaborMonthButton")?.addEventListener("click", () => copyMonthlyLaborSummary(labor));
  node.querySelectorAll("[data-labor-month]").forEach((button) => {
    button.addEventListener("click", () => setSelectedDateKey(`${button.dataset.laborMonth}-01`));
  });
}

function formatMinutesAsHours(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (!hours) return `${mins}분`;
  return mins ? `${hours}시간 ${mins}분` : `${hours}시간`;
}

function buildMonthlyLaborSummary(employeeId, employee) {
  const monthPrefix = getActiveDateKey().slice(0, 7);
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
      status = getAttendanceStatusForLog(employee, dayLog);
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
  const employmentType = String(state.profile?.employmentType || employee.employmentType || "직원");
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
    ["외출", `${breakCount}건`],
  ];
  return { employee, monthLabel, month: monthPrefix, cards, logs, dayRows, scheduledMinutes, actualMinutes, overtimeMinutes, nightMinutes, holidayMinutes, paidPtCount, freePtCount, otherPtCount, settlementPtCount, lateCount, earlyCount, absenceCount, breakCount, recordedDays: logs.length };
}

function getOwnLaborEmployeeId() {
  if (canAccessWorklogOverview() && state.selectedEmployeeId) return state.selectedEmployeeId;
  if (state.selectedEmployeeId && state.selectedEmployeeId !== "beyond-fitness-manager") return state.selectedEmployeeId;
  return state.fitnessWritableEmployeeId || state.selectedEmployeeId || "profile-user";
}

function getOwnLaborEmployee() {
  const employeeId = getOwnLaborEmployeeId();
  return getEmployeeOptions().find((item) => item.id === employeeId) || getProfileEmployee();
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

function buildLaborCostLedger(labor, employee) {
  const profile = { ...(state.profile || {}) };
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
  const text = getWorklogSiteGroups()
    .map((group) => formatSiteLaborCostLedgerText(buildSiteLaborCostLedger(group.id)))
    .join("\n\n");
  await navigator.clipboard?.writeText(text);
  showAppToast("전체 사업장 노무비 지급대장을 복사했습니다.");
}

function buildLaborMonthArchives(employeeId, employee) {
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
      const originalDate = state.selectedDateKey;
      state.selectedDateKey = `${month}-01`;
      const labor = buildMonthlyLaborSummary(employeeId, employee);
      state.selectedDateKey = originalDate;
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

function renderManagement() {
  const node = document.getElementById("managementGrid");
  const logs = Object.values(state.employeeLogs?.[getActiveDateKey()] || {});
  const entries = logs.flatMap((log) => [...(log.tasks || []), ...(log.schedule || [])]);
  const attendance = state.attendance?.[getActiveDateKey()] || [];
  const assetRows = getAssetRows();
  const staffCount = bangjuOrganization.reduce((sum, company) => sum + company.staff + company.units.reduce((unitSum, unit) => unitSum + unit.staff, 0), 0);
  const companies = bangjuOrganization.length;
  const operatingSites = assetRows.filter((row) => ["운영", "무인운영", "임대"].includes(row.status)).length;
  const openIssues = entries.filter((entry) => entry.status === "보류" || entry.status === "지원필요").length;
  node.innerHTML = [
    ["법인", `${companies}개`],
    ["운영 사업장", `${operatingSites}개`],
    ["공간/호실", `${assetRows.reduce((sum, row) => sum + row.rooms.length, 0)}개`],
    ["관리 인원", `${staffCount}명+`],
    ["오늘 근태", `${attendance.length}건`],
    ["경영 이슈", `${openIssues}건`],
    ["운영점수", `${calculateOperatingScore()}점`],
    ["AI 점검", openIssues ? "지원 필요 항목 우선" : "공간·매출 데이터 보강"],
  ].map(([label, value]) => `<article><span>${label}</span><strong>${value}</strong></article>`).join("");
}

function getEmployeeMasterRows() {
  const siteLookup = new Map(getWorklogSiteGroups().flatMap((group) => group.employeeIds.map((id) => [id, group])));
  const todayLogs = state.employeeLogs?.[getActiveDateKey()] || {};
  return employees.map((employee) => {
    const group = siteLookup.get(employee.id);
    const labor = buildMonthlyLaborSummary(employee.id, employee);
    const log = todayLogs[employee.id] || createEmployeeLog(employee);
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

function getEmployeePermissionProfile(employee, group) {
  const inferredPreset = getRecommendedPermissionPresetForEmployee(employee, group);
  const override = state.employeePermissions?.[employee.id] || {};
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

function renderStaffMaster() {
  const grid = document.getElementById("staffMasterGrid");
  const approvalButton = document.getElementById("staffOpenApprovalButton");
  if (!grid) return;
  const canManage = canAccessWorklogOverview();
  if (approvalButton) approvalButton.hidden = !canManage;
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
  const stats = [
    ["전체 직원", `${rows.length}명`],
    ["사업장", `${getWorklogSiteGroups().length}개`],
    ["권한관리", `${rows.filter((row) => row.access.permissions.staffManage || row.access.permissions.staffApproval).length}명`],
    ["온보딩 완료", `${rows.filter((row) => row.onboarding.done === row.onboarding.total).length}명`],
    ["오늘 작성", `${rows.filter((row) => row.tasks.length).length}명`],
    ["노무 기록", `${rows.filter((row) => row.labor.recordedDays).length}명`],
  ];
  grid.innerHTML = `
    <section class="staff-master-summary">
      ${stats.map(([label, value]) => `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`).join("")}
    </section>
    <section class="staff-master-panel">
      <header>
        <div>
          <span>Master Data</span>
          <h3>전체 직원 명부</h3>
        </div>
      </header>
      <div class="staff-master-table-wrap">
        <table class="staff-master-table">
          <thead>
            <tr><th>직원 ID</th><th>소속/사업장</th><th>직함/성명</th><th>고용형태</th><th>권한</th><th>근무시간</th><th>오늘 업무</th><th>온보딩</th></tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                <td>${escapeHtml(row.employeeCode)}</td>
                <td><b>${escapeHtml(row.site)}</b><span>${escapeHtml(row.org || "")}</span></td>
                <td><b>${escapeHtml(row.role || "직원")}</b><span>${escapeHtml(row.name || "")}</span></td>
                <td>${escapeHtml(row.employmentType || "직원")}</td>
                <td><b>${escapeHtml(row.access.role)}</b><span>${escapeHtml(row.access.worklog)} · ${escapeHtml(row.access.labor)}</span></td>
                <td>${escapeHtml(row.workHours || defaultProfile.workHours)}</td>
                <td>${escapeHtml(`${row.completed}/${row.tasks.length || 0}`)}</td>
                <td>${escapeHtml(`${row.onboarding.done}/${row.onboarding.total}`)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
    <section class="staff-master-panel">
      <header>
        <div>
          <span>Permission Matrix</span>
          <h3>권한 체계</h3>
        </div>
      </header>
      <div class="staff-permission-matrix">
        <div class="staff-permission-guide">
          <strong>권한은 직원 원장에서 관리합니다.</strong>
          <p>가입승인에서는 1차 권한을 정하고, 이후 이 화면에서 메뉴별/사업장별 접근권한을 조정합니다. 일반 직원은 본인 업무일지와 본인 노무만 수정할 수 있습니다.</p>
        </div>
        ${rows.map((row) => renderStaffPermissionRow(row)).join("")}
      </div>
    </section>
    <section class="staff-master-panel">
      <header>
        <div>
          <span>Onboarding</span>
          <h3>승인 이후 온보딩</h3>
        </div>
      </header>
      <div class="staff-onboarding-list">
        ${rows.map((row) => `
          <article>
            <header>
              <strong>${escapeHtml(row.name || "")}</strong>
              <span>${escapeHtml(`${row.onboarding.done}/${row.onboarding.total}`)}</span>
            </header>
            <div>
              ${row.onboarding.checks.map(([label, ok]) => `<em class="${ok ? "is-done" : ""}">${escapeHtml(label)}</em>`).join("")}
            </div>
          </article>
        `).join("")}
      </div>
    </section>
    <section class="staff-master-panel">
      <header>
        <div>
          <span>Growth Records</span>
          <h3>직원별 매뉴얼/성장기록</h3>
        </div>
      </header>
      <div class="staff-growth-grid">
        ${rows.map((row) => {
          const manual = getManualTemplateForEmployee(row);
          return `
            <article>
              <b>${escapeHtml(row.name || "")}</b>
              <strong>${escapeHtml(manual?.title || "역할 매뉴얼")}</strong>
              <span>이번 달 노무 ${escapeHtml(String(row.labor.recordedDays))}일 · 유료PT ${escapeHtml(String(row.labor.settlementPtCount || 0))} · 업무 ${escapeHtml(`${row.completed}/${row.tasks.length || 0}`)}</span>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
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
  renderBackupCenter();
  renderInnovationLab();
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
      recommended: "Supabase Edge Function 또는 Vercel Cron + Email API",
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
    ["운영 신호 레이더", "미작성, 지각, 무료수업 과다, 민원 반복을 자동 감지해 대표 개입 우선순위를 만듭니다."],
    ["목표-업무 자동 연결", "PT, 상담, 재등록, 시설 개선 목표가 오늘 업무와 자동으로 연결되어 성과로 누적됩니다."],
    ["역할별 매뉴얼 코치", "센터장, 재무, 공유사업, TBA, 인포, 트레이너별 매뉴얼을 상황에 맞게 꺼내 줍니다."],
    ["직원 성장 로그", "업무 패턴, 완료율, 커뮤니케이션, 책임감 변화를 월별 성장 리포트로 정리합니다."],
    ["다짐 데이터 브릿지", "CSV 또는 수기 입력으로 회원수, 만료예정, PT, 상담 데이터를 운영현황과 합칩니다."],
    ["노무 확정 워크플로", "월별 근무시간, 유료수업, 수정 이력, 승인자를 남겨 노무 제출자료로 고정합니다."],
    ["시설 이슈 티켓", "반복되는 청결·고장·냉난방 이슈를 자동 티켓화하고 처리자를 배정합니다."],
    ["대표의 오늘 10분", "전 사업장 중 오늘 대표가 직접 봐야 할 3가지만 압축해 실행 버튼으로 보여줍니다."],
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
    "",
    "[금일 주요업무]",
    ...model.topTasks.map((task) => `- ${task}`),
    "",
    "[시간별 세부업무]",
    ...model.schedule.map((entry) => `- ${entry.time} ${entry.text || ""}`),
    "",
    "[운영 KPI]",
    ...model.kpis.map(([label, value]) => `- ${label}: ${value}`),
    "",
    "[특이사항 및 인수인계]",
    ...model.issueRows.map((row) => `- ${row}`),
    "",
    "[AI 보완 코칭]",
    ...model.coaching.map(([title, text]) => `- ${title}: ${text}`),
  ];
}

function buildFitnessReportModel() {
  const page = getCurrentFitnessLogPage();
  const employee = page?.employee || employees.find((item) => item.id === state.fitnessWritableEmployeeId) || getSelectedEmployee();
  const log = page?.type === "center" ? getEmployeeLogForDate(state.fitnessWritableEmployeeId) : getSelectedLog();
  const isCenter = page?.type === "center";
  const tasks = getWorklogTaskRefs(log).map((ref) => ref.task).filter(isActiveTask);
  const entries = (log.schedule || []).filter((entry) => entry.time);
  const ops = { ...createFitnessOps(), ...(log.fitnessOps || {}) };
  const ptTotal = ["ptRegular", "ptFree", "ptOther"].reduce((sum, key) => sum + numberValue(ops[key]), 0);
  const contractTotal = ["customerNew", "customerRenewal"].reduce((sum, key) => sum + numberValue(ops[key]), 0);
  const marketingTotal = ["outbound", "outsideSales"].reduce((sum, key) => sum + numberValue(ops[key]), 0);
  const centerAttendanceRows = getFitnessEmployees().map((item) => {
    const rowLog = getEmployeeLogForDate(item.id);
    const breakSummary = (rowLog.attendanceBreaks || []).map((record) => `${record.start || "--:--"}~${record.end || "--:--"}`).join(" / ");
    return {
      role: item.role || "",
      name: item.name || getEmployeeOwnLabel(item),
      clock: `${rowLog.clockIn || "-"}~${rowLog.clockOut || "-"}`,
      status: getAttendanceStatusForLog(item, rowLog),
      breaks: breakSummary || "-",
    };
  });
  const title = isCenter ? "< 비욘드 피트니스 운영일지 >" : "< 비욘드 피트니스 업무일지 >";
  return {
    title,
    isCenter,
    dateLabel: formatKoreanDate(getActiveDateKey()),
    writer: isCenter ? "센터 전체" : employee.name || getEmployeeOwnLabel(employee),
    role: isCenter ? "운영 취합" : employee.role || "직원",
    ownerLabel: isCenter ? "담당 : 센터 운영 취합" : `담당 : ${employee.role || "직원"} ${employee.name || getEmployeeOwnLabel(employee)}`,
    clock: `${log.clockIn || "-"} ~ ${log.clockOut || "-"}`,
    centerAttendanceRows,
    topTasks: Array.from({ length: 3 }, (_, index) => {
      const task = tasks[index];
      if (!task) return "";
      return `${task.priority || "?"} ${task.text || ""}${task.done || task.status === "완료" ? " (완료)" : ""}`.trim();
    }),
    schedule: entries.map((entry) => ({
      time: formatReportTime(entry.time),
      text: getScheduleEntryText(entry),
    })),
    kpis: [
      ["수업", `${ptTotal}건`],
      ["상담", `${numberValue(ops.consultation)}건`],
      ["계약", `${contractTotal}건`],
      ["홍보", `${numberValue(ops.outbound)}건`],
      ["마케팅", `${marketingTotal}건`],
      ["일일권", `${numberValue(ops.dayPass)}건`],
    ],
    issueRows: [ops.specialReport, ops.shiftNote, log.memo].filter(Boolean).slice(0, 3).concat(Array(3).fill("")).slice(0, 3),
    coaching: getFitnessCoachingMessages(),
  };
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
  const attendanceRows = model.centerAttendanceRows.map((row) => `
    <tr>
      <td>${escapeHtml(row.role)}</td>
      <td>${escapeHtml(row.name)}</td>
      <td>${escapeHtml(row.clock)}</td>
      <td>${escapeHtml(row.status)}</td>
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
        </dl>
      </header>

      <section class="fitness-paper-summary">
        <div class="fitness-paper-tasks">
          <h3>금일 주요업무</h3>
          ${taskRows}
        </div>
        <div class="fitness-paper-kpi">
          ${model.kpis.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}
        </div>
      </section>

      ${model.isCenter ? `
        <section class="fitness-paper-attendance-table">
          <h3>전직원 출결현황</h3>
          <table>
            <thead><tr><th>직함</th><th>이름</th><th>출퇴근</th><th>근태</th></tr></thead>
            <tbody>${attendanceRows}</tbody>
          </table>
        </section>
      ` : ""}

      <section class="fitness-paper-schedule">
        <h3>시간별 세부업무</h3>
        <table>
          <thead><tr><th>업무시간</th><th>세부업무내용</th><th>분류</th></tr></thead>
          <tbody>
            ${scheduleRows.map((entry) => `<tr><td>${escapeHtml(entry.time)}</td><td>${escapeHtml(entry.text || "")}</td><td>${escapeHtml(inferScheduleType(entry.text || ""))}</td></tr>`).join("")}
          </tbody>
        </table>
      </section>

      <section class="fitness-paper-footer-grid">
        <div>
          <h3>특이사항 / 인수인계</h3>
          ${model.issueRows.map((row, index) => `<p><b>${index + 1}</b><span>${escapeHtml(row || "")}</span></p>`).join("")}
        </div>
        <div>
          <h3>AI 코칭</h3>
          ${model.coaching.slice(0, 3).map(([title, text]) => `<p><b>${escapeHtml(title)}</b><span>${escapeHtml(text)}</span></p>`).join("")}
        </div>
      </section>
    </article>
  `;
}

function getFitnessReportScheduleRows(schedule = []) {
  const baseTimes = ["06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00", "00:00"];
  const filled = new Map((schedule || []).filter((entry) => entry.time).map((entry) => [entry.time, entry.text || ""]));
  const rows = baseTimes.map((time) => ({ time: formatReportTime(time), text: filled.get(time) || "" }));
  const extraFilled = (schedule || []).filter((entry) => entry.text && !baseTimes.map(formatReportTime).includes(entry.time));
  extraFilled.slice(0, 3).forEach((entry, index) => {
    const target = rows[rows.length - 3 + index];
    if (target && !target.text) target.text = `${entry.time} ${entry.text}`;
  });
  return rows;
}

function openFitnessReportSheet() {
  const backdrop = document.getElementById("fitnessReportBackdrop");
  const sheet = document.getElementById("fitnessReportSheet");
  const preview = document.getElementById("fitnessReportPreview");
  const subtitle = document.getElementById("fitnessReportSubtitle");
  if (!backdrop || !sheet || !preview) return;
  const model = buildFitnessReportModel();
  if (subtitle) subtitle.textContent = `${formatKoreanDate(getActiveDateKey())} 보고서`;
  preview.innerHTML = renderFitnessReportTemplate(model);
  backdrop.hidden = false;
  sheet.hidden = false;
  requestAnimationFrame(() => {
    sheet.classList.add("is-open");
    fitFitnessReportPreview();
  });
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

function saveFitnessReportImage() {
  const lines = buildFitnessReportLines();
  const svgLines = lines.slice(0, 44).map((line, index) => {
    const safe = escapeHtml(line || " ");
    const size = index === 0 ? 30 : 18;
    const weight = index === 0 || /^\[/.test(line) ? 800 : 500;
    return `<text x="56" y="${72 + index * 28}" font-size="${size}" font-weight="${weight}" fill="#111411">${safe}</text>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1240" height="1754" viewBox="0 0 1240 1754"><rect width="1240" height="1754" fill="#fffefa"/><rect x="38" y="38" width="1164" height="1678" fill="none" stroke="#111411" stroke-width="3"/>${svgLines}</svg>`;
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `beyond-fitness-report-${getActiveDateKey()}.svg`;
  link.click();
  URL.revokeObjectURL(url);
}

async function shareFitnessReport() {
  const text = buildFitnessReportLines().join("\n");
  if (navigator.share) {
    await navigator.share({ title: "Beyond Fitness Report", text });
    return;
  }
  await navigator.clipboard?.writeText(text);
  alert("보고서 내용을 클립보드에 복사했습니다.");
}

function switchView(view) {
  const requestedView = view;
  if (!["auth", "settings"].includes(view) && authState.user && !isProfileApproved()) {
    view = "auth";
    renderAuthStatus(`현재 상태: ${getApprovalStatusLabel()}. 승인 후 업무일지를 사용할 수 있습니다.`);
  }
  if (view === "worklog") view = getUserWorklogView();
  view = view === "today" ? "bangju-log" : view;
  ensureSelectedEmployeeForWorklogView(view);
  activeView = view;
  document.body.dataset.activeView = view;
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
  renderGlobalEmployeeIdentity();
  renderOsDashboard();
  renderExecutiveManagement();
  renderControlTower();
  renderWorklogOverview();
  renderAiCoach();
  renderFitnessDashboard();
  renderStaffMaster();
  renderAttendance();
  renderManagement();
  renderOrganization();
  updateGlobalAttendanceVisibility(view);
  dockGlobalHeaderActions(panelView);
  applyCurrentWorklogPermissionState(view);
  if (view === "fitness-log") window.setTimeout(() => showFitnessPageToast(), 80);
}

function getActiveViewPanel(panelView = worklogViewAliases[activeView] || activeView) {
  return document.getElementById(`view-${panelView}`) || document.querySelector(".worklog-view.is-active");
}

function dockGlobalHeaderActions(panelView = worklogViewAliases[activeView] || activeView) {
  const panel = getActiveViewPanel(panelView);
  const menuButton = document.getElementById("settingsGearButton");
  const menuPopover = document.getElementById("mainMenuPopover");
  if (!panel || !menuButton || !menuPopover) return;

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

function toggleMainMenuPopover() {
  const popover = document.getElementById("mainMenuPopover");
  const button = document.getElementById("settingsGearButton");
  const executiveButton = document.getElementById("executiveMenuButton");
  if (!popover) return;
  const willOpen = popover.hidden;
  if (willOpen) renderMainMenuAuthButton();
  popover.hidden = !willOpen;
  button?.setAttribute("aria-expanded", String(willOpen));
  executiveButton?.setAttribute("aria-expanded", String(willOpen));
  if (willOpen) closeAttendancePopover();
  if (willOpen) popover.querySelector("button:not([hidden])")?.focus();
}

function closeMainMenuPopover() {
  const popover = document.getElementById("mainMenuPopover");
  const button = document.getElementById("settingsGearButton");
  const executiveButton = document.getElementById("executiveMenuButton");
  if (!popover || popover.hidden) return;
  popover.hidden = true;
  button?.setAttribute("aria-expanded", "false");
  executiveButton?.setAttribute("aria-expanded", "false");
}

function renderAll() {
  renderGlobalEmployeeIdentity();
  renderMainMenuAuthButton();
  renderOsDashboard();
  renderExecutiveManagement();
  renderControlTower();
  renderWorklogOverview();
  renderAiCoach();
  renderFitnessDashboard();
  renderStaffMaster();
  renderEmployeeSelect();
  renderProfileForm();
  renderEntries();
  renderAttendance();
  renderManagement();
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

document.getElementById("settingsGearButton").onclick = (event) => {
  event.stopPropagation();
  toggleMainMenuPopover();
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
    if (action === "manual") {
      switchView("settings");
      switchSettingsTab("manual");
      return;
    }
    if (action === "report" || action === "daily-report" || action === "backup" || action === "innovation") {
      switchView("report");
      return;
    }
    if (action === "labor") {
      switchView("attendance");
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
  const resetButton = event.target.closest("[data-staff-permission-reset]");
  if (!resetButton) return;
  resetEmployeePermission(resetButton.dataset.staffPermissionReset);
});
document.getElementById("mainMenuPopover")?.addEventListener("click", (event) => event.stopPropagation());
document.addEventListener("click", () => {
  closeMainMenuPopover();
  closeAttendancePopover();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMainMenuPopover();
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
document.getElementById("refreshApprovalRequestsButton")?.addEventListener("click", loadApprovalRequests);
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
document.getElementById("logoutButton").onclick = signOutWithSupabase;
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
document.getElementById("fitnessScheduleUnitButton")?.addEventListener("click", () => {
  if (!guardWorklogEdit()) return;
  const log = getSelectedLog();
  log.scheduleUnit = log.scheduleUnit === "60" ? "30" : "60";
  normalizeEmployeeLogRows(log);
  saveState();
  renderEntries();
});
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
document.getElementById("fitnessReportImageButton")?.addEventListener("click", saveFitnessReportImage);
document.getElementById("fitnessReportShareButton")?.addEventListener("click", () => {
  shareFitnessReport().catch(() => alert("공유 기능을 사용할 수 없어 보고서 미리보기를 확인해주세요."));
});
document.getElementById("addEntryButton").onclick = () => {
  alert("시간별 일정 AI 추천은 이후 Beyond Work 오늘 섹션의 추천 로직과 연결합니다.");
};
document.querySelectorAll("[data-section-ai]").forEach((button) => {
  button.onclick = () => alert("오늘의 우선업무 AI 추천은 이후 Beyond Work 추천 로직과 연결합니다.");
});
document.querySelectorAll("[data-os-action]").forEach((button) => {
  button.onclick = () => alert("Beyond OS AI는 마스터 데이터, 운영점수, 리스크, 실행 추적 데이터를 기준으로 코칭합니다.");
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
    if (!isCurrentFitnessLogEditable()) return;
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
    state.dagymOps = { ...createDagymOps(), ...(state.dagymOps || {}) };
    state.dagymOps[event.target.dataset.dagymField] = event.target.value;
    saveState({ fastSave: true });
    renderFitnessCenterDaily();
  };
});
document.getElementById("dagymImportText")?.addEventListener("input", (event) => {
  state.dagymOps = { ...createDagymOps(), ...(state.dagymOps || {}), importText: event.target.value };
  saveState({ fastSave: true });
});
document.getElementById("dagymImportButton")?.addEventListener("click", importDagymText);
document.getElementById("dagymClearButton")?.addEventListener("click", clearDagymOps);
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
document.getElementById("controlTowerRefreshButton")?.addEventListener("click", () => {
  setSelectedDateKey(todayKey);
  switchView("control");
});
document.getElementById("executiveTodayButton")?.addEventListener("click", () => {
  setSelectedDateKey(todayKey);
  switchView("executive");
});
document.getElementById("executiveMenuButton")?.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleMainMenuPopover();
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

renderResponsiveMode();
normalizeState();
document.getElementById("reportTone").value = state.reportTone;
renderBackupCenter();
renderInnovationLab();
document.getElementById("authEmail").value = state.profile.email || "";
renderAuthStatus();
renderAll();
switchView(getInitialLandingView());
initializeAuth();

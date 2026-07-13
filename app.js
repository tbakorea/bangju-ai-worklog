const storageKey = "beyond-worklog-state-v1";
const supabaseConfig = {
  url: "https://zllpfaijahyfppivkxzu.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpsbHBmYWlqYWh5ZnBwaXZreHp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzMzQxNTUsImV4cCI6MjA5ODkxMDE1NX0.C4omaj-e_9PM-iF3-5GUUVX47Wo06UsNTOYMlMMVcZU",
};
const supabaseClient = window.supabase?.createClient(supabaseConfig.url, supabaseConfig.anonKey) || null;
const todayKey = formatDateKey(new Date());
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
const taskStatusCycle = ["미완료", "완료", "진행중", "위임", "연기"];
const taskStatusGuideLabels = {
  "완료": "완료",
  "진행중": "진행중",
  "위임": "위임",
  "연기": "연기",
  "미완료": "미완료",
};
const defaultScheduleTimes = ["12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00"];
const defaultProfile = {
  org: "(주)방주",
  role: "직원",
  name: "내 프로필",
  phone: "",
  email: "",
  primaryWork: "",
  secondaryWork: "",
  workplace: "",
  workHours: "12:00-19:00",
  extra: "",
  strengths: "",
  weaknesses: "",
  developmentGoals: "",
};
const employees = [
  { id: "bangju-finance-1", name: "방주 재무담당", org: "(주)방주", role: "재무" },
  { id: "beyond-fitness-manager", name: "비욘드 피트니스 센터장", org: "(주)방주 / 비욘드 피트니스 지사", role: "센터장" },
  { id: "workbase-manager", name: "워크베이스 매니저", org: "(주)방주 / 워크베이스", role: "매니저" },
  { id: "sales-office-staff", name: "홍보관 담당", org: "(주)방주 / 홍보관", role: "분양/임대" },
  { id: "construction-hq", name: "비제이종합건설 본사", org: "(주)비제이종합건설", role: "본사관리" },
  { id: "dongcheon-site-manager", name: "동천체육관현장 소장", org: "(주)비제이종합건설 / 동천체육관현장", role: "현장소장" },
  { id: "beyond-company-director", name: "비욘드컴퍼니 총괄", org: "(주)비욘드컴퍼니", role: "총괄관리" },
];
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
  ["근태관리", "출퇴근, 외근, 휴가, GPS/QR/Face ID 확장", "운영"],
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
};
let dateSlideTimer = 0;
let calendarViewDate = parseDateKey(todayKey);
let calendarPickerMode = "worklog";
let calendarPostponeTask = null;
let mobileDayFocusMode = "split";
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
        { employeeId: "beyond-fitness-manager", org: "비욘드 피트니스 지사", role: "센터장", name: "비욘드 피트니스 센터장", status: "정상", note: "" },
        { employeeId: "sales-office-staff", org: "홍보관", role: "분양/임대", name: "홍보관 담당", status: "정상", note: "" },
      ],
    },
    reportTone: "executive",
  };
}

function createEmployeeLog(employee = employees[0], profile = defaultProfile) {
  return {
    employeeId: employee.id,
    org: employee.org,
    role: employee.role,
    clockIn: "",
    clockOut: "",
    tasks: [
      { priority: "A", text: "", status: "진행", done: false },
      { priority: "B", text: "", status: "예정", done: false },
      ...Array.from({ length: 12 }, () => ({ priority: "?", text: "", status: "예정", done: false })),
    ],
    schedule: getScheduleTimes(profile.workHours).map((time) => ({ time, text: "", status: "예정" })),
    scheduleUnit: "30",
    report: "",
    memo: "",
    record: "",
  };
}

function normalizeState() {
  state.selectedEmployeeId ||= "beyond-fitness-manager";
  state.profile = { ...defaultProfile, ...(state.profile || {}) };
  if (state.selectedEmployeeId === "profile-user" && state.profile.name === defaultProfile.name) {
    state.selectedEmployeeId = "beyond-fitness-manager";
  }
  state.selectedDateKey ||= todayKey;
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
    log.attendanceStatus ||= "";
    log.attendanceStep ||= log.attendanceStatus === "조퇴" ? "early" : log.clockOut ? "out" : log.clockIn ? "in" : "ready";
    log.tasks ||= createEmployeeLog(employee).tasks;
    log.schedule ||= createEmployeeLog(employee).schedule;
    normalizeEmployeeLogRows(log);
    log.report ||= log.record || "";
    log.memo ||= "";
    log.record ||= "";
  });
  if (state.entries?.[todayKey]?.length && getActiveDateKey() === todayKey && !state.employeeLogs[todayKey][employees[0].id].schedule.some((item) => item.text)) {
    state.employeeLogs[todayKey][employees[0].id].schedule = state.entries[todayKey].map((entry) => ({
      time: entry.time || "",
      text: entry.text || "",
      status: entry.status || "예정",
    }));
  }
  state.attendance ||= {};
  state.attendance[getActiveDateKey()] ||= [];
}

function normalizeEmployeeLogRows(log) {
  log.tasks ||= [];
  log.schedule ||= [];
  log.tasks.forEach((task, index) => {
    task.id ||= `task-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`;
    task.priority ||= index === 0 ? "A" : index === 1 ? "B" : "?";
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
    const item = scheduleByTime.get(time) || { time, text: "", status: "예정" };
    item.time = time;
    item.text ||= "";
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
    org: profile.org || "(주)방주",
    role: profile.role || "직원",
  };
}

function getScheduleTimes(workHoursValue) {
  const workHours = workHoursValue || state?.profile?.workHours || defaultProfile.workHours;
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
  state.employeeLogs ||= {};
  state.employeeLogs[key] ||= {};
  state.employeeLogs[key][employee.id] ||= createEmployeeLog(employee);
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
  const titleButton = document.getElementById("selectedDateButton");
  if (!titleButton) {
    setSelectedDateKey(nextDateKey);
    return;
  }

  clearTimeout(dateSlideTimer);
  titleButton.classList.remove("slide-out-next", "slide-out-prev", "slide-in-next", "slide-in-prev");
  void titleButton.offsetWidth;
  titleButton.classList.add(delta > 0 ? "slide-out-next" : "slide-out-prev");

  dateSlideTimer = window.setTimeout(() => {
    setSelectedDateKey(nextDateKey);
    const nextTitleButton = document.getElementById("selectedDateButton");
    nextTitleButton.classList.remove("slide-out-next", "slide-out-prev", "slide-in-next", "slide-in-prev");
    void nextTitleButton.offsetWidth;
    nextTitleButton.classList.add(delta > 0 ? "slide-in-next" : "slide-in-prev");
    window.setTimeout(() => {
      nextTitleButton.classList.remove("slide-in-next", "slide-in-prev");
    }, 220);
  }, 150);
}

function formatKoreanDate(key) {
  const date = parseDateKey(key);
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")} (${weekdays[date.getDay()]})`;
}

function formatShortDate(key) {
  if (!key) return "미정";
  const date = parseDateKey(key);
  return `${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function currentTimeValue() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function renderResponsiveMode() {
  const mode = window.matchMedia("(max-width: 760px)").matches ? "narrow" : "expanded";
  document.body.dataset.deviceMode = mode;
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

function renderAiCoach() {
  const score = calculateOperatingScore();
  const log = getSelectedLog();
  const tasks = (log.tasks || []).filter((task) => task.text.trim());
  const coaching = [
    ["대표 AI 코치", `오늘 점검 우선순위는 운영점수 ${score}점 기준으로 매출, 공간 활용, 문서 연결입니다.`],
    ["사업장 AI 코치", "Beyond Fitness는 회원 240명, 월매출 2천만원을 기준 KPI로 두고 PT 전환율과 이탈률을 먼저 추적해야 합니다."],
    ["직원 AI 코치", tasks.length ? `오늘 우선업무 ${tasks.length}건을 기준으로 완료율과 지연 사유를 기록합니다.` : "개인 업무일지의 우선업무와 시간별 일정을 먼저 기록해야 코칭 품질이 올라갑니다."],
    ["데이터 설계 코치", "모든 사진, 도면, 계약서, 업무일지, 매출 데이터는 반드시 사업장 ID와 호실 ID에 연결해야 합니다."],
  ];
  document.getElementById("aiCoachGrid").innerHTML = coaching.map(([title, body]) => `
    <article>
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(body)}</p>
    </article>
  `).join("");
}

function renderDateNav() {
  const selectedDateButton = document.getElementById("selectedDateButton");
  const dayTitle = document.getElementById("worklogDayTitle");
  const todayJumpButton = document.getElementById("todayJumpButton");
  const activeDateKey = getActiveDateKey();
  calendarViewDate = parseDateKey(activeDateKey);
  if (dayTitle) dayTitle.textContent = formatKoreanDate(activeDateKey);
  selectedDateButton.setAttribute("aria-label", `${formatKoreanDate(activeDateKey)} 업무일지 날짜 선택`);
  if (todayJumpButton) {
    todayJumpButton.hidden = activeDateKey === todayKey;
  }
  renderWorklogCalendar();
}

function openWorklogCalendar() {
  calendarPickerMode = "worklog";
  calendarPostponeTask = null;
  openCalendarSheet(parseDateKey(getActiveDateKey()));
}

function openPostponeCalendar(task) {
  calendarPickerMode = "postpone";
  calendarPostponeTask = task;
  openCalendarSheet(parseDateKey(task.postponeDate || getActiveDateKey()));
}

function openCalendarSheet(viewDate) {
  const popover = document.getElementById("worklogCalendarPopover");
  const backdrop = document.getElementById("worklogCalendarBackdrop");
  const selectedDateButton = document.getElementById("selectedDateButton");
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
  const selectedDateButton = document.getElementById("selectedDateButton");
  if (!popover || popover.hidden) return;
  popover.classList.remove("is-open");
  backdrop?.classList.remove("is-open");
  selectedDateButton?.setAttribute("aria-expanded", "false");
  document.getElementById("calendarYearGrid").hidden = true;
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
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = String(date);
    button.className = [
      key === selectedDateKey ? "is-selected" : "",
      key === todayKey ? "is-today" : "",
    ].filter(Boolean).join(" ");
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
  document.getElementById("todayTitle").textContent = `${employee.org} 업무일지. ${employee.role} ${employee.name}`;
}

function renderGlobalEmployeeIdentity() {
  const employee = getSelectedEmployee();
  const [company, rawDepartment] = employee.org.split(" / ");
  const department = rawDepartment || employee.org.replace("(주)방주", "").trim() || "비욘드 피트니스";
  document.getElementById("globalEmployeeIdentity").textContent = `${company || "(주)방주"} (부서: ${department}) ${employee.name} ${employee.role}`;
}

function renderProfileForm() {
  document.querySelectorAll("[data-profile-field]").forEach((field) => {
    field.value = state.profile?.[field.dataset.profileField] || "";
  });
}

function saveProfileFromForm() {
  state.profile = { ...defaultProfile, ...(state.profile || {}) };
  document.querySelectorAll("[data-profile-field]").forEach((field) => {
    state.profile[field.dataset.profileField] = field.value.trim();
  });
  state.selectedEmployeeId = "profile-user";
  normalizeState();
  normalizeEmployeeLogRows(getSelectedLog());
  saveState();
  saveRemoteProfile();
  renderAll();
  switchView("today");
}

function renderAuthStatus(message) {
  const status = document.getElementById("authStatus");
  const email = authState.user?.email || "";
  const readyText = authState.remoteReady ? "Supabase 연결 준비됨" : "Supabase 스크립트 로딩 필요";
  status.textContent = message || (email ? `${email} 로그인됨 · 원격 저장 켜짐` : `${readyText} · 로그인하면 원격 저장됩니다.`);
  document.getElementById("logoutButton").disabled = !authState.user;
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

async function signUpWithSupabase() {
  const credentials = getAuthCredentials();
  if (!credentials || !supabaseClient) return;
  renderAuthStatus("가입 처리 중입니다...");
  const { data, error } = await supabaseClient.auth.signUp(credentials);
  if (error) {
    renderAuthStatus(`가입 실패: ${error.message}`);
    return;
  }
  if (data.user) {
    state.profile.email = credentials.email;
    saveState();
    renderProfileForm();
  }
  renderAuthStatus("가입 완료. 이메일 확인이 필요한 설정이면 메일 확인 후 로그인해주세요.");
}

async function signInWithSupabase() {
  const credentials = getAuthCredentials();
  if (!credentials || !supabaseClient) return;
  renderAuthStatus("로그인 중입니다...");
  const { data, error } = await supabaseClient.auth.signInWithPassword(credentials);
  if (error) {
    renderAuthStatus(`로그인 실패: ${error.message}`);
    return;
  }
  await applySession(data.session);
}

async function signOutWithSupabase() {
  if (!supabaseClient) return;
  await supabaseClient.auth.signOut();
  authState.session = null;
  authState.user = null;
  renderAuthStatus("로그아웃되었습니다. 입력 내용은 이 기기에 계속 보관됩니다.");
}

async function applySession(session) {
  authState.session = session;
  authState.user = session?.user || null;
  if (!authState.user) {
    renderAuthStatus();
    return;
  }
  document.getElementById("authEmail").value = authState.user.email || "";
  state.profile.email ||= authState.user.email || "";
  await loadRemoteProfile();
  await loadRemoteWorklogForActiveDate();
  await saveRemoteProfile();
  scheduleRemoteSave(0);
  renderAll();
  renderAuthStatus();
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
    phone: state.profile.phone,
    email: state.profile.email || authState.user.email || "",
    primary_work: state.profile.primaryWork,
    secondary_work: state.profile.secondaryWork,
    workplace: state.profile.workplace,
    work_hours: state.profile.workHours,
    extra: state.profile.extra,
    strengths: state.profile.strengths,
    weaknesses: state.profile.weaknesses,
    development_goals: state.profile.developmentGoals,
    updated_at: new Date().toISOString(),
  };
}

function remoteRowToProfile(row) {
  return {
    org: row.org,
    role: row.role,
    name: row.name,
    phone: row.phone,
    email: row.email,
    primaryWork: row.primary_work,
    secondaryWork: row.secondary_work,
    workplace: row.workplace,
    workHours: row.work_hours,
    extra: row.extra,
    strengths: row.strengths,
    weaknesses: row.weaknesses,
    developmentGoals: row.development_goals,
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

function isMobilePhoneFocusLayout() {
  return window.matchMedia("(max-width: 640px)").matches || document.body.classList.contains("smartphone-device");
}

function isEditingDailyField() {
  return dailyEditingState.focused || dailyEditingState.composing;
}

function isEditableDayControl(target) {
  return Boolean(target?.closest?.(".day-task-panel input, .day-task-panel textarea, .day-task-panel select, .day-schedule-panel input, .day-schedule-panel textarea, .day-schedule-panel select"));
}

function setupMobileDayFocus() {
  document.querySelectorAll(".day-task-panel, .day-schedule-panel").forEach((panel) => {
    setupSplitEditGate(panel, panel.classList.contains("day-task-panel") ? "tasks" : "schedule");
  });
  setupMobileFocusCloseButtons();
  applyMobileDayFocusMode();
}

function setupSplitEditGate(node, mode) {
  node.addEventListener("pointerdown", (event) => {
    if (!isMobilePhoneFocusLayout() || mobileDayFocusMode !== "split") return;
    if (!isEditableDayControl(event.target)) return;
    event.preventDefault();
    setMobileDayFocusMode(mode);
  }, true);
  node.addEventListener("click", (event) => {
    if (!isMobilePhoneFocusLayout() || mobileDayFocusMode !== "split") return;
    if (!isEditableDayControl(event.target)) return;
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
  if (!main) return;
  const mode = isMobilePhoneFocusLayout() ? mobileDayFocusMode : "split";
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
      ${escapeHtml(employee.name)} · ${escapeHtml(employee.role)}
    </option>
  `).join("");
}

function renderEntries() {
  const log = getSelectedLog();
  normalizeEmployeeLogRows(log);
  renderWorklogToday(log);
  renderEmployeeDetailFields();
  renderClockPanel();
  renderEmployeeTitle();
  renderDateNav();
  renderTodayContext();
  renderReport();
  applyMobileDayFocusMode();
}

function renderWorklogToday(log = getSelectedLog()) {
  renderWorklogSummary(log);
  renderWorklogTaskBoard(log);
  renderWorklogAppointments(log);
}

function renderWorklogSummary(log) {
  const tasks = getWorklogTaskRefs(log).map((ref) => ref.task).filter((task) => isActiveTask(task));
  const completed = tasks.filter((task) => task.done || task.status === "완료").length;
  const pending = tasks.filter((task) => !task.done && !["완료", "취소"].includes(task.status)).length;
  const nextEntry = getNextScheduleEntry(log);
  document.getElementById("worklogDayTitle").textContent = formatKoreanDate(getActiveDateKey());
  document.getElementById("worklogCompletion").textContent = `${completed}/${tasks.length}`;
  document.getElementById("worklogPulse").textContent = `오늘 실행 ${completed}/${tasks.length} · 다음 일정 ${nextEntry ? `${nextEntry.time} ${nextEntry.text}` : "없음"} · 미완료 ${pending} · AI 운영 신호 ${pending ? "추적" : "정상"}`;
  const unitButton = document.getElementById("scheduleUnitButton");
  if (unitButton) unitButton.textContent = log.scheduleUnit === "60" ? "1시간" : "30분";
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
    log.tasks.push(createWorklogTask("A"));
    saveState();
    renderEntries();
  };
  list.appendChild(add);
  board.appendChild(list);
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
    cycleWorklogTaskStatus(task);
    syncWorklogTaskTimeHintToSchedule(task, log);
    saveState();
    renderEntries();
    showTaskStatusGuide(taskStatusGuideLabels[task.status] || task.status || "미완료");
  };
  bindTaskMetaControl(row, task, log);
  row.querySelector(".task-text-input").oninput = (event) => {
    task.text = event.target.value;
    syncWorklogTaskTimeHintToSchedule(task, log);
    saveState({ fastSave: true });
    updateTaskRowTags(row, task);
    renderWorklogSummary(currentLog);
    renderWorklogAppointments(currentLog);
    renderTodayContext();
    renderReport();
  };
  row.querySelector(".task-delete").onclick = () => {
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
      task.delegate = delegateInput.value;
      saveState({ fastSave: true });
    };
    return;
  }
  const postponeButton = row.querySelector(".postpone-date-button");
  if (postponeButton) {
    postponeButton.onclick = () => openPostponeCalendar(task);
    return;
  }
  const prioritySelect = row.querySelector(".priority-select");
  if (prioritySelect) {
    prioritySelect.onchange = (event) => {
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

function renderWorklogAppointments(log) {
  normalizeWorklogSchedule(log);
  const list = document.getElementById("worklogAppointmentList");
  list.innerHTML = "";
  (log.schedule || []).forEach((entry, index) => {
    if (index > 0 && log.schedule[index - 1]?.mergeDown) return;
    const row = document.createElement("div");
    const mergedEntry = entry.mergeDown ? log.schedule[index + 1] : null;
    const value = mergedEntry?.text && !entry.text ? mergedEntry.text : entry.text || "";
    row.className = `appointment-row ${value.trim() ? "is-filled" : ""} ${isCurrentScheduleSlot(entry, log) ? "is-current" : ""} ${entry.mergeDown ? "is-merged" : ""}`;
    row.innerHTML = `
      <span class="appointment-time">${escapeHtml(entry.time)}</span>
      <input type="text" value="${escapeAttr(value)}" placeholder="일정" aria-label="${escapeAttr(entry.time)} 일정" />
      <button class="appointment-merge-button" type="button" aria-label="${escapeAttr(entry.time)} 일정 병합">${entry.mergeDown ? "−" : "+"}</button>
    `;
    const text = row.querySelector("input");
    text.oninput = () => {
      entry.text = text.value;
      if (mergedEntry && !mergedEntry.text) mergedEntry.text = text.value;
      saveState({ fastSave: true });
      renderWorklogSummary(log);
    };
    row.querySelector("button").onclick = () => {
      entry.mergeDown = !entry.mergeDown && index < log.schedule.length - 1;
      saveState();
      renderWorklogAppointments(log);
    };
    list.appendChild(row);
  });
}

function updateEntry(index, field, value) {
  getSelectedLog().schedule[index][field] = value;
  saveState();
  renderTodayContext();
  renderReport();
}

function addEntry() {
  const emptySlot = getSelectedLog().schedule.find((entry) => !entry.text.trim());
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
    if (previous && previous.text === existing.text) previous.text = "";
  }
  const entry = ensureWorklogAppointmentSlot(log, hint.slot);
  if (existing?.slot === hint.slot && entry.text === existing.text) {
    entry.text = hint.text;
    log.autoTaskScheduleLinks[linkId] = { type: "task", slot: hint.slot, text: hint.text };
    normalizeWorklogSchedule(log);
    return;
  }
  const current = String(entry.text || "").trim();
  if (!current) {
    entry.text = hint.text;
  } else if (!current.includes(hint.text)) {
    entry.text = `${current} / ${hint.text}`;
  }
  log.autoTaskScheduleLinks[linkId] = { type: "task", slot: hint.slot, text: hint.text };
  normalizeWorklogSchedule(log);
}

function removeLinkedSchedule(task, log) {
  log.autoTaskScheduleLinks ||= {};
  const linkId = `task:${task.id || task.text}`;
  const existing = log.autoTaskScheduleLinks[linkId];
  if (!existing) return;
  const entry = findScheduleEntry(log, existing.slot);
  if (entry && entry.text === existing.text) entry.text = "";
  delete log.autoTaskScheduleLinks[linkId];
}

function ensureWorklogAppointmentSlot(log, slot) {
  log.schedule ||= [];
  let entry = findScheduleEntry(log, slot);
  if (!entry) {
    entry = { time: slot, text: "", status: "예정", mergeDown: false };
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
    const entry = byTime.get(time) || { time, text: "", status: "예정", mergeDown: false };
    entry.time = time;
    entry.text ||= "";
    entry.status ||= "예정";
    entry.mergeDown ||= false;
    return entry;
  });
}

function getWorklogScheduleSlots(log) {
  const unit = log?.scheduleUnit === "60" ? 60 : 30;
  const baseTimes = getScheduleTimes(state?.profile?.workHours || defaultProfile.workHours);
  const scheduleTimes = (log?.schedule || []).map((entry) => entry.time).filter(Boolean);
  const taskTimes = (log?.tasks || []).map((task) => extractWorklogTaskTimeHint(task.text)?.slot).filter(Boolean);
  const allTimes = [...baseTimes, ...scheduleTimes, ...taskTimes];
  let start = 8 * 60;
  let end = 19 * 60 + 30;
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
    .filter((entry) => entry.text?.trim() && timeToMinutes(entry.time) >= current)
    .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time))[0];
}

function renderEmployeeDetailFields() {
  document.getElementById("employeeReport").value = getSelectedLog().report || "";
  document.getElementById("employeeMemo").value = getSelectedLog().memo || "";
}

function renderClockPanel() {
  const log = getSelectedLog();
  document.getElementById("clockInTime").value = log.clockIn || "";
  document.getElementById("clockOutTime").value = log.clockOut || "";
  const button = document.getElementById("attendanceCycleButton");
  if (button) button.textContent = getNextAttendanceAction(log);
}

function getNextAttendanceAction(log = getSelectedLog()) {
  if (!log.clockIn || log.attendanceStep === "ready") return "출근";
  if (!log.clockOut || log.attendanceStep === "in") return "퇴근";
  if (log.attendanceStep === "out") return "조퇴";
  return "출근";
}

function applyAttendanceCycle() {
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
  saveState();
  renderClockPanel();
  renderTodayContext();
  renderReport();
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
  state.attendance ||= {};
  state.attendance[getActiveDateKey()] ||= [];
  list.innerHTML = "";
  state.attendance[getActiveDateKey()].forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "attendance-row";
    row.innerHTML = `
      <select aria-label="소속">
        ${organizationOptions.map((option) => `<option value="${escapeAttr(option)}" ${item.org === option ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
      </select>
      <input type="text" value="${escapeAttr(item.role)}" placeholder="직책" aria-label="직책" />
      <input type="text" value="${escapeAttr(item.name)}" placeholder="이름" aria-label="이름" />
      <select aria-label="근태">
        ${["정상", "지각", "조퇴", "휴무", "외근", "결근"].map((status) => `<option value="${status}" ${item.status === status ? "selected" : ""}>${status}</option>`).join("")}
      </select>
      <input type="text" value="${escapeAttr(item.note)}" placeholder="메모" aria-label="메모" />
    `;
    const [org, role, name, status, note] = row.querySelectorAll("select, input");
    org.onchange = () => updateAttendance(index, "org", org.value);
    role.oninput = () => updateAttendance(index, "role", role.value);
    name.oninput = () => updateAttendance(index, "name", name.value);
    status.onchange = () => updateAttendance(index, "status", status.value);
    note.oninput = () => updateAttendance(index, "note", note.value);
    list.appendChild(row);
  });
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
  const entries = (log.schedule || []).filter((entry) => entry.text.trim());
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
    ...entries.map((entry) => `- ${entry.time || "--:--"} ${entry.text} (${entry.status})`),
    "",
    `3. 완료 업무: ${completed.length}건`,
    ...completed.map((task) => `- ${task.priority} ${task.text}`),
    "",
    `4. 이슈/지원 필요: ${blocked.length}건`,
    ...blocked.map((entry) => `- ${entry.text} (${entry.status})`),
    "",
    "5. 업무보고",
    log.report || "-",
    "",
    "6. 메모",
    log.memo || "-",
  ].join("\n");
}

function switchView(view) {
  document.querySelectorAll(".worklog-tabs button").forEach((button) => button.classList.toggle("is-active", button.dataset.view === view));
  document.querySelectorAll(".worklog-view").forEach((panel) => panel.classList.toggle("is-active", panel.id === `view-${view}`));
  renderGlobalEmployeeIdentity();
  renderOsDashboard();
  renderAiCoach();
  renderAttendance();
  renderManagement();
  renderOrganization();
}

function renderAll() {
  renderGlobalEmployeeIdentity();
  renderOsDashboard();
  renderAiCoach();
  renderEmployeeSelect();
  renderProfileForm();
  renderEntries();
  renderAttendance();
  renderManagement();
  renderOrganization();
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

document.getElementById("settingsGearButton").onclick = () => {
  renderProfileForm();
  switchView("auth");
};
document.getElementById("closeAuthButton").onclick = () => switchView("today");
document.querySelectorAll("[data-auth-tab]").forEach((button) => {
  button.onclick = () => switchAuthTab(button.dataset.authTab);
});
document.getElementById("saveProfileButton").onclick = saveProfileFromForm;
document.getElementById("loginButton").onclick = signInWithSupabase;
document.getElementById("signupButton").onclick = signUpWithSupabase;
document.getElementById("logoutButton").onclick = signOutWithSupabase;
document.getElementById("employeeSelect").onchange = (event) => {
  state.selectedEmployeeId = event.target.value;
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
  yearGrid.hidden = !yearGrid.hidden;
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
  const log = getSelectedLog();
  log.scheduleUnit = log.scheduleUnit === "60" ? "30" : "60";
  normalizeEmployeeLogRows(log);
  saveState();
  renderEntries();
};
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
document.getElementById("addAttendanceButton").onclick = addAttendance;
document.getElementById("attendanceCycleButton").onclick = applyAttendanceCycle;
document.getElementById("clockInTime").oninput = (event) => {
  getSelectedLog().clockIn = event.target.value;
  getSelectedLog().attendanceStep = event.target.value ? "in" : "ready";
  getSelectedLog().attendanceStatus = event.target.value ? "출근" : "";
  saveState();
  renderClockPanel();
  renderTodayContext();
  renderReport();
};
document.getElementById("clockOutTime").oninput = (event) => {
  getSelectedLog().clockOut = event.target.value;
  getSelectedLog().attendanceStep = event.target.value ? "out" : "in";
  getSelectedLog().attendanceStatus = event.target.value ? "퇴근" : "출근";
  saveState();
  renderClockPanel();
  renderTodayContext();
  renderReport();
};
document.getElementById("employeeReport").oninput = (event) => {
  getSelectedLog().report = event.target.value;
  saveState();
  renderReport();
};
document.getElementById("employeeMemo").oninput = (event) => {
  getSelectedLog().memo = event.target.value;
  saveState();
  renderReport();
};
document.getElementById("reportTone").onchange = (event) => {
  state.reportTone = event.target.value;
  saveState();
};
document.getElementById("worklogAiButton").onclick = () => {
  alert("Bangju AI는 업무일지, 근태, 경영 이슈를 모아 일일 보고·리스크 감지·다음 행동 추천으로 연결합니다.");
};
window.addEventListener("resize", renderResponsiveMode);

renderResponsiveMode();
normalizeState();
document.getElementById("reportTone").value = state.reportTone;
document.getElementById("authEmail").value = state.profile.email || "";
renderAuthStatus();
renderAll();
initializeAuth();

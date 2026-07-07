const storageKey = "beyond-worklog-state-v1";
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
  ["?", "?"],
];
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

const state = loadState();

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
    selectedEmployeeId: "profile-user",
    selectedDateKey: todayKey,
    profile: { ...defaultProfile },
    employeeLogs: {
      [todayKey]: { "profile-user": createEmployeeLog(profileEmployee, defaultProfile) },
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

function createEmployeeLog(employee = employees[0], profile = state?.profile || defaultProfile) {
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
    report: "",
    memo: "",
    record: "",
  };
}

function normalizeState() {
  state.selectedEmployeeId ||= "profile-user";
  state.profile = { ...defaultProfile, ...(state.profile || {}) };
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
    task.priority ||= index === 0 ? "A" : index === 1 ? "B" : "?";
    if (task.priority === "C") task.priority = "?";
    task.status ||= "예정";
    task.done ||= false;
    task.text ||= "";
  });
  while (log.tasks.length < 14) {
    log.tasks.push({ priority: "?", text: "", status: "예정", done: false });
  }
  const scheduleByTime = new Map(log.schedule.map((item) => [item.time, item]));
  log.schedule = getScheduleTimes().map((time) => {
    const item = scheduleByTime.get(time) || { time, text: "", status: "예정" };
    item.time = time;
    item.text ||= "";
    item.status ||= "예정";
    return item;
  });
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
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

function moveSelectedDate(offsetDays) {
  const date = parseDateKey(getActiveDateKey());
  date.setDate(date.getDate() + offsetDays);
  state.selectedDateKey = formatDateKey(date);
  normalizeState();
  saveState();
  renderAll();
}

function formatKoreanDate(key) {
  const date = parseDateKey(key);
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")} (${weekdays[date.getDay()]})`;
}

function currentTimeValue() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function renderDateNav() {
  document.getElementById("selectedDateButton").textContent = formatKoreanDate(getActiveDateKey());
}

function renderEmployeeTitle() {
  const employee = getSelectedEmployee();
  document.getElementById("todayTitle").textContent = `${employee.org} 업무일지. ${employee.role} ${employee.name}`;
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
  renderAll();
  switchView("today");
}

function switchAuthTab(tab) {
  document.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.authTab === tab);
  });
  document.querySelectorAll(".auth-panel").forEach((panel) => {
    panel.classList.toggle("is-active", panel.id === `auth-panel-${tab}`);
  });
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
  const list = document.getElementById("entryList");
  const log = getSelectedLog();
  normalizeEmployeeLogRows(log);
  const entries = log.schedule || [];
  list.innerHTML = "";
  entries.forEach((entry, index) => {
    const row = document.createElement("div");
    row.className = "schedule-row";
    row.innerHTML = `
      <strong>${escapeHtml(entry.time)}</strong>
      <input type="text" value="${escapeAttr(entry.text)}" placeholder="일정" aria-label="${escapeAttr(entry.time)} 일정" />
      <button type="button" aria-label="${escapeAttr(entry.time)} 일정 입력">+</button>
    `;
    const text = row.querySelector("input");
    text.oninput = () => updateEntry(index, "text", text.value);
    row.querySelector("button").onclick = () => text.focus();
    list.appendChild(row);
  });
  renderPriorityBoard();
  renderEmployeeDetailFields();
  renderClockPanel();
  renderEmployeeTitle();
  renderDateNav();
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
  const emptySlot = getSelectedLog().schedule.find((entry) => !entry.text.trim());
  if (emptySlot) {
    saveState();
    renderEntries();
  }
}

function renderPriorityBoard() {
  const board = document.getElementById("priorityBoard");
  const log = getSelectedLog();
  normalizeEmployeeLogRows(log);
  board.innerHTML = log.tasks.map((task, index) => renderTaskRow(task, index)).join("");
  board.querySelectorAll("[data-task-field]").forEach((field) => {
    const index = Number(field.dataset.taskIndex);
    const key = field.dataset.taskField;
    const eventName = field.type === "checkbox" || field.tagName === "SELECT" ? "change" : "input";
    field.addEventListener(eventName, () => updateTask(index, key, field.type === "checkbox" ? field.checked : field.value));
  });
  board.querySelectorAll("[data-task-remove]").forEach((button) => {
    button.onclick = () => clearTask(Number(button.dataset.taskIndex));
  });
}

function renderTaskRow(task, index) {
  return `
    <div class="priority-task ${task.done ? "is-done" : ""}">
      <input type="checkbox" data-task-index="${index}" data-task-field="done" ${task.done ? "checked" : ""} aria-label="완료" />
      <select data-task-index="${index}" data-task-field="priority" aria-label="우선순위">
        ${priorityOptions.map(([value, label]) => `<option value="${value}" ${task.priority === value ? "selected" : ""}>${label}</option>`).join("")}
      </select>
      <input type="text" data-task-index="${index}" data-task-field="text" value="${escapeAttr(task.text)}" placeholder="우선업무" aria-label="우선업무" />
      ${task.text?.trim() ? `<span class="task-tag">${escapeHtml(task.status || "예정")}</span>` : ""}
      <button type="button" data-task-index="${index}" data-task-remove aria-label="업무 삭제">×</button>
    </div>
  `;
}

function addTask(priority, shouldRender = true) {
  const task = { priority, text: "", status: "예정", done: false };
  getSelectedLog().tasks.push(task);
  saveState();
  if (shouldRender) renderEntries();
  return task;
}

function updateTask(index, field, value) {
  const task = getSelectedLog().tasks[index];
  task[field] = value;
  if (field === "done") task.status = value ? "완료" : "진행";
  saveState();
  renderTodayContext();
  renderReport();
  if (["done", "priority"].includes(field)) renderPriorityBoard();
}

function clearTask(index) {
  const task = getSelectedLog().tasks[index];
  task.text = "";
  task.status = "예정";
  task.done = false;
  if (index > 1) task.priority = "?";
  saveState();
  renderPriorityBoard();
  renderTodayContext();
  renderReport();
}

function renderEmployeeDetailFields() {
  document.getElementById("employeeReport").value = getSelectedLog().report || "";
  document.getElementById("employeeMemo").value = getSelectedLog().memo || "";
}

function renderClockPanel() {
  const log = getSelectedLog();
  document.getElementById("clockInTime").value = log.clockIn || "";
  document.getElementById("clockOutTime").value = log.clockOut || "";
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
  node.innerHTML = [
    ["직원", employee.name],
    ["소속", employee.org.split(" / ").at(-1)],
    ["출근", log.clockIn || "미기록"],
    ["퇴근", log.clockOut || "미기록"],
    ["우선업무", `${tasks.filter((task) => task.text.trim()).length}건`],
    ["완료", `${completed}건`],
    ["이슈", `${support}건`],
    ["근태", attendance.find((item) => item.employeeId === employee.id)?.status || "미기록"],
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
  const staffCount = bangjuOrganization.reduce((sum, company) => sum + company.staff + company.units.reduce((unitSum, unit) => unitSum + unit.staff, 0), 0);
  const companies = bangjuOrganization.length;
  const units = bangjuOrganization.reduce((sum, company) => sum + company.units.length, 0);
  const openIssues = entries.filter((entry) => entry.status === "보류" || entry.status === "지원필요").length;
  node.innerHTML = [
    ["법인", `${companies}개`],
    ["부서/현장", `${units}개`],
    ["관리 인원", `${staffCount}명+`],
    ["오늘 근태", `${attendance.length}건`],
    ["경영 이슈", `${openIssues}건`],
    ["AI 점검", openIssues ? "지원 필요 항목 우선" : "정상 흐름"],
  ].map(([label, value]) => `<article><span>${label}</span><strong>${value}</strong></article>`).join("");
}

function renderOrganization() {
  const node = document.getElementById("organizationTree");
  node.innerHTML = bangjuOrganization.map((company) => `
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
  renderAttendance();
  renderManagement();
  renderOrganization();
}

function renderAll() {
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
document.getElementById("employeeSelect").onchange = (event) => {
  state.selectedEmployeeId = event.target.value;
  saveState();
  renderEntries();
};
document.getElementById("prevDateButton").onclick = () => moveSelectedDate(-1);
document.getElementById("selectedDateButton").onclick = () => {
  state.selectedDateKey = todayKey;
  normalizeState();
  saveState();
  renderAll();
};
document.getElementById("nextDateButton").onclick = () => moveSelectedDate(1);
document.getElementById("addEntryButton").onclick = () => {
  alert("시간별 일정 AI 추천은 이후 Beyond Work 오늘 섹션의 추천 로직과 연결합니다.");
};
document.querySelectorAll("[data-section-ai]").forEach((button) => {
  button.onclick = () => alert("오늘의 우선업무 AI 추천은 이후 Beyond Work 추천 로직과 연결합니다.");
});
document.getElementById("addAttendanceButton").onclick = addAttendance;
document.getElementById("clockInButton").onclick = () => {
  getSelectedLog().clockIn = currentTimeValue();
  saveState();
  renderClockPanel();
  renderTodayContext();
  renderReport();
};
document.getElementById("clockOutButton").onclick = () => {
  getSelectedLog().clockOut = currentTimeValue();
  saveState();
  renderClockPanel();
  renderTodayContext();
  renderReport();
};
document.getElementById("clockInTime").oninput = (event) => {
  getSelectedLog().clockIn = event.target.value;
  saveState();
  renderTodayContext();
  renderReport();
};
document.getElementById("clockOutTime").oninput = (event) => {
  getSelectedLog().clockOut = event.target.value;
  saveState();
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

normalizeState();
document.getElementById("reportTone").value = state.reportTone;
renderAll();

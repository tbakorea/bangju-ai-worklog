#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const TODAY = "2026-08-02";
const DAY_COUNT = 90;
const activeFitnessManagerEmail = "pinong0@naver.com";
const retiredFitnessManagerEmails = new Set(["pjhong0@naver.com", "pjhong1@naver.com", "pjhong9@naver.com"]);
const failures = [];
const notes = [];

function read(file) {
  const target = join(rootDir, file);
  return existsSync(target) ? readFileSync(target, "utf8") : "";
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function mulberry32(seed) {
  return function nextRandom() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260802);

function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function dateFromKey(value) {
  return new Date(`${value}T00:00:00+09:00`);
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(value, days) {
  const date = dateFromKey(value);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

function dayOfWeek(value) {
  return dateFromKey(value).getDay();
}

function parseTime(value) {
  if (String(value).trim() === "24:00") return 1440;
  const [hour = "0", minute = "0"] = String(value || "00:00").split(":");
  return Number(hour) * 60 + Number(minute);
}

function minutesToTime(minutes) {
  const bounded = Math.max(0, Math.min(1440, minutes));
  if (bounded === 1440) return "24:00";
  const hour = Math.floor(bounded / 60);
  const minute = bounded % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseWorkHours(value = "08:00-18:00") {
  const match = String(value || "").match(/(\d{1,2}:\d{2})\s*[-~]\s*(\d{1,2}:\d{2})/);
  if (!match) return { start: 8 * 60, end: 18 * 60 };
  return { start: parseTime(match[1]), end: Math.max(parseTime(match[1]) + 60, parseTime(match[2])) };
}

function slotsForRange(range, unit = 60) {
  const slots = [];
  for (let time = range.start; time <= range.end; time += unit) {
    slots.push(minutesToTime(time));
  }
  return [...new Set(slots)];
}

function isFitnessOrg(employee) {
  return /비욘드\s*피트니스|beyond\s*fitness/i.test(`${employee.org || ""} ${employee.workplace || ""}`);
}

function isPlaceholderEmployee(employee) {
  const email = normalizeEmail(employee.email);
  const name = String(employee.name || "").trim();
  const role = String(employee.role || "").trim();
  return (
    !name
    || !email.includes("@")
    || employee.status === "template"
    || /spare|template|placeholder/i.test(employee.id || "")
    || /^(예비|직원|센터장|트레이너|인포|인포데스크|대리|대표|실장)$/u.test(name)
    || (/^(토요 인포|일요 인포)$/u.test(name) && !email.includes("@"))
    || (/^(직원|센터장|트레이너|인포|대리|대표|실장)$/u.test(role) && name === role)
  );
}

function isRetiredParkDuplicate(employee) {
  return retiredFitnessManagerEmails.has(normalizeEmail(employee.email));
}

function isActiveOperationalEmployee(employee) {
  return employee.status !== "retired" && employee.status !== "rejected" && !isPlaceholderEmployee(employee) && !isRetiredParkDuplicate(employee);
}

function collapseByEmail(employees) {
  const map = new Map();
  employees.forEach((employee) => {
    const email = normalizeEmail(employee.email);
    if (!email || !email.includes("@")) return;
    const existing = map.get(email);
    if (!existing || employee.updatedAt > existing.updatedAt) map.set(email, employee);
  });
  return [...map.values()];
}

function canonicalFitnessEmployees(employees) {
  return collapseByEmail(employees)
    .filter((employee) => isActiveOperationalEmployee(employee) && isFitnessOrg(employee))
    .filter((employee) => normalizeEmail(employee.email) !== "pjhong0@naver.com")
    .filter((employee) => normalizeEmail(employee.email) !== "pjhong1@naver.com")
    .filter((employee) => normalizeEmail(employee.email) !== "pjhong9@naver.com")
    .sort((a, b) => {
      const roleOrder = ["센터장", "트레이너", "인포데스크", "인포", "직원"];
      return (roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role)) || a.name.localeCompare(b.name, "ko");
    });
}

function workRangeFor(employee, targetDate) {
  const weekday = String(dayOfWeek(targetDate));
  const weekly = employee.weeklyWorkHours?.[weekday];
  return parseWorkHours(weekly || employee.workHours || "08:00-18:00");
}

function employeeWorksThatDay(employee, targetDate) {
  return (employee.workDays || [1, 2, 3, 4, 5]).includes(dayOfWeek(targetDate));
}

function isWorklogDateEditable(targetDate, nowIso = "2026-08-02T09:30:00+09:00", correctionUntil = "") {
  const now = new Date(nowIso);
  const today = dateKey(now);
  if (targetDate === today) return true;
  if (correctionUntil && new Date(correctionUntil).getTime() > now.getTime()) return true;
  const yesterday = addDays(today, -1);
  if (targetDate === yesterday) return now.getHours() < 10;
  return false;
}

function canEditWorklog(actor, owner, targetDate, correctionUntil = "") {
  if (!actor || !owner) return false;
  if (actor.id !== owner.id) return false;
  return isWorklogDateEditable(targetDate, "2026-08-02T09:30:00+09:00", correctionUntil);
}

function canReadWorklog(actor, owner) {
  if (!actor || !owner) return false;
  if (actor.id === owner.id) return true;
  if (actor.permissions?.includes("all_worklogs_read")) return true;
  if (actor.permissions?.includes("workplace_worklogs_read") && actor.workplace === owner.workplace) return true;
  return false;
}

function buildEmployees() {
  const fixtures = [
    { id: "ceo-j3010", name: "정찬훈", nickname: "Benny", email: "j3010@ymail.com", org: "(주)방주", workplace: "본사", role: "대표", employmentType: "대표", workHours: "08:00-18:00", workDays: [1, 2, 3, 4, 5], permissions: ["all_worklogs_read", "all_labor_read", "employee_manage", "approval_manage"], status: "approved" },
    { id: "bangju-finance-assistant", name: "이소미", nickname: "이소미", email: "thal1440@naver.com", org: "(주)방주", workplace: "재무", role: "재무 대리", employmentType: "직원", workHours: "08:00-18:00", workDays: [1, 2, 3, 4, 5], permissions: ["own_worklog", "own_labor"], status: "approved" },
    { id: "bangju-finance-manager", name: "최희진", nickname: "최희진", email: "yangpa1062@naver.com", org: "(주)방주", workplace: "재무", role: "재무과장", employmentType: "직원", workHours: "08:00-18:00", workDays: [1, 2, 3, 4, 5], permissions: ["workplace_worklogs_read", "own_labor"], status: "approved" },
    { id: "beyond-company-leader", name: "김성민", nickname: "김성민", email: "tbakorea@gmail.com", org: "(주)비욘드컴퍼니", workplace: "TBA studio", role: "실장", employmentType: "직원", workHours: "09:00-18:00", workDays: [1, 2, 3, 4, 5], permissions: ["own_worklog", "own_labor"], status: "approved" },
    { id: "beyond-shared-manager", name: "추소영", nickname: "추소영", email: "l9900820@naver.com", org: "(주)비욘드컴퍼니", workplace: "공유사업부", role: "매니저", employmentType: "직원", workHours: "09:00-18:00", workDays: [1, 2, 3, 4, 5], permissions: ["own_worklog", "own_labor"], status: "approved" },
    { id: "fitness-manager", name: "박주홍", nickname: "박주홍", email: activeFitnessManagerEmail, org: "비욘드 피트니스", workplace: "비욘드 피트니스", role: "센터장", employmentType: "직원", workHours: "06:00-24:00", workDays: [0, 1, 2, 3, 4, 5, 6], permissions: ["workplace_worklogs_read", "own_labor"], status: "approved" },
    { id: "fitness-trainer-hong", name: "홍현규", nickname: "홍현규", email: "gusrd1005@gmail.com", org: "비욘드 피트니스", workplace: "비욘드 피트니스", role: "트레이너", employmentType: "프리랜서", workHours: "06:00-24:00", workDays: [0, 1, 2, 3, 4, 5, 6], permissions: ["own_worklog", "own_labor"], status: "approved" },
    { id: "fitness-info-honggildong", name: "홍길동", nickname: "홍길동", email: "projch@naver.com", org: "비욘드 피트니스", workplace: "비욘드 피트니스", role: "인포데스크", employmentType: "직원", workHours: "16:00-20:00", workDays: [1, 2, 3, 4, 5], permissions: ["own_worklog", "own_labor"], status: "approved" },
    { id: "fitness-info-idabin", name: "이다빈", nickname: "이다빈", email: "dlekqls89@naver.com", org: "비욘드 피트니스", workplace: "비욘드 피트니스", role: "인포데스크", employmentType: "직원", workHours: "10:00-18:00", workDays: [1, 2, 3, 4, 5], permissions: ["own_worklog", "own_labor"], status: "approved" },
    { id: "fitness-info-kimyoungchae", name: "김영채", nickname: "김영채", email: "yckim1558@naver.com", org: "비욘드 피트니스", workplace: "비욘드 피트니스", role: "인포", employmentType: "직원", workHours: "10:00-18:00", workDays: [1, 2, 3, 4, 5], permissions: ["own_worklog", "own_labor"], status: "approved" },
    { id: "fitness-info-shinsemin", name: "신세민", nickname: "신세민", email: "tpals2990@naver.com", org: "비욘드 피트니스", workplace: "비욘드 피트니스", role: "인포", employmentType: "직원", workHours: "10:00-18:00", workDays: [1, 2, 3, 4, 5], permissions: ["own_worklog", "own_labor"], status: "approved" },
    { id: "retired-park-0", name: "박주홍", email: "pjhong0@naver.com", org: "비욘드 피트니스", workplace: "비욘드 피트니스", role: "센터장", status: "retired" },
    { id: "retired-park-1", name: "박주홍", email: "pjhong1@naver.com", org: "비욘드 피트니스", workplace: "비욘드 피트니스", role: "센터장", status: "retired" },
    { id: "retired-park-9", name: "박주홍", email: "pjhong9@naver.com", org: "비욘드 피트니스", workplace: "비욘드 피트니스", role: "직원", status: "retired" },
    { id: "template-fitness-spare", name: "직원", email: "", org: "비욘드 피트니스", workplace: "비욘드 피트니스", role: "직원", status: "template" },
  ];

  const orgs = [
    ["(주)방주", "재무", ["재무과장", "재무 대리", "직원"]],
    ["(주)비욘드컴퍼니", "공유사업부", ["매니저", "직원"]],
    ["(주)비욘드컴퍼니", "TBA studio", ["실장", "직원"]],
    ["(주)비제이종합건설", "옥동 더헤이븐빌 신축현장", ["소장", "과장", "직원"]],
    ["비욘드 피트니스", "비욘드 피트니스", ["트레이너", "인포데스크", "인포"]],
  ];
  let serial = 1;
  while (fixtures.filter(isActiveOperationalEmployee).length < 100) {
    const [org, workplace, roles] = orgs[serial % orgs.length];
    const role = roles[serial % roles.length];
    fixtures.push({
      id: `sim-employee-${String(serial).padStart(3, "0")}`,
      name: `시뮬직원${String(serial).padStart(3, "0")}`,
      nickname: `직원${serial}`,
      email: `sim${String(serial).padStart(3, "0")}@bangju.test`,
      org,
      workplace,
      role,
      employmentType: role === "트레이너" ? "프리랜서" : "직원",
      workHours: role === "트레이너" ? "06:00-24:00" : "08:00-18:00",
      workDays: [1, 2, 3, 4, 5],
      permissions: ["own_worklog", "own_labor"],
      status: "approved",
    });
    serial += 1;
  }
  return fixtures.map((employee, index) => ({ ...employee, updatedAt: index }));
}

const employees = buildEmployees();
const activeEmployees = collapseByEmail(employees).filter(isActiveOperationalEmployee).slice(0, 100);
const ceo = activeEmployees.find((employee) => normalizeEmail(employee.email) === "j3010@ymail.com");
const hongGildong = activeEmployees.find((employee) => normalizeEmail(employee.email) === "projch@naver.com");
const kimSungmin = activeEmployees.find((employee) => normalizeEmail(employee.email) === "tbakorea@gmail.com");
const parkJuhong = activeEmployees.find((employee) => normalizeEmail(employee.email) === activeFitnessManagerEmail);
const dates = Array.from({ length: DAY_COUNT }, (_, index) => addDays(TODAY, index - DAY_COUNT + 1));
const logs = new Map();

function randomInt(max) {
  return Math.floor(rand() * max);
}

function makeTask(employee, targetDate, index) {
  const wordsByOrg = isFitnessOrg(employee)
    ? ["상담 후보 확인", "센터 정리", "유료PT 기록", "회원 응대", "락커 확인"]
    : ["계약 검토", "자금 확인", "공통일정 확인", "보고 정리", "거래처 연락"];
  const status = rand() < 0.16 ? "완료" : rand() < 0.08 ? "연기" : "미완료";
  return {
    id: `${employee.id}-${targetDate}-task-${index}`,
    text: wordsByOrg[(index + randomInt(wordsByOrg.length)) % wordsByOrg.length],
    status,
    done: status === "완료",
  };
}

function makeSchedule(employee, targetDate, range, offDayWork) {
  const slots = slotsForRange(range, 60);
  const appointment = {};
  slots.forEach((slot, index) => {
    if (!offDayWork && rand() < 0.45) return;
    if (isFitnessOrg(employee)) {
      const options = ["(유료PT) 회원 수업", "(무료PT) 체험 수업", "(상담) 신규 문의", "(운영) 센터관리", "(홍보) 후기 요청"];
      appointment[slot] = rand() < 0.42 ? options[(index + randomInt(options.length)) % options.length] : "";
    } else {
      const options = ["일정", "보고 정리", "계약 검토", "자금 확인", "공통업무 확인"];
      appointment[slot] = rand() < 0.36 ? options[(index + randomInt(options.length)) % options.length] : "";
    }
  });
  return appointment;
}

function fitnessMetrics(appointments) {
  const text = Object.values(appointments).join(" ");
  const count = (regex) => (text.match(regex) || []).length;
  return {
    paidPt: count(/유료PT|정규PT|\(P\/T\)/g),
    freePt: count(/무료PT|체험/g),
    counsel: count(/상담/g),
    contract: count(/계약|등록|재등록/g),
    promo: count(/홍보|후기|아웃바운드|인바운드/g),
  };
}

for (const employee of activeEmployees) {
  for (const targetDate of dates) {
    const scheduledWork = employeeWorksThatDay(employee, targetDate);
    const offDayWork = !scheduledWork && rand() < 0.08;
    const shouldWrite = scheduledWork || offDayWork || rand() < 0.02;
    const baseRange = workRangeFor(employee, targetDate);
    const range = offDayWork
      ? parseWorkHours("10:00-15:00")
      : { ...baseRange, end: rand() < 0.07 ? Math.min(1440, baseRange.end + 60) : baseRange.end };
    const appointments = shouldWrite ? makeSchedule(employee, targetDate, range, offDayWork) : {};
    const tasks = shouldWrite ? Array.from({ length: randomInt(5) }, (_, index) => makeTask(employee, targetDate, index)) : [];
    const metrics = isFitnessOrg(employee) ? fitnessMetrics(appointments) : {};
    logs.set(`${employee.id}:${targetDate}`, {
      employeeId: employee.id,
      date: targetDate,
      tasks,
      appointments,
      range,
      attendance: shouldWrite ? { in: minutesToTime(range.start), out: minutesToTime(range.end) } : null,
      metrics,
      offDayWork,
    });
  }
}

function logFor(employee, targetDate) {
  return logs.get(`${employee.id}:${targetDate}`);
}

const fitnessRoster = canonicalFitnessEmployees(employees);
const fitnessEmails = new Set(fitnessRoster.map((employee) => normalizeEmail(employee.email)));
assert(activeEmployees.length === 100, `active employee count should be 100, got ${activeEmployees.length}`);
assert(Boolean(ceo), "CEO account j3010@ymail.com must exist in simulation");
assert(Boolean(hongGildong), "홍길동 profile must exist");
assert(Boolean(kimSungmin), "김성민 profile must exist");
assert(Boolean(parkJuhong), "박주홍 active profile must be pinong0@naver.com");
assert(!activeEmployees.some((employee) => retiredFitnessManagerEmails.has(normalizeEmail(employee.email))), "retired Park manager accounts must not be active");
assert(fitnessEmails.has("yckim1558@naver.com"), "피트니스 직원 김영채 must be included in canonical roster");
assert(fitnessEmails.has("tpals2990@naver.com"), "피트니스 직원 신세민 must be included in canonical roster");
assert(fitnessEmails.has("dlekqls89@naver.com"), "피트니스 직원 이다빈 must be included in canonical roster");
assert(fitnessEmails.has("gusrd1005@gmail.com"), "피트니스 직원 홍현규 must be included in canonical roster");
assert(!fitnessRoster.some((employee) => isPlaceholderEmployee(employee)), "fitness center roster must not include blank/template employees");
assert(!fitnessRoster.some((employee) => !isFitnessOrg(employee)), "fitness center roster must not include other workplace employees");

const deviceAProfile = { ...hongGildong, workplace: "비욘드 피트니스", updatedAt: 1 };
const deviceBProfile = { ...hongGildong, workplace: "(주)방주", updatedAt: 0 };
const canonicalHong = collapseByEmail([deviceBProfile, deviceAProfile]).find((employee) => normalizeEmail(employee.email) === "projch@naver.com");
assert(canonicalHong.workplace === "비욘드 피트니스", "same-email profile should not diverge by device; newest canonical profile wins");
assert(canReadWorklog(ceo, hongGildong), "CEO should read every employee worklog");
assert(!canEditWorklog(ceo, hongGildong, TODAY), "CEO viewing an employee worklog must not edit the employee's own fields");
assert(canEditWorklog(hongGildong, hongGildong, TODAY), "employee should edit today's own worklog");
assert(!canEditWorklog(hongGildong, parkJuhong, TODAY), "employee must not edit another employee's worklog");
assert(isWorklogDateEditable(addDays(TODAY, -1), "2026-08-02T09:59:00+09:00"), "yesterday should be editable before 10:00");
assert(!isWorklogDateEditable(addDays(TODAY, -1), "2026-08-02T10:01:00+09:00"), "yesterday should lock after 10:00");
assert(!isWorklogDateEditable(addDays(TODAY, -2), "2026-08-02T09:00:00+09:00"), "older dates should lock without correction approval");
assert(isWorklogDateEditable(addDays(TODAY, -7), "2026-08-02T09:00:00+09:00", "2026-08-02T18:00:00+09:00"), "approved correction window should unlock a locked date temporarily");

const parkRange = workRangeFor(parkJuhong, TODAY);
assert(minutesToTime(parkRange.start) === "06:00" && minutesToTime(parkRange.end) === "24:00", "fitness manager schedule should follow 06:00-24:00 work hours");
const offDayLog = [...logs.values()].find((entry) => entry.offDayWork);
assert(Boolean(offDayLog) && Object.keys(offDayLog.appointments).length > 0, "off-day/overtime worklog should still create editable schedule slots");

let fitnessPaidPt = 0;
let fitnessFreePt = 0;
for (const employee of fitnessRoster) {
  for (const targetDate of dates) {
    const entry = logFor(employee, targetDate);
    fitnessPaidPt += entry?.metrics?.paidPt || 0;
    fitnessFreePt += entry?.metrics?.freePt || 0;
  }
}
const laborBillablePt = fitnessPaidPt;
assert(fitnessFreePt >= 0 && laborBillablePt === fitnessPaidPt, "free PT must be tracked but excluded from labor settlement paid PT totals");

const reportDate = "2026-08-02";
const fitnessReportRows = fitnessRoster.map((employee) => ({
  name: employee.name,
  role: employee.role,
  attendance: logFor(employee, reportDate)?.attendance,
  metrics: logFor(employee, reportDate)?.metrics || {},
}));
assert(fitnessReportRows.length === fitnessRoster.length, "fitness report must be generated from the same canonical roster as center status");
assert(fitnessReportRows.every((row) => row.name && !/^(직원|예비)$/u.test(row.name)), "fitness report rows must have real employee names");

const worklogCoverage = [...logs.values()].filter((entry) => entry.tasks.length || Object.values(entry.appointments).some(Boolean)).length;
notes.push(`active employees=${activeEmployees.length}`);
notes.push(`dates=${dates.length}`);
notes.push(`generated worklogs=${logs.size}`);
notes.push(`worklogs with activity=${worklogCoverage}`);
notes.push(`fitness roster=${fitnessRoster.map((employee) => `${employee.role}:${employee.name}`).join(", ")}`);
notes.push(`fitness paid/free PT totals=${fitnessPaidPt}/${fitnessFreePt}`);

const appJs = read("app.js");
const schema = read("supabase/worklog_schema.sql");
assert(appJs.includes(`const activeFitnessManagerEmail = "${activeFitnessManagerEmail}";`), "app.js must pin the active Park manager account to pinong0@naver.com");
assert(appJs.includes("retiredFitnessManagerEmails"), "app.js must keep a retired account guard for duplicate Park manager records");
assert(appJs.includes('"gusrd1005@gmail.com": {') && appJs.includes('mappedEmployeeId: "fitness-trainer-1"'), "Hong Hyeon-gyu account must map to the editable trainer worklog");
assert(schema.includes("delete from auth.users") && schema.includes("pjhong0@naver.com") && schema.includes("pinong0@naver.com"), "duplicate Park manager auth accounts must be removed only after preserving the active account");
assert(appJs.includes("김영채") && appJs.includes("신세민") && appJs.includes("이다빈"), "app.js must include canonical fitness members 김영채/신세민/이다빈");
assert(appJs.includes("function canEditCurrentWorklog") && appJs.includes("function canEditEmployeeSlot"), "app.js must keep owner/edit permission guards");
assert(appJs.includes("weekly_work_hours") && appJs.includes("work_hours"), "app.js must support default and weekday-specific work hours");
assert(schema.includes("pending_profile_changes"), "Supabase schema must include pending_profile_changes for approval diffs");
assert(schema.includes("create or replace function public.repair_profile_approval_queue"), "Supabase schema must include repair_profile_approval_queue RPC");
assert(schema.includes("weekly_work_hours"), "Supabase schema must include weekly_work_hours");

if (failures.length) {
  console.error("100명 x 90일 운영 시뮬레이션 QA 실패:");
  failures.forEach((failure, index) => console.error(`${index + 1}. ${failure}`));
  console.error("\n시뮬레이션 메모:");
  notes.forEach((note) => console.error(`- ${note}`));
  process.exit(1);
}

console.log("100명 x 90일 운영 시뮬레이션 QA 통과");
notes.forEach((note) => console.log(`- ${note}`));

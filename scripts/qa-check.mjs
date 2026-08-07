import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (file) => readFileSync(join(root, file), "utf8");
const html = read("index.html");
const js = read("app.js");
const css = read("styles.css");
const backupApi = existsSync(join(root, "api/backup-mail.js")) ? read("api/backup-mail.js") : "";
const fitnessCoachApi = existsSync(join(root, "api/fitness-coach.js")) ? read("api/fitness-coach.js") : "";
const loginCardHtml = html.slice(html.indexOf('<section class="login-card"'), html.indexOf('<div class="auth-panel'));
const failures = [];

function check(name, condition, detail = "") {
  if (!condition) failures.push(`${name}${detail ? `: ${detail}` : ""}`);
}

function unique(values) {
  return [...new Set(values)];
}

function findAll(pattern, source) {
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

const syntax = spawnSync(process.execPath, ["--check", join(root, "app.js")], { encoding: "utf8" });
check("app.js syntax", syntax.status === 0, syntax.stderr.trim());
const backupApiSyntax = backupApi ? spawnSync(process.execPath, ["--check", join(root, "api/backup-mail.js")], { encoding: "utf8" }) : null;
check("backup mail api exists and parses", Boolean(backupApi) && backupApiSyntax.status === 0, backupApiSyntax?.stderr?.trim() || "api/backup-mail.js is missing");
const fitnessCoachApiSyntax = fitnessCoachApi ? spawnSync(process.execPath, ["--check", join(root, "api/fitness-coach.js")], { encoding: "utf8" }) : null;
check("fitness coach api exists and parses", Boolean(fitnessCoachApi) && fitnessCoachApiSyntax.status === 0, fitnessCoachApiSyntax?.stderr?.trim() || "api/fitness-coach.js is missing");
check("fitness coach keeps OpenAI key server-side", fitnessCoachApi.includes("process.env.OPENAI_API_KEY") && !js.includes("OPENAI_API_KEY"));
check("fitness coach verifies signed-in user", fitnessCoachApi.includes("/auth/v1/user") && fitnessCoachApi.includes("Authorization"));
check("fitness coach uses structured Responses output", fitnessCoachApi.includes("/v1/responses") && fitnessCoachApi.includes('type: "json_schema"'));

const ids = findAll(/id="([^"]+)"/g, html);
const duplicateIds = unique(ids.filter((id, index) => ids.indexOf(id) !== index));
check("no duplicate HTML ids", duplicateIds.length === 0, duplicateIds.join(", "));

const viewIds = new Set(ids.filter((id) => id.startsWith("view-")).map((id) => id.slice(5)));
const viewAliases = new Set(["worklog"]);
const menuTargets = findAll(/data-view="([^"]+)"/g, html);
const missingTargets = unique(menuTargets.filter((target) => !viewIds.has(target) && !viewAliases.has(target)));
check("menu targets resolve to views", missingTargets.length === 0, missingTargets.join(", "));

const menuPopoverTargets = findAll(/data-menu-view="([^"]+)"/g, html);
const missingPopoverTargets = unique(menuPopoverTargets.filter((target) => !viewIds.has(target) && !viewAliases.has(target)));
check("popover menu targets resolve to views", missingPopoverTargets.length === 0, missingPopoverTargets.join(", "));

const localAssets = findAll(/(?:href|src)="\.\/([^"]+)"/g, html);
const missingAssets = unique(localAssets.filter((asset) => !existsSync(join(root, asset))));
check("local assets referenced by HTML exist", missingAssets.length === 0, missingAssets.join(", "));

check(
  "switchView records active view",
  /activeView\s*=\s*view;[\s\S]{0,80}document\.body\.dataset\.activeView\s*=\s*view;/.test(js),
  "body[data-active-view] is required for view-specific layout guards"
);

check(
  "CEO overview layout guard exists",
  css.includes('body[data-view-mode="ceo"][data-active-view="worklog-overview"]:not(.physical-phone-device)'),
  "prevents iPad CEO mode from using the phone-frame overview"
);

check(
  "CEO overview shell uses wide command board width",
  /data-active-view="worklog-overview"[\s\S]*\.worklog-shell[\s\S]*width:\s*min\(1280px,\s*calc\(100vw - 48px\)\)/.test(css),
  "expected wide shell rule for tablet/desktop CEO overview"
);

check(
  "overview date navigation exists",
  ["overviewPrevDateButton", "overviewDateButton", "overviewDateTitle", "overviewNextDateButton", "worklogOverviewTodayButton"].every((id) => ids.includes(id)),
  "date controls must remain present for the overview board"
);

check(
  "physical phone keeps CEO-only mode",
  /function getGlobalViewMode\(\)[\s\S]*if \(isPhysicalPhoneLayout\(\)\) return "ceo";/.test(js),
  "phone should not expose the CEO/classic switch"
);

check(
  "phone general worklog date has final no-ellipsis guard",
  /body\.physical-phone-device #view-today #worklogDayTitle[\s\S]{0,120}font-size:\s*clamp\(14px,\s*3\.85vw,\s*15\.5px\)/.test(css),
  "real-device QA found the full date clips without this final override"
);

check(
  "phone pulse starts with visible text",
  /body\[data-layout-mode="phone"\] #view-today \.worklog-pulse span[\s\S]{0,140}padding-left:\s*12px !important/.test(css),
  "marquee must not start with a blank strip"
);

check(
  "worklog edit permission helper exists",
  /function canEditCurrentWorklog\(view = activeView\)[\s\S]{0,220}isRepresentativeProfile\(\)[\s\S]{0,260}canEditEmployeeSlot/.test(js),
  "viewer access must be separate from employee edit access"
);

check(
  "delegated permissions build proportional menus and guard routes",
  /function renderMainMenuVisibility\(\)[\s\S]{0,2600}canAccessAllWorklogs\(\)[\s\S]{0,700}canAccessStaffSection\(\)[\s\S]{0,500}canOpenLaborSection\(\)/.test(js)
    && /if \(view === "staff" && !canAccessStaffSection\(\)\)/.test(js)
    && /if \(view === "control" && !canAccessControlTower\(\)\)/.test(js)
    && /function canShowApprovalMenu[\s\S]{0,300}staffApproval/.test(js),
  "worklog, staff, labor, and approval menus must follow their own delegated permission"
);

check(
  "delegated permissions persist in protected profile fields",
  /accessPreset: row\.access_preset \|\| "employee"/.test(js)
    && /async function persistEmployeePermissionOverride[\s\S]{0,1200}access_preset:[\s\S]{0,120}permissions/.test(js)
    && read("supabase/worklog_schema.sql").includes("access_preset text not null default 'employee'")
    && read("supabase/worklog_schema.sql").includes("protect_delegated_profile_permissions"),
  "delegated menus must follow the employee across devices without allowing self-escalation"
);

check(
  "general worklog report exports image PDF share and print",
  ["worklogReportImageButton", "worklogReportPdfButton", "worklogReportShareButton", "worklogReportPrintButton"].every((id) => ids.includes(id))
    && /async function renderWorklogReportCanvas\(\)/.test(js)
    && /async function saveWorklogReportImage\(\)/.test(js)
    && /async function saveWorklogReportPdf\(\)/.test(js)
    && /async function shareWorklogDailyReport\(\)/.test(js)
    && /function printWorklogDailyReport\(\)/.test(js),
  "non-fitness daily reports need PNG, PDF, share, and print actions"
);

check(
  "future worklogs keep independent pending remote saves",
  /function scheduleRemoteSave\(delay = 700, dateKey = getActiveDateKey\(\)\)[\s\S]{0,500}saveTimers\.get\(key\)[\s\S]{0,500}saveRemoteSnapshot\(key\)/.test(js)
    && /function buildRemoteSnapshot\(dateKey = getActiveDateKey\(\)\)/.test(js)
    && /async function saveRemoteSnapshot\(dateKey = getActiveDateKey\(\)\)/.test(js),
  "moving to another day must not cancel the unsent worklog for the date just edited"
);

check(
  "priority work carries over only after each date arrives",
  /function normalizeWorklogTaskStatus[\s\S]{0,260}\["진행", "진행중", "처리중"\]/.test(js)
    && /function isWorklogTaskCarryoverEligible[\s\S]{0,420}isInProgress[\s\S]{0,220}!\["완료", "취소", "위임", "연기"\]\.includes\(status\)/.test(js)
    && js.includes("function hasWorklogCarryoverDateArrived")
    && js.includes("activeDateKey <= todayKey")
    && js.includes("function getWorklogTaskRolloverDate")
    && js.includes("postponeDate > sourceDateKey")
    && js.includes("function isWorklogTaskDueForDate")
    && js.includes("isWorklogTaskDueForDate(task, dateKey, activeDateKey)"),
  "unfinished work must wait for the next date, while postponed work starts on its selected date"
);

check(
  "readonly worklogs cap blank priority rows at three",
  /function getVisibleWorklogTaskRefs[\s\S]{0,260}if \(!canEditCurrentWorklog\(view\)\)[\s\S]{0,220}3 - activeRefs\.length/.test(js),
  "every read-only detail path must use the same compact blank-row policy"
);

check(
  "fitness schedule display groups repeated categories",
  js.includes("function formatScheduleTextSmartly")
    && js.includes('.split(/\\s*\\/\\s*(?=\\([^)]+\\))/)')
    && js.includes('texts.filter(Boolean).join(", ")'),
  "same-time entries should not repeat an identical category label"
);

check(
  "fitness schedule time has final no-wrap guard",
  /#view-fitness-log \.fitness-log-schedule-panel \.appointment-time[\s\S]{0,260}white-space:\s*nowrap !important;[\s\S]{0,100}word-break:\s*keep-all !important;/.test(css),
  "representative split view must keep HH:MM on one line"
);

check(
  "DaGym daily facts and generated guidance sync remotely",
  js.includes("dagymDaily: state.dagymDaily || {}")
    && js.includes("fitnessDailyGuidance: state.fitnessDailyGuidance || {}")
    && /function mergeSharedFitnessOperations\(remoteState = \{\}\)[\s\S]{0,2200}remoteState\.dagymDaily[\s\S]{0,1800}remoteState\.fitnessDailyGuidance/.test(js),
  "date-scoped DaGym facts and guidance must follow the existing remote worklog snapshot flow"
);

check(
  "previous operating day generates assigned fitness guidance",
  /function getPreviousDagymOperatingDate[\s\S]{0,300}status === "closed"/.test(js)
    && /function buildTodayFitnessGuidance[\s\S]{0,1800}no-show[\s\S]{0,900}pt-gap[\s\S]{0,900}sales-action/.test(js)
    && ids.includes("fitnessDailyGuidancePanel")
    && ids.includes("dagymCloseButton"),
  "only closed daily facts should drive traceable next-day actions"
);

check(
  "fitness guidance acceptance preserves employee edit boundaries",
  /function acceptFitnessDailyGuidance\(guidanceId\)[\s\S]{0,500}isRepresentativeProfile\(\)[\s\S]{0,180}item\.targetEmployeeId !== ownId[\s\S]{0,120}!canEditEmployeeSlot\(ownId\)/.test(js)
    && /guidanceId: item\.id[\s\S]{0,150}guidanceSourceDateKey: item\.sourceDateKey/.test(js)
    && /cycleWorklogTaskStatus\(editableRef\.task\);[\s\S]{0,80}syncFitnessGuidanceFromTask\(editableRef\.task\)/.test(js),
  "only the assigned employee may accept guidance and task status must flow back to the guidance card"
);

check(
  "fixed employee worklogs require authenticated owner",
  /function canEditEmployeeSlot\(employeeId = ""\)[\s\S]{0,180}if \(!authState\.user\) return false;[\s\S]{0,200}const ownEmployeeId = getProfileMappedEmployeeId\(\) \|\| "profile-user";[\s\S]{0,80}employeeId === ownEmployeeId/.test(js),
  "logged-out or mismatched viewers must not operate another employee's attendance/worklog"
);

check(
  "fitness canonical roster includes current named staff",
  [
    '"fitness-info-kimyoungchae"',
    '"fitness-info-shinsemin"',
    "김영채",
    "신세민",
    "yckim1558@naver.com",
    "tpals2990@naver.com",
  ].every((needle) => js.includes(needle)),
  "center report roster must include 김영채 and 신세민 as canonical fitness employees"
);

check(
  "fitness profile mapping includes current named staff",
  /김영채\|yckim1558[\s\S]{0,120}fitness-info-kimyoungchae/.test(js)
    && /신세민\|tpals2990[\s\S]{0,120}fitness-info-shinsemin/.test(js),
  "approved profile records for 김영채 and 신세민 should map to their fitness worklog slots"
);

check(
  "Hong Hyeon-gyu account is pinned to the trainer worklog",
  /"gusrd1005@gmail\.com": \{[\s\S]{0,700}role: "트레이너"[\s\S]{0,500}mappedEmployeeId: "fitness-trainer-1"/.test(js)
    && /id: "fitness-trainer-1"[^\n]+email: "gusrd1005@gmail\.com"/.test(js)
    && read("supabase/worklog_schema.sql").includes("where lower(coalesce(email, '')) = 'gusrd1005@gmail.com'")
    && read("supabase/worklog_schema.sql").includes("approval_status = 'approved'"),
  "Hong Hyeon-gyu must be approved and mapped to his own editable trainer sheet"
);

check(
  "fitness center roster keeps one active Park manager",
  /const activeFitnessManagerEmail = "pjhong0@naver\.com";/.test(js)
    && /const retiredFitnessManagerEmails = new Set\(\["pjhong1@naver\.com", "pjhong9@naver\.com"\]\);/.test(js)
    && /function isConfirmedFitnessCenterEmployee\(employee = \{\}\)[\s\S]{0,900}isRetiredFitnessManagerEmail\(email\)[\s\S]{0,260}personName === "박주홍" && email && !isActiveFitnessManagerEmail\(email\)/.test(js)
    && /function getFitnessCenterEmployeeKey\(employee = \{\}\) \{[\s\S]{0,120}isFitnessManagerRosterIdentity\(employee\)[\s\S]{0,80}return "person:센터장\|박주홍";/.test(js),
  "retired duplicate accounts and role/name variants must collapse to the single active center-manager slot"
);

check(
  "fitness manager worklog stays isolated from trainer PT records",
  /if \(isActiveFitnessManagerEmail\(email\) \|\| \/박주홍\|센터장\|운영총괄\|manager\/.test\(role\)\) id = "beyond-fitness-manager";[\s\S]{0,120}else if \(\/홍현규\|트레이너\|trainer\|pt\|피티\/.test\(role\)\) id = "fitness-trainer-1";/.test(js)
    && /else if \(isFitnessManagerRosterIdentity\(employee\) \|\| \/박주홍\|센터장\|운영총괄\|manager\/.test\(source\)\) ids.push\("beyond-fitness-manager"\);[\s\S]{0,140}else if \(\/홍현규\|트레이너\|trainer\|pt\|피티\/.test\(source\)\) ids.push\("fitness-trainer-1"\);/.test(js),
  "manager identity must be classified before generic PT keywords so trainer logs cannot leak into the manager page"
);

check(
  "worklog writes are restricted to the current profile identity",
  /function canEditEmployeeSlot\(employeeId = ""\) \{[\s\S]{0,220}if \(isRepresentativeProfile\(\)\) return false;[\s\S]{0,160}const ownEmployeeId = getProfileMappedEmployeeId\(\) \|\| "profile-user";[\s\S]{0,80}return employeeId === ownEmployeeId;/.test(js)
    && /function canApplyMissionToEmployee\(employeeId = ""\) \{[\s\S]{0,100}return canEditEmployeeSlot\(employeeId\);/.test(js),
  "employees and AI actions must only write to the current user's own worklog slot"
);

check(
  "representative personal worklog is removed from remote snapshots",
  /const hasPersonalWorklog = !isRepresentativeProfile\(\);[\s\S]{0,220}const ownerEmployeeId = hasPersonalWorklog \?[\s\S]{0,100}: "";[\s\S]{0,180}const ownerWorklog = hasPersonalWorklog/.test(js)
    && !js.includes("benny 업무일지"),
  "representative accounts must inspect employee logs without creating a representative personal worklog"
);

check(
  "own worklog pages use a distinct background treatment",
  /generalView\.classList\.toggle\("is-own-page", isOwnPage\)/.test(js)
    && /#view-fitness-log\.is-own-page \.fitness-log-task-panel[\s\S]{0,420}#view-today\.is-own-page \.worklog-task-panel/.test(css),
  "the current user's page must be visually distinct from coworker read-only pages"
);

check(
  "coworker worklogs stay inside the active business group",
  js.includes("function getCoworkerEmployeesForWorklog")
    && js.includes("getStaffSiteGroupForEmployee(employee)?.id === groupId")
    && js.includes("data-coworker-worklog-open")
    && html.includes("전체 업무일지로 돌아가기")
    && /function updateWorklogOverviewExitButton[\s\S]{0,420}canAccessWorklogOverview\(\)/.test(js),
  "Bangju, Beyond, and Fitness coworker navigation must not leak employees across business groups"
);

check(
  "fitness quantities use compact daily/monthly totals",
  /function renderFitnessOpsSummaryButton\(log = getSelectedLog\(\)\)[\s\S]{0,1000}buildFitnessCenterEmployeeMonthRow\(employee, getActiveDateKey\(\)\.slice\(0, 7\)\)/.test(js)
    && /<strong>\$\{paidPtTotal\}\/\$\{monthlyPaidPtTotal\}<\/strong>/.test(js)
    && /function renderFitnessPersonalMonthSummary[\s\S]{0,180}panel\.hidden = true;/.test(js)
    && /function buildFitnessCenterEmployeeMonthRow\(employee, monthPrefix\)[\s\S]{0,900}getMonthDateKeys\(monthPrefix\)\.forEach/.test(js)
    && /const employeesForCenter = getFitnessCenterEmployees\(\);[\s\S]{0,180}buildFitnessCenterEmployeeMonthRow\(employee, centerMonth\)/.test(js),
  "personal worklogs should show today/month in existing summary cells without a separate grid"
);

check(
  "fitness monthly totals include every quantity field",
  /Object\.keys\(ops\)\.forEach\(\(key\)[\s\S]{0,240}ops\[key\] = String\(numberValue\(ops\[key\]\) \+ numberValue\(dayOps\[key\]\)/.test(js)
    && /summary\.dayPass \+= numberValue\(row\.ops\.dayPass\)[\s\S]{0,300}summary\.outsideSales \+= numberValue\(row\.ops\.outsideSales\)/.test(js),
  "PT, contracts, consultation, inbound/outbound, day passes, and outside sales must all roll up"
);

check(
  "fitness schedules normalize to each roster employee's work hours",
  js.includes("return employee ? getOverviewScheduledWorkHours(employee, dateKey, {}) : defaultProfile.workHours")
    && js.includes("function alignFitnessEmployeeLogToRoster")
    && js.includes("if (employeeId) log.employeeId = employeeId")
    && js.includes('if (!log.scheduleUnitExplicit) log.scheduleUnit = "60"')
    && js.includes("normalizeEmployeeLogRows(log, dateKey)")
    && js.includes("if (isFitnessEmployeeRecord(employee) && !log.scheduleUnitExplicit)"),
  "aliased and newly added fitness logs must not inherit another employee's hours or 30-minute default"
);

check(
  "fitness center report uses canonical roster",
  /function getFitnessReportLogEntries\(dateKey, isCenter, employee\) \{[\s\S]{0,80}if \(isCenter\) \{[\s\S]{0,80}return getFitnessCenterEmployees\(\)\.map/.test(js),
  "center operating reports must use the same canonical roster as the center page"
);

check(
  "global attendance button requires editable worklog",
  /function updateGlobalAttendanceVisibility\(view = activeView\)[\s\S]{0,160}attendanceEnabledViews\.has\(view\) && canEditCurrentWorklog\(view\)/.test(js),
  "attendance controls must be hidden when viewing another employee"
);

check(
  "attendance records current worklog employee",
  /function applyAttendancePopoverSelection\(\)[\s\S]{0,220}const employee = getAttendanceEmployeeForView\(\);[\s\S]{0,80}getEmployeeLogForDate\(employee\.id\)/.test(js),
  "global attendance must not write to the fitness default employee from other worklogs"
);

check(
  "general worklog readonly controls are applied",
  /function applyCurrentWorklogPermissionState\(viewName = activeView\)[\s\S]{0,1400}#worklogTaskBoard \.task-cycle[\s\S]{0,700}#employeeMemo/.test(js),
  "task, schedule, report, and memo controls should be locked in read-only worklogs"
);

check(
  "readonly worklogs hide destructive controls",
  css.includes("#view-today.is-readonly .task-delete") && css.includes(".fitness-log-view.is-readonly .appointment-merge-button"),
  "delete/add controls should disappear when a worklog is only being viewed"
);

check(
  "personal growth engine exists",
  /function buildPersonalGrowthModel\(employee = getSelectedEmployee\(\), log = getSelectedLog\(\)\)/.test(js) && /function getGrowthRoleTrack/.test(js) && /오늘의 성장 미션/.test(js),
  "AI coaching should turn worklog behavior into visible self-development missions"
);

check(
  "premium AI operating OS exists",
  html.includes('id="view-premium"')
    && html.includes('data-menu-view="premium"')
    && html.includes('data-view="premium"')
    && /function buildPremiumOperatingModel\(\)/.test(js)
    && /function renderPremiumOperatingSystem\(\)/.test(js)
    && /renderPremiumOperatingSystem\(\)/.test(js)
    && css.includes(".premium-operating-hero")
    && css.includes(".premium-agent-grid"),
  "premium operating section should consolidate worklog, labor, growth, revenue, and backup signals without touching worklog editors"
);

check(
  "premium OS is kept inside existing report and coaching flow",
  html.includes('data-section-shortcut="premium-growth"')
    && html.includes('data-section-shortcut="premium-roadmap"')
    && /action\?\.startsWith\("premium-"\)/.test(js)
    && css.includes(".worklog-shell > .premium-operating-view.is-active"),
  "premium features need a single hub and final display guard"
);

check(
  "growth engine has visual competency styles",
  css.includes(".growth-command-card") && css.includes(".growth-competency-card") && css.includes("--growth-score"),
  "self-development progress should be visible, not only textual"
);

check(
  "report backup center markup exists",
  ["backupRecipientEmail", "backupCadence", "copyBackupSummaryButton", "downloadBackupButton", "emailBackupButton", "backupPreview", "backupIntegrityHash", "backupCoverage", "backupPayloadSize", "backupAutomationLane", "validateBackupButton", "restoreBackupButton", "backupRestoreFile", "innovationList"].every((id) => ids.includes(id)),
  "report view should contain the integrated backup center instead of a separate backup menu"
);

check(
  "backup package builder exists",
  /function buildBackupPayload\(options = \{\}\)[\s\S]{0,2600}automationPlan/.test(js) && /function buildBackupSummaryText\(payload = buildBackupPayload\(\)\)/.test(js),
  "backup center needs one reusable JSON package for download, email draft, and future cron"
);

check(
  "backup integrity and restore validation exist",
  /async function hashBackupPayload\(payload\)[\s\S]{0,700}SHA-256/.test(js) && /function validateBackupPayload\(payload\)/.test(js) && /function handleBackupRestoreFile\(event\)/.test(js),
  "advanced backup flow should verify integrity and inspect restore files before applying anything"
);

check(
  "backup mail endpoint is environment-gated",
  /module\.exports = async function handler/.test(backupApi) && /RESEND_API_KEY/.test(backupApi) && /attachments/.test(backupApi),
  "server mail function should be ready for Vercel env secrets without hard-coded credentials"
);

check(
  "backup settings sync with remote snapshot",
  /function buildRemoteSnapshot\(dateKey = getActiveDateKey\(\)\)[\s\S]{0,600}backupSettings: state\.backupSettings/.test(js) && /loadRemoteWorklogForActiveDate\(\)[\s\S]{0,1400}data\.state\.backupSettings/.test(js),
  "backup cadence and recipient should follow the logged-in account across devices"
);

check(
  "backup center styles exist",
  css.includes(".backup-center-card") && css.includes(".backup-health-grid") && css.includes(".backup-automation-lane") && css.includes(".innovation-grid") && css.includes(".report-backup-grid"),
  "backup/report screen needs responsive visual rules"
);

check(
  "backup is not duplicated as a new main menu",
  !html.includes('data-menu-view="backup"') && !html.includes('data-view="backup"'),
  "backup should live inside the existing report flow to avoid menu duplication"
);

check(
  "menu sections use consolidated labels",
  html.includes('data-menu-view="ai">성장지원</button>')
    && html.includes('data-menu-view="report">보고·커뮤니티</button>')
    && html.includes('data-settings-tab="manual">매뉴얼 편집</button>'),
  "growth support and report/community should be named as consolidated destinations"
);

check(
  "section command strips provide in-section navigation",
  html.includes('class="section-command-strip"')
    && html.includes('data-section-shortcut="manual"')
    && html.includes('data-section-shortcut="approval"')
    && html.includes('data-section-shortcut="backup"')
    && /querySelectorAll\("\[data-section-shortcut\]"\)[\s\S]{0,900}switchSettingsTab\("manual"\)/.test(js),
  "major sections need visible local hubs so content is not scattered"
);

check(
  "approval queue uses status list and one-person detail",
  js.includes("function renderApprovalQueue()")
    && js.includes("approval-queue-layout")
    && js.includes("data-approval-select")
    && css.includes(".approval-detail-panel"),
  "approval management should not render every applicant form as one long page"
);

check(
  "phone numbers are normalized across signup and approval",
  js.includes("function formatPhoneNumber")
    && js.includes("isPhoneField(field)")
    && js.includes('field("phone", "전화", row.phone)')
    && (js.includes("formatPhoneNumber(state.profile.phone)") || js.includes("formatPhoneNumber(profile.phone)")),
  "phone inputs should accept digits and display hyphenated Korean phone numbers"
);

check(
  "employee registration sheet has email duplicate and password confirmation gate",
  html.includes('id="emailCheckButton"')
    && html.includes('id="registrationEmail"')
    && html.includes('id="registrationPassword"')
    && html.includes('id="authPasswordConfirm"')
    && !loginCardHtml.includes('id="emailCheckButton"')
    && !loginCardHtml.includes('id="authPasswordConfirm"')
    && js.includes("function checkSignupEmailDuplicate()")
    && js.includes('supabaseClient.rpc("check_registration_email"')
    && /if \(password !== passwordConfirm\)[\s\S]{0,120}비밀번호 확인이 일치하지 않습니다/.test(js),
  "login should stay simple, while new employee registration checks duplicate email and two password entries inside the sheet"
);

check(
  "employee registration keeps approver-only fields out of signup sheet",
  !html.includes('data-profile-field="role"')
    && !html.includes('data-profile-field="employmentType"')
    && !html.includes('data-profile-field="primaryWork"')
    && !html.includes('data-profile-field="secondaryWork"')
    && !html.includes('data-profile-field="hourlyWage"')
    && !html.includes('data-profile-field="dailyWage"')
    && js.includes("profile.role = defaultProfile.role")
    && js.includes("primaryWork: \"\"")
    && js.includes("hourlyWage: \"\""),
  "role, employment type, duties, and wages should be assigned during approval, not by the applicant"
);

check(
  "Supabase schema exposes registration email check and auth-to-profile repair",
  read("supabase/worklog_schema.sql").includes("create or replace function public.check_registration_email")
    && read("supabase/worklog_schema.sql").includes("create or replace function public.repair_profile_approval_queue")
    && read("supabase/worklog_schema.sql").includes("grant execute on function public.repair_profile_approval_queue() to authenticated")
    && read("supabase/worklog_schema.sql").includes("from auth.users u")
    && read("supabase/worklog_schema.sql").includes("where lower(coalesce(u.email, ''))")
    && read("supabase/worklog_schema.sql").includes("update public.profiles p")
    && read("supabase/worklog_schema.sql").includes("from auth.users u")
    && js.includes('supabaseClient.rpc("repair_profile_approval_queue"'),
  "SQL schema and app should support duplicate checks and make Auth signups visible in approval queue"
);

check(
  "staff master supports representative-assigned missions",
  js.includes("function staffDetailMissionEditor")
    && js.includes('data-staff-edit-field="assignedMission"')
    && js.includes('data-staff-edit-field="assignedMissionVisible"')
    && js.includes("getAssignedMissionForEmployee")
    && js.includes("대표 지정 미션")
    && read("supabase/worklog_schema.sql").includes("assigned_mission text not null default ''")
    && read("supabase/worklog_schema.sql").includes("assigned_mission_visible boolean not null default true")
    && read("supabase/worklog_schema.sql").includes("approval and assigned mission fields can only be changed by an approver"),
  "representatives should edit employee facts and assign visible/hidden missions that feed AI coaching"
);

check(
  "off-duty employees are excluded from daily warning signals",
  /function buildEmployeeInsightAlerts[\s\S]{0,260}\["off", "scheduled"\]\.includes\(context\.workStatus\?\.key\)/.test(js)
    && /function getOverviewEmployeeSummaryModel[\s\S]{0,800}workStatus\.key === "off"[\s\S]{0,520}shouldMonitorDailyRecord/.test(js)
    && css.includes("Dense representative fitness cards"),
  "non-working days must not create attendance or blank-worklog warnings, and fitness cards should stay compact"
);

check(
  "dates use hanja weekday ordering",
  js.includes('const hanjaWeekdays = ["日", "月", "火", "水", "木", "金", "土"]')
    && /formatKoreanDate\(key\)[\s\S]{0,260}date\.getFullYear\(\)[\s\S]{0,220}hanjaWeekdays\[date\.getDay\(\)\]/.test(js)
    && html.includes("<span>日</span><span>月</span><span>火</span><span>水</span><span>木</span><span>金</span><span>土</span>"),
  "date labels and calendar headers should use year/month/day/(hanja weekday), starting Sunday"
);

check(
  "calendar marks Korean holidays and lunar anchors",
  /function getKoreanHolidayMap\(year\)[\s\S]{0,1800}대체공휴일/.test(js)
    && /function getLunarAnchorLabel\(dateKey\)[\s\S]{0,220}\[1,\s*10,\s*20,\s*30\]/.test(js)
    && /button\.innerHTML = `[\s\S]{0,260}<small>/.test(js)
    && /is-holiday/.test(css)
    && /has-lunar-anchor/.test(css),
  "all shared calendar sheets should display national/public holidays and lunar 1/10/20/30 labels"
);

check(
  "inactive worklog views are force-hidden at the end of CSS",
  /\.worklog-shell > \.worklog-view:not\(\.is-active\)[\s\S]{0,80}display:\s*none !important;[\s\S]*\.worklog-shell > \.report-backup-view\.is-active[\s\S]{0,80}display:\s*grid !important;/.test(css.slice(-1600)),
  "page-specific display rules must not make report/backup or other views appear under the active worklog"
);

check(
  "desktop employee worklog has compact density guard",
  css.includes('body[data-active-view="bangju-log"]:not(.physical-phone-device) #view-today.is-active')
    && css.includes('body[data-active-view="beyond-log"]:not(.physical-phone-device) #view-today > .planner-section textarea'),
  "desktop employee worklogs should avoid oversized content and long report/memo tails"
);

check(
  "logout clears auth runtime state",
  /function clearAuthRuntimeState\(\)[\s\S]{0,420}authState\.user = null[\s\S]{0,420}authState\.saveTimer = null[\s\S]{0,420}authState\.approvalTimer = null/.test(js)
    && /async function signOutWithSupabase\(\)[\s\S]{0,260}clearAuthRuntimeState\(\)/.test(js),
  "login/logout labels and approval state should not remain stale after sign-out"
);

const riskPatterns = [
  {
    name: "avoid viewport-scaled font for overview hero",
    ok: !/\.worklog-overview-hero h2[\s\S]{0,140}font-size:\s*clamp\([^;]*vw[^;]*\);[\s\S]{0,120}writing-mode/.test(css),
  },
  {
    name: "do not hide overview date title",
    ok: !/#overviewDateTitle[\s\S]{0,120}display:\s*none/.test(css),
  },
  {
    name: "do not force overview cards to phone width on tablet",
    ok: !/data-active-view="worklog-overview"[\s\S]{0,220}\.worklog-overview-employee-sheet[\s\S]{0,160}flex:\s*0 0 min\(86vw/.test(css),
  },
];
riskPatterns.forEach((item) => check(item.name, item.ok));

if (failures.length) {
  console.error("QA check failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("QA check passed");

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
  "fixed employee worklogs require authenticated owner",
  /function canEditEmployeeSlot\(employeeId = ""\)[\s\S]{0,180}if \(!authState\.user\) return false;[\s\S]{0,160}getProfileMappedEmployeeId\(\) === employeeId/.test(js),
  "logged-out or mismatched viewers must not operate another employee's attendance/worklog"
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
  /function applyCurrentWorklogPermissionState\(viewName = activeView\)[\s\S]{0,900}#worklogTaskBoard \.task-cycle[\s\S]{0,700}#employeeMemo/.test(js),
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
  /function buildRemoteSnapshot\(\)[\s\S]{0,500}backupSettings: state\.backupSettings/.test(js) && /loadRemoteWorklogForActiveDate\(\)[\s\S]{0,1400}data\.state\.backupSettings/.test(js),
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
  html.includes('data-menu-view="ai">매뉴얼·코칭</button>')
    && html.includes('data-menu-view="report">보고서·백업</button>')
    && html.includes('data-settings-tab="manual">매뉴얼 편집</button>'),
  "manual/coaching and report/backup should be named as consolidated destinations"
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
    && js.includes("formatPhoneNumber(state.profile.phone)"),
  "phone inputs should accept digits and display hyphenated Korean phone numbers"
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

import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (file) => readFileSync(join(root, file), "utf8");
const html = read("index.html");
const js = read("app.js");
const css = read("styles.css");
const schema = read("supabase/worklog_schema.sql");
const backupApi = existsSync(join(root, "api/backup-mail.js")) ? read("api/backup-mail.js") : "";
const fitnessCoachApi = existsSync(join(root, "api/fitness-coach.js")) ? read("api/fitness-coach.js") : "";
const dagymSyncApi = existsSync(join(root, "api/dagym-sync.js")) ? read("api/dagym-sync.js") : "";
const dagymNightlyApi = existsSync(join(root, "api/dagym-nightly-analysis.js")) ? read("api/dagym-nightly-analysis.js") : "";
const dagymMonthlyScheduleApi = existsSync(join(root, "api/dagym-monthly-schedule.js")) ? read("api/dagym-monthly-schedule.js") : "";
const dagymMonthlyScheduleMigration = existsSync(join(root, "supabase/migrations/20260815013000_dagym_monthly_pt_schedule.sql"))
  ? read("supabase/migrations/20260815013000_dagym_monthly_pt_schedule.sql")
  : "";
const dagymMonthlyScheduleCollector = existsSync(join(root, "scripts/dagym-monthly-pt-sync.mjs")) ? read("scripts/dagym-monthly-pt-sync.mjs") : "";
const dagymDailyBrowserApi = existsSync(join(root, "api/dagym-browser-daily.js")) ? read("api/dagym-browser-daily.js") : "";
const dagymDailyBrowserCollector = existsSync(join(root, "scripts/dagym-daily-sync.mjs")) ? read("scripts/dagym-daily-sync.mjs") : "";
const dagymDailyPipelineMigration = existsSync(join(root, "supabase/migrations/20260816090000_dagym_daily_sync_pipeline.sql"))
  ? read("supabase/migrations/20260816090000_dagym_daily_sync_pipeline.sql")
  : "";
const memberOutreachApi = existsSync(join(root, "api/member-outreach.js")) ? read("api/member-outreach.js") : "";
const dagymDatabaseCron = existsSync(join(root, "supabase/migrations/20260811170000_dagym_database_cron.sql"))
  ? read("supabase/migrations/20260811170000_dagym_database_cron.sql")
  : "";
const dagymCeoReportIngest = existsSync(join(root, "supabase/migrations/20260811180000_dagym_ceo_report_ingest.sql"))
  ? read("supabase/migrations/20260811180000_dagym_ceo_report_ingest.sql")
  : "";
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
const dagymSyncApiSyntax = dagymSyncApi ? spawnSync(process.execPath, ["--check", join(root, "api/dagym-sync.js")], { encoding: "utf8" }) : null;
check("DaGym sync api exists and parses", Boolean(dagymSyncApi) && dagymSyncApiSyntax.status === 0, dagymSyncApiSyntax?.stderr?.trim() || "api/dagym-sync.js is missing");
const dagymNightlyApiSyntax = dagymNightlyApi ? spawnSync(process.execPath, ["--check", join(root, "api/dagym-nightly-analysis.js")], { encoding: "utf8" }) : null;
check("DaGym nightly analysis api exists and parses", Boolean(dagymNightlyApi) && dagymNightlyApiSyntax.status === 0, dagymNightlyApiSyntax?.stderr?.trim() || "api/dagym-nightly-analysis.js is missing");
const dagymMonthlyScheduleApiSyntax = dagymMonthlyScheduleApi ? spawnSync(process.execPath, ["--check", join(root, "api/dagym-monthly-schedule.js")], { encoding: "utf8" }) : null;
check("DaGym monthly schedule api exists and parses", Boolean(dagymMonthlyScheduleApi) && dagymMonthlyScheduleApiSyntax.status === 0, dagymMonthlyScheduleApiSyntax?.stderr?.trim() || "api/dagym-monthly-schedule.js is missing");
const dagymMonthlyScheduleCollectorSyntax = dagymMonthlyScheduleCollector ? spawnSync(process.execPath, ["--check", join(root, "scripts/dagym-monthly-pt-sync.mjs")], { encoding: "utf8" }) : null;
check("DaGym monthly schedule collector exists and parses", Boolean(dagymMonthlyScheduleCollector) && dagymMonthlyScheduleCollectorSyntax.status === 0, dagymMonthlyScheduleCollectorSyntax?.stderr?.trim() || "scripts/dagym-monthly-pt-sync.mjs is missing");
const dagymMonthlyScheduleCollectorTests = existsSync(join(root, "scripts/dagym-monthly-pt-sync.test.mjs"))
  ? spawnSync(process.execPath, ["--test", join(root, "scripts/dagym-monthly-pt-sync.test.mjs")], { encoding: "utf8" })
  : null;
check("DaGym monthly schedule collector tests pass", Boolean(dagymMonthlyScheduleCollectorTests) && dagymMonthlyScheduleCollectorTests.status === 0, dagymMonthlyScheduleCollectorTests?.stderr?.trim() || "scripts/dagym-monthly-pt-sync.test.mjs is missing");
const dagymMonthlyScheduleApiTests = existsSync(join(root, "scripts/dagym-monthly-schedule-api.test.cjs"))
  ? spawnSync(process.execPath, ["--test", join(root, "scripts/dagym-monthly-schedule-api.test.cjs")], { encoding: "utf8" })
  : null;
check("DaGym monthly schedule api rejects masked keys safely", Boolean(dagymMonthlyScheduleApiTests) && dagymMonthlyScheduleApiTests.status === 0, dagymMonthlyScheduleApiTests?.stderr?.trim() || "scripts/dagym-monthly-schedule-api.test.cjs is missing");
const dagymDailyBrowserApiSyntax = dagymDailyBrowserApi ? spawnSync(process.execPath, ["--check", join(root, "api/dagym-browser-daily.js")], { encoding: "utf8" }) : null;
check("DaGym daily browser api exists and parses", Boolean(dagymDailyBrowserApi) && dagymDailyBrowserApiSyntax.status === 0, dagymDailyBrowserApiSyntax?.stderr?.trim() || "api/dagym-browser-daily.js is missing");
const dagymDailyBrowserCollectorSyntax = dagymDailyBrowserCollector ? spawnSync(process.execPath, ["--check", join(root, "scripts/dagym-daily-sync.mjs")], { encoding: "utf8" }) : null;
check("DaGym daily browser collector exists and parses", Boolean(dagymDailyBrowserCollector) && dagymDailyBrowserCollectorSyntax.status === 0, dagymDailyBrowserCollectorSyntax?.stderr?.trim() || "scripts/dagym-daily-sync.mjs is missing");
const memberOutreachApiSyntax = memberOutreachApi ? spawnSync(process.execPath, ["--check", join(root, "api/member-outreach.js")], { encoding: "utf8" }) : null;
check("member outreach api exists and parses", Boolean(memberOutreachApi) && memberOutreachApiSyntax.status === 0, memberOutreachApiSyntax?.stderr?.trim() || "api/member-outreach.js is missing");
check(
  "member CRM separates consent, operations, follow-up, and message history",
  ["fitness_members", "member_consents", "member_contracts", "member_attendance", "member_pt_sessions", "member_followups", "member_message_logs", "member_contact_audit_logs"]
    .every((table) => schema.includes(`create table if not exists public.${table}`))
    && schema.includes("cancel_member_followups_on_consent_change")
    && schema.includes("revoke all on public.fitness_members from public, anon, authenticated")
    && memberOutreachApi.includes("function isAssignedTo")
    && memberOutreachApi.includes("MEMBER_CONTACT_ENCRYPTION_KEY")
    && !memberOutreachApi.includes("member_contact_vault")
    && !memberOutreachApi.includes("member_outreach_queue"),
  "member PII must be encrypted, direct DB access blocked, staff limited to assigned members, and withdrawals cancel pending follow-ups"
);
check(
  "DaGym direct sync stays server-side and authenticated",
  dagymSyncApi.includes("process.env.DAGYM_SYNC_TOKEN")
    && dagymSyncApi.includes("process.env.DAGYM_SYNC_URL")
    && dagymSyncApi.includes("/auth/v1/user")
    && dagymSyncApi.includes('provider: "dagym-manager"')
    && !js.includes("DAGYM_SYNC_TOKEN")
    && html.includes('id="dagymSyncButton"')
    && js.includes('fetch("/api/dagym-sync"'),
  "provider credentials must remain in the server environment and the UI must keep a direct-sync control"
);
check(
  "DaGym previous-day analysis runs at 01:00 KST and feeds coaching",
  dagymDatabaseCron.includes("create extension if not exists pg_cron")
    && dagymDatabaseCron.includes("run_dagym_nightly_analysis")
    && dagymDatabaseCron.includes("'0 16 * * *'")
    && dagymDatabaseCron.includes("dagym-nightly-analysis")
    && schema.includes("create table if not exists public.dagym_daily_analyses")
    && js.includes("function ensureTodayDagymDailyAnalysis")
    && js.includes("function buildDagymDailyAnalysis")
    && js.includes("previousDayAnalysis")
    && fitnessCoachApi.includes("previousDayAnalysis"),
  "database cron must persist the previous-day analysis at 01:00 KST and feed today's AI coaching"
);
check(
  "DaGym browser collection persists daily snapshots and sync health",
  dagymDailyBrowserApi.includes("dagym_daily_snapshots")
    && dagymDailyBrowserApi.includes("dagym_sync_runs")
    && dagymDailyBrowserApi.includes("run_dagym_nightly_analysis")
    && dagymDailyBrowserCollector.includes("DAGYM_ATTENDANCE_URL")
    && dagymDailyBrowserCollector.includes("DAGYM_SALES_URL")
    && dagymDailyBrowserCollector.includes("DAGYM_MEMBERS_URL")
    && dagymDailyPipelineMigration.includes("create table if not exists public.dagym_daily_snapshots")
    && dagymDailyPipelineMigration.includes("create table if not exists public.dagym_sync_runs")
    && schema.includes("create table if not exists public.dagym_daily_snapshots")
    && dagymNightlyApi.includes("loadDailySnapshot"),
  "daily attendance, sales, member and PT data must be saved independently of worklog state and feed the next-day analysis"
);
check(
  "DaGym CEO report intake is private, duplicate-safe, and feeds nightly analysis",
  dagymCeoReportIngest.includes("create table if not exists public.dagym_ceo_report_inbox")
    && dagymCeoReportIngest.includes("content_hash text not null unique")
    && dagymCeoReportIngest.includes("ingest_dagym_ceo_report")
    && dagymCeoReportIngest.includes("rotate_dagym_ceo_ingest_token")
    && dagymCeoReportIngest.includes("perform public.run_dagym_nightly_analysis")
    && !dagymCeoReportIngest.includes("raw_text")
    && schema.includes("create table if not exists public.dagym_ceo_report_inbox"),
  "CEO report ingestion must store aggregate metrics only and update the existing coaching pipeline"
);
check(
  "DaGym monthly PT schedule is encrypted, permission-scoped, and status-driven",
  dagymMonthlyScheduleApi.includes("MEMBER_CONTACT_ENCRYPTION_KEY")
    && dagymMonthlyScheduleApi.includes("aes-256-gcm")
    && dagymMonthlyScheduleApi.includes("trainer_profile_id")
    && dagymMonthlyScheduleApi.includes('status_source: "worklog"')
    && dagymMonthlyScheduleMigration.includes("member_name_ciphertext")
    && dagymMonthlyScheduleMigration.includes("'postponed'")
    && js.includes('["completed", "no-show"].includes(item.dagymStatus)')
    && js.includes("auditDagymClassRows")
    && js.includes("skipPt: hasDagymClass")
    && js.includes('dagymClassStatusOptions = [')
    && ["미정", "출석", "노쇼", "취소", "연기"].every((label) => js.includes(`\"${label}\"`)),
  "member names must be encrypted, rows limited by trainer permission, and only attendance/no-show counted after source-ID deduplication"
);
check(
  "DaGym lessons project only to one exact trainer and upcoming worklog slots",
  js.includes("function normalizeDagymTrainerName")
    && js.includes("function getDagymTrainerIdentityNames")
    && /function resolveDagymTrainerEmployeeId[\s\S]{0,700}filter\(isFitnessEmployeeRecord\)[\s\S]{0,350}getDagymTrainerIdentityNames\(employee\)\.includes\(trainerName\)[\s\S]{0,220}matches\.length !== 1[\s\S]{0,220}directId !== matchedId/.test(js)
    && /function isDagymScheduleProjectionEligible[\s\S]{0,520}dateKey < nowParts\.dateKey[\s\S]{0,220}timeToMinutes\(scheduleParts\.time\) >= timeToMinutes\(nowParts\.time\)/.test(js)
    && /function applyDagymPtScheduleRows[\s\S]{0,420}if \(dateKey < todayKey\) return 0;/.test(js)
    && /function applyDagymPtScheduleMonth[\s\S]{0,620}dateKey >= todayKey[\s\S]{0,220}applyDagymPtScheduleRows\(rows, dateKey\)/.test(js)
    && /const isUpcoming = isDagymScheduleProjectionEligible\(row, dateKey, now\);[\s\S]{0,260}if \(!isUpcoming && !existingEntry\) return;/.test(js)
    && js.includes("if (!isUpcoming) return;")
    && /function resolveTrainerProfileId[\s\S]{0,520}profile\.nickname[\s\S]{0,220}exact\.length === 1 \? exact\[0\]\.id : null/.test(dagymMonthlyScheduleApi)
    && dagymMonthlyScheduleApi.includes("trainer_profile_id=is.null")
    && dagymMonthlyScheduleApi.includes("ownNames.includes(normalizeName(row.trainer_name))")
    && !dagymMonthlyScheduleApi.includes('"홍트"'),
  "past lessons must not be injected, and ambiguous or mismatched trainer names must never enter another employee's worklog"
);
check(
  "DaGym local monthly audit excludes member names",
  dagymMonthlyScheduleCollector.includes("const safeEvents = capture.events.map(({ memberName, ...event }) => event)")
    && !dagymMonthlyScheduleCollector.includes("...capture }, null, 2"),
  "local audit files must not retain member names"
);
check(
  "DaGym monthly lessons come from the authenticated timetable GraphQL",
  dagymMonthlyScheduleCollector.includes('new URL("/schedule/calendar", baseUrl)')
    && dagymMonthlyScheduleCollector.includes('const graphqlOperationName = "GetCalendarScheduleItems"')
    && dagymMonthlyScheduleCollector.includes("request.allHeaders()")
    && dagymMonthlyScheduleCollector.includes("getKstMonthRangeIso(monthKey)")
    && !dagymMonthlyScheduleCollector.includes('new URL("/schedule/list", baseUrl)'),
  "monthly PT collection must use the actual timetable response and an exact KST month range, not the reservation list"
);
check(
  "fitness revenue coaching protects data quality and enforces operating targets",
  js.includes("Math.max(30000000")
    && js.includes("Math.max(50000000")
    && js.includes("coverageRate < 80")
    && js.includes("누락일을 0원으로 추정하지 않습니다"),
  "sales coaching must distinguish missing data from zero revenue and keep 30M/50M target floors"
);
check("fitness coach keeps OpenAI key server-side", fitnessCoachApi.includes("process.env.OPENAI_API_KEY") && !js.includes("OPENAI_API_KEY"));
check("fitness coach verifies signed-in user", fitnessCoachApi.includes("/auth/v1/user") && fitnessCoachApi.includes("Authorization"));
check("fitness coach uses structured Responses output", fitnessCoachApi.includes("/v1/responses") && fitnessCoachApi.includes('type: "json_schema"'));
check(
  "fitness SNS promotion stores links, reviews content, and coaches channel expansion",
  ["snsBlogUrl", "snsInstagramUrl", "snsContentSummary"].every((field) => html.includes(`data-fitness-field="${field}"`) && js.includes(`${field}: ""`))
    && js.includes("function buildFitnessSnsReview")
    && js.includes("function renderFitnessSnsReportHtml")
    && js.includes("인스타그램 릴스·카드뉴스")
    && fitnessCoachApi.includes("외부 링크 본문을 실제로 열람했다고 말하지 마세요")
    && css.includes(".fitness-sns-review")
    && css.includes(".fitness-paper-sns-review"),
  "fitness staff must be able to save promotion links and receive evidence-based cross-channel coaching"
);
check(
  "fitness center report keeps manager ownership, Dagym analysis, weather refresh, and attendance warnings",
  /function canConfirmFitnessCenterReport[\s\S]{0,260}return isFitnessCenterManagerEmployee\(actor\)/.test(js)
    && js.includes("getFitnessReportDagymSummary")
    && js.includes("refreshFitnessReportWeather")
    && js.includes("getFitnessReportAttendanceWarnings")
    && css.includes(".fitness-paper-dagym")
    && css.includes(".fitness-paper-warning-banner")
);
check(
  "fitness report uses a polished achievement coaching label",
  js.includes('["성과 하이라이트", model.aiCoaching.praise]')
    && js.includes('["성과 하이라이트", praise]')
    && !js.includes('["칭찬", model.aiCoaching.praise]')
);
check(
  "non-fitness daily report places priorities and schedules side by side",
  js.includes('class="worklog-report-main-grid"')
    && js.includes("1. 오늘의 우선업무")
    && js.includes("2. 시간별일정")
    && css.includes(".worklog-report-main-grid")
    && /\.worklog-report-main-grid\s*\{[\s\S]{0,220}grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/.test(css)
    && /getWorklogReportExportCss[\s\S]{0,5000}\.worklog-report-main-grid \{ display: grid; grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\)/.test(js),
  "general worklog preview and exported report must keep the two primary ledgers in a balanced two-column grid"
);
check(
  "representative weather addresses are shared with every authenticated workplace",
  js.includes("function mergeSharedSiteWeatherSettings")
    && js.includes('.from("site_weather_settings")')
    && js.includes("loadSharedSiteWeatherSettings")
    && js.includes("publishRepresentativeSiteWeatherSettings")
    && /saveSharedSiteWeatherAddress\(key, nextAddress\)/.test(js)
    && /create table if not exists public\.site_weather_settings/.test(schema)
    && /site_weather_settings_select_authenticated[\s\S]{0,180}to authenticated[\s\S]{0,80}using \(true\)/.test(schema)
    && /site_weather_settings_update_approver[\s\S]{0,220}public\.is_profile_approver\(\)/.test(schema),
  "representative addresses must persist in a shared RLS-protected table and load for staff accounts"
);

check(
  "weather uses Beyond Work regional coordinates before street-address geocoding",
  js.includes("const siteWeatherRegions = Object.freeze")
    && js.includes("function getWeatherRegionCoordinates")
    && js.includes('source: "beyond-work-region"')
    && js.includes("const regionPlace = getWeatherRegionCoordinates(trimmedAddress)")
    && js.includes("let place = regionPlace ||"),
  "known Korean regions should call weather directly with stable coordinates"
);
check(
  "worklog editing remains open for 48 hours after the workday",
  /function isWithinWorklogEditWindow[\s\S]{0,420}workday\.getDate\(\) \+ 3[\s\S]{0,120}now < editDeadline/.test(js)
);

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
  "worklog reports include arrived carryover tasks before first daily input",
  js.includes("function getReportArchiveTaskRefs")
    && /function getReportArchiveTaskRefs[\s\S]{0,1500}isWorklogTaskDueForDate\(task, sourceDateKey, dateKey\)/.test(js)
    && /function getReportArchiveTaskRefs[\s\S]{0,1700}!deletedFrom \|\| deletedFrom > dateKey/.test(js)
    && js.includes("const tasks = getReportArchiveTasks(log, { employee, dateKey });")
    && js.includes("reportCarryoverSourceDate")
    && js.includes("carryoverDetail"),
  "opening today's report before typing must use the same arrived-date and completion rules as the visible task ledger"
);

check(
  "report exports use native photo sharing and multipage A4 PDF",
  ids.includes("fitnessReportPdfButton")
    && js.includes("function splitReportCanvasIntoA4Pages")
    && js.includes("async function saveReportPhoto")
    && js.includes("async function shareReportArtifacts")
    && js.includes("async function saveFitnessReportPdf")
    && js.includes('document.getElementById("fitnessReportPdfButton")?.addEventListener')
    && /function createPdfBlobFromCanvas\(canvas\)[\s\S]{0,500}splitReportCanvasIntoA4Pages\(canvas\)/.test(js)
    && /\/Count \$\{pages\.length\}/.test(js),
  "fitness and general reports must save/share photos and multipage PDF without shrinking long reports"
);

check(
  "general worklog reports receive automatic business-specific AI coaching",
  html.includes('id="worklogReportAiStatus"')
    && js.includes("function getWorklogReportBusinessArea")
    && js.includes("function buildWorklogReportAiContext")
    && js.includes("function getWorklogReportCoachingRows")
    && js.includes("function requestWorklogReportAiCoaching")
    && js.includes('requestWorklogReportAiCoaching(model, { silent: true })')
    && js.includes('class="worklog-report-ai-coaching"')
    && ["finance", "shared", "tba", "project", "operations"].every((area) => js.includes(`key: "${area}"`))
    && fitnessCoachApi.includes("방주그룹 각 사업장의 실무를 이해하는 한국어 업무 코치")
    && fitnessCoachApi.includes('name: "bangju_worklog_coaching"'),
  "every non-fitness report should analyze its workplace, role, manual, and daily records when opened"
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
  "fitness schedule tracks SNS promotion as an independent activity",
  /fitness:\s*\[[^\]]*"SNS 홍보"[^\]]*"마케팅활동"/.test(js)
    && js.includes('snsPromotion: ""')
    && js.includes('normalizedType === "SNS 홍보" || isPtActivity ? 1')
    && html.includes('data-fitness-field="snsPromotion"')
    && /인스타그램\|인스타\|instagram\|블로그\|blog/.test(js),
  "SNS promotion must be classified and counted separately from general marketing"
);

check(
  "fitness counters distinguish automatic and author-confirmed values",
  js.includes("function applyFitnessOpsFieldSourceStyle")
    && js.includes('label.dataset.valueSource = isManual ? "작성자 확정" : "자동 집계"')
    && js.includes('field.classList.toggle("is-auto-value", !isManual)')
    && js.includes('field.classList.toggle("is-manual-value", isManual)')
    && css.includes(".fitness-ops-grid input.is-auto-value")
    && css.includes(".fitness-ops-grid input.is-manual-value")
    && html.includes("fitness-ops-source-guide"),
  "schedule-derived values should be gray while an employee override is black"
);

check(
  "employee attendance reminders follow configured work hours",
  js.includes("function buildAttendanceRecordReminder")
    && js.includes("scheduledOff && !log.clockIn")
    && js.includes('action: "출근"')
    && js.includes('action: "퇴근"')
    && js.includes("checkAttendanceRecordReminder(now)")
    && js.includes("requestAttendanceNotificationPermissionFromGesture"),
  "employees need schedule-aware clock-in and clock-out reminders without off-day false alarms"
);

check(
  "attendance evaluation prioritizes weekly settings and cautiously uses recent patterns",
  js.includes("const hasWeeklySettings = weeklyHours && typeof weeklyHours")
    && js.includes("recentPattern?.likelyOff")
    && js.includes("function getRecentEmployeeWorkPattern")
    && js.includes("lookbackDays = 56")
    && js.includes("samples >= 4")
    && js.includes("strongestOtherWeekday >= 3")
    && /label: "비번 추정"[\s\S]{0,120}직원설정 확인/.test(js),
  "configured weekdays must remain authoritative; recent records may only suppress uncertain false warnings"
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
    && js.includes("function createRemoteCoworkerEmployee")
    && js.includes("authState.coworkerEmployees")
    && schema.includes("when concat_ws(' ', p.org, p.workplace, p.primary_work)")
    && schema.includes("else 'bangju'")
    && js.includes("data-coworker-worklog-open")
    && html.includes("전체 업무일지로 돌아가기")
    && /function updateWorklogOverviewExitButton[\s\S]{0,420}canAccessWorklogOverview\(\)/.test(js),
  "Bangju, Beyond, and Fitness coworker navigation must not leak employees across business groups"
);

check(
  "historical worklogs remove AI coaching without changing current worklogs",
  js.includes("function isHistoricalWorklogDate")
    && js.includes("button.hidden = isGeneralWorklog && isHistoricalWorklogDate();")
    && (js.match(/const aiEnabled = !isHistoricalWorklogDate\(dateKey\);/g) || []).length >= 2
    && js.includes('model.aiEnabled ? `<div class="worklog-report-ai-coaching">')
    && js.includes('${model.aiEnabled ? `<div>')
    && js.includes("if (!model?.aiEnabled || !model?.aiKey || !model?.aiContext) return null;"),
  "past dates must not show section coaching, render report coaching, or call the AI endpoint"
);

check(
  "fitness quantities use compact daily/monthly totals",
  /function renderFitnessOpsSummaryButton\(log = getSelectedLog\(\)\)[\s\S]{0,1000}buildFitnessCenterEmployeeMonthRow\(employee, getActiveDateKey\(\)\.slice\(0, 7\)\)/.test(js)
    && /<strong>\$\{paidPtTotal\}\/\$\{monthlyPaidPtTotal\}<\/strong>/.test(js)
    && /function renderFitnessPersonalMonthSummary[\s\S]{0,180}panel\.hidden = true;/.test(js)
    && /function buildFitnessCenterEmployeeMonthRow\(employee, monthPrefix, throughDateKey = getActiveDateKey\(\), options = \{\}\)[\s\S]{0,1800}getFitnessMonthRollupDateKeys\(monthPrefix, throughDateKey\)\.forEach/.test(js)
    && js.includes("const aggregate = buildFitnessCenterEmployeeDayMonthRow(employee, dateKey, centerMonth, {")
    && js.includes("function buildFitnessCenterEmployeeDayMonthRow"),
  "personal worklogs should show today/month in existing summary cells without a separate grid"
);

check(
  "fitness monthly totals include every quantity field",
  /Object\.keys\(ops\)\.forEach\(\(key\)[\s\S]{0,240}ops\[key\] = String\(numberValue\(ops\[key\]\) \+ numberValue\(dayOps\[key\]\)/.test(js)
    && /target\.dayPass \+= numberValue\(ops\.dayPass\)[\s\S]{0,420}target\.customerOther \+= numberValue\(ops\.customerOther\)/.test(js)
    && /formatCount\(total\.daily\.ptPaid, total\.monthly\.ptPaid\)[\s\S]{0,1000}formatCount\(total\.daily\.customerOther, total\.monthly\.customerOther\)/.test(js),
  "PT, contracts, customer management, day passes, and other activity fields must all roll up"
);

check(
  "fitness center exposes sync health and reconciliation",
  html.includes('id="dagymSyncHealth"')
    && html.includes('id="fitnessCenterCountGuide"')
    && js.includes("async function loadRemoteDagymSyncHealth")
    && js.includes('.from("dagym_daily_snapshots")')
    && js.includes('.from("dagym_sync_runs")')
    && js.includes("const audit = summarizeFitnessReportRows")
    && js.includes('["집계점검", auditIssues')
    && js.includes("void loadRemoteDagymSyncHealth(dateKey)"),
  "center managers must be able to see DaGym domain status and schedule-count reconciliation without opening admin tools"
);

check(
  "fitness cumulative totals stop at the selected date and count one lesson per schedule item",
  /function getFitnessMonthRollupDateKeys\(monthPrefix, throughDateKey = getActiveDateKey\(\)\)[\s\S]{0,520}dateKey <= through/.test(js)
    && /function buildFitnessCenterEmployeeMonthRow\(employee, monthPrefix, throughDateKey = getActiveDateKey\(\), options = \{\}\)[\s\S]{0,1800}getFitnessMonthRollupDateKeys\(monthPrefix, throughDateKey\)/.test(js)
    && /const isPtActivity = [\s\S]{0,360}normalizedType === "SNS 홍보" \|\| isPtActivity \? 1 : countFitnessScheduleUnits\(text\)/.test(js)
    && /buildFitnessCenterEmployeeMonthRow\(employee, monthPrefix, dateKey(?:,|\))/.test(js),
  "month totals must exclude later dates, while one PT schedule item remains one lesson even when its description contains commas"
);

check(
  "fitness center totals deduplicate imported lessons and preserve local-only days",
  js.includes("function resolveFitnessOpsForAggregation")
    && js.includes("const dailyDagymSourceIds = new Set()")
    && js.includes("const monthlyDagymSourceIds = new Set()")
    && js.includes("const centerMonthlyDagymSourceIds = new Set()")
    && js.includes("dailyDagymSourceIds,")
    && js.includes("monthlyDagymSourceIds,")
    && js.includes("sharedDagymSourceIds: centerMonthlyDagymSourceIds")
    && /function getDagymMonthlyClassCounts[\s\S]{0,1800}authoritativeDates\.has\(dateKey\)[\s\S]{0,160}else totals\[key\] \+= numberValue\(dayOps\[key\]\)/.test(js),
  "one DaGym lesson must count once center-wide, while worklog PT remains on dates absent from the imported ledger"
);

check(
  "fitness center refreshes today's staff PT and recent DaGym class status",
  /if \(view === "fitness-log" && authState\.session\) \{[\s\S]{0,220}canAccessAllWorklogs\(\)[\s\S]{0,180}refreshVisibleStaffWorklogsForActiveDate\(\{ forceDagym: true \}\)/.test(js)
    && /async function refreshVisibleStaffWorklogsForActiveDate\(options = \{\}\)[\s\S]{0,900}loadVisibleStaffWorklogsForDate\(dateKey\)[\s\S]{0,420}loadDagymMonthlyPtSchedules\(dateKey, \{ force: Boolean\(options\.forceDagym\) \}\)[\s\S]{0,260}renderEntries\(\)/.test(js)
    && /\["worklog-overview", "fitness-log"\]\.includes\(activeView\)/.test(js)
    && /const cacheTtlMs = Math\.max\(5 \* 1000, Number\(options\.cacheTtlMs \|\| 30 \* 1000\)/.test(js),
  "representative center pages must reload employee ledgers and refresh class outcomes instead of keeping stale PT counts"
);

check(
  "fitness center reports preserve the handwritten ledger structure",
  html.includes('data-fitness-field="contractOther"')
    && html.includes('data-fitness-field="customerOther"')
    && js.includes('data-report-ledger="attendance-pt"')
    && js.includes('data-report-ledger="contract-customer"')
    && js.includes("출결현황 · PT수업")
    && js.includes("계약현황 · 고객관리")
    && /contractTotal: customerNew \+ customerRenewal \+ dayPass \+ contractOther/.test(js)
    && /customerTotal: inbound \+ outbound \+ outsideSales \+ consultation \+ customerOther/.test(js),
  "attendance, PT, contracts, customer management, subtotals, and other fields must remain linked from entry to report"
);

check(
  "fitness schedules normalize to each roster employee's work hours",
  js.includes("if (employee) return getOverviewScheduledWorkHours(employee, dateKey, {})")
    && js.includes("return applyApprovedLeaveToWorkHours(defaultProfile.workHours, employeeId, dateKey)")
    && js.includes("function alignFitnessEmployeeLogToRoster")
    && js.includes("if (employeeId) log.employeeId = employeeId")
    && js.includes('if (!log.scheduleUnitExplicit) log.scheduleUnit = "60"')
    && js.includes("normalizeEmployeeLogRows(log, dateKey)")
    && js.includes("if (isFitnessEmployeeRecord(employee) && !log.scheduleUnitExplicit)"),
  "aliased and newly added fitness logs must not inherit another employee's hours or 30-minute default"
);

check(
  "worklog schedule boundaries and missing priority warnings are enforced",
  js.includes("function getWorklogScheduleBoundarySlots")
    && js.includes("const start = Math.floor(rawStart / 60) * 60")
    && js.includes("const end = Math.ceil(rawEnd / 60) * 60")
    && js.includes("function isWorklogTaskPriorityMissing")
    && js.includes("function updateTaskPriorityWarningState")
    && js.includes("A·B·C 중 하나를 선택해주세요")
    && css.includes(".worklog-task-row.is-priority-missing")
    && css.includes(".worklog-priority-warning"),
  "08:30-17:30 must render 08:00-18:00 rows, and text-only priorities must remain visibly incomplete"
);

check(
  "fitness employee worklogs expose a safe off-duty substitute-work toggle",
  html.includes('id="fitnessWorkModeButton"')
    && js.includes("function renderFitnessWorkModeControl")
    && js.includes("function toggleFitnessWorkMode")
    && js.includes("function getEmployeeSubstituteWorkHours")
    && js.includes('log.workHoursOverride = "휴무"')
    && js.includes("normalizeEmployeeLogRows(log, getActiveDateKey())")
    && js.includes('document.getElementById("fitnessWorkModeButton")?.addEventListener("click", toggleFitnessWorkMode)')
    && css.includes(".fitness-work-mode-button.is-off"),
  "an employee off day must default to off and create that employee's blank schedule rows only after switching to substitute work"
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
    && html.includes('<strong>AI 진단</strong>')
    && /function buildPremiumOperatingModel\(\)/.test(js)
    && /function renderPremiumOperatingSystem\(\)/.test(js)
    && /renderPremiumOperatingSystem\(\)/.test(js)
    && css.includes(".premium-operating-hero")
    && css.includes(".premium-agent-grid"),
  "premium operating section should consolidate worklog, labor, growth, revenue, and backup signals without touching worklog editors"
);

check(
  "premium OS is kept inside existing report and coaching flow",
  /function getPrimaryNavigationView[\s\S]{0,500}\["control", "fitness", "premium"\]/.test(js)
    && /label: "AI 운영진단"[\s\S]{0,160}view: "premium"/.test(js)
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
  "worklog layout responds to aspect ratio and monitor resolution",
  js.includes('const isPhoneFlow = isPhysicalPhone || (isPortraitFlow && viewportWidth <= 900)')
    && js.includes('document.body.dataset.resolutionClass = viewportWidth >= 1800 ? "wide-monitor"')
    && css.includes('body[data-responsive-flow="landscape"][data-viewport-density="high"] .worklog-shell')
    && css.includes('@media (min-width: 641px) and (max-width: 900px) and (orientation: portrait)'),
  "wide monitors should use compact expanded cards while tall portrait screens use one full-height column"
);

check(
  "backup is not duplicated as a new main menu",
  !html.includes('data-menu-view="backup"') && !html.includes('data-view="backup"'),
  "backup should live inside the existing report flow to avoid menu duplication"
);

check(
  "menu sections use consolidated labels",
  html.includes('data-menu-view="ai"><strong>성장·코칭</strong>')
    && html.includes('data-menu-view="report"><strong>알림</strong>')
    && html.includes('data-menu-view="attendance"><strong>노무</strong>')
    && html.includes('id="globalCommandPalette"'),
  "growth support and report/community should be named as consolidated destinations"
);

check(
  "section command strips provide in-section navigation",
  html.includes('class="section-command-strip"')
    && html.includes('data-section-shortcut="manual"')
    && html.includes('data-section-shortcut="backup"')
    && js.includes('class="section-command-strip staff-section-tabbar"')
    && js.includes('data-staff-open-labor-workspace')
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
  "schedule types are scoped by business site and role",
  js.includes("const scheduleTypeCatalog =")
    && js.includes('finance: ["입금/수납", "지급/출납", "자금계획", "은행/대출", "매입/매출", "채권/채무", "회계/전표", "결산/마감", "예산/손익", "세무/신고", "급여/4대보험", "증빙/법인카드"')
    && js.includes('project: ["고객/상담", "견적/계약", "설계/디자인", "발주/구매", "시공/현장"')
    && js.includes('shared: ["입주/상담", "계약/수납", "공간/시설"')
    && js.includes('construction: ["공정/시공", "안전/점검", "품질/하자"')
    && /function getScheduleTypeCatalogKey[\s\S]{0,800}return "finance"/.test(js)
    && /appointment-merge-button[\s\S]{0,1800}openWorklogScheduleEditor\(entry, log\)/.test(js),
  "finance worklogs must not use fitness labels, and every site needs its own detailed schedule categories"
);

check(
  "daily reports distinguish every priority status and measure long pages",
  js.includes('const taskPriorityOptions = ["?", "A", "B", "C", "진행중", "위임", "연기", "취소"]')
    && js.includes("function getWorklogReportTaskStatusMeta")
    && ["complete", "progress", "delegate", "postpone", "cancel", "planned"].every((status) => js.includes(`is-${status}`))
    && js.includes("async function measureWorklogReportExportHeight")
    && js.includes("await measureWorklogReportExportHeight(model)"),
  "completed, in-progress, delegated, postponed, canceled, and planned work must stay visible in long exports"
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
  /\.worklog-shell > \.worklog-view:not\(\.is-active\)[\s\S]{0,80}display:\s*none !important;[\s\S]*\.worklog-shell > \.report-backup-view\.is-active[\s\S]{0,80}display:\s*grid !important;/.test(css.slice(-5000)),
  "page-specific display rules must not make report/backup or other views appear under the active worklog"
);

check(
  "desktop employee worklog has compact density guard",
  css.includes('body[data-active-view="bangju-log"]:not(.physical-phone-device) #view-today.is-active')
    && css.includes('body[data-active-view="beyond-log"]:not(.physical-phone-device) #view-today > .planner-section textarea'),
  "desktop employee worklogs should avoid oversized content and long report/memo tails"
);

check(
  "worklog separates own and coworker identity with responsive layout controls",
  html.includes('class="worklog-page-tabs"')
    && html.includes('data-worklog-layout-choice="portrait"')
    && html.includes('data-worklog-layout-choice="expanded"')
    && html.includes('id="coworkerWorklogCount"')
    && js.includes('const worklogLayoutStorageKey = "beyond-worklog-workspace-layout"')
    && js.includes('document.body.dataset.worklogLayout = worklogLayout')
    && js.includes('generalBadge.dataset.ownership = isOwn ? "mine" : "coworker"')
    && js.includes('동료 업무일지 · 열람 전용')
    && css.includes('body[data-worklog-layout="expanded"]:not(.physical-phone-device) #view-today .worklog-main[data-today-page="daily"]')
    && css.includes('body[data-worklog-layout="portrait"] #view-today .worklog-main[data-today-page="daily"]')
    && css.includes('@media (max-width: 759px)')
    && css.includes('#view-today .worklog-person-chip[data-ownership="mine"]')
    && css.includes('#view-today .worklog-person-chip[data-ownership="coworker"]'),
  "phones must stay portrait while tablets/desktops can persist a clear portrait or expanded coworker workspace"
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

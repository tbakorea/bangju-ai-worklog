import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (file) => readFileSync(join(root, file), "utf8");
const html = read("index.html");
const js = read("app.js");
const css = read("styles.css");
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

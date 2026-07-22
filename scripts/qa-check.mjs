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

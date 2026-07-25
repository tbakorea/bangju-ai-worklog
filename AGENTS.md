# Bangju AI Worklog Agent Guide

## Mission

Build Bangju AI Worklog as an operating agent for Bangju Group: worklogs, labor records, employee growth, business-site monitoring, reports, and AI coaching must connect into one reliable operating system.

## Non-Negotiables

- Preserve existing worklog behavior unless the user explicitly asks to change it.
- Treat mobile/iPad layouts as first-class. Most reported bugs come from narrow screens, sticky headers, date rows, menu popovers, and report modals.
- Keep representative/admin access separate from employee editing access. A viewer may inspect another employee's worklog, but must not operate attendance, edit work items, or save notes unless explicitly authorized.
- Avoid Supabase schema drift. When app code needs new persisted fields, update `supabase/worklog_schema.sql` and make the migration idempotent.
- Do not expose internal platform wording such as Supabase to ordinary employee-facing UI unless it is clearly an admin/debug area.

## Core Product Areas

- `업무일지`: employee daily worklog, date navigation, common schedule, coworker pages, tasks, schedules, reports.
- `피트니스 업무일지`: Beyond Fitness daily operations, PT/free PT distinction, center page, personal page, coworker read-only pages.
- `통합관제`: representative or delegated command-board monitoring across business sites.
- `대표 경영페이지`: CEO decisions, directives, delegation, and high-priority interventions.
- `직원`: employee master data, approval, permissions, onboarding, manuals, growth record.
- `노무`: attendance, labor ledger, payroll-statement draft, monthly labor submission support.
- `보고서`: A4 report, image/PDF/share/print, backup and restoration support.
- `메뉴얼·코칭`: role manuals, AI mission suggestions, self-development and operational coaching.

## Design Standard

- Use the Bangju tone: dark green, quiet premium surfaces, clear hierarchy, compact spacing.
- Avoid duplicate title bars. Put the page's main identity inside the green command panel when possible.
- On phones, text must not clip, overlap, or disappear behind sticky elements.
- On desktop, employee worklogs should be compact and not create long empty tails.
- Use stable dimensions for date controls, page navigation, buttons, and task/schedule rows.
- Before finishing UI work, inspect phone, iPad, and desktop behavior.

## QA Routine

Run the light checks after most edits:

```bash
./scripts/qa-check.sh
git diff --check
```

Run the browser/mobile simulation before finishing any UI, auth, permission, worklog, labor, report, or menu change:

```bash
./scripts/mobile-browser-qa.sh
```

If Playwright or a local browser is unavailable, say so clearly and still run the static checks.

## Commit Routine

Before committing:

```bash
./scripts/qa-check.sh
./scripts/mobile-browser-qa.sh
git diff --check
git status --short
```

Commit only scoped changes. Do not revert user changes or unrelated files.

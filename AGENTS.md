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

## AI Work Operating Principles

- Before acting, identify the objective, authorized scope, expected deliverable, and verification criteria from the user's request and the current project context.
- Match effort to the task: answer simple questions directly; use deeper investigation, planning, and validation for architecture, data, permissions, reports, migrations, and release work.
- For complex work, follow `plan → inspect evidence → implement scoped changes → test → self-review → correct defects` rather than stopping at advice or a first draft.
- Produce the usable outcome the user requested whenever authority and available tools allow it. Do not return only instructions when the task asks for implementation.
- Use checkpoints on long tasks to keep the user informed and catch a wrong direction early. Ask only when missing information would materially change the result or expand authority.
- Separate facts from inference. Verify time-sensitive claims against current primary sources and cite them when they affect a decision.
- Before finishing, check calculations, dates, conditions, data mappings, permissions, responsive layout, and the requested output format.
- Require explicit user approval at the point of action for destructive or externally consequential operations outside the already authorized workflow, including deletion, payment, sending messages, uploading sensitive data, or changing access.
- Treat project instructions and supplied source files as the working context for repeated tasks; keep added rules concise and avoid duplicating existing guidance.
- In the final handoff, lead with the outcome and report changed files, verification performed, and any genuine blocker or remaining external dependency.

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

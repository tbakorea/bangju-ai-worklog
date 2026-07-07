# Bangju AI Worklog

Bangju AI Worklog is a separate work-journal, attendance, and management-agent product built from the Beyond Work design language and planning philosophy.

This app should stay independent from the CEO planner dashboard:

- CEO planner: `/dashboard/`
- Bangju AI Worklog: `/worklog/`

## Product Position

Bangju AI Worklog is for daily operational reporting, attendance tracking, management summaries, and AI-assisted decision support across the Bangju group.
It should be faster and simpler than the planner. The first screen should answer:

1. What did I do today?
2. What was completed?
3. What remains or needs help?
4. What should be reported upward?

## MVP Sections

- Today Log: employee-level daily work entries adapted from the Beyond Work Today section
- Attendance: staff attendance, absence, field work, support issues
- Management: company-level status, branch/site issues, risk summary
- Organization: Bangju group companies, branches, sites, departments
- Time Log: simple timeline or work blocks
- Report: daily/weekly report generator
- Projects: linked project and task context
- AI: summarize, polish, evaluate, and suggest next actions
- Settings: user/team/report style

## Bangju Group Seed Structure

- (주)방주: real-estate development and execution corporation
- 비욘드 피트니스 지사: fitness center
- 워크베이스: shared office
- 워크박스: shared storage
- 홍보관: sales and leasing
- (주)비제이종합건설: construction management and sites
- 동천체육관현장
- 옥동 헤이븐빌 현장
- (주)더헤이븐빌: Havenvill execution corporation managed by Bangju
- (주)비욘드컴퍼니: showroom, bathroom system, interior, construction and import/design operations

## Data Separation

Use a separate storage namespace from Beyond Work:

- Local key prefix: `beyond-worklog`
- Supabase tables: `profiles`, `worklog_states`
- Suggested route: `/worklog/`

Do not reuse planner state keys for worklog data.

## Supabase Setup

The app is configured for Supabase Auth and remote worklog storage.

1. Open Supabase Dashboard.
2. Go to the Bangju AI Worklog project.
3. Open SQL Editor.
4. Run `supabase/worklog_schema.sql`.
5. Open the app, press the gear button, then sign up or log in.

The browser still keeps a local copy with `localStorage`, so a network issue does not erase the current device's worklog.

## Today Section Reuse

Bangju AI Worklog should reuse the shape of Beyond Work's Today section, then adjust it for management reporting:

- Planner Today: A/B/C priority work, time schedule, memo, daily record
- Worklog Today: employee selector, A/B/C priority work, time-based work flow, employee daily record
- Report output should summarize the selected employee first, then later roll up by organization and manager.

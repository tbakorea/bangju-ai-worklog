-- Beyond Fitness handwritten worklog import: 2026-08-01 through 2026-08-09
-- Idempotent rules:
--   * Preserve non-empty employee-authored schedule and attendance values.
--   * Fill only empty schedule slots from the paper records.
--   * Keep the greater numeric operation count, never add blindly.
--   * Record source provenance in state.manualImports.

begin;

create temporary table fitness_paper_import (
  email text not null,
  log_date date not null,
  employee_id text not null,
  clock_in text not null default '',
  clock_out text not null default '',
  schedule jsonb not null default '[]'::jsonb,
  fitness_ops jsonb not null default '{}'::jsonb,
  source_id text not null,
  primary key (email, log_date)
) on commit drop;

create or replace function pg_temp.paper_schedule_entry(p_time text, p_items jsonb)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'time', p_time,
    'text', coalesce((
      select string_agg('(' || (item->>'type') || ') ' || (item->>'text'), ' / ' order by ord)
      from jsonb_array_elements(p_items) with ordinality as x(item, ord)
    ), ''),
    'items', p_items,
    'status', '예정',
    'mergeDown', false
  );
$$;

create or replace function pg_temp.paper_blank_schedule(p_start integer, p_end integer)
returns jsonb
language sql
immutable
as $$
  select jsonb_agg(
    jsonb_build_object(
      'time', lpad(hour_no::text, 2, '0') || ':00',
      'text', '',
      'items', jsonb_build_array(jsonb_build_object('type', '업무', 'text', '')),
      'status', '예정',
      'mergeDown', false
    ) order by hour_no
  )
  from generate_series(p_start, p_end) as hour_no;
$$;

create or replace function pg_temp.paper_blank_tasks()
returns jsonb
language sql
volatile
as $$
  select jsonb_agg(
    jsonb_build_object(
      'id', 'paper-task-' || n,
      'priority', '?',
      'text', '',
      'status', '예정',
      'done', false,
      'delegate', '',
      'postponeDate', ''
    ) order by n
  )
  from generate_series(1, 14) as n;
$$;

create or replace function pg_temp.paper_merge_schedule(p_existing jsonb, p_incoming jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  result jsonb := coalesce(p_existing, '[]'::jsonb);
  incoming_item jsonb;
  existing_index integer;
begin
  for incoming_item in select value from jsonb_array_elements(coalesce(p_incoming, '[]'::jsonb)) loop
    select ordinality::integer - 1
      into existing_index
      from jsonb_array_elements(result) with ordinality as x(value, ordinality)
      where value->>'time' = incoming_item->>'time'
      limit 1;

    if existing_index is null then
      result := result || jsonb_build_array(incoming_item);
    elsif nullif(btrim(result->existing_index->>'text'), '') is null then
      result := jsonb_set(result, array[existing_index::text], incoming_item, true);
    end if;
  end loop;

  return coalesce((
    select jsonb_agg(value order by split_part(value->>'time', ':', 1)::integer)
    from jsonb_array_elements(result)
  ), '[]'::jsonb);
end;
$$;

-- 박주홍 · 08.01
insert into fitness_paper_import values (
  'pjhong0@naver.com', '2026-08-01', 'beyond-fitness-manager', '', '',
  jsonb_build_array(
    pg_temp.paper_schedule_entry('08:00', '[{"type":"오픈/마감","text":"오픈"}]'),
    pg_temp.paper_schedule_entry('09:00', '[{"type":"유료PT","text":"임혜린 PT"}]'),
    pg_temp.paper_schedule_entry('11:00', '[{"type":"시설/청결","text":"센터 관리"}]'),
    pg_temp.paper_schedule_entry('12:00', '[{"type":"휴게","text":"점심시간"}]'),
    pg_temp.paper_schedule_entry('15:00', '[{"type":"시설/청결","text":"센터 관리"}]'),
    pg_temp.paper_schedule_entry('16:00', '[{"type":"휴게","text":"개인운동"}]'),
    pg_temp.paper_schedule_entry('17:00', '[{"type":"오픈/마감","text":"마감"}]')
  ),
  '{"ptRegular":"1"}', 'fitness-paper-20260801-park'
);

-- 08.03: 센터장·트레이너·인포
insert into fitness_paper_import values (
  'pjhong0@naver.com', '2026-08-03', 'beyond-fitness-manager', '06:00', '24:00',
  jsonb_build_array(
    pg_temp.paper_schedule_entry('06:00', '[{"type":"오픈/마감","text":"오픈"},{"type":"시설/청결","text":"센터 관리"}]'),
    pg_temp.paper_schedule_entry('09:00', '[{"type":"휴게","text":"식사"},{"type":"시설/청결","text":"센터 관리"}]'),
    pg_temp.paper_schedule_entry('10:00', '[{"type":"유료PT","text":"정미주 PT"}]'),
    pg_temp.paper_schedule_entry('11:00', '[{"type":"시설/청결","text":"센터 관리"}]'),
    pg_temp.paper_schedule_entry('14:00', '[{"type":"유료PT","text":"서현 PT"}]'),
    pg_temp.paper_schedule_entry('15:00', '[{"type":"유료PT","text":"임혜린 PT"}]'),
    pg_temp.paper_schedule_entry('17:00', '[{"type":"휴게","text":"개인운동"}]'),
    pg_temp.paper_schedule_entry('19:00', '[{"type":"업무","text":"홍현규 트레이너 운동 지도"}]'),
    pg_temp.paper_schedule_entry('20:00', '[{"type":"유료PT","text":"김소현 PT"}]'),
    pg_temp.paper_schedule_entry('21:00', '[{"type":"유료PT","text":"박영우 PT"}]'),
    pg_temp.paper_schedule_entry('22:00', '[{"type":"시설/청결","text":"센터 관리"}]'),
    pg_temp.paper_schedule_entry('23:00', '[{"type":"오픈/마감","text":"마감"}]')
  ),
  '{"ptRegular":"5","customerNew":"1","customerRenewal":"2","dayPass":"2","inbound":"5","consultation":"5"}',
  'fitness-paper-20260803-park'
);

insert into fitness_paper_import values (
  'gusrd1005@gmail.com', '2026-08-03', 'fitness-trainer-1', '16:00', '24:00',
  jsonb_build_array(
    pg_temp.paper_schedule_entry('15:00', '[{"type":"유료PT","text":"정연우 PT"}]'),
    pg_temp.paper_schedule_entry('16:00', '[{"type":"고객/상담","text":"회원권 상담"},{"type":"휴게","text":"운동"}]'),
    pg_temp.paper_schedule_entry('17:00', '[{"type":"시설/청결","text":"샤워실 비품 채우기, 탈의실 청소"}]'),
    pg_temp.paper_schedule_entry('18:00', '[{"type":"휴게","text":"식사"},{"type":"시설/청결","text":"쓰레기 비우기"}]'),
    pg_temp.paper_schedule_entry('19:00', '[{"type":"업무","text":"롤플레잉, 정수기 관리"}]'),
    pg_temp.paper_schedule_entry('20:00', '[{"type":"시설/청결","text":"센터 관리"}]'),
    pg_temp.paper_schedule_entry('21:00', '[{"type":"유료PT","text":"한지숙 PT"}]'),
    pg_temp.paper_schedule_entry('22:00', '[{"type":"시설/청결","text":"샤워장 청소"},{"type":"휴게","text":"식사"}]'),
    pg_temp.paper_schedule_entry('23:00', '[{"type":"오픈/마감","text":"마감"}]')
  ),
  '{"ptRegular":"1","ptFree":"1","customerRenewal":"1","consultation":"1"}',
  'fitness-paper-20260803-hong'
);

insert into fitness_paper_import values (
  'tpals2990@naver.com', '2026-08-03', 'fitness-info-shinsemin', '14:00', '20:00',
  '[]', '{}', 'fitness-paper-20260803-shin'
);

-- 08.04
insert into fitness_paper_import values (
  'pjhong0@naver.com', '2026-08-04', 'beyond-fitness-manager', '06:00', '24:00',
  jsonb_build_array(
    pg_temp.paper_schedule_entry('06:00', '[{"type":"오픈/마감","text":"오픈"},{"type":"시설/청결","text":"센터 관리"}]'),
    pg_temp.paper_schedule_entry('08:00', '[{"type":"시설/청결","text":"센터 관리"}]'),
    pg_temp.paper_schedule_entry('09:00', '[{"type":"유료PT","text":"이홍근 PT"}]'),
    pg_temp.paper_schedule_entry('12:00', '[{"type":"시설/청결","text":"센터 관리"}]'),
    pg_temp.paper_schedule_entry('15:00', '[{"type":"고객/상담","text":"기존 회원 연락 관리"}]'),
    pg_temp.paper_schedule_entry('16:00', '[{"type":"휴게","text":"개인운동"}]'),
    pg_temp.paper_schedule_entry('18:00', '[{"type":"유료PT","text":"김상우 PT"}]'),
    pg_temp.paper_schedule_entry('19:00', '[{"type":"시설/청결","text":"센터 관리"}]'),
    pg_temp.paper_schedule_entry('20:00', '[{"type":"유료PT","text":"이환 PT"}]'),
    pg_temp.paper_schedule_entry('22:00', '[{"type":"유료PT","text":"홍서연 PT"}]'),
    pg_temp.paper_schedule_entry('23:00', '[{"type":"업무","text":"홍현규 선생님 피드백"},{"type":"오픈/마감","text":"마감"}]')
  ),
  '{"ptRegular":"4","customerRenewal":"3","contractOther":"1","inbound":"4","outbound":"14","consultation":"4"}',
  'fitness-paper-20260804-park'
);

insert into fitness_paper_import values
  ('gusrd1005@gmail.com','2026-08-04','fitness-trainer-1','16:00','24:00','[]','{"ptRegular":"3"}','fitness-paper-20260804-hong'),
  ('tpals2990@naver.com','2026-08-04','fitness-info-shinsemin','14:00','20:00','[]','{}','fitness-paper-20260804-shin');

-- 08.05
insert into fitness_paper_import values
  ('pjhong0@naver.com','2026-08-05','beyond-fitness-manager','06:00','24:00','[]','{"ptRegular":"5","customerRenewal":"2","inbound":"2","outbound":"26","consultation":"2"}','fitness-paper-20260805-park'),
  ('gusrd1005@gmail.com','2026-08-05','fitness-trainer-1','16:00','24:00','[]','{"ptRegular":"3","ptFree":"1"}','fitness-paper-20260805-hong'),
  ('tpals2990@naver.com','2026-08-05','fitness-info-shinsemin','14:00','20:00','[]','{}','fitness-paper-20260805-shin');

-- 08.06
insert into fitness_paper_import values
  ('pjhong0@naver.com','2026-08-06','beyond-fitness-manager','06:00','24:00','[]','{"ptRegular":"4","customerNew":"1","customerRenewal":"3","inbound":"4","consultation":"4"}','fitness-paper-20260806-park'),
  ('gusrd1005@gmail.com','2026-08-06','fitness-trainer-1','16:00','24:00','[]','{"ptRegular":"3"}','fitness-paper-20260806-hong'),
  ('tpals2990@naver.com','2026-08-06','fitness-info-shinsemin','14:00','20:00','[]','{}','fitness-paper-20260806-shin');

-- 08.07
insert into fitness_paper_import values
  ('pjhong0@naver.com','2026-08-07','beyond-fitness-manager','06:00','24:00','[]','{"ptRegular":"8","customerRenewal":"1","inbound":"1","outbound":"29","consultation":"1"}','fitness-paper-20260807-park'),
  ('gusrd1005@gmail.com','2026-08-07','fitness-trainer-1','16:00','24:00','[]','{"ptRegular":"2","customerRenewal":"1","inbound":"1","consultation":"1"}','fitness-paper-20260807-hong'),
  ('tpals2990@naver.com','2026-08-07','fitness-info-shinsemin','14:00','20:00','[]','{}','fitness-paper-20260807-shin');

-- Weekend info records and Sunday PT count
insert into fitness_paper_import values
  ('dlekqls89@naver.com','2026-08-08','fitness-weekday-info-idabin','08:00','18:00','[]','{"dayPass":"1"}','fitness-paper-20260808-ida'),
  ('yckim1558@naver.com','2026-08-09','fitness-info-kimyoungchae','08:00','18:00','[]','{}','fitness-paper-20260809-kim'),
  ('gusrd1005@gmail.com','2026-08-09','fitness-trainer-1','','','[]','{"ptRegular":"1"}','fitness-paper-20260809-hong');

-- Create missing personal snapshots from the employee's latest valid snapshot.
with missing as (
  select i.*, p.id as user_id, p.org, p.role,
         coalesce((
           select ws.state
           from public.worklog_states ws
           where ws.user_id = p.id and ws.state->'ownerWorklog' is not null
           order by ws.updated_at desc
           limit 1
         ), '{}'::jsonb) as template_state
  from fitness_paper_import i
  join public.profiles p on lower(p.email) = i.email
  where not exists (
    select 1 from public.worklog_states ws
    where ws.user_id = p.id and ws.log_date = i.log_date
  )
), prepared as (
  select m.*,
    jsonb_build_object(
      'employeeId', m.employee_id,
      'org', m.org,
      'role', m.role,
      'clockIn', m.clock_in,
      'clockOut', m.clock_out,
      'attendanceBreaks', '[]'::jsonb,
      'workHoursOverride', '',
      'manualScheduleSlots', '[]'::jsonb,
      'tasks', pg_temp.paper_blank_tasks(),
      'schedule', pg_temp.paper_merge_schedule(
        case when m.employee_id = 'beyond-fitness-manager'
             then pg_temp.paper_blank_schedule(6, 24)
             else pg_temp.paper_blank_schedule(8, 24) end,
        m.schedule
      ),
      'scheduleUnit', '60',
      'report', '', 'memo', '', 'record', '',
      'fitnessOps', jsonb_build_object(
        'ptRegular','', 'ptFree','', 'ptOther','', 'customerNew','', 'customerRenewal','',
        'dayPass','', 'contractOther','', 'inbound','', 'outbound','', 'outsideSales','',
        'consultation','', 'customerOther','', 'snsPromotion','', 'shiftNote','', 'specialReport',''
      ) || m.fitness_ops,
      'fitnessOpsManual', '{}'::jsonb,
      'updatedAt', to_char(clock_timestamp(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    ) as new_log
  from missing m
)
insert into public.worklog_states(user_id, log_date, organization, state, updated_at)
select user_id, log_date, org,
  (template_state - 'ownerWorklog' - 'employeeLogs' - 'attendance') ||
  jsonb_build_object(
    'selectedDateKey', log_date::text,
    'ownerEmployeeId', employee_id,
    'ownerWorklog', new_log,
    'employeeLogs', jsonb_build_object(log_date::text, jsonb_build_object(employee_id, new_log)),
    'attendance', jsonb_build_object(log_date::text, '[]'::jsonb)
  ),
  clock_timestamp()
from prepared;

-- Merge paper values into all matching snapshots, including legacy organization duplicates.
do $$
declare
  imported fitness_paper_import%rowtype;
  target record;
  worklog jsonb;
  merged_ops jsonb;
  merged_manual jsonb;
  op record;
  existing_value integer;
  incoming_value integer;
  new_state jsonb;
begin
  for imported in select * from fitness_paper_import order by log_date, email loop
    for target in
      select ws.id, ws.state
      from public.worklog_states ws
      join public.profiles p on p.id = ws.user_id
      where lower(p.email) = imported.email and ws.log_date = imported.log_date
    loop
      worklog := coalesce(target.state->'ownerWorklog', '{}'::jsonb);
      worklog := jsonb_set(worklog, '{employeeId}', to_jsonb(imported.employee_id), true);

      if nullif(btrim(worklog->>'clockIn'), '') is null and imported.clock_in <> '' then
        worklog := jsonb_set(worklog, '{clockIn}', to_jsonb(imported.clock_in), true);
      end if;
      if nullif(btrim(worklog->>'clockOut'), '') is null and imported.clock_out <> '' then
        worklog := jsonb_set(worklog, '{clockOut}', to_jsonb(imported.clock_out), true);
      end if;

      worklog := jsonb_set(
        worklog,
        '{schedule}',
        pg_temp.paper_merge_schedule(worklog->'schedule', imported.schedule),
        true
      );

      merged_ops := coalesce(worklog->'fitnessOps', '{}'::jsonb);
      merged_manual := coalesce(worklog->'fitnessOpsManual', '{}'::jsonb);
      for op in select key, value from jsonb_each_text(imported.fitness_ops) loop
        if op.value ~ '^\d+$' then
          existing_value := case when coalesce(merged_ops->>op.key, '') ~ '^\d+$'
                                 then (merged_ops->>op.key)::integer else 0 end;
          incoming_value := op.value::integer;
          merged_ops := jsonb_set(merged_ops, array[op.key], to_jsonb(greatest(existing_value, incoming_value)::text), true);
          merged_manual := jsonb_set(merged_manual, array[op.key], 'true'::jsonb, true);
        end if;
      end loop;
      worklog := jsonb_set(worklog, '{fitnessOps}', merged_ops, true);
      worklog := jsonb_set(worklog, '{fitnessOpsManual}', merged_manual, true);
      worklog := jsonb_set(worklog, '{updatedAt}', to_jsonb(to_char(clock_timestamp(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')), true);

      new_state := jsonb_set(target.state, '{ownerWorklog}', worklog, true);
      new_state := jsonb_set(
        new_state,
        array['employeeLogs', imported.log_date::text, imported.employee_id],
        worklog,
        true
      );
      new_state := jsonb_set(
        new_state,
        '{manualImports}',
        coalesce(new_state->'manualImports', '{}'::jsonb) || jsonb_build_object(
          imported.source_id,
          jsonb_build_object('source', 'Beyond Fitness handwritten worklog', 'importedAt', clock_timestamp())
        ),
        true
      );

      update public.worklog_states
      set state = new_state, updated_at = clock_timestamp()
      where id = target.id;
    end loop;
  end loop;
end;
$$;

-- A legacy employee/date can have more than one organization snapshot. Keep the rows for
-- compatibility, but synchronize their owner worklog so the app's latest-row selection
-- cannot surface different content or double-count different values.
with ranked as (
  select ws.id, ws.user_id, ws.log_date, ws.state, ws.updated_at,
         row_number() over (
           partition by ws.user_id, ws.log_date
           order by ws.updated_at desc, ws.id desc
         ) as row_no
  from public.worklog_states ws
  where exists (
    select 1 from jsonb_object_keys(coalesce(ws.state->'manualImports','{}')) key
    where key like 'fitness-paper-202608%'
  )
), canonical as (
  select user_id, log_date,
         state->'ownerWorklog' as owner_worklog,
         state->>'ownerEmployeeId' as employee_id
  from ranked
  where row_no = 1
)
update public.worklog_states ws
set state = jsonb_set(
              jsonb_set(ws.state, '{ownerWorklog}', canonical.owner_worklog, true),
              array['employeeLogs', canonical.log_date::text, canonical.employee_id],
              canonical.owner_worklog,
              true
            ),
    updated_at = clock_timestamp()
from ranked
join canonical using (user_id, log_date)
where ws.id = ranked.id
  and ranked.row_no > 1;

-- Verification output. Counts are per unique employee/date; duplicate organization snapshots
-- remain synchronized and are intentionally not summed twice.
select p.name, ws.log_date, ws.organization,
       ws.state#>>'{ownerWorklog,clockIn}' as clock_in,
       ws.state#>>'{ownerWorklog,clockOut}' as clock_out,
       (select count(*) from jsonb_array_elements(coalesce(ws.state#>'{ownerWorklog,schedule}','[]')) e
        where nullif(btrim(e->>'text'), '') is not null) as filled_schedule,
       ws.state#>'{ownerWorklog,fitnessOps}' as fitness_ops,
       jsonb_object_keys(coalesce(ws.state->'manualImports','{}')) as import_source
from public.worklog_states ws
join public.profiles p on p.id = ws.user_id
where ws.log_date between date '2026-08-01' and date '2026-08-09'
  and lower(p.email) in (select email from fitness_paper_import)
order by ws.log_date, p.name, ws.organization;

commit;

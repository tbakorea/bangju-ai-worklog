-- Keep editable worklog copies of DaGym PT timetable fields.  These columns
-- are intentionally separate from the DaGym source columns: Bangju Worklog
-- remains one-way until a separately approved two-way integration exists.
alter table public.dagym_pt_schedule_events add column if not exists worklog_member_name_ciphertext text not null default '';
alter table public.dagym_pt_schedule_events add column if not exists worklog_scheduled_at timestamptz;
alter table public.dagym_pt_schedule_events add column if not exists worklog_ended_at timestamptz;
alter table public.dagym_pt_schedule_events add column if not exists worklog_session_type text;
alter table public.dagym_pt_schedule_events add column if not exists worklog_class_label text;
alter table public.dagym_pt_schedule_events add column if not exists worklog_override_at timestamptz;

alter table public.dagym_pt_schedule_events drop constraint if exists dagym_pt_schedule_events_worklog_session_type_check;
alter table public.dagym_pt_schedule_events
  add constraint dagym_pt_schedule_events_worklog_session_type_check
  check (worklog_session_type is null or worklog_session_type in ('paid', 'free', 'other'));

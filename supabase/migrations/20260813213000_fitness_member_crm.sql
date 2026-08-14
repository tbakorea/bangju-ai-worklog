begin;

-- Fitness member CRM lives in the same operational database, but PII is encrypted
-- and is accessible only through the role-aware server API.
create table if not exists public.fitness_members (
  id uuid primary key default gen_random_uuid(),
  center_key text not null default 'beyond-fitness',
  external_member_id_ciphertext text not null,
  external_member_hash text not null,
  name_ciphertext text not null,
  phone_ciphertext text not null default '',
  push_token_ciphertext text not null default '',
  assigned_employee_id text not null default '',
  status text not null default 'active' check (status in ('active', 'paused', 'expired', 'withdrawn')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (center_key, external_member_hash)
);

create index if not exists fitness_members_assignee_idx
on public.fitness_members (center_key, assigned_employee_id, status);

alter table public.fitness_members enable row level security;
revoke all on public.fitness_members from public, anon, authenticated;

create table if not exists public.member_consents (
  member_id uuid primary key references public.fitness_members(id) on delete cascade,
  required_use_consent boolean not null default false,
  marketing_consent boolean not null default false,
  sms_consent boolean not null default false,
  kakao_consent boolean not null default false,
  app_push_consent boolean not null default false,
  consent_source text not null default 'member-signup',
  consent_version text not null default '2026-08',
  evidence_reference text not null default '',
  consented_at timestamptz,
  withdrawn_at timestamptz,
  withdrawal_reason text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (not sms_consent or marketing_consent),
  check (not kakao_consent or marketing_consent),
  check (not app_push_consent or marketing_consent)
);

alter table public.member_consents enable row level security;
revoke all on public.member_consents from public, anon, authenticated;

create table if not exists public.member_contracts (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.fitness_members(id) on delete cascade,
  external_contract_id text not null default '',
  contract_type text not null default 'membership',
  started_on date,
  expires_on date,
  pt_purchased_count integer not null default 0 check (pt_purchased_count >= 0),
  pt_remaining_count integer not null default 0 check (pt_remaining_count >= 0),
  status text not null default 'active' check (status in ('pending', 'active', 'expired', 'cancelled', 'refunded')),
  source text not null default 'dagym',
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_on is null or started_on is null or expires_on >= started_on),
  unique (member_id, external_contract_id)
);

create index if not exists member_contracts_expiry_idx
on public.member_contracts (expires_on, status, member_id);

alter table public.member_contracts enable row level security;
revoke all on public.member_contracts from public, anon, authenticated;

create table if not exists public.member_attendance (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.fitness_members(id) on delete cascade,
  attended_at timestamptz not null,
  attendance_type text not null default 'check-in' check (attendance_type in ('check-in', 'check-out', 'visit', 'no-show')),
  source text not null default 'dagym',
  external_event_id text not null default '',
  created_at timestamptz not null default now(),
  unique (member_id, attended_at, attendance_type)
);

create index if not exists member_attendance_member_idx
on public.member_attendance (member_id, attended_at desc);

alter table public.member_attendance enable row level security;
revoke all on public.member_attendance from public, anon, authenticated;

create table if not exists public.member_pt_sessions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.fitness_members(id) on delete cascade,
  trainer_employee_id text not null default '',
  scheduled_at timestamptz not null,
  ended_at timestamptz,
  session_type text not null default 'paid' check (session_type in ('paid', 'free', 'other')),
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled', 'no-show')),
  remaining_after integer check (remaining_after is null or remaining_after >= 0),
  source text not null default 'dagym',
  external_event_id text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, scheduled_at, session_type)
);

create index if not exists member_pt_sessions_schedule_idx
on public.member_pt_sessions (scheduled_at, trainer_employee_id, status);

alter table public.member_pt_sessions enable row level security;
revoke all on public.member_pt_sessions from public, anon, authenticated;

create table if not exists public.member_followups (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.fitness_members(id) on delete cascade,
  action_type text not null default 'renewal' check (action_type in ('renewal', 'consultation', 'recontact', 'retention', 'pt-followup')),
  channel text not null default 'staff-task' check (channel in ('staff-task', 'app-push', 'sms', 'kakao')),
  reason text not null default '',
  priority text not null default 'normal' check (priority in ('normal', 'attention', 'urgent')),
  contact_due_on date not null default current_date,
  contact_due_at timestamptz not null default now(),
  assigned_employee_id text not null default '',
  status text not null default 'pending' check (status in ('pending', 'assigned', 'scheduled', 'contacted', 'completed', 'failed', 'cancelled')),
  consultation_result text not null default '',
  next_contact_at timestamptz,
  cancellation_reason text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists member_followups_daily_unique_idx
on public.member_followups (member_id, action_type, contact_due_on)
where status not in ('cancelled', 'failed');

create index if not exists member_followups_assignee_idx
on public.member_followups (assigned_employee_id, status, contact_due_at);

alter table public.member_followups enable row level security;
revoke all on public.member_followups from public, anon, authenticated;

create table if not exists public.member_message_logs (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.fitness_members(id) on delete cascade,
  followup_id uuid references public.member_followups(id) on delete set null,
  channel text not null check (channel in ('app-push', 'sms', 'kakao', 'call', 'email')),
  content_ciphertext text not null default '',
  template_key text not null default '',
  sent_at timestamptz,
  success boolean not null default false,
  provider_message_id text not null default '',
  failure_reason text not null default '',
  opt_out_received_at timestamptz,
  sent_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists member_message_logs_member_idx
on public.member_message_logs (member_id, created_at desc);

alter table public.member_message_logs enable row level security;
revoke all on public.member_message_logs from public, anon, authenticated;

create table if not exists public.member_contact_audit_logs (
  id bigint generated always as identity primary key,
  member_id uuid references public.fitness_members(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  purpose text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists member_contact_audit_logs_member_idx
on public.member_contact_audit_logs (member_id, created_at desc);

alter table public.member_contact_audit_logs enable row level security;
revoke all on public.member_contact_audit_logs from public, anon, authenticated;

create or replace function public.member_is_contactable(target_member_id uuid, target_channel text default 'staff-task')
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.fitness_members m
    join public.member_consents c on c.member_id = m.id
    where m.id = target_member_id
      and m.status = 'active'
      and c.required_use_consent
      and c.marketing_consent
      and c.withdrawn_at is null
      and case target_channel
        when 'sms' then c.sms_consent
        when 'kakao' then c.kakao_consent
        when 'app-push' then c.app_push_consent
        else true
      end
  );
$$;

revoke all on function public.member_is_contactable(uuid, text) from public, anon, authenticated;

create or replace function public.cancel_member_followups_on_consent_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.withdrawn_at is not null or not new.marketing_consent then
    update public.member_followups
      set status = 'cancelled',
          cancellation_reason = '회원 수신동의 철회 또는 마케팅 미동의',
          updated_at = now()
    where member_id = new.member_id
      and status in ('pending', 'assigned', 'scheduled');
  end if;
  return new;
end;
$$;

drop trigger if exists cancel_member_followups_on_consent_change on public.member_consents;
create trigger cancel_member_followups_on_consent_change
after insert or update of marketing_consent, withdrawn_at on public.member_consents
for each row execute function public.cancel_member_followups_on_consent_change();

commit;

create table if not exists public.site_weather_settings (
  site_key text primary key,
  address text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.site_weather_settings enable row level security;

drop policy if exists "site_weather_settings_select_authenticated" on public.site_weather_settings;
create policy "site_weather_settings_select_authenticated"
on public.site_weather_settings for select
to authenticated
using (true);

drop policy if exists "site_weather_settings_insert_approver" on public.site_weather_settings;
create policy "site_weather_settings_insert_approver"
on public.site_weather_settings for insert
to authenticated
with check (public.is_profile_approver());

drop policy if exists "site_weather_settings_update_approver" on public.site_weather_settings;
create policy "site_weather_settings_update_approver"
on public.site_weather_settings for update
to authenticated
using (public.is_profile_approver())
with check (public.is_profile_approver());

drop policy if exists "site_weather_settings_delete_approver" on public.site_weather_settings;
create policy "site_weather_settings_delete_approver"
on public.site_weather_settings for delete
to authenticated
using (public.is_profile_approver());

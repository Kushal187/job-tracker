alter table public.applications
  add column if not exists user_id uuid;

do $$
declare
  owner_id uuid;
begin
  select id
  into owner_id
  from auth.users
  order by created_at asc
  limit 1;

  if owner_id is null then
    raise exception 'Cannot backfill applications.user_id because auth.users is empty';
  end if;

  update public.applications
  set user_id = owner_id
  where user_id is null;
end
$$;

alter table public.applications
  alter column user_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'applications_user_id_fkey'
  ) then
    alter table public.applications
      add constraint applications_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end
$$;

drop index if exists applications_request_id_unique;

create unique index if not exists applications_user_request_id_unique
  on public.applications (user_id, request_id)
  where request_id is not null;

create index if not exists applications_user_applied_at_idx
  on public.applications (user_id, applied_at desc);

create index if not exists applications_user_status_idx
  on public.applications (user_id, status);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  google_sheet_id text,
  google_sheet_tab text not null default 'Applications',
  google_sheet_sync_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_user_settings_updated_at on public.user_settings;

create trigger trg_user_settings_updated_at
before update on public.user_settings
for each row
execute function public.set_updated_at();

alter table public.applications enable row level security;
alter table public.user_settings enable row level security;

drop policy if exists "applications_select_own" on public.applications;
create policy "applications_select_own"
  on public.applications
  for select
  using (auth.uid() = user_id);

drop policy if exists "applications_insert_own" on public.applications;
create policy "applications_insert_own"
  on public.applications
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "applications_update_own" on public.applications;
create policy "applications_update_own"
  on public.applications
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "applications_delete_own" on public.applications;
create policy "applications_delete_own"
  on public.applications
  for delete
  using (auth.uid() = user_id);

drop policy if exists "user_settings_select_own" on public.user_settings;
create policy "user_settings_select_own"
  on public.user_settings
  for select
  using (auth.uid() = user_id);

drop policy if exists "user_settings_insert_own" on public.user_settings;
create policy "user_settings_insert_own"
  on public.user_settings
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_settings_update_own" on public.user_settings;
create policy "user_settings_update_own"
  on public.user_settings
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_settings_delete_own" on public.user_settings;
create policy "user_settings_delete_own"
  on public.user_settings
  for delete
  using (auth.uid() = user_id);

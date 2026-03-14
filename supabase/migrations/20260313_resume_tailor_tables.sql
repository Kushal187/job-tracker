-- Add user_id + RLS to resume-tailor tables (user_profile, profile_fact, generation_event).
-- These tables already exist in Supabase (created by resume-tailor's schema.sql).
-- This migration adds multi-user support matching the pattern from
-- 20260309_multi_user_auth_and_settings.sql.

-- ── user_profile: add user_id ──────────────────────────────────────────────

alter table public.user_profile
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
    raise exception 'Cannot backfill user_profile.user_id because auth.users is empty';
  end if;

  update public.user_profile
  set user_id = owner_id
  where user_id is null;
end
$$;

alter table public.user_profile
  alter column user_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_profile_user_id_fkey'
  ) then
    alter table public.user_profile
      add constraint user_profile_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end
$$;

-- Replace UNIQUE(name) with UNIQUE(user_id) — one profile per user
alter table public.user_profile drop constraint if exists user_profile_name_key;

create unique index if not exists user_profile_user_id_unique
  on public.user_profile (user_id);

-- ── profile_fact: add user_id ──────────────────────────────────────────────

alter table public.profile_fact
  add column if not exists user_id uuid;

-- Backfill from parent user_profile
update public.profile_fact pf
set user_id = up.user_id
from public.user_profile up
where pf.profile_id = up.id
  and pf.user_id is null;

-- Any orphaned facts (no matching profile) get the first user
do $$
declare
  owner_id uuid;
begin
  select id into owner_id from auth.users order by created_at asc limit 1;

  if owner_id is not null then
    update public.profile_fact
    set user_id = owner_id
    where user_id is null;
  end if;
end
$$;

alter table public.profile_fact
  alter column user_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profile_fact_user_id_fkey'
  ) then
    alter table public.profile_fact
      add constraint profile_fact_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end
$$;

create index if not exists profile_fact_user_id_profile_id_idx
  on public.profile_fact (user_id, profile_id);

-- ── generation_event: add user_id + application_id ─────────────────────────

alter table public.generation_event
  add column if not exists user_id uuid;

do $$
declare
  owner_id uuid;
begin
  select id into owner_id from auth.users order by created_at asc limit 1;

  if owner_id is null then
    raise exception 'Cannot backfill generation_event.user_id because auth.users is empty';
  end if;

  update public.generation_event
  set user_id = owner_id
  where user_id is null;
end
$$;

alter table public.generation_event
  alter column user_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'generation_event_user_id_fkey'
  ) then
    alter table public.generation_event
      add constraint generation_event_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end
$$;

-- Optional link to a specific job application
alter table public.generation_event
  add column if not exists application_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'generation_event_application_id_fkey'
  ) then
    alter table public.generation_event
      add constraint generation_event_application_id_fkey
      foreign key (application_id) references public.applications(id) on delete set null;
  end if;
end
$$;

create index if not exists generation_event_user_created_idx
  on public.generation_event (user_id, created_at desc);

-- ── Enable RLS on all three tables ─────────────────────────────────────────

alter table public.user_profile enable row level security;
alter table public.profile_fact enable row level security;
alter table public.generation_event enable row level security;

-- ── user_profile RLS policies ──────────────────────────────────────────────

drop policy if exists "user_profile_select_own" on public.user_profile;
create policy "user_profile_select_own"
  on public.user_profile for select
  using (auth.uid() = user_id);

drop policy if exists "user_profile_insert_own" on public.user_profile;
create policy "user_profile_insert_own"
  on public.user_profile for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_profile_update_own" on public.user_profile;
create policy "user_profile_update_own"
  on public.user_profile for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_profile_delete_own" on public.user_profile;
create policy "user_profile_delete_own"
  on public.user_profile for delete
  using (auth.uid() = user_id);

-- ── profile_fact RLS policies ──────────────────────────────────────────────

drop policy if exists "profile_fact_select_own" on public.profile_fact;
create policy "profile_fact_select_own"
  on public.profile_fact for select
  using (auth.uid() = user_id);

drop policy if exists "profile_fact_insert_own" on public.profile_fact;
create policy "profile_fact_insert_own"
  on public.profile_fact for insert
  with check (auth.uid() = user_id);

drop policy if exists "profile_fact_update_own" on public.profile_fact;
create policy "profile_fact_update_own"
  on public.profile_fact for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "profile_fact_delete_own" on public.profile_fact;
create policy "profile_fact_delete_own"
  on public.profile_fact for delete
  using (auth.uid() = user_id);

-- ── generation_event RLS policies ──────────────────────────────────────────

drop policy if exists "generation_event_select_own" on public.generation_event;
create policy "generation_event_select_own"
  on public.generation_event for select
  using (auth.uid() = user_id);

drop policy if exists "generation_event_insert_own" on public.generation_event;
create policy "generation_event_insert_own"
  on public.generation_event for insert
  with check (auth.uid() = user_id);

drop policy if exists "generation_event_update_own" on public.generation_event;
create policy "generation_event_update_own"
  on public.generation_event for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "generation_event_delete_own" on public.generation_event;
create policy "generation_event_delete_own"
  on public.generation_event for delete
  using (auth.uid() = user_id);

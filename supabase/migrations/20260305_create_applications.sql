create extension if not exists pgcrypto;

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  job_title text not null,
  status text not null,
  job_url text not null,
  applied_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sheet_row_number integer,
  request_id text
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'applications_status_check'
  ) then
    alter table public.applications
      add constraint applications_status_check
      check (status in ('Applied', 'Interviewing', 'Offer', 'Rejected', 'Withdrawn'));
  end if;
end
$$;

create unique index if not exists applications_request_id_unique
  on public.applications (request_id)
  where request_id is not null;

create index if not exists applications_status_idx
  on public.applications (status);

create index if not exists applications_applied_at_idx
  on public.applications (applied_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_applications_updated_at on public.applications;

create trigger trg_applications_updated_at
before update on public.applications
for each row
execute function public.set_updated_at();

alter table public.applications
  drop constraint if exists applications_status_check;

update public.applications
set status = case status
  when 'Interviewing' then 'Interview'
  when 'Rejected' then 'Reject'
  when 'Offer' then 'Accepted'
  when 'Withdrawn' then 'Reject'
  else status
end
where status in ('Interviewing', 'Rejected', 'Offer', 'Withdrawn');

alter table public.applications
  add constraint applications_status_check
  check (status in ('Applied', 'Reject', 'Accepted', 'Interview', 'OA'));

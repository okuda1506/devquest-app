create table public.learners (
  user_id uuid primary key references auth.users(id) on delete cascade,
  github_id bigint not null unique,
  github_login text not null,
  repo_id bigint unique,
  repo_name text,
  created_at timestamptz not null default now(),
  check ((repo_id is null) = (repo_name is null))
);

create table public.progress (
  user_id uuid not null references public.learners(user_id) on delete cascade,
  task_id text not null check (task_id in ('DEV-101','DEV-102','DEV-103','DEV-104')),
  status text not null default 'not_started' check (status in ('not_started','in_progress','passed','completed')),
  head_sha text,
  pull_number integer,
  merge_sha text,
  completed_at timestamptz,
  primary key (user_id, task_id)
);

create table public.submissions (
  user_id uuid not null,
  task_id text not null,
  head_sha text not null,
  run_id bigint not null,
  run_attempt integer not null,
  result text not null check (result in ('failed','passed')),
  run_url text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, task_id, run_id, run_attempt),
  foreign key (user_id, task_id) references public.progress on delete cascade
);

create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.learners(user_id) on delete cascade,
  task_id text not null,
  kind text not null check (kind in ('assigned','failed','passed','completed')),
  dedup_key text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedup_key)
);

alter table public.learners enable row level security;
alter table public.progress enable row level security;
alter table public.submissions enable row level security;
alter table public.notifications enable row level security;
revoke all on public.learners, public.progress, public.submissions, public.notifications from anon, authenticated;
grant select on public.learners, public.progress, public.submissions, public.notifications to authenticated;
create policy learners_read on public.learners for select to authenticated using (user_id = (select auth.uid()));
create policy progress_read on public.progress for select to authenticated using (user_id = (select auth.uid()));
create policy submissions_read on public.submissions for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_read on public.notifications for select to authenticated using (user_id = (select auth.uid()));

create function public.register_learner_repo(p_user uuid, p_repo bigint, p_name text)
returns void language plpgsql set search_path = '' as $$
begin
  update public.learners set repo_id = p_repo, repo_name = p_name
  where user_id = p_user and (repo_id is null or repo_id = p_repo);
  if not found then raise exception 'repo_already_registered'; end if;
  insert into public.progress(user_id,task_id) values(p_user,'DEV-101') on conflict do nothing;
  insert into public.notifications(user_id,task_id,kind,dedup_key)
  values(p_user,'DEV-101','assigned','assigned:DEV-101') on conflict do nothing;
end;
$$;

create function public.record_grade(
  p_user uuid, p_repo bigint, p_task text, p_previous text, p_next text, p_sha text,
  p_run bigint, p_attempt integer, p_url text, p_result text, p_pr integer, p_merge text
) returns text language plpgsql set search_path = '' as $$
declare
  current_status text;
  expected_previous text;
  expected_next text;
begin
  expected_previous := case p_task when 'DEV-102' then 'DEV-101' when 'DEV-103' then 'DEV-102' when 'DEV-104' then 'DEV-103' end;
  expected_next := case p_task when 'DEV-101' then 'DEV-102' when 'DEV-102' then 'DEV-103' when 'DEV-103' then 'DEV-104' end;
  if p_previous is distinct from expected_previous or p_next is distinct from expected_next then raise exception 'invalid_sequence'; end if;
  perform 1 from public.learners where user_id = p_user and repo_id = p_repo for update;
  if not found then raise exception 'invalid_repo'; end if;
  select status into current_status from public.progress where user_id = p_user and task_id = p_task for update;
  if not found or (p_previous is not null and not exists (
    select 1 from public.progress where user_id = p_user and task_id = p_previous and status = 'completed'
  )) then raise exception 'locked_task'; end if;
  if current_status = 'completed' then return current_status; end if;

  if p_result in ('failed','passed') then
    insert into public.submissions(user_id,task_id,head_sha,run_id,run_attempt,result,run_url)
    values(p_user,p_task,p_sha,p_run,p_attempt,p_result,p_url) on conflict do nothing;
    insert into public.notifications(user_id,task_id,kind,dedup_key)
    values(p_user,p_task,p_result,p_task || ':' || p_run || ':' || p_attempt) on conflict do nothing;
  end if;

  if p_result = 'passed' and p_pr is not null and p_merge is not null then
    current_status := 'completed';
    update public.progress set status = current_status, head_sha = p_sha, pull_number = p_pr,
      merge_sha = p_merge, completed_at = now() where user_id = p_user and task_id = p_task;
    insert into public.notifications(user_id,task_id,kind,dedup_key)
      values(p_user,p_task,'completed','completed:' || p_task) on conflict do nothing;
    if p_next is not null then
      insert into public.progress(user_id,task_id) values(p_user,p_next) on conflict do nothing;
      insert into public.notifications(user_id,task_id,kind,dedup_key)
        values(p_user,p_next,'assigned','assigned:' || p_next) on conflict do nothing;
    end if;
  elsif not exists (
    select 1 from public.submissions where user_id = p_user and task_id = p_task
      and (run_id, run_attempt) > (p_run, p_attempt)
  ) then
    current_status := case when p_result = 'passed' then 'passed' else 'in_progress' end;
    update public.progress set status = current_status, head_sha = p_sha
      where user_id = p_user and task_id = p_task;
  end if;
  return current_status;
end;
$$;

revoke execute on function public.register_learner_repo(uuid,bigint,text) from public, anon, authenticated;
revoke execute on function public.record_grade(uuid,bigint,text,text,text,text,bigint,integer,text,text,integer,text) from public, anon, authenticated;
grant execute on function public.register_learner_repo(uuid,bigint,text) to service_role;
grant execute on function public.record_grade(uuid,bigint,text,text,text,text,bigint,integer,text,text,integer,text) to service_role;

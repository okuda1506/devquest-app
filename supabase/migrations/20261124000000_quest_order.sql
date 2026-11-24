-- 旧課題の進捗を保ったまま チャプター順に40件を解放する
create table public.quest_order (
  position smallint primary key check (position > 0),
  task_id text not null unique
);
insert into public.quest_order(position,task_id) values
  (1, 'DEV-101'), (2, 'DEV-102'), (3, 'DEV-103'), (4, 'DEV-104'), (5, 'DEV-113'),
  (6, 'DEV-114'), (7, 'DEV-121'), (8, 'DEV-122'), (9, 'DEV-123'), (10, 'DEV-124'),
  (11, 'DEV-105'), (12, 'DEV-106'), (13, 'DEV-115'), (14, 'DEV-116'), (15, 'DEV-125'),
  (16, 'DEV-126'), (17, 'DEV-127'), (18, 'DEV-128'), (19, 'DEV-129'), (20, 'DEV-130'),
  (21, 'DEV-107'), (22, 'DEV-108'), (23, 'DEV-109'), (24, 'DEV-117'), (25, 'DEV-118'),
  (26, 'DEV-131'), (27, 'DEV-132'), (28, 'DEV-133'), (29, 'DEV-134'), (30, 'DEV-135'),
  (31, 'DEV-110'), (32, 'DEV-111'), (33, 'DEV-112'), (34, 'DEV-119'), (35, 'DEV-120'),
  (36, 'DEV-136'), (37, 'DEV-137'), (38, 'DEV-138'), (39, 'DEV-139'), (40, 'DEV-140');
alter table public.quest_order enable row level security;
revoke all on public.quest_order from anon, authenticated;
grant select on public.quest_order to service_role;

alter table public.progress
  drop constraint progress_task_id_check,
  add constraint progress_task_id_fkey foreign key (task_id) references public.quest_order(task_id);

-- DEV-104 まで完了済みの学習者にも 次の依頼を一度だけ配布する
with assigned as (
  insert into public.progress(user_id,task_id)
  select user_id,'DEV-113' from public.progress
  where task_id = 'DEV-104' and status = 'completed'
  on conflict do nothing
  returning user_id,task_id
)
insert into public.notifications(user_id,task_id,kind,dedup_key)
select user_id,task_id,'assigned','assigned:' || task_id from assigned
on conflict do nothing;

-- 移行中に旧 Edge Function から DEV-104 を完了しても DB 側で次を解放する
create or replace function public.record_grade(
  p_user uuid, p_repo bigint, p_task text, p_previous text, p_next text, p_sha text,
  p_run bigint, p_attempt integer, p_url text, p_result text, p_pr integer, p_merge text, p_checked_at timestamptz
) returns text language plpgsql set search_path = '' as $$
declare
  current_status text;
  last_check timestamptz;
  expected_previous text;
  expected_next text;
begin
  select prior.task_id, following.task_id into expected_previous, expected_next
  from public.quest_order current_task
  left join public.quest_order prior on prior.position = current_task.position - 1
  left join public.quest_order following on following.position = current_task.position + 1
  where current_task.task_id = p_task;
  if not found or p_previous is distinct from expected_previous or
    (p_next is distinct from expected_next and not (p_task = 'DEV-104' and p_next is null))
  then raise exception 'invalid_sequence'; end if;
  perform 1 from public.learners where user_id = p_user and repo_id = p_repo for update;
  if not found then raise exception 'invalid_repo'; end if;
  select status, checked_at into current_status, last_check from public.progress where user_id = p_user and task_id = p_task for update;
  if not found or (p_previous is not null and not exists (
    select 1 from public.progress where user_id = p_user and task_id = p_previous and status = 'completed'
  )) then raise exception 'locked_task'; end if;
  if current_status = 'completed' or last_check > p_checked_at then return current_status; end if;
  if p_result not in ('pending','failed','passed') or
    (p_result in ('failed','passed') and (p_run <= 0 or p_attempt <= 0)) or
    p_sha !~ '^[0-9a-f]{40}$' then raise exception 'invalid_grade'; end if;

  if p_result in ('failed','passed') then
    insert into public.submissions(user_id,task_id,head_sha,run_id,run_attempt,result,run_url)
    values(p_user,p_task,p_sha,p_run,p_attempt,p_result,p_url) on conflict do nothing;
    insert into public.notifications(user_id,task_id,kind,dedup_key)
    values(p_user,p_task,p_result,p_task || ':' || p_run || ':' || p_attempt) on conflict do nothing;
  end if;

  if p_result = 'passed' and p_pr is not null and p_merge is not null then
    current_status := 'completed';
    update public.progress set status = current_status, head_sha = p_sha, pull_number = p_pr,
      merge_sha = p_merge, completed_at = now(), checked_at = p_checked_at where user_id = p_user and task_id = p_task;
    insert into public.notifications(user_id,task_id,kind,dedup_key)
      values(p_user,p_task,'completed','completed:' || p_task) on conflict do nothing;
    if expected_next is not null then
      insert into public.progress(user_id,task_id) values(p_user,expected_next) on conflict do nothing;
      insert into public.notifications(user_id,task_id,kind,dedup_key)
        values(p_user,expected_next,'assigned','assigned:' || expected_next) on conflict do nothing;
    end if;
  else
    current_status := case when p_result = 'passed' then 'passed' else 'in_progress' end;
    update public.progress set status = current_status, head_sha = p_sha, checked_at = p_checked_at
      where user_id = p_user and task_id = p_task;
  end if;
  return current_status;
end;
$$;

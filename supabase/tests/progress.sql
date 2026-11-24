\set ON_ERROR_STOP on
insert into auth.users values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
set role service_role;
insert into public.learners(user_id,github_id,github_login)
values ('00000000-0000-0000-0000-000000000001',1,'first'), ('00000000-0000-0000-0000-000000000002',2,'second');
select public.register_learner_repo('00000000-0000-0000-0000-000000000001',71,'first/thread');
select public.register_learner_repo('00000000-0000-0000-0000-000000000001',71,'first/thread');
select public.register_learner_repo('00000000-0000-0000-0000-000000000002',72,'second/thread');
do $$
declare
    learner constant uuid := '00000000-0000-0000-0000-000000000001';
    commit_one constant text := repeat('a', 40);
    commit_two constant text := repeat('b', 40);
    merged constant text := repeat('c', 40);
    first_check constant timestamptz := '2026-11-23T10:00:00Z';
    second_check constant timestamptz := '2026-11-23T10:01:00Z';
    third_check constant timestamptz := '2026-11-23T10:02:00Z';
    state text;
begin
    begin
        perform public.record_grade(learner,71,'DEV-102','DEV-101','DEV-103',commit_one,1,1,'test','passed',2,merged,first_check);
        raise exception '次の課題が先に解放された';
    exception when raise_exception then
        if sqlerrm <> 'locked_task' then raise; end if;
    end;
    select public.record_grade(learner,71,'DEV-101',null,'DEV-102',commit_one,1,1,'test','passed',null,null,first_check) into state;
    if state <> 'passed' then raise exception '合格の記録に失敗'; end if;
    select public.record_grade(learner,71,'DEV-101',null,'DEV-102',commit_two,0,0,'','pending',null,null,second_check) into state;
    if state <> 'in_progress' then raise exception '新しい SHA の採点待ちを反映できない'; end if;
    select public.record_grade(learner,71,'DEV-101',null,'DEV-102',commit_one,1,1,'test','passed',null,null,first_check) into state;
    if state <> 'in_progress' then raise exception '古い採点結果で上書きされた'; end if;
    select public.record_grade(learner,71,'DEV-101',null,'DEV-102',commit_two,2,1,'test','passed',3,merged,third_check) into state;
    if state <> 'completed' then raise exception 'マージ確認後に完了していない'; end if;
    perform public.record_grade(learner,71,'DEV-101',null,'DEV-102',commit_two,2,1,'test','passed',3,merged,third_check);
    if (select count(*) from public.submissions where user_id = learner) <> 2 then raise exception '提出が重複した'; end if;
    if (select count(*) from public.notifications where user_id = learner and kind = 'assigned') <> 2 then raise exception '依頼の通知が重複した'; end if;
    if (select count(*) from public.notifications where user_id = learner and kind = 'completed') <> 1 then raise exception '完了通知が重複した'; end if;
    if not exists (select 1 from public.progress where user_id = learner and task_id = 'DEV-102' and status = 'not_started')
        then raise exception '次の課題が解放されていない'; end if;
end;
$$;

do $$
declare
    learner constant uuid := '00000000-0000-0000-0000-000000000001';
    task record;
    state text;
begin
    if (select count(*) from public.quest_order) <> 40 then raise exception '課題数が40件ではない'; end if;
    for task in select task_id, position, lag(task_id) over w as prior, lead(task_id) over w as following
                from public.quest_order window w as (order by position)
    loop
        if task.position = 1 then continue; end if;
        select public.record_grade(
            learner, 71, task.task_id, task.prior,
            case when task.task_id = 'DEV-104' then null else task.following end,
            repeat('a', 40), task.position + 2, 1, 'test', 'passed', task.position, repeat('c', 40), now()
        ) into state;
        if state <> 'completed' then raise exception '完了に失敗 %', task.task_id; end if;
    end loop;
    if (select count(*) from public.progress where user_id = learner and status = 'completed') <> 40
        then raise exception '全40件が順に完了していない'; end if;
    if (select count(*) from public.notifications where user_id = learner and kind = 'assigned') <> 40
        then raise exception '40件の依頼が一度ずつ配布されていない'; end if;
end;
$$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
do $$
begin
    if (select count(*) from public.learners) <> 1 or exists (select 1 from public.submissions) or
        exists (select 1 from public.progress where task_id = 'DEV-102') or
        exists (select 1 from public.notifications where kind = 'completed') then raise exception '別ユーザーのデータが閲覧できた'; end if;
    begin
        update public.progress set status = 'completed';
        raise exception 'ブラウザから進捗を更新できた';
    exception when insufficient_privilege then null;
    end;
    begin
        perform public.register_learner_repo('00000000-0000-0000-0000-000000000002',71,'first/thread');
        raise exception 'ブラウザから管理用 RPC を実行できた';
    exception when insufficient_privilege then null;
    end;
end;
$$;
reset role;
select '進捗の遷移、通知の重複防止、RLS を確認しました。';

begin;

insert into auth.users values
    ('00000000-0000-0000-0000-000000000011'),
    ('00000000-0000-0000-0000-000000000012');

set local role service_role;
do $$
declare
    learner constant uuid := '00000000-0000-0000-0000-000000000011';
    second_user constant uuid := '00000000-0000-0000-0000-000000000012';
begin
    if not public.sync_learner(learner, null, null, 'Google 利用者') then
        raise exception 'GitHub 未連携で初回プロフィールを保存できない';
    end if;
    if not public.sync_learner(learner, 88, 'example-learner', 'OAuth の表示名') then
        raise exception '同じ学習者 ID に GitHub を連携できない';
    end if;
    if public.sync_learner(learner, 89, 'different-learner', null) then
        raise exception '別の GitHub が上書きされた';
    end if;
    begin
        perform public.sync_learner(second_user, 88, 'example-learner', '別の学習者');
        raise exception '同じ GitHub が別の学習者に連携された';
    exception when unique_violation then null;
    end;
    if not exists (
        select 1 from public.learners where user_id = learner and github_id = 88 and display_name = 'Google 利用者'
    ) then raise exception '既存のプロフィールが認証によって上書きされた'; end if;
    perform public.stage_learner_repo(learner, 183, 'example-learner/thread');
    if exists (select 1 from public.progress where user_id = learner)
        or public.finish_first_day(learner, 88) then
        raise exception '起動確認前に課題が解放された';
    end if;

    update public.learners set onboarding = '{"scene":"request","menuIndex":0,"openedPages":["localhost:5174","localhost:5175"]}'
    where user_id = learner;
    if public.finish_first_day(learner, 89) then raise exception '別の GitHub で完了できた'; end if;
    if not public.finish_first_day(learner, 88) or not public.finish_first_day(learner, 88) then
        raise exception '初出勤の完了または再試行に失敗';
    end if;
    if (select count(*) from public.notifications where user_id = learner and task_id = 'DEV-101') <> 1
        or (select count(*) from public.progress where user_id = learner and task_id = 'DEV-101') <> 1 then
        raise exception '課題または通知が重複した';
    end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000012',true);
do $$
begin
    begin
        perform public.finish_first_day('00000000-0000-0000-0000-000000000011',88);
        raise exception '学習者から初出勤の管理用 RPC を実行できた';
    exception when insufficient_privilege then null;
    end;
end;
$$;
rollback;
select '学習者プロフィール、GitHub 連携の一意性、初回課題と通知の重複防止を確認しました。';

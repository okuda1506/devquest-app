alter table public.learners
    alter column github_id drop not null,
    alter column github_login drop not null,
    add column display_name text check (char_length(display_name) <= 50),
    add column onboarding jsonb,
    add column first_day_completed boolean not null default false;

-- 演習を開始済みの学習者は現在の課題から再開
update public.learners set first_day_completed = true where repo_id is not null;

create function public.sync_learner(p_user uuid, p_github bigint, p_login text, p_display text)
returns boolean language sql set search_path = '' as $$
    with saved as (
        insert into public.learners as learner (user_id, github_id, github_login, display_name)
        values (p_user, p_github, p_login, p_display)
        on conflict (user_id) do update set
            github_id = coalesce(learner.github_id, excluded.github_id),
            github_login = coalesce(excluded.github_login, learner.github_login),
            display_name = coalesce(learner.display_name, excluded.display_name)
        where excluded.github_id is null or learner.github_id is null or learner.github_id = excluded.github_id
        returning user_id
    )
    select exists (select 1 from saved)
$$;

create function public.stage_learner_repo(p_user uuid, p_repo bigint, p_name text)
returns void language plpgsql set search_path = '' as $$
begin
    update public.learners set repo_id = p_repo, repo_name = p_name
    where user_id = p_user and github_id is not null and (repo_id is null or repo_id = p_repo);
    if not found then raise exception 'repo_already_registered'; end if;
end;
$$;

create function public.finish_first_day(p_user uuid, p_github bigint)
returns boolean language plpgsql set search_path = '' as $$
declare
    learner public.learners;
begin
    select * into learner from public.learners where user_id = p_user for update;
    if not found or p_github is null or learner.github_id is distinct from p_github or learner.repo_id is null
        then return false; end if;
    if learner.first_day_completed then return true; end if;
    if not coalesce(learner.onboarding->>'scene' = 'request' and
        learner.onboarding->'openedPages' @> '["localhost:5174","localhost:5175"]'::jsonb, false)
        then return false; end if;

    perform public.register_learner_repo(p_user, learner.repo_id, learner.repo_name);
    update public.learners set first_day_completed = true, onboarding = null where user_id = p_user;
    return true;
end;
$$;

revoke execute on function public.sync_learner(uuid,bigint,text,text),
    public.stage_learner_repo(uuid,bigint,text), public.finish_first_day(uuid,bigint) from public, anon, authenticated;
grant execute on function public.sync_learner(uuid,bigint,text,text),
    public.stage_learner_repo(uuid,bigint,text), public.finish_first_day(uuid,bigint) to service_role;

alter table public.learners
    add column privacy_policy_version text,
    add column privacy_consented_at timestamptz,
    add constraint learners_privacy_consent_pair
        check ((privacy_policy_version is null) = (privacy_consented_at is null));

-- OAuth の開始前に確定した同意を PKCE チャレンジに紐づける
create table public.signup_consents (
    challenge text primary key check (challenge ~ '^[A-Za-z0-9_-]{43}$'),
    version text not null check (version = '2026-11-26'),
    accepted_at timestamptz not null default now()
);
alter table public.signup_consents enable row level security;
revoke all on public.signup_consents from public, anon, authenticated;
grant select, insert, delete on public.signup_consents to service_role;

create function public.begin_signup_consent(p_challenge text, p_version text)
returns void language sql set search_path = '' as $$
    delete from public.signup_consents where accepted_at <= now() - interval '10 minutes';
    insert into public.signup_consents(challenge,version) values (p_challenge,p_version)
$$;

create function public.finish_signup_consent(
    p_challenge text, p_user uuid, p_github bigint, p_login text, p_display text
) returns boolean language plpgsql set search_path = '' as $$
declare
    consent public.signup_consents;
begin
    delete from public.signup_consents where challenge = p_challenge
        and accepted_at > now() - interval '10 minutes'
        returning * into consent;
    if not found then return false; end if;
    if not exists (select 1 from auth.identities where user_id = p_user and provider = 'google')
        then return false; end if;

    insert into public.learners(user_id,github_id,github_login,display_name,privacy_policy_version,privacy_consented_at)
        values (p_user,p_github,p_login,p_display,consent.version,consent.accepted_at)
        on conflict (user_id) do nothing;
    return true;
end;
$$;

-- 認証セッションから直接 home を呼んでも Google の新規プロフィールを作成できない
create or replace function public.sync_learner(p_user uuid, p_github bigint, p_login text, p_display text)
returns boolean language sql set search_path = '' as $$
    with saved as (
        insert into public.learners as learner (user_id, github_id, github_login, display_name)
        select p_user, p_github, p_login, p_display
        where exists (select 1 from public.learners where user_id = p_user)
           or (p_github is not null and not exists (
               select 1 from auth.identities where user_id = p_user and provider = 'google'
           ))
        on conflict (user_id) do update set
            github_id = coalesce(learner.github_id, excluded.github_id),
            github_login = coalesce(excluded.github_login, learner.github_login),
            display_name = coalesce(learner.display_name, excluded.display_name)
        where excluded.github_id is null or learner.github_id is null or learner.github_id = excluded.github_id
        returning user_id
    )
    select exists (select 1 from saved)
$$;

revoke execute on function public.begin_signup_consent(text,text),
    public.finish_signup_consent(text,uuid,bigint,text,text) from public, anon, authenticated;
grant execute on function public.begin_signup_consent(text,text),
    public.finish_signup_consent(text,uuid,bigint,text,text) to service_role;
-- Supabase の service_role には通常ある権限を明示して ID の照合に使う
grant usage on schema auth to service_role;
grant select (user_id, provider) on auth.identities to service_role;

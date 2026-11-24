import { createClient } from 'npm:@supabase/supabase-js@2.119.2';

import { QuestError } from './auth-errors.ts';
import { normalizeDisplayName } from './onboarding.ts';

export function questDatabase(env: (name: string) => string | undefined) {
    const url = env('SUPABASE_URL');
    const key = env('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) throw new QuestError('サーバーの接続設定がありません。', 503);
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function authenticate(request: Request, env: (name: string) => string | undefined) {
    const token = /^Bearer (\S+)$/.exec(request.headers.get('Authorization') ?? '')?.[1];
    if (!token) throw new QuestError('DevQuest にログインしてください。', 401);
    const db = questDatabase(env);
    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user) throw new QuestError('セッションを確認できません。ログインし直してください。', 401);
    const identity = data.user.identities?.find((item) => item.provider === 'github');
    const id = Number(identity?.identity_data?.provider_id ?? identity?.identity_data?.sub ?? identity?.id);
    const githubId = Number.isSafeInteger(id) && id > 0 ? id : null;
    const login = identity?.identity_data?.user_name ?? identity?.identity_data?.preferred_username;
    const google = data.user.identities?.find((item) => item.provider === 'google');
    if (!google && !githubId) throw new QuestError('Google または連携済みの認証方法でサインインしてください。', 403);
    const displayName = normalizeDisplayName(google?.identity_data?.full_name ?? google?.identity_data?.name) || null;
    return {
        db,
        userId: data.user.id,
        githubId,
        googleLinked: !!google,
        displayName,
        login: githubId ? (typeof login === 'string' ? login : String(githubId)) : null
    };
}

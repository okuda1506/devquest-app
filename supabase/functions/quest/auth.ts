import { createClient } from 'npm:@supabase/supabase-js@2.119.2';

import { QuestError } from "./auth-errors.ts";

export async function authenticate(request: Request, env: (name: string) => string | undefined) {
  const token = /^Bearer (\S+)$/.exec(request.headers.get('Authorization') ?? '')?.[1];
  if (!token) throw new QuestError('GitHub でログインしてください。', 401);
  const url = env('SUPABASE_URL');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new QuestError('サーバーの接続設定がありません。', 503);
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new QuestError('セッションを確認できません。ログインし直してください。', 401);
  const identity = data.user.identities?.find(item => item.provider === 'github');
  const id = Number(identity?.identity_data?.provider_id ?? identity?.identity_data?.sub ?? identity?.id);
  if (!Number.isSafeInteger(id) || id <= 0) throw new QuestError('GitHub アカウントとの紐付けが必要です。', 403);
  const login = identity?.identity_data?.user_name ?? identity?.identity_data?.preferred_username;
  return { db, userId: data.user.id, githubId: id, login: typeof login === 'string' ? login : String(id) };
}

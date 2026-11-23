import { QuestError } from './auth-errors.ts';

export async function exchangeOAuth(code: unknown, verifier: unknown, env: (key: string) => string | undefined, request = fetch) {
  if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{16,256}$/.test(code) ||
      typeof verifier !== 'string' || !/^[A-Za-z0-9_-]{43,128}$/.test(verifier)) {
    throw new QuestError('ログインの確認情報がありません。もう一度ログインしてください。', 400);
  }
  const url = env('SUPABASE_URL');
  const key = env('SUPABASE_ANON_KEY');
  if (!url || !key) throw new QuestError('ログインの接続設定がありません。', 503);

  const response = await request(url + '/auth/v1/token?grant_type=pkce', {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
    signal: AbortSignal.timeout(8000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || typeof data?.access_token !== 'string' || typeof data?.refresh_token !== 'string') {
    throw new QuestError('認証コードを確認できませんでした。もう一度ログインしてください。', 401);
  }
  // GitHub のアクセストークンは返さず、Supabase のセッションだけをブラウザへ渡す。
  return { access_token: data.access_token, refresh_token: data.refresh_token };
}

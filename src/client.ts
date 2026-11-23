import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = url && key ? createClient(url, key) : null;

export async function signIn() {
  if (!supabase) throw new Error('Supabase の接続設定がありません。');
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo: window.location.origin + window.location.pathname, scopes: 'read:user' },
  });
  if (error) throw new Error('GitHub ログインを開始できませんでした。');
}

export async function callQuest<T>(body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('Supabase の接続設定がありません。');
  const { data, error } = await supabase.functions.invoke('quest', { body });
  if (error) {
    const response = error.context;
    if (response instanceof Response) {
      const details = await response.json().catch(() => null);
      if (typeof details?.error === 'string') throw new Error(details.error);
    }
    throw new Error('サーバーに接続できませんでした。少し待ってからお試しください。');
  }
  return data as T;
}

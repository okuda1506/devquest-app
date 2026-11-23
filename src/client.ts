import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const verifierKey = 'devquest-oauth-verifier';
export const supabase = url && key ? createClient(url, key, { auth: { detectSessionInUrl: false, flowType: 'pkce' } }) : null;

function base64Url(value: Uint8Array) {
  return btoa(String.fromCharCode(...value)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export async function signIn() {
  if (!supabase) throw new Error('Supabase の接続設定がありません。');
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  sessionStorage.setItem(verifierKey, verifier);
  const authorize = new URL(url + '/auth/v1/authorize');
  authorize.search = new URLSearchParams({
    provider: 'github', scopes: 'read:user',
    redirect_to: window.location.origin + window.location.pathname,
    code_challenge: challenge, code_challenge_method: 's256',
  }).toString();
  window.location.assign(authorize);
}

export async function finishSignIn() {
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  if (!code && !params.has('error')) return;
  const verifier = sessionStorage.getItem(verifierKey);
  sessionStorage.removeItem(verifierKey);
  history.replaceState(null, '', location.pathname + location.hash);
  if (!code || !verifier || !supabase) throw new Error('GitHub ログインを完了できませんでした。');
  const tokens = await callQuest<{ access_token: string; refresh_token: string }>({ action: 'exchange', code, verifier });
  const { error } = await supabase.auth.setSession(tokens);
  if (error) throw new Error('ログインを完了できませんでした。');
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

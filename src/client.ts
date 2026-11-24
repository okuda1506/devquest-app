import { createClient } from '@supabase/supabase-js';
import { questSessionStorage } from './quest-session';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const verifierKey = 'devquest-oauth-verifier';
const returnKey = 'devquest-oauth-return';
const storageKey = url ? 'sb-' + new URL(url).hostname.split('.')[0] + '-auth-token' : 'devquest-auth-token';
const authStorage = questSessionStorage(storageKey);
export const sessionExpiration = authStorage.expiration;
export const supabase =
    url && key
        ? createClient(url, key, {
              auth: { detectSessionInUrl: false, flowType: 'pkce', storageKey, storage: authStorage }
          })
        : null;

function base64Url(value: Uint8Array) {
    return btoa(String.fromCharCode(...value))
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replace(/=+$/, '');
}

export async function signIn() {
    if (!supabase) throw new Error('Supabase の接続設定がありません。');
    const verifier = base64Url(crypto.getRandomValues(new Uint8Array(32)));
    const challenge = base64Url(
        new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
    );
    sessionStorage.setItem(verifierKey, verifier);
    sessionStorage.setItem(returnKey, location.hash && location.hash !== '#/' ? location.hash : '#/settings');
    const authorize = new URL(url + '/auth/v1/authorize');
    authorize.search = new URLSearchParams({
        provider: 'github',
        scopes: 'read:user',
        redirect_to: window.location.origin + window.location.pathname,
        code_challenge: challenge,
        code_challenge_method: 's256'
    }).toString();
    window.location.assign(authorize);
}

export async function finishSignIn() {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    const oauthError = params.get('error') ?? params.get('error_code');
    if (!code && !oauthError) return;
    const verifier = sessionStorage.getItem(verifierKey);
    const returnHash = sessionStorage.getItem(returnKey);
    sessionStorage.removeItem(verifierKey);
    sessionStorage.removeItem(returnKey);
    history.replaceState(null, '', location.pathname + location.hash);
    if (returnHash?.startsWith('#/') && returnHash !== location.hash) location.hash = returnHash;
    if (oauthError === 'access_denied') {
        throw new Error('GitHub のログインがキャンセルされました。「GitHub で始める」からやり直せます。');
    }
    if (!code || !verifier || !supabase) {
        throw new Error('GitHub ログインを完了できませんでした。同じタブで最初からやり直してください。');
    }
    const tokens = await callQuest<{ access_token: string; refresh_token: string }>({
        action: 'exchange',
        code,
        verifier
    });
    authStorage.beginLogin(tokens.access_token);
    try {
        const { error } = await supabase.auth.setSession(tokens);
        if (error || !authStorage.expiration()) throw new Error('ログインを完了できませんでした。');
    } finally {
        authStorage.finishLogin();
    }
}

export class QuestRequestError extends Error {
    constructor(
        message: string,
        readonly status?: number
    ) {
        super(message);
    }
}

export async function callQuest<T>(body: Record<string, unknown>): Promise<T> {
    if (!supabase) throw new Error('Supabase の接続設定がありません。');
    if (body.action !== 'exchange' && !authStorage.expiration()) {
        throw new QuestRequestError('ログインの有効期限が切れました。もう一度ログインしてください。', 401);
    }
    const { data, error } = await supabase.functions.invoke('quest', { body });
    if (error) {
        const response = error.context;
        if (response instanceof Response) {
            const details = await response.json().catch(() => null);
            if (typeof details?.error === 'string') throw new QuestRequestError(details.error, response.status);
        }
        throw new QuestRequestError('サーバーに接続できませんでした。少し待ってからお試しください。');
    }
    return data as T;
}

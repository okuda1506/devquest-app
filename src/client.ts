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

export const googleOnboarding = import.meta.env.VITE_GOOGLE_ONBOARDING === 'true';

type Provider = 'google' | 'github';
type OAuthIntent = { provider: Provider; returnHash: string; userId?: string };
const intentKey = 'devquest-oauth-intent';

async function startOAuth(intent: OAuthIntent, accessToken?: string) {
    if (!supabase) throw new Error('Supabase の接続設定がありません。');
    const verifier = base64Url(crypto.getRandomValues(new Uint8Array(32)));
    const challenge = base64Url(
        new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
    );
    const path = accessToken ? '/auth/v1/user/identities/authorize' : '/auth/v1/authorize';
    const authorize = new URL(url + path);
    authorize.search = new URLSearchParams({
        provider: intent.provider,
        ...(intent.provider === 'github' ? { scopes: 'read:user' } : {}),
        redirect_to: location.origin + location.pathname,
        code_challenge: challenge,
        code_challenge_method: 's256'
    }).toString();

    let destination = authorize.href;
    if (accessToken) {
        authorize.searchParams.set('skip_http_redirect', 'true');
        const response = await fetch(authorize, {
            headers: { apikey: key, Authorization: 'Bearer ' + accessToken },
            signal: AbortSignal.timeout(8000)
        });
        const body = await response.json().catch(() => null);
        if (!response.ok || typeof body?.url !== 'string') {
            throw new Error('アカウント連携を開始できませんでした。時間をおいて再試行してください。');
        }
        const redirect = new URL(body.url);
        if (
            redirect.protocol !== 'https:' ||
            ![new URL(url).origin, 'https://accounts.google.com', 'https://github.com'].includes(redirect.origin)
        ) {
            throw new Error('アカウント連携のリダイレクト先を確認できませんでした。');
        }
        destination = redirect.href;
    }
    sessionStorage.setItem(verifierKey, verifier);
    sessionStorage.setItem(intentKey, JSON.stringify(intent));
    location.assign(destination);
}

export function signIn() {
    const returnHash = location.hash && location.hash !== '#/' ? location.hash : '#/settings';
    return startOAuth({ provider: googleOnboarding ? 'google' : 'github', returnHash });
}

export async function linkProvider(provider: Provider, returnHash: string) {
    const session = (await supabase?.auth.getSession())?.data.session;
    if (!session || !authStorage.expiration()) throw new Error('もう一度サインインしてください。');
    return startOAuth({ provider, returnHash, userId: session.user.id }, session.access_token);
}

export async function finishSignIn() {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    const oauthError = params.get('error_code') ?? params.get('error');
    if (!code && !oauthError) return;
    const verifier = sessionStorage.getItem(verifierKey);
    const raw = sessionStorage.getItem(intentKey);
    const intent: OAuthIntent = raw
        ? JSON.parse(raw)
        : {
              provider: 'github',
              returnHash: sessionStorage.getItem(returnKey) ?? location.hash
          };
    sessionStorage.removeItem(verifierKey);
    sessionStorage.removeItem(returnKey);
    sessionStorage.removeItem(intentKey);
    history.replaceState(history.state, '', location.pathname + location.hash);
    if (intent.returnHash?.startsWith('#/') && intent.returnHash !== location.hash) location.hash = intent.returnHash;

    const label = intent.provider === 'google' ? 'Google' : 'GitHub';
    if (oauthError === 'access_denied' || params.get('error') === 'access_denied')
        throw new Error(label + ' の認証がキャンセルされました。もう一度お試しください。');
    if (oauthError === 'identity_already_exists') {
        throw new Error(
            label + ' アカウントはすでに別のアカウントに紐づいています。元のアカウントでサインインしてください。'
        );
    }
    if (oauthError || !code || !verifier || !supabase) {
        throw new Error(label + ' の認証を完了できませんでした。同じタブで最初からやり直してください。');
    }
    if (intent.userId) {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user.id !== intent.userId || !authStorage.expiration()) {
            throw new Error('連携開始時のセッションが切れました。サインインして初出勤の続きから再試行してください。');
        }
    }
    const tokens = await callQuest<{ access_token: string; refresh_token: string }>({
        action: 'exchange',
        code,
        verifier
    });
    if (intent.userId || intent.provider === 'google') {
        const { data, error } = await supabase.auth.getUser(tokens.access_token);
        if (
            error ||
            !data.user?.identities?.some(({ provider }) => provider === intent.provider) ||
            (intent.userId && data.user.id !== intent.userId)
        ) {
            throw new Error(
                '認証後のアカウントを確認できませんでした。連携するアカウントを確認して再試行してください。'
            );
        }
    }
    if (!intent.userId) authStorage.beginLogin(tokens.access_token);
    try {
        const { error } = await supabase.auth.setSession(tokens);
        if (error || !authStorage.expiration()) throw new Error(label + ' の認証を完了できませんでした。');
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

import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { questSessionStorage } from './quest-session';

const key = 'sb-devquest-auth-token';
const hour = 60 * 60 * 1000;
const start = 1800000000000;

beforeEach(() => {
    const entries = new Map<string, string>();
    vi.useFakeTimers();
    vi.setSystemTime(start);
    vi.stubGlobal('localStorage', {
        getItem: (name: string) => entries.get(name) ?? null,
        setItem: (name: string, value: string) => entries.set(name, value),
        removeItem: (name: string) => entries.delete(name)
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

test('再起動やトークンの更新でログイン時に決めた期限を延長しない', () => {
    const firstTab = questSessionStorage(key);
    firstTab.beginLogin('initial');
    firstTab.setItem(key, '{"access_token":"initial"}');
    firstTab.finishLogin();

    vi.setSystemTime(start + hour / 2);
    const newTab = questSessionStorage(key);
    expect(newTab.getItem(key)).toBe('{"access_token":"initial"}');
    newTab.setItem(key, '{"access_token":"refreshed"}');
    expect(firstTab.expiration()).toBe(start + hour);

    vi.setSystemTime(start + hour);
    expect(newTab.getItem(key)).toBeNull();
    newTab.setItem(key, '{"access_token":"late-refresh"}');
    expect(localStorage.getItem(key)).toBeNull();

    newTab.beginLogin('new-login');
    newTab.setItem(key, '{"access_token":"new-login"}');
    newTab.finishLogin();
    expect(newTab.expiration()).toBe(start + hour * 2);
});

test('旧版の保存データはアクセストークンの残り時間だけ引き継いで破棄する', () => {
    const raw = JSON.stringify({ access_token: 'legacy', expires_at: (start + hour / 2) / 1000 });
    localStorage.setItem(key, raw);
    const session = questSessionStorage(key);
    expect(session.getItem(key)).toBe(raw);
    expect(session.expiration()).toBe(start + hour / 2);
    vi.setSystemTime(start + hour / 2);
    expect(session.expiration()).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
});

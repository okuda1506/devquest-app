const oneHour = 60 * 60 * 1000;

type SavedSession = { value: string; expiresAt: number };

export function questSessionStorage(sessionKey: string) {
    const memory = new Map<string, string>();
    let persistent = true;
    let login: { token: string; expiresAt: number } | null = null;

    function read(key: string) {
        if (persistent) {
            try {
                return localStorage.getItem(key);
            } catch {
                persistent = false;
            }
        }
        return memory.get(key) ?? null;
    }

    function write(key: string, value: string | null) {
        if (value === null) memory.delete(key);
        else memory.set(key, value);
        if (!persistent) return;
        try {
            if (value === null) localStorage.removeItem(key);
            else localStorage.setItem(key, value);
        } catch {
            persistent = false;
        }
    }

    function readSession(): SavedSession | null {
        const value = read(sessionKey);
        if (!value) return null;
        try {
            const saved = JSON.parse(value) as Partial<SavedSession> & { expires_at?: number; access_token?: string };
            if (
                saved &&
                typeof saved.value === 'string' &&
                typeof saved.expiresAt === 'number' &&
                Number.isFinite(saved.expiresAt)
            ) {
                return { value: saved.value, expiresAt: saved.expiresAt };
            }
            // 旧版の保存形式では、既存トークンの残り時間だけ引き継ぐ。
            if (
                saved &&
                typeof saved.access_token === 'string' &&
                typeof saved.expires_at === 'number' &&
                Number.isFinite(saved.expires_at)
            ) {
                const session = { value, expiresAt: Math.min(saved.expires_at * 1000, Date.now() + oneHour) };
                if (session.expiresAt > Date.now()) write(sessionKey, JSON.stringify(session));
                return session;
            }
        } catch {
            /* 壊れた保存データは破棄する。 */
        }
        write(sessionKey, null);
        return null;
    }

    function activeSession() {
        const saved = readSession();
        if (saved && Date.now() < saved.expiresAt) return saved;
        if (saved) write(sessionKey, null);
        return null;
    }

    return {
        getItem(key: string) {
            return key === sessionKey ? (activeSession()?.value ?? null) : read(key);
        },
        setItem(key: string, value: string) {
            if (key !== sessionKey) {
                write(key, value);
                return;
            }
            const explicitLogin = login && JSON.parse(value).access_token === login.token;
            // Supabase がトークンを更新しても、アプリのログイン期限は延長しない。
            const expiresAt = explicitLogin ? login?.expiresAt : activeSession()?.expiresAt;
            if (expiresAt && expiresAt > Date.now()) write(sessionKey, JSON.stringify({ value, expiresAt }));
        },
        removeItem(key: string) {
            write(key, null);
        },
        expiration() {
            return activeSession()?.expiresAt ?? null;
        },
        beginLogin(token: string) {
            login = { token, expiresAt: Date.now() + oneHour };
        },
        finishLogin() {
            login = null;
        }
    };
}

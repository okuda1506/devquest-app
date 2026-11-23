// ブラウザが保存を制限していても、開いている画面では設定を切り替えられるようにする。
export function readPreference(key: string) {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

export function savePreference(key: string, value: string) {
    try {
        localStorage.setItem(key, value);
    } catch {
        /* 現在のタブでは React の状態を使う。 */
    }
}

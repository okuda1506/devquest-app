import { useState, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { readPreference, savePreference } from './preferences';

type Action = (input: Record<string, unknown>) => Promise<boolean>;

export function RepositoryForm({ login, busy, action }: { login: string; busy: boolean; action: Action }) {
    const draftKey = 'devquest-repository-draft:' + login;
    const [repository, setRepository] = useState(() => readPreference(draftKey) ?? '');
    async function register(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (await action({ action: 'register', repository })) savePreference(draftKey, '');
    }
    return (
        <form onSubmit={register}>
            <label className="repo-field">
                GitHub のリポジトリ URL または所有者名/リポジトリ名
                <input
                    name="repository"
                    placeholder={`https://github.com/${login}/thread`}
                    value={repository}
                    onChange={(event) => {
                        setRepository(event.target.value);
                        savePreference(draftKey, event.target.value);
                    }}
                    autoComplete="off"
                    required
                    maxLength={180}
                />
            </label>
            <button className="button primary" disabled={busy || !repository.trim()}>
                登録する <ArrowRight size={15} />
            </button>
        </form>
    );
}

import { describe, expect, test, vi } from 'vitest';
import { getTask, tasks, template, branchCommands } from './catalog';
import { GithubError, inspectGrade, repoName, verifyProtection, verifyRepo, type Github, type Repo } from './github';
import { exchangeOAuth } from './oauth';

const canonical = ['a'.repeat(40)];
const main = 'b'.repeat(40);
const sha = 'c'.repeat(40);
const merge = 'd'.repeat(40);
const changed = 'e'.repeat(40);
const repo: Repo = {
    id: 61,
    full_name: 'learner/thread',
    owner: { id: 40, login: 'learner' },
    private: false,
    default_branch: 'main',
    archived: false
};
const task = getTask('DEV-101')!;
const workflow = { path: '.github/workflows/grade.yml', sha: '7'.repeat(40), mode: '100644', type: 'blob' };
type Fixture = {
    branch?: string;
    head?: string | null;
    runHead?: string;
    merged?: boolean;
    changedFiles?: boolean;
    base?: string;
    relation?: string;
    conclusion?: string;
    movingHead?: boolean;
};
function github({
    branch = task.branch,
    head = sha,
    runHead = sha,
    merged,
    changedFiles,
    base = 'main',
    relation = 'ahead',
    conclusion = 'success',
    movingHead
}: Fixture = {}): Github {
    let readCount = 0;
    return async <T>(path: string): Promise<T> => {
        const url = new URL(path, 'https://api.github.com');
        const slug = url.pathname;
        const data: unknown = (() => {
            if (slug.endsWith('/git/ref/heads/main')) return { object: { type: 'commit', sha: main } };
            if (slug.includes('/git/ref/heads/')) {
                if (!head || !slug.endsWith('/' + branch)) throw new GithubError(404);
                return { object: { type: 'commit', sha: readCount++ && movingHead ? changed : head } };
            }
            if (slug.includes('/pulls'))
                return merged
                    ? [
                          {
                              number: 3,
                              merged_at: '2026-11-23',
                              merge_commit_sha: merge,
                              head: { ref: task.branch, sha, repo: { id: repo.id }, user: { id: repo.owner.id } },
                              base: { ref: base, repo: { id: repo.id } }
                          }
                      ]
                    : [];
            if (slug.includes('/git/commits/')) return { tree: { sha: slug.split('/').at(-1) } };
            if (slug.includes('/git/trees/'))
                return {
                    truncated: false,
                    tree: slug.includes(template) || !changedFiles ? [workflow] : [{ ...workflow, sha: changed }]
                };
            if (slug.includes('/compare/')) return { status: relation };
            if (slug.includes('/actions/workflows/grade.yml/runs'))
                return {
                    workflow_runs: [
                        {
                            id: 701,
                            run_attempt: 1,
                            event: 'push',
                            head_branch: branch,
                            head_sha: runHead,
                            head_repository: { id: repo.id },
                            repository: { id: repo.id },
                            path: workflow.path + '@refs/heads/' + task.branch,
                            status: 'completed',
                            conclusion
                        }
                    ]
                };
            throw new Error('未定義の API パス ' + path);
        })();
        return data as T;
    };
}

describe('演習の判定', () => {
    test('12課題の指定ブランチと公開範囲が一致する', () => {
        expect(tasks).toHaveLength(12);
        expect(tasks.filter((item) => item.available).map((item) => item.id)).toEqual([
            'DEV-101',
            'DEV-102',
            'DEV-103',
            'DEV-104'
        ]);
        expect(tasks.every((item) => item.branch === 'task/' + item.id)).toBe(true);
        expect(branchCommands(getTask('DEV-102')!)).toContain('git switch -c task/DEV-102');
    });

    test('登録時の所有者と公開範囲を確認する', () => {
        expect(repoName('https://github.com/learner/thread')).toBe(repo.full_name);
        expect(() => repoName('learner/..')).toThrow();
        expect(() => verifyRepo(repo, 39)).toThrow(/所有/);
        expect(() => verifyRepo({ ...repo, private: true }, 40)).toThrow(/公開/);
        expect(() => verifyRepo(repo, 40)).not.toThrow();
    });

    test('指定コミットの合格と、main へのマージを別々に判定する', async () => {
        expect(await inspectGrade(github(), canonical, repo, task, null)).toMatchObject({
            result: 'passed',
            merge: null,
            sha,
            run: 701
        });
        expect(await inspectGrade(github({ merged: true, head: null }), canonical, repo, task, null)).toMatchObject({
            result: 'passed',
            merge,
            pull: 3,
            sha
        });
        expect(await inspectGrade(github({ merged: true, base: 'other' }), canonical, repo, task, null)).toMatchObject({
            merge: null
        });
        expect(
            await inspectGrade(github({ conclusion: 'failure', merged: true }), canonical, repo, task, null)
        ).toMatchObject({ result: 'failed', merge: null });
    });

    test('異なるブランチや過去のコミットの結果を合格にしない', async () => {
        await expect(inspectGrade(github({ branch: 'task/DEV-999' }), canonical, repo, task, null)).rejects.toThrow(
            /指定ブランチ/
        );
        expect(
            await inspectGrade(github({ runHead: changed, merged: true }), canonical, repo, task, null)
        ).toMatchObject({ result: 'pending', merge: null });
        await expect(inspectGrade(github({ movingHead: true }), canonical, repo, task, null)).rejects.toThrow(/更新/);
    });

    test('採点ファイルの差し替えを拒否し、前の課題のマージを要求する', async () => {
        await expect(inspectGrade(github({ changedFiles: true }), canonical, repo, task, null)).rejects.toThrow(
            /保護ファイル/
        );
        await expect(inspectGrade(github(), canonical, repo, getTask('DEV-102')!, null)).rejects.toThrow(/解放/);
        await expect(inspectGrade(github({ relation: 'diverged' }), canonical, repo, task, null)).rejects.toThrow(
            /最新の main/
        );
    });
});

test('分離前と分離後の採点基準を認め、異なる版を混ぜた提出を拒否する', async () => {
    const legacy = { ...workflow, sha: '8'.repeat(40) };
    const adminConfig = { ...workflow, path: 'admin/vite.config.ts', sha: '9'.repeat(40) };
    const fixture =
        (candidate: Array<typeof workflow>): Github =>
        async <T>(path: string) => {
            const source = path.includes(template);
            const tree = path.includes(canonical[0]) ? [workflow, adminConfig] : [legacy];
            return (
                path.includes('/git/commits/')
                    ? { tree: { sha: path.split('/').at(-1) } }
                    : { truncated: false, tree: source ? tree : candidate }
            ) as T;
        };
    const baselines = [...canonical, 'f'.repeat(40)];
    await expect(
        verifyProtection(fixture([workflow, adminConfig]), baselines, repo.full_name, sha)
    ).resolves.toBeUndefined();
    await expect(verifyProtection(fixture([legacy]), baselines, repo.full_name, sha)).resolves.toBeUndefined();
    const changedConfig = { ...adminConfig, sha: changed };
    await expect(verifyProtection(fixture([workflow, changedConfig]), baselines, repo.full_name, sha)).rejects.toThrow(
        /保護ファイル/
    );
    await expect(verifyProtection(fixture([legacy, adminConfig]), baselines, repo.full_name, sha)).rejects.toThrow(
        /保護ファイル/
    );
});

test('OAuth 交換では GitHub トークンをブラウザに返さない', async () => {
    const exchange = vi.fn(async () =>
        Response.json({ access_token: 'access', refresh_token: 'refresh', provider_token: 'github-token' })
    );
    const env = (name: string) => (name === 'SUPABASE_URL' ? 'https://supabase.test' : 'anon');
    const session = await exchangeOAuth('c'.repeat(36), 'v'.repeat(43), env, exchange);
    expect(session).toEqual({ access_token: 'access', refresh_token: 'refresh' });
    await expect(exchangeOAuth('x', 'v'.repeat(43), env, exchange)).rejects.toThrow(/確認情報/);
    expect(exchange).toHaveBeenCalledTimes(1);
});

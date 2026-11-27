import { describe, expect, test, vi } from 'vitest';
import { getTask, tasks, template, branchCommands } from './catalog';
import {
    GithubError,
    inspectGrade,
    quest40Baseline,
    operationsBaseline,
    architectureBaseline,
    catalogBaseline,
    accountModelBaseline,
    numericShopBaseline,
    paymentBaseline,
    pullRequestBaseline,
    readCriteria,
    repoName,
    verifyProtection,
    verifyRepo,
    type Github,
    type Repo
} from './github';
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
    open?: boolean;
    closed?: boolean;
    pullHead?: string;
    pullRepoId?: number;
    runEvent?: 'pull_request' | 'push';
    runPull?: number;
    changedFiles?: boolean;
    base?: string;
    relation?: string;
    conclusion?: string;
    runStatus?: string;
    movingHead?: boolean;
};
function github({
    branch = task.branch,
    head = sha,
    runHead = sha,
    merged,
    open,
    closed,
    pullHead = sha,
    pullRepoId = repo.id,
    runEvent = 'push',
    runPull = 3,
    changedFiles,
    base = 'main',
    relation = 'ahead',
    conclusion = 'success',
    runStatus = 'completed',
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
                return merged || open || closed
                    ? [
                          {
                              number: 3,
                              state: open ? 'open' : 'closed',
                              merged_at: merged ? '2026-11-23' : null,
                              merge_commit_sha: merged ? merge : null,
                              head: {
                                  ref: branch, sha: pullHead, repo: { id: pullRepoId }, user: { id: repo.owner.id }
                              },
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
                            event: runEvent,
                            display_title: 'DevQuest PR #' + runPull,
                            head_branch: branch,
                            head_sha: runHead,
                            head_repository: { id: repo.id },
                            repository: { id: repo.id },
                            path: workflow.path + '@refs/heads/' + task.branch,
                            status: runStatus,
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
    const prCanonical = [pullRequestBaseline];

    test.each([
        {},
        { closed: true },
        { open: true, base: 'another-base' },
        { open: true, pullRepoId: 999 },
        { open: true, pullHead: changed }
    ])('v10 は現在の作業コミットを対象とする PR が開くまで採点しない %o', async (fixture) => {
        const api = vi.fn(github(fixture));
        await expect(inspectGrade(api, prCanonical, repo, task, null)).resolves.toEqual({
            result: 'unsubmitted',
            state: 'awaiting_pr'
        });
        expect(api.mock.calls.some(([path]) => path.includes('/actions/'))).toBe(false);
    });

    test.each([
        { runEvent: 'push' as const },
        { runEvent: 'pull_request' as const, runPull: 2 },
        { runEvent: 'pull_request' as const, runHead: changed }
    ])('v10 は別イベント・別 PR・更新前の結果を採用しない %o', async (fixture) => {
        const api = vi.fn(github({ open: true, ...fixture }));
        await expect(inspectGrade(api, prCanonical, repo, task, null)).resolves.toMatchObject({
            result: 'pending',
            state: 'queued',
            run: 0,
            pullUrl: 'https://github.com/learner/thread/pull/3'
        });
        expect(api.mock.calls.some(([path]) => path.includes('event=pull_request&head_sha=' + sha))).toBe(true);
    });

    test('v10 は最新の PR を判定し、合格した PR のマージでのみ完了する', async () => {
        const read = (fixture: Fixture) =>
            inspectGrade(github({ runEvent: 'pull_request', ...fixture }), prCanonical, repo, task, null);
        await expect(read({ open: true, conclusion: 'failure' })).resolves.toMatchObject({ state: 'failed' });
        await expect(read({ open: true })).resolves.toMatchObject({ state: 'passed', sha, merge: null });
        await expect(read({ merged: true, head: null, conclusion: 'failure' })).resolves.toMatchObject({
            state: 'failed',
            merge: null
        });
        await expect(read({ merged: true, head: null })).resolves.toMatchObject({
            state: 'completed',
            result: 'passed',
            sha,
            pull: 3,
            merge
        });
    });

    test('既存チャプターの順番を保って新しい課題を解放する', () => {
        expect(tasks).toHaveLength(43);
        expect(new Set(tasks.map((item) => item.id)).size).toBe(43);
        expect([0, 1, 2, 3].map((chapter) => tasks.filter((task) => task.chapter === chapter).length)).toEqual([
            10, 10, 10, 13
        ]);
        expect(tasks.every((item, index) => item.available && item.previous === (tasks[index - 1]?.id ?? null))).toBe(
            true
        );
        expect(tasks.slice(0, 5).map((item) => item.id)).toEqual([
            'DEV-101',
            'DEV-102',
            'DEV-103',
            'DEV-104',
            'DEV-113'
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

    test('保守課題は v3 の採点版で合格とマージを確認する', async () => {
        const added = getTask('DEV-141')!;
        const submitted = github({ branch: added.branch, merged: true });
        await expect(inspectGrade(submitted, [quest40Baseline], repo, added, merge)).rejects.toThrow(/v3/);
        await expect(inspectGrade(submitted, [operationsBaseline], repo, added, merge)).resolves.toMatchObject({
            result: 'passed',
            merge
        });
        const older = getTask('DEV-105')!;
        await expect(
            inspectGrade(github({ branch: older.branch }), [operationsBaseline], repo, older, merge)
        ).resolves.toMatchObject({ result: 'passed' });
    });

    test('追加課題の採点には40課題版のワークフローが必要', async () => {
        const added = getTask('DEV-113')!;
        const repoWithMerge = github({ branch: added.branch, merged: true });
        await expect(inspectGrade(repoWithMerge, canonical, repo, added, merge)).rejects.toThrow(/thread-quests-v2/);
        await expect(inspectGrade(repoWithMerge, [quest40Baseline], repo, added, merge)).resolves.toMatchObject({
            result: 'passed',
            merge,
            pull: 3
        });
    });

    test('異なるブランチや過去のコミットの結果を合格にしない', async () => {
        await expect(inspectGrade(github({ branch: 'task/DEV-999' }), canonical, repo, task, null)).resolves.toEqual({
            result: 'unsubmitted',
            state: 'unsubmitted'
        });
        expect(
            await inspectGrade(github({ runHead: changed, merged: true }), canonical, repo, task, null)
        ).toMatchObject({ result: 'pending', state: 'queued', run: 0, merge: null });
        await expect(inspectGrade(github({ movingHead: true }), canonical, repo, task, null)).rejects.toThrow(/更新/);
    });

    test('実行中や中断では不合格を記録せず、対象実行のログを返す', async () => {
        const running = await inspectGrade(github({ runStatus: 'in_progress' }), canonical, repo, task, null);
        expect(running).toMatchObject({
            result: 'pending',
            state: 'running',
            url: 'https://github.com/learner/thread/actions/runs/701'
        });
        const interrupted = await inspectGrade(
            github({ conclusion: 'cancelled', merged: true }),
            canonical,
            repo,
            task,
            null
        );
        expect(interrupted).toMatchObject({ result: 'pending', state: 'interrupted', merge: null });
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
    await expect(verifyProtection(fixture([workflow, adminConfig]), baselines, repo.full_name, sha)).resolves.toBe(
        baselines[0]
    );
    await expect(verifyProtection(fixture([legacy]), baselines, repo.full_name, sha)).resolves.toBe(baselines[1]);
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

test('保存済みの実行と再試行番号で完了条件の成否を取得する', async () => {
    const getJobs: Github = async <T>(path: string) => {
        expect(path).toBe('/repos/learner/thread/actions/runs/701/attempts/2/jobs?per_page=100');
        return {
            jobs: [
                {
                    name: 'grade',
                    head_sha: changed,
                    steps: [{ name: 'DevQuest criterion 3', status: 'completed', conclusion: 'success' }]
                },
                {
                    name: 'grade',
                    head_sha: sha,
                    steps: [
                        { name: 'DevQuest criterion 1', status: 'completed', conclusion: 'failure' },
                        { name: 'DevQuest criterion 2', status: 'completed', conclusion: 'success' },
                        { name: 'DevQuest criterion 3', status: 'completed', conclusion: 'skipped' }
                    ]
                }
            ]
        } as T;
    };
    await expect(readCriteria(getJobs, repo.full_name, 701, 2, sha, 3)).resolves.toEqual([
        'failed',
        'passed',
        'unavailable'
    ]);
});

test.each([architectureBaseline, catalogBaseline, accountModelBaseline, numericShopBaseline, paymentBaseline])('採点基準 %s は移動した Seed・計測・テストを照合し v3 の保護範囲を維持する', async (baseline) => {
    const legacy = { ...workflow, sha: changed };
    const files = [
        { ...workflow, path: 'api/prisma/seeds/development.seed.ts' },
        { ...workflow, path: 'api/prisma/scripts/benchmark-sales.ts' },
        { ...workflow, path: 'api/src/modules/orders/orders.service.spec.ts' }
    ];
    const fixture =
        (candidate: typeof files): Github =>
        async <T>(path: string) => {
            if (path.includes('/git/commits/')) return { tree: { sha: path.split('/').at(-1) } } as T;
            const tree = path.includes(template)
                ? path.includes(baseline)
                    ? [workflow, ...files]
                    : [legacy]
                : candidate;
            return { tree, truncated: false } as T;
        };
    const supported = [baseline, operationsBaseline];
    await expect(verifyProtection(fixture([workflow, ...files]), supported, repo.full_name, sha)).resolves.toBe(
        baseline
    );
    for (const file of files) {
        const modified = [workflow, ...files.map((item) => (item === file ? { ...item, sha: changed } : item))];
        await expect(verifyProtection(fixture(modified), supported, repo.full_name, sha)).rejects.toThrow(
            /保護ファイル/
        );
    }
    await expect(verifyProtection(fixture([legacy, files[2]]), supported, repo.full_name, sha)).resolves.toBe(
        operationsBaseline
    );

    const added = getTask('DEV-143')!;
    await expect(
        inspectGrade(github({ branch: added.branch }), [baseline], repo, added, merge)
    ).resolves.toMatchObject({ result: 'passed' });
});

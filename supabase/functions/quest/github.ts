import { template, type Task } from './catalog.ts';
import { QuestError } from './auth-errors.ts';
import type { GradeState } from './grade-check.ts';

export class GithubError extends QuestError {
    constructor(
        readonly code: number,
        rateLimited = code === 429
    ) {
        super(
            rateLimited
                ? 'GitHub API の利用上限に達しました。しばらく待ってください。'
                : code === 404
                  ? 'GitHub 上で対象が見つかりませんでした。'
                  : 'GitHub の情報を取得できませんでした。少し待ってからお試しください。',
            rateLimited ? 429 : code === 404 ? 404 : 502
        );
    }
}

export type Github = <T>(path: string) => Promise<T>;
export function githubClient(token?: string, request = fetch): Github {
    return async <T>(path: string) => {
        const headers = new Headers({ Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' });
        if (token) headers.set('Authorization', 'Bearer ' + token);
        const response = await request('https://api.github.com' + path, {
            headers,
            redirect: 'error',
            signal: AbortSignal.timeout(8000)
        }).catch(() => {
            throw new GithubError(502);
        });
        if (!response.ok)
            throw new GithubError(
                response.status,
                response.status === 429 || response.headers.get('X-RateLimit-Remaining') === '0'
            );
        return (await response.json()) as T;
    };
}

export type Repo = {
    id: number;
    full_name: string;
    owner: { id: number; login: string };
    private: boolean;
    default_branch: string;
    archived: boolean;
    template_repository?: { full_name: string } | null;
};
const shaPattern = /^[0-9a-f]{40}$/;
const repoPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}\/[a-zA-Z0-9_.-]{1,100}$/;
export const quest40Baseline = '664ab6ef8aafcb3d7e512aac0b319ed60b18f7dd'; // thread-quests-v2
export const operationsBaseline = 'fa1e751be967d99eab0a02620b6315aad1da95aa'; // thread-quests-v3
export const architectureBaseline = 'af05b18c0007aa78cb7809a64b71c063b8a74958'; // thread-quests-v4
export const catalogBaseline = '404e5a42c0284c45d9cbecb6d7c68f88187ecbd8'; // thread-quests-v5
export const templateBaselines = [
    catalogBaseline,
    architectureBaseline,
    operationsBaseline,
    quest40Baseline,
    'c39fe6597bf0929fa651596a53f3db636d71a852',
    '8308c7e7f65f64e90f265cb0e40e42157ed1b752',
    '7d4f1f33a70257bf4bf6b28e0947a6180840a81b',
    '9f40ca7d279b2ba74e86987b6e9b32d77ed6ecba' // thread-criteria-v1
] as const;

const protectedFiles = new Set([
    'package.json',
    'package-lock.json',
    'eslint.config.js',
    '.npmrc',
    'api/.npmrc',
    'web/.npmrc',
    'admin/.npmrc',
    'packages/shared/.npmrc',
    'api/package.json',
    'api/prisma.config.ts',
    'api/prisma/seed.ts',
    'api/prisma/seed-large.ts',
    'api/prisma/benchmark-sales.ts',
    'api/jest.config.cjs',
    'api/tsconfig.json',
    'api/tsconfig.build.json',
    'web/package.json',
    'web/vite.config.ts',
    'web/tsconfig.json',
    'web/src/test-setup.ts',
    'admin/package.json',
    'admin/vite.config.ts',
    'admin/tsconfig.json',
    'packages/shared/package.json'
]);
const workflow = '.github/workflows/grade.yml';

const repoPath = (name: string) => '/repos/' + name;
const isProtected = (path: string, architecture: boolean) =>
    protectedFiles.has(path) ||
    path.startsWith('.github/workflows/') ||
    path.startsWith('grading/') ||
    /\.test\.tsx?$/.test(path) ||
    (architecture &&
        (path.startsWith('api/prisma/seeds/') || path.startsWith('api/prisma/scripts/') || /\.spec\.tsx?$/.test(path)));

export function repoName(value: unknown) {
    if (typeof value !== 'string') throw new QuestError('所有者名/リポジトリ名を入力してください。');
    const normalized = value
        .trim()
        .replace(/^https:\/\/github\.com\//i, '')
        .replace(/\/$/, '');
    if (!repoPattern.test(normalized) || normalized.endsWith('/.') || normalized.endsWith('/..')) {
        throw new QuestError('所有者名/リポジトリ名を入力してください。');
    }
    return normalized;
}

export function verifyRepo(repo: Repo, githubId: number, id?: number) {
    if (repo.owner.id !== githubId) {
        throw new QuestError('ログイン中の GitHub アカウントが個人で所有するリポジトリを指定してください。', 403);
    }
    if (id !== undefined && repo.id !== id) {
        throw new QuestError('ログイン中の GitHub アカウントが所有する登録済みリポジトリを指定してください。', 403);
    }
    if (repo.private) throw new QuestError('GitHub の Settings で演習用リポジトリを Public（公開）にしてください。');
    if (repo.archived) throw new QuestError('演習用リポジトリのアーカイブを解除してください。');
    if (repo.default_branch !== 'main')
        throw new QuestError('GitHub の Settings で既定ブランチを main にしてください。');
    if (
        repo.full_name.toLowerCase() === template ||
        (repo.template_repository && repo.template_repository.full_name.toLowerCase() !== template)
    ) {
        throw new QuestError('THREAD のテンプレートから作成したリポジトリを指定してください。');
    }
}

type TreeItem = { path: string; sha: string; mode: string; type: string };

async function readTree(github: Github, repo: string, commit: string) {
    const result = await github<{ tree: { sha: string } }>(repoPath(repo) + '/git/commits/' + commit);
    const tree = await github<{ tree: TreeItem[]; truncated: boolean }>(
        repoPath(repo) + '/git/trees/' + result.tree.sha + '?recursive=1'
    );
    if (tree.truncated) throw new QuestError('リポジトリが大きすぎるため採点ファイルを照合できません。');
    return tree.tree;
}

function fingerprint(tree: TreeItem[], architecture: boolean) {
    return JSON.stringify(
        tree
            .filter((item) => item.type !== 'tree' && isProtected(item.path, architecture))
            .sort((a, b) => a.path.localeCompare(b.path))
            .map(({ path, mode, sha }) => [path, mode, sha])
    );
}

export async function verifyProtection(github: Github, canonical: readonly string[], repo: string, sha: string) {
    if (!canonical.length || !canonical.every((commit) => shaPattern.test(commit))) {
        throw new QuestError('採点元の設定が正しくありません。', 503);
    }
    if (!shaPattern.test(sha)) throw new QuestError('コミットを確認できません。');
    const candidate = await readTree(github, repo, sha);
    if (candidate.some(({ path }) => path === workflow)) {
        // 旧版は当時の保護範囲を使い 新構成では移動済みの Seed・計測・テストも照合する
        for (const commit of new Set(canonical)) {
            const architecture = commit === architectureBaseline || commit === catalogBaseline;
            const reference = await readTree(github, template, commit);
            if (fingerprint(candidate, architecture) === fingerprint(reference, architecture)) return commit;
        }
    }
    throw new QuestError('採点対象外の保護ファイルに変更があります。元の状態に戻してください。');
}

export async function readHead(github: Github, repo: string, branch: string): Promise<string | null> {
    try {
        const ref = await github<{ object: { sha: string; type: string } }>(
            repoPath(repo) + '/git/ref/heads/' + branch
        );
        if (ref.object.type !== 'commit' || !shaPattern.test(ref.object.sha))
            throw new QuestError('コミットを確認できません。');
        return ref.object.sha;
    } catch (error) {
        if (error instanceof GithubError && error.code === 404) return null;
        throw error;
    }
}

type Pull = {
    number: number;
    merged_at: string | null;
    merge_commit_sha: string | null;
    head: { ref: string; sha: string; repo: { id: number } | null; user: { id: number } | null };
    base: { ref: string; repo: { id: number } };
};
type Run = {
    id: number;
    run_attempt: number;
    event: string;
    head_branch: string;
    head_sha: string;
    path: string;
    status: string;
    conclusion: string | null;
    head_repository: { id: number } | null;
    repository: { id: number };
};
export type CriterionResult = 'passed' | 'failed' | 'unavailable';

export async function readCriteria(
    github: Github,
    repo: string,
    run: number,
    attempt: number,
    sha: string,
    count: number
): Promise<CriterionResult[]> {
    const { jobs } = await github<{
        jobs: {
            name: string;
            head_sha: string;
            steps?: { name: string; status: string; conclusion: string | null }[];
        }[];
    }>(`${repoPath(repo)}/actions/runs/${run}/attempts/${attempt}/jobs?per_page=100`);
    const steps = jobs.find((job) => job.name === 'grade' && job.head_sha === sha)?.steps ?? [];
    return Array.from({ length: count }, (_, index) => {
        const step = steps.find(
            (step) => step.name === `DevQuest criterion ${index + 1}` && step.status === 'completed'
        );
        if (step?.conclusion === 'success') return 'passed';
        if (step?.conclusion === 'failure') return 'failed';
        return 'unavailable';
    });
}

type Grade =
    | { result: 'unsubmitted'; state: 'unsubmitted' }
    | {
          sha: string;
          run: number;
          attempt: number;
          url: string;
          result: 'pending' | 'failed' | 'passed';
          state: Exclude<GradeState, 'unsubmitted'>;
          pull: number | null;
          merge: string | null;
      };

async function ancestor(github: Github, repo: string, base: string, head: string) {
    if (!shaPattern.test(base) || !shaPattern.test(head)) return false;
    const compare = await github<{ status: string }>(
        repoPath(repo) + '/compare/' + base + '...' + head + '?per_page=1'
    );
    return compare.status === 'ahead' || compare.status === 'identical';
}

export async function inspectGrade(
    github: Github,
    canonical: readonly string[],
    repo: Repo,
    task: Task,
    previousMerge: string | null
): Promise<Grade> {
    if (!task.available || (task.previous && !previousMerge))
        throw new QuestError('この課題はまだ解放されていません。', 403);
    const root = repoPath(repo.full_name);
    const params = new URLSearchParams({
        state: 'closed',
        base: 'main',
        head: repo.owner.login + ':' + task.branch,
        per_page: '30'
    });
    const [head, main, pulls] = await Promise.all([
        readHead(github, repo.full_name, task.branch),
        readHead(github, repo.full_name, 'main'),
        github<Pull[]>(root + '/pulls?' + params)
    ]);
    if (!main) throw new QuestError('main ブランチを確認できません。');
    const merged = pulls
        .filter(
            (pr) =>
                pr.merged_at &&
                pr.merge_commit_sha &&
                pr.head.ref === task.branch &&
                (pr.head.repo?.id === repo.id || (!pr.head.repo && pr.head.user?.id === repo.owner.id)) &&
                pr.base.ref === 'main' &&
                pr.base.repo.id === repo.id &&
                (!head || pr.head.sha === head)
        )
        .sort((a, b) => (b.merged_at ?? '').localeCompare(a.merged_at ?? ''))[0];
    const sha = head ?? merged?.head.sha;
    if (!sha) return { result: 'unsubmitted', state: 'unsubmitted' };
    if (!shaPattern.test(sha)) throw new QuestError('コミットを確認できませんでした。');
    if (previousMerge && !(await ancestor(github, repo.full_name, previousMerge, sha))) {
        throw new QuestError('前の課題がマージされた main を作業ブランチに取り込んでください。');
    }

    if (!merged && !(await ancestor(github, repo.full_name, main, sha))) {
        throw new QuestError('最新の main を作業ブランチに取り込んでから push してください。');
    }
    const baseline = await verifyProtection(github, canonical, repo.full_name, sha);
    const number = Number(task.id.slice(4));
    const operationsSupported = baseline === operationsBaseline || baseline === architectureBaseline || baseline === catalogBaseline;
    if (number >= 141 && !operationsSupported) {
        throw new QuestError(
            'DEV-141 以降は THREAD README の手順に沿って採点と演習コードを v3 以降に更新してください。'
        );
    }
    if (number >= 105 && baseline !== quest40Baseline && !operationsSupported) {
        throw new QuestError(
            '追加課題を採点するには、THREAD README の手順で採点ファイルを thread-quests-v2 に更新してください。'
        );
    }
    const filters = new URLSearchParams({ branch: task.branch, event: 'push', head_sha: sha, per_page: '10' });
    const { workflow_runs: runs } = await github<{ workflow_runs: Run[] }>(
        root + '/actions/workflows/grade.yml/runs?' + filters
    );
    const run = runs
        .filter(
            (run) =>
                run.event === 'push' &&
                run.path.split('@')[0] === workflow &&
                run.head_branch === task.branch &&
                run.head_sha === sha &&
                run.head_repository?.id === repo.id &&
                run.repository.id === repo.id
        )
        .sort((a, b) => b.id - a.id || b.run_attempt - a.run_attempt)[0];

    const conclusion = run?.status === 'completed' ? run.conclusion : null;
    const result = conclusion === 'success' ? 'passed' : conclusion === 'failure' ? 'failed' : 'pending';
    const merge =
        result === 'passed' &&
        merged?.merge_commit_sha &&
        (await ancestor(github, repo.full_name, merged.merge_commit_sha, main))
            ? merged.merge_commit_sha
            : null;
    // 照合中に別のコミットが push された場合は、古い結果を保存しない。
    if (head !== (await readHead(github, repo.full_name, task.branch))) {
        throw new QuestError('照合中にブランチが更新されました。もう一度確認してください。', 409);
    }
    const state = merge
        ? 'completed'
        : result !== 'pending'
          ? result
          : run?.status === 'completed'
            ? 'interrupted'
            : run?.status === 'in_progress'
              ? 'running'
              : 'queued';
    return {
        sha,
        run: run?.id ?? 0,
        attempt: run?.run_attempt ?? 0,
        url: run ? 'https://github.com/' + repo.full_name + '/actions/runs/' + run.id : '',
        result,
        state,
        pull: merge ? merged.number : null,
        merge
    };
}

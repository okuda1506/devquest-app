import { authenticate, questDatabase } from './auth.ts';
import { exchangeOAuth } from './oauth.ts';
import { QuestError } from './auth-errors.ts';
import { getTask, tasks } from './catalog.ts';
import type { GradeCheck } from './grade-check.ts';
import {
    githubClient,
    inspectGrade,
    readCriteria,
    readHead,
    repoName,
    templateBaselines,
    verifyProtection,
    verifyRepo,
    type Repo
} from './github.ts';

const env = (name: string) => Deno.env.get(name);
const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Cache-Control': 'no-store'
};

function checked(result: { error: { code?: string } | null }, message = 'データを保存または取得できませんでした。') {
    if (result.error) throw new QuestError(message, 503);
}

Deno.serve(async (request) => {
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    const startedAt = Date.now();
    const log: {
        action?: string;
        learnerId?: string;
        taskId?: string;
        repoId?: number;
        sha?: string;
        runId?: number;
        runAttempt?: number;
        outcome?: string;
        status?: number;
    } = {};
    try {
        if (request.method === 'GET' && new URL(request.url).pathname.endsWith('/health')) {
            log.action = 'health';
            const { data, error } = await questDatabase(env)
                .from('quest_order')
                .select('position')
                .eq('position', tasks.length)
                .abortSignal(AbortSignal.timeout(4000))
                .maybeSingle();
            if (error || !data) throw new QuestError('サービスを確認できません。', 503);
            return Response.json({ status: 'ok' }, { headers: cors });
        }
        if (request.method !== 'POST') throw new QuestError('この操作は利用できません。', 405);
        const input = await request.json().catch(() => null);
        if (!input || typeof input.action !== 'string') throw new QuestError('操作を指定してください。');
        if (['grade', 'register', 'exchange', 'home', 'criteria', 'read'].includes(input.action))
            log.action = input.action;

        if (input.action === 'exchange') {
            return Response.json(await exchangeOAuth(input.code, input.verifier, env), { headers: cors });
        }
        const { db, userId, githubId, login } = await authenticate(request, env);
        log.learnerId = userId;
        const created = await db
            .from('learners')
            .upsert(
                { user_id: userId, github_id: githubId, github_login: login },
                { onConflict: 'user_id', ignoreDuplicates: true }
            );
        checked(created);
        const learner = await db
            .from('learners')
            .select('github_id, repo_id, repo_name')
            .eq('user_id', userId)
            .single();
        checked(learner);
        if (learner.data?.github_id !== githubId)
            throw new QuestError('登録時と同じ GitHub アカウントでログインしてください。', 403);

        const github = githubClient(env('QUEST_GITHUB_READ_TOKEN'));
        const additionalBaselines = (env('THREAD_TEMPLATE_SHA') ?? '')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean);
        const canonical = [...templateBaselines, ...additionalBaselines];
        let gradeCheck: GradeCheck | undefined;

        if (input.action === 'criteria') {
            const task = typeof input.taskId === 'string' ? getTask(input.taskId) : undefined;
            if (!task?.available || !learner.data.repo_id || typeof input.runUrl !== 'string') {
                throw new QuestError('採点結果が見つかりません。', 404);
            }
            if (input.runAttempt !== undefined && (!Number.isSafeInteger(input.runAttempt) || input.runAttempt < 1)) {
                throw new QuestError('採点の実行回数を指定してください。');
            }
            const query = db
                .from('submissions')
                .select('run_id,run_attempt,head_sha')
                .eq('user_id', userId)
                .eq('task_id', task.id)
                .eq('run_url', input.runUrl);
            if (input.runAttempt !== undefined) query.eq('run_attempt', input.runAttempt);
            const result = await query.order('run_attempt', { ascending: false }).limit(1).maybeSingle();
            checked(result);
            if (!result.data) throw new QuestError('採点結果が見つかりません。', 404);
            const repo = await github<Repo>('/repositories/' + learner.data.repo_id);
            verifyRepo(repo, githubId, learner.data.repo_id);
            const { run_id, run_attempt, head_sha } = result.data;
            const criteria = await readCriteria(
                github,
                repoName(repo.full_name),
                run_id,
                run_attempt,
                head_sha,
                task.criteria.length
            );
            return Response.json({ criteria }, { headers: cors });
        }

        if (input.action === 'register') {
            const name = repoName(input.repository);
            const repo = await github<Repo>('/repos/' + name).catch((error) => {
                if (error instanceof QuestError && error.status === 404) {
                    throw new QuestError(
                        'リポジトリを取得できません。URL が正しいか、GitHub の Settings で Public に設定されているかを確認してください。',
                        404
                    );
                }
                throw error;
            });
            log.repoId = repo.id;
            verifyRepo(repo, githubId);
            const sha = await readHead(github, repo.full_name, 'main');
            if (!sha) throw new QuestError('main ブランチを確認できません。');
            await verifyProtection(github, canonical, repo.full_name, sha);
            const registered = await db.rpc('register_learner_repo', {
                p_user: userId,
                p_repo: repo.id,
                p_name: repo.full_name
            });
            if (registered.error?.code === '23505' || registered.error?.message === 'repo_already_registered') {
                throw new QuestError(
                    '別の演習用リポジトリが登録済みか、このリポジトリは別の利用者に紐付いています。設定をご確認ください。',
                    409
                );
            }
            checked(registered);
        } else if (input.action === 'grade') {
            const task = typeof input.taskId === 'string' ? getTask(input.taskId) : undefined;
            if (!task?.available) throw new QuestError('採点対象の課題が見つかりません。', 404);
            if (!learner.data?.repo_id) throw new QuestError('演習用リポジトリを先に登録してください。');
            log.taskId = task.id;
            log.repoId = learner.data.repo_id;
            const progress = await db.from('progress').select('task_id,status,merge_sha').eq('user_id', userId);
            checked(progress);
            const current = progress.data?.find((row) => row.task_id === task.id);
            const previous = progress.data?.find((row) => row.task_id === task.previous && row.status === 'completed');
            if (!current || (task.previous && !previous))
                throw new QuestError('この課題はまだ解放されていません。', 403);
            if (current.status !== 'completed') {
                const repo = await github<Repo>('/repositories/' + learner.data.repo_id);
                verifyRepo(repo, githubId, learner.data.repo_id);
                if (learner.data.repo_name !== repo.full_name) {
                    checked(
                        await db.rpc('register_learner_repo', {
                            p_user: userId,
                            p_repo: repo.id,
                            p_name: repo.full_name
                        })
                    );
                }
                const checkedAt = new Date().toISOString();
                const grade = await inspectGrade(github, canonical, repo, task, previous?.merge_sha ?? null);
                log.outcome = grade.state;
                gradeCheck = { taskId: task.id, state: grade.state };
                if (grade.result !== 'unsubmitted') {
                    log.sha = grade.sha;
                    log.runId = grade.run || undefined;
                    log.runAttempt = grade.attempt || undefined;
                    gradeCheck.sha = grade.sha;
                    gradeCheck.runUrl = grade.url ? grade.url + '/attempts/' + grade.attempt : undefined;
                    const next = tasks.find((candidate) => candidate.available && candidate.previous === task.id);
                    const saved = await db.rpc('record_grade', {
                        p_user: userId,
                        p_repo: repo.id,
                        p_task: task.id,
                        p_previous: task.previous,
                        p_next: next?.id ?? null,
                        p_sha: grade.sha,
                        p_run: grade.run,
                        p_attempt: grade.attempt,
                        p_url: grade.url,
                        p_result: grade.result,
                        p_pr: grade.pull,
                        p_merge: grade.merge,
                        p_checked_at: checkedAt
                    });
                    checked(saved, '採点結果を保存できませんでした。時間をおいて再確認してください。');
                    if (saved.data === 'completed') gradeCheck.state = 'completed';
                    log.outcome = gradeCheck.state;
                }
            } else {
                gradeCheck = { taskId: task.id, state: 'completed' };
                log.outcome = 'completed';
            }
        } else if (input.action === 'read') {
            if (!Number.isSafeInteger(input.notificationId)) throw new QuestError('通知を指定してください。');
            checked(
                await db
                    .from('notifications')
                    .update({ read_at: new Date().toISOString() })
                    .eq('user_id', userId)
                    .eq('id', input.notificationId)
                    .is('read_at', null)
            );
        } else if (input.action !== 'home') {
            throw new QuestError('この操作は利用できません。');
        }

        const [profile, progress, submissions, notifications] = await Promise.all([
            db.from('learners').select('github_login,repo_name').eq('user_id', userId).single(),
            db
                .from('progress')
                .select('task_id,status,head_sha,pull_number,merge_sha,completed_at')
                .eq('user_id', userId)
                .order('task_id'),
            db
                .from('submissions')
                .select('task_id,head_sha,result,run_url,run_attempt,created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .order('run_id', { ascending: false })
                .order('run_attempt', { ascending: false }),
            db
                .from('notifications')
                .select('id,task_id,kind,read_at,created_at')
                .eq('user_id', userId)
                .order('id', { ascending: false })
        ]);
        [profile, progress, submissions, notifications].forEach((result) => checked(result));
        return Response.json(
            {
                profile: profile.data,
                progress: progress.data,
                submissions: submissions.data,
                notifications: notifications.data,
                gradeCheck
            },
            { headers: cors }
        );
    } catch (error) {
        log.status = error instanceof QuestError ? error.status : 500;
        if (error instanceof QuestError)
            return Response.json({ error: error.message }, { status: error.status, headers: cors });
        console.error('課題 API で内部エラーが発生しました。', error instanceof Error ? error.name : 'Unknown');
        return Response.json(
            { error: '処理に失敗しました。少し待ってからお試しください。' },
            { status: 500, headers: cors }
        );
    } finally {
        if (log.status || log.action === 'grade' || log.action === 'register') {
            console.info(
                JSON.stringify({
                    event: 'quest_request',
                    ...log,
                    status: log.status ?? 200,
                    elapsedMs: Date.now() - startedAt
                })
            );
        }
    }
});

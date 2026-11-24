import { tasks } from '../supabase/functions/quest/catalog';
import { statusFor, submissionLog, type Home, type Status } from './model';

const skillDefinitions = [
    { taskId: 'DEV-101', area: 'React · 画面実装', ability: '在庫データをもとに商品カードの表示を切り替える' },
    { taskId: 'DEV-102', area: 'TypeScript · データ処理', ability: '価格を数値順に並べ、同額の商品は取得順を保つ' },
    { taskId: 'DEV-103', area: 'React · 非同期処理', ability: '古い API 応答による画面の上書きを防ぐ' },
    { taskId: 'DEV-104', area: 'NestJS · Prisma', ability: '一覧・件数・ページングに同じ公開条件を適用する' }
];

export const skillStatus: Record<Status, string> = {
    locked: '未解放',
    planned: '追加予定',
    not_started: '学習中',
    in_progress: '学習中',
    passed: '採点合格',
    completed: 'PR マージ済み'
};

export function learnerSkills(home: Home) {
    return tasks
        .filter((task) => task.available)
        .map((task) => {
            const definition = skillDefinitions.find((skill) => skill.taskId === task.id) ?? {
                taskId: task.id,
                area: task.tags.join(' · '),
                ability: task.title
            };
            const status = statusFor(home, task);
            const progress = home.progress.find((entry) => entry.task_id === task.id);
            const submissions = home.submissions.filter((entry) => entry.task_id === task.id);
            const verified = status === 'passed' || status === 'completed';
            const passed = submissions.find(
                (entry) => verified && entry.result === 'passed' && entry.head_sha === progress?.head_sha
            );
            const firstSubmission = submissions.at(-1);
            const firstPass = submissions.filter((entry) => entry.result === 'passed').at(-1);
            const pullUrl =
                status === 'completed' && progress?.pull_number && home.profile.repo_name
                    ? `https://github.com/${home.profile.repo_name}/pull/${progress.pull_number}`
                    : null;
            const milestones = [];
            if (firstSubmission)
                milestones.push({
                    label: '初回提出',
                    date: firstSubmission.created_at,
                    url: submissionLog(firstSubmission)
                });
            if (firstPass)
                milestones.push({ label: '初回の採点合格', date: firstPass.created_at, url: submissionLog(firstPass) });
            if (status === 'completed' && progress?.completed_at) {
                milestones.push({ label: 'PR のマージを確認', date: progress.completed_at, url: pullUrl });
            }
            return {
                ...definition,
                chapter: task.chapter,
                status,
                pullUrl,
                gradeUrl: passed ? submissionLog(passed) : null,
                milestones
            };
        });
}

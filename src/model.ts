import { getTask, tasks, type Task } from '../supabase/functions/quest/catalog';
import type { GradeCheck } from '../supabase/functions/quest/grade-check';

export type Status = 'not_started' | 'in_progress' | 'passed' | 'completed' | 'locked' | 'planned';
export type Progress = {
    task_id: string;
    status: Exclude<Status, 'locked' | 'planned'>;
    head_sha: string | null;
    pull_number: number | null;
    completed_at: string | null;
};
export type Submission = {
    task_id: string;
    head_sha: string;
    result: 'failed' | 'passed';
    run_url: string;
    run_attempt?: number;
    created_at: string;
};
export type Notice = {
    id: number;
    task_id: string;
    kind: 'assigned' | 'failed' | 'passed' | 'completed';
    read_at: string | null;
    created_at: string;
};
export type Home = {
    profile: { github_login: string; repo_name: string | null };
    progress: Progress[];
    submissions: Submission[];
    notifications: Notice[];
    gradeMessage?: string;
    gradeCheck?: GradeCheck;
};
export const statusLabels: Record<Status, string> = {
    not_started: '未着手',
    in_progress: '作業中',
    passed: '採点合格',
    completed: '完了',
    locked: '未解放',
    planned: '追加予定'
};
export const empty: Home = {
    profile: { github_login: '', repo_name: null },
    progress: [],
    submissions: [],
    notifications: []
};
export const demo: Home = {
    ...empty,
    progress: [{ task_id: 'DEV-101', status: 'not_started', head_sha: null, pull_number: null, completed_at: null }]
};

export function statusFor(home: Home, task: Task): Status {
    if (!task.available) return 'planned';
    return home.progress.find((entry) => entry.task_id === task.id)?.status ?? 'locked';
}

export const currentTask = (home: Home) =>
    tasks.find((task) => {
        const status = statusFor(home, task);
        return status === 'not_started' || status === 'in_progress' || status === 'passed';
    });

export function chapterCompletion(before: Home, after: Home, taskId: string) {
    const task = getTask(taskId);
    const previousStatus = task && statusFor(before, task);
    if (!task?.available || previousStatus === 'locked' || previousStatus === 'completed') return;
    const chapterTasks = tasks.filter((item) => item.chapter === task.chapter);
    if (chapterTasks.some((item) => item.available && statusFor(after, item) !== 'completed')) return;
    const nextTask = tasks.find(
        (item) =>
            item.available &&
            item.previous === taskId &&
            item.chapter !== task.chapter &&
            statusFor(after, item) === 'not_started'
    );
    return { chapter: task.chapter, hasPlanned: chapterTasks.some((item) => !item.available), nextTask };
}

export function submissionLog(submission: Submission) {
    return submission.run_attempt ? submission.run_url + '/attempts/' + submission.run_attempt : submission.run_url;
}

export function noticeText(notice: Notice) {
    const task = getTask(notice.task_id);
    if (notice.kind === 'assigned')
        return (task?.requester.name ?? '開発チーム') + 'さんから新しい改修依頼が届きました';
    if (notice.kind === 'completed') return 'PR のマージを確認しました';
    if (notice.kind === 'passed') return '採点に合格しました';
    return '採点結果を確認してください';
}

export function dateLabel(date: string) {
    return new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date));
}

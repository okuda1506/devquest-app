import { expect, test } from 'vitest';
import { chapterCompletion, empty, type Home, type Progress } from './model';
import { learnerSkills } from './skills';

const timestamp = '2026-11-24T01:00:00Z';
const sha = 'a'.repeat(40);
const repo = 'https://github.com/learner/thread';

function progress(task_id: string, status: Progress['status']): Progress {
    return {
        task_id,
        status,
        head_sha: sha,
        pull_number: status === 'completed' ? 1 : null,
        completed_at: status === 'completed' ? timestamp : null
    };
}

test('公開課題を初めて完了したときだけ次章の依頼を案内する', () => {
    const before = {
        ...empty,
        progress: [progress('DEV-101', 'completed'), progress('DEV-102', 'completed'), progress('DEV-103', 'passed')]
    };
    const after = {
        ...before,
        progress: [...before.progress.slice(0, 2), progress('DEV-103', 'completed'), progress('DEV-104', 'not_started')]
    };
    expect(chapterCompletion(before, before, 'DEV-103')).toBeUndefined();
    expect(chapterCompletion(before, after, 'DEV-103')).toMatchObject({
        chapter: 0,
        hasPlanned: true,
        nextTask: { id: 'DEV-104' }
    });
    expect(chapterCompletion(after, after, 'DEV-103')).toBeUndefined();
    const end = { ...after, progress: [...after.progress.slice(0, 3), progress('DEV-104', 'completed')] };
    expect(chapterCompletion(after, end, 'DEV-104')).toEqual({ chapter: 1, hasPlanned: true, nextTask: undefined });
});

test('マージしたコミットと同じ採点を証拠にし、前の提出も成長の記録に残す', () => {
    const originalRun = repo + '/actions/runs/1';
    const passedRun = repo + '/actions/runs/2';
    const home: Home = {
        ...empty,
        profile: { github_login: 'learner', repo_name: 'learner/thread' },
        progress: [progress('DEV-101', 'completed')],
        submissions: [
            {
                task_id: 'DEV-101',
                head_sha: sha,
                result: 'passed',
                run_url: passedRun,
                run_attempt: 2,
                created_at: timestamp
            },
            {
                task_id: 'DEV-101',
                head_sha: 'b'.repeat(40),
                result: 'failed',
                run_url: originalRun,
                created_at: '2026-11-23T01:00:00Z'
            }
        ]
    };
    expect(learnerSkills(home)[0]).toMatchObject({
        status: 'completed',
        pullUrl: repo + '/pull/1',
        gradeUrl: passedRun + '/attempts/2',
        milestones: [
            { label: '初回提出', url: originalRun },
            { label: '初回の採点合格', url: passedRun + '/attempts/2' },
            { label: 'PR のマージを確認', url: repo + '/pull/1' }
        ]
    });
    const later = { ...home, progress: [{ ...progress('DEV-101', 'in_progress'), head_sha: 'c'.repeat(40) }] };
    expect(learnerSkills(later)[0]).toMatchObject({ status: 'in_progress', gradeUrl: null, pullUrl: null });
});

export type GradeState =
    | 'unsubmitted'
    | 'awaiting_pr'
    | 'queued'
    | 'running'
    | 'failed'
    | 'interrupted'
    | 'passed'
    | 'completed';

export type GradeCheck = {
    taskId: string;
    state: GradeState | 'unavailable' | 'recheck';
    sha?: string;
    runUrl?: string;
    pullUrl?: string;
    detail?: string;
};

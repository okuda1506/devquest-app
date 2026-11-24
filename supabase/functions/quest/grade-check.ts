export type GradeState = 'unsubmitted' | 'queued' | 'running' | 'failed' | 'interrupted' | 'passed' | 'completed';

export type GradeCheck = {
    taskId: string;
    state: GradeState | 'unavailable' | 'recheck';
    sha?: string;
    runUrl?: string;
    detail?: string;
};

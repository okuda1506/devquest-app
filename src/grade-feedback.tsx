import { ArrowUpRight } from 'lucide-react';
import type { GradeCheck } from '../supabase/functions/quest/grade-check';

const gradeCopy = {
    unsubmitted: ['未提出', '指定の作業ブランチにコミットを push してから確認してください。'],
    queued: ['採点結果待ち', '最新コミットの採点結果はまだ届いていません。GitHub の Actions タブを確認してください。'],
    running: ['GitHub Actions 実行中', '最新コミットを採点しています。Actions が完了したら結果を確認してください。'],
    failed: [
        '採点不合格',
        '実行ログを開き、失敗したテストや処理を確認してください。修正して再 push したら再確認できます。'
    ],
    interrupted: [
        '採点が中断されました',
        'GitHub の実行ログを確認し、必要に応じて Actions を再実行してから再確認してください。'
    ],
    passed: ['合格・PR マージ待ち', '作業ブランチから main への PR をマージし、「マージを確認」を押してください。'],
    completed: ['完了', 'main への PR マージを確認しました。'],
    unavailable: ['採点サービスに一時的に接続できません', '少し時間をおいて再確認してください。'],
    recheck: ['採点を確認できませんでした', '表示された内容を確認してから、もう一度お試しください。']
};

export function GradeFeedback({ check }: { check: GradeCheck }) {
    const [title, instruction] = gradeCopy[check.state];
    const error = check.state === 'unavailable' || check.state === 'recheck';
    return (
        <div
            className={error ? 'feedback error grade-feedback' : 'feedback grade-feedback'}
            role={error ? 'alert' : 'status'}
        >
            <strong>{title}</strong>
            {check.detail && <p>{check.detail}</p>}
            <p>{instruction}</p>
            {(check.sha || check.runUrl) && (
                <p>
                    {check.sha && <code>{check.sha.slice(0, 7)}</code>}{' '}
                    {check.runUrl && (
                        <a href={check.runUrl} target="_blank" rel="noreferrer">
                            GitHub Actions の実行ログ <ArrowUpRight size={12} />
                        </a>
                    )}
                </p>
            )}
        </div>
    );
}

import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowRight, CircleCheck, LockKeyholeOpen } from 'lucide-react';
import { chapters, team } from '../supabase/functions/quest/catalog';
import { DialogueLine } from './dialogue-line';
import type { chapterCompletion } from './model';
import './first-day.css';

const reflections = [
    '商品カードの表示、価格の並べ替え、カテゴリー切り替えの調査までできました。実際の画面と通信を見ながら修正を確かめられましたね。',
    '公開商品の判定を一覧・件数・ページングでそろえられました。管理画面への影響も確認できたので、安心して公開できます。'
];

type Completion = NonNullable<ReturnType<typeof chapterCompletion>>;

export function ChapterCelebration({
    completion,
    onClose,
    onContinue
}: {
    completion: Completion;
    onClose: () => void;
    onContinue: () => void;
}) {
    const { chapter, hasPlanned, nextTask } = completion;
    const [briefing, setBriefing] = useState(false);
    const [instant, setInstant] = useState(false);
    const dialogRef = useRef<HTMLDialogElement>(null);
    const headingRef = useRef<HTMLHeadingElement>(null);
    const title = briefing
        ? nextTask
            ? '次のチャプターが解放されました'
            : 'スキルプロフィールを確認しましょう'
        : `チャプター ${chapter + 1} ${hasPlanned ? 'の公開課題を完了' : '完了'}`;
    const line = briefing
        ? nextTask
            ? `次の担当は「${chapters[nextTask.chapter]}」です。準備ができたら、最初の依頼を開きましょう。`
            : '今日の成果はスキルプロフィールに記録されています。採点結果とマージ済みの PR を見返しておきましょう。'
        : (reflections[chapter] ??
          '公開されている依頼を完了しました。確認したことや判断した理由を、次の改修でも活かしてください。');

    useLayoutEffect(() => {
        const dialog = dialogRef.current!;
        dialog.showModal();
        return () => dialog.close();
    }, []);
    useLayoutEffect(() => {
        headingRef.current?.focus();
    }, [briefing]);

    return (
        <dialog
            className="first-day scene-chapter-complete"
            ref={dialogRef}
            aria-labelledby="chapter-complete-title"
            aria-describedby="chapter-complete-line"
            onCancel={(event) => {
                event.preventDefault();
                onClose();
            }}
        >
            <div className="scene-top">
                <div className="scene-label">
                    <CircleCheck size={16} aria-hidden="true" />
                    <strong>{chapters[chapter]}</strong>
                </div>
                <button className="scene-skip" onClick={onClose}>
                    閉じる
                </button>
            </div>
            <div className="scene-body scene-dialogue" key={String(briefing)}>
                <div className="speaker">
                    <span className="speaker-avatar">{team.pm.initials}</span>
                    <strong>{team.pm.name}</strong>
                    <small>{team.pm.role}</small>
                </div>
                <h2 id="chapter-complete-title" ref={headingRef} tabIndex={-1} aria-describedby="chapter-complete-line">
                    {title}
                </h2>
                <DialogueLine id="chapter-complete-line" line={line} instant={instant} />
                {briefing && nextTask && (
                    <div className="chapter-briefing-task">
                        <LockKeyholeOpen size={18} aria-hidden="true" />
                        <span>
                            <strong>{nextTask.id}</strong> {nextTask.title}
                        </span>
                    </div>
                )}
            </div>
            <div className="scene-controls">
                <label className="scene-instant">
                    <input type="checkbox" checked={instant} onChange={(event) => setInstant(event.target.checked)} />
                    全文表示
                </label>
                <div className="scene-navigation">
                    <button className="button primary" onClick={briefing ? onContinue : () => setBriefing(true)}>
                        {briefing ? (nextTask ? '次の依頼を開く' : 'スキルプロフィールを見る') : '次へ'}{' '}
                        <ArrowRight size={16} aria-hidden="true" />
                    </button>
                </div>
            </div>
        </dialog>
    );
}

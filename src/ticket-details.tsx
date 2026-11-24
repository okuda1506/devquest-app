import { useEffect, useState } from 'react';
import { ArrowUpRight, Check, Circle, X } from 'lucide-react';
import { callQuest } from './client';
import { dateLabel, submissionLog, type Submission } from './model';
import { team } from '../supabase/functions/quest/catalog';
import type { CriterionResult } from '../supabase/functions/quest/github';

export const ticketDetails: Record<string, { note: string; surface: string; reference: string; reply: string }> = {
    'DEV-101': {
        note: '問い合わせのあったお客様は、在庫を調べるために商品詳細を1件ずつ開いていました。スマートフォンの一覧でも、カードだけで判断できるようにしたいです。',
        surface: 'EC サイト ／ 商品一覧',
        reference: 'テーブル定義書 → Product シート → stock',
        reply: '一覧だけで在庫が分かるようになりました。お客様が買える商品を見つけやすくなります。対応ありがとうございます！'
    },
    'DEV-102': {
        note: '商品を比較中のお客様から、安い順にしても比較しづらいという報告が届きました。桁数が異なる価格と、同額の商品が並ぶ場合を見てください。',
        surface: 'EC サイト ／ 商品一覧の並び順',
        reference: 'テーブル定義書 → Product シート → price',
        reply: '予算に合う商品を順に見比べられるようになりました。同額の商品も位置が変わらないので探しやすいです。'
    },
    'DEV-103': {
        note: 'QA では、通信に時間がかかる端末でよく再現しました。選択欄に出ているカテゴリーと商品一覧が一致するかを確認してください。',
        surface: 'EC サイト ／ 商品一覧のカテゴリー選択',
        reference: '詳細設計書 → THREAD API 一覧 → GET /api/products',
        reply: '通信が遅いときも、最後に選んだカテゴリーの商品が残ることを確認できました。ありがとうございます！'
    },
    'DEV-104': {
        note: '販売開始前の商品を店舗管理で準備できる状態は必要です。お客様向けの一覧と、店舗スタッフ向けの一覧を両方確認してください。',
        surface: 'EC サイト ／ 商品一覧、店舗管理 ／ 商品管理',
        reference: '詳細設計書 → THREAD API 一覧 → 商品一覧・管理商品一覧',
        reply: '公開前の商品はストアに出ず、店舗スタッフは引き続き準備できます。公開作業を安心して続けられます。'
    }
};

const reviewNotes: Record<string, string[]> = {
    'DEV-101': [
        '在庫が1点の商品のカードで「在庫あり」が表示されるか見てみましょう。',
        '在庫0点の商品カードで、詳細を開かなくても「在庫切れ」と分かるようにしてください。',
        '商品名と価格が表示され、カードから商品詳細へ移動できるか再確認してください。'
    ],
    'DEV-102': [
        '桁数が異なる価格を並べ、昇順・降順ともに数値の順になっているか確認してください。',
        '同じ価格の商品が並ぶとき、取得したときの順序を保てるか確認してください。',
        '価格順から標準に戻したとき、取得時の並びに戻るか確認してください。'
    ],
    'DEV-103': [
        'カテゴリーを変えたときの通信を開き、最新の選択値が検索条件に含まれるか見てください。',
        '「すべて」に戻したとき、前に選んだカテゴリーの条件が残っていないか確認してください。',
        '通信を遅くしてカテゴリーを連続で変更し、前の応答が最後の表示を上書きしないか試してください。'
    ],
    'DEV-104': [
        '未ログインの一覧で検索語やカテゴリーを切り替え、どの条件でも非公開商品が含まれないか確認してください。',
        'ページを切り替え、表示件数と総件数の両方が公開商品をもとに計算されているか見てください。',
        '店舗管理の一覧には、準備中の非公開商品が引き続き表示されるか確認してください。'
    ]
};

function fetchCriteria(taskId: string, runUrl: string, runAttempt?: number) {
    return callQuest<{ criteria: CriterionResult[] }>({
        action: 'criteria',
        taskId,
        runUrl,
        runAttempt
    });
}

export function CriterionResults({
    criteria,
    submission,
    previous
}: {
    criteria: string[];
    submission: Submission;
    previous?: Submission;
}) {
    const [result, setResult] = useState<CriterionResult[] | null>(null);
    const [priorResult, setPriorResult] = useState<CriterionResult[] | null>(null);
    const [failed, setFailed] = useState(false);
    const { task_id: taskId, run_url: runUrl, run_attempt: attempt } = submission;
    const priorUrl = previous?.run_url;
    const priorAttempt = previous?.run_attempt;
    useEffect(() => {
        let active = true;
        // 前回のログが取得できなくても今回の結果と差し戻しコメントは表示する
        void fetchCriteria(taskId, runUrl, attempt).then(
            ({ criteria }) => {
                if (active) setResult(criteria);
            },
            () => {
                if (active) setFailed(true);
            }
        );
        if (priorUrl) {
            void fetchCriteria(taskId, priorUrl, priorAttempt).then(
                ({ criteria }) => {
                    if (active) setPriorResult(criteria);
                },
                () => {
                    if (active) setPriorResult([]);
                }
            );
        }
        return () => {
            active = false;
        };
    }, [taskId, runUrl, attempt, priorUrl, priorAttempt]);

    if (failed) return <p className="muted">条件別の結果を取得できませんでした。実行ログで確認できます。</p>;
    if (!result)
        return (
            <p className="muted" role="status">
                条件別の結果を取得中…
            </p>
        );

    const failedIndex = result.indexOf('failed');
    const passedCount = result.filter((value) => value === 'passed').length;
    const comparable = result.some(
        (value, index) =>
            value !== 'unavailable' && (priorResult?.[index] === 'passed' || priorResult?.[index] === 'failed')
    );
    const improved = result.filter((value, index) => value === 'passed' && priorResult?.[index] === 'failed').length;
    return (
        <>
            {(failedIndex >= 0 || submission.result === 'failed') && (
                <aside className="qa-review" aria-label="QA からの確認依頼">
                    <strong>{team.qa.name} · QA からの確認依頼</strong>
                    {passedCount > 0 && <p>{passedCount} 件の条件は確認できました。</p>}
                    <p>
                        {failedIndex < 0
                            ? '採点全体では不合格でした。実行ログで失敗したステップを確認してください。'
                            : (reviewNotes[submission.task_id]?.[failedIndex] ?? criteria[failedIndex])}
                    </p>
                    <p>修正を push したら、もう一度採点結果を確認してください。</p>
                </aside>
            )}
            <h3>完了条件ごとの結果</h3>
            {previous && (
                <p className="criterion-comparison muted" role="status">
                    <a href={submissionLog(previous)} target="_blank" rel="noreferrer">
                        前回の提出（{dateLabel(previous.created_at)}）
                    </a>
                    {priorResult === null
                        ? ' と比較中…'
                        : !comparable
                          ? ' との条件別比較は利用できません。'
                          : improved
                            ? ` から ${improved} 件の条件が合格に変わりました。`
                            : ' から新たに合格した条件はありません。'}
                </p>
            )}
            <ul className="criterion-results">
                {criteria.map((criterion, index) => {
                    const outcome = result[index];
                    const Icon = outcome === 'passed' ? Check : outcome === 'failed' ? X : Circle;
                    const label = outcome === 'passed' ? '合格' : outcome === 'failed' ? '不合格' : '結果なし';
                    return (
                        <li key={criterion}>
                            <span className={'criterion-status ' + (outcome ?? 'unavailable')}>
                                <Icon size={14} aria-hidden="true" />
                                {label}
                            </span>
                            <span>
                                {criterion}
                                {outcome === 'passed' && priorResult?.[index] === 'failed' && (
                                    <small className="badge passed criterion-improved">前回は不合格</small>
                                )}
                            </span>
                            {outcome === 'failed' && (
                                <a
                                    href={submissionLog(submission)}
                                    target="_blank"
                                    rel="noreferrer"
                                    aria-label={criterion + ' 採点ログ'}
                                >
                                    実行ログ <ArrowUpRight size={12} />
                                </a>
                            )}
                        </li>
                    );
                })}
            </ul>
            {result.every((value) => value === 'unavailable') && (
                <p className="muted">この実行には条件別の記録がありません。</p>
            )}
        </>
    );
}

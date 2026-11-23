import { useEffect, useState } from 'react';
import { ArrowUpRight, Check, Circle, X } from 'lucide-react';
import { callQuest } from './client';
import type { Submission } from './model';
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

export function CriterionResults({
    taskId,
    criteria,
    submission
}: {
    taskId: string;
    criteria: string[];
    submission: Submission;
}) {
    const [result, setResult] = useState<CriterionResult[] | null>(null);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        let active = true;
        void callQuest<{ criteria: CriterionResult[] }>({
            action: 'criteria',
            taskId,
            runUrl: submission.run_url
        }).then(
            ({ criteria }) => {
                if (active) setResult(criteria);
            },
            () => {
                if (active) setFailed(true);
            }
        );
        return () => {
            active = false;
        };
    }, [taskId, submission.run_url]);

    if (failed) return <p className="muted">条件別の結果を取得できませんでした。実行ログで確認できます。</p>;
    if (!result)
        return (
            <p className="muted" role="status">
                条件別の結果を取得中…
            </p>
        );

    return (
        <>
            <h3>完了条件ごとの結果</h3>
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
                            <span>{criterion}</span>
                            {outcome === 'failed' && (
                                <a
                                    href={submission.run_url}
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

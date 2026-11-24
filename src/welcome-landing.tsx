import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, Lightbulb, Pause, Play, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { chapters, tasks, team } from '../supabase/functions/quest/catalog';
import questPreview from '../docs/screenshots/quest-preview.webp';
import skillPreview from '../docs/screenshots/skill-profile.webp';
import campaign from './assets/thread-campaign.webp';
import campaignPortrait from './assets/thread-campaign-portrait.webp';
import { DialogueLine, useDialoguePlayback } from './dialogue-line';
import { MemberAvatar, type MemberId } from './team-members';

const briefing = [
    { member: 'pm', line: 'おはよう！ 今日からこの店の開発を一緒に頼みます。さっそく売り場を見に行こうか。' },
    { member: 'director', line: 'このシャツ、実は売り切れなんです。写真を見ただけじゃ私も気づかなくて。' },
    { member: 'ops', line: 'お店の在庫はちゃんとゼロ。どうやら商品一覧のほうに手がかりがありそうですね。' },
    {
        member: 'qa',
        line: '再現できました！ 在庫ゼロのシャツと残り1枚のシャツ、見比べられるようにチケットに書いておきますね。'
    }
] satisfies { member: MemberId; line: string }[];

const workflow = [
    [
        '初出勤でチームに会う',
        '入館証を受け取ったらメンバーと顔合わせ。商品の在庫はどこに保存されるのか、チームの設計書やテーブル定義書を手がかりに調べられます。'
    ],
    [
        '自分のPCに売り場を立ち上げる',
        'GitHubを連携して演習リポジトリを作成。Windows（WSL 2）またはmacOSでECサイトと店舗管理画面を起動し、依頼に書かれた現象を再現します。'
    ],
    [
        '修正を提出して次の依頼へ',
        '作業ブランチをGitHubにpushすると自動テストが走ります。DevQuestで完了条件ごとの結果を読み、合格した修正をプルリクエスト（PR）でマージすると次の依頼が届きます。'
    ]
];

const chapterOutcomes = [
    'ReactとTypeScriptで商品一覧を改修。画面を操作して不具合を再現し、表示とデータの食い違いを探せるようになります。',
    'NestJSとPrismaを使って受注や在庫のAPIを改修。検索条件やページが変わっても正しいデータを返す方法を学びます。',
    'カートの操作から注文APIまでをたどり、画面の金額とサーバーの計算結果をそろえるような変更に取り組みます。',
    '注文直後に通信が切れたらどうなるか。操作をやり直しても注文や在庫が食い違わないように設計する力を磨きます。'
];

function TeamBriefing() {
    const [index, setIndex] = useState(0);
    const { member, line } = briefing[index];
    const { typing, finish } = useDialoguePlayback(line, false);
    const last = index === briefing.length - 1;
    const dialogue = useRef<HTMLDivElement>(null);
    const [inView, setInView] = useState(false);
    const [paused, setPaused] = useState(false);
    const playing = inView && !paused;
    const ended = last && !typing;

    useEffect(() => {
        let visible = true;
        function update() {
            setInView(visible && !document.hidden);
        }
        const observer =
            'IntersectionObserver' in window
                ? new IntersectionObserver(([entry]) => {
                      visible = entry.isIntersecting;
                      update();
                  })
                : undefined;
        if (dialogue.current) observer?.observe(dialogue.current);
        document.addEventListener('visibilitychange', update);
        update();
        return () => {
            observer?.disconnect();
            document.removeEventListener('visibilitychange', update);
        };
    }, []);

    useEffect(() => {
        if (!playing || typing || last) return;
        // 文字送りが終わってから読み切る時間を取る
        const timer = window.setTimeout(() => setIndex(index + 1), 2000 + line.length * 65);
        return () => window.clearTimeout(timer);
    }, [index, last, line, playing, typing]);

    const controlLabel = ended ? '会話をもう一度再生' : paused ? '会話を再開' : '会話を一時停止';
    const ControlIcon = ended ? RotateCcw : paused ? Play : Pause;
    return (
        <section className="team-briefing" aria-label="初出勤プレビュー">
            <div className="briefing-store">
                <picture>
                    <source media="(max-aspect-ratio: 4/5)" srcSet={campaignPortrait} width="941" height="1672" />
                    <img src={campaign} alt="" width="1536" height="1024" fetchPriority="high" />
                </picture>
                <span className="store-sign">
                    <small>担当するストア</small>
                    <b lang="en">THREAD.</b>
                </span>
            </div>
            <div className="briefing-dialogue" ref={dialogue} data-paused={!playing || undefined}>
                <div className="briefing-speech" aria-hidden="true">
                    <MemberAvatar member={member} speaking={typing} expression="happy" />
                    <div>
                        <div className="briefing-speaker">
                            <strong>{team[member].name}</strong>
                            <span>{team[member].role}</span>
                        </div>
                        <DialogueLine key={member} id="briefing-line" line={line} typing={typing} onComplete={finish} />
                    </div>
                </div>
                <ol className="dialogue-transcript" aria-label="朝会の会話">
                    {briefing.map(({ member, line }) => (
                        <li key={member}>
                            {team[member].name}（{team[member].role}）「{line}」
                        </li>
                    ))}
                </ol>
                <button
                    className="briefing-playback"
                    type="button"
                    aria-label={controlLabel}
                    title={controlLabel}
                    onClick={() => {
                        if (ended) {
                            setIndex(0);
                            setPaused(false);
                        } else {
                            setPaused(!paused);
                        }
                    }}
                >
                    <ControlIcon size={17} aria-hidden="true" />
                </button>
            </div>
        </section>
    );
}

export function WelcomeLanding() {
    const landing = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        if (!landing.current || !('IntersectionObserver' in window)) return;
        // 入場時だけ動かす。読み戻しやフォーカス移動で本文を隠さない
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (!entry.isIntersecting) continue;
                    (entry.target as HTMLElement).dataset.enter = 'seen';
                    observer.unobserve(entry.target);
                }
            },
            { rootMargin: '0px 0px -5% 0px' }
        );
        for (const item of landing.current.querySelectorAll<HTMLElement>('[data-enter]')) {
            item.dataset.enter = 'waiting';
            observer.observe(item);
        }
        return () => observer.disconnect();
    }, []);

    return (
        <div ref={landing} className="welcome-landing">
            <TeamBriefing />
            <div className="welcome-container">
                <section className="welcome-intro" aria-labelledby="welcome-title" data-enter="">
                    <h1 id="welcome-title">
                        <span>初仕事は</span>
                        <span>アパレルECの改修</span>
                    </h1>
                    <div>
                        <p className="welcome-lead">
                            「売り切れって商品を開くまで分からないの？」
                            <wbr />
                            お客様のひと言が最初のチケットです。アパレルストア「THREAD」の開発チームに入り、手元でECサイトを直しながらクエストを進めます。
                        </p>
                        <Link className="button primary welcome-cta" to="/signup">
                            無料で始める <ArrowRight size={17} aria-hidden="true" />
                        </Link>
                        <p className="welcome-note">
                            登録にはGoogleアカウントを使います。演習にはGitHubアカウントと本人所有の公開リポジトリが必要です。
                        </p>
                    </div>
                </section>

                <section className="welcome-section" aria-labelledby="welcome-flow">
                    <h2 id="welcome-flow" data-enter="">
                        初出勤から最初のマージまで
                    </h2>
                    <div className="welcome-spread">
                        <figure className="welcome-quest-sheet" data-enter="">
                            <figcaption>
                                <span className="ticket-number">{tasks[0].id}</span>
                                <strong>{tasks[0].title}</strong>
                            </figcaption>
                            <img
                                src={questPreview}
                                width="1155"
                                height="740"
                                loading="lazy"
                                alt="改修依頼、再現手順、作業ブランチ、段階別ヒントが並ぶ最初のチケット"
                            />
                            <details className="welcome-hint">
                                <summary>
                                    <Lightbulb size={16} aria-hidden="true" />
                                    最初のチケットのヒント
                                    <ChevronDown size={16} aria-hidden="true" />
                                </summary>
                                <p>{tasks[0].hints[0]}</p>
                            </details>
                        </figure>
                        <ol className="welcome-workflow">
                            {workflow.map(([title, description]) => (
                                <li key={title} data-enter="">
                                    <h3>{title}</h3>
                                    <p>{description}</p>
                                </li>
                            ))}
                        </ol>
                    </div>
                </section>

                <section className="welcome-section welcome-curriculum" aria-labelledby="welcome-skills">
                    <div data-enter="">
                        <h2 id="welcome-skills">商品画面から本番運用まで</h2>
                        <p>
                            商品カードの小さな修正からスタート。章が進むにつれて、担当する範囲が売り場の裏側まで広がります。
                        </p>
                    </div>
                    <ol className="welcome-chapters">
                        {chapters.map((chapter, index) => (
                            <li key={chapter} data-enter="">
                                <span className="chapter-index" aria-hidden="true">
                                    {String(index + 1).padStart(2, '0')}
                                </span>
                                <div>
                                    <h3>{chapter}</h3>
                                    <p>{chapterOutcomes[index]}</p>
                                    {chapter === '新機能・本番障害対応' && (
                                        <p className="upcoming-quests">
                                            <strong>上級クエストに追加予定</strong>
                                            レスポンス時間を計測してボトルネックを解消するパフォーマンス改善と、外部APIを組み込んだ新機能の開発に取り組めるようになります。
                                        </p>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ol>
                </section>

                <section className="welcome-section welcome-skill-profile" aria-labelledby="welcome-record">
                    <div data-enter="">
                        <h2 id="welcome-record">
                            自分のPRが
                            <br />
                            スキルの記録になる
                        </h2>
                        <p>
                            スキルプロフィールには、何を実装したかが課題ごとに残ります。採点ログとマージ済みのPRを開けば、どんなテストを通してコードをどう直したかまで振り返れます。
                        </p>
                        <Link className="sub-link" to="/signup">
                            初出勤の準備を始める <ArrowRight size={16} aria-hidden="true" />
                        </Link>
                    </div>
                    <figure className="welcome-proof" data-enter="">
                        <figcaption>
                            スキルプロフィール <span>学習記録の例</span>
                        </figcaption>
                        <img
                            src={skillPreview}
                            width="950"
                            height="335"
                            loading="lazy"
                            alt="Reactの画面実装などのスキルに対応する採点ログとマージ済みPR"
                        />
                    </figure>
                </section>
            </div>
        </div>
    );
}

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { team } from '../supabase/functions/quest/catalog';
import quest from '../docs/screenshots/quest-dev-101.webp';
import campaign from './assets/thread-campaign.webp';
import campaignPortrait from './assets/thread-campaign-portrait.webp';
import storefront from './assets/landing/storefront.webp';
import admin from './assets/landing/admin-dashboard.webp';
import localDevelopment from './assets/landing/local-development.webp';
import typescript from './assets/landing/tech/typescript.svg';
import react from './assets/landing/tech/react.svg';
import nestjs from './assets/landing/tech/nestjs.svg';
import postgresql from './assets/landing/tech/postgresql.svg';
import prisma from './assets/landing/tech/prisma.svg';
import docker from './assets/landing/tech/docker.svg';
import vite from './assets/landing/tech/vitejs.svg';
import githubActions from './assets/landing/tech/githubactions.svg';
import vscode from './assets/landing/tech/vscode.svg';
import { DialogueLine, useDialoguePlayback, useReducedMotion } from './dialogue-line';
import { MemberAvatar, type MemberId } from './team-members';
import { useLandingMotion } from './welcome-motion';
import './welcome-landing.css';

const briefing = [
    { member: 'pm', line: 'おはよう！ 今日からこの店の開発を一緒に頼みます。さっそく売り場を見に行こうか。' },
    { member: 'director', line: 'このシャツ、実は売り切れなんです。写真を見ただけじゃ私も気づかなくて。' },
    { member: 'ops', line: 'お店の在庫はちゃんとゼロ。どうやら商品一覧のほうに手がかりがありそうですね。' },
    {
        member: 'qa',
        line: '再現できました！ 在庫ゼロのシャツと残り1枚のシャツ、見比べられるようにチケットに書いておきますね。'
    }
] satisfies { member: MemberId; line: string }[];

const screens = [
    { src: storefront, label: 'THREADのECサイト', height: 900 },
    { src: admin, label: '店舗管理画面', height: 1095 },
    { src: quest, label: 'DevQuestのクエスト画面', height: 943 }
];

const work = [
    {
        title: 'フロントエンド改修',
        description: 'ReactとTypeScriptで構築された既存画面の調査・改修を行います。',
        examples: '商品一覧・検索条件・ソート処理・UIの改善など。'
    },
    {
        title: 'バックエンド保守',
        description: 'NestJSで構築されたAPIの仕様を理解し、データベースとの連携や業務ロジックを改修します。',
        examples: 'API改修・データ検索・在庫管理・バリデーションなど。'
    },
    {
        title: 'フルスタック改修',
        description:
            'フロントエンドからバックエンドまで横断的に調査し、システム全体の整合性を意識した改修を行います。',
        examples: 'API連携・カート処理・注文処理・管理機能の改善など。'
    },
    {
        title: '新機能開発・障害対応',
        description: '新機能の開発に加え、運用中に発生する障害の調査やパフォーマンス改善にも取り組みます。',
        examples: '外部APIを用いた新機能開発（追加予定）・ログ調査・SQL最適化・パフォーマンス改善など。'
    }
];

const technologies = [
    ['TypeScript', typescript],
    ['React', react],
    ['NestJS', nestjs],
    ['PostgreSQL', postgresql],
    ['Prisma', prisma],
    ['Docker', docker],
    ['Vite', vite],
    ['GitHub Actions', githubActions],
    ['VS Code', vscode]
];

const closingTitle = 'Ready to join?';
const closingLetterMs = 100;
const readingPause = { baseMs: 1050, perCharacterMs: 42 };

function JoinLink() {
    return (
        <Link className="landing-join-link" to="/signup">
            プロジェクトにジョイン
        </Link>
    );
}

function TeamBriefing() {
    const [index, setIndex] = useState(0);
    const [visible, setVisible] = useState(true);
    const dialogue = useRef<HTMLDivElement>(null);
    const reduced = useReducedMotion();
    const { member, line } = briefing[reduced ? 0 : index];
    const { typing, finish } = useDialoguePlayback(line, false);

    useEffect(() => {
        let inView = true;
        const update = () => setVisible(inView && !document.hidden);
        const observer =
            typeof IntersectionObserver === 'function'
                ? new IntersectionObserver(([entry]) => {
                      inView = entry.isIntersecting;
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
        if (typing || reduced || !visible) return;
        const delay = readingPause.baseMs + line.length * readingPause.perCharacterMs;
        const timer = window.setTimeout(() => setIndex((current) => (current + 1) % briefing.length), delay);
        return () => window.clearTimeout(timer);
    }, [typing, reduced, visible, line]);

    return (
        <div className="landing-briefing" ref={dialogue} data-paused={!visible || undefined}>
            <div className="landing-speech" aria-hidden="true">
                <MemberAvatar member={member} speaking={typing} expression="happy" />
                <div className="landing-speech-copy">
                    {briefing.map((message) => (
                        <div className="landing-speech-measure" key={message.member}>
                            <div className="landing-speaker">
                                <strong>{team[message.member].name}</strong>
                                <span>{team[message.member].role}</span>
                            </div>
                            <p className="dialogue-line">{message.line}</p>
                        </div>
                    ))}
                    <div className="landing-speech-current">
                        <div className="landing-speaker">
                            <strong>{team[member].name}</strong>
                            <span>{team[member].role}</span>
                        </div>
                        <DialogueLine
                            key={member}
                            id="briefing-line"
                            line={line}
                            typing={typing}
                            onComplete={finish}
                        />
                    </div>
                </div>
            </div>
            <ol className="dialogue-transcript" aria-label="開発メンバーの会話">
                {briefing.map(({ member, line }) => (
                    <li key={member}>
                        {team[member].name}（{team[member].role}）「{line}」
                    </li>
                ))}
            </ol>
        </div>
    );
}

function ClosingCall({ started }: { started: boolean }) {
    const reduced = useReducedMotion();
    const [letters, setLetters] = useState(0);
    const typing = started && !reduced && letters < closingTitle.length;

    useEffect(() => {
        if (!typing) return;
        const timer = window.setTimeout(() => setLetters(letters + 1), closingLetterMs);
        return () => window.clearTimeout(timer);
    }, [letters, typing]);

    return (
        <section
            className="landing-closing landing-frame"
            aria-labelledby="landing-closing-title"
            data-reveal="closing"
        >
            <h2 id="landing-closing-title" lang="en">
                <span className="landing-closing-measure">{closingTitle}</span>
                {typing && (
                    <span className="landing-closing-typed" aria-hidden="true">
                        {closingTitle.slice(0, letters)}
                        <span className="landing-caret" />
                    </span>
                )}
            </h2>
            <div className="landing-closing-action" data-typing={typing || undefined}>
                <JoinLink />
            </div>
        </section>
    );
}

export function WelcomeLanding() {
    const landing = useRef<HTMLDivElement>(null);
    const [closingStarted, setClosingStarted] = useState(false);
    useLandingMotion(landing, setClosingStarted);

    return (
        <div className="welcome-landing" ref={landing}>
            <section className="landing-hero landing-frame" aria-labelledby="landing-title">
                <picture className="landing-hero-picture">
                    <source
                        media="(max-width: 600px) and (orientation: portrait)"
                        srcSet={campaignPortrait}
                        width="941"
                        height="1672"
                    />
                    <img src={campaign} alt="" width="1536" height="1024" fetchPriority="high" />
                </picture>
                <div className="landing-hero-lead">
                    <h1 id="landing-title" lang="en">
                        DevQuest
                    </h1>
                    <p className="landing-subtitle" lang="en">
                        Experience Real Development.
                    </p>
                    <p>
                        クエスト形式で実際の開発業務を疑似体験できる、全く新しいエンジニアリング学習プラットフォーム。
                    </p>
                    <JoinLink />
                </div>
                <TeamBriefing />
            </section>
            <section className="landing-section" aria-labelledby="landing-project">
                <div className="landing-intro">
                    <h2 id="landing-project">THREAD. にジョインする</h2>
                    <p>
                        アパレルEC「THREAD.」を運営するチームにジョイン。メンバーから届く開発依頼をもとに、既存コードの調査や不具合修正、新機能開発などに取り組みます。
                    </p>
                </div>
                <div className="landing-gallery">
                    {screens.map(({ src, label, height }, index) => (
                        <figure key={label} style={{ '--order': index } as CSSProperties}>
                            <figcaption>{label}</figcaption>
                            <img
                                src={src}
                                width="1440"
                                height={height}
                                loading="lazy"
                                decoding="async"
                                alt={label + 'のスクリーンショット'}
                                data-reveal="screen"
                            />
                        </figure>
                    ))}
                </div>
            </section>
            <section className="landing-section landing-workflow" aria-labelledby="landing-workflow">
                <div className="landing-intro">
                    <h2 id="landing-workflow">実務と同じ開発ワークフロー</h2>
                    <p>チケットの確認〜PR・マージまで、実際の開発現場を想定したプロセスで改修を進めます。</p>
                </div>
                <div className="landing-bench">
                    <div className="landing-bench-copy" data-reveal="copy">
                        <h3>
                            自分の環境で、
                            <br />
                            実務さながらの開発を。
                        </h3>
                        <p>
                            DevQuestの開発はブラウザ内で完結しません。GitHubからソースコードをクローンし、あなたが普段からお使いのコードエディタやローカル環境で実際にシステムを改修します。
                        </p>
                    </div>
                    <div className="landing-device" data-reveal="device">
                        <img
                            src={localDevelopment}
                            width="1440"
                            height="768"
                            loading="lazy"
                            decoding="async"
                            alt="THREADのTypeScriptコードをVS Codeで開いたMacBook Air"
                        />
                    </div>
                </div>
            </section>
            <section className="landing-section landing-work" aria-labelledby="landing-work">
                <h2 id="landing-work">THREADチームで経験できる業務</h2>
                <div className="landing-jobs">
                    {work.map(({ title, description, examples }, index) => (
                        <article
                            key={title}
                            data-reveal="job"
                            style={{ '--order': Math.floor(index / 2) } as CSSProperties}
                        >
                            <div>
                                <h3>{title}</h3>
                                <p>{description}</p>
                                <p className="landing-examples">{examples}</p>
                            </div>
                        </article>
                    ))}
                </div>
            </section>
            <section className="landing-section landing-tech" aria-labelledby="landing-tech">
                <div className="landing-intro">
                    <h2 id="landing-tech">技術スタック</h2>
                    <p>フロントエンドからバックエンドまでTypeScriptで構築されたECシステム。</p>
                </div>
                <ul className="landing-logos">
                    {technologies.map(([name, logo], index) => (
                        <li key={name} data-reveal="logo" style={{ '--order': index } as CSSProperties}>
                            <img src={logo} width="46" height="42" loading="lazy" decoding="async" alt="" />
                            <span>{name}</span>
                        </li>
                    ))}
                </ul>
            </section>
            <ClosingCall started={closingStarted} />
        </div>
    );
}

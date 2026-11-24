import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import {
    ArrowLeft,
    ArrowRight,
    Bell,
    BriefcaseBusiness,
    ChevronRight,
    ExternalLink,
    GitBranch,
    Ticket
} from 'lucide-react';
import { tasks, template } from '../supabase/functions/quest/catalog';
import { menuTour } from './sidebar-menu';
import { SetupHelp } from './setup-help';
import { DialogueLine, Speaker, useDialoguePlayback } from './dialogue-line';
import { readPreference, savePreference } from './preferences';
import './first-day.css';

export const firstAssignment = tasks[0];
const scenes = {
    arrival: {
        step: 1,
        speaker: 'pm',
        label: 'チームに着任',
        title: 'THREAD 開発チームへ、ようこそ。',
        next: 'チームに合流する',
        line: 'PMの田中です。はい、これがあなたの入館証。今日から一緒にアパレルストア「THREAD」を育てていきましょう。鈴木さん、お店の紹介をお願い！'
    },
    project: {
        step: 2,
        speaker: 'director',
        label: '配属先の確認',
        title: 'ここが担当プロジェクトです。',
        next: 'サイドメニューを見る',
        line: 'ディレクターの鈴木です。ここが私たちのお店、THREAD。お客様が服を探すときに迷わないよう、画面を一緒に磨いていきましょう。このカードからお店の仕組みを確認できます。'
    },
    menu: {
        step: 3,
        speaker: 'pm',
        label: 'サイドメニュー'
    },
    setup: {
        step: 4,
        speaker: 'ops',
        label: '環境構築',
        title: '開発環境を準備しましょう。',
        next: 'セットアップ完了',
        line: '運用の山本です。手元でお店を動かしてみましょう。THREAD の README に沿って起動したら、EC サイトと店舗管理画面が両方開けるか確認してください。'
    },
    request: {
        step: 5,
        speaker: firstAssignment.author,
        label: '新しい改修依頼',
        title: firstAssignment.title,
        next: '依頼を開く',
        line: 'お疲れさまです。最初の依頼が届きました。' + firstAssignment.description
    }
} as const;
type Scene = keyof typeof scenes;
const sceneCount = Object.keys(scenes).length;
const setupReadme = 'https://github.com/' + template + '#初回セットアップ';
const setupChecks = [
    { label: 'EC サイトを開けた', host: 'localhost:5174' },
    { label: '店舗管理画面を開けた', host: 'localhost:5175' }
];
const checkpointKey = 'devquest-first-day-checkpoint';

export function clearFirstDayCheckpoint() {
    savePreference(checkpointKey, '');
}

function readCheckpoint() {
    const start = { scene: 'arrival' as Scene, menuIndex: 0, openedPages: [] as string[] };
    try {
        const saved = JSON.parse(readPreference(checkpointKey) ?? 'null');
        if (!saved || typeof saved.scene !== 'string' || !Object.hasOwn(scenes, saved.scene)) return start;
        return {
            scene: saved.scene as Scene,
            menuIndex:
                Number.isInteger(saved.menuIndex) && saved.menuIndex >= 0 && saved.menuIndex < menuTour.length
                    ? Number(saved.menuIndex)
                    : 0,
            openedPages: Array.isArray(saved.openedPages)
                ? setupChecks.map(({ host }) => host).filter((host) => saved.openedPages.includes(host))
                : []
        };
    } catch {
        return start;
    }
}

function StaffPass() {
    return (
        <div className="pass-display" role="img" aria-label="配属先 THREAD、担当は開発エンジニア">
            <div className="staff-pass" aria-hidden="true">
                <span className="pass-slot" />
                <strong className="pass-wordmark">THREAD.</strong>
                <span className="pass-role">開発エンジニア</span>
                <div className="pass-bottom">
                    <span>開発チーム</span>
                    <GitBranch size={18} />
                </div>
            </div>
        </div>
    );
}

type FirstDayProps = {
    projectRef: RefObject<HTMLElement | null>;
    onSkip: () => void;
    onOpenTicket: () => void;
};

export function FirstDay({ projectRef, onSkip, onOpenTicket }: FirstDayProps) {
    const [checkpoint] = useState(readCheckpoint);
    const [scene, setScene] = useState<Scene>(checkpoint.scene);
    const [menuIndex, setMenuIndex] = useState(checkpoint.menuIndex);
    const [openedPages, setOpenedPages] = useState<string[]>(checkpoint.openedPages);
    const [instantDialogue, setInstantDialogue] = useState(false);
    const dialogRef = useRef<HTMLDialogElement>(null);
    const titleRef = useRef<HTMLHeadingElement>(null);
    const { step, label } = scenes[scene];
    const menuItem = scene === 'menu' ? menuTour[menuIndex] : undefined;
    const lastMenuItem = menuIndex === menuTour.length - 1;
    const { title, next, line } =
        scene === 'menu'
            ? {
                  title: menuTour[menuIndex].label,
                  next: lastMenuItem ? '開発環境を準備する' : '次の項目へ',
                  line: menuTour[menuIndex].line
              }
            : scenes[scene];
    const { typing, finish } = useDialoguePlayback(line, instantDialogue);

    useEffect(() => {
        savePreference(checkpointKey, JSON.stringify({ scene, menuIndex, openedPages }));
    }, [scene, menuIndex, openedPages]);

    useLayoutEffect(() => {
        const dialog = dialogRef.current!;
        dialog.showModal();
        return () => dialog.close();
    }, []);

    useLayoutEffect(() => {
        dialogRef.current?.scrollTo(0, 0);
        titleRef.current?.focus({ preventScroll: true });
        if (scene !== 'project' || !projectRef.current) return;
        const project = projectRef.current;
        const originalScroll = window.scrollY;
        // 説明パネルの上に実際の案件カードが見えるよう、必要な分だけスクロールする。
        function revealProject() {
            const card = project.getBoundingClientRect();
            const panel = dialogRef.current!.getBoundingClientRect();
            const limit = card.right < panel.left ? window.innerHeight - 16 : panel.top - 16;
            const offset = card.top < 12 ? card.top - 12 : Math.min(card.top - 12, Math.max(0, card.bottom - limit));
            window.scrollBy({ top: offset, behavior: 'instant' });
        }
        revealProject();
        window.addEventListener('resize', revealProject);
        return () => {
            window.removeEventListener('resize', revealProject);
            window.scrollTo({ top: originalScroll, behavior: 'instant' });
        };
    }, [scene, menuIndex, projectRef]);

    useLayoutEffect(() => {
        if (!menuItem) return;
        const target = document.getElementById(menuItem.id);
        const sidebar = target?.closest('aside');
        const dialog = dialogRef.current;
        if (!target || !sidebar || !dialog) return;

        target.classList.add('menu-tour-current');
        const positionGuide = () => {
            const bounds = sidebar.getBoundingClientRect();
            const item = target.getBoundingClientRect();
            // スクロールはメニュー内に留めて背後のダッシュボードの位置を保つ
            sidebar.scrollTop += Math.min(0, item.top - bounds.top - 8) + Math.max(0, item.bottom - bounds.bottom + 8);
            const top = Math.min(
                target.getBoundingClientRect().top - 56,
                window.innerHeight - dialog.offsetHeight - 12
            );
            dialog.style.setProperty('--menu-top', Math.max(12, top) + 'px');
            dialog.style.setProperty('--menu-left', bounds.right + 16 + 'px');
        };
        positionGuide();
        const observer = new ResizeObserver(positionGuide);
        observer.observe(sidebar);
        observer.observe(dialog);
        return () => {
            observer.disconnect();
            target.classList.remove('menu-tour-current');
        };
    }, [menuItem]);

    function advance() {
        if (scene === 'arrival') setScene('project');
        else if (scene === 'project') setScene('menu');
        else if (scene === 'menu') {
            if (lastMenuItem) setScene('setup');
            else setMenuIndex((index) => index + 1);
        } else if (scene === 'setup') setScene('request');
        else onOpenTicket();
    }

    return (
        <dialog
            className={'first-day scene-' + scene}
            ref={dialogRef}
            aria-labelledby="first-day-title"
            aria-describedby="first-day-line"
            onCancel={(event) => {
                event.preventDefault();
                onSkip();
            }}
        >
            <div className="scene-top">
                <div className="scene-label">
                    {scene === 'request' ? <Bell size={15} /> : <BriefcaseBusiness size={15} />}
                    <span>初出勤</span>
                    <ChevronRight size={13} />
                    <strong>{label}</strong>
                </div>
                <button className="scene-skip" onClick={menuItem ? () => setScene('setup') : onSkip}>
                    {menuItem ? 'メニュー案内を省略' : 'スキップ'}
                </button>
            </div>
            <div className="scene-body" key={menuItem?.id ?? scene}>
                {scene === 'arrival' && <StaffPass />}
                <div className="scene-dialogue">
                    <Speaker
                        member={scenes[scene].speaker}
                        typing={typing}
                        smiling={scene === 'arrival'}
                        showTeam={scene === 'arrival'}
                    >
                        {menuItem && (
                            <span className="menu-tour-count">
                                {menuIndex + 1} / {menuTour.length}
                            </span>
                        )}
                    </Speaker>
                    {scene === 'request' && (
                        <span className="scene-ticket mono">
                            <Ticket size={14} aria-hidden="true" />
                            {firstAssignment.id}
                        </span>
                    )}
                    <h2
                        id="first-day-title"
                        ref={titleRef}
                        tabIndex={-1}
                        aria-describedby="dialogue-speaker first-day-line"
                    >
                        {title}
                    </h2>
                    <DialogueLine id="first-day-line" line={line} typing={typing} onComplete={finish} />
                    {scene === 'setup' && (
                        <div className="scene-setup-checklist">
                            <a className="button" href={setupReadme} target="_blank" rel="noopener noreferrer">
                                THREAD の初回セットアップ <ExternalLink size={15} aria-hidden="true" />
                            </a>
                            <fieldset>
                                <legend>起動確認</legend>
                                {setupChecks.map(({ label, host }) => (
                                    <div className="scene-setup-check" key={host}>
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={openedPages.includes(host)}
                                                onChange={({ target: { checked } }) =>
                                                    setOpenedPages((pages) =>
                                                        checked
                                                            ? [...pages, host]
                                                            : pages.filter((page) => page !== host)
                                                    )
                                                }
                                            />
                                            {label}
                                        </label>
                                        <a href={'http://' + host + '/'} target="_blank" rel="noopener noreferrer">
                                            {host} <ExternalLink size={13} aria-hidden="true" />
                                        </a>
                                    </div>
                                ))}
                            </fieldset>
                            <SetupHelp />
                        </div>
                    )}
                </div>
            </div>
            <div className="scene-controls">
                <div className="scene-reading-controls">
                    <span className="scene-progress" role="img" aria-label={`全${sceneCount}場面のうち${step}番目`}>
                        {Object.values(scenes).map(({ step: n }) => (
                            <i aria-hidden="true" key={n} className={n <= step ? 'lit' : ''} />
                        ))}
                    </span>
                    <label className="scene-instant">
                        <input
                            type="checkbox"
                            checked={instantDialogue}
                            onChange={(event) => setInstantDialogue(event.target.checked)}
                        />
                        全文表示
                    </label>
                </div>
                <div className="scene-navigation">
                    {menuItem && (
                        <button
                            className="button"
                            onClick={() => (menuIndex === 0 ? setScene('project') : setMenuIndex(menuIndex - 1))}
                        >
                            <ArrowLeft size={16} /> 戻る
                        </button>
                    )}
                    <button
                        className="button primary"
                        onClick={typing ? finish : advance}
                        disabled={!typing && scene === 'setup' && openedPages.length !== setupChecks.length}
                    >
                        {typing ? '全文を読む' : next} <ArrowRight size={16} />
                    </button>
                </div>
            </div>
        </dialog>
    );
}

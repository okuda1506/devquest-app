import {
    useCallback,
    useEffect,
    useRef,
    useState,
    useSyncExternalStore,
    type FormEvent,
    type ReactNode,
    type RefObject
} from 'react';
import {
    ArrowDownRight,
    ArrowRight,
    ArrowUpRight,
    Bell,
    Box,
    Check,
    Circle,
    CircleCheck,
    Code2,
    FileText,
    GitBranch,
    GitPullRequest,
    Github,
    LockKeyhole,
    LockKeyholeOpen,
    LogOut,
    Menu,
    Moon,
    PanelLeftClose,
    Sun,
    Terminal,
    X
} from 'lucide-react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { branchCommands, chapters, getTask, tasks, template, type Task } from '../supabase/functions/quest/catalog';
import { callQuest, finishSignIn, sessionExpiration, signIn, supabase } from './client';
import {
    chapterCompletion,
    currentTask,
    dateLabel,
    demo,
    empty,
    noticeText,
    statusFor,
    statusLabels,
    submissionLog,
    type Home,
    type Notice,
    type Status
} from './model';
import { readPreference, savePreference } from './preferences';
import './styles.css';
import { FirstDay, firstAssignment } from './first-day';
import { settingsLink, threadLink, workspaceLinks } from './sidebar-menu';
import { Documents } from './documents';
import { Copy } from './copy';
import { CriterionResults, ticketDetails } from './ticket-details';
import { SkillProfile } from './skill-profile';
import { ChapterCelebration } from './chapter-celebration';
import { MemberProfile, RequesterLink, TeamMembers } from './team-members';

function unlockedChapterFor(notice: Notice) {
    const task = getTask(notice.task_id);
    const previous = task?.previous ? getTask(task.previous) : undefined;
    if (notice.kind === 'assigned' && task && previous && previous.chapter !== task.chapter) return task.chapter;
}

type Action = (input: Record<string, unknown>) => Promise<boolean>;
const templateUrl = 'https://github.com/' + template;
const mobileViewport = '(max-width: 650px)';

function subscribeViewport(update: () => void) {
    const media = window.matchMedia(mobileViewport);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
}

export function App() {
    const [userId, setUserId] = useState<string | null>(null);
    const [loadingAuth, setLoadingAuth] = useState(!!supabase);
    const [data, setData] = useState<Home>(empty);
    const latestHome = useRef<Home>(empty);
    const [celebration, setCelebration] = useState<ReturnType<typeof chapterCompletion>>();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [toast, setToast] = useState<Notice | null>(null);
    const queuedToast = useRef<Notice | null>(null);
    const isMobile = useSyncExternalStore(subscribeViewport, () => window.matchMedia(mobileViewport).matches);
    const [desktopMenuOpen, setDesktopMenuOpen] = useState(() => readPreference('devquest-sidebar') !== 'closed');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const menuOpen = isMobile ? mobileMenuOpen : desktopMenuOpen;
    const menuToggleRef = useRef<HTMLButtonElement>(null);
    const menuCloseRef = useRef<HTMLButtonElement>(null);
    const sidebarRef = useRef<HTMLElement>(null);
    const [theme, setTheme] = useState(() => (readPreference('devquest-theme') === 'dark' ? 'dark' : 'light'));
    const seen = useRef(new Set<number>());
    const activeUser = useRef<string | null>(null);
    const location = useLocation();
    const navigate = useNavigate();
    const projectRef = useRef<HTMLElement>(null);
    const [showFirstDay, setShowFirstDay] = useState(() => readPreference('devquest-first-day') !== 'seen');
    const touring = showFirstDay && location.pathname === '/' && !loadingAuth;
    const mobileDrawerOpen = isMobile && mobileMenuOpen && !touring;
    const demoMode = !userId;
    const home = demoMode ? demo : data;
    const unread = home.notifications.filter((notice) => !notice.read_at).length;

    useEffect(() => {
        if (!supabase) return;
        const auth = supabase.auth;
        let active = true;
        let timer: number | undefined;

        function updateUser(id: string | null) {
            if (id !== activeUser.current) {
                activeUser.current = id;
                latestHome.current = empty;
                setData(empty);
                setCelebration(undefined);
                setToast(null);
                queuedToast.current = null;
                setBusy(false);
                seen.current.clear();
            }
            setUserId(id);
        }

        function checkExpiry() {
            window.clearTimeout(timer);
            if (!activeUser.current) return;
            const expiresAt = sessionExpiration();
            if (expiresAt === null) {
                updateUser(null);
                setError('ログインの有効期限が切れました。もう一度ログインしてください。');
            } else {
                timer = window.setTimeout(checkExpiry, Math.max(1, expiresAt - Date.now()));
            }
        }

        const {
            data: { subscription }
        } = auth.onAuthStateChange((_event, session) => {
            if (!active) return;
            updateUser(session && sessionExpiration() ? session.user.id : null);
            checkExpiry();
        });
        window.addEventListener('focus', checkExpiry);
        void finishSignIn()
            .catch((cause: Error) => {
                if (active) setError(cause.message);
            })
            .finally(() => {
                if (active) setLoadingAuth(false);
            });
        return () => {
            active = false;
            window.clearTimeout(timer);
            window.removeEventListener('focus', checkExpiry);
            subscription.unsubscribe();
        };
    }, []);

    const action = useCallback<Action>(async (input) => {
        const requester = activeUser.current;
        setBusy(true);
        setError('');
        setMessage('');
        try {
            const next = await callQuest<Home>(input);
            if (requester !== activeUser.current) return false;
            if (input.action === 'grade' && typeof input.taskId === 'string') {
                const completed = chapterCompletion(latestHome.current, next, input.taskId);
                if (completed) setCelebration(completed);
            }
            latestHome.current = next;
            setData(next);
            if (next.gradeMessage) setMessage(next.gradeMessage);
            const pending = next.notifications.filter(
                (notice) =>
                    !notice.read_at &&
                    (notice.kind === 'assigned' || notice.kind === 'completed') &&
                    !seen.current.has(notice.id)
            );
            const completion =
                input.action === 'grade'
                    ? pending.find((notice) => notice.kind === 'completed' && notice.task_id === input.taskId)
                    : undefined;
            const notification =
                completion ?? pending.find((notice) => unlockedChapterFor(notice) !== undefined) ?? pending[0];
            if (notification) {
                for (const notice of next.notifications) seen.current.add(notice.id);
                if (completion) {
                    queuedToast.current =
                        pending.find(
                            (notice) =>
                                notice.kind === 'assigned' && getTask(notice.task_id)?.previous === completion.task_id
                        ) ?? null;
                } else {
                    queuedToast.current = null;
                }
                setToast(notification);
            }
            return true;
        } catch (cause) {
            if (requester === activeUser.current) setError((cause as Error).message);
            return false;
        } finally {
            if (requester === activeUser.current) setBusy(false);
        }
    }, []);

    useEffect(() => {
        if (userId) void action({ action: 'home' });
        else {
            setData(empty);
            setToast(null);
            seen.current.clear();
        }
    }, [userId, action]);
    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        document
            .querySelector('meta[name="theme-color"]')
            ?.setAttribute('content', theme === 'dark' ? '#111216' : '#f5f6fa');
    }, [theme]);

    const selected = workspaceLinks.find((item) => item.to === location.pathname);
    const crumb =
        selected?.label ??
        (location.pathname.startsWith('/members/')
            ? 'プロフィール'
            : location.pathname.startsWith('/tasks/')
              ? '課題詳細'
              : 'リポジトリ設定');
    const current = currentTask(home);
    const unlockedChapter = toast ? unlockedChapterFor(toast) : undefined;
    const login = () => void signIn().catch((cause: Error) => setError(cause.message));
    const logout = () =>
        void supabase?.auth.signOut({ scope: 'local' }).then(({ error }) => {
            if (error) setError('ログアウトできませんでした。');
        });

    function dismissToast() {
        setToast(queuedToast.current);
        queuedToast.current = null;
    }

    function closeChapter() {
        setCelebration(undefined);
        requestAnimationFrame(() => {
            document.getElementById('main-content')?.focus({ preventScroll: true });
        });
    }

    function continueAfterChapter() {
        const nextTask = celebration?.nextTask;
        closeChapter();
        if (nextTask) {
            const nextNotice = home.notifications.find(
                (notice) => notice.kind === 'assigned' && notice.task_id === nextTask.id && !notice.read_at
            );
            setToast(null);
            queuedToast.current = null;
            if (nextNotice) void action({ action: 'read', notificationId: nextNotice.id });
        }
        navigate(nextTask ? '/tasks/' + nextTask.id : '/skills');
        requestAnimationFrame(() => {
            window.scrollTo({ top: 0, behavior: 'instant' });
        });
    }

    function finishFirstDay(openTicket: boolean) {
        savePreference('devquest-first-day', 'seen');
        setShowFirstDay(false);
        if (openTicket) {
            if (toast?.kind === 'assigned' && toast.task_id === firstAssignment.id) setToast(null);
            navigate('/tasks/' + firstAssignment.id, { state: { firstDay: true } });
        }
        requestAnimationFrame(() => {
            document.getElementById('main-content')?.focus({ preventScroll: true });
            if (openTicket) window.scrollTo({ top: 0, behavior: 'instant' });
        });
    }

    function replayFirstDay() {
        setShowFirstDay(true);
        setMobileMenuOpen(false);
        navigate('/');
    }

    function setMenuOpen(open: boolean) {
        if (isMobile) {
            setMobileMenuOpen(open);
        } else {
            setDesktopMenuOpen(open);
            savePreference('devquest-sidebar', open ? 'open' : 'closed');
        }
    }

    function closeMenu() {
        setMenuOpen(false);
        requestAnimationFrame(() => menuToggleRef.current?.focus({ preventScroll: true }));
    }

    function openMenu() {
        setMenuOpen(true);
        requestAnimationFrame(() => menuCloseRef.current?.focus({ preventScroll: true }));
    }

    function closeMobileMenuAfterNavigation() {
        if (!isMobile) return;
        setMobileMenuOpen(false);
        requestAnimationFrame(() => {
            if (document.activeElement === document.body) {
                document.getElementById('main-content')?.focus({ preventScroll: true });
            }
        });
    }

    return (
        <div
            className={'shell' + (menuOpen ? ' sidebar-open' : '')}
            onKeyDown={(event) => {
                if (event.key !== 'Escape' || event.defaultPrevented || !menuOpen || touring || celebration) return;
                if (isMobile || sidebarRef.current?.contains(event.target as Node)) {
                    event.preventDefault();
                    closeMenu();
                }
            }}
        >
            <a
                className="skip-link"
                href="#main-content"
                inert={mobileDrawerOpen}
                onClick={(event) => {
                    event.preventDefault();
                    document.getElementById('main-content')?.focus();
                }}
            >
                本文へ移動
            </a>
            {isMobile && (
                <div
                    className={'sidebar-backdrop' + (mobileDrawerOpen ? ' visible' : '')}
                    aria-hidden="true"
                    onClick={closeMenu}
                />
            )}
            <aside
                id="workspace-sidebar"
                className="sidebar"
                ref={sidebarRef}
                aria-label="サイドバー"
                inert={!menuOpen && !touring}
            >
                <div className="sidebar-header">
                    <Link className="brand" to="/" onClick={closeMobileMenuAfterNavigation}>
                        <span className="brand-icon">
                            <Code2 size={21} />
                        </span>
                        <strong>DevQuest</strong>
                    </Link>
                    <button
                        type="button"
                        className="icon-button sidebar-close"
                        ref={menuCloseRef}
                        aria-label="サイドメニューを閉じる"
                        onClick={closeMenu}
                    >
                        <PanelLeftClose size={19} aria-hidden="true" />
                    </button>
                </div>
                <div className="sidebar-body">
                    <span className="nav-label">ワークスペース</span>
                    <nav aria-label="メインメニュー">
                        {workspaceLinks.map(({ id, to, label, icon: Icon }) => (
                            <NavLink key={id} id={id} to={to} end={to === '/'} onClick={closeMobileMenuAfterNavigation}>
                                <Icon size={17} />
                                {label}
                                {to === '/notifications' && unread > 0 && <span className="count">{unread}</span>}
                            </NavLink>
                        ))}
                    </nav>
                    <span className="nav-label project-label">参加プロジェクト</span>
                    <Link
                        id={threadLink.id}
                        className="mini-project"
                        to={threadLink.to}
                        onClick={closeMobileMenuAfterNavigation}
                    >
                        <span className="project-icon">T</span>
                        <span>
                            <strong>{threadLink.label}</strong>
                            <small>アパレル EC</small>
                        </span>
                        <ArrowUpRight size={14} />
                    </Link>
                </div>
                <div className="side-bottom">
                    <Link id={settingsLink.id} to={settingsLink.to} onClick={closeMobileMenuAfterNavigation}>
                        <GitBranch size={16} /> {settingsLink.label}
                    </Link>
                </div>
            </aside>
            <div className="workspace" inert={mobileDrawerOpen}>
                <header className="topbar">
                    <div className="breadcrumb">
                        {!menuOpen && (
                            <button
                                type="button"
                                className="icon-button"
                                ref={menuToggleRef}
                                aria-label="サイドメニューを開く"
                                aria-controls="workspace-sidebar"
                                aria-expanded={false}
                                onClick={openMenu}
                            >
                                <Menu size={19} aria-hidden="true" />
                            </button>
                        )}
                        <span>ワークスペース</span>
                        <span aria-hidden="true">/</span>
                        <strong>{crumb}</strong>
                    </div>
                    <div className="top-actions">
                        <button
                            className="icon-button"
                            aria-label={theme === 'dark' ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
                            onClick={() => {
                                const nextTheme = theme === 'dark' ? 'light' : 'dark';
                                setTheme(nextTheme);
                                savePreference('devquest-theme', nextTheme);
                            }}
                        >
                            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
                        </button>
                        <Link
                            className="icon-button notification-link"
                            aria-label={unread ? `通知センター（未読 ${unread} 件）` : '通知センター'}
                            to="/notifications"
                        >
                            <Bell size={17} />
                            {unread > 0 && <i />}
                        </Link>
                        {userId ? (
                            <div className="account">
                                <span>{home.profile.github_login || 'GitHub'}</span>
                                <button className="icon-button" aria-label="ログアウト" onClick={logout}>
                                    <LogOut size={16} />
                                </button>
                            </div>
                        ) : (
                            <button className="button login" onClick={login} disabled={!supabase || loadingAuth}>
                                <Github size={16} />
                                GitHub でログイン
                            </button>
                        )}
                    </div>
                </header>
                <main className="content" id="main-content" tabIndex={-1}>
                    {demoMode && !loadingAuth && (
                        <p className="demo-banner">
                            <Circle size={10} /> プレビュー表示
                            {!supabase
                                ? '。ログインと採点には Supabase の接続設定が必要です。'
                                : '。GitHub でログインすると演習を始められます。'}
                        </p>
                    )}
                    {(loadingAuth || busy) && (
                        <p className="feedback muted" role="status">
                            確認中…
                        </p>
                    )}
                    {error && (
                        <p className="feedback error" role="alert">
                            {error}{' '}
                            {userId && (
                                <button className="text-button" onClick={() => void action({ action: 'home' })}>
                                    データを再取得
                                </button>
                            )}
                        </p>
                    )}
                    {message && (
                        <p className="feedback success" role="status">
                            <CircleCheck size={17} />
                            {message}
                        </p>
                    )}
                    <Routes>
                        <Route
                            index
                            element={
                                <Dashboard
                                    projectRef={projectRef}
                                    home={home}
                                    task={current}
                                    demoMode={demoMode}
                                    unlockedChapter={unlockedChapter}
                                />
                            }
                        />
                        <Route path="/project" element={<Project home={home} unlockedChapter={unlockedChapter} />} />
                        <Route path="/documents" element={<Documents />} />
                        <Route path="/members" element={<TeamMembers />} />
                        <Route path="/members/:id" element={<MemberProfile home={home} />} />
                        <Route
                            path="/tasks/:id"
                            element={<Ticket home={home} demoMode={demoMode} busy={busy} action={action} />}
                        />
                        <Route path="/history" element={<History home={home} />} />
                        <Route path="/skills" element={<SkillProfile key={userId} home={home} signedIn={!!userId} />} />
                        <Route
                            path="/notifications"
                            element={<Notifications home={home} action={action} busy={busy || demoMode} />}
                        />
                        <Route
                            path="/settings"
                            element={
                                <Settings
                                    home={home}
                                    action={action}
                                    busy={busy}
                                    demoMode={demoMode}
                                    login={login}
                                    replayFirstDay={replayFirstDay}
                                />
                            }
                        />
                        <Route
                            path="*"
                            element={
                                <>
                                    <h1>ページが見つかりません</h1>
                                    <Link to="/">ダッシュボードへ</Link>
                                </>
                            }
                        />
                    </Routes>
                </main>
            </div>
            {touring && (
                <FirstDay
                    projectRef={projectRef}
                    onSkip={() => finishFirstDay(false)}
                    onOpenTicket={() => finishFirstDay(true)}
                />
            )}
            {!touring && celebration && (
                <ChapterCelebration completion={celebration} onClose={closeChapter} onContinue={continueAfterChapter} />
            )}
            {!touring && toast && (
                <div
                    key={toast.id}
                    className={'toast' + (getTask(toast.task_id)?.priority === '緊急' ? ' urgent' : '')}
                    role="status"
                >
                    {unlockedChapter !== undefined ? (
                        <LockKeyholeOpen className="chapter-unlock-icon" size={18} aria-hidden="true" />
                    ) : (
                        <Bell size={18} aria-hidden="true" />
                    )}
                    <Link
                        to={'/tasks/' + toast.task_id}
                        onClick={() => {
                            dismissToast();
                            void action({ action: 'read', notificationId: toast.id });
                        }}
                    >
                        {unlockedChapter !== undefined && <small>チャプター解放 · {chapters[unlockedChapter]}</small>}
                        <strong>
                            {toast.kind === 'completed' && ticketDetails[toast.task_id]
                                ? getTask(toast.task_id)?.requester.name + 'さんから完了コメントが届きました'
                                : noticeText(toast)}
                        </strong>
                        <small>
                            {toast.kind === 'completed' && ticketDetails[toast.task_id]
                                ? ticketDetails[toast.task_id].reply
                                : toast.task_id + ' · ' + getTask(toast.task_id)?.title}
                        </small>
                    </Link>
                    <button className="icon-button" aria-label="通知を閉じる" onClick={dismissToast}>
                        <X size={17} />
                    </button>
                </div>
            )}
        </div>
    );
}

function Badge({ status }: { status: Status }) {
    return (
        <span className={'badge ' + status}>
            {status === 'completed' ? (
                <Check size={13} />
            ) : status === 'locked' ? (
                <LockKeyhole size={12} />
            ) : (
                <Circle size={8} />
            )}
            {statusLabels[status]}
        </span>
    );
}
function Title({ title, description }: { title: string; description: string }) {
    return (
        <div className="page-title">
            <h1>{title}</h1>
            <p>{description}</p>
        </div>
    );
}

function Dashboard({
    home,
    task,
    demoMode,
    projectRef,
    unlockedChapter
}: {
    unlockedChapter?: number;
    projectRef: RefObject<HTMLElement | null>;
    home: Home;
    task?: Task;
    demoMode: boolean;
}) {
    const finished = home.progress.filter((entry) => entry.status === 'completed').length;
    const total = tasks.filter((item) => item.available).length;
    const percent = Math.round((finished * 100) / total);
    return (
        <>
            <Title title="ダッシュボード" description="参加中のプロジェクトと、あなたの改修依頼を確認できます。" />
            <div className="dashboard-grid">
                <section className="panel current-panel" aria-labelledby="current-ticket">
                    <div className="panel-heading">
                        <span>
                            <span className="panel-icon blue">
                                <Code2 size={17} />
                            </span>
                            <strong id="current-ticket">現在の担当課題</strong>
                        </span>
                        {task && <Badge status={statusFor(home, task)} />}
                    </div>
                    {task ? (
                        <div className="current-body">
                            <div className="ticket-meta">
                                <span className="mono">{task.id}</span>
                                <span>·</span>
                                <span>{task.category}</span>
                            </div>
                            <h2>{task.title}</h2>
                            <p>{task.description}</p>
                            <div className="labels">
                                {task.tags.map((tag) => (
                                    <span key={tag}>{tag}</span>
                                ))}
                            </div>
                            <div className="panel-foot">
                                <small>依頼者 {task.requester.name}</small>
                                <Link className="button primary" to={'/tasks/' + task.id}>
                                    課題を開く <ArrowRight size={16} />
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <div className="panel-body">
                            <p>
                                {finished === total
                                    ? '公開中の課題をすべて完了しました。'
                                    : '演習リポジトリを登録すると、最初の改修依頼が届きます。'}
                            </p>
                            <Link className="button primary" to={finished === total ? '/history' : '/settings'}>
                                {finished === total ? '学習履歴を見る' : 'リポジトリを登録'} <ArrowRight size={16} />
                            </Link>
                        </div>
                    )}
                </section>
                <section className="panel progress-panel">
                    <div className="panel-heading">
                        <span>
                            <span className="panel-icon">
                                <CircleCheck size={17} />
                            </span>
                            <strong>学習進捗</strong>
                        </span>
                    </div>
                    <div className="panel-body">
                        <div className="percent">
                            {percent}
                            <small>%</small>
                        </div>
                        <progress max={total} value={finished} aria-label="課題の完了数" />
                        <p>
                            <strong>{finished}</strong> / {total} 件の課題を完了
                        </p>
                        <Link className="sub-link" to="/history">
                            学習履歴を見る <ArrowUpRight size={14} />
                        </Link>
                    </div>
                </section>
                <section className="panel project-panel" ref={projectRef}>
                    <div className="panel-heading">
                        <span>
                            <span className="panel-icon">
                                <Box size={17} />
                            </span>
                            <strong>参加プロジェクト</strong>
                        </span>
                    </div>
                    <div className="panel-body">
                        <div className="project-identity">
                            <span className="project-icon">T</span>
                            <div>
                                <h2>THREAD</h2>
                                <p>アパレル EC システム</p>
                            </div>
                        </div>
                        <div className="labels">
                            <span>React</span>
                            <span>TypeScript</span>
                            <span>NestJS</span>
                        </div>
                        <Link className="sub-link" to="/project">
                            プロジェクトを見る <ArrowUpRight size={14} />
                        </Link>
                    </div>
                </section>
                <section className="panel activity-panel">
                    <div className="panel-heading">
                        <span>
                            <span className="panel-icon">
                                <GitPullRequest size={17} />
                            </span>
                            <strong>最近の作業</strong>
                        </span>
                    </div>
                    <div className="panel-body">
                        {home.submissions.length ? (
                            home.submissions.slice(0, 3).map((entry) => (
                                <Link
                                    key={entry.created_at + entry.head_sha}
                                    className="activity"
                                    to={'/tasks/' + entry.task_id}
                                >
                                    <span className="mono">{entry.task_id}</span>
                                    <span>{entry.result === 'passed' ? '採点合格' : '採点不合格'}</span>
                                    <ArrowUpRight size={14} />
                                </Link>
                            ))
                        ) : (
                            <p className="muted">まだ提出された課題はありません。</p>
                        )}
                        {!home.profile.repo_name && (
                            <Link className="sub-link" to="/settings">
                                <GitBranch size={15} />
                                {demoMode ? '演習の始め方' : 'リポジトリ設定'} <ArrowUpRight size={14} />
                            </Link>
                        )}
                    </div>
                </section>
            </div>
            <ChapterRoadmap home={home} unlockedChapter={unlockedChapter} />
        </>
    );
}

function Project({ home, unlockedChapter }: { home: Home; unlockedChapter?: number }) {
    return (
        <>
            <Title
                title="THREAD プロジェクト"
                description="稼働中のアパレル EC サイトを、開発チームの一員として改修します。"
            />
            <section className="panel project-summary">
                <div className="project-identity">
                    <span className="project-icon">T</span>
                    <div>
                        <h2>THREAD</h2>
                        <p>商品カタログ・在庫・注文管理</p>
                    </div>
                </div>
                <div className="labels">
                    {['React', 'TypeScript', 'NestJS', 'Prisma', 'PostgreSQL', 'Docker'].map((tag) => (
                        <span key={tag}>{tag}</span>
                    ))}
                </div>
                <a className="button" href={templateUrl} target="_blank" rel="noreferrer">
                    <Github size={16} /> 演習テンプレート <ArrowUpRight size={14} />
                </a>
            </section>
            <ChapterRoadmap home={home} unlockedChapter={unlockedChapter} />
        </>
    );
}

function ChapterRoadmap({ home, unlockedChapter }: { home: Home; unlockedChapter?: number }) {
    const unlockedTasks = tasks.filter((task) => task.available && statusFor(home, task) !== 'locked');
    const unlockedThrough = Math.max(0, ...unlockedTasks.map((task) => task.chapter));
    const nextChapter = unlockedThrough + 1;
    const remaining = chapters.length - nextChapter - 1;

    return (
        <section className="chapter-roadmap" aria-labelledby="chapter-roadmap-title">
            <h2 id="chapter-roadmap-title">チャプター進捗</h2>
            {chapters.slice(0, nextChapter).map((chapter, index) => {
                const visibleTasks = unlockedTasks.filter((task) => task.chapter === index);
                const publishedTasks = tasks.filter((task) => task.chapter === index && task.available);
                const plannedCount = tasks.filter((task) => task.chapter === index && !task.available).length;
                const completed = visibleTasks.filter((task) => statusFor(home, task) === 'completed').length;
                const complete = publishedTasks.length > 0 && completed === publishedTasks.length;
                return (
                    <section
                        className={'panel chapter' + (index === unlockedChapter ? ' chapter-unlocked' : '')}
                        key={chapter}
                    >
                        <h3>
                            <small className="mono">CHAPTER {index + 1}</small>
                            {chapter}
                            <span className="chapter-state">
                                {complete ? (
                                    <>
                                        <Check size={15} />
                                        {plannedCount ? '公開分完了' : '完了'}
                                    </>
                                ) : visibleTasks.length ? (
                                    `${completed} / ${publishedTasks.length} 件完了`
                                ) : (
                                    '準備中'
                                )}
                            </span>
                        </h3>
                        {visibleTasks.map((task) => {
                            const completed = statusFor(home, task) === 'completed';
                            return (
                                <Link
                                    className="ticket-row"
                                    key={task.id}
                                    to={'/tasks/' + task.id + (completed ? '#reflection' : '')}
                                >
                                    <span className="mono">{task.id}</span>
                                    <strong>{task.title}</strong>
                                    <span className="chapter-action">{completed ? '振り返る' : '続きから進める'}</span>
                                    <ArrowRight size={15} />
                                </Link>
                            );
                        })}
                        {plannedCount > 0 && <p className="panel-body muted">追加予定の課題 {plannedCount} 件</p>}
                        {!visibleTasks.length && (
                            <div className="panel-body">
                                <Link className="sub-link" to="/settings">
                                    演習リポジトリを登録 <ArrowRight size={15} />
                                </Link>
                            </div>
                        )}
                    </section>
                );
            })}
            {nextChapter < chapters.length && (
                <div className="panel chapter-placeholder">
                    <LockKeyhole size={18} aria-hidden="true" />
                    <div>
                        <strong>次のチャプター</strong>
                        <p>現在のチャプターを完了すると解放</p>
                    </div>
                </div>
            )}
            {remaining > 0 && <p className="chapter-remaining">この先にあと {remaining} チャプター</p>}
        </section>
    );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="panel block">
            <h2>{title}</h2>
            {children}
        </section>
    );
}

function Ticket({ home, demoMode, busy, action }: { home: Home; demoMode: boolean; busy: boolean; action: Action }) {
    const { id } = useParams();
    const task = id ? getTask(id) : undefined;
    if (!task)
        return (
            <>
                <h1>課題が見つかりません</h1>
                <Link to="/project">プロジェクトへ</Link>
            </>
        );
    const status = statusFor(home, task);
    if (status === 'planned' || (status === 'locked' && task.id !== firstAssignment.id)) {
        return (
            <>
                <Title title="未解放の課題" description="学習を進めると、次の改修依頼が届きます。" />
                <Link to="/project">チャプター進捗へ</Link>
            </>
        );
    }
    return <TicketContent key={task.id} task={task} home={home} demoMode={demoMode} busy={busy} action={action} />;
}

function TicketContent({
    task,
    home,
    demoMode,
    busy,
    action
}: {
    task: Task;
    home: Home;
    demoMode: boolean;
    busy: boolean;
    action: Action;
}) {
    const [hints, setHints] = useState(0);
    const location = useLocation();
    const fromFirstDay = location.state?.firstDay && task.id === firstAssignment.id;
    const reflectionRef = useRef<HTMLDivElement>(null);
    const branchRef = useRef<HTMLDivElement>(null);
    const status = statusFor(home, task);
    const details = ticketDetails[task.id];
    const repoUrl = home.profile.repo_name ? 'https://github.com/' + home.profile.repo_name : null;
    const checkGrade = () => void action({ action: 'grade', taskId: task.id });
    useEffect(() => {
        if (location.hash === '#reflection') reflectionRef.current?.focus();
    }, [location.key, location.hash, status]);
    const progress = home.progress.find((record) => record.task_id === task.id);
    const next = tasks.find(
        (candidate) => candidate.previous === task.id && candidate.available && statusFor(home, candidate) !== 'locked'
    );
    const ready = status !== 'locked' && status !== 'planned';
    const commands = branchCommands(task);
    const attempts = home.submissions.filter((record) => record.task_id === task.id);
    const latestIndex = attempts.findIndex((record) => record.head_sha === progress?.head_sha);
    const latest = attempts[latestIndex];
    const previousAttempt =
        latest &&
        attempts
            .slice(latestIndex + 1)
            .find(
                (record) =>
                    record.run_url !== latest.run_url ||
                    (record.run_attempt && latest.run_attempt && record.run_attempt < latest.run_attempt)
            );
    return (
        <>
            <Link className="sub-link back" to="/project">
                ← プロジェクトの課題一覧
            </Link>
            <div className="ticket-header">
                <div className="ticket-meta">
                    <span className="mono">{task.id}</span>
                    <Badge status={status} />
                </div>
                <h1>{task.title}</h1>
                <div className="labels">
                    <span>{task.category}</span>
                    <span>{task.level}</span>
                    <span className={task.priority === '緊急' ? 'danger' : ''}>優先度 {task.priority}</span>
                    {task.tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                    ))}
                </div>
            </div>
            {fromFirstDay && (
                <section className="panel block">
                    <h2>最初の作業</h2>
                    <p>
                        作業ブランチは <code>{task.branch}</code> です。まずは THREAD
                        の商品一覧で、在庫のある商品と在庫切れの商品を見比べてみましょう。
                    </p>
                    {!home.profile.repo_name && (
                        <Link className="sub-link" to="/settings">
                            演習の始め方を見る <ArrowRight size={14} />
                        </Link>
                    )}
                </section>
            )}
            <Block title="次にやること">
                {status === 'completed' ? (
                    next ? (
                        <Link className="button primary" to={'/tasks/' + next.id}>
                            次の依頼 {next.id} <ArrowRight size={15} />
                        </Link>
                    ) : (
                        <Link className="button primary" to="/history">
                            学習履歴を見る <ArrowRight size={15} />
                        </Link>
                    )
                ) : demoMode || !repoUrl ? (
                    <Link className="button primary" to="/settings">
                        演習リポジトリを登録する <ArrowRight size={15} />
                    </Link>
                ) : status === 'not_started' ? (
                    <>
                        <p>作業ブランチを作り、改修したコミットを GitHub に push してください。</p>
                        <button className="button primary" onClick={() => branchRef.current?.focus()}>
                            ブランチ作成手順を見る <ArrowRight size={15} />
                        </button>
                    </>
                ) : status === 'passed' ? (
                    <>
                        <p>作業ブランチから main への PR をマージし、採点結果欄でマージを確認してください。</p>
                        <a
                            className="button primary"
                            href={repoUrl + '/compare/main...' + task.branch + '?expand=1'}
                            target="_blank"
                            rel="noreferrer"
                        >
                            GitHub で PR を開く <ArrowUpRight size={15} />
                        </a>
                    </>
                ) : (
                    <>
                        <p>
                            {latest?.result === 'failed'
                                ? '実行ログを確認し、修正を push してからもう一度採点結果を確認してください。'
                                : 'GitHub Actions の実行が終わったら採点結果を確認してください。'}
                        </p>
                        <button className="button primary" disabled={busy} onClick={checkGrade}>
                            採点結果を確認 <ArrowRight size={15} />
                        </button>
                    </>
                )}
            </Block>
            {status === 'completed' && details && (
                <Block title="依頼者からの完了コメント">
                    <RequesterLink member={task.author} smiling />
                    <p>{details.reply}</p>
                </Block>
            )}
            <div className="details-grid">
                <div className="stack">
                    <Block title="改修依頼">
                        <RequesterLink member={task.author} />
                        <p>{task.description}</p>
                        {details && (
                            <>
                                <h3>依頼者メモ</h3>
                                <p>{details.note}</p>
                                <p className="muted">対象画面 · {details.surface}</p>
                                <Link className="sub-link" to="/documents">
                                    <FileText size={14} />
                                    {details.reference} <ArrowUpRight size={14} />
                                </Link>
                            </>
                        )}
                        {task.steps.length > 0 && (
                            <>
                                <h3>再現・確認手順</h3>
                                <ol>
                                    {task.steps.map((step) => (
                                        <li key={step}>{step}</li>
                                    ))}
                                </ol>
                            </>
                        )}
                        <h3>完了条件</h3>
                        <ul>
                            {task.criteria.map((criterion) => (
                                <li key={criterion}>{criterion}</li>
                            ))}
                        </ul>
                    </Block>
                    {ready && (
                        <Block title="段階的なヒント">
                            {!hints && <p className="muted">調査に行き詰まったときに、順番に確認できます。</p>}
                            {!!hints && (
                                <ol>
                                    {task.hints.slice(0, hints).map((hint) => (
                                        <li key={hint}>{hint}</li>
                                    ))}
                                </ol>
                            )}
                            {hints < task.hints.length && (
                                <button className="button" onClick={() => setHints((n) => n + 1)}>
                                    ヒント {hints + 1} を表示
                                </button>
                            )}
                        </Block>
                    )}
                    {(status === 'passed' || status === 'completed') && (
                        <div tabIndex={-1} ref={reflectionRef} id="reflection">
                            <Block title="解説・振り返り">
                                <p>{task.reflection}</p>
                                {status === 'completed' && next && (
                                    <Link className="button primary" to={'/tasks/' + next.id}>
                                        次の依頼 {next.id} <ArrowRight size={15} />
                                    </Link>
                                )}
                            </Block>
                        </div>
                    )}
                </div>
                <div className="stack">
                    <div ref={branchRef} tabIndex={-1}>
                        <Block title="作業ブランチ">
                            <div className="branch-name">
                                <GitBranch size={16} />
                                <code>{task.branch}</code>
                            </div>
                            {ready ? (
                                <>
                                    <Copy label="ブランチ名をコピー" value={task.branch} />
                                    <h3>ブランチ作成手順</h3>
                                    <pre>
                                        <code>{commands}</code>
                                    </pre>
                                    <Copy label="コマンドをコピー" value={commands} />
                                    <p className="muted">
                                        前の課題をマージした最新の main
                                        を使います。未コミットの変更は先にコミットするか退避してください。指定ブランチがある場合は{' '}
                                        <code>git switch {task.branch}</code> で切り替えます。
                                    </p>
                                </>
                            ) : (
                                <p className="muted">
                                    {status === 'planned'
                                        ? 'この課題は追加予定です。'
                                        : task.previous
                                          ? '前の課題を完了すると解放されます。'
                                          : '演習リポジトリを登録すると解放されます。'}
                                </p>
                            )}
                        </Block>
                    </div>
                    <Block title="採点結果">
                        {home.profile.repo_name && (
                            <a
                                className="sub-link"
                                href={'https://github.com/' + home.profile.repo_name}
                                target="_blank"
                                rel="noreferrer"
                            >
                                <Github size={15} /> 演習リポジトリ <ArrowUpRight size={14} />
                            </a>
                        )}
                        {latest && (
                            <p>
                                <a href={submissionLog(latest)} target="_blank" rel="noreferrer">
                                    {latest.result === 'passed' ? '合格' : '不合格'} · 実行ログ{' '}
                                    <ArrowUpRight size={12} />
                                </a>
                                <br />
                                <code>{latest.head_sha.slice(0, 7)}</code> · {dateLabel(latest.created_at)}
                            </p>
                        )}
                        {latest && !demoMode && (
                            <CriterionResults
                                key={submissionLog(latest) + latest.created_at}
                                submission={latest}
                                previous={previousAttempt}
                                criteria={task.criteria}
                            />
                        )}
                        {progress?.pull_number && home.profile.repo_name && (
                            <p>
                                <a
                                    href={`https://github.com/${home.profile.repo_name}/pull/${progress.pull_number}`}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    マージ済み PR #{progress.pull_number}
                                </a>
                            </p>
                        )}
                        {ready && status !== 'completed' && (
                            <p className="muted">
                                指定ブランチに push し、採点に合格したら自分で PR を main にマージしてください。
                            </p>
                        )}
                        {ready && !demoMode && (status === 'not_started' || status === 'passed') && (
                            <button
                                className="button primary"
                                disabled={busy || !home.profile.repo_name}
                                onClick={checkGrade}
                            >
                                <Terminal size={15} />
                                {status === 'passed' ? 'マージを確認' : '採点結果を確認'}
                            </button>
                        )}
                        {demoMode && (
                            <Link to="/settings" className="sub-link">
                                演習の始め方 <ArrowUpRight size={14} />
                            </Link>
                        )}
                        {!ready && !demoMode && <p className="muted">この課題はまだ採点できません。</p>}
                    </Block>
                </div>
            </div>
        </>
    );
}

function History({ home }: { home: Home }) {
    const completed = home.progress.filter((entry) => entry.status === 'completed');
    return (
        <>
            <Title title="学習履歴" description="完了した改修と、提出コミットの採点結果を確認できます。" />
            <Block title={`完了した課題（${completed.length} 件）`}>
                {completed.length ? (
                    completed.map((entry) => {
                        const task = getTask(entry.task_id);
                        return (
                            <Link key={entry.task_id} className="ticket-row history-row" to={'/tasks/' + entry.task_id}>
                                <span className="mono">{entry.task_id}</span>
                                <strong>{task?.title}</strong>
                                <span>{task?.tags.join(' · ')}</span>
                                <span>
                                    {home.submissions.filter((item) => item.task_id === entry.task_id).length} 回提出
                                </span>
                            </Link>
                        );
                    })
                ) : (
                    <p className="muted">完了した課題はまだありません。</p>
                )}
            </Block>
            <Block title={`提出履歴（${home.submissions.length} 件）`}>
                {home.submissions.length ? (
                    home.submissions.map((entry) => (
                        <a
                            className="ticket-row history-row"
                            key={entry.created_at + entry.head_sha}
                            href={entry.run_url}
                            target="_blank"
                            rel="noreferrer"
                        >
                            <span className="mono">{entry.task_id}</span>
                            <strong>
                                {entry.result === 'passed' ? '合格' : '不合格'} · {entry.head_sha.slice(0, 7)}
                            </strong>
                            <span>{dateLabel(entry.created_at)}</span>
                            <ArrowUpRight size={15} />
                        </a>
                    ))
                ) : (
                    <p className="muted">提出履歴はまだありません。</p>
                )}
            </Block>
        </>
    );
}

function Notifications({ home, action, busy }: { home: Home; action: Action; busy: boolean }) {
    return (
        <>
            <Title title="通知センター" description="開発チームからの依頼や、採点・課題完了の通知を確認できます。" />
            <Block title={`通知（未読 ${home.notifications.filter((notice) => !notice.read_at).length} 件）`}>
                {!home.notifications.length && <p className="muted">新しい通知はありません。</p>}
                {home.notifications.map((notice) => (
                    <div className="notification-row" key={notice.id}>
                        <span
                            className={
                                'panel-icon ' + (getTask(notice.task_id)?.priority === '緊急' ? 'danger' : 'blue')
                            }
                        >
                            <Bell size={16} />
                        </span>
                        <Link
                            to={'/tasks/' + notice.task_id}
                            onClick={() => {
                                if (!notice.read_at) void action({ action: 'read', notificationId: notice.id });
                            }}
                        >
                            <strong>{noticeText(notice)}</strong>
                            <small>
                                {notice.task_id} · {dateLabel(notice.created_at)}
                            </small>
                        </Link>
                        {notice.read_at ? (
                            <span className="muted">既読</span>
                        ) : (
                            <button
                                className="button compact"
                                disabled={busy}
                                onClick={() => void action({ action: 'read', notificationId: notice.id })}
                            >
                                既読にする
                            </button>
                        )}
                    </div>
                ))}
            </Block>
        </>
    );
}

function Settings({
    home,
    action,
    busy,
    demoMode,
    login,
    replayFirstDay
}: {
    replayFirstDay: () => void;
    home: Home;
    action: Action;
    busy: boolean;
    demoMode: boolean;
    login: () => void;
}) {
    async function register(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        await action({ action: 'register', repository: data.get('repository') });
    }
    return (
        <>
            <Title
                title="演習リポジトリの設定"
                description="THREAD の自分専用リポジトリを作成し、DevQuest に登録します。"
            />
            <Block title="初出勤チュートリアル">
                <button className="button" onClick={replayFirstDay}>
                    着任の案内をもう一度見る <ArrowRight size={15} />
                </button>
            </Block>
            <Block title="演習を始める">
                <ol>
                    <li>GitHub でログインします。</li>
                    <li>
                        THREAD のテンプレートから個人所有の公開リポジトリを作成します。既定ブランチは main
                        を使用してください。
                    </li>
                    <li>作成したリポジトリを登録し、ローカルで README の手順に沿って起動します。</li>
                </ol>
                <div className="actions">
                    <a className="button" href={templateUrl + '/generate'} target="_blank" rel="noreferrer">
                        <Github size={16} /> テンプレートを使う <ArrowUpRight size={14} />
                    </a>
                    <a className="sub-link" href={templateUrl + '#readme'} target="_blank" rel="noreferrer">
                        THREAD のセットアップ手順 <ArrowUpRight size={14} />
                    </a>
                </div>
            </Block>
            <Block title="リポジトリを登録">
                {home.profile.repo_name ? (
                    <>
                        <a
                            className="sub-link"
                            href={'https://github.com/' + home.profile.repo_name}
                            target="_blank"
                            rel="noreferrer"
                        >
                            {home.profile.repo_name} <ArrowUpRight size={14} />
                        </a>
                        <p>
                            <Link to="/" className="sub-link">
                                ダッシュボードで依頼を確認 <ArrowDownRight size={15} />
                            </Link>
                        </p>
                    </>
                ) : demoMode ? (
                    <button className="button primary" disabled={!supabase} onClick={login}>
                        <Github size={16} /> GitHub でログイン
                    </button>
                ) : (
                    <form onSubmit={register}>
                        <label className="repo-field">
                            GitHub の所有者名/リポジトリ名
                            <input
                                name="repository"
                                placeholder="所有者名/リポジトリ名"
                                autoComplete="off"
                                required
                                maxLength={180}
                            />
                        </label>
                        <button className="button primary" disabled={busy}>
                            登録する <ArrowRight size={15} />
                        </button>
                    </form>
                )}
            </Block>
        </>
    );
}

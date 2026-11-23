import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Bell, BookOpen, Box, Check, Circle, CircleCheck, Clipboard, Code2, FolderKanban, GitBranch, GitPullRequest, Github, LayoutDashboard, LockKeyhole, LogOut, Menu, Moon, Sun, Terminal, X } from 'lucide-react';
import { Link, NavLink, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { branchCommands, chapters, getTask, tasks, template, type Task } from '../supabase/functions/quest/catalog';
import { callQuest, finishSignIn, signIn, supabase } from './client';
import { currentTask, dateLabel, demo, empty, noticeText, statusFor, statusLabels, type Home, type Notice, type Status } from './model';
import './styles.css';

type Action = (input: Record<string, unknown>) => Promise<boolean>;
const templateUrl = 'https://github.com/' + template;
const nav = [
  { to: '/', label: 'ダッシュボード', icon: LayoutDashboard },
  { to: '/project', label: 'プロジェクト', icon: FolderKanban },
  { to: '/history', label: '学習履歴', icon: BookOpen },
  { to: '/notifications', label: '通知センター', icon: Bell },
];

export function App() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(!!supabase);
  const [data, setData] = useState<Home>(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [toast, setToast] = useState<Notice | null>(null);
  const [menu, setMenu] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('devquest-theme') === 'light' ? 'light' : 'dark');
  const seen = useRef(new Set<number>());
  const location = useLocation();
  const demoMode = !userId;
  const home = demoMode ? demo : data;
  const unread = home.notifications.filter(notice => !notice.read_at).length;

  useEffect(() => {
    if (!supabase) return;
    const auth = supabase.auth;
    let active = true;
    const { data: { subscription } } = auth.onAuthStateChange((_event, session) => {
      if (active) setUserId(session?.user.id ?? null);
    });
    void finishSignIn().catch((cause: Error) => { if (active) setError(cause.message); })
      .finally(() => { if (active) setLoadingAuth(false); });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  const action = useCallback<Action>(async (input) => {
    setBusy(true); setError(''); setMessage('');
    try {
      const next = await callQuest<Home>(input);
      setData(next);
      if (next.gradeMessage) setMessage(next.gradeMessage);
      const notification = next.notifications.find(notice =>
        !notice.read_at && (notice.kind === 'assigned' || notice.kind === 'completed') && !seen.current.has(notice.id));
      if (notification) {
        for (const notice of next.notifications) seen.current.add(notice.id);
        setToast(notification);
      }
      return true;
    } catch (cause) {
      setError((cause as Error).message);
      return false;
    } finally { setBusy(false); }
  }, []);

  useEffect(() => {
    if (userId) void action({ action: 'home' });
    else { setData(empty); setToast(null); seen.current.clear(); }
  }, [userId, action]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('devquest-theme', theme);
  }, [theme]);

  const selected = nav.find(item => item.to === location.pathname);
  const crumb = selected?.label ?? (location.pathname.startsWith('/tasks/') ? '課題詳細' : 'リポジトリ設定');
  const current = currentTask(home);
  const login = () => void signIn().catch((cause: Error) => setError(cause.message));
  const logout = () => void supabase?.auth.signOut().then(({ error }) => {
    if (error) setError('ログアウトできませんでした。');
  });

  return <div className="shell">
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus(); }}>本文へ移動</a>
    <aside className={'sidebar' + (menu ? ' open' : '')} aria-label="サイドバー">
      <Link className="brand" to="/" onClick={() => setMenu(false)}><span className="brand-icon"><Code2 size={21} /></span><strong>DevQuest</strong></Link>
      <div className="sidebar-body">
        <span className="nav-label">ワークスペース</span>
        <nav aria-label="メインメニュー">{nav.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} onClick={() => setMenu(false)}>
          <Icon size={17} />{label}{to === '/notifications' && unread > 0 && <span className="count">{unread}</span>}
        </NavLink>)}</nav>
        <span className="nav-label project-label">参加プロジェクト</span>
        <Link className="mini-project" to="/project" onClick={() => setMenu(false)}><span className="project-icon">T</span><span><strong>THREAD</strong><small>アパレル EC</small></span><ArrowUpRight size={14} /></Link>
      </div>
      <div className="side-bottom"><Link to="/settings" onClick={() => setMenu(false)}><GitBranch size={16} /> リポジトリ設定</Link></div>
    </aside>
    <div className="workspace">
      <header className="topbar">
        <div className="breadcrumb"><button className="icon-button mobile-menu" aria-label="メニュー" aria-expanded={menu} onClick={() => setMenu(show => !show)}><Menu size={19} /></button><span>ワークスペース</span><span aria-hidden="true">/</span><strong>{crumb}</strong></div>
        <div className="top-actions">
          <button className="icon-button" aria-label={theme === 'dark' ? 'ライトモードに切り替え' : 'ダークモードに切り替え'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button>
          <Link className="icon-button notification-link" aria-label={unread ? `通知センター（未読 ${unread} 件）` : '通知センター'} to="/notifications"><Bell size={17} />{unread > 0 && <i />}</Link>
          {userId ? <div className="account"><span>{home.profile.github_login || 'GitHub'}</span><button className="icon-button" aria-label="ログアウト" onClick={logout}><LogOut size={16} /></button></div>
            : <button className="button login" onClick={login} disabled={!supabase || loadingAuth}><Github size={16} />GitHub でログイン</button>}
        </div>
      </header>
      <main className="content" id="main-content" tabIndex={-1}>
        {demoMode && !loadingAuth && <p className="demo-banner"><Circle size={10} /> プレビュー表示{!supabase ? '。ログインと採点には Supabase の接続設定が必要です。' : '。GitHub でログインすると演習を始められます。'}</p>}
        {(loadingAuth || busy) && <p className="feedback muted" role="status">確認中…</p>}
        {error && <p className="feedback error" role="alert">{error} {userId && <button className="text-button" onClick={() => void action({ action: 'home' })}>データを再取得</button>}</p>}
        {message && <p className="feedback success" role="status"><CircleCheck size={17} />{message}</p>}
        <Routes>
          <Route index element={<Dashboard home={home} task={current} demoMode={demoMode} />} />
          <Route path="/project" element={<Project home={home} />} />
          <Route path="/tasks/:id" element={<Ticket home={home} demoMode={demoMode} busy={busy} action={action} />} />
          <Route path="/history" element={<History home={home} />} />
          <Route path="/notifications" element={<Notifications home={home} action={action} busy={busy || demoMode} />} />
          <Route path="/settings" element={<Settings home={home} action={action} busy={busy} demoMode={demoMode} login={login} />} />
          <Route path="*" element={<><h1>ページが見つかりません</h1><Link to="/">ダッシュボードへ</Link></>} />
        </Routes>
      </main>
    </div>
    {toast && <div className={'toast' + (getTask(toast.task_id)?.priority === '緊急' ? ' urgent' : '')} role="status">
      <Bell size={18} /><Link to={'/tasks/' + toast.task_id} onClick={() => { setToast(null); void action({ action: 'read', notificationId: toast.id }); }}>
        <strong>{noticeText(toast)}</strong><small>{toast.task_id} · {getTask(toast.task_id)?.title}</small>
      </Link><button className="icon-button" aria-label="通知を閉じる" onClick={() => setToast(null)}><X size={17} /></button>
    </div>}
  </div>;
}

function Badge({ status }: { status: Status }) {
  return <span className={'badge ' + status}>{status === 'completed' ? <Check size={13} /> : status === 'locked' ? <LockKeyhole size={12} /> : <Circle size={8} />}{statusLabels[status]}</span>;
}
function Title({ title, description }: { title: string; description: string }) {
  return <div className="page-title"><h1>{title}</h1><p>{description}</p></div>;
}

function Dashboard({ home, task, demoMode }: { home: Home; task?: Task; demoMode: boolean }) {
  const finished = home.progress.filter(entry => entry.status === 'completed').length;
  const total = tasks.filter(item => item.available).length;
  const percent = Math.round(finished * 100 / total);
  return <>
    <Title title="ダッシュボード" description="参加中のプロジェクトと、あなたの改修依頼を確認できます。" />
    <div className="dashboard-grid">
      <section className="panel current-panel" aria-labelledby="current-ticket">
        <div className="panel-heading"><span><span className="panel-icon blue"><Code2 size={17} /></span><strong id="current-ticket">現在の担当課題</strong></span>{task && <Badge status={statusFor(home, task)} />}</div>
        {task ? <div className="current-body">
          <div className="ticket-meta"><span className="mono">{task.id}</span><span>·</span><span>{task.category}</span></div>
          <h2>{task.title}</h2><p>{task.description}</p>
          <div className="labels">{task.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
          <div className="panel-foot"><small>依頼者 {task.requester.name}</small><Link className="button primary" to={'/tasks/' + task.id}>課題を開く <ArrowRight size={16} /></Link></div>
        </div> : <div className="panel-body">
          <p>{finished === total ? '公開中の課題をすべて完了しました。' : '演習リポジトリを登録すると、最初の改修依頼が届きます。'}</p>
          <Link className="button primary" to={finished === total ? '/history' : '/settings'}>{finished === total ? '学習履歴を見る' : 'リポジトリを登録'} <ArrowRight size={16} /></Link>
        </div>}
      </section>
      <section className="panel progress-panel">
        <div className="panel-heading"><span><span className="panel-icon"><CircleCheck size={17} /></span><strong>学習進捗</strong></span></div>
        <div className="panel-body"><div className="percent">{percent}<small>%</small></div>
          <progress max={total} value={finished} aria-label="課題の完了数" />
          <p><strong>{finished}</strong> / {total} 件の課題を完了</p>
          <Link className="sub-link" to="/history">学習履歴を見る <ArrowUpRight size={14} /></Link></div>
      </section>
      <section className="panel project-panel">
        <div className="panel-heading"><span><span className="panel-icon"><Box size={17} /></span><strong>参加プロジェクト</strong></span></div>
        <div className="panel-body"><div className="project-identity"><span className="project-icon">T</span><div><h2>THREAD</h2><p>アパレル EC システム</p></div></div>
        <div className="labels"><span>React</span><span>TypeScript</span><span>NestJS</span></div>
        <Link className="sub-link" to="/project">プロジェクトを見る <ArrowUpRight size={14} /></Link></div>
      </section>
      <section className="panel activity-panel">
        <div className="panel-heading"><span><span className="panel-icon"><GitPullRequest size={17} /></span><strong>最近の作業</strong></span></div>
        <div className="panel-body">{home.submissions.length ? home.submissions.slice(0, 3).map(entry =>
          <Link key={entry.created_at + entry.head_sha} className="activity" to={'/tasks/' + entry.task_id}><span className="mono">{entry.task_id}</span><span>{entry.result === 'passed' ? '採点合格' : '採点不合格'}</span><ArrowUpRight size={14} /></Link>)
          : <p className="muted">まだ提出された課題はありません。</p>}
          {!home.profile.repo_name && <Link className="sub-link" to="/settings"><GitBranch size={15} />{demoMode ? '演習の始め方' : 'リポジトリ設定'} <ArrowUpRight size={14} /></Link>}</div>
      </section>
    </div>
  </>;
}

function Project({ home }: { home: Home }) {
  return <>
    <Title title="THREAD プロジェクト" description="稼働中のアパレル EC サイトを、開発チームの一員として改修します。" />
    <section className="panel project-summary"><div className="project-identity"><span className="project-icon">T</span><div><h2>THREAD</h2><p>商品カタログ・在庫・注文管理</p></div></div>
      <div className="labels">{['React', 'TypeScript', 'NestJS', 'Prisma', 'PostgreSQL', 'Docker'].map(tag => <span key={tag}>{tag}</span>)}</div>
      <a className="button" href={templateUrl} target="_blank" rel="noreferrer"><Github size={16} /> 演習テンプレート <ArrowUpRight size={14} /></a>
    </section>
    {chapters.map((chapter, index) => <section className="panel chapter" key={chapter}>
      <h2><small className="mono">CHAPTER {index + 1}</small>{chapter}</h2>
      {tasks.filter(task => task.chapter === index).map(task => <Link className="ticket-row" key={task.id} to={'/tasks/' + task.id}>
        <span className="mono">{task.id}</span><strong>{task.title}</strong><Badge status={statusFor(home, task)} /><ArrowRight size={15} />
      </Link>)}
    </section>)}
  </>;
}

function Copy({ value, label }: { value: string; label: string }) {
  const [result, setResult] = useState('');
  useEffect(() => {
    if (!result) return;
    const timer = setTimeout(() => setResult(''), 3000);
    return () => clearTimeout(timer);
  }, [result]);
  return <><button type="button" className="button compact" onClick={async () => {
    try { await navigator.clipboard.writeText(value); setResult('コピーしました'); }
    catch { setResult('コピーできませんでした。テキストを選択してコピーしてください。'); }
  }}><Clipboard size={14} />{label}</button><span className="copy-feedback" role="status">{result}</span></>;
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return <section className="panel block"><h2>{title}</h2>{children}</section>;
}

function Ticket({ home, demoMode, busy, action }: { home: Home; demoMode: boolean; busy: boolean; action: Action }) {
  const { id } = useParams();
  const task = id ? getTask(id) : undefined;
  if (!task) return <><h1>課題が見つかりません</h1><Link to="/project">プロジェクトへ</Link></>;
  return <TicketContent key={task.id} task={task} home={home} demoMode={demoMode} busy={busy} action={action} />;
}

function TicketContent({ task, home, demoMode, busy, action }: { task: Task; home: Home; demoMode: boolean; busy: boolean; action: Action }) {
  const [hints, setHints] = useState(0);
  const status = statusFor(home, task);
  const progress = home.progress.find(record => record.task_id === task.id);
  const next = tasks.find(candidate => candidate.previous === task.id && statusFor(home, candidate) !== 'planned');
  const ready = status !== 'locked' && status !== 'planned';
  const commands = branchCommands(task);
  const latest = home.submissions.find(record => record.task_id === task.id && record.head_sha === progress?.head_sha);
  return <>
    <Link className="sub-link back" to="/project">← プロジェクトの課題一覧</Link>
    <div className="ticket-header"><div className="ticket-meta"><span className="mono">{task.id}</span><Badge status={status} /></div><h1>{task.title}</h1>
      <div className="labels"><span>{task.category}</span><span>{task.level}</span><span className={task.priority === '緊急' ? 'danger' : ''}>優先度 {task.priority}</span>{task.tags.map(tag => <span key={tag}>{tag}</span>)}</div></div>
    <div className="details-grid"><div className="stack">
      <Block title="改修依頼"><div className="requester"><span>{task.requester.initials}</span><p><strong>{task.requester.name}</strong><small>{task.requester.role}</small></p></div>
        <p>{task.description}</p>
        {task.steps.length > 0 && <><h3>確認手順</h3><ol>{task.steps.map(step => <li key={step}>{step}</li>)}</ol></>}
        <h3>完了条件</h3><ul>{task.criteria.map(criterion => <li key={criterion}>{criterion}</li>)}</ul>
      </Block>
      {ready && <Block title="段階的なヒント">
        {!hints && <p className="muted">調査に行き詰まったときに、順番に確認できます。</p>}
        {!!hints && <ol>{task.hints.slice(0, hints).map(hint => <li key={hint}>{hint}</li>)}</ol>}
        {hints < task.hints.length && <button className="button" onClick={() => setHints(n => n + 1)}>ヒント {hints + 1} を表示</button>}
      </Block>}
      {status === 'completed' && <Block title="解説・振り返り"><p>{task.reflection}</p>{next && <Link className="button primary" to={'/tasks/' + next.id}>次の依頼 {next.id} <ArrowRight size={15} /></Link>}</Block>}
    </div><div className="stack">
      <Block title="作業ブランチ"><div className="branch-name"><GitBranch size={16} /><code>{task.branch}</code></div>
        {ready ? <>
          <Copy label="ブランチ名をコピー" value={task.branch} />
          <h3>ブランチ作成手順</h3><pre><code>{commands}</code></pre><Copy label="コマンドをコピー" value={commands} />
          <p className="muted">前の課題をマージした最新の main を使います。未コミットの変更は先にコミットするか退避してください。指定ブランチがある場合は <code>git switch {task.branch}</code> で切り替えます。</p>
        </> : <p className="muted">{status === 'planned' ? 'この課題は追加予定です。' : '前の課題を完了すると解放されます。'}</p>}
      </Block>
      <Block title="採点結果">
        {home.profile.repo_name && <a className="sub-link" href={'https://github.com/' + home.profile.repo_name} target="_blank" rel="noreferrer"><Github size={15} /> 演習リポジトリ <ArrowUpRight size={14} /></a>}
        {latest && <p><a href={latest.run_url} target="_blank" rel="noreferrer">{latest.result === 'passed' ? '合格' : '不合格'} · 実行ログ <ArrowUpRight size={12} /></a><br /><code>{latest.head_sha.slice(0, 7)}</code> · {dateLabel(latest.created_at)}</p>}
        {progress?.pull_number && home.profile.repo_name && <p><a href={`https://github.com/${home.profile.repo_name}/pull/${progress.pull_number}`} target="_blank" rel="noreferrer">マージ済み PR #{progress.pull_number}</a></p>}
        {ready && status !== 'completed' && <p className="muted">指定ブランチに push し、採点に合格したら自分で PR を main にマージしてください。</p>}
        {ready && !demoMode && status !== 'completed' && <button className="button primary" disabled={busy || !home.profile.repo_name} onClick={() => void action({ action: 'grade', taskId: task.id })}><Terminal size={15} />採点結果を確認</button>}
        {demoMode && <Link to="/settings" className="sub-link">演習の始め方 <ArrowUpRight size={14} /></Link>}
        {!ready && !demoMode && <p className="muted">この課題はまだ採点できません。</p>}
      </Block>
    </div></div>
  </>;
}

function History({ home }: { home: Home }) {
  const completed = home.progress.filter(entry => entry.status === 'completed');
  return <>
    <Title title="学習履歴" description="完了した改修と、提出コミットの採点結果を確認できます。" />
    <Block title={`完了した課題（${completed.length} 件）`}>
      {completed.length ? completed.map(entry => {
        const task = getTask(entry.task_id);
        return <Link key={entry.task_id} className="ticket-row history-row" to={'/tasks/' + entry.task_id}><span className="mono">{entry.task_id}</span><strong>{task?.title}</strong><span>{task?.tags.join(' · ')}</span><span>{home.submissions.filter(item => item.task_id === entry.task_id).length} 回提出</span></Link>;
      }) : <p className="muted">完了した課題はまだありません。</p>}
    </Block>
    <Block title={`提出履歴（${home.submissions.length} 件）`}>
      {home.submissions.length ? home.submissions.map(entry => <a className="ticket-row history-row" key={entry.created_at + entry.head_sha} href={entry.run_url} target="_blank" rel="noreferrer">
        <span className="mono">{entry.task_id}</span><strong>{entry.result === 'passed' ? '合格' : '不合格'} · {entry.head_sha.slice(0, 7)}</strong><span>{dateLabel(entry.created_at)}</span><ArrowUpRight size={15} />
      </a>) : <p className="muted">提出履歴はまだありません。</p>}
    </Block>
  </>;
}

function Notifications({ home, action, busy }: { home: Home; action: Action; busy: boolean }) {
  return <>
    <Title title="通知センター" description="開発チームからの依頼や、採点・課題完了の通知を確認できます。" />
    <Block title={`通知（未読 ${home.notifications.filter(notice => !notice.read_at).length} 件）`}>
      {!home.notifications.length && <p className="muted">新しい通知はありません。</p>}
      {home.notifications.map(notice => <div className="notification-row" key={notice.id}>
        <span className={'panel-icon ' + (getTask(notice.task_id)?.priority === '緊急' ? 'danger' : 'blue')}><Bell size={16} /></span>
        <Link to={'/tasks/' + notice.task_id} onClick={() => { if (!notice.read_at) void action({ action: 'read', notificationId: notice.id }); }}>
          <strong>{noticeText(notice)}</strong><small>{notice.task_id} · {dateLabel(notice.created_at)}</small>
        </Link>
        {notice.read_at ? <span className="muted">既読</span> : <button className="button compact" disabled={busy} onClick={() => void action({ action: 'read', notificationId: notice.id })}>既読にする</button>}
      </div>)}
    </Block>
  </>;
}

function Settings({ home, action, busy, demoMode, login }: { home: Home; action: Action; busy: boolean; demoMode: boolean; login: () => void }) {
  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await action({ action: 'register', repository: data.get('repository') });
  }
  return <>
    <Title title="演習リポジトリの設定" description="THREAD の自分専用リポジトリを作成し、DevQuest に登録します。" />
    <Block title="演習を始める">
      <ol><li>GitHub でログインします。</li><li>THREAD のテンプレートから個人所有の公開リポジトリを作成します。既定ブランチは main を使用してください。</li><li>作成したリポジトリを登録し、ローカルで README の手順に沿って起動します。</li></ol>
      <div className="actions"><a className="button" href={templateUrl + '/generate'} target="_blank" rel="noreferrer"><Github size={16} /> テンプレートを使う <ArrowUpRight size={14} /></a>
      <a className="sub-link" href={templateUrl + '#readme'} target="_blank" rel="noreferrer">THREAD のセットアップ手順 <ArrowUpRight size={14} /></a></div>
    </Block>
    <Block title="リポジトリを登録">
      {home.profile.repo_name ? <><a className="sub-link" href={'https://github.com/' + home.profile.repo_name} target="_blank" rel="noreferrer">{home.profile.repo_name} <ArrowUpRight size={14} /></a><p><Link to="/" className="sub-link">ダッシュボードで依頼を確認 <ArrowDownRight size={15} /></Link></p></> :
        demoMode ? <button className="button primary" disabled={!supabase} onClick={login}><Github size={16} /> GitHub でログイン</button> :
        <form onSubmit={register}><label className="repo-field">GitHub の所有者名/リポジトリ名
          <input name="repository" placeholder="所有者名/リポジトリ名" autoComplete="off" required maxLength={180} /></label><button className="button primary" disabled={busy}>登録する <ArrowRight size={15} /></button></form>}
    </Block>
  </>;
}

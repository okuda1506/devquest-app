import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { ArrowLeft, ArrowRight, ChevronRight } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { getTask, team } from '../supabase/functions/quest/catalog';
import { statusLabels, type Home } from './model';
import './team-members.css';

export type MemberId = keyof typeof team;
const expressionRows = { neutral: '0%', talking: '50%', happy: '100%' };
type Expression = keyof typeof expressionRows;

const profiles = {
    pm: {
        column: 0,
        expression: 'neutral',
        specialty: '要件整理と進行管理',
        quote: 'この改修で、誰の何が楽になるかな？',
        work: '店舗スタッフの相談を聞き、開発チームが一度に取り組める大きさの依頼にまとめる。締め切りが重なったときは、お客様への影響をもとに順番を決める。',
        habit: '朝会には小さなノートを持ってくる。話がまとまると、最後に「今日決めたこと」を一行で読み返す。'
    },
    director: {
        column: 1,
        expression: 'talking',
        specialty: '購入体験と画面設計',
        quote: 'そのボタン、片手で探しても見つかる？',
        work: '服を探してから購入するまでの画面を設計する。店頭でお客様が使う言葉をメモして、ボタンの文言や商品の見せ方に活かしている。',
        habit: 'レビューの最初にスマートフォンを取り出す。迷ったところはスクリーンショットを撮って、変更前後を並べて見せる。'
    },
    ops: {
        column: 2,
        expression: 'happy',
        specialty: '店舗運用と障害調査',
        quote: '最後にうまく動いたのは、いつだった？',
        work: '注文や在庫が店舗に正しく届くようにシステムを見守る。トラブルが起きると、操作時刻とログを突き合わせて原因を絞り込む。',
        habit: '引き継ぎの前に手順書を自分で試す。初めて読む人が迷ったところには、翌日さりげなく一言書き足している。'
    },
    qa: {
        column: 3,
        expression: 'talking',
        specialty: '品質保証と再現手順',
        quote: '同じことがもう一度起きるか、一緒に試そう。',
        work: 'お客様から届いた違和感を再現し、どの操作で何が起きるかを整理する。修正後は、元の操作とその前後の流れをもう一度確かめる。',
        habit: 'うまくいったケースも記録に残す。失敗したケースのすぐ隣に並べると、小さな違いに気づきやすいらしい。'
    }
} satisfies Record<
    MemberId,
    { column: number; expression: Expression; specialty: string; quote: string; work: string; habit: string }
>;

export const memberIds = Object.keys(profiles) as MemberId[];

export function MemberAvatar({
    member,
    expression = 'neutral',
    speaking = false
}: {
    member: MemberId;
    expression?: Expression;
    speaking?: boolean;
}) {
    const style = {
        '--portrait-column': (profiles[member].column * 100) / 3 + '%',
        '--portrait-row': expressionRows[expression]
    } as CSSProperties;
    return <span aria-hidden="true" className={'member-avatar' + (speaking ? ' speaking' : '')} style={style} />;
}

export function RequesterLink({ member, smiling = false }: { member: MemberId; smiling?: boolean }) {
    return (
        <Link className="requester" to={'/members/' + member} aria-label={team[member].name + 'のプロフィール'}>
            <MemberAvatar member={member} expression={smiling ? 'happy' : 'neutral'} />
            <span>
                <strong>{team[member].name}</strong>
                <small>{team[member].role}</small>
            </span>
            <ChevronRight size={14} aria-hidden="true" />
        </Link>
    );
}

export function TeamMembers() {
    return (
        <>
            <div className="page-title">
                <h1>メンバー一覧</h1>
                <p>THREAD 開発チームの4人。それぞれの担当と、仕事の進め方を紹介します。</p>
            </div>
            <ul className="member-grid">
                {memberIds.map((id) => (
                    <li key={id}>
                        <Link
                            className="panel member-card"
                            to={'/members/' + id}
                            aria-label={team[id].name + 'のプロフィール'}
                        >
                            <MemberAvatar member={id} expression={profiles[id].expression} />
                            <div className="member-card-copy">
                                <small>{team[id].role}</small>
                                <h2>{team[id].name}</h2>
                                <p>{profiles[id].specialty}</p>
                                <span className="member-open">
                                    プロフィールを見る <ArrowRight size={14} />
                                </span>
                            </div>
                        </Link>
                    </li>
                ))}
            </ul>
        </>
    );
}

export function MemberProfile({ home }: { home: Home }) {
    const { id } = useParams();
    const headingRef = useRef<HTMLHeadingElement>(null);
    useLayoutEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
        headingRef.current?.focus({ preventScroll: true });
    }, [id]);
    const member = memberIds.find((key) => key === id);
    const back = (
        <Link className="sub-link back" to="/members">
            <ArrowLeft size={15} /> メンバー一覧へ
        </Link>
    );
    if (!member)
        return (
            <>
                {back}
                <h1 ref={headingRef} tabIndex={-1}>
                    メンバーが見つかりません
                </h1>
            </>
        );

    const profile = profiles[member];
    // 配属後に実際に届いた依頼だけを載せて未解放の課題を伏せる
    const assignments = home.progress.flatMap((progress) => {
        const task = getTask(progress.task_id);
        return task?.available && task.author === member ? [{ task, status: progress.status }] : [];
    });
    return (
        <div className="member-detail">
            {back}
            <article className="panel">
                <header className="member-intro">
                    <MemberAvatar member={member} expression={profile.expression} />
                    <div>
                        <small>{team[member].role}</small>
                        <h1 ref={headingRef} tabIndex={-1}>
                            {team[member].name}
                        </h1>
                        <blockquote>「{profile.quote}」</blockquote>
                    </div>
                </header>
                <dl className="member-bio">
                    <dt>担当している仕事</dt>
                    <dd>{profile.work}</dd>
                    <dt>チームでの一面</dt>
                    <dd>{profile.habit}</dd>
                </dl>
            </article>
            <section className="member-requests" aria-labelledby="member-requests-title">
                <h2 id="member-requests-title">このメンバーからの依頼</h2>
                {assignments.length ? (
                    <ul className="panel">
                        {assignments.map(({ task, status }) => (
                            <li key={task.id}>
                                <Link to={'/tasks/' + task.id}>
                                    <span className="mono">{task.id}</span>
                                    <strong>{task.title}</strong>
                                    <small>{statusLabels[status]}</small>
                                    <ChevronRight size={16} />
                                </Link>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p>まだ依頼は届いていません。</p>
                )}
            </section>
        </div>
    );
}

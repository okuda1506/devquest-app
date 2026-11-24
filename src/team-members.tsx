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
        work: '店舗スタッフの「ちょっとお願い」を聞き、開発チームが着手できる大きさのチケットにする。「ちょっと」にしては長い話も、誰が何に困っているかまで丁寧に聞く。',
        habit: '朝会で「最後に一つだけ」と言ったら、本当に一つで終わる。ただし、その一つに箇条書きが三つあることはある。'
    },
    director: {
        column: 1,
        expression: 'talking',
        specialty: '購入体験と画面設計',
        work: '服を探してから買うまでの画面を設計する。カートにたどり着くまでに三回迷った画面を、レビューで「ちょっとした街歩き」と呼んだことがある。',
        habit: 'レビューはスマホ片手で始める。気づいた箇所はスクリーンショットで共有するので、チーム内ではどの端末よりも鈴木の親指が先に仕様を覚えると言われている。'
    },
    ops: {
        column: 2,
        expression: 'happy',
        specialty: '店舗運用と障害調査',
        work: '注文や在庫が店舗に正しく届くように見守る。「さっきまで動いていた」と聞くと穏やかに「さっきは何時ごろ？」と返し、その時刻のログを開く。',
        habit: '引き継ぎ前には手順書を自分で最初から試す。「あとはいつも通り」と書かれた箇所を見つけると、必要な手順を静かに書き足す。'
    },
    qa: {
        column: 3,
        expression: 'talking',
        specialty: '品質保証と再現手順',
        work: 'お客様が遭遇した不具合を再現して、誰でも同じ手順で確認できるようにする。「たまに起きます」と聞くと少しうれしそうになる。再現できた日はもっとうれしそう。',
        habit: '修正後は在庫0件と1件のように、表示が切り替わる境目を並べて試す。テスト用のカートでは同じTシャツを何度も買っているが、クローゼットにはまだ一枚もない。'
    }
} satisfies Record<
    MemberId,
    { column: number; expression: Expression; specialty: string; work: string; habit: string }
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

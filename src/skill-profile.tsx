import { useState } from 'react';
import { ArrowRight, ArrowUpRight, GitMerge, Milestone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Copy } from './copy';
import { dateLabel, type Home } from './model';
import { learnerSkills, skillStatus } from './skills';
import './skill-profile.css';

export function SkillProfile({ home, signedIn }: { home: Home; signedIn: boolean }) {
    const [selected, setSelected] = useState<string[]>([]);
    const skills = learnerSkills(home);
    const visibleChapter = Math.max(
        0,
        ...skills.filter((skill) => skill.status !== 'locked').map((skill) => skill.chapter)
    );
    const visibleSkills = skills.filter((skill) => skill.chapter <= visibleChapter);
    const merged = visibleSkills.filter((skill) => skill.status === 'completed').length;
    const timeline = visibleSkills
        .flatMap((skill) => skill.milestones.map((event) => ({ ...event, area: skill.area, taskId: skill.taskId })))
        .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
    const portfolio = visibleSkills
        .filter((skill) => skill.pullUrl && selected.includes(skill.taskId))
        .map((skill) => {
            const proof = skill.gradeUrl ? ` · [採点結果](${skill.gradeUrl})` : '';
            return `- **${skill.area}** · ${skill.ability}（${skill.taskId}）\n  [マージ済み PR](${skill.pullUrl})${proof}`;
        })
        .join('\n');

    return (
        <>
            <div className="page-title">
                <h1>スキルプロフィール</h1>
                <p>演習で身につけたスキルと、成果を確認できる GitHub の記録を振り返れます。</p>
            </div>
            {!signedIn || !home.profile.repo_name ? (
                <section className="panel block">
                    <h2>スキルの記録を始める</h2>
                    <p>GitHub でログインし、演習リポジトリを登録すると課題の進捗が表示されます。</p>
                    <Link to="/settings" className="button">
                        演習の始め方 <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                </section>
            ) : (
                <>
                    <section className="skills-section" aria-labelledby="skill-abilities">
                        <div className="skills-heading">
                            <h2 id="skill-abilities">スキルの到達状況</h2>
                            <span className="muted">
                                PR マージ済み {merged} / {skills.length}
                            </span>
                        </div>
                        <div className="skills-grid">
                            {visibleSkills.map((skill) => (
                                <article key={skill.taskId} className="panel skill-card">
                                    <div className="skills-heading">
                                        <span className="skill-area">{skill.area}</span>
                                        <span
                                            className={
                                                'badge ' +
                                                (skill.status === 'not_started' ? 'in_progress' : skill.status)
                                            }
                                        >
                                            {skill.status === 'completed' && <GitMerge size={13} aria-hidden="true" />}
                                            {skillStatus[skill.status]}
                                        </span>
                                    </div>
                                    <h3>{skill.ability}</h3>
                                    <div className="skill-links">
                                        {skill.status !== 'locked' && (
                                            <Link className="sub-link" to={'/tasks/' + skill.taskId}>
                                                {skill.taskId} の課題 <ArrowRight size={14} aria-hidden="true" />
                                            </Link>
                                        )}
                                        {skill.gradeUrl && (
                                            <a
                                                className="sub-link"
                                                href={skill.gradeUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                採点結果 <ArrowUpRight size={14} aria-hidden="true" />
                                            </a>
                                        )}
                                        {skill.pullUrl && (
                                            <a
                                                className="sub-link"
                                                href={skill.pullUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                マージ済み PR <ArrowUpRight size={14} aria-hidden="true" />
                                            </a>
                                        )}
                                    </div>
                                    {skill.pullUrl && (
                                        <label className="skill-share-option">
                                            <input
                                                type="checkbox"
                                                checked={selected.includes(skill.taskId)}
                                                onChange={(event) => {
                                                    const checked = event.target.checked;
                                                    setSelected((ids) =>
                                                        checked
                                                            ? [...ids, skill.taskId]
                                                            : ids.filter((id) => id !== skill.taskId)
                                                    );
                                                }}
                                            />
                                            共有文に含める
                                        </label>
                                    )}
                                </article>
                            ))}
                        </div>
                        {visibleSkills.length < skills.length && (
                            <p className="muted skill-locked">
                                次のチャプターが解放されると、対応するスキルが表示されます。
                            </p>
                        )}
                    </section>
                    {portfolio && (
                        <section className="panel block skill-portfolio">
                            <h2>成果の共有文</h2>
                            <p className="muted">選んだスキルと根拠のリンクを Markdown でコピーできます。</p>
                            <textarea aria-label="成果の共有文" readOnly value={portfolio} rows={5} />
                            <Copy label="共有文をコピー" value={portfolio} />
                        </section>
                    )}
                    <section className="panel block skill-timeline">
                        <h2>成長の記録</h2>
                        {timeline.length > 0 ? (
                            <ol>
                                {timeline.map((event) => (
                                    <li key={event.taskId + event.label}>
                                        <Milestone size={15} aria-hidden="true" />
                                        <div>
                                            <strong>
                                                {event.label} · {event.area}
                                            </strong>
                                            <small>
                                                <time dateTime={event.date}>{dateLabel(event.date)}</time>
                                                {event.url && (
                                                    <a
                                                        href={event.url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        aria-label={event.label + ' の GitHub 記録'}
                                                    >
                                                        GitHub <ArrowUpRight size={13} aria-hidden="true" />
                                                    </a>
                                                )}
                                            </small>
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        ) : (
                            <p className="muted">課題を提出して採点結果を確認すると、ここに記録されます。</p>
                        )}
                    </section>
                </>
            )}
        </>
    );
}

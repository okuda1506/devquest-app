import { ArrowRight, Code2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import questPreview from '../docs/screenshots/quest-preview.webp';
import skillPreview from '../docs/screenshots/skill-profile.webp';
import { MemberAvatar } from './team-members';
import './welcome.css';

const steps = [
    ['初出勤', 'THREAD のメンバーに会い、チームで使う画面や設計資料を確認します。'],
    ['ローカルで環境構築', 'GitHub を連携し、自分の公開リポジトリを用意。手元で EC サイトと店舗管理画面を起動します。'],
    ['改修して GitHub に提出', '依頼に沿ってコードを改修し、自動採点と PR マージを経て次の課題に進みます。']
];

export function Welcome({
    page,
    login,
    error,
    disabled,
    signingIn
}: {
    page?: 'signin' | 'signup';
    login: () => void;
    error: string;
    disabled: boolean;
    signingIn: boolean;
}) {
    const signup = page === 'signup';
    return (
        <div className="welcome">
            <header className="welcome-header">
                <div className="welcome-container welcome-header-content">
                    <Link to="/" className="welcome-brand">
                        <span className="brand-icon">
                            <Code2 size={20} />
                        </span>{' '}
                        DevQuest
                    </Link>
                    <nav aria-label="アカウント">
                        <Link to="/signin" className="button" aria-current={page === 'signin' ? 'page' : undefined}>
                            サインイン
                        </Link>
                        <Link to="/signup" className="button primary" aria-current={signup ? 'page' : undefined}>
                            新規登録
                        </Link>
                    </nav>
                </div>
            </header>
            <main className="welcome-container" id="main-content">
                {page ? (
                    <section className="panel welcome-auth">
                        <h1>{signup ? '新規登録' : 'サインイン'}</h1>
                        <p>
                            {signup
                                ? 'Google アカウントで DevQuest を始めます。'
                                : '登録に使った Google アカウントで演習を再開します。'}
                        </p>
                        {error && (
                            <p className="feedback error" role="alert">
                                {error}
                            </p>
                        )}
                        {disabled && (
                            <p className="feedback" role="status">
                                この環境では認証が設定されていません。
                            </p>
                        )}
                        <button className="button primary" onClick={login} disabled={disabled || signingIn}>
                            {signingIn ? 'Google に接続中…' : signup ? 'Googleで登録' : 'Googleでサインイン'}{' '}
                            <ArrowRight size={17} aria-hidden="true" />
                        </button>
                        <Link className="sub-link" to={signup ? '/signin' : '/signup'}>
                            {signup ? '登録済みの方はサインイン' : '初めての方は新規登録'}
                        </Link>
                    </section>
                ) : (
                    <>
                        {error && (
                            <p className="feedback error welcome-error" role="alert">
                                {error}
                            </p>
                        )}
                        <section className="welcome-hero" aria-labelledby="welcome-title">
                            <div>
                                <h1 id="welcome-title">
                                    アパレルECの開発チームに、
                                    <wbr />
                                    今日から参加。
                                </h1>
                                <p>
                                    チームから届く改修依頼に取り組み、GitHub
                                    に提出。自動採点を受けながら、4チャプター・40課題を進めます。
                                </p>
                                <Link className="button primary" to="/signup">
                                    無料で始める <ArrowRight size={17} aria-hidden="true" />
                                </Link>
                                <p className="welcome-note">
                                    ログインには Google、演習には GitHub
                                    アカウントと本人所有の公開リポジトリを使います。
                                </p>
                            </div>
                            <figure className="welcome-figure">
                                <img src={questPreview} alt="DEV-101の商品カード改修依頼と採点結果欄" />
                                <figcaption>DevQuest の課題画面</figcaption>
                            </figure>
                        </section>
                        <section className="welcome-section" aria-labelledby="welcome-steps">
                            <h2 id="welcome-steps">演習の進め方</h2>
                            <div className="welcome-path">
                                <ol>
                                    {steps.map(([title, description]) => (
                                        <li key={title}>
                                            <h3>{title}</h3>
                                            <p>{description}</p>
                                        </li>
                                    ))}
                                </ol>
                                <div className="welcome-team">
                                    <div aria-hidden="true">
                                        <MemberAvatar member="pm" />
                                        <MemberAvatar member="director" />
                                        <MemberAvatar member="ops" />
                                        <MemberAvatar member="qa" />
                                    </div>
                                    <p>PM・ディレクター・運用・QA からなる THREAD 開発チーム</p>
                                </div>
                            </div>
                        </section>
                        <section className="welcome-section welcome-path" aria-labelledby="welcome-skills">
                            <div>
                                <h2 id="welcome-skills">身につけたスキルを振り返る</h2>
                                <p>
                                    スキルプロフィールから、取り組んだ課題と採点結果、マージ済みの PR を確認できます。
                                </p>
                            </div>
                            <figure className="welcome-figure">
                                <img
                                    src={skillPreview}
                                    alt="採点結果とマージ済みPRを確認できるスキルプロフィール"
                                    loading="lazy"
                                />
                            </figure>
                        </section>
                    </>
                )}
            </main>
        </div>
    );
}

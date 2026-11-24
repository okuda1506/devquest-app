import { ArrowRight, Code2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { WelcomeLanding } from './welcome-landing';
import './welcome.css';

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
                        <WelcomeLanding />
                    </>
                )}
            </main>
        </div>
    );
}

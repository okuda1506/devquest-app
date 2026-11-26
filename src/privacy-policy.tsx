import { ArrowLeft, Code2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { privacyPolicyVersion } from '../supabase/functions/quest/privacy';

export function PrivacyPolicy() {
    return (
        <div className="welcome">
            <header className="welcome-header">
                <div className="welcome-container welcome-header-content">
                    <Link className="welcome-brand" to="/">
                        <span className="brand-icon">
                            <Code2 size={20} />
                        </span>
                        DevQuest
                    </Link>
                </div>
            </header>
            <main className="welcome-container">
                <article className="panel welcome-auth privacy-policy">
                    <h1>プライバシーポリシー</h1>
                    <p>版 {privacyPolicyVersion}</p>
                    <h2>取得する情報と利用目的</h2>
                    <p>
                        Google アカウントの識別子・メールアドレスは登録者の認証とアカウント管理に使います。 Google
                        の表示名は DevQuest の初期表示名に使います。
                        プライバシーポリシーへの同意日時と版を登録時に記録します。
                    </p>
                    <p>
                        GitHub のアカウント識別子・ユーザー名と公開演習リポジトリの識別子・名前を使って、
                        本人の提出かどうかを確認します。課題の進捗、提出コミット、採点結果、通知、
                        チュートリアルの進行状況は学習管理に使います。 課題 API
                        の記録は稼働確認や問い合わせの調査に使います。
                    </p>
                    <h2>利用する外部サービス</h2>
                    <p>
                        Google で本人確認を行い、Supabase で認証と学習データを管理します。 GitHub Pages
                        でアプリを配信し、GitHub の公開演習リポジトリと GitHub Actions で採点を行います。
                        演習リポジトリやプルリクエストに掲載した内容は GitHub で公開されます。
                    </p>
                    <h2>保存と削除</h2>
                    <p>
                        アカウントを利用している間は、認証情報と学習データをアカウントに紐づけて管理します。
                        保存期間の確認やアカウント・学習データの削除を希望する場合は、運営者にご連絡ください。 GitHub
                        上の演習リポジトリや投稿は、ご自身で GitHub から管理できます。
                    </p>
                    <h2>問い合わせ</h2>
                    <p>
                        <a href="https://github.com/okuda1506/devquest-app/issues">DevQuest の GitHub Issues</a>{' '}
                        で運営者にご連絡ください。 メールアドレスやアカウントの削除など、個人情報を含む相談の場合は、
                        公開欄には個人情報を書かずに連絡先の案内を依頼してください。
                    </p>
                    <Link className="sub-link back" to="/signup">
                        <ArrowLeft size={16} aria-hidden="true" /> 新規登録へ
                    </Link>
                </article>
            </main>
        </div>
    );
}

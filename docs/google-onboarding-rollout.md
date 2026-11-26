# DevQuest を Google 認証に切り替える

Google 登録・サインインの画面は `VITE_GOOGLE_ONBOARDING=true` で有効になります。GitHub Pages の Actions 変数を設定すると、次回のビルドから新しい導線を公開します。

## OAuth の準備

- Google Cloud の **Google Auth Platform → Clients** で Web application 用 OAuth クライアントを作成する。Google の **Authorized redirect URIs** には Supabase が示す `https://PROJECT_REF.supabase.co/auth/v1/callback` を登録する
- Supabase の **Authentication → Sign In / Providers** で Google を有効にし、Client ID と Client Secret を入力する。GitHub プロバイダーは有効のままにし、**Allow manual linking** を有効にする
- Supabase の **Authentication → URL Configuration** で Site URL と Redirect URLs に `https://okuda1506.github.io/devquest-app/` を設定する。事前検証には使用するテスト環境の URL も個別に登録する
- Google Cloud の **Audience** が Testing の場合は実際に使うアカウントをテストユーザーへ追加する。対象外の学習者を招く前に対象範囲を更新する
- Client Secret と Supabase の service role キーは管理画面で管理する。ブラウザ用のビルド変数は Supabase Project URL とフロント向け公開キーを使用する

## DB と Edge Function を反映する

本番の接続先を確認してから、対象コミットで以下を実行する。新規の Google 学習者は GitHub 未連携でプロフィールを持てる。既存プロフィールと提出・通知・進捗のキーは維持する。すでに演習リポジトリを登録した学習者は、現在の課題から再開できる。

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase functions deploy quest
```

## 既存学習者に Google ログインを追加する

1. GitHub Pages の `VITE_GOOGLE_ONBOARDING` は未設定のまま、DB と Edge Function 反映済みの版を公開する。
2. 既存の GitHub で DevQuest にログインし、リポジトリ設定の **Google ログインを追加** から、今後使う Google アカウントを紐づける。
3. Supabase の **Authentication → Users** で、従来のユーザー ID に Google と GitHub の両方が連携されたことを確認する。別のアカウントに連携済みと表示された場合はそこで中断し、対象ユーザー ID を確認する。メールアドレスだけで履歴の移し替えは行わない。
4. テスト環境または指定したローカル URL で、新しい導線をビルドして Google でサインインし、同じ ID、登録リポジトリ、進捗、提出履歴を確認する。ローカルの場合は `VITE_GOOGLE_ONBOARDING=true` と Supabase の公開接続情報を `.env.local` に設定し、URL を Supabase の許可リストに加える。

## 事前確認と公開

- 別のテスト用 Google と GitHub で、登録、最初の呼びかけ、ブラウザを変えた続きの再開、GitHub 連携のキャンセルと成功、別アカウントとの連携競合、登録エラーからの再試行、DEV-101 の解放まで確認する
- Windows の WSL 2 と macOS の実機で、README に沿ってクローンし、EC サイトと管理画面を起動する。DEV-101 の提出・採点・PR マージと DEV-102 の解放を確認する
- サインアウト後、画面の戻る操作や課題直リンクで前のユーザー情報が表示されることがないか確認する
- 既存学習者の引き継ぎと通し確認が終わったら、GitHub の **Settings → Secrets and variables → Actions → Variables** に `VITE_GOOGLE_ONBOARDING=true` を登録し、`main` で Pages ワークフローを実行する

フロントエンドを切り戻す場合は、この変数を外して Pages を再公開する。Google の学習者や進捗は保持し、本番 DB を元のスキーマへ戻す操作は行わない。

## プライバシーポリシーの公開前確認

- Google の新規登録では同意を選択するまで登録ボタンを使用できないことを確認する。認証を完了した後に `learners.privacy_policy_version` と `privacy_consented_at` が保存されることを確認する
- 新しいテストアカウントで先にサインインを試し、同意付きの新規登録へ案内されることを確認する。Supabase Auth に本人確認済みの ID が作成されても、同意を照合できるまで DevQuest の学習者プロフィールは作成されない
- 既存学習者の再サインインと GitHub 連携で、アカウント ID・進捗・既存の同意記録が維持されることを確認する
- 公開文面の問い合わせ経路・保存期間・削除の手順を運営者の実際の運用と照合する。GitHub Issues は公開のため、個人情報を含む依頼は運営者が別途案内する窓口で受け付ける
- ポリシーを改訂する場合は、画面で表示する文面と `privacyPolicyVersion` を更新し、DB が受け付ける版もマイグレーションで更新する。登録時の同意履歴は元の版と時刻を保持する

THREAD の構成刷新版を使う場合は、`thread-quests-v4` が公開済みであることを確認し、その採点基準に対応した DevQuest の `quest` を反映する。最新テンプレートから作ったリポジトリの登録と採点、および従来版で登録済みのリポジトリからの採点を確認する。

export function SetupHelp() {
    return (
        <details className="setup-help">
            <summary>開けないとき</summary>
            <p>THREAD リポジトリ直下のターミナルで、表示された症状に合わせて確認してください。</p>
            <details name="thread-setup-help">
                <summary>JWT シークレットのエラーが出る</summary>
                <p>
                    <code>.env</code> の <code>THREAD_JWT_SECRET</code> に32文字以上の値が必要です。
                    空の場合は次のコマンドで生成し、出力を <code>THREAD_JWT_SECRET=</code> の右側に貼り付けます。
                </p>
                <pre>
                    <code>{`node -p "require('node:crypto').randomBytes(32).toString('hex')"`}</code>
                </pre>
                <p>成功時は64文字の英数字が表示されます。保存後に開発サーバーを再起動してください。</p>
            </details>
            <details name="thread-setup-help">
                <summary>DB に接続できない</summary>
                <pre>
                    <code>docker compose ps db</code>
                </pre>
                <p>
                    <code>STATUS</code> が <code>Up ... (healthy)</code> なら DB は起動しています。 DB
                    が一覧にない場合は Docker を起動し、<code>docker compose up -d --wait</code> を実行してください。 DB
                    起動後も接続エラーが出る場合は <code>.env</code> の <code>DATABASE_URL</code> とポート 55432
                    を確認します。
                </p>
            </details>
            <details name="thread-setup-help">
                <summary>ポートが使用中と表示される</summary>
                <p>macOS・Linux では、使用中のポートと待ち受けているプロセスを確認できます。</p>
                <pre>
                    <code>{`lsof -nP -iTCP -sTCP:LISTEN | grep -E ':(3001|5174|5175|55432)[[:space:]]'`}</code>
                </pre>
                <p>
                    たとえば <code>127.0.0.1:5174 (LISTEN)</code> と表示された場合、そのポートはすでに使用中です。
                    別のターミナルで起動した開発サーバーが使用している場合は、そこで <kbd>Ctrl+C</kbd> を押して停止し、
                    <code>npm run dev</code> を実行します。 起動後は EC が 5174、店舗管理が 5175 と表示されます。
                </p>
            </details>
        </details>
    );
}

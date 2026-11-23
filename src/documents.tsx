import { Database, Download, FileCode2, Layers3 } from 'lucide-react';
import './documents.css';

const documents = [
    {
        title: 'テーブル定義書',
        description: 'THREAD のカラム、キー、制約をテーブルごとのシートで確認できます。',
        file: 'table-definition.xlsx',
        icon: Database
    },
    {
        title: '基本設計書',
        description: 'EC サイト、店舗管理、DevQuest の画面構成、権限、主な業務フローを確認できます。',
        file: 'basic-design.xlsx',
        icon: Layers3
    },
    {
        title: '詳細設計書',
        description: 'API の入出力、入力チェック、注文確定と採点の処理手順を確認できます。',
        file: 'detailed-design.xlsx',
        icon: FileCode2
    }
];

export function Documents() {
    return (
        <>
            <div className="page-title">
                <h1>ドキュメント</h1>
                <p>THREAD の改修や調査で参照する設計資料を Excel でダウンロードできます。</p>
            </div>
            <div className="document-list">
                {documents.map(({ title, description, file, icon: Icon }) => (
                    <article className="panel document-card" key={file}>
                        <span className="panel-icon blue">
                            <Icon size={19} aria-hidden="true" />
                        </span>
                        <div>
                            <h2>{title}</h2>
                            <p>{description}</p>
                        </div>
                        <a
                            className="button"
                            href={import.meta.env.BASE_URL + 'documents/' + file}
                            download={'THREAD_' + title + '.xlsx'}
                            aria-label={title + 'を Excel でダウンロード'}
                        >
                            <Download size={16} aria-hidden="true" /> XLSX をダウンロード
                        </a>
                    </article>
                ))}
            </div>
        </>
    );
}

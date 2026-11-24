import { Bell, BookOpen, FileText, FolderKanban, LayoutDashboard, Milestone } from 'lucide-react';

export const workspaceLinks = [
    {
        id: 'menu-dashboard',
        to: '/',
        label: 'ダッシュボード',
        icon: LayoutDashboard,
        line: '作業を再開するときは、まずここを開いてください。担当中の課題と、次にやることが分かります。'
    },
    {
        id: 'menu-project',
        to: '/project',
        label: 'プロジェクト',
        icon: FolderKanban,
        line: '配属先で使う技術と、今取り組めるチャプターを確認できます。演習用のテンプレートもここから開けますよ。'
    },
    {
        id: 'menu-documents',
        to: '/documents',
        label: 'ドキュメント',
        icon: FileText,
        line: '改修前に仕様を調べたいときはここです。テーブル定義書・基本設計書・詳細設計書を Excel でダウンロードできます。'
    },
    {
        id: 'menu-history',
        to: '/history',
        label: '学習履歴',
        icon: BookOpen,
        line: '提出したコミットの採点結果と、完了した改修が残ります。前の作業を振り返りたいときに使ってください。'
    },
    {
        id: 'menu-skills',
        to: '/skills',
        label: 'スキルプロフィール',
        icon: Milestone,
        line: '課題を通して身につけたスキルを確認できます。採点結果やマージ済みの PR もここから見返せますよ。'
    },
    {
        id: 'menu-notifications',
        to: '/notifications',
        label: '通知センター',
        icon: Bell,
        line: 'チームからの新しい依頼や採点結果が届きます。通知を開くと、その課題の詳細に移れますよ。'
    }
];

export const threadLink = {
    id: 'menu-thread',
    to: '/project',
    label: 'THREAD',
    line: '「参加プロジェクト」にある THREAD は、配属先への近道です。別の画面で作業していても、ここから案件に戻れます。'
};

export const settingsLink = {
    id: 'menu-settings',
    to: '/settings',
    label: 'リポジトリ設定',
    line: '自分の演習用 GitHub リポジトリはここで登録します。今日の着任案内も、ここから何度でも見返せます。'
};

export const menuTour = [...workspaceLinks, threadLink, settingsLink];

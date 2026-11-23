import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { ArrowRight, Bell, BriefcaseBusiness, ChevronRight, GitBranch } from 'lucide-react';
import { tasks, team } from '../supabase/functions/quest/catalog';
import './first-day.css';

export const firstAssignment = tasks[0];
type Scene = 'arrival' | 'project' | 'request';

const scenes = {
  arrival: { step: 1, label: 'チームに着任', title: 'THREAD 開発チームへ、ようこそ。', next: 'チームに合流する' },
  project: { step: 2, label: '配属先の確認', title: 'ここが担当プロジェクトです。', next: '最初の依頼を受け取る' },
  request: { step: 3, label: '新しい改修依頼', title: firstAssignment.title, next: '依頼を開く' },
};

function StaffPass() {
  return <div className="pass-display" role="img" aria-label="配属先 THREAD、担当は開発エンジニア">
    <div className="staff-pass" aria-hidden="true">
      <span className="pass-slot" />
      <strong className="pass-wordmark">THREAD.</strong>
      <span className="pass-role">開発エンジニア</span>
      <div className="pass-bottom"><span>開発チーム</span><GitBranch size={18} /></div>
    </div>
  </div>;
}

type FirstDayProps = {
  projectRef: RefObject<HTMLElement | null>;
  onSkip: () => void;
  onOpenTicket: () => void;
};

export function FirstDay({ projectRef, onSkip, onOpenTicket }: FirstDayProps) {
  const [scene, setScene] = useState<Scene>('arrival');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { step, label, title, next } = scenes[scene];
  const speaker = scene === 'request' ? firstAssignment.requester : team.pm;

  useLayoutEffect(() => {
    const dialog = dialogRef.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  useLayoutEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
    if (scene !== 'project' || !projectRef.current) return;
    const project = projectRef.current;
    const originalScroll = window.scrollY;
    // 説明パネルの上に実際の案件カードが見えるよう、必要な分だけスクロールする。
    function revealProject() {
      const card = project.getBoundingClientRect();
      const panel = dialogRef.current!.getBoundingClientRect();
      const limit = card.right < panel.left ? window.innerHeight - 16 : panel.top - 16;
      const offset = card.top < 12 ? card.top - 12 : Math.min(card.top - 12, Math.max(0, card.bottom - limit));
      window.scrollBy({ top: offset, behavior: 'instant' });
    }
    revealProject();
    window.addEventListener('resize', revealProject);
    return () => {
      window.removeEventListener('resize', revealProject);
      window.scrollTo({ top: originalScroll, behavior: 'instant' });
    };
  }, [scene, projectRef]);

  function advance() {
    if (scene === 'arrival') setScene('project');
    else if (scene === 'project') setScene('request');
    else onOpenTicket();
  }

  return <dialog className={'first-day scene-' + scene} ref={dialogRef} aria-labelledby="first-day-title" aria-describedby="first-day-line"
    onCancel={event => { event.preventDefault(); onSkip(); }}>
    <div className="scene-top">
      <div className="scene-label">{scene === 'request' ? <Bell size={15} /> : <BriefcaseBusiness size={15} />}
        <span>初出勤</span><ChevronRight size={13} /><strong>{label}</strong>
      </div>
      <button className="scene-skip" onClick={onSkip}>スキップ</button>
    </div>
    <div className="scene-body" key={scene}>
      {scene === 'arrival' && <StaffPass />}
      <div className="scene-dialogue">
        <div className="speaker"><span className="speaker-avatar">{speaker.initials}</span><strong>{speaker.name}</strong><small>{speaker.role}</small></div>
        {scene === 'request' && <span className="scene-ticket mono">{firstAssignment.id}</span>}
        <h2 id="first-day-title" ref={titleRef} tabIndex={-1}>{title}</h2>
        <p id="first-day-line">{scene === 'arrival' ? '田中です。今日から一緒に、アパレルストア「THREAD」を育てていきましょう。まずは、担当してもらうプロジェクトを紹介します。'
          : scene === 'project' ? 'THREAD は、すでにお客様が使っているお店です。このカードから、システムの概要やチームの課題をいつでも確認できます。'
          : firstAssignment.description}</p>
      </div>
    </div>
    <div className="scene-controls">
      <span className="scene-progress" role="img" aria-label={`全3場面のうち${step}番目`}>{[1, 2, 3].map(n => <i aria-hidden="true" key={n} className={n <= step ? 'lit' : ''} />)}</span>
      <button className="button primary" onClick={advance}>{next} <ArrowRight size={16} /></button>
    </div>
  </dialog>;
}

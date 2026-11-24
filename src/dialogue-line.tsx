import { useLayoutEffect, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { team } from '../supabase/functions/quest/catalog';
import { MemberAvatar, memberIds, type MemberId } from './team-members';

const motionPreference = '(prefers-reduced-motion: reduce)';

function subscribeMotion(update: () => void) {
    const media = window.matchMedia(motionPreference);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
}

export function useDialoguePlayback(line: string, instant: boolean) {
    const reduced = useSyncExternalStore(subscribeMotion, () => window.matchMedia(motionPreference).matches);
    const [finished, setFinished] = useState(false);
    useLayoutEffect(() => setFinished(false), [line, instant, reduced]);
    return { typing: !instant && !reduced && !finished, finish: () => setFinished(true) };
}

export function Speaker({
    member,
    typing,
    smiling = false,
    showTeam = false,
    children
}: {
    member: MemberId;
    typing: boolean;
    smiling?: boolean;
    showTeam?: boolean;
    children?: ReactNode;
}) {
    return (
        <div className="speaker">
            <div className="speaker-portrait">
                <MemberAvatar member={member} speaking={typing} expression={smiling ? 'happy' : 'neutral'} />
            </div>
            <div className="speaker-caption" id="dialogue-speaker">
                <small>{team[member].role}</small>
                <strong>{team[member].name}</strong>
            </div>
            {showTeam && (
                <div className="speaker-ensemble" aria-hidden="true">
                    {memberIds
                        .filter((id) => id !== member)
                        .map((id) => (
                            <MemberAvatar key={id} member={id} />
                        ))}
                </div>
            )}
            {children}
        </div>
    );
}

export function DialogueLine({
    id,
    line,
    typing,
    onComplete
}: {
    id: string;
    line: string;
    typing: boolean;
    onComplete: () => void;
}) {
    let delay = 140;
    const letters = Array.from(line);
    return (
        <p id={id} className="dialogue-line">
            {!typing ? (
                line
            ) : (
                <>
                    <span className="dialogue-transcript">{line}</span>
                    <span aria-hidden="true">
                        {letters.map((character, index) => {
                            const hold = /[。！？]/u.test(character) ? 200 : /[、，]/u.test(character) ? 100 : 32;
                            const style = { '--start': delay + 'ms', '--hold': hold + 'ms' } as CSSProperties;
                            delay += hold;
                            return (
                                <span
                                    key={index}
                                    className="dialogue-letter"
                                    style={style}
                                    onAnimationEnd={index === letters.length - 1 ? onComplete : undefined}
                                >
                                    {character}
                                </span>
                            );
                        })}
                    </span>
                </>
            )}
        </p>
    );
}

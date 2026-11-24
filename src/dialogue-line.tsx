import type { CSSProperties } from 'react';

export function DialogueLine({ id, line, instant }: { id: string; line: string; instant: boolean }) {
    let delay = 140;
    return (
        <p id={id} className="dialogue-line">
            {instant ? (
                line
            ) : (
                <>
                    <span className="dialogue-transcript">{line}</span>
                    <span aria-hidden="true">
                        {Array.from(line).map((character, index) => {
                            const hold = /[。！？]/u.test(character) ? 200 : /[、，]/u.test(character) ? 100 : 32;
                            const style = { '--start': delay + 'ms', '--hold': hold + 'ms' } as CSSProperties;
                            delay += hold;
                            return (
                                <span key={index} className="dialogue-letter" style={style}>
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

import { useLayoutEffect, type RefObject } from 'react';
import { useReducedMotion } from './dialogue-line';

const startLine = 0.6;
const deviceFinishLine = 0.33;

export function useLandingMotion(
    landing: RefObject<HTMLDivElement | null>,
    startClosing: (started: true) => void
) {
    const reduced = useReducedMotion();

    useLayoutEffect(() => {
        const root = landing.current;
        if (!root || reduced || typeof window.requestAnimationFrame !== 'function') return;

        const pending = new Set(
            root.querySelectorAll<HTMLElement>(
                '[data-reveal]:not([data-motion="entered"]):not([data-motion="done"])'
            )
        );
        if (!pending.size) return;

        let frame = 0;
        const benchCopy = root.querySelector<HTMLElement>('[data-reveal="copy"]');

        function stop() {
            window.removeEventListener('scroll', requestUpdate);
            window.removeEventListener('resize', requestUpdate);
        }

        function reveal(item: HTMLElement, animate: boolean) {
            item.dataset.motion = animate ? 'entered' : 'done';
            item.style.removeProperty('--device-progress');
            pending.delete(item);
            if (animate && item.dataset.reveal === 'closing') startClosing(true);
        }

        function update(initial = false) {
            const height = window.innerHeight;
            const threshold = height * startLine;
            const atEnd = window.scrollY + height >= document.documentElement.scrollHeight - 2;
            const copyTop = benchCopy?.getBoundingClientRect().top ?? Number.NEGATIVE_INFINITY;
            const positions = Array.from(pending, (item) => [item, item.getBoundingClientRect()] as const);
            let precedingScreenReady = true;

            for (const [item, rect] of positions) {
                const section = item.dataset.reveal;
                const past = rect.bottom <= 0;
                const atEndAndVisible = atEnd && rect.top < height;
                const ready = rect.top <= threshold || atEndAndVisible;

                if (past || (initial && ready)) {
                    reveal(item, false);
                } else if (section === 'device') {
                    // 開発環境の説明を先に表示し、画像だけをスクロール量に追従させる
                    const top = Math.max(rect.top, copyTop + 24);
                    const progress = (threshold - top) / (height * (startLine - deviceFinishLine));
                    if (progress >= 1 || atEndAndVisible) reveal(item, false);
                    else item.style.setProperty('--device-progress', String(Math.max(0, progress)));
                } else if (ready && (section !== 'screen' || precedingScreenReady)) {
                    reveal(item, true);
                }
                if (section === 'screen' && pending.has(item)) precedingScreenReady = false;
            }

            if (!pending.size) stop();
        }

        function requestUpdate() {
            if (frame) return;
            frame = window.requestAnimationFrame(() => {
                frame = 0;
                update();
            });
        }

        for (const item of pending) item.dataset.motion = 'waiting';
        update(true);

        if (pending.size) {
            window.addEventListener('scroll', requestUpdate, { passive: true });
            window.addEventListener('resize', requestUpdate);
        }

        return () => {
            stop();
            window.cancelAnimationFrame(frame);
            for (const item of pending) {
                delete item.dataset.motion;
                item.style.removeProperty('--device-progress');
            }
        };
    }, [landing, reduced, startClosing]);
}

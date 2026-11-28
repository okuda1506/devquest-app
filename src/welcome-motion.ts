import { useLayoutEffect, type RefObject } from 'react';
import { useReducedMotion } from './dialogue-line';

const startLine = 0.6;
const copyDuration = 650;

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
        const enteredAt = new Map<HTMLElement, number>();
        const prerequisites = new Map(
            Array.from(pending, (item) => {
                const section = item.closest('.landing-section');
                const intro = section?.querySelector<HTMLElement>('[data-reveal="intro"]');
                const copy =
                    item.dataset.reveal === 'device'
                        ? section?.querySelector<HTMLElement>('[data-reveal="copy"]')
                        : null;
                return [
                    item,
                    [intro, copy].filter((part): part is HTMLElement => !!part && part !== item)
                ] as const;
            })
        );
        const device = root.querySelector<HTMLElement>('[data-reveal="device"]');
        root.style.setProperty('--landing-copy-duration', copyDuration + 'ms');

        function stop() {
            window.removeEventListener('scroll', requestUpdate);
            window.removeEventListener('resize', requestUpdate);
        }

        function reveal(item: HTMLElement, animate: boolean) {
            item.dataset.motion = animate ? 'entered' : 'done';
            pending.delete(item);
            if (animate && item.dataset.reveal === 'closing') startClosing(true);
        }

        function update(initial = false) {
            const height = window.innerHeight;
            const threshold = height * startLine;
            const atEnd = window.scrollY + height >= document.documentElement.scrollHeight - 2;
            const now = performance.now();
            const deviceTop = device?.getBoundingClientRect().top ?? Infinity;
            const positions = Array.from(pending, (item) => [item, item.getBoundingClientRect()] as const);
            let precedingScreenReady = true;

            for (const [item, rect] of positions) {
                const section = item.dataset.reveal;
                const past = rect.bottom <= 0;
                const atEndAndVisible = atEnd && rect.top < height;
                const ready =
                    rect.top <= threshold ||
                    atEndAndVisible ||
                    (section === 'copy' && deviceTop <= threshold && rect.top < height);
                const before = prerequisites.get(item) ?? [];

                if (past || (initial && ready)) {
                    reveal(item, false);
                } else if (
                    ready &&
                    !before.some((part) => pending.has(part)) &&
                    (section !== 'screen' || precedingScreenReady)
                ) {
                    // 同じスクロール位置で文言と画像が発火する場合も、文言が表示されるまで待つ
                    const latest = Math.max(...before.map((part) => enteredAt.get(part) ?? -Infinity));
                    const delay = Math.max(0, latest + copyDuration - now);
                    item.style.setProperty('--landing-reveal-delay', delay + 'ms');
                    if (section === 'intro' || section === 'copy') enteredAt.set(item, now + delay);
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
            }
        };
    }, [landing, reduced, startClosing]);
}

export const firstDayScenes = ['arrival', 'project', 'menu', 'setup', 'request'] as const;
export const setupHosts = ['localhost:5174', 'localhost:5175'] as const;

export type FirstDayCheckpoint = {
    scene: (typeof firstDayScenes)[number];
    menuIndex: number;
    openedPages: string[];
};

export function readFirstDayCheckpoint(value: unknown): FirstDayCheckpoint | null {
    if (!value || typeof value !== 'object') return null;
    const { scene, menuIndex, openedPages } = value as Record<string, unknown>;
    if (
        !firstDayScenes.some((step) => step === scene) ||
        typeof menuIndex !== 'number' ||
        !Number.isInteger(menuIndex) ||
        menuIndex < 0 ||
        menuIndex > 64 ||
        !Array.isArray(openedPages)
    )
        return null;
    return {
        scene: scene as FirstDayCheckpoint['scene'],
        menuIndex,
        openedPages: setupHosts.filter((host) => openedPages.includes(host))
    };
}

export function normalizeDisplayName(value: unknown): string {
    return typeof value === 'string'
        ? Array.from(value.replace(/[\p{Cc}\p{Cf}]/gu, '').trim())
              .slice(0, 50)
              .join('')
        : '';
}

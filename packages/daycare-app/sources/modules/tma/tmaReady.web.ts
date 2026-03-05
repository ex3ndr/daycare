/**
 * Signals to Telegram that the Mini App is ready.
 * Calls both @tma.js/bridge postEvent and legacy Telegram.WebApp.ready().
 */
export function tmaReady(): void {
    try {
        // Legacy global
        const w = window as Window & { Telegram?: { WebApp?: { ready?: () => void } } };
        w.Telegram?.WebApp?.ready?.();
    } catch {
        // ignore
    }
}

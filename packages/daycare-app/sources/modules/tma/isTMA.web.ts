import { isTMA as isTMABridge } from "@tma.js/bridge";

/**
 * Returns true if the app is running inside a Telegram Mini App.
 * Web implementation using @tma.js/bridge.
 */
export function isTMA(): boolean {
    try {
        return isTMABridge();
    } catch {
        return false;
    }
}

import { retrieveRawInitData } from "@tma.js/bridge";

/**
 * Retrieves Telegram Mini App initData string using @tma.js/bridge.
 * Returns undefined if not in TMA or initData is not available.
 */
export function tmaInitData(): string | undefined {
    try {
        return retrieveRawInitData();
    } catch {
        return undefined;
    }
}

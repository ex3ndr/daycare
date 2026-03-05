import { retrieveRawLaunchParams } from "@tma.js/bridge";

/**
 * Retrieves raw Telegram Mini App launch params as a query string.
 * Contains all params from the original URL (query + hash), flattened.
 */
export function tmaLaunchParams(): string | undefined {
    try {
        return retrieveRawLaunchParams();
    } catch {
        return undefined;
    }
}

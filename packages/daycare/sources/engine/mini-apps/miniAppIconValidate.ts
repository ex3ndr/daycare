import { MiniAppIconError } from "./miniAppIconError.js";
import { MINI_APP_OCTICON_NAME_SET, MINI_APP_OCTICON_NAMES } from "./miniAppOcticons.js";

/**
 * Validates one mini app icon against the supported Octicons glyph names.
 * Expects: icon is a trimmed user-provided icon name.
 */
export function miniAppIconValidate(icon: string): string {
    const normalized = icon.trim();
    if (!normalized) {
        throw new Error("Mini app icon is required.");
    }
    if (!MINI_APP_OCTICON_NAME_SET.has(normalized)) {
        throw new MiniAppIconError(normalized, MINI_APP_OCTICON_NAMES);
    }
    return normalized;
}

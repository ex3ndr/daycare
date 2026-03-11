import { MINI_APP_ICON_FALLBACK } from "./miniAppOcticons.js";

/**
 * Raised when a mini app icon does not match the supported Octicons catalog.
 * Expects: icons contains the full allowed icon list.
 */
export class MiniAppIconError extends Error {
    readonly icons: readonly string[];
    readonly fallbackIcon = MINI_APP_ICON_FALLBACK;

    constructor(icon: string, icons: readonly string[]) {
        super(`Invalid mini app icon "${icon}".`);
        this.name = "MiniAppIconError";
        this.icons = icons;
    }
}

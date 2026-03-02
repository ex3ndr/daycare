export type ThemePreference = "light" | "dark" | "adaptive";
const THEME_PREFERENCE_KEY = "daycare.theme.preference";

function themePreferenceReadRaw(): string | null {
    if (typeof window === "undefined") {
        return null;
    }

    const storage = window.localStorage;
    if (!storage || typeof storage.getItem !== "function") {
        return null;
    }

    try {
        return storage.getItem(THEME_PREFERENCE_KEY);
    } catch {
        return null;
    }
}

/**
 * Loads preferred theme mode from web storage when available.
 * Expects: this function is safe to call in non-browser runtime.
 */
export function loadThemePreference(): ThemePreference {
    const raw = themePreferenceReadRaw();
    if (raw === "light" || raw === "dark" || raw === "adaptive") {
        return raw;
    }
    return "adaptive";
}

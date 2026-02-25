export type ThemePreference = "light" | "dark" | "adaptive";

/**
 * Loads preferred theme mode from web storage when available.
 * Expects: this function is safe to call in non-browser runtime.
 */
export function loadThemePreference(): ThemePreference {
    if (typeof window === "undefined") {
        return "adaptive";
    }
    const raw = window.localStorage.getItem("daycare.theme.preference");
    if (raw === "light" || raw === "dark" || raw === "adaptive") {
        return raw;
    }
    return "adaptive";
}

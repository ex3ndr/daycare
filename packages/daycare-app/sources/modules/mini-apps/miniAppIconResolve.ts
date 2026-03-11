import type { Octicons } from "@expo/vector-icons";
import octiconsGlyphMap from "@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Octicons.json";

export const MINI_APP_ICON_FALLBACK = "browser";

const miniAppIconNames = new Set(Object.keys(octiconsGlyphMap));

/**
 * Resolves one stored mini-app icon to a safe Octicons glyph name.
 * Expects: icon may be missing or stale compared with the current icon set.
 */
export function miniAppIconResolve(icon: string | null | undefined): React.ComponentProps<typeof Octicons>["name"] {
    return typeof icon === "string" && miniAppIconNames.has(icon)
        ? (icon as React.ComponentProps<typeof Octicons>["name"])
        : MINI_APP_ICON_FALLBACK;
}

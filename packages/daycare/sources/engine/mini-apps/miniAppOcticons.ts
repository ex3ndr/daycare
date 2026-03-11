import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const MINI_APP_ICON_FALLBACK = "browser";

const miniAppOcticonsPath = fileURLToPath(
    new URL(
        "../../../../daycare-app/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Octicons.json",
        import.meta.url
    )
);
const miniAppOcticonsGlyphMap = JSON.parse(readFileSync(miniAppOcticonsPath, "utf8")) as Record<string, number>;

export const MINI_APP_OCTICON_NAMES = Object.freeze(Object.keys(miniAppOcticonsGlyphMap).sort());
export const MINI_APP_OCTICON_NAME_SET = new Set(MINI_APP_OCTICON_NAMES);

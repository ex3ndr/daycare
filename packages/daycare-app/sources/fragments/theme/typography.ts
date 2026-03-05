import { z } from "zod";

// Known font weight roles. Maps to IBM Plex Sans font families at render time.
export const fontWeights = ["regular", "medium", "semibold"] as const;

// Font weight prop schema: accepts a known weight role.
export const fontWeightSchema = z.enum(fontWeights);

/**
 * Resolves a font weight string to a concrete font family name.
 * If the string matches a known weight role, returns the corresponding IBM Plex Sans variant.
 * Otherwise treats it as a raw font family name and passes it through directly.
 *
 * Weight roles:
 * - "regular"  → IBMPlexSans-Regular (normal body text)
 * - "medium"   → IBMPlexSans-Medium (emphasized text, labels)
 * - "semibold" → IBMPlexSans-SemiBold (headings, strong emphasis)
 *
 * Expects: returns "IBMPlexSans-Regular" when value is null/undefined.
 */
export function fontWeightResolve(value: string | null | undefined): string {
    switch (value) {
        case "medium":
            return "IBMPlexSans-Medium";
        case "semibold":
            return "IBMPlexSans-SemiBold";
        case "regular":
            return "IBMPlexSans-Regular";
        default:
            if (!value) return "IBMPlexSans-Regular";
            return value;
    }
}

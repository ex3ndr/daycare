import { z } from "zod";

// Zod schemas for flex alignment props in the catalog.
// Includes both shorthand ("start", "between") and original RN values ("flex-start", "space-between").
export const flexAlignSchema = z.enum(["start", "center", "end", "stretch", "baseline", "flex-start", "flex-end"]);
export const flexJustifySchema = z.enum([
    "start",
    "center",
    "end",
    "between",
    "flex-start",
    "flex-end",
    "space-between"
]);

/**
 * Resolves shorthand align-items values to React Native FlexStyle equivalents.
 * Accepts both shorthand ("start", "end") and original RN values ("flex-start", "flex-end").
 *
 * Expects: catalog or RN values, or null/undefined.
 */
export function flexAlignResolve(
    v: string | null | undefined
): "flex-start" | "center" | "flex-end" | "stretch" | "baseline" | undefined {
    switch (v) {
        case "start":
        case "flex-start":
            return "flex-start";
        case "end":
        case "flex-end":
            return "flex-end";
        case "center":
            return "center";
        case "stretch":
            return "stretch";
        case "baseline":
            return "baseline";
        default:
            return undefined;
    }
}

/**
 * Resolves shorthand justify-content values to React Native FlexStyle equivalents.
 * Accepts both shorthand ("start", "end", "between") and original RN values ("flex-start", "flex-end", "space-between").
 *
 * Expects: catalog or RN values, or null/undefined.
 */
export function flexJustifyResolve(
    v: string | null | undefined
): "flex-start" | "center" | "flex-end" | "space-between" | undefined {
    switch (v) {
        case "start":
        case "flex-start":
            return "flex-start";
        case "end":
        case "flex-end":
            return "flex-end";
        case "between":
        case "space-between":
            return "space-between";
        case "center":
            return "center";
        default:
            return undefined;
    }
}

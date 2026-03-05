import { z } from "zod";

// Semantic spacing scale tokens: 4px increments for consistent density.
export const spacingScales = ["none", "xs", "sm", "md", "lg", "xl"] as const;

// Spacing prop schema: accepts a semantic scale token or a raw number (pixels).
export const spacingSchema = z.union([z.enum(spacingScales), z.number()]);

/**
 * Resolves a spacing value to pixels.
 * Accepts a semantic scale token or a raw number. Returns 0 for null/undefined.
 *
 * Scale mapping: none=0, xs=4, sm=8, md=16, lg=24, xl=32.
 */
export function spacingResolve(value: string | number | null | undefined): number {
    if (typeof value === "number") return value;
    switch (value) {
        case "xs":
            return 4;
        case "sm":
            return 8;
        case "md":
            return 16;
        case "lg":
            return 24;
        case "xl":
            return 32;
        default:
            return 0;
    }
}

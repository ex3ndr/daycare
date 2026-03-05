import { z } from "zod";
import type { Theme } from "@/theme";

// Known Material Design 3 color roles for documentation/autocomplete hints.
export const colorRoles = [
    "primary",
    "onPrimary",
    "primaryContainer",
    "onPrimaryContainer",
    "secondary",
    "onSecondary",
    "secondaryContainer",
    "onSecondaryContainer",
    "tertiary",
    "onTertiary",
    "tertiaryContainer",
    "onTertiaryContainer",
    "error",
    "onError",
    "errorContainer",
    "onErrorContainer",
    "surface",
    "onSurface",
    "surfaceVariant",
    "onSurfaceVariant",
    "surfaceContainer",
    "surfaceContainerLow",
    "surfaceContainerHigh",
    "surfaceContainerHighest",
    "outline",
    "outlineVariant"
] as const;

// Color prop schema: accepts a theme color role (e.g. "primary") or any CSS color string (e.g. "#FF0000", "rgba(...)").
export const colorSchema = z.string();

/**
 * Resolves a color string to a concrete color value.
 * If the string matches a Material Design 3 theme color role (e.g. "primary", "onSurface"),
 * returns the corresponding theme color. Otherwise treats it as a raw CSS color and passes
 * it through directly (e.g. "#FF0000", "rgba(0,0,0,0.5)").
 *
 * Expects: theme is a valid Theme object. Returns undefined when value is null/undefined/empty.
 */
export function colorResolve(value: string, theme: Theme): string;
export function colorResolve(value: string | null | undefined, theme: Theme): string | undefined;
export function colorResolve(value: string | null | undefined, theme: Theme): string | undefined {
    if (!value) return undefined;
    return (theme.colors as Record<string, string>)[value] ?? value;
}

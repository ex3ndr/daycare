/**
 * Formats a numeric cost value as a USD string (e.g., $12.34).
 * For values under $0.01, shows 4 decimal places.
 */
export function costsFormatCurrency(value: number): string {
    if (value < 0.01 && value > 0) {
        return `$${value.toFixed(4)}`;
    }
    return `$${value.toFixed(2)}`;
}

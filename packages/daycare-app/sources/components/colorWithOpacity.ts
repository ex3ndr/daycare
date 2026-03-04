/**
 * Returns a color string with the given opacity applied.
 * Supports #RGB, #RRGGBB, rgb(), and rgba() inputs.
 */
export function colorWithOpacity(color: string, opacity: number): string {
    const alpha = Math.max(0, Math.min(1, opacity));

    if (/^#[0-9a-f]{3}$/i.test(color)) {
        const r = parseInt(color[1] + color[1], 16);
        const g = parseInt(color[2] + color[2], 16);
        const b = parseInt(color[3] + color[3], 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    if (/^#[0-9a-f]{6}$/i.test(color)) {
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    const rgbMatch = color.match(/^rgb\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\)$/i);
    if (rgbMatch) {
        const [, r, g, b] = rgbMatch;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    const rgbaMatch = color.match(/^rgba\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([0-9.]+)\)$/i);
    if (rgbaMatch) {
        const [, r, g, b] = rgbaMatch;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    return color;
}

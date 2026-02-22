/**
 * Keeps a balanced head/tail slice with a truncation separator when needed.
 * Expects: maxLength >= 0.
 */
export function stringTruncateHeadTail(value: string, maxLength: number, source = "output"): string {
    if (value.length <= maxLength) {
        return value;
    }

    const safeMax = Math.max(0, maxLength);
    const headLength = Math.ceil(safeMax / 2);
    const tailLength = Math.floor(safeMax / 2);
    const truncatedChars = value.length - safeMax;
    const separator = `\n\n... (${truncatedChars.toLocaleString("en-US")} chars truncated from ${source}) ...\n\n`;
    const head = value.slice(0, headLength);
    const tail = value.slice(Math.max(0, value.length - tailLength));
    return `${head}${separator}${tail}`;
}

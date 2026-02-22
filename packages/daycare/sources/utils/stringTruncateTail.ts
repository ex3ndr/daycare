/**
 * Keeps the trailing maxLength chars and prepends a truncation notice when needed.
 * Expects: maxLength >= 0.
 */
export function stringTruncateTail(value: string, maxLength: number, source = "output"): string {
    if (value.length <= maxLength) {
        return value;
    }

    const safeMax = Math.max(0, maxLength);
    const truncatedChars = value.length - safeMax;
    const notice = `... (${truncatedChars.toLocaleString("en-US")} chars truncated from ${source})\n`;
    const tail = value.slice(Math.max(0, value.length - safeMax));
    return `${notice}${tail}`;
}

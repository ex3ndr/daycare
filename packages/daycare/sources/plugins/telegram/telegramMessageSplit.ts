/**
 * Splits a Telegram message into chunks that fit within the max length.
 * Expects: maxLength > 0.
 */
export function telegramMessageSplit(text: string, maxLength: number): string[] {
    if (maxLength <= 0) {
        throw new Error("maxLength must be greater than 0");
    }
    if (text.length <= maxLength) {
        return [text];
    }

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > maxLength) {
        const window = remaining.slice(0, maxLength);
        const cutIndex = findBreakIndex(window) || maxLength;
        chunks.push(remaining.slice(0, cutIndex));
        remaining = remaining.slice(cutIndex);
    }

    chunks.push(remaining);
    return chunks;
}

function findBreakIndex(window: string): number {
    const separators = ["\n\n", "\n", " "];
    for (const separator of separators) {
        const index = window.lastIndexOf(separator);
        if (index > 0) {
            return index + separator.length;
        }
    }
    return 0;
}

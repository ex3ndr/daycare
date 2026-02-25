/**
 * Extracts the first <summary>...</summary> section from model output.
 * Returns the original text when summary tags are missing.
 */
export function inferenceSummaryParse(text: string): string {
    const match = /<summary>([\s\S]*?)<\/summary>/i.exec(text);
    if (!match) {
        return text;
    }
    return (match[1] ?? "").trim();
}

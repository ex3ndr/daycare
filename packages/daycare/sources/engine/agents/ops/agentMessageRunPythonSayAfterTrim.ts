/**
 * Trims assistant text by removing <say> blocks that appear after the first <run_python> tag.
 * Returns null when no trim is needed.
 */
export function agentMessageRunPythonSayAfterTrim(text: string): string | null {
    const openTagPattern = /<run_python(\s[^>]*)?>/i;
    const match = openTagPattern.exec(text);
    if (!match || match.index === undefined) {
        return null;
    }

    const beforeRunPython = text.slice(0, match.index);
    const afterRunPython = text.slice(match.index);
    const strippedAfter = afterRunPython.replace(/<say(\s[^>]*)?>[\s\S]*?<\/say\s*>/gi, "");
    const trimmed = `${beforeRunPython}${strippedAfter}`;
    return trimmed === text ? null : trimmed;
}

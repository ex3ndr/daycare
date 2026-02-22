/**
 * Trims assistant text at the first </run_python> closing tag.
 * Expects: text may contain arbitrary content before/after run_python tags.
 * Returns null when no trim is needed.
 */
export function agentMessageRunPythonTerminalTrim(text: string): string | null {
    const closeTagPattern = /<\/run_python\s*>/i;
    const match = closeTagPattern.exec(text);
    if (!match || match.index === undefined) {
        return null;
    }
    const trimEnd = match.index + match[0].length;
    const trimmed = text.slice(0, trimEnd);
    return trimmed === text ? null : trimmed;
}

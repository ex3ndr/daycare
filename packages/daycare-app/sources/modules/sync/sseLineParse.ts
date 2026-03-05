/**
 * Parses a single SSE line into a data payload string or null.
 * Handles `data: {...}` lines and ignores comments (`:keepalive`) and empty lines.
 *
 * Expects: line is a single line from an SSE stream (no trailing newline).
 */
export function sseLineParse(line: string): string | null {
    if (line.startsWith("data: ")) {
        return line.slice(6);
    }
    if (line.startsWith("data:")) {
        return line.slice(5);
    }
    // Comments (`:keepalive`), empty lines, event/id fields — ignored
    return null;
}

/**
 * Extracts complete SSE data payloads from a text buffer.
 * SSE events are delimited by double newlines. Handles partial chunks
 * by returning the remaining incomplete buffer.
 *
 * Returns: [parsedDataStrings, remainingBuffer]
 */
export function sseBufferParse(buffer: string): [string[], string] {
    const results: string[] = [];
    const blocks = buffer.split("\n\n");

    // Last element may be incomplete (no trailing \n\n)
    const remaining = blocks.pop() ?? "";

    for (const block of blocks) {
        const lines = block.split("\n");
        for (const line of lines) {
            const data = sseLineParse(line);
            if (data !== null) {
                results.push(data);
            }
        }
    }

    return [results, remaining];
}

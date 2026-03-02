export type MessageContextStatusOptions = {
    usedTokens: number | null;
    contextLimit: number;
};

/**
 * Builds a user-facing status message for the /context command.
 * Expects: contextLimit is a positive integer.
 */
export function messageContextStatus(options: MessageContextStatusOptions): string {
    const { usedTokens, contextLimit } = options;

    if (usedTokens === null) {
        return "📊 Context: no message history yet. Send a message first.";
    }

    const used = Math.max(0, Math.floor(usedTokens));
    const pct = contextLimit > 0 ? Math.min(100, Math.round((used / contextLimit) * 100)) : 0;
    const bar = progressBar(pct);
    const usedK = formatTokensK(used);
    const limitK = formatTokensK(contextLimit);

    const lines = [`📊 Context: ${usedK} / ${limitK} tokens (${pct}%)`, bar, "", "Estimate based on session messages."];

    return lines.join("\n");
}

function formatTokensK(n: number): string {
    if (n >= 1000) {
        return `${Math.round(n / 1000)}k`;
    }
    return String(n);
}

function progressBar(pct: number): string {
    const width = 20;
    const filled = Math.round((pct / 100) * width);
    const empty = width - filled;
    const bar = "█".repeat(filled) + "░".repeat(empty);
    return `[${bar}]`;
}

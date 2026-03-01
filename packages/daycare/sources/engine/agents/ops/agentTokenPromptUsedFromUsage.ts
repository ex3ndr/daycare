import type { AgentTokenEntry } from "./agentTypes.js";

/**
 * Returns prompt tokens only when they came from provider-reported usage.
 * Expects: tokens are from agent state/history; legacy entries may omit `source`.
 */
export function agentTokenPromptUsedFromUsage(tokens: AgentTokenEntry | null): number | null {
    if (!tokens) {
        return null;
    }
    if (tokens.source === "estimate") {
        return null;
    }

    // Legacy entries may not include `source`; cached prompt tokens indicate provider usage.
    if (tokens.source !== "usage" && tokens.size.cacheRead <= 0 && tokens.size.cacheWrite <= 0) {
        return null;
    }

    const used = tokens.size.input + tokens.size.cacheRead + tokens.size.cacheWrite;
    if (!Number.isFinite(used) || used <= 0) {
        return null;
    }
    return Math.floor(used);
}

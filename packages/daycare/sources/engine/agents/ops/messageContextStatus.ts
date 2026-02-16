import type { AgentTokenEntry } from "./agentTypes.js";

export type MessageContextStatusOptions = {
  tokens: AgentTokenEntry | null;
  contextLimit: number;
};

/**
 * Builds a user-facing status message for the /context command.
 * Expects: contextLimit is a positive integer.
 */
export function messageContextStatus(options: MessageContextStatusOptions): string {
  const { tokens, contextLimit } = options;

  if (!tokens) {
    return "📊 Context: no token data yet. Send a message first.";
  }

  const { size, provider, model } = tokens;
  // Context window usage = all prompt tokens (input + cached)
  const used = size.input + size.cacheRead + size.cacheWrite;
  const pct = contextLimit > 0 ? Math.min(100, Math.round((used / contextLimit) * 100)) : 0;
  const bar = progressBar(pct);
  const usedK = formatTokensK(used);
  const limitK = formatTokensK(contextLimit);

  const lines = [
    `📊 Context: ${usedK} / ${limitK} tokens (${pct}%)`,
    bar,
    "",
    `Provider: ${provider}/${model}`,
    `Input: ${size.input.toLocaleString()}  Output: ${size.output.toLocaleString()}`,
    `Cache read: ${size.cacheRead.toLocaleString()}  Cache write: ${size.cacheWrite.toLocaleString()}`
  ];

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

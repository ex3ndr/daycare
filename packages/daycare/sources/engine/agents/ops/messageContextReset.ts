/**
 * Formats user-facing messages for context reset events.
 * Pure function — no side effects.
 */

export type MessageContextResetKind = "compaction" | "manual" | "overflow";

export type MessageContextResetOptions = {
  kind: MessageContextResetKind;
  estimatedTokens?: number;
};

/**
 * Builds a user-facing notification for context reset events.
 * Expects: estimatedTokens >= 0 when provided.
 */
export function messageContextReset(options: MessageContextResetOptions): string {
  switch (options.kind) {
    case "compaction":
      return "⏳ Tidying up our conversation — back in a moment!";
    case "manual":
      return "🔄 Fresh start! How can I help?";
    case "overflow": {
      const lengthHint = describeConversationLength(options.estimatedTokens ?? 0);
      return `⚠️ Our conversation got ${lengthHint}, so I had to start fresh. Could you repeat your last message?`;
    }
  }
}

/**
 * Returns a human-friendly description of conversation length based on token count.
 */
function describeConversationLength(tokens: number): string {
  if (tokens >= 150_000) {
    return "really long";
  }
  if (tokens >= 100_000) {
    return "quite long";
  }
  if (tokens >= 50_000) {
    return "a bit too long";
  }
  return "too long";
}
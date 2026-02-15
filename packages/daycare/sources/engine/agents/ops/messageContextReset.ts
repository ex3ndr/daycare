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
      return "⏳ Compacting session context. I'll continue shortly.";
    case "manual":
      return "🔄 Session reset.";
    case "overflow": {
      const tokens = options.estimatedTokens ?? 0;
      const tokensPart = tokens > 0
        ? ` (~${Math.round(tokens / 1000)}k tokens)`
        : "";
      return `⚠️ Session reset — context overflow${tokensPart}. Please resend your last message.`;
    }
  }
}

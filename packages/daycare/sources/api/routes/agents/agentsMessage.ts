import type { Context } from "@/types";

export type AgentsMessageInput = {
    ctx: Context;
    agentId: string;
    text: string;
    agentPost: (
        ctx: Context,
        target: { agentId: string },
        item: { type: "message"; message: { text: string; files: [] }; context: Record<string, never> }
    ) => Promise<void>;
};

export type AgentsMessageResult =
    | {
          ok: true;
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Sends a plain text message to an agent inbox.
 * Expects: agentId and text are non-empty strings.
 */
export async function agentsMessage(input: AgentsMessageInput): Promise<AgentsMessageResult> {
    const agentId = input.agentId.trim();
    if (!agentId) {
        return { ok: false, error: "agentId is required." };
    }

    const text = input.text.trim();
    if (!text) {
        return { ok: false, error: "text is required." };
    }

    try {
        await input.agentPost(
            input.ctx,
            { agentId },
            {
                type: "message",
                message: {
                    text,
                    files: []
                },
                context: {}
            }
        );
        return { ok: true };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to send message.";
        return { ok: false, error: message };
    }
}

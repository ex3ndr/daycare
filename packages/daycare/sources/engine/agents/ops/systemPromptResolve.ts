import type { SystemPromptDbRecord } from "../../../storage/databaseTypes.js";
import type { Storage } from "../../../storage/storage.js";
import { userStateDetect } from "./userStateDetect.js";

export type ResolvedSystemPrompts = {
    /** Prompt sections to append to the system prompt. */
    systemPromptSections: string[];
    /** Prompt to prepend to the user's first message text. Null if not applicable. */
    firstMessagePrompt: string | null;
};

/**
 * Resolves applicable system prompts for a user based on scope, user state, and message position.
 *
 * Fetches all enabled prompts (global + per-user), detects user state,
 * filters by condition, and separates system vs first-message prompts.
 *
 * Expects: userId exists in storage; isFirstMessage indicates whether this is the first message in the agent's session.
 */
export async function systemPromptResolve(
    storage: Storage,
    userId: string,
    isFirstMessage: boolean
): Promise<ResolvedSystemPrompts> {
    const prompts = await storage.systemPrompts.findEnabled(userId);
    if (prompts.length === 0) {
        return { systemPromptSections: [], firstMessagePrompt: null };
    }

    const userState = await userStateDetect(storage, userId);

    const applicable = prompts.filter((prompt) => promptConditionMatches(prompt, userState));

    const systemPromptSections: string[] = [];
    const firstMessageParts: string[] = [];

    for (const prompt of applicable) {
        if (prompt.kind === "system") {
            systemPromptSections.push(prompt.prompt);
        } else if (prompt.kind === "first_message" && isFirstMessage) {
            firstMessageParts.push(prompt.prompt);
        }
    }

    return {
        systemPromptSections,
        firstMessagePrompt: firstMessageParts.length > 0 ? firstMessageParts.join("\n") : null
    };
}

/** Returns true if the prompt's condition matches the current user state. */
function promptConditionMatches(prompt: SystemPromptDbRecord, userState: string): boolean {
    if (prompt.condition === null) {
        return true;
    }
    return prompt.condition === userState;
}

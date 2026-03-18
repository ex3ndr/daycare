import { Context } from "./Context.js";

/**
 * Creates an agent-scoped context with both user and agent identity.
 * Expects: userId and agentId are already validated by caller.
 */
export function contextForAgent(input: { userId: string; personUserId?: string; agentId: string }): Context {
    return new Context({ userId: input.userId, personUserId: input.personUserId, agentId: input.agentId });
}

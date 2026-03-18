import { Context } from "./Context.js";

/**
 * Creates a user-scoped context without an agent identity.
 * Expects: userId is already validated by caller.
 */
export function contextForUser(input: { userId: string; personUserId?: string }): Context {
    return new Context({ userId: input.userId, personUserId: input.personUserId });
}

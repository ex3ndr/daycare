const contextAgentIds = new WeakMap<Context, string | null>();

/**
 * Readonly context carrying agent and user identity.
 * Passed to tools, signals, and scheduled tasks for user-scoped operations.
 */
export class Context {
    readonly userId: string;
    readonly hasAgentId?: boolean;

    constructor(input: { userId: string; agentId?: string });
    constructor(agentId: string, userId: string);
    constructor(inputOrAgentId: { userId: string; agentId?: string } | string, userId?: string) {
        const normalized =
            typeof inputOrAgentId === "string" ? { userId: userId ?? "", agentId: inputOrAgentId } : inputOrAgentId;
        this.userId = normalized.userId;
        contextAgentIds.set(this, normalized.agentId ?? null);
        Object.defineProperty(this, "hasAgentId", {
            configurable: false,
            enumerable: true,
            get: () => {
                return contextAgentIds.get(this) !== null;
            }
        });
    }

    get agentId(): string {
        const agentId = contextAgentIds.get(this);
        if (!agentId) {
            throw new Error("Context has no agentId");
        }
        return agentId;
    }
}

/**
 * Creates a user-scoped context without an agent identity.
 * Expects: userId is already validated by caller.
 */
export function contextForUser(input: { userId: string }): Context {
    return new Context({ userId: input.userId });
}

/**
 * Creates an agent-scoped context with both user and agent identity.
 * Expects: userId and agentId are already validated by caller.
 */
export function contextForAgent(input: { userId: string; agentId: string }): Context {
    return new Context({ userId: input.userId, agentId: input.agentId });
}

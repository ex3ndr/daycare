type ContextLike = {
    userId: string;
    hasAgentId?: boolean;
    agentId?: string;
};

/**
 * Resolves a stable worker key from execution context identity.
 * Expects: ctx.userId is always available; agentId may be absent for user-scoped contexts.
 */
export function rlmWorkerKeyResolve(ctx: ContextLike): string {
    const userId = ctx.userId.trim();
    const agentId = agentIdRead(ctx);
    if (agentId) {
        return `${userId}:${agentId}`;
    }
    return `${userId}:_user`;
}

function agentIdRead(ctx: ContextLike): string | null {
    if (ctx.hasAgentId === false) {
        return null;
    }
    try {
        const candidate = ctx.agentId;
        if (typeof candidate !== "string") {
            return null;
        }
        const normalized = candidate.trim();
        return normalized.length > 0 ? normalized : null;
    } catch {
        return null;
    }
}

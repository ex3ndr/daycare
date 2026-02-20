/**
 * Readonly context carrying agent and user identity.
 * Passed to tools, signals, and scheduled tasks for user-scoped operations.
 */
export class AgentContext {
    readonly agentId: string;
    readonly userId: string;

    constructor(agentId: string, userId: string) {
        this.agentId = agentId;
        this.userId = userId;
    }
}

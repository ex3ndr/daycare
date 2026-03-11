import type { AgentCreationConfig, MessageContext } from "@/types";
import type { AgentSystem } from "../agents/agentSystem.js";
import { contextForUser } from "../agents/context.js";
import type { AgentPostTarget } from "../agents/ops/agentTypes.js";

const TASK_EXECUTION_SOURCES = ["cron", "webhook", "manual"] as const;

export type TaskExecutionSource = (typeof TASK_EXECUTION_SOURCES)[number];

export type TaskExecutionDispatchInput = {
    userId: string;
    taskId: string;
    target: AgentPostTarget;
    text: string;
    source: TaskExecutionSource;
    taskVersion?: number | null;
    origin?: string;
    parameters?: Record<string, unknown>;
    context?: MessageContext;
    sync?: boolean;
    creationConfig?: AgentCreationConfig;
};

export type TaskExecutionRunnerOptions = {
    agentSystem: AgentSystem;
};

export type TaskExecutionRunnerResult = Awaited<ReturnType<AgentSystem["taskExecuteAndAwait"]>> & {
    promptSent: boolean;
    promptText: string | null;
};

/**
 * Runs task code directly and forwards any resulting prompt text back into the target agent.
 * Expects: task parameters are already validated by the caller.
 */
export class TaskExecutionRunner {
    private readonly agentSystem: AgentSystem;

    constructor(options: TaskExecutionRunnerOptions) {
        this.agentSystem = options.agentSystem;
    }

    async runAndAwait(input: TaskExecutionDispatchInput): Promise<TaskExecutionRunnerResult> {
        const prepared = taskExecutionPrepare(input);
        const ctx = contextForUser({ userId: prepared.userId });
        const target = await this.targetForDispatchResolve(prepared, ctx);
        const result = await this.agentSystem.taskExecuteAndAwait(ctx, target.agentId, {
            taskId: prepared.taskId,
            taskVersion: prepared.taskVersion,
            source: prepared.origin,
            messageContext: prepared.context,
            inputValues: prepared.parameters
        });
        const promptText =
            prepared.sync || result.skipTurn ? null : taskExecutionPromptTextResolve(prepared, result.output);
        if (!promptText) {
            return { ...result, promptSent: false, promptText: null };
        }
        await this.agentSystem.post(
            ctx,
            { agentId: target.agentId },
            {
                type: "system_message",
                text: promptText,
                origin: prepared.origin,
                ...(prepared.context ? { context: prepared.context } : {})
            }
        );
        return { ...result, promptSent: true, promptText };
    }

    /** Resolves dispatch target to agentId when callers provide a path target. */
    private async targetForDispatchResolve(
        input: ReturnType<typeof taskExecutionPrepare>,
        ctx: ReturnType<typeof contextForUser>
    ): Promise<{ agentId: string }> {
        if ("agentId" in input.target) {
            return input.target;
        }
        const agentId = await this.agentSystem.agentIdForTarget(ctx, input.target, input.creationConfig);
        return { agentId };
    }
}

function taskExecutionPrepare(input: TaskExecutionDispatchInput): {
    userId: string;
    target: AgentPostTarget;
    text: string;
    source: TaskExecutionSource;
    origin: string;
    taskId: string;
    taskVersion: number | null;
    parameters?: Record<string, unknown>;
    context?: MessageContext;
    sync: boolean;
    creationConfig?: AgentCreationConfig;
} {
    const userId = input.userId.trim();
    if (!userId) {
        throw new Error("Task execution userId is required.");
    }
    const taskId = input.taskId.trim();
    if (!taskId) {
        throw new Error("Task execution taskId is required.");
    }
    const taskVersion =
        typeof input.taskVersion === "number" && Number.isFinite(input.taskVersion) && input.taskVersion > 0
            ? Math.trunc(input.taskVersion)
            : null;
    return {
        userId,
        target: input.target,
        text: input.text,
        source: input.source,
        origin: input.origin?.trim() || input.source,
        taskId,
        taskVersion,
        parameters: input.parameters,
        context: input.context,
        sync: input.sync === true,
        creationConfig: input.creationConfig
    };
}

function taskExecutionPromptTextResolve(input: ReturnType<typeof taskExecutionPrepare>, output: string): string | null {
    const combined = [input.text, output].filter((value) => value.trim().length > 0).join("\n\n");
    return combined.trim().length > 0 ? combined : null;
}

import type { ToolExecutionContext } from "@/types";
import {
    CONTEXT_COMPACT_TOOL_NAME,
    CONTEXT_RESET_TOOL_NAME,
    JSON_PARSE_TOOL_NAME,
    JSON_STRINGIFY_TOOL_NAME,
    STEP_TOOL_NAME
} from "./rlmConstants.js";

type RuntimeExecuteHandled = {
    handled: true;
    value: unknown;
};

type RuntimeExecuteNotHandled = {
    handled: false;
};

export type RlmRuntimeToolExecuteResult = RuntimeExecuteHandled | RuntimeExecuteNotHandled;

/**
 * Executes built-in RLM runtime helpers that do not go through ToolResolver.
 * Expects: args already passed through rlmArgsConvert using matching runtime tool schemas.
 */
export async function rlmRuntimeToolExecute(
    toolName: string,
    args: unknown,
    context: ToolExecutionContext
): Promise<RlmRuntimeToolExecuteResult> {
    if (toolName === JSON_PARSE_TOOL_NAME) {
        const payload = argsRecordResolve(args);
        const text = argsStringResolve(payload, "text");
        return {
            handled: true,
            value: {
                value: JSON.parse(text)
            }
        };
    }

    if (toolName === JSON_STRINGIFY_TOOL_NAME) {
        const payload = argsRecordResolve(args);
        const pretty = argsBooleanResolve(payload, "pretty");
        const serialized = JSON.stringify(payload.value, null, pretty ? 2 : undefined);
        if (typeof serialized !== "string") {
            throw new Error("json_stringify could not serialize the provided value.");
        }
        return {
            handled: true,
            value: {
                value: serialized
            }
        };
    }

    if (toolName === STEP_TOOL_NAME) {
        const payload = argsRecordResolve(args);
        const prompt = argsStringResolve(payload, "prompt").trim();
        if (prompt.length === 0) {
            throw new Error("prompt must be a non-empty string.");
        }
        taskExecutionAssert(context, "step");
        const result = await context.agentSystem.postAndAwait(
            context.ctx,
            { agentId: context.ctx.agentId },
            {
                type: "system_message",
                text: prompt,
                origin: context.source,
                context: context.messageContext
            }
        );
        if (result.type !== "system_message") {
            throw new Error(`step() expected system_message result, got ${result.type}.`);
        }
        if (result.responseError) {
            throw new Error(result.executionErrorText ?? "step() target agent execution failed.");
        }
        return {
            handled: true,
            value: null
        };
    }

    if (toolName === CONTEXT_RESET_TOOL_NAME) {
        const payload = argsRecordResolve(args);
        const message = argsOptionalStringResolve(payload, "message")?.trim();
        if (payload.message !== undefined && !message) {
            throw new Error("message must be a non-empty string when provided.");
        }
        taskExecutionAssert(context, CONTEXT_RESET_TOOL_NAME);
        const result = await context.agentSystem.postAndAwait(
            context.ctx,
            { agentId: context.ctx.agentId },
            message ? { type: "reset", message } : { type: "reset" }
        );
        if (result.type !== "reset") {
            throw new Error(`context_reset() expected reset result, got ${result.type}.`);
        }
        if (!result.ok) {
            throw new Error("context_reset() target agent reset failed.");
        }
        return {
            handled: true,
            value: null
        };
    }

    if (toolName === CONTEXT_COMPACT_TOOL_NAME) {
        argsRecordResolve(args);
        taskExecutionAssert(context, CONTEXT_COMPACT_TOOL_NAME);
        const result = await context.agentSystem.postAndAwait(
            context.ctx,
            { agentId: context.ctx.agentId },
            {
                type: "compact"
            }
        );
        if (result.type !== "compact") {
            throw new Error(`context_compact() expected compact result, got ${result.type}.`);
        }
        if (!result.ok) {
            throw new Error("context_compact() target agent compaction failed.");
        }
        return {
            handled: true,
            value: null
        };
    }

    return { handled: false };
}

function taskExecutionAssert(context: ToolExecutionContext, toolName: string): void {
    if (!context.taskExecution) {
        throw new Error(`${toolName}() is allowed only in tasks.`);
    }
}

function argsRecordResolve(args: unknown): Record<string, unknown> {
    if (typeof args !== "object" || args === null || Array.isArray(args)) {
        throw new Error("Runtime operation arguments must be an object.");
    }
    return args as Record<string, unknown>;
}

function argsStringResolve(args: Record<string, unknown>, key: string): string {
    const value = args[key];
    if (typeof value !== "string") {
        throw new Error(`${key} must be a string.`);
    }
    return value;
}

function argsBooleanResolve(args: Record<string, unknown>, key: string): boolean {
    const value = args[key];
    if (typeof value === "undefined") {
        return false;
    }
    if (typeof value !== "boolean") {
        throw new Error(`${key} must be a boolean when provided.`);
    }
    return value;
}

function argsOptionalStringResolve(args: Record<string, unknown>, key: string): string | undefined {
    const value = args[key];
    if (typeof value === "undefined") {
        return undefined;
    }
    if (typeof value !== "string") {
        throw new Error(`${key} must be a string when provided.`);
    }
    return value;
}

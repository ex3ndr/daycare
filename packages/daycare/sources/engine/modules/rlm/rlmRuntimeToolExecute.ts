import { JSON_PARSE_TOOL_NAME, JSON_STRINGIFY_TOOL_NAME } from "./rlmConstants.js";

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
export function rlmRuntimeToolExecute(toolName: string, args: unknown): RlmRuntimeToolExecuteResult {
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

    return { handled: false };
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

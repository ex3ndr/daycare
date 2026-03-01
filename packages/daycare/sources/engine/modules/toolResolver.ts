import type { Tool, ToolCall, ToolResultMessage } from "@mariozechner/pi-ai";
import { validateToolCall } from "@mariozechner/pi-ai";
import type { TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import type { ToolDefinition, ToolExecutionContext, ToolExecutionResult, ToolVisibilityContext } from "@/types";
import { getLogger } from "../../log.js";
import { MONTY_RESPONSE_SCHEMA_KEY } from "./monty/montyResponseSchemaKey.js";
import { toolResultTruncate } from "./tools/toolResultTruncate.js";
import { toolExecutionResultOutcome } from "./tools/toolReturnOutcome.js";

type RegisteredTool = ToolDefinition & { pluginId: string };

const logger = getLogger("engine.modules");

export class ToolResolver {
    private tools = new Map<string, RegisteredTool>();

    register(pluginId: string, definition: ToolDefinition): void {
        toolResultSchemaValidate(definition.tool.name, definition.returns.schema);
        logger.debug(`register: Registering tool pluginId=${pluginId} toolName=${definition.tool.name}`);
        this.tools.set(definition.tool.name, { ...definition, pluginId });
        logger.debug(`register: Tool registered totalTools=${this.tools.size}`);
    }

    unregister(name: string): void {
        logger.debug(`unregister: Unregistering tool toolName=${name}`);
        this.tools.delete(name);
    }

    unregisterByPlugin(pluginId: string): void {
        logger.debug(`unregister: Unregistering tools by plugin pluginId=${pluginId}`);
        let count = 0;
        for (const [name, entry] of this.tools.entries()) {
            if (entry.pluginId === pluginId) {
                this.tools.delete(name);
                count++;
            }
        }
        logger.debug(`unregister: Tools unregistered by plugin pluginId=${pluginId} unregisteredCount=${count}`);
    }

    listTools(): Tool[] {
        return Array.from(this.tools.values()).map((entry) => toolExpose(entry));
    }

    listToolsForAgent(context: ToolVisibilityContext): Tool[] {
        return Array.from(this.tools.values())
            .filter((entry) => toolVisibleByDefault(entry, context))
            .map((entry) => toolExpose(entry));
    }

    async execute(toolCall: ToolCall, context: ToolExecutionContext): Promise<ToolExecutionResult> {
        const argsPreview = JSON.stringify(toolCall.arguments).slice(0, 100);
        logger.debug(
            `execute: execute() called toolName=${toolCall.name} toolCallId=${toolCall.id} argsPreview=${argsPreview}`
        );
        if (context.abortSignal?.aborted) {
            throw abortErrorBuild();
        }
        const entry = this.tools.get(toolCall.name);
        if (!entry) {
            const availableTools = Array.from(this.tools.keys()).join(",");
            logger.debug(`event: Tool not found toolName=${toolCall.name} availableTools=${availableTools}`);
            return buildToolError(toolCall, `Unknown tool: ${toolCall.name}`);
        }
        if (context.allowedToolNames && !context.allowedToolNames.has(toolCall.name)) {
            logger.info({ tool: toolCall.name }, "deny: Tool execution blocked by execution allowlist");
            return buildToolError(toolCall, `Tool "${toolCall.name}" is not allowed for this agent.`);
        }

        try {
            logger.debug(`event: Validating tool call arguments toolName=${toolCall.name}`);
            const args = validateToolCall([entry.tool], toolCall);
            logger.debug(`execute: Arguments validated, executing tool toolName=${toolCall.name}`);
            const startTime = Date.now();
            const result = await promiseAbortRace(entry.execute(args, context, toolCall), context.abortSignal);
            const duration = Date.now() - startTime;
            if (!Value.Check(entry.returns.schema, result.typedResult)) {
                throw new Error(`Tool "${toolCall.name}" returned data that does not match its return schema.`);
            }
            if (!toolMessageHasText(result.toolMessage)) {
                const text = entry.returns.toLLMText(result.typedResult).trim();
                if (text.length > 0) {
                    result.toolMessage.content = [
                        ...toolMessageContentNormalize(result.toolMessage),
                        { type: "text", text }
                    ];
                }
            }
            logger.debug(
                `event: Tool execution completed toolName=${toolCall.name} durationMs=${duration} isError=${result.toolMessage.isError}`
            );
            if (!result.toolMessage.toolCallId) {
                result.toolMessage.toolCallId = toolCall.id;
            }
            if (!result.toolMessage.toolName) {
                result.toolMessage.toolName = toolCall.name;
            }
            // Auto-attach deferred handler from definition when tool returned a deferred payload
            if (result.deferredPayload !== undefined && entry.executeDeferred) {
                result.deferredHandler = entry.executeDeferred;
            }
            return toolResultTruncate(result);
        } catch (error) {
            if (abortErrorIs(error, context.abortSignal)) {
                logger.info({ tool: toolCall.name }, "event: Tool execution aborted");
                throw error;
            }
            const message = error instanceof Error ? error.message : "Tool execution failed.";
            logger.debug(`error: Tool execution threw error toolName=${toolCall.name} error=${String(error)}`);
            logger.warn({ tool: toolCall.name, error }, "error: Tool execution failed");
            return buildToolError(toolCall, message);
        }
    }
}

export type ToolResolverApi = Pick<ToolResolver, "listTools" | "listToolsForAgent" | "execute">;

function buildToolError(toolCall: ToolCall, text: string): ToolExecutionResult {
    const toolMessage: ToolResultMessage = {
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: "text", text }],
        isError: true,
        timestamp: Date.now()
    };
    return toolExecutionResultOutcome(toolMessage);
}

function toolExpose(entry: RegisteredTool): Tool {
    const tool = { ...entry.tool } as Tool;
    Object.defineProperty(tool, MONTY_RESPONSE_SCHEMA_KEY, {
        value: entry.returns.schema,
        enumerable: false,
        configurable: false
    });
    return tool;
}

function toolVisibleByDefault(entry: RegisteredTool, context: ToolVisibilityContext): boolean {
    if (!entry.visibleByDefault) {
        return true;
    }
    try {
        return entry.visibleByDefault(context);
    } catch (error) {
        logger.warn(
            { tool: entry.tool.name, descriptorType: context.descriptor.type, error },
            "error: Tool visibleByDefault callback failed"
        );
        return false;
    }
}

function toolResultSchemaValidate(toolName: string, schema: TSchema): void {
    if (!schemaObjectIs(schema) || schema.type !== "object") {
        throw new Error(`Tool "${toolName}" return schema must be an object schema.`);
    }
    if (!toolResultObjectSchemaIs(schema)) {
        throw new Error(
            `Tool "${toolName}" return schema supports primitives, any, nested objects, arrays, and unions only; additionalProperties must not be true.`
        );
    }
}

/**
 * Validates return-schema fragments recursively.
 * Expects: schema fragment follows JSON-schema-like TypeBox output.
 */
function toolResultPropertySchemaIs(schema: unknown): boolean {
    if (!schemaObjectIs(schema)) {
        return false;
    }
    if (schemaUnionIs(schema)) {
        return true;
    }
    if (schemaAnyIs(schema)) {
        return true;
    }
    if (schemaPrimitiveIs(schema)) {
        return true;
    }
    if (schema.type === "object") {
        return toolResultObjectSchemaIs(schema);
    }
    if (schema.type === "array") {
        const items = schema.items;
        if (Array.isArray(items)) {
            return items.length > 0 && items.every((entry) => toolResultPropertySchemaIs(entry));
        }
        return toolResultPropertySchemaIs(items);
    }
    return false;
}

function toolResultObjectSchemaIs(schema: Record<string, unknown>): boolean {
    const properties = schemaPropertyRecordGet(schema.properties);
    if (Object.values(properties).some((entry) => !toolResultPropertySchemaIs(entry))) {
        return false;
    }
    if (!("additionalProperties" in schema) || schema.additionalProperties === undefined) {
        return true;
    }
    const additionalProperties = schema.additionalProperties;
    if (typeof additionalProperties === "boolean") {
        return additionalProperties === false;
    }
    return toolResultPropertySchemaIs(additionalProperties);
}

function schemaAnyIs(schema: Record<string, unknown>): boolean {
    if (schema.type === "any") {
        return true;
    }
    const symbolSchema = schema as Record<PropertyKey, unknown>;
    return Object.getOwnPropertySymbols(schema).some((symbol) => symbolSchema[symbol] === "Any");
}

function schemaUnionIs(schema: Record<string, unknown>): boolean {
    for (const key of ["anyOf", "oneOf", "allOf"] as const) {
        if (!(key in schema)) {
            continue;
        }
        const variants = schema[key];
        if (!Array.isArray(variants) || variants.length === 0) {
            return false;
        }
        return variants.every((variant) => toolResultPropertySchemaIs(variant));
    }
    return false;
}

function schemaPrimitiveIs(schema: { type?: unknown }): boolean {
    return (
        schema.type === "string" ||
        schema.type === "number" ||
        schema.type === "integer" ||
        schema.type === "boolean" ||
        schema.type === "null"
    );
}

function schemaObjectIs(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function schemaPropertyRecordGet(value: unknown): Record<string, unknown> {
    if (!schemaObjectIs(value)) {
        return {};
    }
    return value;
}

function toolMessageHasText(message: ToolResultMessage): boolean {
    return toolMessageContentNormalize(message).some(
        (part) => part.type === "text" && "text" in part && typeof part.text === "string" && part.text.trim().length > 0
    );
}

function toolMessageContentNormalize(message: ToolResultMessage): ToolResultMessage["content"] {
    return Array.isArray(message.content) ? message.content : [];
}

function promiseAbortRace<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
    if (!signal) {
        return promise;
    }
    if (signal.aborted) {
        return Promise.reject(abortErrorBuild());
    }

    return new Promise<T>((resolve, reject) => {
        const onAbort = () => {
            reject(abortErrorBuild());
        };
        signal.addEventListener("abort", onAbort, { once: true });

        promise.then(resolve, reject).finally(() => {
            signal.removeEventListener("abort", onAbort);
        });
    });
}

function abortErrorIs(error: unknown, signal?: AbortSignal): boolean {
    if (signal?.aborted) {
        return true;
    }
    if (error instanceof Error && error.name === "AbortError") {
        return true;
    }
    if (typeof error === "object" && error !== null) {
        const name = (error as { name?: unknown }).name;
        if (typeof name === "string" && name === "AbortError") {
            return true;
        }
    }
    return false;
}

function abortErrorBuild(): Error {
    const error = new Error("Operation aborted.");
    error.name = "AbortError";
    return error;
}

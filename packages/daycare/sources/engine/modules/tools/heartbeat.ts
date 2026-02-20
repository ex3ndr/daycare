import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import { execGateNormalize } from "../../scheduling/execGateNormalize.js";

const envSchema = Type.Record(
    Type.String({ minLength: 1 }),
    Type.Union([Type.String(), Type.Number(), Type.Boolean()])
);

const runSchema = Type.Object(
    {
        ids: Type.Optional(Type.Array(Type.String({ minLength: 1 })))
    },
    { additionalProperties: false }
);

const addSchema = Type.Object(
    {
        id: Type.Optional(Type.String({ minLength: 1 })),
        title: Type.String({ minLength: 1 }),
        prompt: Type.String({ minLength: 1 }),
        gate: Type.Optional(
            Type.Object(
                {
                    command: Type.String({ minLength: 1 }),
                    cwd: Type.Optional(Type.String({ minLength: 1 })),
                    timeoutMs: Type.Optional(Type.Number({ minimum: 100, maximum: 300_000 })),
                    env: Type.Optional(envSchema),
                    home: Type.Optional(Type.String({ minLength: 1 })),
                    permissions: Type.Optional(Type.Array(Type.String({ minLength: 1 }), { minItems: 1 })),
                    packageManagers: Type.Optional(
                        Type.Array(
                            Type.Union([
                                Type.Literal("dart"),
                                Type.Literal("dotnet"),
                                Type.Literal("go"),
                                Type.Literal("java"),
                                Type.Literal("node"),
                                Type.Literal("php"),
                                Type.Literal("python"),
                                Type.Literal("ruby"),
                                Type.Literal("rust")
                            ]),
                            { minItems: 1 }
                        )
                    ),
                    allowedDomains: Type.Optional(Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }))
                },
                { additionalProperties: false }
            )
        ),
        overwrite: Type.Optional(Type.Boolean())
    },
    { additionalProperties: false }
);

const removeSchema = Type.Object(
    {
        id: Type.String({ minLength: 1 })
    },
    { additionalProperties: false }
);

type RunHeartbeatArgs = Static<typeof runSchema>;
type AddHeartbeatArgs = Static<typeof addSchema>;
type RemoveHeartbeatArgs = Static<typeof removeSchema>;

const heartbeatRunResultSchema = Type.Object(
    {
        summary: Type.String(),
        ran: Type.Number()
    },
    { additionalProperties: false }
);

type HeartbeatRunResult = Static<typeof heartbeatRunResultSchema>;

const heartbeatRunReturns: ToolResultContract<HeartbeatRunResult> = {
    schema: heartbeatRunResultSchema,
    toLLMText: (result) => result.summary
};

const heartbeatAddResultSchema = Type.Object(
    {
        summary: Type.String(),
        taskId: Type.String(),
        title: Type.String()
    },
    { additionalProperties: false }
);

type HeartbeatAddResult = Static<typeof heartbeatAddResultSchema>;

const heartbeatAddReturns: ToolResultContract<HeartbeatAddResult> = {
    schema: heartbeatAddResultSchema,
    toLLMText: (result) => result.summary
};

const heartbeatRemoveResultSchema = Type.Object(
    {
        summary: Type.String(),
        taskId: Type.String(),
        removed: Type.Boolean()
    },
    { additionalProperties: false }
);

type HeartbeatRemoveResult = Static<typeof heartbeatRemoveResultSchema>;

const heartbeatRemoveReturns: ToolResultContract<HeartbeatRemoveResult> = {
    schema: heartbeatRemoveResultSchema,
    toLLMText: (result) => result.summary
};

export function buildHeartbeatRunTool(): ToolDefinition {
    return {
        tool: {
            name: "heartbeat_run",
            description: "Run heartbeat tasks immediately as a single batch instead of waiting for the next interval.",
            parameters: runSchema
        },
        returns: heartbeatRunReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as RunHeartbeatArgs;
            const result = await toolContext.heartbeats.runNow({ ids: payload.ids });

            const summary =
                result.ran > 0
                    ? `Heartbeat ran ${result.ran} task(s): ${result.taskIds.join(", ")}.`
                    : "No heartbeat tasks ran.";
            const toolMessage: ToolResultMessage = {
                role: "toolResult",
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                content: [
                    {
                        type: "text",
                        text: summary
                    }
                ],
                isError: false,
                timestamp: Date.now()
            };

            return {
                toolMessage,
                typedResult: {
                    summary,
                    ran: result.ran
                }
            };
        }
    };
}

export function buildHeartbeatAddTool(): ToolDefinition {
    return {
        tool: {
            name: "heartbeat_add",
            description: "Create or update a heartbeat prompt stored in config/heartbeat (optional gate).",
            parameters: addSchema
        },
        returns: heartbeatAddReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as AddHeartbeatArgs;

            const gate = execGateNormalize(payload.gate);
            const result = await toolContext.heartbeats.addTask({
                id: payload.id,
                title: payload.title,
                prompt: payload.prompt,
                gate,
                overwrite: payload.overwrite
            });

            const summary = `Heartbeat saved: ${result.id} (${result.title}).`;
            const toolMessage: ToolResultMessage = {
                role: "toolResult",
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                content: [
                    {
                        type: "text",
                        text: summary
                    }
                ],
                details: {
                    id: result.id,
                    title: result.title,
                    filePath: result.filePath,
                    gate: result.gate ?? null
                },
                isError: false,
                timestamp: Date.now()
            };

            return {
                toolMessage,
                typedResult: {
                    summary,
                    taskId: result.id,
                    title: result.title
                }
            };
        }
    };
}

export function buildHeartbeatRemoveTool(): ToolDefinition {
    return {
        tool: {
            name: "heartbeat_remove",
            description: "Delete a heartbeat task.",
            parameters: removeSchema
        },
        returns: heartbeatRemoveReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as RemoveHeartbeatArgs;
            const removed = await toolContext.heartbeats.removeTask(payload.id);

            const summary = removed ? `Removed heartbeat ${payload.id}.` : `Heartbeat not found: ${payload.id}.`;
            const toolMessage: ToolResultMessage = {
                role: "toolResult",
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                content: [
                    {
                        type: "text",
                        text: summary
                    }
                ],
                details: { id: payload.id, removed },
                isError: false,
                timestamp: Date.now()
            };

            return {
                toolMessage,
                typedResult: {
                    summary,
                    taskId: payload.id,
                    removed
                }
            };
        }
    };
}

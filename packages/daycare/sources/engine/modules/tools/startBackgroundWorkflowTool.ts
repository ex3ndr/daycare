import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolExecutionContext, ToolResultContract } from "@/types";
import { taskIdIsSafe } from "../../../utils/taskIdIsSafe.js";
import { agentPathSub } from "../../agents/ops/agentPathBuild.js";
import { agentPathChildAllocate } from "../../agents/ops/agentPathChildAllocate.js";
import { rlmVerify } from "../rlm/rlmVerify.js";
import { taskParameterPreambleStubs } from "../tasks/taskParameterCodegen.js";
import { taskParameterInputsNormalize } from "../tasks/taskParameterInputsNormalize.js";
import type { TaskParameter } from "../tasks/taskParameterTypes.js";
import { taskParameterValidate } from "../tasks/taskParameterValidate.js";

const taskParameterSchema = Type.Object(
    {
        name: Type.String({ minLength: 1 }),
        type: Type.Union([
            Type.Literal("integer"),
            Type.Literal("float"),
            Type.Literal("string"),
            Type.Literal("boolean"),
            Type.Literal("any")
        ]),
        nullable: Type.Boolean()
    },
    { additionalProperties: false }
);

const schema = Type.Object(
    {
        code: Type.Optional(
            Type.String({
                minLength: 1,
                description:
                    "Inline Python code executed first in a fresh background subagent. Print/return text to " +
                    "wake the agent, or call tools and skip()."
            })
        ),
        taskId: Type.Optional(
            Type.String({
                minLength: 1,
                description: "Stored task id to execute first in a fresh background subagent."
            })
        ),
        taskVersion: Type.Optional(Type.Integer({ minimum: 1 })),
        name: Type.Optional(Type.String({ minLength: 1 })),
        parameters: Type.Optional(
            Type.Record(Type.String(), Type.Unknown(), {
                description: "Input values passed into the workflow code or task execution."
            })
        ),
        inputSchema: Type.Optional(
            Type.Array(taskParameterSchema, {
                description: "Typed input schema for inline code. Each input becomes a Python variable with type hints."
            })
        )
    },
    { additionalProperties: false }
);

type StartBackgroundWorkflowArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        targetAgentId: Type.String(),
        originAgentId: Type.String(),
        taskId: Type.Optional(Type.String())
    },
    { additionalProperties: false }
);

type StartBackgroundWorkflowResult = Static<typeof resultSchema>;

const returns: ToolResultContract<StartBackgroundWorkflowResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the start_background_workflow tool for code-first or task-first child execution.
 * Expects: exactly one of code or taskId is provided; task parameters must match the chosen workflow schema.
 */
export function startBackgroundWorkflowToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "start_background_workflow",
            description:
                "Start a fresh background subagent and execute inline code or a stored task before the agent continues.",
            parameters: schema
        },
        returns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as StartBackgroundWorkflowArgs;
            const code = payload.code?.trim() ?? "";
            const taskId = payload.taskId?.trim() ?? "";
            const requestedName = payload.name?.trim() ?? "";
            const mode = workflowModeResolve(code, taskId);

            if (mode === "code") {
                return startInlineWorkflow(payload, code, requestedName, toolContext, toolCall);
            }

            return startTaskWorkflow(payload, taskId, requestedName, toolContext, toolCall);
        }
    };
}

async function startInlineWorkflow(
    payload: StartBackgroundWorkflowArgs,
    code: string,
    requestedName: string,
    toolContext: ToolExecutionContext,
    toolCall: { id: string; name: string }
): Promise<Awaited<ReturnType<ToolDefinition["execute"]>>> {
    if (payload.taskVersion !== undefined) {
        throw new Error("taskVersion can only be used with taskId.");
    }
    if (payload.taskId !== undefined) {
        throw new Error("Provide either code or taskId, not both.");
    }

    const inputSchema = payload.inputSchema as TaskParameter[] | undefined;
    const parameterValues = (payload.parameters as Record<string, unknown> | undefined) ?? {};
    if (inputSchema?.length) {
        const error = taskParameterValidate(inputSchema, parameterValues);
        if (error) {
            throw new Error(error);
        }
    }

    const verifyContext = workflowVerifyContextBuild(toolContext, requestedName);
    const parameterPreamble = inputSchema?.length ? taskParameterPreambleStubs(inputSchema) : undefined;
    rlmVerify(code, verifyContext, parameterPreamble);

    const agentId = await workflowAgentCreate(toolContext, requestedName);
    await toolContext.agentSystem.post(
        toolContext.ctx,
        { agentId },
        {
            type: "system_message",
            text: "[workflow]\nmode: code",
            origin: "workflow",
            code,
            inputs: payload.parameters ?? undefined,
            inputSchemas: inputSchema ?? undefined,
            context: toolContext.messageContext
        }
    );

    const summary = requestedName
        ? `Background workflow started (${requestedName}): ${agentId}.`
        : `Background workflow started: ${agentId}.`;
    return workflowResultBuild(toolCall, toolContext.agent.id, agentId, summary);
}

async function startTaskWorkflow(
    payload: StartBackgroundWorkflowArgs,
    taskId: string,
    requestedName: string,
    toolContext: ToolExecutionContext,
    toolCall: { id: string; name: string }
): Promise<Awaited<ReturnType<ToolDefinition["execute"]>>> {
    if (payload.code !== undefined) {
        throw new Error("Provide either code or taskId, not both.");
    }
    if (payload.inputSchema !== undefined) {
        throw new Error("inputSchema is only supported with inline code workflows.");
    }

    const task = await workflowTaskResolve(toolContext, taskId, payload.taskVersion);
    let inputValues: Record<string, unknown> | undefined;
    if (payload.parameters && !task.parameters?.length) {
        throw new Error("Task has no parameter schema. Remove parameters or define a schema on the task.");
    }
    if (task.parameters?.length) {
        const values = (payload.parameters as Record<string, unknown> | undefined) ?? {};
        const error = taskParameterValidate(task.parameters, values);
        if (error) {
            throw new Error(error);
        }
        inputValues = taskParameterInputsNormalize(task.parameters, values);
    }

    const agentId = await workflowAgentCreate(toolContext, requestedName || task.title);
    toolContext.agentSystem.taskExecutions.dispatch({
        userId: task.userId,
        source: "manual",
        taskId: task.id,
        taskVersion: task.version ?? null,
        origin: "workflow",
        target: { agentId },
        text: ["[workflow]", `taskId: ${task.id}`, `taskTitle: ${task.title}`].join("\n"),
        parameters: inputValues ?? undefined,
        context: toolContext.messageContext
    });

    const summary = requestedName
        ? `Background workflow started from task ${task.id} (${requestedName}): ${agentId}.`
        : `Background workflow started from task ${task.id}: ${agentId}.`;
    return workflowResultBuild(toolCall, toolContext.agent.id, agentId, summary, task.id);
}

function workflowModeResolve(code: string, taskId: string): "code" | "task" {
    const hasCode = code.length > 0;
    const hasTaskId = taskId.length > 0;
    if (hasCode === hasTaskId) {
        throw new Error("Provide exactly one of code or taskId.");
    }
    return hasCode ? "code" : "task";
}

function workflowVerifyContextBuild(
    toolContext: ToolExecutionContext,
    requestedName: string
): Parameters<typeof rlmVerify>[1] {
    return {
        ...toolContext,
        agent: {
            ...toolContext.agent,
            path: agentPathSub(toolContext.agent.path, 0),
            config: {
                ...toolContext.agent.config,
                kind: "sub",
                foreground: false,
                parentAgentId: toolContext.agent.id,
                name: requestedName || null
            }
        } as unknown as ToolExecutionContext["agent"]
    };
}

async function workflowAgentCreate(toolContext: ToolExecutionContext, requestedName: string): Promise<string> {
    const path = await agentPathChildAllocate({
        storage: toolContext.agentSystem.storage,
        parentAgentId: toolContext.agent.id,
        kind: "sub"
    });
    return toolContext.agentSystem.agentIdForTarget(
        toolContext.ctx,
        { path },
        {
            kind: "sub",
            parentAgentId: toolContext.agent.id,
            name: requestedName || null
        }
    );
}

async function workflowTaskResolve(
    toolContext: ToolExecutionContext,
    taskId: string,
    taskVersion?: number
): Promise<{
    id: string;
    userId: string;
    version?: number;
    title: string;
    parameters: TaskParameter[] | null;
}> {
    const normalizedTaskId = taskId.trim();
    if (!taskIdIsSafe(normalizedTaskId)) {
        throw new Error("Task id contains invalid characters.");
    }
    const task =
        taskVersion !== undefined
            ? await toolContext.agentSystem.storage.tasks.findByVersion(toolContext.ctx, normalizedTaskId, taskVersion)
            : await toolContext.agentSystem.storage.tasks.findById(toolContext.ctx, normalizedTaskId);
    if (!task) {
        throw new Error(
            taskVersion !== undefined
                ? `Task not found: ${normalizedTaskId}@${Math.trunc(taskVersion)}`
                : `Task not found: ${normalizedTaskId}`
        );
    }
    return {
        id: task.id,
        userId: task.userId,
        version: task.version,
        title: task.title,
        parameters: task.parameters
    };
}

function workflowResultBuild(
    toolCall: { id: string; name: string },
    originAgentId: string,
    targetAgentId: string,
    summary: string,
    taskId?: string
) {
    const toolMessage: ToolResultMessage = {
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: "text", text: summary }],
        isError: false,
        timestamp: Date.now()
    };

    return {
        toolMessage,
        typedResult: {
            summary,
            targetAgentId,
            originAgentId,
            ...(taskId ? { taskId } : {})
        }
    };
}

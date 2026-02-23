import { promises as fs } from "node:fs";
import path from "node:path";
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { createId } from "@paralleldrive/cuid2";
import { type Static, Type } from "@sinclair/typebox";
import type { AgentState, SessionPermissions, ToolDefinition, ToolResultContract } from "@/types";
import { pathResolveSecure } from "../../../sandbox/pathResolveSecure.js";
import { cuid2Is } from "../../../utils/cuid2Is.js";
import { contextForAgent } from "../../agents/context.js";
import { agentDescriptorWrite } from "../../agents/ops/agentDescriptorWrite.js";
import { agentPermanentList } from "../../agents/ops/agentPermanentList.js";
import type { PermanentAgentSummary } from "../../agents/ops/agentPermanentTypes.js";
import { agentStateRead } from "../../agents/ops/agentStateRead.js";
import { agentStateWrite } from "../../agents/ops/agentStateWrite.js";
import { permissionBuildUser } from "../../permissions/permissionBuildUser.js";

const schema = Type.Object(
    {
        name: Type.String({ minLength: 1 }),
        username: Type.Optional(Type.String({ minLength: 1 })),
        description: Type.String({ minLength: 1 }),
        systemPrompt: Type.String({ minLength: 1 }),
        workspaceDir: Type.Optional(Type.String({ minLength: 1 })),
        agentId: Type.Optional(Type.String({ minLength: 1 }))
    },
    { additionalProperties: false }
);

type PermanentAgentArgs = Static<typeof schema>;

const permanentAgentResultSchema = Type.Object(
    {
        summary: Type.String(),
        agentId: Type.String(),
        name: Type.String(),
        action: Type.String()
    },
    { additionalProperties: false }
);

type PermanentAgentResult = Static<typeof permanentAgentResultSchema>;

const permanentAgentReturns: ToolResultContract<PermanentAgentResult> = {
    schema: permanentAgentResultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the create_permanent_agent tool to create or update permanent agents.
 * Expects: agent name + system prompt are provided; workspaceDir stays within the owner user's home.
 */
export function permanentAgentToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "create_permanent_agent",
            description: "Create or update a permanent background agent with a stable name and system prompt.",
            parameters: schema
        },
        returns: permanentAgentReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as PermanentAgentArgs;
            const name = payload.name.trim();
            if (!name) {
                throw new Error("Permanent agent name is required.");
            }
            const description = payload.description.trim();
            if (!description) {
                throw new Error("Permanent agent description is required.");
            }
            const username = payload.username?.trim();
            if (payload.username !== undefined && !username) {
                throw new Error("Permanent agent username must be non-empty when provided.");
            }
            const systemPrompt = payload.systemPrompt.trim();
            if (!systemPrompt) {
                throw new Error("Permanent agent system prompt is required.");
            }

            const storage = toolContext.agentSystem.storage;
            const existingAgents = await agentPermanentList(storage);
            const resolvedAgent = resolveExistingAgent(existingAgents, payload.agentId, name);
            const agentId = resolvedAgent?.agentId ?? createId();
            const ownerUserId = toolContext.ctx?.userId;
            if (!ownerUserId) {
                throw new Error("Tool context userId is required.");
            }
            const ownerUserHome = toolContext.agentSystem.userHomeForUserId(ownerUserId);
            const targetCtx = contextForAgent({ userId: ownerUserId, agentId });
            const resolvedWorkspaceDir = payload.workspaceDir
                ? await resolveWorkspaceDir(ownerUserHome.home, payload.workspaceDir)
                : (resolvedAgent?.descriptor.workspaceDir ?? null);

            const descriptor = {
                type: "permanent" as const,
                id: agentId,
                name,
                ...(username
                    ? { username }
                    : resolvedAgent?.descriptor.username
                      ? { username: resolvedAgent.descriptor.username }
                      : {}),
                description,
                systemPrompt,
                ...(resolvedWorkspaceDir ? { workspaceDir: resolvedWorkspaceDir } : {})
            };
            const basePermissions = permissionBuildUser(ownerUserHome);

            if (resolvedAgent) {
                await agentDescriptorWrite(storage, targetCtx, descriptor, basePermissions);
                toolContext.agentSystem.updateAgentDescriptor(agentId, descriptor);

                const state = await agentStateRead(storage, targetCtx);
                if (!state) {
                    throw new Error("Permanent agent state not found.");
                }
                const permissions = updatePermissions(state.permissions, resolvedWorkspaceDir);
                const nextState: AgentState = {
                    ...state,
                    permissions,
                    updatedAt: Date.now()
                };
                await agentStateWrite(storage, targetCtx, nextState);
                toolContext.agentSystem.updateAgentPermissions(agentId, nextState.permissions, nextState.updatedAt);
            } else {
                const now = Date.now();
                const permissions = updatePermissions(basePermissions, resolvedWorkspaceDir);
                const state: AgentState = {
                    context: { messages: [] },
                    activeSessionId: null,
                    inferenceSessionId: createId(),
                    permissions,
                    tokens: null,
                    stats: {},
                    createdAt: now,
                    updatedAt: now,
                    state: "active"
                };
                await agentDescriptorWrite(storage, targetCtx, descriptor, basePermissions);
                await agentStateWrite(storage, targetCtx, state);
                state.activeSessionId = await storage.sessions.create({
                    agentId,
                    inferenceSessionId: state.inferenceSessionId,
                    createdAt: now
                });
                await agentStateWrite(storage, targetCtx, state);
                toolContext.agentSystem.updateAgentDescriptor(agentId, descriptor);
                toolContext.agentSystem.updateAgentPermissions(agentId, permissions, now);
            }

            const action = resolvedAgent ? "updated" : "created";
            const summary = `Permanent agent ${action}: ${agentId} (name: ${name}).`;
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
                    agentId,
                    name,
                    action
                }
            };
        }
    };
}

function resolveExistingAgent(
    agents: PermanentAgentSummary[],
    agentId: string | undefined,
    name: string
): PermanentAgentSummary | null {
    if (agentId) {
        const trimmed = agentId.trim();
        if (!cuid2Is(trimmed)) {
            throw new Error("agentId must be a cuid2 value.");
        }
        const match = agents.find((entry) => entry.agentId === trimmed) ?? null;
        if (!match) {
            throw new Error("Permanent agent not found for the supplied agentId.");
        }
        return match;
    }

    const normalized = normalizeName(name);
    const matches = agents.filter((entry) => normalizeName(entry.descriptor.name) === normalized);
    if (matches.length === 0) {
        return null;
    }
    return matches.sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
}

function normalizeName(value: string): string {
    return value.trim().toLowerCase();
}

async function resolveWorkspaceDir(workspaceRoot: string, input: string): Promise<string> {
    const trimmed = input.trim();
    if (!trimmed) {
        throw new Error("workspaceDir must be a non-empty string when provided.");
    }
    const target = path.isAbsolute(trimmed) ? trimmed : path.resolve(workspaceRoot, trimmed);
    const resolved = await pathResolveSecure([workspaceRoot], target);
    await fs.mkdir(resolved.realPath, { recursive: true });
    return resolved.realPath;
}

function updatePermissions(permissions: SessionPermissions, workspaceDir: string | null): SessionPermissions {
    if (!workspaceDir) {
        return permissions;
    }
    return {
        ...permissions,
        workingDir: workspaceDir
    };
}

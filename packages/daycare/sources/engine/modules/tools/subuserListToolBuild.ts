import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolExecutionContext, ToolResultContract } from "@/types";
import type { AgentLifecycleState } from "../../agents/ops/agentTypes.js";

const schema = Type.Object({}, { additionalProperties: false });

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        count: Type.Number()
    },
    { additionalProperties: false }
);

type SubuserListResult = {
    summary: string;
    count: number;
};

const returns: ToolResultContract<SubuserListResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

type SubuserEntry = {
    subuserId: string;
    name: string | null;
    gatewayAgentId: string | null;
    gatewayLifecycle: AgentLifecycleState | null;
};

/**
 * Builds the subuser_list tool that lists all subusers owned by the calling user.
 * Expects: caller is the owner user.
 */
export function subuserListToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "subuser_list",
            description: "List all subusers and their gateway agents. Only the owner can list subusers.",
            parameters: schema
        },
        returns,
        visibleByDefault: (context) => context.descriptor.type !== "subuser",
        execute: async (_args, toolContext, toolCall) => {
            await assertCallerIsOwner(toolContext);

            const storage = toolContext.agentSystem.storage;
            const subusers = await storage.users.findByParentUserId(toolContext.ctx.userId);
            const agents = await storage.agents.findMany();

            const entries: SubuserEntry[] = subusers.map((subuser) => {
                const gateway = agents.find(
                    (agent) => agent.descriptor.type === "subuser" && agent.descriptor.id === subuser.id
                );
                return {
                    subuserId: subuser.id,
                    name: subuser.name,
                    gatewayAgentId: gateway?.id ?? null,
                    gatewayLifecycle: gateway?.lifecycle ?? null
                };
            });

            const lines =
                entries.length === 0
                    ? ["No subusers."]
                    : entries.map(
                          (entry) =>
                              `${entry.subuserId} name="${entry.name ?? "unnamed"}" ` +
                              `gatewayAgent=${entry.gatewayAgentId ?? "none"} ` +
                              `lifecycle=${entry.gatewayLifecycle ?? "unknown"}`
                      );

            const summary = [`## Subusers (${entries.length})`, ...lines].join("\n");
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
                typedResult: { summary, count: entries.length }
            };
        }
    };
}

async function assertCallerIsOwner(toolContext: ToolExecutionContext): Promise<void> {
    const userId = toolContext.ctx.userId;
    const user = await toolContext.agentSystem.storage.users.findById(userId);
    if (!user || !user.isOwner) {
        throw new Error("Only the owner user can list subusers.");
    }
}

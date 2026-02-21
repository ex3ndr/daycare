import { describe, expect, it, vi } from "vitest";

import type { ToolExecutionContext } from "@/types";
import { channelAddMemberToolBuild, channelRemoveMemberToolBuild } from "./channelMemberTool.js";

const addToolCall = { id: "tool-1", name: "channel_add_member" };
const removeToolCall = { id: "tool-2", name: "channel_remove_member" };

describe("channelMemberToolBuild", () => {
    it("adds a member through channel facade", async () => {
        const addMember = vi.fn(async () => ({
            id: "ch-1",
            name: "dev",
            leader: "agent-leader",
            members: [{ agentId: "agent-a", username: "alice", joinedAt: 1 }],
            createdAt: 1,
            updatedAt: 2
        }));
        const tool = channelAddMemberToolBuild({ addMember } as never);
        const result = await tool.execute(
            {
                channelName: "dev",
                agentId: "agent-a",
                username: "alice"
            },
            contextBuild(),
            addToolCall
        );

        expect(addMember).toHaveBeenCalledWith("dev", { agentId: "agent-a", userId: "user-a" }, "alice");
        expect(result.toolMessage.isError).toBe(false);
    });

    it("removes a member through channel facade", async () => {
        const removeMember = vi.fn(async () => true);
        const tool = channelRemoveMemberToolBuild({ removeMember } as never);
        const result = await tool.execute(
            {
                channelName: "dev",
                agentId: "agent-a"
            },
            contextBuild(),
            removeToolCall
        );

        expect(removeMember).toHaveBeenCalledWith("dev", { agentId: "agent-a", userId: "user-a" });
        expect(result.toolMessage.isError).toBe(false);
    });
});

function contextBuild(): ToolExecutionContext {
    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        fileStore: null as unknown as ToolExecutionContext["fileStore"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        permissions: {
            workingDir: "/tmp",
            writeDirs: ["/tmp"]
        },
        agent: { id: "agent-caller" } as unknown as ToolExecutionContext["agent"],
        ctx: null as unknown as ToolExecutionContext["ctx"],
        source: "test",
        messageContext: {},
        agentSystem: {
            contextForAgentId: async (agentId: string) => ({ agentId, userId: "user-a" })
        } as unknown as ToolExecutionContext["agentSystem"],
        heartbeats: null as unknown as ToolExecutionContext["heartbeats"]
    };
}

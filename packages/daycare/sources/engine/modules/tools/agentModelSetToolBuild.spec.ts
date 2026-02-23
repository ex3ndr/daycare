import { describe, expect, it } from "vitest";
import { contextForAgent } from "../../agents/context.js";
import type { InferenceRouter } from "../inference/router.js";
import { agentModelSetToolBuild } from "./agentModelSetToolBuild.js";

// Minimal mock router — tests only check tool structure and visibility
const mockRouter = {} as InferenceRouter;

describe("agentModelSetToolBuild", () => {
    const tool = agentModelSetToolBuild(mockRouter);

    it("has the correct tool name", () => {
        expect(tool.tool.name).toBe("set_agent_model");
    });

    it("is visible only to user (foreground) agents", () => {
        expect(
            tool.visibleByDefault?.({
                ctx: contextForAgent({ userId: "user-1", agentId: "agent-1" }),
                descriptor: { type: "user", connector: "telegram", userId: "user-1", channelId: "channel-1" }
            })
        ).toBe(true);
    });

    it("is not visible to subagent descriptors", () => {
        expect(
            tool.visibleByDefault?.({
                ctx: contextForAgent({ userId: "user-1", agentId: "agent-1" }),
                descriptor: { type: "subagent", id: "sub-1", parentAgentId: "parent-1", name: "sub" }
            })
        ).toBe(false);
    });

    it("is not visible to permanent agent descriptors", () => {
        expect(
            tool.visibleByDefault?.({
                ctx: contextForAgent({ userId: "user-1", agentId: "agent-1" }),
                descriptor: {
                    type: "permanent",
                    id: "perm-1",
                    name: "bot",
                    description: "test",
                    systemPrompt: "you are a bot"
                }
            })
        ).toBe(false);
    });

    it("is not visible to cron descriptors", () => {
        expect(
            tool.visibleByDefault?.({
                ctx: contextForAgent({ userId: "user-1", agentId: "agent-1" }),
                descriptor: { type: "cron", id: "cron-1" }
            })
        ).toBe(false);
    });
});

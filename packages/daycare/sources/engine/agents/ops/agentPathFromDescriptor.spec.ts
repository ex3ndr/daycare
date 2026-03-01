import { describe, expect, it } from "vitest";

import { agentPathFromDescriptor } from "./agentPathFromDescriptor.js";
import { agentPath } from "./agentPathTypes.js";

describe("agentPathFromDescriptor", () => {
    it("bridges each descriptor type", () => {
        expect(
            agentPathFromDescriptor(
                { type: "user", connector: "telegram", userId: "ext", channelId: "chat" },
                { userId: "u1" }
            )
        ).toBe("/u1/telegram");
        expect(agentPathFromDescriptor({ type: "cron", id: "daily" }, { userId: "u1" })).toBe("/u1/cron/daily");
        expect(agentPathFromDescriptor({ type: "task", id: "task-1" }, { userId: "u1" })).toBe("/u1/task/task-1");
        expect(agentPathFromDescriptor({ type: "system", tag: "gc" }, { userId: "u1" })).toBe("/system/gc");
        expect(
            agentPathFromDescriptor(
                { type: "subagent", id: "a1", parentAgentId: "p1", name: "worker" },
                { userId: "u1", parentPath: agentPath("/u1/telegram"), subIndex: 2 }
            )
        ).toBe("/u1/telegram/sub/2");
        expect(
            agentPathFromDescriptor(
                {
                    type: "permanent",
                    id: "p1",
                    name: "claude",
                    description: "",
                    systemPrompt: ""
                },
                { userId: "u1" }
            )
        ).toBe("/u1/agent/claude");
        expect(
            agentPathFromDescriptor(
                { type: "memory-agent", id: "src" },
                { userId: "u1", parentPath: agentPath("/u1/telegram") }
            )
        ).toBe("/u1/telegram/memory");
        expect(
            agentPathFromDescriptor(
                { type: "memory-search", id: "s1", parentAgentId: "p1", name: "query" },
                { userId: "u1", parentPath: agentPath("/u1/telegram"), searchIndex: 0 }
            )
        ).toBe("/u1/telegram/search/0");
        expect(agentPathFromDescriptor({ type: "swarm", id: "swarm-1" }, { userId: "u1" })).toBe("/u1/agent/swarm");
    });
});

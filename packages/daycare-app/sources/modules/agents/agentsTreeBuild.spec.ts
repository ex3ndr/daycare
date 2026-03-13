import { describe, expect, it } from "vitest";
import { agentsTreeBuild } from "./agentsTreeBuild";
import type { AgentListItem } from "./agentsTypes";

function agentCreate(overrides: Partial<AgentListItem> & { agentId: string }): AgentListItem {
    const { agentId, ...rest } = overrides;

    return {
        agentId,
        path: null,
        kind: "agent",
        name: null,
        description: null,
        connector: null,
        foreground: false,
        lifecycle: "active",
        createdAt: 1000,
        updatedAt: 1000,
        ...rest
    };
}

describe("agentsTreeBuild", () => {
    it("renders connector children as a file tree", () => {
        const tree = agentsTreeBuild([
            agentCreate({
                agentId: "root-1",
                kind: "connector",
                connector: { name: "telegram", key: "room-1" },
                path: "/user-1/telegram"
            }),
            agentCreate({
                agentId: "memory-1",
                kind: "memory",
                path: "/user-1/telegram/memory"
            }),
            agentCreate({
                agentId: "search-1",
                kind: "search",
                path: "/user-1/telegram/search/0"
            }),
            agentCreate({
                agentId: "sub-1",
                kind: "sub",
                path: "/user-1/telegram/sub/0"
            })
        ]);

        expect(tree.nodeCount).toBe(4);
        expect(tree.linkCount).toBe(3);
        expect(tree.rootCount).toBe(1);
        expect(tree.orphanCount).toBe(0);
        expect(tree.text).toContain("agents/");
        expect(tree.text).toContain("Telegram [connector, active]");
        expect(tree.text).toContain("\\- Subagent [sub, active]");
    });

    it("marks detached children as orphan nodes", () => {
        const tree = agentsTreeBuild([
            agentCreate({
                agentId: "orphan-1",
                kind: "memory",
                path: "/user-1/agent/missing/memory"
            })
        ]);

        expect(tree.linkCount).toBe(0);
        expect(tree.rootCount).toBe(1);
        expect(tree.orphanCount).toBe(1);
        expect(tree.text).toContain("Memory Worker [memory, active, orphan]");
    });
});

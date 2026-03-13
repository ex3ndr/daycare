import { describe, expect, it } from "vitest";
import { agentsGraphBuild } from "./agentsGraphBuild";
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

describe("agentsGraphBuild", () => {
    it("links memory, search, and sub agents to their parent path", () => {
        const graph = agentsGraphBuild([
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

        expect(graph.nodeCount).toBe(4);
        expect(graph.edgeCount).toBe(3);
        expect(graph.rootCount).toBe(1);
        expect(graph.orphanCount).toBe(0);
        expect(graph.mermaid).toContain("graph TD");
        expect(graph.mermaid).toContain("Telegram | connector | active");
        expect(graph.mermaid).toContain("-->");
    });

    it("marks nodes as orphaned when the parent path is missing", () => {
        const graph = agentsGraphBuild([
            agentCreate({
                agentId: "orphan-1",
                kind: "memory",
                path: "/user-1/agent/missing/memory"
            })
        ]);

        expect(graph.edgeCount).toBe(0);
        expect(graph.rootCount).toBe(1);
        expect(graph.orphanCount).toBe(1);
        expect(graph.mermaid).toContain("%% Missing parent path for Memory Worker: /user-1/agent/missing");
    });
});

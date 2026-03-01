import { describe, expect, it, vi } from "vitest";
import { documentSearchToolBuild } from "./documentSearchToolBuild.js";

type BuildContextInput = {
    responseText?: string | null;
};

function buildContext(input?: BuildContextInput) {
    const agentIdForTarget = vi.fn(async (_ctx: unknown, _target: unknown) => "memory-search-agent-1");
    const post = vi.fn(async (_ctx: unknown, _target: { agentId: string }, _item: unknown) => undefined);
    const responseText = input && "responseText" in input ? input.responseText : "Found prior decision in documents.";
    const postAndAwait = vi.fn(async (_ctx: unknown, _target: { agentId: string }, _item: unknown) => {
        return {
            type: "message" as const,
            responseText
        };
    });
    const ctx = {
        agentId: "agent-parent-1",
        userId: "user-1"
    };

    return {
        context: {
            agent: {
                id: "agent-parent-1"
            },
            ctx,
            agentSystem: {
                agentIdForTarget,
                post,
                postAndAwait
            }
        } as never,
        ctx,
        agentIdForTarget,
        post,
        postAndAwait
    };
}

describe("documentSearchToolBuild", () => {
    const tool = documentSearchToolBuild();

    it("runs asynchronously by default", async () => {
        const { context, ctx, agentIdForTarget, post, postAndAwait } = buildContext();
        const result = await tool.execute({ query: "  daily metrics  " }, context, {
            id: "tc-1",
            name: "document_search"
        });

        expect(agentIdForTarget).toHaveBeenCalledTimes(1);
        expect(agentIdForTarget.mock.calls[0]?.[1]).toMatchObject({
            path: expect.stringContaining("/search/0")
        });
        expect(post).toHaveBeenCalledWith(
            ctx,
            { agentId: "memory-search-agent-1" },
            { type: "message", message: { text: "daily metrics" }, context: {} }
        );
        expect(postAndAwait).not.toHaveBeenCalled();
        expect(result.typedResult.summary).toContain("Results will arrive asynchronously");
        expect(result.typedResult.targetAgentId).toBe("memory-search-agent-1");
        expect(result.typedResult.originAgentId).toBe("agent-parent-1");
    });

    it("supports sync mode when sync=true", async () => {
        const { context, ctx, post, postAndAwait } = buildContext();
        const result = await tool.execute({ query: "tool behavior", sync: true }, context, {
            id: "tc-1",
            name: "document_search"
        });

        expect(post).not.toHaveBeenCalled();
        expect(postAndAwait).toHaveBeenCalledWith(
            ctx,
            { agentId: "memory-search-agent-1" },
            { type: "message", message: { text: "tool behavior" }, context: {} }
        );
        expect(result.typedResult.summary).toContain("completed in sync mode");
        expect(result.typedResult.summary).toContain("Found prior decision in documents.");
    });

    it("explains sync mode when the child returns no response text", async () => {
        const { context } = buildContext({ responseText: null });
        const result = await tool.execute({ query: "missing info", sync: true }, context, {
            id: "tc-1",
            name: "document_search"
        });

        expect(result.typedResult.summary).toContain("No response text returned.");
    });

    it("rejects blank queries", async () => {
        const { context } = buildContext();
        await expect(tool.execute({ query: "   " }, context, { id: "tc-1", name: "document_search" })).rejects.toThrow(
            "Search query is required"
        );
    });
});

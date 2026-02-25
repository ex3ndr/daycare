import { describe, expect, it } from "vitest";

import { agentToolExecutionAllowlistResolve } from "./agentToolExecutionAllowlistResolve.js";

describe("agentToolExecutionAllowlistResolve", () => {
    it("returns undefined for non-memory descriptors", () => {
        const allowlist = agentToolExecutionAllowlistResolve({
            type: "user",
            connector: "telegram",
            userId: "user-1",
            channelId: "channel-1"
        });

        expect(allowlist).toBeUndefined();
    });

    it("returns memory-only tools for memory-agent descriptors", () => {
        const allowlist = agentToolExecutionAllowlistResolve({ type: "memory-agent", id: "agent-1" });

        expect(allowlist ? [...allowlist] : []).toEqual(["memory_node_read", "memory_node_write"]);
    });

    it("returns read+report tools for memory-search descriptors", () => {
        const allowlist = agentToolExecutionAllowlistResolve({
            type: "memory-search",
            id: "ms-1",
            parentAgentId: "parent-1",
            name: "query"
        });

        expect(allowlist ? [...allowlist] : []).toEqual(["memory_node_read", "send_agent_message"]);
    });
});

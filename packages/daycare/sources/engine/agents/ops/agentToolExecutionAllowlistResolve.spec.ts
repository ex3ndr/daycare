import { describe, expect, it } from "vitest";

import { agentToolExecutionAllowlistResolve } from "./agentToolExecutionAllowlistResolve.js";

describe("agentToolExecutionAllowlistResolve", () => {
    it("returns undefined for non-memory descriptors", () => {
        const allowlist = agentToolExecutionAllowlistResolve(
            { type: "user", connector: "telegram", userId: "user-1", channelId: "channel-1" },
            { rlmEnabled: true }
        );

        expect(allowlist).toBeUndefined();
    });

    it("returns memory-only tools for memory-agent descriptors", () => {
        const allowlist = agentToolExecutionAllowlistResolve(
            { type: "memory-agent", id: "agent-1" },
            {
                rlmEnabled: false
            }
        );

        expect(allowlist ? [...allowlist] : []).toEqual(["memory_node_read", "memory_node_write"]);
    });

    it("returns read-only tools for memory-search descriptors", () => {
        const allowlist = agentToolExecutionAllowlistResolve(
            { type: "memory-search", id: "ms-1", parentAgentId: "parent-1", name: "query" },
            { rlmEnabled: false }
        );

        expect(allowlist ? [...allowlist] : []).toEqual(["memory_node_read"]);
    });

    it("includes rlm tools for memory-search when rlm is enabled", () => {
        const allowlist = agentToolExecutionAllowlistResolve(
            { type: "memory-search", id: "ms-1", parentAgentId: "parent-1", name: "query" },
            { rlmEnabled: true }
        );

        expect(allowlist ? [...allowlist] : []).toEqual(["memory_node_read", "run_python", "skip"]);
    });

    it("includes run_python and skip when rlm is enabled", () => {
        const allowlist = agentToolExecutionAllowlistResolve(
            { type: "memory-agent", id: "agent-1" },
            {
                rlmEnabled: true
            }
        );

        expect(allowlist ? [...allowlist] : []).toEqual([
            "memory_node_read",
            "memory_node_write",
            "run_python",
            "skip"
        ]);
    });
});

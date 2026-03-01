import { describe, expect, it } from "vitest";

import { agentToolExecutionAllowlistResolve } from "./agentToolExecutionAllowlistResolve.js";

describe("agentToolExecutionAllowlistResolve", () => {
    it("returns undefined for non-memory kinds", () => {
        const allowlist = agentToolExecutionAllowlistResolve("connector");

        expect(allowlist).toBeUndefined();
    });

    it("returns memory-only tools for memory-agents", () => {
        const allowlist = agentToolExecutionAllowlistResolve("memory");

        expect(allowlist ? [...allowlist] : []).toEqual(["document_read", "document_write"]);
    });

    it("returns read+report tools for memory-search agents", () => {
        const allowlist = agentToolExecutionAllowlistResolve("search");

        expect(allowlist ? [...allowlist] : []).toEqual(["document_read", "send_agent_message"]);
    });
});

import { describe, expect, it } from "vitest";

import { systemAgentTagIs } from "./systemAgentTagIs.js";

describe("systemAgentTagIs", () => {
    it("accepts lowercase english tags", () => {
        expect(systemAgentTagIs("heartbeat")).toBe(true);
    });

    it("rejects non-system tags", () => {
        expect(systemAgentTagIs("HeartBeat")).toBe(false);
        expect(systemAgentTagIs("heartbeat-v2")).toBe(false);
        expect(systemAgentTagIs(" heartbeat ")).toBe(true);
    });
});

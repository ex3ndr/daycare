import { describe, expect, it } from "vitest";

import { systemAgentTagIs } from "./systemAgentTagIs.js";

describe("systemAgentTagIs", () => {
    it("accepts lowercase english tags", () => {
        expect(systemAgentTagIs("status")).toBe(true);
    });

    it("rejects non-system tags", () => {
        expect(systemAgentTagIs("Status")).toBe(false);
        expect(systemAgentTagIs("status-v2")).toBe(false);
        expect(systemAgentTagIs(" status ")).toBe(true);
    });
});

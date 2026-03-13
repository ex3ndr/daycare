import { describe, expect, it } from "vitest";
import { agentsSupervisorBootstrapTextBuild } from "./agentsSupervisorBootstrapTextBuild.js";

describe("agentsSupervisorBootstrapTextBuild", () => {
    it("wraps bootstrap text in supervisor instructions", () => {
        const result = agentsSupervisorBootstrapTextBuild("Ship the bugfix.");
        expect(result).toContain("<bootstrap_request>\nShip the bugfix.");
        expect(result).toContain("document_write");
        expect(result).toContain('parentPath under "doc://document"');
        expect(result).toContain('"mission"');
        expect(result).toContain("user_profile_update");
        expect(result).toContain("homeReady: true, appReady: true");
    });
});

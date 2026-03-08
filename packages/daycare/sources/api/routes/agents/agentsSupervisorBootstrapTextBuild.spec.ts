import { describe, expect, it } from "vitest";
import { agentsSupervisorBootstrapTextBuild } from "./agentsSupervisorBootstrapTextBuild.js";

describe("agentsSupervisorBootstrapTextBuild", () => {
    it("wraps bootstrap text in supervisor instructions", () => {
        expect(agentsSupervisorBootstrapTextBuild("Ship the bugfix.")).toContain(
            "<bootstrap_request>\nShip the bugfix."
        );
    });
});

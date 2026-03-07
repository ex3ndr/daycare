import { describe, expect, it } from "vitest";
import { agentDraftTextBuild } from "./agentDraftTextBuild.js";

describe("agentDraftTextBuild", () => {
    it("returns assistant text when there are no tool entries", () => {
        expect(agentDraftTextBuild("Finished", [])).toBe("Finished");
    });

    it("renders tool entries without assistant text", () => {
        expect(
            agentDraftTextBuild(null, [
                { label: "run_python: Check status", status: "running" },
                { label: "echo text=hello", status: "done" }
            ])
        ).toBe("Tools:\n- run_python: Check status (running)\n- echo text=hello");
    });

    it("marks failed tool entries", () => {
        expect(
            agentDraftTextBuild("Result", [
                { label: "run_python", status: "done" },
                { label: "say text=hello", status: "error" }
            ])
        ).toBe("Result\n\nTools:\n- run_python\n- say text=hello (failed)");
    });
});

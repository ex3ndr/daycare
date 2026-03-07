import { describe, expect, it } from "vitest";
import { agentDraftTextBuild } from "./agentDraftTextBuild.js";

describe("agentDraftTextBuild", () => {
    it("returns assistant text when there are no tool entries", () => {
        expect(agentDraftTextBuild("Finished", [])).toBe("Finished");
    });

    it("renders tool entries without assistant text", () => {
        expect(
            agentDraftTextBuild(null, [
                { label: "Check status", status: "running" },
                { label: "Open workspace", status: "done" }
            ])
        ).toBe("Steps:\n- Check status\n- Open workspace");
    });

    it("renders steps before assistant text", () => {
        expect(
            agentDraftTextBuild("Result", [
                { label: "Check status", status: "done" },
                { label: "Read memory", status: "error" }
            ])
        ).toBe("Steps:\n- Check status\n- Read memory (failed)\n\nResult");
    });
});

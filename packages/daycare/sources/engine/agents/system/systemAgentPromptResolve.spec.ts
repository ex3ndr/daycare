import { describe, expect, it } from "vitest";

import { systemAgentPromptResolve } from "./systemAgentPromptResolve.js";

describe("systemAgentPromptResolve", () => {
    it("returns null when no built-in system agent prompts are registered", async () => {
        await expect(systemAgentPromptResolve("status")).resolves.toBeNull();
    });
});

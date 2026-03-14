import { describe, expect, it } from "vitest";

import { agentPathAgent } from "../engine/agents/ops/agentPathBuild.js";
import { evalHarnessCreate } from "./evalHarness.js";

describe("evalHarnessCreate", () => {
    it("boots an in-process harness and creates an agent", async () => {
        const harness = await evalHarnessCreate();
        try {
            const ownerCtx = await harness.agentSystem.ownerCtxEnsure();
            const agentPath = agentPathAgent(ownerCtx.userId, "eval-agent");
            const creationConfig = { kind: "agent" as const, name: "eval-agent" };

            const resetResult = await harness.agentSystem.postAndAwait(
                ownerCtx,
                { path: agentPath },
                { type: "reset", message: "init eval agent" },
                creationConfig
            );

            const agentId = await harness.agentSystem.agentIdForTarget(ownerCtx, { path: agentPath }, creationConfig);
            const agentCtx = await harness.agentSystem.contextForAgentId(agentId);

            expect(resetResult).toEqual({ type: "reset", ok: true });
            expect(agentCtx?.userId).toBe(ownerCtx.userId);
            expect(await harness.agentSystem.agentExists(agentId)).toBe(true);
        } finally {
            await harness.cleanup();
        }
    });
});

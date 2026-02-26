import { describe, expect, it } from "vitest";
import { RLM_LIMITS } from "./rlmLimits.js";
import { RlmWorkers } from "./rlmWorkers.js";

describe("RlmWorkers", () => {
    it("reuses a worker for the same agent key", async () => {
        const workers = new RlmWorkers();
        try {
            await workers.start("user-1:agent-1", {
                code: "'one'",
                preamble: "",
                externalFunctions: [],
                limits: RLM_LIMITS
            });
            await workers.start("user-1:agent-1", {
                code: "'two'",
                preamble: "",
                externalFunctions: [],
                limits: RLM_LIMITS
            });

            const active = (workers as unknown as { workers: Map<string, unknown> }).workers;
            expect(active.size).toBe(1);
        } finally {
            await workers.stop();
        }
    });

    it("creates separate workers for different agent keys", async () => {
        const workers = new RlmWorkers();
        try {
            await workers.start("user-1:agent-1", {
                code: "'one'",
                preamble: "",
                externalFunctions: [],
                limits: RLM_LIMITS
            });
            await workers.start("user-1:agent-2", {
                code: "'two'",
                preamble: "",
                externalFunctions: [],
                limits: RLM_LIMITS
            });

            const active = (workers as unknown as { workers: Map<string, unknown> }).workers;
            expect(active.size).toBe(2);
        } finally {
            await workers.stop();
        }
    });
});

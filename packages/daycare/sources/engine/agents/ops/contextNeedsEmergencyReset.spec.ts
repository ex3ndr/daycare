import path from "node:path";

import { describe, expect, it } from "vitest";
import type { AgentHistoryRecord } from "@/types";
import { configResolve } from "../../../config/configResolve.js";
import { contextNeedsEmergencyReset } from "./contextNeedsEmergencyReset.js";

describe("contextNeedsEmergencyReset", () => {
    it("returns true when estimate exceeds configured limit", () => {
        const config = configResolve({ agents: { emergencyContextLimit: 5 } }, path.resolve("/tmp/settings.json"));
        const history: AgentHistoryRecord[] = [{ type: "user_message", at: 1, text: "x".repeat(24), files: [] }];

        expect(contextNeedsEmergencyReset(config, history)).toBe(true);
    });

    it("uses the default limit when unset", () => {
        const config = configResolve({}, path.resolve("/tmp/settings.json"));
        const history: AgentHistoryRecord[] = [{ type: "user_message", at: 1, text: "short", files: [] }];

        expect(contextNeedsEmergencyReset(config, history)).toBe(false);
    });

    it("includes heuristic extras in the estimate", () => {
        const config = configResolve({ agents: { emergencyContextLimit: 10 } }, path.resolve("/tmp/settings.json"));
        const history: AgentHistoryRecord[] = [{ type: "user_message", at: 1, text: "", files: [] }];

        expect(contextNeedsEmergencyReset(config, history, { systemPrompt: "x".repeat(40) })).toBe(true);
    });
});

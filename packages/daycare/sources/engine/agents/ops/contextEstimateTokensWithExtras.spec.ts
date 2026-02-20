import { describe, expect, it } from "vitest";

import type { AgentHistoryRecord } from "@/types";

import { contextEstimateTokensWithExtras } from "./contextEstimateTokensWithExtras.js";

describe("contextEstimateTokensWithExtras", () => {
    it("adds heuristic extras to history estimates", () => {
        const history: AgentHistoryRecord[] = [{ type: "user_message", at: 1, text: "abcd", files: [] }];

        const estimated = contextEstimateTokensWithExtras(history, {
            systemPrompt: "abcd"
        });

        expect(estimated).toBe(2);
    });
});

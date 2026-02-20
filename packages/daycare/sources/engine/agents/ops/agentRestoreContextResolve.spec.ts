import type { Context } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";

import { agentRestoreContextResolve } from "./agentRestoreContextResolve.js";

describe("agentRestoreContextResolve", () => {
    it("prefers history messages when history is available", () => {
        const current: Context["messages"] = [{ role: "user", content: "persisted", timestamp: 1 }];
        const history: Context["messages"] = [{ role: "user", content: "history", timestamp: 2 }];

        const resolved = agentRestoreContextResolve([...current], [...history]);

        expect(resolved).toEqual(history);
    });

    it("keeps current messages when history is empty", () => {
        const current: Context["messages"] = [{ role: "user", content: "persisted", timestamp: 1 }];

        const resolved = agentRestoreContextResolve([...current], []);

        expect(resolved).toEqual(current);
    });
});

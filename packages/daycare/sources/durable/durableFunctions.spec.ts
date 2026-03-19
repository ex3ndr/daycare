import { describe, expect, it } from "vitest";

import { durableFunctionDefinitionGet } from "./durableFunctionDefinitionGet.js";
import { durableFunctionEnabled } from "./durableFunctionEnabled.js";
import { durableFunctionNamesForRoles } from "./durableFunctionNamesForRoles.js";

describe("durableFunctions", () => {
    it("exposes tool-like durable metadata", () => {
        const definition = durableFunctionDefinitionGet("delayedSignalDeliver");

        expect(definition.name).toBe("delayedSignalDeliver");
        expect(definition.description).toContain("delayed signal");
        expect(definition.enabledRoles).toEqual(["api", "agents", "signals"]);
    });

    it("filters functions by runtime role", () => {
        expect(durableFunctionEnabled("delayedSignalDeliver", ["signals"])).toBe(true);
        expect(durableFunctionEnabled("delayedSignalDeliver", ["tasks"])).toBe(false);
        expect(durableFunctionNamesForRoles(["tasks"])).toEqual([]);
    });

    it("keeps functions enabled when no role filter is provided", () => {
        expect(durableFunctionEnabled("delayedSignalDeliver", [])).toBe(true);
        expect(durableFunctionNamesForRoles([])).toEqual(["delayedSignalDeliver"]);
    });
});

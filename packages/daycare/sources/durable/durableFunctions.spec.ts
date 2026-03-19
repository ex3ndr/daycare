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
        expect(durableFunctionNamesForRoles([])).toEqual([
            "delayedSignalDeliver",
            "connectorSendMessage",
            "connectorReceiveMessage"
        ]);
    });

    it("enables connectorSendMessage only for connectors role", () => {
        const definition = durableFunctionDefinitionGet("connectorSendMessage");

        expect(definition.name).toBe("connectorSendMessage");
        expect(definition.description).toContain("connector");
        expect(definition.enabledRoles).toEqual(["connectors"]);
        expect(durableFunctionEnabled("connectorSendMessage", ["connectors"])).toBe(true);
        expect(durableFunctionEnabled("connectorSendMessage", ["agents"])).toBe(false);
        expect(durableFunctionEnabled("connectorSendMessage", ["api"])).toBe(false);
    });

    it("enables connectorReceiveMessage only for agents role", () => {
        const definition = durableFunctionDefinitionGet("connectorReceiveMessage");

        expect(definition.name).toBe("connectorReceiveMessage");
        expect(definition.description).toContain("inbox");
        expect(definition.enabledRoles).toEqual(["agents"]);
        expect(durableFunctionEnabled("connectorReceiveMessage", ["agents"])).toBe(true);
        expect(durableFunctionEnabled("connectorReceiveMessage", ["connectors"])).toBe(false);
    });

    it("returns connector functions for their respective roles", () => {
        expect(durableFunctionNamesForRoles(["connectors"])).toContain("connectorSendMessage");
        expect(durableFunctionNamesForRoles(["connectors"])).not.toContain("connectorReceiveMessage");
        expect(durableFunctionNamesForRoles(["agents"])).toContain("connectorReceiveMessage");
        expect(durableFunctionNamesForRoles(["agents"])).not.toContain("connectorSendMessage");
    });
});

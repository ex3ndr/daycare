import { describe, expect, it, vi } from "vitest";

import type { PermissionDecision } from "@/types";
import { PermissionRequestRegistry } from "./permissionRequestRegistry.js";

describe("PermissionRequestRegistry", () => {
    it("resolves pending request when a decision arrives", async () => {
        const registry = new PermissionRequestRegistry();
        const decision = decisionBuild({ token: "token-1", approved: true });

        const pending = registry.register("token-1", 1_000);
        const resolved = registry.resolve("token-1", decision);

        expect(resolved).toBe(true);
        await expect(pending).resolves.toEqual(decision);
    });

    it("rejects pending request when timeout is reached", async () => {
        vi.useFakeTimers();
        try {
            const registry = new PermissionRequestRegistry();
            const pending = registry.register("token-1", 5_000);
            const rejection = expect(pending).rejects.toThrow("Permission request timed out.");

            await vi.advanceTimersByTimeAsync(5_000);

            await rejection;
        } finally {
            vi.useRealTimers();
        }
    });

    it("returns false for unknown token resolve", () => {
        const registry = new PermissionRequestRegistry();

        const resolved = registry.resolve("missing", decisionBuild({ token: "missing" }));

        expect(resolved).toBe(false);
    });

    it("rejects pending request when cancelled", async () => {
        const registry = new PermissionRequestRegistry();
        const pending = registry.register("token-1", 1_000);
        const rejection = expect(pending).rejects.toThrow("Permission request cancelled.");

        registry.cancel("token-1");

        await rejection;
    });
});

function decisionBuild(overrides: Partial<PermissionDecision> = {}): PermissionDecision {
    return {
        token: "token-1",
        agentId: "agent-1",
        approved: false,
        permissions: [{ permission: "@network", access: { kind: "network" } }],
        ...overrides
    };
}

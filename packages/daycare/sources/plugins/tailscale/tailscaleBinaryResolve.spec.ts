import { describe, expect, it } from "vitest";

import { tailscaleBinaryResolve } from "./tailscaleBinaryResolve.js";

describe("tailscaleBinaryResolve", () => {
    it("returns app bundle binary on macOS when present", async () => {
        const resolved = await tailscaleBinaryResolve({
            platform: "darwin",
            pathExists: async (value) => value === "/Applications/Tailscale.app/Contents/MacOS/Tailscale"
        });

        expect(resolved).toBe("/Applications/Tailscale.app/Contents/MacOS/Tailscale");
    });

    it("falls back to PATH command on macOS when app bundle binary is absent", async () => {
        const resolved = await tailscaleBinaryResolve({
            platform: "darwin",
            pathExists: async () => false
        });

        expect(resolved).toBe("tailscale");
    });

    it("returns PATH command on non-macOS platforms", async () => {
        const resolved = await tailscaleBinaryResolve({
            platform: "linux",
            pathExists: async () => true
        });

        expect(resolved).toBe("tailscale");
    });
});

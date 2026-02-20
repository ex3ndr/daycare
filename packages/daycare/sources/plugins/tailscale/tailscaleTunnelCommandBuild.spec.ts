import { describe, expect, it } from "vitest";

import { tailscaleTunnelCommandBuild } from "./tailscaleTunnelCommandBuild.js";

describe("tailscaleTunnelCommandBuild", () => {
    it("builds create commands for public and local-network modes", () => {
        expect(tailscaleTunnelCommandBuild({ action: "create", mode: "public", proxyPort: 7777 })).toEqual({
            command: "tailscale",
            args: ["funnel", "--bg", "--https", "443", "http://127.0.0.1:7777"]
        });

        expect(
            tailscaleTunnelCommandBuild({
                action: "create",
                mode: "local-network",
                proxyPort: 8888
            })
        ).toEqual({
            command: "tailscale",
            args: ["serve", "--bg", "--https", "443", "http://127.0.0.1:8888"]
        });
    });

    it("uses provided binary path when specified", () => {
        expect(
            tailscaleTunnelCommandBuild({
                action: "create",
                mode: "public",
                proxyPort: 9090,
                binary: "/Applications/Tailscale.app/Contents/MacOS/Tailscale"
            })
        ).toEqual({
            command: "/Applications/Tailscale.app/Contents/MacOS/Tailscale",
            args: ["funnel", "--bg", "--https", "443", "http://127.0.0.1:9090"]
        });
    });

    it("builds destroy commands for public and local-network modes", () => {
        expect(tailscaleTunnelCommandBuild({ action: "destroy", mode: "public" })).toEqual({
            command: "tailscale",
            args: ["funnel", "clear", "https:443"]
        });

        expect(tailscaleTunnelCommandBuild({ action: "destroy", mode: "local-network" })).toEqual({
            command: "tailscale",
            args: ["serve", "clear", "https:443"]
        });
    });
});

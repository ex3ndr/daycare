import { describe, expect, it } from "vitest";

import { cloudflareTunnelCommandBuild } from "./cloudflareTunnelCommandBuild.js";

describe("cloudflareTunnelCommandBuild", () => {
    it("builds create command", () => {
        expect(
            cloudflareTunnelCommandBuild({
                action: "create",
                domain: "app.example.com",
                proxyPort: 7070
            })
        ).toEqual({
            command: "cloudflared",
            args: [
                "tunnel",
                "route",
                "dns",
                "daycare",
                "app.example.com",
                "--overwrite-dns",
                "--url",
                "http://127.0.0.1:7070"
            ]
        });
    });

    it("builds destroy command", () => {
        expect(
            cloudflareTunnelCommandBuild({
                action: "destroy",
                domain: "app.example.com"
            })
        ).toEqual({
            command: "cloudflared",
            args: ["tunnel", "route", "dns", "daycare", "app.example.com", "--delete"]
        });
    });
});

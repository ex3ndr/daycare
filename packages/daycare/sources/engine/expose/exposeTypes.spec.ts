import { describe, expect, it } from "vitest";

import {
    exposeCreateInputParse,
    exposeDomainNormalize,
    exposeEndpointParse,
    exposeModeSupported,
    exposeTargetParse,
    exposeUpdateInputParse
} from "./exposeTypes.js";

describe("exposeTypes", () => {
    it("parses valid port and unix targets", () => {
        expect(exposeTargetParse({ type: "port", port: 3000 })).toEqual({
            type: "port",
            port: 3000
        });
        expect(exposeTargetParse({ type: "unix", path: "/tmp/app.sock" })).toEqual({
            type: "unix",
            path: "/tmp/app.sock"
        });
    });

    it("rejects invalid targets", () => {
        expect(() => exposeTargetParse({ type: "port", port: 0 })).toThrow();
        expect(() => exposeTargetParse({ type: "unix", path: "" })).toThrow();
    });

    it("normalizes valid domains", () => {
        expect(exposeDomainNormalize("APP.Example.COM")).toBe("app.example.com");
        expect(() => exposeDomainNormalize("invalid_domain")).toThrow("Invalid expose domain");
    });

    it("parses create and update payloads", () => {
        expect(
            exposeCreateInputParse({
                target: { type: "port", port: 8080 },
                provider: " provider-a ",
                mode: "public",
                authenticated: true
            })
        ).toEqual({
            target: { type: "port", port: 8080 },
            provider: "provider-a",
            mode: "public",
            authenticated: true
        });

        expect(exposeUpdateInputParse({ authenticated: false })).toEqual({
            authenticated: false
        });
    });

    it("parses endpoint payloads and normalizes domain", () => {
        expect(
            exposeEndpointParse({
                id: "ep-1",
                target: { type: "port", port: 8080 },
                provider: "tailscale",
                domain: "APP.Example.COM",
                mode: "local-network",
                auth: { enabled: true, passwordHash: "hash" },
                createdAt: 1,
                updatedAt: 2
            })
        ).toEqual({
            id: "ep-1",
            target: { type: "port", port: 8080 },
            provider: "tailscale",
            domain: "app.example.com",
            mode: "local-network",
            auth: { enabled: true, passwordHash: "hash" },
            createdAt: 1,
            updatedAt: 2
        });
    });

    it("checks mode capability support", () => {
        expect(exposeModeSupported("public", { public: true, localNetwork: false })).toBe(true);
        expect(exposeModeSupported("local-network", { public: true, localNetwork: false })).toBe(false);
    });
});

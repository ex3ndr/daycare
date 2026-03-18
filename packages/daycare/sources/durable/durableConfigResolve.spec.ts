import { describe, expect, it } from "vitest";

import { durableConfigResolve } from "./durableConfigResolve.js";

describe("durableConfigResolve", () => {
    it("returns null when Inngest durable env is not configured", () => {
        expect(durableConfigResolve({})).toBeNull();
    });

    it("normalizes http endpoints to websocket urls", () => {
        const result = durableConfigResolve({
            INNGEST_ENDPOINT: "https://inngest.example/connect",
            INNGEST_TOKEN: "secret-token"
        });

        expect(result).toEqual({
            endpoint: "https://inngest.example/connect",
            token: "secret-token",
            apiUrl: "https://inngest.example/connect",
            gatewayUrl: "wss://inngest.example/connect"
        });
    });

    it("requires both endpoint and token", () => {
        expect(() => durableConfigResolve({ INNGEST_ENDPOINT: "https://inngest.example/connect" })).toThrow(
            "INNGEST_ENDPOINT and INNGEST_TOKEN must both be set to enable durable runtime."
        );
    });

    it("rejects unsupported endpoint protocols", () => {
        expect(() =>
            durableConfigResolve({
                INNGEST_ENDPOINT: "ftp://inngest.example/connect",
                INNGEST_TOKEN: "secret-token"
            })
        ).toThrow("INNGEST_ENDPOINT must use http, https, ws, or wss.");
    });
});

import { describe, expect, it } from "vitest";

import { durableConfigResolve } from "./durableConfigResolve.js";

describe("durableConfigResolve", () => {
    it("returns null when Inngest durable env is not configured", () => {
        expect(durableConfigResolve({})).toBeNull();
    });

    it("accepts websocket endpoints as-is", () => {
        const result = durableConfigResolve({
            INNGEST_ENDPOINT: "wss://inngest.example/connect?token=secret-token"
        });

        expect(result).toEqual({
            apiBaseUrl: "https://inngest.example/",
            endpoint: "wss://inngest.example/connect?token=secret-token"
        });
    });

    it("accepts insecure websocket endpoints when explicitly provided", () => {
        const result = durableConfigResolve({ INNGEST_ENDPOINT: "ws://inngest.example/connect" });

        expect(result).toEqual({
            apiBaseUrl: "http://inngest.example/",
            endpoint: "ws://inngest.example/connect"
        });
    });

    it("derives api base url from websocket host even when the endpoint has a nested path", () => {
        const result = durableConfigResolve({
            INNGEST_ENDPOINT: "wss://inngest.example:8288/gateway/v0/connect?token=secret-token"
        });

        expect(result).toEqual({
            apiBaseUrl: "https://inngest.example:8288/",
            endpoint: "wss://inngest.example:8288/gateway/v0/connect?token=secret-token"
        });
    });

    it("maps the self-hosted connect gateway port to the api port", () => {
        const result = durableConfigResolve({
            INNGEST_ENDPOINT: "ws://daycare-inngest:8289/v0/connect"
        });

        expect(result).toEqual({
            apiBaseUrl: "http://daycare-inngest:8288/",
            endpoint: "ws://daycare-inngest:8289/v0/connect"
        });
    });

    it("rejects non-websocket endpoint protocols", () => {
        expect(() =>
            durableConfigResolve({
                INNGEST_ENDPOINT: "https://inngest.example/connect"
            })
        ).toThrow("INNGEST_ENDPOINT must use ws or wss.");
    });
});

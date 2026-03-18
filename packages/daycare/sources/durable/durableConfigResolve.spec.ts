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
            endpoint: "wss://inngest.example/connect?token=secret-token"
        });
    });

    it("accepts insecure websocket endpoints when explicitly provided", () => {
        const result = durableConfigResolve({ INNGEST_ENDPOINT: "ws://inngest.example/connect" });

        expect(result).toEqual({
            endpoint: "ws://inngest.example/connect"
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

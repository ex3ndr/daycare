import { describe, expect, it } from "vitest";
import { appRequestEndpointsResolve } from "./appRequestEndpointsResolve.js";

describe("appRequestEndpointsResolve", () => {
    it("prefers configured endpoints over request headers", () => {
        const resolved = appRequestEndpointsResolve({
            host: "127.0.0.1",
            port: 7332,
            appEndpoint: "https://app.example.com",
            serverEndpoint: "https://api.example.com",
            headers: {
                origin: "https://ignored.example.com",
                host: "ignored-api.example.com"
            }
        });

        expect(resolved).toEqual({
            appEndpoint: "https://app.example.com",
            serverEndpoint: "https://api.example.com"
        });
    });

    it("derives app and api origins from request headers", () => {
        const resolved = appRequestEndpointsResolve({
            host: "127.0.0.1",
            port: 7332,
            headers: {
                origin: "https://app.customer.example/some/path",
                host: "api.customer.example",
                "x-forwarded-proto": "https"
            }
        });

        expect(resolved).toEqual({
            appEndpoint: "https://app.customer.example",
            serverEndpoint: "https://api.customer.example"
        });
    });

    it("falls back to local listener when request headers are unavailable", () => {
        const resolved = appRequestEndpointsResolve({
            host: "127.0.0.1",
            port: 7332
        });

        expect(resolved).toEqual({
            appEndpoint: "http://127.0.0.1:7332",
            serverEndpoint: "http://127.0.0.1:7332"
        });
    });
});

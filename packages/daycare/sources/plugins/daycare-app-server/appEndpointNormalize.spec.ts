import { describe, expect, it } from "vitest";
import { appEndpointNormalize } from "./appEndpointNormalize.js";

describe("appEndpointNormalize", () => {
    it("returns undefined for blank input", () => {
        expect(appEndpointNormalize(undefined, "appEndpoint")).toBeUndefined();
        expect(appEndpointNormalize("   ", "appEndpoint")).toBeUndefined();
    });

    it("normalizes endpoint and trims trailing slash", () => {
        expect(appEndpointNormalize("https://app.example.com/", "appEndpoint")).toBe("https://app.example.com");
        expect(appEndpointNormalize("http://127.0.0.1:7332///", "serverDomain")).toBe("http://127.0.0.1:7332");
    });

    it("throws for bare domains", () => {
        expect(() => appEndpointNormalize("app.example.com", "appEndpoint")).toThrow(
            "appEndpoint must be an endpoint URL"
        );
    });

    it("throws for urls with path/query/hash", () => {
        expect(() => appEndpointNormalize("https://app.example.com/path", "appEndpoint")).toThrow(
            "appEndpoint must not include a path."
        );
        expect(() => appEndpointNormalize("https://app.example.com/?a=1", "appEndpoint")).toThrow(
            "appEndpoint must not include query params or hash."
        );
        expect(() => appEndpointNormalize("https://app.example.com/#x", "appEndpoint")).toThrow(
            "appEndpoint must not include query params or hash."
        );
    });
});

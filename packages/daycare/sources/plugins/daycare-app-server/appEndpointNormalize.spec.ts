import { describe, expect, it } from "vitest";
import { appEndpointNormalize } from "./appEndpointNormalize.js";

describe("appEndpointNormalize", () => {
    it("returns undefined for blank input", () => {
        expect(appEndpointNormalize(undefined, "appDomain")).toBeUndefined();
        expect(appEndpointNormalize("   ", "appDomain")).toBeUndefined();
    });

    it("normalizes endpoint and trims trailing slash", () => {
        expect(appEndpointNormalize("https://app.example.com/", "appDomain")).toBe("https://app.example.com");
        expect(appEndpointNormalize("http://127.0.0.1:7332///", "serverDomain")).toBe("http://127.0.0.1:7332");
    });

    it("throws for bare domains", () => {
        expect(() => appEndpointNormalize("app.example.com", "appDomain")).toThrow("appDomain must be an endpoint URL");
    });

    it("throws for urls with path/query/hash", () => {
        expect(() => appEndpointNormalize("https://app.example.com/path", "appDomain")).toThrow(
            "appDomain must not include a path."
        );
        expect(() => appEndpointNormalize("https://app.example.com/?a=1", "appDomain")).toThrow(
            "appDomain must not include query params or hash."
        );
        expect(() => appEndpointNormalize("https://app.example.com/#x", "appDomain")).toThrow(
            "appDomain must not include query params or hash."
        );
    });
});

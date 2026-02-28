import { describe, expect, it } from "vitest";
import { appServerSettingsResolve } from "./appServerSettingsResolve.js";

describe("appServerSettingsResolve", () => {
    it("returns disabled defaults when settings are missing", () => {
        const resolved = appServerSettingsResolve(undefined);

        expect(resolved).toEqual({
            enabled: false,
            host: "127.0.0.1",
            port: 7332
        });
    });

    it("normalizes endpoint settings", () => {
        const resolved = appServerSettingsResolve({
            enabled: true,
            appEndpoint: "https://app.example.com/",
            serverEndpoint: "https://api.example.com/"
        });

        expect(resolved).toMatchObject({
            enabled: true,
            appEndpoint: "https://app.example.com",
            serverEndpoint: "https://api.example.com"
        });
    });
});

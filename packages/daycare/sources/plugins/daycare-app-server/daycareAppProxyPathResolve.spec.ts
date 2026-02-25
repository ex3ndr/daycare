import { describe, expect, it } from "vitest";
import { daycareAppProxyPathResolve } from "./daycareAppProxyPathResolve.js";

describe("daycareAppProxyPathResolve", () => {
    it("strips /api prefix for engine routes", () => {
        expect(daycareAppProxyPathResolve("/api/v1/engine/status", "")).toBe("/v1/engine/status");
    });

    it("maps /api root to slash", () => {
        expect(daycareAppProxyPathResolve("/api", "")).toBe("/");
    });

    it("preserves existing route and query", () => {
        expect(daycareAppProxyPathResolve("/v1/engine/events", "?watch=1")).toBe("/v1/engine/events?watch=1");
    });
});

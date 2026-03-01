import { describe, expect, it } from "vitest";

import { dashboardProxyPathResolve } from "./dashboardProxyPathResolve.js";

describe("dashboardProxyPathResolve", () => {
    it("strips /api prefix for engine routes", () => {
        expect(dashboardProxyPathResolve("/api/v1/engine/cron/tasks", "")).toBe("/v1/engine/cron/tasks");
    });

    it("preserves already-normalized engine routes", () => {
        expect(dashboardProxyPathResolve("/v1/engine/status", "?verbose=1")).toBe("/v1/engine/status?verbose=1");
    });

    it("maps /api root to /", () => {
        expect(dashboardProxyPathResolve("/api", "")).toBe("/");
    });
});

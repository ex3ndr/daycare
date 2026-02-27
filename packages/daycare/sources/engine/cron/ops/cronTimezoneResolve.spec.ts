import { describe, expect, it } from "vitest";
import { cronTimezoneResolve } from "./cronTimezoneResolve.js";

describe("cronTimezoneResolve", () => {
    it("returns explicit timezone when valid", () => {
        expect(cronTimezoneResolve({ timezone: "America/New_York" })).toBe("America/New_York");
    });

    it("throws for invalid explicit timezone", () => {
        expect(() => cronTimezoneResolve({ timezone: "Mars/Base" })).toThrow("Invalid cron timezone: Mars/Base");
    });

    it("falls back to profile timezone when explicit timezone is missing", () => {
        expect(cronTimezoneResolve({ profileTimezone: "Europe/Berlin" })).toBe("Europe/Berlin");
    });

    it("falls back to UTC when profile timezone is invalid", () => {
        expect(cronTimezoneResolve({ profileTimezone: "Mars/Base" })).toBe("UTC");
    });

    it("throws when timezone cannot be resolved and resolution is required", () => {
        expect(() => cronTimezoneResolve({ requireResolved: true })).toThrow("Timezone is required.");
    });
});

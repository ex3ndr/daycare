import { describe, expect, it } from "vitest";
import { contextCompactionLimitsBuild } from "./contextCompactionLimitsBuild.js";

describe("contextCompactionLimitsBuild", () => {
    it("derives warning and critical limits from the emergency limit", () => {
        expect(contextCompactionLimitsBuild({ emergencyLimit: 200_000 })).toEqual({
            emergencyLimit: 200_000,
            warningLimit: 150_000,
            criticalLimit: 180_000
        });
    });

    it("uses explicit warning and critical limits when provided", () => {
        expect(
            contextCompactionLimitsBuild({
                emergencyLimit: 1_000_000,
                warningLimit: 800_000,
                criticalLimit: 950_000
            })
        ).toEqual({
            emergencyLimit: 1_000_000,
            warningLimit: 800_000,
            criticalLimit: 950_000
        });
    });

    it("clamps invalid ordering to a monotonic range", () => {
        expect(
            contextCompactionLimitsBuild({
                emergencyLimit: 100,
                warningLimit: 120,
                criticalLimit: 80
            })
        ).toEqual({
            emergencyLimit: 100,
            warningLimit: 100,
            criticalLimit: 100
        });
    });
});

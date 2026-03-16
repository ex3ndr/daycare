import path from "node:path";

import { describe, expect, it } from "vitest";

import { configResolve } from "../../../config/configResolve.js";
import { contextCompactionLimitsResolve } from "./contextCompactionLimitsResolve.js";

describe("contextCompactionLimitsResolve", () => {
    it("uses global compaction limits when there is no model override", () => {
        const config = configResolve(
            {
                agents: {
                    compaction: {
                        emergencyLimit: 300_000
                    }
                }
            },
            path.resolve("/tmp/settings.json")
        );

        expect(contextCompactionLimitsResolve(config, { id: "anthropic", model: "claude-opus-4-6" })).toEqual({
            emergencyLimit: 300_000,
            warningLimit: 225_000,
            criticalLimit: 270_000
        });
    });

    it("derives per-model thresholds from an overridden emergency limit", () => {
        const config = configResolve(
            {
                agents: {
                    compaction: {
                        emergencyLimit: 200_000,
                        models: {
                            "anthropic/claude-opus-4-6": {
                                emergencyLimit: 1_000_000
                            }
                        }
                    }
                }
            },
            path.resolve("/tmp/settings.json")
        );

        expect(contextCompactionLimitsResolve(config, { id: "anthropic", model: "claude-opus-4-6" })).toEqual({
            emergencyLimit: 1_000_000,
            warningLimit: 750_000,
            criticalLimit: 900_000
        });
    });

    it("uses the resolved default provider model when the settings entry omits model", () => {
        const config = configResolve(
            {
                providers: [{ id: "anthropic" }],
                agents: {
                    compaction: {
                        models: {
                            "anthropic/claude-opus-4-6": {
                                emergencyLimit: 1_000_000
                            }
                        }
                    }
                }
            },
            path.resolve("/tmp/settings.json")
        );

        expect(contextCompactionLimitsResolve(config, { id: "anthropic" })).toEqual({
            emergencyLimit: 1_000_000,
            warningLimit: 750_000,
            criticalLimit: 900_000
        });
    });

    it("inherits explicit global thresholds when a model override only changes the critical limit", () => {
        const config = configResolve(
            {
                agents: {
                    compaction: {
                        emergencyLimit: 200_000,
                        warningLimit: 140_000,
                        criticalLimit: 175_000,
                        models: {
                            "anthropic/claude-opus-4-6": {
                                criticalLimit: 190_000
                            }
                        }
                    }
                }
            },
            path.resolve("/tmp/settings.json")
        );

        expect(contextCompactionLimitsResolve(config, { id: "anthropic", model: "claude-opus-4-6" })).toEqual({
            emergencyLimit: 200_000,
            warningLimit: 140_000,
            criticalLimit: 190_000
        });
    });
});

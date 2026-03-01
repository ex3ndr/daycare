import { describe, expect, it } from "vitest";
import type { SettingsConfig } from "../settings.js";
import {
    assignmentTargetClear,
    assignmentTargetParse,
    assignmentTargetSet,
    customFlavorNameValidate
} from "./models.js";

describe("models command helpers", () => {
    it("parses role assignment targets including task", () => {
        expect(assignmentTargetParse("role:task")).toEqual({
            type: "role",
            key: "task"
        });
    });

    it("parses flavor assignment targets", () => {
        expect(assignmentTargetParse("flavor:coding")).toEqual({
            type: "flavor",
            key: "coding"
        });
    });

    it("sets built-in flavor mapping with built-in description", () => {
        const settings: SettingsConfig = {};

        const result = assignmentTargetSet(settings, { type: "flavor", key: "small" }, "openai/gpt-5-mini");

        expect(result.modelFlavors?.small).toEqual({
            model: "openai/gpt-5-mini",
            description: "Fastest and lowest-cost path for lightweight tasks."
        });
    });

    it("preserves custom flavor description when updating model", () => {
        const settings: SettingsConfig = {
            modelFlavors: {
                coding: {
                    model: "openai/codex-mini",
                    description: "Optimized for code generation"
                }
            }
        };

        const result = assignmentTargetSet(settings, { type: "flavor", key: "coding" }, "openai/gpt-5-mini");

        expect(result.modelFlavors?.coding).toEqual({
            model: "openai/gpt-5-mini",
            description: "Optimized for code generation"
        });
    });

    it("clears flavor mappings", () => {
        const settings: SettingsConfig = {
            modelFlavors: {
                small: {
                    model: "openai/gpt-5-mini",
                    description: "Fastest and lowest-cost path for lightweight tasks."
                }
            }
        };

        const result = assignmentTargetClear(settings, { type: "flavor", key: "small" });
        expect(result.modelFlavors).toBeUndefined();
    });

    it("validates custom flavor names", () => {
        expect(customFlavorNameValidate("", {})).toBe("name is required");
        expect(customFlavorNameValidate("two words", {})).toBe("spaces are not allowed");
        expect(customFlavorNameValidate("small", {})).toBe("name cannot be a built-in flavor");
        expect(
            customFlavorNameValidate("coding", {
                Coding: {
                    model: "openai/codex-mini",
                    description: "Case-insensitive duplicate"
                }
            })
        ).toBe("flavor already exists");
        expect(customFlavorNameValidate("coding", {})).toBeNull();
    });
});

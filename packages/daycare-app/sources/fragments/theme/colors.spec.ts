import { describe, expect, it } from "vitest";
import type { Theme } from "@/theme";
import { colorResolve } from "./colors";

// Minimal theme stub with a few color roles for testing.
const theme = {
    colors: {
        primary: "#6B4F12",
        onPrimary: "#FFFFFF",
        onSurface: "#1C1B18",
        surfaceContainer: "#201E18",
        surfaceContainerHigh: "#2B2822"
    }
} as unknown as Theme;

describe("colorResolve", () => {
    it("returns undefined when value is null", () => {
        expect(colorResolve(null, theme)).toBeUndefined();
    });

    it("returns undefined when value is undefined", () => {
        expect(colorResolve(undefined, theme)).toBeUndefined();
    });

    it("returns undefined for empty string", () => {
        expect(colorResolve("", theme)).toBeUndefined();
    });

    it("resolves a known theme color role", () => {
        expect(colorResolve("primary", theme)).toBe("#6B4F12");
    });

    it("resolves another theme color role", () => {
        expect(colorResolve("onPrimary", theme)).toBe("#FFFFFF");
    });

    it("passes through a hex color string", () => {
        expect(colorResolve("#FF0000", theme)).toBe("#FF0000");
    });

    it("passes through an rgba color string", () => {
        expect(colorResolve("rgba(255,0,0,0.5)", theme)).toBe("rgba(255,0,0,0.5)");
    });

    it("passes through an rgb color string", () => {
        expect(colorResolve("rgb(0,128,255)", theme)).toBe("rgb(0,128,255)");
    });

    it("passes through a named CSS color", () => {
        expect(colorResolve("red", theme)).toBe("red");
    });

    it("passes through an unknown string that is not a theme role", () => {
        expect(colorResolve("notARole", theme)).toBe("notARole");
    });
});

import { describe, expect, it } from "vitest";
import { fontWeightResolve } from "./typography";

describe("fontWeightResolve", () => {
    it("returns IBMPlexSans-Regular for null", () => {
        expect(fontWeightResolve(null)).toBe("IBMPlexSans-Regular");
    });

    it("returns IBMPlexSans-Regular for undefined", () => {
        expect(fontWeightResolve(undefined)).toBe("IBMPlexSans-Regular");
    });

    it("returns IBMPlexSans-Regular for 'regular'", () => {
        expect(fontWeightResolve("regular")).toBe("IBMPlexSans-Regular");
    });

    it("returns IBMPlexSans-Medium for 'medium'", () => {
        expect(fontWeightResolve("medium")).toBe("IBMPlexSans-Medium");
    });

    it("returns IBMPlexSans-SemiBold for 'semibold'", () => {
        expect(fontWeightResolve("semibold")).toBe("IBMPlexSans-SemiBold");
    });

    it("passes through a custom font family string", () => {
        expect(fontWeightResolve("Helvetica-Bold")).toBe("Helvetica-Bold");
    });

    it("passes through another custom font family", () => {
        expect(fontWeightResolve("Roboto-Light")).toBe("Roboto-Light");
    });

    it("returns IBMPlexSans-Regular for empty string", () => {
        expect(fontWeightResolve("")).toBe("IBMPlexSans-Regular");
    });
});

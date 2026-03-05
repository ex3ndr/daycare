import { describe, expect, it } from "vitest";
import { flexAlignResolve, flexJustifyResolve } from "./flex";

describe("flexAlignResolve", () => {
    it("returns undefined for null", () => {
        expect(flexAlignResolve(null)).toBeUndefined();
    });

    it("returns undefined for undefined", () => {
        expect(flexAlignResolve(undefined)).toBeUndefined();
    });

    it("returns undefined for unknown value", () => {
        expect(flexAlignResolve("bogus")).toBeUndefined();
    });

    it("resolves 'start' to 'flex-start'", () => {
        expect(flexAlignResolve("start")).toBe("flex-start");
    });

    it("passes through 'flex-start'", () => {
        expect(flexAlignResolve("flex-start")).toBe("flex-start");
    });

    it("resolves 'end' to 'flex-end'", () => {
        expect(flexAlignResolve("end")).toBe("flex-end");
    });

    it("passes through 'flex-end'", () => {
        expect(flexAlignResolve("flex-end")).toBe("flex-end");
    });

    it("passes through 'center'", () => {
        expect(flexAlignResolve("center")).toBe("center");
    });

    it("passes through 'stretch'", () => {
        expect(flexAlignResolve("stretch")).toBe("stretch");
    });

    it("passes through 'baseline'", () => {
        expect(flexAlignResolve("baseline")).toBe("baseline");
    });
});

describe("flexJustifyResolve", () => {
    it("returns undefined for null", () => {
        expect(flexJustifyResolve(null)).toBeUndefined();
    });

    it("returns undefined for undefined", () => {
        expect(flexJustifyResolve(undefined)).toBeUndefined();
    });

    it("returns undefined for unknown value", () => {
        expect(flexJustifyResolve("bogus")).toBeUndefined();
    });

    it("resolves 'start' to 'flex-start'", () => {
        expect(flexJustifyResolve("start")).toBe("flex-start");
    });

    it("passes through 'flex-start'", () => {
        expect(flexJustifyResolve("flex-start")).toBe("flex-start");
    });

    it("resolves 'end' to 'flex-end'", () => {
        expect(flexJustifyResolve("end")).toBe("flex-end");
    });

    it("passes through 'flex-end'", () => {
        expect(flexJustifyResolve("flex-end")).toBe("flex-end");
    });

    it("resolves 'between' to 'space-between'", () => {
        expect(flexJustifyResolve("between")).toBe("space-between");
    });

    it("passes through 'space-between'", () => {
        expect(flexJustifyResolve("space-between")).toBe("space-between");
    });

    it("passes through 'center'", () => {
        expect(flexJustifyResolve("center")).toBe("center");
    });
});

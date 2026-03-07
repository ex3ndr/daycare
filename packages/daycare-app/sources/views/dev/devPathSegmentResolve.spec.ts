import { describe, expect, it } from "vitest";
import { devPathSegmentResolve } from "./devPathSegmentResolve";

describe("devPathSegmentResolve", () => {
    it("resolves bare dev routes", () => {
        expect(devPathSegmentResolve("/dev")).toBeUndefined();
        expect(devPathSegmentResolve("/dev/examples")).toBe("examples");
    });

    it("resolves workspace dev routes", () => {
        expect(devPathSegmentResolve("/workspace-a/dev")).toBeUndefined();
        expect(devPathSegmentResolve("/workspace-a/dev/showcase")).toBe("showcase");
        expect(devPathSegmentResolve("/workspace-a/dev/reading-list")).toBe("reading-list");
    });
});

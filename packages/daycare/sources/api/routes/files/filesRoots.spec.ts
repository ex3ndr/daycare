import { describe, expect, it } from "vitest";
import { filesRoots } from "./filesRoots.js";

describe("filesRoots", () => {
    it("returns ok with a non-empty roots array", () => {
        const result = filesRoots();
        expect(result.ok).toBe(true);
        expect(result.roots.length).toBeGreaterThan(0);
    });

    it("each root has id, label, and path", () => {
        const { roots } = filesRoots();
        for (const root of roots) {
            expect(typeof root.id).toBe("string");
            expect(typeof root.label).toBe("string");
            expect(typeof root.path).toBe("string");
        }
    });

    it("includes desktop, documents, downloads", () => {
        const ids = filesRoots().roots.map((r) => r.id);
        expect(ids).toContain("desktop");
        expect(ids).toContain("documents");
        expect(ids).toContain("downloads");
    });
});

import { describe, expect, it } from "vitest";
import { documentProtectedCheck } from "./documentProtectedCheck";
import type { DocumentItem } from "./documentsTypes";

function doc(overrides: Partial<DocumentItem> & { id: string; slug: string }): DocumentItem {
    return {
        title: overrides.slug,
        description: "",
        body: "",
        parentId: null,
        createdAt: 0,
        updatedAt: 0,
        ...overrides
    };
}

describe("documentProtectedCheck", () => {
    const items = [
        doc({ id: "mem", slug: "memory" }),
        doc({ id: "sys", slug: "system" }),
        doc({ id: "ppl", slug: "people" }),
        doc({ id: "docroot", slug: "document" }),
        doc({ id: "mem-child", slug: "notes", parentId: "mem" }),
        doc({ id: "sys-child", slug: "soul", parentId: "sys" }),
        doc({ id: "sys-grandchild", slug: "deep", parentId: "sys-child" }),
        doc({ id: "doc-child", slug: "readme", parentId: "docroot" })
    ];

    it("returns true for memory root", () => {
        expect(documentProtectedCheck(items[0], items)).toBe(true);
    });

    it("returns true for system root", () => {
        expect(documentProtectedCheck(items[1], items)).toBe(true);
    });

    it("returns true for people root", () => {
        expect(documentProtectedCheck(items[2], items)).toBe(true);
    });

    it("returns false for document root", () => {
        expect(documentProtectedCheck(items[3], items)).toBe(false);
    });

    it("returns true for child of memory", () => {
        expect(documentProtectedCheck(items[4], items)).toBe(true);
    });

    it("returns true for child of system", () => {
        expect(documentProtectedCheck(items[5], items)).toBe(true);
    });

    it("returns true for deeply nested child under system", () => {
        expect(documentProtectedCheck(items[6], items)).toBe(true);
    });

    it("returns false for child of document root", () => {
        expect(documentProtectedCheck(items[7], items)).toBe(false);
    });
});

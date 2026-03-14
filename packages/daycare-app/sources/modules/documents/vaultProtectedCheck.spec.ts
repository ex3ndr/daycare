import { describe, expect, it } from "vitest";
import { vaultProtectedCheck } from "./vaultProtectedCheck";
import type { VaultItem } from "./vaultsTypes";

function doc(overrides: Partial<VaultItem> & { id: string; slug: string }): VaultItem {
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

describe("vaultProtectedCheck", () => {
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
        expect(vaultProtectedCheck(items[0], items)).toBe(true);
    });

    it("returns true for system root", () => {
        expect(vaultProtectedCheck(items[1], items)).toBe(true);
    });

    it("returns true for people root", () => {
        expect(vaultProtectedCheck(items[2], items)).toBe(true);
    });

    it("returns false for document root", () => {
        expect(vaultProtectedCheck(items[3], items)).toBe(false);
    });

    it("returns true for child of memory", () => {
        expect(vaultProtectedCheck(items[4], items)).toBe(true);
    });

    it("returns true for child of system", () => {
        expect(vaultProtectedCheck(items[5], items)).toBe(true);
    });

    it("returns true for deeply nested child under system", () => {
        expect(vaultProtectedCheck(items[6], items)).toBe(true);
    });

    it("returns false for child of document root", () => {
        expect(vaultProtectedCheck(items[7], items)).toBe(false);
    });
});

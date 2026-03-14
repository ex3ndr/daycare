import { describe, expect, it } from "vitest";
import { vaultRootIdResolve } from "./vaultRootIdResolve";
import type { VaultItem } from "./vaultsTypes";

function doc(input: Partial<VaultItem> & Pick<VaultItem, "id" | "slug" | "title">): VaultItem {
    return {
        id: input.id,
        slug: input.slug,
        title: input.title,
        description: input.description ?? "",
        body: input.body ?? "",
        parentId: input.parentId ?? null,
        createdAt: input.createdAt ?? 0,
        updatedAt: input.updatedAt ?? 0
    };
}

describe("vaultRootIdResolve", () => {
    it("returns null when root is missing", () => {
        expect(vaultRootIdResolve([])).toBeNull();
        expect(vaultRootIdResolve([doc({ id: "a", slug: "memory", title: "Memory" })])).toBeNull();
    });

    it("returns the root vault id from the stored `document` slug", () => {
        const items = [
            doc({ id: "memory", slug: "memory", title: "Memory" }),
            doc({ id: "root-document", slug: "document", title: "Vault" }),
            doc({ id: "child", slug: "note", title: "Note", parentId: "root-document" })
        ];

        expect(vaultRootIdResolve(items)).toBe("root-document");
    });
});

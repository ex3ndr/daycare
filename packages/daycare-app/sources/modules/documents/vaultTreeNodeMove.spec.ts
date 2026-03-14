import { describe, expect, it } from "vitest";
import type { VaultItem } from "./vaultsTypes";
import { vaultTreeNodeMoveValidate } from "./vaultTreeNodeMove";

function makeDoc(id: string, parentId: string | null = null): VaultItem {
    return { id, slug: id, title: id, description: "", body: "", parentId, createdAt: 0, updatedAt: 0 };
}

describe("vaultTreeNodeMoveValidate", () => {
    it("allows moving to root", () => {
        const items = [makeDoc("a"), makeDoc("b", "a")];
        expect(vaultTreeNodeMoveValidate(items, "b", null)).toBe(true);
    });

    it("rejects moving to self", () => {
        const items = [makeDoc("a")];
        expect(vaultTreeNodeMoveValidate(items, "a", "a")).toBe(false);
    });

    it("rejects moving to a descendant", () => {
        const items = [makeDoc("a"), makeDoc("b", "a"), makeDoc("c", "b")];
        expect(vaultTreeNodeMoveValidate(items, "a", "c")).toBe(false);
    });

    it("allows moving to a non-descendant", () => {
        const items = [makeDoc("a"), makeDoc("b"), makeDoc("c", "b")];
        expect(vaultTreeNodeMoveValidate(items, "a", "b")).toBe(true);
    });

    it("allows moving a leaf to another branch", () => {
        const items = [makeDoc("a"), makeDoc("b"), makeDoc("c", "a")];
        expect(vaultTreeNodeMoveValidate(items, "c", "b")).toBe(true);
    });
});

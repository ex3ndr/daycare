import { describe, expect, it } from "vitest";
import type { DocumentItem } from "./documentsTypes";
import { documentTreeNodeMoveValidate } from "./documentTreeNodeMove";

function makeDoc(id: string, parentId: string | null = null): DocumentItem {
    return { id, slug: id, title: id, description: "", body: "", parentId, createdAt: 0, updatedAt: 0 };
}

describe("documentTreeNodeMoveValidate", () => {
    it("allows moving to root", () => {
        const items = [makeDoc("a"), makeDoc("b", "a")];
        expect(documentTreeNodeMoveValidate(items, "b", null)).toBe(true);
    });

    it("rejects moving to self", () => {
        const items = [makeDoc("a")];
        expect(documentTreeNodeMoveValidate(items, "a", "a")).toBe(false);
    });

    it("rejects moving to a descendant", () => {
        const items = [makeDoc("a"), makeDoc("b", "a"), makeDoc("c", "b")];
        expect(documentTreeNodeMoveValidate(items, "a", "c")).toBe(false);
    });

    it("allows moving to a non-descendant", () => {
        const items = [makeDoc("a"), makeDoc("b"), makeDoc("c", "b")];
        expect(documentTreeNodeMoveValidate(items, "a", "b")).toBe(true);
    });

    it("allows moving a leaf to another branch", () => {
        const items = [makeDoc("a"), makeDoc("b"), makeDoc("c", "a")];
        expect(documentTreeNodeMoveValidate(items, "c", "b")).toBe(true);
    });
});

import { describe, expect, it } from "vitest";
import type { DocumentItem } from "./documentsTypes";
import { documentTreeBuild } from "./documentTreeBuild";
import { documentTreeFlatten } from "./documentTreeFlatten";

function makeDoc(id: string, title: string, parentId: string | null = null): DocumentItem {
    return { id, slug: id, title, description: "", body: "", parentId, createdAt: 0, updatedAt: 0 };
}

describe("documentTreeFlatten", () => {
    it("returns empty for empty tree", () => {
        expect(documentTreeFlatten([], new Set())).toEqual([]);
    });

    it("returns roots only when nothing is expanded", () => {
        const items = [makeDoc("a", "A"), makeDoc("b", "B", "a")];
        const tree = documentTreeBuild(items);
        const flat = documentTreeFlatten(tree, new Set());
        expect(flat).toHaveLength(1);
        expect(flat[0].document.id).toBe("a");
        expect(flat[0].hasChildren).toBe(true);
        expect(flat[0].expanded).toBe(false);
        expect(flat[0].depth).toBe(0);
    });

    it("includes children when parent is expanded", () => {
        const items = [makeDoc("a", "A"), makeDoc("b", "B", "a")];
        const tree = documentTreeBuild(items);
        const flat = documentTreeFlatten(tree, new Set(["a"]));
        expect(flat).toHaveLength(2);
        expect(flat[0].document.id).toBe("a");
        expect(flat[0].expanded).toBe(true);
        expect(flat[1].document.id).toBe("b");
        expect(flat[1].depth).toBe(1);
    });

    it("handles deep expansion", () => {
        const items = [makeDoc("a", "A"), makeDoc("b", "B", "a"), makeDoc("c", "C", "b")];
        const tree = documentTreeBuild(items);
        const flat = documentTreeFlatten(tree, new Set(["a", "b"]));
        expect(flat).toHaveLength(3);
        expect(flat[2].document.id).toBe("c");
        expect(flat[2].depth).toBe(2);
    });
});

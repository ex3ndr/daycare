import { describe, expect, it } from "vitest";
import type { DocumentItem } from "./documentsTypes";
import { documentTreeBuild } from "./documentTreeBuild";

function makeDoc(id: string, title: string, parentId: string | null = null): DocumentItem {
    return { id, slug: id, title, description: "", body: "", parentId, createdAt: 0, updatedAt: 0 };
}

describe("documentTreeBuild", () => {
    it("returns empty array for empty input", () => {
        expect(documentTreeBuild([])).toEqual([]);
    });

    it("builds flat list of root documents", () => {
        const items = [makeDoc("a", "Alpha"), makeDoc("b", "Beta")];
        const tree = documentTreeBuild(items);
        expect(tree).toHaveLength(2);
        expect(tree[0].document.id).toBe("a");
        expect(tree[1].document.id).toBe("b");
        expect(tree[0].children).toEqual([]);
    });

    it("nests children under their parent", () => {
        const items = [makeDoc("root", "Root"), makeDoc("child", "Child", "root")];
        const tree = documentTreeBuild(items);
        expect(tree).toHaveLength(1);
        expect(tree[0].document.id).toBe("root");
        expect(tree[0].children).toHaveLength(1);
        expect(tree[0].children[0].document.id).toBe("child");
    });

    it("builds deep hierarchy", () => {
        const items = [makeDoc("a", "A"), makeDoc("b", "B", "a"), makeDoc("c", "C", "b")];
        const tree = documentTreeBuild(items);
        expect(tree).toHaveLength(1);
        expect(tree[0].children[0].children[0].document.id).toBe("c");
    });

    it("sorts siblings by title", () => {
        const items = [makeDoc("z", "Zebra"), makeDoc("a", "Apple"), makeDoc("m", "Mango")];
        const tree = documentTreeBuild(items);
        expect(tree.map((n) => n.document.id)).toEqual(["a", "m", "z"]);
    });
});

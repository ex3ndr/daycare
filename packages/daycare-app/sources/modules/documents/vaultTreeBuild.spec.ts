import { describe, expect, it } from "vitest";
import type { VaultItem } from "./vaultsTypes";
import { vaultTreeBuild } from "./vaultTreeBuild";

function makeDoc(id: string, title: string, parentId: string | null = null): VaultItem {
    return { id, slug: id, title, description: "", body: "", parentId, createdAt: 0, updatedAt: 0 };
}

describe("vaultTreeBuild", () => {
    it("returns empty array for empty input", () => {
        expect(vaultTreeBuild([])).toEqual([]);
    });

    it("builds flat list of root documents", () => {
        const items = [makeDoc("a", "Alpha"), makeDoc("b", "Beta")];
        const tree = vaultTreeBuild(items);
        expect(tree).toHaveLength(2);
        expect(tree[0].document.id).toBe("a");
        expect(tree[1].document.id).toBe("b");
        expect(tree[0].children).toEqual([]);
    });

    it("nests children under their parent", () => {
        const items = [makeDoc("root", "Root"), makeDoc("child", "Child", "root")];
        const tree = vaultTreeBuild(items);
        expect(tree).toHaveLength(1);
        expect(tree[0].document.id).toBe("root");
        expect(tree[0].children).toHaveLength(1);
        expect(tree[0].children[0].document.id).toBe("child");
    });

    it("builds deep hierarchy", () => {
        const items = [makeDoc("a", "A"), makeDoc("b", "B", "a"), makeDoc("c", "C", "b")];
        const tree = vaultTreeBuild(items);
        expect(tree).toHaveLength(1);
        expect(tree[0].children[0].children[0].document.id).toBe("c");
    });

    it("sorts siblings by title", () => {
        const items = [makeDoc("z", "Zebra"), makeDoc("a", "Apple"), makeDoc("m", "Mango")];
        const tree = vaultTreeBuild(items);
        expect(tree.map((n) => n.document.id)).toEqual(["a", "m", "z"]);
    });
});

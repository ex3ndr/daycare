import { describe, expect, it } from "vitest";

import { graphTreeBuild } from "./graphTreeBuild.js";
import type { GraphNode } from "./graphTypes.js";

function nodeCreate(input: { id: string; title: string; parents?: string[]; refs?: string[] }): GraphNode {
    return {
        id: input.id,
        frontmatter: {
            title: input.title,
            description: `${input.title} description`,
            parents: input.parents ?? ["__root__"],
            version: 1,
            createdAt: 1,
            updatedAt: 1
        },
        content: "",
        refs: input.refs ?? []
    };
}

describe("graphTreeBuild", () => {
    it("builds tree from frontmatter parents", () => {
        const root = nodeCreate({ id: "__root__", title: "Memory Summary", parents: [] });
        const prefs = nodeCreate({ id: "prefs", title: "Preferences", parents: ["__root__"] });
        const darkMode = nodeCreate({ id: "dark-mode", title: "Dark mode", parents: ["prefs"] });

        const tree = graphTreeBuild([root, prefs, darkMode]);

        const rootChildren = tree.children.get("__root__") ?? [];
        expect(rootChildren.map((c) => c.id)).toEqual(["prefs"]);

        const prefsChildren = tree.children.get("prefs") ?? [];
        expect(prefsChildren.map((c) => c.id)).toEqual(["dark-mode"]);
    });

    it("supports multiple parents for one node", () => {
        const root = nodeCreate({ id: "__root__", title: "Memory Summary", parents: [] });
        const source = nodeCreate({ id: "source", title: "Source", parents: ["__root__"] });
        const target = nodeCreate({ id: "target", title: "Target", parents: ["source", "__root__"] });

        const tree = graphTreeBuild([root, source, target]);
        const sourceChildren = tree.children.get("source") ?? [];
        const rootChildren = tree.children.get("__root__") ?? [];

        expect(sourceChildren.map((child) => child.id)).toContain("target");
        expect(rootChildren.map((child) => child.id)).toContain("target");
    });

    it("attaches nodes with unknown parents to root", () => {
        const root = nodeCreate({ id: "__root__", title: "Memory Summary", parents: [] });
        const orphan = nodeCreate({ id: "orphan", title: "Orphan", parents: ["missing-parent"] });

        const tree = graphTreeBuild([root, orphan]);
        const rootChildren = tree.children.get("__root__") ?? [];

        expect(rootChildren.map((child) => child.id)).toContain("orphan");
    });
});

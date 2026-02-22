import { describe, expect, it } from "vitest";

import { graphTreeBuild } from "./graphTreeBuild.js";
import type { GraphNode } from "./graphTypes.js";

function nodeCreate(input: { id: string; title: string; refs?: string[] }): GraphNode {
    return {
        id: input.id,
        frontmatter: {
            title: input.title,
            description: "",
            createdAt: 1,
            updatedAt: 1
        },
        content: "",
        refs: input.refs ?? []
    };
}

describe("graphTreeBuild", () => {
    it("builds tree from refs", () => {
        const root = nodeCreate({ id: "__root__", title: "Memory Summary", refs: ["prefs"] });
        const prefs = nodeCreate({ id: "prefs", title: "Preferences", refs: ["dark-mode"] });
        const darkMode = nodeCreate({ id: "dark-mode", title: "Dark mode" });

        const tree = graphTreeBuild([root, prefs, darkMode]);

        const rootChildren = tree.children.get("__root__") ?? [];
        expect(rootChildren.map((c) => c.id)).toEqual(["prefs"]);

        const prefsChildren = tree.children.get("prefs") ?? [];
        expect(prefsChildren.map((c) => c.id)).toEqual(["dark-mode"]);
    });

    it("adds cross-reference edges as parent-child links", () => {
        const root = nodeCreate({ id: "__root__", title: "Memory Summary" });
        const source = nodeCreate({ id: "source", title: "Source", refs: ["target"] });
        const target = nodeCreate({ id: "target", title: "Target" });

        const tree = graphTreeBuild([root, source, target]);
        const sourceChildren = tree.children.get("source") ?? [];

        expect(sourceChildren.map((child) => child.id)).toContain("target");
    });

    it("attaches orphan nodes to root", () => {
        const root = nodeCreate({ id: "__root__", title: "Memory Summary" });
        const orphan = nodeCreate({ id: "orphan", title: "Orphan" });

        const tree = graphTreeBuild([root, orphan]);
        const rootChildren = tree.children.get("__root__") ?? [];

        expect(rootChildren.map((child) => child.id)).toContain("orphan");
    });
});

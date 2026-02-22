import { describe, expect, it } from "vitest";

import { graphTreeBuild } from "./graphTreeBuild.js";
import type { GraphNode } from "./graphTypes.js";

function nodeCreate(input: { id: string; title: string; path?: string[]; refs?: string[] }): GraphNode {
    return {
        id: input.id,
        frontmatter: {
            title: input.title,
            description: "",
            path: input.path ?? [],
            createdAt: 1,
            updatedAt: 1
        },
        content: "",
        refs: input.refs ?? []
    };
}

describe("graphTreeBuild", () => {
    it("builds nested tree with synthesized folder nodes", () => {
        const root = nodeCreate({ id: "__root__", title: "Memory Summary" });
        const nodeA = nodeCreate({ id: "node-a", title: "Dark mode", path: ["preferences", "ui"] });
        const nodeB = nodeCreate({ id: "node-b", title: "Notifications", path: ["preferences", "alerts"] });

        const tree = graphTreeBuild([root, nodeA, nodeB]);

        const rootChildren = tree.children.get("__root__") ?? [];
        expect(rootChildren.some((child) => child.frontmatter.title === "preferences")).toBe(true);

        const folderPreferences = rootChildren.find((child) => child.frontmatter.title === "preferences");
        expect(folderPreferences).toBeTruthy();
        const preferencesChildren = tree.children.get(folderPreferences!.id) ?? [];
        expect(preferencesChildren.map((child) => child.frontmatter.title).sort()).toEqual(["alerts", "ui"]);
    });

    it("adds cross-reference edges as additional parent-child links", () => {
        const root = nodeCreate({ id: "__root__", title: "Memory Summary" });
        const source = nodeCreate({ id: "source", title: "Source", refs: ["target"] });
        const target = nodeCreate({ id: "target", title: "Target", path: ["topics"] });

        const tree = graphTreeBuild([root, source, target]);
        const sourceChildren = tree.children.get("source") ?? [];

        expect(sourceChildren.map((child) => child.id)).toContain("target");
    });

    it("keeps orphan-like nodes reachable from root", () => {
        const root = nodeCreate({ id: "__root__", title: "Memory Summary" });
        const orphan = nodeCreate({ id: "orphan", title: "Orphan", path: [] });

        const tree = graphTreeBuild([root, orphan]);
        const rootChildren = tree.children.get("__root__") ?? [];

        expect(rootChildren.map((child) => child.id)).toContain("orphan");
    });
});

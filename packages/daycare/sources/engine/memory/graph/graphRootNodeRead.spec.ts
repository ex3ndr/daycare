import { describe, expect, it } from "vitest";

import { graphRootNodeRead } from "./graphRootNodeRead.js";

describe("graphRootNodeRead", () => {
    it("returns virtual root node with bundled prompt content", async () => {
        const root = await graphRootNodeRead();

        expect(root.id).toBe("__root__");
        expect(root.frontmatter.title).toBe("Memory Summary");
        expect(root.frontmatter.description).toBe("Structured summary of all memories");
        expect(root.content).toContain("Memory Graph");
        expect(root.refs).toEqual([]);
    });
});

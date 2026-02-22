import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { graphStoreEnsureRoot } from "./graphStoreEnsureRoot.js";
import { graphStoreWrite } from "./graphStoreWrite.js";
import type { GraphNode } from "./graphTypes.js";

describe("graphStoreEnsureRoot", () => {
    let memoryDir: string;

    beforeEach(async () => {
        memoryDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-graph-root-"));
    });

    afterEach(async () => {
        await fs.rm(memoryDir, { recursive: true, force: true });
    });

    it("creates root file when missing", async () => {
        const root = await graphStoreEnsureRoot(memoryDir);

        expect(root.id).toBe("__root__");
        expect(root.frontmatter.path).toEqual([]);
        const exists = await fs.stat(path.join(memoryDir, "__root__.md"));
        expect(exists.isFile()).toBe(true);
    });

    it("returns existing root without overwriting", async () => {
        const existing: GraphNode = {
            id: "__root__",
            frontmatter: {
                title: "Custom Root",
                description: "Kept",
                path: [],
                createdAt: 10,
                updatedAt: 20
            },
            content: "Existing root body",
            refs: []
        };
        await graphStoreWrite(memoryDir, existing);

        const root = await graphStoreEnsureRoot(memoryDir);

        expect(root.frontmatter.title).toBe("Custom Root");
        expect(root.content).toContain("Existing root body");
    });
});

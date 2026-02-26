import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { GraphNode } from "./graphTypes.js";
import { graphVersionRead } from "./graphVersionRead.js";
import { graphVersionWrite } from "./graphVersionWrite.js";

describe("graphVersionRead", () => {
    let memoryDir: string;

    beforeEach(async () => {
        memoryDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-graph-version-read-"));
    });

    afterEach(async () => {
        await fs.rm(memoryDir, { recursive: true, force: true });
    });

    it("reads node versions sorted by version and ignores unrelated files", async () => {
        const versionTwo: GraphNode = {
            id: "node-1",
            frontmatter: {
                title: "Node 1",
                description: "Description",
                parents: ["__root__"],
                version: 2,
                createdAt: 100,
                updatedAt: 200
            },
            content: "Version 2 body",
            refs: ["ref-b"]
        };
        const versionOne: GraphNode = {
            ...versionTwo,
            frontmatter: {
                ...versionTwo.frontmatter,
                version: 1,
                updatedAt: 150
            },
            content: "Version 1 body",
            refs: ["ref-a"]
        };
        const otherNodeVersion: GraphNode = {
            ...versionOne,
            id: "other-node"
        };

        await graphVersionWrite(memoryDir, versionTwo, "Second revision");
        await graphVersionWrite(memoryDir, versionOne, "Initial revision");
        await graphVersionWrite(memoryDir, otherNodeVersion, "Other node revision");
        await fs.writeFile(path.join(memoryDir, "node-1.md"), "active node", "utf8");

        const versions = await graphVersionRead(memoryDir, "node-1");

        expect(versions).toHaveLength(2);
        expect(versions[0]?.frontmatter.version).toBe(1);
        expect(versions[0]?.content).toBe("Version 1 body");
        expect(versions[0]?.changeDescription).toBe("Initial revision");
        expect(versions[1]?.frontmatter.version).toBe(2);
        expect(versions[1]?.content).toBe("Version 2 body");
        expect(versions[1]?.changeDescription).toBe("Second revision");
    });

    it("returns empty list when memory dir does not exist", async () => {
        const missingDir = path.join(memoryDir, "missing");
        const versions = await graphVersionRead(missingDir, "node-1");
        expect(versions).toEqual([]);
    });
});

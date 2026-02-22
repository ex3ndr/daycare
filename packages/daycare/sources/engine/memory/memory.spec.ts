import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { GraphNode } from "./graph/graphTypes.js";
import { Memory } from "./memory.js";

describe("Memory", () => {
    let usersDir: string;

    beforeEach(async () => {
        usersDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-memory-facade-"));
    });

    afterEach(async () => {
        await fs.rm(usersDir, { recursive: true, force: true });
    });

    it("readGraph returns virtual root and creates graph directory", async () => {
        const memory = new Memory({ usersDir });

        const tree = await memory.readGraph("usr_001");

        expect(tree.root.id).toBe("__root__");
        expect(tree.root.content).toContain("Memory Graph");
        const graphDir = path.join(usersDir, "usr_001", "memory", "graph");
        const stat = await fs.stat(graphDir);
        expect(stat.isDirectory()).toBe(true);
    });

    it("readNode returns virtual root for __root__", async () => {
        const memory = new Memory({ usersDir });

        const root = await memory.readNode("usr_001", "__root__");

        expect(root).not.toBeNull();
        expect(root!.id).toBe("__root__");
        expect(root!.content).toContain("Memory Graph");
    });

    it("append updates body and updatedAt while preserving frontmatter", async () => {
        const memory = new Memory({ usersDir });
        const node: GraphNode = {
            id: "node-1",
            frontmatter: {
                title: "Preference",
                description: "User preference",
                createdAt: 100,
                updatedAt: 100
            },
            content: "Initial line",
            refs: []
        };

        await memory.writeNode("usr_001", node);
        await memory.append("usr_001", "node-1", "Appended line");

        const updated = await memory.readNode("usr_001", "node-1");
        expect(updated).not.toBeNull();
        expect(updated?.frontmatter.title).toBe("Preference");
        expect(updated?.frontmatter.description).toBe("User preference");
        expect(updated?.frontmatter.updatedAt).toBeGreaterThan(100);
        expect(updated?.content).toBe("Initial line\nAppended line");
    });
});

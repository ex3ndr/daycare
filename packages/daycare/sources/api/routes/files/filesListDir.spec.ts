import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { filesListDir } from "./filesListDir.js";

describe("filesListDir", () => {
    let tmpDir: string;

    beforeEach(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "filesListDir-"));
    });

    afterEach(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it("rejects empty path", async () => {
        const result = await filesListDir({ homeDir: tmpDir, requestedPath: "" });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.statusCode).toBe(400);
    });

    it("rejects path traversal", async () => {
        const result = await filesListDir({ homeDir: tmpDir, requestedPath: "../etc" });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.statusCode).toBe(400);
    });

    it("lists files and directories", async () => {
        const sub = path.join(tmpDir, "test");
        await fs.mkdir(sub);
        await fs.mkdir(path.join(sub, "folder"));
        await fs.writeFile(path.join(sub, "file.txt"), "hello");

        const result = await filesListDir({ homeDir: tmpDir, requestedPath: "test" });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.entries).toHaveLength(2);
            // directories first
            const [first, second] = result.entries;
            expect(first!.name).toBe("folder");
            expect(first!.type).toBe("directory");
            expect(second!.name).toBe("file.txt");
            expect(second!.type).toBe("file");
        }
    });

    it("skips dotfiles", async () => {
        const sub = path.join(tmpDir, "test");
        await fs.mkdir(sub);
        await fs.writeFile(path.join(sub, ".hidden"), "secret");
        await fs.writeFile(path.join(sub, "visible.txt"), "hello");

        const result = await filesListDir({ homeDir: tmpDir, requestedPath: "test" });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.entries).toHaveLength(1);
            expect(result.entries[0]!.name).toBe("visible.txt");
        }
    });

    it("returns 404 for missing directory", async () => {
        const result = await filesListDir({ homeDir: tmpDir, requestedPath: "newdir" });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.statusCode).toBe(404);
    });
});

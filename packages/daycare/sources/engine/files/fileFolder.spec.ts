import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { FileFolder } from "./fileFolder.js";

describe("FileFolder", () => {
    let rootDir: string;

    beforeEach(async () => {
        rootDir = await mkdtemp(path.join(os.tmpdir(), "daycare-file-folder-"));
    });

    afterEach(async () => {
        await rm(rootDir, { recursive: true, force: true });
    });

    it("saveBuffer stores files under the configured folder", async () => {
        const folderPath = path.join(rootDir, "home", "downloads");
        const folder = new FileFolder(folderPath);
        const saved = await folder.saveBuffer({
            name: "hello.txt",
            mimeType: "text/plain",
            data: Buffer.from("hello")
        });

        expect(saved.path.startsWith(path.resolve(folderPath))).toBe(true);
        expect(saved.name).toBe("hello.txt");
        expect(saved.size).toBe(5);
    });

    it("saveFromPath copies source files into the configured folder", async () => {
        const sourcePath = path.join(rootDir, "source.txt");
        await writeFile(sourcePath, "copied");
        const folderPath = path.join(rootDir, "home", "downloads");
        const folder = new FileFolder(folderPath);

        const saved = await folder.saveFromPath({
            name: "copied.txt",
            mimeType: "text/plain",
            path: sourcePath
        });

        expect(saved.path.startsWith(path.resolve(folderPath))).toBe(true);
        expect(saved.name).toBe("copied.txt");
        expect(saved.size).toBe(6);
    });
});

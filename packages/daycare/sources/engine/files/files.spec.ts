import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Files } from "./files.js";

describe("Files", () => {
    let rootDir: string;

    beforeEach(async () => {
        rootDir = await mkdtemp(path.join(os.tmpdir(), "daycare-files-facade-"));
    });

    afterEach(async () => {
        await rm(rootDir, { recursive: true, force: true });
    });

    it("creates downloads, desktop, and tmp folders from home path", async () => {
        const homePath = path.join(rootDir, "home");
        const files = new Files(homePath);

        expect(files.downloads.path).toBe(path.resolve(path.join(homePath, "downloads")));
        expect(files.desktop.path).toBe(path.resolve(path.join(homePath, "desktop")));
        expect(files.tmp.path).toBe(path.resolve(path.join(homePath, "tmp")));
    });

    it("writes files in each managed folder", async () => {
        const homePath = path.join(rootDir, "home");
        const files = new Files(homePath);

        const savedDownloads = await files.downloads.saveBuffer({
            name: "downloads.txt",
            mimeType: "text/plain",
            data: Buffer.from("downloads")
        });
        const savedDesktop = await files.desktop.saveBuffer({
            name: "desktop.txt",
            mimeType: "text/plain",
            data: Buffer.from("desktop")
        });
        const savedTmp = await files.tmp.saveBuffer({
            name: "tmp.txt",
            mimeType: "text/plain",
            data: Buffer.from("tmp")
        });

        expect(savedDownloads.path.startsWith(files.downloads.path)).toBe(true);
        expect(savedDesktop.path.startsWith(files.desktop.path)).toBe(true);
        expect(savedTmp.path.startsWith(files.tmp.path)).toBe(true);
    });
});

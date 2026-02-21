import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import type { SessionPermissions } from "@/types";
import { FileFolder } from "../../files/fileFolder.js";
import { sayFileResolve } from "./sayFileResolve.js";

describe("sayFileResolve", () => {
    it("copies tagged files into the file store when resolving", async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-say-file-resolve-"));
        try {
            const fileStore = new FileFolder(path.join(tempDir, "files-store"));
            const saved = await fileStore.saveBuffer({
                name: "report.txt",
                mimeType: "text/plain",
                data: Buffer.from("hello")
            });

            const result = await sayFileResolve({
                files: [{ path: saved.path, mode: "document" }],
                fileStore,
                permissions: permissionsBuild(tempDir),
                logger: loggerBuild()
            });

            expect(result).toHaveLength(1);
            expect(result[0]?.mimeType).toBe(saved.mimeType);
            expect(result[0]?.size).toBe(saved.size);
            expect(result[0]?.sendAs).toBe("document");
            expect(result[0]?.id).not.toBe(saved.id);
            expect(result[0]?.path).not.toBe(saved.path);
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    it("resolves filesystem files and stores them before sending", async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-say-file-resolve-"));
        try {
            const workingDir = path.join(tempDir, "workspace");
            const filesDir = path.join(tempDir, "files-store");
            await fs.mkdir(workingDir, { recursive: true });
            await fs.writeFile(path.join(workingDir, "notes.txt"), "notes");

            const fileStore = new FileFolder(filesDir);
            const result = await sayFileResolve({
                files: [{ path: path.join(workingDir, "notes.txt"), mode: "auto" }],
                fileStore,
                permissions: permissionsBuild(workingDir),
                logger: loggerBuild()
            });

            expect(result).toHaveLength(1);
            expect(result[0]?.name).toBe("notes.txt");
            expect(result[0]?.mimeType).toBe("text/plain");
            expect(result[0]?.path.startsWith(path.resolve(filesDir))).toBe(true);
            expect(result[0]?.sendAs).toBe("auto");
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    it("logs and skips unresolved file paths", async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-say-file-resolve-"));
        try {
            const logger = loggerBuild();
            const fileStore = new FileFolder(path.join(tempDir, "files-store"));

            const result = await sayFileResolve({
                files: [{ path: "/definitely/missing/file.txt", mode: "auto" }],
                fileStore,
                permissions: permissionsBuild(tempDir),
                logger
            });

            expect(result).toEqual([]);
            expect(logger.warn).toHaveBeenCalledTimes(1);
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });
});

function permissionsBuild(workingDir: string): SessionPermissions {
    return {
        workingDir,
        writeDirs: [workingDir]
    };
}

function loggerBuild() {
    return {
        warn: vi.fn(),
        debug: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        fatal: vi.fn(),
        trace: vi.fn(),
        level: "info"
    } as unknown as Parameters<typeof sayFileResolve>[0]["logger"];
}

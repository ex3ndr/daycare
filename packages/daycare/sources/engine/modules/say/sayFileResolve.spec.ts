import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { Sandbox } from "../../../sandbox/sandbox.js";
import { sayFileResolve } from "./sayFileResolve.js";

describe("sayFileResolve", () => {
    it("copies tagged files into downloads when resolving", async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-say-file-resolve-"));
        try {
            const sourcePath = path.join(tempDir, "report.txt");
            await fs.writeFile(sourcePath, Buffer.from("hello"));
            const sandbox = sandboxBuild(tempDir, tempDir);

            const result = await sayFileResolve({
                files: [{ path: sourcePath, mode: "document" }],
                sandbox,
                logger: loggerBuild()
            });

            expect(result).toHaveLength(1);
            expect(result[0]?.mimeType).toBe("text/plain");
            expect(result[0]?.size).toBe(5);
            expect(result[0]?.sendAs).toBe("document");
            expect(result[0]?.id).toBe("~/downloads/report.txt");
            const resolvedPath = result[0]?.path ? await fs.realpath(result[0]!.path) : null;
            expect(resolvedPath).toBe(await fs.realpath(path.join(tempDir, "downloads", "report.txt")));
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    it("resolves filesystem files and stores them in downloads before sending", async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-say-file-resolve-"));
        try {
            const workingDir = path.join(tempDir, "workspace");
            await fs.mkdir(workingDir, { recursive: true });
            await fs.writeFile(path.join(workingDir, "notes.txt"), "notes");
            const sandbox = sandboxBuild(tempDir, workingDir);
            const result = await sayFileResolve({
                files: [{ path: path.join(workingDir, "notes.txt"), mode: "auto" }],
                sandbox,
                logger: loggerBuild()
            });

            expect(result).toHaveLength(1);
            expect(result[0]?.name).toBe("notes.txt");
            expect(result[0]?.mimeType).toBe("text/plain");
            const downloadsRealPath = await fs.realpath(path.join(tempDir, "downloads"));
            const resolvedPath = result[0]?.path ? await fs.realpath(result[0]!.path) : null;
            expect(resolvedPath?.startsWith(downloadsRealPath)).toBe(true);
            expect(result[0]?.sendAs).toBe("auto");
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    it("logs and skips unresolved file paths", async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-say-file-resolve-"));
        try {
            const logger = loggerBuild();
            const sandbox = sandboxBuild(tempDir, tempDir);

            const result = await sayFileResolve({
                files: [{ path: "/definitely/missing/file.txt", mode: "auto" }],
                sandbox,
                logger
            });

            expect(result).toEqual([]);
            expect(logger.warn).toHaveBeenCalledTimes(1);
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });
});

function sandboxBuild(homeDir: string, workingDir: string): Sandbox {
    return new Sandbox({
        homeDir,
        permissions: {
            workingDir,
            writeDirs: [homeDir]
        }
    });
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

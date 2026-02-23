import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionPermissions } from "@/types";
import { sandboxCanWrite } from "./sandboxCanWrite.js";

describe("sandboxCanWrite", () => {
    let workingDir: string;
    let outsideDir: string;
    let homeDir: string;
    let sensitiveFile: string;
    let dangerousFile: string;
    let dangerousHookFile: string;
    let appFile: string;

    beforeEach(async () => {
        workingDir = await fs.mkdtemp(path.join(os.tmpdir(), "sandbox-can-write-workspace-"));
        outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), "sandbox-can-write-outside-"));
        homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "sandbox-can-write-home-"));
        vi.spyOn(os, "homedir").mockReturnValue(homeDir);
        sensitiveFile = path.join(homeDir, ".ssh", "authorized_keys");
        dangerousFile = path.join(outsideDir, ".bashrc");
        dangerousHookFile = path.join(outsideDir, ".git", "hooks", "pre-commit");
        await fs.mkdir(path.dirname(sensitiveFile), { recursive: true });
        await fs.mkdir(path.dirname(dangerousHookFile), { recursive: true });
        appFile = path.join(workingDir, "apps", "my-app", "APP.md");
        await fs.mkdir(path.dirname(appFile), { recursive: true });
    });

    afterEach(async () => {
        await fs.rm(workingDir, { recursive: true, force: true });
        await fs.rm(outsideDir, { recursive: true, force: true });
        await fs.rm(homeDir, { recursive: true, force: true });
        vi.restoreAllMocks();
    });

    it("rejects writing within the workspace when not explicitly granted", async () => {
        const permissions = buildPermissions(workingDir, []);
        const target = path.join(workingDir, "nested", "output.txt");

        await expect(sandboxCanWrite(permissions, target)).rejects.toThrow("Path is outside the allowed directories.");
    });

    it("allows writing within explicitly granted write directories", async () => {
        const permissions = buildPermissions(workingDir, [outsideDir]);
        const target = path.join(outsideDir, "output.txt");

        const result = await sandboxCanWrite(permissions, target);

        expect(result).toBe(path.join(await fs.realpath(outsideDir), "output.txt"));
    });

    it("allows writing in workspace when workspace is explicitly granted", async () => {
        const permissions = buildPermissions(workingDir, [workingDir]);
        const target = path.join(workingDir, "nested", "output.txt");

        const result = await sandboxCanWrite(permissions, target);

        expect(result).toBe(path.join(await fs.realpath(workingDir), "nested", "output.txt"));
    });

    it("rejects paths outside the write allowlist", async () => {
        const permissions = buildPermissions(workingDir, []);
        const target = path.join(outsideDir, "blocked.txt");

        await expect(sandboxCanWrite(permissions, target)).rejects.toThrow("Path is outside the allowed directories.");
    });

    it("denies writing to sensitive paths even when parent is in writeDirs", async () => {
        const permissions = buildPermissions(workingDir, [homeDir]);

        await expect(sandboxCanWrite(permissions, sensitiveFile)).rejects.toThrow(
            "Read access denied for denied paths."
        );
    });

    it("denies writes when target path is not readable", async () => {
        const permissions = buildPermissions(workingDir, [homeDir]);
        const target = path.join(homeDir, "notes", "blind-write.txt");

        await expect(sandboxCanWrite(permissions, target)).rejects.toThrow("Read access denied for denied paths.");
    });

    it("denies writing dangerous filenames in allowed writeDirs", async () => {
        const permissions = buildPermissions(workingDir, [outsideDir]);

        await expect(sandboxCanWrite(permissions, dangerousFile)).rejects.toThrow(
            "Write access denied for dangerous files or directories."
        );
    });

    it("denies writing under dangerous directories in allowed writeDirs", async () => {
        const permissions = buildPermissions(workingDir, [outsideDir]);

        await expect(sandboxCanWrite(permissions, dangerousHookFile)).rejects.toThrow(
            "Write access denied for dangerous files or directories."
        );
    });

    it("allows writing regular files in allowed writeDirs", async () => {
        const permissions = buildPermissions(workingDir, [outsideDir]);
        const target = path.join(outsideDir, "notes", "output.txt");

        const result = await sandboxCanWrite(permissions, target);

        expect(result).toBe(path.join(await fs.realpath(outsideDir), "notes", "output.txt"));
    });

    it("denies non-app agents from writing app directories", async () => {
        const permissions = buildPermissions(workingDir, [workingDir]);

        await expect(sandboxCanWrite(permissions, appFile)).rejects.toThrow(
            "App directories are not accessible from non-app agents."
        );
    });
});

function buildPermissions(workingDir: string, writeDirs: string[]): SessionPermissions {
    return {
        workingDir: path.resolve(workingDir),
        writeDirs: writeDirs.map((entry) => path.resolve(entry))
    };
}

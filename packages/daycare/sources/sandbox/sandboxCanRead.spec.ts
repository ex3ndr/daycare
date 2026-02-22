import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionPermissions } from "@/types";
import { sandboxCanRead } from "./sandboxCanRead.js";

describe("sandboxCanRead", () => {
    let workingDir: string;
    let outsideDir: string;
    let outsideFile: string;
    let homeDir: string;
    let homeSensitiveFile: string;
    let homeRandomFile: string;
    let homeWorkspaceFile: string;
    let homeWriteDirFile: string;
    let appFile: string;
    let otherAppFile: string;

    beforeEach(async () => {
        workingDir = await fs.mkdtemp(path.join(os.tmpdir(), "sandbox-can-read-workspace-"));
        outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), "sandbox-can-read-outside-"));
        homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "sandbox-can-read-home-"));
        vi.spyOn(os, "homedir").mockReturnValue(homeDir);

        outsideFile = path.join(outsideDir, "outside.txt");
        await fs.writeFile(outsideFile, "outside-content", "utf8");

        homeSensitiveFile = path.join(homeDir, ".ssh", "id_rsa");
        homeRandomFile = path.join(homeDir, "random.txt");
        homeWorkspaceFile = path.join(homeDir, "workspace", "notes.txt");
        homeWriteDirFile = path.join(homeDir, "allowed", "data.txt");
        await fs.mkdir(path.dirname(homeSensitiveFile), { recursive: true });
        await fs.mkdir(path.dirname(homeWorkspaceFile), { recursive: true });
        await fs.mkdir(path.dirname(homeWriteDirFile), { recursive: true });
        await fs.writeFile(homeSensitiveFile, "sensitive", "utf8");
        await fs.writeFile(homeRandomFile, "home-file", "utf8");
        await fs.writeFile(homeWorkspaceFile, "workspace-file", "utf8");
        await fs.writeFile(homeWriteDirFile, "allowed-file", "utf8");

        appFile = path.join(workingDir, "apps", "my-app", "APP.md");
        otherAppFile = path.join(workingDir, "apps", "other-app", "APP.md");
        await fs.mkdir(path.dirname(appFile), { recursive: true });
        await fs.mkdir(path.dirname(otherAppFile), { recursive: true });
        await fs.writeFile(appFile, "app manifest", "utf8");
        await fs.writeFile(otherAppFile, "other app manifest", "utf8");
    });

    afterEach(async () => {
        await fs.rm(workingDir, { recursive: true, force: true });
        await fs.rm(outsideDir, { recursive: true, force: true });
        await fs.rm(homeDir, { recursive: true, force: true });
        vi.restoreAllMocks();
    });

    it("denies reading sensitive paths", async () => {
        const permissions = buildPermissions(workingDir, [homeDir]);

        await expect(sandboxCanRead(permissions, homeSensitiveFile)).rejects.toThrow(
            "Read access denied for sensitive paths."
        );
    });

    it("denies reading random home-directory files by default", async () => {
        const permissions = buildPermissions(workingDir, []);

        await expect(sandboxCanRead(permissions, homeRandomFile)).rejects.toThrow(
            "Read access denied for OS home paths without explicit permission."
        );
    });

    it("allows reading files in workingDir even when workingDir is inside home", async () => {
        const permissions = buildPermissions(path.join(homeDir, "workspace"), []);

        const result = await sandboxCanRead(permissions, homeWorkspaceFile);

        expect(result).toBe(await fs.realpath(homeWorkspaceFile));
    });

    it("allows reading files in explicitly granted writeDirs inside home", async () => {
        const permissions = buildPermissions(workingDir, [path.join(homeDir, "allowed")]);

        const result = await sandboxCanRead(permissions, homeWriteDirFile);

        expect(result).toBe(await fs.realpath(homeWriteDirFile));
    });

    it("allows reading system paths outside home", async () => {
        const permissions = buildPermissions(workingDir, []);

        const result = await sandboxCanRead(permissions, outsideFile);

        expect(result).toBe(await fs.realpath(outsideFile));
    });

    it("denies non-app agents from reading app directories", async () => {
        const permissions = buildPermissions(workingDir, [workingDir]);

        await expect(sandboxCanRead(permissions, appFile)).rejects.toThrow(
            "App directories are not accessible from non-app agents."
        );
    });

    it("allows app agents to read their own app directory", async () => {
        const appDataDir = path.join(workingDir, "apps", "my-app", "data");
        await fs.mkdir(appDataDir, { recursive: true });
        const permissions = buildPermissions(appDataDir, [appDataDir]);

        const result = await sandboxCanRead(permissions, appFile);

        expect(result).toBe(await fs.realpath(appFile));
    });

    it("denies app agents from reading other app directories", async () => {
        const appDataDir = path.join(workingDir, "apps", "my-app", "data");
        await fs.mkdir(appDataDir, { recursive: true });
        const permissions = buildPermissions(appDataDir, [appDataDir]);

        await expect(sandboxCanRead(permissions, otherAppFile)).rejects.toThrow(
            "App agents can only access their own app directory."
        );
    });
});

function buildPermissions(workingDir: string, writeDirs: string[]): SessionPermissions {
    return {
        workingDir: path.resolve(workingDir),
        writeDirs: writeDirs.map((entry) => path.resolve(entry))
    };
}

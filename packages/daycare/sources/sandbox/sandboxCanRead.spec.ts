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
    let homeReadDirFile: string;
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
        homeReadDirFile = path.join(homeDir, ".daycare", "skills", "my-skill", "SKILL.md");
        await fs.mkdir(path.dirname(homeSensitiveFile), { recursive: true });
        await fs.mkdir(path.dirname(homeWorkspaceFile), { recursive: true });
        await fs.mkdir(path.dirname(homeWriteDirFile), { recursive: true });
        await fs.mkdir(path.dirname(homeReadDirFile), { recursive: true });
        await fs.writeFile(homeSensitiveFile, "sensitive", "utf8");
        await fs.writeFile(homeRandomFile, "home-file", "utf8");
        await fs.writeFile(homeWorkspaceFile, "workspace-file", "utf8");
        await fs.writeFile(homeWriteDirFile, "allowed-file", "utf8");
        await fs.writeFile(homeReadDirFile, "skill-body", "utf8");

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
            "Read access denied for denied paths."
        );
    });

    it("denies reading random home-directory files by default", async () => {
        const permissions = buildPermissions(workingDir, []);

        await expect(sandboxCanRead(permissions, homeRandomFile)).rejects.toThrow(
            "Read access denied for denied paths."
        );
    });

    it("denies reading files in workingDir when workingDir is inside OS home", async () => {
        const permissions = buildPermissions(path.join(homeDir, "workspace"), []);

        await expect(sandboxCanRead(permissions, homeWorkspaceFile)).rejects.toThrow(
            "Read access denied for denied paths."
        );
    });

    it("denies reading files in explicitly granted writeDirs inside OS home", async () => {
        const permissions = buildPermissions(workingDir, [path.join(homeDir, "allowed")]);

        await expect(sandboxCanRead(permissions, homeWriteDirFile)).rejects.toThrow(
            "Read access denied for denied paths."
        );
    });

    it("denies reading files in explicitly granted readDirs inside OS home", async () => {
        const permissions = buildPermissions(workingDir, [], [path.join(homeDir, ".daycare", "skills")]);

        await expect(sandboxCanRead(permissions, homeReadDirFile)).rejects.toThrow(
            "Read access denied for denied paths."
        );
    });

    it("allows reading system paths outside home", async () => {
        const permissions = buildPermissions(workingDir, []);

        const result = await sandboxCanRead(permissions, outsideFile);

        expect(result).toBe(await fs.realpath(outsideFile));
    });

    it("allows reading files in explicitly granted readDirs outside OS home", async () => {
        const explicitReadDir = path.join(outsideDir, "allowed-read");
        const explicitReadFile = path.join(explicitReadDir, "file.txt");
        await fs.mkdir(explicitReadDir, { recursive: true });
        await fs.writeFile(explicitReadFile, "explicit-read", "utf8");
        const permissions = buildPermissions(workingDir, [], [explicitReadDir]);

        const result = await sandboxCanRead(permissions, explicitReadFile);

        expect(result).toBe(await fs.realpath(explicitReadFile));
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

function buildPermissions(workingDir: string, writeDirs: string[], readDirs: string[] = []): SessionPermissions {
    return {
        workingDir: path.resolve(workingDir),
        writeDirs: writeDirs.map((entry) => path.resolve(entry)),
        readDirs: readDirs.map((entry) => path.resolve(entry))
    };
}

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { SessionPermissions } from "@/types";
import { sandboxCanRead } from "./sandboxCanRead.js";

describe("sandboxCanRead", () => {
    let workingDir: string;
    let outsideDir: string;
    let outsideFile: string;
    let appFile: string;
    let otherAppFile: string;

    beforeEach(async () => {
        workingDir = await fs.mkdtemp(path.join(os.tmpdir(), "sandbox-can-read-workspace-"));
        outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), "sandbox-can-read-outside-"));
        outsideFile = path.join(outsideDir, "outside.txt");
        await fs.writeFile(outsideFile, "outside-content", "utf8");
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
    });

    it("allows reading any absolute path when readDirs is empty", async () => {
        const permissions = buildPermissions(workingDir, [], []);

        const result = await sandboxCanRead(permissions, outsideFile);

        expect(result).toBe(await fs.realpath(outsideFile));
    });

    it("allows reading any absolute path when readDirs are configured", async () => {
        const permissions = buildPermissions(workingDir, [workingDir], []);

        const result = await sandboxCanRead(permissions, outsideFile);

        expect(result).toBe(await fs.realpath(outsideFile));
    });

    it("ignores write grants for read access checks", async () => {
        const permissions = buildPermissions(workingDir, [workingDir], [outsideFile]);

        const result = await sandboxCanRead(permissions, outsideFile);

        expect(result).toBe(await fs.realpath(outsideFile));
    });

    it("denies non-app agents from reading app directories", async () => {
        const permissions = buildPermissions(workingDir, [workingDir], [workingDir]);

        await expect(sandboxCanRead(permissions, appFile)).rejects.toThrow(
            "App directories are not accessible from non-app agents."
        );
    });

    it("allows app agents to read their own app directory", async () => {
        const appDataDir = path.join(workingDir, "apps", "my-app", "data");
        await fs.mkdir(appDataDir, { recursive: true });
        const permissions = buildPermissions(appDataDir, [workingDir], [appDataDir]);

        const result = await sandboxCanRead(permissions, appFile);

        expect(result).toBe(await fs.realpath(appFile));
    });

    it("denies app agents from reading other app directories", async () => {
        const appDataDir = path.join(workingDir, "apps", "my-app", "data");
        await fs.mkdir(appDataDir, { recursive: true });
        const permissions = buildPermissions(appDataDir, [workingDir], [appDataDir]);

        await expect(sandboxCanRead(permissions, otherAppFile)).rejects.toThrow(
            "App agents can only access their own app directory."
        );
    });
});

function buildPermissions(workingDir: string, readDirs: string[], writeDirs: string[]): SessionPermissions {
    return {
        workingDir: path.resolve(workingDir),
        readDirs: readDirs.map((entry) => path.resolve(entry)),
        writeDirs: writeDirs.map((entry) => path.resolve(entry)),
        network: false,
        events: false
    };
}

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionPermissions } from "@/types";
import { dockerRunInSandbox } from "./docker/dockerRunInSandbox.js";
import { runInSandbox } from "./runtime.js";
import { Sandbox } from "./sandbox.js";

vi.mock("./runtime.js", () => ({
    runInSandbox: vi.fn()
}));

vi.mock("./docker/dockerRunInSandbox.js", () => ({
    dockerRunInSandbox: vi.fn()
}));

describe("Sandbox docker integration", () => {
    let rootDir: string;
    let homeDir: string;
    let skillsActiveDir: string;
    let workingDir: string;
    let permissions: SessionPermissions;

    beforeEach(async () => {
        rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-sandbox-docker-"));
        homeDir = path.join(rootDir, "home");
        skillsActiveDir = path.join(rootDir, "skills", "active");
        workingDir = path.join(homeDir, "desktop");
        await fs.mkdir(workingDir, { recursive: true });
        await fs.mkdir(path.join(homeDir, "documents"), { recursive: true });
        await fs.mkdir(skillsActiveDir, { recursive: true });

        permissions = {
            workingDir,
            writeDirs: [homeDir]
        };

        vi.mocked(runInSandbox).mockReset();
        vi.mocked(dockerRunInSandbox).mockReset();
    });

    afterEach(async () => {
        await fs.rm(rootDir, { recursive: true, force: true });
    });

    it("uses host runtime when docker is not enabled", async () => {
        vi.mocked(runInSandbox).mockResolvedValue({
            stdout: "host",
            stderr: ""
        });

        const sandbox = new Sandbox({
            homeDir,
            permissions
        });

        const result = await sandbox.exec({
            command: "echo host",
            allowedDomains: ["example.com"]
        });

        expect(result.failed).toBe(false);
        expect(result.stdout).toBe("host");
        expect(runInSandbox).toHaveBeenCalledTimes(1);
        expect(dockerRunInSandbox).not.toHaveBeenCalled();
    });

    it("uses docker runtime when docker is enabled", async () => {
        vi.mocked(dockerRunInSandbox).mockResolvedValue({
            stdout: "docker",
            stderr: ""
        });

        const sandbox = new Sandbox({
            homeDir,
            permissions,
            docker: {
                enabled: true,
                image: "daycare-sandbox",
                tag: "latest",
                userId: "u123",
                skillsActiveDir
            }
        });

        const result = await sandbox.exec({
            command: "echo docker",
            allowedDomains: ["example.com"]
        });

        expect(result.failed).toBe(false);
        expect(result.stdout).toBe("docker");
        expect(dockerRunInSandbox).toHaveBeenCalledTimes(1);
        expect(runInSandbox).not.toHaveBeenCalled();
    });

    it("rewrites container read paths back to host paths", async () => {
        const targetPath = path.join(homeDir, "documents", "notes.txt");
        await fs.writeFile(targetPath, "hello", "utf8");

        const sandbox = new Sandbox({
            homeDir,
            permissions,
            docker: {
                enabled: true,
                image: "daycare-sandbox",
                tag: "latest",
                userId: "u123",
                skillsActiveDir
            }
        });

        const read = await sandbox.read({
            path: "/home/documents/notes.txt",
            raw: true
        });

        expect(read.type).toBe("text");
        if (read.type !== "text") {
            return;
        }
        expect(read.content).toBe("hello");
        expect(read.resolvedPath).toBe(await fs.realpath(targetPath));
    });

    it("rewrites container write paths back to host paths", async () => {
        const sandbox = new Sandbox({
            homeDir,
            permissions,
            docker: {
                enabled: true,
                image: "daycare-sandbox",
                tag: "latest",
                userId: "u123",
                skillsActiveDir
            }
        });

        const result = await sandbox.write({
            path: "/home/documents/output.txt",
            content: "docker-write"
        });

        const outputPath = path.join(homeDir, "documents", "output.txt");
        expect(result.resolvedPath).toBe(await fs.realpath(outputPath));
        await expect(fs.readFile(outputPath, "utf8")).resolves.toBe("docker-write");
    });
});

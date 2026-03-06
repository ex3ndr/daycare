import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionPermissions } from "@/types";
import { dockerRunInSandbox } from "./docker/dockerRunInSandbox.js";
import { Sandbox } from "./sandbox.js";

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

        vi.mocked(dockerRunInSandbox).mockReset();
    });

    afterEach(async () => {
        await fs.rm(rootDir, { recursive: true, force: true });
    });

    it("uses docker runtime for exec", async () => {
        vi.mocked(dockerRunInSandbox).mockResolvedValue({
            stdout: "docker",
            stderr: ""
        });

        const sandbox = sandboxBuild();
        const result = await sandbox.exec({ command: "echo docker" });

        expect(result.failed).toBe(false);
        expect(result.stdout).toBe("docker");
        expect(dockerRunInSandbox).toHaveBeenCalledTimes(1);
        expect(vi.mocked(dockerRunInSandbox).mock.calls[0]?.[1]?.docker).toMatchObject({
            readOnly: false,
            unconfinedSecurity: false,
            capAdd: [],
            capDrop: [],
            allowLocalNetworkingForUsers: ["u123"],
            isolatedDnsServers: ["9.9.9.9"],
            localDnsServers: ["192.168.1.1"],
            userId: "u123"
        });
    });

    it("rethrows AbortError from docker execution", async () => {
        const abortError = new Error("Operation aborted.");
        abortError.name = "AbortError";
        vi.mocked(dockerRunInSandbox).mockRejectedValueOnce(abortError);

        const sandbox = sandboxBuild();
        await expect(
            sandbox.exec({
                command: "echo docker",
                signal: new AbortController().signal
            })
        ).rejects.toMatchObject({ name: "AbortError" });
    });

    it("rewrites container read paths back to host paths", async () => {
        const targetPath = path.join(homeDir, "documents", "notes.txt");
        await fs.writeFile(targetPath, "hello", "utf8");

        const sandbox = sandboxBuild();
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
        expect(read.displayPath).toBe("~/documents/notes.txt");
        expect(read.displayPath).not.toContain(rootDir);
    });

    it("rewrites container write paths back to host paths", async () => {
        const sandbox = sandboxBuild();
        const result = await sandbox.write({
            path: "/home/documents/output.txt",
            content: "docker-write"
        });

        const outputPath = path.join(homeDir, "documents", "output.txt");
        expect(result.resolvedPath).toBe(await fs.realpath(outputPath));
        await expect(fs.readFile(outputPath, "utf8")).resolves.toBe("docker-write");
    });

    it("expands ~/ write paths to container home before host rewrite", async () => {
        const sandbox = sandboxBuild();
        const result = await sandbox.write({
            path: "~/documents/tilde-output.txt",
            content: "docker-tilde-write"
        });

        const outputPath = path.join(homeDir, "documents", "tilde-output.txt");
        expect(result.resolvedPath).toBe(await fs.realpath(outputPath));
        await expect(fs.readFile(outputPath, "utf8")).resolves.toBe("docker-tilde-write");
    });

    it("resolves symlinked homeDir and produces correct displayPath", async () => {
        const realHome = path.join(rootDir, "real-home");
        await fs.mkdir(path.join(realHome, "desktop"), { recursive: true });
        await fs.mkdir(path.join(realHome, "documents"), { recursive: true });
        const symlinkHome = path.join(rootDir, "sym-home");
        await fs.symlink(realHome, symlinkHome);

        const targetPath = path.join(realHome, "documents", "notes.txt");
        await fs.writeFile(targetPath, "hello", "utf8");

        const sandbox = new Sandbox({
            homeDir: symlinkHome,
            permissions: {
                workingDir: path.join(symlinkHome, "desktop"),
                writeDirs: [symlinkHome]
            },
            docker: dockerConfigBuild()
        });

        const read = await sandbox.read({ path: "/home/documents/notes.txt", raw: true });
        expect(read.type).toBe("text");
        expect(read.displayPath).toBe("~/documents/notes.txt");
        expect(read.displayPath).not.toContain(rootDir);
    });

    function sandboxBuild() {
        return new Sandbox({
            homeDir,
            permissions,
            mounts: [
                { hostPath: skillsActiveDir, mappedPath: "/shared/skills" },
                { hostPath: skillsActiveDir, mappedPath: "/shared/examples" }
            ],
            docker: dockerConfigBuild()
        });
    }

    function dockerConfigBuild() {
        return {
            readOnly: false,
            unconfinedSecurity: false,
            capAdd: [],
            capDrop: [],
            allowLocalNetworkingForUsers: ["u123"],
            isolatedDnsServers: ["9.9.9.9"],
            localDnsServers: ["192.168.1.1"],
            userId: "u123"
        };
    }
});

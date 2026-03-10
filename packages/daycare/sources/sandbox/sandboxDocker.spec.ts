import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionPermissions } from "@/types";
import { dockerContainersShared } from "./docker/dockerContainersShared.js";
import { Sandbox } from "./sandbox.js";

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

        vi.spyOn(dockerContainersShared, "execStream").mockReset();
    });

    afterEach(async () => {
        await fs.rm(rootDir, { recursive: true, force: true });
    });

    it("uses docker runtime for exec", async () => {
        const stdout = new PassThrough();
        const stderr = new PassThrough();
        const execSpy = vi.spyOn(dockerContainersShared, "execStream").mockResolvedValue({
            stdout,
            stderr,
            wait: async () => ({
                stdout: "docker",
                stderr: "",
                exitCode: 0,
                signal: null
            }),
            kill: async () => undefined
        });

        const sandbox = sandboxBuild();
        const execution = await sandbox.exec({ command: "echo docker" });
        const result = await execution.wait();

        expect(result.failed).toBe(false);
        expect(result.stdout).toBe("docker");
        expect(execSpy).toHaveBeenCalledTimes(1);
        expect(execSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                readOnly: false,
                unconfinedSecurity: false,
                capAdd: [],
                capDrop: [],
                allowLocalNetworkingForUsers: ["u123"],
                isolatedDnsServers: ["9.9.9.9"],
                localDnsServers: ["192.168.1.1"],
                userId: "u123"
            }),
            expect.objectContaining({
                command: [
                    "daycare-exec-supervisor",
                    "--control",
                    expect.stringMatching(/^\/tmp\/daycare-exec-.*\.ctl$/),
                    "--",
                    "bash",
                    "-lc",
                    "echo docker"
                ]
            })
        );
    });

    it("rethrows AbortError from docker execution", async () => {
        const abortError = new Error("Operation aborted.");
        abortError.name = "AbortError";
        vi.spyOn(dockerContainersShared, "execStream").mockRejectedValueOnce(abortError);

        const sandbox = sandboxBuild();
        await expect(
            sandbox.execBuffered({
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
            backend: {
                type: "docker",
                docker: dockerConfigBuild()
            }
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
            backend: {
                type: "docker",
                docker: dockerConfigBuild()
            }
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

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { dockerContainersShared } from "./dockerContainersShared.js";
import { dockerRunInSandbox } from "./dockerRunInSandbox.js";

describe("dockerRunInSandbox", () => {
    it("runs bash directly in the container with rewritten cwd and env", async () => {
        const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-docker-run-"));
        const homeDir = path.join(workspace, "home");
        const skillsActiveDir = path.join(workspace, "skills", "active");
        await fs.mkdir(path.join(homeDir, "desktop", "project"), { recursive: true });
        await fs.mkdir(skillsActiveDir, { recursive: true });

        const dockerExecSpy = vi.spyOn(dockerContainersShared, "exec");
        let capturedEnv: NodeJS.ProcessEnv | undefined;
        let capturedCwd: string | undefined;
        let capturedCommand: string[] | undefined;

        dockerExecSpy.mockImplementationOnce(async (_dockerConfig, args) => {
            capturedEnv = args.env;
            capturedCwd = args.cwd;
            capturedCommand = args.command;
            return {
                stdout: "done",
                stderr: "",
                exitCode: 0
            };
        });

        const result = await dockerRunInSandbox("echo ok", {
            cwd: path.join(homeDir, "desktop", "project"),
            home: homeDir,
            docker: {
                readOnly: false,
                unconfinedSecurity: false,
                capAdd: [],
                capDrop: [],
                allowLocalNetworkingForUsers: ["u123"],
                isolatedDnsServers: ["9.9.9.9"],
                localDnsServers: ["192.168.1.1"],
                userId: "u123",
                mounts: [
                    { hostPath: homeDir, mappedPath: "/home" },
                    { hostPath: skillsActiveDir, mappedPath: "/shared/skills" },
                    { hostPath: skillsActiveDir, mappedPath: "/shared/examples" }
                ]
            }
        });

        expect(result).toEqual({
            stdout: "done",
            stderr: ""
        });
        expect(capturedCommand).toEqual(["bash", "-lc", "echo ok"]);
        expect(capturedEnv?.HOME).toBe("/home");
        expect(capturedEnv?.TMPDIR).toBe("/tmp");
        expect(capturedEnv?.TMP).toBe("/tmp");
        expect(capturedEnv?.TEMP).toBe("/tmp");
        expect(capturedCwd).toBe("/home/desktop/project");

        dockerExecSpy.mockRestore();
        await fs.rm(workspace, { recursive: true, force: true });
    });

    it("throws exec-like error when container command fails", async () => {
        const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-docker-run-fail-"));
        const homeDir = path.join(workspace, "home");
        const skillsActiveDir = path.join(workspace, "skills", "active");
        await fs.mkdir(homeDir, { recursive: true });
        await fs.mkdir(skillsActiveDir, { recursive: true });

        const dockerExecSpy = vi.spyOn(dockerContainersShared, "exec");
        dockerExecSpy.mockResolvedValueOnce({
            stdout: "partial",
            stderr: "failed",
            exitCode: 17
        });

        await expect(
            dockerRunInSandbox("bad", {
                home: homeDir,
                docker: {
                    readOnly: false,
                    unconfinedSecurity: false,
                    capAdd: [],
                    capDrop: [],
                    userId: "u123",
                    mounts: [
                        { hostPath: homeDir, mappedPath: "/home" },
                        { hostPath: skillsActiveDir, mappedPath: "/shared/skills" },
                        { hostPath: skillsActiveDir, mappedPath: "/shared/examples" }
                    ]
                }
            })
        ).rejects.toMatchObject({
            code: 17,
            stdout: "partial",
            stderr: "failed"
        });

        dockerExecSpy.mockRestore();
        await fs.rm(workspace, { recursive: true, force: true });
    });
});

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { sandboxPathContainerToHost } from "../sandboxPathContainerToHost.js";
import { dockerContainersShared } from "./dockerContainersShared.js";
import { dockerRunInSandbox } from "./dockerRunInSandbox.js";

describe("dockerRunInSandbox", () => {
    it("rewrites sandbox config paths and runs srt in container", async () => {
        const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-docker-run-"));
        const homeDir = path.join(workspace, "home");
        const skillsActiveDir = path.join(workspace, "skills", "active");
        await fs.mkdir(path.join(homeDir, "desktop", "project"), { recursive: true });
        await fs.mkdir(skillsActiveDir, { recursive: true });

        const userId = "u123";
        const dockerExecSpy = vi.spyOn(dockerContainersShared, "exec");
        let capturedRuntimeConfig: Record<string, unknown> | null = null;
        let capturedSettingsHostPath: string | null = null;
        let capturedEnv: NodeJS.ProcessEnv | undefined;
        let capturedCwd: string | undefined;
        let capturedCommand: string | undefined;
        let capturedReadOnly: boolean | undefined;
        let capturedUnconfinedSecurity: boolean | undefined;
        let capturedCapAdd: string[] | undefined;
        let capturedCapDrop: string[] | undefined;
        let capturedLocalNetworkAllowlist: string[] | undefined;
        let capturedIsolatedDnsServers: string[] | undefined;
        let capturedLocalDnsServers: string[] | undefined;

        dockerExecSpy.mockImplementationOnce(async (dockerConfig, args) => {
            // Command is wrapped as: ["bash", "-lc", "/usr/local/bin/srt --settings <path> -c <cmd>"]
            const bashCmd = args.command[2] ?? "";
            const settingsMatch = bashCmd.match(/--settings\s+(\S+)/);
            const settingsContainerPath = settingsMatch?.[1];
            if (!settingsContainerPath) {
                throw new Error("Expected --settings path in bash command string.");
            }
            capturedReadOnly = dockerConfig.readOnly;
            capturedUnconfinedSecurity = dockerConfig.unconfinedSecurity;
            capturedCapAdd = dockerConfig.capAdd;
            capturedCapDrop = dockerConfig.capDrop;
            capturedLocalNetworkAllowlist = dockerConfig.allowLocalNetworkingForUsers;
            capturedIsolatedDnsServers = dockerConfig.isolatedDnsServers;
            capturedLocalDnsServers = dockerConfig.localDnsServers;
            capturedCommand = bashCmd;
            capturedSettingsHostPath = sandboxPathContainerToHost(homeDir, userId, settingsContainerPath);
            const rawConfig = await fs.readFile(capturedSettingsHostPath, "utf8");
            capturedRuntimeConfig = JSON.parse(rawConfig) as Record<string, unknown>;
            capturedEnv = args.env;
            capturedCwd = args.cwd;

            return {
                stdout: "done",
                stderr: "",
                exitCode: 0
            };
        });

        const result = await dockerRunInSandbox(
            "echo ok",
            {
                filesystem: {
                    allowWrite: [homeDir, path.join(homeDir, "desktop")],
                    denyRead: [path.join(homeDir, ".ssh")],
                    denyWrite: [path.join(homeDir, ".aws")]
                },
                network: {
                    allowedDomains: ["example.com"],
                    deniedDomains: []
                }
            },
            {
                cwd: path.join(homeDir, "desktop", "project"),
                home: homeDir,
                docker: {
                    image: "daycare-sandbox",
                    tag: "latest",
                    readOnly: false,
                    unconfinedSecurity: false,
                    capAdd: [],
                    capDrop: [],
                    allowLocalNetworkingForUsers: ["u123"],
                    isolatedDnsServers: ["9.9.9.9"],
                    localDnsServers: ["192.168.1.1"],
                    userId,
                    hostSkillsActiveDir: skillsActiveDir
                }
            }
        );

        expect(result).toEqual({
            stdout: "done",
            stderr: ""
        });
        expect(capturedRuntimeConfig).toEqual({
            filesystem: {
                allowWrite: ["/home", "/home/desktop"],
                denyRead: ["/home/.ssh"],
                denyWrite: ["/home/.aws"]
            },
            network: {
                allowedDomains: ["example.com"],
                deniedDomains: []
            }
        });
        expect(capturedEnv?.HOME).toBe("/home/developer");
        expect(capturedEnv?.TMPDIR).toBe("/home/developer/.tmp");
        expect(capturedCwd).toBe("/home/desktop/project");
        expect(capturedReadOnly).toBe(false);
        expect(capturedUnconfinedSecurity).toBe(false);
        expect(capturedCapAdd).toEqual([]);
        expect(capturedCapDrop).toEqual([]);
        expect(capturedLocalNetworkAllowlist).toEqual(["u123"]);
        expect(capturedIsolatedDnsServers).toEqual(["9.9.9.9"]);
        expect(capturedLocalDnsServers).toEqual(["192.168.1.1"]);
        expect(capturedCommand).toContain("/usr/local/bin/srt --settings ");
        await expect(fs.access(capturedSettingsHostPath ?? "")).rejects.toThrow();
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
            dockerRunInSandbox(
                "bad",
                {
                    filesystem: {
                        allowWrite: [homeDir],
                        denyRead: [],
                        denyWrite: []
                    },
                    network: {
                        allowedDomains: ["example.com"],
                        deniedDomains: []
                    }
                },
                {
                    home: homeDir,
                    docker: {
                        image: "daycare-sandbox",
                        tag: "latest",
                        readOnly: false,
                        unconfinedSecurity: false,
                        capAdd: [],
                        capDrop: [],
                        userId: "u123",
                        hostSkillsActiveDir: skillsActiveDir
                    }
                }
            )
        ).rejects.toMatchObject({
            code: 17,
            stdout: "partial",
            stderr: "failed"
        });

        dockerExecSpy.mockRestore();
        await fs.rm(workspace, { recursive: true, force: true });
    });
});

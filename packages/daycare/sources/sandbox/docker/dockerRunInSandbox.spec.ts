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
        await fs.mkdir(path.join(homeDir, "desktop", "project"), { recursive: true });

        const userId = "u123";
        const dockerExecSpy = vi.spyOn(dockerContainersShared, "exec");
        let capturedRuntimeConfig: Record<string, unknown> | null = null;
        let capturedSettingsHostPath: string | null = null;
        let capturedEnv: NodeJS.ProcessEnv | undefined;
        let capturedCwd: string | undefined;

        dockerExecSpy
            .mockResolvedValueOnce({
                stdout: "/app/node_modules/@anthropic-ai/sandbox-runtime/dist/cli.js\n",
                stderr: "",
                exitCode: 0
            })
            .mockImplementationOnce(async (_dockerConfig, args) => {
                const settingsArgIndex = args.command.indexOf("--settings");
                const settingsContainerPath = args.command[settingsArgIndex + 1];
                if (!settingsContainerPath) {
                    throw new Error("Expected --settings path argument.");
                }
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
                    userId
                }
            }
        );

        expect(result).toEqual({
            stdout: "done",
            stderr: ""
        });
        expect(capturedRuntimeConfig).toEqual({
            filesystem: {
                allowWrite: ["/home/u123", "/home/u123/desktop"],
                denyRead: ["/home/u123/.ssh"],
                denyWrite: ["/home/u123/.aws"]
            },
            network: {
                allowedDomains: ["example.com"],
                deniedDomains: []
            }
        });
        expect(capturedEnv?.HOME).toBe("/home/u123");
        expect(capturedEnv?.TMPDIR).toBe("/home/u123/.tmp");
        expect(capturedCwd).toBe("/home/u123/desktop/project");
        await expect(fs.access(capturedSettingsHostPath ?? "")).rejects.toThrow();
        dockerExecSpy.mockRestore();
        await fs.rm(workspace, { recursive: true, force: true });
    });

    it("throws exec-like error when container command fails", async () => {
        const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-docker-run-fail-"));
        const homeDir = path.join(workspace, "home");
        await fs.mkdir(homeDir, { recursive: true });

        const dockerExecSpy = vi.spyOn(dockerContainersShared, "exec");
        dockerExecSpy
            .mockResolvedValueOnce({
                stdout: "/app/node_modules/@anthropic-ai/sandbox-runtime/dist/cli.js\n",
                stderr: "",
                exitCode: 0
            })
            .mockResolvedValueOnce({
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
                        userId: "u123"
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

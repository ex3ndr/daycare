import { describe, expect, it, vi } from "vitest";

import { dockerContainersShared } from "./dockerContainersShared.js";
import { DockerExecBackend } from "./dockerExecBackend.js";

describe("DockerExecBackend", () => {
    it("rewrites cwd and env into sandbox paths before exec", async () => {
        const execSpy = vi.spyOn(dockerContainersShared, "exec").mockResolvedValueOnce({
            stdout: "done",
            stderr: "",
            exitCode: 0
        });

        const backend = new DockerExecBackend({
            homeDir: "/host/home",
            mounts: [
                { hostPath: "/host/home", mappedPath: "/home" },
                { hostPath: "/host/skills", mappedPath: "/shared/skills" }
            ],
            docker: {
                readOnly: false,
                unconfinedSecurity: false,
                capAdd: [],
                capDrop: [],
                userId: "u123"
            }
        });

        const result = await backend.exec({
            command: "echo ok",
            cwd: "/host/home/project",
            env: {
                HOME: "/host/home",
                XDG_CACHE_HOME: "/host/home/.cache"
            },
            timeoutMs: 30_000,
            maxBufferBytes: 1_000_000
        });

        expect(result).toEqual({
            stdout: "done",
            stderr: "",
            exitCode: 0
        });
        expect(execSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                hostHomeDir: "/host/home",
                userId: "u123"
            }),
            expect.objectContaining({
                command: ["bash", "-lc", "echo ok"],
                cwd: "/home/project",
                env: expect.objectContaining({
                    HOME: "/home",
                    XDG_CACHE_HOME: "/home/.cache",
                    TMPDIR: "/tmp"
                })
            })
        );

        execSpy.mockRestore();
    });

    it("returns non-zero exits without throwing", async () => {
        const execSpy = vi.spyOn(dockerContainersShared, "exec").mockResolvedValueOnce({
            stdout: "",
            stderr: "failed",
            exitCode: 17
        });

        const backend = new DockerExecBackend({
            homeDir: "/host/home",
            mounts: [{ hostPath: "/host/home", mappedPath: "/home" }],
            docker: {
                readOnly: false,
                unconfinedSecurity: false,
                capAdd: [],
                capDrop: [],
                userId: "u123"
            }
        });

        await expect(
            backend.exec({
                command: "bad",
                env: { HOME: "/host/home" },
                timeoutMs: 30_000,
                maxBufferBytes: 1_000_000
            })
        ).resolves.toEqual({
            stdout: "",
            stderr: "failed",
            exitCode: 17
        });

        execSpy.mockRestore();
    });
});

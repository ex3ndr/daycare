import { beforeEach, describe, expect, it, vi } from "vitest";

import { OpenSandboxExecBackend } from "./opensandboxExecBackend.js";
import { opensandboxSandboxEnsure } from "./opensandboxSandboxEnsure.js";

vi.mock("./opensandboxSandboxEnsure.js", () => ({
    opensandboxSandboxEnsure: vi.fn()
}));

describe("OpenSandboxExecBackend", () => {
    beforeEach(() => {
        vi.mocked(opensandboxSandboxEnsure).mockReset();
    });

    it("maps command results into sandbox exec output", async () => {
        const run = vi.fn().mockResolvedValue({
            id: "cmd-1",
            logs: {
                stdout: [],
                stderr: []
            },
            result: []
        });
        const getCommandStatus = vi.fn().mockResolvedValue({
            exitCode: 7,
            error: "failed"
        });
        vi.mocked(opensandboxSandboxEnsure).mockResolvedValue({
            commands: {
                run,
                getCommandStatus
            }
        } as never);

        const backend = new OpenSandboxExecBackend(
            {
                domain: "localhost:8080",
                image: "ubuntu",
                userId: "user-1",
                timeoutSeconds: 600
            },
            [{ hostPath: "/host/home", mappedPath: "/home" }]
        );

        const result = await backend.exec({
            command: "echo fail",
            cwd: "/host/home/project",
            env: { HOME: "/host/home", GREETING: "hello world" },
            timeoutMs: 30_000,
            maxBufferBytes: 1_000_000
        });
        const resolved = await result.wait();

        expect(resolved).toEqual({
            stdout: "",
            stderr: "failed",
            exitCode: 7,
            signal: null
        });
        expect(run).toHaveBeenCalledWith(
            expect.stringContaining("'GREETING=hello world'"),
            expect.objectContaining({
                workingDirectory: "/home/project",
                timeoutSeconds: 30
            }),
            expect.any(Object),
            expect.any(AbortSignal)
        );
    });

    it("enforces max buffer limits on streamed output", async () => {
        const run = vi.fn().mockImplementation(async (_command, _opts, handlers) => {
            await handlers?.onStdout?.({ text: "12345", timestamp: Date.now() });
            await handlers?.onStdout?.({ text: "67890", timestamp: Date.now() });
            return {
                id: "cmd-1",
                logs: {
                    stdout: [],
                    stderr: []
                },
                result: []
            };
        });
        vi.mocked(opensandboxSandboxEnsure).mockResolvedValue({
            commands: {
                run,
                getCommandStatus: vi.fn()
            }
        } as never);

        const backend = new OpenSandboxExecBackend(
            {
                domain: "localhost:8080",
                image: "ubuntu",
                userId: "user-1",
                timeoutSeconds: 600
            },
            [{ hostPath: "/host/home", mappedPath: "/home" }]
        );

        const result = await backend.exec({
            command: "echo noisy",
            env: { HOME: "/host/home" },
            timeoutMs: 30_000,
            maxBufferBytes: 8
        });

        await expect(result.wait()).rejects.toMatchObject({
            message: "stdout exceeded maxBufferBytes (8)",
            stdout: "1234567890",
            code: null
        });
    });

    it("interrupts running commands when kill is requested", async () => {
        const interrupt = vi.fn().mockResolvedValue(undefined);
        const run = vi.fn().mockImplementation(async (_command, _opts, handlers) => {
            await handlers?.onInit?.({ id: "cmd-1", timestamp: Date.now() });
            await handlers?.onStdout?.({ text: "hello", timestamp: Date.now() });
            return {
                id: "cmd-1",
                logs: {
                    stdout: [],
                    stderr: []
                },
                result: []
            };
        });
        vi.mocked(opensandboxSandboxEnsure).mockResolvedValue({
            commands: {
                run,
                interrupt,
                getCommandStatus: vi.fn().mockResolvedValue({ exitCode: 0 })
            }
        } as never);

        const backend = new OpenSandboxExecBackend(
            {
                domain: "localhost:8080",
                image: "ubuntu",
                userId: "user-1",
                timeoutSeconds: 600
            },
            [{ hostPath: "/host/home", mappedPath: "/home" }]
        );

        const result = await backend.exec({
            command: "sleep 30",
            env: { HOME: "/host/home" },
            timeoutMs: 30_000,
            maxBufferBytes: 1_000_000
        });
        await result.kill("SIGTERM");

        expect(interrupt).toHaveBeenCalledWith("cmd-1");
    });
});

import { PassThrough } from "node:stream";

import type Docker from "dockerode";
import { describe, expect, it, vi } from "vitest";

import { dockerContainerExec } from "./dockerContainerExec.js";

describe("dockerContainerExec", () => {
    it("executes command and returns stdout/stderr with exit code", async () => {
        const stream = new PassThrough();
        const execHandle = {
            start: vi.fn().mockImplementation(async () => {
                setTimeout(() => {
                    stream.end();
                }, 0);
                return stream;
            }),
            inspect: vi
                .fn()
                .mockResolvedValueOnce({ Running: true, Pid: 123, ExitCode: null })
                .mockResolvedValueOnce({ ExitCode: 7 })
        };

        const container = {
            exec: vi.fn().mockResolvedValue(execHandle)
        } as unknown as Docker.Container;

        const docker = {
            modem: {
                demuxStream: vi.fn((_stream: NodeJS.ReadableStream, stdout: NodeJS.WritableStream, stderr) => {
                    stdout.write("hello");
                    stderr.write("warn");
                })
            }
        } as unknown as Docker;

        const execution = await dockerContainerExec(docker, container, {
            command: ["echo", "ok"],
            cwd: "/home",
            env: {
                HOME: "/home",
                DEBUG: "1"
            }
        });
        const result = await execution.wait();

        expect(container.exec).toHaveBeenCalledWith({
            Cmd: ["echo", "ok"],
            AttachStdout: true,
            AttachStderr: true,
            AttachStdin: false,
            WorkingDir: "/home",
            Env: ["HOME=/home", "DEBUG=1"]
        });
        expect(result).toEqual({
            stdout: "hello",
            stderr: "warn",
            exitCode: 7,
            signal: null
        });
    });

    it("fails when output exceeds max buffer", async () => {
        const stream = new PassThrough();
        const killStream = new PassThrough();
        const execHandle = {
            start: vi.fn().mockImplementation(async () => {
                setTimeout(() => {
                    stream.end();
                }, 0);
                return stream;
            }),
            inspect: vi.fn().mockResolvedValue({ Running: true, Pid: 321, ExitCode: null })
        };
        const killHandle = {
            start: vi.fn().mockImplementation(async () => {
                setTimeout(() => {
                    killStream.end();
                }, 0);
                return killStream;
            })
        };

        const container = {
            exec: vi.fn().mockResolvedValueOnce(execHandle).mockResolvedValueOnce(killHandle)
        } as unknown as Docker.Container;

        const docker = {
            modem: {
                demuxStream: vi.fn((_stream: NodeJS.ReadableStream, stdout: NodeJS.WritableStream) => {
                    stdout.write("12345");
                })
            }
        } as unknown as Docker;

        const execution = await dockerContainerExec(docker, container, {
            command: ["echo", "ok"],
            maxBufferBytes: 3
        });

        await expect(execution.wait()).rejects.toThrow("maxBufferBytes");
    });

    it("aborts when signal is cancelled", async () => {
        const stream = new PassThrough();
        const killStream = new PassThrough();
        const execHandle = {
            start: vi.fn().mockResolvedValue(stream),
            inspect: vi
                .fn()
                .mockResolvedValueOnce({ Running: true, Pid: 777, ExitCode: null })
                .mockResolvedValueOnce({ ExitCode: 143 })
        };
        const killHandle = {
            start: vi.fn().mockImplementation(async () => {
                setTimeout(() => {
                    killStream.end();
                    stream.end();
                }, 0);
                return killStream;
            })
        };
        const container = {
            exec: vi.fn().mockResolvedValueOnce(execHandle).mockResolvedValueOnce(killHandle)
        } as unknown as Docker.Container;
        const docker = {
            modem: {
                demuxStream: vi.fn()
            }
        } as unknown as Docker;
        const abortController = new AbortController();

        const execution = await dockerContainerExec(docker, container, {
            command: ["echo", "ok"],
            signal: abortController.signal
        });
        abortController.abort();

        await expect(execution.wait()).rejects.toMatchObject({ name: "AbortError" });
    });
});

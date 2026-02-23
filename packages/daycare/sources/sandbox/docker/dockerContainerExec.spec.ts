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
            inspect: vi.fn().mockResolvedValue({ ExitCode: 7 })
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

        const result = await dockerContainerExec(docker, container, {
            command: ["echo", "ok"],
            cwd: "/home",
            env: {
                HOME: "/home",
                DEBUG: "1"
            }
        });

        expect(container.exec).toHaveBeenCalledWith({
            Cmd: ["echo", "ok"],
            AttachStdout: true,
            AttachStderr: true,
            WorkingDir: "/home",
            Env: ["HOME=/home", "DEBUG=1"]
        });
        expect(result).toEqual({
            stdout: "hello",
            stderr: "warn",
            exitCode: 7
        });
    });

    it("fails when output exceeds max buffer", async () => {
        const stream = new PassThrough();
        const execHandle = {
            start: vi.fn().mockImplementation(async () => {
                setTimeout(() => {
                    stream.end();
                }, 0);
                return stream;
            }),
            inspect: vi.fn().mockResolvedValue({ ExitCode: 0 })
        };

        const container = {
            exec: vi.fn().mockResolvedValue(execHandle)
        } as unknown as Docker.Container;

        const docker = {
            modem: {
                demuxStream: vi.fn((_stream: NodeJS.ReadableStream, stdout: NodeJS.WritableStream) => {
                    stdout.write("12345");
                })
            }
        } as unknown as Docker;

        await expect(
            dockerContainerExec(docker, container, {
                command: ["echo", "ok"],
                maxBufferBytes: 3
            })
        ).rejects.toThrow("maxBufferBytes");
    });
});

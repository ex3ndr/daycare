import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Context, SandboxExecResult } from "@/types";
import { SessionExecs } from "./sessionExecs.js";

describe("SessionExecs", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("returns a process id immediately in background mode and only new output on poll", async () => {
        const execs = new SessionExecs();
        const runtime = handleBuild();
        const ctx = contextBuild();
        const sandbox = {
            workingDir: "/workspace",
            exec: vi.fn(async () => runtime.handle)
        } as never;

        const start = await execs.start({
            ctx,
            agentId: ctx.agentId,
            sessionId: "session-1",
            sandbox,
            command: "sleep 5",
            timeoutMs: 20,
            background: true
        });

        expect(start.processId).toBeTruthy();
        expect(start.timedOut).toBe(false);
        expect(start.running).toBe(true);

        runtime.stdout.write("first\n");

        const firstPoll = await execs.poll(ctx, "session-1", start.processId!, 20);
        expect(firstPoll.stdout).toBe("first\n");
        expect(firstPoll.running).toBe(true);

        runtime.stdout.write("second\n");
        runtime.stdout.end();
        runtime.stderr.end();
        runtime.resolveWait({
            stdout: "",
            stderr: "",
            exitCode: 0,
            signal: null,
            failed: false,
            cwd: "/workspace"
        });

        const secondPoll = await execs.poll(ctx, "session-1", start.processId!, 50);
        expect(secondPoll.stdout).toBe("second\n");
        expect(secondPoll.processId).toBeNull();
        expect(secondPoll.running).toBe(false);
        expect(secondPoll.exitCode).toBe(0);
    });

    it("kills all processes attached to a session", async () => {
        const execs = new SessionExecs();
        const runtime = handleBuild();
        const ctx = contextBuild();
        const sandbox = {
            workingDir: "/workspace",
            exec: vi.fn(async () => runtime.handle)
        } as never;

        const start = await execs.start({
            ctx,
            agentId: ctx.agentId,
            sessionId: "session-2",
            sandbox,
            command: "sleep 5",
            timeoutMs: 20,
            background: true
        });

        expect(start.processId).toBeTruthy();

        const killed = await execs.killBySessionId("session-2");
        expect(killed).toBe(1);
        expect(runtime.kill).toHaveBeenCalledWith("SIGTERM");
    });

    it("rejects poll from a different session", async () => {
        const execs = new SessionExecs();
        const runtime = handleBuild();
        const ctx = contextBuild();
        const sandbox = {
            workingDir: "/workspace",
            exec: vi.fn(async () => runtime.handle)
        } as never;

        const start = await execs.start({
            ctx,
            agentId: ctx.agentId,
            sessionId: "session-3",
            sandbox,
            command: "sleep 5",
            timeoutMs: 20,
            background: true
        });

        await expect(execs.poll(ctx, "session-4", start.processId!, 20)).rejects.toThrow(
            `Unknown process id: ${start.processId}`
        );
    });

    it("waits for foreground execs to exit even when output arrives before timeout", async () => {
        const execs = new SessionExecs();
        const runtime = handleBuild();
        const ctx = contextBuild();
        const sandbox = {
            workingDir: "/workspace",
            exec: vi.fn(async () => runtime.handle)
        } as never;

        const startPromise = execs.start({
            ctx,
            agentId: ctx.agentId,
            sessionId: "session-4",
            sandbox,
            command: "echo ok && sleep 1",
            timeoutMs: 100,
            background: false
        });

        setTimeout(() => {
            runtime.stdout.write("first\n");
        }, 10);
        setTimeout(() => {
            runtime.stdout.end();
            runtime.stderr.end();
            runtime.resolveWait({
                stdout: "",
                stderr: "",
                exitCode: 0,
                signal: null,
                failed: false,
                cwd: "/workspace"
            });
        }, 20);

        const result = await startPromise;
        expect(result.processId).toBeNull();
        expect(result.running).toBe(false);
        expect(result.stdout).toBe("first\n");
        expect(result.exitCode).toBe(0);
    });

    it("kills foreground execs when they hit timeout", async () => {
        const execs = new SessionExecs();
        const runtime = handleBuild();
        runtime.kill.mockImplementation(async (...args: unknown[]) => {
            const signal = typeof args[0] === "string" ? args[0] : "SIGTERM";
            runtime.stdout.write("partial\n");
            runtime.stdout.end();
            runtime.stderr.end();
            runtime.resolveWait({
                stdout: "",
                stderr: "",
                exitCode: null,
                signal,
                failed: true,
                cwd: "/workspace"
            });
        });
        const ctx = contextBuild();
        const sandbox = {
            workingDir: "/workspace",
            exec: vi.fn(async () => runtime.handle)
        } as never;

        const result = await execs.start({
            ctx,
            agentId: ctx.agentId,
            sessionId: "session-5",
            sandbox,
            command: "sleep 5",
            timeoutMs: 20,
            background: false
        });

        expect(runtime.kill).toHaveBeenCalledWith("SIGTERM");
        expect(result.processId).toBeNull();
        expect(result.running).toBe(false);
        expect(result.timedOut).toBe(true);
        expect(result.signal).toBe("SIGTERM");
        expect(result.stdout).toBe("partial\n");
    });

    it("lists running session execs for the current session", async () => {
        const execs = new SessionExecs();
        const runtime = handleBuild();
        const ctx = contextBuild();
        const sandbox = {
            workingDir: "/workspace",
            exec: vi.fn(async () => runtime.handle)
        } as never;

        const start = await execs.start({
            ctx,
            agentId: ctx.agentId,
            sessionId: "session-6",
            sandbox,
            command: "sleep 5",
            timeoutMs: 20,
            background: true
        });

        expect(execs.list(ctx, "session-6")).toEqual([
            {
                processId: start.processId!,
                command: "sleep 5",
                cwd: "/workspace"
            }
        ]);
    });
});

function contextBuild(): Context {
    return {
        userId: "user-1",
        agentId: "agent-1"
    } as Context;
}

function handleBuild() {
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const kill = vi.fn(async () => undefined);
    let resolveWait: ((result: SandboxExecResult) => void) | null = null;
    const waitPromise = new Promise<SandboxExecResult>((resolve) => {
        resolveWait = resolve;
    });
    return {
        handle: {
            stdout,
            stderr,
            kill,
            wait: () => waitPromise
        },
        stdout,
        stderr,
        kill,
        resolveWait: (result: SandboxExecResult) => resolveWait?.(result)
    };
}

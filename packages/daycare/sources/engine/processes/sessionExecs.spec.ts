import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Context, SandboxExecResult } from "@/types";
import { SessionExecs } from "./sessionExecs.js";

describe("SessionExecs", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("returns a process id on timeout and only new output on poll", async () => {
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
            detachOnTimeout: true
        });

        expect(start.processId).toBeTruthy();
        expect(start.timedOut).toBe(true);
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
            detachOnTimeout: true
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
            detachOnTimeout: true
        });

        await expect(execs.poll(ctx, "session-4", start.processId!, 20)).rejects.toThrow(
            `Unknown process id: ${start.processId}`
        );
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

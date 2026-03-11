import { StringDecoder } from "node:string_decoder";
import { createId } from "@paralleldrive/cuid2";

import type { Context, Sandbox, SandboxExecHandle, SandboxExecSignal } from "@/types";

const SESSION_EXEC_RUNTIME_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000;
const EXEC_KILL_WAIT_TIMEOUT_MS = 1_000;

export type SessionExecStartInput = {
    ctx: Context;
    agentId: string;
    sessionId: string;
    sandbox: Sandbox;
    command: string;
    cwd?: string;
    env?: Record<string, string | number | boolean>;
    secrets?: Record<string, string>;
    dotenv?: boolean | string;
    timeoutMs: number;
    background: boolean;
    abortSignal?: AbortSignal;
};

export type SessionExecResult = {
    processId: string | null;
    command: string;
    cwd: string;
    stdout: string;
    stderr: string;
    timedOut: boolean;
    running: boolean;
    exitCode: number | null;
    signal: string | null;
    failed: boolean;
};

export type SessionExecListItem = {
    processId: string;
    command: string;
    cwd: string;
};

type SessionExecEntry = {
    id: string;
    ctx: Context;
    agentId: string;
    sessionId: string;
    command: string;
    cwd: string;
    handle: SandboxExecHandle;
    stdout: string;
    stderr: string;
    stdoutOffset: number;
    stderrOffset: number;
    stdoutDecoder: StringDecoder;
    stderrDecoder: StringDecoder;
    exitCode: number | null;
    signal: string | null;
    failed: boolean;
    running: boolean;
    changeVersion: number;
    waiters: Set<() => void>;
};

/**
 * Manages session-scoped execs that can either complete inline or continue across poll/kill calls.
 * Expects: callers kill entries on session/agent shutdown through the provided helpers.
 */
export class SessionExecs {
    private readonly entries = new Map<string, SessionExecEntry>();

    async start(input: SessionExecStartInput): Promise<SessionExecResult> {
        const handle = await input.sandbox.exec({
            command: input.command,
            cwd: input.cwd,
            env: input.env,
            secrets: input.secrets,
            dotenv: input.dotenv,
            timeoutMs: SESSION_EXEC_RUNTIME_TIMEOUT_MS
        });
        const entry = this.entryCreate(input, handle);
        this.entries.set(entry.id, entry);

        try {
            if (input.background) {
                return {
                    processId: entry.id,
                    command: entry.command,
                    cwd: entry.cwd,
                    stdout: "",
                    stderr: "",
                    timedOut: false,
                    running: entry.running,
                    exitCode: entry.exitCode,
                    signal: entry.signal,
                    failed: entry.failed
                };
            }

            const waitOutcome = await this.waitForExitOrTimeout(entry, input.timeoutMs, input.abortSignal);
            if (waitOutcome === "completed") {
                const result = this.entryConsume(entry, false);
                this.entryRemoveIfComplete(entry);
                return result;
            }

            const stopped = await this.killInternal(entry, "SIGTERM", EXEC_KILL_WAIT_TIMEOUT_MS, input.abortSignal);
            if (!stopped.running) {
                return {
                    ...stopped,
                    timedOut: true
                };
            }
            const killed = await this.killInternal(entry, "SIGKILL", EXEC_KILL_WAIT_TIMEOUT_MS, input.abortSignal);
            return {
                ...killed,
                stdout: `${stopped.stdout}${killed.stdout}`,
                stderr: `${stopped.stderr}${killed.stderr}`,
                timedOut: true
            };
        } catch (error) {
            this.entries.delete(entry.id);
            void handle.kill("SIGTERM").catch(() => undefined);
            throw error;
        }
    }

    async poll(
        ctx: Context,
        sessionId: string,
        processId: string,
        timeoutMs: number,
        abortSignal?: AbortSignal
    ): Promise<SessionExecResult> {
        const entry = this.entryGetForContext(ctx, sessionId, processId);
        const result = await this.collectUntil(entry, timeoutMs, abortSignal);
        this.entryRemoveIfComplete(entry);
        return result;
    }

    async kill(
        ctx: Context,
        sessionId: string,
        processId: string,
        signal: SandboxExecSignal = "SIGTERM",
        timeoutMs = EXEC_KILL_WAIT_TIMEOUT_MS,
        abortSignal?: AbortSignal
    ): Promise<SessionExecResult> {
        const entry = this.entryGetForContext(ctx, sessionId, processId);
        return this.killInternal(entry, signal, timeoutMs, abortSignal);
    }

    async killBySessionId(sessionId: string): Promise<number> {
        return this.killMany((entry) => entry.sessionId === sessionId);
    }

    async killByAgentId(agentId: string): Promise<number> {
        return this.killMany((entry) => entry.agentId === agentId);
    }

    async killAll(): Promise<number> {
        return this.killMany(() => true);
    }

    list(ctx: Context, sessionId: string): SessionExecListItem[] {
        return Array.from(this.entries.values())
            .filter((entry) => entry.ctx.userId === ctx.userId && entry.agentId === ctx.agentId)
            .filter((entry) => entry.sessionId === sessionId && entry.running)
            .map((entry) => ({
                processId: entry.id,
                command: entry.command,
                cwd: entry.cwd
            }));
    }

    private entryCreate(input: SessionExecStartInput, handle: SandboxExecHandle): SessionExecEntry {
        const entry: SessionExecEntry = {
            id: createId(),
            ctx: input.ctx,
            agentId: input.agentId,
            sessionId: input.sessionId,
            command: input.command,
            cwd: input.cwd ?? input.sandbox.workingDir,
            handle,
            stdout: "",
            stderr: "",
            stdoutOffset: 0,
            stderrOffset: 0,
            stdoutDecoder: new StringDecoder("utf8"),
            stderrDecoder: new StringDecoder("utf8"),
            exitCode: null,
            signal: null,
            failed: false,
            running: true,
            changeVersion: 0,
            waiters: new Set()
        };

        this.streamAttach(entry, "stdout");
        this.streamAttach(entry, "stderr");
        void this.waitForExit(entry);
        return entry;
    }

    private streamAttach(entry: SessionExecEntry, stream: "stdout" | "stderr"): void {
        const source = stream === "stdout" ? entry.handle.stdout : entry.handle.stderr;
        const decoder = stream === "stdout" ? entry.stdoutDecoder : entry.stderrDecoder;
        source.on("data", (chunk) => {
            const text = decoder.write(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            if (text.length === 0) {
                return;
            }
            this.streamAppend(entry, stream, text);
        });
        source.on("end", () => {
            const tail = decoder.end();
            if (tail.length === 0) {
                return;
            }
            this.streamAppend(entry, stream, tail);
        });
    }

    private async waitForExit(entry: SessionExecEntry): Promise<void> {
        try {
            const result = await entry.handle.wait();
            entry.exitCode = result.exitCode;
            entry.signal = result.signal;
            entry.failed = result.failed;
        } catch (error) {
            const normalized = execErrorNormalize(error);
            if (normalized.stdout.length > 0) {
                this.streamAppend(entry, "stdout", normalized.stdout);
            }
            if (normalized.stderr.length > 0) {
                this.streamAppend(entry, "stderr", normalized.stderr);
            }
            entry.exitCode = normalized.exitCode;
            entry.signal = normalized.signal;
            entry.failed = true;
        } finally {
            entry.running = false;
            this.entrySignal(entry);
        }
    }

    private streamAppend(entry: SessionExecEntry, stream: "stdout" | "stderr", text: string): void {
        if (stream === "stdout") {
            entry.stdout += text;
        } else {
            entry.stderr += text;
        }
        this.entrySignal(entry);
    }

    private entrySignal(entry: SessionExecEntry): void {
        entry.changeVersion += 1;
        for (const resolve of entry.waiters) {
            resolve();
        }
        entry.waiters.clear();
    }

    private entryGetForContext(ctx: Context, sessionId: string, processId: string): SessionExecEntry {
        const entry = this.entries.get(processId);
        if (
            !entry ||
            entry.ctx.userId !== ctx.userId ||
            entry.agentId !== ctx.agentId ||
            entry.sessionId !== sessionId
        ) {
            throw new Error(`Unknown process id: ${processId}`);
        }
        return entry;
    }

    private entryConsume(entry: SessionExecEntry, timedOut: boolean): SessionExecResult {
        const stdout = entry.stdout.slice(entry.stdoutOffset);
        const stderr = entry.stderr.slice(entry.stderrOffset);
        entry.stdoutOffset = entry.stdout.length;
        entry.stderrOffset = entry.stderr.length;
        return {
            processId: entry.running ? entry.id : null,
            command: entry.command,
            cwd: entry.cwd,
            stdout,
            stderr,
            timedOut,
            running: entry.running,
            exitCode: entry.exitCode,
            signal: entry.signal,
            failed: entry.failed
        };
    }

    private entryHasPendingOutput(entry: SessionExecEntry): boolean {
        return entry.stdoutOffset < entry.stdout.length || entry.stderrOffset < entry.stderr.length;
    }

    private entryRemoveIfComplete(entry: SessionExecEntry): void {
        if (entry.running || this.entryHasPendingOutput(entry)) {
            return;
        }
        this.entries.delete(entry.id);
    }

    private async collectUntil(
        entry: SessionExecEntry,
        timeoutMs: number,
        abortSignal?: AbortSignal
    ): Promise<SessionExecResult> {
        if (this.entryHasPendingOutput(entry)) {
            // Let the background wait() resolution publish exit metadata before we snapshot.
            await Promise.resolve();
            return this.entryConsume(entry, false);
        }

        if (!entry.running) {
            return this.entryConsume(entry, false);
        }

        const version = entry.changeVersion;
        const outcome = await entryWait(entry, version, timeoutMs, abortSignal);
        if (outcome === "aborted") {
            throw abortErrorBuild();
        }
        return this.entryConsume(entry, outcome === "timeout" && entry.running);
    }

    private async waitForExitOrTimeout(
        entry: SessionExecEntry,
        timeoutMs: number,
        abortSignal?: AbortSignal
    ): Promise<"completed" | "timeout"> {
        const deadline = Date.now() + timeoutMs;
        while (entry.running) {
            const remainingMs = deadline - Date.now();
            if (remainingMs <= 0) {
                return "timeout";
            }
            const outcome = await entryWait(entry, entry.changeVersion, remainingMs, abortSignal);
            if (outcome === "aborted") {
                throw abortErrorBuild();
            }
            if (outcome === "timeout") {
                return entry.running ? "timeout" : "completed";
            }
        }
        return "completed";
    }

    private async killInternal(
        entry: SessionExecEntry,
        signal: SandboxExecSignal,
        timeoutMs: number,
        abortSignal?: AbortSignal
    ): Promise<SessionExecResult> {
        if (entry.running) {
            await entry.handle.kill(signal);
        }
        const result = await this.collectUntil(entry, timeoutMs, abortSignal);
        this.entryRemoveIfComplete(entry);
        return result.running
            ? result
            : {
                  ...result,
                  signal: result.signal ?? signal
              };
    }

    private async killMany(predicate: (entry: SessionExecEntry) => boolean): Promise<number> {
        const entries = Array.from(this.entries.values()).filter(predicate);
        await Promise.all(
            entries.map(async (entry) => {
                try {
                    await entry.handle.kill("SIGTERM");
                } catch {
                    // best-effort cleanup
                } finally {
                    this.entries.delete(entry.id);
                }
            })
        );
        return entries.length;
    }
}

async function entryWait(
    entry: SessionExecEntry,
    initialVersion: number,
    timeoutMs: number,
    abortSignal?: AbortSignal
): Promise<"changed" | "timeout" | "aborted"> {
    if (entry.changeVersion !== initialVersion) {
        return "changed";
    }

    return new Promise((resolve) => {
        const onChange = () => {
            cleanup();
            resolve("changed");
        };
        const onAbort = () => {
            cleanup();
            resolve("aborted");
        };
        const timer = setTimeout(() => {
            cleanup();
            resolve("timeout");
        }, timeoutMs);

        const cleanup = () => {
            clearTimeout(timer);
            entry.waiters.delete(onChange);
            abortSignal?.removeEventListener("abort", onAbort);
        };

        entry.waiters.add(onChange);
        if (abortSignal?.aborted) {
            cleanup();
            resolve("aborted");
            return;
        }
        abortSignal?.addEventListener("abort", onAbort, { once: true });
    });
}

function execErrorNormalize(error: unknown): {
    stdout: string;
    stderr: string;
    exitCode: number | null;
    signal: string | null;
} {
    const details = error as Partial<{ stdout: string; stderr: string; code: number | null; signal: string | null }>;
    return {
        stdout: typeof details.stdout === "string" ? details.stdout : "",
        stderr: execErrorText(details.stderr, error),
        exitCode: typeof details.code === "number" ? details.code : null,
        signal: typeof details.signal === "string" ? details.signal : null
    };
}

function execErrorText(stderr: unknown, error: unknown): string {
    if (typeof stderr === "string" && stderr.length > 0) {
        return stderr;
    }
    if (error instanceof Error && error.message.length > 0) {
        return error.message;
    }
    return "";
}

function abortErrorBuild(): Error {
    const error = new Error("Operation aborted.");
    error.name = "AbortError";
    return error;
}

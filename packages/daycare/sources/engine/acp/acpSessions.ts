import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { Readable, Writable } from "node:stream";
import {
    type Client,
    ClientSideConnection,
    type ContentBlock,
    ndJsonStream,
    type PermissionOption,
    PROTOCOL_VERSION,
    RequestError,
    type RequestPermissionResponse,
    type SessionNotification,
    type StopReason
} from "@agentclientprotocol/sdk";
import { createId } from "@paralleldrive/cuid2";
import type { Logger } from "pino";

import { AsyncLock } from "../../utils/lock.js";
import type { AcpSessionCreateInput, AcpSessionInfo, AcpSessionPromptResult } from "./acpSessionTypes.js";

const ACP_CLIENT_NAME = "Daycare";
const ACP_CLIENT_VERSION = "0.1.2";
const ACP_SHUTDOWN_TIMEOUT_MS = 2_000;

type AcpPromptCollector = {
    chunks: string[];
};

type AcpSessionRuntime = {
    info: AcpSessionInfo;
    child: ChildProcessWithoutNullStreams;
    connection: ClientSideConnection;
    promptLock: AsyncLock;
    promptCollector: AcpPromptCollector | null;
};

/**
 * Manages live ACP subprocess sessions over stdio.
 * Expects: adapters are available on PATH or addressed by absolute executable path.
 */
export class AcpSessions {
    private readonly logger: Logger;
    private readonly sessions = new Map<string, AcpSessionRuntime>();

    constructor(logger: Logger) {
        this.logger = logger;
    }

    async create(input: AcpSessionCreateInput): Promise<AcpSessionInfo> {
        const description = input.description.trim();
        const command = input.command.trim();
        if (!description) {
            throw new Error("ACP session description is required.");
        }
        if (!command) {
            throw new Error("ACP session command is required.");
        }

        const now = Date.now();
        const id = createId();
        const child = spawn(command, input.args, {
            cwd: input.cwd,
            env: {
                ...process.env,
                ...(input.env ?? {})
            },
            stdio: ["pipe", "pipe", "pipe"]
        });
        const stream = ndJsonStream(Writable.toWeb(child.stdin), Readable.toWeb(child.stdout));
        let runtime: AcpSessionRuntime | null = null;

        const connection = new ClientSideConnection(
            () =>
                ({
                    requestPermission: async (params) => requestPermissionResolve(input.permissionMode, params.options),
                    sessionUpdate: async (params) => {
                        if (!runtime) {
                            return;
                        }
                        acpSessionTouch(runtime.info);
                        acpSessionUpdateCollect(runtime, params);
                    }
                }) satisfies Client,
            stream
        );

        const info: AcpSessionInfo = {
            id,
            remoteSessionId: "",
            userId: input.ctx.userId,
            ownerAgentId: input.ownerAgentId,
            ownerAgentName: input.ownerAgentName,
            description,
            command,
            args: [...input.args],
            cwd: input.cwd,
            permissionMode: input.permissionMode,
            createdAt: now,
            updatedAt: now
        };

        runtime = {
            info,
            child,
            connection,
            promptLock: new AsyncLock(),
            promptCollector: null
        };

        const cleanup = () => {
            const existing = this.sessions.get(id);
            if (existing && existing === runtime) {
                this.sessions.delete(id);
            }
        };

        child.stderr.on("data", (chunk: Buffer) => {
            const text = chunk.toString("utf8").trim();
            if (!text) {
                return;
            }
            this.logger.debug({ sessionId: id, stderr: text }, "event: ACP adapter stderr");
        });
        child.once("exit", (code, signal) => {
            this.logger.info({ sessionId: id, code, signal }, "stop: ACP adapter exited");
            cleanup();
        });
        connection.closed
            .then(() => {
                this.logger.info({ sessionId: id }, "stop: ACP connection closed");
                cleanup();
            })
            .catch((error) => {
                this.logger.warn({ sessionId: id, error }, "error: ACP connection close wait failed");
                cleanup();
            });

        try {
            await connection.initialize({
                protocolVersion: PROTOCOL_VERSION,
                clientInfo: {
                    name: ACP_CLIENT_NAME,
                    version: ACP_CLIENT_VERSION
                },
                clientCapabilities: {}
            });
            const session = await connection.newSession({
                cwd: input.cwd,
                mcpServers: []
            });
            runtime.info.remoteSessionId = session.sessionId;
            this.sessions.set(id, runtime);
            this.logger.info(
                {
                    sessionId: id,
                    remoteSessionId: session.sessionId,
                    ownerAgentId: input.ownerAgentId,
                    command
                },
                "start: ACP session created"
            );
            return acpSessionInfoClone(runtime.info);
        } catch (error) {
            await acpSessionChildStop(child);
            const message = error instanceof Error ? error.message : "Failed to create ACP session.";
            throw new Error(`Failed to create ACP session: ${message}`);
        }
    }

    async prompt(sessionId: string, prompt: string, signal?: AbortSignal): Promise<AcpSessionPromptResult> {
        const runtime = this.sessions.get(sessionId);
        if (!runtime) {
            throw new Error(`Unknown ACP session id: ${sessionId}`);
        }
        const normalizedPrompt = prompt.trim();
        if (!normalizedPrompt) {
            throw new Error("ACP prompt is required.");
        }

        return runtime.promptLock.inLock(async () => {
            if (runtime.connection.signal.aborted) {
                throw new Error(`ACP session is closed: ${sessionId}`);
            }

            const abortHandler = () => {
                runtime.connection
                    .cancel({ sessionId: runtime.info.remoteSessionId })
                    .catch((error) => this.logger.debug({ sessionId, error }, "event: ACP cancel failed"));
            };
            signal?.addEventListener("abort", abortHandler, { once: true });
            runtime.promptCollector = { chunks: [] };
            try {
                const response = await runtime.connection.prompt({
                    sessionId: runtime.info.remoteSessionId,
                    prompt: [
                        {
                            type: "text",
                            text: normalizedPrompt
                        } satisfies ContentBlock
                    ]
                });
                acpSessionTouch(runtime.info);
                return {
                    sessionId,
                    stopReason: response.stopReason,
                    answer: acpPromptAnswerResolve(runtime.promptCollector.chunks, response.stopReason)
                };
            } catch (error) {
                if (error instanceof RequestError) {
                    throw new Error(error.message);
                }
                throw error;
            } finally {
                runtime.promptCollector = null;
                signal?.removeEventListener("abort", abortHandler);
            }
        });
    }

    list(): AcpSessionInfo[] {
        return Array.from(this.sessions.values())
            .map((runtime) => acpSessionInfoClone(runtime.info))
            .sort((left, right) => right.updatedAt - left.updatedAt);
    }

    /**
     * Child processes keep OS resources open, so shutdown must terminate them explicitly.
     */
    async shutdown(): Promise<void> {
        const runtimes = Array.from(this.sessions.values());
        this.sessions.clear();
        await Promise.all(runtimes.map((runtime) => acpSessionChildStop(runtime.child)));
    }
}

function acpSessionTouch(info: AcpSessionInfo): void {
    info.updatedAt = Date.now();
}

function acpSessionUpdateCollect(runtime: AcpSessionRuntime, notification: SessionNotification): void {
    if (notification.sessionId !== runtime.info.remoteSessionId) {
        return;
    }
    const collector = runtime.promptCollector;
    if (!collector) {
        return;
    }
    const update = notification.update;
    if (update.sessionUpdate !== "agent_message_chunk") {
        return;
    }
    if (update.content.type !== "text") {
        return;
    }
    collector.chunks.push(update.content.text);
}

function requestPermissionResolve(
    mode: AcpSessionInfo["permissionMode"],
    options: PermissionOption[]
): RequestPermissionResponse {
    if (options.length === 0) {
        throw new Error("ACP permission request did not include any options.");
    }
    const preferredPrefix = mode === "allow" ? "allow" : "reject";
    const fallback = options[mode === "allow" ? 0 : options.length - 1];
    if (!fallback) {
        throw new Error("ACP permission request did not include any selectable options.");
    }
    const selected = options.find((option) => option.kind.startsWith(preferredPrefix)) ?? fallback;
    return {
        outcome: {
            outcome: "selected",
            optionId: selected.optionId
        }
    };
}

function acpPromptAnswerResolve(chunks: string[], stopReason: StopReason): string {
    const answer = chunks.join("").trim();
    if (answer) {
        return answer;
    }
    return `ACP session completed with stop reason: ${stopReason}.`;
}

async function acpSessionChildStop(child: ChildProcessWithoutNullStreams): Promise<void> {
    if (child.exitCode !== null || child.signalCode !== null) {
        child.stdin.destroy();
        child.stdout.destroy();
        child.stderr.destroy();
        return;
    }
    child.kill("SIGTERM");
    await Promise.race([
        new Promise<void>((resolve) => {
            child.once("exit", () => resolve());
            child.once("close", () => resolve());
        }),
        new Promise<void>((resolve) => {
            setTimeout(() => {
                if (child.exitCode === null && child.signalCode === null) {
                    child.kill("SIGKILL");
                }
                resolve();
            }, ACP_SHUTDOWN_TIMEOUT_MS);
        })
    ]);
    child.stdin.destroy();
    child.stdout.destroy();
    child.stderr.destroy();
}

function acpSessionInfoClone(info: AcpSessionInfo): AcpSessionInfo {
    return {
        ...info,
        args: [...info.args]
    };
}

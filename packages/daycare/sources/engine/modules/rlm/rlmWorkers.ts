import { type ChildProcess, fork } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createId } from "@paralleldrive/cuid2";

import { getLogger } from "../../../log.js";
import { AsyncLock } from "../../../util/lock.js";
import { onShutdown } from "../../../util/shutdown.js";
import type { RlmVmProgress } from "./rlmVmProgress.js";
import { RlmWorkerError, rlmWorkerErrorFromSerialized } from "./rlmWorkerError.js";
import type { RlmWorkerRequest, RlmWorkerResponse } from "./rlmWorkerProtocol.js";

const logger = getLogger("engine.rlm-workers");
const REQUEST_TIMEOUT_MS = 60_000;

type PendingRequest = {
    workerKey: string;
    resolve: (value: { progress: RlmVmProgress; printOutput: string[] }) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
};

type RlmWorkersOptions = {
    requestTimeoutMs?: number;
};

/**
 * Worker facade that isolates Monty VM execution inside a dedicated child process.
 * Expects: callers use start/resume methods and treat thrown errors as execution failures.
 */
export class RlmWorkers {
    private readonly lock = new AsyncLock();
    private readonly pending = new Map<string, PendingRequest>();
    private readonly requestTimeoutMs: number;
    private readonly workers = new Map<string, ChildProcess>();

    constructor(options: RlmWorkersOptions = {}) {
        this.requestTimeoutMs = options.requestTimeoutMs ?? REQUEST_TIMEOUT_MS;
    }

    async start(
        workerKey: string,
        payload: Extract<RlmWorkerRequest, { type: "start" }>["payload"]
    ): Promise<{ progress: RlmVmProgress; printOutput: string[] }> {
        return this.request(workerKey, {
            type: "start",
            payload
        });
    }

    async resume(
        workerKey: string,
        payload: Extract<RlmWorkerRequest, { type: "resume" }>["payload"]
    ): Promise<{ progress: RlmVmProgress; printOutput: string[] }> {
        return this.request(workerKey, {
            type: "resume",
            payload
        });
    }

    async stop(): Promise<void> {
        const workers = await this.lock.inLock(async () => {
            const active = [...this.workers.values()];
            this.workers.clear();
            return active;
        });
        if (workers.length === 0) {
            return;
        }

        await this.pendingRejectAll(
            new RlmWorkerError("worker_crash", "Monty worker was stopped before request completion.")
        );
        await Promise.all(workers.map((worker) => workerStop(worker)));
    }

    private async request(
        workerKey: string,
        input: Omit<RlmWorkerRequest, "id">
    ): Promise<{
        progress: RlmVmProgress;
        printOutput: string[];
    }> {
        const worker = await this.workerEnsure(workerKey);
        const id = createId();
        const request = {
            id,
            ...input
        } as RlmWorkerRequest;

        return new Promise<{
            progress: RlmVmProgress;
            printOutput: string[];
        }>((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pending.delete(id);
                reject(new RlmWorkerError("worker_protocol", "Monty worker request timed out."));
            }, this.requestTimeoutMs);
            this.pending.set(id, { workerKey, resolve, reject, timeout });

            worker.send(request, (error) => {
                if (!error) {
                    return;
                }
                const pending = this.pending.get(id);
                if (!pending) {
                    return;
                }
                clearTimeout(pending.timeout);
                this.pending.delete(id);
                reject(
                    new RlmWorkerError(
                        "worker_crash",
                        `Failed to send request to Monty worker (${workerKey}): ${error.message}`
                    )
                );
            });
        });
    }

    private async workerEnsure(workerKey: string): Promise<ChildProcess> {
        return this.lock.inLock(async () => {
            const existing = this.workers.get(workerKey);
            if (existing) {
                return existing;
            }
            const worker = workerSpawn();
            worker.on("message", (message) => {
                this.messageHandle(message);
            });
            worker.on("exit", (code, signal) => {
                const reason = `Monty worker exited (code=${code ?? "null"}, signal=${signal ?? "null"})`;
                void this.workerHandleExit(workerKey, worker, reason);
            });
            worker.on("error", (error) => {
                void this.workerHandleExit(workerKey, worker, `Monty worker crashed: ${error.message}`);
            });
            this.workers.set(workerKey, worker);
            logger.debug(`start: Monty worker started key=${workerKey} pid=${worker.pid ?? "unknown"}`);
            return worker;
        });
    }

    private messageHandle(message: unknown): void {
        const response = responseParse(message);
        if (!response) {
            return;
        }

        const pending = this.pending.get(response.id);
        if (!pending) {
            return;
        }
        clearTimeout(pending.timeout);
        this.pending.delete(response.id);

        if (!response.ok) {
            pending.reject(rlmWorkerErrorFromSerialized(response.error));
            return;
        }

        if (response.progress.type === "snapshot") {
            const snapshotDump = Buffer.from(response.progress.snapshot, "base64");
            pending.resolve({
                progress: {
                    functionName: response.progress.functionName,
                    args: response.progress.args,
                    kwargs: response.progress.kwargs,
                    dump: () => Uint8Array.from(snapshotDump)
                },
                printOutput: response.progress.printOutput
            });
            return;
        }

        pending.resolve({
            progress: {
                output: response.progress.output
            },
            printOutput: response.progress.printOutput
        });
    }

    private async workerHandleExit(workerKey: string, worker: ChildProcess, message: string): Promise<void> {
        const shouldReject = await this.lock.inLock(async () => {
            if (this.workers.get(workerKey) !== worker) {
                return false;
            }
            this.workers.delete(workerKey);
            return true;
        });
        if (!shouldReject) {
            return;
        }
        logger.warn({ pid: worker.pid, workerKey }, `error: ${message}`);
        await this.pendingRejectByWorkerKey(workerKey, new RlmWorkerError("worker_crash", message));
    }

    private async pendingRejectAll(error: Error): Promise<void> {
        for (const [id, pending] of this.pending.entries()) {
            clearTimeout(pending.timeout);
            this.pending.delete(id);
            pending.reject(error);
        }
    }

    private async pendingRejectByWorkerKey(workerKey: string, error: Error): Promise<void> {
        for (const [id, pending] of this.pending.entries()) {
            if (pending.workerKey !== workerKey) {
                continue;
            }
            clearTimeout(pending.timeout);
            this.pending.delete(id);
            pending.reject(error);
        }
    }
}

let sharedWorkers: RlmWorkers | null = null;
let sharedShutdownRegistered = false;

/**
 * Returns the shared RLM worker facade used by VM step primitives.
 * Expects: process-level shutdown hooks remain active for the app lifetime.
 */
export function rlmWorkersSharedGet(): RlmWorkers {
    if (!sharedWorkers) {
        sharedWorkers = new RlmWorkers();
    }
    if (!sharedShutdownRegistered) {
        sharedShutdownRegistered = true;
        onShutdown("rlm-workers", async () => {
            await sharedWorkers?.stop();
        });
    }
    return sharedWorkers;
}

function responseParse(message: unknown): RlmWorkerResponse | null {
    if (typeof message !== "object" || message === null) {
        return null;
    }
    const response = message as Partial<RlmWorkerResponse>;
    if (typeof response.id !== "string" || typeof response.ok !== "boolean") {
        return null;
    }
    return response as RlmWorkerResponse;
}

function workerSpawn(): ChildProcess {
    const currentPath = fileURLToPath(import.meta.url);
    const extension = path.extname(currentPath);
    const workerPath = path.join(path.dirname(currentPath), `rlmWorkerProcess${extension}`);
    const execArgv = workerExecArgvResolve(workerPath);
    return fork(workerPath, [], {
        stdio: ["ignore", "ignore", "ignore", "ipc"],
        serialization: "advanced",
        execArgv
    });
}

function workerExecArgvResolve(workerPath: string): string[] {
    if (!workerPath.endsWith(".ts")) {
        return [];
    }
    const nodeRequire = createRequire(import.meta.url);
    const tsxPath = nodeRequire.resolve("tsx");
    return ["--import", tsxPath];
}

async function workerStop(worker: ChildProcess): Promise<void> {
    await new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
            if (settled) {
                return;
            }
            settled = true;
            resolve();
        };

        const timer = setTimeout(() => {
            worker.kill("SIGKILL");
            finish();
        }, 1_000);
        timer.unref();

        worker.once("exit", () => {
            clearTimeout(timer);
            finish();
        });

        worker.kill("SIGTERM");
    });
}

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createId } from "@paralleldrive/cuid2";
import { getLogger } from "../log.js";
import { Context, type ContextJson, contextToJSON } from "../types.js";
import type { DaycareRole } from "../utils/hasRole.js";
import { durableContextBind, durableContextCallGet } from "./durableContext.js";
import {
    type DurableFunctionInput,
    type DurableFunctionName,
    type DurableFunctionOutput,
    durableFunctionEnabled,
    durableFunctionKey
} from "./durableFunctions.js";
import type { Durable, DurableExecute } from "./durableTypes.js";

const logger = getLogger("durable.local");

type DurableLocalOptions = {
    execute: DurableExecute;
    roles?: readonly DaycareRole[];
    retryBaseMs?: number;
    rootDir: string;
};

type DurableLocalJob = {
    attempts: number;
    createdAt: number;
    ctx: ContextJson;
    id: string;
    input: unknown;
    name: DurableFunctionName;
    nextRunAt: number;
    updatedAt: number;
};

/**
 * Local durable runtime used when no remote durable backend is configured.
 * Expects: scheduled calls persist to disk and are replayed after restarts.
 */
export class DurableLocal implements Durable {
    readonly kind = "local" as const;
    private readonly execute: DurableExecute;
    private readonly roles: readonly DaycareRole[];
    private readonly retryBaseMs: number;
    private readonly rootDir: string;
    private readonly pendingDir: string;
    private readonly activeDir: string;
    private timer: NodeJS.Timeout | null = null;
    private draining = false;
    private started = false;
    private stopped = false;

    constructor(options: DurableLocalOptions) {
        this.execute = options.execute;
        this.roles = options.roles ?? [];
        this.retryBaseMs = Math.max(25, Math.floor(options.retryBaseMs ?? 250));
        this.rootDir = options.rootDir;
        this.pendingDir = path.join(this.rootDir, "pending");
        this.activeDir = path.join(this.rootDir, "active");
    }

    async invoke<TName extends DurableFunctionName>(
        ctx: Context,
        name: TName,
        input: DurableFunctionInput<TName>
    ): Promise<DurableFunctionOutput<TName> | undefined> {
        const call = durableContextCallGet(ctx, this.kind);
        if (call) {
            return call(ctx, name, input);
        }
        await this.schedule(ctx, name, input);
    }

    async call<TName extends DurableFunctionName>(
        ctx: Context,
        name: TName,
        input: DurableFunctionInput<TName>
    ): Promise<DurableFunctionOutput<TName>> {
        this.functionRequireEnabled(name);
        const call = durableContextCallGet(ctx, this.kind);
        if (!call) {
            throw new Error("Durable call requires a durable execution context.");
        }
        return call(ctx, name, input);
    }

    async schedule<TName extends DurableFunctionName>(
        ctx: Context,
        name: TName,
        input: DurableFunctionInput<TName>
    ): Promise<void> {
        this.functionRequireEnabled(name);
        await this.ensureDirs();

        const job = this.jobBuild(ctx, name, input);
        const pendingPath = this.pendingPath(job.id);
        const activePath = this.activePath(job.id);

        if ((await fileExists(pendingPath)) || (await fileExists(activePath))) {
            return;
        }

        await writeJsonAtomic(pendingPath, job);
        this.triggerDrain(0);
    }

    async start(): Promise<void> {
        if (this.started || this.stopped) {
            return;
        }
        await this.ensureDirs();
        await this.recoverActiveJobs();
        this.started = true;
        logger.info("skip: Durable runtime using local implementation");
        this.triggerDrain(0);
    }

    async stop(): Promise<void> {
        this.stopped = true;
        this.started = false;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    private async ensureDirs(): Promise<void> {
        await fs.mkdir(this.pendingDir, { recursive: true });
        await fs.mkdir(this.activeDir, { recursive: true });
    }

    private triggerDrain(delayMs: number): void {
        if (!this.started || this.stopped) {
            return;
        }
        if (this.timer) {
            clearTimeout(this.timer);
        }
        this.timer = setTimeout(
            () => {
                this.timer = null;
                void this.drain();
            },
            Math.max(0, Math.floor(delayMs))
        );
    }

    private async drain(): Promise<void> {
        if (!this.started || this.stopped || this.draining) {
            return;
        }

        this.draining = true;
        try {
            while (this.started && !this.stopped) {
                const next = await this.nextJob();
                if (!next) {
                    return;
                }

                const delay = next.nextRunAt - Date.now();
                if (delay > 0) {
                    this.triggerDrain(delay);
                    return;
                }

                await this.jobRun(next.id);
            }
        } finally {
            this.draining = false;
        }
    }

    private async nextJob(): Promise<DurableLocalJob | null> {
        const entries = await fs.readdir(this.pendingDir).catch(() => []);
        if (entries.length === 0) {
            return null;
        }

        const jobs: DurableLocalJob[] = [];
        for (const entry of entries) {
            if (!entry.endsWith(".json")) {
                continue;
            }
            const loaded = await this.jobRead(this.pendingPath(entry.slice(0, -5)));
            if (loaded) {
                jobs.push(loaded);
            }
        }

        if (jobs.length === 0) {
            return null;
        }

        jobs.sort((left, right) => {
            if (left.nextRunAt !== right.nextRunAt) {
                return left.nextRunAt - right.nextRunAt;
            }
            return left.createdAt - right.createdAt;
        });
        return jobs[0] ?? null;
    }

    private async jobRun(id: string): Promise<void> {
        const pendingPath = this.pendingPath(id);
        const activePath = this.activePath(id);

        try {
            await fs.rename(pendingPath, activePath);
        } catch (error) {
            if (isMissingFileError(error)) {
                return;
            }
            throw error;
        }

        const job = await this.jobRead(activePath);
        if (!job) {
            return;
        }

        const ctx = Context.fromJSON(job.ctx);
        try {
            const durableCtx = durableContextBind(ctx, this.kind, (callCtx, callName, callInput) =>
                this.executeRequireEnabled(callCtx, callName, callInput)
            );
            await this.executeRequireEnabled(durableCtx, job.name, jobInputCast(job.name, job.input));
            await fs.unlink(activePath).catch(() => undefined);
        } catch (error) {
            const nextAttempt = job.attempts + 1;
            const retryDelay = this.retryBaseMs * 2 ** Math.min(6, nextAttempt - 1);
            const requeued: DurableLocalJob = {
                ...job,
                attempts: nextAttempt,
                nextRunAt: Date.now() + retryDelay,
                updatedAt: Date.now()
            };
            logger.warn(
                { error, id: job.id, name: job.name, nextRunAt: requeued.nextRunAt },
                "error: Durable job failed"
            );
            await writeJsonAtomic(this.pendingPath(id), requeued);
            await fs.unlink(activePath).catch(() => undefined);
        }
    }

    private async recoverActiveJobs(): Promise<void> {
        const entries = await fs.readdir(this.activeDir).catch(() => []);
        for (const entry of entries) {
            if (!entry.endsWith(".json")) {
                continue;
            }

            const id = entry.slice(0, -5);
            const activePath = this.activePath(id);
            const pendingPath = this.pendingPath(id);
            if (await fileExists(pendingPath)) {
                await fs.unlink(activePath).catch(() => undefined);
                continue;
            }
            await fs.rename(activePath, pendingPath).catch(() => undefined);
        }
    }

    private async jobRead(filePath: string): Promise<DurableLocalJob | null> {
        let raw: string;
        try {
            raw = await fs.readFile(filePath, "utf8");
        } catch (error) {
            if (isMissingFileError(error)) {
                return null;
            }
            throw error;
        }

        try {
            return JSON.parse(raw) as DurableLocalJob;
        } catch (error) {
            logger.warn({ error, filePath }, "error: Failed to parse durable job; dropping corrupt file");
            await fs.unlink(filePath).catch(() => undefined);
            return null;
        }
    }

    private jobBuild<TName extends DurableFunctionName>(
        ctx: Context,
        name: TName,
        input: DurableFunctionInput<TName>
    ): DurableLocalJob {
        const now = Date.now();
        return {
            attempts: 0,
            createdAt: now,
            ctx: contextToJSON(ctx),
            id: this.jobId(ctx, name, input),
            input,
            name,
            nextRunAt: now,
            updatedAt: now
        };
    }

    private jobId<TName extends DurableFunctionName>(
        ctx: Context,
        name: TName,
        input: DurableFunctionInput<TName>
    ): string {
        const key = durableFunctionKey(ctx, name, input);
        if (!key) {
            return createId();
        }
        return createHash("sha1").update(`${name}\u0000${key}`).digest("hex");
    }

    private pendingPath(id: string): string {
        return path.join(this.pendingDir, `${id}.json`);
    }

    private activePath(id: string): string {
        return path.join(this.activeDir, `${id}.json`);
    }

    private executeRequireEnabled<TName extends DurableFunctionName>(
        ctx: Context,
        name: TName,
        input: DurableFunctionInput<TName>
    ): Promise<DurableFunctionOutput<TName>> {
        this.functionRequireEnabled(name);
        return this.execute(ctx, name, input);
    }

    private functionRequireEnabled(name: DurableFunctionName): void {
        if (durableFunctionEnabled(name, this.roles)) {
            return;
        }
        const roleLabel = this.roles.length === 0 ? "none" : this.roles.join(", ");
        throw new Error(`Durable function "${name}" is disabled for roles: ${roleLabel}.`);
    }
}

async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

function isMissingFileError(error: unknown): boolean {
    return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
    const tempPath = `${filePath}.${createId()}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(value), "utf8");
    await fs.rename(tempPath, filePath);
}

function jobInputCast<TName extends DurableFunctionName>(_name: TName, input: unknown): DurableFunctionInput<TName> {
    return input as DurableFunctionInput<TName>;
}

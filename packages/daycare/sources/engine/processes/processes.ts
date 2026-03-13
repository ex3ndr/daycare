import { promises as fs, realpathSync } from "node:fs";
import path from "node:path";
import { createId } from "@paralleldrive/cuid2";
import type { Logger } from "pino";

import type { Context, SessionPermissions } from "@/types";
import { Sandbox } from "../../sandbox/sandbox.js";
import { sandboxCanWrite } from "../../sandbox/sandboxCanWrite.js";
import { sandboxResourceLimitsResolve } from "../../sandbox/sandboxResourceLimitsResolve.js";
import type { SandboxDockerConfig } from "../../sandbox/sandboxTypes.js";
import type { ResolvedDockerSettings } from "../../settings.js";
import type { ProcessDbRecord } from "../../storage/databaseTypes.js";
import type { ProcessesRepository, ProcessesRuntimeUpdate } from "../../storage/processesRepository.js";
import { envNormalize } from "../../utils/envNormalize.js";
import { AsyncLock } from "../../utils/lock.js";
import type { PathMountPoint } from "../../utils/pathMountTypes.js";
import { shellQuote } from "../../utils/shellQuote.js";
import { resolveWorkspacePath } from "../permissions.js";
import { processBootTimeRead } from "./processBootTimeRead.js";
import {
    type SessionExecListItem,
    type SessionExecResult,
    type SessionExecStartInput,
    SessionExecs
} from "./sessionExecs.js";

const MONITOR_INTERVAL_MS = 2_000;
const PROCESS_STOP_POLL_MS = 200;
const RESTART_BACKOFF_BASE_MS = 2_000;
const RESTART_BACKOFF_MAX_MS = 60_000;
const RESTART_STABLE_UPTIME_MS = 30_000;
const DOCKER_STOP_TIMEOUT_MS = 8_000;
const PROCESS_CONTROL_PATH = "/process/control.fifo";
const PROCESS_LOG_PATH = "/process/process.log";

const SIGNALS = ["SIGTERM", "SIGINT", "SIGHUP", "SIGKILL"] as const;

export type ProcessSignal = (typeof SIGNALS)[number];

export type ProcessOwner = {
    type: "plugin";
    id: string;
};

export type ProcessCreateInput = {
    command: string;
    name?: string;
    cwd?: string;
    env?: Record<string, string | number | boolean>;
    home?: string;
    keepAlive?: boolean;
    allowLocalBinding?: boolean;
    owner?: ProcessOwner;
    userId: string;
};

export type ProcessInfo = {
    id: string;
    name: string;
    command: string;
    cwd: string;
    home: string | null;
    pid: number | null;
    keepAlive: boolean;
    desiredState: "running" | "stopped";
    status: "running" | "stopped" | "exited";
    restartCount: number;
    createdAt: number;
    updatedAt: number;
    lastStartedAt: number | null;
    lastExitedAt: number | null;
    logPath: string;
};

type ProcessRecord = {
    id: string;
    userId: string;
    name: string;
    command: string;
    cwd: string;
    home: string | null;
    env: Record<string, string>;
    allowLocalBinding: boolean;
    permissions: SessionPermissions;
    owner: ProcessOwner | null;
    keepAlive: boolean;
    desiredState: "running" | "stopped";
    status: "running" | "stopped" | "exited";
    pid: number | null;
    bootTimeMs: number | null;
    restartCount: number;
    restartFailureCount: number;
    nextRestartAt: number | null;
    createdAt: number;
    updatedAt: number;
    lastStartedAt: number | null;
    lastExitedAt: number | null;
    settingsPath: string;
    logPath: string;
};

type ProcessRuntime = {
    start(record: ProcessRecord): Promise<number | null>;
    isRunning(record: ProcessRecord): Promise<boolean>;
    stop(record: ProcessRecord, signal: ProcessSignal): Promise<void>;
    remove(record: ProcessRecord): Promise<void>;
};

type ProcessSandboxSettings = {
    backend: "sandbox";
    processUserId: string;
    controlPath: string;
    mounts: Array<{
        hostPath: string;
        mappedPath: string;
        readOnly: boolean;
    }>;
};

/**
 * Manages durable background processes persisted in SQLite.
 * Expects: all state writes happen through this facade to keep pid/status in sync.
 */
export class Processes {
    private readonly baseDir: string;
    private readonly recordsDir: string;
    private readonly lock = new AsyncLock();
    private readonly logger: Logger;
    private readonly runtime: ProcessRuntime;
    private readonly bootTimeProvider: () => Promise<number | null>;
    private readonly repository: Pick<
        ProcessesRepository,
        "create" | "findAll" | "findById" | "update" | "updateRuntime" | "delete" | "deleteByOwner"
    >;
    private readonly sessionExecs = new SessionExecs();
    private readonly records = new Map<string, ProcessRecord>();
    private currentBootTimeMs: number | null = null;
    private currentBootTimeKnown = false;
    private monitorHandle: NodeJS.Timeout | null = null;

    constructor(
        baseDir: string,
        logger: Logger,
        options: {
            bootTimeProvider?: () => Promise<number | null>;
            docker?: ResolvedDockerSettings;
            sandboxResourceLimits?: {
                cpu: number;
                memory: string;
            };
            repository: Pick<
                ProcessesRepository,
                "create" | "findAll" | "findById" | "update" | "updateRuntime" | "delete" | "deleteByOwner"
            >;
            runtime?: ProcessRuntime;
        }
    ) {
        this.baseDir = realpathSyncSafe(path.resolve(baseDir));
        this.recordsDir = path.join(this.baseDir, "processes");
        this.logger = logger;
        this.bootTimeProvider = options.bootTimeProvider ?? processBootTimeRead;
        this.repository = options.repository;
        this.runtime =
            options.runtime ??
            (options.docker
                ? processRuntimeBuild(options.docker, options.sandboxResourceLimits)
                : processRuntimeUnavailableBuild());
    }

    async load(): Promise<void> {
        await fs.mkdir(this.recordsDir, { recursive: true });
        this.currentBootTimeMs = await this.bootTimeProvider();
        this.currentBootTimeKnown = true;
        await this.lock.inLock(async () => {
            this.records.clear();
            const rows = await this.repository.findAll();
            for (const row of rows) {
                const record = processRecordFromDb(row);
                this.clearStalePidForBootMismatch(record);
                this.records.set(record.id, record);
            }
            await this.refreshRecordStatusLocked();
        });
        this.startMonitor();
    }

    unload(): void {
        if (this.monitorHandle) {
            // Interval cleanup is required to avoid keeping timers alive after runtime shutdown.
            clearInterval(this.monitorHandle);
            this.monitorHandle = null;
        }
    }

    async create(input: ProcessCreateInput, permissions: SessionPermissions): Promise<ProcessInfo> {
        return this.lock.inLock(async () => {
            const now = Date.now();
            const normalizedPermissions = permissionsPathNormalize(permissions);
            const workingDir = normalizedPermissions.workingDir;
            if (!workingDir) {
                throw new Error("Workspace is not configured.");
            }

            const command = input.command.trim();
            if (!command) {
                throw new Error("Command is required.");
            }

            if (input.cwd && !path.isAbsolute(input.cwd)) {
                throw new Error("Path must be absolute.");
            }
            if (input.home && !path.isAbsolute(input.home)) {
                throw new Error("Path must be absolute.");
            }

            const cwdCandidate = input.cwd
                ? path.isAbsolute(input.cwd)
                    ? realpathSyncSafe(input.cwd)
                    : path.resolve(workingDir, input.cwd)
                : workingDir;
            const cwd = realpathSyncSafe(resolveWorkspacePath(workingDir, cwdCandidate));
            const envInput = envNormalize(input.env) ?? {};
            const id = createId();
            const recordDir = this.processDir(id);
            const home = input.home
                ? await sandboxCanWrite(normalizedPermissions, realpathSyncSafe(input.home))
                : path.join(recordDir, "home");
            const settingsPath = path.join(recordDir, "sandbox.json");
            const logPath = path.join(recordDir, "process.log");
            const bootTimeMs = await this.resolveCurrentBootTimeMsLocked();
            const userId = normalizeRequiredUserId(input.userId);
            await fs.mkdir(recordDir, { recursive: true });

            const record: ProcessRecord = {
                id,
                userId,
                name: (input.name?.trim() || id).slice(0, 80),
                command,
                cwd,
                home,
                env: envInput,
                allowLocalBinding: input.allowLocalBinding === true,
                permissions: clonePermissions(normalizedPermissions),
                owner: input.owner ? ownerNormalize(input.owner) : null,
                keepAlive: input.keepAlive ?? false,
                desiredState: "running",
                status: "stopped",
                pid: null,
                bootTimeMs,
                restartCount: 0,
                restartFailureCount: 0,
                nextRestartAt: null,
                createdAt: now,
                updatedAt: now,
                lastStartedAt: null,
                lastExitedAt: null,
                settingsPath,
                logPath
            };

            await this.startRecordLocked(record, { incrementRestart: false });
            this.records.set(record.id, record);
            await this.repository.create(processRecordToDb(record));
            return toProcessInfo(record);
        });
    }

    async listByOwner(owner: ProcessOwner): Promise<ProcessInfo[]> {
        return this.lock.inLock(async () => {
            const normalizedOwner = ownerNormalize(owner);
            await this.refreshRecordStatusLocked();
            return Array.from(this.records.values())
                .filter((record) => ownerIs(record.owner, normalizedOwner))
                .sort((a, b) => a.createdAt - b.createdAt)
                .map((record) => toProcessInfo(record));
        });
    }

    async list(): Promise<ProcessInfo[]> {
        return this.lock.inLock(async () => {
            await this.refreshRecordStatusLocked();
            return Array.from(this.records.values())
                .sort((a, b) => a.createdAt - b.createdAt)
                .map((record) => toProcessInfo(record));
        });
    }

    async listForContext(ctx: Context): Promise<ProcessInfo[]> {
        return this.lock.inLock(async () => {
            const userId = contextUserIdNormalize(ctx);
            await this.refreshRecordStatusLocked();
            return Array.from(this.records.values())
                .filter((record) => record.userId === userId)
                .sort((a, b) => a.createdAt - b.createdAt)
                .map((record) => toProcessInfo(record));
        });
    }

    async get(processId: string): Promise<ProcessInfo> {
        return this.lock.inLock(async () => {
            await this.refreshRecordStatusLocked();
            const record = this.records.get(processId);
            if (!record) {
                throw new Error(`Unknown process id: ${processId}`);
            }
            return toProcessInfo(record);
        });
    }

    async getForContext(ctx: Context, processId: string): Promise<ProcessInfo> {
        return this.lock.inLock(async () => {
            await this.refreshRecordStatusLocked();
            const record = recordForContextGet(this.records, ctx, processId);
            return toProcessInfo(record);
        });
    }

    async stop(processId: string, signal: ProcessSignal = "SIGTERM"): Promise<ProcessInfo> {
        return this.lock.inLock(async () => {
            const record = this.records.get(processId);
            if (!record) {
                throw new Error(`Unknown process id: ${processId}`);
            }
            record.desiredState = "stopped";
            await this.stopRecordLocked(record, signal);
            await this.writeRecordLocked(record);
            return toProcessInfo(record);
        });
    }

    async stopForContext(ctx: Context, processId: string, signal: ProcessSignal = "SIGTERM"): Promise<ProcessInfo> {
        return this.lock.inLock(async () => {
            const record = recordForContextGet(this.records, ctx, processId);
            record.desiredState = "stopped";
            await this.stopRecordLocked(record, signal);
            await this.writeRecordLocked(record);
            return toProcessInfo(record);
        });
    }

    async remove(processId: string, signal: ProcessSignal = "SIGTERM"): Promise<void> {
        await this.lock.inLock(async () => {
            const record = this.records.get(processId);
            if (!record) {
                throw new Error(`Unknown process id: ${processId}`);
            }
            await this.removeRecordLocked(record, signal);
        });
    }

    async removeByOwner(owner: ProcessOwner, signal: ProcessSignal = "SIGTERM"): Promise<number> {
        return this.lock.inLock(async () => {
            const normalizedOwner = ownerNormalize(owner);
            const records = Array.from(this.records.values()).filter((record) =>
                ownerIs(record.owner, normalizedOwner)
            );
            for (const record of records) {
                await this.removeRecordLocked(record, signal);
            }
            return records.length;
        });
    }

    async stopAll(signal: ProcessSignal = "SIGTERM"): Promise<ProcessInfo[]> {
        return this.lock.inLock(async () => {
            const results: ProcessInfo[] = [];
            for (const record of this.records.values()) {
                record.desiredState = "stopped";
                await this.stopRecordLocked(record, signal);
                await this.writeRecordLocked(record);
                results.push(toProcessInfo(record));
            }
            return results;
        });
    }

    async stopAllForContext(ctx: Context, signal: ProcessSignal = "SIGTERM"): Promise<ProcessInfo[]> {
        return this.lock.inLock(async () => {
            const userId = contextUserIdNormalize(ctx);
            const results: ProcessInfo[] = [];
            for (const record of this.records.values()) {
                if (record.userId !== userId) {
                    continue;
                }
                record.desiredState = "stopped";
                await this.stopRecordLocked(record, signal);
                await this.writeRecordLocked(record);
                results.push(toProcessInfo(record));
            }
            return results;
        });
    }

    async execStartForContext(input: SessionExecStartInput): Promise<SessionExecResult> {
        return this.sessionExecs.start(input);
    }

    async execPollForContext(
        ctx: Context,
        sessionId: string,
        processId: string,
        timeoutMs: number,
        abortSignal?: AbortSignal
    ): Promise<SessionExecResult> {
        return this.sessionExecs.poll(ctx, sessionId, processId, timeoutMs, abortSignal);
    }

    async execKillForContext(
        ctx: Context,
        sessionId: string,
        processId: string,
        signal: ProcessSignal = "SIGTERM",
        timeoutMs?: number,
        abortSignal?: AbortSignal
    ): Promise<SessionExecResult> {
        return this.sessionExecs.kill(ctx, sessionId, processId, signal, timeoutMs, abortSignal);
    }

    execListForContext(ctx: Context, sessionId: string): SessionExecListItem[] {
        return this.sessionExecs.list(ctx, sessionId);
    }

    async killSessionExecs(sessionId: string): Promise<number> {
        return this.sessionExecs.killBySessionId(sessionId);
    }

    async killAgentExecs(agentId: string): Promise<number> {
        return this.sessionExecs.killByAgentId(agentId);
    }

    async killAllSessionExecs(): Promise<number> {
        return this.sessionExecs.killAll();
    }

    private startMonitor(): void {
        if (this.monitorHandle) {
            return;
        }
        this.monitorHandle = setInterval(() => {
            void this.lock
                .inLock(async () => {
                    await this.refreshRecordStatusLocked();
                })
                .catch((error) => {
                    this.logger.warn({ error }, "error: Process monitor tick failed");
                });
        }, MONITOR_INTERVAL_MS);
        this.monitorHandle.unref();
    }

    private async refreshRecordStatusLocked(): Promise<void> {
        for (const record of this.records.values()) {
            const running = record.pid !== null && (await this.runtime.isRunning(record));
            if (running) {
                const now = Date.now();
                if (record.desiredState === "stopped") {
                    await this.stopRecordLocked(record, "SIGTERM");
                    await this.writeRecordLocked(record);
                    continue;
                }

                if (
                    record.restartFailureCount > 0 &&
                    record.lastStartedAt !== null &&
                    now - record.lastStartedAt >= RESTART_STABLE_UPTIME_MS
                ) {
                    record.restartFailureCount = 0;
                    record.nextRestartAt = null;
                    record.updatedAt = now;
                    await this.writeRecordLocked(record);
                }

                if (record.status !== "running") {
                    record.status = "running";
                    record.updatedAt = now;
                    await this.writeRecordLocked(record);
                }
                continue;
            }

            if (record.pid !== null) {
                record.pid = null;
                record.lastExitedAt = Date.now();
            }

            if (record.desiredState === "running") {
                if (record.keepAlive) {
                    await this.restartRecordWithBackoffLocked(record);
                    continue;
                }
                if (record.status !== "exited") {
                    record.status = "exited";
                    record.updatedAt = Date.now();
                    await this.writeRecordLocked(record);
                }
                continue;
            }

            if (record.status !== "stopped") {
                record.status = "stopped";
                record.restartFailureCount = 0;
                record.nextRestartAt = null;
                record.updatedAt = Date.now();
                await this.writeRecordLocked(record);
            }
        }
    }

    private async restartRecordWithBackoffLocked(record: ProcessRecord): Promise<void> {
        const now = Date.now();
        if (record.status !== "exited") {
            record.status = "exited";
            record.updatedAt = now;
            await this.writeRecordLocked(record);
        }

        if (record.nextRestartAt === null) {
            scheduleRestart(record, now);
            await this.writeRecordLocked(record);
            return;
        }
        if (now < record.nextRestartAt) {
            return;
        }

        try {
            await this.startRecordLocked(record, { incrementRestart: true });
            record.nextRestartAt = null;
            await this.writeRecordLocked(record);
        } catch (error) {
            this.logger.warn(
                { error, processId: record.id, restartFailureCount: record.restartFailureCount + 1 },
                "error: Process restart failed; backoff applied"
            );
            const failedAt = Date.now();
            record.pid = null;
            record.status = "exited";
            record.lastExitedAt = failedAt;
            scheduleRestart(record, failedAt);
            await this.writeRecordLocked(record);
        }
    }

    private async removeRecordLocked(record: ProcessRecord, signal: ProcessSignal): Promise<void> {
        record.desiredState = "stopped";
        await this.stopRecordLocked(record, signal);
        this.records.delete(record.id);
        await this.runtime.remove(record);
        await this.repository.delete(record.id);
        await fs.rm(this.processDir(record.id), { recursive: true, force: true });
        this.logger.info({ processId: record.id, signal }, "remove: Process removed");
    }

    private async startRecordLocked(record: ProcessRecord, options: { incrementRestart: boolean }): Promise<void> {
        await fs.mkdir(path.dirname(record.logPath), { recursive: true });
        const pid = await this.runtime.start(record);

        const now = Date.now();
        record.bootTimeMs = await this.resolveCurrentBootTimeMsLocked();
        record.pid = pid;
        record.status = "running";
        record.lastStartedAt = now;
        record.updatedAt = now;
        if (options.incrementRestart) {
            record.restartCount += 1;
        }

        this.logger.info(
            {
                processId: record.id,
                pid: record.pid,
                keepAlive: record.keepAlive,
                cwd: record.cwd
            },
            "start: Process started"
        );
    }

    private async stopRecordLocked(record: ProcessRecord, signal: ProcessSignal): Promise<void> {
        await this.runtime.stop(record, signal);

        const now = Date.now();
        record.pid = null;
        record.status = "stopped";
        record.nextRestartAt = null;
        record.restartFailureCount = 0;
        record.lastExitedAt = now;
        record.updatedAt = now;

        this.logger.info({ processId: record.id, signal }, "stop: Process stopped");
    }

    private async writeRecordLocked(record: ProcessRecord): Promise<void> {
        await this.repository.updateRuntime(record.id, processRuntimeState(record));
    }

    private processDir(processId: string): string {
        return path.join(this.recordsDir, processId);
    }

    private async resolveCurrentBootTimeMsLocked(): Promise<number | null> {
        if (this.currentBootTimeKnown) {
            return this.currentBootTimeMs;
        }
        this.currentBootTimeMs = await this.bootTimeProvider();
        this.currentBootTimeKnown = true;
        return this.currentBootTimeMs;
    }

    private clearStalePidForBootMismatch(record: ProcessRecord): void {
        if (
            record.pid === null ||
            record.bootTimeMs === null ||
            this.currentBootTimeMs === null ||
            record.bootTimeMs === this.currentBootTimeMs
        ) {
            if (record.bootTimeMs === null && this.currentBootTimeMs !== null) {
                record.bootTimeMs = this.currentBootTimeMs;
            }
            return;
        }

        this.logger.info(
            {
                processId: record.id,
                pid: record.pid,
                recordBootTimeMs: record.bootTimeMs,
                currentBootTimeMs: this.currentBootTimeMs
            },
            "event: Process pid cleared after boot mismatch detection"
        );
        record.pid = null;
        record.bootTimeMs = this.currentBootTimeMs;
        // Force refresh loop to persist a normalized terminal status.
        record.status = "running";
        record.lastExitedAt = Date.now();
        record.updatedAt = Date.now();
        record.nextRestartAt = null;
    }
}

function toProcessInfo(record: ProcessRecord): ProcessInfo {
    return {
        id: record.id,
        name: record.name,
        command: record.command,
        cwd: record.cwd,
        home: record.home,
        pid: record.pid,
        keepAlive: record.keepAlive,
        desiredState: record.desiredState,
        status: record.status,
        restartCount: record.restartCount,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        lastStartedAt: record.lastStartedAt,
        lastExitedAt: record.lastExitedAt,
        logPath: record.logPath
    };
}

function clonePermissions(permissions: SessionPermissions): SessionPermissions {
    return {
        workingDir: permissions.workingDir,
        writeDirs: [...permissions.writeDirs],
        readDirs: [...(permissions.readDirs ?? [])]
    };
}

function ownerNormalize(owner: ProcessOwner): ProcessOwner {
    const id = owner.id.trim();
    if (!id) {
        throw new Error("Process owner id is required.");
    }
    return { type: owner.type, id };
}

function ownerIs(candidate: ProcessOwner | null, owner: ProcessOwner): boolean {
    if (!candidate) {
        return false;
    }
    return candidate.type === owner.type && candidate.id === owner.id;
}

function normalizeRequiredUserId(userId: string): string {
    const normalized = userId.trim();
    if (!normalized) {
        throw new Error("Process userId is required.");
    }
    return normalized;
}

function contextUserIdNormalize(ctx: Context): string {
    return normalizeRequiredUserId(ctx.userId);
}

function recordForContextGet(records: Map<string, ProcessRecord>, ctx: Context, processId: string): ProcessRecord {
    const record = records.get(processId);
    const userId = contextUserIdNormalize(ctx);
    if (!record || record.userId !== userId) {
        throw new Error(`Unknown process id: ${processId}`);
    }
    return record;
}

function processRecordFromDb(record: ProcessDbRecord): ProcessRecord {
    const permissions = permissionsPathNormalize(record.permissions);
    return {
        id: record.id,
        userId: record.userId,
        name: record.name,
        command: record.command,
        cwd: realpathSyncSafe(record.cwd),
        home: record.home ? realpathSyncSafe(record.home) : null,
        env: { ...record.env },
        allowLocalBinding: record.allowLocalBinding,
        permissions: clonePermissions(permissions),
        owner: record.owner ? ownerNormalize(record.owner) : null,
        keepAlive: record.keepAlive,
        desiredState: record.desiredState,
        status: record.status,
        pid: record.pid,
        bootTimeMs: record.bootTimeMs,
        restartCount: record.restartCount,
        restartFailureCount: record.restartFailureCount,
        nextRestartAt: record.nextRestartAt,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        lastStartedAt: record.lastStartedAt,
        lastExitedAt: record.lastExitedAt,
        settingsPath: path.resolve(record.settingsPath),
        logPath: path.resolve(record.logPath)
    };
}

function processRecordToDb(record: ProcessRecord): ProcessDbRecord {
    return {
        id: record.id,
        userId: record.userId,
        name: record.name,
        command: record.command,
        cwd: record.cwd,
        home: record.home,
        env: { ...record.env },
        allowLocalBinding: record.allowLocalBinding,
        permissions: clonePermissions(record.permissions),
        owner: record.owner ? ownerNormalize(record.owner) : null,
        keepAlive: record.keepAlive,
        desiredState: record.desiredState,
        status: record.status,
        pid: record.pid,
        bootTimeMs: record.bootTimeMs,
        restartCount: record.restartCount,
        restartFailureCount: record.restartFailureCount,
        nextRestartAt: record.nextRestartAt,
        settingsPath: record.settingsPath,
        logPath: record.logPath,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        lastStartedAt: record.lastStartedAt,
        lastExitedAt: record.lastExitedAt
    };
}

function processRuntimeState(record: ProcessRecord): ProcessesRuntimeUpdate {
    return {
        desiredState: record.desiredState,
        status: record.status,
        pid: record.pid,
        bootTimeMs: record.bootTimeMs,
        restartCount: record.restartCount,
        restartFailureCount: record.restartFailureCount,
        nextRestartAt: record.nextRestartAt,
        settingsPath: record.settingsPath,
        logPath: record.logPath,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        lastStartedAt: record.lastStartedAt,
        lastExitedAt: record.lastExitedAt
    };
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function permissionsPathNormalize(permissions: SessionPermissions): SessionPermissions {
    return {
        workingDir: realpathSyncSafe(permissions.workingDir),
        writeDirs: permissions.writeDirs.map((entry) => realpathSyncSafe(entry)),
        readDirs: (permissions.readDirs ?? []).map((entry) => realpathSyncSafe(entry))
    };
}

function realpathSyncSafe(target: string): string {
    try {
        return realpathSync(target);
    } catch {
        return path.resolve(target);
    }
}

function scheduleRestart(record: ProcessRecord, now: number): void {
    const uptimeMs = resolveUptimeMs(record, now);
    if (uptimeMs >= RESTART_STABLE_UPTIME_MS) {
        record.restartFailureCount = 0;
    }
    record.restartFailureCount += 1;
    const delayMs = restartBackoffMs(record.restartFailureCount);
    record.nextRestartAt = now + delayMs;
    record.updatedAt = now;
}

function resolveUptimeMs(record: ProcessRecord, now: number): number {
    const startedAt = record.lastStartedAt;
    if (startedAt === null) {
        return 0;
    }
    const exitedAt = record.lastExitedAt ?? now;
    if (exitedAt < startedAt) {
        return 0;
    }
    return exitedAt - startedAt;
}

function restartBackoffMs(restartFailureCount: number): number {
    const exponent = Math.max(0, restartFailureCount - 1);
    const delay = RESTART_BACKOFF_BASE_MS * 2 ** exponent;
    return Math.min(delay, RESTART_BACKOFF_MAX_MS);
}

function processRuntimeUnavailableBuild(): ProcessRuntime {
    const errorBuild = () => new Error("Docker settings are required for process runtime.");
    return {
        start: async () => {
            throw errorBuild();
        },
        isRunning: async () => {
            throw errorBuild();
        },
        stop: async () => {
            throw errorBuild();
        },
        remove: async () => {
            throw errorBuild();
        }
    };
}

function processMountsResolve(record: ProcessRecord, processDir: string): PathMountPoint[] {
    const resolvedProcessDir = path.resolve(processDir);
    const homeHostPath = path.resolve(record.home ?? path.join(processDir, "home"));
    const mounts: PathMountPoint[] = [
        { hostPath: resolvedProcessDir, mappedPath: "/process", readOnly: false },
        { hostPath: homeHostPath, mappedPath: "/home", readOnly: false }
    ];

    if (record.permissions.workingDir) {
        mounts.push({
            hostPath: path.resolve(record.permissions.workingDir),
            mappedPath: "/workspace",
            readOnly: processPathReadOnly(record.permissions, record.permissions.workingDir)
        });
    }

    let writeIndex = 0;
    for (const writeDir of record.permissions.writeDirs) {
        mounts.push({
            hostPath: path.resolve(writeDir),
            mappedPath: `/writes/${writeIndex}`,
            readOnly: false
        });
        writeIndex += 1;
    }

    let readIndex = 0;
    for (const readDir of record.permissions.readDirs ?? []) {
        mounts.push({
            hostPath: path.resolve(readDir),
            mappedPath: `/reads/${readIndex}`,
            readOnly: true
        });
        readIndex += 1;
    }

    return mountPointsDeduplicate(mounts);
}

function mountPointsDeduplicate(mounts: PathMountPoint[]): PathMountPoint[] {
    const result: PathMountPoint[] = [];
    const seen = new Set<string>();
    for (const mount of mounts) {
        const key = `${path.resolve(mount.hostPath)}::${mount.mappedPath}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        result.push({
            hostPath: path.resolve(mount.hostPath),
            mappedPath: mount.mappedPath,
            readOnly: mount.readOnly
        });
    }
    return result;
}

function processPathReadOnly(permissions: SessionPermissions, targetPath: string): boolean {
    const target = path.resolve(targetPath);
    for (const writeDir of permissions.writeDirs) {
        const root = path.resolve(writeDir);
        const relative = path.relative(root, target);
        if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
            return false;
        }
    }
    return true;
}

function processRuntimeBuild(
    dockerSettings: ResolvedDockerSettings,
    sandboxResourceLimits?: {
        cpu: number;
        memory: string;
    }
): ProcessRuntime {
    return {
        start: async (record) => {
            const sandbox = processSandboxBuild(record, dockerSettings, sandboxResourceLimits);
            const settings = processSandboxSettingsBuild(record);
            await processSandboxSettingsWrite(record, settings);

            const result = await sandbox.execBuffered({
                command: processStartCommandBuild(record.command),
                cwd: record.cwd,
                env: record.env
            });
            if (result.failed) {
                throw new Error(result.stderr || result.stdout || "Failed to start managed process.");
            }

            const pid = Number(result.stdout.trim());
            if (!Number.isInteger(pid) || pid <= 0) {
                throw new Error(`Failed to capture managed process pid from output: ${JSON.stringify(result.stdout)}`);
            }
            return pid;
        },
        isRunning: async (record) => {
            if (record.pid === null) {
                return false;
            }

            const sandbox = processSandboxBuild(record, dockerSettings, sandboxResourceLimits);
            const result = await sandbox.execBuffered({
                command: processStatusCommandBuild(record.pid),
                cwd: record.cwd
            });
            return result.stdout.trim() === "running";
        },
        stop: async (record, signal) => {
            if (record.pid === null) {
                return;
            }

            const sandbox = processSandboxBuild(record, dockerSettings, sandboxResourceLimits);
            await sandbox.execBuffered({
                command: processStopCommandBuild(signal),
                cwd: record.cwd
            });
            await processSandboxWaitForStop(sandbox, record.pid, DOCKER_STOP_TIMEOUT_MS);
        },
        remove: async (record) => {
            const sandbox = processSandboxBuild(record, dockerSettings, sandboxResourceLimits);
            await sandbox.destroy();
        }
    };
}

function processSandboxBuild(
    record: ProcessRecord,
    dockerSettings: ResolvedDockerSettings,
    sandboxResourceLimits?: {
        cpu: number;
        memory: string;
    }
): Sandbox {
    const processDir = path.dirname(record.logPath);
    const homeDir = record.home ?? path.join(processDir, "home");
    const processUserId = processSandboxUserIdBuild(record.id);
    const allowLocalNetworkingForUsers = record.allowLocalBinding
        ? Array.from(new Set([...(dockerSettings.allowLocalNetworkingForUsers ?? []), processUserId]))
        : [...(dockerSettings.allowLocalNetworkingForUsers ?? [])];
    const resourceLimits = sandboxResourceLimitsResolve(sandboxResourceLimits);
    const dockerConfig: SandboxDockerConfig = {
        socketPath: dockerSettings.socketPath,
        runtime: dockerSettings.runtime,
        readOnly: dockerSettings.readOnly,
        unconfinedSecurity: dockerSettings.unconfinedSecurity,
        capAdd: [...dockerSettings.capAdd],
        capDrop: [...dockerSettings.capDrop],
        allowLocalNetworkingForUsers,
        isolatedDnsServers: dockerSettings.isolatedDnsServers,
        localDnsServers: dockerSettings.localDnsServers,
        resourceLimits: {
            cpu: resourceLimits.cpu,
            memory: resourceLimits.memory
        },
        userId: processUserId
    };

    return new Sandbox({
        homeDir,
        permissions: clonePermissions(record.permissions),
        mounts: processMountsResolve(record, processDir).filter((mount) => mount.mappedPath !== "/home"),
        backend: {
            type: "docker",
            docker: dockerConfig
        }
    });
}

function processSandboxUserIdBuild(processId: string): string {
    return `process-${processId}`;
}

function processSandboxSettingsBuild(record: ProcessRecord): ProcessSandboxSettings {
    const processDir = path.dirname(record.logPath);
    return {
        backend: "sandbox",
        processUserId: processSandboxUserIdBuild(record.id),
        controlPath: PROCESS_CONTROL_PATH,
        mounts: processMountsResolve(record, processDir).map((mount) => ({
            hostPath: mount.hostPath,
            mappedPath: mount.mappedPath,
            readOnly: mount.readOnly ?? false
        }))
    };
}

async function processSandboxSettingsWrite(record: ProcessRecord, settings: ProcessSandboxSettings): Promise<void> {
    await fs.mkdir(path.dirname(record.settingsPath), { recursive: true });
    await fs.writeFile(record.settingsPath, `${JSON.stringify(settings, null, 4)}\n`, "utf8");
}

function processStartCommandBuild(command: string): string {
    const supervisorCommand = [
        "nohup",
        "daycare-exec-supervisor",
        "--control",
        shellQuote(PROCESS_CONTROL_PATH),
        "--",
        "bash",
        "-lc",
        shellQuote(command),
        ">>",
        shellQuote(PROCESS_LOG_PATH),
        "2>&1",
        "<",
        "/dev/null",
        "&",
        "echo",
        "$!"
    ];
    return supervisorCommand.join(" ");
}

function processStatusCommandBuild(pid: number): string {
    return [
        `pid="${pid}";`,
        'if ! ps -p "$pid" >/dev/null 2>&1; then echo stopped;',
        'elif ps -o stat= -p "$pid" 2>/dev/null | grep -q "^[Zz]"; then echo stopped;',
        "else echo running;",
        "fi"
    ].join(" ");
}

function processStopCommandBuild(signal: ProcessSignal): string {
    return [
        `if [ -p ${shellQuote(PROCESS_CONTROL_PATH)} ]; then`,
        `timeout 1 bash -lc ${shellQuote(`printf '%s\\n' '${signal}' > ${shellQuote(PROCESS_CONTROL_PATH)}`)} >/dev/null 2>&1 || true;`,
        "fi"
    ].join(" ");
}

async function processSandboxWaitForStop(sandbox: Sandbox, pid: number, timeoutMs: number): Promise<void> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        const result = await sandbox.execBuffered({
            command: processStatusCommandBuild(pid)
        });
        if (result.stdout.trim() !== "running") {
            return;
        }
        await sleep(PROCESS_STOP_POLL_MS);
    }

    await sandbox.execBuffered({
        command: [`kill -KILL -- -${pid} 2>/dev/null || true;`, `kill -KILL ${pid} 2>/dev/null || true;`].join(" ")
    });
}

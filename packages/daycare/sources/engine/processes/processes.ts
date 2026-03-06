import { promises as fs } from "node:fs";
import path from "node:path";
import { createId } from "@paralleldrive/cuid2";
import Docker from "dockerode";
import type { Logger } from "pino";

import type { Context, SessionPermissions } from "@/types";
import { dockerDnsProfileResolve } from "../../sandbox/docker/dockerDnsProfileResolve.js";
import { dockerNetworkNameResolveForUser } from "../../sandbox/docker/dockerNetworkNameResolveForUser.js";
import { dockerNetworksEnsure } from "../../sandbox/docker/dockerNetworksEnsure.js";
import { sandboxCanWrite } from "../../sandbox/sandboxCanWrite.js";
import { sandboxHomeRedefine } from "../../sandbox/sandboxHomeRedefine.js";
import type { ResolvedDockerSettings } from "../../settings.js";
import type { ProcessDbRecord } from "../../storage/databaseTypes.js";
import type { ProcessesRepository, ProcessesRuntimeUpdate } from "../../storage/processesRepository.js";
import { envNormalize } from "../../utils/envNormalize.js";
import { AsyncLock } from "../../utils/lock.js";
import { pathMountMapHostToMapped } from "../../utils/pathMountMapHostToMapped.js";
import type { PathMountPoint } from "../../utils/pathMountTypes.js";
import { shellQuote } from "../../utils/shellQuote.js";
import { resolveWorkspacePath } from "../permissions.js";
import { processBootTimeRead } from "./processBootTimeRead.js";

const MONITOR_INTERVAL_MS = 2_000;
const PROCESS_STOP_POLL_MS = 200;
const RESTART_BACKOFF_BASE_MS = 2_000;
const RESTART_BACKOFF_MAX_MS = 60_000;
const RESTART_STABLE_UPTIME_MS = 30_000;
const PROCESS_CONTAINER_PREFIX = "daycare-process";
const DAYCARE_RUNTIME_IMAGE_REF = "daycare-runtime:latest";
const DOCKER_SHM_SIZE_BYTES = 1024 * 1024 * 1024;
const DOCKER_STOP_TIMEOUT_MS = 8_000;
const DOCKER_SECURITY_OPT_UNCONFINED = ["seccomp=unconfined", "apparmor=unconfined"] as const;

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
            repository: Pick<
                ProcessesRepository,
                "create" | "findAll" | "findById" | "update" | "updateRuntime" | "delete" | "deleteByOwner"
            >;
            runtime?: ProcessRuntime;
        }
    ) {
        this.baseDir = path.resolve(baseDir);
        this.recordsDir = path.join(this.baseDir, "processes");
        this.logger = logger;
        this.bootTimeProvider = options.bootTimeProvider ?? processBootTimeRead;
        this.repository = options.repository;
        this.runtime =
            options.runtime ??
            (options.docker ? processRuntimeBuild(options.docker) : processRuntimeUnavailableBuild());
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
            const workingDir = permissions.workingDir;
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

            const cwd = input.cwd ? resolveWorkspacePath(workingDir, input.cwd) : workingDir;
            const envInput = envNormalize(input.env) ?? {};
            const id = createId();
            const recordDir = this.processDir(id);
            const home = input.home ? await sandboxCanWrite(permissions, input.home) : path.join(recordDir, "home");
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
                permissions: clonePermissions(permissions),
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
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        lastStartedAt: record.lastStartedAt,
        lastExitedAt: record.lastExitedAt,
        settingsPath: record.settingsPath,
        logPath: record.logPath
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

function processRuntimeBuild(dockerSettings: ResolvedDockerSettings): ProcessRuntime {
    const docker = dockerSettings.socketPath ? new Docker({ socketPath: dockerSettings.socketPath }) : new Docker();
    let networksReady = false;

    return {
        start: async (record) => {
            await dockerNetworksEnsureIfNeeded();
            const container = await processContainerCreate(docker, dockerSettings, record);
            await container.start();
            const details = await processContainerInspect(container);
            return details.State?.Pid ?? null;
        },
        isRunning: async (record) => {
            const container = docker.getContainer(processContainerName(record.id));
            try {
                const details = await processContainerInspect(container);
                return details.State?.Running === true;
            } catch (error) {
                if (dockerErrorCodeResolve(error) === 404) {
                    return false;
                }
                throw error;
            }
        },
        stop: async (record, signal) => {
            const container = docker.getContainer(processContainerName(record.id));
            await processContainerStopAndRemove(container, signal);
        },
        remove: async (record) => {
            const container = docker.getContainer(processContainerName(record.id));
            await processContainerForceRemove(container);
        }
    };

    async function dockerNetworksEnsureIfNeeded(): Promise<void> {
        if (networksReady) {
            return;
        }
        await dockerNetworksEnsure(docker);
        networksReady = true;
    }
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

type DockerError = {
    statusCode?: number;
};

type ProcessContainerInspect = {
    State?: {
        Running?: boolean;
        Pid?: number;
    };
};

async function processContainerCreate(
    docker: Docker,
    dockerSettings: ResolvedDockerSettings,
    record: ProcessRecord
): Promise<Docker.Container> {
    const processDir = path.dirname(record.logPath);
    const mounts = processMountsResolve(record, processDir);
    const homeHostPath = record.home ?? path.join(processDir, "home");
    pathMapRequired(mounts, homeHostPath);
    const cwdContainerPath = pathMapRequired(mounts, record.cwd);
    const logContainerPath = pathMapRequired(mounts, record.logPath);
    const baseEnv = { ...process.env, ...record.env };
    const envResult = await sandboxHomeRedefine({ env: baseEnv, home: homeHostPath });
    const env = envPathRewrite(envResult.env, mounts);
    const containerName = processContainerName(record.id);
    const networkName = dockerNetworkNameResolveForUser(
        record.userId,
        dockerSettings.allowLocalNetworkingForUsers ?? []
    );
    const dnsProfile = dockerDnsProfileResolve({
        networkName,
        isolatedDnsServers: dockerSettings.isolatedDnsServers,
        localDnsServers: dockerSettings.localDnsServers
    });
    const shellCommand = `(${record.command}) >> ${shellQuote(logContainerPath)} 2>&1`;

    await processContainerForceRemove(docker.getContainer(containerName));

    return docker.createContainer({
        name: containerName,
        Image: DAYCARE_RUNTIME_IMAGE_REF,
        WorkingDir: cwdContainerPath,
        Cmd: ["bash", "-lc", shellCommand],
        Env: dockerEnvBuild(env),
        Labels: {
            "daycare.process.id": record.id,
            "daycare.process.user": record.userId
        },
        HostConfig: {
            Binds: processBindsResolve(mounts),
            NetworkMode: networkName,
            ShmSize: DOCKER_SHM_SIZE_BYTES,
            Tmpfs: {
                "/tmp": "rw",
                "/run": "rw",
                "/var/tmp": "rw",
                "/var/run": "rw"
            },
            ...(dnsProfile.dnsServers ? { Dns: dnsProfile.dnsServers } : {}),
            ...(dockerSettings.runtime ? { Runtime: dockerSettings.runtime } : {}),
            ...(dockerSettings.readOnly ? { ReadonlyRootfs: true } : {}),
            ...(dockerSettings.capAdd.length > 0 ? { CapAdd: dockerSettings.capAdd } : {}),
            ...(dockerSettings.capDrop.length > 0 ? { CapDrop: dockerSettings.capDrop } : {}),
            ...(dockerSettings.unconfinedSecurity ? { SecurityOpt: [...DOCKER_SECURITY_OPT_UNCONFINED] } : {})
        }
    });
}

async function processContainerInspect(container: Docker.Container): Promise<ProcessContainerInspect> {
    return (await container.inspect()) as ProcessContainerInspect;
}

async function processContainerStopAndRemove(container: Docker.Container, signal: ProcessSignal): Promise<void> {
    try {
        const details = await processContainerInspect(container);
        if (details.State?.Running) {
            await container.kill({ signal });
            await processContainerWaitForStop(container, DOCKER_STOP_TIMEOUT_MS);
        }
    } catch (error) {
        if (dockerErrorCodeResolve(error) !== 404) {
            throw error;
        }
    }

    await processContainerForceRemove(container);
}

async function processContainerForceRemove(container: Docker.Container): Promise<void> {
    try {
        await container.remove({ force: true });
    } catch (error) {
        if (dockerErrorCodeResolve(error) !== 404) {
            throw error;
        }
    }
}

async function processContainerWaitForStop(container: Docker.Container, timeoutMs: number): Promise<void> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        try {
            const details = await processContainerInspect(container);
            if (!details.State?.Running) {
                return;
            }
        } catch (error) {
            if (dockerErrorCodeResolve(error) === 404) {
                return;
            }
            throw error;
        }
        await sleep(PROCESS_STOP_POLL_MS);
    }

    try {
        await container.kill({ signal: "SIGKILL" });
    } catch (error) {
        if (dockerErrorCodeResolve(error) !== 404 && dockerErrorCodeResolve(error) !== 409) {
            throw error;
        }
    }
}

function processMountsResolve(record: ProcessRecord, processDir: string): PathMountPoint[] {
    const mounts: PathMountPoint[] = [
        { hostPath: processDir, mappedPath: "/process" },
        { hostPath: record.home ?? path.join(processDir, "home"), mappedPath: "/home" }
    ];

    const workspaceDir = record.permissions.workingDir;
    if (workspaceDir) {
        mounts.push({ hostPath: workspaceDir, mappedPath: "/workspace" });
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
            mappedPath: mount.mappedPath
        });
    }
    return result;
}

function processBindsResolve(mounts: PathMountPoint[]): string[] {
    return mounts.map((mount) => {
        const writable = mount.mappedPath === "/process" || mount.mappedPath === "/home";
        return writable ? `${mount.hostPath}:${mount.mappedPath}` : `${mount.hostPath}:${mount.mappedPath}:ro`;
    });
}

function pathMapRequired(mounts: PathMountPoint[], hostPath: string): string {
    const mapped = pathMountMapHostToMapped({ mountPoints: mounts, hostPath });
    if (!mapped) {
        throw new Error(`Path is not mounted into process container: ${hostPath}`);
    }
    return mapped;
}

function envPathRewrite(env: NodeJS.ProcessEnv, mounts: PathMountPoint[]): NodeJS.ProcessEnv {
    const rewritten: NodeJS.ProcessEnv = {};
    for (const [key, value] of Object.entries(env)) {
        if (typeof value !== "string") {
            continue;
        }
        if (!path.isAbsolute(value)) {
            rewritten[key] = value;
            continue;
        }
        rewritten[key] = pathMountMapHostToMapped({ mountPoints: mounts, hostPath: value }) ?? value;
    }
    return rewritten;
}

function dockerEnvBuild(env: NodeJS.ProcessEnv): string[] {
    return Object.entries(env)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => `${key}=${value}`);
}

function processContainerName(processId: string): string {
    return `${PROCESS_CONTAINER_PREFIX}-${processId}`;
}

function dockerErrorCodeResolve(error: unknown): number | null {
    return typeof (error as DockerError).statusCode === "number" ? ((error as DockerError).statusCode ?? null) : null;
}

import { access, mkdir, open } from "node:fs/promises";
import path from "node:path";

import { createId } from "@paralleldrive/cuid2";
import type { AgentHistoryAppendRecord, AgentHistoryRecord, AgentHistoryRlmToolCallRecord } from "@/types";
import { nametagGenerate } from "../engine/friends/nametagGenerate.js";
import { agentSnapshotPathResolve } from "../engine/agents/ops/agentSnapshotPathResolve.js";
import { AsyncLock } from "../util/lock.js";
import { cuid2Is } from "../utils/cuid2Is.js";
import { AgentsRepository } from "./agentsRepository.js";
import { ChannelMessagesRepository } from "./channelMessagesRepository.js";
import { ChannelsRepository } from "./channelsRepository.js";
import { ConnectionsRepository } from "./connectionsRepository.js";
import { CronTasksRepository } from "./cronTasksRepository.js";
import { databaseOpen } from "./databaseOpen.js";
import type { CreateAgentInput, CreateUserInput, UserWithConnectorKeysDbRecord } from "./databaseTypes.js";
import { DelayedSignalsRepository } from "./delayedSignalsRepository.js";
import { ExposeEndpointsRepository } from "./exposeEndpointsRepository.js";
import { HeartbeatTasksRepository } from "./heartbeatTasksRepository.js";
import { HistoryRepository } from "./historyRepository.js";
import { InboxRepository } from "./inboxRepository.js";
import { migrationRun } from "./migrations/migrationRun.js";
import { ProcessesRepository } from "./processesRepository.js";
import { SessionsRepository } from "./sessionsRepository.js";
import { SignalEventsRepository } from "./signalEventsRepository.js";
import { SignalSubscriptionsRepository } from "./signalSubscriptionsRepository.js";
import { SystemPromptsRepository } from "./systemPromptsRepository.js";
import { TasksRepository } from "./tasksRepository.js";
import { TokenStatsRepository } from "./tokenStatsRepository.js";
import { UsersRepository } from "./usersRepository.js";

type StorageOpenOptions = {
    agentsDir?: string;
};

/**
 * Facade for all SQLite access. Owns one connection and repository instances.
 * Expects: dbPath points to a writable sqlite file or ":memory:".
 */
export class Storage {
    readonly users: UsersRepository;
    readonly agents: AgentsRepository;
    readonly sessions: SessionsRepository;
    readonly history: HistoryRepository;
    readonly inbox: InboxRepository;
    readonly cronTasks: CronTasksRepository;
    readonly heartbeatTasks: HeartbeatTasksRepository;
    readonly tasks: TasksRepository;
    readonly signalEvents: SignalEventsRepository;
    readonly signalSubscriptions: SignalSubscriptionsRepository;
    readonly delayedSignals: DelayedSignalsRepository;
    readonly channels: ChannelsRepository;
    readonly channelMessages: ChannelMessagesRepository;
    readonly connections: ConnectionsRepository;
    readonly exposeEndpoints: ExposeEndpointsRepository;
    readonly processes: ProcessesRepository;
    readonly systemPrompts: SystemPromptsRepository;
    readonly tokenStats: TokenStatsRepository;

    private readonly connection: ReturnType<typeof databaseOpen>;
    private readonly dbPath: string;
    private readonly agentsDir: string | null;
    private readonly connectorKeyLocks = new Map<string, AsyncLock>();

    private constructor(
        connection: ReturnType<typeof databaseOpen>,
        options: {
            dbPath: string;
            agentsDir: string | null;
        }
    ) {
        this.connection = connection;
        this.dbPath = options.dbPath;
        this.agentsDir = options.agentsDir;
        this.users = new UsersRepository(connection);
        this.agents = new AgentsRepository(connection);
        this.sessions = new SessionsRepository(connection);
        this.history = new HistoryRepository(connection);
        this.inbox = new InboxRepository(connection);
        this.cronTasks = new CronTasksRepository(connection);
        this.heartbeatTasks = new HeartbeatTasksRepository(connection);
        this.tasks = new TasksRepository(connection);
        this.signalEvents = new SignalEventsRepository(connection);
        this.signalSubscriptions = new SignalSubscriptionsRepository(connection);
        this.delayedSignals = new DelayedSignalsRepository(connection);
        this.channels = new ChannelsRepository(connection);
        this.channelMessages = new ChannelMessagesRepository(connection);
        this.connections = new ConnectionsRepository(connection);
        this.exposeEndpoints = new ExposeEndpointsRepository(connection);
        this.processes = new ProcessesRepository(connection);
        this.systemPrompts = new SystemPromptsRepository(connection);
        this.tokenStats = new TokenStatsRepository(connection);
    }

    static open(dbPath: string, options?: StorageOpenOptions): Storage {
        const db = databaseOpen(dbPath);
        migrationRun(db);
        const agentsDir =
            options?.agentsDir ?? (dbPath === ":memory:" ? null : path.join(path.dirname(dbPath), "agents"));
        return new Storage(db, { dbPath, agentsDir });
    }

    get db(): ReturnType<typeof databaseOpen> {
        return this.connection;
    }

    close(): void {
        this.connection.close();
    }

    async createUser(input: CreateUserInput): Promise<UserWithConnectorKeysDbRecord> {
        const normalizedNametag = input.nametag?.trim() ?? "";
        if (normalizedNametag) {
            return this.users.create({ ...input, nametag: normalizedNametag });
        }
        return this.userCreateWithGeneratedNametag(input);
    }

    async resolveUserByConnectorKey(connectorKey: string): Promise<UserWithConnectorKeysDbRecord> {
        const normalized = connectorKey.trim();
        if (!normalized) {
            throw new Error("connectorKey is required");
        }

        const lock = this.connectorKeyLockFor(normalized);
        return lock.inLock(async () => {
            const existing = await this.users.findByConnectorKey(normalized);
            if (existing) {
                return existing;
            }
            const users = await this.users.findMany();
            try {
                return await this.userCreateWithGeneratedNametag({
                    isOwner: users.length === 0,
                    connectorKey: normalized
                });
            } catch (error) {
                if (!sqliteUniqueConstraintOnConnectorKeyIs(error)) {
                    throw error;
                }
                const raced = await this.users.findByConnectorKey(normalized);
                if (raced) {
                    return raced;
                }
                throw error;
            }
        });
    }

    async createAgentWithSession(
        input: CreateAgentInput
    ): Promise<{ agent: CreateAgentInput["record"]; sessionId: string }> {
        const baseRecord = {
            ...input.record,
            activeSessionId: null
        };

        const sessionCreatedAt = input.session?.createdAt ?? baseRecord.createdAt;
        this.connection.exec("BEGIN");
        try {
            await this.agents.create(baseRecord);
            const sessionId = await this.sessions.create({
                agentId: baseRecord.id,
                inferenceSessionId: input.session?.inferenceSessionId ?? null,
                createdAt: sessionCreatedAt,
                resetMessage: input.session?.resetMessage ?? null
            });
            const agent = {
                ...baseRecord,
                activeSessionId: sessionId,
                updatedAt: Math.max(baseRecord.updatedAt, sessionCreatedAt)
            };
            await this.agents.update(baseRecord.id, agent);
            this.connection.exec("COMMIT");
            return { agent, sessionId };
        } catch (error) {
            this.connection.exec("ROLLBACK");
            await this.agents.invalidate(baseRecord.id);
            throw error;
        }
    }

    async appendHistory(agentId: string, record: AgentHistoryAppendRecord): Promise<void> {
        const agent = await this.agents.findById(agentId);
        if (!agent) {
            throw new Error(`Agent not found for history append: ${agentId}`);
        }

        let sessionId = agent.activeSessionId;
        if (!sessionId) {
            sessionId = await this.sessions.create({
                agentId,
                createdAt: record.at
            });
            await this.agents.update(agentId, {
                activeSessionId: sessionId,
                updatedAt: Math.max(agent.updatedAt, record.at)
            });
        }

        let persistedRecord = record as AgentHistoryRecord;
        let snapshotPath: string | null = null;
        if (record.type === "rlm_tool_call") {
            if (!this.agentsDir) {
                throw new Error("Agent snapshot persistence requires a configured agentsDir.");
            }
            const persisted = storageRlmToolCallPersistRecord({
                record,
                snapshotIdBuild: () => createId()
            });
            if (persisted.snapshotDump) {
                snapshotPath = agentSnapshotPathResolve(this.agentsDir, agentId, sessionId, persisted.record.snapshotId);
                await storageSnapshotWrite(snapshotPath, storageSnapshotDecode(persisted.snapshotDump));
            }
            persistedRecord = persisted.record;
        }

        await this.history.append(sessionId, persistedRecord);
        if (snapshotPath) {
            await storageDatabaseSync(this.dbPath);
        }
    }

    private connectorKeyLockFor(connectorKey: string): AsyncLock {
        const existing = this.connectorKeyLocks.get(connectorKey);
        if (existing) {
            return existing;
        }
        const lock = new AsyncLock();
        this.connectorKeyLocks.set(connectorKey, lock);
        return lock;
    }

    private async userCreateWithGeneratedNametag(input: CreateUserInput): Promise<UserWithConnectorKeysDbRecord> {
        const MAX_NAMETAG_ATTEMPTS = 100;
        for (let attempt = 0; attempt < MAX_NAMETAG_ATTEMPTS; attempt += 1) {
            const nametag = nametagGenerate();
            try {
                return await this.users.create({ ...input, nametag });
            } catch (error) {
                if (sqliteUniqueConstraintOnNametagIs(error)) {
                    continue;
                }
                throw error;
            }
        }
        throw new Error("Failed to generate unique nametag after 100 attempts.");
    }
}

function sqliteUniqueConstraintErrorIs(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error ?? "");
    return message.includes("UNIQUE constraint failed");
}

function sqliteUniqueConstraintOnNametagIs(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error ?? "");
    return message.includes("UNIQUE constraint failed: users.nametag");
}

function sqliteUniqueConstraintOnConnectorKeyIs(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error ?? "");
    return sqliteUniqueConstraintErrorIs(error) && message.includes("user_connector_keys.connector_key");
}

function storageSnapshotDecode(snapshotBase64: string): Uint8Array {
    return Buffer.from(snapshotBase64, "base64");
}

function storageRlmToolCallPersistRecord(options: {
    record: Extract<AgentHistoryAppendRecord, { type: "rlm_tool_call" }>;
    snapshotIdBuild: () => string;
}): {
    record: AgentHistoryRlmToolCallRecord;
    snapshotDump: string | null;
} {
    const { record } = options;
    if ("snapshotDump" in record) {
        return {
            record: {
                type: "rlm_tool_call",
                at: record.at,
                toolCallId: record.toolCallId,
                snapshotId: options.snapshotIdBuild(),
                printOutput: record.printOutput,
                toolCallCount: record.toolCallCount,
                toolName: record.toolName,
                toolArgs: record.toolArgs
            },
            snapshotDump: record.snapshotDump
        };
    }

    if (cuid2Is(record.snapshotId)) {
        return {
            record,
            snapshotDump: null
        };
    }

    return {
        record: {
            ...record,
            snapshotId: options.snapshotIdBuild()
        },
        snapshotDump: record.snapshotId
    };
}

async function storageSnapshotWrite(snapshotPath: string, dump: Uint8Array): Promise<void> {
    await mkdir(path.dirname(snapshotPath), { recursive: true });
    const handle = await open(snapshotPath, "w");
    try {
        await handle.writeFile(dump);
        await handle.sync();
    } finally {
        await handle.close();
    }
    await storagePathSync(path.dirname(snapshotPath));
}

async function storageDatabaseSync(dbPath: string): Promise<void> {
    if (dbPath === ":memory:") {
        return;
    }
    await storagePathSyncIfExists(dbPath);
    await storagePathSyncIfExists(`${dbPath}-wal`);
}

async function storagePathSyncIfExists(targetPath: string): Promise<void> {
    try {
        await access(targetPath);
    } catch {
        return;
    }
    await storagePathSync(targetPath);
}

async function storagePathSync(targetPath: string): Promise<void> {
    const handle = await open(targetPath, "r");
    try {
        await handle.sync();
    } finally {
        await handle.close();
    }
}

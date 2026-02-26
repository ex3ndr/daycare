import type { AgentHistoryRecord } from "@/types";
import { nametagGenerate } from "../engine/friends/nametagGenerate.js";
import { AsyncLock } from "../util/lock.js";
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
    private readonly connectorKeyLocks = new Map<string, AsyncLock>();

    private constructor(connection: ReturnType<typeof databaseOpen>) {
        this.connection = connection;
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

    static open(dbPath: string): Storage {
        const db = databaseOpen(dbPath);
        migrationRun(db);
        return new Storage(db);
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

    async appendHistory(agentId: string, record: AgentHistoryRecord): Promise<void> {
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

        await this.history.append(sessionId, record);
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

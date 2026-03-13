import { createId } from "@paralleldrive/cuid2";
import type { AgentHistoryRecord, ConnectorIdentity } from "@/types";
import { nametagGenerate } from "../engine/friends/nametagGenerate.js";
import { agentsTable, type DaycareDb, schemaDrizzle, sessionsTable } from "../schema.js";
import { AsyncLock } from "../utils/lock.js";
import { AgentsRepository } from "./agentsRepository.js";
import { ChannelMessagesRepository } from "./channelMessagesRepository.js";
import { ChannelsRepository } from "./channelsRepository.js";
import { ConnectionsRepository } from "./connectionsRepository.js";
import { CronTasksRepository } from "./cronTasksRepository.js";
import type { StorageDatabase } from "./databaseOpen.js";
import type { CreateAgentInput, CreateUserInput, UserWithConnectorKeysDbRecord } from "./databaseTypes.js";
import { DelayedSignalsRepository } from "./delayedSignalsRepository.js";
import { DocumentsRepository } from "./documentsRepository.js";
import { FragmentsRepository } from "./fragmentsRepository.js";
import { HistoryRepository } from "./historyRepository.js";
import { InboxRepository } from "./inboxRepository.js";
import { KeyValuesRepository } from "./keyValuesRepository.js";
import { MiniAppsRepository } from "./miniAppsRepository.js";
import { ModelRoleRulesRepository } from "./modelRoleRulesRepository.js";
import { ObservationLogRepository } from "./observationLogRepository.js";
import { ProcessesRepository } from "./processesRepository.js";
import { PsqlDatabasesRepository } from "./psqlDatabasesRepository.js";
import { SessionsRepository } from "./sessionsRepository.js";
import { SignalEventsRepository } from "./signalEventsRepository.js";
import { SignalSubscriptionsRepository } from "./signalSubscriptionsRepository.js";
import { SystemPromptsRepository } from "./systemPromptsRepository.js";
import { TasksRepository } from "./tasksRepository.js";
import { TokenStatsRepository } from "./tokenStatsRepository.js";
import { UsersRepository } from "./usersRepository.js";
import { WebhookTasksRepository } from "./webhookTasksRepository.js";
import { WorkspaceMembersRepository } from "./workspaceMembersRepository.js";

/**
 * Facade for all storage access and repository instances.
 * Expects: connection is an open storage database with required migrations applied.
 */
export class Storage {
    readonly users: UsersRepository;
    readonly agents: AgentsRepository;
    readonly sessions: SessionsRepository;
    readonly history: HistoryRepository;
    readonly inbox: InboxRepository;
    readonly cronTasks: CronTasksRepository;
    readonly webhookTasks: WebhookTasksRepository;
    readonly tasks: TasksRepository;
    readonly documents: DocumentsRepository;
    readonly fragments: FragmentsRepository;
    readonly signalEvents: SignalEventsRepository;
    readonly signalSubscriptions: SignalSubscriptionsRepository;
    readonly delayedSignals: DelayedSignalsRepository;
    readonly channels: ChannelsRepository;
    readonly channelMessages: ChannelMessagesRepository;
    readonly workspaceMembers: WorkspaceMembersRepository;
    readonly connections: ConnectionsRepository;
    readonly processes: ProcessesRepository;
    readonly systemPrompts: SystemPromptsRepository;
    readonly tokenStats: TokenStatsRepository;
    readonly keyValues: KeyValuesRepository;
    readonly modelRoleRules: ModelRoleRulesRepository;
    readonly psqlDatabases: PsqlDatabasesRepository;
    readonly miniApps: MiniAppsRepository;
    readonly observationLog: ObservationLogRepository;

    readonly db: DaycareDb;
    readonly connection: StorageDatabase;

    private readonly connectorKeyLocks = new Map<string, AsyncLock>();

    private constructor(connection: StorageDatabase, db: DaycareDb) {
        this.connection = connection;
        this.db = db;
        this.users = new UsersRepository(db);
        this.agents = new AgentsRepository(db);
        this.sessions = new SessionsRepository(db);
        this.history = new HistoryRepository(db);
        this.inbox = new InboxRepository(db);
        this.cronTasks = new CronTasksRepository(db);
        this.webhookTasks = new WebhookTasksRepository(db);
        this.tasks = new TasksRepository(db);
        this.documents = new DocumentsRepository(db);
        this.fragments = new FragmentsRepository(db);
        this.signalEvents = new SignalEventsRepository(db);
        this.signalSubscriptions = new SignalSubscriptionsRepository(db);
        this.delayedSignals = new DelayedSignalsRepository(db);
        this.channels = new ChannelsRepository(db);
        this.channelMessages = new ChannelMessagesRepository(db);
        this.workspaceMembers = new WorkspaceMembersRepository(db);
        this.connections = new ConnectionsRepository(db);
        this.processes = new ProcessesRepository(db);
        this.systemPrompts = new SystemPromptsRepository(db);
        this.tokenStats = new TokenStatsRepository(db);
        this.keyValues = new KeyValuesRepository(db);
        this.modelRoleRules = new ModelRoleRulesRepository(db);
        this.psqlDatabases = new PsqlDatabasesRepository(db);
        this.miniApps = new MiniAppsRepository(db);
        this.observationLog = new ObservationLogRepository(db);
    }

    static fromDatabase(rawDb: StorageDatabase): Storage {
        if (rawDb.__pgliteClient) {
            return new Storage(rawDb, schemaDrizzle(rawDb.__pgliteClient));
        }
        if (rawDb.__pgClient) {
            return new Storage(rawDb, schemaDrizzle(rawDb.__pgClient));
        }
        throw new Error("StorageDatabase has no raw client for Drizzle ORM");
    }

    async createUser(input: CreateUserInput): Promise<UserWithConnectorKeysDbRecord> {
        const normalizedNametag = input.nametag?.trim() ?? "";
        if (normalizedNametag) {
            return this.users.create({ ...input, nametag: normalizedNametag });
        }
        return this.userCreateWithGeneratedNametag(input);
    }

    async resolveUserByConnector(connector: ConnectorIdentity): Promise<UserWithConnectorKeysDbRecord> {
        const normalizedName = connector.name.trim();
        const normalizedKey = connector.key.trim();
        if (!normalizedName || !normalizedKey) {
            throw new Error("connector is required");
        }
        const lock = this.connectorKeyLockFor({ name: normalizedName, key: normalizedKey });
        return lock.inLock(async () => {
            const existing = await this.users.findByConnector({ name: normalizedName, key: normalizedKey });
            if (existing) {
                return existing;
            }
            try {
                return await this.userCreateWithGeneratedNametag({
                    connector: {
                        name: normalizedName,
                        key: normalizedKey
                    }
                });
            } catch (error) {
                if (!sqliteUniqueConstraintOnConnectorKeyIs(error)) {
                    throw error;
                }
                const raced = await this.users.findByConnector({ name: normalizedName, key: normalizedKey });
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
            activeSessionId: null,
            version: 1,
            validFrom: input.record.createdAt,
            validTo: null
        };

        const sessionCreatedAt = input.session?.createdAt ?? baseRecord.createdAt;
        const sessionId = createId();

        // Use tx directly to avoid deadlock with PGlite's single connection.
        // Repo methods use this.db (the main instance), not tx, so calling them
        // inside db.transaction() would deadlock.
        await this.db.transaction(async (tx) => {
            await tx.insert(agentsTable).values({
                id: baseRecord.id,
                version: baseRecord.version,
                validFrom: baseRecord.validFrom,
                validTo: baseRecord.validTo,
                userId: baseRecord.userId,
                path: baseRecord.path,
                kind: baseRecord.kind,
                modelRole: baseRecord.modelRole,
                connectorName: baseRecord.connector?.name ?? null,
                connectorKey: baseRecord.connector?.key ?? null,
                parentAgentId: baseRecord.parentAgentId,
                foreground: baseRecord.foreground,
                name: baseRecord.name,
                description: baseRecord.description,
                systemPrompt: baseRecord.systemPrompt,
                workspaceDir: baseRecord.workspaceDir,
                nextSubIndex: baseRecord.nextSubIndex ?? 0,
                activeSessionId: sessionId,
                permissions: baseRecord.permissions,
                lifecycle: baseRecord.lifecycle,
                createdAt: baseRecord.createdAt,
                updatedAt: Math.max(baseRecord.updatedAt, sessionCreatedAt)
            });
            await tx.insert(sessionsTable).values({
                id: sessionId,
                agentId: baseRecord.id,
                inferenceSessionId: input.session?.inferenceSessionId ?? null,
                createdAt: sessionCreatedAt,
                resetMessage: input.session?.resetMessage ?? null,
                invalidatedAt: null,
                processedUntil: null
            });
        });

        const agent = {
            ...baseRecord,
            activeSessionId: sessionId,
            updatedAt: Math.max(baseRecord.updatedAt, sessionCreatedAt)
        };

        // Invalidate caches so repos pick up the new data.
        await this.agents.invalidate(baseRecord.id);

        return { agent, sessionId };
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

    private connectorKeyLockFor(connector: ConnectorIdentity): AsyncLock {
        const lockKey = `${connector.name}\u0000${connector.key}`;
        const existing = this.connectorKeyLocks.get(lockKey);
        if (existing) {
            return existing;
        }
        const lock = new AsyncLock();
        this.connectorKeyLocks.set(lockKey, lock);
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
    return (
        message.includes("UNIQUE constraint failed") ||
        message.includes("duplicate key value violates unique constraint")
    );
}

function sqliteUniqueConstraintOnNametagIs(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error ?? "");
    return (
        message.includes("UNIQUE constraint failed: users.nametag") ||
        message.includes("users_nametag") ||
        message.includes("idx_users_nametag")
    );
}

function sqliteUniqueConstraintOnConnectorKeyIs(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error ?? "");
    return (
        sqliteUniqueConstraintErrorIs(error) &&
        (message.includes("user_connector_keys.connector_key") ||
            message.includes("user_connector_keys_connector_key_unique"))
    );
}

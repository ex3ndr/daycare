import type { AgentHistoryRecord } from "@/types";
import { AsyncLock } from "../util/lock.js";
import { AgentsRepository } from "./agentsRepository.js";
import { databaseOpen } from "./databaseOpen.js";
import type { CreateAgentInput, CreateUserInput, UserWithConnectorKeysDbRecord } from "./databaseTypes.js";
import { HistoryRepository } from "./historyRepository.js";
import { migrationRun } from "./migrations/migrationRun.js";
import { SessionsRepository } from "./sessionsRepository.js";
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

    private readonly connection: ReturnType<typeof databaseOpen>;
    private readonly connectorKeyLocks = new Map<string, AsyncLock>();

    private constructor(connection: ReturnType<typeof databaseOpen>) {
        this.connection = connection;
        this.users = new UsersRepository(connection);
        this.agents = new AgentsRepository(connection);
        this.sessions = new SessionsRepository(connection);
        this.history = new HistoryRepository(connection);
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
        return this.users.create(input);
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
                return await this.users.create({
                    isOwner: users.length === 0,
                    connectorKey: normalized
                });
            } catch (error) {
                if (!sqliteUniqueConstraintErrorIs(error)) {
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
}

function sqliteUniqueConstraintErrorIs(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error ?? "");
    return message.includes("UNIQUE constraint failed");
}

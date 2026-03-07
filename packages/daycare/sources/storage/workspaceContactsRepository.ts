import { and, desc, eq, sql } from "drizzle-orm";
import type { DaycareDb } from "../schema.js";
import { workspaceContactsTable } from "../schema.js";
import type { WorkspaceContactDbRecord } from "./databaseTypes.js";

/**
 * Workspace contacts repository backed by Drizzle.
 * Expects: schema migrations already applied for workspace_contacts.
 */
export class WorkspaceContactsRepository {
    private readonly db: DaycareDb;

    constructor(db: DaycareDb) {
        this.db = db;
    }

    async findOrCreate(
        workspaceUserId: string,
        contactAgentId: string,
        workspaceAgentId: string
    ): Promise<WorkspaceContactDbRecord> {
        const existing = await this.find(workspaceUserId, contactAgentId);
        if (existing) {
            if (existing.workspaceAgentId !== workspaceAgentId) {
                await this.db
                    .update(workspaceContactsTable)
                    .set({ workspaceAgentId, lastContactAt: Date.now() })
                    .where(
                        and(
                            eq(workspaceContactsTable.workspaceUserId, workspaceUserId),
                            eq(workspaceContactsTable.contactAgentId, contactAgentId)
                        )
                    );
                const refreshed = await this.find(workspaceUserId, contactAgentId);
                if (refreshed) {
                    return refreshed;
                }
            }
            return existing;
        }

        const now = Date.now();
        try {
            await this.db.insert(workspaceContactsTable).values({
                workspaceUserId,
                contactAgentId,
                workspaceAgentId,
                messagesSent: 0,
                messagesReceived: 0,
                firstContactAt: now,
                lastContactAt: now
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error ?? "");
            if (!message.includes("duplicate key")) {
                throw error;
            }
        }

        const created = await this.find(workspaceUserId, contactAgentId);
        if (!created) {
            throw new Error("Failed to create workspace contact record.");
        }
        return created;
    }

    async recordSent(workspaceUserId: string, contactAgentId: string): Promise<void> {
        const updated = await this.db
            .update(workspaceContactsTable)
            .set({
                messagesSent: sql`${workspaceContactsTable.messagesSent} + 1`,
                lastContactAt: Date.now()
            })
            .where(
                and(
                    eq(workspaceContactsTable.workspaceUserId, workspaceUserId),
                    eq(workspaceContactsTable.contactAgentId, contactAgentId)
                )
            )
            .returning({ workspaceUserId: workspaceContactsTable.workspaceUserId });
        if (updated.length === 0) {
            throw new Error("Workspace contact not found.");
        }
    }

    async recordReceived(workspaceUserId: string, contactAgentId: string): Promise<void> {
        const updated = await this.db
            .update(workspaceContactsTable)
            .set({
                messagesReceived: sql`${workspaceContactsTable.messagesReceived} + 1`,
                lastContactAt: Date.now()
            })
            .where(
                and(
                    eq(workspaceContactsTable.workspaceUserId, workspaceUserId),
                    eq(workspaceContactsTable.contactAgentId, contactAgentId)
                )
            )
            .returning({ workspaceUserId: workspaceContactsTable.workspaceUserId });
        if (updated.length === 0) {
            throw new Error("Workspace contact not found.");
        }
    }

    async listContacts(workspaceUserId: string): Promise<WorkspaceContactDbRecord[]> {
        const rows = await this.db
            .select()
            .from(workspaceContactsTable)
            .where(eq(workspaceContactsTable.workspaceUserId, workspaceUserId))
            .orderBy(desc(workspaceContactsTable.lastContactAt));
        return rows.map((row) => workspaceContactParse(row));
    }

    async isKnownContact(workspaceUserId: string, contactAgentId: string): Promise<boolean> {
        const rows = await this.db
            .select({ workspaceUserId: workspaceContactsTable.workspaceUserId })
            .from(workspaceContactsTable)
            .where(
                and(
                    eq(workspaceContactsTable.workspaceUserId, workspaceUserId),
                    eq(workspaceContactsTable.contactAgentId, contactAgentId)
                )
            )
            .limit(1);
        return rows.length > 0;
    }

    private async find(workspaceUserId: string, contactAgentId: string): Promise<WorkspaceContactDbRecord | null> {
        const rows = await this.db
            .select()
            .from(workspaceContactsTable)
            .where(
                and(
                    eq(workspaceContactsTable.workspaceUserId, workspaceUserId),
                    eq(workspaceContactsTable.contactAgentId, contactAgentId)
                )
            )
            .limit(1);
        const row = rows[0];
        if (!row) {
            return null;
        }
        return workspaceContactParse(row);
    }
}

function workspaceContactParse(row: {
    workspaceUserId: string;
    contactAgentId: string;
    workspaceAgentId: string;
    messagesSent: number;
    messagesReceived: number;
    firstContactAt: number;
    lastContactAt: number;
}): WorkspaceContactDbRecord {
    return {
        workspaceUserId: row.workspaceUserId,
        contactAgentId: row.contactAgentId,
        workspaceAgentId: row.workspaceAgentId,
        messagesSent: row.messagesSent,
        messagesReceived: row.messagesReceived,
        firstContactAt: row.firstContactAt,
        lastContactAt: row.lastContactAt
    };
}

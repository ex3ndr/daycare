import { describe, expect, it } from "vitest";
import type { PermissionDecision } from "@/types";

import { databaseOpen } from "./databaseOpen.js";
import { PermissionRequestsRepository } from "./permissionRequestsRepository.js";

describe("PermissionRequestsRepository", () => {
    it("creates records and finds by token with cache fallback", async () => {
        const db = databaseOpen(":memory:");
        try {
            schemaCreate(db);
            const repository = new PermissionRequestsRepository(db);

            const created = recordBuild({
                id: "req-1",
                token: "token-1",
                agentId: "agent-a",
                userId: "user-a",
                status: "pending",
                timeoutAt: 100
            });
            await repository.create(created);

            const loaded = await repository.findByToken("token-1");
            expect(loaded).toEqual(created);

            db.prepare("DELETE FROM permission_requests WHERE token = ?").run("token-1");
            const cached = await repository.findByToken("token-1");
            expect(cached).toEqual(created);
        } finally {
            db.close();
        }
    });

    it("returns pending requests by agent and updates decision status", async () => {
        const db = databaseOpen(":memory:");
        try {
            schemaCreate(db);
            const repository = new PermissionRequestsRepository(db);

            await repository.create(
                recordBuild({
                    id: "req-1",
                    token: "token-1",
                    agentId: "agent-a",
                    userId: "user-a",
                    status: "pending",
                    timeoutAt: 100
                })
            );
            await repository.create(
                recordBuild({
                    id: "req-2",
                    token: "token-2",
                    agentId: "agent-a",
                    userId: "user-a",
                    status: "denied",
                    timeoutAt: 100
                })
            );
            await repository.create(
                recordBuild({
                    id: "req-3",
                    token: "token-3",
                    agentId: "agent-b",
                    userId: "user-b",
                    status: "pending",
                    timeoutAt: 100
                })
            );

            const pending = await repository.findPendingByAgentId("agent-a");
            expect(pending.map((entry) => entry.id)).toEqual(["req-1"]);

            const decision: PermissionDecision = {
                token: "token-1",
                agentId: "agent-a",
                approved: true,
                permissions: [{ permission: "@network", access: { kind: "network" } }],
                scope: "always"
            };
            const updated = await repository.updateStatus("token-1", "approved", 200, decision);
            expect(updated).toBe(true);

            const loaded = await repository.findByToken("token-1");
            expect(loaded?.status).toBe("approved");
            expect(loaded?.decision).toEqual(decision);
            expect(loaded?.updatedAt).toBe(200);
        } finally {
            db.close();
        }
    });

    it("expires only due pending requests and keeps ordering in findMany", async () => {
        const db = databaseOpen(":memory:");
        try {
            schemaCreate(db);
            const repository = new PermissionRequestsRepository(db);

            await repository.create(
                recordBuild({
                    id: "req-2",
                    token: "token-2",
                    agentId: "agent-a",
                    userId: "user-a",
                    status: "pending",
                    timeoutAt: 20,
                    createdAt: 20
                })
            );
            await repository.create(
                recordBuild({
                    id: "req-1",
                    token: "token-1",
                    agentId: "agent-a",
                    userId: "user-a",
                    status: "pending",
                    timeoutAt: 10,
                    createdAt: 10
                })
            );
            await repository.create(
                recordBuild({
                    id: "req-3",
                    token: "token-3",
                    agentId: "agent-a",
                    userId: "user-a",
                    status: "approved",
                    timeoutAt: 5,
                    createdAt: 30
                })
            );

            const expired = await repository.expirePending(15, 100);
            expect(expired).toBe(1);
            expect((await repository.findByToken("token-1"))?.status).toBe("expired");
            expect((await repository.findByToken("token-2"))?.status).toBe("pending");
            expect((await repository.findByToken("token-3"))?.status).toBe("approved");

            const all = await repository.findMany();
            expect(all.map((entry) => entry.id)).toEqual(["req-1", "req-2", "req-3"]);
        } finally {
            db.close();
        }
    });
});

function schemaCreate(db: ReturnType<typeof databaseOpen>): void {
    db.exec(`
        CREATE TABLE permission_requests (
            id TEXT PRIMARY KEY,
            token TEXT UNIQUE NOT NULL,
            agent_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            permissions TEXT NOT NULL,
            reason TEXT NOT NULL,
            requester TEXT NOT NULL,
            scope TEXT,
            timeout_at INTEGER NOT NULL,
            decision TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );
    `);
}

function recordBuild(input: {
    id: string;
    token: string;
    agentId: string;
    userId: string;
    status: "pending" | "approved" | "denied" | "expired";
    timeoutAt: number;
    createdAt?: number;
}) {
    const createdAt = input.createdAt ?? 1;
    return {
        id: input.id,
        token: input.token,
        agentId: input.agentId,
        userId: input.userId,
        status: input.status,
        permissions: [{ permission: "@network", access: { kind: "network" as const } }],
        reason: "Need network access for API call",
        requester: {
            id: input.agentId,
            type: "cron" as const,
            label: "Cron agent",
            kind: "background" as const
        },
        scope: "now" as const,
        timeoutAt: input.timeoutAt,
        decision: null,
        createdAt,
        updatedAt: createdAt
    };
}

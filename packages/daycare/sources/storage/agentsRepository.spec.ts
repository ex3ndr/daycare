import { describe, expect, it } from "vitest";

import type { SessionPermissions } from "@/types";
import { AgentsRepository } from "./agentsRepository.js";
import type { AgentDbRecord } from "./databaseTypes.js";
import { Storage } from "./storage.js";

const permissions: SessionPermissions = {
    workspaceDir: "/workspace",
    workingDir: "/workspace",
    writeDirs: ["/workspace"],
    readDirs: ["/workspace"],
    network: false,
    events: false
};

describe("AgentsRepository", () => {
    it("supports create, find and update", async () => {
        const storage = Storage.open(":memory:");
        try {
            const users = await storage.users.findMany();
            const ownerUser = users[0];
            if (!ownerUser) {
                throw new Error("Owner user missing");
            }
            const repo = new AgentsRepository(storage.db);
            const record: AgentDbRecord = {
                id: "agent-1",
                userId: ownerUser.id,
                type: "cron",
                descriptor: { type: "cron", id: "agent-1", name: "cron" },
                activeSessionId: null,
                permissions,
                tokens: null,
                stats: {},
                lifecycle: "active",
                createdAt: 1,
                updatedAt: 1
            };
            await repo.create(record);

            const byId = await repo.findById("agent-1");
            expect(byId).toEqual(record);

            await repo.update("agent-1", {
                lifecycle: "sleeping",
                updatedAt: 2
            });
            const updated = await repo.findById("agent-1");
            expect(updated?.lifecycle).toBe("sleeping");
            expect(updated?.updatedAt).toBe(2);

            const listed = await repo.findMany();
            expect(listed).toHaveLength(1);
            expect(listed[0]?.id).toBe("agent-1");
        } finally {
            storage.close();
        }
    });

    it("returns cached agent on repeated read", async () => {
        const storage = Storage.open(":memory:");
        try {
            const ownerUser = (await storage.users.findMany())[0];
            if (!ownerUser) {
                throw new Error("Owner user missing");
            }
            const repo = new AgentsRepository(storage.db);
            await repo.create({
                id: "agent-cache",
                userId: ownerUser.id,
                type: "cron",
                descriptor: { type: "cron", id: "agent-cache", name: "cache" },
                activeSessionId: null,
                permissions,
                tokens: null,
                stats: {},
                lifecycle: "active",
                createdAt: 1,
                updatedAt: 1
            });

            const first = await repo.findById("agent-cache");
            expect(first?.id).toBe("agent-cache");

            storage.db.prepare("DELETE FROM agents WHERE id = ?").run("agent-cache");
            const second = await repo.findById("agent-cache");
            expect(second?.id).toBe("agent-cache");
        } finally {
            storage.close();
        }
    });

    it("loads from db on cache miss", async () => {
        const storage = Storage.open(":memory:");
        try {
            const ownerUser = (await storage.users.findMany())[0];
            if (!ownerUser) {
                throw new Error("Owner user missing");
            }
            const repo = new AgentsRepository(storage.db);
            storage.db
                .prepare(
                    `
                  INSERT INTO agents (
                    id,
                    user_id,
                    type,
                    descriptor,
                    active_session_id,
                    permissions,
                    tokens,
                    stats,
                    lifecycle,
                    created_at,
                    updated_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `
                )
                .run(
                    "agent-db",
                    ownerUser.id,
                    "cron",
                    JSON.stringify({ type: "cron", id: "agent-db", name: "db" }),
                    null,
                    JSON.stringify(permissions),
                    null,
                    "{}",
                    "active",
                    1,
                    2
                );

            const loaded = await repo.findById("agent-db");
            expect(loaded?.id).toBe("agent-db");
            expect(loaded?.updatedAt).toBe(2);
        } finally {
            storage.close();
        }
    });
});

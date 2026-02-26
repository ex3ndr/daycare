import { describe, expect, it } from "vitest";
import type { Context } from "@/types";

import { databaseOpenTest } from "./databaseOpenTest.js";
import { ExposeEndpointsRepository } from "./exposeEndpointsRepository.js";

describe("ExposeEndpointsRepository", () => {
    it("supports CRUD and user scoping", async () => {
        const db = databaseOpenTest();
        try {
            schemaCreate(db);
            const repository = new ExposeEndpointsRepository(db);

            await repository.create({
                id: "ep-1",
                userId: "user-a",
                target: { type: "port", port: 8080 },
                provider: "provider-a",
                domain: "app.example.com",
                mode: "public",
                auth: null,
                createdAt: 1,
                updatedAt: 1
            });
            await repository.create({
                id: "ep-2",
                userId: "user-b",
                target: { type: "unix", path: "/tmp/server.sock" },
                provider: "provider-b",
                domain: "ops.example.com",
                mode: "local-network",
                auth: { enabled: true, passwordHash: "hash" },
                createdAt: 2,
                updatedAt: 2
            });

            const all = await repository.findAll();
            const userA = await repository.findMany(ctxBuild("user-a"));

            expect(all.map((entry) => entry.id)).toEqual(["ep-1", "ep-2"]);
            expect(userA.map((entry) => entry.id)).toEqual(["ep-1"]);

            await repository.update("ep-1", {
                auth: { enabled: true, passwordHash: "next-hash" },
                updatedAt: 10
            });

            const updated = await repository.findById("ep-1");
            expect(updated?.auth?.passwordHash).toBe("next-hash");

            const removed = await repository.delete("ep-2");
            const remaining = await repository.findAll();

            expect(removed).toBe(true);
            expect(remaining.map((entry) => entry.id)).toEqual(["ep-1"]);
        } finally {
            db.close();
        }
    });
});

function schemaCreate(db: ReturnType<typeof databaseOpenTest>): void {
    db.exec(`
        CREATE TABLE expose_endpoints (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            target TEXT NOT NULL,
            provider TEXT NOT NULL,
            domain TEXT NOT NULL,
            mode TEXT NOT NULL,
            auth TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );
    `);
}

function ctxBuild(userId: string): Context {
    return { agentId: "test-agent", userId };
}

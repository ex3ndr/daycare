import { describe, expect, it } from "vitest";
import type { Context } from "@/types";

import { ExposeEndpointsRepository } from "./exposeEndpointsRepository.js";
import { storageOpenTest } from "./storageOpenTest.js";

describe("ExposeEndpointsRepository", () => {
    it("supports CRUD and user scoping", async () => {
        const storage = await storageOpenTest();
        try {
            const repository = new ExposeEndpointsRepository(storage.db);

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
            storage.connection.close();
        }
    });
});

function ctxBuild(userId: string): Context {
    return { agentId: "test-agent", userId };
}

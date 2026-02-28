import { describe, expect, it } from "vitest";
import type { Context } from "@/types";

import { DelayedSignalsRepository } from "./delayedSignalsRepository.js";
import { storageOpenTest } from "./storageOpenTest.js";

describe("DelayedSignalsRepository", () => {
    it("creates, reads due records, deletes, and cancels by repeat key", async () => {
        const storage = await storageOpenTest();
        try {
            const repository = new DelayedSignalsRepository(storage.db);

            await repository.create({
                id: "delay-1",
                userId: "user-a",
                type: "notify:a",
                deliverAt: 10,
                source: { type: "system", userId: "user-a" },
                data: { a: true },
                repeatKey: null,
                createdAt: 1,
                updatedAt: 1
            });
            await repository.create({
                id: "delay-2",
                userId: "user-a",
                type: "notify:repeat",
                deliverAt: 30,
                source: { type: "system", userId: "user-a" },
                data: { b: true },
                repeatKey: "r1",
                createdAt: 2,
                updatedAt: 2
            });
            await repository.create({
                id: "delay-3",
                userId: "user-a",
                type: "notify:repeat",
                deliverAt: 40,
                source: { type: "system", userId: "user-a" },
                data: { c: true },
                repeatKey: "r1",
                createdAt: 3,
                updatedAt: 3
            });

            const all = await repository.findMany(ctxBuild("user-a"));
            const due = await repository.findDue(20);

            expect(all.map((entry) => entry.id)).toEqual(["delay-1", "delay-3"]);
            expect(due.map((entry) => entry.id)).toEqual(["delay-1"]);

            const removed = await repository.delete("delay-1");
            const cancelled = await repository.deleteByRepeatKey(
                { agentId: "test-agent", userId: "user-a" },
                "notify:repeat",
                "r1"
            );
            const empty = await repository.findMany(ctxBuild("user-a"));

            expect(removed).toBe(true);
            expect(cancelled).toBe(1);
            expect(empty).toEqual([]);
        } finally {
            storage.connection.close();
        }
    });
});

function ctxBuild(userId: string): Context {
    return { agentId: "test-agent", userId };
}

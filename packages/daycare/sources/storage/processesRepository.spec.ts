import { describe, expect, it } from "vitest";
import type { Context } from "@/types";

import { ProcessesRepository } from "./processesRepository.js";
import { storageOpenTest } from "./storageOpenTest.js";

describe("ProcessesRepository", () => {
    it("supports CRUD and filtering by user and owner", async () => {
        const storage = await storageOpenTest();
        try {
            const repository = new ProcessesRepository(storage.db);

            await repository.create(
                recordBuild({ id: "p-1", userId: "user-a", owner: { type: "plugin", id: "plugin-a" } })
            );
            await repository.create(
                recordBuild({ id: "p-2", userId: "user-b", owner: { type: "plugin", id: "plugin-b" } })
            );
            await repository.create(recordBuild({ id: "p-3", userId: "user-a", owner: null }));

            const all = await repository.findAll();
            const byUser = await repository.findMany(ctxBuild("user-a"));
            const byOwner = await repository.findMany(ctxBuild("user-a"), {
                ownerType: "plugin",
                ownerId: "plugin-a"
            });

            expect(all.map((entry) => entry.id)).toEqual(["p-1", "p-2", "p-3"]);
            expect(byUser.map((entry) => entry.id)).toEqual(["p-1", "p-3"]);
            expect(byOwner.map((entry) => entry.id)).toEqual(["p-1"]);

            await repository.update("p-1", { status: "exited", pid: null, updatedAt: 20 });
            const updated = await repository.findById("p-1");
            expect(updated?.status).toBe("exited");

            const removedByOwner = await repository.deleteByOwner("plugin", "plugin-b");
            const removedDirect = await repository.delete("p-3");
            const remaining = await repository.findAll();

            expect(removedByOwner).toBe(1);
            expect(removedDirect).toBe(true);
            expect(remaining.map((entry) => entry.id)).toEqual(["p-1"]);
        } finally {
            storage.connection.close();
        }
    });
});

function ctxBuild(userId: string): Context {
    return { agentId: "test-agent", userId };
}

function recordBuild(input: { id: string; userId: string; owner: { type: "plugin"; id: string } | null }) {
    return {
        id: input.id,
        userId: input.userId,
        name: input.id,
        command: 'node -e "1"',
        cwd: "/tmp",
        home: null,
        env: {},
        packageManagers: [],
        allowedDomains: [],
        allowLocalBinding: false,
        permissions: {
            workingDir: "/tmp",
            writeDirs: ["/tmp"]
        },
        owner: input.owner,
        keepAlive: false,
        desiredState: "running" as const,
        status: "running" as const,
        pid: 100,
        bootTimeMs: 10,
        restartCount: 0,
        restartFailureCount: 0,
        nextRestartAt: null,
        settingsPath: `/tmp/${input.id}/sandbox.json`,
        logPath: `/tmp/${input.id}/process.log`,
        createdAt: 1,
        updatedAt: 1,
        lastStartedAt: 1,
        lastExitedAt: null
    };
}

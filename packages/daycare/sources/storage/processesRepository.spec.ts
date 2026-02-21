import { describe, expect, it } from "vitest";

import { databaseOpen } from "./databaseOpen.js";
import { ProcessesRepository } from "./processesRepository.js";

describe("ProcessesRepository", () => {
    it("supports CRUD and filtering by user and owner", async () => {
        const db = databaseOpen(":memory:");
        try {
            schemaCreate(db);
            const repository = new ProcessesRepository(db);

            await repository.create(
                recordBuild({ id: "p-1", userId: "user-a", owner: { type: "plugin", id: "plugin-a" } })
            );
            await repository.create(
                recordBuild({ id: "p-2", userId: "user-b", owner: { type: "plugin", id: "plugin-b" } })
            );
            await repository.create(recordBuild({ id: "p-3", userId: "user-a", owner: null }));

            const all = await repository.findMany();
            const byUser = await repository.findMany({ userId: "user-a" });
            const byOwner = await repository.findMany({ ownerType: "plugin", ownerId: "plugin-a" });

            expect(all.map((entry) => entry.id)).toEqual(["p-1", "p-2", "p-3"]);
            expect(byUser.map((entry) => entry.id)).toEqual(["p-1", "p-3"]);
            expect(byOwner.map((entry) => entry.id)).toEqual(["p-1"]);

            await repository.update("p-1", { status: "exited", pid: null, updatedAt: 20 });
            const updated = await repository.findById("p-1");
            expect(updated?.status).toBe("exited");

            const removedByOwner = await repository.deleteByOwner("plugin", "plugin-b");
            const removedDirect = await repository.delete("p-3");
            const remaining = await repository.findMany();

            expect(removedByOwner).toBe(1);
            expect(removedDirect).toBe(true);
            expect(remaining.map((entry) => entry.id)).toEqual(["p-1"]);
        } finally {
            db.close();
        }
    });
});

function schemaCreate(db: ReturnType<typeof databaseOpen>): void {
    db.exec(`
        CREATE TABLE processes (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            command TEXT NOT NULL,
            cwd TEXT NOT NULL,
            home TEXT,
            env TEXT NOT NULL,
            package_managers TEXT NOT NULL,
            allowed_domains TEXT NOT NULL,
            allow_local_binding INTEGER NOT NULL,
            permissions TEXT NOT NULL,
            owner TEXT,
            keep_alive INTEGER NOT NULL,
            desired_state TEXT NOT NULL,
            status TEXT NOT NULL,
            pid INTEGER,
            boot_time_ms INTEGER,
            restart_count INTEGER NOT NULL,
            restart_failure_count INTEGER NOT NULL,
            next_restart_at INTEGER,
            settings_path TEXT NOT NULL,
            log_path TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            last_started_at INTEGER,
            last_exited_at INTEGER
        );
    `);
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
            writeDirs: ["/tmp"],
            readDirs: ["/tmp"],
            network: false,
            events: false
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

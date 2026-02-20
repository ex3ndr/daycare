import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { HeartbeatStore } from "./heartbeatStore.js";

async function createTempStore() {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-heartbeat-store-"));
    const store = new HeartbeatStore(dir);
    await store.ensureDir();
    return { dir, store };
}

describe("HeartbeatStore", () => {
    const temps: string[] = [];

    afterEach(async () => {
        await Promise.all(temps.map((dir) => fs.rm(dir, { recursive: true, force: true })));
        temps.length = 0;
    });

    it("persists gate permissions on create", async () => {
        const { dir, store } = await createTempStore();
        temps.push(dir);

        await store.createTask({
            title: "Gate Task",
            prompt: "Prompt",
            gate: { command: "echo gate", permissions: ["@network"] }
        });

        const tasks = await store.listTasks();
        expect(tasks[0]?.gate?.permissions).toEqual(["@network"]);
    });
});

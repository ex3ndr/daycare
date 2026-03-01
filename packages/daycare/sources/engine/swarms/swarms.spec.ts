import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { storageOpenTest } from "../../storage/storageOpenTest.js";
import { UserHome } from "../users/userHome.js";
import { Swarms } from "./swarms.js";

describe("Swarms", () => {
    it("creates, lists, gets, and builds owner mounts", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-swarms-facade-"));
        const storage = await storageOpenTest();
        try {
            const owner = await storage.users.findOwner();
            if (!owner) {
                throw new Error("Owner user not found.");
            }

            const swarms = new Swarms({
                storage,
                userHomeForUserId: (userId) => new UserHome(path.join(dir, "users"), userId)
            });
            await swarms.create(owner.id, {
                nametag: "todo",
                firstName: "Todo",
                lastName: null,
                bio: "Todo helper",
                about: null,
                systemPrompt: "prompt",
                memory: false
            });

            const listed = swarms.list();
            const fetched = swarms.get("todo");

            expect(listed).toHaveLength(1);
            expect(fetched?.nametag).toBe("todo");
            expect(swarms.mountsForOwner(owner.id)).toHaveLength(1);
        } finally {
            storage.connection.close();
            await rm(dir, { recursive: true, force: true });
        }
    });
});

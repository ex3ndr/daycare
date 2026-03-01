import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { storageOpenTest } from "../../storage/storageOpenTest.js";
import { UserHome } from "../users/userHome.js";
import { swarmCreate } from "./swarmCreate.js";

describe("swarmCreate", () => {
    it("creates a swarm user and user home with SOUL prompt", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-swarm-create-"));
        const storage = await storageOpenTest();
        try {
            const owner = await storage.users.findOwner();
            if (!owner) {
                throw new Error("Owner user not found.");
            }

            const created = await swarmCreate({
                ownerUserId: owner.id,
                config: {
                    nametag: "todo",
                    firstName: "Todo",
                    lastName: "Swarm",
                    bio: "Manages todos",
                    about: "Autonomous todo management",
                    systemPrompt: "You are the todo swarm.",
                    memory: false
                },
                storage,
                userHomeForUserId: (userId) => new UserHome(path.join(dir, "users"), userId)
            });

            const user = await storage.users.findById(created.userId);
            const soul = await readFile(
                path.join(dir, "users", created.userId, "home", "knowledge", "SOUL.md"),
                "utf8"
            );

            expect(user?.parentUserId).toBe(owner.id);
            expect(user?.isSwarm).toBe(true);
            expect(user?.nametag).toBe("todo");
            expect(user?.firstName).toBe("Todo");
            expect(user?.lastName).toBe("Swarm");
            expect(user?.bio).toBe("Manages todos");
            expect(user?.about).toBe("Autonomous todo management");
            expect(user?.memory).toBe(false);
            expect(soul).toContain("You are the todo swarm.");
        } finally {
            storage.connection.close();
            await rm(dir, { recursive: true, force: true });
        }
    });
});

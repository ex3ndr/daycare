import { describe, expect, it } from "vitest";

import { storageOpenTest } from "../../storage/storageOpenTest.js";
import { swarmDiscover } from "./swarmDiscover.js";

describe("swarmDiscover", () => {
    it("discovers owner swarms from swarm user records", async () => {
        const storage = await storageOpenTest();
        try {
            const owner = await storage.users.findOwner();
            if (!owner) {
                throw new Error("Owner user not found.");
            }
            await storage.users.create({
                id: "swarm-1",
                parentUserId: owner.id,
                isSwarm: true,
                nametag: "todo",
                firstName: "Todo",
                bio: "Todos",
                systemPrompt: "prompt 1",
                memory: false,
                createdAt: 2,
                updatedAt: 2
            });
            await storage.users.create({
                id: "swarm-2",
                parentUserId: owner.id,
                isSwarm: true,
                nametag: "review",
                firstName: "Review",
                bio: "Reviews",
                systemPrompt: "prompt 2",
                memory: true,
                createdAt: 3,
                updatedAt: 3
            });

            const discovered = await swarmDiscover({ ownerUserId: owner.id, storage });
            expect(discovered.map((entry) => entry.nametag)).toEqual(["review", "todo"]);
            expect(discovered.find((entry) => entry.nametag === "review")?.memory).toBe(true);
        } finally {
            storage.connection.close();
        }
    });
});

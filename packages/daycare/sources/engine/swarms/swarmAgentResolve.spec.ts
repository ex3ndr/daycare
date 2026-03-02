import { describe, expect, it } from "vitest";

import { storageOpenTest } from "../../storage/storageOpenTest.js";
import { swarmAgentResolve } from "./swarmAgentResolve.js";

describe("swarmAgentResolve", () => {
    it("creates or reuses swarm agent mapping for a contact agent", async () => {
        const storage = await storageOpenTest();
        try {
            const owner = await storage.users.findOwner();
            if (!owner) {
                throw new Error("Owner user not found.");
            }
            await storage.users.create({
                id: "swarm-1",
                parentUserId: owner.id,
                nametag: "todo",
                isSwarm: true,
                firstName: "Todo",
                bio: "desc",
                systemPrompt: "prompt",
                createdAt: 2,
                updatedAt: 2
            });
            await storage.users.create({ id: "contact-user-1", nametag: "contact-1", createdAt: 3, updatedAt: 3 });
            await storage.agents.create({
                id: "contact-agent-1",
                userId: "contact-user-1",
                type: "user",
                descriptor: { type: "user", connector: "local", userId: "contact", channelId: "ch-1" },
                activeSessionId: null,
                permissions: { workingDir: "/tmp", writeDirs: ["/tmp"] },
                tokens: null,
                lifecycle: "active",
                createdAt: 10,
                updatedAt: 10
            });

            const ids = new Map<string, string>();
            const agentSystem = {
                storage,
                agentIdForTarget: async (_ctx: unknown, target: { path: string }) => {
                    const key = target.path;
                    const existing = ids.get(key);
                    if (existing) {
                        return existing;
                    }
                    const created = `swarm-agent-${ids.size + 1}`;
                    ids.set(key, created);
                    return created;
                }
            };

            const first = await swarmAgentResolve({
                swarmUserId: "swarm-1",
                contactAgentId: "contact-agent-1",
                agentSystem: agentSystem as never
            });
            const second = await swarmAgentResolve({
                swarmUserId: "swarm-1",
                contactAgentId: "contact-agent-1",
                agentSystem: agentSystem as never
            });

            expect(first.swarmAgentId).toBe("swarm-agent-1");
            expect(second.swarmAgentId).toBe("swarm-agent-1");
            expect(first.path).toBe("/swarm-1/agent/swarm");
            expect(second.path).toBe("/swarm-1/agent/swarm");

            const contacts = await storage.swarmContacts.listContacts("swarm-1");
            expect(contacts).toHaveLength(1);
            expect(contacts[0]?.swarmAgentId).toBe("swarm-agent-1");
        } finally {
            storage.connection.close();
        }
    });
});

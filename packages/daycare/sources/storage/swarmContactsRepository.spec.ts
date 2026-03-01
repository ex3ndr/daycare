import { describe, expect, it } from "vitest";
import { storageOpenTest } from "./storageOpenTest.js";
import { SwarmContactsRepository } from "./swarmContactsRepository.js";

describe("SwarmContactsRepository", () => {
    it("creates, updates counters, lists contacts, and checks known contacts", async () => {
        const storage = await storageOpenTest();
        try {
            const repository = new SwarmContactsRepository(storage.db);

            const created = await repository.findOrCreate("swarm-1", "contact-agent-1", "swarm-agent-1");
            expect(created.messagesSent).toBe(0);
            expect(created.messagesReceived).toBe(0);

            const second = await repository.findOrCreate("swarm-1", "contact-agent-1", "swarm-agent-1");
            expect(second.swarmAgentId).toBe("swarm-agent-1");

            await repository.recordReceived("swarm-1", "contact-agent-1");
            await repository.recordReceived("swarm-1", "contact-agent-1");
            await repository.recordSent("swarm-1", "contact-agent-1");

            await repository.findOrCreate("swarm-1", "contact-agent-2", "swarm-agent-2");
            await repository.recordSent("swarm-1", "contact-agent-2");

            const contacts = await repository.listContacts("swarm-1");
            const first = contacts.find((entry) => entry.contactAgentId === "contact-agent-1");
            const secondContact = contacts.find((entry) => entry.contactAgentId === "contact-agent-2");

            expect(first?.messagesReceived).toBe(2);
            expect(first?.messagesSent).toBe(1);
            expect(secondContact?.messagesSent).toBe(1);
            expect(await repository.isKnownContact("swarm-1", "contact-agent-1")).toBe(true);
            expect(await repository.isKnownContact("swarm-1", "unknown-agent")).toBe(false);
        } finally {
            storage.connection.close();
        }
    });
});

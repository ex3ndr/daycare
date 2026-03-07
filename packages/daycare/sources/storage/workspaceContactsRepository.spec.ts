import { describe, expect, it } from "vitest";
import { storageOpenTest } from "./storageOpenTest.js";
import { WorkspaceContactsRepository } from "./workspaceContactsRepository.js";

describe("WorkspaceContactsRepository", () => {
    it("creates, updates counters, lists contacts, and checks known contacts", async () => {
        const storage = await storageOpenTest();
        try {
            const repository = new WorkspaceContactsRepository(storage.db);

            const created = await repository.findOrCreate("workspace-1", "contact-agent-1", "workspace-agent-1");
            expect(created.messagesSent).toBe(0);
            expect(created.messagesReceived).toBe(0);

            const second = await repository.findOrCreate("workspace-1", "contact-agent-1", "workspace-agent-1");
            expect(second.workspaceAgentId).toBe("workspace-agent-1");

            await repository.recordReceived("workspace-1", "contact-agent-1");
            await repository.recordReceived("workspace-1", "contact-agent-1");
            await repository.recordSent("workspace-1", "contact-agent-1");

            await repository.findOrCreate("workspace-1", "contact-agent-2", "workspace-agent-2");
            await repository.recordSent("workspace-1", "contact-agent-2");

            const contacts = await repository.listContacts("workspace-1");
            const first = contacts.find((entry) => entry.contactAgentId === "contact-agent-1");
            const secondContact = contacts.find((entry) => entry.contactAgentId === "contact-agent-2");

            expect(first?.messagesReceived).toBe(2);
            expect(first?.messagesSent).toBe(1);
            expect(secondContact?.messagesSent).toBe(1);
            expect(await repository.isKnownContact("workspace-1", "contact-agent-1")).toBe(true);
            expect(await repository.isKnownContact("workspace-1", "unknown-agent")).toBe(false);
        } finally {
            storage.connection.close();
        }
    });
});

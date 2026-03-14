import { describe, expect, it } from "vitest";
import { contextForUser } from "../engine/agents/context.js";
import { storageOpenTest } from "./storageOpenTest.js";
import { VoiceAgentsRepository } from "./voiceAgentsRepository.js";

describe("VoiceAgentsRepository", () => {
    it("creates, reads, updates, lists, and deletes voice agents by ctx user", async () => {
        const storage = await storageOpenTest();
        const repository = new VoiceAgentsRepository(storage.db);
        const userA = contextForUser({ userId: "user-a" });
        const userB = contextForUser({ userId: "user-b" });

        await storage.users.create({
            id: "user-a",
            createdAt: 1,
            updatedAt: 1,
            nametag: "user-a"
        });
        await storage.users.create({
            id: "user-b",
            createdAt: 1,
            updatedAt: 1,
            nametag: "user-b"
        });

        const created = await repository.create(userA, {
            id: "voice-1",
            name: "Support line",
            description: "Handles support calls",
            systemPrompt: "Be calm and helpful.",
            tools: [
                {
                    name: "lookup_order",
                    description: "Look up an order",
                    parameters: {
                        orderId: {
                            type: "string",
                            description: "Order ID",
                            required: true
                        }
                    }
                }
            ],
            settings: {
                providerId: "elevenlabs"
            },
            createdAt: 10,
            updatedAt: 10
        });

        expect(created).toEqual(
            expect.objectContaining({
                id: "voice-1",
                userId: "user-a",
                name: "Support line"
            })
        );
        expect(await repository.findById(userA, "voice-1")).toEqual(created);
        expect(await repository.findById(userB, "voice-1")).toBeNull();

        const updated = await repository.update(userA, "voice-1", {
            name: "Support concierge",
            description: "Answers support calls",
            updatedAt: 20
        });
        expect(updated.name).toBe("Support concierge");
        expect(updated.description).toBe("Answers support calls");

        expect(await repository.findMany(userA)).toEqual([updated]);
        expect(await repository.findMany(userB)).toEqual([]);

        const deleted = await repository.delete(userA, "voice-1");
        expect(deleted.id).toBe("voice-1");
        expect(await repository.findById(userA, "voice-1")).toBeNull();
    });

    it("validates required fields and duplicate ids per user", async () => {
        const storage = await storageOpenTest();
        const repository = new VoiceAgentsRepository(storage.db);
        const ctx = contextForUser({ userId: "user-a" });

        await storage.users.create({
            id: "user-a",
            createdAt: 1,
            updatedAt: 1,
            nametag: "user-a"
        });

        await expect(
            repository.create(ctx, {
                id: "",
                name: "Voice",
                systemPrompt: "Prompt",
                createdAt: 1,
                updatedAt: 1
            })
        ).rejects.toThrow("Voice agent id is required.");

        await repository.create(ctx, {
            id: "voice-1",
            name: "Voice",
            systemPrompt: "Prompt",
            createdAt: 1,
            updatedAt: 1
        });

        await expect(
            repository.create(ctx, {
                id: "voice-1",
                name: "Voice 2",
                systemPrompt: "Prompt",
                createdAt: 2,
                updatedAt: 2
            })
        ).rejects.toThrow("Voice agent already exists: voice-1");
    });
});

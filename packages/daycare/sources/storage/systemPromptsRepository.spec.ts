import { describe, expect, it } from "vitest";

import { Storage } from "./storage.js";
import type { SystemPromptDbRecord } from "./databaseTypes.js";

function createStorage(): Storage {
    return Storage.open(":memory:");
}

function makePrompt(overrides: Partial<SystemPromptDbRecord> = {}): SystemPromptDbRecord {
    const now = Date.now();
    return {
        id: `prompt-${Math.random().toString(36).slice(2, 8)}`,
        scope: "global",
        userId: null,
        kind: "system",
        condition: null,
        prompt: "You are a helpful assistant.",
        enabled: true,
        createdAt: now,
        updatedAt: now,
        ...overrides
    };
}

describe("SystemPromptsRepository", () => {
    it("creates and finds a prompt by id", async () => {
        const storage = createStorage();
        try {
            const record = makePrompt({ id: "p1" });
            await storage.systemPrompts.create(record);

            const found = await storage.systemPrompts.findById("p1");
            expect(found).not.toBeNull();
            expect(found!.id).toBe("p1");
            expect(found!.prompt).toBe("You are a helpful assistant.");
            expect(found!.scope).toBe("global");
            expect(found!.enabled).toBe(true);
        } finally {
            storage.close();
        }
    });

    it("returns null for non-existent prompt", async () => {
        const storage = createStorage();
        try {
            const found = await storage.systemPrompts.findById("nonexistent");
            expect(found).toBeNull();
        } finally {
            storage.close();
        }
    });

    it("lists all prompts", async () => {
        const storage = createStorage();
        try {
            await storage.systemPrompts.create(makePrompt({ id: "p1", createdAt: 1000 }));
            await storage.systemPrompts.create(makePrompt({ id: "p2", createdAt: 2000 }));

            const all = await storage.systemPrompts.findMany();
            expect(all).toHaveLength(2);
            expect(all[0]!.id).toBe("p1");
            expect(all[1]!.id).toBe("p2");
        } finally {
            storage.close();
        }
    });

    it("finds prompts by scope", async () => {
        const storage = createStorage();
        try {
            await storage.systemPrompts.create(makePrompt({ id: "g1", scope: "global" }));
            await storage.systemPrompts.create(
                makePrompt({ id: "u1", scope: "user", userId: "user-abc" })
            );

            const globals = await storage.systemPrompts.findByScope("global");
            expect(globals).toHaveLength(1);
            expect(globals[0]!.id).toBe("g1");

            const userPrompts = await storage.systemPrompts.findByScope("user", "user-abc");
            expect(userPrompts).toHaveLength(1);
            expect(userPrompts[0]!.id).toBe("u1");
        } finally {
            storage.close();
        }
    });

    it("finds enabled prompts for a user (global + per-user)", async () => {
        const storage = createStorage();
        try {
            await storage.systemPrompts.create(makePrompt({ id: "g1", scope: "global", enabled: true }));
            await storage.systemPrompts.create(makePrompt({ id: "g2", scope: "global", enabled: false }));
            await storage.systemPrompts.create(
                makePrompt({ id: "u1", scope: "user", userId: "user-abc", enabled: true })
            );
            await storage.systemPrompts.create(
                makePrompt({ id: "u2", scope: "user", userId: "user-other", enabled: true })
            );

            const enabled = await storage.systemPrompts.findEnabled("user-abc");
            expect(enabled).toHaveLength(2);
            const ids = enabled.map((p) => p.id);
            expect(ids).toContain("g1");
            expect(ids).toContain("u1");
            expect(ids).not.toContain("g2");
            expect(ids).not.toContain("u2");
        } finally {
            storage.close();
        }
    });

    it("updates a prompt", async () => {
        const storage = createStorage();
        try {
            await storage.systemPrompts.create(makePrompt({ id: "p1", prompt: "original" }));

            await storage.systemPrompts.updateById("p1", {
                prompt: "updated",
                updatedAt: Date.now()
            });

            const found = await storage.systemPrompts.findById("p1");
            expect(found!.prompt).toBe("updated");
        } finally {
            storage.close();
        }
    });

    it("deletes a prompt", async () => {
        const storage = createStorage();
        try {
            await storage.systemPrompts.create(makePrompt({ id: "p1" }));
            const deleted = await storage.systemPrompts.deleteById("p1");
            expect(deleted).toBe(true);

            const found = await storage.systemPrompts.findById("p1");
            expect(found).toBeNull();
        } finally {
            storage.close();
        }
    });

    it("returns false when deleting non-existent prompt", async () => {
        const storage = createStorage();
        try {
            const deleted = await storage.systemPrompts.deleteById("nonexistent");
            expect(deleted).toBe(false);
        } finally {
            storage.close();
        }
    });

    it("stores and retrieves condition field", async () => {
        const storage = createStorage();
        try {
            await storage.systemPrompts.create(
                makePrompt({ id: "p1", condition: "new_user" })
            );
            await storage.systemPrompts.create(
                makePrompt({ id: "p2", condition: "returning_user" })
            );
            await storage.systemPrompts.create(
                makePrompt({ id: "p3", condition: null })
            );

            const p1 = await storage.systemPrompts.findById("p1");
            expect(p1!.condition).toBe("new_user");

            const p2 = await storage.systemPrompts.findById("p2");
            expect(p2!.condition).toBe("returning_user");

            const p3 = await storage.systemPrompts.findById("p3");
            expect(p3!.condition).toBeNull();
        } finally {
            storage.close();
        }
    });

    it("stores first_message kind", async () => {
        const storage = createStorage();
        try {
            await storage.systemPrompts.create(
                makePrompt({ id: "fm1", kind: "first_message", prompt: "Welcome!" })
            );

            const found = await storage.systemPrompts.findById("fm1");
            expect(found!.kind).toBe("first_message");
            expect(found!.prompt).toBe("Welcome!");
        } finally {
            storage.close();
        }
    });
});

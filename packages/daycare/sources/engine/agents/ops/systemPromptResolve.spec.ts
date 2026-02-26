import { describe, expect, it } from "vitest";

import type { SystemPromptDbRecord } from "../../../storage/databaseTypes.js";
import type { Storage } from "../../../storage/storage.js";
import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { systemPromptResolve } from "./systemPromptResolve.js";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

function createStorage(): Storage {
    return storageOpenTest(":memory:");
}

function makePrompt(overrides: Partial<SystemPromptDbRecord> = {}): SystemPromptDbRecord {
    const now = Date.now();
    return {
        id: `p-${Math.random().toString(36).slice(2, 8)}`,
        scope: "global",
        userId: null,
        kind: "system",
        condition: null,
        prompt: "Default prompt.",
        enabled: true,
        createdAt: now,
        updatedAt: now,
        ...overrides
    };
}

async function setupUser(storage: Storage, userId: string, options?: { createdAt?: number; updatedAt?: number }) {
    const now = Date.now();
    await storage.createUser({
        id: userId,
        nametag: `user-${userId}`,
        createdAt: options?.createdAt ?? now,
        updatedAt: options?.updatedAt ?? now
    });
}

async function setupUserWithAgent(
    storage: Storage,
    userId: string,
    options?: { createdAt?: number; updatedAt?: number }
) {
    const now = Date.now();
    const createdAt = options?.createdAt ?? now;
    const updatedAt = options?.updatedAt ?? now;
    await setupUser(storage, userId, { createdAt, updatedAt });
    await storage.createAgentWithSession({
        record: {
            id: `agent-${userId}`,
            userId,
            type: "user",
            descriptor: { type: "user", connector: "test", userId, channelId: "ch1" },
            activeSessionId: null,
            permissions: { workingDir: "/tmp", writeDirs: [] },
            tokens: null,
            stats: {},
            lifecycle: "active",
            createdAt,
            updatedAt
        }
    });
}

describe("systemPromptResolve", () => {
    it("returns empty when no prompts configured", async () => {
        const storage = createStorage();
        try {
            await setupUser(storage, "u1");
            const result = await systemPromptResolve(storage, "u1", false);
            expect(result.systemPromptSections).toEqual([]);
            expect(result.firstMessagePrompt).toBeNull();
        } finally {
            storage.db.close();
        }
    });

    it("includes global prompt with no condition for all users", async () => {
        const storage = createStorage();
        try {
            await setupUser(storage, "u1");
            await storage.systemPrompts.create(makePrompt({ id: "g1", scope: "global", prompt: "Be concise." }));

            const result = await systemPromptResolve(storage, "u1", false);
            expect(result.systemPromptSections).toEqual(["Be concise."]);
        } finally {
            storage.db.close();
        }
    });

    it("includes per-user prompt only for matching userId", async () => {
        const storage = createStorage();
        try {
            await setupUser(storage, "u1");
            await setupUser(storage, "u2");
            await storage.systemPrompts.create(
                makePrompt({ id: "u1p", scope: "user", userId: "u1", prompt: "Special for u1." })
            );

            const result1 = await systemPromptResolve(storage, "u1", false);
            expect(result1.systemPromptSections).toEqual(["Special for u1."]);

            const result2 = await systemPromptResolve(storage, "u2", false);
            expect(result2.systemPromptSections).toEqual([]);
        } finally {
            storage.db.close();
        }
    });

    it("excludes disabled prompts", async () => {
        const storage = createStorage();
        try {
            await setupUser(storage, "u1");
            await storage.systemPrompts.create(
                makePrompt({ id: "g1", scope: "global", prompt: "Active.", enabled: true })
            );
            await storage.systemPrompts.create(
                makePrompt({ id: "g2", scope: "global", prompt: "Disabled.", enabled: false })
            );

            const result = await systemPromptResolve(storage, "u1", false);
            expect(result.systemPromptSections).toEqual(["Active."]);
        } finally {
            storage.db.close();
        }
    });

    it("applies new_user condition for new users", async () => {
        const storage = createStorage();
        try {
            // New user: created recently, no agents
            await setupUser(storage, "u1");
            await storage.systemPrompts.create(
                makePrompt({ id: "p1", prompt: "Welcome new user!", condition: "new_user" })
            );
            await storage.systemPrompts.create(
                makePrompt({ id: "p2", prompt: "Welcome back!", condition: "returning_user" })
            );

            const result = await systemPromptResolve(storage, "u1", false);
            expect(result.systemPromptSections).toEqual(["Welcome new user!"]);
        } finally {
            storage.db.close();
        }
    });

    it("applies returning_user condition for returning users", async () => {
        const storage = createStorage();
        try {
            const now = Date.now();
            const oldTime = now - SEVEN_DAYS_MS - 1000;
            const staleTime = now - THREE_DAYS_MS - 1000;
            await setupUserWithAgent(storage, "u1", { createdAt: oldTime, updatedAt: staleTime });

            await storage.systemPrompts.create(
                makePrompt({ id: "p1", prompt: "Welcome new user!", condition: "new_user" })
            );
            await storage.systemPrompts.create(
                makePrompt({ id: "p2", prompt: "Welcome back!", condition: "returning_user" })
            );

            const result = await systemPromptResolve(storage, "u1", false);
            expect(result.systemPromptSections).toEqual(["Welcome back!"]);
        } finally {
            storage.db.close();
        }
    });

    it("returns first message prompt only when isFirstMessage is true", async () => {
        const storage = createStorage();
        try {
            await setupUser(storage, "u1");
            await storage.systemPrompts.create(
                makePrompt({ id: "fm1", kind: "first_message", prompt: "Introduce yourself." })
            );

            const resultFirst = await systemPromptResolve(storage, "u1", true);
            expect(resultFirst.firstMessagePrompt).toBe("Introduce yourself.");
            expect(resultFirst.systemPromptSections).toEqual([]);

            const resultNotFirst = await systemPromptResolve(storage, "u1", false);
            expect(resultNotFirst.firstMessagePrompt).toBeNull();
        } finally {
            storage.db.close();
        }
    });

    it("concatenates multiple first message prompts with newline", async () => {
        const storage = createStorage();
        try {
            await setupUser(storage, "u1");
            await storage.systemPrompts.create(
                makePrompt({ id: "fm1", kind: "first_message", prompt: "Line 1.", createdAt: 1000 })
            );
            await storage.systemPrompts.create(
                makePrompt({ id: "fm2", kind: "first_message", prompt: "Line 2.", createdAt: 2000 })
            );

            const result = await systemPromptResolve(storage, "u1", true);
            expect(result.firstMessagePrompt).toBe("Line 1.\nLine 2.");
        } finally {
            storage.db.close();
        }
    });

    it("combines global system prompt with per-user system prompt", async () => {
        const storage = createStorage();
        try {
            await setupUser(storage, "u1");
            await storage.systemPrompts.create(
                makePrompt({ id: "g1", scope: "global", prompt: "Global rule.", createdAt: 1000 })
            );
            await storage.systemPrompts.create(
                makePrompt({
                    id: "u1p",
                    scope: "user",
                    userId: "u1",
                    prompt: "User-specific rule.",
                    createdAt: 2000
                })
            );

            const result = await systemPromptResolve(storage, "u1", false);
            expect(result.systemPromptSections).toEqual(["Global rule.", "User-specific rule."]);
        } finally {
            storage.db.close();
        }
    });
});

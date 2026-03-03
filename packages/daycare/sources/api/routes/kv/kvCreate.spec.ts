import { describe, expect, it } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { kvCreate } from "./kvCreate.js";

describe("kvCreate", () => {
    it("creates a key-value entry", async () => {
        const storage = await storageOpenTest();
        try {
            const ctx = contextForUser({ userId: "user-a" });
            const result = await kvCreate({
                ctx,
                body: {
                    key: "profile",
                    value: { theme: "dark" }
                },
                keyValues: storage.keyValues
            });

            expect(result).toEqual({
                ok: true,
                entry: {
                    key: "profile",
                    value: { theme: "dark" },
                    createdAt: expect.any(Number),
                    updatedAt: expect.any(Number)
                }
            });
        } finally {
            storage.connection.close();
        }
    });

    it("rejects missing fields", async () => {
        const storage = await storageOpenTest();
        try {
            const ctx = contextForUser({ userId: "user-a" });

            await expect(
                kvCreate({
                    ctx,
                    body: {
                        value: true
                    },
                    keyValues: storage.keyValues
                })
            ).resolves.toEqual({ ok: false, error: "key is required." });

            await expect(
                kvCreate({
                    ctx,
                    body: {
                        key: "profile"
                    },
                    keyValues: storage.keyValues
                })
            ).resolves.toEqual({ ok: false, error: "value is required." });
        } finally {
            storage.connection.close();
        }
    });
});

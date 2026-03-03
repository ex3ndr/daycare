import { describe, expect, it } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { kvUpdate } from "./kvUpdate.js";

describe("kvUpdate", () => {
    it("updates existing entries and enforces route/body key match", async () => {
        const storage = await storageOpenTest();
        try {
            const ctx = contextForUser({ userId: "user-a" });
            await storage.keyValues.create(ctx, {
                key: "profile",
                value: { theme: "dark" },
                createdAt: 1,
                updatedAt: 1
            });

            const result = await kvUpdate({
                ctx,
                key: "profile",
                body: {
                    value: { theme: "light" }
                },
                keyValues: storage.keyValues
            });
            expect(result).toEqual({
                ok: true,
                entry: {
                    key: "profile",
                    value: { theme: "light" },
                    createdAt: 1,
                    updatedAt: expect.any(Number)
                }
            });

            await expect(
                kvUpdate({
                    ctx,
                    key: "profile",
                    body: {
                        key: "other",
                        value: 1
                    },
                    keyValues: storage.keyValues
                })
            ).resolves.toEqual({ ok: false, error: "key in body must match route key." });
        } finally {
            storage.connection.close();
        }
    });
});

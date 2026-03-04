import { describe, expect, it, vi } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import { fragmentsFindById } from "./fragmentsFindById.js";

describe("fragmentsFindById", () => {
    it("returns a fragment when found", async () => {
        const ctx = contextForUser({ userId: "user-1" });
        const findAnyById = vi.fn(async () => ({
            id: "fragment-1",
            userId: "user-1",
            version: 3,
            validFrom: 30,
            validTo: null,
            kitVersion: "1",
            title: "Card",
            description: "Desc",
            spec: { type: "Text", text: "hello" },
            archived: true,
            createdAt: 1,
            updatedAt: 30
        }));

        const result = await fragmentsFindById({
            ctx,
            id: "fragment-1",
            fragments: {
                findAnyById
            } as never
        });

        expect(result).toEqual({
            ok: true,
            fragment: {
                id: "fragment-1",
                kitVersion: "1",
                title: "Card",
                description: "Desc",
                spec: { type: "Text", text: "hello" },
                archived: true,
                version: 3,
                createdAt: 1,
                updatedAt: 30
            }
        });
    });

    it("returns errors for invalid id and missing records", async () => {
        const ctx = contextForUser({ userId: "user-1" });

        await expect(
            fragmentsFindById({
                ctx,
                id: "   ",
                fragments: {
                    findAnyById: async () => {
                        throw new Error("should not run");
                    }
                } as never
            })
        ).resolves.toEqual({ ok: false, error: "id is required." });

        await expect(
            fragmentsFindById({
                ctx,
                id: "missing",
                fragments: {
                    findAnyById: async () => null
                } as never
            })
        ).resolves.toEqual({ ok: false, error: "Fragment not found." });
    });
});

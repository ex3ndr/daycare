import { describe, expect, it, vi } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import { fragmentsUpdate } from "./fragmentsUpdate.js";

describe("fragmentsUpdate", () => {
    it("updates fragment fields", async () => {
        const ctx = contextForUser({ userId: "user-1" });
        const update = vi.fn(async () => ({
            id: "fragment-1",
            userId: "user-1",
            version: 2,
            validFrom: 20,
            validTo: null,
            kitVersion: "1",
            title: "Profile Card v2",
            description: "Updated",
            spec: { type: "Text", text: "updated" },
            archived: false,
            createdAt: 10,
            updatedAt: 20
        }));

        const result = await fragmentsUpdate({
            ctx,
            id: "fragment-1",
            body: {
                title: "Profile Card v2",
                description: "Updated",
                spec: { type: "Text", text: "updated" }
            },
            fragments: {
                update
            } as never
        });

        expect(result).toEqual({
            ok: true,
            fragment: {
                id: "fragment-1",
                kitVersion: "1",
                title: "Profile Card v2",
                description: "Updated",
                spec: { type: "Text", text: "updated" },
                archived: false,
                version: 2,
                createdAt: 10,
                updatedAt: 20
            }
        });
    });

    it("rejects invalid updates and reports missing records", async () => {
        const ctx = contextForUser({ userId: "user-1" });

        await expect(
            fragmentsUpdate({
                ctx,
                id: "fragment-1",
                body: {},
                fragments: {} as never
            })
        ).resolves.toEqual({
            ok: false,
            error: "At least one field is required: kitVersion, title, description, or spec."
        });

        await expect(
            fragmentsUpdate({
                ctx,
                id: "fragment-1",
                body: {
                    title: 5
                },
                fragments: {} as never
            })
        ).resolves.toEqual({ ok: false, error: "title must be a string." });

        const missing = await fragmentsUpdate({
            ctx,
            id: "missing",
            body: {
                title: "Nope"
            },
            fragments: {
                update: async () => {
                    throw new Error("Fragment not found: missing");
                }
            } as never
        });
        expect(missing).toEqual({ ok: false, error: "Fragment not found: missing" });
    });
});

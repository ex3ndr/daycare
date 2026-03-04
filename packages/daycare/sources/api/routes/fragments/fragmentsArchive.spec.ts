import { describe, expect, it, vi } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import { fragmentsArchive } from "./fragmentsArchive.js";

describe("fragmentsArchive", () => {
    it("archives fragment by id", async () => {
        const ctx = contextForUser({ userId: "user-1" });
        const archive = vi.fn(async () => ({
            id: "fragment-1"
        }));

        const result = await fragmentsArchive({
            ctx,
            id: "fragment-1",
            fragments: {
                archive
            } as never
        });

        expect(result).toEqual({ ok: true });
    });

    it("returns validation and repository errors", async () => {
        const ctx = contextForUser({ userId: "user-1" });

        await expect(
            fragmentsArchive({
                ctx,
                id: "   ",
                fragments: {} as never
            })
        ).resolves.toEqual({ ok: false, error: "id is required." });

        const missing = await fragmentsArchive({
            ctx,
            id: "missing",
            fragments: {
                archive: async () => {
                    throw new Error("Fragment not found: missing");
                }
            } as never
        });
        expect(missing).toEqual({ ok: false, error: "Fragment not found: missing" });
    });
});

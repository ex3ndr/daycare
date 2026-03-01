import { describe, expect, it, vi } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import { profileUpdate } from "./profileUpdate.js";

describe("profileUpdate", () => {
    it("updates valid fields and returns updated profile", async () => {
        const ctx = contextForUser({ userId: "user-1" });
        const state = {
            firstName: "Ada",
            lastName: null,
            bio: null,
            about: null,
            country: null,
            timezone: null,
            systemPrompt: null,
            memory: false,
            nametag: "ada"
        };
        const users = {
            findById: vi.fn(async () => ({ ...state })),
            update: vi.fn(async (_id: string, patch: Record<string, unknown>) => {
                Object.assign(state, patch);
            })
        };

        const result = await profileUpdate({
            ctx,
            users,
            body: {
                firstName: "Grace",
                memory: true
            }
        });

        expect(result).toEqual({
            ok: true,
            profile: {
                firstName: "Grace",
                lastName: null,
                bio: null,
                about: null,
                country: null,
                timezone: null,
                systemPrompt: null,
                memory: true,
                nametag: "ada"
            }
        });
        expect(users.update).toHaveBeenCalledWith(
            "user-1",
            expect.objectContaining({ firstName: "Grace", memory: true, updatedAt: expect.any(Number) })
        );
    });

    it("supports partial update with null text values", async () => {
        const ctx = contextForUser({ userId: "user-1" });
        const state = {
            firstName: "Ada",
            lastName: "Lovelace",
            bio: "bio",
            about: "about",
            country: "UK",
            timezone: "Europe/London",
            systemPrompt: "prompt",
            memory: true,
            nametag: "ada"
        };
        const users = {
            findById: vi.fn(async () => ({ ...state })),
            update: vi.fn(async (_id: string, patch: Record<string, unknown>) => {
                Object.assign(state, patch);
            })
        };

        const result = await profileUpdate({
            ctx,
            users,
            body: {
                bio: null,
                timezone: "UTC"
            }
        });

        expect(result).toEqual({
            ok: true,
            profile: {
                firstName: "Ada",
                lastName: "Lovelace",
                bio: null,
                about: "about",
                country: "UK",
                timezone: "UTC",
                systemPrompt: "prompt",
                memory: true,
                nametag: "ada"
            }
        });
    });

    it("rejects invalid field types", async () => {
        const ctx = contextForUser({ userId: "user-1" });
        const users = {
            findById: vi.fn(async () => null),
            update: vi.fn(async () => undefined)
        };

        await expect(
            profileUpdate({
                ctx,
                users,
                body: { firstName: 42 }
            })
        ).resolves.toEqual({ ok: false, error: "firstName must be a string or null." });

        await expect(
            profileUpdate({
                ctx,
                users,
                body: { memory: "yes" }
            })
        ).resolves.toEqual({ ok: false, error: "memory must be a boolean." });
    });

    it("returns error when user update fails", async () => {
        const ctx = contextForUser({ userId: "user-1" });
        const users = {
            findById: vi.fn(async () => null),
            update: vi.fn(async () => {
                throw new Error("User not found.");
            })
        };

        const result = await profileUpdate({
            ctx,
            users,
            body: { firstName: "Ada" }
        });

        expect(result).toEqual({ ok: false, error: "User not found." });
    });
});

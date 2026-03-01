import { describe, expect, it, vi } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import { profileRead } from "./profileRead.js";

describe("profileRead", () => {
    it("returns profile when user exists", async () => {
        const ctx = contextForUser({ userId: "user-1" });
        const users = {
            findById: vi.fn(async () => ({
                id: "user-1",
                firstName: "Ada",
                lastName: "Lovelace",
                bio: "bio",
                about: "about",
                country: "UK",
                timezone: "Europe/London",
                systemPrompt: "prompt",
                memory: true,
                nametag: "ada",
                connectorKeys: []
            }))
        };

        const result = await profileRead({ ctx, users });

        expect(result).toEqual({
            ok: true,
            profile: {
                firstName: "Ada",
                lastName: "Lovelace",
                bio: "bio",
                about: "about",
                country: "UK",
                timezone: "Europe/London",
                systemPrompt: "prompt",
                memory: true,
                nametag: "ada"
            }
        });
    });

    it("returns error when user is missing", async () => {
        const ctx = contextForUser({ userId: "user-1" });
        const users = {
            findById: vi.fn(async () => null)
        };

        const result = await profileRead({ ctx, users });

        expect(result).toEqual({ ok: false, error: "User not found." });
    });
});

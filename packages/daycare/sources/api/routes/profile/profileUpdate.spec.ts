import { describe, expect, it, vi } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import { USER_CONFIGURATION_SYNC_EVENT } from "../../../engine/users/userConfigurationSyncEventBuild.js";
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
            configuration: {
                homeReady: false,
                appReady: false,
                bootstrapStarted: false
            },
            nametag: "ada",
            connectorKeys: []
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
                configuration: {
                    homeReady: false,
                    appReady: false,
                    bootstrapStarted: false
                },
                nametag: "ada",
                emails: []
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
            configuration: {
                homeReady: false,
                appReady: true,
                bootstrapStarted: false
            },
            nametag: "ada",
            connectorKeys: []
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
                configuration: {
                    homeReady: false,
                    appReady: true,
                    bootstrapStarted: false
                },
                nametag: "ada",
                emails: []
            }
        });
    });

    it("merges configuration updates and emits sync event", async () => {
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
            configuration: {
                homeReady: false,
                appReady: true,
                bootstrapStarted: false
            },
            nametag: "ada",
            connectorKeys: []
        };
        const users = {
            findById: vi.fn(async () => ({ ...state })),
            update: vi.fn(async (_id: string, patch: Record<string, unknown>) => {
                Object.assign(state, patch);
            })
        };
        const eventBus = {
            emit: vi.fn()
        };

        const result = await profileUpdate({
            ctx,
            users,
            eventBus,
            body: {
                configuration: {
                    homeReady: true
                }
            }
        });

        expect(result).toEqual({
            ok: true,
            profile: {
                firstName: "Ada",
                lastName: null,
                bio: null,
                about: null,
                country: null,
                timezone: null,
                systemPrompt: null,
                memory: false,
                configuration: {
                    homeReady: true,
                    appReady: true,
                    bootstrapStarted: false
                },
                nametag: "ada",
                emails: []
            }
        });
        expect(users.update).toHaveBeenCalledWith(
            "user-1",
            expect.objectContaining({
                configuration: {
                    homeReady: true,
                    appReady: true,
                    bootstrapStarted: false
                }
            })
        );
        expect(eventBus.emit).toHaveBeenCalledWith(
            USER_CONFIGURATION_SYNC_EVENT,
            {
                configuration: {
                    homeReady: true,
                    appReady: true,
                    bootstrapStarted: false
                }
            },
            "user-1"
        );
    });

    it("rejects invalid field types", async () => {
        const ctx = contextForUser({ userId: "user-1" });
        const users = {
            findById: vi.fn(async () => ({
                firstName: null,
                lastName: null,
                bio: null,
                about: null,
                country: null,
                timezone: null,
                systemPrompt: null,
                memory: false,
                configuration: {
                    homeReady: false,
                    appReady: false,
                    bootstrapStarted: false
                },
                nametag: "ada",
                connectorKeys: []
            })),
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

        await expect(
            profileUpdate({
                ctx,
                users,
                body: { configuration: "yes" }
            })
        ).resolves.toEqual({ ok: false, error: "configuration must be an object." });

        await expect(
            profileUpdate({
                ctx,
                users,
                body: { configuration: { homeReady: "yes" } }
            })
        ).resolves.toEqual({ ok: false, error: "configuration.homeReady must be a boolean." });

        await expect(
            profileUpdate({
                ctx,
                users,
                body: { configuration: { extra: true } }
            })
        ).resolves.toEqual({ ok: false, error: "configuration.extra is not supported." });
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

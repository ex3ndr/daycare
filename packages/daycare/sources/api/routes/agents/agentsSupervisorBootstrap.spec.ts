import { describe, expect, it, vi } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import { USER_CONFIGURATION_SYNC_EVENT } from "../../../engine/users/userConfigurationSyncEventBuild.js";
import { agentsSupervisorBootstrap } from "./agentsSupervisorBootstrap.js";

describe("agentsSupervisorBootstrap", () => {
    it("resolves the supervisor and posts a wrapped bootstrap message", async () => {
        const ctx = contextForUser({ userId: "u1" });
        const agentSupervisorResolve = vi.fn(async () => "supervisor-1");
        const agentPost = vi.fn(async () => undefined);
        const users = {
            findById: vi.fn(async () => ({
                configuration: { homeReady: false, appReady: false, bootstrapStarted: false }
            })),
            update: vi.fn(async () => undefined)
        };
        const eventBus = {
            emit: vi.fn()
        };

        const result = await agentsSupervisorBootstrap({
            ctx,
            body: { text: "  Start the release work.  " },
            agentSupervisorResolve,
            agentPost,
            users,
            eventBus
        });

        expect(result).toEqual({ ok: true, agentId: "supervisor-1" });
        expect(agentSupervisorResolve).toHaveBeenCalledWith(ctx);
        expect(agentPost).toHaveBeenCalledWith(
            ctx,
            { agentId: "supervisor-1" },
            {
                type: "message",
                message: {
                    text: expect.stringContaining("<bootstrap_request>\nStart the release work.\n</bootstrap_request>"),
                    files: []
                },
                context: {}
            }
        );
        expect(users.update).toHaveBeenCalledWith("u1", {
            configuration: { homeReady: false, appReady: false, bootstrapStarted: true },
            updatedAt: expect.any(Number)
        });
        expect(eventBus.emit).toHaveBeenCalledWith(
            USER_CONFIGURATION_SYNC_EVENT,
            {
                configuration: { homeReady: false, appReady: false, bootstrapStarted: true }
            },
            "u1"
        );
    });

    it("rejects empty text", async () => {
        const result = await agentsSupervisorBootstrap({
            ctx: contextForUser({ userId: "u1" }),
            body: { text: "   " },
            agentSupervisorResolve: async () => "supervisor-1",
            agentPost: async () => undefined,
            users: {
                findById: async () => null,
                update: async () => undefined
            }
        });

        expect(result).toEqual({ ok: false, error: "text is required." });
    });

    it("does not rewrite configuration when bootstrap is already started", async () => {
        const ctx = contextForUser({ userId: "u1" });
        const users = {
            findById: vi.fn(async () => ({
                configuration: { homeReady: false, appReady: false, bootstrapStarted: true }
            })),
            update: vi.fn(async () => undefined)
        };
        const eventBus = {
            emit: vi.fn()
        };

        const result = await agentsSupervisorBootstrap({
            ctx,
            body: { text: "Start the release work." },
            agentSupervisorResolve: async () => "supervisor-1",
            agentPost: async () => undefined,
            users,
            eventBus
        });

        expect(result).toEqual({ ok: true, agentId: "supervisor-1" });
        expect(users.update).not.toHaveBeenCalled();
        expect(eventBus.emit).not.toHaveBeenCalled();
    });
});

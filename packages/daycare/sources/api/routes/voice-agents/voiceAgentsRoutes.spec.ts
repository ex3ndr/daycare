import { describe, expect, it, vi } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import { VoiceAgentRegistry } from "../../../engine/modules/voiceAgentRegistry.js";
import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { voiceAgentsRouteHandle } from "./voiceAgentsRoutes.js";

describe("voiceAgentsRouteHandle", () => {
    it("handles CRUD and session start", async () => {
        const storage = await storageOpenTest();
        await storage.users.create({
            id: "user-1",
            createdAt: 1,
            updatedAt: 1,
            nametag: "user-1"
        });
        const ctx = contextForUser({ userId: "user-1" });
        const registry = new VoiceAgentRegistry();
        const startSession = vi.fn(async () => ({
            agentId: "agent-123",
            overrides: {
                agent: {
                    prompt: {
                        prompt: "Speak clearly"
                    }
                }
            }
        }));
        registry.register("plugin-elevenlabs", {
            id: "elevenlabs",
            label: "ElevenLabs",
            startSession
        });

        const created = await routeInvoke({
            ctx,
            pathname: "/voice-agents/create",
            method: "POST",
            body: {
                id: "voice-1",
                name: "Concierge",
                description: "Front desk",
                systemPrompt: "Help callers.",
                settings: {
                    providerId: "elevenlabs"
                }
            },
            voiceAgents: storage.voiceAgents,
            voiceRegistry: registry
        });
        expect(created.statusCode).toBe(200);
        expect(created.payload).toEqual(
            expect.objectContaining({
                ok: true,
                voiceAgent: expect.objectContaining({
                    id: "voice-1",
                    name: "Concierge"
                })
            })
        );

        const listed = await routeInvoke({
            ctx,
            pathname: "/voice-agents",
            method: "GET",
            voiceAgents: storage.voiceAgents,
            voiceRegistry: registry
        });
        expect(listed.payload).toEqual({
            ok: true,
            voiceAgents: [expect.objectContaining({ id: "voice-1" })]
        });

        const read = await routeInvoke({
            ctx,
            pathname: "/voice-agents/voice-1",
            method: "GET",
            voiceAgents: storage.voiceAgents,
            voiceRegistry: registry
        });
        expect(read.payload).toEqual({
            ok: true,
            voiceAgent: expect.objectContaining({ id: "voice-1", description: "Front desk" })
        });

        const updated = await routeInvoke({
            ctx,
            pathname: "/voice-agents/voice-1/update",
            method: "POST",
            body: {
                name: "Desk",
                tools: [
                    {
                        name: "lookup_order",
                        description: "Lookup order",
                        parameters: {
                            orderId: {
                                type: "string",
                                description: "Order ID",
                                required: true
                            }
                        }
                    }
                ]
            },
            voiceAgents: storage.voiceAgents,
            voiceRegistry: registry
        });
        expect(updated.payload).toEqual({
            ok: true,
            voiceAgent: expect.objectContaining({
                id: "voice-1",
                name: "Desk",
                tools: [
                    {
                        name: "lookup_order",
                        description: "Lookup order",
                        parameters: {
                            orderId: {
                                type: "string",
                                description: "Order ID",
                                required: true
                            }
                        }
                    }
                ]
            })
        });

        const session = await routeInvoke({
            ctx,
            pathname: "/voice-agents/voice-1/session/start",
            method: "POST",
            body: {},
            voiceAgents: storage.voiceAgents,
            voiceRegistry: registry
        });
        expect(session.payload).toEqual({
            ok: true,
            providerId: "elevenlabs",
            voiceAgent: expect.objectContaining({ id: "voice-1" }),
            session: {
                agentId: "agent-123",
                overrides: {
                    agent: {
                        prompt: {
                            prompt: "Speak clearly"
                        }
                    }
                }
            }
        });
        expect(startSession).toHaveBeenCalledWith(
            expect.objectContaining({
                voiceAgentId: "voice-1"
            }),
            expect.objectContaining({
                ctx
            })
        );

        const deleted = await routeInvoke({
            ctx,
            pathname: "/voice-agents/voice-1/delete",
            method: "POST",
            voiceAgents: storage.voiceAgents,
            voiceRegistry: registry
        });
        expect(deleted.payload).toEqual({
            ok: true,
            voiceAgent: expect.objectContaining({ id: "voice-1" })
        });
    });

    it("returns 503 when repositories are unavailable", async () => {
        const result = await routeInvoke({
            ctx: contextForUser({ userId: "user-1" }),
            pathname: "/voice-agents",
            method: "GET",
            voiceAgents: null,
            voiceRegistry: null
        });
        expect(result.payload).toEqual({ ok: false, error: "Voice agents unavailable." });
    });
});

async function routeInvoke(input: {
    ctx: ReturnType<typeof contextForUser>;
    pathname: string;
    method: string;
    body?: Record<string, unknown>;
    voiceAgents: unknown;
    voiceRegistry: VoiceAgentRegistry | null;
}) {
    let statusCode = -1;
    let payload: Record<string, unknown> | null = null;
    const handled = await voiceAgentsRouteHandle({ method: input.method } as never, {} as never, input.pathname, {
        ctx: input.ctx,
        sendJson: (_response, nextStatusCode, nextPayload) => {
            statusCode = nextStatusCode;
            payload = nextPayload;
        },
        readJsonBody: async () => input.body ?? {},
        voiceAgents: input.voiceAgents as never,
        voiceRegistry: input.voiceRegistry
    });

    return {
        handled,
        statusCode,
        payload
    };
}

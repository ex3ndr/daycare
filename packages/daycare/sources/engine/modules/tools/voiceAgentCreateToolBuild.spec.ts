import { describe, expect, it } from "vitest";
import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { contextForUser } from "../../agents/context.js";
import { voiceAgentCreateToolBuild } from "./voiceAgentCreateToolBuild.js";

describe("voiceAgentCreateToolBuild", () => {
    it("creates a voice agent in storage", async () => {
        const storage = await storageOpenTest();
        await storage.users.create({
            id: "user-1",
            createdAt: 1,
            updatedAt: 1,
            nametag: "user-1"
        });
        const tool = voiceAgentCreateToolBuild();
        const ctx = contextForUser({ userId: "user-1" });

        const result = await tool.execute?.(
            {
                name: "Reception",
                description: "Greets callers",
                systemPrompt: "Be warm and concise.",
                tools: [
                    {
                        name: "lookup_order",
                        description: "Lookup an order",
                        parameters: {
                            orderId: {
                                type: "string",
                                description: "Order ID",
                                required: true
                            }
                        }
                    }
                ],
                settings: {
                    providerId: "elevenlabs"
                }
            },
            {
                ctx,
                agentSystem: {
                    storage
                }
            } as never,
            {
                id: "call-1",
                name: "voice_agent_create"
            } as never
        );

        expect(result?.typedResult).toEqual(
            expect.objectContaining({
                name: "Reception"
            })
        );

        const stored = await storage.voiceAgents.findMany(ctx);
        expect(stored).toHaveLength(1);
        expect(stored[0]).toEqual(
            expect.objectContaining({
                name: "Reception",
                settings: {
                    providerId: "elevenlabs"
                }
            })
        );
    });
});

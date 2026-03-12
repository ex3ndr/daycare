import { describe, expect, it } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import { agentsChats } from "./agentsChats.js";

describe("agentsChats", () => {
    it("returns only app chats for current user", async () => {
        const ctx = contextForUser({ userId: "u1" });

        const result = await agentsChats({
            ctx,
            agentList: async () => [
                {
                    agentId: "app-1",
                    path: "/u1/app/app-1",
                    kind: "app",
                    name: "Project Chat",
                    description: "Main",
                    connector: null,
                    foreground: false,
                    lifecycle: "active",
                    createdAt: 10,
                    updatedAt: 20,
                    userId: "u1"
                },
                {
                    agentId: "agent-1",
                    path: "/u1/agent/main",
                    kind: "agent",
                    name: "main",
                    description: null,
                    connector: null,
                    foreground: false,
                    lifecycle: "active",
                    createdAt: 15,
                    updatedAt: 25,
                    userId: "u1"
                },
                {
                    agentId: "app-2",
                    path: "/u2/app/app-2",
                    kind: "app",
                    name: "Other User",
                    description: null,
                    connector: null,
                    foreground: false,
                    lifecycle: "active",
                    createdAt: 30,
                    updatedAt: 40,
                    userId: "u2"
                }
            ]
        });

        expect(result).toEqual({
            ok: true,
            chats: [
                {
                    agentId: "app-1",
                    name: "Project Chat",
                    description: "Main",
                    lifecycle: "active",
                    createdAt: 10,
                    updatedAt: 20
                }
            ]
        });
    });

    it("sorts chats by updatedAt descending", async () => {
        const ctx = contextForUser({ userId: "u1" });

        const result = await agentsChats({
            ctx,
            agentList: async () => [
                {
                    agentId: "app-older",
                    path: "/u1/app/older",
                    kind: "app",
                    name: "Older",
                    description: null,
                    connector: null,
                    foreground: false,
                    lifecycle: "sleeping",
                    createdAt: 1,
                    updatedAt: 10
                },
                {
                    agentId: "app-newer",
                    path: "/u1/app/newer",
                    kind: "app",
                    name: "Newer",
                    description: null,
                    connector: null,
                    foreground: false,
                    lifecycle: "active",
                    createdAt: 2,
                    updatedAt: 20
                }
            ]
        });

        expect(result.chats.map((chat) => chat.agentId)).toEqual(["app-newer", "app-older"]);
    });
});

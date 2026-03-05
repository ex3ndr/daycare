import { describe, expect, it } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import type { Secret } from "../../../engine/secrets/secretTypes.js";
import type { SecretsRuntime } from "../secrets/secretsTypes.js";
import { swarmsSecretsList } from "./swarmsSecretsList.js";

describe("swarmsSecretsList", () => {
    it("lists secrets for a caller-owned swarm", async () => {
        const store = new Map<string, Secret[]>();
        store.set("swarm-1", [
            {
                name: "openai-key",
                displayName: "OpenAI",
                description: "desc",
                variables: { OPENAI_API_KEY: "sk" }
            }
        ]);

        const result = await swarmsSecretsList({
            ctx: contextForUser({ userId: "owner-1" }),
            nametag: "reviewer",
            users: usersBuild(),
            secrets: secretsRuntimeBuild(store)
        });

        expect(result).toEqual({
            ok: true,
            secrets: [
                {
                    name: "openai-key",
                    displayName: "OpenAI",
                    description: "desc",
                    variableNames: ["OPENAI_API_KEY"],
                    variableCount: 1
                }
            ]
        });
    });

    it("returns error when caller is not owner", async () => {
        const result = await swarmsSecretsList({
            ctx: contextForUser({ userId: "user-1" }),
            nametag: "reviewer",
            users: usersBuild(),
            secrets: secretsRuntimeBuild(new Map())
        });

        expect(result).toEqual({
            ok: false,
            error: "Only the owner user can manage swarm secrets."
        });
    });
});

function usersBuild(): {
    findById: (id: string) => Promise<{ id: string; isOwner: boolean } | null>;
    findByNametag: (nametag: string) => Promise<{ id: string; isSwarm: boolean; parentUserId: string } | null>;
} {
    return {
        findById: async (id) => (id === "owner-1" ? { id: "owner-1", isOwner: true } : { id, isOwner: false }),
        findByNametag: async (nametag) =>
            nametag === "reviewer" ? { id: "swarm-1", isSwarm: true, parentUserId: "owner-1" } : null
    };
}

function secretsRuntimeBuild(store: Map<string, Secret[]>): SecretsRuntime {
    return {
        list: async (ctx) => store.get(ctx.userId) ?? [],
        add: async () => undefined,
        remove: async () => false
    };
}

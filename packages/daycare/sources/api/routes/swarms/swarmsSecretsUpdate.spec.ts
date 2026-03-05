import { describe, expect, it } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import type { Secret } from "../../../engine/secrets/secretTypes.js";
import type { SecretsRuntime } from "../secrets/secretsTypes.js";
import { swarmsSecretsUpdate } from "./swarmsSecretsUpdate.js";

describe("swarmsSecretsUpdate", () => {
    it("updates an existing secret in the swarm scope", async () => {
        const store = new Map<string, Secret[]>();
        store.set("swarm-1", [
            {
                name: "swarm-key",
                displayName: "Swarm Key",
                description: "old",
                variables: { API_KEY: "old" }
            }
        ]);

        const result = await swarmsSecretsUpdate({
            ctx: contextForUser({ userId: "owner-1" }),
            nametag: "reviewer",
            name: "swarm-key",
            body: {
                description: "new",
                variables: { API_KEY: "new" }
            },
            users: usersBuild(),
            secrets: secretsRuntimeBuild(store)
        });

        expect(result).toEqual({
            ok: true,
            secret: {
                name: "swarm-key",
                displayName: "Swarm Key",
                description: "new",
                variableNames: ["API_KEY"],
                variableCount: 1
            }
        });
        expect(store.get("swarm-1")?.[0]?.description).toBe("new");
    });

    it("returns not found when secret does not exist", async () => {
        const result = await swarmsSecretsUpdate({
            ctx: contextForUser({ userId: "owner-1" }),
            nametag: "reviewer",
            name: "missing",
            body: { description: "x" },
            users: usersBuild(),
            secrets: secretsRuntimeBuild(new Map())
        });

        expect(result).toEqual({
            ok: false,
            error: "Secret not found."
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
        add: async (ctx, secret) => {
            const next = [...(store.get(ctx.userId) ?? [])];
            const index = next.findIndex((entry) => entry.name === secret.name);
            if (index >= 0) {
                next[index] = secret;
            } else {
                next.push(secret);
            }
            store.set(ctx.userId, next);
        },
        remove: async () => false
    };
}

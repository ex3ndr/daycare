import { describe, expect, it } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import type { Secret } from "../../../engine/secrets/secretTypes.js";
import type { SecretsRuntime } from "../secrets/secretsTypes.js";
import { swarmsSecretsCreate } from "./swarmsSecretsCreate.js";

describe("swarmsSecretsCreate", () => {
    it("creates a secret in the target swarm scope", async () => {
        const store = new Map<string, Secret[]>();
        const result = await swarmsSecretsCreate({
            ctx: contextForUser({ userId: "owner-1" }),
            nametag: "reviewer",
            body: {
                name: "swarm-key",
                displayName: "Swarm Key",
                description: "desc",
                variables: { API_KEY: "secret" }
            },
            users: usersBuild(),
            secrets: secretsRuntimeBuild(store)
        });

        expect(result).toEqual({
            ok: true,
            secret: {
                name: "swarm-key",
                displayName: "Swarm Key",
                description: "desc",
                variableNames: ["API_KEY"],
                variableCount: 1
            }
        });
        expect(store.get("swarm-1")?.[0]?.name).toBe("swarm-key");
    });

    it("returns error when swarm nametag does not exist", async () => {
        const result = await swarmsSecretsCreate({
            ctx: contextForUser({ userId: "owner-1" }),
            nametag: "missing",
            body: {
                name: "swarm-key",
                variables: { API_KEY: "secret" }
            },
            users: usersBuild(),
            secrets: secretsRuntimeBuild(new Map())
        });

        expect(result).toEqual({
            ok: false,
            error: "Swarm not found."
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

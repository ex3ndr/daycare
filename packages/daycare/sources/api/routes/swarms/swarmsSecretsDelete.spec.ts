import { describe, expect, it } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import type { Secret } from "../../../engine/secrets/secretTypes.js";
import type { SecretsRuntime } from "../secrets/secretsTypes.js";
import { swarmsSecretsDelete } from "./swarmsSecretsDelete.js";

describe("swarmsSecretsDelete", () => {
    it("deletes a secret in swarm scope", async () => {
        const store = new Map<string, Secret[]>();
        store.set("swarm-1", [
            {
                name: "swarm-key",
                displayName: "Swarm Key",
                description: "desc",
                variables: { API_KEY: "secret" }
            }
        ]);

        const result = await swarmsSecretsDelete({
            ctx: contextForUser({ userId: "owner-1" }),
            nametag: "reviewer",
            name: "swarm-key",
            users: usersBuild(),
            secrets: secretsRuntimeBuild(store)
        });

        expect(result).toEqual({ ok: true, deleted: true });
        expect(store.get("swarm-1")).toEqual([]);
    });

    it("returns not found when secret is missing", async () => {
        const result = await swarmsSecretsDelete({
            ctx: contextForUser({ userId: "owner-1" }),
            nametag: "reviewer",
            name: "missing",
            users: usersBuild(),
            secrets: secretsRuntimeBuild(new Map())
        });

        expect(result).toEqual({ ok: false, error: "Secret not found." });
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
        remove: async (ctx, name) => {
            const current = [...(store.get(ctx.userId) ?? [])];
            const next = current.filter((entry) => entry.name !== name);
            store.set(ctx.userId, next);
            return next.length !== current.length;
        }
    };
}

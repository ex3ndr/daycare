import { describe, expect, it } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import type { Secret } from "../../../engine/secrets/secretTypes.js";
import type { SecretsRuntime } from "../secrets/secretsTypes.js";
import { workspacesSecretsCopy } from "./workspacesSecretsCopy.js";

describe("workspacesSecretsCopy", () => {
    it("copies owner secrets to workspace secrets", async () => {
        const store = new Map<string, Secret[]>();
        store.set("owner-1", [
            {
                name: "openai-key",
                displayName: "OpenAI",
                description: "desc",
                variables: { OPENAI_API_KEY: "sk" }
            }
        ]);

        const result = await workspacesSecretsCopy({
            ctx: contextForUser({ userId: "owner-1" }),
            nametag: "reviewer",
            body: { secret: "openai-key" },
            users: usersBuild(),
            secrets: secretsRuntimeBuild(store)
        });

        expect(result).toEqual({
            ok: true,
            workspaceUserId: "workspace-1",
            secret: "openai-key"
        });
        expect(store.get("workspace-1")).toEqual([
            {
                name: "openai-key",
                displayName: "OpenAI",
                description: "desc",
                variables: { OPENAI_API_KEY: "sk" }
            }
        ]);
    });

    it("returns error when owner secret is missing", async () => {
        const result = await workspacesSecretsCopy({
            ctx: contextForUser({ userId: "owner-1" }),
            nametag: "reviewer",
            body: { secret: "missing" },
            users: usersBuild(),
            secrets: secretsRuntimeBuild(new Map([["owner-1", []]]))
        });

        expect(result).toEqual({
            ok: false,
            error: 'Secret not found: "missing".'
        });
    });
});

function usersBuild(): {
    findById: (id: string) => Promise<{ id: string; isOwner: boolean } | null>;
    findByNametag: (nametag: string) => Promise<{ id: string; isWorkspace: boolean; parentUserId: string } | null>;
} {
    return {
        findById: async (id) => (id === "owner-1" ? { id: "owner-1", isOwner: true } : { id, isOwner: false }),
        findByNametag: async (nametag) =>
            nametag === "reviewer" ? { id: "workspace-1", isWorkspace: true, parentUserId: "owner-1" } : null
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

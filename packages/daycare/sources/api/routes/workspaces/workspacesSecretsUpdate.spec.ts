import { describe, expect, it } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import type { Secret } from "../../../engine/secrets/secretTypes.js";
import type { SecretsRuntime } from "../secrets/secretsTypes.js";
import { workspacesSecretsUpdate } from "./workspacesSecretsUpdate.js";

describe("workspacesSecretsUpdate", () => {
    it("updates an existing secret in the workspace scope", async () => {
        const store = new Map<string, Secret[]>();
        store.set("workspace-1", [
            {
                name: "workspace-key",
                displayName: "Workspace Key",
                description: "old",
                variables: { API_KEY: "old" }
            }
        ]);

        const result = await workspacesSecretsUpdate({
            ctx: contextForUser({ userId: "owner-1" }),
            nametag: "reviewer",
            name: "workspace-key",
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
                name: "workspace-key",
                displayName: "Workspace Key",
                description: "new",
                variableNames: ["API_KEY"],
                variableCount: 1
            }
        });
        expect(store.get("workspace-1")?.[0]?.description).toBe("new");
    });

    it("returns not found when secret does not exist", async () => {
        const result = await workspacesSecretsUpdate({
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
    findById: (id: string) => Promise<{ id: string } | null>;
    findByNametag: (nametag: string) => Promise<{ id: string; isWorkspace: boolean; workspaceOwnerId: string } | null>;
} {
    return {
        findById: async (id) => ({ id }),
        findByNametag: async (nametag) =>
            nametag === "reviewer" ? { id: "workspace-1", isWorkspace: true, workspaceOwnerId: "owner-1" } : null
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

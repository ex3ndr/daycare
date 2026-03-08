import { describe, expect, it } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import type { Secret } from "../../../engine/secrets/secretTypes.js";
import type { SecretsRuntime } from "../secrets/secretsTypes.js";
import { workspacesSecretsDelete } from "./workspacesSecretsDelete.js";

describe("workspacesSecretsDelete", () => {
    it("deletes a secret in workspace scope", async () => {
        const store = new Map<string, Secret[]>();
        store.set("workspace-1", [
            {
                name: "workspace-key",
                displayName: "Workspace Key",
                description: "desc",
                variables: { API_KEY: "secret" }
            }
        ]);

        const result = await workspacesSecretsDelete({
            ctx: contextForUser({ userId: "owner-1" }),
            nametag: "reviewer",
            name: "workspace-key",
            users: usersBuild(),
            secrets: secretsRuntimeBuild(store)
        });

        expect(result).toEqual({ ok: true, deleted: true });
        expect(store.get("workspace-1")).toEqual([]);
    });

    it("returns not found when secret is missing", async () => {
        const result = await workspacesSecretsDelete({
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
        add: async () => undefined,
        remove: async (ctx, name) => {
            const current = [...(store.get(ctx.userId) ?? [])];
            const next = current.filter((entry) => entry.name !== name);
            store.set(ctx.userId, next);
            return next.length !== current.length;
        }
    };
}

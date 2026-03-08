import { describe, expect, it } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import type { Secret } from "../../../engine/secrets/secretTypes.js";
import type { SecretsRuntime } from "../secrets/secretsTypes.js";
import { workspacesSecretsList } from "./workspacesSecretsList.js";

describe("workspacesSecretsList", () => {
    it("lists secrets for a caller-owned workspace", async () => {
        const store = new Map<string, Secret[]>();
        store.set("workspace-1", [
            {
                name: "openai-key",
                displayName: "OpenAI",
                description: "desc",
                variables: { OPENAI_API_KEY: "sk" }
            }
        ]);

        const result = await workspacesSecretsList({
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
        const result = await workspacesSecretsList({
            ctx: contextForUser({ userId: "user-1" }),
            nametag: "reviewer",
            users: usersBuild(),
            secrets: secretsRuntimeBuild(new Map())
        });

        expect(result).toEqual({
            ok: false,
            error: "Only workspace owners can manage workspace secrets."
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
        add: async () => undefined,
        remove: async () => false
    };
}

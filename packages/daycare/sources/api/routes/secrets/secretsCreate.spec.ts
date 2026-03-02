import { describe, expect, it } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import type { Secret } from "../../../engine/secrets/secretTypes.js";
import { secretsCreate } from "./secretsCreate.js";
import type { SecretsRuntime } from "./secretsTypes.js";

function secretsRuntimeBuild(store: Secret[]): SecretsRuntime {
    return {
        list: async () => store,
        add: async (_ctx, secret) => {
            const index = store.findIndex((item) => item.name === secret.name);
            if (index >= 0) {
                store[index] = secret;
                return;
            }
            store.push(secret);
        },
        remove: async () => false
    };
}

describe("secretsCreate", () => {
    it("creates a secret and never returns variable values", async () => {
        const ctx = contextForUser({ userId: "user-1" });
        const stored: Secret[] = [];
        const result = await secretsCreate({
            ctx,
            body: {
                name: "openai-key",
                displayName: "OpenAI",
                description: "API credentials",
                variables: {
                    OPENAI_API_KEY: "sk-secret",
                    ENABLED: true
                }
            },
            secrets: secretsRuntimeBuild(stored)
        });

        expect(result).toEqual({
            ok: true,
            secret: {
                name: "openai-key",
                displayName: "OpenAI",
                description: "API credentials",
                variableNames: ["ENABLED", "OPENAI_API_KEY"],
                variableCount: 2
            }
        });
        expect(JSON.stringify(result)).not.toContain("sk-secret");
        expect(stored).toHaveLength(1);
        expect(stored[0]?.variables).toEqual({
            OPENAI_API_KEY: "sk-secret",
            ENABLED: "true"
        });
    });

    it("rejects invalid variables payload", async () => {
        const ctx = contextForUser({ userId: "user-1" });
        const result = await secretsCreate({
            ctx,
            body: {
                name: "openai-key",
                variables: {
                    OPENAI_API_KEY: { value: "bad" }
                }
            },
            secrets: secretsRuntimeBuild([])
        });

        expect(result).toEqual({
            ok: false,
            error: "invalid value for variable OPENAI_API_KEY: expected string, number, or boolean."
        });
    });
});

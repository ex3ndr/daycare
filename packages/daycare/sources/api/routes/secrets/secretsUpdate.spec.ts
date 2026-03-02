import { describe, expect, it } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import type { Secret } from "../../../engine/secrets/secretTypes.js";
import type { SecretsRuntime } from "./secretsTypes.js";
import { secretsUpdate } from "./secretsUpdate.js";

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

describe("secretsUpdate", () => {
    it("updates an existing secret and keeps response metadata-only", async () => {
        const ctx = contextForUser({ userId: "user-1" });
        const stored: Secret[] = [
            {
                name: "openai-key",
                displayName: "OpenAI",
                description: "old",
                variables: {
                    OPENAI_API_KEY: "sk-old"
                }
            }
        ];

        const result = await secretsUpdate({
            ctx,
            name: "openai-key",
            body: {
                description: "new",
                variables: {
                    OPENAI_API_KEY: "sk-updated",
                    MODEL: "gpt-5"
                }
            },
            secrets: secretsRuntimeBuild(stored)
        });

        expect(result).toEqual({
            ok: true,
            secret: {
                name: "openai-key",
                displayName: "OpenAI",
                description: "new",
                variableNames: ["MODEL", "OPENAI_API_KEY"],
                variableCount: 2
            }
        });
        expect(JSON.stringify(result)).not.toContain("sk-updated");
        expect(stored[0]?.variables).toEqual({
            OPENAI_API_KEY: "sk-updated",
            MODEL: "gpt-5"
        });
    });

    it("returns not found when secret does not exist", async () => {
        const ctx = contextForUser({ userId: "user-1" });
        const result = await secretsUpdate({
            ctx,
            name: "missing",
            body: {
                description: "x"
            },
            secrets: secretsRuntimeBuild([])
        });

        expect(result).toEqual({
            ok: false,
            error: "Secret not found."
        });
    });
});

import type { Context } from "@/types";
import type { Secret } from "../../../engine/secrets/secretTypes.js";
import { secretsPublicSummaryBuild } from "./secretsPublicSummaryBuild.js";
import type { SecretPublicSummary, SecretsRuntime } from "./secretsTypes.js";
import { secretsVariablesParse } from "./secretsVariablesParse.js";

export type SecretsUpdateInput = {
    ctx: Context;
    name: string;
    body: Record<string, unknown>;
    secrets: SecretsRuntime;
};

export type SecretsUpdateResult =
    | {
          ok: true;
          secret: SecretPublicSummary;
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Updates an existing secret by route name.
 * Expects: secret exists and body includes at least one mutable field.
 */
export async function secretsUpdate(input: SecretsUpdateInput): Promise<SecretsUpdateResult> {
    const normalizedName = input.name.trim();
    if (!normalizedName) {
        return { ok: false, error: "name is required." };
    }

    if (input.body.name !== undefined) {
        if (typeof input.body.name !== "string") {
            return { ok: false, error: "name in body must be a string." };
        }
        const bodyName = input.body.name.trim();
        if (!bodyName) {
            return { ok: false, error: "name in body must be a non-empty string." };
        }
        if (bodyName !== normalizedName) {
            return { ok: false, error: "name in body must match route name." };
        }
    }

    const all = await input.secrets.list(input.ctx);
    const existing = all.find((secret) => secret.name === normalizedName);
    if (!existing) {
        return { ok: false, error: "Secret not found." };
    }

    const updates: {
        displayName?: string;
        description?: string;
        variables?: Record<string, string>;
    } = {};

    if (input.body.displayName !== undefined) {
        if (typeof input.body.displayName !== "string") {
            return { ok: false, error: "displayName must be a string." };
        }
        const displayName = input.body.displayName.trim();
        if (!displayName) {
            return { ok: false, error: "displayName must be a non-empty string." };
        }
        updates.displayName = displayName;
    }

    if (input.body.description !== undefined) {
        if (typeof input.body.description !== "string") {
            return { ok: false, error: "description must be a string." };
        }
        updates.description = input.body.description;
    }

    if (input.body.variables !== undefined) {
        const parsedVariables = secretsVariablesParse(input.body.variables, { allowEmpty: true });
        if (!parsedVariables.ok) {
            return parsedVariables;
        }
        updates.variables = parsedVariables.variables;
    }

    if (updates.displayName === undefined && updates.description === undefined && updates.variables === undefined) {
        return {
            ok: false,
            error: "At least one of displayName, description, or variables is required."
        };
    }

    const updated: Secret = {
        name: existing.name,
        displayName: updates.displayName ?? existing.displayName,
        description: updates.description ?? existing.description,
        variables: updates.variables ?? existing.variables
    };

    try {
        await input.secrets.add(input.ctx, updated);
        return {
            ok: true,
            secret: secretsPublicSummaryBuild(updated)
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update secret.";
        return { ok: false, error: message };
    }
}

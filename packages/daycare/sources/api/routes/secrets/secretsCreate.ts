import type { Context } from "@/types";
import type { Secret } from "../../../engine/secrets/secretTypes.js";
import { secretsPublicSummaryBuild } from "./secretsPublicSummaryBuild.js";
import type { SecretPublicSummary, SecretsRuntime } from "./secretsTypes.js";
import { secretsVariablesParse } from "./secretsVariablesParse.js";

export type SecretsCreateInput = {
    ctx: Context;
    body: Record<string, unknown>;
    secrets: SecretsRuntime;
};

export type SecretsCreateResult =
    | {
          ok: true;
          secret: SecretPublicSummary;
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Creates a new secret or replaces an existing secret by name.
 * Expects: body includes a valid name and at least one variable.
 */
export async function secretsCreate(input: SecretsCreateInput): Promise<SecretsCreateResult> {
    const name = typeof input.body.name === "string" ? input.body.name.trim() : "";
    if (!name) {
        return { ok: false, error: "name is required." };
    }

    const displayNameValue = input.body.displayName;
    if (displayNameValue !== undefined && typeof displayNameValue !== "string") {
        return { ok: false, error: "displayName must be a string." };
    }
    const displayName = displayNameValue?.trim() ?? name;
    if (!displayName) {
        return { ok: false, error: "displayName must be a non-empty string." };
    }

    const descriptionValue = input.body.description;
    if (descriptionValue !== undefined && typeof descriptionValue !== "string") {
        return { ok: false, error: "description must be a string." };
    }
    const description = descriptionValue ?? "";

    const parsedVariables = secretsVariablesParse(input.body.variables, { allowEmpty: false });
    if (!parsedVariables.ok) {
        return parsedVariables;
    }

    const secret: Secret = {
        name,
        displayName,
        description,
        variables: parsedVariables.variables
    };

    try {
        await input.secrets.add(input.ctx, secret);
        return {
            ok: true,
            secret: secretsPublicSummaryBuild(secret)
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create secret.";
        return { ok: false, error: message };
    }
}

import type { Context } from "@/types";
import type { Secret } from "../../../engine/secrets/secretTypes.js";

export type SecretsRuntime = {
    list: (ctx: Context) => Promise<Secret[]>;
    add: (ctx: Context, secret: Secret) => Promise<void>;
    remove: (ctx: Context, name: string) => Promise<boolean>;
};

export type SecretPublicSummary = {
    name: string;
    displayName: string;
    description: string;
    variableNames: string[];
    variableCount: number;
};

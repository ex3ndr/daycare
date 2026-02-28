import type { Context } from "@/types";
import { secretLoad } from "./secretLoad.js";
import { secretSave } from "./secretSave.js";
import type { Secret } from "./secretTypes.js";
import { secretValidateName } from "./secretValidateName.js";

/**
 * Facade for user-scoped secret definitions persisted under `usersDir`.
 * Expects: all methods receive a user-scoped `ctx`.
 */
export class Secrets {
    private readonly usersDir: string;

    constructor(usersDir: string) {
        this.usersDir = usersDir;
    }

    async list(ctx: Context): Promise<Secret[]> {
        return secretLoad(this.usersDir, ctx);
    }

    async add(ctx: Context, secret: Secret): Promise<void> {
        const name = secret.name.trim();
        if (!secretValidateName(name)) {
            throw new Error(`Invalid secret name "${secret.name}". Secret names must use kebab-case.`);
        }

        const current = await this.list(ctx);
        const next: Secret = {
            name,
            displayName: secret.displayName,
            description: secret.description,
            variables: { ...secret.variables }
        };
        const existingIndex = current.findIndex((entry) => entry.name === name);
        if (existingIndex >= 0) {
            current[existingIndex] = next;
        } else {
            current.push(next);
        }

        await secretSave(this.usersDir, ctx, current);
    }

    async remove(ctx: Context, name: string): Promise<boolean> {
        const current = await this.list(ctx);
        const next = current.filter((entry) => entry.name !== name);
        if (next.length === current.length) {
            return false;
        }
        await secretSave(this.usersDir, ctx, next);
        return true;
    }

    async resolve(ctx: Context, names: string[]): Promise<Record<string, string>> {
        if (names.length === 0) {
            return {};
        }

        const all = await this.list(ctx);
        const byName = new Map(all.map((secret) => [secret.name, secret]));
        const resolved: Record<string, string> = {};
        for (const name of names) {
            const secret = byName.get(name);
            if (!secret) {
                throw new Error(`Unknown secret: "${name}".`);
            }
            Object.assign(resolved, secret.variables);
        }
        return resolved;
    }
}

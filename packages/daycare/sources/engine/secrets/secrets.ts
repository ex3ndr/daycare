import type { Context } from "@/types";
import type { ObservationLogRepository } from "../../storage/observationLogRepository.js";
import { TOPO_EVENT_TYPES, TOPO_SOURCE_SECRETS, topographyObservationEmit } from "../observations/topographyEvents.js";
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
    private readonly observationLog: ObservationLogRepository;

    constructor(options: { usersDir: string; observationLog: ObservationLogRepository }) {
        this.usersDir = options.usersDir;
        this.observationLog = options.observationLog;
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
        const variableNames = Object.keys(next.variables).sort((left, right) => left.localeCompare(right));
        await topographyObservationEmit(this.observationLog, {
            userId: ctx.userId,
            type: TOPO_EVENT_TYPES.SECRET_ADDED,
            source: TOPO_SOURCE_SECRETS,
            message: `Secret added: ${next.displayName}`,
            details: `Secret "${next.name}" added with variables: ${variableNames.join(", ")}`,
            data: {
                userId: ctx.userId,
                name: next.name,
                displayName: next.displayName,
                variableNames
            },
            scopeIds: [ctx.userId]
        });
    }

    async remove(ctx: Context, name: string): Promise<boolean> {
        const current = await this.list(ctx);
        const removedSecret = current.find((entry) => entry.name === name) ?? null;
        const next = current.filter((entry) => entry.name !== name);
        if (next.length === current.length) {
            return false;
        }
        await secretSave(this.usersDir, ctx, next);
        if (removedSecret) {
            await topographyObservationEmit(this.observationLog, {
                userId: ctx.userId,
                type: TOPO_EVENT_TYPES.SECRET_REMOVED,
                source: TOPO_SOURCE_SECRETS,
                message: `Secret removed: ${removedSecret.displayName}`,
                details: `Secret "${removedSecret.name}" removed`,
                data: {
                    userId: ctx.userId,
                    name: removedSecret.name,
                    displayName: removedSecret.displayName
                },
                scopeIds: [ctx.userId]
            });
        }
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

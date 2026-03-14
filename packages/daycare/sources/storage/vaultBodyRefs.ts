import type { Context } from "@/types";
import { type VaultPathFindRepo, vaultPathFind } from "./vaultPathFind.js";

export type VaultBodyRefsRepo = VaultPathFindRepo & {
    findById: (ctx: Context, id: string) => Promise<{ id: string } | null>;
};

/**
 * Extracts and resolves document references from markdown wiki links (`[[...]]`).
 * Expects: unresolved references are ignored and duplicates are returned once.
 */
export async function vaultBodyRefs(body: string, ctx: Context, repo: VaultBodyRefsRepo): Promise<string[]> {
    const resolved = new Set<string>();
    const pattern = /\[\[([^[\]]+)\]\]/g;

    while (true) {
        const match = pattern.exec(body);
        if (!match) {
            break;
        }

        const rawTarget = (match[1] ?? "").trim();
        if (!rawTarget) {
            continue;
        }

        const target = rawTarget.split("|")[0]?.trim() ?? "";
        if (!target) {
            continue;
        }

        let resolvedId: string | null = null;
        if (target.startsWith("vault://") || target.startsWith("doc://")) {
            resolvedId = await vaultPathFind(ctx, target, repo);
        } else {
            const byId = await repo.findById(ctx, target);
            if (byId) {
                resolvedId = byId.id;
            }
        }

        if (resolvedId) {
            resolved.add(resolvedId);
        }
    }

    return Array.from(resolved);
}

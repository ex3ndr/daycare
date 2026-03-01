import type { Context } from "@/types";
import { type DocumentPathFindRepo, documentPathFind } from "./documentPathFind.js";

export type DocumentBodyRefsRepo = DocumentPathFindRepo & {
    findById: (ctx: Context, id: string) => Promise<{ id: string } | null>;
};

/**
 * Extracts and resolves document references from markdown wiki links (`[[...]]`).
 * Expects: unresolved references are ignored and duplicates are returned once.
 */
export async function documentBodyRefs(body: string, ctx: Context, repo: DocumentBodyRefsRepo): Promise<string[]> {
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
        if (target.startsWith("~/")) {
            resolvedId = await documentPathFind(ctx, target, repo);
        } else if (target.includes("/")) {
            resolvedId = await documentPathFind(ctx, `~/${target}`, repo);
        } else {
            const byId = await repo.findById(ctx, target);
            if (byId) {
                resolvedId = byId.id;
            } else {
                resolvedId = await documentPathFind(ctx, `~/${target}`, repo);
            }
        }

        if (resolvedId) {
            resolved.add(resolvedId);
        }
    }

    return Array.from(resolved);
}

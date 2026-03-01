import { createId } from "@paralleldrive/cuid2";
import type { Context } from "@/types";
import type { Storage } from "../../storage/storage.js";
import { agentPromptBundledRead } from "../agents/ops/agentPromptBundledRead.js";

const MEMORY_ROOT_SLUG = "memory";

/**
 * Ensures the root `~/memory` document exists for the provided user context.
 * Expects: storage migrations are applied and ctx.userId is valid.
 */
export async function memoryRootDocumentEnsure(
    ctx: Context,
    storage: Storage
): Promise<{ id: string; created: boolean }> {
    const existing = await storage.documents.findBySlugAndParent(ctx, MEMORY_ROOT_SLUG, null);
    if (existing) {
        return { id: existing.id, created: false };
    }

    const now = Date.now();
    const body = await agentPromptBundledRead("memory/MEMORY_ROOT.md");
    try {
        const created = await storage.documents.create(ctx, {
            id: createId(),
            slug: MEMORY_ROOT_SLUG,
            title: "Memory",
            description: "Persistent structured memory root.",
            body,
            createdAt: now,
            updatedAt: now,
            parentId: null
        });
        return { id: created.id, created: true };
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        if (!detail.includes("slug is already used")) {
            throw error;
        }
        const raced = await storage.documents.findBySlugAndParent(ctx, MEMORY_ROOT_SLUG, null);
        if (!raced) {
            throw error;
        }
        return { id: raced.id, created: false };
    }
}

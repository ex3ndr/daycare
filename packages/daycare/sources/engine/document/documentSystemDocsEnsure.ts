import { createId } from "@paralleldrive/cuid2";
import type { Context } from "@/types";
import type { Storage } from "../../storage/storage.js";
import { agentPromptBundledRead } from "../agents/ops/agentPromptBundledRead.js";

const SYSTEM_ROOT_SLUG = "system";
const SYSTEM_ROOT_BODY = "# System\n\nVersioned system prompt documents for this user.\n";
const SYSTEM_DOCS = [
    {
        slug: "soul",
        title: "Soul",
        description: "Core behavioral prompt for the user.",
        bundledPrompt: "SOUL.md"
    },
    {
        slug: "user",
        title: "User",
        description: "User-specific guidance and preferences.",
        bundledPrompt: "USER.md"
    },
    {
        slug: "agents",
        title: "Agents",
        description: "Workspace operating guidance for agents.",
        bundledPrompt: "AGENTS.md"
    },
    {
        slug: "memory",
        title: "Memory",
        description: "Memory-agent guidance for organizing and compressing durable memory.",
        bundledPrompt: "MEMORY.md"
    },
    {
        slug: "tools",
        title: "Tools",
        description: "Operational notes about tool behavior.",
        bundledPrompt: "TOOLS.md"
    }
] as const;

/**
 * Ensures the root `doc://system` document and core child prompt documents exist.
 * Expects: storage migrations are applied and ctx.userId is valid.
 */
export async function documentSystemDocsEnsure(
    ctx: Context,
    storage: Pick<Storage, "documents">,
    options?: { soulBody?: string }
): Promise<{ id: string; created: boolean }> {
    const root = await documentEnsure(ctx, storage, {
        slug: SYSTEM_ROOT_SLUG,
        title: "System",
        description: "Root folder for versioned system prompt documents.",
        body: SYSTEM_ROOT_BODY,
        parentId: null
    });

    for (const doc of SYSTEM_DOCS) {
        const body =
            doc.slug === "soul" && options?.soulBody !== undefined
                ? options.soulBody
                : await agentPromptBundledRead(doc.bundledPrompt);
        await documentEnsure(ctx, storage, {
            slug: doc.slug,
            title: doc.title,
            description: doc.description,
            body,
            parentId: root.id
        });
    }

    return root;
}

async function documentEnsure(
    ctx: Context,
    storage: Pick<Storage, "documents">,
    input: {
        slug: string;
        title: string;
        description: string;
        body: string;
        parentId: string | null;
    }
): Promise<{ id: string; created: boolean }> {
    const existing = await storage.documents.findBySlugAndParent(ctx, input.slug, input.parentId);
    if (existing) {
        return { id: existing.id, created: false };
    }

    const now = Date.now();
    try {
        const created = await storage.documents.create(ctx, {
            id: createId(),
            slug: input.slug,
            title: input.title,
            description: input.description,
            body: input.body,
            createdAt: now,
            updatedAt: now,
            parentId: input.parentId
        });
        return { id: created.id, created: true };
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        if (!detail.includes("slug is already used")) {
            throw error;
        }
        const raced = await storage.documents.findBySlugAndParent(ctx, input.slug, input.parentId);
        if (!raced) {
            throw error;
        }
        return { id: raced.id, created: false };
    }
}

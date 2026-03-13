import matter from "gray-matter";
import type { Context } from "@/types";
import { documentChainResolve } from "../../storage/documentChainResolve.js";

const PEOPLE_ROOT_SLUG = "people";

type PeopleDocumentFrontmatterAssertOptions = {
    ctx: Context;
    documents: {
        findById: (
            ctx: Context,
            id: string
        ) => Promise<{
            id: string;
            slug: string;
            version?: number | null;
        } | null>;
        findParentId: (ctx: Context, id: string) => Promise<string | null>;
    };
    parentId: string | null;
    body: string;
};

/**
 * Validates YAML frontmatter for writes inside the `vault://people` tree.
 * Expects: slug/body represent the next persisted state for the target vault entry.
 */
export async function peopleDocumentFrontmatterAssert(options: PeopleDocumentFrontmatterAssertOptions): Promise<void> {
    if (!(await peopleDocumentInTreeIs(options.ctx, options.documents, options.parentId))) {
        return;
    }

    const parsed = matter(options.body);
    const firstName = frontmatterTextResolve(parsed.data, "firstName");
    if (!firstName) {
        throw new Error("People vault entries require YAML frontmatter with a non-empty `firstName` field.");
    }

    if ("lastName" in parsed.data) {
        const lastName = frontmatterTextResolve(parsed.data, "lastName");
        if (!lastName) {
            throw new Error("People vault entry `lastName` frontmatter must be a non-empty string when provided.");
        }
    }
}

async function peopleDocumentInTreeIs(
    ctx: Context,
    documents: PeopleDocumentFrontmatterAssertOptions["documents"],
    parentId: string | null
): Promise<boolean> {
    if (parentId === null) {
        return false;
    }

    const chain = await documentChainResolve(ctx, parentId, documents);
    if (!chain || chain.length === 0) {
        return false;
    }
    return chain[0]?.slug === PEOPLE_ROOT_SLUG;
}

function frontmatterTextResolve(data: unknown, field: string): string {
    if (!data || typeof data !== "object") {
        return "";
    }
    const value = (data as Record<string, unknown>)[field];
    if (typeof value !== "string") {
        return "";
    }
    return value.trim();
}

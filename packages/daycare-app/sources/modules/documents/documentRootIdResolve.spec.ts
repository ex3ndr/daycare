import { describe, expect, it } from "vitest";
import { documentRootIdResolve } from "./documentRootIdResolve";
import type { DocumentItem } from "./documentsTypes";

function doc(input: Partial<DocumentItem> & Pick<DocumentItem, "id" | "slug" | "title">): DocumentItem {
    return {
        id: input.id,
        slug: input.slug,
        title: input.title,
        description: input.description ?? "",
        body: input.body ?? "",
        parentId: input.parentId ?? null,
        createdAt: input.createdAt ?? 0,
        updatedAt: input.updatedAt ?? 0
    };
}

describe("documentRootIdResolve", () => {
    it("returns null when root is missing", () => {
        expect(documentRootIdResolve([])).toBeNull();
        expect(documentRootIdResolve([doc({ id: "a", slug: "memory", title: "Memory" })])).toBeNull();
    });

    it("returns the root vault id from the stored `document` slug", () => {
        const items = [
            doc({ id: "memory", slug: "memory", title: "Memory" }),
            doc({ id: "root-document", slug: "document", title: "Vault" }),
            doc({ id: "child", slug: "note", title: "Note", parentId: "root-document" })
        ];

        expect(documentRootIdResolve(items)).toBe("root-document");
    });
});

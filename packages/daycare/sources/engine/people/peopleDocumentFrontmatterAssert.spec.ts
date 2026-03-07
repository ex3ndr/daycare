import { describe, expect, it } from "vitest";
import { storageOpenTest } from "../../storage/storageOpenTest.js";
import { contextForUser } from "../agents/context.js";
import { peopleDocumentFrontmatterAssert } from "./peopleDocumentFrontmatterAssert.js";

describe("peopleDocumentFrontmatterAssert", () => {
    it("skips non-people documents", async () => {
        const storage = await storageOpenTest();
        try {
            const ctx = contextForUser({ userId: "user-1" });
            await expect(
                peopleDocumentFrontmatterAssert({
                    ctx,
                    documents: storage.documents,
                    parentId: null,
                    body: "no frontmatter needed"
                })
            ).resolves.toBeUndefined();
        } finally {
            storage.connection.close();
        }
    });

    it("requires firstName frontmatter for documents inside doc://people", async () => {
        const storage = await storageOpenTest();
        try {
            const ctx = contextForUser({ userId: "user-1" });
            await storage.documents.create(ctx, {
                id: "people",
                slug: "people",
                title: "People",
                description: "People root",
                body: "root",
                createdAt: 1,
                updatedAt: 1
            });

            await expect(
                peopleDocumentFrontmatterAssert({
                    ctx,
                    documents: storage.documents,
                    parentId: "people",
                    body: "# Ada"
                })
            ).rejects.toThrow("firstName");
        } finally {
            storage.connection.close();
        }
    });

    it("accepts valid people frontmatter and optional lastName", async () => {
        const storage = await storageOpenTest();
        try {
            const ctx = contextForUser({ userId: "user-1" });
            await storage.documents.create(ctx, {
                id: "people",
                slug: "people",
                title: "People",
                description: "People root",
                body: "root",
                createdAt: 1,
                updatedAt: 1
            });

            await expect(
                peopleDocumentFrontmatterAssert({
                    ctx,
                    documents: storage.documents,
                    parentId: "people",
                    body: "---\nfirstName: Ada\n---\nEngineer."
                })
            ).resolves.toBeUndefined();

            await expect(
                peopleDocumentFrontmatterAssert({
                    ctx,
                    documents: storage.documents,
                    parentId: "people",
                    body: "---\nfirstName: Grace\nlastName: Hopper\n---\nComputer scientist."
                })
            ).resolves.toBeUndefined();
        } finally {
            storage.connection.close();
        }
    });

    it("rejects empty lastName when provided", async () => {
        const storage = await storageOpenTest();
        try {
            const ctx = contextForUser({ userId: "user-1" });
            await storage.documents.create(ctx, {
                id: "people",
                slug: "people",
                title: "People",
                description: "People root",
                body: "root",
                createdAt: 1,
                updatedAt: 1
            });

            await expect(
                peopleDocumentFrontmatterAssert({
                    ctx,
                    documents: storage.documents,
                    parentId: "people",
                    body: '---\nfirstName: Ada\nlastName: ""\n---\nEngineer.'
                })
            ).rejects.toThrow("lastName");
        } finally {
            storage.connection.close();
        }
    });

    it("does not require person frontmatter for the doc://people root document", async () => {
        const storage = await storageOpenTest();
        try {
            const ctx = contextForUser({ userId: "user-1" });
            await expect(
                peopleDocumentFrontmatterAssert({
                    ctx,
                    documents: storage.documents,
                    parentId: null,
                    body: "root instructions"
                })
            ).resolves.toBeUndefined();
        } finally {
            storage.connection.close();
        }
    });
});

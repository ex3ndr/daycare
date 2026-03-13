import { describe, expect, it, vi } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import { documentsCreate } from "./documentsCreate.js";

describe("documentsCreate", () => {
    it("rejects creates without parentId", async () => {
        const repository = {
            create: vi.fn(),
            findById: vi.fn(),
            findParentId: vi.fn()
        };

        const response = await routeCall({
            repository,
            body: {
                id: "doc-1",
                slug: "child",
                title: "Child"
            }
        });

        expect(response.statusCode).toBe(400);
        expect(response.payload).toEqual({
            ok: false,
            error: "Fields id, slug, title, and parentId are required."
        });
        expect(repository.create).not.toHaveBeenCalled();
    });

    it("creates a vault entry when parentId is provided", async () => {
        const repository = {
            create: vi.fn(async () => ({
                id: "doc-1",
                slug: "child",
                title: "Child",
                description: "",
                body: "",
                createdAt: 10,
                updatedAt: 10
            })),
            findById: vi.fn(async () => ({
                id: "document-root",
                slug: "document",
                version: 1
            })),
            findParentId: vi.fn(async () => null)
        };

        const response = await routeCall({
            repository,
            body: {
                id: "doc-1",
                slug: "child",
                title: "Child",
                parentId: "document-root"
            }
        });

        expect(response.statusCode).toBe(200);
        expect(response.payload).toEqual({
            ok: true,
            item: {
                id: "doc-1",
                slug: "child",
                title: "Child",
                description: "",
                body: "",
                parentId: "document-root",
                createdAt: 10,
                updatedAt: 10
            }
        });
        expect(repository.create).toHaveBeenCalledWith(
            expect.objectContaining({ userId: "user-1" }),
            expect.objectContaining({
                id: "doc-1",
                slug: "child",
                title: "Child",
                parentId: "document-root"
            })
        );
    });
});

type RouteCallInput = {
    repository: unknown;
    body: Record<string, unknown>;
};

async function routeCall(input: RouteCallInput): Promise<{
    statusCode: number;
    payload: Record<string, unknown>;
}> {
    let statusCode = -1;
    let payload: Record<string, unknown> = {};

    await documentsCreate(
        {} as never,
        {} as never,
        {
            ctx: contextForUser({ userId: "user-1" }),
            documents: input.repository as never,
            readJsonBody: async () => input.body,
            sendJson: (_response: never, code: number, body: Record<string, unknown>) => {
                statusCode = code;
                payload = body;
            }
        } as never
    );

    return { statusCode, payload };
}

import { describe, expect, it } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { fragmentsRouteHandle } from "./fragmentsRoutes.js";

describe("fragmentsRouteHandle integration", () => {
    it("supports create, update, archive, listing, and archived direct reads", async () => {
        const storage = await storageOpenTest();
        try {
            const ctx = contextForUser({ userId: "user-1" });

            const created = await routeCall({
                pathname: "/fragments/create",
                method: "POST",
                body: {
                    id: "fragment-1",
                    kitVersion: "1",
                    title: "Profile Card",
                    description: "Shows profile summary",
                    spec: { type: "Column", children: [] }
                },
                ctx,
                fragments: storage.fragments
            });
            expect(created.handled).toBe(true);
            expect(created.statusCode).toBe(200);
            expect(created.payload.ok).toBe(true);

            const updated = await routeCall({
                pathname: "/fragments/fragment-1/update",
                method: "POST",
                body: {
                    title: "Profile Card V2",
                    spec: { type: "Column", children: [{ type: "Text", text: "hello" }] }
                },
                ctx,
                fragments: storage.fragments
            });
            expect(updated.statusCode).toBe(200);
            expect(updated.payload.ok).toBe(true);
            expect((updated.payload.fragment as { version: number }).version).toBe(2);

            const archived = await routeCall({
                pathname: "/fragments/fragment-1/archive",
                method: "POST",
                ctx,
                fragments: storage.fragments
            });
            expect(archived.statusCode).toBe(200);
            expect(archived.payload).toEqual({ ok: true });

            const list = await routeCall({
                pathname: "/fragments",
                method: "GET",
                ctx,
                fragments: storage.fragments
            });
            expect(list.statusCode).toBe(200);
            expect(list.payload).toEqual({ ok: true, fragments: [] });

            const byId = await routeCall({
                pathname: "/fragments/fragment-1",
                method: "GET",
                ctx,
                fragments: storage.fragments
            });
            expect(byId.statusCode).toBe(200);
            expect(byId.payload.ok).toBe(true);
            const fragment = byId.payload.fragment as {
                id: string;
                archived: boolean;
                version: number;
            };
            expect(fragment.id).toBe("fragment-1");
            expect(fragment.archived).toBe(true);
            expect(fragment.version).toBe(3);

            const versions = (await storage.connection
                .prepare("SELECT version, valid_to FROM fragments WHERE user_id = ? AND id = ? ORDER BY version ASC")
                .all(ctx.userId, "fragment-1")) as Array<{ version: number; valid_to: number | null }>;
            expect(versions).toEqual([
                { version: 1, valid_to: expect.any(Number) },
                { version: 2, valid_to: expect.any(Number) },
                { version: 3, valid_to: null }
            ]);
        } finally {
            storage.connection.close();
        }
    });
});

type RouteCallInput = {
    pathname: string;
    method: string;
    ctx: ReturnType<typeof contextForUser>;
    fragments: unknown;
    body?: Record<string, unknown>;
};

async function routeCall(input: RouteCallInput): Promise<{
    handled: boolean;
    statusCode: number;
    payload: Record<string, unknown>;
}> {
    let statusCode = -1;
    let payload: Record<string, unknown> = {};
    const handled = await fragmentsRouteHandle(
        {
            method: input.method
        } as never,
        {} as never,
        input.pathname,
        {
            ctx: input.ctx,
            fragments: input.fragments as never,
            readJsonBody: async () => input.body ?? {},
            sendJson: (_response, code, body) => {
                statusCode = code;
                payload = body;
            }
        }
    );
    return { handled, statusCode, payload };
}

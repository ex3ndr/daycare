import { describe, expect, it } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import { PsqlService } from "../../../services/psql/PsqlService.js";
import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { databasesRouteHandle } from "./databasesRoutes.js";

describe("databasesRouteHandle", () => {
    const usersDir = "/tmp/daycare-databases-routes-users";

    it("handles create/list/schema/data/query lifecycle", async () => {
        const storage = await storageOpenTest();
        try {
            const service = new PsqlService({
                usersDir,
                databases: storage.psqlDatabases,
                databaseMode: "memory"
            });
            const ctx = contextForUser({ userId: "user-1" });

            const create = await routeCall({
                pathname: "/databases/create",
                method: "POST",
                body: { name: "CRM" },
                ctx,
                psql: service
            });
            expect(create.handled).toBe(true);
            expect(create.statusCode).toBe(200);
            expect(create.payload.ok).toBe(true);
            const dbId = String((create.payload.database as { id: string }).id);

            const list = await routeCall({ pathname: "/databases", method: "GET", ctx, psql: service });
            expect(list.statusCode).toBe(200);
            expect(list.payload).toEqual({
                ok: true,
                databases: [
                    {
                        id: dbId,
                        userId: "user-1",
                        name: "CRM",
                        createdAt: expect.any(Number)
                    }
                ]
            });

            const applySchema = await routeCall({
                pathname: `/databases/${dbId}/schema`,
                method: "POST",
                body: {
                    table: "contacts",
                    comment: "Contact records",
                    fields: [{ name: "first_name", type: "text", comment: "Given name" }]
                },
                ctx,
                psql: service
            });
            expect(applySchema.statusCode).toBe(200);
            expect(applySchema.payload.ok).toBe(true);

            const add = await routeCall({
                pathname: `/databases/${dbId}/add`,
                method: "POST",
                body: { table: "contacts", data: { first_name: "Ada" } },
                ctx,
                psql: service
            });
            expect(add.statusCode).toBe(200);
            const rowId = String((add.payload.row as { id: string }).id);

            const update = await routeCall({
                pathname: `/databases/${dbId}/update`,
                method: "POST",
                body: { table: "contacts", id: rowId, data: { first_name: "Ada Lovelace" } },
                ctx,
                psql: service
            });
            expect(update.statusCode).toBe(200);

            const query = await routeCall({
                pathname: `/databases/${dbId}/query`,
                method: "POST",
                body: {
                    sql: 'SELECT first_name FROM "contacts" WHERE "valid_to" IS NULL'
                },
                ctx,
                psql: service
            });
            expect(query.statusCode).toBe(200);
            expect(query.payload.rows).toEqual([{ first_name: "Ada Lovelace" }]);

            const del = await routeCall({
                pathname: `/databases/${dbId}/delete`,
                method: "POST",
                body: { table: "contacts", id: rowId },
                ctx,
                psql: service
            });
            expect(del.statusCode).toBe(200);
            const deletedRow = del.payload.row as { valid_to: number };
            expect(deletedRow.valid_to).toEqual(expect.any(Number));

            const schema = await routeCall({
                pathname: `/databases/${dbId}/schema`,
                method: "GET",
                ctx,
                psql: service
            });
            expect(schema.statusCode).toBe(200);
            expect(schema.payload).toEqual({
                ok: true,
                schema: {
                    tables: [
                        {
                            name: "contacts",
                            comment: "Contact records",
                            columns: [{ name: "first_name", type: "text", comment: "Given name", nullable: false }]
                        }
                    ]
                }
            });
        } finally {
            await storage.connection.close();
        }
    });

    it("returns 503 when service is unavailable", async () => {
        const result = await routeCall({
            pathname: "/databases",
            method: "GET",
            ctx: contextForUser({ userId: "user-1" }),
            psql: null
        });

        expect(result.handled).toBe(true);
        expect(result.statusCode).toBe(503);
        expect(result.payload).toEqual({ ok: false, error: "PSQL service unavailable." });
    });

    it("returns false for unknown path", async () => {
        const result = await routeCall({
            pathname: "/not-databases",
            method: "GET",
            ctx: contextForUser({ userId: "user-1" }),
            psql: null
        });

        expect(result.handled).toBe(false);
    });
});

type RouteCallInput = {
    pathname: string;
    method: string;
    ctx: ReturnType<typeof contextForUser>;
    psql: PsqlService | null;
    body?: Record<string, unknown>;
};

async function routeCall(input: RouteCallInput): Promise<{
    handled: boolean;
    statusCode: number;
    payload: Record<string, unknown>;
}> {
    let statusCode = -1;
    let payload: Record<string, unknown> = {};

    const handled = await databasesRouteHandle(
        {
            method: input.method
        } as never,
        {} as never,
        input.pathname,
        {
            ctx: input.ctx,
            psql: input.psql,
            readJsonBody: async () => input.body ?? {},
            sendJson: (_response, code, body) => {
                statusCode = code;
                payload = body;
            }
        }
    );

    return {
        handled,
        statusCode,
        payload
    };
}

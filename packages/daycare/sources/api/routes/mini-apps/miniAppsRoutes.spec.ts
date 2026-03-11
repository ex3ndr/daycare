import { describe, expect, it, vi } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import { MiniApps } from "../../../engine/mini-apps/MiniApps.js";
import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { miniAppsRouteHandle } from "./miniAppsRoutes.js";

describe("miniAppsRouteHandle", () => {
    it("lists apps and returns launch paths", async () => {
        const storage = await storageOpenTest();
        try {
            const miniApps = new MiniApps({
                usersDir: "/tmp/daycare-mini-app-routes",
                storage
            });
            const ctx = contextForUser({ userId: "user-1" });
            await miniApps.create(ctx, {
                id: "crm",
                title: "CRM",
                icon: "browser",
                html: "<!doctype html><h1>CRM</h1>"
            });

            const list = await routeCall({
                pathname: "/mini-apps",
                method: "GET",
                ctx,
                miniApps
            });
            expect(list.statusCode).toBe(200);
            expect(list.payload).toEqual({
                ok: true,
                apps: [
                    {
                        id: "crm",
                        userId: "user-1",
                        version: 1,
                        codeVersion: 1,
                        title: "CRM",
                        icon: "browser",
                        createdAt: expect.any(Number),
                        updatedAt: expect.any(Number)
                    }
                ]
            });

            const launch = await routeCall({
                pathname: "/mini-apps/crm/launch",
                method: "GET",
                ctx,
                miniApps,
                launch: vi.fn(async () => ({ launchPath: "/mini-apps/s/token-1/", expiresAt: 123 }))
            });
            expect(launch.statusCode).toBe(200);
            expect(launch.payload).toEqual({
                ok: true,
                launchPath: "/mini-apps/s/token-1/",
                expiresAt: 123
            });
        } finally {
            await storage.connection.close();
        }
    });

    it("returns 503 when mini apps are unavailable", async () => {
        const result = await routeCall({
            pathname: "/mini-apps",
            method: "GET",
            ctx: contextForUser({ userId: "user-1" }),
            miniApps: null
        });

        expect(result.statusCode).toBe(503);
        expect(result.payload).toEqual({ ok: false, error: "Mini apps unavailable." });
    });
});

type RouteCallInput = {
    pathname: string;
    method: string;
    ctx: ReturnType<typeof contextForUser>;
    miniApps: MiniApps | null;
    launch?:
        | ((ctx: ReturnType<typeof contextForUser>, id: string) => Promise<{ launchPath: string; expiresAt: number }>)
        | null;
    body?: Record<string, unknown>;
};

async function routeCall(input: RouteCallInput): Promise<{
    statusCode: number;
    payload: Record<string, unknown>;
}> {
    let statusCode = -1;
    let payload: Record<string, unknown> = {};

    await miniAppsRouteHandle(
        {
            method: input.method
        } as never,
        {} as never,
        input.pathname,
        {
            ctx: input.ctx,
            miniApps: input.miniApps,
            launch: input.launch ?? null,
            readJsonBody: async () => input.body ?? {},
            sendJson: (_response, code, body) => {
                statusCode = code;
                payload = body;
            }
        }
    );

    return {
        statusCode,
        payload
    };
}

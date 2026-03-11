import { describe, expect, it, vi } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import { MiniApps } from "../../../engine/mini-apps/MiniApps.js";
import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { miniAppsRouteHandle } from "./miniAppsRoutes.js";

describe("miniAppsRouteHandle", () => {
    it("lists apps, icons, and returns launch paths", async () => {
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

            const icons = await routeCall({
                pathname: "/mini-apps/icons",
                method: "GET",
                ctx,
                miniApps
            });
            expect(icons.statusCode).toBe(200);
            expect(icons.payload).toEqual({
                ok: true,
                icons: expect.arrayContaining(["browser", "gear", "home"]),
                fallbackIcon: "browser"
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

    it("returns icon metadata when validation fails", async () => {
        const storage = await storageOpenTest();
        try {
            const miniApps = new MiniApps({
                usersDir: "/tmp/daycare-mini-app-routes",
                storage
            });
            const result = await routeCall({
                pathname: "/mini-apps/create",
                method: "POST",
                ctx: contextForUser({ userId: "user-1" }),
                miniApps,
                body: {
                    id: "crm",
                    title: "CRM",
                    icon: "not-a-real-icon",
                    html: "<!doctype html><h1>CRM</h1>"
                }
            });

            expect(result.statusCode).toBe(400);
            expect(result.payload).toEqual({
                ok: false,
                error: 'Invalid mini app icon "not-a-real-icon".',
                icons: expect.arrayContaining(["browser", "gear", "home"]),
                fallbackIcon: "browser"
            });
        } finally {
            await storage.connection.close();
        }
    });


    it("executes Python code in mini app context", async () => {
        const storage = await storageOpenTest();
        try {
            const miniApps = new MiniApps({
                usersDir: "/tmp/daycare-mini-app-routes-exec",
                storage
            });
            const ctx = contextForUser({ userId: "user-1" });
            await miniApps.create(ctx, {
                id: "calculator",
                title: "Calculator",
                icon: "browser",
                html: "<!doctype html><h1>Calculator</h1>"
            });

            // Test successful exec
            const execResult = await routeCall({
                pathname: "/mini-apps/calculator/exec",
                method: "POST",
                ctx,
                miniApps,
                exec: vi.fn(async () => ({
                    output: "42",
                    printOutput: ["Calculating..."],
                    toolCallCount: 1
                })),
                body: { code: "21 + 21" }
            });
            expect(execResult.statusCode).toBe(200);
            expect(execResult.payload).toEqual({
                ok: true,
                output: "42",
                printOutput: ["Calculating..."],
                toolCallCount: 1
            });

            // Test exec with error
            const errorResult = await routeCall({
                pathname: "/mini-apps/calculator/exec",
                method: "POST",
                ctx,
                miniApps,
                exec: vi.fn(async () => ({
                    output: "",
                    printOutput: [],
                    toolCallCount: 0,
                    error: "Tool not allowed"
                })),
                body: { code: "write(\"test\", \"content\")" }
            });
            expect(errorResult.statusCode).toBe(200);
            expect(errorResult.payload).toEqual({
                ok: false,
                error: "Tool not allowed",
                output: "",
                printOutput: [],
                toolCallCount: 0
            });
        } finally {
            await storage.connection.close();
        }
    });

    it("returns 503 when exec is unavailable", async () => {
        const storage = await storageOpenTest();
        try {
            const miniApps = new MiniApps({
                usersDir: "/tmp/daycare-mini-app-routes-exec-unavail",
                storage
            });
            const ctx = contextForUser({ userId: "user-1" });
            await miniApps.create(ctx, {
                id: "app",
                title: "App",
                icon: "browser",
                html: "<!doctype html><h1>App</h1>"
            });

            const result = await routeCall({
                pathname: "/mini-apps/app/exec",
                method: "POST",
                ctx,
                miniApps,
                exec: null,
                body: { code: "1 + 1" }
            });

            expect(result.statusCode).toBe(503);
            expect(result.payload).toEqual({ ok: false, error: "Mini-app exec unavailable." });
        } finally {
            await storage.connection.close();
        }
    });

    it("returns 404 when mini app not found for exec", async () => {
        const storage = await storageOpenTest();
        try {
            const miniApps = new MiniApps({
                usersDir: "/tmp/daycare-mini-app-routes-exec-notfound",
                storage
            });
            const ctx = contextForUser({ userId: "user-1" });

            const result = await routeCall({
                pathname: "/mini-apps/nonexistent/exec",
                method: "POST",
                ctx,
                miniApps,
                exec: vi.fn(async () => ({ output: "", printOutput: [], toolCallCount: 0 })),
                body: { code: "1 + 1" }
            });

            expect(result.statusCode).toBe(404);
            expect(result.payload).toEqual({ ok: false, error: "Mini app not found." });
        } finally {
            await storage.connection.close();
        }
    });

    it("returns 400 when code is empty", async () => {
        const storage = await storageOpenTest();
        try {
            const miniApps = new MiniApps({
                usersDir: "/tmp/daycare-mini-app-routes-exec-empty",
                storage
            });
            const ctx = contextForUser({ userId: "user-1" });
            await miniApps.create(ctx, {
                id: "app",
                title: "App",
                icon: "browser",
                html: "<!doctype html><h1>App</h1>"
            });

            const result = await routeCall({
                pathname: "/mini-apps/app/exec",
                method: "POST",
                ctx,
                miniApps,
                exec: vi.fn(async () => ({ output: "", printOutput: [], toolCallCount: 0 })),
                body: { code: "   " }
            });

            expect(result.statusCode).toBe(400);
            expect(result.payload).toEqual({ ok: false, error: "Code is required." });
        } finally {
            await storage.connection.close();
        }
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
    exec?:
        | ((ctx: ReturnType<typeof contextForUser>, appId: string, code: string) => Promise<{ output: string; printOutput: string[]; toolCallCount: number; error?: string }>)
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
            exec: input.exec,
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
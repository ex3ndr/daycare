import { describe, expect, it, vi } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import { fragmentsRouteHandle } from "./fragmentsRoutes.js";

describe("fragmentsRouteHandle", () => {
    it("routes list, read, create, update, and archive endpoints", async () => {
        const repo = {
            findAll: vi.fn(async () => []),
            findAnyById: vi.fn(async () => ({
                id: "fragment-1",
                userId: "user-1",
                version: 1,
                validFrom: 1,
                validTo: null,
                kitVersion: "1",
                title: "Profile",
                description: "",
                spec: {},
                archived: false,
                createdAt: 1,
                updatedAt: 1
            })),
            create: vi.fn(async () => ({
                id: "fragment-1",
                userId: "user-1",
                version: 1,
                validFrom: 1,
                validTo: null,
                kitVersion: "1",
                title: "Profile",
                description: "",
                spec: {},
                archived: false,
                createdAt: 1,
                updatedAt: 1
            })),
            update: vi.fn(async () => ({
                id: "fragment-1",
                userId: "user-1",
                version: 2,
                validFrom: 2,
                validTo: null,
                kitVersion: "1",
                title: "Profile v2",
                description: "",
                spec: {},
                archived: false,
                createdAt: 1,
                updatedAt: 2
            })),
            archive: vi.fn(async () => ({
                id: "fragment-1"
            }))
        } as never;

        const list = await routeCall({
            pathname: "/fragments",
            method: "GET",
            fragments: repo
        });
        expect(list.handled).toBe(true);
        expect(list.statusCode).toBe(200);
        expect(list.payload).toEqual({ ok: true, fragments: [] });

        const read = await routeCall({
            pathname: "/fragments/fragment-1",
            method: "GET",
            fragments: repo
        });
        expect(read.statusCode).toBe(200);
        expect(read.payload.ok).toBe(true);

        const create = await routeCall({
            pathname: "/fragments/create",
            method: "POST",
            fragments: repo,
            body: {
                id: "fragment-1",
                kitVersion: "1",
                title: "Profile",
                spec: { root: "main", elements: { main: { type: "View", props: {}, children: [] } } }
            }
        });
        expect(create.statusCode).toBe(200);
        expect(create.payload.ok).toBe(true);

        const update = await routeCall({
            pathname: "/fragments/fragment-1/update",
            method: "POST",
            fragments: repo,
            body: { title: "Profile v2" }
        });
        expect(update.statusCode).toBe(200);
        expect(update.payload.ok).toBe(true);

        const archive = await routeCall({
            pathname: "/fragments/fragment-1/archive",
            method: "POST",
            fragments: repo
        });
        expect(archive.statusCode).toBe(200);
        expect(archive.payload).toEqual({ ok: true });
    });

    it("returns 503 when repository is unavailable and false for unknown paths", async () => {
        const unavailable = await routeCall({
            pathname: "/fragments",
            method: "GET",
            fragments: null
        });
        expect(unavailable.handled).toBe(true);
        expect(unavailable.statusCode).toBe(503);
        expect(unavailable.payload).toEqual({ ok: false, error: "Fragments repository unavailable." });

        const unknown = await routeCall({
            pathname: "/not-fragments",
            method: "GET",
            fragments: null
        });
        expect(unknown.handled).toBe(false);
    });
});

type RouteCallInput = {
    pathname: string;
    method: string;
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
            ctx: contextForUser({ userId: "user-1" }),
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

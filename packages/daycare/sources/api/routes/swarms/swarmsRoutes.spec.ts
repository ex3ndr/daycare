import { describe, expect, it } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import type { Secret } from "../../../engine/secrets/secretTypes.js";
import { swarmsRouteHandle } from "./swarmsRoutes.js";

describe("swarmsRouteHandle", () => {
    it("routes swarm secrets endpoints", async () => {
        const store = new Map<string, Secret[]>();
        store.set("owner-1", [
            {
                name: "owner-secret",
                displayName: "Owner Secret",
                description: "desc",
                variables: { KEY: "owner" }
            }
        ]);

        const listBefore = await routeCall({
            pathname: "/swarms/reviewer/secrets",
            method: "GET",
            store
        });
        expect(listBefore.handled).toBe(true);
        expect(listBefore.statusCode).toBe(200);
        expect(listBefore.payload).toEqual({ ok: true, secrets: [] });

        const create = await routeCall({
            pathname: "/swarms/reviewer/secrets/create",
            method: "POST",
            body: {
                name: "swarm-key",
                displayName: "Swarm Key",
                description: "desc",
                variables: { API_KEY: "secret" }
            },
            store
        });
        expect(create.statusCode).toBe(200);
        expect(create.payload.ok).toBe(true);

        const copy = await routeCall({
            pathname: "/swarms/reviewer/secrets/copy",
            method: "POST",
            body: { secret: "owner-secret" },
            store
        });
        expect(copy.statusCode).toBe(200);
        expect(copy.payload).toEqual({
            ok: true,
            swarmUserId: "swarm-1",
            secret: "owner-secret"
        });

        const update = await routeCall({
            pathname: "/swarms/reviewer/secrets/swarm-key/update",
            method: "POST",
            body: { description: "updated" },
            store
        });
        expect(update.statusCode).toBe(200);
        expect(update.payload.ok).toBe(true);

        const remove = await routeCall({
            pathname: "/swarms/reviewer/secrets/swarm-key/delete",
            method: "POST",
            store
        });
        expect(remove.statusCode).toBe(200);
        expect(remove.payload).toEqual({ ok: true, deleted: true });

        const listAfter = await routeCall({
            pathname: "/swarms/reviewer/secrets",
            method: "GET",
            store
        });
        expect(listAfter.statusCode).toBe(200);
        expect(listAfter.payload.ok).toBe(true);
    });

    it("returns false for unknown paths and 503 for unavailable runtime", async () => {
        const unknown = await routeCall({
            pathname: "/not-swarms",
            method: "GET",
            usersEnabled: true,
            secretsEnabled: true
        });
        expect(unknown.handled).toBe(false);

        const unavailable = await routeCall({
            pathname: "/swarms/reviewer/secrets",
            method: "GET",
            usersEnabled: false,
            secretsEnabled: false
        });
        expect(unavailable.handled).toBe(true);
        expect(unavailable.statusCode).toBe(503);
        expect(unavailable.payload).toEqual({
            ok: false,
            error: "Swarms runtime unavailable."
        });
    });
});

type RouteCallInput = {
    pathname: string;
    method: string;
    body?: Record<string, unknown>;
    store?: Map<string, Secret[]>;
    usersEnabled?: boolean;
    secretsEnabled?: boolean;
};

async function routeCall(input: RouteCallInput): Promise<{
    handled: boolean;
    statusCode: number;
    payload: Record<string, unknown>;
}> {
    let statusCode = -1;
    let payload: Record<string, unknown> = {};
    const store = input.store ?? new Map<string, Secret[]>();
    const usersEnabled = input.usersEnabled ?? true;
    const secretsEnabled = input.secretsEnabled ?? true;

    const handled = await swarmsRouteHandle(
        {
            method: input.method
        } as never,
        {} as never,
        input.pathname,
        {
            ctx: contextForUser({ userId: "owner-1" }),
            readJsonBody: async () => input.body ?? {},
            sendJson: (_response, code, body) => {
                statusCode = code;
                payload = body;
            },
            users: usersEnabled
                ? ({
                      findById: async (id: string) =>
                          id === "owner-1" ? { id: "owner-1", isOwner: true } : { id, isOwner: false },
                      findByNametag: async (nametag: string) =>
                          nametag === "reviewer" ? { id: "swarm-1", isSwarm: true, parentUserId: "owner-1" } : null
                  } as never)
                : null,
            secrets: secretsEnabled
                ? ({
                      list: async (ctx: { userId: string }) => store.get(ctx.userId) ?? [],
                      add: async (ctx: { userId: string }, secret: Secret) => {
                          const current = [...(store.get(ctx.userId) ?? [])];
                          const index = current.findIndex((entry) => entry.name === secret.name);
                          if (index >= 0) {
                              current[index] = secret;
                          } else {
                              current.push(secret);
                          }
                          store.set(ctx.userId, current);
                      },
                      remove: async (ctx: { userId: string }, name: string) => {
                          const current = [...(store.get(ctx.userId) ?? [])];
                          const next = current.filter((entry) => entry.name !== name);
                          store.set(ctx.userId, next);
                          return next.length !== current.length;
                      }
                  } as never)
                : null
        }
    );

    return { handled, statusCode, payload };
}

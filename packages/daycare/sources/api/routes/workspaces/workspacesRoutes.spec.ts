import { describe, expect, it } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import type { Secret } from "../../../engine/secrets/secretTypes.js";
import { workspacesRouteHandle } from "./workspacesRoutes.js";

describe("workspacesRouteHandle", () => {
    it("routes workspace secrets endpoints", async () => {
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
            pathname: "/workspaces/reviewer/secrets",
            method: "GET",
            store
        });
        expect(listBefore.handled).toBe(true);
        expect(listBefore.statusCode).toBe(200);
        expect(listBefore.payload).toEqual({ ok: true, secrets: [] });

        const create = await routeCall({
            pathname: "/workspaces/reviewer/secrets/create",
            method: "POST",
            body: {
                name: "workspace-key",
                displayName: "Workspace Key",
                description: "desc",
                variables: { API_KEY: "secret" }
            },
            store
        });
        expect(create.statusCode).toBe(200);
        expect(create.payload.ok).toBe(true);

        const copy = await routeCall({
            pathname: "/workspaces/reviewer/secrets/copy",
            method: "POST",
            body: { secret: "owner-secret" },
            store
        });
        expect(copy.statusCode).toBe(200);
        expect(copy.payload).toEqual({
            ok: true,
            workspaceUserId: "workspace-1",
            secret: "owner-secret"
        });

        const update = await routeCall({
            pathname: "/workspaces/reviewer/secrets/workspace-key/update",
            method: "POST",
            body: { description: "updated" },
            store
        });
        expect(update.statusCode).toBe(200);
        expect(update.payload.ok).toBe(true);

        const remove = await routeCall({
            pathname: "/workspaces/reviewer/secrets/workspace-key/delete",
            method: "POST",
            store
        });
        expect(remove.statusCode).toBe(200);
        expect(remove.payload).toEqual({ ok: true, deleted: true });

        const listAfter = await routeCall({
            pathname: "/workspaces/reviewer/secrets",
            method: "GET",
            store
        });
        expect(listAfter.statusCode).toBe(200);
        expect(listAfter.payload.ok).toBe(true);
    });

    it("routes members and invite endpoints", async () => {
        const invite = await routeCall({
            pathname: "/workspaces/reviewer/invite/create",
            method: "POST",
            workspaceMembersApiEnabled: true
        });
        expect(invite.statusCode).toBe(200);
        expect(invite.payload).toMatchObject({
            ok: true,
            url: expect.stringContaining("/invite#"),
            token: expect.any(String),
            expiresAt: expect.any(Number)
        });

        const members = await routeCall({
            pathname: "/workspaces/reviewer/members",
            method: "GET",
            workspaceMembersApiEnabled: true
        });
        expect(members.statusCode).toBe(200);
        expect(members.payload).toEqual({
            ok: true,
            members: [
                {
                    userId: "owner-1",
                    nametag: "owner-1",
                    firstName: null,
                    lastName: null,
                    joinedAt: 1,
                    isOwner: true
                },
                {
                    userId: "member-2",
                    nametag: "member-2",
                    firstName: null,
                    lastName: null,
                    joinedAt: 2,
                    isOwner: false
                }
            ]
        });

        const kicked = await routeCall({
            pathname: "/workspaces/reviewer/members/member-2/kick",
            method: "POST",
            body: { reason: "cleanup" },
            workspaceMembersApiEnabled: true
        });
        expect(kicked.statusCode).toBe(200);
        expect(kicked.payload).toEqual({ ok: true });
    });

    it("returns false for unknown paths and 503 for unavailable runtime", async () => {
        const unknown = await routeCall({
            pathname: "/not-workspaces",
            method: "GET",
            usersEnabled: true,
            secretsEnabled: true
        });
        expect(unknown.handled).toBe(false);

        const unavailable = await routeCall({
            pathname: "/workspaces/reviewer/secrets",
            method: "GET",
            usersEnabled: false,
            secretsEnabled: false
        });
        expect(unavailable.handled).toBe(true);
        expect(unavailable.statusCode).toBe(503);
        expect(unavailable.payload).toEqual({
            ok: false,
            error: "Workspaces runtime unavailable."
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
    workspaceMembersApiEnabled?: boolean;
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
    const activeMembers = input.workspaceMembersApiEnabled ? new Set(["member-2"]) : new Set<string>();

    const handled = await workspacesRouteHandle(
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
                          id === "workspace-1"
                              ? {
                                    id: "workspace-1",
                                    nametag: "reviewer",
                                    isWorkspace: true,
                                    workspaceOwnerId: "owner-1",
                                    createdAt: 1
                                }
                              : id === "owner-1"
                                ? { id: "owner-1", nametag: "owner-1", firstName: null, lastName: null }
                                : { id, nametag: id, firstName: null, lastName: null },
                      findByNametag: async (nametag: string) =>
                          nametag === "reviewer"
                              ? {
                                    id: "workspace-1",
                                    nametag: "reviewer",
                                    firstName: "Reviewer",
                                    lastName: null,
                                    createdAt: 1,
                                    isWorkspace: true,
                                    workspaceOwnerId: "owner-1"
                                }
                              : null
                  } as never)
                : null,
            workspaceMembers: usersEnabled
                ? ({
                      findByUser: async () => [],
                      findByWorkspace: async () =>
                          activeMembers.has("member-2")
                              ? [
                                    {
                                        id: 1,
                                        workspaceId: "workspace-1",
                                        userId: "member-2",
                                        joinedAt: 2,
                                        leftAt: null,
                                        kickReason: null
                                    }
                                ]
                              : [],
                      isMember: async () => false,
                      kick: async (_workspaceId: string, userId: string) => {
                          activeMembers.delete(userId);
                      }
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
                : null,
            publicEndpoints: {
                appEndpoint: "https://app.example.com",
                serverEndpoint: "https://api.example.com"
            },
            secretResolve: async () => "test-secret"
        }
    );

    return { handled, statusCode, payload };
}
